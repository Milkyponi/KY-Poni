# KY-Poni Product & Engineering Roadmap

Dokumen ini adalah peta jalan jangka panjang (*long-term roadmap*) pengembangan **KY-Poni Livestream Chat Overlay Studio**.

---

## 🏆 Milestone yang Telah Diselesaikan (Completed Milestones)

### ✅ Fase 1: Prototyping & Arsitektur Zero-Quota (v0.1.0 – v0.1.3)
- WebSocket & HTTP local broadcaster pada port `19840`.
- YouTube Live InnerTube chat ingest lokal tanpa API key Google (biaya server Rp 0).
- Penanganan avatar penonton via Google CDN (`yt3.ggpht.com`) dengan proteksi hotlink `no-referrer`.
- Penanganan auto-hide pesan dengan retention guard (*keep last N messages*).

### ✅ Fase 2: 4-Corner Anchors & Layout Responsif (v0.2.0 – v0.2.2)
- Dukungan 4 sudut layar: `bottom-left`, `bottom-right`, `top-left`, `top-right`.
- Alur vertikal banting ke bawah (*slam-down*) untuk game dengan HUD bawah (MOBA).
- Kustomisasi tipografi live: Slider skala kanvas (70% - 150%), slider ukuran font, Google Fonts kurasi, dan color picker neon.

### ✅ Fase 3: Distribusi Native Portable & In-App Updater (v0.3.0 – v0.4.2)
- Packaging desktop native portable: Linux `.AppImage` (terintegrasi Gear Lever) dan Windows portable `.exe`.
- Desain logo resmi aplikasi monogram "KY" bergaya Persona 5 manga badge.
- In-App auto-updater berbasis GitHub Releases API publik (`Milkyponi/KY-Poni`) dengan progress bar unduhan.
- Single-instance lock dan pemulihan port otomatis `EADDRINUSE`.

### ✅ Fase 4: Rekonstruksi Otentik Persona 5 & Anti-RTO (v0.4.3 – v0.4.10)
- Rekonstruksi total tema Persona 5 berbasis potongan aset asli (*3-piece sliced asset skin*) dengan pengerasan alpha 100% solid.
- Bundling font resmi Atlus (`OptimaNova`, `KoreanKRSM`, `p5hatty`) dan penataan nameplate dinamis bergaya *ransom-note*.
- Redesain antarmuka Studio ke navigasi 3-tab modern (*Studio*, *Katalog Tema*, *Pengaturan*).
- YouTube Ingest Anti-RTO engine dengan watchdog pemulihan otomatis (*self-healing backoff*).
- Penyimpanan preferensi pengguna permanen di level OS (`~/.config/ky-poni/config.json`) yang bebas dari reset saat update versi.
- Alur chat horizontal cerdas mengikuti sudut anchor.
- Pelebaran dinamis bodi tengah gelembung chat (*dynamic horizontal expansion*) dan anti-overflow berjenjang (Vision 10/10 verified).

---

## 🚀 Rencana Pengembangan Aktif (Current & Future Milestones)

### 🔨 Fase 5: Refactoring Arsitektur Bersih & Modular Theme System (Sedang Berjalan)
* **Tujuan Utama:** Menghilangkan seluruh utang teknis (*technical debt*) dan membuat codebase mudah di-maintain jangka panjang oleh developer maupun AI agent.
* **Deliverables:**
  1. **Dokumentasi Lengkap:** Penerbitan `PRD.md`, `THEME_SPEC.md`, dan `ROADMAP.md`.
  2. **Riwayat Rilis:** Catatan rilis per versi dipublikasikan di halaman GitHub Releases, bukan lagi sebagai berkas changelog terpisah di dalam repo.
  3. **Modular Native Backend Router:** Memecah monolit `src/server.js` ke dalam modul router native Node.js di `src/routes/` (`config.js`, `status.js`, `ingest.js`, `themes.js`, `updater.js`, `static.js`).
  4. **Dynamic Theme Plugin System:** Menghapus seluruh hardcoded `if (theme === ...)` di `overlay.js`. Setiap tema mengekspor `renderer.js` sendiri yang dimuat secara dinamis saat runtime.
  5. **Modular Dashboard Controller:** Merapikan logika dashboard ke komponen kontrol terisolasi.

---

### 🎨 Fase 6: Ekspansi Katalog Tema Game Resmi (Q4 2026 – Q1 2027)
Menambahkan tema-tema game legendaris ke dalam katalog resmi Milky Brain menggunakan standar `THEME_SPEC.md`:

1. **Tema 2: Undertale & Deltarune Retro Box**
   * Balon dialog hitam-putih 8-bit dengan border pixelated.
   * Font retro bitmap (*Determination Mono* / *VT323*).
   * Efek teks typewriter ketik karakter per karakter.
2. **Tema 3: Cyberpunk 2077 Night City HUD**
   * Palet kuning neon `#FFE600` dan cyan `#00F0FF`.
   * Border futuristik brutalist dengan efek scanlines CRT dan glitch pop-in.
   * Header terminal tech dengan data transmisi holocall.
3. **Tema 4: Persona 3 Reload Tartarus UI**
   * Palet biru laut cerah (*ocean blue*) dan cyan neon.
   * Balon dialog kaca modern sleek dengan ornamen air dan jam bayangan (*Dark Hour*).
4. **Tema 5: Retro 16-Bit Classic JRPG (Chrono Trigger / Final Fantasy VI style)**
   * Kotak dialog gradasi biru royal klasik dengan border marmer putih melengkung.
   * Kursor tangan penunjuk (*pointing glove finger*) pada chat terbaru.

---

### 🎛️ Fase 7: Fitur Creator Quality-of-Life (Q1 2027)
* **Preset Profil Streamer:** Streamer dapat menyimpan preset konfigurasi berbeda (misal: "Profil Persona 5 Stream", "Profil Horror Stream", "Profil Chill Just Chatting") dan berganti dengan 1 klik.
* **Theme Sound Effects (Opsional):** Efek suara opsional bawaan tema saat chat masuk (misal: suara bleep teks Undertale, suara swoosh kartu Persona 5, atau notifikasi holocall Cyberpunk). Suara bisa di-mute total oleh streamer.
* **Custom Bad Words & Emote Filters:** Filter kata-kata terlarang lokal dan filter pesan bot spam.

---

### 🌐 Fase 8: Multi-Platform Ingest Expansion (Q2 2027)
* **Twitch Live Chat Integration:** Koneksi langsung ke WebSocket Twitch IRC tanpa perlu login OAuth streamer.
* **Kick Live Chat Integration:** Integrasi Pusher WebSocket channel Kick.
* **Multi-Chat Aggregator:** Kemampuan menggabungkan chat YouTube + Twitch ke dalam satu overlay kanvas game yang sama secara harmonis.
