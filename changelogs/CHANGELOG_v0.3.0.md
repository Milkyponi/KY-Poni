# Project Archive & Changelog: KY-Poni (v0.3.0-alpha)

- **Tanggal Rilis**: 2026-11-02
- **Lead Developer**: Fonzy (Divisi Software Development)
- **Status**: Phase 3 Milestone (Theme Catalog & Storage System)
- **Port Layanan**: `http://localhost:19840/`

---

## Ringkasan Fitur & Changelog v0.3.0 (Phase 3 Complete)

Implementasi modul Theme Manager mandiri (`src/theme_manager.js`) yang menangani katalog remote, instalasi tema on-demand, dan struktur direktori tema kustom cross-platform:

### 1. Sistem Penyimpanan Tema Cross-Platform (User Themes Directory)
- Mendukung penyimpanan tema dinamis di luar direktori instalasi aplikasi utama:
  - **Linux:** `~/.config/ky-poni/themes/<theme_id>/`
  - **Windows:** `%APPDATA%/KY-Poni/themes/<theme_id>/`
- Modder dan streamer dapat menaruh folder tema kustom buatan mereka sendiri langsung ke folder tersebut.

### 2. Dynamic Remote Theme Downloader & Extractor
- Endpoint REST terpasang:
  - `POST /api/themes/install`: Mengunduh berkas `.zip` tema secara otomatis dari remote repository GitHub atau paket lokal, mengekstrak secara non-blocking, memvalidasi `style.css` dan `theme.json`, lalu meregistrasikannya secara instan.
  - `POST /api/themes/delete`: Menghapus tema kustom yang telah dipasang dengan guardrail aman (tema inti bawaan `persona5` dan `classic` dilindungi dari penghapusan).
  - `GET /api/themes/open-folder`: Membuka folder tema kustom pengguna langsung di file explorer OS (`xdg-open` di Linux / `explorer` di Windows).

### 3. Integrasi Interaktif di Dashboard Studio
- Card **Remote Theme Catalog** kini dilengkapi tombol aksi **"📥 Pasang"** pada tema yang belum terinstal (`undertale-box`, `cyberpunk-2077`).
- Menekan tombol pasang akan memicu instalasi otomatis, mengubah badge menjadi **"TERPASANG"**, dan langsung menambahkan tema ke dropdown **"Active Theme"** tanpa perlu me-restart server atau OBS.
- Tombol **"📂 Folder Tema"** di header katalog memungkinkan streamer membuka folder penyimpanan lokal dengan satu klik.
