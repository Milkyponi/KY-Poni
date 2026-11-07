# QA & Automated Test Report: KY-Poni (v0.8.0-alpha)

- **Tanggal Eksekusi**: 2026-11-07
- **Lead Tester**: Fonzy (Divisi Software Development)
- **Komponen Diuji**: Persona 5 Authentic Dialogue Asset Engine, Persona 3 Reload Tartarus Theme Engine, 3-Piece Hybrid Asset Slicing, Aganè Font Family Bundling, Dynamic Status Badge (TALK/Donasi/Member), Fixed 1000x1000 Canvas Standard, Anti-RTO Watchdog.

---

## 1. Ringkasan Hasil Pengujian

| No | Modul / Skenario Uji | Status | Catatan Teknis |
|---|---|---|---|
| 1 | Server Boot & Port Binding (`19840`) | ✅ PASS | Binding bersih di localhost, latensi 0 ms |
| 2 | REST Endpoint `GET /api/status` | ✅ PASS | Mengembalikan state lifecycle runtime (v0.8.0) |
| 3 | REST Endpoint `GET /api/themes` | ✅ PASS | Terdeteksi 3 tema resmi: Persona 5, Persona 3 Reload, & Classic |
| 4 | REST Endpoint `GET /api/catalog` | ✅ PASS | P3R otomatis terdaftar berdampingan dengan Persona 5 |
| 5 | OBS Overlay Serving (`GET /overlay`) | ✅ PASS | HTML kanvas transparan 60 FPS |
| 6 | 3-Piece Hybrid Asset Skin Assembly (P3R) | ✅ PASS | Gabungan `bubble_left`, `bubble_mid`, `bubble_right` 100% solid, seamline hilang total |
| 7 | Persona 3 Reload Official Font Bundling | ✅ PASS | Font `Agane-Roman.ttf`, `Agane-Bold.ttf`, `Agane-ExtraBold.ttf` ter-bundle di tema |
| 8 | Dynamic Status Badge (TALK/Superchat/Member) | ✅ PASS | Badge mikro TALK (cyan), Superchat (Rp 100.000 emas), & Member (hijau) adaptif |
| 9 | Tartarus Palette & Hard-Edge Shadow | ✅ PASS | Warna body Deep Navy & Electric Cyan dengan stylized hard shadow tajam |
| 10 | Multiline Word-Wrapping & Breathing Room | ✅ PASS | Pesan 2 baris tertampung lapang dengan padding proporsional |
| 11 | Real YouTube Live Ingestion Test | ✅ PASS | Teruji menyerap 70 pesan asli live chat YouTube dalam 10 detik tanpa API key |
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
  `Documents/Milky Brain/07_PROJECTS/KY-Poni/dist/KY-Poni-0.7.0.AppImage` (Executable)
- **Windows Portable Executable:**
  `Documents/Milky Brain/07_PROJECTS/KY-Poni/dist/KY-Poni 0.7.0.exe` (Single Portable Exe)
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
