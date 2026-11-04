# Project Archive & Changelog: KY-Poni (v0.2.2-alpha)

- **Tanggal Rilis**: 2026-11-02
- **Lead Developer**: Fonzy (Divisi Software Development)
- **Status**: Customization Engine & Preferences Persistence Milestone
- **Port Layanan**: `http://localhost:19840/`

---

## Ringkasan Fitur & Changelog v0.2.2

Fitur kustomisasi bebas dan persistensi konfigurasi pengguna telah diimplementasikan:

### 1. Kustomisasi Skala Canvas Keseluruhan (`scale`)
- Dilengkapi slider rentang **70% s/d 150%** (step 5%) untuk menyesuaikan ukuran chatbox terhadap resolusi layar streamer (1080p, 1440p, hingga 4K).
- Properti `transform-origin` secara otomatis menyelaraskan titik pembesaran/pengecilan ke sudut posisi layar yang aktif (misal `bottom left`, `top right`).

### 2. Kustomisasi Ukuran Teks Pesan (`fsize`)
- Slider ukuran font teks dari **12px s/d 26px** (default: 16px), memberikan kontrol penuh pada keterbacaan pesan penonton di layar.

### 3. Pilihan Kurasi Font Komik & Modern (`font`)
- Dropdown font Google Fonts siap pakai:
  - **Space Grotesk** (Default - Modern Anime/Manga)
  - **Bebas Neue** (Punchy Comic All-Caps)
  - **Inter** (Clean & Ultra Legible)
  - **Bangers** (Western Comic Book)
  - **Montserrat** (Sleek Modern Bold)
  - **VT323** (Retro 8-Bit Pixel Gamer)

### 4. Kustomisasi Warna Teks & Swatches Favorit (`color`)
- Native color picker + input nilai heksadesimal.
- Quick swatch tombol warna favorit: Putih (`#FFFFFF`), Kuning Neon (`#FFE600`), Cyan Mint (`#00F0FF`), Neon Pink (`#FF007F`), dan Neon Green (`#00E676`).

### 5. Persistensi Konfigurasi Lokal Otomatis (`/api/config`)
- Setiap kali streamer mengubah pengaturan (slider skala, font, warna, sudut layar, handle YouTube), sistem secara otomatis menyimpan preferensi ke `src/config.json`.
- Saat aplikasi dibuka kembali, seluruh konfigurasi terakhir dimuat otomatis tanpa perlu pengaturan ulang dari awal.
