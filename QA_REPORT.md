# QA & Automated Test Report: KY-Poni (v0.9.1)

> **Rilis terkini: v0.9.1** — Persistence Hardening & Windows Compatibility Gate.
> Laporan v0.9.0-alpha di bawah dipertahankan sebagai riwayat; bagian v0.9.1 ada di **Bagian 4**.

- **Tanggal Eksekusi Terakhir**: 2026-11-09
- **Lead Tester**: Fonzy (Divisi Software Development)
- **Komponen Diuji**: Persona 3 Reload Triple-Hybrid Adaptation, Centered Vertical Anchor, Snug-Fit Tier Height Progression, Aganè Font Bundling, 3-Piece Sliced Skin, Anti-RTO Watchdog, Preference Persistence, Legacy Theme ID Migration, Windows Path Compatibility.

---

## 1. Ringkasan Hasil Pengujian

| No | Modul / Skenario Uji | Status | Catatan Teknis |
|---|---|---|---|
| 1 | Server Boot & Port Binding (`19840`) | ✅ PASS | Binding bersih di localhost, latensi 0 ms |
| 2 | REST Endpoint `GET /api/status` | ✅ PASS | Mengembalikan state lifecycle runtime (v0.9.0) |
| 3 | REST Endpoint `GET /api/themes` | ✅ PASS | Terdeteksi 3 tema resmi: Persona 5, Persona 3 Reload, & Classic |
| 4 | REST Endpoint `GET /api/catalog` | ✅ PASS | P3R otomatis terdaftar berdampingan dengan Persona 5 |
| 5 | OBS Overlay Serving (`GET /overlay`) | ✅ PASS | HTML kanvas transparan 60 FPS |
| 6 | 3-Piece Hybrid Asset Skin Assembly (P3R) | ✅ PASS | Gabungan `bubble_left`, `bubble_mid`, `bubble_right` 100% solid, seamline hilang total |
| 7 | Persona 3 Reload Official Font Bundling | ✅ PASS | Font `Agane-Roman.ttf`, `Agane-Bold.ttf`, `Agane-ExtraBold.ttf` ter-bundle di tema |
| 8 | Dynamic Status Badge (TALK/Superchat/Member) | ✅ PASS | Badge mikro TALK (cyan), Superchat (Rp 100.000 emas), & Member (hijau) adaptif |
| 9 | Centered Vertical Anchor (Anti Top-Heavy) | ✅ PASS | Teks pesan mengapung simetris di tengah vertikal, dead space bawah hilang |
| 10 | Snug-Fit Tier Progression (3.5:1 - 3.8:1) | ✅ PASS | 4-tier height progression (128px s/d 172px) membungkus teks tanpa balon membengkak |
| 11 | Triple-Hybrid Long Comment Hardening | ✅ PASS | Komentar panjang (187 karakter) tampil 100% utuh tanpa terpotong (*gameplay-nya,* terlihat) |
| 12 | YouTube Ingest Anti-RTO Resilience | ✅ PASS | Penanganan ETIMEDOUT tanpa crash, soft 'reconnecting' state teruji |
| 13 | Auto-Recovery on Message Ingest | ✅ PASS | Pemulihan otomatis status 'connected' saat pesan baru masuk pasca sinyal pulih |
| 14 | Self-Healing Watchdog (Backoff) | ✅ PASS | Reconnect otomatis jika RTO berlanjut >4 polling cycles tanpa intervensi streamer |
| 15 | Cross-Version Persistent Preferences | ✅ PASS | Penyimpanan di OS path (`~/.config/ky-poni/config.json`) bertahan lintas update |
| 16 | Anchor-Sensitive Horizontal Chat Flow | ✅ PASS | Chat baru muncul di sisi anchor (`bottom-left` / `bottom-right`) & dorong chat lama |
| 17 | Authentic Persona 5 Catalog Showcase | ✅ PASS | Banner preview P5 menampilkan 3-piece asset bubble, ransom nameplate, & font Atlus |
| 18 | Curated Catalog Sanitization | ✅ PASS | Tombol custom folder tema dibersihkan, kartu masa depan berstatus 'Segera Hadir' |
| 19 | Dynamic Horizontal Text Expansion | ✅ PASS | Potongan bodi tengah melebar mengikuti teks; ornamen kiri/kanan terkunci tanpa distorsi |
| 20 | Multi-Tier Height & Anti-Overflow | ✅ PASS | Pesan 165 karakter font 25px 100% tertampung utuh di dalam balon tanpa bocor garis bawah |
| 21 | Modular Native Backend Router | ✅ PASS | `src/routes/` modular dispatch (`status`, `config`, `ingest`, `themes`, `updater`, `static`) |
| 22 | Dynamic Theme Plugin Architecture | ✅ PASS | `overlay.js` agnostic; `persona5/renderer.js` & `classic/renderer.js` modular verified |
| 23 | Header OBS Widget & Zero-Overlap Ergonomics | ✅ PASS | URL OBS + tombol salin di header, nav tabs digeser ke kanan tanpa tumpang tindih |
| 24 | Canvas Scale Range (25% - 150%) | ✅ PASS | Minimum slider skala kanvas turun ke 25% terverifikasi di DOM dan URL |
| 25 | Catalog Gallery Purification | ✅ PASS | Deskripsi dan kredit dihapus; fokus murni pada visual kartu dan nama tema |
| 26 | Content-Driven Intrinsic Bubble Sizing | ✅ PASS | Balon chat `fit-content` (min 380px, max 520px), terlepas dari lebar kanvas OBS |
| 27 | Pure Proportional Scale (25% - 150%) | ✅ PASS | Skala 25% proporsional sudut layar (tanpa stretching pancake); skala 150% gagah (tanpa shrink) |
| 28 | Persona 5 True Silhouette Restoration | ✅ PASS | Rasio 3.45:1 (440x128px), bentuk pipih aerodinamis 1:1 identik dengan kartu katalog |
| 29 | Origami Ribbon Nameplate Enclosure | ✅ PASS | Huruf nameplate 100% di atas pita putih solid, zero bleeding/spill ke ruang hitam kosong |
| 30 | Universal Theme-Agnostic Simulator | ✅ PASS | Data simulasi netral (ViewerOne, MilkyPoni, ModTeam, MemberStar, Supporter) siap multi-tema |
| 31 | Remote GitHub Theme Catalog Integration | ✅ PASS | In-App catalog memuat rilis resmi dari `Milkyponi/ky-poni-themes` via GitHub API |
| 32 | In-App Theme Installer & Uninstaller | ✅ PASS | 1-klik `⚡ Instal & Pasang` dan `🗑️ Hapus` di folder OS persistent user data |
| 33 | Theme-Bound Smart Presets Auto-Apply | ✅ PASS | Ganti tema otomatis menerapkan font, warna, dan layout rekomendasi game |
| 34 | Dynamic Font Lifecycle Injection | ✅ PASS | Font tema (`OptimaNova`, `VT323`, `Chakra Petch`) otomatis muncul saat terpasang & dicopot saat dihapus |
| 35 | Fixed 1000x1000 Canvas Standard | ✅ PASS | Resolusi OBS Browser Source dibakukan ke 1000x1000 px, zero-clipping pada skala 150% |
| 36 | Streamlabs Layout Flow Architecture | ✅ PASS | Pilihan resolusi kanvas dihilangkan; diganti murni orientasi aliran chat (Vertical / Horizontal) |
| 37 | 1:1 Scaled Canvas Preview (WYSIWYG) | ✅ PASS | Iframe 1000x1000 diproyeksikan proporsional via ResizeObserver & CSS transform zoom |
| 38 | Config Backward-Compatibility Normalization | ✅ PASS | Nilai legacy (`vertical-wide`, `horizontal-wide`, dll) dinormalisasi otomatis ke `vertical`/`horizontal` |

**Total:** 38/38 Targeted Tests Passed (100% Green).

---

## 2. Berkas Binari Portable Tersedia
- **Linux Portable AppImage (Installed in ~/AppImages/kyponi.appimage):**
  `Documents/Milky Brain/07_PROJECTS/KY-Poni/dist/KY-Poni-0.9.1.AppImage` (Executable)
- **Windows Portable Executable:**
  `Documents/Milky Brain/07_PROJECTS/KY-Poni/dist/KY-Poni 0.9.1.exe` (Single Portable Exe)
- **Studio Dashboard Server (Internal):** `http://localhost:19840/`

---

## 2. Akses Pengujian Langsung untuk Bos & Tim
- **Studio Dashboard:** `http://localhost:19840/`
- **OBS Browser Source URL (Customized):** `http://localhost:19840/overlay?theme=persona5&layout=vertical&pos=bottom-left&scale=100&fsize=16&font=Space+Grotesk&color=FFFFFF&fade=8&keep=1`
- **Parameter URL:**
  - `theme`: `persona5` | `classic`
  - `layout`: `vertical` | `horizontal`
  - `pos`: `bottom-left` | `bottom-right` | `top-left` | `top-right`
  - `scale`: Skala persentase keseluruhan (70 - 150)
  - `fsize`: Ukuran font pesan (12 - 26 px)
  - `font`: Nama font pesan (Space Grotesk, Bebas Neue, Inter, Bangers, Montserrat, VT323)
  - `color`: Hex warna teks (misal: FFFFFF, FFE600, 00F0FF, FF007F)
  - `fade`: Detik auto-hide (default: 8, `0` = nonaktif)
  - `keep`: Jumlah chat terakhir yang ditahan agar layar tidak kosong (default: 1)

---

## 4. Laporan Pengujian v0.9.1 — Persistence Hardening & Windows Compatibility Gate

**Tanggal**: 2026-11-09
**Latar belakang**: Pengguna melaporkan preferensi kembali ke default dan tema unduhan tampak terhapus setelah pembaruan. Investigasi akar masalah: `INVESTIGATION_PREFERENCES_UPDATE_BUG.md`.

### 4.1 Total Gate Otomatis

| Suite | Assertion | Hasil |
|---|---|---|
| `test/test_server.js` (regresi server & API) | 11 | ✅ PASS |
| `test/test_anti_rto.js` (Anti-RTO watchdog) | 4 | ✅ PASS |
| `test/test_persistence.js` (persistensi & path lintas OS) | 17 | ✅ PASS |
| `test/test_dashboard_boot.js` (kontrak urutan boot) | 13 | ✅ PASS |
| `test/test_windows_compat.js` (simulasi win32 penuh) | 14 | ✅ PASS |
| **Total** | **59** | **✅ 100% PASS** |

Perintah tunggal: `npm test` → exit code 0.

### 4.2 Regresi Bug Lapangan — Sebelum vs Sesudah

**A. Preferensi berubah saat aplikasi dibuka (tanpa interaksi)**

| Metrik | Sebelum perbaikan | Sesudah perbaikan |
|---|---|---|
| MD5 `config.json` sebelum boot | `548324…` | `58a53e…` |
| MD5 setelah 15 detik idle | `82fa2c…` (**berubah**) | `58a53e…` (**identik**) |
| Tema aktif di dashboard | `classic` (reset paksa) | `cyberpunk2077` (bertahan) |
| Font pilihan user | hilang → `Agane` | `Chakra Petch` (bertahan) |

**B. Ganti tema menghapus tipografi user**

| Langkah | Sebelum | Sesudah |
|---|---|---|
| Kondisi awal | `Chakra Petch`, `#FFE600`, 19px | sama |
| Pilih tema lain dari dropdown | font → `Agane`, 16px (**hilang**) | tetap `Chakra Petch`, 19px (**bertahan**) |
| Perubahan tersimpan ke disk | ✅ | ✅ |

**C. Tema unduhan tampak "hilang" setelah update**
Kondisi: folder `cyberpunk-2077` + `config.json` menyimpan `theme: "cyberpunk-2077"`.

| Pemeriksaan | Hasil |
|---|---|
| Folder dimigrasi ke `cyberpunk2077` | ✅ |
| Katalog menandai `installed: true` | ✅ |
| Tombol katalog "Gunakan Tema Ini" (bukan "Instal") | ✅ |
| `config` dibaca sebagai `cyberpunk2077` | ✅ |
| File config tidak ditulis ulang saat boot | ✅ |

**D. Ketahanan migrasi**

| Skenario | Hasil |
|---|---|
| Folder kanonik & folder lama keduanya ada | Kanonik dipertahankan, tidak ditimpa ✅ |
| Migrasi dijalankan 3× berturut-turut | Tetap satu folder kanonik (idempoten) ✅ |
| `theme.json` paket membawa ID lama | Nama folder menang ✅ |
| `config.json` korup | Fallback default tanpa crash ✅ |

### 4.3 Kompatibilitas Windows

Lapis 1 — **simulasi runtime win32** (14 assertion):

| Pemeriksaan | Hasil |
|---|---|
| `%APPDATA%\KY-Poni\config.json` (kapital) | ✅ |
| `%APPDATA%\KY-Poni\themes\` sejajar config | ✅ |
| Fallback `<home>\AppData\Roaming` saat `APPDATA` kosong | ✅ |
| Preferensi bertahan setelah restart penuh | ✅ |
| Penulisan atomik tanpa sisa `.tmp` | ✅ |
| Fallback tulis saat `renameSync` `EPERM` (file terkunci) | ✅ |
| Migrasi `cyberpunk-2077` → `cyberpunk2077` | ✅ |
| Fallback copy+remove saat `renameSync` `EBUSY` | ✅ |
| `theme.json` ID basi tidak merusak deteksi | ✅ |
| Normalisasi ID lama saat baca config | ✅ |
| Boot tidak menulis ulang config | ✅ |
| Hapus tema tanpa folder yatim | ✅ |
| Tema inti tidak bisa dihapus | ✅ |

Lapis 2 — **eksekusi biner `.exe` asli di Wine 11.20**:

| Bukti | Hasil |
|---|---|
| Membuat `C:\users\<user>\AppData\Roaming\KY-Poni\config.json` | ✅ terverifikasi di disk |
| Membuat folder `themes\` pada lokasi sama | ✅ |
| Nama folder kapital `KY-Poni` | ✅ |
| Migrasi folder tema lama pada path Windows | ✅ log: `Migrated legacy theme folder "cyberpunk-2077" -> "cyberpunk2077"` |
| Aset tema (`theme.json`, `style.css`) ikut pindah utuh | ✅ |

Catatan: setelah window init, Wine menghentikan proses karena tidak ada display server (`hwnd_util.cc: 1400`, `nodrv_CreateWindow`). Keterbatasan lingkungan headless Wine, bukan cacat aplikasi — semua logika storage, migrasi, dan path Windows sudah tereksekusi sebelum titik tersebut.

### 4.4 Integritas Artefak Rilis

| Artefak | Versi ter-embed | Fix terverifikasi di `app.asar` |
|---|---|---|
| `KY-Poni-0.9.1.AppImage` | `0.9.1` | ✅ `theme_ids.js` + guard `isBootstrapping` |
| `KY-Poni 0.9.1.exe` | `0.9.1` | ✅ `theme_ids.js`, `migrateLegacyThemeDirs`, path `%APPDATA%` |

Uji runtime AppImage 0.9.1: dashboard menampilkan tema `cyberpunk2077`, font `Chakra Petch`, skala 130, warna `#FFE600`, handle `@LegacyUser` — seluruhnya bertahan dari config pengguna lama, dan file config tidak tersentuh saat boot.

### 4.5 Regresi Non-Persistensi (dicek ulang)

Port 19840 & teardown ✅ · `/api/status`, `/api/version` ✅ · `/api/themes` (3 tema inti) ✅ · `/api/catalog` (5 item) ✅ · `/overlay` kanvas 1000×1000 ✅ · serving aset tema dari user dir ✅ · instal & hapus tema ✅ · WebSocket broadcast & simulator ✅ · Anti-RTO watchdog ✅ · Auto-updater SemVer strict ✅ · Renderer plugin THEME_SPEC ✅

### 4.6 Catatan Rilis

- Format `config.json` tidak berubah — pengguna bisa downgrade tanpa kehilangan data.
- Migrasi folder tema bersifat *one-way* dan idempoten, aman dijalankan setiap boot.
- Normalisasi ID tema dilakukan **saat dibaca**, bukan dengan menulis ulang file.
- Direkomendasikan sebagai rilis wajib sebelum distribusi publik.
