# Changelog KY-Poni v0.4.10-alpha (2026-11-03)

### 📐 Dynamic Horizontal Text Expansion & Anti-Overflow Architecture
- **Middle Slice Horizontal Expansion:** Membuka pembatasan lebar `max-width: 620px` dan `max-width: 440px`. Potongan tengah bodi hitam (`bubble_mid.png`) kini melebar secara dinamis mengikuti panjang teks pesan (`max-width: calc(100% - 24px)`), memberikan ruang horizontal lapang hingga 550px–850px+ pada kanvas.
- **Strict Ornament Preservation:** Ornamen gerigi tajam kiri (`bubble_left.png`) dan pecahan segitiga kanan (`bubble_right.png`) dikunci pada rasio aspek alaminya (100% vector-sharp), sehingga pelebaran bodi tengah tidak pernah mendistorsi ornamen sedikit pun.
- **Dynamic 3-Tier Height Adaptation:** Menyesuaikan tinggi kontainer gelembung dialog berdasarkan volume teks:
  - `tier-1 (165px)`: Pesan pendek (<45 karakter) dengan siluet ramping otentik.
  - `tier-2 (200px)`: Pesan sedang (45–95 karakter) dan alert Membership / Super Chat.
  - `tier-3 (235px)`: Pesan panjang (>95 karakter) dengan safe margin lapang.
- **Safe Interior Clearance Formula:** Menata ulang interior kotak teks ke `top: 64px–72px` dan `bottom: 24px–32px`, mengeliminasi total tabrakan teks dengan papan nama (*nameplate*) di atas dan mencegah teks menembus outline putih di bawah.
- **Auto-Fit Font Scaling:** Memasang penyesuaian skala font otomatis proporsional untuk pesan panjang ketika streamer menggunakan ukuran font besar (25px+), menjamin keterbacaan teks 100% di dalam balon tanpa teks terpotong (*10/10 Vision Verified*).
