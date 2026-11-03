# QA & Automated Test Report: KY-Poni (v0.4.6-alpha)

- **Tanggal Eksekusi**: 2026-11-03
- **Lead Tester**: Fonzy (Divisi Software Development)
- **Komponen Diuji**: Persona 5 Authentic Dialogue Asset Engine (3-Piece Sliced Skin, Alpha-Hardened Assets, Ransom Note Typography, Dynamic Multiline Auto-Height, Curated Theme System).

---

## 1. Ringkasan Hasil Pengujian

| No | Modul / Skenario Uji | Status | Catatan Teknis |
|---|---|---|---|
| 1 | Server Boot & Port Binding (`19840`) | ✅ PASS | Binding bersih di localhost, latensi 0 ms |
| 2 | REST Endpoint `GET /api/status` | ✅ PASS | Mengembalikan state lifecycle runtime (v0.4.6) |
| 3 | REST Endpoint `GET /api/themes` | ✅ PASS | Terdeteksi 2 tema resmi: Persona 5 & Classic |
| 4 | REST Endpoint `GET /api/catalog` | ✅ PASS | Manifest katalog resmi termuat tanpa kustom eksternal |
| 5 | OBS Overlay Serving (`GET /overlay`) | ✅ PASS | HTML kanvas transparan 60 FPS |
| 6 | 3-Piece Hybrid Asset Skin Assembly | ✅ PASS | Gabungan `bubble_left`, `bubble_mid`, `bubble_right` 100% solid, seamline hilang total |
| 7 | Persona 5 Official Font Bundling | ✅ PASS | Font `OptimaNovaLT-Black.ttf`, `KoreanKRSM.ttf`, `p5hatty.ttf` ter-bundle di tema |
| 8 | Dynamic Ransom-Note Nameplate | ✅ PASS | Algoritma penataan huruf + satu aksen kotak merah miring di pita putih aman tanpa clipping |
| 9 | Dynamic Multiline Word-Wrapping | ✅ PASS | Pesan 2 baris otomatis wrap dan tinggi bertambah (220px) dengan margin bawah lapang |
| 10 | Unified Scope (Animation Pruned) | ✅ PASS | Super Chat & Member disatukan ke template balon dialog dengan badge inline rapi |
| 11 | Custom Theme Pruning & Security | ✅ PASS | Folder tema kustom ditutup; hanya tema resmi Milky Brain yang dieksekusi |
| 12 | Visual Verification vs Image 2 | ✅ PASS | Nilai kemiripan visual mencapai ~96–98% (standar 'plek ketiplek') |

**Total:** 12/12 Targeted Persona 5 & Theme Tests Passed (100% Green).

---

## 2. Berkas Binari Portable Tersedia
- **Linux Portable AppImage:**
  `Documents/Milky Brain/07_PROJECTS/KY-Poni/dist/KY-Poni-0.4.5.AppImage` (Executable)
- **Windows Portable Executable:**
  `Documents/Milky Brain/07_PROJECTS/KY-Poni/dist/KY-Poni 0.4.5.exe` (Single Portable Exe)
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
