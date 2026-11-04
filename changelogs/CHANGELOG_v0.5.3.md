# Changelog KY-Poni v0.5.3-alpha (2026-11-04)

### 🎨 Persona 5 True Silhouette Restoration & Universal Simulator
- **True Authentic Persona 5 Proportions (3.45 : 1 Ratio):**
  - Mengembalikan rasio aspek pipih aerodinamis khas Atlus dengan menurunkan tinggi dasar balon chat dari 165px ke **128px** (Tier 1) dan **148px** (Tier 2).
  - Menetapkan batas lebar alami ideal `min-width: 440px` dan `max-width: 540px`, mengeliminasi bentuk kotak gendut/swollen dan menghasilkan siluet horizontal tajam 1:1 identik dengan preview katalog resmi.
- **Origami Ribbon Nameplate Enclosure:**
  - Menambahkan styling slip origami putih solid (`background: #FFFFFF; box-shadow: 2px 2px 0 #000; transform: skewX(-14deg)`) pada `.p5-nameplate`.
  - Huruf-huruf nama penonton kini 100% selalu duduk di atas pita putih tanpa pernah tumpah/bocor ke ruang hitam kosong di luar gelembung.
  - Menambahkan dynamic font auto-scaling untuk nama penonton yang lebih panjang dari 8–11 karakter.
- **Default Official Font Alignment:**
  - Mengaktifkan **Optima Nova (`OptimaNovaLT-Black`)** sebagai font default tema Persona 5 dengan dukungan variasi berat (`font-weight: 100 900`).
  - Menambahkan `OptimaNova` sebagai opsi teratas di selector tipografi dashboard.
- **Universal Simulator Payloads (Theme-Agnostic):**
  - Mengubah data simulasi live chat menjadi netral dan universal lintas tema (`ViewerOne`, `MilkyPoni`, `ModTeam`, `MemberStar`, `Supporter`), sehingga siap digunakan untuk tema game apa pun (Persona 5, Cyberpunk, Undertale, dll.) tanpa hardcoded karakter game tertentu.
- **Studio Canvas Auto-Scroll to Anchor:**
  - Viewport kanvas di dashboard studio secara otomatis mengalir ke sudut anchor aktif streamer (`bottom-left` / `bottom-right`) sehingga balon chat langsung tampak di layar tanpa perlu scroll manual.
