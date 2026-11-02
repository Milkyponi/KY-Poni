/**
 * KY-Poni - OBS Overlay Client Script
 * Authentic Persona 5 UI V2 (Tilted Square Avatar, Origami Ribbon, Slanted Colored Tabs, Two-Tier Banners)
 * Handles 4 Screen Corners, Horizontal/Vertical Layouts, Smooth Slides, and Auto-Hide with "Keep Last N".
 */

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const theme = urlParams.get('theme') || 'persona5';
  const layout = urlParams.get('layout') || 'vertical';
  const pos = urlParams.get('pos') || 'bottom-left'; // 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
  const isTopPos = pos.startsWith('top-');
  const maxMessages = parseInt(urlParams.get('max') || '8', 10);
  const fadeSeconds = parseInt(urlParams.get('fade') || '8', 10); // 0 = never hide
  const keepLastN = parseInt(urlParams.get('keep') !== null ? urlParams.get('keep') : '1', 10); // default keep 1

  // Live Customization Parameters
  const scale = parseFloat(urlParams.get('scale') || '100');
  const fsize = parseInt(urlParams.get('fsize') || '0', 10);
  const font = urlParams.get('font');
  const color = urlParams.get('color');

  if (scale && scale !== 100) {
    document.documentElement.style.setProperty('--canvas-scale', (scale / 100).toString());
  }
  if (fsize && fsize > 0) {
    document.documentElement.style.setProperty('--msg-font-size', `${fsize}px`);
  }
  if (font) {
    document.documentElement.style.setProperty('--msg-font-family', `'${font}', sans-serif`);
  }
  if (color) {
    const cleanColor = color.startsWith('#') ? color : `#${color}`;
    document.documentElement.style.setProperty('--msg-font-color', cleanColor);
  }

  // Apply layout and position classes
  const canvas = document.getElementById('chat-canvas');
  canvas.className = '';
  if (layout === 'horizontal') {
    canvas.classList.add('layout-horizontal');
  } else {
    canvas.classList.add('layout-vertical');
  }
  canvas.classList.add(`pos-${pos}`);

  // Load selected theme stylesheet
  const themeLink = document.getElementById('theme-stylesheet');
  if (themeLink) {
    themeLink.href = `/themes/${theme}/style.css`;
  }

  // Cut-in elements
  const cutinOverlay = document.getElementById('cutin-overlay');
  const cutinAvatar = document.getElementById('cutin-avatar');
  const cutinUsername = document.getElementById('cutin-username');
  const cutinAmount = document.getElementById('cutin-amount');
  const cutinMessage = document.getElementById('cutin-message');

  let cutinTimeout = null;

  function triggerCutin(item) {
    if (!cutinOverlay) return;

    if (cutinTimeout) {
      clearTimeout(cutinTimeout);
    }

    cutinAvatar.referrerPolicy = 'no-referrer';
    cutinAvatar.onerror = () => {
      cutinAvatar.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(item.author.name);
    };
    cutinAvatar.src = item.author.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=P5';
    cutinUsername.textContent = item.author.name;
    cutinAmount.textContent = item.superchat?.amount || 'SPECIAL REWARD';
    cutinMessage.innerHTML = item.message || 'Thank you for the phantom support!';

    cutinOverlay.classList.add('active');

    cutinTimeout = setTimeout(() => {
      cutinOverlay.classList.remove('active');
    }, 4500);
  }

  // Get active (non-exiting) chat entries
  function getActiveEntries() {
    return Array.from(canvas.querySelectorAll('.chat-entry')).filter(
      (el) => !el.classList.contains('is-exiting')
    );
  }

  // Animate and remove an entry
  function animateAndRemove(entry) {
    if (!entry || entry.classList.contains('is-exiting')) return;
    entry.classList.add('is-exiting');
    setTimeout(() => {
      if (entry.parentNode) {
        entry.parentNode.removeChild(entry);
      }
    }, 450);
  }

  // Clean up any previously expired entries if active count exceeds keepLastN
  function flushExpiredEntries() {
    if (fadeSeconds <= 0) return;
    const active = getActiveEntries();
    let excess = active.length - keepLastN;
    if (excess <= 0) return;

    if (isTopPos) {
      for (let i = active.length - 1; i >= 0; i--) {
        const entry = active[i];
        if (entry.dataset.expired === 'true' && excess > 0) {
          animateAndRemove(entry);
          excess--;
        }
      }
    } else {
      for (const entry of active) {
        if (entry.dataset.expired === 'true' && excess > 0) {
          animateAndRemove(entry);
          excess--;
        }
      }
    }
  }

  function appendChatMessage(item) {
    // 1. Enforce maxMessages limit
    const existing = getActiveEntries();
    if (existing.length >= maxMessages) {
      if (isTopPos) {
        animateAndRemove(existing[existing.length - 1]);
      } else {
        animateAndRemove(existing[0]);
      }
    }

    // 2. Build DOM element based on message type
    const entry = document.createElement('div');
    entry.className = `chat-entry ${item.type === 'superchat' ? 'is-superchat' : ''} ${item.type === 'membership' ? 'is-membership' : ''}`;
    entry.id = `msg-${item.id}`;

    if (item.type === 'superchat' && item.superchat) {
      // Two-Tier Slanted Red Banner (Image 2)
      const bannerBox = document.createElement('div');
      bannerBox.className = 'p5-banner-box banner-superchat';

      const header = document.createElement('div');
      header.className = 'p5-banner-header';
      header.innerHTML = `
        <div class="banner-user">${escapeText(item.author.name)}</div>
        <div class="banner-amount">${escapeText(item.superchat.amount)}</div>
        <div class="p5-shard-accent"></div>
      `;
      bannerBox.appendChild(header);

      const body = document.createElement('div');
      body.className = 'p5-banner-body';
      body.innerHTML = `<div class="message-text">${item.message}</div>`;
      bannerBox.appendChild(body);

      entry.appendChild(bannerBox);
    } else if (item.type === 'membership') {
      // Two-Tier Slanted Green Banner (Image 2)
      const bannerBox = document.createElement('div');
      bannerBox.className = 'p5-banner-box banner-membership';

      const header = document.createElement('div');
      header.className = 'p5-banner-header';
      header.innerHTML = `
        <div class="banner-user-group">
          <div class="banner-user">${escapeText(item.author.name)}</div>
          <div class="banner-subtext">WELCOME TO MEMBERSHIP</div>
        </div>
        <div class="p5-shard-accent"></div>
      `;
      bannerBox.appendChild(header);

      const body = document.createElement('div');
      body.className = 'p5-banner-body';
      body.innerHTML = `<div class="message-text">${item.message}</div>`;
      bannerBox.appendChild(body);

      entry.appendChild(bannerBox);
    } else {
      // Regular Chat: Tilted Square Polaroid Avatar + Origami Ribbon + Slanted Colored Tag

      // A. Avatar Slot
      const avatarSlot = document.createElement('div');
      avatarSlot.className = 'p5-avatar-slot';

      const avatarImg = document.createElement('img');
      avatarImg.className = 'author-avatar';
      avatarImg.referrerPolicy = 'no-referrer';
      avatarImg.onerror = () => {
        avatarImg.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(item.author.name);
      };
      avatarImg.src = item.author.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(item.author.name);
      avatarImg.alt = item.author.name;
      avatarSlot.appendChild(avatarImg);

      const shard = document.createElement('div');
      shard.className = 'p5-avatar-shard';
      avatarSlot.appendChild(shard);

      entry.appendChild(avatarSlot);

      // B. Bubble Container
      const bubbleContainer = document.createElement('div');
      bubbleContainer.className = 'p5-bubble-container';

      // Pick tag color class (Purple, Teal, Yellow, White, Red)
      let tagColor = 'tag-purple';
      if (item.author.badges && item.author.badges.some(b => b.type === 'owner')) {
        tagColor = 'tag-red';
      } else if (item.author.badges && item.author.badges.some(b => b.type === 'mod')) {
        tagColor = 'tag-teal';
      } else if (item.author.badges && item.author.badges.some(b => b.type === 'member')) {
        tagColor = 'tag-yellow';
      } else {
        const palette = ['tag-purple', 'tag-teal', 'tag-yellow', 'tag-white'];
        const hash = (item.author.name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        tagColor = palette[hash % palette.length];
      }

      // Author Tab (Slanted Tab on top border)
      const authorTab = document.createElement('div');
      authorTab.className = `author-tab ${tagColor}`;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'author-name';
      nameSpan.textContent = item.author.name;
      authorTab.appendChild(nameSpan);

      if (Array.isArray(item.author.badges)) {
        item.author.badges.forEach((b) => {
          const badgeSpan = document.createElement('span');
          badgeSpan.className = `author-badge badge-${b.type}`;
          badgeSpan.textContent = b.label || b.type.toUpperCase();
          authorTab.appendChild(badgeSpan);
        });
      }
      bubbleContainer.appendChild(authorTab);

      // Speech Bubble Body (Black Origami Ribbon with folded corner tab)
      const bubbleBody = document.createElement('div');
      bubbleBody.className = 'bubble-body';

      const foldedTab = document.createElement('div');
      foldedTab.className = 'p5-folded-tab';
      bubbleBody.appendChild(foldedTab);

      const msgSpan = document.createElement('div');
      msgSpan.className = 'message-text';
      msgSpan.innerHTML = item.message;
      bubbleBody.appendChild(msgSpan);

      const tail = document.createElement('div');
      tail.className = 'p5-bubble-tail';
      bubbleBody.appendChild(tail);

      bubbleContainer.appendChild(bubbleBody);
      entry.appendChild(bubbleContainer);
    }

    // 3. Insert into canvas (prepend for top, append for bottom)
    if (isTopPos) {
      canvas.prepend(entry);
    } else {
      canvas.appendChild(entry);
    }

    // 4. Flush any older expired entries now that a new message has arrived
    flushExpiredEntries();

    // 5. Smooth scroll / slide
    if (layout === 'horizontal') {
      canvas.scrollTo({
        left: canvas.scrollWidth,
        behavior: 'smooth',
      });
    } else {
      if (isTopPos) {
        canvas.scrollTop = 0;
      } else {
        canvas.scrollTop = canvas.scrollHeight;
      }
    }

    // 6. Schedule Auto-Hide Timer
    if (fadeSeconds > 0) {
      setTimeout(() => {
        const active = getActiveEntries();
        if (active.length > keepLastN) {
          animateAndRemove(entry);
        } else {
          entry.dataset.expired = 'true';
        }
      }, fadeSeconds * 1000);
    }

    // 7. Trigger cutin for Super Chat
    if (item.type === 'superchat') {
      triggerCutin(item);
    }
  }

  function escapeText(text) {
    const div = document.createElement('div');
    div.innerText = text || '';
    return div.innerHTML;
  }

  // WebSocket Connection
  let ws = null;
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[KY-Poni Overlay] Connected to WebSocket broadcaster.');
      ws.send(JSON.stringify({ type: 'REGISTER_OVERLAY', theme, layout, pos }));
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'CHAT_MESSAGE') {
          appendChatMessage(payload.data);
        } else if (payload.type === 'TRIGGER_CUTIN') {
          triggerCutin(payload.data);
        }
      } catch (e) {
        console.error('[KY-Poni Overlay] Error parsing WS event:', e);
      }
    };

    ws.onclose = () => {
      console.warn('[KY-Poni Overlay] Connection closed. Reconnecting in 3s...');
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error('[KY-Poni Overlay] WS error:', err);
      ws.close();
    };
  }

  connectWebSocket();
})();
