# Changelog KY-Poni v0.5.1-alpha (2026-11-04)

### 🎨 UI/UX Refinement & Layout Ergonomics
- **Header Layout Restructuring:**
  - Menghilangkan subtitle teks `"Game-aesthetic Overlay for OBS"` di bawah judul brand `KY-Poni Chat Studio` untuk estetika navbar yang bersih dan minimalis.
  - Memindahkan input widget dan tombol salin **URL OBS Browser Source** langsung ke header utama dengan padding presisi dan isolasi `min-width: 0`, memberikan akses instan 1-klik bagi streamer.
  - Menggeser pil navigasi segmented tab (`Studio`, `Katalog Tema`, `Pengaturan`) ke sisi kanan navbar dengan negative space seimbang (zero overlap terverifikasi).
  - Menambahkan badge versi aplikasi (`v0.5.1`) di samping tombol `🔄 Cek Update` yang tersinkronisasi secara dinamis via REST API.
- **Studio Sidebar & Simulator Controls:**
  - Mengubah heading card YouTube menjadi `"YOUTUBE LIVE"`.
  - Mengubah tombol koneksi menjadi `"⚡ Connect"`.
  - Menurunkan batas skala minimum kanvas dari `70%` menjadi **`25%`** (rentang slider kini `25%` – `150%`), memberikan fleksibilitas kanvas bagi streamer dengan layar resolusi tinggi atau layout kompresi.
  - Menyederhanakan penamaan tombol Live Testing Simulator menjadi nama peran bersih:
    - `🗣️ General` (sebelumnya *Ryuji Normal*)
    - `👑 Owner` (sebelumnya *Morgana Owner*)
    - `🛡️ Moderator` (sebelumnya *Makoto Mod*)
    - `✦ Member` (sebelumnya *Ann Membership*)
    - `💥 Super Chat` (sebelumnya *Super Chat All-Out Attack*)
  - Memindahkan instruksi dimensi OBS (`💡 Rekomendasi OBS: Width x Height px`) langsung di bawah dropdown preset resolusi kanvas.
- **Katalog Tema:**
  - Menghilangkan blok teks deskripsi dan atribusi kredit (`By Milky Brain (Fonzy)`) di seluruh kartu katalog tema agar fokus murni pada preview visual estetika game dan nama tema.
  - Memperbarui sub-header katalog menjadi: *"Koleksi tema visual video game resmi dari Milkyponi untuk mempercantik siaran livestreaming Anda."*
- **Tab Pengaturan:**
  - Menyederhanakan status InnerTube Ingest menjadi **`Aktif`** (menghilangkan embel-embel *Zero-Quota*).
