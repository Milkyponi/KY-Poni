# Changelog KY-Poni v0.9.0-alpha (2026-11-07)

### 🎯 Phase 9: Centered Vertical Anchor, Snug-Fit Tier Heights & Long Comment Hardening
- **Centered Vertical Anchor (Anti Top-Heavy Trap):**
  - Mengubah orientasi titik tumpu vertikal teks pesan pada tema obrolan menjadi rata tengah (`display: flex; flex-direction: column; justify-content: center; align-items: flex-start;`).
  - Menghilangkan kekosongan bawah (*dead space*) yang sebelumnya mencapai ~45% dari area interior balon dialog.
  - Distribusi ruang vertikal kini terbagi simetris secara sempurna: margin atas ke Username seimbang dengan margin bawah ke garis tepi bawah balon.
- **Snug-Fit Tier Height Progression:**
  - Melakukan kalibrasi ulang pada 4-tingkat progres tinggi balon dialog agar membungkus baris teks secara pas (*snug fit*):
    - **Tier 1 (Pendek < 55 char)**: Tinggi 128px (Lebar 460px)
    - **Tier 2 (Sedang 55 - 115 char)**: Tinggi 142px (Lebar 520px)
    - **Tier 3 (Panjang 115 - 175 char)**: Tinggi 156px (Lebar 600px)
    - **Tier 4 (Ekstrem > 175 char)**: Tinggi 172px (Lebar 660px)
  - Mempertahankan rasio aspek aerodinamis game di kisaran 3.5:1 s/d 3.8:1 tanpa pembengkakan bentuk balon menjadi kotak bantal.
- **Standarisasi Kontrak THEME_SPEC.md & Standing Preference:**
  - Menetapkan aturan wajib bagi seluruh tema game (built-in maupun tema modular masa depan di `ky-poni-themes`):
    1. Seluruh kontainer pesan wajib rata tengah vertikal.
    2. Kenaikan tinggi tier wajib *snug fit* menjaga siluet game.
- **Cache-Busting & Anti-Stale Assets Serving:**
  - Menambahkan header `Cache-Control: no-cache, no-store, must-revalidate` pada route statis aset tema dan timestamp query `?v=${Date.now()}` pada pemuatan skrip dinamis `renderer.js` dan stylesheet `style.css` di `overlay.js`.
- **Workstation Auto-Install:**
  - Biner Linux AppImage otomatis di-build dan dipasang ke `~/AppImages/kyponi.appimage` untuk pengujian lokal instan oleh Bos.
