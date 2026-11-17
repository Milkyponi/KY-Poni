/**
 * KY-Poni - Persona 5 Theme Renderer Plugin (9-Slice PhotoCraft PNG Original)
 * Implements Standard Theme Plugin Contract (THEME_SPEC.md).
 *
 * Features:
 * - 100% Original PNG Assets (3-piece compact <=128px + 9-slice PhotoCraft >=148px)
 * - Left zig-zag ornament & right white wedge locked 1:1 (zero stretching/distortion)
 * - Origami-Anchored Nameplate locked on white ribbon across all tiers
 * - Font-size-aware tiering & ResizeObserver auto-expansion (zero clipping)
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

      const fsize = (context && Number(context.fsize) > 0) ? Number(context.fsize) : 16;
      const fontFactor = Math.max(1, fsize / 16);
      const badgeBonus = (isSuperChat ? 24 : 0) + (isMembership ? 22 : 0);
      const effectiveLength = Math.round(rawLength * fontFactor) + badgeBonus;

      // 4-Tier Dynamic Width Classification (font-size-aware)
      let tierClass = 'tier-1';
      if (effectiveLength > 175 || newlineCount >= 3) {
        tierClass = 'tier-4';
      } else if (effectiveLength > 115 || newlineCount >= 2) {
        tierClass = 'tier-3';
      } else if (effectiveLength > 55 || newlineCount >= 1 || isSuperChat || isMembership) {
        tierClass = 'tier-2';
      }

      const isHorizontal = context && context.layout === 'horizontal';
      const startTall = tierClass !== 'tier-1' || (fsize >= 18 && rawLength > 24) || (isHorizontal && rawLength > 24);

      entry.className = `chat-entry ${tierClass} ${isSuperChat ? 'is-superchat' : ''} ${isMembership ? 'is-membership' : ''}`;
      entry.id = `msg-${item.id}`;

      const bubble = document.createElement('div');
      bubble.className = `p5-dialogue-bubble ${tierClass} ${tierClass !== 'tier-1' ? 'multiline' : ''} ${startTall ? 'is-tall' : ''}`.trim();

      // A1. 3-Piece Original PNG Skin (compact <= 128px)
      const skin = document.createElement('div');
      skin.className = 'p5-skin';
      skin.innerHTML = `
        <div class="p5-skin-left"></div>
        <div class="p5-skin-mid"></div>
        <div class="p5-skin-right"></div>
      `;
      bubble.appendChild(skin);

      // A2. 9-Slice PhotoCraft PNG Skin (tall >= 148px, left zig-zag & right wedge locked 1:1)
      const skin9 = document.createElement('div');
      skin9.className = 'p5-skin-9slice';
      skin9.innerHTML = `
        <div class="p5-9-col-left">
          <div class="p5-9-tl"></div>
          <div class="p5-9-ml"></div>
          <div class="p5-9-bl"></div>
        </div>
        <div class="p5-9-col-mid">
          <div class="p5-9-tm"></div>
          <div class="p5-9-mc"></div>
          <div class="p5-9-bm"></div>
        </div>
        <div class="p5-9-col-right">
          <div class="p5-9-tr"></div>
          <div class="p5-9-mr"></div>
          <div class="p5-9-br"></div>
        </div>
      `;
      bubble.appendChild(skin9);

      // B. Nameplate with Ransom-Note Letter Styling
      const nameplate = document.createElement('div');
      nameplate.className = 'p5-nameplate';

      const rawName = (item.author.name || 'ANON').toUpperCase();
      if (rawName.length > 11) {
        nameplate.style.fontSize = '10.5px';
      } else if (rawName.length > 8) {
        nameplate.style.fontSize = '12px';
      }

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
      messageText.style.fontSize = `${fsize}px`;

      messageText.innerHTML = prefixHtml + item.message;
      messageBox.appendChild(messageText);
      bubble.appendChild(messageBox);
      entry.appendChild(bubble);

      // Auto-promote to 9-slice tall skin if rendered text wraps beyond 128px
      const promoteIfTall = () => {
        if (!bubble.classList.contains('is-tall') && bubble.offsetHeight > 130) {
          bubble.classList.add('is-tall');
        }
      };
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(promoteIfTall);
        ro.observe(messageBox);
      }
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(promoteIfTall);
      }

      return entry;
    },

    onLoad(context) {
      console.log(`[Persona 5 Theme] Theme initialized with 9-Slice PhotoCraft PNG Original. Layout: ${context.layout}`);
    }
  };
})();
