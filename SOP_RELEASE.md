# SOP Rilis — KY-Poni

Prosedur ini **khusus proyek KY-Poni**. Setiap proyek di Milky Brain punya SOP-nya sendiri.

Sejak v1.0.0, KY-Poni sudah didistribusikan ke publik. Artinya setiap perubahan yang menyentuh kode aplikasi harus melewati **dua gerbang pengujian** sebelum menyentuh GitHub Releases.

---

## 1. Prinsip Dasar

**Dilarang push ke GitHub Releases secara otomatis setelah update atau bugfix.**

Urutan wajib:

```
Perubahan kode
   → Uji teknis Fonzy (gate 1)
   → Instal ke PC Bos
   → Uji pengalaman Bos (gate 2)
   → Bos menyatakan lolos
   → Verifikasi akhir Fonzy
   → Publish release
```

Rilis hanya terjadi setelah **kedua gerbang** lulus. Tidak ada pengecualian untuk "perubahan kecil", "cuma typo CSS", atau "sudah jelas aman".

---

## 2. Gerbang 1 — Verifikasi Teknis (Fonzy)

Dijalankan **sebelum** apa pun dikirim ke PC Bos.

| Langkah | Perintah / Tindakan | Kriteria Lulus |
| --- | --- | --- |
| Suite otomatis | `npm test` | Semua suite hijau (server 11, boot-order 13, persistence, Windows compat 14) |
| Isolasi profil | Periksa `~/.config/ky-poni/` tidak berubah setelah test | Profil asli Bos tidak tersentuh |
| Audit modul terdampak | Baca ulang diff modul yang diubah + modul yang mengonsumsi outputnya | Tidak ada route/handler yang memanggil method tidak ada, tidak ada import menggantung |
| Uji fitur nyata | Jalankan server, panggil endpoint yang berubah | Status 200 + payload benar, bukan sekadar `--help` |
| Paritas platform | Build `.exe` dan jalankan fungsional (Wine bila tanpa mesin Windows) | Path data sesuai konvensi OS (`%APPDATA%` vs `~/.config`) |
| Benchmark UI | Untuk perubahan tema/overlay: uji batas platform (YouTube 200 char chat, 350 char Super Chat) di **setiap** tema aktif | Tanpa clipping; screenshot per tema sebagai bukti |
| Sinkron versi | `package.json` == PROJECT.md == QA_REPORT.md | SemVer identik di seluruh manifes |

Jika ada satu saja yang gagal: **stop**, perbaiki, ulangi gerbang 1 dari awal.

---

## 3. Gerbang 2 — Uji Pengalaman (Bos)

Fonzy memasang build ke PC Bos, lalu Bos menguji sendiri sebagai pengguna.

Yang Fonzy serahkan ke Bos setiap kali:

1. Berkas binary hasil build (path absolut).
2. Daftar singkat **apa yang berubah** dan **apa yang perlu dicoba** (bukan changelog panjang).
3. Perilaku yang diharapkan, supaya Bos bisa menilai sesuai atau tidak.

Bos menilai hal yang tidak bisa diukur otomatis: rasa animasi, keterbacaan saat live, kenyamanan alur dashboard, dan apakah hasilnya sesuai maksud desain.

**Fonzy tidak melakukan publish selama Bos belum menyatakan hasilnya tidak bermasalah.**

---

## 4. Verifikasi Akhir Sebelum Publish

Setelah Bos lolos, Fonzy tetap memverifikasi sekali lagi — bukan mengulang gerbang 1, tapi memastikan artefak yang akan dirilis memang artefak yang sudah diuji:

- Hash binary yang diuji == hash binary yang diunggah.
- Versi di dalam binary (`/api/version`) == tag rilis.
- `package.json` tidak menyertakan berkas pengembangan (`src/config.json` dan sejenisnya wajib dikecualikan).
- Profil bersih: jalankan binary dengan direktori config kosong, pastikan mulai dari default — bukan mewarisi setting pengembang.

---

## 5. Publish

Hanya setelah bagian 2, 3, dan 4 lulus:

```bash
scripts/publish_release.sh
```

Skrip ini menjalankan test, build kedua platform, membuat GitHub Release, dan mengirim notifikasi ke Discord `#project-archive`.

---

## 6. Penomoran Versi

SemVer, dengan aturan khusus proyek ini:

| Jenis Perubahan | Naik |
| --- | --- |
| Bugfix, penyesuaian visual kecil | PATCH (`1.0.0` → `1.0.1`) |
| Fitur baru di aplikasi | MINOR (`1.0.1` → `1.1.0`) |
| Perubahan yang memutus kompatibilitas tema lama | MAJOR |

**Penambahan tema atau preset yang didistribusikan lewat katalog remote tidak menaikkan versi aplikasi.** Versi aplikasi hanya naik bila binary berubah.

---

## 7. Larangan

- Push langsung ke GitHub Releases tanpa gerbang 1 dan 2.
- Menyatakan "sudah dites" tanpa menjalankan suite dan tanpa uji fitur nyata.
- Menghapus atau menimpa release lama yang sudah diunduh pengguna, kecuali ada instruksi eksplisit Bos.
- Menjalankan `npm test` tanpa isolasi direktori config (dulu menimpa `~/.config/ky-poni/config.json` milik Bos).

---

## 8. Riwayat

| Versi | Tanggal | Catatan |
| --- | --- | --- |
| 1.0.0 | 2026-11-10 | Rilis publik pertama. SOP dua gerbang mulai berlaku. |
