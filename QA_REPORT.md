# QA & Automated Test Report: KY-Poni (v0.4.0-alpha)

- **Tanggal Eksekusi**: 2026-11-02
- **Lead Tester**: Fonzy (Divisi Software Development)
- **Komponen Diuji**: Core Broadcaster Server, YouTube Ingest Engine, Live Customization Engine, Preferences Persistence, Dynamic Theme Downloader, Native Desktop Window (`src/electron_main.js`), Portable Binaries (`.AppImage` & `.exe`).

---

## 1. Ringkasan Hasil Pengujian

| No | Modul / Skenario Uji | Status | Catatan Teknis |
|---|---|---|---|
| 1 | Server Boot & Port Binding (`19840`) | ✅ PASS | Binding bersih di localhost, latensi 0 ms |
| 2 | REST Endpoint `GET /api/status` | ✅ PASS | Mengembalikan state lifecycle runtime |
| 3 | REST Endpoint `GET /api/themes` | ✅ PASS | Terdeteksi 2 tema: Persona 5 & Classic |
| 4 | REST Endpoint `GET /api/catalog` | ✅ PASS | Manifest katalog remote termuat (4 tema) |
| 5 | OBS Overlay Serving (`GET /overlay`) | ✅ PASS | HTML kanvas transparan 60 FPS |
| 6 | Persona 5 CSS & Polygon Clip-Path | ✅ PASS | Rendering balon kata jagged komik otentik |
| 7 | WebSocket Ingest & Broadcast (`/ws`) | ✅ PASS | Event tersalurkan secara real-time |
| 8 | Super Chat "All-Out Attack" Cut-In | ✅ PASS | Animasi shake & modal cut-in terverifikasi |
| 9 | Horizontal Ticker Anti-Shrink & Push | ✅ PASS | `flex-shrink: 0` + smooth slide terverifikasi |
| 10 | Auto-Hide & "Keep Last N" Retention | ✅ PASS | Timer delay + retention guard berjalan akurat |
| 11 | 4-Corner Anchors & Top-Down Flow | ✅ PASS | Dukungan 4 sudut, animasi slam-down, & tab inversi kanan |
| 12 | YouTube Avatar CDN & Hotlink Guard | ✅ PASS | Ekstraksi `yt3.ggpht.com` + `no-referrer` + fallback bottts |
| 13 | Exact Image 1 & 2 Color & Skew Spec | ✅ PASS | Hex `#6D64FD`, `#4BC196`, `#F5BE29`, `#D03D3D`, `#11AA72` terverifikasi |
| 14 | Customization & Config Persistence | ✅ PASS | Slider scale, font size, custom fonts, text colors, `/api/config` tested |
| 15 | Dynamic Theme Downloader & Manager | ✅ PASS | Install zip, HTTP serving dari custom folder, uninstall, dan open-folder |
| 16 | Native Portable Binaries & GUI Launch | ✅ PASS | Linux `.AppImage` (114M) & Windows `.exe` (106M) verified running |

**Total:** 16/16 Tests Passed (100% Green).

---

## 2. Berkas Binari Portable Tersedia
- **Linux Portable AppImage:**
  `Documents/Milky Brain/07_PROJECTS/KY-Poni/dist/KY-Poni-0.3.0.AppImage` (Executable)
- **Windows Portable Executable:**
  `Documents/Milky Brain/07_PROJECTS/KY-Poni/dist/KY-Poni 0.3.0.exe` (Single Portable Exe)
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
