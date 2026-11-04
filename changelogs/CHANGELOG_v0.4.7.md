# Changelog KY-Poni v0.4.7-alpha (2026-11-03)

### ⚡ One-Click In-App Seamless Auto-Update & Restart
- **Auto-Replacement & Relaunch (Linux .AppImage):** Setelah pengunduhan rilis baru mencapai 100%, tombol sekarang berubah menjadi *"⚡ Pasang & Mulai Ulang"*. Sistem secara cerdas menggantikan biner AppImage aktif (`process.env.APPIMAGE` atau `~/AppImages/kyponi.appimage`), mem-spawn versi baru secara detached, dan menutup instance lama sehingga aplikasi langsung ter-restart ke versi terbaru tanpa intervensi manual.
- **Self-Replacement Helper (Windows .exe Portable):** Menerapkan skrip runner background `.cmd` yang memantau penutupan PID aplikasi lama, menggantikan biner portable yang terkunci oleh kernel Windows, meluncurkan versi baru, dan menghapus dirinya sendiri (*clean self-deletion*).
- **Graceful Port Handover:** Memastikan penutupan server internal port 19840 dan single-instance lock terlepas mulus saat versi baru mengambil alih layar studio.
