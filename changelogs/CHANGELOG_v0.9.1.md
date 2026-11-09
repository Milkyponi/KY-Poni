# Changelog KY-Poni v0.9.1

**Rilis**: 9 November 2026
**Tipe**: Bugfix — Persistence & Cross-Platform Hardening
**Fokus**: Preferensi pengguna & tema unduhan tidak lagi hilang setelah aplikasi di-update.

---

## 🐛 Perbaikan Utama

### 1. Preferensi tidak lagi kembali ke default setelah update/restart

**Gejala lapangan:** Aplikasi bisa mengingat preferensi, tetapi setelah versi baru dipasang, semua preferensi (tema, font, skala, warna) kembali ke setelan pabrik.

**Akar masalah:** Dashboard memuat preferensi tersimpan **sebelum** daftar tema terpasang selesai dibangun. Saat sebuah tema unduhan belum ada di elemen `<select>`, penugasan nilai gagal secara senyap dan browser mengosongkan pilihan. Lima ratus milidetik kemudian, fungsi auto-save menulis nilai kosong itu ke disk — menimpa preferensi asli pengguna tanpa satu pun klik.

**Perbaikan:**
- Urutan boot dibalik: `loadThemes()` **selalu** selesai lebih dulu, baru `applyConfigToUI()` memasang nilai tersimpan.
- Ditambahkan guard `isBootstrapping` — aplikasi tidak boleh menulis konfigurasi selama proses boot.
- `updateOverlayParams()` dipisah dari persistensi lewat `scheduleSave()`; render dan simpan tidak lagi bercampur dalam satu fungsi.
- `loadSavedConfig()` / `applyConfigToUI()` dijamin bebas operasi tulis (diverifikasi oleh test statis).

### 2. Preferensi font & warna streamer tidak lagi tertimpa saat ganti tema

**Gejala lapangan:** Streamer mengatur font dan warna favorit, lalu berpindah tema — pengaturan tipografinya hilang dan kembali ke default tema baru.

**Akar masalah:** `applyThemePresets()` dipanggil pada setiap event `change` dropdown tema, termasuk saat aplikasi sendiri yang mengganti tema secara otomatis.

**Perbaikan:**
- Ganti tema dari dropdown = murni ganti tampilan. Font, ukuran, dan warna milik pengguna dihormati.
- Preset tema hanya diterapkan pada dua aksi eksplisit: **instal tema baru** dan tombol baru **↺ Preset Tema** di kartu katalog.
- Reset preferensi pabrik kini melakukan flush langsung, tidak menunggu debounce.

### 3. Tema unduhan tidak lagi "hilang" setelah update

**Gejala lapangan:** Setelah update, tema yang sudah diunduh berubah status menjadi "belum terpasang" dan pengguna diminta mengunduh ulang.

**Akar masalah:** ID tema di katalog berubah pada v0.6.0 (`cyberpunk-2077` → `cyberpunk2077`, `undertale-box` → `undertale`) tanpa migrasi folder. Folder lama tetap ada di disk tetapi tidak dikenali. Diperparah oleh `theme.json` di dalam paket lama yang masih membawa ID lama sehingga menimpa ID folder saat pemindaian.

**Perbaikan:**
- Modul baru `src/theme_ids.js` sebagai satu sumber kebenaran pemetaan ID lama → kanonik.
- `ThemeManager.migrateLegacyThemeDirs()` otomatis mengganti nama folder lama saat boot, dengan fallback *copy + remove* untuk Windows (EPERM/EBUSY).
- Nama folder kini otoritatif: `theme.json` yang masih membawa ID lama tidak bisa lagi menimpa identitas tema.
- `ConfigManager.getConfig()` menormalkan ID lama yang tersimpan di `config.json`, tanpa menulis ulang file saat boot.
- `getThemePath()` menerima ID lama maupun baru, sehingga URL/aset lama tetap resolve.

### 4. Handle YouTube kini tersimpan sendiri

Sebelumnya `@handle` hanya ikut tersimpan bila pengguna menyentuh kontrol lain. Kini punya listener debounce sendiri.

### 5. Penulisan konfigurasi dibuat atomik

`config.json` ditulis lewat *temp file + rename*. Crash di tengah penulisan tidak lagi bisa meninggalkan file JSON terpotong. Pada Windows, kegagalan rename (file terkunci antivirus/Explorer) jatuh ke penulisan langsung dengan pembersihan temp file.

---

## 🪟 Kompatibilitas Windows

Perbaikan ini **tidak** Linux-only. Gate verifikasi Windows:

| Pemeriksaan | Hasil |
|---|---|
| Lokasi config `%APPDATA%\KY-Poni\config.json` (nama kapital) | ✅ |
| Folder tema `%APPDATA%\KY-Poni\themes\` | ✅ |
| Fallback `<home>\AppData\Roaming` saat `APPDATA` kosong | ✅ |
| Preferensi bertahan setelah restart penuh | ✅ |
| Penulisan atomik tanpa sisa `.tmp` | ✅ |
| Fallback saat rename terkunci (EPERM) | ✅ |
| Migrasi folder `cyberpunk-2077` → `cyberpunk2077` | ✅ |
| Fallback copy+remove saat `renameSync` EBUSY | ✅ |
| `theme.json` ber-ID basi tidak merusak deteksi | ✅ |
| Normalisasi ID lama saat baca config | ✅ |
| Boot tidak menulis ulang config | ✅ |
| Hapus tema tidak meninggalkan folder yatim | ✅ |
| Tema inti tidak bisa dihapus | ✅ |

Bukti tambahan: biner `KY-Poni 0.9.1.exe` dieksekusi di Wine dan benar-benar membuat `C:\users\<user>\AppData\Roaming\KY-Poni\config.json` + folder `themes`, serta menjalankan migrasi folder lama pada path Windows.

---

## 🧪 Test Baru (masuk `npm test`)

| Suite | Cakupan |
|---|---|
| `test/test_persistence.js` | 17 assertion — path lintas OS, round-trip preferensi, atomic write, config korup, migrasi folder, idempotensi |
| `test/test_dashboard_boot.js` | 13 assertion — kontrak urutan boot, anti save-on-load, preset tidak menimpa, tombol reset preset |
| `test/test_windows_compat.js` | 14 assertion — simulasi win32 penuh termasuk fallback lock Windows |

Total gate: **11 (server) + anti-RTO + 44 assertion baru** — semuanya hijau.

---

## 📦 Artefak

- `KY-Poni-0.9.1.AppImage` (Linux)
- `KY-Poni 0.9.1.exe` (Windows portable)

## 🔁 Kompatibilitas Mundur

- Pengguna lama dengan folder `cyberpunk-2077` / `undertale-box` dimigrasi otomatis saat boot pertama.
- Config lama yang menyimpan ID lama tetap terbaca dan langsung dipetakan ke ID baru.
- Tidak ada perubahan format file konfigurasi; pengguna bisa downgrade tanpa kehilangan data.
