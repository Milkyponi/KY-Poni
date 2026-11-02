# Changelog KY-Poni v0.4.1-alpha (2026-11-02)

### 🐛 Bug Fixes & Stabilitas
- **EADDRINUSE Port Graceful Recovery:** Menambahkan deteksi dan penanganan aman bila port `19840` sudah dipakai oleh server lokal lain. Jendela aplikasi akan langsung menggunakan server aktif tanpa melemparkan *uncaught exception* crash dialog.
- **Single-Instance Application Lock:** Mengaktifkan `app.requestSingleInstanceLock()` pada Electron. Membuka aplikasi berulang kali tidak akan memicu tabrakan port, melainkan memfokuskan jendela yang sudah berjalan.
- **Production Error Guard:** Menghilangkan dialog pop-up JavaScript error yang mengganggu pada level Electron main process.

### 📦 Distribusi & Packaging
- Diperbarui di Gear Lever (`it.mijorus.gearlever`) dengan pelacak rilis `GithubUpdater`.
- Binari portable terbaru tersedia untuk Linux (`.AppImage`) dan Windows (`.exe`).
