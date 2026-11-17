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

      // Sumber teks: `rawText` (MENTAH), bukan `message`.
      //
      // Kontrak lintas renderer: `message` sudah di-escape di batas sistem
      // (youtube_ingest.simulateMessage) karena p5/classic/overlay menulisnya
      // lewat innerHTML. Renderer ini meng-escape sendiri di baris pemasangan
      // (escapeText), jadi kalau memakai `message` yang sudah ber-entitas hasilnya
      // DOUBLE ESCAPE: "&" tampil sebagai "&amp;" di layar.
      // `rawText` disediakan justru untuk konsumen seperti ini.
      const sourceText = item.rawText !== undefined && item.rawText !== null
        ? String(item.rawText)
        : String(item.message || '');
      const rawText = sourceText.replace(/<[^>]*>/g, '').trim();
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

      entry.className = `chat-entry ${tierClass} ${isSuperChat ? 'is-superchat' : ''} ${isMembership ? 'is-membership' : ''}`;
      entry.id = `msg-${item.id}`;

      const bubble = document.createElement('div');
      bubble.className = `p3r-dialogue-bubble ${tierClass} ${tierClass !== 'tier-1' ? 'multiline' : ''}`;

      // A. 9-Slice PhotoCraft PNG Original Skin (Fixed 127px / 124px caps)
      const skin = document.createElement('div');
      skin.className = 'p3r-skin-9slice';
      skin.innerHTML = `
        <div class="p3r-9-col-left">
          <div class="p3r-9-tl"></div>
          <div class="p3r-9-ml"></div>
          <div class="p3r-9-bl"></div>
        </div>
        <div class="p3r-9-col-mid">
          <div class="p3r-9-tm"></div>
          <div class="p3r-9-mc"></div>
          <div class="p3r-9-bm"></div>
        </div>
        <div class="p3r-9-col-right">
          <div class="p3r-9-tr"></div>
          <div class="p3r-9-mr"></div>
          <div class="p3r-9-br"></div>
        </div>
      `;
      bubble.appendChild(skin);

      // B. Header / Meta Information (Username #FBE837 + Status Badge)
      const meta = document.createElement('div');
      const isInlineBadge = isSuperChat || isMembership;
      meta.className = `p3r-meta ${isInlineBadge ? 'is-inline-badge' : ''}`.trim();

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

      // C. Message Content Overlay (Normal Flow, Zero Clipping)
      const messageBox = document.createElement('div');
      messageBox.className = 'p3r-message-box';

      const messageText = document.createElement('div');
      messageText.className = 'p3r-message-text';
      messageText.style.fontSize = `${fsize}px`;

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
