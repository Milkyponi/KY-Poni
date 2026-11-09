# Laporan Investigasi Teknis: Reset Preferensi & Kejanggalan Tema Unduhan Pasca-Update

- **Proyek**: KY-Poni (Livestream Chat Overlay Studio)
- **Investigator**: Fonzy (Kepala Divisi Software Development & Vibe Coding)
- **Tanggal Audit**: 9 November 2026
- **Status Kode Saat Audit**: Branch `main` (commit `6b6b91c`, v0.9.0-alpha)
- **Metode Pembuktian**: Uji dinamis sandbox terisolasi, simulasi update v0.8.0 ➔ v0.9.0 via AppImage asli, inspeksi binary ASAR, simulasi dashboard berbasis browser nyata, dan audit source code.

---

## 1. Ringkasan Eksekutif

Hasil investigasi membuktikan bahwa **file preferensi (`config.json`) maupun folder tema unduhan (`~/.config/ky-poni/themes/`) sebenarnya TIDAK terhapus oleh proses update aplikasi**. 

Yang sebenarnya terjadi adalah **dua bug berantai pada logika inisialisasi frontend (dashboard) dan migrasi ID katalog**:
1. **Bug Urutan Muat (*Race Condition* di Frontend)**: Saat aplikasi dibuka, dashboard membaca preferensi user **sebelum** daftar tema yang terpasang selesai diambil dari disk. Akibatnya, dashboard mengira tema unduhan milik user "tidak valid", lalu secara otomatis beralih paksa (*fallback*) ke tema bawaan pertama (`classic`), lalu memicu auto-save yang **menimpa file preferensi asli di disk dalam waktu 500 milidetik tanpa interaksi user sama sekali**.
2. **Bug Timpa Otomatis Preset Tema**: Setiap kali tema berubah (termasuk saat terjadi fallback paksa pada poin 1), fungsi `applyThemePresets()` langsung menimpa pilihan font, warna teks, dan ukuran font milik user kembali ke nilai default bawaan tema tersebut.
3. **Ilusi Tema Terhapus (Perubahan ID Tema `cyberpunk-2077` ➔ `cyberpunk2077`)**: File tema unduhan tetap utuh di disk, tetapi karena ID katalog diubah tanpa skrip migrasi, tema dengan ID lama tidak lagi dikenali oleh antarmuka katalog baru, sehingga tombolnya kembali bertuliskan "Instal & Pasang" seolah belum pernah diinstal.

---

## 2. Bedah Akar Masalah (Root Cause Analysis)

### Root Cause 1: Urutan Eksekusi Startup Frontend (`src/public/dashboard.js`)

Perhatikan baris 1040–1046 pada `src/public/dashboard.js`:

```javascript
// Startup Initialization
loadSavedConfig().then(async () => {
  await loadThemes();
  await loadCatalog();
  setupUpdaterWS();
  checkUpdateAuto();
  setInterval(pollStatus, 5000);
});
```

#### Alur Bug yang Terjadi Saat Aplikasi Dibuka:
1. **Detik 0.0**: `loadSavedConfig()` dipanggil terlebih dahulu. Fungsi ini melakukan `fetch('/api/config')` dan menerima data tersimpan, misalnya:
   ```json
   {
     "theme": "cyberpunk2077",
     "fontFamily": "Chakra Petch",
     "scale": 130
   }
   ```
2. **Detik 0.05**: `loadSavedConfig()` mencoba mengisi dua dropdown sekaligus:
   ```javascript
   if (cfg.theme && selectTheme) selectTheme.value = cfg.theme;
   if (cfg.fontFamily && selectFont) selectFont.value = cfg.fontFamily;
   ```
   **MASALAH KRUSIAL**: Pada saat ini, fungsi `loadThemes()` **BELUM SELESAI DIJALANKAN**! Saat itu kedua dropdown di HTML masih berisi pilihan hardcoded versi lama:
   - `#select-theme`: hanya `persona5`, `persona3reload`, `classic`
   - `#select-font`: hanya `OptimaNova`, `Space Grotesk`, `Bebas Neue`, `Inter`, `Bangers`, `Montserrat`, `VT323`
   
   Karena opsi `cyberpunk2077` dan font `Chakra Petch` belum ada di dalam elemen `<select>`, perintah penugasan `.value` tersebut **GAGAL SECARA SENYAP** — browser mengosongkan nilai menjadi string kosong (`""`), bukan mempertahankan nilai lama.
3. **Detik 0.08**: `loadSavedConfig()` memanggil `updateOverlayParams()` di baris terakhirnya:
   ```javascript
   function updateOverlayParams() {
     const theme = selectTheme.value; // nilainya BUKAN cyberpunk2077, melainkan default hardcoded!
     ...
     if (saveConfigTimeout) clearTimeout(saveConfigTimeout);
     saveConfigTimeout = setTimeout(saveUserConfig, 500); // Memicu auto-save!
   }
   ```
4. **Detik 0.15**: Fungsi `loadThemes()` akhirnya selesai mengambil tema dari disk dan mengisi dropdown secara lengkap. Namun di dalam `loadThemes()` baris 533–535 ada kode berikut:
   ```javascript
   const currentVal = selectTheme.value;
   ...
   if (!Array.from(selectTheme.options).some(o => o.value === currentVal) && data.themes.length > 0) {
     selectTheme.value = data.themes[0].id; // Fallback ke elemen pertama: "classic"
   }
   ```
   Karena `currentVal` sebelumnya gagal diisi oleh `loadSavedConfig()`, kode ini mengunci tema ke `classic` (elemen index 0).
5. **Detik 0.58**: Timer 500ms dari langkah ke-3 selesai, dan `saveUserConfig()` dieksekusi:
   ```javascript
   async function saveUserConfig() {
     const config = {
       theme: selectTheme ? selectTheme.value : 'persona5', // Kini bernilai "classic"
       ...
     };
     await fetch('/api/config', { method: 'POST', body: JSON.stringify(config) });
   }
   ```
   **HASILNYA**: File `~/.config/ky-poni/config.json` di disk yang tadinya menyimpan tema pilihan user (`cyberpunk2077`) **DITIMPA SECARA OTOMATIS** menjadi `classic`! User baru saja membuka aplikasi selama 1 detik, tetapi preferensinya sudah rusak sebelum sempat mengklik apa pun.

---

### Root Cause 2: Mekanisme Timpa Paksa Preset Tema (`applyThemePresets`)

Di dalam `src/public/dashboard.js`, setiap kali tema berganti:
```javascript
selectTheme.addEventListener('change', () => {
  applyThemePresets(selectTheme.value);
  updateOverlayParams();
});
```

Dan fungsi `applyThemePresets()`:
```javascript
function applyThemePresets(themeId) {
  const themeMeta = installedThemesMap.get(themeId);
  if (!themeMeta || !themeMeta.presets) return;
  const p = themeMeta.presets;

  if (p.fontFamily && selectFont) selectFont.value = p.fontFamily;
  if (p.fontSize && inputFsize && labelFsizeVal) {
    inputFsize.value = p.fontSize;
    labelFsizeVal.textContent = `${p.fontSize}px`;
  }
  if (p.textColor && inputColor && inputColorHex) {
    inputColor.value = p.textColor;
    inputColorHex.value = p.textColor.toUpperCase();
  }
  if (p.recommendedLayout && selectLayout) { ... }
}
```

#### Efek Samping:
- Ketika Root Cause 1 memicu perubahan tema otomatis ke `classic`, `applyThemePresets('classic')` langsung menimpa font kustom user (misal `Bebas Neue` atau `VT323`) kembali ke `Inter`, dan warna font kembali ke putih `#FFFFFF`.
- Selain itu, jika seorang streamer sengaja mengatur:
  - Tema: Persona 5
  - Font: Bebas Neue (karena suka gaya komik tebal)
  - Warna: Kuning `#FFE600`
  Saat aplikasi restart atau tema di-klik ulang, preferensi font & warna yang sudah diatur streamer akan **terhapus dan dipaksa kembali ke preset bawaan**.

---

### Root Cause 3: Perubahan Skema ID Tema Tanpa Migrasi Bersih

Saat KY-Poni beralih dari v0.4.x ke v0.6.0+, penamaan ID tema di katalog diubah:
- Versi lama: `cyberpunk-2077` dan `undertale-box`
- Versi baru: `cyberpunk2077` dan `undertale`

#### Dampak ke Pengguna yang Melakukan Update:
- Folder fisik di komputer user bernama `~/.config/ky-poni/themes/cyberpunk-2077/`.
- Katalog baru di v0.6.0+ mencari folder bernama `~/.config/ky-poni/themes/cyberpunk2077/`.
- Karena nama foldernya tidak cocok, fungsi `getInstalledThemes()` di `theme_manager.js` menganggap tema `cyberpunk2077` **BELUM TERPASANG** (`installed: false`).
- Di dashboard katalog, kartu tema Cyberpunk menampilkan tombol **"⚡ Instal & Pasang"** alih-alih **"✓ Terpasang"** atau **"⚡ Gunakan Tema Ini"**.
- Pengguna merasa temanya "terhapus", padahal file fisiknya masih utuh di disk, hanya saja menjadi folder yatim (*orphaned directory*).

---

### Root Cause 4: Auto-Save Prematur Saat Memuat Konfigurasi

Pada fungsi `loadSavedConfig()`:
```javascript
async function loadSavedConfig() {
  ...
  updateOverlayParams(); // ⚠️ INI MEMICU saveConfigTimeout (500ms)
}
```
`loadSavedConfig` bertujuan untuk **MEMBACA** data dari disk ke tampilan UI. Namun karena di akhir fungsi ia memanggil `updateOverlayParams()`, fungsi tersebut menjadwalkan penyimpanan kembali ke disk (`saveUserConfig`).

Jika salah satu elemen UI belum siap atau sedang dalam keadaan transisi, nilai yang setengah matang akan langsung disimpan ke disk. Seharusnya proses membaca (*read/load*) murni hanya memuat tampilan, tanpa memicu penulisan balik (*write/save*).

---

## 3. Bukti Pengujian Nyata (Evidence Matrix)

Seluruh pengujian dilakukan pada lingkungan Fedora Workstation dengan instance proses biner AppImage asli dan isolated home directory:

| Skenario Uji | Kondisi Awal di Disk | Tindakan | Hasil Aktual (Sebelum Perbaikan) | Status Bug |
|---|---|---|---|---|
| **Test 1: Restart App dengan Tema Unduhan** | `theme: "cyberpunk2077"`, `scale: 130`, file tema lengkap di disk | Jalankan KY-Poni, biarkan 10 detik tanpa klik apa pun | File disk berubah otomatis jadi `theme: "classic"`, `fontFamily: "Agane"`. MD5 file berubah. | **CONFIRMED BUG** (Root Cause 1 & 4) |
| **Test 2: Update In-Place v0.8 ➔ v0.9** | Tema `undertale` terpasang di user data, biner v0.8 berjalan | Panggil `/api/updater/restart` dengan biner v0.9 | Folder `undertale` tetap ada di disk, tapi tema aktif di-reset ke `classic`. | **CONFIRMED BUG** (Root Cause 1) |
| **Test 3: Tema Bawaan (Persona 5) Restart** | `theme: "persona5"`, `scale: 130`, `textColor: "#00FF00"` | Jalankan KY-Poni, biarkan 10 detik | Tema tetap `persona5`, skala & warna bertahan karena `persona5` ada di HTML hardcoded. | **KONTROL VALID** (Membuktikan bug hanya menyerang tema non-hardcoded) |
| **Test 4: Deteksi Folder Tema Lama** | Folder `cyberpunk-2077` ada di disk | Buka katalog tema | Kartu Cyberpunk bertuliskan "Instal & Pasang" (status `installed: false`). | **CONFIRMED BUG** (Root Cause 3) |

---

## 4. Rencana Solusi Arsitektur (Action Plan)

Perbaikan ini akan menyelesaikan akar masalah secara tuntas dan permanen tanpa merusak arsitektur yang sudah ada:

### Solusi 1: Balik Urutan Inisialisasi Startup (`src/public/dashboard.js`)
Ubah urutan muat menjadi:
```
1. loadThemes() ➔ scan folder disk & isi dropdown #select-theme secara lengkap (termasuk tema kustom)
2. loadSavedConfig({ silent: true }) ➔ pasang nilai yang tersimpan ke dropdown yang sudah lengkap
3. loadCatalog() ➔ render showcase grid katalog
```
Dengan urutan ini, saat `loadSavedConfig()` memasang nilai `selectTheme.value = cfg.theme`, opsi tema unduhan **sudah ada** di dalam dropdown, sehingga tidak akan pernah terjadi fallback paksa ke `classic`.

### Solusi 2: Tambahkan Flag `isInitialLoad` Anti-Auto-Save Prematur
Buat flag boolean `isInitialLoad = true` saat startup. Fungsi `updateOverlayParams()` hanya boleh memanggil `saveUserConfig()` jika `!isInitialLoad` dan dipicu oleh interaksi user asli (`change` / `input`).

### Solusi 3: Pisahkan "Ganti Tema" vs "Terapkan Preset"
Preset tema (font, ukuran, warna bawaan) hanya diterapkan secara otomatis jika:
1. User mengklik tombol **"⚡ Instal & Pasang"** pertama kali di katalog.
2. User mengklik tombol baru: **"↺ Reset ke Preset Bawaan Tema"**.

Saat user sekadar memilih tema dari dropdown atau saat aplikasi baru dibuka, preferensi font dan warna pilihan user **tidak boleh ditimpa secara paksa**.

### Solusi 4: Migrasi Otomatis Folder Tema Warisan (*Legacy Folder Migration*)
Pada `ThemeManager.resolveUserThemesDir()` atau saat scan direktori:
- Jika folder `cyberpunk-2077` ditemukan tetapi `cyberpunk2077` belum ada, lakukan `fs.renameSync` secara otomatis ke `cyberpunk2077`.
- Jika folder `undertale-box` ditemukan, otomatis migrasi ke `undertale`.
Dengan demikian, pengguna versi lama yang meng-update aplikasinya langsung melihat tema mereka dalam status **"✓ Terpasang"** tanpa harus mengunduh ulang.

---

Dokumen ini disimpan di:
`/home/milkyponi/Documents/Milky Brain/07_PROJECTS/KY-Poni/INVESTIGATION_PREFERENCES_UPDATE_BUG.md`
