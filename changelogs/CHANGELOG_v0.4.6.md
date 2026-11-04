# Changelog KY-Poni v0.4.6-alpha (2026-11-03)

### 🎨 Persona 5 Authentic Asset Dialogue Reconstruction ("Plek Ketiplek")
- **3-Piece Hybrid Asset Skin:** Menggantikan rekonstruksi CSS murni dengan pemotongan aset grafis resmi Persona 5 (`bubble_left.png`, `bubble_mid.png`, `bubble_right.png`) dengan alpha channel 100% solid, menghasilkan siluet ornamen gerigi tajam kiri (*speech tail/shards*) dan segitiga kanan murni tanpa cacat sambungan (*zero seamline*).
- **Authentic Font Integration:** Mem-bundle font resmi Persona 5 ke direktori aset lokal: `OptimaNovaLT-Black.ttf` (P5 Royal English font), `KoreanKRSM.ttf` (P5 Vanilla font), dan `p5hatty.ttf` (ransom header font).
- **Ransom-Note Dynamic Nameplate:** Logika penataan karakter nameplate otomatis di atas pita putih trapesium miring (`skewX -14deg`), dengan seleksi huruf dinamis berlatar kotak merah (*ransom red accent*) dan subtle organic tilt.
- **Dynamic Multi-Line Height:** Gelembung dialog otomatis beradaptasi (1 baris vs 2 baris atau lebih) dengan margin bawah yang lapang dan aman dari lereng garis outline bawah.
- **Unified Chat Bubble Scope (Animation Pruned):** Menangguhkan animasi khusus Super Chat (*All-Out Attack*) dan banner multi-tingkat. Semua chat penonton, member, dan donatur disatukan menggunakan template dialog otentik game Persona 5 dengan lencana inline yang rapi.

### 🔒 Theme Ecosystem Curation (Custom Theme Removed)
- **Strictly Curated Milky Brain Themes:** Menghapus fitur import/upload folder custom tema pengguna (`userThemesDir` dan tombol *"Buka Folder Tema Kustom"*). Seluruh tema yang dijalankan aplikasi dikunci secara ketat hanya pada koleksi resmi Milky Brain (`src/public/themes/`) guna menjamin 100% stabilitas dan kompatibilitas antarmuka pengguna.
