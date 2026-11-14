/**
 * KY-Poni - YouTube Live Chat Ingest Worker
 * Uses reverse-engineered InnerTube protocol without Google API keys.
 * Hardened with Anti-RTO resilience, exponential backoff, and self-healing watchdog.
 */
const { EventEmitter } = require('events');
const { LiveChat } = require('youtube-chat');
const axios = require('axios');
const { classify, toLiveChatTarget } = require('./youtube_target');
const { YouTubeResolver } = require('./youtube_resolver');
const { installLiveChatShim } = require('./innertube_live_source');

// WAJIB dipanggil sebelum LiveChat.start() mana pun.
// Sejak Nov 2026 YouTube menyajikan `<link rel="canonical" href="undefined">`, sehingga
// youtube-chat (rilis terakhir 2022) gagal menemukan liveId dan SEMUA jalur koneksi mati —
// termasuk v1.0.1 yang sudah dirilis. Shim ini mengganti hanya fungsi pengambil opsi awal.
installLiveChatShim();

// Set global timeout on axios so requests don't hang indefinitely during network RTO
try {
  axios.defaults.timeout = 10000;
} catch (e) {}

class YouTubeChatIngest extends EventEmitter {
  constructor(options = {}) {
    super();
    this.liveChat = null;
    this.status = 'idle'; // 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'
    this.currentTarget = null;
    this.activeLiveId = null;
    this.activeChannelId = null;
    this.channelProfile = null;
    this.messageCount = 0;
    this.consecutiveErrors = 0;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.isManuallyStopped = false;

    // Pemantauan "menunggu live": kanal dikenal tetapi belum menyiarkan.
    this.waitPollTimer = null;
    this.waitPollInterval = options.waitPollInterval || 60000;
    this.resolver = options.resolver || new YouTubeResolver();

    // Nomor urut sesi. Dipakai untuk mengabaikan event dari sesi yang sudah digantikan.
    this.sessionToken = 0;
  }

  parseTarget(input) {
    // Klasifikasi tunggal ada di youtube_target.js (modul terpisah, bisa dites offline).
    // Alias ini dipertahankan karena test suite dan kode lama memakai nama parseTarget().
    return classify(input);
  }


  async fetchChannelProfile(target) {
    if (!this.resolver || typeof this.resolver.resolveChannelProfile !== 'function') return null;
    try {
      const res = await this.resolver.resolveChannelProfile(target);
      if (res && res.ok && res.profile) {
        this.channelProfile = res.profile;
        if (res.profile.channelId && !this.activeChannelId) {
          this.activeChannelId = res.profile.channelId;
        }
        return res.profile;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  async connect(rawTarget) {
    this.isManuallyStopped = false;
    this.consecutiveErrors = 0;
    this.reconnectAttempts = 0;
    this.clearWaitPoll();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    return this.startSession(rawTarget);
  }

  async startSession(rawTarget) {
    const descriptor = this.parseTarget(rawTarget);
    if (!descriptor) {
      // Pesan menyebut format yang DIDUKUNG, bukan menyalahkan streamer soal status live.
      throw new Error(
        `Format target tidak dikenali: "${rawTarget}". ` +
        'Gunakan @handle, Channel ID (UC...), URL kanal, atau URL live/video YouTube.'
      );
    }

    // Naikkan nomor sesi SEBELUM menghentikan sesi lama.
    //
    // Diuji langsung: `liveChat.stop()` memancarkan event 'end' secara SINKRON, dan itu
    // terjadi sebelum setupListeners() untuk sesi baru dijalankan. Kalau token dinaikkan
    // belakangan, event 'end' dari sesi lama masih dianggap sah (token-nya masih sama),
    // sehingga log menampilkan "Siaran berakhir" setiap kali pengguna berganti target
    // padahal siaran masih berjalan. Menaikkan token di sini membuat event tersebut basi.
    this.sessionToken++;

    if (this.liveChat) {
      const previous = this.liveChat;
      this.liveChat = null;
      try { previous.stop('Restarting session'); } catch (e) {}
    }

    this.status = 'connecting';
    this.currentTarget = rawTarget;
    this.emit('status_change', { status: this.status, target: this.currentTarget, profile: this.channelProfile });

    // Asynchronously resolve profile metadata without blocking chat connection
    this.fetchChannelProfile(rawTarget).then((prof) => {
      if (prof && this.currentTarget === rawTarget) {
        this.emit('status_change', {
          status: this.status,
          target: this.currentTarget,
          channelId: this.activeChannelId,
          liveId: this.activeLiveId,
          profile: this.channelProfile,
        });
      }
    }).catch(() => {});

    // Bentuk legacy (/c/Nama, /user/Nama) harus diterjemahkan dulu ke identitas kanal.
    let resolvedDescriptor = descriptor;
    if (descriptor.kind === 'remote') {
      const normalized = await this.resolver.normalize(rawTarget);
      if (!normalized.ok) {
        const err = new Error(normalized.reason || 'Kanal tidak dapat diterjemahkan.');
        this.status = 'error';
        this.emit('status_change', { status: this.status, error: err.message });
        throw err;
      }
      resolvedDescriptor = normalized.descriptor;
    }

    const liveChatTarget = toLiveChatTarget(resolvedDescriptor);
    if (!liveChatTarget) {
      const err = new Error(`Target "${rawTarget}" tidak dapat dipakai untuk membaca chat.`);
      this.status = 'error';
      this.emit('status_change', { status: this.status, error: err.message });
      throw err;
    }

    try {
      this.liveChat = new LiveChat(liveChatTarget);
      this.setupListeners(this.liveChat);

      const ok = await this.liveChat.start();
      if (!ok) {
        // Kanal dikenal tetapi belum menyiarkan: ini kondisi NORMAL, bukan error pengguna.
        // Jangan lempar error dengan pesan menyesatkan; masuk mode "menunggu live"
        // yang memeriksa ulang secara berkala.
        const liveId = this.liveChat && this.liveChat.liveId;
        const looksOffline = !liveId;

        if (looksOffline && (resolvedDescriptor.kind === 'handle' || resolvedDescriptor.kind === 'channelId')) {
          this.enterWaitingForLive(rawTarget, resolvedDescriptor);
          return true;
        }

        throw new Error(
          `Tidak dapat membaca live chat untuk "${rawTarget}". ` +
          'Pastikan siaran sudah dimulai dan live chat-nya aktif (bukan ditutup).'
        );
      }

      return true;
    } catch (err) {
      if (this.status !== 'reconnecting' && this.status !== 'waiting') {
        this.status = 'error';
        this.emit('status_change', { status: this.status, target: this.currentTarget, error: err.message });
      }
      throw err;
    }
  }

  /**
   * Kanal dikenal tetapi belum live. Status ini jujur kepada pengguna: bukan "error",
   * bukan pula "connected". Periksa ulang secara ringan (0 kuota, ~1 KB per cek) sampai
   * siaran dimulai, lalu sambungkan otomatis tanpa campur tangan pengguna.
   */
  enterWaitingForLive(rawTarget, descriptor) {
    this.status = 'waiting';
    this.clearWaitPoll();

    const emitWaiting = (extra = {}) => {
      this.emit('status_change', {
        status: 'waiting',
        target: rawTarget,
        channelId: this.activeChannelId,
        message: 'Kanal dikenali. Menunggu siaran dimulai...',
        ...extra,
      });
    };

    if (descriptor.channelId) this.activeChannelId = descriptor.channelId;
    emitWaiting();

    console.log(`[KY-Poni YouTube] Target "${rawTarget}" dikenali tetapi belum live. Menunggu siaran...`);

    this.waitPollTimer = setInterval(async () => {
      if (this.isManuallyStopped) { this.clearWaitPoll(); return; }
      if (this.status !== 'waiting') { this.clearWaitPoll(); return; }

      let probe;
      try {
        probe = await this.resolver.probe(rawTarget);
      } catch (e) {
        return; // gangguan jaringan sesaat: biarkan siklus berikutnya mencoba
      }

      if (probe.channelId) this.activeChannelId = probe.channelId;

      if (probe.state === 'live') {
        console.log(`[KY-Poni YouTube] Siaran terdeteksi (${probe.videoId || 'live'}). Menyambungkan chat otomatis...`);
        this.clearWaitPoll();
        this.status = 'connecting';
        this.emit('status_change', { status: 'connecting', target: rawTarget, liveId: probe.videoId || null });

        try {
          await this.startSession(rawTarget);
        } catch (err) {
          console.warn(`[KY-Poni YouTube] Gagal menyambung setelah siaran terdeteksi: ${err.message}`);
          // Kembali ke mode menunggu, bukan mati total: streamer bisa mulai siaran kapan saja.
          this.enterWaitingForLive(rawTarget, descriptor);
        }
      } else if (probe.state === 'not_found') {
        // Kanal benar-benar tidak ada: berhenti memantau, laporkan sekali.
        this.clearWaitPoll();
        this.status = 'error';
        this.emit('status_change', {
          status: 'error',
          target: rawTarget,
          error: 'Kanal tidak ditemukan di YouTube. Periksa kembali handle atau Channel ID-nya.',
        });
      }
      // state 'offline' / 'unknown': tetap menunggu, tidak perlu mengganggu pengguna.
    }, this.waitPollInterval);

    // Jangan menahan proses tetap hidup hanya karena timer pemantauan.
    if (this.waitPollTimer && typeof this.waitPollTimer.unref === 'function') {
      this.waitPollTimer.unref();
    }
  }

  clearWaitPoll() {
    if (this.waitPollTimer) {
      clearInterval(this.waitPollTimer);
      this.waitPollTimer = null;
    }
  }


  triggerSelfHealingReconnect() {
    if (this.reconnectTimer || this.isManuallyStopped || !this.currentTarget) return;

    this.status = 'reconnecting';
    this.emit('status_change', {
      status: this.status,
      target: this.currentTarget,
      liveId: this.activeLiveId,
      message: 'Sinyal terputus sebentar, memulihkan koneksi stream...'
    });

    if (this.liveChat) {
      try { this.liveChat.stop('Self-healing reconnect'); } catch (e) {}
      this.liveChat = null;
    }

    const backoff = Math.min(15000, 2000 * Math.pow(1.5, Math.min(4, this.reconnectAttempts)));
    this.reconnectAttempts++;
    console.log(`[KY-Poni YouTube Anti-RTO] Reconnecting in ${(backoff / 1000).toFixed(1)}s (Attempt #${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.isManuallyStopped || !this.currentTarget) return;

      try {
        await this.startSession(this.currentTarget);
        this.consecutiveErrors = 0;
        this.reconnectAttempts = 0;
        console.log('[KY-Poni YouTube Anti-RTO] Reconnected successfully!');
      } catch (err) {
        console.warn(`[KY-Poni YouTube Anti-RTO] Reconnect failed: ${err.message}. Retrying...`);
        this.triggerSelfHealingReconnect();
      }
    }, backoff);
  }

  async disconnect() {
    this.isManuallyStopped = true;
    this.clearWaitPoll();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.liveChat) {
      try {
        this.liveChat.stop('User requested disconnect');
      } catch (e) {
        // ignore
      }
      this.liveChat = null;
    }
    this.status = 'idle';
    this.activeLiveId = null;
    this.activeChannelId = null;
    this.consecutiveErrors = 0;
    this.reconnectAttempts = 0;
    this.emit('status_change', { status: this.status });
  }

  setupListeners(liveChat) {
    // Token identitas sesi. Pendekatan referensi (`this.liveChat !== liveChat`) TERBUKTI
    // tidak cukup: saat mengganti target, referensi dilepas lebih dulu agar `stop()` aman,
    // sehingga pada momen event 'end' dipancarkan `this.liveChat` bernilai null dan guard
    // berbasis referensi justru meloloskan event basi. Token angka tidak punya lubang itu.
    const sessionToken = ++this.sessionToken;

    liveChat.on('start', (liveId) => {
      if (sessionToken !== this.sessionToken) return; // sesi basi
      this.status = 'connected';
      this.activeLiveId = liveId;
      this.consecutiveErrors = 0;
      this.reconnectAttempts = 0;
      console.log(`[KY-Poni YouTube] Live Chat connected. Stream ID: ${liveId}`);
      this.emit('status_change', {
        status: this.status,
        target: this.currentTarget,
        liveId: this.activeLiveId,
        channelId: this.activeChannelId,
        profile: this.channelProfile,
      });
    });

    liveChat.on('end', (reason) => {
      // KRITIS: event 'end' bisa datang dari sesi yang sudah digantikan. Tanpa guard ini,
      // mengganti target memicu "siaran berakhir" pada sesi baru yang sedang sehat, dan
      // dashboard berkedip ke mode waiting padahal chat baru mengalir normal.
      if (sessionToken !== this.sessionToken) {
        return;
      }

      console.log(`[KY-Poni YouTube] Live Chat ended: ${reason}`);
      if (this.isManuallyStopped || !this.currentTarget) {
        this.status = 'idle';
        this.emit('status_change', { status: this.status, target: this.currentTarget, reason });
        return;
      }

      // Siaran selesai ≠ gangguan jaringan. Daripada berulang kali reconnect ke siaran
      // yang sudah berakhir, masuk mode "menunggu live": aplikasi siap menyambung lagi
      // otomatis saat streamer memulai siaran berikutnya.
      const descriptor = this.parseTarget(this.currentTarget);
      const canWait = descriptor && (descriptor.kind === 'handle' || descriptor.kind === 'channelId');

      if (canWait) {
        console.log('[KY-Poni YouTube] Siaran berakhir. Beralih ke mode menunggu siaran berikutnya.');
        this.activeLiveId = null;
        this.enterWaitingForLive(this.currentTarget, descriptor);
      } else {
        console.warn('[KY-Poni YouTube] Stream ended unexpectedly. Self-healing reconnect scheduled...');
        this.triggerSelfHealingReconnect();
      }
    });

    liveChat.on('chat', (chatItem) => {
      // Automatic recovery when new messages arrive after transient network drops
      if (this.consecutiveErrors > 0 || this.status !== 'connected') {
        this.consecutiveErrors = 0;
        this.status = 'connected';
        this.emit('status_change', {
          status: this.status,
          target: this.currentTarget,
          liveId: this.activeLiveId,
        });
      }
      this.messageCount++;
      const standardized = this.standardizeChatItem(chatItem);
      this.emit('message', standardized);
    });

    liveChat.on('error', (err) => {
      this.consecutiveErrors++;
      const errMsg = err?.message || String(err);
      console.warn(`[KY-Poni YouTube] Transient network/polling error (#${this.consecutiveErrors}): ${errMsg}`);

      // Mark as reconnecting instead of fatal error so UI shows soft warning
      if (this.status === 'connected') {
        this.status = 'reconnecting';
        this.emit('status_change', {
          status: this.status,
          target: this.currentTarget,
          liveId: this.activeLiveId,
          error: errMsg,
        });
      }

      // If network outage or RTO persists for 4+ consecutive polling cycles (~4-8s)
      if (this.consecutiveErrors >= 4 && !this.isManuallyStopped) {
        this.triggerSelfHealingReconnect();
      }
    });
  }

  standardizeChatItem(item) {
    // Format message items (text and emotes)
    let messageHtml = '';
    let rawText = '';

    if (Array.isArray(item.message)) {
      item.message.forEach((part) => {
        if ('text' in part) {
          rawText += part.text;
          messageHtml += escapeHtml(part.text);
        } else if ('url' in part) {
          rawText += part.emojiText || '[emote]';
          messageHtml += `<img class="chat-emote" src="${escapeHtml(part.url)}" alt="${escapeHtml(part.alt || part.emojiText || '')}" title="${escapeHtml(part.emojiText || '')}" />`;
        }
      });
    }

    // Extract badges
    const badges = [];
    if (item.isOwner) badges.push({ type: 'owner', label: 'OWNER' });
    if (item.isModerator) badges.push({ type: 'mod', label: 'MOD' });
    if (item.isMembership) badges.push({ type: 'member', label: 'MEMBER' });
    if (item.isVerified) badges.push({ type: 'verified', label: 'VERIFIED' });

    // Identify message type
    let type = 'chat';
    if (item.superchat) type = 'superchat';
    else if (item.isMembership && rawText.toLowerCase().includes('welcome')) type = 'membership';

    return {
      id: item.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      author: {
        name: item.author.name || 'Anonymous',
        channelId: item.author.channelId || '',
        avatar: item.author.thumbnail?.url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(item.author.name || 'User')}`,
        badges,
      },
      message: messageHtml,
      rawText,
      superchat: item.superchat ? {
        amount: item.superchat.amount,
        color: item.superchat.color || '#E60012',
      } : null,
      timestamp: item.timestamp ? new Date(item.timestamp).toISOString() : new Date().toISOString(),
    };
  }

  simulateMessage(type = 'chat', customData = {}) {
    this.messageCount++;
    const defaultAvatars = [
      'https://api.dicebear.com/7.x/bottts/svg?seed=Ryuji',
      'https://api.dicebear.com/7.x/bottts/svg?seed=Morgana',
      'https://api.dicebear.com/7.x/bottts/svg?seed=Ann',
      'https://api.dicebear.com/7.x/bottts/svg?seed=Joker'
    ];
    const randomAvatar = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];

    // ESCAPE DI BATAS SISTEM — tapi HANYA pada field yang memang butuh.
    //
    // Kontrak renderer (diverifikasi di semua 5 renderer):
    //   message        -> SEMUA renderer menulisnya via innerHTML
    //                     (p5: prefixHtml + item.message, classic: innerHTML,
    //                      overlay fallback: innerHTML). Jadi HARUS di-escape di sini.
    //   author.name    -> renderer meng-escape sendiri: p5 memecah per karakter
    //                     dengan escapeText(), classic/cyberpunk pakai textContent,
    //                     p3r pakai innerText. Jadi HARUS mentah. Kalau di-escape
    //                     di sini, nama tampil rusak: "Budi & Sari" -> "B U D I &A M P ;".
    //   superchat.amount -> semua pemakai escape sendiri / textContent. HARUS mentah.
    //   rawText        -> p3r meng-escape sendiri. HARUS mentah (cegah double escape).
    //
    // Kesalahan sebelumnya: ketiganya di-escape seragam sehingga karakter &, <, >
    // tampil sebagai entitas di nameplate tema Persona 5.
    const safeMessage = escapeHtml(customData.message);

    // `type` datang dari body HTTP dan dipakai untuk menentukan kelas CSS di
    // renderer — batasi ke nilai yang dikenal.
    const allowedTypes = ['chat', 'superchat', 'membership'];
    const safeType = allowedTypes.includes(type) ? type : 'chat';

    // color dipakai sebagai nilai CSS, jadi tetap divalidasi ketat (bukan display text).
    const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(String(customData.color || ''))
      ? String(customData.color)
      : '#E60012';
    // avatar dipakai sebagai src <img>, jadi wajib http(s).
    const safeAvatar = (typeof customData.avatar === 'string' && /^https?:\/\//i.test(customData.avatar))
      ? customData.avatar
      : randomAvatar;

    let result = {
      id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: safeType,
      author: {
        // Mentah: renderer yang meng-escape (lihat kontrak di atas).
        name: customData.author || 'PhantomViewer',
        channelId: 'UC_mock_user',
        avatar: safeAvatar,
        badges: Array.isArray(customData.badges) ? customData.badges : [],
      },
      message: safeMessage || 'For real?! Ini beneran keren banget!',
      rawText: customData.rawText || customData.message || 'For real?!',
      superchat: null,
      timestamp: new Date().toISOString(),
    };

    if (safeType === 'superchat') {
      result.superchat = {
        // Mentah: classic/p3r memakai textContent/innerText, p5 escape sendiri.
        amount: customData.amount || 'Rp 50.000',
        color: safeColor,
      };
      result.message = safeMessage || 'Semangat live streamnya Bos! Lookin cool!';
    } else if (safeType === 'membership') {
      result.author.badges.push({ type: 'member', label: 'MEMBER' });
      result.message = safeMessage || 'Baru saja bergabung menjadi anggota!';
    }

    this.emit('message', result);
    return result;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = { YouTubeChatIngest };
