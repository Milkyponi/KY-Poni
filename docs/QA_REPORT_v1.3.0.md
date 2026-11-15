# QA & Audit Kelayakan Distribusi: KY-Poni v1.3.0

> **v1.3.0 — Chat Entry Transitions (Kustomisasi).** Animasi **masuk** chat bukan lagi milik tema:
> kini kustomisasi pengguna dengan 5 pilihan (Pop Up, Slide Menyamping, Slide Vertikal, Zoom In,
> Fade In), dan **arah gerak mengikuti Sudut Layar**. Animasi **keluar** tetap milik tema.
>
> **Catatan gate:** Gerbang 1 **LULUS** — 262 assertion PASS dari satu perintah, plus verifikasi
> biner (asar AppImage & payload NSIS Windows sama-sama v1.3.0, server dijalankan dari hasil
> ekstraksi). **Gerbang 2 MENUNGGU uji Bos.** Belum ada tag, belum ada GitHub Release.

- **Tanggal**: 2026-11-15
- **Lead Tester**: Fonzy (Divisi Software Development)
- **Lingkup**: fitur baru (transisi masuk) + dua cacat yang ditemukan sendiri saat implementasi
- **Status**: **Lulus Gerbang 1** — 262/262 assertion; 2 cacat ditemukan & diperbaiki; 1 cacat lama dicatat (tidak diperbaiki, di luar scope)

---

## 1. Ringkasan

| Kategori | Hasil |
| --- | --- |
| Suite otomatis (`npm test`, exit code 0, profil terisolasi) | **262 assertion, 262 PASS, 0 FAIL** |
| Suite baru `test_transitions.js` | **45/45** |
| Matriks arah di browser nyata (5 transisi × 4 anchor) | **20/20** nilai keyframe 0% sesuai kontrak |
| Uji lintas tema (persona5, persona3reload, classic) | `kyp-enter-pop` berjalan di ketiganya |
| Uji dari biner (server hasil ekstraksi `app.asar`) | `/api/version` = 1.3.0; animasi nyata berjalan |
| Paritas Windows | 14/14 simulasi win32 + payload NSIS dijalankan fungsional |
| Kebocoran artefak dev ke paket | **0** (diperiksa di asar Linux **dan** payload Windows) |
| Cacat ditemukan | 2 (keduanya diperbaiki di versi ini) |
| Cacat lama dicatat | 1 (`persona3reload` tanpa animasi keluar) |

**Angka 262 berasal dari satu perintah** `npm test 2>&1 | grep -c "[PASS]"` yang dijalankan
**setelah** semua perubahan selesai — bukan penjumlahan ringkasan manual.

---

## 2. Ringkasan fitur yang diuji

### 2.1 Lima transisi masuk

| id | Gerak |
| --- | --- |
| `pop` *(bawaan)* | scale 0.7 → overshoot → 1, rotasi ±6°, geser 24px |
| `slide-x` | dari tepi kiri/kanan, jarak awal 108% |
| `slide-y` | dari tepi atas/bawah, jarak awal 108% |
| `zoom` | scale 0.35 → 1, titik tumpu di sudut anchor |
| `fade` | opacity 0 → 1, tanpa transform |

### 2.2 Kontrak arah (dikunci test)

| Anchor | slide-x | slide-y | zoom origin | pop |
| --- | --- | --- | --- | --- |
| kiri-bawah | −108% (dari kiri) | +108% (dari bawah) | `bottom left` | +24px, −6° |
| kiri-atas | −108% | −108% (dari atas) | `top left` | −24px, +6° |
| kanan-bawah | +108% (dari kanan) | +108% | `bottom right` | +24px, −6° |
| kanan-atas | +108% | −108% | `top right` | −24px, +6° |
| center | −108% (default) | +108% (default) | `bottom left` | sesuai vertikal |

---

## 3. Cacat yang ditemukan & diperbaiki

### 3.1 Kritis — rebuild kosmetik memutar ulang animasi seluruh tumpukan

**Gejala di layar (sebelum perbaikan):** streamer menggeser slider **Skala** atau mengganti
**warna teks** di dashboard saat live → **seluruh balon chat yang sedang tampil muncul ulang
serentak**. Dengan animasi lama yang halus ini nyaris tak terasa; dengan `slide-x`/`slide-y`
dari luar frame, semua balon terbang masuk lagi di tengah siaran.

**Sebab:** `rebuildDom()` dipanggil pada setiap perubahan kosmetik dan menulis
`flow.textContent = ''` lalu membangun ulang semua elemen dari nol, sehingga setiap elemen
mendapat animasi masuk baru.

**Perbaikan:** core menandai elemen hasil rebuild dengan kelas `kyp-static`; lapisan transisi
mematikan animasi untuk kelas itu. Kelas `kyp-entering` hanya dipasang pada pesan **baru**,
sebelum elemen masuk DOM (agar tidak ada kedip satu frame).

**Bukti:** mengubah `scale` 100 → 115 lewat `POST /api/config` menghasilkan **0**
`animationstart` pada `.chat-entry`; ketiga balon bertanda `kyp-static`.

### 3.2 Kritis — perbaikan 3.1 membunuh animasi auto-hide

**Gejala di layar (setelah perbaikan pertama):** balon yang kedaluwarsa **menghilang mendadak
tanpa fade**. Hanya terjadi pada pesan yang kebetulan tampil ketika streamer menggeser slider —
yaitu persis saat live, sehingga mudah lolos dari pembacaan kode.

**Sebab:** aturan penjaga `#chat-canvas[data-transition] .chat-entry.kyp-static { animation: none !important }`
memiliki spesifisitas (id + atribut + 2 kelas) yang **mengalahkan** `.chat-entry.is-exiting`
milik tema (2 kelas), meskipun tema memakai `!important` — `!important` pada kedua sisi
diselesaikan lewat spesifisitas, dan penjaga menang.

**Perbaikan:** selektor penjaga diberi `:not(.is-exiting)`.

**Bukti:** elemen dengan `kyp-static` + `is-exiting` kembali memakai `p5-puff-out` (0.35s) dan
`clean-fade-out` (0.4s). Dikunci sebagai test regresi
(`penjaga kyp-static TIDAK membunuh animasi keluar`) agar tidak kembali.

> Kedua cacat ini ditemukan lewat **uji browser nyata**, bukan lewat membaca kode. Itu sebabnya
> Gate 1 v1.3.0 mewajibkan server dijalankan dari biner hasil ekstraksi, bukan hanya dari source tree.

---

## 4. Cacat lama yang DICATAT (tidak diperbaiki di versi ini)

**`persona3reload` tidak memiliki animasi keluar.** `grep -n 'is-exiting'` pada
`src/public/themes/persona3reload/style.css` mengembalikan **tidak ada hasil** — tema ini sejak
sebelum v1.3.0 tidak mendeklarasikan `.chat-entry.is-exiting`, sehingga balon menghilang
mendadak (perilaku bawaan browser) alih-alih beranimasi.

Alasan tidak diperbaiki: Bos mengunci cakupan v1.3.0 menjadi **"entry saja dulu"**. Menambah
animasi keluar P3R adalah pekerjaan tema terpisah dan akan mengubah tampilan tema itu di luar
fitur yang disetujui. **Butuh aba-aba Bos sebelum dikerjakan.**

---

## 5. Verifikasi biner (Gate 1 artefak)

### 5.1 AppImage

| Pemeriksaan | Hasil |
| --- | --- |
| `--appimage-extract` → `resources/app.asar` | berhasil |
| Ekstraksi asar dari **direktori scratch** (bukan root proyek) | `app/package.json` versi **1.3.0** |
| `src/public/overlay_transitions.css` & `.js` ada di dalam asar | ✅ 5460 B / 7384 B |
| `src/config.json` (profil developer) bocor? | **TIDAK ADA** |
| Folder `test/` ikut terpaket? | **TIDAK ADA** |
| Kode transisi utuh (dijalankan dari hasil ekstraksi) | `IDS` lengkap, `slide-x @ bottom-right = +108%` |
| Server dijalankan dari hasil ekstraksi (`node src/server.js`) | `/api/version` = **1.3.0**, `/api/config` memuat `transition: pop` |
| Aset disajikan (`/overlay_transitions.css`, `.js`) | HTTP **200** / **200** |
| Animasi nyata dari biner di browser | `kyp-enter-pop` `scale(0.7) rotate(-6deg) translateY(24px)` |
| Ganti transisi + anchor dari biner | `slide-x` + `bottom-right` → `--kyp-enter-x = +108%`, animasi `translate(108%)` |

### 5.2 Windows `.exe` (payload NSIS)

| Pemeriksaan | Hasil |
| --- | --- |
| `7z x` tingkat 1 → `$PLUGINSDIR/app-64.7z` (111.327.269 B) | berhasil |
| `7z x` tingkat 2 → payload aplikasi | berhasil |
| Ekstraksi `app.asar` payload Windows | `package.json` versi **1.3.0** |
| Berkas transisi ada di payload Windows | ✅ |
| `src/config.json` / `test/` bocor? | **AMAN** keduanya |
| `resolveConfigDir(platform: win32)` | `...\\Roaming/KY-Poni` — **kapitalisasi benar** |
| Config lama (tanpa `transition`) di path Windows | termigrasi ke **`pop`** |
| Simpan `slide-y` dari payload Windows | tersimpan |
| Nilai `../evil` ditolak | tetap `slide-y` (nilai sah dipertahankan) |
| Payload Windows dijalankan sebagai server (port 19842) | `/api/version` = **1.3.0**, `POST transition: zoom` → tersimpan |

**Batas kejujuran:** `.exe` **tidak** dijalankan sebagai GUI Windows sungguhan di mesin ini
(sesi headless, tidak ada Windows). Yang dibuktikan adalah: payload NSIS utuh, kode di dalamnya
v1.3.0 dan berperilaku benar, path config Windows benar, dan server-nya berjalan fungsional.
Klaim "GUI `.exe` sudah diuji" **tidak** dibuat.

---

## 6. Verifikasi arah di browser (bukti geometris)

Diukur dengan `getBoundingClientRect()` pada posisi **keyframe 0%** yang dirender statis,
kanvas uji 780×437, anchor **kiri-bawah**:

| Transisi | transform awal | left | right | bottom | Tafsir |
| --- | --- | --- | --- | --- | --- |
| `slide-x` | `translate(-108%, 0) scale(1)` | **−455** | **−15** | 419 | seluruh balon di luar tepi **kiri** |
| `slide-y` | `translate(0, 108%) scale(1)` | 20 | 460 | **557** | balon di bawah garis kanvas (437) |
| `pop` | `scale(0.7) rotate(-6deg) translateY(24px)` | 84 | 400 | 432 | mengecil 70% + miring kiri |
| `zoom` | `scale(0.35)` | 163 | 317 | 377 | 35% ukuran, tumbuh dari sudut |
| `fade` | `none` | 20 | 460 | 419 | tanpa gerak |

Screenshot dikonfirmasi dengan pembacaan visual: `start_slide-x.png` **kosong total** (sesuai
`right = −15`, balon di luar frame), sementara `start_pop.png` menampilkan balon kecil yang
miring — dua-duanya konsisten dengan angka, bukan tebakan.

**Bukti gambar:** `test_previews/transitions-v1.3.0/` (15 gambar: 3 tema × 5 transisi, dibekukan
di 45% durasi animasi) dan `test_previews/transitions-v1.3.0/startpos/` (5 gambar titik awal).

---

## 7. Cakupan yang TIDAK diklaim

- **Tidak** mengklaim "semua tema sudah diverifikasi visual": matriks screenshot penuh
  (3 tema × 4 anchor × 5 transisi = 60 gambar) **belum** dikumpulkan. Yang ada: 15 gambar
  (3 tema × 5 transisi pada satu anchor) + 5 gambar titik awal.
- **Tidak** mengklaim GUI `.exe` diuji di Windows sungguhan.
- **Tidak** mengklaim transisi keluar diubah — animasi keluar tidak disentuh sama sekali
  (kecuali cacat 3.2, yang justru memulihkan animasi keluar yang sempat rusak).
- Anchor `center` sudah punya arah deterministik dari resolver, tetapi **belum** punya CSS
  posisi di tema mana pun (tidak ada tombol Center di dashboard). Bukan bagian versi ini.

---

## 8. Kesimpulan

| Gerbang | Status |
| --- | --- |
| **Gerbang 1 (Fonzy)** | **LULUS** — 262/262 assertion, biner diverifikasi dua platform, dua cacat diperbaiki, satu cacat lama dicatat |
| **Gerbang 2 (Bos)** | **MENUNGGU** — instal artefak uji, jalankan daftar uji singkat, nyatakan lolos/tidak |

Artefak yang tercatat di sini adalah **artefak UJI, bukan rilis final**. Sesuai SOP, publish
hanya setelah Bos menyatakan lolos; bila ada perbaikan susulan, hash berubah dan area yang
disentuh wajib diuji ulang.
