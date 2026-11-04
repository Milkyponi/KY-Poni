# Changelog KY-Poni v0.4.5-alpha (2026-11-02)

### 🐛 Auto-Updater Strict Semver & Anti-Spam Fixes
- **Strict Semver Inequality:** Memperbaiki logika perbandingan versi pada `src/updater.js`. Notifikasi pembaruan sekarang **hanya** muncul jika tag versi rilis di GitHub secara mutlak lebih tinggi daripada versi aplikasi yang sedang berjalan (`isNewer = latestTag > currentVersion`).
- **Dismissed Version Memory (Anti-Spam):** Saat pengguna mengklik *"✕ Lewati Dulu"*, sistem menyimpan preferensi tersebut ke `localStorage`. Pengguna tidak akan diganggu lagi oleh pop-up update berulang setiap kali membuka aplikasi atau berpindah tab untuk versi yang sama.
- **Auto-Termination Outdated Server:** Electron sekarang memverifikasi versi server lokal port `19840` (`/api/version`). Jika terdapat server versi lama yang masih berjalan di latar belakang, Electron secara otomatis menghentikannya via `POST /api/shutdown` dan meluncurkan server versi terbaru yang cocok.
- **Dynamic Version Reflection:** Versi di tab Pengaturan sekarang disinkronkan secara dinamis langsung dari runtime (`pkg.version`) dan bukan teks statis hardcoded.
