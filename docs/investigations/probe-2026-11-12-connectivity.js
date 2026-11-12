#!/usr/bin/env node
/**
 * PROBE SEMENTARA (tidak di-commit ke produk) — bukti untuk diskusi arsitektur
 * konektivitas YouTube KY-Poni.
 *
 * Mengukur 3 hal:
 *  1. Berapa format input yang saat ini dibaca SALAH oleh YouTubeChatIngest.parseTarget
 *  2. Apakah detect-live bisa dilakukan TANPA login, dan seberapa cepat
 *  3. Berapa biaya kuota bila memakai YouTube Data API v3 resmi
 *
 * Jalankan: node docs/investigations/probe-2026-11-12-connectivity.js
 */
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const { YouTubeChatIngest } = require(path.join(ROOT, 'src/youtube_ingest.js'));
const axios = require(path.join(ROOT, 'node_modules/axios'));

const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ── 1. parseTarget audit ────────────────────────────────────────────────────────
function auditParseTarget() {
  const y = new YouTubeChatIngest();
  const CHANNEL_ID = 'UCSJ4gkVC6NrvII8umztf0Ow';   // LofiGirl (sedang live saat probe)
  const inputs = [
    '@LofiGirl', 'LofiGirl',
    'https://www.youtube.com/@LofiGirl',
    'https://www.youtube.com/@LofiGirl/live',
    'https://m.youtube.com/@LofiGirl/live',
    'https://www.youtube.com/@LofiGirl?si=abc',
    'https://www.youtube.com/channel/' + CHANNEL_ID,
    'https://www.youtube.com/channel/' + CHANNEL_ID + '/live',
    'https://www.youtube.com/c/LofiGirl',
    'https://www.youtube.com/user/LofiGirl',
    'https://www.youtube.com/live/4t4AQ15yj1M',
    'https://www.youtube.com/watch?v=4t4AQ15yj1M',
    'https://youtu.be/4t4AQ15yj1M',
    '4t4AQ15yj1M',
  ];
  const saneRe = /^https:\/\/www\.youtube\.com\/(watch\?v=[A-Za-z0-9_-]{11}|channel\/UC[A-Za-z0-9_-]{22}\/live|@[A-Za-z0-9_.-]+\/live)$/;

  let ok = 0;
  const broken = [];
  for (const input of inputs) {
    const t = y.parseTarget(input);
    const url = t.channelId ? `https://www.youtube.com/channel/${t.channelId}/live`
      : t.liveId ? `https://www.youtube.com/watch?v=${t.liveId}`
      : `https://www.youtube.com/${t.handle}/live`;
    if (saneRe.test(url)) ok++;
    else broken.push({ input, parsed: t, url });
  }
  return { total: inputs.length, ok, broken };
}

// ── 2. Detect-live tanpa login (InnerTube resolve_url) ──────────────────────────
async function resolveUrl(targetUrl) {
  const t0 = Date.now();
  const res = await axios.post(
    `https://www.youtube.com/youtubei/v1/navigation/resolve_url?key=${INNERTUBE_KEY}`,
    { context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en', gl: 'US' } }, url: targetUrl },
    { timeout: 15000, validateStatus: () => true, headers: { 'Content-Type': 'application/json', 'User-Agent': UA } }
  );
  const ms = Date.now() - t0;
  const s = JSON.stringify(res.data);
  return {
    status: res.status,
    bytes: s.length,
    ms,
    videoId: (s.match(/"videoId":"([a-zA-Z0-9_-]{11})"/) || [])[1] || null,
    channelId: (s.match(/"browseId":"(UC[a-zA-Z0-9_-]{22})"/) || [])[1] || null,
  };
}

async function probeNoLoginDetection() {
  const cases = [
    ['LofiGirl (LIVE)',      'https://www.youtube.com/@LofiGirl/live'],
    ['LofiGirl /channel/',   'https://www.youtube.com/channel/UCSJ4gkVC6NrvII8umztf0Ow/live'],
    ['MilkyPoni (OFFLINE)',  'https://www.youtube.com/@MilkyPoni/live'],
    ['handle saja',          'https://www.youtube.com/@MilkyPoni'],
    ['handle tidak ada',     'https://www.youtube.com/@nonexistent99999999'],
  ];
  const out = [];
  for (const [label, url] of cases) {
    try {
      const r = await resolveUrl(url);
      out.push({ label, url, ...r });
    } catch (e) {
      out.push({ label, url, error: e.message });
    }
  }
  return out;
}

// ── 3. Biaya kuota API resmi ────────────────────────────────────────────────────
function quotaMath() {
  const QUOTA = 10000;          // unit/hari, PER PROJECT (bukan per user)
  const CHAT_LIST = 5;          // liveChatMessages.list
  const CHANNELS_LIST = 1;      // channels.list(mine=true)
  const rows = [];
  for (const interval of [1, 2, 5]) {
    const callsPerHour = 3600 / interval;
    const unitsPerHour = callsPerHour * CHAT_LIST;
    rows.push({ interval, callsPerHour, unitsPerHour, burnsQuotaInHours: QUOTA / unitsPerHour });
  }
  return { QUOTA, CHAT_LIST, CHANNELS_LIST, chatBurn: rows, loginsPerDay: QUOTA / CHANNELS_LIST };
}

// ── Run ────────────────────────────────────────────────────────────────────────
(async () => {
  console.log('='.repeat(78));
  console.log('1. AUDIT parseTarget (format input yang dibaca SALAH)');
  console.log('='.repeat(78));
  const p = auditParseTarget();
  console.log(`   Benar: ${p.ok}/${p.total} format`);
  for (const b of p.broken) {
    console.log(`   ✗ ${b.input}`);
    console.log(`     → di-parse jadi ${JSON.stringify(b.parsed)}`);
    console.log(`     → request ke ${b.url}`);
  }

  console.log('\n' + '='.repeat(78));
  console.log('2. DETEKSI LIVE TANPA LOGIN (InnerTube resolve_url)');
  console.log('='.repeat(78));
  const d = await probeNoLoginDetection();
  for (const r of d) {
    if (r.error) { console.log(`   ${r.label.padEnd(22)} ERROR ${r.error}`); continue; }
    const verdict = r.videoId ? `LIVE videoId=${r.videoId}`
      : r.status === 404 ? 'handle tidak ada'
      : `OFFLINE (channelId=${r.channelId || '-'})`;
    console.log(`   ${r.label.padEnd(22)} HTTP ${r.status} ${String(r.ms).padStart(5)}ms ${String(r.bytes).padStart(5)}B  → ${verdict}`);
  }

  console.log('\n' + '='.repeat(78));
  console.log('3. BIAYA KUOTA API RESMI (YouTube Data API v3)');
  console.log('='.repeat(78));
  const q = quotaMath();
  console.log(`   Kuota default = ${q.QUOTA} unit/hari, dihitung PER PROJECT (bukan per pengguna)`);
  console.log(`   liveChatMessages.list = ${q.CHAT_LIST} unit/panggilan`);
  for (const r of q.chatBurn) {
    console.log(`     polling ${r.interval}s → ${r.callsPerHour.toFixed(0)} call/jam → ${r.unitsPerHour.toFixed(0)} unit/jam`
      + ` → 1 streamer menghabiskan kuota dalam ${r.burnsQuotaInHours.toFixed(2)} jam`);
  }
  console.log(`   channels.list(mine=true) = ${q.CHANNELS_LIST} unit → cukup untuk ${q.loginsPerDay.toLocaleString('id-ID')} login/hari`);
  console.log('\n   Catatan: kuota 10.000 unit itu SATU kolam untuk SELURUH pengguna aplikasi.');
})();
