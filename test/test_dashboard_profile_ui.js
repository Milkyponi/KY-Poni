/**
 * KY-Poni - Channel Profile Card "Ganti" Edit-Lock Audit
 *
 * Regression under test
 * ---------------------
 * Clicking "Ganti" (btn-edit-target) opens the handle input form. Two background
 * heartbeats — the 5s `setInterval(pollStatus)` and the SYSTEM_STATUS message on
 * /ws — both call applyStreamStatus(), which used to unconditionally re-render the
 * channel profile card. So 1-5 seconds after the user started typing, the OLD
 * profile from the server yanked the dashboard back to the profile card and closed
 * the form mid-edit.
 *
 * The fix is `isEditingTarget`: a UI edit lock raised by showTargetInputForm(),
 * lowered by renderChannelProfile()/cancel/connect, and honoured by
 * applyStreamStatus().
 *
 * This suite does not just grep the source: it evaluates src/public/dashboard.js in
 * a `vm` sandbox with a DOM stub, then drives the real handlers (Ganti -> heartbeat
 * -> cancel -> connect) and asserts on actual style.display state.
 *
 * Run: node test/test_dashboard_profile_ui.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src', 'public', 'dashboard.js');
const source = fs.readFileSync(SRC, 'utf-8');

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
    console.log(`[FAIL] ${name}: ${err.message}`);
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
    console.log(`[FAIL] ${name}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Minimal DOM / browser stub
// ---------------------------------------------------------------------------

function makeElement(id = '') {
  const el = {
    id,
    tagName: 'DIV',
    value: '',
    innerHTML: '',
    textContent: '',
    disabled: false,
    src: '',
    options: [],
    children: [],
    dataset: {},
    _attrs: {},
    listeners: {},
    style: {
      _props: {},
      display: '',
      width: '',
      height: '',
      color: '',
      background: '',
      borderColor: '',
      setProperty(k, v) { this._props[k] = v; },
      getPropertyValue(k) { return this._props[k] || ''; },
    },
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
      toggle(c, on) { if (on === undefined ? !this._set.has(c) : on) this._set.add(c); else this._set.delete(c); },
    },
    addEventListener(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    },
    removeEventListener() {},
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
    setAttribute(k, v) { this._attrs[k] = v; },
    appendChild(child) { this.children.push(child); this.options.push(child); return child; },
    focus() { el._focused = true; },
    select() { el._selected = true; },
    remove() {},
    dispatchEvent() { return true; },
    getBoundingClientRect() { return { width: 800, height: 800, top: 0, left: 0 }; },
    closest() { return null; },
    click() {
      (el.listeners.click || []).forEach(fn => fn({ target: el }));
    },
    fire(type) {
      (el.listeners[type] || []).forEach(fn => fn({ target: el }));
    },
  };
  return el;
}

/**
 * Boots the dashboard inside a vm sandbox.
 *
 * @param {object} opts
 * @param {object} opts.config        body of GET /api/config
 * @param {object} opts.status        body of GET /api/status (and SYSTEM_STATUS payload)
 * @param {object} opts.connectResult body of POST /api/connect
 */
function bootDashboard(opts = {}) {
  const {
    config = {},
    status = { status: 'idle' },
    connectResult = { ok: true, profile: { title: 'NEW CHANNEL', handle: '@new' } },
  } = opts;

  const elements = new Map();
  const getEl = (id) => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };

  const intervals = [];
  const timeouts = [];

  const wsInstances = [];
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.onmessage = null;
      wsInstances.push(this);
    }
    send() {}
    close() {}
  }

  const fetchLog = [];
  async function fakeFetch(url, init = {}) {
    fetchLog.push({ url, method: (init.method || 'GET').toUpperCase(), body: init.body });
    const urlPath = String(url).split('?')[0];
    const json = (obj, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => obj });

    switch (urlPath) {
      case '/api/config':
        if ((init.method || 'GET').toUpperCase() === 'POST') {
          return json({ config: { ...config, ...(init.body ? JSON.parse(init.body) : {}) } });
        }
        return json(config);
      case '/api/themes':
        return json({ themes: [{ id: 'persona5', name: 'Persona 5', isBuiltIn: true }] });
      case '/api/catalog':
        return json({ themes: [] });
      case '/api/status':
        return json(status);
      case '/api/connect':
        return connectResult.ok === false
          ? json({ error: connectResult.error || 'gagal' }, false)
          : json(connectResult);
      case '/api/disconnect':
        return json({ ok: true });
      case '/api/updater/check':
        return json({ updateAvailable: false }, false);
      default:
        return json({});
    }
  }

  const sandbox = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    document: {
      getElementById: (id) => getEl(id),
      querySelector: (sel) => (sel === '.canvas-viewport' ? getEl('__canvas-viewport') : null),
      querySelectorAll: () => {
        const list = [];
        list.forEach = Array.prototype.forEach.bind(list);
        return list;
      },
      createElement: (tag) => {
        const el = makeElement();
        el.tagName = String(tag).toUpperCase();
        return el;
      },
      execCommand: () => true,
      addEventListener() {},
      body: makeElement('body'),
    },
    window: {
      location: { origin: 'http://127.0.0.1:3131', protocol: 'http:', host: '127.0.0.1:3131', href: 'http://127.0.0.1:3131/' },
      addEventListener() {},
      removeEventListener() {},
      ResizeObserver: class { observe() {} disconnect() {} },
    },
    navigator: { clipboard: { writeText: async () => {} } },
    localStorage: {
      _m: new Map(),
      getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
      setItem(k, v) { this._m.set(k, String(v)); },
      removeItem(k) { this._m.delete(k); },
    },
    fetch: fakeFetch,
    WebSocket: FakeWebSocket,
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
    clearInterval: () => {},
    setTimeout: (fn, ms) => { const t = { fn, ms }; timeouts.push(t); return timeouts.length; },
    clearTimeout: () => {},
    URLSearchParams,
    Map,
    Promise,
    alert: () => {},
    confirm: () => true,
  };
  sandbox.globalThis = sandbox;
  sandbox.window.document = sandbox.document;

  const context = vm.createContext(sandbox);

  // Expose the internals we need. The module-scoped `let isEditingTarget` is NOT a
  // property of the sandbox global, so we append an accessor that closes over it.
  const instrumented = `${source}
;globalThis.__ky = {
  get isEditingTarget() { return isEditingTarget; },
  set isEditingTarget(v) { isEditingTarget = v; },
  get currentChannelProfile() { return currentChannelProfile; },
  get isBootstrapping() { return isBootstrapping; },
  applyStreamStatus,
  renderChannelProfile,
  showTargetInputForm,
  pollStatus,
};`;

  vm.runInContext(instrumented, context, { filename: 'dashboard.js' });

  return { getEl, sandbox, intervals, timeouts, wsInstances, fetchLog, ky: sandbox.__ky };
}

/** Lets the startup IIFE's promise chain drain. */
async function flush(rounds = 8) {
  for (let i = 0; i < rounds; i++) {
    await new Promise((r) => setImmediate(r));
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

(async () => {
  console.log('🧪 KY-Poni Channel Profile Edit-Lock Audit\n');

  // =========================================================================
  // Part 1 - static contract (fails fast, names the missing guard)
  // =========================================================================

  check('isEditingTarget is declared exactly once', () => {
    const decls = source.match(/let\s+isEditingTarget\s*=\s*false/g) || [];
    assert.strictEqual(decls.length, 1,
      `expected exactly one declaration, found ${decls.length} (a duplicate is a hard SyntaxError)`);
  });

  check('Declaration sits next to currentChannelProfile', () => {
    const anchor = source.indexOf('let currentChannelProfile = null;');
    const decl = source.indexOf('let isEditingTarget = false;');
    assert.notStrictEqual(anchor, -1, 'currentChannelProfile declaration missing');
    assert.notStrictEqual(decl, -1, 'isEditingTarget declaration missing');
    assert.ok(decl > anchor && decl - anchor < 900, 'edit lock must be declared beside currentChannelProfile');
  });

  check('showTargetInputForm() raises the edit lock', () => {
    const start = source.indexOf('function showTargetInputForm(');
    assert.notStrictEqual(start, -1, 'showTargetInputForm missing');
    const body = source.slice(start, source.indexOf('if (btnEditTarget)', start));
    assert.ok(/isEditingTarget\s*=\s*true/.test(body), 'opening the form must lock edit mode');
  });

  check('renderChannelProfile() clears the edit lock', () => {
    const start = source.indexOf('function renderChannelProfile(');
    assert.notStrictEqual(start, -1, 'renderChannelProfile missing');
    const body = source.slice(start, source.indexOf('function showTargetInputForm(', start));
    assert.ok(/isEditingTarget\s*=\s*false/.test(body), 'rendering the card must end edit mode');
  });

  check('btnCancelEdit handler clears the edit lock', () => {
    const start = source.indexOf("btnCancelEdit.addEventListener('click'");
    assert.notStrictEqual(start, -1, 'btnCancelEdit click handler missing');
    const body = source.slice(start, start + 400);
    assert.ok(/isEditingTarget\s*=\s*false/.test(body), 'cancelling must end edit mode');
  });

  check('btnConnect handler clears the edit lock', () => {
    const start = source.indexOf("btnConnect.addEventListener('click'");
    assert.notStrictEqual(start, -1, 'btnConnect click handler missing');
    const body = source.slice(start, source.indexOf('btnDisconnect.addEventListener', start));
    assert.ok(/isEditingTarget\s*=\s*false/.test(body), 'a successful connect must end edit mode');
  });

  check('applyStreamStatus() guards the profile render with !isEditingTarget', () => {
    const start = source.indexOf('function applyStreamStatus(');
    assert.notStrictEqual(start, -1, 'applyStreamStatus missing');
    const body = source.slice(start, source.indexOf('async function pollStatus(', start));
    assert.ok(/if\s*\(\s*data\.profile\s*&&\s*!isEditingTarget\s*\)/.test(body),
      'background status must not re-render the profile card while the user is editing');
    assert.ok(!/if\s*\(\s*data\.profile\s*\)\s*\{/.test(body),
      'the unguarded `if (data.profile)` form must not come back');
  });

  check('Boot opens the form without locking edit mode', () => {
    // With no saved target the empty form IS the resting state; locking it would
    // block autoconnect from ever painting the card.
    const start = source.indexOf('async function applyConfigToUI(');
    const body = source.slice(start, source.indexOf('// Copy URL', start));
    const formCall = body.match(/showTargetInputForm\(\s*false\s*(,\s*false\s*)?\)/g) || [];
    assert.ok(formCall.length > 0, 'boot must call showTargetInputForm(false)');
    assert.ok(formCall.some(c => /,\s*false\s*\)/.test(c)),
      'boot must pass markEditing=false so a later autoconnect can render the card');
  });

  // =========================================================================
  // Part 2 - behavioural: real handlers, real DOM stub
  // =========================================================================

  await checkAsync('Boot with a saved profile renders the card and clears the lock', async () => {
    const saved = { target: '@old', channelProfile: { title: 'OLD CHANNEL', handle: '@old', avatar: 'http://x/a.png' } };
    const h = bootDashboard({ config: saved });
    await flush();

    assert.strictEqual(h.getEl('yt-profile-view').style.display, 'block', 'profile card should be visible');
    assert.strictEqual(h.getEl('yt-input-view').style.display, 'none', 'input form should be hidden');
    assert.strictEqual(h.getEl('profile-title').textContent, 'OLD CHANNEL', 'card should show the saved channel');
    assert.strictEqual(h.ky.isEditingTarget, false, 'boot must not leave the lock raised');
  });

  await checkAsync('Clicking "Ganti" opens the form and raises the lock', async () => {
    const saved = { target: '@old', channelProfile: { title: 'OLD CHANNEL', handle: '@old' } };
    const h = bootDashboard({ config: saved });
    await flush();

    h.getEl('btn-edit-target').click();

    assert.strictEqual(h.getEl('yt-input-view').style.display, 'block', 'form must open');
    assert.strictEqual(h.getEl('yt-profile-view').style.display, 'none', 'card must collapse');
    assert.strictEqual(h.ky.isEditingTarget, true, 'edit lock must be raised');
    assert.strictEqual(h.getEl('btn-cancel-edit').style.display, 'inline-flex', '"Batal" must be offered');
  });

  await checkAsync('THE BUG: background poll mid-edit does not steal the form back', async () => {
    const saved = { target: '@old', channelProfile: { title: 'OLD CHANNEL', handle: '@old' } };
    const h = bootDashboard({ config: saved, status: { status: 'connected', target: '@old', profile: { title: 'OLD CHANNEL', handle: '@old' } } });
    await flush();

    h.getEl('btn-edit-target').click();
    h.getEl('yt-target').value = '@brand-new';

    // This is exactly what the 5s heartbeat delivers after the user clicks "Ganti".
    await h.ky.pollStatus();

    assert.strictEqual(h.getEl('yt-input-view').style.display, 'block',
      'heartbeat must NOT close the input form (this is the reported bug)');
    assert.strictEqual(h.getEl('yt-profile-view').style.display, 'none',
      'heartbeat must NOT re-show the old profile card');
    assert.strictEqual(h.getEl('yt-target').value, '@brand-new', 'typed handle must be preserved');
    assert.strictEqual(h.ky.isEditingTarget, true, 'lock must survive the heartbeat');
  });

  await checkAsync('The WebSocket SYSTEM_STATUS path is guarded too', async () => {
    const saved = { target: '@old', channelProfile: { title: 'OLD CHANNEL', handle: '@old' } };
    const h = bootDashboard({ config: saved });
    await flush();

    h.getEl('btn-edit-target').click();
    assert.strictEqual(h.wsInstances.length, 1, 'dashboard should open exactly one status WebSocket');

    // Same event the server pushes on a status change.
    h.wsInstances[0].onmessage({
      data: JSON.stringify({
        type: 'SYSTEM_STATUS',
        data: { status: 'connected', target: '@old', profile: { title: 'OLD CHANNEL', handle: '@old' } },
      }),
    });
    await flush(2);

    assert.strictEqual(h.getEl('yt-input-view').style.display, 'block',
      'SYSTEM_STATUS must not close the form while editing');
    assert.strictEqual(h.ky.isEditingTarget, true, 'WS message must not release the lock');
  });

  await checkAsync('Badges still update from the background feed while editing', async () => {
    // The lock must silence the LAYOUT, not the status indicators — otherwise the
    // dashboard goes stale during a long edit session.
    const saved = { target: '@old', channelProfile: { title: 'OLD CHANNEL', handle: '@old' } };
    const h = bootDashboard({ config: saved, status: { status: 'connected', target: '@old', liveId: 'LIVE-123', profile: { title: 'OLD CHANNEL', handle: '@old' } } });
    await flush();

    h.getEl('btn-edit-target').click();
    await h.ky.pollStatus();

    assert.strictEqual(h.getEl('info-liveid').textContent, 'LIVE-123', 'liveId should still refresh while editing');
    assert.strictEqual(h.getEl('profile-avatar-status').style.background, '#00ff88', 'status dot should still refresh');
    assert.strictEqual(h.getEl('yt-input-view').style.display, 'block', 'but the form must stay open');
  });

  await checkAsync('"Batal" restores the card and releases the lock', async () => {
    const saved = { target: '@old', channelProfile: { title: 'OLD CHANNEL', handle: '@old' } };
    const h = bootDashboard({ config: saved });
    await flush();

    h.getEl('btn-edit-target').click();
    assert.strictEqual(h.ky.isEditingTarget, true, 'precondition: editing');
    h.getEl('btn-cancel-edit').click();

    assert.strictEqual(h.ky.isEditingTarget, false, 'cancel must release the lock');
    assert.strictEqual(h.getEl('yt-profile-view').style.display, 'block', 'card must come back');
    assert.strictEqual(h.getEl('yt-input-view').style.display, 'none', 'form must close');
    assert.strictEqual(h.getEl('profile-title').textContent, 'OLD CHANNEL', 'card content must be intact');
  });

  await checkAsync('After cancel, background polling may render the card again', async () => {
    const saved = { target: '@old', channelProfile: { title: 'OLD CHANNEL', handle: '@old' } };
    const h = bootDashboard({
      config: saved,
      status: { status: 'connected', target: '@old', profile: { title: 'SERVER TRUTH', handle: '@server' } },
    });
    await flush();

    h.getEl('btn-edit-target').click();
    await h.ky.pollStatus();                       // ignored: locked
    assert.strictEqual(h.getEl('profile-title').textContent, 'OLD CHANNEL', 'lock must block the render');

    h.getEl('btn-cancel-edit').click();            // back to the card, lock released
    await h.ky.pollStatus();

    assert.strictEqual(h.getEl('profile-title').textContent, 'SERVER TRUTH',
      'once the lock is released the server profile must render again');
    assert.strictEqual(h.getEl('profile-avatar-status').style.background, '#00ff88');
  });

  await checkAsync('Connect renders the new card and releases the lock', async () => {
    const saved = { target: '@old', channelProfile: { title: 'OLD CHANNEL', handle: '@old' } };
    const h = bootDashboard({
      config: saved,
      connectResult: { profile: { title: 'NEW CHANNEL', handle: '@brand-new', avatar: 'http://x/b.png' } },
      status: { status: 'connected', target: '@brand-new', profile: { title: 'NEW CHANNEL', handle: '@brand-new' } },
    });
    await flush();

    h.getEl('btn-edit-target').click();
    h.getEl('yt-target').value = '@brand-new';
    await h.getEl('btn-connect').listeners.click[0]();

    assert.strictEqual(h.ky.isEditingTarget, false, 'successful connect must release the lock');
    assert.strictEqual(h.getEl('yt-profile-view').style.display, 'block', 'new card must be visible');
    assert.strictEqual(h.getEl('yt-input-view').style.display, 'none', 'form must be closed');
    assert.strictEqual(h.getEl('profile-title').textContent, 'NEW CHANNEL', 'card must show the new channel');
    assert.strictEqual(h.ky.currentChannelProfile.title, 'NEW CHANNEL', 'profile state must be updated');
  });

  await checkAsync('A failed connect keeps the form usable and does not lock the user out', async () => {
    const h = bootDashboard({ config: { target: '@old', channelProfile: { title: 'OLD CHANNEL', handle: '@old' } }, connectResult: { ok: false, error: 'kanal tidak ditemukan' } });
    await flush();

    h.getEl('btn-edit-target').click();
    h.getEl('yt-target').value = '@typo';
    await h.getEl('btn-connect').listeners.click[0]();

    // The form stays open (the user still has their text) and the lock state is coherent.
    assert.strictEqual(h.getEl('yt-input-view').style.display, 'block', 'form must stay open after a failed connect');
    assert.strictEqual(h.getEl('yt-target').value, '@typo', 'the typed handle must not be wiped');
    assert.strictEqual(h.getEl('btn-connect').disabled, false, 'connect button must be re-enabled in finally');
  });

  await checkAsync('First run (no saved target) does not lock out autoconnect', async () => {
    // No channelProfile and the default target: the empty form is the resting state.
    // If boot raised the lock, an autoconnect SYSTEM_STATUS could never paint the card.
    const h = bootDashboard({
      config: { target: '@MilkyPoni' },
      status: { status: 'waiting', target: '@autoconnect', profile: { title: 'AUTOCONNECTED', handle: '@autoconnect' } },
    });
    await flush();

    assert.strictEqual(h.getEl('yt-input-view').style.display, 'block', 'first run should show the input form');
    assert.strictEqual(h.ky.isEditingTarget, false, 'boot must not raise the edit lock');

    await h.ky.pollStatus();

    assert.strictEqual(h.getEl('yt-profile-view').style.display, 'block',
      'autoconnect must be able to render the card on first run');
    assert.strictEqual(h.getEl('profile-title').textContent, 'AUTOCONNECTED');
    assert.strictEqual(h.getEl('btn-cancel-edit').style.display, 'none',
      'no card existed when the form opened, so "Batal" must stay hidden');
  });

  await checkAsync('Repeated heartbeats never reopen the form over a rendered card', async () => {
    const saved = { target: '@old', channelProfile: { title: 'OLD CHANNEL', handle: '@old' } };
    const h = bootDashboard({ config: saved, status: { status: 'idle', profile: { title: 'OLD CHANNEL', handle: '@old' } } });
    await flush();

    for (let i = 0; i < 10; i++) await h.ky.pollStatus();
    assert.strictEqual(h.getEl('yt-profile-view').style.display, 'block', 'idle heartbeats must leave the card up');
    assert.strictEqual(h.getEl('yt-input-view').style.display, 'none', 'and must not open the form');
  });

  // =========================================================================
  // Summary
  // =========================================================================
  const failed = results.filter(r => !r.ok);
  console.log(`\n${'='.repeat(56)}`);
  console.log(`  ${results.length - failed.length}/${results.length} profile edit-lock checks passed`);
  if (failed.length) {
    console.log(`  ❌ ${failed.length} FAILED`);
    failed.forEach(f => console.log(`     - ${f.name}: ${f.error}`));
  } else {
    console.log('  ✅ "Ganti" input form is protected from background status polling');
  }
  console.log('='.repeat(56));

  process.exit(failed.length ? 1 : 0);
})();
