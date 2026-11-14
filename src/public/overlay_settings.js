/**
 * KY-Poni - Overlay Settings Resolver
 *
 * Satu-satunya tempat yang memutuskan "bagaimana overlay harus terlihat".
 *
 * Sebelum v1.2.0, tampilan overlay sepenuhnya ditentukan oleh query string pada URL OBS.
 * Konsekuensinya streamer harus memperbarui URL di OBS setiap kali mengubah preferensi.
 * Sekarang preferensi tinggal di config.json (server lokal), dan modul ini yang
 * menggabungkan tiga sumber menjadi satu objek setelan yang sudah divalidasi:
 *
 *   1. config server (atau cache lokal saat server belum siap)
 *   2. parameter URL  - hanya menang di mode preview (iframe dashboard)
 *   3. default bawaan
 *
 * Aturan prioritas (disengaja, lihat catatan di resolveSettings):
 *   - preview=1  -> parameter URL menang  (slider dashboard harus terasa instan)
 *   - normal     -> config menang         (streamer ganti tema dari aplikasi, bukan dari OBS)
 *
 * Modul ini zero-dependency dan dapat dimuat baik oleh browser (window.KYPoniSettings)
 * maupun oleh Node (require) supaya penggabungan prioritas diuji sebagai fungsi nyata,
 * bukan ditebak lewat pencarian string.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KYPoniSettings = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Nilai bawaan. WAJIB sinkron dengan DEFAULT_CONFIG di src/config_manager.js.
   * fontFamily = 'OptimaNova' karena tema default aplikasi adalah Persona 5, dan
   * Optima Nova adalah font resmi tema tersebut. Sebelumnya nilai ini berbeda antara
   * config manager dan dashboard, yang tidak pernah terlihat selama tampilan selalu
   * datang dari URL.
   */
  var DEFAULTS = {
    theme: 'persona5',
    layout: 'vertical',
    pos: 'bottom-left',
    scale: 100,
    fontSize: 16,
    fontFamily: 'OptimaNova',
    textColor: '#FFFFFF',
    fade: 8,
    keep: 1,
  };

  /** `max` tidak pernah menjadi bagian dari config pengguna; ia tetap parameter URL. */
  var DEFAULT_MAX = 8;

  var POS_VALUES = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];

  /** Parameter URL -> key config kanonik. Nama berbeda karena URL lebih ringkas. */
  var URL_TO_CONFIG = {
    theme: 'theme',
    layout: 'layout',
    pos: 'pos',
    scale: 'scale',
    fsize: 'fontSize',
    font: 'fontFamily',
    color: 'textColor',
    fade: 'fade',
    keep: 'keep',
  };

  /** Perubahan pada key ini tidak bisa diterapkan tanpa membangun ulang kanvas. */
  var STRUCTURAL_KEYS = ['theme', 'layout', 'pos'];

  function normLayout(value) {
    if (typeof value !== 'string') return undefined;
    return value.indexOf('horizontal') === 0 ? 'horizontal' : 'vertical';
  }

  function normPos(value) {
    return (typeof value === 'string' && POS_VALUES.indexOf(value) !== -1) ? value : undefined;
  }

  function normNum(value, min, max) {
    var n;
    if (typeof value === 'number') {
      n = value;
    } else if (typeof value === 'string' && value.trim() !== '') {
      n = Number(value);
    } else {
      return undefined;
    }
    if (!isFinite(n)) return undefined;
    if (n < min || n > max) return undefined;
    return n;
  }

  /**
   * Warna dinormalkan ke '#RRGGBB' (atau '#RRGGBBAA') huruf besar.
   * Dashboard mengirim `FFFFFF` tanpa '#', URL lama juga, sedangkan config menyimpan
   * '#FFFFFF'. Tanpa normalisasi, ketiganya menghasilkan string berbeda untuk warna
   * yang sama dan perbandingan "apakah berubah?" jadi salah.
   */
  function normHex(value) {
    if (typeof value !== 'string') return undefined;
    var s = value.trim();
    if (!s) return undefined;
    if (s.charAt(0) === '#') s = s.slice(1);
    if (!/^[0-9a-fA-F]{3,8}$/.test(s)) return undefined;
    if (s.length === 3 || s.length === 4) {
      var expanded = '';
      for (var i = 0; i < s.length; i++) expanded += s.charAt(i) + s.charAt(i);
      s = expanded;
    }
    if (s.length !== 6 && s.length !== 8) return undefined;
    return '#' + s.toUpperCase();
  }

  function normTheme(value) {
    if (typeof value !== 'string') return undefined;
    var s = value.trim();
    return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : undefined;
  }

  function normFont(value) {
    if (typeof value !== 'string') return undefined;
    var s = value.trim().replace(/^['"]+|['"]+$/g, '');
    return (s.length > 0 && s.length <= 64) ? s : undefined;
  }

  var NORMALIZERS = {
    theme: normTheme,
    layout: normLayout,
    pos: normPos,
    scale: function (v) { return normNum(v, 10, 400); },
    fontSize: function (v) { return normNum(v, 6, 96); },
    fontFamily: normFont,
    textColor: normHex,
    fade: function (v) { return normNum(v, 0, 600); },
    keep: function (v) { return normNum(v, 0, 200); },
  };

  var CONFIG_KEYS = ['theme', 'layout', 'pos', 'scale', 'fontSize', 'fontFamily', 'textColor', 'fade', 'keep'];

  /**
   * Saring objek config (dari server, cache, atau berkas) menjadi hanya key berskema
   * dengan nilai yang lolos validasi. Key tak dikenal dibuang, bukan diteruskan.
   */
  function normalizeConfig(config) {
    var out = {};
    if (!config || typeof config !== 'object') return out;
    for (var i = 0; i < CONFIG_KEYS.length; i++) {
      var key = CONFIG_KEYS[i];
      if (!Object.prototype.hasOwnProperty.call(config, key)) continue;
      var normalized = NORMALIZERS[key](config[key]);
      if (normalized !== undefined) out[key] = normalized;
    }
    return out;
  }

  /** Baca query string menjadi key config kanonik, plus `max` yang hanya hidup di URL. */
  function normalizeUrlParams(search) {
    var out = {};
    var params;
    try {
      params = new URLSearchParams(typeof search === 'string' ? search : '');
    } catch (e) {
      return out;
    }
    for (var urlKey in URL_TO_CONFIG) {
      if (!Object.prototype.hasOwnProperty.call(URL_TO_CONFIG, urlKey)) continue;
      if (!params.has(urlKey)) continue;
      var configKey = URL_TO_CONFIG[urlKey];
      var normalized = NORMALIZERS[configKey](params.get(urlKey));
      if (normalized !== undefined) out[configKey] = normalized;
    }
    var max = normNum(params.get('max'), 1, 50);
    if (max !== undefined) out.max = max;
    return out;
  }

  /**
   * Gabungkan semua sumber menjadi setelan final.
   *
   * @param {object}  options
   * @param {string}  options.search  Query string mentah (window.location.search)
   * @param {object}  options.config  Config dari server / cache / null
   * @param {boolean} options.preview True bila dipanggil dari iframe dashboard (preview=1)
   * @returns {object} setelan tervalidasi: theme, layout, pos, scale, fontSize,
   *                   fontFamily, textColor, fade, keep, max
   */
  function resolveSettings(options) {
    var opts = options || {};
    var fromUrl = normalizeUrlParams(opts.search || '');
    var fromConfig = normalizeConfig(opts.config);
    var preview = opts.preview === true;

    var resolved = {
      theme: DEFAULTS.theme,
      layout: DEFAULTS.layout,
      pos: DEFAULTS.pos,
      scale: DEFAULTS.scale,
      fontSize: DEFAULTS.fontSize,
      fontFamily: DEFAULTS.fontFamily,
      textColor: DEFAULTS.textColor,
      fade: DEFAULTS.fade,
      keep: DEFAULTS.keep,
    };

    // Lapis config SELALU diterapkan lebih dulu. Di mode normal ia adalah lapisan
    // terakhir (menang); di mode preview ia menjadi dasar yang boleh ditimpa URL.
    // Bug yang ditutup di sini: versi pertama hanya menerapkan URL di mode preview,
    // sehingga field yang tidak disebut URL (mis. tema tersimpan) jatuh ke default
    // dan iframe dashboard menampilkan tema yang salah.
    for (var k = 0; k < CONFIG_KEYS.length; k++) {
      var ckey = CONFIG_KEYS[k];
      if (fromConfig[ckey] !== undefined) resolved[ckey] = fromConfig[ckey];
    }

    // PENTING - kenapa urutannya begini:
    //
    // Di OBS, URL adalah string mati. Kalau parameter URL SELALU menang, setiap pengguna
    // yang sudah menempel `?theme=persona5&layout=vertical` sejak v1.0 akan terkunci pada
    // tampilan itu selamanya — mereka tidak akan pernah merasakan fitur ini kecuali
    // menyunting URL manual, yaitu persis langkah manual yang ingin dihapus.
    //
    // Karena streamer mengganti tema/preferensi dari aplikasi (bukan dengan menyunting URL
    // OBS), config adalah sumber kebenaran yang sebenarnya.
    //
    //   mode normal  : default -> URL -> config   (config menang; streamer ganti dari aplikasi)
    //   mode preview : default -> config -> URL   (URL menang; slider dashboard harus instan)
    //
    // Parameter URL pada mode normal tetap berguna sebagai lapisan di bawah config,
    // sehingga URL lama yang menyebut sesuatu yang tidak ada di config tidak dibuang.
    if (preview) {
      for (var m = 0; m < CONFIG_KEYS.length; m++) {
        var pkey = CONFIG_KEYS[m];
        if (fromUrl[pkey] !== undefined) resolved[pkey] = fromUrl[pkey];
      }
    } else {
      for (var j = 0; j < CONFIG_KEYS.length; j++) {
        var ukey = CONFIG_KEYS[j];
        if (fromUrl[ukey] !== undefined) resolved[ukey] = fromUrl[ukey];
      }
      for (var n = 0; n < CONFIG_KEYS.length; n++) {
        var fkey = CONFIG_KEYS[n];
        if (fromConfig[fkey] !== undefined) resolved[fkey] = fromConfig[fkey];
      }
    }

    resolved.max = fromUrl.max !== undefined ? fromUrl.max : DEFAULT_MAX;

    return resolved;
  }

  /**
   * Apakah perbedaan dua setelan hanya menyangkut hal yang bisa diterapkan tanpa
   * membangun ulang kanvas (skala, ukuran font, jenis font, warna, fade, keep)?
   *
   * Dipakai sebagai guard anti reload-loop: overlay hanya reload bila benar-benar
   * ada perubahan struktural, jadi broadcast config yang nilainya sama tidak
   * memicu reload tanpa akhir.
   */
  function structuralChanged(current, next) {
    if (!current || !next) return true;
    for (var i = 0; i < STRUCTURAL_KEYS.length; i++) {
      var key = STRUCTURAL_KEYS[i];
      if (current[key] !== next[key]) return true;
    }
    return false;
  }

  /** Daftar key yang berubah antara dua setelan, untuk log dan pengujian. */
  function changedKeys(current, next) {
    var changed = [];
    if (!current || !next) return changed;
    var all = CONFIG_KEYS.concat(['max']);
    for (var i = 0; i < all.length; i++) {
      var key = all[i];
      if (current[key] !== next[key]) changed.push(key);
    }
    return changed;
  }

  return {
    DEFAULTS: DEFAULTS,
    DEFAULT_MAX: DEFAULT_MAX,
    STRUCTURAL_KEYS: STRUCTURAL_KEYS,
    URL_TO_CONFIG: URL_TO_CONFIG,
    normalizeConfig: normalizeConfig,
    normalizeUrlParams: normalizeUrlParams,
    normalizeColor: normHex,
    resolveSettings: resolveSettings,
    structuralChanged: structuralChanged,
    changedKeys: changedKeys,
  };
});
