/**
 * KY-Poni - YouTube Live Resolver (zero-credential)
 *
 * Menjawab satu pertanyaan: "kanal/video ini sedang live, offline, atau tidak ada?"
 *
 * Memakai endpoint publik milik YouTube sendiri:
 *   POST https://www.youtube.com/youtubei/v1/navigation/resolve_url
 *
 * Kenapa endpoint ini dan bukan API resmi:
 *   - Tidak butuh OAuth, tidak butuh API key Google Cloud. Diuji: request TANPA parameter
 *     `key` sama sekali tetap dijawab HTTP 200 dengan payload yang sama.
 *   - Tidak memotong kuota YouTube Data API (10.000 unit/hari PER PROJECT, bukan per pengguna).
 *   - Payload ~1 KB dan ~100 ms, versus ~1,5 MB bila mengambil halaman HTML penuh.
 *
 * Kenapa bukan GET halaman HTML:
 *   Halaman /@handle/live mengembalikan 1,4-1,6 MB per pemeriksaan. Untuk pemantauan
 *   berkala itu pemborosan bandwidth pengguna tanpa manfaat tambahan.
 *
 * Batasan yang ditemukan lewat pengujian dan HARUS dihormati pemanggil:
 *   - `watch?v=<id>` SELALU di-resolve ke watchEndpoint, bahkan untuk video yang sudah
 *     selesai atau ID sampah. Jadi endpoint ini TIDAK memverifikasi status live sebuah video.
 *     Untuk target berbentuk video, keaktifan diverifikasi oleh pustaka youtube-chat saat konek.
 *   - `/@handle/live` saat offline di-resolve ke browseEndpoint (kanal), bukan watchEndpoint.
 *     Perbedaan bentuk endpoint inilah yang menjadi sinyal live/offline yang andal.
 */

const axios = require('axios');
const { classify, buildProbeUrl } = require('./youtube_target');

const RESOLVE_ENDPOINT = 'https://www.youtube.com/youtubei/v1/navigation/resolve_url';
const DEFAULT_TIMEOUT_MS = 10000;

// Client context minimum yang diterima endpoint. Nilai ini bagian dari protokol publik
// YouTube, bukan kredensial — tidak ada rahasia yang tersimpan di biner.
const WEB_CONTEXT = {
  client: {
    clientName: 'WEB',
    clientVersion: '2.20240101.00.00',
    hl: 'en',
    gl: 'US',
  },
};

class YouTubeResolver {
  constructor(options = {}) {
    this.timeout = options.timeout || DEFAULT_TIMEOUT_MS;
    this.post = options.post || ((url, body, cfg) => axios.post(url, body, cfg));
  }

  /**
   * @param {string} target input apa adanya dari pengguna
   * @returns {Promise<{
   *   ok: boolean,
   *   state?: 'live' | 'offline' | 'not_found' | 'unknown',
   *   descriptor?: object,
   *   videoId?: string|null,
   *   channelId?: string|null,
   *   reason?: string
   * }>}
   */
  async probe(target) {
    const descriptor = classify(target);
    if (!descriptor) {
      return {
        ok: false,
        state: 'not_found',
        reason: 'Format target tidak dikenali. Gunakan @handle, Channel ID (UC...), atau URL YouTube.',
      };
    }

    const probeUrl = buildProbeUrl(descriptor);
    if (!probeUrl) {
      return { ok: false, state: 'not_found', descriptor, reason: 'Target tidak dapat diperiksa.' };
    }

    // Bentuk legacy (/c/Nama, /user/Nama) hanya memberi tahu IDENTITAS kanal, bukan status
    // live-nya. Diuji: '/c/LofiGirl' resolve ke browseEndpoint (dianggap offline) padahal kanal
    // itu sedang live. Jadi identitas di-resolve lebih dulu, lalu status live ditanyakan lewat
    // URL kanal yang sebenarnya. Ini juga yang membuat '/user/Nama' aman: nama lama bisa sudah
    // dimiliki kanal lain (diuji: /user/LofiGirl bukan kanal LofiGirl).
    if (descriptor.kind === 'remote') {
      const identity = await this.postResolve(probeUrl);
      if (!identity.ok) return { ...identity, descriptor };

      if (!identity.channelId) {
        if (identity.videoId) {
          return {
            ok: true,
            state: 'unknown',
            descriptor,
            videoId: identity.videoId,
            channelId: null,
            reason: 'Target berupa video; status live dipastikan saat menghubungkan chat.',
          };
        }
        return {
          ok: false,
          state: 'not_found',
          descriptor,
          reason: 'Kanal tidak dapat diterjemahkan dari URL tersebut.',
        };
      }

      const viaChannel = await this.postResolve(
        `https://www.youtube.com/channel/${identity.channelId}/live`
      );
      if (!viaChannel.ok) {
        // Identitas sudah diketahui walau status live gagal diperiksa: laporkan offline
        // beserta channelId supaya pemanggil tetap bisa menyimpan kanal yang benar.
        return { ok: true, state: 'offline', descriptor, videoId: null, channelId: identity.channelId };
      }

      return {
        ok: true,
        state: viaChannel.videoId ? 'live' : 'offline',
        descriptor,
        videoId: viaChannel.videoId || null,
        channelId: identity.channelId,
      };
    }

    const resolved = await this.postResolve(probeUrl);
    if (!resolved.ok) return { ...resolved, descriptor };

    const { videoId, channelId } = resolved;

    // Target berbentuk video: endpoint tidak bisa memastikan status live.
    if (descriptor.kind === 'video') {
      return {
        ok: true,
        state: 'unknown',
        descriptor,
        videoId: videoId || descriptor.videoId,
        channelId,
        reason: 'Target berupa video; status live dipastikan saat menghubungkan chat.',
      };
    }

    if (videoId) {
      return { ok: true, state: 'live', descriptor, videoId, channelId };
    }

    if (channelId) {
      return { ok: true, state: 'offline', descriptor, videoId: null, channelId };
    }

    return {
      ok: true,
      state: 'unknown',
      descriptor,
      videoId: null,
      channelId: null,
      reason: 'YouTube tidak memberi informasi kanal maupun live.',
    };
  }

  /**
   * Satu panggilan ke endpoint resolve_url. Mengembalikan bentuk yang sudah dinormalisasi
   * supaya probe() tidak perlu mengulang penanganan HTTP.
   */
  async postResolve(probeUrl) {
    let res;
    try {
      res = await this.post(
        RESOLVE_ENDPOINT,
        { context: WEB_CONTEXT, url: probeUrl },
        {
          timeout: this.timeout,
          validateStatus: () => true,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (err) {
      // Gangguan jaringan bukan berarti kanal tidak ada. Bedakan supaya pemanggil
      // tidak menampilkan "kanal tidak ditemukan" saat Wi-Fi streamer putus.
      return { ok: false, state: 'unknown', reason: `Tidak dapat menghubungi YouTube: ${err.message}` };
    }

    if (res.status === 404) {
      return { ok: false, state: 'not_found', reason: 'Kanal atau video tidak ditemukan di YouTube.' };
    }

    if (res.status !== 200) {
      return { ok: false, state: 'unknown', reason: `YouTube membalas HTTP ${res.status}.` };
    }

    const endpoint = (res.data && res.data.endpoint) || {};
    const watch = endpoint.watchEndpoint || null;
    const browse = endpoint.browseEndpoint || null;

    return {
      ok: true,
      videoId: (watch && watch.videoId) || null,
      channelId: (browse && browse.browseId) || null,
    };
  }

  /**
   * Ubah target `remote` (/c/Nama, /user/Nama) menjadi deskriptor yang bisa dipakai
   * pustaka youtube-chat. Untuk bentuk lain, cukup kembalikan hasil classify().
   */
  async normalize(target) {
    const descriptor = classify(target);
    if (!descriptor) {
      return { ok: false, reason: 'Format target tidak dikenali.' };
    }
    if (descriptor.kind !== 'remote') {
      return { ok: true, descriptor };
    }

    const probe = await this.probe(target);
    if (probe.channelId) {
      return { ok: true, descriptor: { kind: 'channelId', channelId: probe.channelId, raw: target } };
    }
    if (probe.videoId) {
      return { ok: true, descriptor: { kind: 'video', videoId: probe.videoId, raw: target } };
    }
    return { ok: false, reason: probe.reason || 'Kanal tidak dapat diterjemahkan.' };
  }
}

module.exports = { YouTubeResolver, RESOLVE_ENDPOINT, WEB_CONTEXT };
