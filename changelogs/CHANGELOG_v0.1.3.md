# Project Archive & Changelog: KY-Poni (v0.1.3-alpha)

- **Tanggal Rilis**: 2026-11-02
- **Lead Developer**: Fonzy (Divisi Software Development)
- **Status**: Alpha Release (Internal Testing & Active Feature Set)
- **Port Layanan**: `http://localhost:19840/`

---

## Ringkasan Fitur & Changelog v0.1.3

### 1. Ekstraksi Foto Profil YouTube (Viewer Avatars) & CDN Hotlink Guard
- **Ekstraksi Otomatis:** Engine InnerTube mengekstrak URL foto profil asli (`item.author.thumbnail.url`) dari CDN Google/YouTube (`yt3.ggpht.com`).
- **Mitigasi 403 Forbidden (Hotlink Defense):**
  - Ditambahkan `<meta name="referrer" content="no-referrer">` pada kanvas OBS (`overlay.html`) dan dashboard (`index.html`).
  - Atribut `referrerPolicy = 'no-referrer'` disematkan langsung pada elemen avatar balon kata dan pop-up All-Out Attack Super Chat, mencegah CDN Google memblokir pemuatan gambar saat dimuat dari localhost/OBS.
- **Graceful Avatar Fallback:**
  - Dilengkapi event listener `onerror`: jika penonton tidak memiliki foto profil publik atau gambar gagal dimuat, sistem otomatis memunculkan avatar robot/komik dinamis unik berdasarkan nama akun (`dicebear bottts`).

### 2. Integrasi Visual Penuh di Persona 5 Theme
- Avatar penonton dirender dalam lingkaran bergaris tepi putih 2px (`border: 2px solid var(--p5-white)`), dipotong miring (*skewed*) serasi dengan tab nama Persona 5, memberikan sentuhan visual premium di setiap komentar.
