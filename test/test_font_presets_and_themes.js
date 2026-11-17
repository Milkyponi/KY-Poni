/**
 * KY-Poni - Font Size Presets (Small/Medium/Large), Persona 5 Parametric SVG & Classic Theme Audit
 *
 * Run: node test/test_font_presets_and_themes.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

let pass = 0;
let fail = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    pass++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    fail++;
    failures.push({ name, error: err.message });
    console.log(`[FAIL] ${name}: ${err.message}`);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    fail++;
    failures.push({ name, error: err.message });
    console.log(`[FAIL] ${name}: ${err.message}`);
  }
}

function makeDomNode(tag = 'DIV', id = '') {
  const node = {
    tagName: String(tag).toUpperCase(),
    id,
    value: '',
    innerHTML: '',
    _innerText: '',
    textContent: '',
    src: '',
    disabled: false,
    options: [],
    children: [],
    dataset: {},
    _attrs: {},
    listeners: {},
    offsetWidth: 0,
    offsetHeight: 0,
    style: {
      _props: {},
      display: '',
      fontSize: '',
      fontFamily: '',
      color: '',
      setProperty(k, v) { this._props[k] = v; },
      getPropertyValue(k) { return this._props[k] || ''; },
    },
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
      toggle(c, on) {
        if (on === undefined ? !this._set.has(c) : on) this._set.add(c);
        else this._set.delete(c);
      },
    },
    addEventListener(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    },
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    appendChild(child) { this.children.push(child); this.options.push(child); return child; },
    focus() {},
    select() {},
    remove() {},
    getBoundingClientRect() { return { width: 800, height: 800, top: 0, left: 0 }; },
    click() { (this.listeners.click || []).forEach(fn => fn({ target: node })); },
  };
  Object.defineProperty(node, 'innerText', {
    get() { return node._innerText; },
    set(v) {
      node._innerText = String(v);
      node.innerHTML = String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },
  });
  Object.defineProperty(node, 'className', {
    get() { return Array.from(node.classList._set).join(' '); },
    set(v) {
      node.classList._set = new Set(String(v).split(/\s+/).filter(Boolean));
    },
  });
  return node;
}

function loadThemeRenderer(relPath) {
  const code = read(relPath);
  const sandbox = {
    window: {},
    console: { log() {}, warn() {}, error() {} },
    document: {
      createElement: (tag) => makeDomNode(tag),
      fonts: null,
    },
  };
  sandbox.window = sandbox;
  vm.runInContext(code, vm.createContext(sandbox), { filename: relPath });
  return sandbox.window.KYPoniTheme;
}

function bootDashboardWithPresets(config = {}) {
  const source = read('src/public/dashboard.js');
  const elements = new Map();
  const getEl = (id) => {
    if (!elements.has(id)) elements.set(id, makeDomNode('DIV', id));
    return elements.get(id);
  };

  const fsizeBtns = [
    { label: 'Small', val: '14' },
    { label: 'Medium', val: '16' },
    { label: 'Large', val: '20' },
  ].map(({ label, val }) => {
    const b = makeDomNode('BUTTON');
    b.textContent = label;
    b.setAttribute('data-fsize', val);
    if (val === '16') b.classList.add('active');
    return b;
  });

  const fetchLog = [];
  async function fakeFetch(url, init = {}) {
    const method = (init.method || 'GET').toUpperCase();
    fetchLog.push({ url, method, body: init.body });
    const urlPath = String(url).split('?')[0];
    const json = (obj, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => obj });
    if (urlPath === '/api/config') {
      if (method === 'POST') return json({ config: { ...config, ...JSON.parse(init.body) } });
      return json(config);
    }
    if (urlPath === '/api/themes') {
      return json({ themes: [{ id: 'persona5', name: 'Persona 5', isBuiltIn: true }] });
    }
    if (urlPath === '/api/catalog') return json({ themes: [] });
    if (urlPath === '/api/status') return json({ status: 'idle' });
    if (urlPath === '/api/updater/check') return json({ updateAvailable: false }, false);
    return json({});
  }

  const sandbox = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    document: {
      getElementById: (id) => getEl(id),
      querySelector: (sel) => (sel === '.canvas-viewport' ? getEl('__canvas-viewport') : null),
      querySelectorAll: (sel) => {
        const list = sel === '#fsize-selector .btn-fsize' ? fsizeBtns : [];
        list.forEach = Array.prototype.forEach.bind(list);
        return list;
      },
      createElement: (tag) => makeDomNode(tag),
      execCommand: () => true,
      addEventListener() {},
      body: makeDomNode('BODY', 'body'),
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
    WebSocket: class { close() {} send() {} },
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {},
    URLSearchParams,
    Map,
    Promise,
    alert: () => {},
    confirm: () => true,
  };
  sandbox.globalThis = sandbox;
  sandbox.window.document = sandbox.document;

  const instrumented = `${source}
;globalThis.__kyPreset = {
  snapFontSizePreset,
  setFontSizeUI,
  get currentFontSize() { return currentFontSize; },
  saveUserConfig,
};`;
  vm.runInContext(instrumented, vm.createContext(sandbox), { filename: 'dashboard.js' });
  return { getEl, fsizeBtns, fetchLog, ky: sandbox.__kyPreset };
}

(async () => {
  console.log('🧪 KY-Poni Font Presets, Persona 5 9-Slice PNG & Classic Theme Audit\n');

  // 1. Dashboard HTML & Preset UI
  check('index.html menawarkan tepat 3 preset Ukuran Teks (14/16/20) tanpa slider bebas', () => {
    const html = read('src/public/index.html');
    assert.ok(!/id="input-fsize"/.test(html), 'slider input-fsize lama harus dihapus');
    assert.ok(/id="fsize-selector"/.test(html), 'kontainer #fsize-selector harus ada');
    assert.ok(/data-fsize="14"[^>]*>Small</.test(html), 'preset Small (14px) harus ada');
    assert.ok(/data-fsize="16"[^>]*>Medium</.test(html), 'preset Medium (16px) harus ada');
    assert.ok(/data-fsize="20"[^>]*>Large</.test(html), 'preset Large (20px) harus ada');
  });

  await checkAsync('dashboard.js memetakan nilai lama ke preset terdekat & menyimpan klik preset', async () => {
    const { getEl, fsizeBtns, fetchLog, ky } = bootDashboardWithPresets({
      theme: 'persona5', layout: 'vertical', pos: 'bottom-left',
      scale: 100, fontSize: 22, fontFamily: 'OptimaNova', textColor: '#FFFFFF', fade: 8, keep: 1, transition: 'pop',
    });
    for (let i = 0; i < 8; i++) await new Promise(r => setImmediate(r));

    assert.strictEqual(ky.snapFontSizePreset(12), 14);
    assert.strictEqual(ky.snapFontSizePreset(14), 14);
    assert.strictEqual(ky.snapFontSizePreset(16), 16);
    assert.strictEqual(ky.snapFontSizePreset(17), 16);
    assert.strictEqual(ky.snapFontSizePreset(20), 20);
    assert.strictEqual(ky.snapFontSizePreset(26), 20);
    assert.strictEqual(ky.snapFontSizePreset(0), 16);

    // Boot dengan config lama fontSize=22 -> snap ke Large (20px) tanpa menulis saat boot
    assert.strictEqual(ky.currentFontSize, 20);
    assert.strictEqual(getEl('label-fsize-val').textContent, 'Large (20px)');
    assert.strictEqual(fsizeBtns[2].classList.contains('active'), true);
    assert.strictEqual(fetchLog.filter(f => f.method === 'POST').length, 0, 'boot tidak boleh menulis config');

    // Klik Small (14px) -> update label, preview URL, dan POST /api/config
    fsizeBtns[0].click();
    await new Promise(r => setImmediate(r));
    assert.strictEqual(ky.currentFontSize, 14);
    assert.strictEqual(getEl('label-fsize-val').textContent, 'Small (14px)');
    assert.ok(getEl('preview-frame').src.includes('fsize=14'), 'preview iframe harus menerima fsize=14');
    const posts = fetchLog.filter(f => f.url === '/api/config' && f.method === 'POST');
    assert.ok(posts.length >= 1, 'klik preset harus menyimpan ke /api/config');
    assert.strictEqual(JSON.parse(posts[posts.length - 1].body).fontSize, 14);
  });

  // 2. Persona 5 9-Slice PhotoCraft PNG Original & Zero-Clipping CSS
  check('persona5/assets/9slice memuat lengkap 9 irisan PNG original dari PhotoCraft', () => {
    const slices = ['p5_tl_tall.png', 'p5_ml.png', 'p5_bl.png', 'p5_tm.png', 'p5_mc.png', 'p5_bm.png', 'p5_tr.png', 'p5_mr.png', 'p5_br.png'];
    for (const f of slices) {
      const p = path.join(ROOT, 'src/public/themes/persona5/assets/9slice', f);
      assert.ok(fs.existsSync(p), 'slice PNG harus ada: ' + f);
      assert.ok(fs.statSync(p).size > 100, 'slice PNG tidak boleh kosong: ' + f);
    }
  });

  check('persona5/style.css memakai PNG original 3-piece + 9-slice tanpa overflow:hidden', () => {
    const css = read('src/public/themes/persona5/style.css');
    const bubbleBlock = css.slice(css.indexOf('.p5-dialogue-bubble {'), css.indexOf('}', css.indexOf('.p5-dialogue-bubble {')) + 1);
    assert.ok(/min-height:\s*128px/.test(bubbleBlock), 'bubble harus memakai min-height');
    assert.ok(/height:\s*auto/.test(bubbleBlock), 'bubble harus memakai height: auto');
    assert.ok(css.includes('.p5-skin-9slice'), 'CSS harus mendefinisikan .p5-skin-9slice');
    assert.ok(css.includes('/themes/persona5/assets/9slice/p5_tl_tall.png'), 'CSS harus memakai PNG original 9-slice');
    const boxBlock = css.slice(css.indexOf('.p5-message-box {'), css.indexOf('}', css.indexOf('.p5-message-box {')) + 1);
    assert.ok(!/overflow:\s*hidden/.test(boxBlock), '.p5-message-box tidak boleh memotong teks dengan overflow:hidden');
    assert.ok(!/position:\s*absolute/.test(boxBlock), '.p5-message-box harus berada di flow normal agar bubble ikut memanjang');
  });

  check('persona5/renderer.js merender dual PNG skin (3-piece + 9-slice) & tier sadar ukuran font', () => {
    const p5 = loadThemeRenderer('src/public/themes/persona5/renderer.js');
    const msg44 = 'Halo semuanya, selamat datang di live stream!';

    const elMed = p5.renderMessage({ id: '1', type: 'chat', author: { name: 'MilkyPoni' }, message: msg44 }, { fsize: 16, layout: 'vertical' });
    assert.ok(elMed.classList.contains('tier-1'), '44 char di Medium (16px) tetap tier-1');
    const bubbleMed = elMed.children[0];
    assert.ok(!bubbleMed.classList.contains('is-tall'), '44 char di Medium (16px) memakai 3-piece PNG asli');
    assert.ok(bubbleMed.children[0].classList.contains('p5-skin'), 'harus ada .p5-skin');
    assert.ok(bubbleMed.children[1].classList.contains('p5-skin-9slice'), 'harus ada .p5-skin-9slice');

    const elLarge = p5.renderMessage({ id: '2', type: 'chat', author: { name: 'MilkyPoni' }, message: msg44 }, { fsize: 20, layout: 'vertical' });
    assert.ok(elLarge.classList.contains('tier-2'), '44 char di Large (20px) harus naik ke tier-2 agar lega');
    assert.ok(elLarge.children[0].classList.contains('is-tall'), 'tier-2 di Large (20px) harus mengaktifkan 9-slice .is-tall');

    const elMember = p5.renderMessage({ id: '3', type: 'membership', author: { name: 'MemberStar' }, message: 'Baru saja bergabung menjadi Member Tier 1!' }, { fsize: 20, layout: 'vertical' });
    assert.ok(elMember.children[0].classList.contains('is-tall'), 'membership harus mengaktifkan 9-slice .is-tall');
    const msgText = elMember.children[0].children[3].children[0];
    assert.strictEqual(msgText.style.fontSize, '20px', 'fontSize harus diterapkan langsung 20px');
  });

  // 3. Classic Theme Fix
  check('classic/style.css membaca CSS variable ukuran, font, warna & kontras Super Chat', () => {
    const css = read('src/public/themes/classic/style.css');
    assert.ok(/var\(--msg-font-size/.test(css), 'classic harus memakai --msg-font-size');
    assert.ok(/var\(--msg-font-family/.test(css), 'classic harus memakai --msg-font-family');
    assert.ok(/var\(--msg-font-color/.test(css), 'classic harus memakai --msg-font-color');
    assert.ok(/overflow-wrap:\s*anywhere/.test(css), 'classic harus membungkus kata panjang');
  });

  check('classic/renderer.js menerapkan context.fsize, context.font, dan context.color ke pesan', () => {
    const classic = loadThemeRenderer('src/public/themes/classic/renderer.js');
    const entry = classic.renderMessage(
      { id: 'c1', type: 'chat', author: { name: 'Tester' }, message: 'Halo Classic!' },
      { fsize: 20, font: 'OptimaNova', color: '#FFE600' }
    );
    const bubbleBody = entry.children[1];
    const msgSpan = bubbleBody.children[0];
    assert.strictEqual(msgSpan.style.fontSize, '20px');
    assert.ok(msgSpan.style.fontFamily.includes('OptimaNova'));
    assert.strictEqual(msgSpan.style.color, '#FFE600');
  });

  // 4. Persona 3 Reload 9-Slice PhotoCraft PNG Original & Bos Username/Badge Layout
  check('persona3reload/assets/9slice memuat lengkap 9 irisan PNG original dari PhotoCraft', () => {
    const slices = ['p3r_tl.png', 'p3r_tm.png', 'p3r_tr.png', 'p3r_ml.png', 'p3r_mc.png', 'p3r_mr.png', 'p3r_bl.png', 'p3r_bm.png', 'p3r_br.png'];
    for (const f of slices) {
      const p = path.join(ROOT, 'src/public/themes/persona3reload/assets/9slice', f);
      assert.ok(fs.existsSync(p), 'slice PNG P3R harus ada: ' + f);
      assert.ok(fs.statSync(p).size > 100, 'slice PNG P3R tidak boleh kosong: ' + f);
    }
  });

  check('persona3reload/style.css memakai 9-slice cap tetap, username #FBE837 & pill Super Chat #FFE066', () => {
    const css = read('src/public/themes/persona3reload/style.css');
    const bubbleBlock = css.slice(css.indexOf('.p3r-dialogue-bubble {'), css.indexOf('}', css.indexOf('.p3r-dialogue-bubble {')) + 1);
    assert.ok(/min-height:\s*128px/.test(bubbleBlock), 'P3R bubble harus memakai min-height');
    assert.ok(/height:\s*auto/.test(bubbleBlock), 'P3R bubble harus memakai height: auto');
    assert.ok(css.includes('.p3r-skin-9slice'), 'P3R CSS harus mendefinisikan .p3r-skin-9slice');
    assert.ok(css.includes('width: 127px'), 'P3R left cap harus terkunci 127px');
    assert.ok(css.includes('width: 124px'), 'P3R right cap harus terkunci 124px');
    assert.ok(css.includes('#FBE837'), 'P3R username harus memakai kuning #FBE837');
    assert.ok(css.includes('#FFE066'), 'P3R Super Chat badge harus memakai pill emas #FFE066');
    const boxBlock = css.slice(css.indexOf('.p3r-message-box {'), css.indexOf('}', css.indexOf('.p3r-message-box {')) + 1);
    assert.ok(!/overflow:\s*hidden/.test(boxBlock), '.p3r-message-box tidak boleh memotong teks dengan overflow:hidden');
    assert.ok(!/position:\s*absolute/.test(boxBlock), '.p3r-message-box harus berada di flow normal');
  });

  check('persona3reload/renderer.js merender 9-slice, badge stacked/inline & rawText aman XSS', () => {
    const p3r = loadThemeRenderer('src/public/themes/persona3reload/renderer.js');
    const elChat = p3r.renderMessage(
      { id: 'p1', type: 'chat', author: { name: 'ViewerOne' }, rawText: 'Halo & 1 < 2', message: 'Halo &amp; 1 &lt; 2' },
      { fsize: 16, layout: 'vertical' }
    );
    const bubbleChat = elChat.children[0];
    assert.ok(bubbleChat.children[0].classList.contains('p3r-skin-9slice'), 'P3R harus memakai .p3r-skin-9slice');
    assert.ok(!bubbleChat.children[1].classList.contains('is-inline-badge'), 'chat normal memakai TALK stacked di bawah username');
    assert.strictEqual(bubbleChat.children[2].children[0].style.fontSize, '16px');
    assert.strictEqual(bubbleChat.children[2].children[0].innerHTML, 'Halo &amp; 1 &lt; 2', 'rawText harus di-escape sekali tanpa double-escape');

    const elSc = p3r.renderMessage(
      { id: 'p2', type: 'superchat', author: { name: 'Sultan350' }, rawText: 'Support!', superchat: { amount: 'Rp 500.000' } },
      { fsize: 20, layout: 'vertical' }
    );
    assert.ok(elSc.children[0].children[1].classList.contains('is-inline-badge'), 'Super Chat memakai badge inline');
    assert.strictEqual(elSc.children[0].children[2].children[0].style.fontSize, '20px');
  });

  console.log(`\n${'='.repeat(52)}`);
  console.log(`  ${pass}/${pass + fail} font-preset & theme checks passed`);
  if (fail > 0) {
    console.log(`  ❌ ${fail} FAILED`);
    failures.forEach(f => console.log(`     - ${f.name}: ${f.error}`));
    process.exit(1);
  }
  console.log('  ✅ Font presets, Persona 5 & P3R 9-Slice PNG & Classic theme verified');
  console.log('='.repeat(52));
  process.exit(0);
})();
