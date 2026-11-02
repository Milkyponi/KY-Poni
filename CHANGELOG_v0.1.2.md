# Project Archive & Changelog: KY-Poni (v0.1.2-alpha)

- **Tanggal Rilis**: 2026-11-02
- **Lead Developer**: Fonzy (Divisi Software Development)
- **Status**: Alpha Release (Internal Testing & Active Feature Set)
- **Port Layanan**: `http://localhost:19840/`

---

## Ringkasan Fitur & Changelog v0.1.2

### 1. 4-Corner Screen Anchors (`pos` Parameter)
- **↖ Kiri Atas (`pos=top-left`) & Kanan Atas ↗ (`pos=top-right`):**
  - Mengimplementasikan alur masuk dari atas ke bawah (*Top-to-Bottom Flow*).
  - Animasi hentak khusus *Slam-Down* (`p5-slam-down`) dan animasi keluar *Drop-Out* (`p5-drop-out`).
  - Mendorong pesan-pesan lama ke arah bawah secara natural.
- **Sisi Kanan (`pos=*-right`):**
  - Menginversi bayangan tebal komik ke arah dalam (`drop-shadow(-4px 4px 0 #000)`).
  - Tab nama pengirim merapat rapi ke kanan (`skewX(16deg)`).

### 2. Bottom Ticker Anti-Shrink & Push Slide
- Menghilangkan bug balon kata gepeng pada layout horizontal dengan `flex-shrink: 0 !important; min-width: 220px; max-width: 380px;`.
- Container horizontal kini menggeser pesan lama ke kiri secara mulus (*smooth slide*) saat pesan baru masuk dari sisi kanan.

### 3. Auto-Hide Timer & Retention Guard ("Keep Last N")
- **Timer Auto-Hide:** Pesan lama memudar dan keluar secara otomatis setelah durasi yang ditentukan user (default: 8 detik, dapat disetel ke 0 untuk menonaktifkan).
- **Retention Guard:** Menjamin layar livestream tidak sepi/kosong dengan menahan N pesan terakhir (default: 1 pesan) sampai ada pesan baru yang menggantikannya.

### 4. Interactive Studio Dashboard & Testing Pad
- Ditambahkan visual selector 2x2 grid untuk memilih sudut layar OBS dalam 1 klik.
- Pengaturan auto-hide detik dan retensi pesan terakhir langsung terintegrasi ke URL OBS.
