# Changelog KY-Poni v0.5.2-alpha (2026-11-04)

### 📐 Content-Driven Intrinsic Sizing & Pure Proportional Scaling Architecture
- **Eliminasi Formula Distorsi Kanvas Inverse:**
  - Menghapus rumus `width: calc(100% / var(--canvas-scale))` dan `height: calc(100% / var(--canvas-scale))` pada `#chat-canvas` yang sebelumnya memicu distorsi gelembung (melebar melar ribuan pixel pada skala 25% dan tertekan menyusut pada skala 150%).
- **Pemisahan Peran Kanvas vs Ukuran Desain Tema (Streamlabs Philosophy):**
  - **Kanvas OBS (`#chat-canvas`):** Kini murni berfungsi sebagai *viewport window* pembatas area layar (`100vw` × `100vh`). Mengubah resolusi kanvas (450x800, 600x900, 1080p, 4K) murni menentukan kapasitas berapa banyak pesan chat yang mampu ditampung dan bertumpuk vertikal/horizontal, bukan lagi merusak bentuk tema!
  - **Ukuran Alami Konten (`#chat-flow` & `.chat-entry`):** Gelembung Persona 5 dan tema Classic kini memiliki ukuran alami mandiri (`width: fit-content; min-width: 380px; max-width: 520px;`) yang hanya memanjang mengikuti kalimat chat, bukan mengikuti lebar kanvas layar.
- **Pure Proportional Zoom Transform:**
  - Memperkenalkan `#chat-flow` sebagai kontainer tumpukan pesan yang diskalakan secara proporsional murni (`transform: scale(var(--overlay-scale, 1))`) dengan titik tumpu (*transform-origin*) terkunci ke sudut anchor aktif (`bottom-left`, `bottom-right`, `top-left`, `top-right`).
  - **Skala Minimum (25%):** Gelembung chat mengecil secara proporsional (tinggi dan lebar seimbang ~95px × 41px), duduk manis di sudut layar tanpa meregang gepeng seperti mie/pancake (Vision 10/10 verified).
  - **Skala Maksimum (150%):** Gelembung chat membesar gagah dan tajam (~570px × 300px), teks tertata rapi dengan margin bersih dan zero-overflow (Vision 10/10 verified).
