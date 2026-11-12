/**
 * KY-Poni - Pure-Node ZIP Reader (zero external dependency)
 *
 * Kenapa ini ada: implementasi sebelumnya memanggil biner eksternal
 * (`unzip`, `tar`, `powershell Expand-Archive`). Itu rapuh di PC orang lain:
 *  - Distro minimal / Arch base / container sering TIDAK punya `unzip`.
 *    Saat itu terjadi, SEMUA pemasangan tema gagal ("spawn unzip ENOENT") —
 *    regresi yang tidak terlihat di mesin developer yang sudah lengkap.
 *  - PowerShell hanya ada di Windows; `unzip` hanya di sebagian Linux.
 *
 * Modul ini membaca format ZIP langsung dengan `zlib` bawaan Node, sehingga
 * perilakunya IDENTIK di Linux, Windows, dan macOS, tanpa syarat biner apa pun.
 *
 * Keamanan: setiap entri divalidasi SEBELUM diekstrak (anti zip-slip).
 * Entri dengan path absolut, drive letter, `..`, atau symlink ditolak, dan
 * seluruh arsip dibatalkan — bukan hanya entri bermasalah itu.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIG_EOCD = 0x06054b50;      // End of Central Directory
const SIG_EOCD64 = 0x06064b50;    // ZIP64 End of Central Directory
const SIG_CEN = 0x02014b50;       // Central Directory file header
const SIG_LOC = 0x04034b50;       // Local file header

const MAX_TOTAL_UNCOMPRESSED = 256 * 1024 * 1024; // 256 MB (anti zip-bomb)
const MAX_ENTRIES = 10000;

/**
 * Baca daftar entri dari central directory.
 * @param {Buffer} buf seluruh isi berkas zip
 * @returns {Array<{name, method, compressedSize, uncompressedSize, localOffset, isSymlink}>}
 */
function readCentralDirectory(buf) {
  // EOCD berada di 22..(22+65535) byte terakhir.
  let eocdOffset = -1;
  const minPos = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= minPos; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Berkas bukan arsip ZIP yang sah (EOCD tidak ditemukan).');
  }

  let entryCount = buf.readUInt16LE(eocdOffset + 10);
  let cenOffset = buf.readUInt32LE(eocdOffset + 16);

  // ZIP64: nilai 0xffffffff/0xffff menandakan perlu membaca record ZIP64.
  if (entryCount === 0xffff || cenOffset === 0xffffffff) {
    // Cari ZIP64 EOCD locator (20 byte sebelum EOCD).
    const locOffset = eocdOffset - 20;
    if (locOffset >= 0 && buf.readUInt32LE(locOffset) === 0x07064b50) {
      const z64EocdOff = Number(buf.readBigUInt64LE(locOffset + 8));
      if (z64EocdOff >= 0 && z64EocdOff + 56 <= buf.length && buf.readUInt32LE(z64EocdOff) === SIG_EOCD64) {
        entryCount = Number(buf.readBigUInt64LE(z64EocdOff + 32));
        cenOffset = Number(buf.readBigUInt64LE(z64EocdOff + 48));
      }
    }
  }

  if (entryCount > MAX_ENTRIES) {
    throw new Error(`Arsip tema ditolak: jumlah entri berlebihan (${entryCount}).`);
  }
  if (cenOffset < 0 || cenOffset >= buf.length) {
    throw new Error('Arsip tema rusak: offset central directory tidak sah.');
  }

  const entries = [];
  let p = cenOffset;
  let totalUncompressed = 0;

  for (let i = 0; i < entryCount; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== SIG_CEN) {
      throw new Error('Arsip tema rusak: central directory tidak konsisten.');
    }

    const versionMadeBy = buf.readUInt16LE(p + 4);
    const method = buf.readUInt16LE(p + 10);
    let compressedSize = buf.readUInt32LE(p + 20);
    let uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    let localOffset = buf.readUInt32LE(p + 42);

    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    // ZIP64 extra field (header id 0x0001) mengisi nilai yang di-truncate.
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
      let ep = p + 46 + nameLen;
      const extraEnd = ep + extraLen;
      while (ep + 4 <= extraEnd) {
        const hid = buf.readUInt16LE(ep);
        const hsz = buf.readUInt16LE(ep + 2);
        if (hid === 0x0001) {
          let q = ep + 4;
          if (uncompressedSize === 0xffffffff && q + 8 <= ep + 4 + hsz) {
            uncompressedSize = Number(buf.readBigUInt64LE(q)); q += 8;
          }
          if (compressedSize === 0xffffffff && q + 8 <= ep + 4 + hsz) {
            compressedSize = Number(buf.readBigUInt64LE(q)); q += 8;
          }
          if (localOffset === 0xffffffff && q + 8 <= ep + 4 + hsz) {
            localOffset = Number(buf.readBigUInt64LE(q)); q += 8;
          }
          break;
        }
        ep += 4 + hsz;
      }
    }

    // Mode unix ada di upper 16 bit "version made by" bila dibuat di unix.
    const isUnix = (versionMadeBy >> 8) === 3;
    const externalAttrs = buf.readUInt32LE(p + 38);
    const mode = isUnix ? (externalAttrs >>> 16) : 0;
    const isSymlink = (mode & 0o170000) === 0o120000;

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) {
      throw new Error('Arsip tema ditolak: ukuran hasil ekstraksi melebihi batas aman (zip-bomb).');
    }

    entries.push({ name, method, compressedSize, uncompressedSize, localOffset, isSymlink });

    p += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

/**
 * Validasi nama entri. Melempar error bila entri berbahaya.
 * Dipisah agar bisa diuji sendiri dan dipakai sebelum ekstraksi apa pun.
 */
function assertSafeEntryName(name) {
  if (!name) return false; // entri kosong (mis. direktori) → dilewati

  const normalized = name.replace(/\\/g, '/');

  if (normalized.startsWith('/')) {
    throw new Error(`Arsip tema ditolak: entri berpath absolut "${name}".`);
  }
  if (/^[a-zA-Z]:[\/]/.test(normalized)) {
    throw new Error(`Arsip tema ditolak: entri berdrive letter "${name}".`);
  }
  // `..` sebagai segmen path (bukan bagian nama seperti "a..b").
  const segments = normalized.split('/');
  if (segments.some(s => s === '..')) {
    throw new Error(`Arsip tema ditolak: entri traversal "${name}".`);
  }
  if (normalized.includes('\0')) {
    throw new Error(`Arsip tema ditolak: entri mengandung NUL byte.`);
  }
  return true;
}

/**
 * Ekstrak arsip zip ke destDir. Semua validasi dilakukan lebih dulu:
 * kalau ada satu entri tidak aman, TIDAK ADA yang ditulis sama sekali.
 */
function extractZipBuffer(buf, destDir) {
  const entries = readCentralDirectory(buf);
  const base = path.resolve(destDir);

  // ---- Fase 1: validasi SELURUH entri sebelum menyentuh disk ----
  for (const entry of entries) {
    if (!assertSafeEntryName(entry.name)) continue;
    if (entry.isSymlink) {
      throw new Error(`Arsip tema ditolak: entri symlink "${entry.name}".`);
    }
    const target = path.resolve(base, entry.name.replace(/\\/g, '/'));
    if (target !== base && !target.startsWith(base + path.sep)) {
      throw new Error(`Arsip tema ditolak: entri keluar direktori "${entry.name}".`);
    }
  }

  // ---- Fase 2: tulis ----
  fs.mkdirSync(base, { recursive: true });
  let written = 0;

  for (const entry of entries) {
    if (!entry.name) continue;
    const rel = entry.name.replace(/\\/g, '/');
    const target = path.resolve(base, rel);

    if (rel.endsWith('/')) {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }

    // Baca local header untuk menemukan awal data (ukuran nama/extra di local
    // header bisa BERBEDA dari central directory — wajib dibaca ulang).
    const lp = entry.localOffset;
    if (lp + 30 > buf.length || buf.readUInt32LE(lp) !== SIG_LOC) {
      throw new Error(`Arsip tema rusak: local header tidak sah untuk "${entry.name}".`);
    }
    const locNameLen = buf.readUInt16LE(lp + 26);
    const locExtraLen = buf.readUInt16LE(lp + 28);
    const dataStart = lp + 30 + locNameLen + locExtraLen;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > buf.length) {
      throw new Error(`Arsip tema rusak: data terpotong untuk "${entry.name}".`);
    }

    const raw = buf.subarray(dataStart, dataEnd);
    let out;
    if (entry.method === 0) {
      out = raw;
    } else if (entry.method === 8) {
      try {
        out = zlib.inflateRawSync(raw, { maxOutputLength: Math.max(entry.uncompressedSize, 1024) });
      } catch (e) {
        throw new Error(`Arsip tema rusak: gagal dekompresi "${entry.name}": ${e.message}`);
      }
    } else {
      throw new Error(`Arsip tema ditolak: metode kompresi ${entry.method} tidak didukung ("${entry.name}").`);
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, out);
    written++;
  }

  return { entries: entries.length, written };
}

function extractZipFile(zipPath, destDir) {
  const buf = fs.readFileSync(zipPath);
  return extractZipBuffer(buf, destDir);
}

module.exports = {
  extractZipFile,
  extractZipBuffer,
  readCentralDirectory,
  assertSafeEntryName,
  MAX_TOTAL_UNCOMPRESSED,
};
