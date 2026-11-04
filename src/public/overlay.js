/**
 * KY-Poni - Core OBS Overlay Client Engine
 * 
 * Open-Closed Architecture:
 * - Core Engine manages canvas positioning, directional horizontal/vertical insertion,
 *   auto-hide expiration timers, retention guards, and WebSocket event ingestion.
 * - Theme-specific DOM construction is delegated to dynamic theme plugins (/themes/:theme/renderer.js)
 *   implementing the standard Theme Plugin Contract (THEME_SPEC.md).
 */

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const theme = urlParams.get('theme') || 'persona5';
  const layout = urlParams.get('layout') || 'vertical';
  const pos = urlParams.get('pos') || 'bottom-left'; // 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
  const isHorizontal = layout.startsWith('horizontal');
  const isRightPos = pos.endsWith('-right');
  const isTopPos = pos.startsWith('top-');

  // Directional Flow:
  // - Horizontal left anchors (bottom-left, top-left) prepend so newest chat appears at anchor and pushes older rightward.
  // - Horizontal right anchors (bottom-right, top-right) append so newest chat appears at anchor and pushes older leftward.
  // - Vertical: top anchors prepend (pushes down), bottom anchors append (pushes up).
  const isPrependFlow = isHorizontal ? !isRightPos : isTopPos;

  const maxMessages = parseInt(urlParams.get('max') || '8', 10);
  const fadeSeconds = parseInt(urlParams.get('fade') || '8', 10); // 0 = never hide
  const keepLastN = parseInt(urlParams.get('keep') !== null ? urlParams.get('keep') : '1', 10); // default keep 1

  // Live Customization Parameters
  const scale = parseFloat(urlParams.get('scale') || '100');
  const fsize = parseInt(urlParams.get('fsize') || '0', 10);
  const font = urlParams.get('font');
  const color = urlParams.get('color');

  if (scale) {
    const scaleRatio = (scale / 100).toString();
    document.documentElement.style.setProperty('--overlay-scale', scaleRatio);
    document.documentElement.style.setProperty('--canvas-scale', scaleRatio);
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

  // Active Context passed to Theme Plugins
  const context = {
    theme,
    layout,
    pos,
    scale,
    fsize,
    font,
    color,
    fade: fadeSeconds,
    keep: keepLastN,
    max: maxMessages,
    isHorizontal,
    isRightPos,
    isTopPos,
    isPrependFlow,
  };

  // Setup Canvas Classes
  const canvas = document.getElementById('chat-canvas');
  const flow = document.getElementById('chat-flow') || canvas;
  canvas.className = '';
  if (isHorizontal) {
    canvas.classList.add('layout-horizontal');
  } else {
    canvas.classList.add('layout-vertical');
  }
  if (layout === 'fullscreen') {
    canvas.classList.add('layout-fullscreen');
  }
  canvas.classList.add(`pos-${pos}`);

  // Dynamic Theme Asset Loading (CSS + Renderer Plugin)
  const themeLink = document.getElementById('theme-stylesheet');
  if (themeLink) {
    themeLink.href = `/themes/${theme}/style.css`;
  }

  function loadThemePlugin(themeName) {
    const scriptId = 'theme-renderer-plugin';
    let existing = document.getElementById(scriptId);
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `/themes/${themeName}/renderer.js`;
    script.onload = () => {
      if (window.KYPoniTheme && typeof window.KYPoniTheme.onLoad === 'function') {
        window.KYPoniTheme.onLoad(context);
      }
    };
    script.onerror = () => {
      console.warn(`[KY-Poni Core] Could not load renderer.js for theme "${themeName}". Generic fallback will be used.`);
    };
    document.head.appendChild(script);
  }

  loadThemePlugin(theme);

  // Helper: Active (non-exiting) DOM entries
  function getActiveEntries() {
    return Array.from(flow.querySelectorAll('.chat-entry')).filter(
      (el) => !el.classList.contains('is-exiting')
    );
  }

  // Helper: Animate and remove an entry
  function animateAndRemove(entry) {
    if (!entry || entry.classList.contains('is-exiting')) return;
    entry.classList.add('is-exiting');
    setTimeout(() => {
      if (entry.parentNode) {
        entry.parentNode.removeChild(entry);
      }
    }, 450);
  }

  // Retention Guard: Clean up expired entries if active count exceeds keepLastN
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

  // Generic Fallback Renderer (if theme plugin is loading or unavailable)
  function renderFallbackMessage(item) {
    const entry = document.createElement('div');
    entry.className = `chat-entry ${item.type === 'superchat' ? 'is-superchat' : ''}`;
    entry.id = `msg-${item.id}`;

    const authorSpan = document.createElement('div');
    authorSpan.style.fontWeight = 'bold';
    authorSpan.textContent = (item.author && item.author.name) || 'User';

    const textSpan = document.createElement('div');
    textSpan.innerHTML = item.message || '';

    entry.appendChild(authorSpan);
    entry.appendChild(textSpan);
    return entry;
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

    // 2. Delegate DOM construction to Active Theme Plugin
    let entry = null;
    if (window.KYPoniTheme && typeof window.KYPoniTheme.renderMessage === 'function') {
      entry = window.KYPoniTheme.renderMessage(item, context);
    } else {
      entry = renderFallbackMessage(item);
    }

    // 3. Directional insertion into canvas (prepend vs append based on anchor flow)
    if (isPrependFlow) {
      flow.prepend(entry);
    } else {
      flow.appendChild(entry);
    }

    // 4. Flush older expired entries now that new message arrived
    flushExpiredEntries();

    // 5. Directional scroll alignment
    if (isHorizontal) {
      if (isRightPos) {
        canvas.scrollTo({ left: canvas.scrollWidth, behavior: 'smooth' });
      } else {
        canvas.scrollTo({ left: 0, behavior: 'smooth' });
      }
    } else {
      if (isTopPos) {
        canvas.scrollTop = 0;
      } else {
        canvas.scrollTop = canvas.scrollHeight;
      }
    }

    // 6. Schedule Auto-Hide Timer with Retention Guard
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

  // WebSocket Connection
  let ws = null;
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[KY-Poni Core Overlay] Connected to WebSocket broadcaster.');
      ws.send(JSON.stringify({ type: 'REGISTER_OVERLAY', theme, layout, pos }));
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'CHAT_MESSAGE') {
          appendChatMessage(payload.data);
        }
      } catch (e) {
        console.error('[KY-Poni Core Overlay] Error parsing WS event:', e);
      }
    };

    ws.onclose = () => {
      console.warn('[KY-Poni Core Overlay] Connection closed. Reconnecting in 3s...');
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error('[KY-Poni Core Overlay] WS error:', err);
      ws.close();
    };
  }

  connectWebSocket();

  // Test demo seed via ?test=p5 or ?demo=1
  if (urlParams.get('test') === 'p5' || urlParams.get('demo') === '1') {
    setTimeout(() => {
      appendChatMessage({ id: 'test-1', author: { name: 'Sae' }, message: 'The P5 Generator rocks, baby!' });
      appendChatMessage({ id: 'test-2', author: { name: 'Ren' }, message: "I should write something. I'll just add this." });
      appendChatMessage({ id: 'test-3', author: { name: 'Joker' }, message: 'Take your time.' });
    }, 500);
  }
})();
