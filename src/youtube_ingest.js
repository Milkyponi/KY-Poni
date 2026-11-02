/**
 * KY-Poni - YouTube Live Chat Ingest Worker
 * Uses reverse-engineered InnerTube protocol without Google API keys.
 */
const { EventEmitter } = require('events');
const { LiveChat } = require('youtube-chat');

class YouTubeChatIngest extends EventEmitter {
  constructor() {
    super();
    this.liveChat = null;
    this.status = 'idle'; // 'idle' | 'connecting' | 'connected' | 'error'
    this.currentTarget = null;
    this.activeLiveId = null;
    this.messageCount = 0;
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
    const targetObj = this.parseTarget(rawTarget);
    if (!targetObj) {
      throw new Error(`Target YouTube channel atau livestream tidak valid: "${rawTarget}"`);
    }

    if (this.liveChat) {
      await this.disconnect();
    }

    this.status = 'connecting';
    this.currentTarget = rawTarget;
    this.emit('status_change', { status: this.status, target: this.currentTarget });

    try {
      this.liveChat = new LiveChat(targetObj);

      this.liveChat.on('start', (liveId) => {
        this.status = 'connected';
        this.activeLiveId = liveId;
        this.emit('status_change', {
          status: this.status,
          target: this.currentTarget,
          liveId: this.activeLiveId,
        });
      });

      this.liveChat.on('end', (reason) => {
        this.status = 'idle';
        this.emit('status_change', { status: this.status, reason });
      });

      this.liveChat.on('chat', (chatItem) => {
        this.messageCount++;
        const standardized = this.standardizeChatItem(chatItem);
        this.emit('message', standardized);
      });

      this.liveChat.on('error', (err) => {
        console.error('[KY-Poni YouTube] Error:', err.message || err);
        this.status = 'error';
        this.emit('status_change', { status: this.status, error: err.message || String(err) });
      });

      const ok = await this.liveChat.start();
      if (!ok) {
        throw new Error(`Tidak dapat memulai live chat untuk target "${rawTarget}". Pastikan channel sedang live streaming.`);
      }

      return true;
    } catch (err) {
      this.status = 'error';
      this.emit('status_change', { status: this.status, error: err.message });
      throw err;
    }
  }

  async disconnect() {
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
    this.emit('status_change', { status: this.status });
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

    let result = {
      id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      author: {
        name: customData.author || 'PhantomViewer',
        channelId: 'UC_mock_user',
        avatar: customData.avatar || randomAvatar,
        badges: customData.badges || [],
      },
      message: customData.message || 'For real?! Ini beneran keren banget!',
      rawText: customData.rawText || customData.message || 'For real?!',
      superchat: null,
      timestamp: new Date().toISOString(),
    };

    if (type === 'superchat') {
      result.superchat = {
        amount: customData.amount || 'Rp 50.000',
        color: customData.color || '#E60012',
      };
      result.message = customData.message || 'Semangat live streamnya Bos! Lookin cool!';
    } else if (type === 'membership') {
      result.author.badges.push({ type: 'member', label: 'MEMBER' });
      result.message = customData.message || 'Baru saja bergabung menjadi anggota!';
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
