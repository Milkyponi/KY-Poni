/**
 * KY-Poni - YouTube Target Classification
 *
 * Modul ini adalah SATU-SATUNYA tempat yang memutuskan "input pengguna ini sebenarnya apa".
 *
 * Kenapa dipisah dari youtube_ingest.js:
 *   Bug v1.0.1 lahir dari parser yang menebak urutan salah. `channel/UC...`, `youtu.be/x`,
 *   `/c/`, dan `/user/` semuanya jatuh ke fallback "anggap handle", sehingga aplikasi
 *   menembak `https://www.youtube.com/@https://youtu.be/x/live` (HTTP 404) lalu menampilkan
 *   pesan menyesatkan "Pastikan channel sedang live streaming" padahal channel-nya sedang live.
 *
 * Prinsip modul ini:
 *   1. Klasifikasi URL SELALU mendahului klasifikasi handle. Sebuah URL tidak pernah boleh
 *      diperlakukan sebagai handle, apa pun isinya.
 *   2. Normalisasi skema dilakukan sendiri. `www.youtube.com/@x/live` tanpa skema TIDAK boleh
 *      dikirim mentah ke YouTube — diuji: itu di-resolve sebagai path relatif dan menghasilkan
 *      channel yang sama sekali berbeda.
 *   3. Zero dependency. Hanya `URL` bawaan Node, supaya modul ini bisa dites tanpa jaringan.
 *
 * Modul ini tidak melakukan I/O jaringan. Resolusi jaringan ada di youtube_resolver.js.
 */

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;
// Handle resmi: 3-30 karakter, huruf/angka/titik/garis bawah/tanpa strip di ujung.
const HANDLE_RE = /^@[A-Za-z0-9_.-]{3,30}$/;

/** Path segmen pertama yang menandakan "ini URL, jangan pernah dianggap handle polos". */
const URL_LIKE_RE = /^(?:https?:\/\/|www\.|m\.|youtu\.be\/|youtube\.com\/|youtube-nocookie\.com\/)/i;

function isYouTubeHost(hostname) {
  return YOUTUBE_HOSTS.has(String(hostname || '').toLowerCase());
}

/**
 * Tambahkan skema bila input mirip URL tapi belum punya.
 * Mengembalikan null bila input bukan URL sama sekali.
 */
function normalizeUrl(input) {
  const clean = String(input || '').trim();
  if (!clean) return null;
  if (/^https?:\/\//i.test(clean)) {
    try { return new URL(clean); } catch (e) { return null; }
  }
  if (!URL_LIKE_RE.test(clean)) return null;
  try {
    const withScheme = new URL('https://' + clean.replace(/^\/+/, ''));
    return isYouTubeHost(withScheme.hostname) ? withScheme : null;
  } catch (e) {
    return null;
  }
}

/**
 * Ambil segmen path yang bermakna, buang segmen kosong dan parameter.
 * Contoh: '/@LofiGirl/live' -> ['@LofiGirl', 'live']
 */
function pathSegments(url) {
  return String(url.pathname || '')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
}

function stripHandlePrefix(value) {
  return String(value || '').trim().replace(/^@+/, '');
}

/**
 * Klasifikasi input pengguna menjadi deskriptor yang tidak ambigu.
 *
 * @param {string} input apa pun yang diketik/ditempel streamer
 * @returns {null | {
 *   kind: 'video' | 'channelId' | 'handle' | 'remote',
 *   videoId?: string,
 *   channelId?: string,
 *   handle?: string,
 *   resolveUrl?: string,
 *   raw: string
 * }}
 *   `remote` berarti URL YouTube yang sah tetapi identitas kanalnya hanya bisa diketahui
 *   lewat jaringan (format legacy /c/Nama dan /user/Nama, plus /streams dan sejenisnya).
 */
function classify(input) {
  if (typeof input !== 'string') return null;
  const clean = input.trim();
  if (!clean) return null;
  if (clean.length > 512) return null; // jauh di luar panjang URL/handle yang wajar

  // ── 1. URL ────────────────────────────────────────────────────────────────────
  // WAJIB diperiksa lebih dulu. Kalau tidak, '@' di dalam URL akan tertangkap sebagai handle.
  const url = normalizeUrl(clean);
  if (url) {
    if (!isYouTubeHost(url.hostname)) return null;
    const host = url.hostname.toLowerCase();
    const seg = pathSegments(url);

    // youtu.be/<id>
    if (host === 'youtu.be' || host === 'www.youtu.be') {
      const id = seg[0];
      if (id && VIDEO_ID_RE.test(id)) {
        return { kind: 'video', videoId: id, raw: clean };
      }
      return null;
    }

    // /watch?v=<id>
    if (seg[0] === 'watch') {
      const v = url.searchParams.get('v');
      if (v && VIDEO_ID_RE.test(v)) {
        return { kind: 'video', videoId: v, raw: clean };
      }
      return null;
    }

    // /live/<id>  dan  /shorts/<id>  dan  /embed/<id>  dan  /v/<id>
    if (['live', 'shorts', 'embed', 'v'].includes(seg[0])) {
      const id = seg[1];
      if (id && VIDEO_ID_RE.test(id)) {
        return { kind: 'video', videoId: id, raw: clean };
      }
      // '/live' tanpa id bukan target yang sah; jangan menebak.
      return null;
    }

    // /channel/<UC...>  (boleh diikuti /live, /streams, /videos, /featured)
    if (seg[0] === 'channel') {
      const id = seg[1];
      if (id && CHANNEL_ID_RE.test(id)) {
        return { kind: 'channelId', channelId: id, raw: clean };
      }
      return null;
    }

    // /@handle  (boleh diikuti /live, /streams, /videos)
    if (seg[0] && seg[0].startsWith('@')) {
      const handle = '@' + stripHandlePrefix(seg[0]);
      if (HANDLE_RE.test(handle)) {
        return { kind: 'handle', handle, raw: clean };
      }
      return null;
    }

    // /c/Nama dan /user/Nama: identitas kanal hanya bisa dipastikan via jaringan.
    // Tetap dianggap sah sebagai bentuk URL, tetapi belum bisa dipakai konek tanpa resolve.
    if (seg[0] === 'c' || seg[0] === 'user' || seg[0] === 'custom') {
      const name = seg[1];
      if (name && name.length <= 100) {
        return { kind: 'remote', resolveUrl: url.toString(), raw: clean };
      }
      return null;
    }

    // URL YouTube sah tetapi tidak dikenali bentuknya (mis. /playlist, /results).
    // Jangan menebak — lebih jujur menolak dengan pesan jelas.
    return null;
  }

  // ── 2. Bentuk non-URL ─────────────────────────────────────────────────────────
  const bare = clean.replace(/\s+/g, '');

  // @handle
  if (bare.startsWith('@')) {
    return HANDLE_RE.test(bare) ? { kind: 'handle', handle: bare, raw: clean } : null;
  }

  // Channel ID mentah
  if (CHANNEL_ID_RE.test(bare)) {
    return { kind: 'channelId', channelId: bare, raw: clean };
  }

  // Upaya mengetik Channel ID yang terpotong/salah ("UC" + sekumpulan karakter, tapi
  // bukan 24 karakter yang sah) TIDAK boleh jatuh ke jalur handle. Kalau dibiarkan,
  // pengguna akan melihat "kanal tidak ditemukan" padahal masalahnya ID-nya kepotong.
  if (/^UC/i.test(bare) && bare.length >= 20) {
    return null;
  }

  // Video ID mentah (11 karakter)
  if (VIDEO_ID_RE.test(bare)) {
    return { kind: 'video', videoId: bare, raw: clean };
  }

  // Handle tanpa '@' — perilaku lama yang dipertahankan: "MilkyPoni" -> "@MilkyPoni".
  // Dibatasi karakter handle agar sampah seperti "bukan url sama sekali" tidak lolos.
  if (/^[A-Za-z0-9_.-]{3,30}$/.test(bare)) {
    return { kind: 'handle', handle: '@' + bare, raw: clean };
  }

  return null;
}

/**
 * URL probe yang dipakai untuk menanyakan status live ke YouTube.
 * Hanya menerima deskriptor hasil classify().
 */
function buildProbeUrl(descriptor) {
  if (!descriptor) return null;
  switch (descriptor.kind) {
    case 'video':
      return `https://www.youtube.com/watch?v=${descriptor.videoId}`;
    case 'channelId':
      return `https://www.youtube.com/channel/${descriptor.channelId}/live`;
    case 'handle':
      return `https://www.youtube.com/${descriptor.handle}/live`;
    case 'remote':
      return descriptor.resolveUrl;
    default:
      return null;
  }
}

/**
 * Terjemahkan deskriptor ke opsi yang diterima pustaka `youtube-chat`.
 * `remote` belum bisa diterjemahkan sebelum di-resolve lewat jaringan.
 */
function toLiveChatTarget(descriptor) {
  if (!descriptor) return null;
  switch (descriptor.kind) {
    case 'video':
      return { liveId: descriptor.videoId };
    case 'channelId':
      return { channelId: descriptor.channelId };
    case 'handle':
      return { handle: descriptor.handle };
    default:
      return null;
  }
}

/** Deskripsi manusia untuk ditampilkan di dashboard. */
function describeTarget(descriptor) {
  if (!descriptor) return 'tidak dikenal';
  switch (descriptor.kind) {
    case 'video':
      return `video ${descriptor.videoId}`;
    case 'channelId':
      return `channel ${descriptor.channelId}`;
    case 'handle':
      return `kanal ${descriptor.handle}`;
    case 'remote':
      return `kanal dari ${descriptor.resolveUrl}`;
    default:
      return 'tidak dikenal';
  }
}

module.exports = {
  classify,
  buildProbeUrl,
  toLiveChatTarget,
  describeTarget,
  normalizeUrl,
  isYouTubeHost,
  YOUTUBE_HOSTS,
  VIDEO_ID_RE,
  CHANNEL_ID_RE,
  HANDLE_RE,
};
