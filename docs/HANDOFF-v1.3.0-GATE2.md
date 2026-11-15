# Serah-Terima Uji v1.3.0 — Untuk Bos (Gerbang 2)

**Status:** Gerbang 1 LULUS. Menunggu uji Bos.
**Yang dipasang:** `~/AppImages/kyponi.appimage` — v1.3.0, `sha256 48b11a93…`, **identik** dengan `dist/KY-Poni-1.3.0.AppImage`.
**Cadangan versi lama:** `~/AppImages/kyponi.appimage.v1.2.2.bak` (kalau perlu balik).
**Profil Bos tidak disentuh:** `~/.config/ky-poni/config.json` masih versi lama tanpa field `transition` → aplikasi akan memakai bawaan **Pop Up**, jadi tampilan tidak berubah sampai Bos memilih sendiri.

---

## Apa yang berubah

Animasi **masuk** chat sekarang bisa dipilih, dan arahnya mengikuti Sudut Layar.

| Pilihan | Gerak |
| --- | --- |
| **Pop Up** *(bawaan)* | mengecil 70% + miring 6° lalu "menampar" masuk — sama seperti tema P5 sebelumnya |
| **Slide Menyamping** | meluncur dari tepi kiri atau kanan layar |
| **Slide Vertikal** | meluncur dari tepi atas atau bawah layar |
| **Zoom In** | tumbuh dari 35% di sudut tempat chat menempel |
| **Fade In** | muncul pelan tanpa gerak |

**Animasi hilang (auto-hide) tidak berubah** — tetap milik tema.

---

## Cara uji (5 menit)

1. Buka KY-Poni. Dashboard akan tampil seperti biasa.
2. Di panel **Tampilan & Posisi Overlay**, ada dropdown baru **"Transisi Chat Masuk"** di antara tombol Sudut Layar dan kolom Auto-Hide.
3. Pilih **Slide Menyamping**, lalu perhatikan kotak preview di dashboard.
4. Klik **Sudut Layar: Kanan Atas**. Perhatikan: chat sekarang harus masuk **dari kanan**, bukan dari kiri.
5. Ganti ke **Slide Vertikal** + **Kanan Bawah** → chat masuk **dari bawah**.
6. Ganti ke **Zoom In** → chat tumbuh dari sudut, bukan mekar dari tengah.
7. Ganti ke **Fade In** → muncul pelan, tanpa gerak.
8. Balikkan ke **Pop Up** → kembali seperti tema P5 yang lama.

### Uji yang paling penting (cacat yang saya temukan & perbaiki)

9. Di dashboard, geser slider **Skala** pelan-pelan sambil ada chat di preview.
   → **Yang benar:** chat yang sudah tampil **tetap di tempat**, tidak terbang masuk ulang. Hanya skala yang berubah.
   → Kalau Bos melihat semua balon muncul ulang serentak, itu regresi — lapor ke saya.

10. Tunggu sampai satu chat **hilang sendiri** (auto-hide 8 detik).
    → **Yang benar:** hilang dengan animasi halus (puff/gelebur di P5).
    → Kalau hilang mendadak tanpa animasi, itu regresi — lapor ke saya.

### Uji di OBS (kalau sempat)

11. Tambahkan Browser Source `http://localhost:19840/overlay` (1000×1000), lalu ganti-ganti transisi dari dashboard sambil OBS jalan.
    → Chat di OBS harus ikut berubah transisinya **tanpa** perlu menyunting URL OBS.

---

## Yang perlu Bos tahu (jujur)

1. **Tema Persona 3 Reload tidak punya animasi keluar** — balonnya hilang mendadak. Ini **cacat lama**, sudah ada sebelum v1.3.0, bukan akibat pekerjaan ini. Saya tidak perbaiki karena Bos mengunci cakupan "entry saja dulu". Kalau Bos mau, saya kerjakan terpisah.

2. **Tema P3R dan Classic kehilangan animasi masuk khasnya** — ini konsekuensi keputusan Bos ("transisi jadi kustomisasi, bukan bawaan tema"). P3R yang dulu meluncur tipis dari kiri, sekarang ikut transisi pilihan Bos. Kalau Bos pilih Pop Up, P3R juga akan "menampar" seperti P5.

3. **Screenshot bukti belum lengkap 60 gambar.** Yang saya kumpulkan 15 gambar (3 tema × 5 transisi) + 5 gambar titik awal. Matriks penuh 3 tema × 4 anchor × 5 transisi belum. Jadi saya tidak mengklaim "semua kombinasi sudah dilihat mata".

4. **`.exe` Windows tidak saya jalankan sebagai GUI** — mesin ini tidak punya Windows. Yang dibuktikan: isi `.exe` utuh v1.3.0, kode berperilaku benar, path config `%APPDATA%\KY-Poni` benar, server-nya jalan fungsional.

---

## Kalau Bos menyatakan LOLOS

Saya akan: buat tag `v1.3.0`, GitHub Release dengan kedua biner, dan verifikasi hash unggahan = hash lokal. Tidak ada rebuild (source di dalam biner sudah saya buktikan identik dengan commit `9d0b461`).

## Kalau ada yang perlu diperbaiki

Sebutkan saja gejalanya. Perbaikan berarti build ulang, jadi hash berubah dan area yang disentuh saya uji ulang.
