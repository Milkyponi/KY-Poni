# Changelog KY-Poni v0.5.0-alpha (2026-11-04)

### 🏛️ Phase 5 Architecture Modularization & Clean Code Refactoring
- **Separation of Concerns (SoC) & PRD:**
  - Menerbitkan dokumen resmi **`PRD.md`** (Product Requirements Document), **`THEME_SPEC.md`** (Theme Plugin Contract & Developer Guide), dan **`ROADMAP.md`** (Peta Jalan Jangka Panjang).
  - Merapikan struktur proyek dengan memindahkan seluruh arsip pembaruan ke direktori khusus **`changelogs/`**.
- **Modular Native Backend Router (`src/routes/`):**
  - Memecah monolit `src/server.js` (500+ baris) ke dalam modul router native Node.js tanpa dependensi eksternal:
    - `src/routes/status.js`: Status koneksi, versi aplikasi, dan graceful shutdown.
    - `src/routes/config.js`: Persistent configuration endpoints (`/api/config`).
    - `src/routes/ingest.js`: YouTube live streaming connect, disconnect, dan chat simulator.
    - `src/routes/themes.js`: Katalog dan inventaris tema resmi.
    - `src/routes/updater.js`: In-app GitHub releases auto-updater.
    - `src/routes/static.js`: Melayani aset kanvas, font, dan file publik dengan proteksi MIME type dan boundary traversal guard.
    - `src/routes/index.js`: Global request dispatcher dengan penanganan CORS terpusat.
  - Memperkenalkan **`ConfigManager`** (`src/config_manager.js`) yang mengelola persistensi konfigurasi pengguna di direktori OS resmi (`~/.config/ky-poni/` di Linux / `%APPDATA%/KY-Poni/` di Windows).
  - Menyederhanakan `src/server.js` menjadi lean orchestrator (~120 baris) yang fokus pada bootstrapping HTTP, WebSocket, dan graceful shutdown.
- **Dynamic Theme Plugin Architecture (`THEME_SPEC.md`):**
  - Mengeliminasi seluruh pengecekan tema hardcoded (`if (theme === 'persona5')`) di `src/public/overlay.js`.
  - Mengubah Core Overlay Engine menjadi agnostic: hanya mengelola antrean pesan, posisi sudut (*anchors*), scrolling terarah (*horizontal/vertical directional flow*), dan auto-hide retention.
  - Mengimplementasikan plugin tema modular:
    - `src/public/themes/persona5/renderer.js`: Plugin tema Persona 5 mandiri (3-piece sliced asset skin, ransom-note nameplate, 3-tier height, dan auto-fit font scaling).
    - `src/public/themes/classic/renderer.js`: Plugin tema minimalis transparan mandiri.
  - Menambah tema game baru di masa depan kini 100% independen tanpa perlu memodifikasi kode inti overlay!
- **Automated Test Suite Expansion:**
  - Menambahkan pengujian kepatuhan kontrak plugin tema modular pada `test/test_server.js` (11/11 scenarios passed, 100% Green).
