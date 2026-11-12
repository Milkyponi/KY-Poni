# Serah-Terima Uji — KY-Poni v1.1.0 (Gerbang 2)

**Tanggal:** 12 November 2026
**Untuk:** Milky Poni (Bos)
**Status:** Gerbang 1 lulus (169 assertion, 0 gagal). **Gerbang 2 menunggu penilaian Bos.**
**Belum dipush, belum dirilis.** Push & GitHub Release menunggu lampu hijau Bos.

---

## 1. Yang Dipasang

| Platform | Path | Ukuran | SHA-256 |
| --- | --- | --- | --- |
| Linux (terpasang) | `/home/milkyponi/AppImages/kyponi.appimage` | 123 MB | `9498ba0725f0bb14f0cdd300a568093858b84824e3d9348a84af44ada6bd5dfd` |
| Linux (arsip) | `07_PROJECTS/KY-Poni/dist/KY-Poni-1.1.0.AppImage` | 123 MB | idem (hash identik) |
| Windows (arsip) | `07_PROJECTS/KY-Poni/dist/KY-Poni-1.1.0.exe` | 107 MB | `b900e3eb1c9578f978e2916578cbf64bc67376492540666db4dc35bf88cda366` |

Hash AppImage terpasang = hash artefak yang diuji, jadi yang Bos jalankan memang biner yang lolos gerbang.

**Profil Bos tidak tersentuh.** `~/.config/ky-poni/config.json` tetap seperti semula (target `@MilkyPoni`,
tema `cyberpunk2077`, scale 150, font Chakra Petch). Aplikasi akan mencoba menyambung ke `@MilkyPoni`
saat dibuka — kanal Bos sedang offline, jadi yang muncul adalah status **menunggu siaran**, bukan error.
Itu perilaku yang dimaksud.

---

## 2. Yang Berubah (ringkas, bukan changelog)

1. **Channel ID akhirnya dikenali.** Dulu `youtube.com/channel/UC...` dibungkus jadi handle rusak,
   ditembak ke URL yang tidak ada, lalu muncul pesan "Pastikan channel sedang live streaming" —
   padahal siarannya jalan. Sekarang format itu dikenali, begitu juga `youtu.be/`, `/c/Nama`, `/user/Nama`.
2. **Tidak perlu copy-paste link lagi.** Buka aplikasi → langsung menyambung ke kanal tersimpan.
3. **Status tidak lagi menipu.** Tiga keadaan dibedakan dengan jujur: `Live`, `Menunggu siaran dimulai`,
   dan `Gagal + alasannya`.
4. **Penyelamatan darurat.** Sejak November 2026 YouTube mengubah HTML-nya sehingga **v1.0.1 yang
   sudah beredar tidak bisa konek sama sekali**. Ini sudah diperbaiki di 1.1.0.

---

## 3. Yang Perlu Bos Coba

### Uji 1 — Buka aplikasi tanpa menyentuh apa pun
1. Jalankan `/home/milkyponi/AppImages/kyponi.appimage`
2. **Jangan** ketik atau klik apa pun. Tunggu ~10 detik.

**Diharapkan:** status kanan atas menunjukkan `⏳ Menunggu siaran dimulai...` (karena @MilkyPoni offline).
Tidak ada kotak error, tidak ada ajakan mengisi apa pun.

### Uji 2 — Channel ID (keluhan utama)
1. Di kolom YouTube Live, tempel Channel ID mentah, misal `UCSJ4gkVC6NrvII8umztf0Ow`
2. Klik **Hubungkan Stream**

**Diharapkan:** tersambung dalam beberapa detik, muncul `Live: ...` dan kotak Info Stream menampilkan
`liveId`. Dulu input ini mustahil berhasil.

### Uji 3 — Format lain yang dulu gagal
Coba satu per satu (boleh ganti-ganti beruntun):
- `https://youtu.be/4t4AQ15yj1M`
- `LofiGirl` (tanpa `@`)
- `https://www.youtube.com/c/LofiGirl`

**Diharapkan:** ketiganya tersambung, dan **tidak** muncul kedip `Menunggu siaran` di antara pergantian.
Ini bagian yang paling saya khawatirkan (ada bug yang saya temukan dan perbaiki saat uji), jadi tolong
perhatikan justru saat ganti target beruntun.

### Uji 4 — Overlay di OBS
1. `http://localhost:19840/overlay?theme=persona5`
2. Kirim pesan uji lewat tab Simulator

**Diharapkan:** balon chat Persona 5 muncul normal, tidak ada perubahan tampilan dari v1.0.1.
Versi ini tidak menyentuh tema sama sekali.

### Uji 5 — Kanal yang tidak ada (uji kejujuran pesan)
Ketik `@kanalrandomngasal999`, klik Hubungkan.

**Diharapkan:** pesan jelas menyebut kanal tidak ditemukan / format tidak dikenali — **bukan** lagi
"pastikan channel sedang live streaming".

---

## 4. Yang Tidak Bisa Saya Uji (dan saya tidak akan mengklaimnya)

**GUI `.exe` Windows tidak dijalankan.** Lingkungan build saya headless (tidak ada display server),
dan Wine di mesin ini gagal membuat window. Yang **sudah** diverifikasi untuk `.exe`:

- Isi asar Windows benar: versi 1.1.0, ketiga modul baru ada, `config.json` tidak bocor.
- Path data `%APPDATA%\KY-Poni` benar (suite `test_windows_compat.js` 14/14).

Yang **belum**: benar-benar membuka jendela di Windows dan menyambung ke YouTube. Kalau Bos punya
mesin Windows, itu satu-satunya bagian yang perlu dilihat mata manusia. Saya tidak menyebutnya
"lolos" sebelum itu terjadi.

---

## 5. Yang Saya Temukan Saat Uji (jujur, bukan disembunyikan)

Tiga bug yang **tidak ada** di laporan awal, semuanya saya temukan sendiri saat pengujian:

1. **YouTube mematikan pustaka pihak ketiga kita.** Tag canonical kini berisi literal `"undefined"`.
   Ini bukan bug kode KY-Poni, tapi efeknya v1.0.1 mati total. Sudah diperbaiki dengan shim.

2. **Bug state machine milik saya sendiri.** Versi pertama perbaikan saya membuat status berkedip
   "Siaran berakhir" setiap kali ganti target, padahal siaran masih jalan. Ketahuan dari log, bukan
   dari test. Sudah diperbaiki (token nomor sesi) dan dikunci 4 test regresi.

3. **Config Bos sempat tertimpa — dan itu bug nyata, bukan kecelakaan uji.** Saat saya menjalankan
   aplikasi sekali, `~/.config/ky-poni/config.json` berubah dari `cyberpunk2077 / scale 150 /
   Chakra Petch` menjadi default. **Sudah saya pulihkan ke nilai semula**, dan penyebabnya sudah
   diperbaiki: dashboard lama mengirim SELURUH field DOM setiap kali menyimpan, sehingga satu
   field yang belum sempat dipulihkan menghapus semua preferensi. Sekarang hanya field yang
   benar-benar berubah yang dikirim, dan penyimpanan ditolak bila acuan belum termuat.

   Ini penting untuk Bos ketahui: bug ini **sudah ada di v1.0.1** dan bisa menghapus preferensi
   setiap pengguna. Sekarang tertutup.

---

## 6. Keputusan yang Saya Minta

Setelah Bos selesai menguji:

- **Kalau sesuai** → saya lanjut ke verifikasi akhir + push + GitHub Release.
- **Kalau ada yang tidak sesuai** → sebutkan saja perilakunya, saya perbaiki dulu.

Satu hal yang perlu keputusan Bos secara terpisah: karena v1.0.1 yang sudah diunduh pengguna
**tidak berfungsi sama sekali sekarang**, apakah 1.1.0 ini dirilis sebagai **hotfix mendesak**
(catatan rilis menonjolkan "perbaikan darurat") atau rilis fitur biasa? Saya sarankan hotfix.
