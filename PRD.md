# Product Requirements Document (PRD)
## KY-Poni - Stylized Game-Aesthetic Livestream Chat Overlay Studio

---

## 1. Executive Summary & Vision

**KY-Poni** adalah aplikasi desktop native portable (.AppImage untuk Linux, .exe untuk Windows) yang mengelola dan merender *livestream chat overlay* di OBS Studio dengan diferensiasi utama pada **Game-Inspired Visual Aesthetics**.

Sebagian besar chat overlay yang beredar di pasar (Streamlabs, StreamElements, SmartChat) bersifat generik, monoton, dan berbasis SaaS terpusat yang rentan pembatasan kuota API pihak ketiga. KY-Poni menghadirkan solusi mandiri, zero-quota (Rp 0 server cost), bebas login, dan berfokus pada pengalaman estetika visual video game legendaris (Persona 5, Undertale, Cyberpunk 2077, Persona 3 Reload, Retro JRPG).

---

## 2. Target Pengguna & Persona

* **Target Utama:** Gaming Streamer, VTuber, dan Content Creator (fokus awal: YouTube Gaming Livestream).
* **Kebutuhan Pengguna:**
  * Ingin chatbox siaran yang unik, menarik perhatian penonton, dan sesuai dengan tema game yang sedang dimainkan.
  * Menolak proses setup yang rumit (tidak mau membuat Google Cloud API credentials, OAuth, atau langganan bulanan).
  * Menuntut aplikasi yang ringan (*low footprint*) agar tidak membebani performa saat memainkan game berat di komputer yang sama.
  * Membutuhkan persistensi preferensi: skala, warna, posisi sudut layar, dan font tidak boleh reset saat aplikasi diperbarui.

---

## 3. Prinsip Arsitektur Perangkat Lunak (Core Architecture Principles)

1. **Clean Separation of Concerns (SoC):**
   * **Core Engine:** Menangani penerimaan WebSocket, antrean pesan (*chat queue*), posisi 4 sudut layar (*screen anchors*), alur scrolling terarah (*horizontal/vertical directional flow*), dan penghapusan otomatis (*auto-hide timer & retention guard*).
   * **Theme Plugin Engine:** Mengisolasi seluruh urusan rendering visual, konstruksi DOM, pemotongan aset grafis (.PNG), dan tipografi ke dalam modul tema mandiri tanpa mutasi kode inti.
   * **Ingest Engine:** Menangani scraping YouTube Live InnerTube secara lokal, pemulihan otomatis dari error sementara (*transient RTO*), dan watchdog penyambung ulang (*self-healing reconnection*).
   * **Host Runtime:** Lapisan desktop Electron ringan yang mengelola lifecycle proses tunggal (*single instance lock*), in-app updater, dan direktori penyimpanan pengguna permanen di level OS.
2. **Zero Core Mutation for New Themes:**
   * Menambah, mengedit, atau menghapus tema game **DILARANG KERAS** memodifikasi kode inti `overlay.js`, `server.js`, atau `dashboard.js`. Tema beroperasi sebagai modul plugin yang di-load secara dinamis.
3. **Resilience & Zero Maintenance:**
   * Zero Server Cost (Rp 0 biaya backend pengembang).
   * Zero Quota Google API (InnerTube scraper berjalan lokal di IP streamer).
   * Single-instance lock dan port conflict recovery otomatis.
   * Cross-version persistent user preferences di direktori konfigurasi OS resmi.

---

## 4. Spesifikasi Fungsional (Functional Requirements)

### A. YouTube Live Ingest & Anti-RTO Watchdog
* Pengguna cukup menginput YouTube Handle (`@username`), Live URL, atau Video ID.
* Backend mengekstrak `liveChatContinuation` token secara otomatis tanpa OAuth.
* Dilengkapi timeout guard 10 detik (`axios.defaults.timeout = 10000`).
* Error jaringan sementara dialihkan ke status `reconnecting` (kuning lembut) alih-alih melempar exception fatal.
* Watchdog otomatis mereset session token dan melakukan rekoneksi berjenjang (*exponential backoff*) jika RTO berlanjut > 4 siklus polling.

### B. OBS Integration & Overlay Engine
* Melayani kanvas transparan via Browser Source OBS pada port lokal `19840`.
* **URL OBS statis** (`http://localhost:19840/overlay`): satu URL untuk selamanya, tidak berubah saat tema atau preferensi diganti. Tampilan dibaca dari `config.json` milik server lokal.
* Parameter URL (`theme`, `layout`, `pos`, `scale`, `fsize`, `font`, `color`, `fade`, `keep`, `max`) tetap didukung sebagai lapisan kompatibilitas. Prioritas: config menang atas URL, kecuali mode preview (`?preview=1`) yang dipakai iframe dashboard agar slider terasa instan.
* 4 Sudut Layar (*Screen Anchors*): `bottom-left` (default), `bottom-right`, `top-left`, `top-right`.
* Alur Chat Horizontal Cerdas (*Anchor-Sensitive Directional Flow*):
  * Posisi kiri (`bottom-left` & `top-left`): Chat baru muncul langsung di anchor kiri (`prepend`) dan mendorong pesan lama ke kanan.
  * Posisi kanan (`bottom-right` & `top-right`): Chat baru muncul di anchor kanan (`append`) dan mendorong pesan lama ke kiri.
* Paradigma Streamlabs & Standar Kanvas Tetap 1000 x 1000 px:
  * Pengguna tidak perlu memilih resolusi piksel. Rekomendasi Browser Source OBS dibakukan ke Width 1000 x Height 1000 px.
  * Menjamin seluruh elemen dan balon chat tetap 100% utuh tanpa pernah terpotong (*zero clipping*) saat skala dibesarkan hingga 150%, serta muat banyak komentar pada skala kecil (25%-70%).
  * Penyesuaian ukuran bounding box, cropping (`Alt`+drag), dan penataan posisi scene dilakukan streamer langsung di OBS.
* Arah Aliran Chat (Layout Flow):
  * Vertikal (`layout=vertical`): Komentar mengalir naik/turun sesuai tumpuan anchor sudut layar.
  * Horizontal (`layout=horizontal`): Komentar mengalir menyamping (*ticker*) dari anchor sudut layar.

### C. Studio Dashboard & User Interface
* Navigasi 3-Tab di Header:
  * **🎛️ Studio:** Pengaturan koneksi YouTube, kartu URL OBS dengan tombol salin instan, kontrol tampilan & tipografi, monitor preview live, dan toolbar simulator interaktif di bawah kanvas.
  * **🎨 Katalog Tema:** Galeri pameran visual berukuran penuh dengan cuplikan banner grafis resmi dari Milky Brain dan status tema aktif.
  * **⚙️ Pengaturan:** Info server lokal & WebSocket, auto-updater center, petunjuk setup OBS, dan tombol reset preferensi pabrik.

### D. In-App Auto-Updater & Distribusi
* Pengecekan versi otomatis ke GitHub Releases API (`repos/Milkyponi/KY-Poni/releases/latest`).
* Pembandingan SemVer ketat: modal notifikasi pembaruan hanya muncul jika tag rilis remote lebih baru dari versi yang sedang berjalan.
* Memori penolakan: jika pengguna memilih *"✕ Lewati Dulu"*, sistem mengingat penolakan tersebut di `localStorage` agar tidak memunculkan notifikasi berulang (*zero spam*).
* One-click seamless update & restart untuk Linux (`.AppImage`) dan Windows (`.exe`).

---

## 5. Kebutuhan Non-Fungsional (Non-Functional Requirements)

* **Performa & FPS:** Kanvas overlay OBS harus berjalan stabil pada 60 FPS menggunakan akselerasi GPU (animasi via CSS `transform` dan `opacity`).
* **Konsumsi Memori:** Penggunaan RAM desktop app tidak boleh membebani workstation gaming (<150 MB saat streaming aktif).
* **Portabilitas:** Aplikasi harus dapat dijalankan langsung tanpa instalasi rumit (Portable `.AppImage` di Linux melalui Gear Lever dan Portable `.exe` di Windows).
* **Keamanan:** Komunikasi lokal dibatasi ketat ke loopback `127.0.0.1` tanpa membuka port ke jaringan publik.
