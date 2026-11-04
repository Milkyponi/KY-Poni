# Changelog KY-Poni v0.4.4-alpha (2026-11-02)

### 📐 Canvas Scaling & Dynamic Resolution Suite
- **Inverse Mathematical Scaling:** Mengubah kalkulasi CSS container `#chat-canvas` menjadi `width: calc(100% / var(--canvas-scale, 1))` dan `height: calc(100% / var(--canvas-scale, 1))`. Saat skala diatur hingga mentok kanan (150%), balon kata dan seluruh elemen membesar proporsional tanpa pernah terpotong (*zero clipping*) di sisi kanan maupun atas.
- **Protected Gutter Margins:** Menambahkan margin aman `calc(100% - 28px)` dan `margin-right: 20px` pada wadah balon Persona 5 untuk menampung sudut miring `skewX(-14deg)`, aksen panah komik (*speed shard arrow*), dan drop-shadow hitam.
- **Suite Preset Resolusi Kanvas Lengkap:**
  - `Vertical Standar (450 x 800 px)`
  - `Vertical Lebar (600 x 900 px) ★` (Sangat disarankan untuk streamer yang menggunakan skala teks besar 120%–150%)
  - `Vertical Ringkas (380 x 650 px)` (Cocok untuk layout minimalis di monitor kecil)
  - `Horizontal Ticker (800 x 300 px)`
  - `Horizontal Ultrawide (1200 x 320 px)`
  - `Full-HD 1080p (1920 x 1080 px)` (Mode bebas sudut langsung pasang 1 sumber layar di OBS)
- **Dynamic OBS Setup Tooltip:** Menampilkan petunjuk ukuran OBS yang otomatis berubah sesuai preset yang dipilih: *"💡 Rekomendasi OBS: Width [W] x Height [H] px"*.
