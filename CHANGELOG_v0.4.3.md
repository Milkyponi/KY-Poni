# Changelog KY-Poni v0.4.3-alpha (2026-11-02)

### 🎨 UI/UX Redesign & Segmented Tab Navigation
- **Header Tab Navigation:** Mengganti layout bertumpuk menjadi 3 tab navigasi terstruktur:
  - **🎛️ Studio:** Workspace utama streamer (Koneksi YouTube, URL OBS, Kustomisasi Tipografi, Canvas Preview, dan Toolbar Simulator terintegrasi di bawah kanvas).
  - **🎨 Katalog Tema:** Galeri pameran tema berukuran penuh dengan cuplikan visual (*banner preview*), status tema aktif, dan tombol instalasi 1-klik.
  - **⚙️ Pengaturan:** Pusat status server lokal (`19840`), auto-updater GitHub, panduan setup OBS Studio, dan tombol reset preferensi pabrik.
- **Eliminasi Horizontal Scrollbar:** Memasang `overflow-x: hidden` dan pembatasan `min-width: 0` pada grid sidebar kiri sehingga slider skala dan font tampil rapi tanpa terpotong scrollbar.
- **Prominent OBS URL:** Memindahkan kartu URL Browser Source OBS ke posisi teratas tepat di bawah koneksi YouTube dengan tombol salin instan.
- **Zero-Scroll Viewport:** Menyesuaikan padding pada tab Pengaturan sehingga grid 2x2 pas di layar tanpa memerlukan scrolling vertikal.
