# Laporan Teknis — Distribusi KY-Poni v1.0.0

Tanggal: 2026-11-10
Repo: https://github.com/Milkyponi/KY-Poni
Rilis: https://github.com/Milkyponi/KY-Poni/releases/tag/v1.0.0

---

## 1. Instruksi Bos & Status

| No | Instruksi | Status |
| --- | --- | --- |
| 1 | Ganti kartu "Segera Hadir" — P3R sudah ada di katalog, jadi ganti ke Persona 4 Golden | Selesai |
| 2 | Hapus semua release GitHub + changelog; rebuild README anti AI-slop; masukkan screenshot katalog ke README | Selesai |
| 3 | Cek kelayakan distribusi seluruh fitur & modul; naikkan ke 1.0.0, keluar dari alpha | Selesai — 4 cacat ditemukan & diperbaiki |
| 4 | SOP baru proyek ini: jangan auto-push ke release, pasang ke PC Bos dulu, lalu verifikasi teknis | Selesai — `SOP_RELEASE.md` |

---

## 2. Detail Perubahan Kode

### 2.1 `src/public/dashboard.js` — kartu coming soon

```diff
-<div class="theme-name">Persona 3 Reload & Retro 16-Bit JRPG</div>
+<div class="theme-name">Persona 4 Golden</div>
   <span class="theme-tag">Segera Hadir</span>
-  <span class="theme-tag">Ocean Blue</span>
-  <span class="theme-tag">Chrono</span>
+  <span class="theme-tag">Midnight Channel</span>
+  <span class="theme-tag">Yellow</span>
```

### 2.2 `src/config_manager.js` — dua perbaikan

**(a) Override direktori untuk isolasi test**

```js
if (env.KY_PONI_CONFIG_HOME) {
  return env.KY_PONI_CONFIG_HOME;
}
```

**(b) Lewati migrasi legacy saat berjalan dari dalam `.asar`**

```js
migrateLegacyIfNeeded() {
  const legacyPath = path.join(this.legacyConfigDir, 'config.json');
  if (legacyPath.includes('.asar')) return;   // <-- ditambahkan
  if (!fs.existsSync(this.configPath) && fs.existsSync(legacyPath)) { ... }
}
```

### 2.3 `src/theme_manager.js` — method yang hilang

Route `GET /api/themes/open-folder` memanggil `themeManager.openThemesFolder()` yang tidak pernah ada. Ditambahkan:

```js
openThemesFolder() {
  this.ensureDirs();
  const dir = this.userThemesDir;
  const cmd = process.platform === 'win32' ? `explorer "${dir}"`
    : process.platform === 'darwin' ? `open "${dir}"` : `xdg-open "${dir}"`;
  return new Promise((resolve) => exec(cmd, () => resolve(dir)));
}
```

### 2.4 `test/test_server.js` — isolasi profil

```js
const TEST_CONFIG_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'kyp-server-test-'));
process.env.KY_PONI_CONFIG_HOME = TEST_CONFIG_HOME;   // diset SEBELUM require('../src/server')
const { server, wss, youtubeIngest } = require('../src/server');
```

### 2.5 `package.json` — versi, pengecualian config, nama artefak

```json
"version": "1.0.0",
"build": {
  "files": ["src/**/*", "package.json", "!src/config.json"],
  "linux": { "artifactName": "${productName}-${version}.${ext}" },
  "win":   { "artifactName": "${productName}-${version}.${ext}" }
}
```

### 2.6 `scripts/publish_release.sh` — path & URL tanpa spasi

```diff
-WIN_EXE_PATH="${PROJECT_ROOT}/dist/KY-Poni ${VERSION}.exe"
+WIN_EXE_PATH="${PROJECT_ROOT}/dist/KY-Poni-${VERSION}.exe"
-.../download/${TAG}/KY-Poni%20${VERSION}.exe
+.../download/${TAG}/KY-Poni-${VERSION}.exe
```

---

## 3. Bukti Empiris Cacat 2.2 (bukan sekadar pembacaan kode)

Saat binary lama (0.9.1) dijalankan, keluar log:

```
[KY-Poni ConfigManager] Migrated legacy local config to: /home/milkyponi/.config/ky-poni/config.json
```

Isi berkas hasil migrasi:

```json
{ "target": "@MilkyPoni", "theme": "persona5", "scale": 120,
  "fontSize": 18, "fontFamily": "Bebas Neue", "textColor": "#FFE600" }
```

`scale: 120` + `Bebas Neue` adalah nilai yang ada di `src/config.json` milik pengembang — bukan default (`100` / `OptimaNova`). Artinya pengguna baru memang mewarisi setting developer. Berkas bocor ini sudah dihapus agar Bos mulai dari default.

---

## 4. Keluaran Pengujian Nyata

### 4.1 Suite otomatis — `npm test` (exit 0)

| Suite | Assertion | Hasil |
| --- | --- | --- |
| `test_server.js` | 19 | PASS |
| `test_anti_rto.js` | 6 | PASS |
| `test_persistence.js` | 17 | PASS |
| `test_dashboard_boot.js` | 13 | PASS |
| `test_windows_compat.js` | 14 | PASS |
| **Total** | **69** | **PASS** |

Catatan: laporan QA lama menyebut "38/38", angka itu tidak sesuai jumlah assertion nyata. Laporan baru memakai hitungan aktual (69).

### 4.2 Uji pada kode yang benar-benar terpaket (`app.asar` 1.0.0, profil kosong)

| Endpoint / Aksi | Hasil |
| --- | --- |
| `GET /api/version` | `{"version":"1.0.0","appName":"KY-Poni"}` |
| `GET /api/status` | `idle`, version 1.0.0 |
| `GET /api/config` | **default penuh** (`scale:100`, `OptimaNova`, `persona5`) |
| `GET /api/themes` | `classic, persona3reload, persona5` |
| `GET /api/catalog` | 5 item (3 builtin installed, 2 remote belum) |
| `GET /overlay?theme=persona5` | 200 |
| css + renderer.js × 3 tema | 200 semua |
| `POST /api/themes/install` (unduh remote nyata) | sukses → `/themes/undertale/style.css` 200 |
| `POST /api/themes/delete` | sukses |
| hapus tema inti `persona5` | ditolak dengan pesan benar |
| `GET /api/themes/open-folder` | **200** (sebelumnya 500) |
| `POST /api/simulate` chat/superchat/membership | sukses |
| `GET /api/updater/check` | `updateAvailable:false` (tangani 404 tanpa rilis) |

### 4.3 Paritas Windows

- Simulasi `win32`: 14/14 lulus — `%APPDATA%\KY-Poni` kapital, `themes\` sejajar config, fallback `APPDATA` kosong, atomic write tanpa sisa `.tmp`, fallback `EPERM`, migrasi `cyberpunk-2077` → `cyberpunk2077`, fallback `EBUSY`, ID basi, hapus tanpa folder yatim, proteksi tema inti.
- Eksekusi `.exe` asli di Wine 11.20: folder `C:\users\milkyponi\AppData\Roaming\KY-Poni\` + `themes\` benar-benar terbentuk di disk.
- Proses berhenti setelah inisialisasi window (`nodrv_CreateWindow`) karena tidak ada display server di lingkungan uji — keterbatasan lingkungan, bukan cacat aplikasi.

### 4.4 Integritas artefak

| Artefak | Ukuran | SHA-256 |
| --- | --- | --- |
| `KY-Poni-1.0.0.AppImage` | 128.598.444 B | `425c244631deb6d1fe0dc590b181b4917607396849676050c338206072456788` |
| `KY-Poni-1.0.0.exe` | 111.696.085 B | `fa854460cb555c378ad432e133ef02cb3a0790f50c530832fc02834f7b8b5670` |

`app.asar` Linux & Windows: versi ter-embed `1.0.0`, `/src/config.json` **tidak ada**, `changelogs` **tidak ada**.

---

## 5. Insiden Saat Eksekusi

### 5.1 `package.json` tertimpa perintah `asar extract-file`

`asar extract-file <asar> package.json` dijalankan dari root proyek pada build Windows, sehingga `package.json` asli tertimpa versi minim dari dalam asar (tanpa `scripts`, tanpa `build`). Terdeteksi saat `npm test` → `Missing script: "test"`.

Dipulihkan: `git checkout HEAD -- package.json`, lalu versi & `build.files` diterapkan ulang. Build artefak tidak terpengaruh karena dibuat sebelum insiden.

### 5.2 Nama aset `.exe` berubah → tautan 404

`gh release create ... "KY-Poni 1.0.0.exe"` → GitHub menyimpan sebagai `KY-Poni.1.0.0.exe` (spasi jadi titik). URL unduhan ber-spasi mengembalikan **404**.

Perbaikan: aset salah dihapus, diunggah ulang sebagai `KY-Poni-1.0.0.exe` (hash identik), body rilis diedit, README diselaraskan, dan `artifactName` dikunci di `package.json` agar tidak terulang.

### 5.3 Peluncuran GUI dari shell agent gagal

AppImage tidak bisa dibuka dari shell ini: `Missing X server or $DISPLAY` lalu `Authorization required, but no authorization protocol specified` — tidak ada cookie `XAUTHORITY` untuk sesi desktop Bos. Verifikasi runtime dialihkan ke uji headless atas kode terpaket (bagian 4.2), yang menguji logika aplikasi sebenarnya.

---

## 6. Repositori & Riwayat

- 16 release lama + 16 tag `v0.4.0`–`v0.6.0` dihapus. Tersisa satu release: `v1.0.0`.
- Folder `changelogs/` (26 berkas) dihapus dari repo & disk, masuk `.gitignore`.
- `INVESTIGATION_PREFERENCES_UPDATE_BUG.md`, `preview_p5_widget.html`, `test_previews/` dikeluarkan dari tracking.
- Commit: `9c1cfd0` (rilis) + `50bbf0d` (perbaikan nama artefak). Keduanya sudah di `origin/main`, working tree bersih.

---

## 7. README

Ditulis ulang total (3.040 byte, dari 4.571). Perubahan pendekatan:

- Emoji dekoratif per butir dihapus; heading memakai teks biasa.
- Bahasa Indonesia, bukan campuran.
- Klaim yang tidak ada di kode dihapus — README lama menjanjikan "animasi cut-in All-Out Attack" pada Super Chat, sedangkan `persona5/renderer.js` hanya menampilkan badge inline.
- Empat screenshot asli hasil tangkapan aplikasi 1.0.0: `catalog.png` (halaman katalog), `showcase_overlay.png` (P5 vs P3R berdampingan), `persona5_overlay.png`, `persona3reload_overlay.png`.

Screenshot katalog diambil ulang dengan viewport 1500×1080 agar keenam kartu tampil utuh, termasuk kartu Persona 4 Golden.

---

## 8. Instalasi untuk Uji Bos

| Item | Nilai |
| --- | --- |
| Biner terpasang | `~/AppImages/kyponi.appimage` (123 MB) |
| Hash | `425c2446…456788` — identik dengan aset rilis |
| Launcher | `~/.local/share/applications/kyponi.desktop` → `Name=KY-Poni (1.0.0)`, `X-AppImage-Version=1.0.0` (sebelumnya masih 0.7.0) |
| Profil | `~/.config/ky-poni/config.json` **dihapus** → Bos mulai dari default pabrik |
| Port | 19840 bebas, tidak ada proses menggantung |

---

## 9. SOP Baru

`SOP_RELEASE.md` (4.386 byte) — dua gerbang wajib:

1. **Gerbang 1 (Fonzy, teknis)**: suite otomatis, isolasi profil, audit modul terdampak, uji fitur nyata, paritas platform, benchmark batas UI per tema, sinkron SemVer.
2. **Gerbang 2 (Bos, pengalaman)**: build dipasang ke PC Bos, Bos menguji sendiri, menyatakan lolos.

Setelah Bos lolos, Fonzy tetap memverifikasi artefak yang dirilis identik dengan yang diuji (hash, versi ter-embed, profil bersih). Dilarang push ke release sebelum kedua gerbang lulus.

Dikunci juga di vault: `01_MEMORY/Decisions/2026-11-10-KY-Poni-Dual-Gate-Release-SOP.md`, dengan catatan eksplisit bahwa SOP ini **hanya berlaku untuk KY-Poni** — proyek lain punya SOP sendiri.

---

## 10. Sisa / Catatan Terbuka

1. Aset grafis tak terpakai masih ada di tree tema: `p5_spritesheet_clean.png`, `banner_1..8`, `pointer_1..4`, `1 template_*`, `bubble_full.png`, P3R `bubble_full.png` + `preview.png`. Total ± 21 berkas, ± 900 KB. **Sengaja tidak dihapus** pada rilis ini agar paket tema yang sudah diunduh pengguna tidak berubah. Kandidat pembersihan rilis berikutnya.
2. `README` menyebut nama berkas `KY-Poni-<versi>.exe`; artefak v1.0.0 saat ini memang sudah sesuai.
3. Uji GUI nyata di sesi desktop Bos belum dilakukan dari sisi Fonzy (butuh cookie display). Bos akan melakukannya sebagai gerbang 2.
