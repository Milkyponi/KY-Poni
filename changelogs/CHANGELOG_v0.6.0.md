# Changelog KY-Poni v0.6.0-alpha (2026-11-04)

### 🚀 Phase 6: Remote GitHub Theme Catalog & Dynamic Theme-Bound Presets
- **Dedicated GitHub Theme Catalog Repository (`Milkyponi/ky-poni-themes`):**
  - Pemisahan repositori tema game resmi dari binary aplikasi utama. Ukuran binary KY-Poni tetap ramping (~60 MB) dan rilis tema baru dapat dipublikasikan kapan pun secara independen tanpa perlu merilis ulang seluruh aplikasi desktop.
  - Inisiasi repositori resmi: `https://github.com/Milkyponi/ky-poni-themes` dengan rilis perdana `v1.0.0`.
  - Dua tema game resmi pertama tersedia untuk diunduh langsung:
    1. **Undertale Retro Box:** Kotak dialog 8-bit hitam-putih dengan border piksel, ikon Soul merah, dan font `VT323`.
    2. **Cyberpunk 2077 Night City HUD:** Kotak dialog chamfered polygon futuristik beraksen neon yellow `#FFE600` / cyan `#00F0FF`, tag `// COMMS //`, dan font `Chakra Petch`.
- **In-App Dynamic Install & Uninstall System:**
  - Kartu tema di Tab 2 (*Katalog Tema*) kini memiliki tombol aksi dinamis:
    - **`⚡ Instal & Pasang`**: Otomatis mengunduh berkas `.zip` dari GitHub Releases `ky-poni-themes`, mengekstraknya ke direktori data pengguna persisten OS (`~/.config/ky-poni/themes/<id>` di Linux / `%APPDATA%/KY-Poni/themes/<id>` di Windows), dan langsung mengaktifkannya.
    - **`🗑️ Hapus`**: Menghapus tema dari direktori lokal serta membersihkan font bawaannya dari sistem.
- **Smart Presets Auto-Apply (Opsi 1A):**
  - Setiap tema kini mengikat preferensi bawaan game (`presets`) dalam `theme.json`:
    - Mengganti tema otomatis mengaplikasikan font otentik game, warna teks khas game, ukuran font proporsional, dan rekomendasi resolusi kanvas OBS.
    - Streamer tetap bebas menggeser slider kustomisasi sesuka hati setelah preset diaplikasikan.
- **Dynamic Font Lifecycle:**
  - Font bawaan tema (seperti `OptimaNova`, `VT323`, `Chakra Petch`) otomatis disuntikkan ke dropdown selector tipografi saat tema terpasang, dan otomatis dicopot saat tema dihapus.
