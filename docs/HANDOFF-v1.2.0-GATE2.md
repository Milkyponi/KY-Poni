# Serah-Terima Uji v1.2.0 — Gerbang 2 (Bos)

> **Status Gerbang 1: LULUS.** 214 assertion PASS (exit code 0), verifikasi fungsional di
> Chromium nyata terhadap server lokal, sweep regresi tiga tema pada batas platform YouTube.
> **Gerbang 2: menunggu uji Bos.**
>
> Binary belum dibangun untuk versi ini. Dokumen ini disiapkan supaya begitu biner ada,
> pengujian bisa langsung dijalankan tanpa menunggu instruksi tambahan.

---

## 1. Yang berubah (versi manusia)

URL Browser Source di OBS sekarang **tidak pernah berubah**:

```
http://localhost:19840/overlay
```

Ganti tema, font, warna, atau skala di aplikasi — overlay ikut. Tidak perlu membuka properti
source di OBS lagi.

---

## 2. Yang perlu dicoba

### Uji 1 — URL statis tidak berubah

1. Buka aplikasi, salin URL dari kotak OBS Browser Source.
2. Ganti tema ke tema lain, lalu lihat kembali kotak URL itu.
3. Ganti juga font dan warna, lihat lagi.

**Diharapkan:** isi kotak URL **tetap** `http://localhost:19840/overlay` di ketiga kondisi.
Sebelum versi ini, isinya berubah setiap kali preferensi disentuh.

### Uji 2 — Perubahan kosmetik terasa langsung di OBS

1. Pasang URL statis di OBS sebagai Browser Source (1000 × 1000 px).
2. Saat overlay sudah menampilkan chat, geser slider **Skala**, lalu **Ukuran Font**, lalu ganti
   **Warna Teks**.

**Diharapkan:** perubahan terlihat di OBS dalam hitungan detik, **tanpa** source berkedip atau
memuat ulang. Chat yang sedang tampil tetap di tempatnya.

### Uji 3 — Pergantian tema memuat ulang sendiri

1. Ganti **tema** dari dashboard.
2. Perhatikan overlay di OBS.

**Diharapkan:** overlay memuat ulang dirinya sendiri (sekitar 0,3 detik) dan langsung memakai tema
baru. Wajar bila chat yang sedang tampil hilang saat reload — itu konsekuensi yang sudah
disepakati.

### Uji 4 — URL lama tetap jalan

1. Kalau OBS masih menyimpan URL panjang berisi `?theme=...`, biarkan apa adanya. Jalankan overlay.
2. Ganti tema dari aplikasi.

**Diharapkan:** overlay mengikuti tema dari aplikasi, **bukan** parameter di URL. Ini disengaja:
pengguna lama otomatis menikmati fitur ini tanpa perlu mengubah URL.

### Uji 5 — Overlay dibuka sebelum aplikasi hidup

1. Tutup aplikasi KY-Poni.
2. Pastikan OBS masih menampilkan Browser Source overlay (chat terakhir tetap terlihat).
3. Nyalakan aplikasi kembali.

**Diharapkan:** overlay menampilkan pengaturan terakhir yang tersimpan, lalu menyesuaikan diri
sendiri begitu aplikasi hidup. Tidak perlu menekan Refresh di OBS.

### Uji 6 — Regresi tampilan

1. Uji ketiga tema bawaan (Persona 5, Persona 3 Reload, Clean Modern).
2. Kirim pesan uji panjang lewat tab Simulator (near 200 karakter) dan satu Super Chat.

**Diharapkan:** tidak ada teks terpotong, tidak ada balon melar, tidak ada perubahan tampilan
dibanding v1.1.0 selain yang disebut di atas.

---

## 3. Perilaku yang diharapkan (untuk menilai sesuai/tidak)

| Kejadian | Perilaku benar |
| --- | --- |
| Ganti skala/font/warna/fade/keep | Berubah tanpa reload |
| Ganti tema/layout/posisi | Reload sendiri, sekali |
| Ganti preferensi berulang cepat | Tidak reload berulang (slider tidak memicu reload) |
| Aplikasi mati lalu hidup | Overlay pulih sendiri |
| Font default pada instalasi baru | Optima Nova (font resmi Persona 5) |
| Tema `classic` tanpa ganti font | Memakai font sistem — perilaku lama, bukan cacat baru |

---

## 3A. Hasil Gate 2 — LULUS

Bos menyatakan hasil 1.2.0 **sesuai** saat diuji di OBS (2026-11-14). Tidak ada temuan.
Karena itu tidak ada perbaikan yang perlu mendarat sebelum rilis.

---

## 3A.1 Tiga hal yang sempat aku laporkan sebagai cacat — TERNYATA BUKAN REGRESI

Tiga hal ini aku sebut "masalah tertunda" sebelum Gate 2. Setelah diukur ulang dengan pembanding
**v1.1.0** pada 8 kombinasi anchor × layout, ketiganya bukan regresi 1.2.0. Koreksi ini dicatat
supaya tidak diwariskan sebagai cacat palsu ke sesi berikutnya:

| # | Hal | Hasil ukur | Status sebenarnya |
| --- | --- | --- | --- |
| 1 | `?layout=fullscreen` "mati" | `git log --all -S".layout-fullscreen"` **kosong**: class itu tidak pernah punya aturan CSS sejak ditambahkan di v0.4.4, tidak pernah ada di UI (`index.html`/`dashboard.js`), dan tidak ada di PRD | **Dead code lama**, bukan regresi 1.2.0 |
| 2 | 3 anchor belum disapu | Vertikal 4/4 anchor: 0 luber. Horizontal 4/4: tepat 1 pesan luber ke arah dorong — **angka identik di v1.1.0** | Perilaku ticker lama (memang bisa digeser), **bukan regresi** |
| 3 | Balon beranimasi ulang saat slider | v1.2.0: bangun ulang DOM, tanpa reload jaringan. v1.1.0: ganti preferensi = URL baru = **iframe reload penuh** | 1.2.0 **lebih baik**, bukan mundur |

Catatan tambahan: `pos=center` juga tidak punya aturan CSS. Hanya empat anchor yang benar-benar
ditata (`bottom-left`, `bottom-right`, `top-left`, `top-right`).

### Bukti pembanding (200 char chat + 350 char Super Chat)

| Layout | Anchor | v1.1.0 | v1.2.0 |
| --- | --- | --- | --- |
| vertical | bottom-left | 0 luber | 0 luber |
| vertical | bottom-right | 0 luber | 0 luber |
| vertical | top-left | 0 luber | 0 luber |
| vertical | top-right | 0 luber | 0 luber |
| horizontal | bottom-left | 1 luber (kanan) | 1 luber (kanan) |
| horizontal | bottom-right | 1 luber (kiri) | 1 luber (kiri) |
| horizontal | top-left | 1 luber (kanan) | 1 luber (kanan) |
| horizontal | top-right | 1 luber (kiri) | 1 luber (kiri) |

Kesimpulan: **paritas penuh** dengan v1.1.0 di kedelapan kombinasi. Tidak ada yang diperbaiki
1.2.0, dan tidak ada yang dirusak.

---

## 3A.2 Kandidat perbaikan untuk 1.2.1 (bukan blocker)

Dua hal ini tetap layak dikerjakan, tapi **bukan** syarat rilis karena tidak ada regresi:

1. `?layout=fullscreen` — putuskan: beri CSS nyata, atau hapus cabang mati dari `overlay.js`.
2. Ticker horizontal yang meluber 1 pesan — perilaku lama; perbaiki hanya bila memang terasa
   mengganggu saat live.

---

## 3B. Template catatan temuan

Isi ini selama uji supaya perbaikan pasca-Gate 2 bisa dikerjakan sekali jalan:

```
Skenario : Uji 1 / 2 / 3 / 4 / 5 / 6
Tema     : persona5 | persona3reload | classic | cyberpunk2077
Yang saya lakukan : ....
Yang saya lihat   : ....
Yang saya harapkan : ....
Tingkat   : mengganggu saat live / kosmetik / tidak masalah
```

---

## 3C. Catatan Gate 2 v1.1.0 (masih menunggu)

Gerbang 2 versi 1.1.0 (konektivitas YouTube) **belum pernah dijalankan**, padahal v1.1.0 sudah
tayang sebagai Latest. Satu sesi live bisa menguji keduanya sekaligus:

- **Konektivitas (v1.1.0):** sambung ke kanal, ganti target beruntun, kanal yang sedang offline.
  Detailnya ada di `docs/HANDOFF-v1.1.0-GATE2.md`.
- **URL statis (v1.2.0):** enam skenario di atas.

---

## 4. Catatan teknis untuk Fonzy (bukan untuk Bos)

- Suite: `KY_PONI_CONFIG_HOME=$(mktemp -d) npm test` → 214 PASS, exit 0.
- Assertion dihitung dari satu perintah: `npm test 2>&1 | grep -c "\[PASS\]"`.
- Modul baru: `src/public/overlay_settings.js` (resolver), diuji `test/test_overlay_settings.js` (24).
- Broadcast: `test/test_config_broadcast.js` (11), klien WS nyata terhadap server nyata.
- Kontrak baru di `test/test_dashboard_boot.js` (18 cek, 5 di antaranya mengunci URL statis).
- Profil asli Bos diverifikasi tidak berubah selama pengujian (`md5` sebelum = sesudah).
- **Belum diuji:** GUI Electron, OBS sungguhan (lingkungan sesi headless). Jangan diklaim sudah.
- Sisa dari v1.1.0: Gerbang 2 versi itu masih menunggu uji livestream Bos.
