/**
 * KY-Poni - OBS Overlay Client Script
 * Authentic Persona 5 UI V4 (Game-Asset Sliced 3-Piece Bubble, Ransom Nameplate)
 * Handles 4 Screen Corners, Horizontal/Vertical Layouts, Smooth Slides, and Auto-Hide with "Keep Last N".
 */

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const theme = urlParams.get('theme') || 'persona5';
  const layout = urlParams.get('layout') || 'vertical';
  const pos = urlParams.get('pos') || 'bottom-left'; // 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
  const isHorizontal = layout.startsWith('horizontal');
  const isRightPos = pos.endsWith('-right');
  const isTopPos = pos.startsWith('top-');

  // In horizontal mode: Left anchors (bottom-left, top-left) MUST prepend so new chat is at the left anchor and pushes older chats rightward.
  // Right anchors (bottom-right, top-right) MUST append so new chat is at the right anchor and pushes older chats leftward.
  // In vertical mode: Top anchors prepend (pushes down), Bottom anchors append (pushes up).
  const isPrependFlow = isHorizontal ? !isRightPos : isTopPos;

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
  if (layout.startsWith('horizontal')) {
    canvas.classList.add('layout-horizontal');
  } else {
    canvas.classList.add('layout-vertical');
  }
  if (layout === 'fullscreen') {
    canvas.classList.add('layout-fullscreen');
  }
  canvas.classList.add(`pos-${pos}`);

  // Load selected theme stylesheet
  const themeLink = document.getElementById('theme-stylesheet');
  if (themeLink) {
    themeLink.href = `/themes/${theme}/style.css`;
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

    if (isPrependFlow) {
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
      if (isPrependFlow) {
        animateAndRemove(existing[existing.length - 1]);
      } else {
        animateAndRemove(existing[0]);
      }
    }

    // 2. Build DOM element based on active theme
    const entry = document.createElement('div');
    entry.className = `chat-entry ${item.type === 'superchat' ? 'is-superchat' : ''} ${item.type === 'membership' ? 'is-membership' : ''}`;
    entry.id = `msg-${item.id}`;

    if (theme === 'persona5') {
      // ========================================================
      // Authentic Persona 5 Dialogue Bubble (Asset-Based Sliced)
      // ========================================================
      const rawText = (item.message || '').replace(/<[^>]*>/g, '').trim();
      const isMultiline = rawText.length > 28 || rawText.includes('\n') || (item.type === 'superchat');

      const bubble = document.createElement('div');
      bubble.className = `p5-dialogue-bubble ${isMultiline ? 'multiline' : ''}`;

      // A. 3-Piece Background Skin
      const skin = document.createElement('div');
      skin.className = 'p5-skin';
      skin.innerHTML = `
        <div class="p5-skin-left"></div>
        <div class="p5-skin-mid"></div>
        <div class="p5-skin-right"></div>
      `;
      bubble.appendChild(skin);

      // B. Nameplate with Ransom-Note Letter Styling
      const nameplate = document.createElement('div');
      nameplate.className = 'p5-nameplate';

      const rawName = (item.author.name || 'ANON').toUpperCase();
      // Pick one letter for the red ransom box (deterministic hash or index 1)
      let redIdx = 1;
      if (rawName.length > 3) {
        const hash = rawName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        redIdx = 1 + (hash % Math.max(1, rawName.length - 2));
      } else if (rawName.length <= 1) {
        redIdx = 0;
      }

      let nameHtml = '';
      for (let i = 0; i < rawName.length; i++) {
        const char = rawName[i];
        if (char === ' ') {
          nameHtml += '<span class="p5-char-space">&nbsp;</span>';
          continue;
        }
        const rot = ((i * 3 + char.charCodeAt(0)) % 5) - 2;
        if (i === redIdx) {
          nameHtml += `<span class="p5-char ransom-red">${escapeText(char)}</span>`;
        } else {
          nameHtml += `<span class="p5-char" style="--r: ${rot};">${escapeText(char)}</span>`;
        }
      }
      nameplate.innerHTML = nameHtml;
      bubble.appendChild(nameplate);

      // C. Message Content Overlay (Inside Safe Black Panel)
      const messageBox = document.createElement('div');
      messageBox.className = 'p5-message-box';

      let prefixHtml = '';
      if (item.type === 'superchat' && item.superchat) {
        prefixHtml = `<span class="p5-badge-amount">${escapeText(item.superchat.amount)}</span>`;
      } else if (item.type === 'membership') {
        prefixHtml = `<span class="p5-badge-member">NEW MEMBER</span>`;
      }

      const messageText = document.createElement('div');
      messageText.className = 'p5-message-text';
      messageText.innerHTML = prefixHtml + item.message;
      messageBox.appendChild(messageText);

      bubble.appendChild(messageBox);
      entry.appendChild(bubble);

    } else {
      // ========================================================
      // Classic Clean Translucent Theme
      // ========================================================
      const authorTab = document.createElement('div');
      authorTab.className = 'author-tab';

      if (item.author.avatar) {
        const avatar = document.createElement('img');
        avatar.className = 'author-avatar';
        avatar.referrerPolicy = 'no-referrer';
        avatar.src = item.author.avatar;
        avatar.alt = item.author.name;
        avatar.onerror = () => { avatar.style.display = 'none'; };
        authorTab.appendChild(avatar);
      }

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
      entry.appendChild(authorTab);

      const bubbleBody = document.createElement('div');
      bubbleBody.className = 'bubble-body';

      if (item.type === 'superchat' && item.superchat) {
        const scAmount = document.createElement('div');
        scAmount.className = 'superchat-amount-banner';
        scAmount.textContent = item.superchat.amount;
        bubbleBody.appendChild(scAmount);
      } else if (item.type === 'membership') {
        const memBanner = document.createElement('div');
        memBanner.className = 'superchat-amount-banner';
        memBanner.textContent = '★ NEW MEMBER';
        bubbleBody.appendChild(memBanner);
      }

      const msgSpan = document.createElement('div');
      msgSpan.className = 'message-text';
      msgSpan.innerHTML = item.message;
      bubbleBody.appendChild(msgSpan);

      entry.appendChild(bubbleBody);
    }

    // 3. Insert into canvas (prepend vs append based on anchor flow)
    if (isPrependFlow) {
      canvas.prepend(entry);
    } else {
      canvas.appendChild(entry);
    }

    // 4. Flush any older expired entries now that a new message has arrived
    flushExpiredEntries();

    // 5. Smooth scroll / slide
    if (isHorizontal) {
      if (isRightPos) {
        canvas.scrollTo({
          left: canvas.scrollWidth,
          behavior: 'smooth',
        });
      } else {
        canvas.scrollTo({
          left: 0,
          behavior: 'smooth',
        });
      }
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

  // Optional Test Seed via ?test=p5 or ?demo=1
  if (urlParams.get('test') === 'p5' || urlParams.get('demo') === '1') {
    appendChatMessage({ id: 'test-1', author: { name: 'Sae' }, message: 'The P5 Generator rocks, baby!' });
    appendChatMessage({ id: 'test-2', author: { name: 'Ren' }, message: "I should write something. I'll just add this." });
    appendChatMessage({ id: 'test-3', author: { name: 'Joker' }, message: 'Take your time.' });
  }
})();
