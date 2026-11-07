/**
 * KY-Poni - Persona 3 Reload Theme Renderer Plugin (Triple-Hybrid Adaptation)
 * Implements Standard Theme Plugin Contract (THEME_SPEC.md).
 * 
 * Features:
 * - 3-Piece Hybrid Sliced Asset Skin (bubble_left.png, bubble_mid.png, bubble_right.png)
 * - Dynamic Status Badge: TALK / SUPER CHAT / NEW MEMBER
 * - Triple-Hybrid Adaptation: Dynamic Width (460px - 700px) + 4-Tier Height (128px - 208px)
 * - Auto-Fit Font Scaling: Prevents text clipping while preserving authentic P3R aerodynamic ratio (~3.4:1)
 * - Authentic Persona 3 Reload Tartarus Navy & Cyan Typography (Aganè font family)
 */

(function () {
  function escapeText(text) {
    const div = document.createElement('div');
    div.innerText = text || '';
    return div.innerHTML;
  }

  window.KYPoniTheme = {
    renderMessage(item, context) {
      const entry = document.createElement('div');
      const isSuperChat = item.type === 'superchat';
      const isMembership = item.type === 'membership';

      const rawText = (item.message || '').replace(/<[^>]*>/g, '').trim();
      const rawLength = rawText.length;
      const newlineCount = (rawText.match(/\n/g) || []).length;

      // 4-Tier Dynamic Classification based on content volume
      let tierClass = 'tier-1';
      if (rawLength > 175 || newlineCount >= 3) {
        tierClass = 'tier-4';
      } else if (rawLength > 115 || newlineCount >= 2) {
        tierClass = 'tier-3';
      } else if (rawLength > 55 || newlineCount >= 1 || isSuperChat || isMembership) {
        tierClass = 'tier-2';
      }

      entry.className = `chat-entry ${tierClass} ${isSuperChat ? 'is-superchat' : ''} ${isMembership ? 'is-membership' : ''}`;
      entry.id = `msg-${item.id}`;

      const bubble = document.createElement('div');
      bubble.className = `p3r-dialogue-bubble ${tierClass} ${tierClass !== 'tier-1' ? 'multiline' : ''}`;

      // A. 3-Piece Background Skin
      const skin = document.createElement('div');
      skin.className = 'p3r-skin';
      skin.innerHTML = `
        <div class="p3r-skin-left"></div>
        <div class="p3r-skin-mid"></div>
        <div class="p3r-skin-right"></div>
      `;
      bubble.appendChild(skin);

      // B. Header / Meta Information (Username + Status Badge)
      const meta = document.createElement('div');
      meta.className = 'p3r-meta';

      const username = document.createElement('span');
      username.className = 'p3r-username';
      username.innerText = item.author.name || 'Anonymous';

      const badge = document.createElement('span');
      if (isSuperChat && item.superchat) {
        badge.className = 'p3r-badge is-superchat-badge';
        badge.innerText = item.superchat.amount || 'SUPER CHAT';
      } else if (isMembership) {
        badge.className = 'p3r-badge is-member-badge';
        badge.innerText = 'NEW MEMBER';
      } else {
        badge.className = 'p3r-badge';
        badge.innerText = 'TALK';
      }

      meta.appendChild(username);
      meta.appendChild(badge);
      bubble.appendChild(meta);

      // C. Message Content Overlay
      const messageBox = document.createElement('div');
      messageBox.className = 'p3r-message-box';

      const messageText = document.createElement('div');
      messageText.className = 'p3r-message-text';

      // Custom font-size / font-color overrides from overlay context if provided
      if (context && context.fsize && Number(context.fsize) > 0) {
        const userScale = Number(context.fsize) / 16;
        if (tierClass === 'tier-4') {
          messageText.style.fontSize = `${0.86 * userScale}rem`;
        } else if (tierClass === 'tier-3') {
          messageText.style.fontSize = `${0.93 * userScale}rem`;
        } else if (tierClass === 'tier-2') {
          messageText.style.fontSize = `${1.02 * userScale}rem`;
        } else {
          messageText.style.fontSize = `${1.10 * userScale}rem`;
        }
      }
      if (context && context.color) {
        messageText.style.color = context.color;
      }

      messageText.innerHTML = escapeText(rawText);
      messageBox.appendChild(messageText);
      bubble.appendChild(messageBox);

      entry.appendChild(bubble);
      return entry;
    },

    onLoad(context) {
      console.log(`[P3R Theme] Persona 3 Reload Theme initialized with Triple-Hybrid Adaptation. Anchor: ${context.pos || 'bottom-left'}`);
    },

    onSpecialEvent(item, context) {
      console.log(`[P3R Theme] Special event received: ${item.type}`, item);
    }
  };
})();
