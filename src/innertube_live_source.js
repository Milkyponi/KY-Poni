/**
 * KY-Poni - InnerTube Live Chat Source (compatibility shim)
 *
 * MASALAH YANG DISELESAIKAN
 * -------------------------
 * Pustaka `youtube-chat` (v2.2.0, rilis terakhir November 2022) menemukan videoId
 * siaran dengan membaca tag di HTML:
 *
 *   <link rel="canonical" href="https://www.youtube.com/watch?v=<ID>">
 *
 * Sejak sekitar November 2026 YouTube menyajikan tag itu dengan isi literal "undefined":
 *
 *   <link rel="canonical" href="undefined">
 *
 * Diverifikasi 8/8 percobaan berurutan gagal, pada tiga URL berbeda (watch, /live, /@handle/live).
 * Karena tag itu satu-satunya sumber liveId bagi pustaka, SELURUH jalur koneksi (handle,
 * channelId, liveId) gagal dengan pesan "Live Stream was not found" — termasuk untuk siaran
 * yang benar-benar sedang live. Artinya versi yang sudah dirilis ke publik (v1.0.1) ikut mati,
 * bukan hanya build pengembangan.
 *
 * Pustaka ini tidak akan diperbaiki upstream (tidak ada rilis sejak 2022), jadi perbaikan
 * harus ada di sisi aplikasi.
 *
 * PENDEKATAN
 * ----------
 * Hanya SATU fungsi yang diganti: `fetchLivePage` — pengambil opsi awal. Fungsi lain
 * (`fetchChat` dan seluruh parser actions/badges/superchat) tetap milik pustaka, karena
 * format respons `live_chat/get_live_chat` tidak berubah dan masih bekerja.
 *
 * Penggantinya memakai endpoint publik YouTube, tanpa scraping HTML dan tanpa kredensial:
 *   1. POST /youtubei/v1/navigation/resolve_url  → videoId siaran yang sedang aktif
 *   2. POST /youtubei/v1/next?key=<public web key> → continuation token live chat
 *
 * Diverifikasi end-to-end: 47 pesan ditarik dari satu respons, lalu pesan baru terus
 * mengalir lewat LiveChat seperti biasa.
 */

const axios = require('axios');
const { classify } = require('./youtube_target');

const INNERTUBE_BASE = 'https://www.youtube.com/youtubei/v1';
// Client key publik milik web player YouTube. Ini BUKAN kredensial rahasia pengembang —
// nilainya sama untuk siapa pun yang membuka youtube.com, dan tidak terikat akun.
const WEB_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const WEB_CLIENT_VERSION = '2.20240101.00.00';
const CONTEXT = {
  client: { clientName: 'WEB', clientVersion: WEB_CLIENT_VERSION, hl: 'en', gl: 'US' },
};

const DEFAULT_TIMEOUT = 15000;

/**
 * Cari videoId siaran aktif dari sebuah target.
 *
 * Pustaka youtube-chat memanggil `fetchLivePage({ channelId })`, `{ handle }`, atau
 * `{ liveId }` — bukan string. Karena itu fungsi ini menerima KEDUA bentuk: string apa
 * adanya dari pengguna, maupun objek descriptor milik pustaka.
 *
 * Mengembalikan null bila kanal sedang tidak menyiarkan.
 */
async function resolveActiveVideoId(target, options = {}) {
  const descriptor = resolveDescriptor(target);
  if (!descriptor) return null;

  // Bila target sudah berupa video, tidak perlu bertanya lagi.
  if (descriptor.kind === 'video') return descriptor.videoId;

  let probeUrl;
  if (descriptor.kind === 'channelId') {
    probeUrl = `https://www.youtube.com/channel/${descriptor.channelId}/live`;
  } else if (descriptor.kind === 'handle') {
    probeUrl = `https://www.youtube.com/${descriptor.handle}/live`;
  } else if (descriptor.kind === 'remote') {
    probeUrl = descriptor.resolveUrl;
  } else {
    return null;
  }

  const post = options.post || ((url, body, cfg) => axios.post(url, body, cfg));
  const res = await post(
    `${INNERTUBE_BASE}/navigation/resolve_url`,
    { context: CONTEXT, url: probeUrl },
    {
      timeout: options.timeout || DEFAULT_TIMEOUT,
      validateStatus: () => true,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (res.status !== 200) return null;
  const endpoint = (res.data && res.data.endpoint) || {};
  return (endpoint.watchEndpoint && endpoint.watchEndpoint.videoId) || null;
}

/**
 * Terima string target maupun objek descriptor pustaka dan kembalikan descriptor seragam.
 */
function resolveDescriptor(target) {
  if (!target) return null;

  // Bentuk objek milik youtube-chat: { channelId } | { handle } | { liveId }
  if (typeof target === 'object') {
    if (target.liveId) return { kind: 'video', videoId: target.liveId, raw: target.liveId };
    if (target.channelId) return { kind: 'channelId', channelId: target.channelId, raw: target.channelId };
    if (target.handle) {
      const handle = target.handle.startsWith('@') ? target.handle : '@' + target.handle;
      return { kind: 'handle', handle, raw: handle };
    }
    return null;
  }

  return classify(target);
}

/**
 * Ambil opsi yang dibutuhkan LiveChat: liveId, apiKey, clientVersion, continuation.
 * Melempar Error dengan pesan yang sama seperti pustaka agar pemanggil lama tetap kompatibel.
 */
async function fetchLiveChatOptions(target, options = {}) {
  const post = options.post || ((url, body, cfg) => axios.post(url, body, cfg));
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  const videoId = await resolveActiveVideoId(target, { post, timeout });
  if (!videoId) {
    throw new Error('Live Stream was not found');
  }

  const res = await post(
    `${INNERTUBE_BASE}/next?key=${WEB_API_KEY}`,
    { context: CONTEXT, videoId },
    {
      timeout,
      validateStatus: () => true,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (res.status !== 200) {
    throw new Error(`Live chat tidak dapat dibuka (HTTP ${res.status}).`);
  }

  const raw = JSON.stringify(res.data || {});
  const match = raw.match(/"continuation":"([^"]{40,})"/);
  if (!match) {
    // Terjadi bila live chat dimatikan pada siaran tersebut.
    throw new Error('Live chat tidak tersedia untuk siaran ini (fitur chat mungkin dinonaktifkan).');
  }

  return {
    liveId: videoId,
    apiKey: WEB_API_KEY,
    clientVersion: WEB_CLIENT_VERSION,
    continuation: match[1],
  };
}

let shimInstalled = false;

/**
 * Pasang pengganti `fetchLivePage` pada pustaka youtube-chat.
 *
 * Idempotent dan aman dipanggil berkali-kali. Gagal secara senyap (dengan peringatan)
 * bila struktur internal pustaka berubah, supaya aplikasi tidak ikut mati karena shim.
 */
function installLiveChatShim() {
  if (shimInstalled) return true;
  try {
    const requests = require('youtube-chat/dist/requests');
    if (typeof requests.fetchLivePage !== 'function') {
      console.warn('[KY-Poni Compat] Struktur youtube-chat tak terduga; shim dilewati.');
      return false;
    }
    requests.fetchLivePage = (id) => fetchLiveChatOptions(id);
    shimInstalled = true;
    console.log('[KY-Poni Compat] fetchLivePage diganti jalur InnerTube (tag canonical YouTube rusak).');
    return true;
  } catch (err) {
    console.warn('[KY-Poni Compat] Gagal memasang shim:', err.message);
    return false;
  }
}

module.exports = {
  installLiveChatShim,
  fetchLiveChatOptions,
  resolveActiveVideoId,
  resolveDescriptor,
  WEB_API_KEY,
  WEB_CLIENT_VERSION,
  INNERTUBE_BASE,
};
