# Project Archive & Changelog: KY-Poni (v0.4.0-alpha)

- **Tanggal Rilis**: 2026-11-02
- **Lead Developer**: Fonzy (Divisi Software Development)
- **Status**: Phase 4 Milestone (Native Desktop Binaries for Linux & Windows)
- **Port Layanan Internal**: `http://localhost:19840/`

---

## Ringkasan Fitur & Changelog v0.4.0 (Native Packaging Complete)

Sesuai tujuan awal proyek untuk mendistribusikan aplikasi secara bebas kepada sesama streamer tanpa dependensi browser atau server luar, paket binari native portable telah berhasil di-compile dan diverifikasi:

### 1. Binari Standalone Portable Siap Distribusi
Telah ter-build secara bersih di folder `07_PROJECTS/KY-Poni/dist/`:
- **Linux Standalone Portable AppImage:**
  - Berkas: `KY-Poni-0.3.0.AppImage` (114 MB)
  - Cukup download, beri izin eksekusi (`chmod +x`), dan double-click langsung jalan di distro Linux modern mana pun (Fedora, Debian, Ubuntu, Arch).
- **Windows Standalone Portable Executable:**
  - Berkas: `KY-Poni 0.3.0.exe` (106 MB)
  - Berkas `.exe` portable mandiri (single executable). Streamer Windows cukup double-click tanpa perlu installer, tanpa perlu Node.js, dan tanpa perlu setup runtime.

### 2. Native Desktop Window Integration (`src/electron_main.js`)
- Menggantikan kebutuhan me-review via browser tab/localhost:
  - Saat aplikasi native dibuka, langsung memunculkan jendela desktop gelap berukuran 1320x880 px dengan auto-hide menu bar.
  - Secara otomatis menyalakan background broadcaster server di `port 19840` di balik layar.
  - Ketika jendela aplikasi ditutup oleh user, koneksi live chat YouTube dan server broadcaster otomatis dibersihkan secara rapi (*graceful teardown*).
  - Tautan web eksternal secara otomatis diarahkan ke default browser sistem.

### 3. Verifikasi Eksekusi Langsung di Workstation Bos
- Binari Linux AppImage telah diuji eksekusi langsung di lingkungan KDE Wayland (`wayland-0` / `:0`) milik Bos:
  - Proses `ky-poni` berhasil binding ke port `19840`.
  - Jendela GUI native studio aktif dan siap direview secara langsung di desktop Bos.
