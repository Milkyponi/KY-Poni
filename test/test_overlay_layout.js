/**
 * KY-Poni - Core Overlay Layout Test Suite (v1.4.2, Opsi B)
 *
 * Mengunci kontrak "core layout" yang lahir dari bug katalog `aceattorney`
 * v1.0.0: tema sempat memaksa `#chat-canvas.layout-horizontal` menjadi
 * `flex-direction: row` plus `justify-content: flex-start`, sehingga 4 sudut
 * anchor runtuh di mode horizontal.
 *
 * Yang diuji:
 *   1. `overlay.html` memuat `/overlay_layout.css` SETELAH `#theme-stylesheet`
 *      dan SEBELUM `/overlay_transitions.css` (urutan = kontrak cascade).
 *   2. `overlay_layout.css` mengunci `#chat-canvas` (dan varian
 *      `.layout-horizontal`) tetap `flex-direction: column`, mendefinisikan
 *      4 sudut `pos-*` di kedua mode + `transform-origin`-nya, serta memakai
 *      variabel padding/gap yang dipakai tema.
 *   3. Tema built-in (`persona5`, `persona3reload`, `classic`) TIDAK lagi
 *      mendeklarasikan layout kanvas/flow (single source of truth).
 *
 * Run: node test/test_overlay_layout.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

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

/** Buang komentar CSS agar isi komentar tidak lolos sebagai "aturan". */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Parser blok datar: kembalikan [{ selectors:[...], body, raw }]. */
function parseBlocks(css) {
  const out = [];
  const text = stripComments(css);
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const selectors = m[1]
      .split(',')
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (!selectors.length) continue;
    out.push({ selectors, body: m[2], raw: m[0] });
  }
  return out;
}

/** Cari blok yang selector-nya persis sama (setelah normalisasi spasi). */
function blockFor(css, selector) {
  const want = selector.replace(/\s+/g, ' ').trim();
  return parseBlocks(css).filter((b) => b.selectors.includes(want));
}

function decl(body, prop) {
  const re = new RegExp(`(^|[;{\\s])${prop}\\s*:\\s*([^;}]+)`, 'i');
  const m = body.match(re);
  return m ? m[2].trim() : null;
}

const LAYOUT_PROPS = ['flex-direction', 'justify-content', 'align-items', 'gap', 'transform-origin', 'padding'];
const CANVAS_FLOW_SEL = /^#chat-canvas\b|^#chat-flow\b/;

console.log('\n🧪 KY-Poni CORE OVERLAY LAYOUT Suite (v1.4.2)\n');

// ---------------------------------------------------------------------------
// 1. Urutan pemuatan stylesheet di overlay.html
// ---------------------------------------------------------------------------

const html = read('src/public/overlay.html');

check('overlay.html memuat /overlay_layout.css', () => {
  assert.ok(/<link[^>]+href="\/overlay_layout\.css"/.test(html), 'link overlay_layout.css tidak ada');
});

check('overlay_layout.css dimuat SETELAH #theme-stylesheet', () => {
  const iTheme = html.indexOf('id="theme-stylesheet"');
  const iLayout = html.indexOf('href="/overlay_layout.css"');
  assert.ok(iTheme >= 0 && iLayout >= 0, 'salah satu link tidak ditemukan');
  assert.ok(iLayout > iTheme, `overlay_layout.css (${iLayout}) harus setelah theme-stylesheet (${iTheme})`);
});

check('overlay_layout.css dimuat SEBELUM overlay_transitions.css', () => {
  const iLayout = html.indexOf('href="/overlay_layout.css"');
  const iTrans = html.indexOf('href="/overlay_transitions.css"');
  assert.ok(iLayout >= 0 && iTrans >= 0, 'salah satu link tidak ditemukan');
  assert.ok(iLayout < iTrans, `overlay_layout.css (${iLayout}) harus sebelum transitions (${iTrans})`);
});

// ---------------------------------------------------------------------------
// 2. Kontrak core layout
// ---------------------------------------------------------------------------

check('overlay_layout.css ada dan tidak kosong', () => {
  const css = read('src/public/overlay_layout.css');
  assert.ok(css.length > 500, 'berkas terlalu kecil untuk memuat kontrak layout');
});

const layoutCss = read('src/public/overlay_layout.css');

check('#chat-canvas dideklarasikan flex-direction: column', () => {
  const blocks = blockFor(layoutCss, '#chat-canvas');
  assert.ok(blocks.length >= 1, 'blok #chat-canvas tidak ada');
  const dir = decl(blocks[0].body, 'flex-direction');
  assert.strictEqual(dir, 'column', `#chat-canvas flex-direction = ${dir}`);
});

check('#chat-canvas SELALU column di kedua layout (0 flex-direction: row)', () => {
  // Hanya selektor yang MENARGETKAN kanvas itu sendiri (bukan turunannya,
  // mis. `#chat-canvas.layout-horizontal #chat-flow` yang memang harus row).
  const isCanvasTarget = (s) => /^#chat-canvas(\.[\w-]+)*$/.test(s);
  const blocks = parseBlocks(layoutCss).filter((b) => b.selectors.some(isCanvasTarget));
  assert.ok(blocks.length >= 3, 'blok kanvas terlalu sedikit');
  const rowRules = blocks.filter((b) => /flex-direction\s*:\s*row/i.test(b.body));
  assert.strictEqual(rowRules.length, 0,
    `#chat-canvas tidak boleh flex-direction: row -> ${rowRules.map((b) => b.selectors.join(',')).join(' | ')}`);
  // Setiap blok kanvas yang menyebut flex-direction wajib 'column'.
  for (const b of blocks) {
    const dir = decl(b.body, 'flex-direction');
    if (dir) assert.strictEqual(dir, 'column', `${b.selectors.join(',')} -> ${dir}`);
  }
});

check('kanvas horizontal dikunci eksplisit di 4 sudut (mengalahkan tema katalog lama)', () => {
  const blocks = parseBlocks(layoutCss);
  const corners = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];
  for (const corner of corners) {
    const sel = `#chat-canvas.layout-horizontal.pos-${corner}`;
    const hit = blocks.filter((b) => b.selectors.includes(sel) && /flex-direction\s*:\s*column/i.test(b.body));
    assert.ok(hit.length >= 1, `selektor eksplisit ${sel} { flex-direction: column } tidak ada`);
  }
});

check('4 sudut pos-* didefinisikan untuk mode vertical & horizontal', () => {
  const blocks = parseBlocks(layoutCss);
  const corners = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];
  for (const corner of corners) {
    const vertical = blocks.filter((b) => b.selectors.includes(`#chat-canvas.pos-${corner}`));
    assert.ok(vertical.length >= 1, `#chat-canvas.pos-${corner} tidak ada`);
    const verticalFlow = blocks.filter((b) => b.selectors.includes(`#chat-canvas.pos-${corner} #chat-flow`));
    assert.ok(verticalFlow.length >= 1, `#chat-canvas.pos-${corner} #chat-flow tidak ada`);
    const horizontalFlow = blocks.filter((b) =>
      b.selectors.includes(`#chat-canvas.layout-horizontal.pos-${corner} #chat-flow`));
    assert.ok(horizontalFlow.length >= 1, `#chat-canvas.layout-horizontal.pos-${corner} #chat-flow tidak ada`);
  }
});

check('anchor horizontal mengikuti sumbu yang benar (justify/align per sudut)', () => {
  const blocks = parseBlocks(layoutCss);
  // Satu selektor bisa muncul di beberapa blok (mis. pengunci flex-direction
  // lalu blok justify/align); ambil blok yang benar-benar mendeklarasikan properti.
  const get = (sel, prop) => blocks.filter((b) => b.selectors.includes(sel) && decl(b.body, prop) !== null)[0];
  const expect = {
    'bottom-left': { justify: 'flex-end', align: 'flex-start' },
    'bottom-right': { justify: 'flex-end', align: 'flex-end' },
    'top-left': { justify: 'flex-start', align: 'flex-start' },
    'top-right': { justify: 'flex-start', align: 'flex-end' },
  };
  for (const [corner, want] of Object.entries(expect)) {
    const canvasSel = `#chat-canvas.layout-horizontal.pos-${corner}`;
    assert.ok(get(canvasSel, 'justify-content'), `kanvas ${corner} justify-content tidak ada`);
    assert.strictEqual(decl(get(canvasSel, 'justify-content').body, 'justify-content'), want.justify, `kanvas ${corner} justify-content`);
    assert.ok(get(canvasSel, 'align-items'), `kanvas ${corner} align-items tidak ada`);
    assert.strictEqual(decl(get(canvasSel, 'align-items').body, 'align-items'), want.align, `kanvas ${corner} align-items`);
    const flowSel = `${canvasSel} #chat-flow`;
    const vertical = corner.startsWith('bottom') ? 'flex-end' : 'flex-start';
    const horizontal = corner.endsWith('left') ? 'flex-start' : 'flex-end';
    assert.ok(get(flowSel, 'align-items'), `flow ${corner} align-items tidak ada`);
    assert.strictEqual(decl(get(flowSel, 'align-items').body, 'align-items'), vertical, `flow ${corner} align-items`);
    assert.ok(get(flowSel, 'justify-content'), `flow ${corner} justify-content tidak ada`);
    assert.strictEqual(decl(get(flowSel, 'justify-content').body, 'justify-content'), horizontal, `flow ${corner} justify-content`);
  }
});

check('#chat-flow memakai skala, transform-origin, dan gap bervariabel', () => {
  const blocks = blockFor(layoutCss, '#chat-flow');
  assert.ok(blocks.length >= 1, 'blok #chat-flow tidak ada');
  const body = blocks[0].body;
  assert.ok(/transform\s*:\s*scale\(var\(--overlay-scale,\s*1\)\)/.test(body), 'transform scale tidak ada');
  assert.ok(/var\(--kyp-flow-gap,\s*12px\)/.test(body), 'gap var(--kyp-flow-gap, 12px) tidak ada');
  assert.ok(/transform-origin/i.test(body), 'transform-origin default tidak ada');
});

check('mode horizontal: HANYA #chat-flow yang menjadi baris', () => {
  const blocks = parseBlocks(layoutCss);
  const flow = blocks.filter((b) => b.selectors.includes('#chat-canvas.layout-horizontal #chat-flow'))[0];
  assert.ok(flow, 'aturan #chat-canvas.layout-horizontal #chat-flow tidak ada');
  assert.strictEqual(decl(flow.body, 'flex-direction'), 'row', 'flow horizontal harus row');
  assert.ok(/var\(--kyp-flow-gap-horizontal,\s*16px\)/.test(flow.body), 'gap horizontal bervariabel tidak ada');
});

check('transform-origin 4 sudut didefinisikan (vertical & horizontal)', () => {
  const blocks = parseBlocks(layoutCss);
  const corners = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];
  for (const corner of corners) {
    const origin = corner.replace('-', ' ');
    for (const prefix of ['#chat-canvas.pos', '#chat-canvas.layout-horizontal.pos']) {
      const sel = `${prefix}-${corner} #chat-flow`;
      const hit = blocks.filter((b) => b.selectors.includes(sel) && decl(b.body, 'transform-origin') === origin);
      assert.ok(hit.length >= 1, `transform-origin '${origin}' untuk ${sel} tidak ada`);
    }
  }
});

check('#chat-canvas memakai padding var(--kyp-canvas-padding, 16px 20px)', () => {
  const body = blockFor(layoutCss, '#chat-canvas')[0].body;
  assert.ok(/var\(--kyp-canvas-padding,\s*16px 20px\)/.test(body),
    `padding kanvas = ${decl(body, 'padding')}`);
});

check('perubahan ukuran/mode tidak memakai inverse-scaling (calc(100% / scale))', () => {
  assert.ok(!/calc\(\s*100%\s*\/\s*(var\(--overlay-scale|scale)/.test(layoutCss),
    'larangan inverse scaling dilanggar');
});

// ---------------------------------------------------------------------------
// 3. Tema built-in = single source of truth
// ---------------------------------------------------------------------------

const BUILTIN = ['persona5', 'persona3reload', 'classic'];

for (const id of BUILTIN) {
  check(`tema ${id} tidak lagi menduplikasi layout #chat-canvas / #chat-flow`, () => {
    const css = read(`src/public/themes/${id}/style.css`);
    const blocks = parseBlocks(css);
    const offenders = [];
    for (const b of blocks) {
      const isCanvasFlow = b.selectors.some((s) => CANVAS_FLOW_SEL.test(s));
      if (!isCanvasFlow) continue;
      for (const prop of LAYOUT_PROPS) {
        if (decl(b.body, prop) !== null) {
          offenders.push(`${b.selectors.join(',')} -> ${prop}`);
        }
      }
    }
    assert.strictEqual(offenders.length, 0,
      `aturan layout masih ada di tema (harus di core):\n       ${offenders.join('\n       ')}`);
  });
}

check('tema built-in tetap memegang lebar .chat-entry mode horizontal', () => {
  for (const id of BUILTIN) {
    const css = read(`src/public/themes/${id}/style.css`);
    assert.ok(/#chat-canvas\.layout-horizontal \.chat-entry\s*\{/.test(css),
      `${id}: aturan lebar .chat-entry horizontal hilang (harus tetap di tema)`);
  }
});

check('tema built-in menyebut core overlay_layout.css di komentarnya', () => {
  for (const id of BUILTIN) {
    const css = read(`src/public/themes/${id}/style.css`);
    assert.ok(/overlay_layout\.css/.test(css), `${id}: komentar rujukan core tidak ada`);
  }
});

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------

const failed = failures.length;
console.log(`\n${'='.repeat(52)}`);
console.log(`  ${pass}/${pass + failed} overlay layout checks passed`);
if (failed) {
  console.log(`  ❌ ${failed} FAILED`);
  failures.forEach((f) => console.log(`     - ${f.name}: ${f.error}`));
} else {
  console.log('  ✅ Core layout contract intact (kanvas selalu kolom)');
}
console.log('='.repeat(52));

process.exit(failed ? 1 : 0);
