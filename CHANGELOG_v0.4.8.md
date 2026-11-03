# Changelog KY-Poni v0.4.8-alpha (2026-11-03)

### 🛡️ YouTube Ingest Anti-RTO Engine & Self-Healing Watchdog
- **Transient RTO Resilience:** Menghubungkan pelindung timeout 10 detik (`axios.defaults.timeout = 10000`) pada request InnerTube untuk mencegah hanging sockets saat terjadi packet drop / sinyal hilang sesaat.
- **Soft Reconnecting State:** Jika terjadi error jaringan sementara (ETIMEDOUT, ENOTFOUND, ECONNRESET), status beralih ke `reconnecting` (kuning lembut) alih-alih melempar error fatal atau memutuskan koneksi overlay.
- **Auto-Recovery on Incoming Chat:** Begitu sinyal internet kembali dan pesan chat YouTube berikutnya tiba, status secara otomatis pulih kembali ke `connected` dan mereset error counter ke 0.
- **Self-Healing Watchdog with Exponential Backoff:** Jika RTO berlangsung lebih dari 4 siklus polling (~8-15 detik) atau token continuation basi, watchdog secara otomatis menutup sesi yang macet dan menyambung ulang (*fetchLivePage*) dari awal secara transparan di background tanpa perlu streamer menekan tombol apapun di dashboard.
- **Real-Time WebSocket System Status:** Menghubungkan event `SYSTEM_STATUS` ke antarmuka Dashboard via WebSocket sehingga indikator status stream merespons status jaringan secara instan (0 ms latensi).
