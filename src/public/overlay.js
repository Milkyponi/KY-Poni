/**
 * KY-Poni - Core OBS Overlay Client Engine
 *
 * Open-Closed Architecture:
 * - Core Engine manages canvas positioning, directional horizontal/vertical insertion,
 *   auto-hide expiration timers, retention guards, and WebSocket event ingestion.
 * - Theme-specific DOM construction is delegated to dynamic theme plugins (/themes/:theme/renderer.js)
 *   implementing the standard Theme Plugin Contract (THEME_SPEC.md).
 *
 * Sejak v1.2.0 tampilan TIDAK lagi ditentukan oleh query string URL OBS.
 * Sumber kebenaran adalah config.json milik server lokal (lihat overlay_settings.js),
 * sehingga URL OBS bisa statis: http://localhost:19840/overlay
 *
 * Perubahan preferensi dari dashboard diterima lewat WebSocket (CONFIG_UPDATED):
 *   - perubahan kosmetik   -> diterapkan langsung tanpa reload, tanpa kedipan
 *   - perubahan struktural -> halaman memuat ulang dirinya sendiri
 */

(function () {
  'use strict';

  var Settings = window.KYPoniSettings;
  if (!Settings) {
    console.error('[KY-Poni Core Overlay] overlay_settings.js tidak termuat. Overlay tidak dapat berjalan.');
    return;
  }

  var urlParams = new URLSearchParams(window.location.search);

  // Mode preview = iframe di dashboard. Di mode ini parameter URL menang, supaya
  // slider terasa instan tanpa menunggu simpan ke disk.
  var isPreview = urlParams.get('preview') === '1';

  // Cache khusus profil Chromium OBS. Dashboard TIDAK boleh menulis kunci ini:
  // kalau dua sisi menulis, nilai lama bisa menang atas config baru.
  var CACHE_KEY = 'kyp-overlay-settings-cache-v1';

  /** Setelan hasil resolusi (config / URL / default). */
  var settings = null;

  /**
   * Objek context yang dioper ke plugin tema.
   *
   * PENTING: objek ini dimutasi DI TEMPAT, tidak pernah diganti referensinya.
   * Renderer tema membaca `context.fsize` / `context.color` pada SETIAP pesan
   * (persona5:107, persona3reload:99-112), jadi mengganti referensi saja tidak akan
   * mengubah apa pun pada pesan yang dirender sesudahnya.
   */
  var context = {};

  /** Item yang sedang tampil: { item, expiresAt, el }. Urut dari yang paling lama. */
  var visible = [];

  var canvas = null;
  var flow = null;
  var ready = false;
  var pending = [];
  var sweepTimer = null;
  var configRetryTimer = null;
  var themePluginLoadedFor = null;
  var ws = null;
  var hasConnectedOnce = false;

  // ---------------------------------------------------------------- cache

  function readCache() {
    try {
      var raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(config) {
    // Mode preview tidak menulis cache: iframe hanya mencerminkan state yang sudah
    // tersimpan di server, bukan sumber kebenaran.
    if (isPreview) return;
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify({
        theme: config.theme,
        layout: config.layout,
        pos: config.pos,
        scale: config.scale,
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
        textColor: config.textColor,
        fade: config.fade,
        keep: config.keep,
      }));
    } catch (e) {
      // localStorage penuh/diblokir: overlay tetap jalan dengan config server.
    }
  }

  // ---------------------------------------------------------------- config

  function fetchConfig(timeoutMs) {
    var controller = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = null;

    if (controller) {
      timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    }

    return fetch('/api/config', {
      cache: 'no-store',
      signal: controller ? controller.signal : undefined,
    })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (cfg) {
        return (cfg && typeof cfg === 'object') ? cfg : null;
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        return null;
      });
  }

  function resolve(config) {
    return Settings.resolveSettings({
      search: window.location.search,
      config: config,
      preview: isPreview,
    });
  }

  // ---------------------------------------------------------------- penerapan setelan

  function applyCssVariables() {
    var root = document.documentElement;

    root.style.setProperty('--overlay-scale', (settings.scale / 100).toString());
    root.style.setProperty('--canvas-scale', (settings.scale / 100).toString());

    if (settings.fontSize && settings.fontSize > 0) {
      root.style.setProperty('--msg-font-size', settings.fontSize + 'px');
    }
    if (settings.fontFamily) {
      root.style.setProperty('--msg-font-family', "'" + settings.fontFamily + "', sans-serif");
    }
    if (settings.textColor) {
      root.style.setProperty('--msg-font-color', settings.textColor);
    }
  }

  function syncContext() {
    // Mutasi di tempat. Lihat catatan pada deklarasi `context`.
    context.theme = settings.theme;
    context.layout = settings.layout;
    context.pos = settings.pos;
    context.scale = settings.scale;
    context.fsize = settings.fontSize;
    context.font = settings.fontFamily;
    context.color = settings.textColor;
    context.fade = settings.fade;
    context.keep = settings.keep;
    context.max = settings.max;
    context.isHorizontal = settings.layout === 'horizontal';
    context.isRightPos = settings.pos.indexOf('-right') !== -1;
    context.isTopPos = settings.pos.indexOf('top-') === 0;
    context.isPrependFlow = context.isHorizontal ? !context.isRightPos : context.isTopPos;
  }

  function isPrependFlow() {
    return context.isPrependFlow === true;
  }

  function applyCanvasClasses() {
    canvas.className = '';
    canvas.classList.add(context.isHorizontal ? 'layout-horizontal' : 'layout-vertical');
    if (settings.layout === 'fullscreen') {
      canvas.classList.add('layout-fullscreen');
    }
    canvas.classList.add('pos-' + settings.pos);
  }

  function loadThemePlugin(themeName, done) {
    if (themePluginLoadedFor === themeName && window.KYPoniTheme) {
      if (typeof window.KYPoniTheme.onLoad === 'function') {
        try { window.KYPoniTheme.onLoad(context); } catch (e) { /* tema tidak boleh mematikan core */ }
      }
      done();
      return;
    }

    var scriptId = 'theme-renderer-plugin';
    var existing = document.getElementById(scriptId);
    if (existing) existing.remove();

    // Plugin tema lama menggantung di window.KYPoniTheme sampai script baru selesai
    // dimuat. Dikosongkan agar tidak ada pesan yang dirender dengan tema salah.
    window.KYPoniTheme = null;

    var script = document.createElement('script');
    script.id = scriptId;
    script.src = '/themes/' + themeName + '/renderer.js?v=' + Date.now();
    script.onload = function () {
      themePluginLoadedFor = themeName;
      if (window.KYPoniTheme && typeof window.KYPoniTheme.onLoad === 'function') {
        try { window.KYPoniTheme.onLoad(context); } catch (e) { /* ignore */ }
      }
      done();
    };
    script.onerror = function () {
      themePluginLoadedFor = null;
      console.warn('[KY-Poni Core] Could not load renderer.js for theme "' + themeName + '". Generic fallback will be used.');
      done();
    };
    document.head.appendChild(script);

    var themeLink = document.getElementById('theme-stylesheet');
    if (themeLink) {
      themeLink.href = '/themes/' + themeName + '/style.css?v=' + Date.now();
    }
  }

  function renderFallbackMessage(item) {
    var entry = document.createElement('div');
    entry.className = 'chat-entry ' + (item.type === 'superchat' ? 'is-superchat' : '');
    entry.id = 'msg-' + item.id;

    var authorSpan = document.createElement('div');
    authorSpan.style.fontWeight = 'bold';
    authorSpan.textContent = (item.author && item.author.name) || 'User';

    var textSpan = document.createElement('div');
    textSpan.innerHTML = item.message || '';

    entry.appendChild(authorSpan);
    entry.appendChild(textSpan);
    return entry;
  }

  function buildEntry(item) {
    if (window.KYPoniTheme && typeof window.KYPoniTheme.renderMessage === 'function') {
      try {
        return window.KYPoniTheme.renderMessage(item, context);
      } catch (e) {
        console.error('[KY-Poni Core] renderer tema melempar error, memakai fallback:', e);
      }
    }
    return renderFallbackMessage(item);
  }

  /**
   * Bangun ulang seluruh DOM dari state `visible`.
   *
   * Diperlukan karena renderer tema menulis ukuran font & warna sebagai INLINE STYLE
   * per pesan. Mengubah CSS variable saja tidak akan memperbarui pesan yang sudah
   * tampil — khususnya persona3reload, yang menulis `context.color` langsung ke style
   * elemen (persona3reload/renderer.js:111-113).
   */
  function rebuildDom() {
    flow.textContent = '';
    for (var i = 0; i < visible.length; i++) {
      var entry = visible[i];
      var el = buildEntry(entry.item);
      entry.el = el;
      if (!el) continue;
      if (isPrependFlow()) {
        flow.prepend(el);
      } else {
        flow.appendChild(el);
      }
    }
    scrollToAnchor();
  }

  function scrollToAnchor() {
    if (!canvas) return;
    if (context.isHorizontal) {
      canvas.scrollTo({ left: context.isRightPos ? canvas.scrollWidth : 0, behavior: 'smooth' });
    } else {
      canvas.scrollTop = context.isTopPos ? 0 : canvas.scrollHeight;
    }
  }

  function animateAndRemove(el) {
    if (!el) return;
    if (el.classList.contains('is-exiting')) return;
    el.classList.add('is-exiting');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 450);
  }

  /**
   * Terapkan setelan hasil resolusi.
   *
   * @param {object}  next       setelan hasil resolveSettings
   * @param {boolean} firstPaint true saat boot (belum ada pesan yang bisa hilang)
   */
  function applySettings(next, firstPaint) {
    var previous = settings;
    var structural = firstPaint || !previous || Settings.structuralChanged(previous, next);
    var changed = previous ? Settings.changedKeys(previous, next) : ['(init)'];

    settings = next;
    syncContext();
    applyCssVariables();
    applyCanvasClasses();

    if (structural) {
      loadThemePlugin(settings.theme, function () {
        rebuildDom();
      });
    } else if (changed.length > 0) {
      // Kosmetik: rebuild DOM agar inline style tiap pesan ikut berubah.
      // Tidak ada reload, tidak ada kedipan, chat tetap di tempatnya.
      rebuildDom();
      console.log('[KY-Poni Core] Preferensi tampilan diperbarui tanpa reload:', changed.join(', '));
    }
  }

  // ---------------------------------------------------------------- retensi & auto-hide

  function removeOldest() {
    var oldest = visible.shift();
    if (oldest && oldest.el) animateAndRemove(oldest.el);
  }

  /**
   * Satu penyapu untuk auto-hide + retention guard.
   *
   * Versi lama memasang setTimeout per pesan. Dengan rebuild DOM, timer per pesan
   * menjadi rapuh (closure menunjuk elemen yang sudah dibuang). Penyapu berbasis
   * timestamp kebal terhadap rebuild.
   */
  function sweep() {
    if (!settings) return;

    var now = Date.now();

    // 1. Batas maksimum pesan yang boleh tampil bersamaan.
    while (visible.length > settings.max) {
      removeOldest();
    }

    if (settings.fade <= 0) return;

    // 2. Buang pesan kedaluwarsa selama masih di atas jatah "tahan N pesan".
    var excess = visible.length - settings.keep;
    while (excess > 0) {
      var oldest = visible[0];
      if (!oldest || oldest.expiresAt > now) break;
      removeOldest();
      excess--;
    }
  }

  // ---------------------------------------------------------------- ingest pesan

  function appendChatMessage(item) {
    if (!settings) return;
    if (!item) return;

    while (visible.length >= settings.max) {
      removeOldest();
    }

    var el = buildEntry(item);
    if (!el) return;

    if (isPrependFlow()) {
      flow.prepend(el);
    } else {
      flow.appendChild(el);
    }

    visible.push({
      item: item,
      expiresAt: settings.fade > 0 ? Date.now() + settings.fade * 1000 : Infinity,
      el: el,
    });

    sweep();
    scrollToAnchor();
  }

  function handleIncoming(item) {
    if (!ready) {
      // Buffer singkat: pesan yang datang sebelum config resolve tidak boleh dirender
      // dengan renderer fallback lalu berganti tema di tengah jalan (terlihat sebagai
      // kedipan balon chat generik di antara balon tema).
      pending.push(item);
      return;
    }
    appendChatMessage(item);
  }

  function flushPending() {
    var queued = pending;
    pending = [];
    for (var i = 0; i < queued.length; i++) {
      appendChatMessage(queued[i]);
    }
  }

  // ---------------------------------------------------------------- WebSocket

  function connectWebSocket() {
    var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(protocol + '//' + window.location.host + '/ws');

    ws.onopen = function () {
      console.log('[KY-Poni Core Overlay] Connected to WebSocket broadcaster.');
      ws.send(JSON.stringify({
        type: 'REGISTER_OVERLAY',
        theme: settings ? settings.theme : null,
        layout: settings ? settings.layout : null,
        pos: settings ? settings.pos : null,
        preview: isPreview,
      }));

      // Sambung ulang setelah putus: ambil config terkini, karena broadcast yang
      // terlewat selama koneksi mati tidak akan dikirim ulang oleh server.
      if (hasConnectedOnce) {
        fetchConfig(4000).then(function (cfg) {
          if (!cfg) return;
          writeCache(cfg);
          applySettings(resolve(cfg), false);
        });
      }
      hasConnectedOnce = true;
    };

    ws.onmessage = function (event) {
      var payload;
      try {
        payload = JSON.parse(event.data);
      } catch (e) {
        console.error('[KY-Poni Core Overlay] Error parsing WS event:', e);
        return;
      }

      if (payload.type === 'CHAT_MESSAGE') {
        handleIncoming(payload.data);
        return;
      }

      if (payload.type === 'CONFIG_UPDATED') {
        // Iframe preview sudah dimuat ulang oleh dashboard dengan URL berparameter.
        // Kalau ia juga bereaksi pada broadcast, ia akan reload dirinya sendiri di
        // tengah orang menggeser slider — kedipan yang tidak perlu.
        if (isPreview) return;

        var nextConfig = payload.config || {};
        writeCache(nextConfig);

        var next = resolve(nextConfig);
        if (!settings) {
          applySettings(next, true);
          return;
        }

        if (Settings.structuralChanged(settings, next)) {
          // Tema/layout/posisi mengubah cara kanvas dibangun (arah aliran, transform
          // origin, plugin renderer). Memuat ulang halaman jauh lebih aman daripada
          // membangun ulang di tempat, dan ini perilaku yang dipilih.
          console.log('[KY-Poni Core] Perubahan struktural terdeteksi — memuat ulang overlay.');
          window.location.reload();
          return;
        }

        applySettings(next, false);
      }
    };

    ws.onclose = function () {
      console.warn('[KY-Poni Core Overlay] Connection closed. Reconnecting in 3s...');
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = function (err) {
      console.error('[KY-Poni Core Overlay] WS error:', err);
      try { ws.close(); } catch (e) { /* ignore */ }
    };
  }

  // ---------------------------------------------------------------- boot

  function markReady() {
    ready = true;
    flushPending();
  }

  function retryConfig() {
    if (configRetryTimer) clearTimeout(configRetryTimer);
    configRetryTimer = setTimeout(function () {
      fetchConfig(4000).then(function (cfg) {
        if (!cfg) {
          retryConfig();
          return;
        }
        writeCache(cfg);
        applySettings(resolve(cfg), false);
      });
    }, 3000);
  }

  function boot() {
    canvas = document.getElementById('chat-canvas');
    flow = document.getElementById('chat-flow') || canvas;
    if (!canvas || !flow) return;

    sweepTimer = setInterval(sweep, 500);

    // Config lokal dijawab dalam hitungan milidetik. Menunggu sebentar lebih baik
    // daripada melukis dulu dengan default lalu berganti tema di depan penonton.
    fetchConfig(1500).then(function (cfg) {
      if (cfg) {
        writeCache(cfg);
        applySettings(resolve(cfg), true);
        markReady();
        return;
      }

      var cached = readCache();
      if (cached) {
        applySettings(resolve(cached), true);
        console.warn('[KY-Poni Core] Server belum menjawab. Memakai setelan cache terakhir.');
      } else {
        applySettings(resolve(null), true);
        console.warn('[KY-Poni Core] Server belum menjawab dan belum ada cache. Memakai default.');
      }
      markReady();
      retryConfig();
    });

    connectWebSocket();

    // Demo/test seed via ?test=p5 or ?demo=1
    if (urlParams.get('test') === 'p5' || urlParams.get('demo') === '1') {
      setTimeout(function () {
        appendChatMessage({ id: 'test-1', author: { name: 'Sae' }, message: 'The P5 Generator rocks, baby!' });
        appendChatMessage({ id: 'test-2', author: { name: 'Ren' }, message: "I should write something. I'll just add this." });
        appendChatMessage({ id: 'test-3', author: { name: 'Joker' }, message: 'Take your time.' });
      }, 600);
    }
  }

  boot();
})();
