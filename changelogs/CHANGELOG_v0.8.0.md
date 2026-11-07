# Changelog KY-Poni v0.8.0-alpha (2026-11-07)

### 🗡️ Phase 8: Persona 3 Reload Theme Engine & Aganè Typography Integration
- **Tema Baru Persona 3 Reload (`persona3reload`):**
  - Mengintegrasikan tema visual resmi game **Persona 3 Reload** ke dalam KY-Poni sebagai tema built-in inti.
  - Membawa siluet gelembung dialog Tartarus otentik dengan palet khas *Deep Midnight Navy* dan garis tepi *Electric Cyan*.
- **Asset-First 3-Piece Slicing Architecture:**
  - Mengekstrak aset speech bubble mentah ($2170 \times 725$ px) menjadi 3 potongan modular:
    1. `bubble_left.png` (Left Cap): Mengunci ekor segitiga tajam (*sharp geometric origami tail*) dan lengkungan kiri.
    2. `bubble_mid.png` (Mid Slice): Bodi tengah elastis (`flex: 1`) dengan perlindungan anti-seamline (`margin: 0 -1px`).
    3. `bubble_right.png` (Right Cap): Mengunci sudut kanan dan drop shadow grafis.
  - Balon chat elastis memanjang horizontal secara bebas tanpa mendistorsi proporsi ornamen kiri dan kanan.
- **Tipografi Resmi P3R (Aganè Font Family):**
  - Mengunduh dan membundel font resmi komunitas modding P3R berlisensi OFL:
    - `Agane-Roman.ttf` (Teks dialog pesan)
    - `Agane-Bold.ttf` (Username dan highlight)
    - `Agane-ExtraBold.ttf` (Status badge TALK)
  - Seluruh font disimpan lokal di direktori `assets/fonts/` (zero-CDN dependency saat live streaming).
- **Dynamic Status Badge (TALK / Super Chat / Member):**
  - Chat umum: Menampilkan status badge mikro **TALK** dengan aksen cyan neon.
  - Super Chat / Donasi: Menampilkan nominal donasi natural (misal `Rp 100.000`) dengan highlight emas hangat.
  - New Member: Menampilkan badge **NEW MEMBER** dengan aksen hijau emerald.
- **Graphic Hard-Edge Drop Shadow:**
  - Menerapkan stylized layered shadow (`drop-shadow(4px 6px 0px rgba(0, 12, 32, 0.9))`) untuk kedalaman visual yang tajam di atas footage gameplay live stream tanpa efek blur yang kotor.
- **Catalog Integration & Showcase:**
  - Kartu tema Persona 3 Reload ditampilkan secara berdampingan dengan Persona 5 Phantom pada katalog tema dashboard aplikasi dengan banner visual 1:1 identik.
