# Changelog KY-Poni v0.7.0-alpha (2026-11-07)

### 🚀 Phase 7: Fixed 1000x1000 Canvas Architecture & Streamlabs Layout Flow Paradigm
- **Pembersihan Total Dropdown Resolusi Kanvas:**
  - Mengeliminasi menu preset resolusi lama (450x800, 600x900, 380x650, 800x300, 1200x320, 1080p) yang membingungkan pengguna.
  - Mengadopsi **Paradigma Streamlabs**: KY-Poni murni berfokus menyajikan estetika overlay chatbox tema, sementara penyesuaian tata letak scene (posisi, crop, scale) diserahkan seutuhnya ke OBS Studio.
- **Standar Kanvas Tetap 1000 x 1000 px:**
  - Rekomendasi Browser Source OBS dibakukan menjadi **Width 1000 x Height 1000 px**.
  - **Zero-Clipping Guarantee**: Lebar kanvas 1000 px menjamin balon chat (seperti Persona 5 berlebar ~540 px) pada skala terbesar 150% (~810 px + skew) tidak pernah terpotong di tepi layar kiri maupun kanan.
  - **High Capacity Stack**: Tinggi kanvas 1000 px menampung tumpukan vertikal banyak komentar pada skala kecil (25% - 70%).
- **Kontrol Arah Aliran Chat (Layout Flow):**
  - Dropdown layout kini murni menentukan orientasi pergerakan chat:
    1. **Vertikal (Stack Atas / Bawah)** (`layout=vertical`): Komentar mengalir naik/turun sesuai tumpuan anchor (bawah ke atas untuk bottom anchor, atas ke bawah untuk top anchor).
    2. **Horizontal (Ticker Menyamping)** (`layout=horizontal`): Komentar mengalir menyamping (kiri ke kanan untuk left anchor, kanan ke kiri untuk right anchor).
- **Live Canvas Preview 1:1 WYSIWYG (Scaled Projection):**
  - Iframe preview di dashboard dirender pada resolusi internal riil `1000 x 1000 px`.
  - Menggunakan `ResizeObserver` + CSS `transform: scale(var(--preview-zoom))` untuk memproyeksikan kanvas 1000x1000 secara responsif dan presisi ke panel preview studio tanpa memicu scrollbar.
  - Menghadirkan visualisasi yang 100% identik antara simulator dashboard dan Browser Source OBS.
- **Backward-Compatibility & Config Normalization:**
  - Konfigurasi lawas (`vertical-wide`, `vertical-compact`, `horizontal-wide`, `fullscreen`) dinormalisasi secara otomatis menjadi `'vertical'` atau `'horizontal'`.
  - URL OBS Browser Source kini lebih bersih dan ringkas.
