/**
 * KY-Poni - YouTube Live Chat Ingest Worker
 * Uses reverse-engineered InnerTube protocol without Google API keys.
 * Hardened with Anti-RTO resilience, exponential backoff, and self-healing watchdog.
 */
const { EventEmitter } = require('events');
const { LiveChat } = require('youtube-chat');
const axios = require('axios');

// Set global timeout on axios so requests don't hang indefinitely during network RTO
try {
  axios.defaults.timeout = 10000;
} catch (e) {}

class YouTubeChatIngest extends EventEmitter {
  constructor() {
    super();
    this.liveChat = null;
    this.status = 'idle'; // 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'
    this.currentTarget = null;
    this.activeLiveId = null;
    this.messageCount = 0;
    this.consecutiveErrors = 0;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.isManuallyStopped = false;
  }

  parseTarget(input) {
    if (!input || typeof input !== 'string') return null;
    const clean = input.trim();

    // Check for watch URL
    const watchMatch = clean.match(/(?:v=|\/live\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (watchMatch) {
      return { liveId: watchMatch[1] };
    }

    // Check for channel handle: @Username or youtube.com/@Username
    const handleMatch = clean.match(/@([a-zA-Z0-9_.-]+)/);
    if (handleMatch) {
      return { handle: `@${handleMatch[1]}` };
    }

    // Check for raw channelId: UC...
    if (clean.startsWith('UC') && clean.length >= 22) {
      return { channelId: clean };
    }

    // Fallback: assume raw video ID if 11 chars, otherwise handle
    if (clean.length === 11 && !clean.includes(' ')) {
      return { liveId: clean };
    }

    // Default to handle if prefixed or not
    return { handle: clean.startsWith('@') ? clean : `@${clean}` };
  }

  async connect(rawTarget) {
    this.isManuallyStopped = false;
    this.consecutiveErrors = 0;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    return this.startSession(rawTarget);
  }

  async startSession(rawTarget) {
    const targetObj = this.parseTarget(rawTarget);
    if (!targetObj) {
      throw new Error(`Target YouTube channel atau livestream tidak valid: "${rawTarget}"`);
    }

    if (this.liveChat) {
      try { this.liveChat.stop('Restarting session'); } catch (e) {}
      this.liveChat = null;
    }

    this.status = 'connecting';
    this.currentTarget = rawTarget;
    this.emit('status_change', { status: this.status, target: this.currentTarget });

    try {
      this.liveChat = new LiveChat(targetObj);
      this.setupListeners(this.liveChat);

      const ok = await this.liveChat.start();
      if (!ok) {
        throw new Error(`Tidak dapat memulai live chat untuk target "${rawTarget}". Pastikan channel sedang live streaming.`);
      }

      return true;
    } catch (err) {
      if (this.status !== 'reconnecting') {
        this.status = 'error';
        this.emit('status_change', { status: this.status, error: err.message });
      }
      throw err;
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
    this.consecutiveErrors = 0;
    this.reconnectAttempts = 0;
    this.emit('status_change', { status: this.status });
  }

  setupListeners(liveChat) {
    liveChat.on('start', (liveId) => {
      this.status = 'connected';
      this.activeLiveId = liveId;
      this.consecutiveErrors = 0;
      this.reconnectAttempts = 0;
      console.log(`[KY-Poni YouTube] Live Chat connected. Stream ID: ${liveId}`);
      this.emit('status_change', {
        status: this.status,
        target: this.currentTarget,
        liveId: this.activeLiveId,
      });
    });

    liveChat.on('end', (reason) => {
      console.log(`[KY-Poni YouTube] Live Chat ended: ${reason}`);
      if (!this.isManuallyStopped && this.currentTarget) {
        console.warn('[KY-Poni YouTube] Stream ended unexpectedly. Self-healing reconnect scheduled...');
        this.triggerSelfHealingReconnect();
      } else {
        this.status = 'idle';
        this.emit('status_change', { status: this.status, reason });
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
