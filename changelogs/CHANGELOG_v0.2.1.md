# Project Archive & Changelog: KY-Poni (v0.2.1-alpha)

- **Tanggal Rilis**: 2026-11-02
- **Lead Developer**: Fonzy (Divisi Software Development)
- **Status**: Visual Accuracy Refinement (Exact Gambar 1 & 2 Parity)
- **Port Layanan**: `http://localhost:19840/`

---

## Ringkasan Fitur & Changelog v0.2.1

Berdasarkan inspeksi piksel mendalam dan sampling warna langsung dari berkas referensi:

### 1. Parallelogram Skew Geometry & Cel-Shaded Stroke
- Mengganti bodi kotak dengan **Jajar Genjang Miring (`skewX(-14deg)`)** dengan sudut dinamis presisi.
- Menerapkan **Garis Tepi Putih Tebal (3.5px solid #FFFFFF)** dengan **Hard Drop Shadow Hitam Cel-Shaded (`box-shadow: 6px 6px 0px #000000`)**.
- Teks pesan di-unskew secara proporsional (`transform: skewX(14deg)`) menjamin keterbacaan 100%.

### 2. Penempatan Avatar Polaroid Miring (Embedded Overlap)
- Avatar bujursangkar diputar `-12deg` dengan bingkai putih tebal (3.5px) dan menempel tertanam di sisi kiri pita dialog.
- Ditambahkan aksen duri komik segitiga (*comic shard*) di balik avatar.

### 3. Palet Warna Tag Asli Gambar 2
- Tag username jajar genjang miring menancap langsung di atas garis tepi balon dengan kode warna sampel asli:
  - **Ungu Lavender**: `#6D64FD`
  - **Toska / Mint**: `#4BC196`
  - **Kuning**: `#F5BE29`
  - **Merah Phantom**: `#D03D3D`

### 4. Alert Box Dua Tingkat (Super Chat & Membership)
- **Super Chat (#D03D3D):** Header merah 70% tinggi dengan username + nominal donasi miring putih tebal, body hitam 30% tinggi dengan teks komentar donatur.
- **Membership (#11AA72):** Header hijau emerald 70% tinggi dengan username + teks `WELCOME TO MEMBERSHIP`, body hitam 30% tinggi.
- Sudut kanan atas dilengkapi aksen stiker duri komik panah ganda (*sticker shard*).
