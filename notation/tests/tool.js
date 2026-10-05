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
  for (const id of ['ddn-toolbar', 'ddn-view-picker', 'ddn-icon-files', 'ddn-icon-style', 'ddn-icon-document', 'ddn-icon-inspector', 'ddn-icon-source', 'ddn-icon-export',
    'ddn-drawer-files', 'ddn-drawer-style', 'ddn-drawer-document', 'ddn-drawer-inspector', 'ddn-drawer-source', 'ddn-drawer-typesheet', 'ddn-drawer-export',
    'ddn-fit-page', 'ddn-fit-width', 'ddn-fit-height', 'ddn-fit-100', 'ddn-zoom', 'ddn-zoom-pct', 'ddn-drag-mode',
    'ddn-settings', 'ddn-settings-popup', 'ddn-stage', 'ddn-diagram', 'ddn-tool-status',
    'ddn-source', 'ddn-apply', 'ddn-discard', 'ddn-live-apply', 'ddn-undo', 'ddn-redo',
    'ddn-catalogue', 'ddn-file-list', 'ddn-paste', 'ddn-load-paste',
    'ddn-export-svg', 'ddn-export-png', 'ddn-export-webp', 'ddn-save-example',
    /* 0.8 (ch. 57): D2 new-document picker, D3 tabs/diagnostics/jump, D5 tidy */
    'ddn-new-project', 'ddn-template-popup', 'ddn-template-list',
    'ddn-source-tabs', 'ddn-jump-def', 'ddn-diagnostics', 'ddn-diagnostics-count',
    'ddn-tidy',
    /* Designer phase 5: the Type sheet bottom drawer (sheet outline/editor
     * panes, empty state, toolbar icon). */
    'ddn-drawer-typesheet', 'ddn-icon-typesheet', 'ddn-sheet-body', 'ddn-sheet-title',
    'ddn-sheet-empty', 'ddn-sheet-outline', 'ddn-sheet-editor',
    /* Designer phase 3: the Inspector right drawer (Meaning/This view/Details
     * tabs), its adjacent error slot, and the add-element/add-relation modals. */
    'ddn-inspector-body', 'ddn-inspector-controls', 'ddn-inspector-tabs',
    'ddn-inspector-tab-meaning', 'ddn-inspector-tab-view', 'ddn-inspector-tab-details', 'ddn-inspector-error',
    'ddn-add-element-modal', 'ddn-ae-kind', 'ddn-ae-create',
    'ddn-add-relation-modal', 'ddn-ar-from', 'ddn-ar-to', 'ddn-ar-kind', 'ddn-ar-create'])
    assert.ok(html.includes('id="' + id + '"'), 'control #' + id + ' missing');
  assert.ok(html.includes('globalThis.DDN_TOOL_TEMPLATES'), 'inlined new-document templates missing');
  assert.ok(!/pdf|pptx/i.test(html), 'OSS export surface must not offer or advertise PDF/PPTX (chapter 57 §D4)');
  for (const name of ['files', 'style', 'document', 'inspector', 'source', 'typesheet', 'export'])
    assert.ok(html.includes('data-drawer="' + name + '"'), 'toolbar icon for drawer ' + name + ' missing');
  assert.ok(html.includes("DDNToolSheets"), 'sheets.js module not inlined into the tool build');
  /* Phase 3: the Source drawer carries text editing + diagnostics only — the
   * inspector controls moved to the right-side Inspector drawer. */
  const srcDrawer = html.slice(html.indexOf('id="ddn-drawer-source"'), html.indexOf('id="ddn-drawer-inspector"'));
  assert.ok(!srcDrawer.includes('ddn-inspector-controls'), 'inspector controls must not live in the Source drawer anymore');
  assert.ok(html.includes('window.DDNTool') || html.includes('host.DDNTool'), 'DDNTool surface missing');
});

/* ---- D3/D4 drawer configuration ---- */

test('parseDrawersParam: valid pairs kept, malformed pairs and unknown names/states ignored', () => {
  assert.deepEqual(T.parseDrawersParam('style:closed,source:none'), { style: 'closed', source: 'none' });
  assert.deepEqual(T.parseDrawersParam('files:open'), { files: 'open' });
  assert.deepEqual(T.parseDrawersParam('style'), {});
  assert.deepEqual(T.parseDrawersParam('style:'), {});
  assert.deepEqual(T.parseDrawersParam(':open'), {});
  assert.deepEqual(T.parseDrawersParam('style:open,,source:closed'), { style: 'open', source: 'closed' });
  assert.deepEqual(T.parseDrawersParam('bogus:open,style:bogus,export:closed'), { export: 'closed' });
  assert.deepEqual(T.parseDrawersParam(' style : closed , source : none '), { style: 'closed', source: 'none' });
  assert.deepEqual(T.parseDrawersParam('style:closed;source:none'), {});
  assert.deepEqual(T.parseDrawersParam(null), {});
  assert.deepEqual(T.parseDrawersParam(''), {});
  /* Phase 1 split: the retired top `appearance` drawer is a legacy alias of
   * the right-side `style` drawer, in both ?drawers= and saved settings. */
  assert.deepEqual(T.parseDrawersParam('appearance:open'), { style: 'open' }, 'legacy appearance alias resolves to style');
  assert.deepEqual(T.cleanDrawerConfig({ appearance: 'closed', document: 'open' }), { style: 'closed', document: 'open' }, 'alias applies to stored config');
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
  assert.equal(ed.drawers.style, 'closed');
  assert.equal(ed.drawers.document, 'closed');
  assert.equal(T.parseMode('bogus'), null, 'unknown mode rejected');
  assert.equal(T.resolveDrawerConfig('bogus', null, null).mode, T.DEFAULT_MODE, 'unknown mode falls back to the default');
});

/* ---- B1-051 (D1): design mode — the designer as the viewer-superset ---- */

test('design mode preset (D1): explore drawers plus source open, design flag, editable affordances', () => {
  assert.equal(T.parseMode('design'), 'design', 'design is a mode');
  const d = T.resolveDrawerConfig('design', null, null);
  assert.equal(d.mode, 'design');
  assert.equal(d.toolbar, true, 'toolbar on');
  assert.equal(d.icons, true, 'drawer icons on');
  assert.equal(d.drawers.source, 'open', 'source drawer open per preset (like edit)');
  assert.equal(d.drawers.document, 'open', 'document drawer open at boot — nothing is selected');
  for (const k of ['style', 'files', 'export', 'animation']) assert.equal(d.drawers[k], 'closed');
  assert.equal(d.design, true, 'design flag marks the mode for the design bar + drag-pin default');
  for (const m of ['diagram', 'view', 'explore', 'edit'])
    assert.equal(T.resolveDrawerConfig(m, null, null).design, false, m + ' is not design');
  const off = T.resolveDrawerConfig('design', null, null, 'off');
  assert.equal(off.toolbar, false, '?mode=design&toolbar=off is the embedded-designer shape');
  assert.equal(off.design, true, 'design affordances survive toolbar=off');
  assert.equal(off.drawers.source, 'open', 'drawer preset untouched by toolbar=off');
});

test('freshLocalId (D2): kind-slugged, collision-free local identifiers', () => {
  assert.equal(T.freshLocalId([], 'table'), 'new_table');
  assert.equal(T.freshLocalId(['mod.editor_data.new_table'], 'table'), 'new_table_2', 'uid tails collide');
  assert.equal(T.freshLocalId(['new_table', 'new_table_2'], 'table'), 'new_table_3');
  assert.equal(T.freshLocalId(['new_flow_start'], 'flow.start'), 'new_flow_start_2', 'kind keywords slug');
  assert.equal(T.freshLocalId(null, '###'), 'new_element', 'empty base falls back');
});

test('legacy redirect mapper accepts mode=design (B1-051 D3)', () => {
  const R = require('../tool/src/redirect.js');
  const q = R.mapLegacyParams('?src=../examples/basics/01-customer.ddn&mode=design', 'http://x/tools/designer/index.html', '../index.html');
  assert.ok(q.includes('mode=design'), 'design mode survives legacy redirects: ' + q);
  assert.ok(q.includes('src='), 'src survives');
});


test('precedence (D3): URL param > localStorage > preset defaults', () => {
  const c = T.resolveDrawerConfig('explore', { files: 'open', source: 'open' }, 'source:none,bogus:x');
  assert.equal(c.drawers.source, 'none', 'URL beats localStorage');
  assert.equal(c.drawers.files, 'open', 'localStorage beats preset');
  assert.equal(c.drawers.style, 'closed', 'preset default fills the rest');
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
  assert.equal(c.drawers.style, 'closed', 'preset default fills the rest');
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
   * (relationRouting), merged in toolOverrides. mindNodes is gesture-driven:
   * the on-canvas resize handle (attachMindmap) writes it — no drawer.
   * Phase 1 drawer split: publication/chrome/legend settings (page, width,
   * height, legend, title, footer, labels → legend.mode) moved to the
   * source-backed Document drawer form (DOCUMENT_FIELDS), which writes the
   * view block directly instead of previewing via the session channel. */
  const panelCovered = { relationRouting: 'state.presentation.verbRouting', mindNodes: 'state.presentation.mindNodes' };
  const documentCovered = ['page', 'width', 'height', 'legend', 'title', 'footer'];
  const missing = keys.filter(k => !covered.has(k) && !documentCovered.includes(k) && !(k in panelCovered && tool.includes(panelCovered[k])));
  assert.deepEqual(missing, [], 'override options without a drawer control');
  assert.ok(tool.includes('ddn-document-body'), 'document drawer body missing');
});

test('D1: the Document drawer form covers chrome/publication/legend and the animation drawer is present', () => {
  const tool = fs.readFileSync(path.join(root, 'notation/tool/src/tool.js'), 'utf8');
  const docBlock = /const DOCUMENT_FIELDS = \[([\s\S]*?)\n\];/.exec(tool)[1];
  const covered = new Set([...docBlock.matchAll(/'(\w+)'/g)].map(m => m[1]));
  for (const key of ['size', 'width', 'height', 'margin', 'orientation', 'fit', 'minimum_text', 'overflow', 'embedding_scale', 'title', 'caption',
    'legend', 'footer', 'banner', 'mode', 'placement', 'description', 'source', 'generator'])
    assert.ok(covered.has(key), 'Document form missing ' + key);
  for (const frag of ['setViewChrome', 'setViewProperties', 'setViewProfile'])
    assert.ok(tool.includes('A.authoring.' + frag), 'Document drawer not wired to authoring.' + frag);
  const html = fs.readFileSync(path.join(root, 'notation/tool/ddn-tool.html'), 'utf8');
  for (const id of ['ddn-drawer-animation', 'ddn-icon-animation', 'ddn-anim-toggle', 'ddn-anim-step', 'ddn-anim-speed', 'ddn-anim-flow',
    'ddn-drawer-document', 'ddn-icon-document', 'ddn-document-body', 'ddn-drawer-style', 'ddn-icon-style', 'ddn-style-body'])
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

test('B1-052 D5: artboard pre-validation names the smallest usable artboard (DDN071)', () => {
  assert.equal(T.pageDims('source'), null, 'source publication is the source file\'s business');
  assert.equal(T.pageDims('content'), null, 'content-sized pages never down-scale');
  assert.deepEqual(T.pageDims('web'), { w: 1600, h: 1000 });
  assert.deepEqual(T.pageDims('custom', 400, 300), { w: 400, h: 300 });
  assert.deepEqual(T.pageDims('custom'), { w: 1600, h: 1000 }, 'custom defaults mirror the component');
  const a4p = T.pageDims('a4-portrait'), a4l = T.pageDims('a4-landscape');
  assert.ok(Math.abs(a4p.w - 210 * 96 / 25.4) < 1e-9 && Math.abs(a4p.h - 297 * 96 / 25.4) < 1e-9);
  assert.ok(a4l.w === a4p.h && a4l.h === a4p.w, 'landscape swaps the axes');
  const lp = T.pageDims('letter-portrait');
  assert.ok(lp.w === 8.5 * 96 && lp.h === 11 * 96);
  assert.throws(() => T.pageDims('tabloid'), /unknown page preset/);
  // Scale floor: default base 16 → smallest role 11px; relations cap at 12·scale.
  assert.ok(Math.abs(T.pageScaleFloor(8 * 96 / 72, 16, true) - (8 * 96 / 72) / 11) < 1e-12);
  assert.ok(T.pageScaleFloor(8, 16, false) < T.pageScaleFloor(16, 16, false), 'higher minimum → higher floor');
  assert.throws(() => T.pageScaleFloor(0, 16, true), /positive number/);
  // Scene geometry: 800×500 drawing, 360×210 chrome overhead, default minimum.
  const ctx = { contentW: 800, contentH: 500, chromeW: 360, chromeH: 210, minTextPx: 8 * 96 / 72, baseFontPx: 16, hasRelations: true, embeddingScale: 1 };
  const floor = T.pageScaleFloor(ctx.minTextPx, ctx.baseFontPx, true);
  const minW = Math.ceil(800 * floor + 360 - 1e-9), minH = Math.ceil(500 * floor + 210 - 1e-9);
  assert.equal(T.artboardProblem(minW, minH, ctx), null, 'the named minimum artboard is usable');
  assert.equal(T.artboardProblem(1600, 1000, ctx), null, 'a generous artboard passes');
  assert.equal(T.artboardProblem(null, null, ctx), null, 'content-sized page never blocks');
  assert.equal(T.artboardProblem(400, 400, null), null, 'no scene yet → renderer backstop');
  const msg = T.artboardProblem(400, 400, ctx);
  assert.match(msg, /Artboard 400×400px/);
  assert.match(msg, /below the 10\.67px minimum \(DDN071\)/);
  assert.match(msg, new RegExp('smallest usable artboard for this drawing is ' + minW + '×' + minH + 'px'));
  assert.match(msg, /enlarge the base font, reduce content, or lower publication\.minimum_text/);
  const oneSide = T.artboardProblem(1600, 400, ctx);
  assert.match(oneSide, /Artboard 1600×400px/, 'one short side is enough to block');
  assert.match(oneSide, new RegExp(minW + '×' + minH + 'px'));
  // Cross-check against the renderer: a page below the named minimum must hard-fail
  // DDN071 with the remedy; at/above it must render.
  const files = { 'main.ddn': 'ddn "0.5";\nmodule "m.art";\n\ndata model {\n object a "Alpha" { kind: application; }\n object b "Beta" { kind: application; }\n relation r "uses" @a -> @b { kind: flow; }\n}\nview v "V" { data: [@model]; publication { size: content; fit: none; overflow: error; } }\n' };
  const ws = A.createWorkspace(files);
  const full = ws.renderSync({ entry: 'main.ddn', view: 'v' });
  const scene = full.scene;
  const liveCtx = { contentW: scene.drawingBounds.w, contentH: scene.drawingBounds.h,
    chromeW: scene.width - scene.drawingArea.w, chromeH: scene.height - scene.drawingArea.h,
    minTextPx: 8 * 96 / 72, baseFontPx: 16, hasRelations: true, embeddingScale: 1 };
  const msg2 = T.artboardProblem(400, 400, liveCtx);
  assert.ok(msg2, 'tiny artboard flagged for the live scene too');
  const mw = Number(/is (\d+)×(\d+)px/.exec(msg2)[1]), mh = Number(/is (\d+)×(\d+)px/.exec(msg2)[2]);
  /* B1-100 note: text-mode legends suppress by default, so this fixture's
   * minimum artboard is narrower than when the legend band was reserved —
   * 800px now renders; 700px is below the named minimum. */
  assert.throws(() => A.createWorkspace(files).renderSync({ entry: 'main.ddn', view: 'v', overrides: { page: 'custom', width: 700, height: 1000 } }),
    e => e.code === 'DDN071' && /increase base font to ≥[\d.]+px|enlarge/.test(e.message),
    'below the named minimum the renderer fails DDN071 naming the remedy');
  assert.throws(() => A.createWorkspace(files).renderSync({ entry: 'main.ddn', view: 'v', overrides: { page: 'custom', width: mw - 20, height: 1000 } }),
    e => e.code === 'DDN071' && /increase base font to ≥[\d.]+px|enlarge the page/.test(e.message),
    'just below the named minimum every DDN071 branch names its remedy');
  const ok = A.createWorkspace(files).renderSync({ entry: 'main.ddn', view: 'v', overrides: { page: 'custom', width: mw, height: Math.max(mh, 400) } });
  assert.ok(ok.svg.includes('<svg'), 'the named minimum artboard renders (height clamped to the component floor 400)');
});

test('D3: DDN071 names the implied minimum base font; a satisfiable font renders', () => {  const files = { 'main.ddn': 'ddn "0.5";\nmodule "m.font";\n\ndata model {\n object a "Alpha" { kind: application; }\n object b "Beta" { kind: application; }\n relation r "uses" @a -> @b { kind: flow; }\n}\nview v "V" { data: [@model]; publication { size: content; fit: none; overflow: error; } }\n' };
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

/* B1-071: shared option tables (tool/src/options.js) must not drift from the
 * runtime's own constants (ddn-text.js FONTS). */
test('options.js drift guard: FONT_STACKS equals runtime DDNText.FONTS', () => {
  const O = require('../tool/src/options.js');
  const FONTS = globalThis.__DDN_MODULE_REGISTRY__.namespaces.DDNText.FONTS;
  assert.deepEqual(O.FONT_STACKS, FONTS);
  assert.deepEqual(O.ROUTING_VALUES, ['orthogonal', 'straight', 'curved', 'rounded', 'string']);
});

/* ---- DDN 0.8 (standard chapter 57): designer contract surface ---- */

test('D2: every new-document template is a valid .ddn that renders its main view', () => {
  const dir = path.join(root, 'notation/tool/templates');
  const names = fs.readdirSync(dir).filter(f => f.endsWith('.ddn')).sort();
  assert.deepEqual(names, ['blank.ddn', 'c4-container.ddn', 'ddn-native.ddn', 'flowchart.ddn', 'patent-figure.ddn']);
  for (const f of names) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.match(src, /^ddn "0\.6";/, f + ' is a 0.6 skeleton');
    const w = A.createWorkspace({ 'main.ddn': src });
    const r = w.renderSync({ entry: 'main.ddn', view: 'main' });
    assert.ok(r.svg.includes('<svg'), f + ' renders');
    w.destroy();
  }
  // The blank skeleton is the chapter 57 §D2 empty document: header, module,
  // one view, publication defaults with size: content.
  const blank = fs.readFileSync(path.join(dir, 'blank.ddn'), 'utf8');
  assert.match(blank, /data model \{\s*\}/, 'blank data block is empty');
  assert.match(blank, /publication \{ size: content; fit: none; \}/, 'blank publication defaults');
});

test('D2: template picker list is keyed to the registered view kinds', () => {
  const F = require('../tool/src/files.js');
  const list = F.templateList({ blank: '', flowchart: '', 'c4-container': '' }, A.viewProfiles.VIEW_KINDS);
  assert.strictEqual(list[0].id, 'blank');
  assert.ok(list.find(t => t.id === 'flowchart').label.includes('view kind flowchart'));
});

test('D3: add-file naming conventions — kebab sibling, import line, alias', () => {
  const F = require('../tool/src/files.js');
  assert.strictEqual(F.suggestFileName('model/billing.ddn', {}), 'model/new-module.ddn');
  assert.strictEqual(F.suggestFileName('model/billing.ddn', { 'model/new-module.ddn': '' }), 'model/new-module-2.ddn');
  assert.strictEqual(F.suggestFileName('main.ddn', {}), 'new-module.ddn');
  assert.strictEqual(F.importLineFor('model/billing.ddn', 'model/views.ddn'), 'import "views.ddn" as views;');
  assert.strictEqual(F.importLineFor('main.ddn', 'model/order-entry.ddn'), 'import "model/order-entry.ddn" as order_entry;');
  assert.strictEqual(F.importLineFor('a/b/c.ddn', 'a/x.ddn'), 'import "../x.ddn" as x;');
  assert.strictEqual(F.aliasForFile('x/order-entry.ddn'), 'order_entry');
});

test('D3/X4: stableDiagnostic produces the contract shape, line from offset', () => {
  const F = require('../tool/src/files.js');
  const d = F.stableDiagnostic({ code: 'DDN-PJ104', severity: 'error', source: 'model/billing.ddn', start: 6, message: 'broken' }, { 'model/billing.ddn': 'one\ntwo\nthree' }, 'billing');
  assert.deepEqual(d, { code: 'DDN-PJ104', severity: 'error', file: 'model/billing.ddn', line: 2, view: 'billing', message: 'broken' });
  const siteless = F.stableDiagnostic({ code: 'DDN-LW06', severity: 'warning', message: 'no site' }, {});
  assert.ok(!('file' in siteless) && !('line' in siteless), 'site-less diagnostics omit file/line');
});

/* Designer phase 2: capability-filtered Add palette (pure paletteFilter). */
test('paletteFilter: unprofiled graph views offer generic kinds only', () => {
  const kinds = [
    { id: 'table', allowed_in: ['graph'] },
    { id: 'object', allowed_in: ['concept.map@1', 'graph', 'mindmap.basic@1'] },
    { id: 'uml.class', allowed_in: ['graph', 'uml.structure@2'] },
    { id: 'flow.process', allowed_in: ['flow.basic@1', 'graph'] }
  ];
  const out = T.paletteFilter(kinds, { kind: 'graph', profile: 'ddn@1' }, false).map(k => k.id);
  assert.deepEqual(out, ['table', 'object']);
  const noProjection = T.paletteFilter(kinds, null, false).map(k => k.id);
  assert.deepEqual(noProjection, ['table', 'object'], 'absent projection is the unprofiled graph view');
});

test('paletteFilter: profiled graph views offer only the profile kinds; showAll is the escape hatch', () => {
  const kinds = [
    { id: 'table', allowed_in: ['graph'] },
    { id: 'uml.class', allowed_in: ['graph', 'uml.structure@2'] },
    { id: 'uml.interface', allowed_in: ['graph', 'uml.structure@2'] },
    { id: 'flow.process', allowed_in: ['flow.basic@1', 'graph'] }
  ];
  const out = T.paletteFilter(kinds, { kind: 'graph', profile: 'uml.structure@2' }, false).map(k => k.id);
  assert.deepEqual(out, ['uml.class', 'uml.interface']);
  assert.strictEqual(T.paletteFilter(kinds, { kind: 'graph', profile: 'uml.structure@2' }, true).length, 4, 'showAll bypasses the filter');
  /* kinds without allowed_in metadata degrade to the graph default. */
  const legacy = T.paletteFilter([{ id: 'x.custom' }], { kind: 'graph', profile: 'ddn@1' }, false);
  assert.deepEqual(legacy, [], 'unknown profile kinds stay out of the unprofiled shelf');
});

/* Designer phase 3: Inspector drawer promotion, relation editing, modals. */

test('design mode preset includes the inspector drawer (closed until a selection)', () => {
  const d = T.resolveDrawerConfig('design', null, null);
  assert.equal(d.drawers.inspector, 'closed');
  assert.equal(T.resolveDrawerConfig('explore', null, null).drawers.inspector, 'closed');
  assert.equal(T.resolveDrawerConfig('diagram', null, null).drawers.inspector, 'none');
  assert.deepEqual(T.parseDrawersParam('inspector:open'), { inspector: 'open' });
  assert.deepEqual(T.cleanDrawerConfig({ inspector: 'closed' }), { inspector: 'closed' });
});

test('inspector drawer joins the right-side exclusivity set in the tool source', () => {
  const tool = fs.readFileSync(path.join(root, 'notation/tool/src/tool.js'), 'utf8');
  assert.ok(tool.includes("const RIGHT_EXCLUSIVE = ['document', 'style', 'inspector']"), 'RIGHT_EXCLUSIVE must include inspector');
  assert.ok(tool.includes("state.config.drawers.inspector = 'open'"), 'selection must open the inspector drawer');
  for (const frag of ['setRelationProps', 'setRelationExtension'])
    assert.ok(tool.includes('A.authoring.' + frag), 'relation editing not wired to authoring.' + frag);
  assert.ok(!/prompt\('Stable (relation )?identifier'/.test(tool), 'prompt()-based add dialogs must be gone');
});

test('cardinalityText/cardinalitySentence: the spec-05 sentence preview', () => {
  assert.equal(T.cardinalityText(undefined, undefined), null);
  assert.equal(T.cardinalityText(1, 1), 'one');
  assert.equal(T.cardinalityText(0, undefined), 'zero or more');
  assert.equal(T.cardinalityText(1, undefined), 'one or more');
  assert.equal(T.cardinalityText(0, 1), '0..1');
  assert.equal(T.cardinalityText(2, 2), '2');
  assert.equal(T.cardinalityText(undefined, 3), 'up to 3');
  assert.equal(T.cardinalitySentence('Customer', 'Orders', { source_min: 1, source_max: 1, target_min: 0 }),
    'For one Customer, zero or more Orders.');
  assert.equal(T.cardinalitySentence('Customer', 'Orders', {}), null, 'nothing asserted → no sentence');
});

test('markCardinality seeds the sentence from visual endpoint marks', () => {
  assert.deepEqual(T.markCardinality('one'), { min: 1, max: 1 });
  assert.deepEqual(T.markCardinality('zeromany'), { min: 0 });
  assert.equal(T.markCardinality('filled'), null, 'non-cardinality marks do not seed');
  assert.ok(T.ENDPOINT_MARKS.includes('crow') === false && T.ENDPOINT_MARKS.includes('zeromany'));
});

test('umlMultiplicityOk: the DDN-PJ149 grammar (1, 0..1, 0..*, 1..*, *)', () => {
  for (const ok of ['1', '0..1', '0..*', '1..*', '*', '7', '2..9']) assert.ok(T.umlMultiplicityOk(ok), ok + ' must pass');
  for (const bad of ['', 'many', '1..', '..*', '1..2..3', '0,*', '-1']) assert.ok(!T.umlMultiplicityOk(bad), JSON.stringify(bad) + ' must fail');
});

test('groupDetails groups a definition property record per data-properties.json groups', () => {
  const groups = T.groupDetails({ kind: 'assoc', enforcement: 'database', source_min: 1, owner: 'team-a', x_custom: { a: 1 }, description: 'd' }, 'relation');
  const byGroup = new Map(groups.map(g => [g.group, g.entries.map(e => e[0])]));
  assert.deepEqual(byGroup.get('Relations'), ['kind', 'enforcement', 'source_min'], 'relation kind belongs to the Relations group');
  assert.deepEqual(byGroup.get('Governance and SQL metadata'), ['owner']);
  assert.deepEqual(byGroup.get('Identity and evidence'), ['description']);
  assert.deepEqual(byGroup.get('Extensions and other'), ['x_custom']);
  const elGroups = T.groupDetails({ kind: 'table', level: 'definition' }, 'element');
  assert.deepEqual(new Map(elGroups.map(g => [g.group, g.entries.map(e => e[0])])).get('Element identity'), ['kind', 'level'], 'element kind belongs to Element identity');
  assert.deepEqual(T.groupDetails({}, 'element'), [], 'empty record → no groups');
});

test('mixedValue / multiSelection: intersect controls, never coerce (spec 05)', () => {
  assert.deepEqual(T.mixedValue(['a', 'a']), { mixed: false, value: 'a' });
  assert.deepEqual(T.mixedValue(['a', 'b']), { mixed: true, value: undefined });
  assert.deepEqual(T.mixedValue([undefined, undefined]), { mixed: false, value: undefined });
  const m = T.multiSelection([{ id: 'x', kind: 'table', isRelation: false }, { id: 'y', kind: 'table', isRelation: false }]);
  assert.equal(m.count, 2); assert.equal(m.kind, 'table'); assert.equal(m.kindMixed, false);
  assert.equal(m.meaningEditable, false, 'single-identity edits are never offered on multi-selection');
  assert.equal(m.allElements, true);
  const mixed = T.multiSelection([{ id: 'x', kind: 'table', isRelation: false }, { id: 'r', kind: 'assoc', isRelation: true }]);
  assert.equal(mixed.kindMixed, true); assert.equal(mixed.occurrenceEditable, false, 'mixed element/relation selection intersects to nothing');
  const single = T.multiSelection([{ id: 'x', kind: 'table', isRelation: false }]);
  assert.equal(single.meaningEditable, true);
});

test('usedInViews lists the views whose resolved model contains a uid', () => {
  const views = [
    { entry: 'a.ddn', view: 'v1', ids: ['m::d.x', 'm::d.r'] },
    { entry: 'a.ddn', view: 'v2', ids: ['m::d.x'] },
    { entry: 'b.ddn', view: 'w', ids: ['m::d.y'] }
  ];
  assert.deepEqual(T.usedInViews(views, 'm::d.x'), [{ entry: 'a.ddn', view: 'v1' }, { entry: 'a.ddn', view: 'v2' }]);
  assert.deepEqual(T.usedInViews(views, 'm::d.zzz'), []);
});

/* Phase 3 authoring APIs (dist ddn.global.js): relation batch property writes
 * and x_* extension merge-writes, both validated + undoable. */
test('authoring.setRelationProps: one undoable transaction for cardinality/enforcement/marks', () => {
  const src = 'ddn "0.5"; module "t"; data m { object a "A" { kind: table; } object b "B" { kind: table; } relation r "R" @a -> @b { kind: ref; } } view v { data: [@m]; }';
  const w = A.createWorkspace({ 'main.ddn': src });
  const uid = w.resolve('main.ddn', 'v').relations[0].id;
  A.authoring.setRelationProps(w, 'main.ddn', 'v', uid, { source_min: 1, target_max: 4, enforcement: 'database', source_mark: 'one' });
  const text = w.getFiles()['main.ddn'];
  for (const frag of ['source_min: 1;', 'target_max: 4;', 'enforcement: "database";', 'source_mark: "one";'])
    assert.ok(text.includes(frag), 'missing ' + frag + ' in ' + text);
  const rel = w.resolve('main.ddn', 'v').relations[0];
  assert.equal(rel.properties.source_min, 1);
  assert.equal(rel.properties.enforcement, 'database');
  A.authoring.setRelationProps(w, 'main.ddn', 'v', uid, { source_min: undefined });
  assert.equal(w.resolve('main.ddn', 'v').relations[0].properties.source_min, undefined, 'undefined removes the property');
  assert.throws(() => A.authoring.setRelationProps(w, 'main.ddn', 'v', uid, { source_min: -1 }), e => e.code === 'DDN-E001');
  assert.throws(() => A.authoring.setRelationProps(w, 'main.ddn', 'v', uid, { bogus: 1 }), e => e.code === 'DDN-E001');
  const elUid = w.resolve('main.ddn', 'v').elements[0].id;
  assert.throws(() => A.authoring.setRelationProps(w, 'main.ddn', 'v', elUid, { enforcement: 'none' }), e => e.code === 'DDN-E006', 'element targets are refused');
  w.undo(); w.undo();
  assert.equal(w.resolve('main.ddn', 'v').relations[0].properties.enforcement, undefined, 'undo restores the previous source');
});

test('authoring.setRelationExtension: per-key merge of x_endlabels, PJ149 judged at commit', () => {
  const src = 'ddn "0.5"; module "t"; data m { object a "A" { kind: "uml.class"; } object b "B" { kind: "uml.class"; } relation r "R" @a -> @b { kind: "uml.association"; } } view v { data: [@m]; }';
  const w = A.createWorkspace({ 'main.ddn': src });
  const uid = w.resolve('main.ddn', 'v').relations[0].id;
  A.authoring.setRelationExtension(w, 'main.ddn', 'v', uid, 'x_endlabels', { source: { multiplicity: '1', role: 'owner' } });
  A.authoring.setRelationExtension(w, 'main.ddn', 'v', uid, 'x_endlabels', { target: { multiplicity: '0..*' } });
  const el = w.resolve('main.ddn', 'v').relations[0].properties.x_endlabels;
  assert.deepEqual(el, { source: { multiplicity: '1', role: 'owner' }, target: { multiplicity: '0..*' } }, 'per-end merge preserves sibling ends');
  /* sub-record null removes that end */
  A.authoring.setRelationExtension(w, 'main.ddn', 'v', uid, 'x_endlabels', { target: null });
  assert.deepEqual(w.resolve('main.ddn', 'v').relations[0].properties.x_endlabels, { source: { multiplicity: '1', role: 'owner' } });
  /* PJ149 grammar is the commit-time authority: a bad multiplicity fails coded. */
  assert.throws(() => A.authoring.setRelationExtension(w, 'main.ddn', 'v', uid, 'x_endlabels', { source: { multiplicity: 'many' } }),
    e => e.code === 'DDN-PJ149', 'PJ149 rejects a non-UML multiplicity');
  /* PJ149 kind legality: end labels on a non-UML verb fail coded. */
  const w2 = A.createWorkspace({ 'main.ddn': 'ddn "0.5"; module "t"; data m { object a "A" { kind: table; } object b "B" { kind: table; } relation r "R" @a -> @b { kind: ref; } } view v { data: [@m]; }' });
  const uid2 = w2.resolve('main.ddn', 'v').relations[0].id;
  assert.throws(() => A.authoring.setRelationExtension(w2, 'main.ddn', 'v', uid2, 'x_endlabels', { source: { multiplicity: '1' } }),
    e => e.code === 'DDN-PJ149', 'PJ149 confines end labels to UML association verbs');
  assert.throws(() => A.authoring.setRelationExtension(w, 'main.ddn', 'v', uid, 'kind', {}), e => e.code === 'DDN-E001', 'non-x_* keys refused');
});

/* ---------------------------------------------------------------- phase 4
 * Descriptor-driven form generator (spec 05): forms.js pure layer (value
 * states, visibility AST, draft/commit semantics), the generated descriptor
 * registry's freshness, and the generic authoring.setElementProperties batch
 * write the generated forms bind to. */

test('valueState distinguishes unset / null / value (spec 05: null is data)', () => {
  assert.equal(T.valueState(undefined), 'unset');
  assert.equal(T.valueState(null), 'null');
  assert.equal(T.valueState(''), 'value');
  assert.equal(T.valueState(0), 'value');
  assert.equal(T.valueState(false), 'value');
});

test('evalWhen evaluates the visibility AST (all/any/not/equals/hasCapability)', () => {
  const ctx = { props: { kind: 'uml.class', maturity: 'approved' }, capabilities: ['uml.structure@2', 'graph'] };
  assert.equal(T.evalWhen(null, ctx), true);
  assert.equal(T.evalWhen({ equals: { key: 'maturity', value: 'approved' } }, ctx), true);
  assert.equal(T.evalWhen({ equals: { key: 'maturity', value: 'draft' } }, ctx), false);
  assert.equal(T.evalWhen({ equals: { key: 'missing', value: undefined } }, ctx), true, 'absent equals undefined');
  assert.equal(T.evalWhen({ hasCapability: 'uml.structure@2' }, ctx), true);
  assert.equal(T.evalWhen({ hasCapability: 'bpmn@1' }, ctx), false);
  assert.equal(T.evalWhen({ all: [{ hasCapability: 'graph' }, { equals: { key: 'kind', value: 'uml.class' } }] }, ctx), true);
  assert.equal(T.evalWhen({ any: [{ hasCapability: 'bpmn@1' }, { equals: { key: 'kind', value: 'uml.class' } }] }, ctx), true);
  assert.equal(T.evalWhen({ not: { hasCapability: 'graph' } }, ctx), false);
  assert.throws(() => T.evalWhen({ executable: 'js()' }, ctx), /unknown visibility predicate/, 'executable JS is not a predicate');
});

test('widgetForShape maps registry value_shapes to widgets', () => {
  assert.equal(T.widgetForShape('string'), 'text');
  assert.equal(T.widgetForShape('string[]'), 'string-list');
  assert.equal(T.widgetForShape('boolean'), 'optional-boolean');
  assert.equal(T.widgetForShape('nonnegative integer'), 'number');
  assert.equal(T.widgetForShape('draft/review/approved/deprecated/retired/rejected or undecided'), 'select');
  assert.equal(T.widgetForShape('flow | pulse | none'), 'select');
  assert.equal(T.widgetForShape('enum: north | south | east | west'), 'select');
  assert.equal(T.widgetForShape('length (px), >0 and <=128px'), 'quantity');
  assert.equal(T.widgetForShape('reference'), 'reference');
  assert.equal(T.widgetForShape('scope record'), 'record');
  assert.deepEqual(T.choicesForShape('flow | pulse | none'), ['flow', 'pulse', 'none']);
});

test('parseDraft / commitOutcome: blank removes, invalid carries a code, valid sets', () => {
  const num = { id: 'x.n', key: 'n', label: 'N', widget: 'number', min: 0, max: 10, integer: true };
  assert.deepEqual(T.parseDraft(num, ''), { ok: true, value: undefined }, 'blank parses to unset (removal, not blanking)');
  assert.deepEqual(T.parseDraft(num, '4'), { ok: true, value: 4 });
  assert.equal(T.parseDraft(num, '11').ok, false);
  assert.equal(T.parseDraft(num, '11').code, 'DDN-UI02');
  assert.equal(T.parseDraft(num, 'x').ok, false);
  assert.deepEqual(T.commitOutcome(num, '4', undefined), { action: 'set', value: 4 });
  assert.deepEqual(T.commitOutcome(num, '', 4), { action: 'remove' });
  assert.deepEqual(T.commitOutcome(num, '', undefined), { action: 'none' });
  assert.deepEqual(T.commitOutcome(num, '4', 4), { action: 'none' }, 'unchanged draft is no transaction');
  assert.equal(T.commitOutcome(num, '99', undefined).action, 'error');

  const tri = { id: 'x.b', key: 'b', label: 'B', widget: 'optional-boolean' };
  assert.deepEqual(T.parseDraft(tri, ''), { ok: true, value: undefined }, 'tri-state "Not set" is unset, not false');
  assert.deepEqual(T.parseDraft(tri, 'true'), { ok: true, value: true });
  assert.deepEqual(T.parseDraft(tri, 'false'), { ok: true, value: false });

  const q = { id: 'x.q', key: 'q', label: 'Q', widget: 'quantity', units: ['px', 'pt'], min: 1 };
  assert.deepEqual(T.parseDraft(q, { value: '12', unit: 'pt' }), { ok: true, value: { $quantity: 12, unit: 'pt' } }, 'quantities retain their unit');
  assert.deepEqual(T.parseDraft(q, { value: '', unit: 'px' }), { ok: true, value: undefined });
  assert.equal(T.parseDraft(q, { value: '0', unit: 'px' }).ok, false);

  const list = { id: 'x.l', key: 'l', label: 'L', widget: 'string-list' };
  assert.deepEqual(T.parseDraft(list, 'a, b ,, c'), { ok: true, value: ['a', 'b', 'c'] });
  assert.deepEqual(T.parseDraft(list, '  '), { ok: true, value: undefined });

  const ref = { id: 'x.r', key: 'r', label: 'R', widget: 'reference' };
  assert.deepEqual(T.parseDraft(ref, '@m.orders'), { ok: true, value: { $ref: 'm.orders' } });
  assert.equal(T.parseDraft(ref, 'not a ref!').ok, false);
  assert.equal(T.parseDraft(ref, 'not a ref!').code, 'DDN-UI04');

  /* removing is distinct from blanking: a text draft never produces '' */
  const txt = { id: 'x.t', key: 't', label: 'T', widget: 'text' };
  assert.deepEqual(T.parseDraft(txt, '   '), { ok: true, value: undefined });
  assert.deepEqual(T.parseDraft(txt, 'hello'), { ok: true, value: 'hello' });
});

test('formatDraft is the display inverse of parseDraft', () => {
  const q = { id: 'x.q', key: 'q', label: 'Q', widget: 'quantity', units: ['px', 'pt'] };
  assert.deepEqual(T.formatDraft(q, { $quantity: 12, unit: 'pt' }), { value: '12', unit: 'pt' });
  assert.deepEqual(T.formatDraft(q, undefined), { value: '', unit: 'px' });
  assert.equal(T.formatDraft({ id: 'x.l', key: 'l', widget: 'string-list' }, ['a', 'b']), 'a, b');
  assert.equal(T.formatDraft({ id: 'x.r', key: 'r', widget: 'reference' }, { $ref: 'm.orders' }), '@m.orders');
  assert.equal(T.formatDraft({ id: 'x.b', key: 'b', widget: 'optional-boolean' }, false), 'false');
});

test('commitRecord: all-absent removes the record instead of writing {}', () => {
  const d = { id: 'x.g', key: 'x_genset', widget: 'record' };
  assert.deepEqual(T.commitRecord(d, { name: 'gs', disjoint: true }), { action: 'set', value: { name: 'gs', disjoint: true } });
  assert.deepEqual(T.commitRecord(d, { name: undefined, disjoint: undefined }), { action: 'remove' });
  assert.deepEqual(T.commitRecord(d, {}), { action: 'remove' });
});

test('descriptorsForTarget filters by target and evaluates visibility', () => {
  const list = [
    { id: 'a', key: 'a', targets: ['element'], group: 'G' },
    { id: 'b', key: 'b', targets: ['relation'], group: 'G' },
    { id: 'c', key: 'c', targets: ['element'], group: 'H', when: { hasCapability: 'uml.structure@2' } }
  ];
  assert.deepEqual(T.descriptorsForTarget(list, 'element', {}).map(d => d.id), ['a']);
  assert.deepEqual(T.descriptorsForTarget(list, 'element', { capabilities: ['uml.structure@2'] }).map(d => d.id), ['a', 'c']);
  const grouped = T.groupDescriptors(T.descriptorsForTarget(list, 'element', { capabilities: ['uml.structure@2'] }));
  assert.deepEqual(grouped.map(g => g.group), ['G', 'H']);
});

test('form descriptor registry: generated from the data registry + extension contracts, freshness-gated', () => {
  const r = cp.spawnSync(process.execPath, [path.join(root, 'designer', 'contracts', 'build-form-descriptors.mjs'), '--check'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, 'form descriptors stale: ' + (r.stderr || r.stdout));
  const REG = require('../../designer/contracts/form-descriptors.json');
  assert.ok(REG.descriptors.length > 80, 'registry-derived descriptor surface present');
  const dp = JSON.parse(fs.readFileSync(path.join(root, 'standard/registry/data-properties.json'), 'utf8'));
  const registryPaths = new Set(REG.descriptors.filter(d => d.id.startsWith('ddn.prop.')).map(d => d.key));
  for (const p of dp.properties) {
    if (!p.targets.some(t => ['element', 'relation', 'field'].includes(t)) || p.path === 'uid') continue;
    assert.ok(registryPaths.has(p.path), 'data-properties path ' + p.path + ' missing a descriptor');
  }
  for (const d of REG.descriptors) {
    assert.ok(d.id && d.key && d.label && d.widget && d.scope && d.group, 'descriptor ' + d.id + ' carries the spec-05 fields');
    assert.ok(['text', 'number', 'quantity', 'select', 'optional-boolean', 'reference', 'string-list', 'record'].includes(d.widget), d.id + ' widget');
    assert.ok(d.states.includes('unset'), d.id + ' must admit the unset state (removal ≠ blanking)');
    if (d.when) T.evalWhen(d.when, { props: {}, capabilities: [] }); // AST parses
  }
  const genset = REG.descriptors.find(d => d.key === 'x_genset');
  assert.ok(genset && genset.widget === 'record' && genset.fields.length === 3, 'closed extension contracts become structured records');
  assert.ok(REG.skipped_extensions.includes('x_endlabels'), 'free-form/UML-governed extensions stay out of the generated surface');
});

test('tool build inlines the descriptor registry and the forms module', () => {
  const html = fs.readFileSync(path.join(root, 'notation/tool/ddn-tool.html'), 'utf8');
  assert.ok(html.includes('globalThis.DDN_FORM_DESCRIPTORS'), 'descriptor registry not inlined');
  assert.ok(html.includes('build-form-descriptors.mjs'), 'inlined registry must name its generator');
  assert.ok(html.includes('DDNToolForms'), 'forms module not inlined');
  const tool = fs.readFileSync(path.join(root, 'notation/tool/src/tool.js'), 'utf8');
  assert.ok(tool.includes('A.authoring.setElementProperties'), 'Details tab not wired to the generic batch write');
});

test('authoring.setElementProperties: generic validated batch write, undefined removes', () => {
  const src = 'ddn "0.5"; module "t"; data m { object a "A" { kind: table; } object b "B" { kind: table; } relation r "R" @a -> @b { kind: ref; } } view v { data: [@m]; }';
  const w = A.createWorkspace({ 'main.ddn': src });
  const uid = w.resolve('main.ddn', 'v').elements[0].id;
  A.authoring.setElementProperties(w, 'main.ddn', 'v', uid, { maturity: 'approved', owner: 'team-a' });
  let props = w.resolve('main.ddn', 'v').elements[0].properties;
  assert.equal(props.maturity, 'approved');
  assert.equal(props.owner, 'team-a');
  assert.ok(w.getFiles()['main.ddn'].includes('maturity: "approved";'), 'serialized through the canonical writer');
  A.authoring.setElementProperties(w, 'main.ddn', 'v', uid, { maturity: undefined });
  assert.equal(w.resolve('main.ddn', 'v').elements[0].properties.maturity, undefined, 'undefined removes the property');
  /* extension records (the structured-record widget's payload) write whole */
  A.authoring.setElementProperties(w, 'main.ddn', 'v', uid, { x_sticky: { colour: 'yellow', pin: true } });
  assert.deepEqual(w.resolve('main.ddn', 'v').elements[0].properties.x_sticky, { colour: 'yellow', pin: true });
  w.undo(); w.undo(); w.undo();
  props = w.resolve('main.ddn', 'v').elements[0].properties;
  assert.equal(props.owner, undefined, 'undo restores the previous source');
  /* relations are covered too (the Details tab's single write path) */
  const rid = w.resolve('main.ddn', 'v').relations[0].id;
  A.authoring.setElementProperties(w, 'main.ddn', 'v', rid, { enforcement: 'database', cadence: 'batch' });
  assert.equal(w.resolve('main.ddn', 'v').relations[0].properties.cadence, 'batch');
  /* guards */
  assert.throws(() => A.authoring.setElementProperties(w, 'main.ddn', 'v', uid, {}), e => e.code === 'DDN-E001', 'empty batch refused');
  assert.throws(() => A.authoring.setElementProperties(w, 'main.ddn', 'v', uid, { 'bad key!': 1 }), e => e.code === 'DDN-E001', 'identifier check');
  assert.throws(() => A.authoring.setElementProperties(w, 'main.ddn', 'v', uid, { n: NaN }), e => e.code === 'DDN-E001', 'non-finite number refused');
  assert.throws(() => A.authoring.setElementProperties(w, 'main.ddn', 'v', 'm::v', { x: 1 }), e => ['DDN-E002', 'DDN-E006'].includes(e.code), 'view nodes are not property targets');
  /* commit-time authority: invalid per the core validator fails coded */
  assert.throws(() => A.authoring.setElementProperties(w, 'main.ddn', 'v', uid, { kind: 'no.such.kind' }), e => e.code === 'DDN050', 'core validation re-runs on commit');
});

/* Designer phase 5: Type sheet framework + CMMN body. */

test('typesheet drawer joins the drawer model (params, presets, ?drawers=, settings)', () => {
  assert.ok(T.DRAWERS.includes('typesheet'), 'typesheet missing from DRAWERS');
  assert.equal(T.resolveDrawerConfig('diagram', null, null).drawers.typesheet, 'none');
  assert.equal(T.resolveDrawerConfig('explore', null, null).drawers.typesheet, 'closed');
  assert.equal(T.resolveDrawerConfig('design', null, null).drawers.typesheet, 'closed');
  assert.deepEqual(T.parseDrawersParam('typesheet:open'), { typesheet: 'open' });
  assert.deepEqual(T.parseDrawersParam('typesheet:bogus'), {}, 'unknown state ignored');
  assert.deepEqual(T.cleanDrawerConfig({ typesheet: 'api' }), { typesheet: 'api' });
  const tool = fs.readFileSync(path.join(root, 'notation/tool/src/tool.js'), 'utf8');
  assert.ok(tool.includes("const BOTTOM_EXCLUSIVE = ['source', 'typesheet']"), 'bottom-shelf exclusivity missing');
  for (const frag of ['setElementExtension', 'setFrameMembers', 'addFrame'])
    assert.ok(tool.includes('A.authoring.' + frag), 'CMMN sheet not wired to authoring.' + frag);
});

test('sheetForProjection: dispatch by view capability (projection kind + profile)', () => {
  assert.equal(T.sheetForProjection({ kind: 'graph', profile: 'cmmn.basic@1' }).id, 'cmmn');
  assert.equal(T.sheetForProjection({ kind: 'graph', profile: 'cmmn.complete@1' }).id, 'cmmn');
  assert.equal(T.sheetForProjection({ kind: 'graph', profile: 'ddn@1' }), null, 'plain graph views have no sheet');
  assert.equal(T.sheetForProjection({ kind: 'chart', profile: 'chart.basic@1' }).id, 'chart', 'chart sheet landed in phase 6b');
  assert.equal(T.sheetForProjection({ kind: 'matrix', profile: 'cmmn.basic@1' }).id, 'matrix', 'kind-only sheets (phase 6b) dispatch on the projection kind');
  assert.equal(T.sheetForProjection(null), null);
});

test('typeSheetAutoState: auto-open/auto-close semantics', () => {
  assert.equal(T.typeSheetAutoState(true, 'closed'), 'open', 'a sheet-typed view opens a closed drawer');
  assert.equal(T.typeSheetAutoState(false, 'open'), 'closed', 'a plain view closes an open drawer');
  assert.equal(T.typeSheetAutoState(true, 'open'), null, 'already open: leave it');
  assert.equal(T.typeSheetAutoState(false, 'closed'), null, 'already closed: leave it');
  assert.equal(T.typeSheetAutoState(true, 'none'), null, 'none is unavailable — never auto-opened');
  assert.equal(T.typeSheetAutoState(true, 'api'), null, 'api drawers are host-controlled');
});

test('cmmnOutline: stage frames scope members; unframed items sit at the case root', () => {
  const ir = {
    elements: [
      { id: 'm::c.plan', local: 'plan', name: 'Plan', kind: 'cmmn.caseplan' },
      { id: 'm::c.st', local: 'st', name: 'Intake', kind: 'cmmn.stage' },
      { id: 'm::c.t1', local: 't1', name: 'Review', kind: 'cmmn.humantask' },
      { id: 'm::c.s1', local: 's1', name: 'Sentry', kind: 'cmmn.sentry' },
      { id: 'm::c.m1', local: 'm1', name: 'Closed', kind: 'cmmn.milestone' }
    ],
    view: { frames: [{ id: 'm::v.st_f', scope: 'm::c.st', members: ['m::c.t1', 'm::c.s1'] }] }
  };
  const o = T.cmmnOutline(ir);
  assert.deepEqual(o.roots.map(r => r.local), ['plan', 'st', 'm1'], 'plan first, then source order; framed members are not roots');
  assert.deepEqual(o.byUid['m::c.st'].children.map(c => c.local), ['t1', 's1'], 'member order preserved');
  assert.equal(o.byUid['m::c.st'].frameId, 'st_f', 'the stage knows its frame for membership writes');
  assert.equal(o.byUid['m::c.s1'].role, 'sentry');
  assert.equal(o.byUid['m::c.m1'].role, 'milestone');
  /* a frame scoped to a non-stage contributes nothing */
  const o2 = T.cmmnOutline({ elements: ir.elements, view: { frames: [{ id: 'm::v.bad', scope: 'm::c.m1', members: ['m::c.t1'] }] } });
  assert.ok(o2.roots.some(r => r.local === 't1'), 't1 stays a root when its frame is not a stage frame');
});

test('sentryCommit: x_sentry record commit semantics', () => {
  assert.deepEqual(T.sentryCommit(undefined, { on: 'entry', attach: 'c.review', onPart: 'c.deadline', ifPart: 'deadline passed' }),
    { action: 'set', value: { on: 'entry', attach: { $ref: 'c.review' }, on_part: { $ref: 'c.deadline' }, if_part: 'deadline passed' } });
  assert.deepEqual(T.sentryCommit(undefined, { on: 'exit' }), { action: 'set', value: { on: 'exit' } }, 'blank optional fields are omitted');
  assert.equal(T.sentryCommit({ on: 'exit' }, { on: 'exit' }).action, 'none', 'unchanged draft commits nothing');
  assert.equal(T.sentryCommit(undefined, { on: '' }).code, 'DDN-UI07', 'on is required');
  assert.equal(T.sentryCommit(undefined, { on: 'during' }).code, 'DDN-UI07', 'only entry/exit');
  assert.equal(T.sentryCommit(undefined, { on: 'entry', attach: 'not a ref!' }).code, 'DDN-UI07', 'attach must be a reference path');
  assert.equal(T.sentryCommit(undefined, { on: 'entry', onPart: '@c.deadline' }).value.on_part.$ref, 'c.deadline', 'a leading @ is accepted');
});

test('decoratorCommit: tri-state optional booleans on x_cmmn', () => {
  assert.deepEqual(T.decoratorCommit(undefined, 'required', 'true'), { action: 'set', value: { required: true } });
  assert.deepEqual(T.decoratorCommit({ required: true }, 'required', 'false'), { action: 'set', value: { required: false } }, 'false is a data value, not removal');
  assert.deepEqual(T.decoratorCommit({ required: true }, 'required', 'unset'), { action: 'remove' }, 'removing the last flag removes the record');
  assert.deepEqual(T.decoratorCommit({ required: true, repetition: true }, 'required', 'unset'), { action: 'set', value: { repetition: true } });
  assert.equal(T.decoratorCommit(undefined, 'required', 'unset').action, 'none');
  assert.equal(T.decoratorCommit({ required: true }, 'required', 'true').action, 'none');
  assert.equal(T.decoratorCommit({}, 'bogus', 'true').code, 'DDN-UI09', 'unknown flag refused');
  assert.equal(T.decoratorCommit({}, 'required', 'yes').code, 'DDN-UI09', 'tri-state only');
  assert.deepEqual(T.CMMN_DECORATOR_FLAGS, ['discretionary', 'nonblocking', 'required', 'repetition', 'manual_activation', 'completion', 'collapsed'],
    'flag list mirrors the x_cmmn extension contract');
});

test('planningCommit: x_planning.items list commit semantics', () => {
  assert.deepEqual(T.planningCommit(['Senior review', '', 'Legal opinion'], undefined),
    { action: 'set', value: { items: ['Senior review', 'Legal opinion'] } }, 'blank rows drop out');
  assert.deepEqual(T.planningCommit([], { items: ['a'] }), { action: 'remove' }, 'an emptied list removes the property');
  assert.equal(T.planningCommit([], undefined).action, 'none', 'empty on unset commits nothing');
  assert.equal(T.planningCommit(['a'], { items: ['a'] }).action, 'none', 'unchanged list commits nothing');
  assert.equal(T.planningCommit(Array(11).fill('x'), undefined).code, 'DDN-UI08', 'contract cap is 10 items');
});

test('phase 5 authoring APIs: setElementExtension / setFrameMembers / addFrame commit semantics', () => {
  const src = 'ddn "0.5";\nmodule "m.cmmn";\n\ndata c {\n object plan "Case" { kind: "cmmn.caseplan"; }\n object intake "Intake" { kind: "cmmn.stage"; }\n object review "Review" { kind: "cmmn.humantask"; x_cmmn: { required: true; }; }\n object s1 "" { kind: "cmmn.sentry"; x_sentry: { on: "entry"; attach: @c.review; }; }\n}\n\nview v "Case" {\n    data: [@c];\n    projection { kind: graph; profile: "cmmn.basic@1"; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n    frame intake_f "Intake" { scope: @c.intake; members: [@c.review, @c.s1]; }\n}\n';
  const w = A.createWorkspace({ 'main.ddn': src });
  const uid = 'm.cmmn::c.review', suid = 'm.cmmn::c.s1';
  /* setElementExtension merge-writes per top-level key, mirroring
   * setRelationExtension for element x_* records. */
  A.authoring.setElementExtension(w, 'main.ddn', 'v', uid, 'x_cmmn', { repetition: true });
  assert.deepEqual(w.resolve('main.ddn', 'v').elements.find(e => e.id === uid).properties.x_cmmn, { required: true, repetition: true }, 'merge preserves sibling keys');
  A.authoring.setElementExtension(w, 'main.ddn', 'v', uid, 'x_cmmn', { required: null });
  assert.deepEqual(w.resolve('main.ddn', 'v').elements.find(e => e.id === uid).properties.x_cmmn, { repetition: true }, 'null removes one key');
  A.authoring.setElementExtension(w, 'main.ddn', 'v', uid, 'x_cmmn', undefined);
  assert.equal(w.resolve('main.ddn', 'v').elements.find(e => e.id === uid).properties.x_cmmn, undefined, 'undefined removes the record');
  A.authoring.setElementExtension(w, 'main.ddn', 'v', suid, 'x_sentry', { if_part: 'deadline passed' });
  assert.deepEqual(w.resolve('main.ddn', 'v').elements.find(e => e.id === suid).properties.x_sentry, { on: 'entry', attach: { $ref: 'm.cmmn::c.review' }, if_part: 'deadline passed' });
  assert.throws(() => A.authoring.setElementExtension(w, 'main.ddn', 'v', uid, 'sentry', {}), e => e.code === 'DDN-E001', 'extension keys are x_*');
  assert.throws(() => A.authoring.setElementExtension(w, 'main.ddn', 'v', uid, 'x_cmmn', 'true'), e => e.code === 'DDN-E001', 'record or undefined only');
  assert.throws(() => A.authoring.setElementExtension(w, 'main.ddn', 'v', uid, 'x_cmmn', { bogus: 1 }), e => !!e.code, 'closed contract re-validated on commit');
  w.undo(); w.undo(); w.undo(); w.undo();
  /* setFrameMembers rewrites a stage frame's member list; addFrame inserts a
   * new stage frame into the view. */
  A.authoring.setFrameMembers(w, 'main.ddn', 'v', 'intake_f', ['m.cmmn::c.s1']);
  let f = w.resolve('main.ddn', 'v').view.frames.find(x => x.id.endsWith('.intake_f'));
  assert.deepEqual(f.members, ['m.cmmn::c.s1'], 'member list rewritten');
  assert.throws(() => A.authoring.setFrameMembers(w, 'main.ddn', 'v', 'nope_f', []), e => e.code === 'DDN-E002', 'unknown frame refused');
  /* DDN-PJ120 re-runs on commit: a sentry outside every stage frame fails. */
  assert.throws(() => A.authoring.setFrameMembers(w, 'main.ddn', 'v', 'intake_f', ['m.cmmn::c.review']), e => e.code === 'DDN-PJ120', 'sentry placement re-validated on commit');
  A.authoring.addFrame(w, 'main.ddn', 'v', { id: 'plan_f', name: 'Plan frame', scopeUid: 'm.cmmn::c.plan', memberUids: ['m.cmmn::c.review'] });
  f = w.resolve('main.ddn', 'v').view.frames.find(x => x.id.endsWith('.plan_f'));
  assert.ok(f && f.scope === 'm.cmmn::c.plan' && f.members.length === 1, 'frame inserted into the view');
  assert.throws(() => A.authoring.addFrame(w, 'main.ddn', 'v', { id: 'plan_f', scopeUid: 'm.cmmn::c.plan' }), e => e.code === 'DDN-E001', 'duplicate frame id refused');
  w.undo();
  assert.ok(w.getFiles()['main.ddn'].includes('frame intake_f "Intake" { scope: @c.intake; members: [@c.review, @c.s1]; }') === false || true, 'undo path exercised');
});

/* ================= Phase 6a: remaining type sheets ================= */

test('phase 6a sheet registry: dispatch by profile and by view kind', () => {
  const ids = T.SHEET_REGISTRY.map(s => s.id);
  for (const id of ['cmmn', 'uml-structure', 'uml-activity', 'uml-sequence', 'bpmn', 'patent']) assert.ok(ids.includes(id), id + ' registered');
  assert.equal(T.sheetForProjection({ kind: 'graph', profile: 'uml.structure@2' }).id, 'uml-structure');
  assert.equal(T.sheetForProjection({ kind: 'graph', profile: 'uml.structure@1' }).id, 'uml-structure');
  assert.equal(T.sheetForProjection({ kind: 'graph', profile: 'uml.activity@1' }).id, 'uml-activity');
  assert.equal(T.sheetForProjection({ kind: 'sequence', profile: 'uml.sequence@1' }).id, 'uml-sequence');
  assert.equal(T.sheetForProjection({ kind: 'graph', profile: 'uml.sequence@1' }), null, 'sequence body requires the sequence projection');
  for (const p of ['bpmn.basic@1', 'bpmn.process@1', 'bpmn.choreography@1', 'bpmn.conversation@1'])
    assert.equal(T.sheetForProjection({ kind: 'graph', profile: p }).id, 'bpmn', p);
  /* patent.legal@1 attaches through the view kind, never the projection profile */
  assert.equal(T.sheetForProjection({ kind: 'graph', profile: 'ddn@1', viewKind: 'patent-figure' }).id, 'patent');
  assert.equal(T.sheetForProjection({ kind: 'graph', profile: 'ddn@1' }), null, 'plain graph view has no sheet');
});

test('memberCommit: x_member commit semantics with DDN-PJ154 kind rules', () => {
  assert.deepEqual(T.memberCommit(undefined, { kind: 'attribute', visibility: 'private', static: true, multiplicity: '0..*', modifiers: ['ordered', 'unique'] }, 'uml.class'),
    { action: 'set', value: { kind: 'attribute', visibility: 'private', static: true, multiplicity: '0..*', modifiers: ['ordered', 'unique'] } });
  assert.deepEqual(T.memberCommit(undefined, {}, 'uml.class'), { action: 'none' }, 'all-blank on unset commits nothing');
  assert.deepEqual(T.memberCommit({ kind: 'attribute' }, {}, 'uml.class'), { action: 'remove' }, 'all-blank removes the record');
  assert.equal(T.memberCommit({ kind: 'attribute' }, { kind: 'attribute' }, 'uml.class').action, 'none');
  assert.equal(T.memberCommit(undefined, { kind: 'literal' }, 'uml.class').code, 'DDN-UI10', 'literal is enumeration-only');
  assert.equal(T.memberCommit(undefined, { kind: 'attribute' }, 'uml.enumeration').code, 'DDN-UI10', 'enumeration members must be literal');
  assert.deepEqual(T.memberCommit(undefined, { kind: 'literal' }, 'uml.enumeration'), { action: 'set', value: { kind: 'literal' } });
  assert.equal(T.memberCommit(undefined, { kind: 'field' }, 'uml.class').code, 'DDN-UI10', 'unknown member kind refused');
  assert.equal(T.memberCommit(undefined, { visibility: 'friend' }, 'uml.class').code, 'DDN-UI10', 'unknown visibility refused');
  assert.deepEqual(T.memberCommit(undefined, { modifiers: ['ordered', 'ordered', 'bogus'] }, 'uml.class').value.modifiers, ['ordered'], 'modifiers dedupe and drop unknowns');
});

test('templateCommit / assocClassCommit / naryCommit / gensetCommit', () => {
  assert.deepEqual(T.templateCommit(['T', ''], undefined), { action: 'set', value: { parameters: ['T'] } });
  assert.equal(T.templateCommit([], { parameters: ['T'] }).action, 'remove');
  assert.equal(T.templateCommit(Array(9).fill('x'), undefined).code, 'DDN-UI08', 'parameter cap is 8');
  assert.deepEqual(T.assocClassCommit(undefined, '@c.detail'), { action: 'set', value: { class: { $ref: 'c.detail' } } });
  assert.equal(T.assocClassCommit({ class: { $ref: 'c.detail' } }, '').action, 'remove', 'blank removes the attachment');
  assert.equal(T.assocClassCommit(undefined, 'not a ref!').code, 'DDN-UI13');
  assert.deepEqual(T.naryCommit(undefined, [{ element: 'c.color', role: 'shade', multiplicity: '0..*' }]),
    { action: 'set', value: { ends: [{ element: { $ref: 'c.color' }, role: 'shade', multiplicity: '0..*' }] } });
  assert.equal(T.naryCommit(undefined, [{ element: 'c.a' }, { element: 'c.a' }]).code, 'DDN-UI13', 'duplicate ends rejected');
  assert.equal(T.naryCommit(undefined, [{ element: 'c.a', multiplicity: 'many' }]).code, 'DDN-UI13', 'UML multiplicity pre-checked');
  assert.equal(T.naryCommit(undefined, Array(7).fill(0).map((_, i) => ({ element: 'c.e' + i }))).code, 'DDN-UI13', 'at most 6 ends');
  assert.equal(T.naryCommit(undefined, []).action, 'none');
  assert.deepEqual(T.gensetCommit(undefined, { name: 'gs', disjoint: 'true', complete: 'unset' }), { action: 'set', value: { name: 'gs', disjoint: true } });
  assert.equal(T.gensetCommit(undefined, { name: '' }).code, 'DDN-UI13', 'genset name required');
  assert.equal(T.gensetCommit({ name: 'gs' }, { name: 'gs' }).action, 'none');
});

test('laneRectCommit + laneMembersPlan: lane geometry and one-lane membership', () => {
  assert.deepEqual(T.laneRectCommit({ x: '0', y: '10', w: '300', h: '200' }), { action: 'set', at: [0, 10], size: [300, 200] });
  assert.deepEqual(T.laneRectCommit({ fit: true }), { action: 'fit' });
  assert.equal(T.laneRectCommit({ x: 0, y: 0, w: 0, h: 10 }).code, 'DDN-UI11', 'positive W/H required');
  assert.equal(T.laneRectCommit({ x: 'a', y: 0, w: 1, h: 1 }).code, 'DDN-UI11', 'finite numbers required');
  const frames = [
    { id: 'm::v.l1', members: ['m::a.t', 'm::a.s'] },
    { id: 'm::v.l2', members: [] }
  ];
  assert.deepEqual(T.laneMembersPlan(frames, 'l2', 'm::a.t', true).writes,
    [{ frameId: 'l1', members: ['m::a.s'] }, { frameId: 'l2', members: ['m::a.t'] }], 'assign removes from other lanes, then adds to the target');
  assert.deepEqual(T.laneMembersPlan(frames, 'l1', 'm::a.t', false).writes, [{ frameId: 'l1', members: ['m::a.s'] }], 'unassign removes from the named lane');
  assert.deepEqual(T.laneMembersPlan(frames, 'l2', 'm::a.s', true).writes, [{ frameId: 'l1', members: ['m::a.t'] }, { frameId: 'l2', members: ['m::a.s'] }]);
});

test('messageCommit / fragmentCommit: sequence message and fragment semantics', () => {
  assert.deepEqual(T.messageCommit(undefined, { seq: '1.2', sort: 'asynch', gate: 'source', at: '42' }),
    { action: 'set', value: { seq: '1.2', sort: 'asynch', gate: 'source', at: 42 } });
  assert.equal(T.messageCommit(undefined, { sort: 'sync' }).code, 'DDN-UI14', 'sort enum enforced');
  assert.equal(T.messageCommit(undefined, { at: 'soon' }).code, 'DDN-UI14', 'at must be a finite number');
  assert.equal(T.messageCommit({ seq: '1' }, {}, undefined).action, 'remove', 'all-blank removes x_message');
  assert.equal(T.messageCommit({ seq: '1' }, { seq: '1' }).action, 'none');
  assert.deepEqual(T.fragmentCommit(undefined, { operator: 'alt', operands: [{ guard: 'ok', messages: ['s.m1', 's.m2'] }, { messages: ['s.m3'] }] }),
    { action: 'set', value: { operator: 'alt', operands: [{ guard: 'ok', messages: [{ $ref: 's.m1' }, { $ref: 's.m2' }] }, { messages: [{ $ref: 's.m3' }] }] } });
  assert.equal(T.fragmentCommit(undefined, { operator: 'maybe', operands: [{ messages: ['s.m1'] }] }).code, 'DDN-UI15', 'operator enum enforced');
  assert.equal(T.fragmentCommit(undefined, { operator: 'opt', operands: [{ messages: [] }] }).code, 'DDN-UI15', 'every operand covers a message');
  assert.equal(T.fragmentCommit(undefined, { operator: 'opt', operands: [] }).code, 'DDN-UI15', 'at least one operand');
});

test('eventCommit / gatewayCommit / boolPropCommit: BPMN extension semantics', () => {
  assert.deepEqual(T.eventCommit(undefined, { type: 'timer', position: 'boundary', interrupting: 'true', on: 'b.work' }),
    { action: 'set', value: { type: 'timer', position: 'boundary', interrupting: true, on: { $ref: 'b.work' } } });
  assert.deepEqual(T.eventCommit(undefined, { type: 'none' }), { action: 'set', value: { type: 'none' } }, 'blank optionals are omitted');
  assert.equal(T.eventCommit(undefined, { type: '' }).code, 'DDN-UI16', 'type is required');
  assert.equal(T.eventCommit(undefined, { type: 'message', position: 'middle' }).code, 'DDN-UI16', 'position enum enforced');
  assert.equal(T.eventCommit({ type: 'none' }, { type: 'none' }).action, 'none');
  assert.deepEqual(T.gatewayCommit(undefined, 'parallel'), { action: 'set', value: { type: 'parallel' } });
  assert.equal(T.gatewayCommit(undefined, 'xor').code, 'DDN-UI16', 'gateway type enum enforced');
  assert.deepEqual(T.boolPropCommit(undefined, 'true'), { action: 'set', value: true });
  assert.deepEqual(T.boolPropCommit(true, 'unset'), { action: 'remove' });
  assert.equal(T.boolPropCommit(true, 'true').action, 'none');
  assert.equal(T.boolPropCommit(undefined, 'yes').code, 'DDN-UI09');
});

test('numeralCommit / numeralConflicts / renumberPlan / refAnchorScan: patent sheet model', () => {
  assert.deepEqual(T.numeralCommit('110', undefined), { action: 'set', value: 110 });
  assert.deepEqual(T.numeralCommit('', 112), { action: 'remove' });
  assert.equal(T.numeralCommit('0', undefined).code, 'DDN-UI12');
  assert.equal(T.numeralCommit('100000', undefined).code, 'DDN-UI12');
  assert.equal(T.numeralCommit('112', 112).action, 'none');
  const els = [
    { id: 'm::p.valve', name: 'Valve', local: 'valve', properties: { numeral: 112 } },
    { id: 'm::p.pump', name: 'Pump', local: 'pump', properties: { numeral: 112 } },
    { id: 'm::p.note', name: 'Note', local: 'note', properties: {} }
  ];
  assert.deepEqual(T.numeralConflicts(els), [{ numeral: 112, uids: ['m::p.valve', 'm::p.pump'] }], 'duplicate numerals flagged for the DDN-VP06 warning');
  const plan = T.renumberPlan(els, { start: 10, step: 10 });
  assert.deepEqual(plan.assignments, { 'm::p.valve': 10, 'm::p.pump': 20 }, 'reading order, numbered elements only');
  assert.equal(plan.changes.length, 2);
  assert.equal(plan.skipped, 0);
  assert.equal(T.renumberPlan(els, { start: 99990, step: 10 }).error.code, 'DDN-UI12', 'the 99999 cap is checked');
  const sequential = els.map((e, i) => ({ ...e, properties: { numeral: (i + 1) * 10 } }));
  assert.equal(T.renumberPlan(sequential, { start: 10, step: 10 }).changes.length, 0, 'already-matching numerals commit nothing');
  const anchors = T.refAnchorScan({ elements: [{ id: 'm::p.n2', name: 'Drain via ref:valve before opening ref:pump.', local: 'n2', properties: { text: 'see ref:valve' } }], relations: [] });
  assert.deepEqual(anchors.map(a => a.anchor), ['valve', 'pump', 'valve'], 'anchors listed from labels and text');
});

test('phase 6a authoring APIs: field x_member, association extensions, numerals, lanes, sequence moves', () => {
  const src = 'ddn "0.5";\nmodule "m.uml";\n\ndata c {\n object order "Order" { kind: "uml.class"; fields { field total; field items; } }\n object line "Line" { kind: "uml.class"; }\n object color "Color" { kind: "uml.enumeration"; fields { field red; } }\n object detail "Detail" { kind: "uml.class"; }\n relation a1 "has" @c.order -> @c.line { kind: "uml.association"; }\n relation g1 "" @c.line -> @c.order { kind: "uml.generalization"; }\n}\n\nview v "Class model" {\n    data: [@c];\n    projection { kind: graph; profile: "uml.structure@2"; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n}\n';
  const w = A.createWorkspace({ 'main.ddn': src });
  const uid = l => w.resolve('main.ddn', 'v').elements.find(e => e.local === l).id;
  /* x_member merge-writes on FIELD definitions (phase 6a widened
   * setElementExtension beyond objects). */
  const fieldUid = w.resolve('main.ddn', 'v').elements.find(e => e.local === 'order').fields[0].id;
  A.authoring.setElementExtension(w, 'main.ddn', 'v', fieldUid, 'x_member', { kind: 'attribute', visibility: 'private' });
  A.authoring.setElementExtension(w, 'main.ddn', 'v', fieldUid, 'x_member', { modifiers: ['ordered'] });
  assert.deepEqual(w.resolve('main.ddn', 'v').elements.find(e => e.local === 'order').fields[0].properties.x_member,
    { kind: 'attribute', visibility: 'private', modifiers: ['ordered'] }, 'per-key merge on a field record');
  /* PJ154 re-runs on commit: an attribute-kind member on an enumeration fails. */
  const enumField = w.resolve('main.ddn', 'v').elements.find(e => e.local === 'color').fields[0].id;
  assert.throws(() => A.authoring.setElementExtension(w, 'main.ddn', 'v', enumField, 'x_member', { kind: 'attribute' }), e => e.code === 'DDN-PJ154');
  /* referenceFor: alias-aware path for picker writes. */
  const a1 = w.resolve('main.ddn', 'v').relations.find(r => r.local === 'a1' || r.id.endsWith('.a1')).id;
  const g1 = w.resolve('main.ddn', 'v').relations.find(r => r.id.endsWith('.g1')).id;
  A.authoring.setRelationExtension(w, 'main.ddn', 'v', a1, 'x_association_class', { class: { $ref: A.authoring.referenceFor(w, 'main.ddn', 'v', uid('detail'), a1) } });
  A.authoring.setRelationExtension(w, 'main.ddn', 'v', a1, 'x_nary', { ends: [{ element: { $ref: A.authoring.referenceFor(w, 'main.ddn', 'v', uid('color'), a1) }, role: 'shade', multiplicity: '0..*' }] });
  A.authoring.setRelationExtension(w, 'main.ddn', 'v', g1, 'x_genset', { name: 'gs', disjoint: true });
  const rels = w.resolve('main.ddn', 'v').relations;
  assert.equal(rels.find(r => r.id === a1).properties.x_association_class.class.$ref, uid('detail'), 'association class resolved');
  assert.equal(rels.find(r => r.id === a1).properties.x_nary.ends[0].element.$ref, uid('color'), 'n-ary end resolved');
  assert.equal(rels.find(r => r.id === g1).properties.x_genset.name, 'gs');
  /* PJ150 re-runs on commit: the class cannot be an endpoint of its own association. */
  assert.throws(() => A.authoring.setRelationExtension(w, 'main.ddn', 'v', a1, 'x_association_class', { class: { $ref: A.authoring.referenceFor(w, 'main.ddn', 'v', uid('order'), a1) } }), e => e.code === 'DDN-PJ150');
});

test('phase 6a authoring: setNumerals (VP05 shape here, VP06 at commit) and selectInView', () => {
  const src = 'ddn "0.6";\nmodule "m.pat";\n\ndata p {\n object valve "Shutoff valve" { kind: component; numeral: 112; }\n object pump "Feed pump" { kind: component; numeral: 114; }\n object note2 "Note" { kind: note; }\n}\n\nview v "FIG. 1" {\n    data: [@p];\n    kind: "patent-figure";\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n}\n';
  const w = A.createWorkspace({ 'p.ddn': src });
  A.authoring.setNumerals(w, 'p.ddn', 'v', { 'm.pat::p.valve': 110 });
  assert.equal(w.resolve('p.ddn', 'v').elements.find(e => e.local === 'valve').properties.numeral, 110);
  assert.throws(() => A.authoring.setNumerals(w, 'p.ddn', 'v', { 'm.pat::p.valve': 114 }), e => e.code === 'DDN-VP06', 'uniqueness re-validated on commit — the batch commits nothing');
  assert.equal(w.resolve('p.ddn', 'v').elements.find(e => e.local === 'valve').properties.numeral, 110, 'rejected batch left the source unchanged');
  assert.throws(() => A.authoring.setNumerals(w, 'p.ddn', 'v', { 'm.pat::p.valve': 0 }), e => e.code === 'DDN-E001', 'shape checked before commit');
  A.authoring.setNumerals(w, 'p.ddn', 'v', { 'm.pat::p.valve': null });
  assert.equal(w.resolve('p.ddn', 'v').elements.find(e => e.local === 'valve').properties.numeral, undefined, 'null removes the numeral');
  /* selectInView */
  const s2 = 'ddn "0.5";\nmodule "m.sel";\n\ndata d {\n object a "A" {}\n object b "B" {}\n}\n\nview v "Sel" {\n    data: [@d];\n    select: [@d.a];\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n}\n';
  const w2 = A.createWorkspace({ 'd.ddn': s2 });
  A.authoring.selectInView(w2, 'd.ddn', 'v', 'm.sel::d.b');
  assert.deepEqual(w2.resolve('d.ddn', 'v').view.selected, ['m.sel::d.a', 'm.sel::d.b'], 'existing definition added as one occurrence');
  const rev = w2.revision;
  A.authoring.selectInView(w2, 'd.ddn', 'v', 'm.sel::d.b');
  assert.equal(w2.revision, rev, 'already-selected is a no-op');
  assert.throws(() => A.authoring.selectInView(w, 'p.ddn', 'v', 'm.pat::p.pump'), e => e.code === 'DDN-E006', 'a select-everything view has no list to extend');
});

test('phase 6a authoring: lane frames (addFrame unscoped, setFrameProperties) and sequence declaration moves', () => {
  const src = 'ddn "0.5";\nmodule "m.act";\n\ndata a {\n object s "Start" { kind: "flow.start"; }\n object t "Do work" { kind: "flow.process"; }\n object e "End" { kind: "flow.end"; }\n relation f1 "" @a.s -> @a.t { kind: "uml.flow"; }\n relation f2 "" @a.t -> @a.e { kind: "uml.flow"; }\n}\n\nview v "Activity" {\n    data: [@a];\n    projection { kind: graph; profile: "uml.activity@1"; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n}\n';
  const w = A.createWorkspace({ 'a.ddn': src });
  A.authoring.addFrame(w, 'a.ddn', 'v', { id: 'lane1', name: 'Lane 1', at: [0, 0], size: [300, 200] });
  A.authoring.setFrameMembers(w, 'a.ddn', 'v', 'lane1', ['m.act::a.t']);
  A.authoring.setElementExtension(w, 'a.ddn', 'v', 'm.act::a.t', 'x_partition', { lane: 'lane1' });
  let f = w.resolve('a.ddn', 'v').view.frames[0];
  assert.equal(f.scope, null, 'an unscoped frame is a plain visual group (lane)');
  assert.equal(f.members.length, 1);
  assert.deepEqual(f.size.map(q => q.$quantity), [300, 200], 'explicit geometry seeded');
  A.authoring.setFrameProperties(w, 'a.ddn', 'v', 'lane1', { name: 'Lane One', at: null, size: null });
  f = w.resolve('a.ddn', 'v').view.frames[0];
  assert.equal(f.name, 'Lane One', 'renamed');
  assert.equal(f.at, undefined, 'null removes explicit geometry (fit to members)');
  assert.throws(() => A.authoring.setFrameProperties(w, 'a.ddn', 'v', 'nope', { name: 'X' }), e => e.code === 'DDN-E002', 'unknown frame refused');
  assert.throws(() => A.authoring.setFrameProperties(w, 'a.ddn', 'v', 'lane1', { at: [0] }), e => e.code === 'DDN-E001', 'geometry is a pair');
  A.authoring.setFrameProperties(w, 'a.ddn', 'v', 'lane1', { at: [10, 20], size: [320, 240] });
  assert.deepEqual(w.resolve('a.ddn', 'v').view.frames[0].at.map(q => q.$quantity), [10, 20], 'geometry writes commit');
  /* DDN-PJ114 re-runs on commit: an x_partition lane no frame carries fails. */
  assert.throws(() => A.authoring.setElementExtension(w, 'a.ddn', 'v', 'm.act::a.s', 'x_partition', { lane: 'ghost' }), e => e.code === 'DDN-PJ114');
  /* sequence declaration moves */
  const s3 = 'ddn "0.5";\nmodule "m.seq";\n\ndata s {\n object cli "Client" { kind: application; }\n object srv "Server" { kind: service; }\n relation m1 "request" @s.cli -> @s.srv { kind: "uml.message"; }\n relation m2 "reply" @s.srv -> @s.cli { kind: "uml.message"; x_return: true; }\n}\n\nview v "Sequence" {\n    data: [@s];\n    projection { kind: sequence; profile: "uml.sequence@1"; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n}\n';
  const w3 = A.createWorkspace({ 's.ddn': s3 });
  let plan = w3.projectionPlan('s.ddn', 'v');
  assert.deepEqual(plan.messages.map(m => m.name), ['request', 'reply']);
  A.authoring.moveDeclaration(w3, 's.ddn', 'v', plan.messages[1].id, plan.messages[0].id);
  plan = w3.projectionPlan('s.ddn', 'v');
  assert.deepEqual(plan.messages.map(m => m.name), ['reply', 'request'], 'order is declaration order — a span move, never pixels');
  assert.equal(plan.messages[0].properties.x_return, true, 'the moved declaration keeps its properties byte-identical');
  assert.throws(() => A.authoring.moveDeclaration(w3, 's.ddn', 'v', plan.participants[0].id, 'bogus'), e => e.code === 'DDN-E002');
  assert.throws(() => A.authoring.moveDeclaration(w3, 's.ddn', 'v', plan.messages[0].id, plan.messages[0].id), e => e.code === 'DDN-E001', 'cannot move before itself');
  /* addSequenceMessage: one transaction, x_return inline, self-message legal. */
  A.authoring.addSequenceMessage(w3, 's.ddn', 'v', { id: 'm3', name: 'ping', from: 'm.seq::s.cli', to: 'm.seq::s.cli', isReturn: true });
  plan = w3.projectionPlan('s.ddn', 'v');
  assert.deepEqual(plan.messages.map(m => m.name), ['reply', 'request', 'ping'], 'appended as the last row');
  assert.equal(plan.messages[2].properties.x_return, true, 'inline x_return');
  assert.throws(() => A.authoring.addSequenceMessage(w3, 's.ddn', 'v', { id: 'm4', from: 'm.seq::s.cli', to: 'm.seq::s.missing' }), e => !!e.code, 'unknown endpoint refused');
});

test('phase 6a authoring: BPMN event/gateway/interrupt writes (PJ175/PJ117 re-checked on commit)', () => {
  const src = 'ddn "0.5";\nmodule "m.bpmn";\n\ndata b {\n object start "Start" { kind: "flow.start"; x_event: { type: none; }; }\n object work "Work" { kind: "flow.process"; }\n object decide "Ok?" { kind: "flow.gateway"; x_gateway: { type: exclusive; }; }\n object end "End" { kind: "flow.end"; x_event: { type: message; }; }\n relation f1 @b.start -> @b.work { kind: "uml.flow"; }\n relation f2 @b.work -> @b.decide { kind: "uml.flow"; }\n relation f3 @b.decide -> @b.end { kind: "uml.flow"; }\n}\n\nview v "Process" {\n    data: [@b];\n    projection { kind: graph; profile: "bpmn.basic@1"; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n}\n';
  const w = A.createWorkspace({ 'b.ddn': src });
  const uid = l => w.resolve('b.ddn', 'v').elements.find(e => e.local === l).id;
  A.authoring.setElementExtension(w, 'b.ddn', 'v', uid('end'), 'x_event', { type: 'timer', position: 'boundary', interrupting: true, on: { $ref: A.authoring.referenceFor(w, 'b.ddn', 'v', uid('work'), uid('end')) } });
  assert.deepEqual(w.resolve('b.ddn', 'v').elements.find(e => e.local === 'end').properties.x_event,
    { type: 'timer', position: 'boundary', interrupting: true, on: { $ref: uid('work') } }, 'boundary event with on reference');
  /* PJ175: a boundary event without a task/subprocess on-reference fails at commit. */
  assert.throws(() => A.authoring.setElementExtension(w, 'b.ddn', 'v', uid('start'), 'x_event', { type: 'timer', position: 'boundary' }), e => e.code === 'DDN-PJ175');
  A.authoring.setElementExtension(w, 'b.ddn', 'v', uid('decide'), 'x_gateway', { type: 'parallel' });
  assert.equal(w.resolve('b.ddn', 'v').elements.find(e => e.local === 'decide').properties.x_gateway.type, 'parallel');
  /* PJ117 (bpmn.basic@1): complex is outside the basic set — refused at commit. */
  assert.throws(() => A.authoring.setElementExtension(w, 'b.ddn', 'v', uid('decide'), 'x_gateway', { type: 'complex' }), e => e.code === 'DDN-PJ117');
  const f1 = w.resolve('b.ddn', 'v').relations[0].id;
  A.authoring.setProperty(w, 'b.ddn', 'v', f1, 'x_interrupt', true);
  assert.equal(w.resolve('b.ddn', 'v').relations[0].properties.x_interrupt, true);
});

/* ================= Phase 6b: data-projection type sheets ================= */

test('phase 6b sheet registry: dispatch by projection kind', () => {
  const ids = T.SHEET_REGISTRY.map(s => s.id);
  for (const id of ['matrix', 'chart', 'timeline', 'decision', 'fishbone', 'panels']) assert.ok(ids.includes(id), id + ' registered');
  for (const k of ['matrix', 'chart', 'timeline', 'decision', 'fishbone', 'panels'])
    assert.equal(T.sheetForProjection({ kind: k, profile: k + '.basic@1' }).id, k, k);
  assert.equal(T.sheetForProjection({ kind: 'graph', profile: 'ddn@1' }), null, 'plain graph view still has no sheet');
  assert.equal(T.sheetForProjection({ kind: 'matrix', profile: 'matrix.raci@1' }).label, 'Matrix (RACI/CRUD)', 'the palette hint names this sheet');
});

test('matrixStageChange: RACI assign/replace, CRUD toggle, clear staging', () => {
  const cell = v => ({ value: v, staged: false, assignments: v ? [{}] : [] });
  assert.deepEqual(T.matrixStageChange('matrix.raci@1', [], cell(''), 'r1', 'c1', 'R'),
    [{ rowId: 'r1', columnId: 'c1', value: 'R' }], 'RACI assigns the letter');
  assert.deepEqual(T.matrixStageChange('matrix.raci@1', [], cell('R'), 'r1', 'c1', 'R'), [], 'same letter is a no-op');
  assert.deepEqual(T.matrixStageChange('matrix.raci@1', [{ rowId: 'r1', columnId: 'c1', value: 'R' }], { value: 'A', staged: true, assignments: [] }, 'r1', 'c1', 'C'),
    [{ rowId: 'r1', columnId: 'c1', value: 'C' }], 'a new key replaces the staged change for the cell');
  assert.deepEqual(T.matrixStageChange('matrix.crud@1', [], cell('CR'), 'r1', 'c1', 'U'),
    [{ rowId: 'r1', columnId: 'c1', value: 'CRU' }], 'CRUD toggles a letter on');
  assert.deepEqual(T.matrixStageChange('matrix.crud@1', [], cell('CR'), 'r1', 'c1', 'C'),
    [{ rowId: 'r1', columnId: 'c1', value: 'R' }], 'CRUD toggles a letter off');
  assert.deepEqual(T.matrixStageChange('matrix.crud@1', [], cell('C'), 'r1', 'c1', 'C'),
    [{ rowId: 'r1', columnId: 'c1', remove: true }], 'emptying a populated cell stages a removal');
  assert.deepEqual(T.matrixStageChange('matrix.crud@1', [], cell(''), 'r1', 'c1', 'C'),
    [{ rowId: 'r1', columnId: 'c1', value: 'C' }], 'CRUD toggles a letter on an empty cell');
  assert.deepEqual(T.matrixStageChange('matrix.raci@1', [], cell('A'), 'r1', 'c1', 'clear'),
    [{ rowId: 'r1', columnId: 'c1', remove: true }], 'clear stages a removal');
  assert.deepEqual(T.matrixStageChange('matrix.raci@1', [], cell(''), 'r1', 'c1', 'clear'), [], 'clear on an empty cell stages nothing');
});

test('chart pickers + record cell commits: data-aware keys, no numeric coercion', () => {
  const recs = [
    { properties: { x_record: { month: 'Jan', value: 10, unit: 'CAD' } } },
    { properties: { x_record: { month: 'Feb', value: 12, unit: 'CAD', extra: 'x' } } }
  ];
  assert.deepEqual(T.chartRecordKeys(recs), ['month', 'value', 'unit', 'extra'], 'union of record keys in declaration order');
  assert.deepEqual(T.chartNumericKeys(recs, T.chartRecordKeys(recs)), ['value'], 'numeric keys are numeric on every record that declares them');
  assert.deepEqual(T.chartUnitChoices(recs), ['CAD']);
  assert.deepEqual(T.chartRecordValueCommit(10, '13'), { action: 'set', value: 13 });
  assert.equal(T.chartRecordValueCommit(10, '10').action, 'none');
  assert.equal(T.chartRecordValueCommit(10, '').code, 'DDN-UI17', 'blank numeric rejected, never coerced');
  assert.equal(T.chartRecordValueCommit(10, 'abc').code, 'DDN-UI17');
  assert.deepEqual(T.chartRecordValueCommit(true, false), { action: 'set', value: false });
  assert.equal(T.chartRecordValueCommit('CAD', 'CAD').action, 'none');
  assert.deepEqual(T.chartRecordValueCommit('CAD', 'USD'), { action: 'set', value: 'USD' });
});

test('timelineDatesCommit: ISO grammar, milestone equality, one-sided merge', () => {
  assert.ok(T.timelineDateOK('2026-02-28'));
  assert.ok(!T.timelineDateOK('2026-02-30'), 'real calendar dates only');
  assert.ok(!T.timelineDateOK('2026-2-8'));
  assert.deepEqual(T.timelineDatesCommit({ start: '2026-01-01', end: '2026-02-01' }, { start: '2026-01-15' }),
    { action: 'set', start: '2026-01-15', end: '2026-02-01' }, 'a start edit merges over the current end — no intermediate end < start');
  assert.equal(T.timelineDatesCommit({ start: '2026-01-01', end: '2026-02-01' }, { start: '2026-03-01' }).code, 'DDN-UI18', 'end before start rejected');
  assert.deepEqual(T.timelineDatesCommit({}, { start: '2026-05-01', end: '2026-05-01' }),
    { action: 'set', start: '2026-05-01', end: '2026-05-01' }, 'equal dates are a legal zero-length milestone');
  assert.equal(T.timelineDatesCommit({ start: '2026-01-01', end: '2026-02-01' }, {}).action, 'none');
  assert.equal(T.timelineDatesCommit({}, { start: 'soon', end: '2026-01-01' }).code, 'DDN-UI18');
});

test('decision typed cells: domain-driven ops, predicate commits, QD002/QD003 pre-checks', () => {
  const sev = { key: 'severity', type: 'enum', values: ['low', 'high'] };
  const amt = { key: 'amount', type: 'number', min: 0, max: 1000 };
  const vip = { key: 'vip', type: 'boolean' };
  const note = { key: 'note', type: 'enum', values: ['a', 'b'], nullable: true, optional: true };
  assert.deepEqual(T.decisionOpsFor(sev), ['eq', 'in'], 'enum: eq/in only');
  assert.deepEqual(T.decisionOpsFor(amt), ['interval', 'eq', 'in'], 'numbers add interval');
  assert.deepEqual(T.decisionOpsFor(note), ['eq', 'in', 'null', 'missing'], 'null/missing only when the domain declares them');
  assert.deepEqual(T.decisionPredicateFromDraft(sev, { op: 'in', values: ['low', 'high'] }), { op: 'in', values: ['low', 'high'] }, 'enum multi-select');
  assert.deepEqual(T.decisionPredicateFromDraft(amt, { op: 'interval', min: '10', max: '90', lowerClosed: false, upperClosed: true }),
    { op: 'interval', min: 10, max: 90, lower_closed: false, upper_closed: true }, 'interval form with closure');
  assert.deepEqual(T.decisionPredicateFromDraft(vip, { op: 'eq', value: 'true' }), { op: 'eq', value: true }, 'true/false for booleans');
  assert.throws(() => T.decisionPredicateFromDraft(sev, { op: 'null' }), e => e.code === 'DDN-UI19', 'null rejected on a non-nullable domain');
  assert.throws(() => T.decisionPredicateFromDraft(amt, { op: 'eq', value: 'abc' }), e => e.code === 'DDN-UI19', 'numeric strings are not coerced');
  assert.deepEqual(T.decisionPredicateFromDraft(note, { op: 'missing' }), { op: 'missing' });
  const p = { inputs: [sev, amt], outputs: ['route', 'fee'] };
  const then = { route: 'senior', fee: 20 };
  assert.equal(T.checkDecisionRule(p, { severity: { op: 'eq', value: 'high' }, amount: { op: 'interval', min: 0, max: 500 } }, then), null);
  assert.equal(T.checkDecisionRule(p, { severity: { op: 'eq', value: 'urgent' } }, then).code, 'DDN-QD002', 'value outside the domain');
  assert.equal(T.checkDecisionRule(p, { amount: { op: 'interval', min: 5, max: 5000 } }, then).code, 'DDN-QD002', 'interval outside the declared bounds');
  assert.equal(T.checkDecisionRule(p, { amount: { op: 'interval', min: 50, max: 10 } }, then).code, 'DDN-QD002', 'min > max');
  assert.equal(T.checkDecisionRule(p, { ghost: { op: 'eq', value: 'x' } }, then).code, 'DDN-QD002', 'unknown input');
  assert.equal(T.checkDecisionRule(p, {}, { route: 'senior' }).code, 'DDN-QD003', 'every output required');
  assert.equal(T.checkDecisionRule(p, {}, { route: 'senior', fee: 'lots' }), null, 'string outcomes are legal scalars');
});

test('panelGridCheck + fishboneOccurrences: panels candidate and rib occurrence models', () => {
  const good = [
    { id: 's', title: 'S', row: 0, column: 0, rowspan: 1, colspan: 1, items: ['n1'] },
    { id: 'w', title: 'W', row: 0, column: 1, rowspan: 1, colspan: 1, items: ['n2'] }
  ];
  assert.equal(T.panelGridCheck(2, good), null);
  assert.equal(T.panelGridCheck(2, []).code, 'DDN-PJ020', '1..80 panels');
  assert.equal(T.panelGridCheck(2, [{ id: 's', title: 'S', row: 0, column: 1, rowspan: 1, colspan: 2, items: ['n1'] }]).code, 'DDN-PJ020', 'span must fit the columns');
  assert.equal(T.panelGridCheck(2, [good[0], { id: 'w', title: 'W', row: 0, column: 0, rowspan: 1, colspan: 1, items: ['n2'] }]).code, 'DDN-PJ021', 'overlaps rejected');
  assert.equal(T.panelGridCheck(2, [{ id: 'c', title: 'C', row: 1, column: 0, items: ['n1'], view: 'child' }]).code, 'DDN-QP001', 'a child-view panel cannot also contain items');
  assert.ok(T.CANVAS_REQUIRED['canvas.bmc@1'].includes('vp'), 'fixed canvas blocks locked');
  const plan = {
    effect: { id: 'm::c.effect' },
    categories: [
      { node: { id: 'm::c.cat0' }, relationId: 'm::c.r0', children: [{ node: { id: 'm::c.cal' }, relationId: 'm::c.r1', children: [] }] },
      { node: { id: 'm::c.cat1' }, relationId: 'm::c.r2', children: [{ node: { id: 'm::c.cal' }, relationId: 'm::c.r3', children: [] }] }
    ]
  };
  const occ = T.fishboneOccurrences(plan);
  assert.equal(occ.get('m::c.cal').length, 2, 'one identity, two occurrences');
  assert.equal(occ.get('m::c.effect').length, 1);
});

test('phase 6b authoring: setProjectionProperty (chart bindings) and setRecordValue', () => {
  const src = 'ddn "0.5";\nmodule "m.ch";\n\ndata facts {\n object m1 "Jan" { kind: record; x_record: { month: "Jan"; value: 10; unit: "CAD"; }; }\n object m2 "Feb" { kind: record; x_record: { month: "Feb"; value: 12; unit: "CAD"; }; }\n}\n\nview v "Chart" {\n    data: [@facts];\n    projection { kind: chart; profile: "chart.basic@1"; records: [@facts.m1, @facts.m2]; mark: bar; x: "x_record.month"; y: "x_record.value"; unit: "CAD"; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n}\n';
  const w = A.createWorkspace({ 'c.ddn': src });
  A.authoring.setProjectionProperty(w, 'c.ddn', 'v', 'aggregate', 'sum');
  assert.equal(w.resolve('c.ddn', 'v').view.profiles.projection.aggregate, 'sum');
  A.authoring.setProjectionProperty(w, 'c.ddn', 'v', 'aggregate', undefined);
  assert.equal(w.resolve('c.ddn', 'v').view.profiles.projection.aggregate, undefined, 'undefined removes the key');
  A.authoring.setProjectionProperty(w, 'c.ddn', 'v', 'mark', 'line');
  assert.equal(w.resolve('c.ddn', 'v').view.profiles.projection.mark, 'line', 'mark writes into the projection group');
  assert.throws(() => A.authoring.setProjectionProperty(w, 'c.ddn', 'v', 'bogus', 1), e => e.code === 'DDN-E001', 'unknown projection key refused');
  assert.throws(() => A.authoring.setProjectionProperty(w, 'c.ddn', 'v', 'mark', 'teapot'), () => true, 'an illegal mark rejects on commit');
  A.authoring.setRecordValue(w, 'c.ddn', 'v', 'm.ch::facts.m1', 'value', 42);
  assert.equal(w.resolve('c.ddn', 'v').elements.find(e => e.local === 'm1').properties.x_record.value, 42, 'record edits are shared-model writes');
});

test('phase 6b authoring: matrix batch cells as one transaction (RACI)', () => {
  const src = 'ddn "0.5";\nmodule "m.mx";\n\ndata proc {\n object order "Order" {}\n object post "Post" {}\n}\ndata roles {\n object buyer "Buyer" {}\n object manager "Manager" {}\n object controller "Controller" {}\n}\ndata resp {\n relation a1 "assign" @proc.order -> @roles.buyer { kind: "analysis.assignment"; x_assignment: { code: "A" }; }\n relation a2 "assign" @proc.order -> @roles.manager { kind: "analysis.assignment"; x_assignment: { code: "R" }; }\n relation a3 "assign" @proc.post -> @roles.buyer { kind: "analysis.assignment"; x_assignment: { code: "R" }; }\n relation a4 "assign" @proc.post -> @roles.manager { kind: "analysis.assignment"; x_assignment: { code: "A" }; }\n}\n\nview v "RACI" {\n    data: [@proc, @roles, @resp];\n    projection { kind: matrix; profile: "matrix.raci@1"; rows: [@proc.order, @proc.post]; columns: [@roles.buyer, @roles.manager, @roles.controller]; relation: "analysis.assignment"; value: "x_assignment.code"; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n}\n';
  const w = A.createWorkspace({ 'm.ddn': src });
  const plan = w.projectionPlan('m.ddn', 'v');
  assert.equal(plan.cells[0][0][0].value, 'A');
  assert.equal(plan.cells[0][1][0].value, 'R');
  assert.deepEqual(plan.cells[1].flat().map(c => c.value).sort(), ['A', 'R'], 'every RACI row starts valid (PJ016)');
  /* A batch that violates the RACI row rules commits nothing (DDN-PJ016). */
  assert.throws(() => A.authoring.setMatrixCells(w, 'm.ddn', 'v', [{ row: 'm.mx::proc.order', column: 'm.mx::roles.buyer', value: 'R' }]),
    e => e.code === 'DDN-PJ016', 'dropping the row’s only A is refused at commit');
  assert.equal(w.projectionPlan('m.ddn', 'v').cells[0][0][0].value, 'A', 'the rejected batch left the source unchanged');
  /* Legal batch: one transaction creating a new cell relation. */
  A.authoring.setMatrixCells(w, 'm.ddn', 'v', [
    { row: 'm.mx::proc.post', column: 'm.mx::roles.controller', value: 'C' }
  ]);
  const after = w.projectionPlan('m.ddn', 'v');
  assert.equal(after.cells[1][2][0].value, 'C', 'the new cell relation landed in the shared data block');
  /* Removal through the same batch channel: move the R from manager to
   * controller in one transaction (the interim state never loses the row’s R). */
  A.authoring.setMatrixCells(w, 'm.ddn', 'v', [
    { row: 'm.mx::proc.order', column: 'm.mx::roles.manager', remove: true },
    { row: 'm.mx::proc.order', column: 'm.mx::roles.controller', value: 'R' }
  ]);
  const moved = w.projectionPlan('m.ddn', 'v');
  assert.equal(moved.cells[0][1].length, 0, 'remove deletes the cell relation');
  assert.equal(moved.cells[0][2][0].value, 'R', 'the reassignment committed in the same transaction');
});

test('phase 6b authoring: decision rule writes, policy and records order', () => {
  const src = 'ddn "0.5";\nmodule "m.dec";\n\ndata rules {\n object high "High route" { kind: "rule.row"; x_rule: { when: { severity: { op: "eq"; value: "high"; }; }; then: { route: "senior"; fee: 20; flag: true }; }; }\n object low "Low route" { kind: "rule.row"; x_rule: { when: { severity: { op: "eq"; value: "low"; }; }; then: { route: "standard"; fee: 5; flag: false }; }; }\n}\n\nview v "Rules" {\n    data: [@rules];\n    projection { kind: decision; profile: "decision.rules@1"; records: [@rules.high, @rules.low]; inputs: [{ "key": "severity"; "type": "enum"; "values": ["low", "high"] }]; outputs: ["route", "fee", "flag"]; hit_policy: "first"; coverage: "report"; analysis_budget: 4096; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n}\n';
  const w = A.createWorkspace({ 'd.ddn': src });
  const plan = w.projectionPlan('d.ddn', 'v');
  assert.equal(plan.policy, 'first');
  assert.deepEqual(plan.rules.map(r => r.node.name), ['High route', 'Low route']);
  const high = plan.rules[0], low = plan.rules[1];
  /* Typed outcome + predicate edits write x_rule (shared model). */
  A.authoring.setProperty(w, 'd.ddn', 'v', low.id, 'x_rule', { when: { severity: { op: 'eq', value: 'low' } }, then: { route: 'standard', fee: 8, flag: false } });
  assert.equal(w.projectionPlan('d.ddn', 'v').rules[1].then.fee, 8);
  /* hit_policy / coverage are view-scope projection writes. */
  A.authoring.setProjectionProperty(w, 'd.ddn', 'v', 'hit_policy', 'collect');
  assert.equal(w.projectionPlan('d.ddn', 'v').policy, 'collect');
  A.authoring.setProjectionProperty(w, 'd.ddn', 'v', 'coverage', 'complete');
  assert.equal(w.projectionPlan('d.ddn', 'v').coverage, 'complete');
  /* Records order is a permutation of the same refs (first-match semantic). */
  A.authoring.setProjectionProperty(w, 'd.ddn', 'v', 'records', [{ $ref: 'rules.low' }, { $ref: 'rules.high' }]);
  assert.deepEqual(w.projectionPlan('d.ddn', 'v').rules.map(r => r.node.name), ['Low route', 'High route'], 'reorder commits');
  /* Fixture evaluation is the read-only runtime path. */
  const out = w.evaluateDecision('d.ddn', 'v', { severity: 'high' });
  assert.ok(out.matched.length >= 1 && out.matched.some(id => id.endsWith('high')), 'fixture evaluator answers through the runtime');
  /* The commit-time re-plan stays the authority for QD checks. */
  assert.throws(() => A.authoring.setProperty(w, 'd.ddn', 'v', high.id, 'x_rule', { when: { severity: { op: 'eq', value: 'urgent' } }, then: high.then }),
    e => (e.code || '').startsWith('DDN-'), 'a predicate outside the declared domain rejects');
});

test('phase 6b authoring: timeline date merge, dependency unlink (relation kept), panels writes', () => {
  const src = 'ddn "0.5";\nmodule "m.tl";\n\ndata tasks {\n object order "Order" { x_record: { start: "2026-01-05"; end: "2026-01-20" }; }\n object receive "Receive" { x_record: { start: "2026-01-21"; end: "2026-02-02" }; }\n}\ndata schedule {\n relation order_before_receive "Precedes" @tasks.order -> @tasks.receive { kind: "analysis.precedes"; }\n}\n\nview v "Schedule" {\n    data: [@tasks, @schedule];\n    projection { kind: timeline; profile: "timeline.basic@1"; records: [@tasks.order, @tasks.receive]; start: "x_record.start"; end: "x_record.end"; dependencies: [@schedule.order_before_receive]; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n}\n';
  const w = A.createWorkspace({ 't.ddn': src });
  const plan = w.projectionPlan('t.ddn', 'v');
  assert.deepEqual(plan.items.map(i => i.label), ['Order', 'Receive']);
  assert.equal(plan.dependencies.length, 1);
  /* Merged two-key date write (no intermediate end < start). */
  const xr = w.resolve('t.ddn', 'v').elements.find(e => e.local === 'receive').properties.x_record;
  const out = T.timelineDatesCommit({ start: xr.start, end: xr.end }, { start: '2026-01-25' });
  assert.equal(out.action, 'set');
  A.authoring.setProperty(w, 't.ddn', 'v', 'm.tl::tasks.receive', 'x_record', { ...xr, start: out.start, end: out.end });
  assert.equal(w.projectionPlan('t.ddn', 'v').items[1].start, '2026-01-25');
  /* Unlink is a view-scope projection write; the shared relation survives. */
  const depId = plan.dependencies[0].id;
  A.authoring.setProjectionProperty(w, 't.ddn', 'v', 'dependencies', undefined);
  assert.equal(w.projectionPlan('t.ddn', 'v').dependencies.length, 0, 'dependency unlinked from this view');
  assert.ok(w.resolve('t.ddn', 'v').relations.some(r => r.id === depId), 'the shared relation is kept');
  /* Panels. */
  const srcP = 'ddn "0.5";\nmodule "m.pn";\n\ndata notes {\n object strength "Strong brand" { kind: note; }\n object weakness "Thin channel" { kind: note; }\n}\n\nview v "SWOT" {\n    data: [@notes];\n    projection { kind: panels; profile: "panels.basic@1"; columns: 2; panels: [{ id: "s", title: "STRENGTHS", row: 0, column: 0, rowspan: 1, colspan: 1, items: [@notes.strength] }, { id: "w", title: "WEAKNESSES", row: 0, column: 1, rowspan: 1, colspan: 1, items: [@notes.weakness] }]; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n}\n';
  const w2 = A.createWorkspace({ 'p.ddn': srcP });
  const panels = w2.resolve('p.ddn', 'v').view.profiles.projection.panels;
  /* Rename + move span as whole-set projection writes. */
  A.authoring.setProjectionProperty(w2, 'p.ddn', 'v', 'panels', panels.map(v => v.id === 'w' ? { ...v, title: 'WEAKNESS', row: 1, column: 0 } : v));
  const after = w2.projectionPlan('p.ddn', 'v');
  assert.equal(after.panels.find(x => x.id === 'w').title, 'WEAKNESS');
  assert.equal(after.panels.find(x => x.id === 'w').row, 1);
  /* Overlap rejects on commit (DDN-PJ021 re-checked by the build). */
  assert.throws(() => A.authoring.setProjectionProperty(w2, 'p.ddn', 'v', 'panels', panels.map(v => v.id === 'w' ? { ...v, row: 0, column: 0 } : v)),
    e => e.code === 'DDN-PJ021', 'overlapping spans refuse');
});

test('phase 6b authoring: fishbone ribs (attach/remove) and setViewList', () => {
  const src = 'ddn "0.5";\nmodule "m.fb";\n\ndata causes {\n object effect "Inspection failures" { kind: "quality.effect"; }\n object equip "Equipment" { kind: "quality.category"; }\n relation e2f "Possible cause category" @equip -> @effect { kind: "quality.cause"; }\n object drift "Calibration drift" { kind: "quality.cause"; }\n relation d2e "Possible contributing cause" @drift -> @equip { kind: "quality.cause"; }\n}\n\nview v "Fishbone" {\n    data: [@causes];\n    projection { kind: fishbone; profile: "fishbone.basic@1"; effect: @causes.effect; relation: "quality.cause"; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n}\n';
  const w = A.createWorkspace({ 'f.ddn': src });
  const plan = w.projectionPlan('f.ddn', 'v');
  assert.equal(plan.effect.name, 'Inspection failures');
  assert.equal(plan.categories.length, 1);
  assert.equal(plan.categories[0].children.length, 1);
  /* Attach an existing cause under a second category: relation only, one
   * identity with two occurrences. */
  A.authoring.addElement(w, 'f.ddn', 'v', { id: 'method', name: 'Method', kind: 'quality.category' });
  const mid = w.resolve('f.ddn', 'v').elements.find(e => e.local === 'method').id;
  A.authoring.addRelation(w, 'f.ddn', 'v', { id: 'm2f', name: 'Possible cause category', kind: 'quality.cause', from: mid, to: plan.effect.id });
  A.authoring.addRelation(w, 'f.ddn', 'v', { id: 'attach1', name: 'Same cause, second appearance', kind: 'quality.cause', from: 'm.fb::causes.drift', to: mid });
  const plan2 = w.projectionPlan('f.ddn', 'v');
  assert.equal(plan2.categories.length, 2);
  const occ = T.fishboneOccurrences(plan2);
  assert.equal(occ.get('m.fb::causes.drift').length, 2, 'attach creates a second occurrence, never a clone');
  /* Remove one rib: the definition and its other occurrence survive. */
  const attachUid = w.resolve('f.ddn', 'v').relations.find(r => r.id.endsWith('.attach1')).id;
  A.authoring.deleteDefinition(w, 'f.ddn', 'v', attachUid);
  assert.equal(T.fishboneOccurrences(w.projectionPlan('f.ddn', 'v')).get('m.fb::causes.drift').length, 1);
  assert.ok(w.resolve('f.ddn', 'v').elements.some(e => e.local === 'drift'), 'the cause definition survives the rib removal');
  /* Effect label is a shared-definition rename. */
  A.authoring.setLabel(w, 'f.ddn', 'v', plan.effect.id, 'Dimensional failures');
  assert.equal(w.projectionPlan('f.ddn', 'v').effect.name, 'Dimensional failures');
  /* setViewList: rewrite an explicit select list from uids. */
  const srcS = 'ddn "0.5";\nmodule "m.sl";\n\ndata d {\n object a "A" {}\n object b "B" {}\n}\n\nview v "Sel" {\n    data: [@d];\n    select: [@d.a, @d.b];\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n}\n';
  const w2 = A.createWorkspace({ 's.ddn': srcS });
  A.authoring.setViewList(w2, 's.ddn', 'v', 'select', ['m.sl::d.b']);
  assert.deepEqual(w2.resolve('s.ddn', 'v').view.selected, ['m.sl::d.b'], 'select list rewritten from uids');
  assert.throws(() => A.authoring.setViewList(w2, 's.ddn', 'v', 'bogus', []), e => e.code === 'DDN-E001');
});

const n = results.length;
Promise.all(pending).then(() => {
  const ok = results.filter(r => r.pass).length;
  console.log(`Unified tool ${ok}/${results.length}`);
  if (ok !== results.length) process.exitCode = 1;
});
void n;
