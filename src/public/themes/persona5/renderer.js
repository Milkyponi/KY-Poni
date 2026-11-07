/**
 * KY-Poni - Persona 5 Theme Renderer Plugin (Origami-Anchored Hybrid Stretch)
 * Implements Standard Theme Plugin Contract (THEME_SPEC.md).
 * 
 * Features:
 * - 3-Piece Hybrid Sliced Asset Skin with Fixed Width Caps (155px)
 * - Origami-Anchored Nameplate (Fixed physical positioning on white ribbon)
 * - Centered Vertical Anchor & Snug-Fit 4-Tier Progression
 * - Auto-Fit Font Scaling for long messages (Zero-Clipping up to 250+ chars)
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
      if (isSuperChat && item.superchat) {
        prefixHtml = `<span class="p5-badge-amount">${escapeText(item.superchat.amount)}</span>`;
      } else if (isMembership) {
        prefixHtml = `<span class="p5-badge-member">NEW MEMBER</span>`;
      }

      const messageText = document.createElement('div');
      messageText.className = 'p5-message-text';

      // Auto-fit font scaling so text remains 100% enclosed without border breaches
      const fsize = context && context.fsize;
      if (fsize && fsize > 0) {
        const userScale = Number(fsize) / 16;
        if (tierClass === 'tier-4') {
          messageText.style.fontSize = `${0.86 * userScale}rem`;
        } else if (tierClass === 'tier-3') {
          messageText.style.fontSize = `${0.94 * userScale}rem`;
        } else if (tierClass === 'tier-2') {
          messageText.style.fontSize = `${1.04 * userScale}rem`;
        } else {
          messageText.style.fontSize = `${1.15 * userScale}rem`;
        }
      } else {
        if (tierClass === 'tier-4') {
          messageText.style.fontSize = '0.86rem';
        } else if (tierClass === 'tier-3') {
          messageText.style.fontSize = '0.94rem';
        } else if (tierClass === 'tier-2') {
          messageText.style.fontSize = '1.04rem';
        } else {
          messageText.style.fontSize = '1.15rem';
        }
      }

      messageText.innerHTML = prefixHtml + item.message;
      messageBox.appendChild(messageText);

      bubble.appendChild(messageBox);
      entry.appendChild(bubble);

      return entry;
    },

    onLoad(context) {
      console.log(`[Persona 5 Theme] Theme initialized with Origami-Anchored Hybrid Stretch. Layout: ${context.layout}`);
    }
  };
})();
