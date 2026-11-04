# Project: KY-Poni

**Directory:** `/home/milkyponi/Documents/Milky Brain/07_PROJECTS/KY-Poni/`  
**Current Version:** `v0.5.1-alpha` (Phase 5 Milestone: UI/UX Refinement & Layout Ergonomics Verified)  
**Lead:** Fonzy (Software Development & Architecture)  
**Stakeholder / Product Owner:** Milky Poni (Bos)  
**Target Output:** Portable Native Binaries (`.exe` Windows & `.AppImage` Linux via Gear Lever)  
**Status:** In Development (Stage 2: Modular Architecture & Plugin System)

### 📚 Dokumentasi Arsitektur Resmi Proyek:
- **[PRD.md](PRD.md):** Product Requirements Document lengkap (visi, pengguna, spesifikasi fungsional & non-fungsional).
- **[THEME_SPEC.md](THEME_SPEC.md):** Standar Kontrak Plugin Tema Game (antarmuka `renderer.js`, `theme.json`, aset grafis).
- **[ROADMAP.md](ROADMAP.md):** Peta jalan jangka panjang fitur & rilis tema baru (Undertale, Cyberpunk, P3 Reload).
- **[changelogs/](changelogs/):** Arsip riwayat rilis lengkap dari versi 0.1.0 hingga terkini.

---

## 1. Executive Summary & Vision

**KY-Poni** adalah aplikasi desktop cross-platform untuk mengelola dan menampilkan *livestream chat overlay* di OBS Studio dengan diferensiasi utama pada **Game-Inspired Visual Aesthetics**.

Mayoritas chat overlay di pasar (Streamlabs, Streamelements, SmartChat) memiliki visual yang generik dan monoton (kotak transparan standar). KY-Poni menghadirkan pengalaman visual imersif yang terinspirasi dari antarmuka video game populer, diawali dengan **Persona 5 Aesthetic Theme** (balon kata komik bersudut tajam, tipografi manga distressed, kontras tinggi merah-hitam-putih, animasi cut-in Super Chat *All-Out Attack*), serta katalog tema game modular di masa mendatang (Retro JRPG, Undertale, Cyberpunk, dll).

Target audiens awal adalah para VTuber, gaming streamer, dan kreator YouTube yang menginginkan identitas visual livestream unik tanpa beban setup yang rumit.

---

## 2. Pilihan Arsitektur & Tech Stack

### A. Runtime & Desktop Engine: **Tauri (Rust + Web Frontend)**
* **Kenapa Bukan Full Web / Hosted SaaS?**
  * Quota Google Cloud YouTube Data API v3 resmi dibatasi 10.000 unit/hari (setara ~1,5 jam pembacaan chat streaming 1 channel). Model SaaS terpusat akan runtuh seketika akibat kuota dan biaya server WebSocket.
  * Dengan arsitektur desktop lokal, setiap streamer membaca stream dari IP dan koneksi lokal mereka sendiri. Biaya server pengembang = **Rp 0**.
* **Kenapa Bukan Electron?**
  * Electron mengonsumsi 400 MB - 1 GB RAM, memberatkan sistem streamer saat memainkan game AAA.
  * **Tauri (Rust)** hanya memakan RAM **30–60 MB**, waktu buka instan, dan ukuran installer portable hanya **~15 MB**.
* **Target Packaging:**
  * Windows: Single executable portable (`KY-Poni.exe`) & NSIS installer.
  * Linux: Portable AppImage (`KY-Poni.AppImage`) & RPM.

### B. YouTube Chat Engine (Zero-Quota Innertube Client)
* Streamer **tidak perlu login OAuth** atau membuat API key Google yang rumit.
* Streamer cukup memasukkan Channel ID, URL livestream, atau YouTube Handle (contoh: `@MilkyPoni`).
* Backend Rust / Node worker mengekstrak `liveChatContinuation` token secara lokal via protokol internal YouTube (Innertube), bebas dari limit kuota harian Google Data API.

### C. OBS Integration (Local Browser Source)
* Backend KY-Poni menjalankan HTTP & WebSocket server lokal ringan pada port terdedikasi:
  * URL Overlay: `http://localhost:19840/overlay?theme=persona5&layout=vertical`
  * Dashboard Settings: `http://localhost:19840/` (atau langsung di jendela GUI Tauri).
* OBS Studio cukup menambahkan Browser Source ke URL lokal tersebut. Latensi 0 ms dengan refresh rate lancar 60 FPS.

---

## 3. Sistem Desain & Fitur Spesifik

### A. Persona 5 Theme Engine (Flagship v1)
* **Balon Kata Komik Bergerigi:**
  * Implementasi via CSS `clip-path: polygon(...)` dengan sudut kemiringan dinamis (*skew* -7° s/d -10°).
  * Tab nama pengirim berlatar hitam/putih kontras tinggi yang menancap di sudut balon dialog.
* **Tipografi & Aset:**
  * Custom stencil manga font (*p5hatty* style).
  * Text rendering tajam dengan drop-shadow hitam tebal solid (*comic shadow*, bukan blur gaussian).
* **Super Chat & New Membership "All-Out Attack Cut-In":**
  * Efek visual spesial saat menerima Super Chat / Donasi atau Member Baru:
  * Layar overlay diisi slash kartu merah-hitam dinamis berputar, teks donasi tercetak besar, menahan atensi selama 3-5 detik sebelum bertransisi kembali ke chat feed.

### B. Dimensi Standar OBS Canvas & Perilaku Layout
1. **Vertical Sidebar Mode:** `450 x 800 px` (Dirancang untuk sudut kanan/kiri layar gameplay).
2. **Bottom Ticker / Horizontal Mode:** `800 x 300 px` (Anti-shrink fixed width `min-width: 220px`, smooth slide push ke kiri saat pesan baru masuk).

### C. 4-Corner Screen Anchors (Posisi Sudut Layar)
* **Pojok Kiri Bawah (`bottom-left` - Default):** Chat baru masuk dari bawah, mendorong pesan lama ke atas, rata kiri.
* **Pojok Kanan Bawah (`bottom-right`):** Chat baru masuk dari bawah, mendorong pesan lama ke atas, rata kanan dengan bayangan dan tab nama terinversi agar tidak terpotong tepi layar.
* **Pojok Kiri Atas (`top-left`):** Chat baru membanting masuk dari atas (*slam-down*), mendorong pesan lama ke bawah (*top-to-bottom flow*), cocok untuk game dengan HUD/minimap di bawah (Dota 2 / Mobile Legends).
* **Pojok Kanan Atas (`top-right`):** Chat baru masuk dari atas ke bawah, rata kanan dengan bayangan terinversi.

### D. Sistem Auto-Hide & Retention Guard (Keep Last N)
* **Auto-Hide Timer (Configurable):** Pesan lama otomatis fade-out dan keluar dari layar setelah N detik (default: 8 detik, dapat di-set 0 untuk nonaktif).
* **Retention Guard ("Keep Last N"):** Menjamin agar layar stream tidak menjadi kosong/mati saat kolom komentar sepi. Sistem secara cerdas menahan N pesan terakhir (default: 1 pesan) agar tetap terlihat sampai ada penonton baru yang mengirim chat pengganti.

### E. Live Customization Suite & Preferences Persistence
* **Overall Scale:** Slider skala dinamis 70% s/d 150% (default: 100%) dengan transform-origin sesuai sudut anchor.
* **Font Size & Family:** Slider ukuran teks 12px s/d 26px (default: 16px) dan pilihan font terkurasi (Space Grotesk, Bebas Neue, Inter, Bangers, Montserrat, VT323).
* **Text Color & Swatches:** Color picker kustom + quick palette swatches (Putih, Kuning Neon, Cyan Mint, Neon Pink, Neon Green).
* **Preferences Persistence (`config.json`):** Seluruh preferensi streamer otomatis disimpan ke `config.json` via `/api/config` dan terisi otomatis saat membuka aplikasi kembali.

### F. Cakupan Elemen Chat (v1 Scope)
* Pesan teks murni & mention.
* Badge resmi YouTube: Channel Owner, Moderator, Verified, Member/Sponsor.
* YouTube standard emotes dan Android/iOS native Unicode emojis.
* Tanpa filter bot/kata kasar di v1 (fokus performa dan fidelitas estetika).

---

## 4. GitHub-Backed Dynamic Theme Catalog (Zero-Cost CDN)

Aplikasi utama tetap berukuran mini karena tidak mem-bundle seluruh aset tema game secara berlebihan.
* **Katalog Remote:**
  * Di-host secara publik di GitHub repository via file `catalog.json`.
  * Berisi metadata tema, thumbnail preview, nama author, dan link download bundle `.zip`.
* **Download On-Demand:**
  * Streamer dapat melihat preview tema langsung di aplikasi.
  * Menekan tombol "Install" akan mengunduh dan mengekstrak tema ke folder lokal pengguna:
    * Linux: `~/.config/ky-poni/themes/<theme_id>/`
    * Windows: `%APPDATA%/KY-Poni/themes/<theme_id>/`
* **Keuntungan:** Update dan rilis tema baru dapat dilakukan kapan saja tanpa perlu merilis update binari `.exe`/`.AppImage`. Komunitas kreator/modder dapat membuat custom theme mereka sendiri.

---

## 5. Milestone & Rencana Implementasi

1. **Fase 1: Core Engine & YouTube Ingestion (Selesai ✅)**
   - Setup broadcaster HTTP/WebSocket port 19840.
   - Zero-quota YouTube live chat ingest protocol.
2. **Fase 2: Persona 5 Theme & OBS Overlay Client (Selesai ✅)**
   - Rekonstruksi presisi aset Persona 5 Atlus (Origami ribbon, polaroid tilted avatar, slanted tags).
   - 4-corner screen anchors, anti-shrink ticker, auto-hide retention guard.
   - Suite kustomisasi (skala, font, warna teks, persistensi config.json).
3. **Fase 3: Theme Catalog & Storage System (Selesai ✅)**
   - Sistem direktori tema dinamis cross-platform (`~/.config/ky-poni/themes/` & `%APPDATA%/KY-Poni/themes/`).
   - Downloader & extractor katalog tema otomatis (`/api/themes/install` & `/api/themes/delete`).
   - Tombol buka folder tema dan registrasi instan tanpa restart.
4. **Fase 4: Packaging & Portable Binaries (Selesai ✅)**
   - Build portable Windows standalone `.exe` (`dist/KY-Poni 0.3.0.exe` / `v0.4.0`).
   - Build portable Linux standalone `.AppImage` (`dist/KY-Poni-0.3.0.AppImage` / `v0.4.0`).
   - Integrasi desktop window native dengan lifecycle server otomatis (port 19840).
   - Automated testing & QA review 100% Green.
