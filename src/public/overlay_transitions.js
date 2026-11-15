/**
 * KY-Poni - Chat Entry Transition Resolver
 *
 * Sejak v1.3.0 animasi MASUK chat bukan lagi milik tema, melainkan kustomisasi
 * pengguna. Modul ini adalah satu-satunya tempat yang memutuskan "dari arah mana
 * balon chat datang" berdasarkan transisi terpilih + sudut anchor.
 *
 * Alasan animasi dipindahkan keluar dari tema:
 *   - Dua aturan CSS (tema + pilihan pengguna) yang menyasar properti `animation`
 *     pada elemen yang sama akan saling menimpa tergantung urutan stylesheet.
 *     Gejalanya hanya terlihat di siaran, bukan di kode.
 *   - Tema katalog komunitas tidak perlu mengimplementasikan lima animasi.
 *   - Animasi keluar (auto-hide) tetap milik tema; modul ini tidak menyentuhnya.
 *
 * Aturan arah (permintaan langsung streamer):
 *   Anchor kiri  -> masuk dari KIRI menuju kanan.
 *   Anchor kanan -> masuk dari KANAN menuju kiri.
 *   Anchor atas  -> masuk dari ATAS menuju bawah.
 *   Anchor bawah -> masuk dari BAWAH menuju atas.
 *   Anchor tengah-> jatuh ke kiri / bawah sebagai default.
 *
 * Modul zero-dependency dan bisa dimuat browser (window.KYPoniTransitions)
 * maupun Node (require), supaya arah transisi diuji sebagai fungsi nyata
 * dan bukan ditebak lewat pencarian string pada CSS.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KYPoniTransitions = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Urutan ini yang dipakai dropdown dashboard. Jangan diacak tanpa alasan. */
  var IDS = ['pop', 'slide-x', 'slide-y', 'zoom', 'fade'];

  /**
   * Bawaan aplikasi. 'pop' dipilih karena ia meniru gerak balon tema default
   * (Persona 5) sehingga instalasi lama tidak terasa berubah saat fitur ini masuk.
   */
  var DEFAULT_ID = 'pop';

  /**
   * Jarak awal slide, dalam persen ukuran elemen itu sendiri.
   * 108% bukan 100%: balon Persona 5 punya drop-shadow 4px, dan pada 100% tepat
   * garis bayangannya masih menyentuh tepi kanvas sebelum balon benar-benar masuk.
   */
  var SLIDE_OFFSET = 108;

  /** Titik awal zoom. 0.35 masih terbaca sebagai "tumbuh", bukan "berkedip". */
  var ZOOM_FROM = 0.35;

  /** Pop: shift, skala, dan rotasi awal — menyamakan gerak slam milik Persona 5. */
  var POP_SHIFT = 24;
  var POP_SCALE = 0.7;
  var POP_ROTATE = 6;

  /**
   * Pecah nilai `pos` menjadi sisi horizontal & vertikal.
   * Nilai di luar skema (null, sampah) diperlakukan sebagai anchor kiri-bawah,
   * sama dengan default overlay.
   */
  function sideOf(pos) {
    if (typeof pos !== 'string') return { h: 'left', v: 'bottom' };
    var h = 'center';
    if (pos.indexOf('-left') !== -1) h = 'left';
    else if (pos.indexOf('-right') !== -1) h = 'right';

    var v = 'center';
    if (pos.indexOf('top-') === 0) v = 'top';
    else if (pos.indexOf('bottom-') === 0) v = 'bottom';

    return { h: h, v: v };
  }

  /** Normalisasi id transisi dari config / URL. Nilai tak dikenal -> undefined. */
  function normalize(value) {
    if (typeof value !== 'string') return undefined;
    var s = value.trim().toLowerCase();
    return IDS.indexOf(s) !== -1 ? s : undefined;
  }

  function pct(n) {
    return (n > 0 ? '+' : '') + n + '%';
  }

  function px(n) {
    return (n > 0 ? '+' : '') + n + 'px';
  }

  /**
   * Hitung parameter animasi masuk.
   *
   * @param {string} transition id transisi ('pop', 'slide-x', 'slide-y', 'zoom', 'fade')
   * @param {string} pos        sudut anchor ('bottom-left', 'top-right', 'center', ...)
   * @returns {object} { id, animation, x, y, scale, rotate, origin }
   *                   `animation` adalah nama keyframe yang dipakai CSS.
   *                   x/y/scale/rotate adalah nilai CSS siap tempel (string).
   *                   origin adalah titik tumpu transform.
   */
  function resolve(transition, pos) {
    var id = normalize(transition) || DEFAULT_ID;
    var side = sideOf(pos);

    // Anchor 'center' tidak punya tepi layar. Arah dipilih agar konsisten dengan
    // tampilan lama: masuk dari kiri untuk slide menyamping, dari bawah untuk
    // slide vertikal. Bukan bug — keputusan yang disengaja.
    var h = side.h === 'center' ? 'left' : side.h;
    var v = side.v === 'center' ? 'bottom' : side.v;

    var origin = v + ' ' + h;

    if (id === 'slide-x') {
      // Anchor kiri -> balon datang dari kiri (x negatif). Anchor kanan -> sebaliknya.
      var xSign = (h === 'right') ? 1 : -1;
      return {
        id: id,
        animation: 'kyp-enter-slide',
        x: pct(xSign * SLIDE_OFFSET),
        y: '0px',
        scale: '1',
        rotate: '0deg',
        origin: origin,
      };
    }

    if (id === 'slide-y') {
      var ySign = (v === 'top') ? -1 : 1;
      return {
        id: id,
        animation: 'kyp-enter-slide',
        x: '0px',
        y: pct(ySign * SLIDE_OFFSET),
        scale: '1',
        rotate: '0deg',
        origin: origin,
      };
    }

    if (id === 'zoom') {
      return {
        id: id,
        animation: 'kyp-enter-zoom',
        x: '0px',
        y: '0px',
        scale: String(ZOOM_FROM),
        rotate: '0deg',
        // Titik tumpu di sudut anchor: balon tampak tumbuh dari tepi layar,
        // bukan mekar dari tengahnya sendiri.
        origin: origin,
      };
    }

    if (id === 'fade') {
      return {
        id: id,
        animation: 'kyp-enter-fade',
        x: '0px',
        y: '0px',
        scale: '1',
        rotate: '0deg',
        origin: 'center',
      };
    }

    // 'pop' — meniru slam-in Persona 5, arah mengikuti anchor vertikal.
    // Anchor bawah: turun +24px sambil berputar -6° (persis slam-in milik tema P5).
    // Anchor atas : naik -24px sambil berputar +6° (slam-down milik tema P5).
    var popSign = (v === 'top') ? -1 : 1;
    return {
      id: 'pop',
      animation: 'kyp-enter-pop',
      x: '0px',
      y: px(popSign * POP_SHIFT),
      scale: String(POP_SCALE),
      rotate: (popSign * POP_ROTATE * -1) + 'deg',
      origin: origin,
    };
  }

  /**
   * Terapkan hasil resolve ke elemen kanvas sebagai atribut + CSS variable.
   *
   * Dipisah dari overlay.js agar bisa dipanggil ulang tanpa membangun DOM:
   * mengganti transisi tidak boleh memicu rebuild (rebuild akan memutar ulang
   * animasi seluruh balon yang sedang tampil, terlihat sebagai kedipan di siaran).
   *
   * @param {HTMLElement} canvas elemen #chat-canvas
   * @param {object} resolution hasil resolve()
   * @param {HTMLElement} [rootEl] elemen tempat CSS variable dipasang (default: canvas)
   */
  function applyToCanvas(canvas, resolution, rootEl) {
    if (!canvas || !resolution) return;
    canvas.setAttribute('data-transition', resolution.id);

    var host = rootEl || canvas;
    if (!host || !host.style || typeof host.style.setProperty !== 'function') return;

    host.style.setProperty('--kyp-enter-x', resolution.x);
    host.style.setProperty('--kyp-enter-y', resolution.y);
    host.style.setProperty('--kyp-enter-scale', resolution.scale);
    host.style.setProperty('--kyp-enter-rotate', resolution.rotate);
    host.style.setProperty('--kyp-enter-origin', resolution.origin);
  }

  return {
    IDS: IDS,
    DEFAULT_ID: DEFAULT_ID,
    SLIDE_OFFSET: SLIDE_OFFSET,
    ZOOM_FROM: ZOOM_FROM,
    normalize: normalize,
    sideOf: sideOf,
    resolve: resolve,
    applyToCanvas: applyToCanvas,
  };
});
