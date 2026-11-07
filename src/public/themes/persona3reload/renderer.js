/**
 * KY-Poni - Persona 3 Reload Theme Renderer Plugin
 * Implements Standard Theme Plugin Contract (THEME_SPEC.md).
 * 
 * Features:
 * - 3-Piece Hybrid Sliced Asset Skin (bubble_left.png, bubble_mid.png, bubble_right.png)
 * - Dynamic Status Badge: TALK / SUPER CHAT / NEW MEMBER
 * - Dynamic 3-Tier Height Adaptation (tier-1 128px, tier-2 148px, tier-3 172px)
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

      entry.className = `chat-entry ${isSuperChat ? 'is-superchat' : ''} ${isMembership ? 'is-membership' : ''}`;
      entry.id = `msg-${item.id}`;

      const rawText = (item.message || '').replace(/<[^>]*>/g, '').trim();
      const rawLength = rawText.length;

      // Dynamic 3-Tier Height Classification based on content volume
      let tierClass = 'tier-1';
      if (rawLength > 120 || (rawText.match(/\n/g) || []).length >= 2) {
        tierClass = 'tier-3';
      } else if (rawLength > 60 || rawText.includes('\n') || isSuperChat || isMembership) {
        tierClass = 'tier-2';
      }

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
        messageText.style.fontSize = `${Number(context.fsize) / 16}rem`;
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
      console.log(`[P3R Theme] Persona 3 Reload Theme successfully initialized. Anchor: ${context.pos || 'bottom-left'}`);
    },

    onSpecialEvent(item, context) {
      console.log(`[P3R Theme] Special event received: ${item.type}`, item);
    }
  };
})();
