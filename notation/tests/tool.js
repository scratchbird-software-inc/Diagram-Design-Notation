/* SPDX-License-Identifier: GPL-2.0-or-later. B1-027 unified tool: build
 * determinism + freshness gate, drawer config (D3/D4), override rules, export
 * helpers, deep-link loading (D5), and legacy redirect mapping (D6). */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..', '..');
const T = require('../tool/src/tool.js');
const R = require('../tool/src/redirect.js');
const A = require('../dist/ddn.global.js');
const results = [];
const pending = [];
function test(name, fn) {
  const done = r => { results.push(r); if (r.pass) console.log('PASS', name); else { console.error('FAIL', name, r.err.stack); process.exitCode = 1; } };
  try {
    const out = fn();
    if (out && typeof out.then === 'function') pending.push(out.then(() => done({ name, pass: true }), err => done({ name, pass: false, err })));
    else done({ name, pass: true });
  } catch (e) { done({ name, pass: false, err: e }); }
}

test('build:tool is deterministic — three runs give byte-identical output matching the committed file', () => {
  const committed = fs.readFileSync(path.join(root, 'notation/tool/ddn-tool.html'), 'utf8');
  let prev = null;
  for (let i = 0; i < 3; i++) {
    cp.execFileSync('node', [path.join(root, 'tools/build-tool.js')], { stdio: 'pipe' });
    const bytes = fs.readFileSync(path.join(root, 'notation/tool/ddn-tool.html'), 'utf8');
    if (prev !== null) assert.strictEqual(bytes, prev, 'run ' + i + ' differs');
    prev = bytes;
  }
  assert.strictEqual(prev, committed, 'committed ddn-tool.html differs from a fresh build — run node tools/build-tool.js');
});

test('generated tool inlines the runtime, the corpus data, and carries the chrome', () => {
  const html = fs.readFileSync(path.join(root, 'notation/tool/ddn-tool.html'), 'utf8');
  assert.ok(html.includes('Inlined from notation/dist/ddn.global.min.js'), 'inlined minified runtime missing');
  assert.ok(html.includes('globalThis.DDNLiveData'), 'inlined example corpus missing');
  assert.ok(!html.includes('<script src='), 'external script reference defeats file:// single-file use');
  for (const id of ['ddn-toolbar', 'ddn-view-picker', 'ddn-icon-files', 'ddn-icon-appearance', 'ddn-icon-source', 'ddn-icon-export',
    'ddn-drawer-files', 'ddn-drawer-appearance', 'ddn-drawer-source', 'ddn-drawer-export',
    'ddn-fit-page', 'ddn-fit-width', 'ddn-fit-height', 'ddn-fit-100', 'ddn-zoom', 'ddn-zoom-pct', 'ddn-drag-mode',
    'ddn-settings', 'ddn-settings-popup', 'ddn-stage', 'ddn-diagram', 'ddn-tool-status',
    'ddn-source', 'ddn-apply', 'ddn-discard', 'ddn-live-apply', 'ddn-undo', 'ddn-redo',
    'ddn-catalogue', 'ddn-file-list', 'ddn-paste', 'ddn-load-paste',
    'ddn-export-svg', 'ddn-export-png', 'ddn-export-webp', 'ddn-save-example'])
    assert.ok(html.includes('id="' + id + '"'), 'control #' + id + ' missing');
  for (const name of ['files', 'appearance', 'source', 'export'])
    assert.ok(html.includes('data-drawer="' + name + '"'), 'toolbar icon for drawer ' + name + ' missing');
  assert.ok(html.includes('window.DDNTool') || html.includes('host.DDNTool'), 'DDNTool surface missing');
});

/* ---- D3/D4 drawer configuration ---- */

test('parseDrawersParam: valid pairs kept, malformed pairs and unknown names/states ignored', () => {
  assert.deepEqual(T.parseDrawersParam('appearance:closed,source:none'), { appearance: 'closed', source: 'none' });
  assert.deepEqual(T.parseDrawersParam('files:open'), { files: 'open' });
  assert.deepEqual(T.parseDrawersParam('appearance'), {});
  assert.deepEqual(T.parseDrawersParam('appearance:'), {});
  assert.deepEqual(T.parseDrawersParam(':open'), {});
  assert.deepEqual(T.parseDrawersParam('appearance:open,,source:closed'), { appearance: 'open', source: 'closed' });
  assert.deepEqual(T.parseDrawersParam('bogus:open,appearance:bogus,export:closed'), { export: 'closed' });
  assert.deepEqual(T.parseDrawersParam(' appearance : closed , source : none '), { appearance: 'closed', source: 'none' });
  assert.deepEqual(T.parseDrawersParam('appearance:closed;source:none'), {});
  assert.deepEqual(T.parseDrawersParam(null), {});
  assert.deepEqual(T.parseDrawersParam(''), {});
});

test('mode presets (D4): diagram/view/explore/edit', () => {
  const d = T.resolveDrawerConfig('diagram', null, null);
  assert.equal(d.toolbar, false, 'diagram hides the toolbar');
  for (const k of T.DRAWERS) assert.equal(d.drawers[k], 'none');
  const v = T.resolveDrawerConfig('view', null, null);
  assert.equal(v.toolbar, true); assert.equal(v.icons, false);
  for (const k of T.DRAWERS) assert.equal(v.drawers[k], 'none');
  const e = T.resolveDrawerConfig('explore', null, null);
  assert.equal(e.toolbar, true); assert.equal(e.icons, true);
  for (const k of T.DRAWERS) assert.equal(e.drawers[k], 'closed');
  const ed = T.resolveDrawerConfig('edit', null, null);
  assert.equal(ed.drawers.source, 'open');
  assert.equal(ed.drawers.appearance, 'closed');
  assert.equal(T.parseMode('bogus'), null, 'unknown mode rejected');
  assert.equal(T.resolveDrawerConfig('bogus', null, null).mode, T.DEFAULT_MODE, 'unknown mode falls back to the default');
});

test('precedence (D3): URL param > localStorage > preset defaults', () => {
  const c = T.resolveDrawerConfig('explore', { files: 'open', source: 'open' }, 'source:none,bogus:x');
  assert.equal(c.drawers.source, 'none', 'URL beats localStorage');
  assert.equal(c.drawers.files, 'open', 'localStorage beats preset');
  assert.equal(c.drawers.appearance, 'closed', 'preset default fills the rest');
  const dirty = T.resolveDrawerConfig('explore', { files: 'wide-open', source: 3, export: 'open' }, null);
  assert.equal(dirty.drawers.files, 'closed', 'malformed stored state ignored');
  assert.equal(dirty.drawers.source, 'closed', 'non-string stored state ignored');
  assert.equal(dirty.drawers.export, 'open', 'valid stored state kept');
});

/* ---- overrides ---- */

test('overrideRuleFor: kind/verb/object CSS rules and validation', () => {
  assert.equal(T.overrideRuleFor({ type: 'kind', code: 'TBL' }, '#a1b2c3'),
    '.ddn-svg .ddn-kind-tbl > path, .ddn-svg .ddn-kind-tbl > rect, .ddn-svg .ddn-kind-tbl > circle, .ddn-svg .ddn-kind-tbl > ellipse, .ddn-svg .ddn-kind-tbl > polygon { fill: #a1b2c3; }');
  assert.equal(T.overrideRuleFor({ type: 'verb', code: 'ref' }, '#fff'),
    '.ddn-svg .ddn-verb-ref path { stroke: #fff; }');
  const obj = T.overrideRuleFor({ type: 'object', id: 'model.order' }, '#123456');
  assert.ok(obj.includes('[data-id="model.order"]') && obj.includes('[data-ddn-id="model.order"]'), 'object rule covers both id hooks');
  assert.throws(() => T.overrideRuleFor({ type: 'kind', code: 'x' }, 'red'), /#rgb or #rrggbb/);
  assert.throws(() => T.overrideRuleFor({ type: 'wat', code: 'x' }, '#fff'), /unknown override type/);
});

test('typographyRuleFor: per-kind family/size overlay', () => {
  assert.equal(T.typographyRuleFor('TBL', { family: 'mono', size: '12' }),
    '.ddn-svg .ddn-kind-tbl text { font-family: DejaVu Sans Mono, monospace; font-size: 12px; }');
  assert.throws(() => T.typographyRuleFor('TBL', { family: 'nope' }), /unknown font family/);
  assert.throws(() => T.typographyRuleFor('TBL', { size: '99' }), /between 8 and 24/);
  assert.throws(() => T.typographyRuleFor('TBL', {}), /needs a family or a size/);
});

test('overrideCss: composition plus relation highlight', () => {
  const css = T.overrideCss({ typography: { TBL: { family: 'serif', size: 'source' } }, kindColours: { TBL: '#111111' }, verbColours: { ref: '#222222' }, objectColours: { 'm.a': '#333333' } }, 'm.r1');
  for (const frag of ['.ddn-kind-tbl text', 'fill: #111111', '.ddn-verb-ref path', '[data-id="m.a"]', '[data-id="m.r1"] path { stroke: #d97706'])
    assert.ok(css.includes(frag), 'missing ' + frag);
  assert.equal(T.overrideCss(null, null), '');
});

test('toolOverrides: verb + relation routing merge, relation ids win, source dropped', () => {
  const o = T.toolOverrides({ options: { routing: 'curved' }, verbRouting: { flow: 'orthogonal', ref: 'source' }, relationRouting: { 'm.r': 'straight' } });
  assert.equal(o.routing, 'curved');
  assert.deepEqual(o.relationRouting, { flow: 'orthogonal', 'm.r': 'straight' });
  assert.throws(() => T.toolOverrides({ verbRouting: { flow: 'diagonal' } }), /unknown routing/);
  assert.ok(!('relationRouting' in T.toolOverrides({ verbRouting: { flow: 'source' } })), 'all-source routing stays inactive');
});

/* ---- export helpers ---- */

test('exportSvgWithOverrides: style block injected once, marker attribute set', () => {
  const svg = '<svg width="10" height="10"><rect width="10" height="10"/></svg>';
  const out = T.exportSvgWithOverrides(svg, '.x { fill: red; }');
  assert.ok(out.includes('data-ddn-tool-export="presentation-overrides"'), 'marker missing');
  assert.ok(out.includes('<style>.x { fill: red; }</style><rect'), 'style not injected after the svg tag');
  assert.equal(T.exportSvgWithOverrides(svg, ''), svg, 'no css, no rewrite');
  assert.throws(() => T.exportSvgWithOverrides('', '.x{}'), /nothing rendered/);
});

test('rasterCanvasSize: 2× scale with per-side cap', () => {
  assert.deepEqual(T.rasterCanvasSize(100, 50, 2), { width: 200, height: 100 });
  assert.throws(() => T.rasterCanvasSize(0, 50), /nothing rendered/);
  assert.throws(() => T.rasterCanvasSize(9000, 100, 2), /exceeds/);
});

/* ---- deep links ---- */

test('srcFromQuery: strictly relative .ddn only', () => {
  assert.equal(T.srcFromQuery('?src=examples/basics/01-customer.ddn'), 'examples/basics/01-customer.ddn');
  assert.equal(T.srcFromQuery('?src=a.ddn&mode=edit'), 'a.ddn');
  assert.equal(T.srcFromQuery('?mode=edit'), null);
  assert.throws(() => T.srcFromQuery('?src='), /empty/);
  assert.throws(() => T.srcFromQuery('?src=javascript:alert(1)'), /scheme/);
  assert.throws(() => T.srcFromQuery('?src=https://x/a.ddn'), /scheme/);
  assert.throws(() => T.srcFromQuery('?src=/abs/a.ddn'), /absolute/);
  assert.throws(() => T.srcFromQuery('?src=a.txt'), /.ddn/);
});

test('srcImportClosure: multi-file fetch with cycle safety and error naming', async () => {
  const corpus = {
    'http://site/tools/x/main.ddn': 'main',
    'http://site/tools/x/shared.ddn': 'shared',
    'http://site/tools/x/data.ddn': 'data'
  };
  const importsOf = { main: ['./shared.ddn', 'data.ddn'], shared: ['./data.ddn'], data: [] };
  const { files, entryName } = await T.srcImportClosure('x/main.ddn', 'http://site/tools/index.html',
    url => Promise.resolve({ ok: true, text: () => Promise.resolve(corpus[String(url)]) }),
    (text) => importsOf[text] || [],
    (name, p) => p.replace(/^\.\//, ''));
  assert.equal(entryName, 'main.ddn');
  assert.deepEqual(Object.keys(files).sort(), ['data.ddn', 'main.ddn', 'shared.ddn']);
  await assert.rejects(
    T.srcImportClosure('x/main.ddn', 'http://site/tools/index.html',
      url => Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') }),
      () => [], () => ''),
    /main\.ddn — HTTP 404/);
});

test('viewListFrom / isPlausibleSourceFile / srcFetchErrorMessage', () => {
  assert.deepEqual(T.viewListFrom([{ file: 'a.ddn', views: [{ id: 'v1', name: 'One' }] }]),
    [{ entry: 'a.ddn', view: 'v1', label: 'a.ddn · One' }]);
  assert.ok(T.isPlausibleSourceFile({ name: 'x.ddn', type: '' }));
  assert.ok(T.isPlausibleSourceFile({ name: 'x.zip', type: '' }));
  assert.ok(!T.isPlausibleSourceFile({ name: 'x.png', type: 'image/png' }));
  assert.match(T.srcFetchErrorMessage(new Error('x'), 'file:', 'a.ddn'), /serve the site over HTTP/i);
  assert.equal(T.srcFetchErrorMessage(new Error('boom'), 'http:', 'a.ddn'), 'boom');
});

/* ---- D6 redirect mapping ---- */

test('mapLegacyParams: src/entry/view/mode/drawers preserved, junk dropped', () => {
  assert.equal(R.mapLegacyParams('?src=../../examples/basics/01-customer.ddn'), '?src=..%2F..%2Fexamples%2Fbasics%2F01-customer.ddn');
  assert.equal(R.mapLegacyParams('?entry=examples/01-customer.ddn&view=overview'), '?entry=examples%2F01-customer.ddn&view=overview');
  assert.equal(R.mapLegacyParams('?src=javascript:alert(1)'), '', 'scheme src dropped');
  assert.equal(R.mapLegacyParams('?src=/abs/x.ddn'), '', 'absolute src dropped');
  assert.equal(R.mapLegacyParams('?src=x.txt'), '', 'non-ddn src dropped');
  assert.equal(R.mapLegacyParams('?mode=bogus&drawers=x:y'), '', 'invalid mode/drawers dropped');
  assert.equal(R.mapLegacyParams('?mode=edit&drawers=source:open,files:none'), '?mode=edit&drawers=source%3Aopen%2Cfiles%3Anone');
  assert.equal(R.mapLegacyParams(''), '');
  // Old pages sat one directory deeper: same-origin ?src= paths are
  // re-relativized so legacy bookmarks keep resolving (D6).
  assert.equal(
    R.mapLegacyParams('?src=../../examples/basics/01-customer.ddn',
      'http://site/tools/viewer/index.html', '../index.html'),
    '?src=..%2Fexamples%2Fbasics%2F01-customer.ddn');
  assert.equal(R.relativize(new URL('http://site/tools/index.html'), new URL('http://site/examples/x.ddn')), '../examples/x.ddn');
  assert.equal(R.relativize(new URL('http://a/tools/index.html'), new URL('http://b/x.ddn')), null);
});

test('redirect stubs are generated for the three retired URLs and map params', () => {
  for (const rel of ['tools/viewer/index.html', 'tools/studio/index.html', 'tools/studio/editor.html']) {
    const html = fs.readFileSync(path.join(root, 'website', rel), 'utf8');
    assert.ok(html.includes('DDNRedirect.mapLegacyParams'), rel + ' missing the mapper');
    assert.ok(html.includes('location.replace'), rel + ' missing the JS redirect');
    assert.ok(html.includes('http-equiv="refresh"'), rel + ' missing the meta refresh');
    assert.ok(html.includes('../index.html'), rel + ' must target the unified tool');
  }
});

test('old sources are kept but marked deprecated (D9)', () => {
  for (const rel of ['notation/viewer/src/viewer.js', 'notation/viewer/src/template.html', 'tools/build-viewer.js', 'tools/build-portable-studio.js'])
    assert.ok(fs.readFileSync(path.join(root, rel), 'utf8').includes('Deprecated (B1-027)'), rel + ' not marked deprecated');
  assert.ok(fs.existsSync(path.join(root, 'notation/viewer/ddn-viewer.html')), 'viewer build artifact kept');
  assert.ok(fs.existsSync(path.join(root, 'notation/studio/portable-editor.html')), 'studio build artifact kept');
});

const n = results.length;
Promise.all(pending).then(() => {
  const ok = results.filter(r => r.pass).length;
  console.log(`Unified tool ${ok}/${results.length}`);
  if (ok !== results.length) process.exitCode = 1;
});
void n;
