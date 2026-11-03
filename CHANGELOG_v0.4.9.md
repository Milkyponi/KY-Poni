# Changelog KY-Poni v0.4.9-alpha (2026-11-03)

### 💾 Cross-Version Persistent Preferences
- **OS User Data Storage:** Memindahkan penyimpanan file `config.json` dari folder temporary / internal mount (`__dirname`) ke direktori data pengguna OS permanen:
  - Linux: `~/.config/ky-poni/config.json` (`$XDG_CONFIG_HOME/ky-poni/config.json`)
  - Windows: `%APPDATA%/KY-Poni/config.json`
- **Zero-Reset Updates:** Preferensi skala kanvas, ukuran font, jenis font, warna teks, sudut layar, dan auto-hide sekarang bertahan selamanya lintas pembaruan versi (tidak akan pernah ter-reset saat update biner baru).
- **Auto-Migration:** Menambahkan migrasi otomatis satu-kali jika terdapat konfigurasi lama di direktori lokal.

### 📐 Dynamic Horizontal Chat Flow & Anchor Alignment
- **Anchor-Sensitive Chat Insertion:** Pada mode horizontal, chat baru sekarang selalu muncul langsung di sisi anchor:
  - **Pojok Kiri Bawah / Kiri Atas (`bottom-left` / `top-left`):** Chat terbaru langsung muncul di anchor sisi kiri (`prepend`) dan mendorong chat sebelumnya ke arah kanan. Scroll otomatis terkunci di sisi kiri (`scrollLeft = 0`).
  - **Pojok Kanan Bawah / Kanan Atas (`bottom-right` / `top-right`):** Chat terbaru muncul di anchor sisi kanan (`append`) dan mendorong chat sebelumnya ke arah kiri.
- **Directional Slide-Out Animation:** Chat terlama yang kedaluwarsa pada posisi kiri akan memudar dan bergeser keluar ke arah kanan (`p5-slide-out-right`), menjaga aliran visual natural seperti ticker berita / broadcast TV.
- **Synchronized Auto-Hide Eviction:** Logika pemangkasan chat (`maxMessages` dan auto-hide `keepLastN`) disinkronkan agar selalu membuang chat yang paling lama sesuai arah alirannya.

### 🎨 Authentic Persona 5 Catalog Preview & Curated Catalog
- **Authentic 3-Piece Sliced Banner:** Memperbarui banner preview tema Persona 5 di Tab 2 (Katalog Tema) menggunakan potongan aset grafis resmi (`bubble_left.png`, `bubble_mid.png`, `bubble_right.png`), font otentik P5 (`p5hatty`, `OptimaNova`), nameplate ransom-note dengan aksen merah, dan teks dialog *"For real?! Lookin' cool, Joker!"*.
- **Clean Curated Themes Showcase:** Menghilangkan seluruh tombol dan instruksi custom theme folder (`openThemesFolder`). Kartu koleksi masa depan kini murni menampilkan badge *"🚀 Segera Hadir"*.
