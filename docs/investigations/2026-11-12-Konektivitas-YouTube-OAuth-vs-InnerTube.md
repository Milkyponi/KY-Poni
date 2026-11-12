# Investigasi: Rombak Konektivitas YouTube KY-Poni ke Jalur Login/OAuth

**Tanggal:** 12 November 2026
**Proyek:** KY-Poni v1.0.1 (`07_PROJECTS/KY-Poni/`)
**Pemicu:** Laporan pengguna — (a) Channel ID tidak terdeteksi, (b) setiap live harus copy-paste link URL, (c) alur konektivitas dianggap ribet.
**Status:** Investigasi selesai — **belum ada eksekusi**, menunggu keputusan Bos.
**Probe reproducible:** `docs/investigations/probe-2026-11-12-connectivity.js`

---

## 1. Ringkasan Temuan

Dua keluhan pengguna itu **bukan satu masalah**, dan hanya satu di antaranya yang benar-benar soal arsitektur:

| # | Keluhan | Akar masalah sebenarnya | Solusi butuh OAuth? |
|---|---|---|---|
| 1 | Channel ID tidak kedetek | **Bug parser** di `parseTarget()` — URL `/channel/UC...` dianggap handle | **Tidak** |
| 2 | Ribet copy-paste link tiap live | Tidak ada auto-connect saat app dibuka | **Tidak** |
| 3 | "Konektivitas ribet" | Akumulasi dua hal di atas | **Tidak** |
| 4 | Pembacaan chat lewat API resmi | **Ditolak** — kuota 10.000 unit/hari dihitung per *project*, bukan per pengguna | Ya, tapi merusak produk |

**Kesimpulan awal: usulan "rombak total ke jalur login" TIDAK direkomendasikan sebagai pengganti.** Namun ada satu versi OAuth yang masuk akal sebagai *lapisan tambahan opsional* (Opsi B di bawah).

---

## 2. Bukti Teknis

### 2.1 Audit `parseTarget()` — 9/14 format benar

Dijalankan dengan `node docs/investigations/probe-2026-11-12-connectivity.js`. Hasil nyata:

```
1. AUDIT parseTarget (format input yang dibaca SALAH)
   Benar: 9/14 format
   ✗ https://www.youtube.com/channel/UCSJ4gkVC6NrvII8umztf0Ow
     → di-parse jadi {"handle":"@https://www.youtube.com/channel/UCSJ4gkVC6NrvII8umztf0Ow"}
     → request ke https://www.youtube.com/@https://www.youtube.com/channel/UCSJ4gkVC6NrvII8umztf0Ow/live
   ✗ https://www.youtube.com/channel/UCSJ4gkVC6NrvII8umztf0Ow/live
     → di-parse jadi {"handle":"@https://www.youtube.com/channel/UCSJ4gkVC6NrvII8umztf0Ow/live"}
     → request ke https://www.youtube.com/@https://www.youtube.com/channel/UCSJ4gkVC6NrvII8umztf0Ow/live/live
   ✗ https://www.youtube.com/c/LofiGirl
   ✗ https://www.youtube.com/user/LofiGirl
   ✗ https://youtu.be/4t4AQ15yj1M
```

**Mekanisme bug:** `src/youtube_ingest.js` baris 39–56. Pemeriksaan `channelId` (baris 49) berada **setelah** pemeriksaan `handle` (baris 44). Regex handle `/@([a-zA-Z0-9_.-]+)/` ikut menangkap URL yang mengandung `@` di dalamnya — dan lebih parah, jalur `channel/` tidak pernah tercapai karena string `https://www.youtube.com/channel/...` tidak dimulai dengan `UC`, lalu jatuh ke fallback `return { handle: '@' + clean }` sehingga seluruh URL dibungkus jadi handle.

**Dampak nyata pada laporan pengguna:** URL `/channel/UC...` adalah format yang **paling sering** disalin orang dari YouTube Studio (Settings → Channel → Advanced settings → Channel ID) dan dari tombol "Share channel". Jadi keluhan "Channel ID tidak kedetek" **100% terkonfirmasi dan reprodusibel** — ini bug, bukan keterbatasan protokol.

Efek sampingnya juga tereksekusi nyata: request keluar ke
`https://www.youtube.com/@https://youtu.be/4t4AQ15yj1M/live` → HTTP 404 → user melihat pesan generik
`Tidak dapat memulai live chat untuk target "...". Pastikan channel sedang live streaming.`
Pesan itu menyesatkan: channel-nya **sedang live**, yang salah adalah URL yang dibentuk app.

**Test coverage:** hanya `test/test_anti_rto.js` yang menyentuh `parseTarget`, dan tidak ada satu pun kasus `channel/UC...`, `youtu.be/`, `/c/`, atau `/user/`. Inilah alasan bug ini lolos dari suite 7 file tes.

### 2.2 Deteksi live TANPA login — berhasil, biaya 0

```
2. DETEKSI LIVE TANPA LOGIN (InnerTube resolve_url)
   LofiGirl (LIVE)        HTTP 200   366ms  1090B  → LIVE videoId=4t4AQ15yj1M
   LofiGirl /channel/     HTTP 200   106ms  1026B  → LIVE videoId=4t4AQ15yj1M
   MilkyPoni (OFFLINE)    HTTP 200   105ms  1182B  → OFFLINE (channelId=UCbtU1G3peng0-uLPHnJdNNQ)
   handle saja            HTTP 200    74ms  1170B  → OFFLINE (channelId=UCbtU1G3peng0-uLPHnJdNNQ)
   handle tidak ada       HTTP 404    86ms   182B  → handle tidak ada
```

Endpoint: `POST https://www.youtube.com/youtubei/v1/navigation/resolve_url`

Yang terbukti dari percobaan ini:
- Bedakan **LIVE** vs **OFFLINE** vs **handle tidak ada** hanya dalam ~100 ms dan ~1 KB response.
- Tidak perlu OAuth, tidak perlu API key Google Cloud, tidak perlu consent screen.
- `/channel/UC.../live` **juga berfungsi** di jalur ini — artinya format yang selama ini gagal di app sebenarnya bisa diselesaikan tanpa login sama sekali.
- Saat offline, response mengembalikan `channelId` — jadi app bisa menyimpan identitas kanal dengan benar meski tidak sedang live.
- Diverifikasi tidak ada risiko salah-arah: untuk MrBeast & MilkyPoni (keduanya offline), resolve `/live` mengembalikan channel yang **sama**, bukan channel lain yang streaming.

Sebagai pembanding, verifikasi langsung ke HTTP page (`GET /@handle/live`) juga berhasil tetapi **jauh lebih mahal**: 1,4–1,6 MB per cek (payload halaman penuh), vs 1 KB. Untuk cek status tiap beberapa detik, page-fetch tidak layak.

### 2.3 Biaya kuota bila memakai YouTube Data API v3 resmi

```
3. BIAYA KUOTA API RESMI (YouTube Data API v3)
   Kuota default = 10000 unit/hari, dihitung PER PROJECT (bukan per pengguna)
   liveChatMessages.list = 5 unit/panggilan
     polling 1s → 3600 call/jam → 18000 unit/jam → 1 streamer menghabiskan kuota dalam 0.56 jam
     polling 2s → 1800 call/jam →  9000 unit/jam → 1 streamer menghabiskan kuota dalam 1.11 jam
     polling 5s →  720 call/jam →  3600 unit/jam → 1 streamer menghabiskan kuota dalam 2.78 jam
   channels.list(mine=true) = 1 unit → cukup untuk 10.000 login/hari
```

Sumber resmi (dibaca 12 Nov 2026):
- `liveChatMessages.list` = **5 unit** — <https://developers.google.com/youtube/v3/determine_quota_cost>
- Kuota 10.000 unit dihitung **per project**, dan access token hasil OAuth tetap memotong kuota project yang sama — <https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits>
- `liveBroadcasts.list` hanya mengembalikan broadcast milik user yang terautentikasi, dan bukan broadcast yang dibuat lewat Studio/Stream Now dengan andal — <https://developers.google.com/youtube/v3/live/docs/liveBroadcasts/list>

**Ini poin mematikan untuk Opsi C:** kuota 10.000 unit itu **satu kolam bersama untuk seluruh pengguna aplikasi**, karena semua instalasi memakai OAuth client ID yang sama milik Bos. Streamer pertama yang live 1,1 jam akan menghabiskan kuota hari itu untuk **semua** pengguna KY-Poni di dunia. Menaikkan kuota butuh **API Compliance Audit** ke YouTube (bukan sekadar form), dengan review manual.

Perbandingan langsung:

| Jalur | Biaya kuota | Batas pengguna |
|---|---|---|
| InnerTube (sekarang) | **0 unit** | tidak terbatas |
| API resmi + OAuth | 5 unit/poll → habis 1,1 jam | terbatas pada 10.000/project |

### 2.4 Biaya & risiko OAuth untuk distribusi publik

| Aspek | Fakta terverifikasi |
|---|---|
| Scope | `youtube.readonly` = **sensitive scope** → wajib review Google |
| Review | 3–5 hari kerja; butuh demo video (unlisted), justifikasi per-scope, privacy policy di domain yang terverifikasi Search Console |
| Status Testing | cap **100 test user**, refresh token **expired 7 hari** |
| Status Published belum verified | cap **100 user total**, muncul layar "Google hasn't verified this app" |
| Refresh token | bisa mati bila tidak dipakai 6 bulan, user ganti password, atau user revoke |
| Batas token | maks 100 refresh token per akun Google per client ID |

Catatan penting: Bos **sudah pernah kena** persis jebakan ini di Google Workspace (`invalid_grant` karena consent screen masih Testing → token mati 7 hari). Memindahkan risiko itu ke seluruh pengguna KY-Poni jauh lebih mahal daripada menanggungnya sendiri.

---

## 3. Matriks Opsi

### Opsi A — Perbaiki parser + auto-connect saat app dibuka (TANPA login)

**Perubahan:**
1. Tulis ulang `parseTarget()` dengan urutan yang benar: cek `channel/UC...` → `youtu.be/` → `watch?v=` → `/live/` → `/shorts/` → `@handle` → handle polos. Tambah dukungan `/c/` dan `/user/` (di-resolve lewat InnerTube, bukan ditebak).
2. Tambah fallback: kalau input punya awalan `http`, kirim apa adanya ke `resolve_url` dan pakai hasilnya — jangan pernah membungkus URL jadi `@handle`.
3. Auto-connect saat app launch memakai `target` tersimpan di `config.json` (sudah tersimpan, hanya belum dipakai untuk connect).
4. Tambah indikator status: `Menunggu live...` saat channel dikenal tapi offline, dengan re-check ringan (default 60 detik, ~1 KB per cek, 0 kuota).
5. Tambah test: 14 format input di atas harus 14/14, plus kasus `channel/UC...` yang selama ini nol coverage.

**Hasil untuk pengguna:** buka app → langsung tersambung. Copy-paste nol kali. Channel ID, URL channel, URL live, `youtu.be`, handle — semua diterima.

**Biaya:** 0 kuota, 0 Google review, 0 risiko token mati, tetap jalan offline-first di mesin streamer.
**Estimasi kerja:** 4–6 jam termasuk test + build ulang AppImage/exe.
**Risiko:** rendah. Tidak menyentuh arsitektur ingest yang sudah stabil di v1.0.1.

### Opsi B — Opsi A + tombol "Login Google" opsional (hybrid)

OAuth dipakai **hanya sekali** untuk membaca identitas kanal sendiri lewat `channels.list(mine=true)` = **1 unit**. Kapasitas: 10.000 login/hari — jauh lebih dari cukup.

**Yang didapat:** pengguna tidak perlu tahu handle/channel ID sama sekali. Klik "Login", app tahu kanal mana miliknya.
**Yang tetap dipakai untuk chat:** InnerTube (0 kuota).
**Syarat tambahan:** OAuth client di Google Cloud, privacy policy di domain terverifikasi, submission verifikasi (3–5 hari), dan **wajib publish** consent screen agar token tidak mati 7 hari.
**Risiko:** selama verifikasi belum lulus, cap 100 user + layar peringatan "unverified app" — untuk produk publik ini bisa mematikan konversi unduhan.
**Estimasi kerja:** Opsi A + 1–2 hari (termasuk urusan verifikasi Google yang di luar kendali kita).

### Opsi C — Rombak total: OAuth + API resmi untuk baca chat

**Ditolak.** Alasan: 10.000 unit/project/hari habis oleh **satu** streamer dalam 1,1 jam (polling 2s). Untuk aplikasi yang dibagikan publik, ini bukan degradasi — ini kegagalan total setelah satu jam tayang, dan berlaku untuk semua pengguna sekaligus. Menambah kuota butuh API Compliance Audit YouTube.

---

## 4. Rekomendasi

**Kerjakan Opsi A sekarang.** Ini menyelesaikan ketiga keluhan yang dilaporkan, tanpa satu pun kompromi arsitektur, dan tanpa risiko kuota.

**Tunda Opsi B** sampai ada sinyal bahwa pengguna benar-benar menolak mengetik handle (bukan sekadar menolak copy-paste URL panjang). Bisa dirilis sebagai fitur opsional yang tidak memblokir alur utama — dan kalau verifikasi Google belum lulus, alur manual harus tetap jadi jalur default.

**Jangan kerjakan Opsi C**, kecuali arah produk berubah menjadi SaaS berbayar dengan kuota teraudit — dan itu keputusan bisnis, bukan teknis.

---

## 5. Catatan untuk Keputusan

- Keluhan "channel ID ngga kedetek" adalah **cacat produk yang harus diperbaiki terlepas dari keputusan OAuth**. Kalau Opsi B/C dipilih tanpa memperbaiki parser, bug yang sama tetap hidup di jalur fallback manual.
- Kalau nanti Opsi B diambil, ada konsekuensi desain: pengguna yang login dengan akun Google **berbeda** dari akun yang sedang live harus tetap bisa menunjuk kanal lain (co-host, kolaborasi, VTuber multi-kanal). Jadi login tidak boleh menjadi *satu-satunya* jalan.
- Probe di dokumen ini memakai endpoint publik YouTube tanpa kredensial apa pun — tidak ada token atau rahasia yang tersimpan di repo.

---

## 6. Metode Verifikasi Ulang

```bash
cd "/home/milkyponi/Documents/Milky Brain/07_PROJECTS/KY-Poni"
node docs/investigations/probe-2026-11-12-connectivity.js
```

Probe bersifat *read-only* terhadap YouTube dan tidak menyentuh `config.json` pengguna. Setelah Opsi A dieksekusi, probe ini seharusnya melaporkan **14/14 format benar** pada bagian 1.
