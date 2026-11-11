/**
 * KY-Poni - URL Safety Guards
 *
 * Dua celah yang ditutup di sini:
 *
 * 1. SSRF lewat REDIRECT. Allowlist di route hanya memeriksa URL AWAL. Server
 *    yang diizinkan (atau yang disusupi) bisa membalas 302 ke alamat internal —
 *    `http://169.254.169.254/` (metadata cloud), `http://127.0.0.1:8080/admin`,
 *    `file://` dsb. Implementasi lama mengikuti redirect tanpa memeriksa tujuan.
 *
 * 2. SSRF lewat DNS. Hostname yang lolos allowlist bisa me-resolve ke IP privat
 *    (DNS rebinding). Untuk katalog resmi GitHub ini teoretis, tetapi pemeriksaan
 *    IP tetap dilakukan sebagai lapisan pertahanan.
 *
 * Modul ini zero-dependency (hanya `dns` bawaan Node).
 */

const dns = require('dns');
const net = require('net');

/**
 * Apakah IP termasuk rentang privat/loopback/link-local yang tidak boleh
 * diakses oleh fitur unduh tema?
 */
function isBlockedIp(ip) {
  if (!ip) return true;

  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  const normalized = ip.replace(/^::ffff:/i, '');

  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    const [a, b] = parts;

    if (a === 0) return true;                          // 0.0.0.0/8
    if (a === 10) return true;                         // 10.0.0.0/8
    if (a === 127) return true;                        // loopback
    if (a === 169 && b === 254) return true;           // link-local (metadata cloud)
    if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
    if (a === 192 && b === 168) return true;           // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
    if (a >= 224) return true;                         // multicast + reserved
    return false;
  }

  if (net.isIPv6(normalized)) {
    const low = normalized.toLowerCase();
    if (low === '::1' || low === '::') return true;
    if (low.startsWith('fe80')) return true;  // link-local
    if (low.startsWith('fc') || low.startsWith('fd')) return true; // unique local
    return false;
  }

  return true; // bukan IP yang dikenali → tolak (fail-closed)
}

/**
 * Validasi URL tujuan unduhan.
 *
 * @param {string} rawUrl
 * @param {object} opts
 * @param {string[]} opts.allowedHosts hostname yang diizinkan
 * @param {string[]} opts.allowedPathPrefixes prefix pathname yang diizinkan (opsional)
 * @param {boolean} opts.requireHttps default true
 * @returns {{ok: boolean, reason?: string}}
 */
function validateDownloadUrl(rawUrl, opts = {}) {
  const {
    allowedHosts = [],
    allowedPathPrefixes = [],
    requireHttps = true,
  } = opts;

  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { ok: false, reason: 'URL kosong' };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (e) {
    return { ok: false, reason: 'URL tidak dapat di-parse' };
  }

  if (requireHttps && parsed.protocol !== 'https:') {
    return { ok: false, reason: `protokol ${parsed.protocol} tidak diizinkan` };
  }
  if (!requireHttps && !['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, reason: `protokol ${parsed.protocol} tidak diizinkan` };
  }

  if (allowedHosts.length > 0 && !allowedHosts.includes(parsed.hostname)) {
    return { ok: false, reason: `host ${parsed.hostname} tidak ada di allowlist` };
  }

  if (allowedPathPrefixes.length > 0) {
    const okPath = allowedPathPrefixes.some(p => parsed.pathname.startsWith(p));
    if (!okPath) {
      return { ok: false, reason: `path ${parsed.pathname} di luar katalog resmi` };
    }
  }

  // Kalau hostname sudah berupa IP literal, tolak yang privat.
  if (net.isIP(parsed.hostname) && isBlockedIp(parsed.hostname)) {
    return { ok: false, reason: `alamat IP ${parsed.hostname} tidak diizinkan` };
  }

  return { ok: true };
}

/**
 * Validasi tambahan berbasis DNS: resolve hostname dan pastikan tidak ada satu pun
 * hasil yang menunjuk ke alamat privat.
 *
 * Catatan: pemeriksaan ini rentan TOCTOU (DNS bisa berubah antara cek dan koneksi).
 * Karena itu ia dipakai sebagai lapisan tambahan, BUKAN pengganti allowlist
 * hostname. Untuk tujuan unduhan tema yang sudah di-allowlist, risikonya minimal.
 */
function resolveHostnameSafely(hostname) {
  return new Promise((resolve) => {
    if (net.isIP(hostname)) {
      return resolve({ ok: !isBlockedIp(hostname), addresses: [hostname] });
    }
    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        // Gagal resolve bukan indikasi serangan — biarkan request gagal sendiri.
        return resolve({ ok: true, addresses: [] });
      }
      const ips = addresses.map(a => a.address);
      const blocked = ips.filter(isBlockedIp);
      if (blocked.length > 0) {
        return resolve({ ok: false, reason: `hostname menunjuk ke IP privat: ${blocked.join(', ')}`, addresses: ips });
      }
      resolve({ ok: true, addresses: ips });
    });
  });
}

module.exports = {
  isBlockedIp,
  validateDownloadUrl,
  resolveHostnameSafely,
};
