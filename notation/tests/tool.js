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

/* ---- B1-049: host-controlled embedding (api drawer state + ?toolbar=off) ---- */

test('api drawer state (D1): accepted in URL param, localStorage config, and DRAWER_STATES', () => {
  assert.ok(T.DRAWER_STATES.includes('api'), 'api is a drawer state');
  assert.ok(!T.GEAR_STATES.includes('api'), 'gear popup never offers api');
  assert.deepEqual(T.GEAR_STATES, ['open', 'closed', 'none']);
  assert.deepEqual(T.parseDrawersParam('source:api,appearance:bogus'), { source: 'api' }, 'api accepted in ?drawers=');
  const c = T.resolveDrawerConfig('explore', { source: 'api', files: 'api' }, 'export:api');
  assert.equal(c.drawers.source, 'api', 'api accepted from localStorage');
  assert.equal(c.drawers.files, 'api');
  assert.equal(c.drawers.export, 'api', 'api accepted from URL');
  assert.equal(c.drawers.appearance, 'closed', 'preset default fills the rest');
});

test('?toolbar=off (D2): hides the toolbar without touching drawer states; beats preset toolbar:true', () => {
  assert.equal(T.parseToolbarParam('off'), 'off');
  assert.equal(T.parseToolbarParam('OFF'), 'off', 'case-insensitive per worker-param idiom');
  for (const bad of [null, '', 'on', 'true', '0', 'offf']) assert.equal(T.parseToolbarParam(bad), null, 'malformed value ignored: ' + bad);
  const c = T.resolveDrawerConfig('explore', null, 'source:api', 'off');
  assert.equal(c.toolbar, false, 'toolbar hidden');
  assert.equal(c.icons, true, 'icons config untouched — drawers stay in their configured states');
  assert.equal(c.drawers.source, 'api', 'drawer states unchanged by toolbar=off');
  const ed = T.resolveDrawerConfig('edit', null, null, 'off');
  assert.equal(ed.toolbar, false, 'beats the edit preset toolbar:true');
  assert.equal(ed.drawers.source, 'open', 'preset drawer states still apply');
  const on = T.resolveDrawerConfig('explore', null, null, 'on');
  assert.equal(on.toolbar, true, 'anything but off is ignored');
  const d = T.resolveDrawerConfig('diagram', null, null, null);
  assert.equal(d.toolbar, false, 'mode=diagram still hides the toolbar without the param');
});

test('setDrawer hardening (D3): opening a none drawer throws; api drawers open; setToolbar exists', () => {
  // The DOM setDrawer lives behind the browser boot; the shared contract is
  // asserted here and exercised for real in the headless-Chromium embed check
  // (website/examples/embed/tool-host-control.html, see the B1-049 report).
  const src = fs.readFileSync(path.join(root, 'notation/tool/src/tool.js'), 'utf8');
  assert.ok(src.includes('is none — unavailable'), 'setDrawer reports misuse when opening a none drawer');
  assert.ok(/setDrawer, setToolbar,/.test(src), 'DDNTool exposes setDrawer + setToolbar');
  assert.ok(src.includes("st === 'api' ? 'closed' : st"), 'api drawers render closed until host-opened');
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
  assert.equal(R.mapLegacyParams('?worker=off'), '?worker=off', 'explicit sync fallback survives the redirect (B1-043)');
  assert.equal(R.mapLegacyParams('?worker=bogus'), '', 'non-off worker values dropped');
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

/* ---- B1-046: option completeness mapping + base-font DDN071 UX ---- */

test('D1 mapping: every override-channel option in the live API has a drawer control', () => {
  const api = fs.readFileSync(path.join(root, 'notation/studio/src/api.js'), 'utf8');
  const tool = fs.readFileSync(path.join(root, 'notation/tool/src/tool.js'), 'utf8');
  const defBlock = /const defaults=\{([^}]+)\};/.exec(api)[1];
  const keys = [...defBlock.matchAll(/(\w+):/g)].map(m => m[1]);
  assert.ok(keys.length >= 25, 'override channel enumeration should find every defaults key');
  const selectBlock = /const SELECT_FIELDS = \[([\s\S]*?)\n\];/.exec(tool)[1];
  const covered = new Set([...selectBlock.matchAll(/'(\w+)'/g)].map(m => m[1]));
  /* relationRouting is not a single select: the "Routing per relation class"
   * panel drives it per verb (verbRouting) and per clicked relation
   * (relationRouting), merged in toolOverrides. */
  const panelCovered = { relationRouting: 'state.presentation.verbRouting' };
  const missing = keys.filter(k => !covered.has(k) && !(k in panelCovered && tool.includes(panelCovered[k])));
  assert.deepEqual(missing, [], 'override options without a drawer control');
});

test('D1: the B1-045 Chrome section and the animation drawer are present', () => {
  const tool = fs.readFileSync(path.join(root, 'notation/tool/src/tool.js'), 'utf8');
  for (const frag of ["['Chrome', [", "['Legend', 'legend'", "['Title block', 'title'", "['Footer line', 'footer'", "['Field depth (levels)', 'depth'"])
    assert.ok(tool.includes(frag), 'missing ' + frag);
  const html = fs.readFileSync(path.join(root, 'notation/tool/ddn-tool.html'), 'utf8');
  for (const id of ['ddn-drawer-animation', 'ddn-icon-animation', 'ddn-anim-toggle', 'ddn-anim-step', 'ddn-anim-speed', 'ddn-anim-flow'])
    assert.ok(html.includes('id="' + id + '"'), '#' + id + ' missing from the built tool');
});

test('D2: base-font floor and friendly pre-render message derive from the DDN071 constants', () => {
  assert.equal(T.MIN_TEXT_PX, 8 * 96 / 72);
  assert.equal(T.baseFontFloor(), 16, 'default minimum_text 8pt ≈ 10.67px floors the base font at 16px');
  assert.equal(T.baseFontFloor(8 * 96 / 72), 16, '8pt ≈ 10.67px gives the same floor');
  assert.equal(T.baseFontFloor(8), 12, 'a relaxed 8px minimum allows 12px base');
  assert.equal(T.smallestRolePx(16), 11);
  assert.equal(T.smallestRolePx(8), 5.5);
  assert.equal(T.baseFontProblem(null), null, 'unset (source default) never blocks');
  assert.equal(T.baseFontProblem(16), null);
  assert.equal(T.baseFontProblem(12, 8), null);
  const msg = T.baseFontProblem(8);
  assert.match(msg, /Base font 8px would make the smallest text 5\.50px, below the 10\.67px minimum \(DDN071\) — use ≥16px/);
  assert.match(T.baseFontProblem(7), /smallest text 4\.81px/);
  assert.match(T.baseFontProblem(12, 10.67), /10\.67px minimum \(DDN071\) — use ≥16px/);
  assert.equal(T.quantityPx({ $quantity: 8, unit: 'pt' }), 8 * 96 / 72);
  assert.equal(T.quantityPx({ $quantity: 9, unit: 'px' }), 9);
  assert.equal(T.quantityPx(11, 10.66), 11);
  assert.equal(T.quantityPx(null, 10.66), 10.66);
  assert.equal(T.quantityPx({ $quantity: NaN, unit: 'px' }, 10.66), 10.66);
});

test('D3: DDN071 names the implied minimum base font; a satisfiable font renders', () => {
  const files = { 'main.ddn': 'ddn "0.5";\nmodule "m.font";\n\ndata model {\n object a "Alpha" { kind: application; }\n object b "Beta" { kind: application; }\n relation r "uses" @a -> @b { kind: flow; }\n}\nview v "V" { data: [@model]; publication { size: content; fit: none; overflow: error; } }\n' };
  assert.throws(() => A.createWorkspace(files).renderSync({ entry: 'main.ddn', view: 'v', overrides: { fontSize: 8 } }),
    e => e.code === 'DDN071' && /5\.50px is below minimum 10\.67px — increase base font to ≥15\.5px/.test(e.message));
  assert.throws(() => A.createWorkspace(files).renderSync({ entry: 'main.ddn', view: 'v', overrides: { fontSize: 15 } }),
    e => e.code === 'DDN071' && /10\.31px is below minimum 10\.67px/.test(e.message), '15px is still below the floor');
  const out = A.createWorkspace(files).renderSync({ entry: 'main.ddn', view: 'v', overrides: { fontSize: 16 } });
  assert.ok(out.svg.includes('<svg'), '16px renders');
});

/* ---- B1-050: host I/O contract pure parts + the appearance serializer ---- */

test('B1-050 overrideProfileWrites mirrors api.js apply() branch-for-branch', () => {
  const Q = n => ({ $quantity: n, unit: 'px' });
  assert.deepEqual(T.overrideProfileWrites({}), { groups: {}, routes: {} }, 'empty overrides write nothing');
  assert.deepEqual(T.overrideProfileWrites({ theme: 'source', routing: 'source', look: null }).groups, {}, "'source'/null write nothing");
  const w = T.overrideProfileWrites({
    theme: 'night', font: 'serif', look: 'handDrawn', roughness: 1.5, hachure: false, fontSize: 18,
    routing: 'rounded', curveTension: 0.5, curveRadius: 24, crossings: 'bridge', endpointOrdering: 'preserve',
    placement: 'grid', autoPlace: false, gridStep: 16, fontSize2: undefined,
    fields: 'names', depth: 2, domains: 'hide', datatypes: 'show', kind: 'icon', labels: 'text',
    legend: 'off', title: 'off', footer: 'on', mark: 'bar',
    relationRouting: { flow: 'straight', 'm::d.r': 'rounded' }
  });
  assert.deepEqual(w.groups.style, { theme: 'night', font: 'serif', look: 'handDrawn', roughness: 1.5, hachure: false, font_size: Q(18) });
  assert.deepEqual(w.groups.layout, {
    routing: 'curved', curve: 'rounded', curve_tension: 0.5, curve_radius: Q(24),
    crossings: 'bridge', endpoint_ordering: 'preserve', algorithm: 'grid', center: 'pins',
    auto_place: false, grid_step: Q(16)
  }, 'rounded → routing curved + curve rounded; placement with source center pins (apply() semantics)');
  assert.deepEqual(w.groups.display, { fields: 'names', depth: 2, domains: 'hide', datatypes: 'show', kind: 'icon' });
  assert.deepEqual(w.groups.legend, { mode: 'text' });
  assert.deepEqual(w.groups.chrome, { legend: 'off', title: 'off', footer: 'on' });
  assert.deepEqual(w.groups.projection, { mark: 'bar' });
  assert.deepEqual(w.routes, { flow: { routing: 'straight' }, 'm::d.r': { routing: 'curved', curve: 'rounded' } });
  const p = T.overrideProfileWrites({ page: 'a4-landscape' });
  assert.deepEqual(p.groups.publication, { size: 'a4', width: Q(1600), height: Q(1000), fit: 'contain', overflow: 'error', orientation: 'landscape' }, 'page defaults width/height like apply()');
  const pc = T.overrideProfileWrites({ page: 'custom', width: 1200, height: 800 });
  assert.deepEqual(pc.groups.publication, { size: 'figure', width: Q(1200), height: Q(800), fit: 'contain', overflow: 'error' });
  const pw = T.overrideProfileWrites({ page: 'content' });
  assert.equal(pw.groups.publication.size, 'content');
  assert.equal(pw.groups.publication.fit, 'none');
  const c = T.overrideProfileWrites({ placement: 'circular', center: 'content' });
  assert.deepEqual(c.groups.layout, { algorithm: 'circular', center: 'content' }, 'explicit center is not pinned');
});

test('B1-050 cssOverlayRecord keeps only the non-empty CSS overlay channels', () => {
  assert.equal(T.cssOverlayRecord({ kindColours: {}, verbColours: {}, objectColours: {}, typography: {} }), null);
  assert.equal(T.cssOverlayRecord({}), null);
  const rec = T.cssOverlayRecord({ kindColours: { APP: '#ff0000' }, typography: { APP: { family: 'mono', size: 12 } }, verbColours: {} });
  assert.deepEqual(rec, { kindColours: { APP: '#ff0000' }, typography: { APP: { family: 'mono', size: 12 } } });
  assert.notEqual(rec.kindColours, undefined);
});

test('B1-050 pickEntryView: opts.entry/opts.view win; coded DDN-T1xx errors', () => {
  const parse = (t, n) => A.parse(t, n);
  const files = {
    'a.ddn': 'ddn "0.5";\nmodule "m.a";\ndata d { object x "X" { kind: application; } }\nview va "A" { data: [@d]; }\n',
    'b.ddn': 'ddn "0.5";\nmodule "m.b";\ndata e { object y "Y" { kind: application; } }\nview vb "B" { data: [@e]; }\nview vc "C" { data: [@e]; }\n'
  };
  assert.deepEqual(T.pickEntryView(files, {}, parse), { entry: 'a.ddn', view: 'va' }, 'first file with a view, its first view');
  assert.deepEqual(T.pickEntryView(files, { entry: 'b.ddn' }, parse), { entry: 'b.ddn', view: 'vb' });
  assert.deepEqual(T.pickEntryView(files, { view: 'vc' }, parse), { entry: 'b.ddn', view: 'vc' }, 'view search crosses files');
  assert.throws(() => T.pickEntryView(files, { entry: 'z.ddn' }, parse), e => e.code === 'DDN-T102');
  assert.throws(() => T.pickEntryView(files, { view: 'nope' }, parse), e => e.code === 'DDN-T104');
  assert.throws(() => T.pickEntryView({ 'x.ddn': 'ddn "0.5";\nmodule "m.x";\ndata d { object x "X" { kind: application; } }\n' }, {}, parse), e => e.code === 'DDN-T105', 'no view anywhere');
  assert.throws(() => T.pickEntryView({}, {}, parse), e => e.code === 'DDN-T101');
});

test('B1-050 authoring.setViewProfile writes groups, route members and x_tool_presentation through the canonical serializer', () => {
  const src = 'ddn "0.5";\nmodule "m.prof";\n\ndata model {\n object a "Alpha" { kind: application; }\n object b "Beta" { kind: application; }\n relation r "uses" @a -> @b { kind: flow; }\n}\n\nview v "V" {\n    data: [@model];\n    layout { algorithm: auto; routing: curved; }\n    publication { size: content; fit: none; }\n}\n';
  const ws = A.createWorkspace({ 'main.ddn': src });
  const rev = A.authoring.setViewProfile(ws, 'main.ddn', 'v',
    T.overrideProfileWrites({ theme: 'night', routing: 'rounded', fontSize: 18 }).groups,
    { routes: { 'm.prof::model.r': { routing: 'straight' } }, presentation: { kindColours: { APP: '#b45309' } } });
  assert.equal(rev, 1);
  const text = ws.getFiles()['main.ddn'];
  assert.match(text, /style \{\s+theme: "night";/, 'new style group inserted');
  assert.match(text, /font_size: 18px/, 'quantity serialized as px');
  assert.match(text, /route @model\.r \{\s+routing: "straight";\s+\}/, 'route member for the relation');
  assert.match(text, /x_tool_presentation: \{ "kindColours": \{ "APP": "#b45309" \} \};/, 'CSS overlay as extension record');
  const ir = ws.resolve('main.ddn', 'v');
  assert.equal(ir.view.profiles.style.theme, 'night');
  assert.equal(ir.view.profiles.layout.routing, 'curved');
  assert.equal(ir.view.profiles.layout.curve, 'rounded');
  assert.deepEqual(ir.view.routes['m.prof::model.r'], { routing: 'straight' });
  /* Idempotent: applying the same writes again changes nothing. */
  const rev2 = A.authoring.setViewProfile(ws, 'main.ddn', 'v',
    T.overrideProfileWrites({ theme: 'night', routing: 'rounded', fontSize: 18 }).groups,
    { routes: { 'm.prof::model.r': { routing: 'straight' } }, presentation: { kindColours: { APP: '#b45309' } } });
  assert.equal(rev2, rev, 'identical rewrite is a no-op commit');
  /* Removal: presentation null strips the extension record. */
  A.authoring.setViewProfile(ws, 'main.ddn', 'v', {}, { presentation: null });
  assert.ok(!ws.getFiles()['main.ddn'].includes('x_tool_presentation'));
  /* Invalid values are rejected by the commit-time build validation, coded. */
  assert.throws(() => A.authoring.setViewProfile(ws, 'main.ddn', 'v', { style: { theme: 'not-a-theme' } }, {}),
    e => !!e.code, 'unknown theme fails coded');
  assert.throws(() => A.authoring.setViewProfile(ws, 'main.ddn', 'v', { bogusGroup: { x: 1 } }, {}),
    e => e.code === 'DDN-E001', 'unknown profile group refused');
});

test('B1-050 D5 node-level round trip: serialized appearance re-renders byte-identical with no overrides', () => {
  const files = { 'main.ddn': 'ddn "0.5";\nmodule "m.rt";\n\ndata model {\n object a "Alpha" { kind: application; }\n object b "Beta" { kind: application; }\n relation r "uses" @a -> @b { kind: flow; }\n}\n\nview v "V" {\n    data: [@model];\n    layout { algorithm: auto; routing: curved; crossings: gap; }\n    style { look: classic; theme: forest; }\n    publication { size: content; fit: none; }\n    legend { mode: tokens; placement: right; }\n}\n' };
  const overrides = { theme: 'night', routing: 'rounded', fontSize: 18, fields: 'names', labels: 'text', footer: 'off' };
  const ws1 = A.createWorkspace(files);
  const before = ws1.renderSync({ entry: 'main.ddn', view: 'v', overrides }).svg;
  const writes = T.overrideProfileWrites(overrides);
  A.authoring.setViewProfile(ws1, 'main.ddn', 'v', writes.groups, { routes: {} });
  const out = ws1.getFiles();
  const ws2 = A.createWorkspace(out);
  const after = ws2.renderSync({ entry: 'main.ddn', view: 'v' }).svg;
  assert.strictEqual(after, before, 'source-serialized appearance renders the same bytes as the override channel');
});

const n = results.length;
Promise.all(pending).then(() => {
  const ok = results.filter(r => r.pass).length;
  console.log(`Unified tool ${ok}/${results.length}`);
  if (ok !== results.length) process.exitCode = 1;
});
void n;
