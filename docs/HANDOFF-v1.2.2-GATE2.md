# Serah-Terima Uji v1.2.2 — Gerbang 2 (Bos)

> **Status Gerbang 1: LULUS.** 217 assertion PASS (exit code 0), build biner berhasil (.AppImage + .exe), asar bersih (tanpa kebocoran developer config), dan biner terpasang di workstation Bos (`~/AppImages/kyponi.appimage`).
> **Gerbang 2: LULUS.** Bos menyatakan hasil 1.2.2 mantap dan memberi aba-aba rilis langsung (2026-11-14), tanpa temuan. Status: **DIRILIS v1.2.2**.

---

## 1. Yang Berubah (Versi Manusia)

Kartu YouTube Live di dashboard KY-Poni sekarang punya **dua mode**:
1. **Mode Terhubung (Connected Profile Card)**:
   - Ada foto avatar resmi YouTube (bulat dengan border glow aksen).
   - Nama tampilan kanal (misal: **MilkyPoni**).
   - Handle resmi (misal: **@milkyponi**).
   - Status badge real-time (**Live** merah / **Standby** cyan / **Offline** abu-abu).
   - Tombol **"Ganti"** untuk berpindah kanal.
2. **Mode Input (Form Isian)**:
   - Muncul saat instalasi baru atau saat tombol **"Ganti"** ditekan.
   - Ada tombol **"Connect"** dan tombol **"Batal"** (untuk kembali ke profil sebelumnya jika tidak jadi ganti).

**Nol Kuota & Nol Biaya**: Seluruh pengambilan foto dan nama kanal berjalan 100% lokal via YouTube InnerTube `/browse`. Tidak ada Google Cloud API, tidak ada kuota yang terpotong, dan tidak ada database server terpusat.

---

## 2. Panduan Uji Singkat untuk Bos

Biner v1.2.2 sudah terpasang di PC Bos. Cukup buka aplikasi lewat menu aplikasi desktop Bos atau jalankan `~/AppImages/kyponi.appimage`.

### Uji 1 — Profil Kanal Tampil Otomatis
1. Buka KY-Poni di PC Bos.
2. Buka dashboard di browser (`http://localhost:19840/` atau jendela Electron).
3. **Diharapkan:** Kotak YouTube Live langsung menampilkan kartu profil Milky Poni lengkap dengan foto profil YouTube Bos dan handle `@milkyponi` tanpa perlu mengetik ulang!

### Uji 2 — Ganti Kanal & Batal
1. Klik tombol **"Ganti"** di kartu profil.
2. Form input teks akan terbuka, dan tombol **"Batal"** muncul di samping tombol Connect.
3. Coba ketik handle lain (misal `@LofiGirl`) lalu klik **Connect**:
   - Status berubah menjadi "Menghubungkan...".
   - Begitu terhubung, kartu profil langsung berganti menampilkan foto profil Lofi Girl dan namanya.
4. Klik **"Ganti"** lagi, ketik `@MilkyPoni`, lalu klik **Connect** untuk kembali ke kanal Bos.
5. Bila Bos klik **"Ganti"** tapi tidak jadi ganti, klik **"Batal"**: form input tertutup kembali dan kartu profil tetap tampil.

### Uji 3 — Status Siaran & Indikator Avatar
1. Saat kanal sedang offline / belum live:
   - Badge menunjukkan **"Standby"** (cyan).
   - Lampu kecil di sudut avatar menyala cyan.
2. Saat kanal mulai live:
   - Badge berubah menjadi **"Live"** (merah).
   - Lampu avatar menyala hijau terang.
3. Tombol **"Putus"** (Disconnect) tetap tersedia jika Bos ingin menghentikan pemantauan chat sementara.

---

## 3. Detail Artefak Biner (Gate 1 Verified)

| Berkas | Ukuran | SHA-256 |
| --- | --- | --- |
| `KY-Poni-1.2.2.AppImage` | 128.632.034 byte | `672e8378e9479507a72d4195305d2b9da7777a2c585db8e2cf69322cebb755bb` |
| `KY-Poni-1.2.2.exe` | 111.722.838 byte | `c01fb352348744c63269c9f20bd109e46b287f5a0b0d1c29e216fc60d42765d0` |
| Terpasang di Workstation | `~/AppImages/kyponi.appimage` | Byte-identik dengan AppImage di atas |
