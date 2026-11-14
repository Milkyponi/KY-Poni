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

## 4. Catatan teknis untuk Fonzy (bukan untuk Bos)

- Suite: `KY_PONI_CONFIG_HOME=$(mktemp -d) npm test` → 214 PASS, exit 0.
- Assertion dihitung dari satu perintah: `npm test 2>&1 | grep -c "\[PASS\]"`.
- Modul baru: `src/public/overlay_settings.js` (resolver), diuji `test/test_overlay_settings.js` (24).
- Broadcast: `test/test_config_broadcast.js` (11), klien WS nyata terhadap server nyata.
- Kontrak baru di `test/test_dashboard_boot.js` (18 cek, 5 di antaranya mengunci URL statis).
- Profil asli Bos diverifikasi tidak berubah selama pengujian (`md5` sebelum = sesudah).
- **Belum diuji:** GUI Electron, OBS sungguhan (lingkungan sesi headless). Jangan diklaim sudah.
- Sisa dari v1.1.0: Gerbang 2 versi itu masih menunggu uji livestream Bos.
