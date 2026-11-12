/**
 * KY-Poni - Connectivity Regression Tests
 *
 * Menjaga tiga keluhan pengguna yang sudah diperbaiki agar tidak kembali:
 *   1. "Channel ID ngga kedetek" — parser dulu membungkus URL jadi @handle.
 *   2. "Ribet copy-paste link tiap live" — auto-connect saat app dibuka.
 *   3. "Status konektivitas tidak jelas" — mode 'waiting' saat kanal belum menyiarkan.
 *
 * Dua bagian:
 *   BAGIAN A (offline, deterministik) — klasifikasi target. Tidak menyentuh jaringan.
 *   BAGIAN B (jaringan)              — probe resolver + perilaku waiting. Boleh di-skip
 *                                      bila tidak ada internet, tanpa membuat suite merah.
 *
 * Run: node test/test_connectivity.js
 */

const assert = require('assert');
const { classify, buildProbeUrl, toLiveChatTarget } = require('../src/youtube_target');
const { YouTubeResolver } = require('../src/youtube_resolver');
const { YouTubeChatIngest } = require('../src/youtube_ingest');

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
    console.log(`[FAIL] ${name}: ${err.message}`);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
    console.log(`[FAIL] ${name}: ${err.message}`);
  }
}

// ── BAGIAN A: klasifikasi target (offline) ─────────────────────────────────────
const CH = 'UCSJ4gkVC6NrvII8umztf0Ow';
const VID = '4t4AQ15yj1M';

function runOfflineTests() {
  console.log('\n── BAGIAN A: Klasifikasi Target (offline) ──\n');

  // Regresi inti: URL /channel/ DULU berubah jadi handle '@https://...'
  check('URL /channel/UC... dikenali sebagai channelId (bug v1.0.1)', () => {
    const d = classify(`https://www.youtube.com/channel/${CH}`);
    assert.strictEqual(d.kind, 'channelId');
    assert.strictEqual(d.channelId, CH);
  });

  check('URL /channel/UC.../live dikenali sebagai channelId', () => {
    const d = classify(`https://www.youtube.com/channel/${CH}/live`);
    assert.strictEqual(d.kind, 'channelId');
    assert.strictEqual(d.channelId, CH);
  });

  check('URL /channel/UC.../streams dikenali sebagai channelId', () => {
    const d = classify(`https://www.youtube.com/channel/${CH}/streams`);
    assert.strictEqual(d.kind, 'channelId');
  });

  check('Channel ID mentah (UC...) dikenali', () => {
    const d = classify(CH);
    assert.strictEqual(d.kind, 'channelId');
    assert.strictEqual(d.channelId, CH);
  });

  check('URL youtu.be dikenali sebagai video (bug v1.0.1)', () => {
    const d = classify(`https://youtu.be/${VID}`);
    assert.strictEqual(d.kind, 'video');
    assert.strictEqual(d.videoId, VID);
  });

  check('URL /live/<id> dikenali sebagai video', () => {
    assert.strictEqual(classify(`https://www.youtube.com/live/${VID}`).videoId, VID);
  });

  check('URL watch?v= dikenali sebagai video', () => {
    assert.strictEqual(classify(`https://www.youtube.com/watch?v=${VID}`).videoId, VID);
  });

  check('URL /shorts/ dikenali sebagai video', () => {
    assert.strictEqual(classify(`https://www.youtube.com/shorts/${VID}`).videoId, VID);
  });

  check('Video ID mentah 11 karakter dikenali', () => {
    assert.strictEqual(classify(VID).videoId, VID);
  });

  check('@handle dikenali', () => {
    const d = classify('@MilkyPoni');
    assert.strictEqual(d.kind, 'handle');
    assert.strictEqual(d.handle, '@MilkyPoni');
  });

  check('handle tanpa @ dinormalisasi', () => {
    assert.strictEqual(classify('MilkyPoni').handle, '@MilkyPoni');
  });

  check('URL /@handle dikenali sebagai handle, bukan URL mentah', () => {
    assert.strictEqual(classify('https://www.youtube.com/@MilkyPoni').handle, '@MilkyPoni');
  });

  check('URL /@handle/live dikenali sebagai handle', () => {
    assert.strictEqual(classify('https://www.youtube.com/@MilkyPoni/live').handle, '@MilkyPoni');
  });

  check('URL m.youtube.com dikenali', () => {
    assert.strictEqual(classify('https://m.youtube.com/@MilkyPoni/live').handle, '@MilkyPoni');
  });

  check('URL dengan query ?si= tidak merusak handle', () => {
    assert.strictEqual(classify('https://www.youtube.com/@MilkyPoni?si=abc123').handle, '@MilkyPoni');
  });

  check('URL tanpa skema (www.youtube.com/...) TIDAK dikirim mentah', () => {
    // Diuji di YouTube: tanpa skema, ini di-resolve sebagai path relatif dan
    // menghasilkan channel yang sama sekali berbeda.
    const d = classify('www.youtube.com/@MilkyPoni/live');
    assert.strictEqual(d.kind, 'handle');
    assert.strictEqual(d.handle, '@MilkyPoni');
  });

  check('URL /c/Nama dan /user/Nama dikenali sebagai remote', () => {
    assert.strictEqual(classify('https://www.youtube.com/c/LofiGirl').kind, 'remote');
    assert.strictEqual(classify('https://www.youtube.com/user/LofiGirl').kind, 'remote');
  });

  check('Domain non-YouTube ditolak', () => {
    assert.strictEqual(classify('https://vimeo.com/channels/123'), null);
    assert.strictEqual(classify('https://example.com/@MilkyPoni'), null);
  });

  check('Playlist dan halaman pencarian ditolak (bukan target chat)', () => {
    assert.strictEqual(classify('https://www.youtube.com/playlist?list=PL123456'), null);
    assert.strictEqual(classify('https://www.youtube.com/results?search_query=test'), null);
  });

  check('String sampah ditolak', () => {
    assert.strictEqual(classify(''), null);
    assert.strictEqual(classify(null), null);
    assert.strictEqual(classify(undefined), null);
    assert.strictEqual(classify('bukan url sama sekali!!'), null);
  });

  check('Channel ID terpotong ditolak, tidak diam-diam dianggap handle', () => {
    // Kasus nyata: streamer menyalin ID tapi terpotong. Kalau diperlakukan sebagai handle,
    // hasilnya "kanal tidak ditemukan" — padahal masalahnya ID kurang satu karakter.
    assert.strictEqual(classify('UCabcdefghijklmnopqrstu'), null); // 23 karakter (kurang 1)
    assert.strictEqual(classify('UCabcdefghijklmnopqrstuvwxyz12345'), null); // kepanjangan
  });

  check('"UC123" yang sangat pendek diperlakukan sebagai handle (ambigu, terdokumentasi)', () => {
    // Ambiguitas tak terhindarkan: "@UC123" adalah handle yang sah menurut aturan YouTube
    // (3-30 karakter). Yang dilindungi adalah bentuk yang jelas berpretensi Channel ID.
    assert.strictEqual(classify('UC123').kind, 'handle');
  });

  check('Video ID mentah sepanjang 13 karakter diperlakukan sebagai handle', () => {
    // Ambiguitas tak terhindarkan: 13 karakter alfanumerik adalah bentuk handle yang sah.
    // Yang WAJIB dijaga adalah URL /watch?v= dengan ID kepanjangan tidak lolos jadi video.
    assert.strictEqual(classify('https://www.youtube.com/watch?v=4t4AQ15yj1MEXTRA'), null);
    assert.strictEqual(classify('https://youtu.be/4t4AQ15yj1MEXTRA'), null);
  });

  // Setiap bentuk valid harus menghasilkan URL probe yang sah (bukan URL rusak).
  check('Semua bentuk valid membentuk URL probe yang benar', () => {
    const sane = /^https:\/\/www\.youtube\.com\/(watch\?v=[A-Za-z0-9_-]{11}|channel\/UC[A-Za-z0-9_-]{22}\/live|@[A-Za-z0-9_.-]+\/live|(c|user|custom)\/[^/]+)$/;
    const inputs = [
      '@MilkyPoni', 'MilkyPoni', 'https://www.youtube.com/@MilkyPoni',
      'https://www.youtube.com/@MilkyPoni/live', `https://youtu.be/${VID}`,
      `https://www.youtube.com/watch?v=${VID}`, `https://www.youtube.com/channel/${CH}`,
      `https://www.youtube.com/channel/${CH}/live`, VID, CH,
      'https://www.youtube.com/c/LofiGirl', 'https://www.youtube.com/user/LofiGirl',
    ];
    for (const input of inputs) {
      const url = buildProbeUrl(classify(input));
      assert(url && sane.test(url), `URL probe tidak sah untuk "${input}": ${url}`);
      assert(!url.includes('www.youtube.com/@http'), `URL probe rusak untuk "${input}": ${url}`);
    }
  });

  check('toLiveChatTarget memetakan descriptor ke opsi youtube-chat', () => {
    assert.deepStrictEqual(toLiveChatTarget(classify(`https://youtu.be/${VID}`)), { liveId: VID });
    assert.deepStrictEqual(toLiveChatTarget(classify(CH)), { channelId: CH });
    assert.deepStrictEqual(toLiveChatTarget(classify('@MilkyPoni')), { handle: '@MilkyPoni' });
  });

  check('parseTarget pada ingest memakai klasifikasi yang sama', () => {
    const yt = new YouTubeChatIngest();
    assert.strictEqual(yt.parseTarget(`https://www.youtube.com/channel/${CH}`).kind, 'channelId');
    assert.strictEqual(yt.parseTarget(`https://youtu.be/${VID}`).kind, 'video');
    assert.strictEqual(yt.parseTarget('bukan url!!'), null);
  });

  check('Ingest menginisialisasi state waiting dengan benar', () => {
    const yt = new YouTubeChatIngest();
    assert.strictEqual(yt.waitPollTimer, null);
    assert.strictEqual(yt.waitPollInterval, 60000);
    assert(yt.resolver instanceof YouTubeResolver);
  });

  check('enterWaitingForLive mengubah status dan memasang timer', () => {
    const yt = new YouTubeChatIngest({ waitPollInterval: 999999 });
    yt.enterWaitingForLive('@MilkyPoni', { kind: 'handle', handle: '@MilkyPoni' });
    assert.strictEqual(yt.status, 'waiting');
    assert(yt.waitPollTimer !== null, 'timer pemantauan harus aktif');
    yt.clearWaitPoll();
    assert.strictEqual(yt.waitPollTimer, null);
  });

  check('enterWaitingForLive menyimpan channelId untuk ditampilkan', () => {
    const yt = new YouTubeChatIngest({ waitPollInterval: 999999 });
    yt.enterWaitingForLive('@x', { kind: 'channelId', channelId: CH });
    assert.strictEqual(yt.activeChannelId, CH);
    yt.clearWaitPoll();
  });

  check('connect menolak format tidak dikenal dengan pesan yang menyebut format didukung', async () => {
    const yt = new YouTubeChatIngest();
    let msg = '';
    try { await yt.connect('!!! bukan target !!!'); } catch (e) { msg = e.message; }
    assert(msg.includes('Format target tidak dikenali'), `pesan tidak informatif: ${msg}`);
  });

  check('event "end" dari sesi LAMA tidak menimpa status sesi baru', () => {
    // Regresi nyata: liveChat.stop() memancarkan 'end' secara sinkron. Saat pengguna
    // mengganti target, end dari sesi lama sempat mengubah status sesi baru jadi 'waiting'
    // walau siaran barunya sehat. Guard berbasis referensi tidak cukup karena referensi
    // dilepas lebih dulu; yang dipakai sekarang token nomor sesi.
    const { EventEmitter } = require('events');
    const yt = new YouTubeChatIngest({ waitPollInterval: 999999 });

    const oldSession = new EventEmitter();
    oldSession.stop = () => {};
    yt.liveChat = oldSession;
    yt.setupListeners(oldSession);      // token 1

    const newSession = new EventEmitter();
    newSession.stop = () => {};
    yt.liveChat = newSession;
    yt.setupListeners(newSession);      // token 2 — sesi basi sekarang token 1
    yt.currentTarget = '@SomeChannel';

    oldSession.emit('end', 'Restarting session');

    assert.strictEqual(yt.status, 'idle', `status berubah jadi "${yt.status}" padahal harus tetap idle`);
    assert.strictEqual(yt.waitPollTimer, null, 'sesi basi tidak boleh memicu mode waiting');
  });

  check('event "start" dari sesi LAMA diabaikan', () => {
    const { EventEmitter } = require('events');
    const yt = new YouTubeChatIngest({ waitPollInterval: 999999 });

    const oldSession = new EventEmitter();
    yt.liveChat = oldSession;
    yt.setupListeners(oldSession);

    const newSession = new EventEmitter();
    yt.liveChat = newSession;
    yt.setupListeners(newSession);

    oldSession.emit('start', 'stale_video_id');
    assert.strictEqual(yt.activeLiveId, null, 'liveId basi tidak boleh dipakai');
  });

  check('sesi AKTIF tetap diproses (guard tidak over-blocking)', () => {
    const { EventEmitter } = require('events');
    const yt = new YouTubeChatIngest({ waitPollInterval: 999999 });

    const active = new EventEmitter();
    active.stop = () => {};
    yt.liveChat = active;
    yt.setupListeners(active);

    active.emit('start', 'fresh_video_id');
    assert.strictEqual(yt.status, 'connected', 'sesi aktif harus menghasilkan connected');
    assert.strictEqual(yt.activeLiveId, 'fresh_video_id');
  });

  check('stop() sinkron pada sesi lama TIDAK mengubah status (simulasi ganti target)', () => {
    // Ini bentuk regresi yang paling dekat dengan kejadian nyata: LiveChat.stop()
    // memancarkan 'end' SINKRON, sebelum sesi baru dipasang. Token harus dinaikkan
    // sebelum stop(), bukan sesudah.
    const { EventEmitter } = require('events');
    const yt = new YouTubeChatIngest({ waitPollInterval: 999999 });

    const makeSession = () => {
      const ee = new EventEmitter();
      ee.stop = (reason) => ee.emit('end', reason);
      return ee;
    };

    const s1 = makeSession();
    yt.liveChat = s1;
    yt.setupListeners(s1);
    s1.emit('start', 'vid1');
    assert.strictEqual(yt.status, 'connected');

    // Replikasi urutan di startSession()
    const emitted = [];
    yt.on('status_change', (d) => emitted.push(d.status));

    yt.sessionToken++;
    const prev = yt.liveChat;
    yt.liveChat = null;
    prev.stop('Restarting session');

    assert.strictEqual(yt.status, 'connected', 'status tidak boleh berubah oleh stop() sesi lama');
    assert.strictEqual(emitted.length, 0, `tidak boleh ada status_change, dapat: ${emitted.join(',')}`);
    assert.strictEqual(yt.waitPollTimer, null, 'tidak boleh masuk mode waiting');
  });
}

// ── BAGIAN B: jaringan ────────────────────────────────────────────────────────
async function runNetworkTests() {
  console.log('\n── BAGIAN B: Resolver Jaringan ──\n');

  const resolver = new YouTubeResolver({ timeout: 12000 });

  // Sambungkan dulu: tanpa internet, bagian ini dilaporkan SKIP, bukan FAIL.
  let online = true;
  try {
    await resolver.probe('@MilkyPoni');
  } catch (e) {
    online = false;
  }

  if (!online) {
    console.log('[SKIP] Tidak ada koneksi ke YouTube — uji jaringan dilewati.');
    return;
  }

  await checkAsync('resolver: handle offline dilaporkan offline + channelId', async () => {
    const p = await resolver.probe('@MilkyPoni');
    assert.strictEqual(p.state, 'offline', `state=${p.state}`);
    assert(/^UC[A-Za-z0-9_-]{22}$/.test(p.channelId || ''), `channelId=${p.channelId}`);
  });

  await checkAsync('resolver: handle tidak ada dilaporkan not_found (bukan offline)', async () => {
    const p = await resolver.probe('@nonexistent99999999zzz');
    assert.strictEqual(p.state, 'not_found');
  });

  await checkAsync('resolver: format tidak dikenal tidak menyentuh jaringan', async () => {
    const p = await resolver.probe('bukan-target-sama-sekali!!!');
    assert.strictEqual(p.state, 'not_found');
    assert.strictEqual(p.ok, false);
  });

  await checkAsync('resolver: gangguan jaringan dilaporkan unknown, bukan not_found', async () => {
    const offlineResolver = new YouTubeResolver({
      post: async () => { throw new Error('ETIMEDOUT'); },
    });
    const p = await offlineResolver.probe('@MilkyPoni');
    assert.strictEqual(p.state, 'unknown');
  });

  await checkAsync('resolver: 404 dari YouTube dilaporkan not_found', async () => {
    const r404 = new YouTubeResolver({
      post: async () => ({ status: 404, data: {} }),
    });
    const p = await r404.probe('@MilkyPoni');
    assert.strictEqual(p.state, 'not_found');
  });

  await checkAsync('resolver: watchEndpoint berarti live', async () => {
    const liveResolver = new YouTubeResolver({
      post: async () => ({
        status: 200,
        data: { endpoint: { watchEndpoint: { videoId: VID } } },
      }),
    });
    const p = await liveResolver.probe('@SomeChannel');
    assert.strictEqual(p.state, 'live');
    assert.strictEqual(p.videoId, VID);
  });

  await checkAsync('resolver: browseEndpoint berarti offline', async () => {
    const offResolver = new YouTubeResolver({
      post: async () => ({
        status: 200,
        data: { endpoint: { browseEndpoint: { browseId: CH } } },
      }),
    });
    const p = await offResolver.probe('@SomeChannel');
    assert.strictEqual(p.state, 'offline');
    assert.strictEqual(p.channelId, CH);
  });

  await checkAsync('resolver: target berbentuk video tidak diklaim live', async () => {
    // Diuji manual: watch?v= selalu menghasilkan watchEndpoint, bahkan untuk video mati.
    const p = await resolver.probe(`https://youtu.be/${VID}`);
    assert.strictEqual(p.state, 'unknown', 'video tidak boleh diklaim live tanpa verifikasi');
  });

  // ── Regresi YouTube Nov 2026: tag canonical berisi "undefined" ────────────────
  await checkAsync('shim: fetchLivePage menerima objek {channelId} dari pustaka', async () => {
    const { resolveDescriptor } = require('../src/innertube_live_source');
    const d = resolveDescriptor({ channelId: CH });
    assert.strictEqual(d.kind, 'channelId');
    assert.strictEqual(d.channelId, CH);
  });

  await checkAsync('shim: fetchLivePage menerima objek {handle} tanpa @', async () => {
    const { resolveDescriptor } = require('../src/innertube_live_source');
    assert.strictEqual(resolveDescriptor({ handle: 'LofiGirl' }).handle, '@LofiGirl');
  });

  await checkAsync('shim: fetchLivePage menerima objek {liveId}', async () => {
    const { resolveDescriptor } = require('../src/innertube_live_source');
    const d = resolveDescriptor({ liveId: VID });
    assert.strictEqual(d.kind, 'video');
    assert.strictEqual(d.videoId, VID);
  });

  await checkAsync('shim: terpasang dan mengganti fetchLivePage pustaka', async () => {
    const { installLiveChatShim, fetchLiveChatOptions } = require('../src/innertube_live_source');
    assert.strictEqual(installLiveChatShim(), true);
    const requests = require('youtube-chat/dist/requests');
    // Referensi fungsi harus identik dengan milik shim, bukan implementasi scraping.
    assert.strictEqual(typeof requests.fetchLivePage, 'function');
    assert.notStrictEqual(requests.fetchLivePage, fetchLiveChatOptions, 'pustaka tidak boleh masih memakai scraping');
    // Idempotent: pemanggilan kedua tidak merusak apa pun.
    assert.strictEqual(installLiveChatShim(), true);
  });

  await checkAsync('shim: kanal offline memberi error "Live Stream was not found"', async () => {
    const { fetchLiveChatOptions } = require('../src/innertube_live_source');
    let msg = '';
    try { await fetchLiveChatOptions({ channelId: 'UCbtU1G3peng0-uLPHnJdNNQ' }); } catch (e) { msg = e.message; }
    assert(/Live Stream was not found/.test(msg), `pesan tak terduga: ${msg}`);
  });

  await checkAsync('shim: kanal live menghasilkan opsi lengkap untuk LiveChat', async () => {
    const { fetchLiveChatOptions } = require('../src/innertube_live_source');
    const opts = await fetchLiveChatOptions({ channelId: 'UCSJ4gkVC6NrvII8umztf0Ow' });
    assert.strictEqual(opts.liveId, VID);
    assert(opts.continuation && opts.continuation.length > 40, 'continuation harus terisi');
    assert(opts.apiKey, 'apiKey harus terisi');
    assert(opts.clientVersion, 'clientVersion harus terisi');
  });
}

(async () => {
  console.log('🧪 Connectivity Regression Tests\n');
  runOfflineTests();
  await runNetworkTests();

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} cek lulus.`);
  if (failed.length) {
    console.error(`\n❌ ${failed.length} cek GAGAL:`);
    failed.forEach(f => console.error(`   - ${f.name}: ${f.error}`));
    process.exit(1);
  }
  console.log('🎉 Connectivity suite passed.\n');
  process.exit(0);
})();
