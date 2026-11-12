# QA & Audit Kelayakan Distribusi: KY-Poni v1.1.0

> **v1.1.0 — Connectivity Overhaul.** Versi ini memperbaiki tiga keluhan pengguna yang
> dilaporkan langsung (Channel ID tidak terdeteksi, harus copy-paste link live setiap kali,
> alur konektivitas dianggap ribet) **dan** menyelamatkan aplikasi dari kematian total:
> sejak November 2026 YouTube menyajikan `<link rel="canonical" href="undefined">`, sehingga
> pustaka `youtube-chat` tidak lagi bisa menemukan `liveId`. Semua jalur koneksi di v1.0.1
> (handle, channelId, liveId) gagal dengan "Live Stream was not found" — termasuk untuk
> siaran yang benar-benar sedang live. Rincian investigasi:
> `docs/investigations/2026-11-12-Konektivitas-YouTube-OAuth-vs-InnerTube.md`.
>
> **Catatan gate:** artefak 1.1.0 lolos Gerbang 1 (verifikasi teknis, 169 assertion).
> Gerbang 2 (uji pengalaman Bos) berstatus **menunggu**. Push & rilis GitHub belum dilakukan.

- **Tanggal**: 2026-11-10
- **Lead Tester**: Fonzy (Divisi Software Development)
- **Lingkup**: Audit pra-rilis pertama untuk distribusi publik. Fokus pada benturan antar-modul dan kebocoran artefak pengembangan ke paket distribusi — bukan sekadar regresi fitur.
- **Status**: **Lulus** — 69/69 assertion, 4 cacat distribusi ditemukan & diperbaiki.

---

## 1. Ringkasan

| Kategori | Hasil |
| --- | --- |
| Suite otomatis (`npm test`, exit code 0) | **69 assertion, 69 PASS** |
| Paritas Windows | 14/14 simulasi win32 + eksekusi `.exe` nyata di Wine 11.20 |
| Uji fungsional binary terpaket | Seluruh endpoint 200, termasuk instal/hapus tema via unduhan remote nyata |
| Cacat ditemukan | 4 (2 kritis, 2 sedang) — semuanya diperbaiki sebelum rilis |
| Kebocoran artefak dev ke paket | 0 (diverifikasi di `app.asar` Linux & Windows) |

### Rincian Suite

| Suite | Assertion | Hasil |
| --- | --- | --- |
| `test/test_server.js` (regresi server & API) | 19 | PASS |
| `test/test_anti_rto.js` (Anti-RTO watchdog) | 6 | PASS |
| `test/test_persistence.js` (persistensi & path lintas OS) | 17 | PASS |
| `test/test_dashboard_boot.js` (kontrak urutan boot) | 13 | PASS |
| `test/test_windows_compat.js` (simulasi win32) | 14 | PASS |
| **Total** | **69** | **PASS** |

---

## 2. Cacat yang Ditemukan & Diperbaiki

### 2.1 KRITIS — Test suite menimpa profil streamer asli

`test/test_server.js` memanggil `POST /api/config` serta `POST /api/themes/install` ke server sungguhan, yang menulis ke `~/.config/ky-poni/`. Akibatnya **setiap `npm test` mengganti `config.json` milik pengguna** dan memasang/menghapus tema di folder tema asli.

Bukti: setelah `npm test`, `~/.config/ky-poni/config.json` berisi `target: "@MilkyPoniTest"`, `fontFamily: "Bebas Neue"`, `scale: 120` — nilai yang ditulis test, bukan pengguna.

**Perbaikan**: `resolveConfigDir()` menerima override `KY_PONI_CONFIG_HOME`; suite membuat direktori sementara dan menyetelnya **sebelum** `src/server.js` di-*require*. Diverifikasi: setelah test, `~/.config/ky-poni/config.json` tidak dibuat/tidak berubah.

### 2.2 KRITIS — Config pengembang ikut terpaket dan diwariskan ke pengguna baru

`src/config.json` (`scale: 120`, `fontFamily: "Bebas Neue"`, `theme: "cyberpunk2077"`) ikut masuk ke `app.asar`. Karena `migrateLegacyIfNeeded()` menyalin config lama saat instalasi pertama, **setiap pengguna baru mewarisi setting pengembang** alih-alih mulai dari default.

Bukti: `asar list` pada build lama menunjukkan `/src/config.json`; instalasi bersih mengembalikan nilai dev.

**Perbaikan**: berkas dihapus dari repo & masuk `.gitignore`, dikecualikan lewat `build.files` (`!src/config.json`), dan migrasi legacy dilewati saat berjalan dari dalam `.asar`.

Diverifikasi pada build 1.0.0: `/src/config.json` **tidak ada** di asar Linux maupun Windows; instalasi bersih mengembalikan `scale: 100`, `fontFamily: "OptimaNova"`, `theme: "persona5"`.

### 2.3 SEDANG — `GET /api/themes/open-folder` selalu gagal 500

Route memanggil `themeManager.openThemesFolder()`, method yang tidak pernah ada di kelas `ThemeManager`. Setiap pemanggilan berakhir `TypeError`.

**Perbaikan**: method ditambahkan (mendukung `explorer` / `open` / `xdg-open`). Diverifikasi: endpoint 200.

### 2.4 SEDANG — Kartu "Segera Hadir" menampilkan tema yang sudah rilis

Katalog menampilkan "Persona 3 Reload & Retro 16-Bit JRPG" sebagai *coming soon*, padahal Persona 3 Reload sudah terpasang sebagai tema bawaan.

**Perbaikan**: diganti menjadi **Persona 4 Golden** (Midnight Channel / Yellow).

---

## 3. Uji Fungsional pada Binary Terpaket

Dijalankan terhadap kode yang diekstrak dari `app.asar` hasil build 1.0.0, dengan direktori config kosong.

| Uji | Hasil |
| --- | --- |
| `GET /api/version` | `1.0.0` |
| `GET /api/status` | `idle`, `version: 1.0.0` |
| `GET /api/config` (instalasi bersih) | Default penuh — tidak mewarisi config dev |
| `GET /api/themes` | 3 tema bawaan: persona5, persona3reload, classic |
| `GET /api/catalog` | 5 item; 3 builtin `installed: true`, 2 remote `installed: false` |
| `GET /overlay?theme=persona5` | 200 |
| Aset tema (css + renderer.js × 3 tema) | 200 seluruhnya |
| `POST /api/themes/install` (unduh remote nyata) | Sukses; tersaji di `/themes/undertale/style.css` (200) |
| `POST /api/themes/delete` | Sukses |
| Proteksi tema inti (`persona5`) | Ditolak dengan pesan benar |
| `GET /api/themes/open-folder` | 200 (setelah perbaikan) |
| `POST /api/simulate` (chat / superchat / membership) | Ketiga tipe sukses |
| `GET /api/updater/check` | `updateAvailable: false` — menangani kondisi tanpa rilis (404) dengan benar |

---

## 4. Kompatibilitas Windows

**Lapis 1 — simulasi runtime win32 (14 assertion)**: `%APPDATA%\KY-Poni\config.json` (kapital), folder `themes\` sejajar config, fallback `<home>\AppData\Roaming`, preferensi bertahan setelah restart, penulisan atomik tanpa sisa `.tmp`, fallback tulis saat `EPERM`, migrasi `cyberpunk-2077` → `cyberpunk2077`, fallback copy+remove saat `EBUSY`, ID basi di `theme.json` tidak merusak deteksi, normalisasi ID saat baca, boot tanpa tulis ulang, hapus tema tanpa folder yatim, tema inti tidak bisa dihapus. Seluruhnya PASS.

**Lapis 2 — eksekusi `.exe` asli di Wine 11.20**:

| Bukti | Hasil |
| --- | --- |
| Membuat `C:\users\<user>\AppData\Roaming\KY-Poni\` | Terverifikasi di disk |
| Nama folder kapital `KY-Poni` | Benar |
| Folder `themes\` sebagai saudara `config.json` | Benar |

Setelah inisialisasi window, Wine menghentikan proses karena tidak ada display server (`nodrv_CreateWindow`). Ini keterbatasan lingkungan headless, **bukan cacat aplikasi** — seluruh logika storage, path, dan migrasi sudah tereksekusi sebelum titik tersebut.

---

## 5. Catatan Verifikasi

- Verifikasi `AppImage` difokuskan pada kode yang benar-benar terpaket (`app.asar`) yang dijalankan headless, karena lingkungan audit tidak memiliki X server. Peluncuran langsung tanpa `$DISPLAY` gagal di lapisan Electron/Ozone, bukan di kode aplikasi.
- Aset grafis yang tidak direferensikan kode (`p5_spritesheet_clean.png`, `banner_*`, `pointer_*`, `bubble_full.png`) masih tersisa di tree. **Sengaja tidak dihapus** pada rilis ini agar paket tema yang sudah diunduh pengguna tidak berubah; kandidat pembersihan rilis berikutnya.
- README v1.0.0 ditulis ulang tanpa klaim yang tidak ada di kode. Klaim "All-Out Attack cut-in animation" pada README lama **tidak pernah ada** di `persona5/renderer.js` (hanya badge inline) sehingga dihapus.

---

## 6. Kesimpulan

Seluruh cacat yang ditemukan bersifat **distribusi**, bukan fitur — tepat jenis masalah yang baru muncul ketika aplikasi dipakai orang lain. Setelah perbaikan, semua gerbang lulus dan artefak 1.0.0 layak dirilis.

Prosedur rilis ke depan mengikuti [SOP_RELEASE.md](SOP_RELEASE.md): uji pengalaman Bos + verifikasi teknis Fonzy sebelum setiap rilis.

### Riwayat Versi

| Versi | Tanggal | Catatan |
| --- | --- | --- |
| 1.1.0 | 2026-11-12 | **Connectivity Overhaul.** Tiga keluhan pengguna diperbaiki + penyelamatan dari regresi YouTube. **(a) Parser:** `parseTarget()` dulu memeriksa `handle` sebelum `channelId`, sehingga `youtube.com/channel/UC...`, `youtu.be/`, `/c/`, `/user/` semuanya dibungkus jadi `@handle` dan menembak URL tidak ada (HTTP 404) — pengguna melihat "Pastikan channel sedang live streaming" padahal sedang live. Klasifikasi dipindah ke modul `youtube_target.js`; **14/14 format** input kini dikenali (sebelumnya 9/14). **(b) Auto-connect:** target tersimpan di `config.json` kini dipakai menyambung otomatis saat aplikasi dibuka; hanya instance pemilik server yang menjalankannya. **(c) Status jujur:** mode `waiting` baru untuk "kanal dikenal, siaran belum mulai", plus status `error` yang kini benar-benar ditampilkan (sebelumnya tenggelam jadi "Disconnected"). **(d) Regresi YouTube Nov 2026:** `<link rel="canonical" href="undefined">` membuat `youtube-chat` (rilis 2022) gagal menemukan `liveId` di SEMUA jalur — v1.0.1 tidak bisa konek sama sekali. Shim `innertube_live_source.js` mengganti hanya `fetchLivePage` dengan jalur `navigation/resolve_url` + `next`, tanpa scraping HTML dan tanpa kredensial. **(e) Bug state machine:** `stop()` memancarkan `end` sinkron sebelum sesi baru dipasang, memicu "Siaran berakhir" palsu setiap ganti target; diperbaiki dengan token nomor sesi yang dinaikkan sebelum `stop()`. **(f) Guard instalasi baru:** `DEFAULT_CONFIG.target` bernilai `@MilkyPoni` sebagai contoh di kolom input; tanpa guard, setiap instalasi baru akan auto-connect ke kanal pengembang. Auto-connect sekarang hanya jalan bila `config.json` benar-benar ada (bukti pengguna pernah menyimpan target sendiri). Ditemukan saat verifikasi akhir SOP §4 dan dikunci `test_autoconnect.js` (5 cek). Verifikasi: 9/9 format tersambung end-to-end dengan chat nyata; ganti target 3× beruntun tetap `connected`; `messageCount` naik 62→248 pada build terpaket. **174 assertion PASS, 0 gagal.** Kedua artefak dibangun & diverifikasi (AppImage 123 MB, `sha256 1b115060…`; `.exe` 107 MB, `sha256 f1f0276d…`). Uji GUI Windows via Wine **tidak dapat dijalankan** (lingkungan build headless, tidak ada display server) — paritas path `%APPDATA%\\KY-Poni` diverifikasi lewat suite `test_windows_compat.js` 14/14. |
| 1.0.1 | 2026-11-11 | Security patch + perbaikan regresi. Menutup 8 temuan audit (CORS wildcard yang menetralkan origin guard, RCE endpoint updater, shell injection `extractZip`, stored XSS simulator, zip-slip, SSRF/`downloadUrl`, body tanpa batas, graceful shutdown menggantung) plus celah port pada origin guard. Juga: ekstraksi ZIP murni Node (tanpa `unzip`/`tar`/PowerShell), folder unduhan ikut XDG, XSS metadata tema dashboard, validasi skema config. Lalu 3 regresi fungsional diperbaiki: tombol Instal tema (kutip ganda di onclick), double-escape nama penonton, P3R `&amp;` literal. Suite `test_security_regression.js` 43 cek. Total 121 assertion PASS. **Kedua artefak (AppImage + .exe) diuji fungsional** — `.exe` dijalankan lewat Wine: versi 1.0.1, 4 overlay 200, escape kontrak benar, unduh tema `installed: true` ke `%APPDATA%\KY-Poni\themes`. |
| 1.0.0 | 2026-11-10 | Rilis publik pertama. Audit distribusi, 4 cacat diperbaiki, SOP dua gerbang berlaku. |
