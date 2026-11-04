# KY-Poni Theme Plugin Specification (THEME_SPEC.md)
## Standard Contract for Game-Aesthetic Chat Overlays

---

## 1. Filosofi & Desain Arsitektur

Theme Plugin System pada KY-Poni dirancang dengan prinsip **Open-Closed Principle (OCP)**:
> *Core Overlay Engine tertutup untuk modifikasi (`overlay.js` tidak boleh diubah), namun terbuka untuk ekspansi tema game baru seluas-luasnya.*

Setiap tema adalah modul independen yang mengemas aset grafis, tipografi, stylesheet, dan fungsi konstruksi DOM-nya sendiri.

---

## 2. Struktur Direktori Tema Standar

Setiap tema wajib disimpan di dalam folder:
`src/public/themes/<theme_id>/`

```text
src/public/themes/<theme_id>/
├── theme.json        # [WAJIB] Metadata tema, tags, & preview mockup
├── style.css         # [WAJIB] Styling CSS, @font-face, dan keyframe animasi
├── renderer.js       # [WAJIB] Modul JavaScript konstruksi DOM balon chat
└── assets/           # [WAJIB] Berkas gambar (.PNG/.SVG) dan font lokal (.TTF/.WOFF2)
    ├── fonts/
    └── slices/
```

---

## 3. Spesifikasi Berkas `theme.json`

Setiap tema wajib memiliki file `theme.json` valid:

```json
{
  "id": "persona5",
  "name": "Persona 5 Phantom",
  "version": "1.0.0",
  "author": "Milky Brain",
  "previewColor": "#D03D3D",
  "description": "Balon kata otentik 3-piece dengan ransom nameplate dan font resmi Persona 5.",
  "tags": ["JRPG", "Persona", "Comic", "All-Out Attack"],
  "defaultConfig": {
    "recommendedLayout": "vertical-wide",
    "fontFamily": "OptimaNova",
    "fontSize": 18,
    "textColor": "#FFFFFF"
  },
  "previewBanner": {
    "type": "custom",
    "html": "<div class='p5-banner-preview'>...</div>"
  }
}
```

---

## 4. Spesifikasi Kontrak Modul `renderer.js`

File `renderer.js` dieksekusi secara dinamis di kanvas overlay (`overlay.html`). File ini wajib meregistrasikan objek renderer ke objek global `window.KYPoniTheme`:

```javascript
/**
 * Standar Kontrak Theme Renderer KY-Poni
 */
window.KYPoniTheme = {
  /**
   * Mengonstruksi elemen DOM untuk satu pesan chat.
   * 
   * @param {Object} item - Data pesan chat
   *   @param {string} item.id - ID unik pesan
   *   @param {string} item.type - 'chat' | 'superchat' | 'membership'
   *   @param {Object} item.author - Info pengirim
   *     @param {string} item.author.name - Nama pengirim
   *     @param {string} item.author.avatar - URL foto profil
   *     @param {Array}  item.author.badges - Badge (owner, mod, member, verified)
   *   @param {string} item.message - Isi teks pesan (mendukung emotikon inline)
   *   @param {Object} [item.superchat] - Detail donasi (amount, color, dll)
   * 
   * @param {Object} context - Konfigurasi overlay aktif dari URL parameters
   *   @param {string} context.theme - ID tema yang sedang aktif
   *   @param {string} context.layout - Preset layout ('vertical', 'horizontal', dll)
   *   @param {string} context.pos - Sudut layar ('bottom-left', 'top-right', dll)
   *   @param {number} context.scale - Skala kanvas (70 - 150)
   *   @param {number} context.fsize - Ukuran font custom (0 jika default)
   *   @param {string} context.font - Nama font keluarga aktif
   *   @param {string} context.color - Hex warna teks custom
   * 
   * @returns {HTMLElement} Elemen DOM .chat-entry yang sudah siap di-mount ke kanvas
   */
  renderMessage(item, context) {
    const entry = document.createElement('div');
    entry.className = `chat-entry ${item.type === 'superchat' ? 'is-superchat' : ''}`;
    entry.id = `msg-${item.id}`;

    // Susun elemen balon chat sesuai estetika game...
    return entry;
  },

  /**
   * (Opsional) Lifecycle hook yang dipanggil sekali saat tema berhasil diinisialisasi.
   * @param {Object} context
   */
  onLoad(context) {
    console.log(`[Theme Engine] Theme "${context.theme}" successfully loaded.`);
  },

  /**
   * (Opsional) Hook kustom saat menerima Super Chat atau Membership.
   * @param {Object} item
   * @param {Object} context
   */
  onSpecialEvent(item, context) {}
};
```

---

## 5. Aturan Baku Rekayasa Visual Game (Rule of Thumb)

1. **Prinsip Asset-First (Anti-CSS Recreation Trap):**
   * Jangan pernah mencoba menggambar ulang balon game kompleks dengan `clip-path` murni jika aset grafis aslinya tersedia. Gunakan potongan gambar asli game (.PNG) ber-alpha channel bersih.
2. **Strategi 3-Piece Slicing (Left Cap, Mid Slice, Right Cap):**
   * **Left Cap:** Mengunci ekor balon, gerigi/petir, dan dudukan papan nama. Dimensi terkunci permanen (*flex-shrink: 0*).
   * **Mid Slice:** Panel bodi hitam penyambung garis atas dan bawah. Diberikan `flex: 1` agar bisa melebar bebas mengikuti teks pesan tanpa membatasi panjang kalimat.
   * **Right Cap:** Mengunci pecahan segitiga (*shards*), tanduk, atau aksen kanan. Dimensi terkunci permanen (*flex-shrink: 0*).
3. **Penyimpanan Font Lokal:**
   * Dilarang bergantung pada font internet eksternal saat streaming live. Seluruh font game resmi wajib disimpan di `assets/fonts/` dan diregistrasikan dengan `@font-face` di `style.css`.
4. **Pencegahan Seamline:**
   * Berikan margin negatif 1px (`margin-left: -1px; margin-right: -1px;`) pada potongan tengah untuk mencegah timbulnya celah transparan akibat interpolasi sub-piksel browser.
5. **Safe Interior Clearance:**
   * Batasi area kotak teks (`.p5-message-box` atau sejenisnya) agar selalu memiliki ruang aman dari papan nama di atas dan garis outline di bawah.
