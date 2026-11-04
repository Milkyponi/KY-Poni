/**
 * KY-Poni - Classic Clean Translucent Theme Renderer Plugin
 * Implements Standard Theme Plugin Contract (THEME_SPEC.md).
 */

(function () {
  window.KYPoniTheme = {
    renderMessage(item, context) {
      const entry = document.createElement('div');
      entry.className = `chat-entry ${item.type === 'superchat' ? 'is-superchat' : ''} ${item.type === 'membership' ? 'is-membership' : ''}`;
      entry.id = `msg-${item.id}`;

      // Author Header Bar
      const authorTab = document.createElement('div');
      authorTab.className = 'author-tab';

      if (item.author && item.author.avatar) {
        const avatar = document.createElement('img');
        avatar.className = 'author-avatar';
        avatar.referrerPolicy = 'no-referrer';
        avatar.src = item.author.avatar;
        avatar.alt = item.author.name || 'User';
        avatar.onerror = () => { avatar.style.display = 'none'; };
        authorTab.appendChild(avatar);
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 'author-name';
      nameSpan.textContent = (item.author && item.author.name) || 'Anonymous';
      authorTab.appendChild(nameSpan);

      if (item.author && Array.isArray(item.author.badges)) {
        item.author.badges.forEach((b) => {
          const badgeSpan = document.createElement('span');
          badgeSpan.className = `author-badge badge-${b.type}`;
          badgeSpan.textContent = b.label || b.type.toUpperCase();
          authorTab.appendChild(badgeSpan);
        });
      }
      entry.appendChild(authorTab);

      // Translucent Bubble Body
      const bubbleBody = document.createElement('div');
      bubbleBody.className = 'bubble-body';

      if (item.type === 'superchat' && item.superchat) {
        const scAmount = document.createElement('div');
        scAmount.className = 'superchat-amount-banner';
        scAmount.textContent = item.superchat.amount;
        bubbleBody.appendChild(scAmount);
      } else if (item.type === 'membership') {
        const memBadge = document.createElement('div');
        memBadge.className = 'membership-badge-banner';
        memBadge.textContent = '★ NEW MEMBER';
        bubbleBody.appendChild(memBadge);
      }

      const msgSpan = document.createElement('div');
      msgSpan.className = 'message-text';
      msgSpan.innerHTML = item.message;
      bubbleBody.appendChild(msgSpan);

      entry.appendChild(bubbleBody);
      return entry;
    },

    onLoad(context) {
      console.log(`[Classic Theme] Theme initialized successfully.`);
    }
  };
})();
