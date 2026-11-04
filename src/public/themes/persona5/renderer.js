/**
 * KY-Poni - Persona 5 Theme Renderer Plugin
 * Implements Standard Theme Plugin Contract (THEME_SPEC.md).
 * 
 * Features:
 * - 3-Piece Hybrid Sliced Asset Skin (bubble_left.png, bubble_mid.png, bubble_right.png)
 * - Persona 5 Ransom-Note Nameplate with dynamic Red Tile accent
 * - Dynamic 3-Tier Height Adaptation (tier-1 165px, tier-2 200px, tier-3 235px)
 * - Auto-Fit Font Scaling for long messages (anti-clipping / zero-overflow)
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
      entry.className = `chat-entry ${item.type === 'superchat' ? 'is-superchat' : ''} ${item.type === 'membership' ? 'is-membership' : ''}`;
      entry.id = `msg-${item.id}`;

      const rawText = (item.message || '').replace(/<[^>]*>/g, '').trim();
      const rawLength = rawText.length;

      // Dynamic 3-Tier Height Classification based on content volume
      let tierClass = 'tier-1';
      if (rawLength > 110 || (rawText.match(/\n/g) || []).length >= 2) {
        tierClass = 'tier-3';
      } else if (rawLength > 55 || rawText.includes('\n') || (item.type === 'superchat') || (item.type === 'membership')) {
        tierClass = 'tier-2';
      }

      const bubble = document.createElement('div');
      bubble.className = `p5-dialogue-bubble ${tierClass} ${tierClass !== 'tier-1' ? 'multiline' : ''}`;

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
      if (rawName.length > 11) {
        nameplate.style.fontSize = '10.5px';
      } else if (rawName.length > 8) {
        nameplate.style.fontSize = '12px';
      }

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

      // Auto-fit font scaling so text remains 100% enclosed without border breaches
      const fsize = context && context.fsize;
      if (fsize && fsize > 0) {
        let effFsize = fsize;
        if (rawLength > 120) {
          effFsize = Math.min(fsize, 15);
        } else if (rawLength > 70) {
          effFsize = Math.min(fsize, 18);
        }
        messageText.style.fontSize = `${effFsize}px`;
      } else {
        if (rawLength > 120) {
          messageText.style.fontSize = '0.98rem';
        } else if (rawLength > 70) {
          messageText.style.fontSize = '1.08rem';
        } else {
          messageText.style.fontSize = '1.18rem';
        }
      }

      messageText.innerHTML = prefixHtml + item.message;
      messageBox.appendChild(messageText);

      bubble.appendChild(messageBox);
      entry.appendChild(bubble);

      return entry;
    },

    onLoad(context) {
      console.log(`[Persona 5 Theme] Theme initialized successfully with layout: ${context.layout}`);
    }
  };
})();
