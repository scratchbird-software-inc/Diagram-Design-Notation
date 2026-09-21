// SPDX-License-Identifier: GPL-2.0-or-later.
// B1-014 behavior suite: designer Display tab (global + per-kind typography,
// kind/verb/object colours, relation options — presentation only), Text
// download formats (current file / single-file sectioned .ddn via api.io.bundle
// / ZIP), resizable floating panels, and window pop-out panels.
// Harness style imitates notation/tests/projections.js. No dependencies.
//
// Acceptance-plan note: no VE-AC case covers designer chrome or display options
// (same situation as B1-012). The gap is recorded here and in the report;
// nothing is flipped in designer/tests/acceptance-plan.json.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

const ROOT = path.join(__dirname, '..', '..');
const PROTO = path.join(ROOT, 'designer', 'prototype');
const CMD = require(path.join(PROTO, 'commands.js'));
const D = require(path.join(ROOT, 'notation', 'dist', 'ddn.global.js'));
const FILES = JSON.parse(fs.readFileSync(path.join(PROTO, 'workspace.json'), 'utf8'));
const body = fs.readFileSync(path.join(PROTO, 'body.html'), 'utf8');
const app = fs.readFileSync(path.join(PROTO, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(PROTO, 'style.css'), 'utf8');

// 1. Pure units: display CSS rule builders (mirror the viewer's B1-011 helpers,
//    scoped to #paper).
test('display CSS rule builders: typography, kind/verb/object colours, errors', () => {
  const d = CMD.display;
  assert.strictEqual(d.typographyRule('tbl', { family: 'serif', size: 18 }), '#paper .ddn-kind-tbl text { font-family: DejaVu Serif, Georgia, serif; font-size: 18px; }');
  assert.strictEqual(d.typographyRule('act', { family: 'mono' }), '#paper .ddn-kind-act text { font-family: DejaVu Sans Mono, monospace; }');
  assert.throws(() => d.typographyRule('tbl', {}), e => e.code === 'DDN-I033');
  assert.throws(() => d.typographyRule('tbl', { family: 'papyrus' }), e => e.code === 'DDN-I033');
  assert.throws(() => d.typographyRule('tbl', { size: 30 }), e => e.code === 'DDN-I033');
  assert.strictEqual(d.colourRule({ type: 'kind', code: 'TBL' }, '#AbC'), '#paper .ddn-kind-tbl > path, #paper .ddn-kind-tbl > rect, #paper .ddn-kind-tbl > circle, #paper .ddn-kind-tbl > ellipse, #paper .ddn-kind-tbl > polygon { fill: #AbC; }');
  assert.strictEqual(d.colourRule({ type: 'verb', code: 'ref' }, '#112233'), '#paper .ddn-verb-ref path { stroke: #112233; }');
  assert.ok(d.colourRule({ type: 'object', id: 'm::a.b' }, '#fff').startsWith('#paper [data-ddn-id="m::a.b"] > path'));
  assert.throws(() => d.colourRule({ type: 'kind', code: 'tbl' }, 'red'), e => e.code === 'DDN-I033');
  assert.throws(() => d.colourRule({ type: 'wat', code: 'x' }, '#fff'), e => e.code === 'DDN-I033');
  const all = d.css({ typography: { tbl: { family: 'serif' } }, kindColours: { tbl: '#123456' }, verbColours: { ref: '#654321' }, objectColours: { 'm::a': '#abcdef' } });
  assert.ok(all.split('\n').length === 4 && all.includes('tbl') && all.includes('#654321'));
  assert.strictEqual(d.css({}), '');
  assert.deepStrictEqual(d.FONT_SIZES, [8, 9, 10, 11, 12, 14, 16, 18, 20, 24]);
  assert.deepStrictEqual(Object.keys(d.FONT_STACKS).sort(), ['handwriting', 'mono', 'sans', 'serif']);
});

// 2. Pure units: Text download format table + whole-workspace sectioned bundle.
test('text-download format table: current / bundle / ZIP with fixed filenames', () => {
  const byId = Object.fromEntries(CMD.TEXT_FORMATS.map(f => [f.id, f]));
  assert.deepStrictEqual(CMD.TEXT_FORMATS.map(f => f.id), ['current', 'bundle', 'zip']);
  assert.strictEqual(byId.bundle.file, 'designer-prototype-workspace.ddn');
  assert.strictEqual(byId.zip.file, 'designer-prototype-workspace.zip');
  assert.ok(byId.bundle.tooltip.includes('self-contained') && byId.bundle.tooltip.includes('re-opens'));
});
test('bundleWorkspace: one sectioned .ddn for the whole workspace, re-openable, byte-identical renders', () => {
  const text = CMD.bundleWorkspace(D, FILES, 'model.ddn');
  assert.ok(text.startsWith('ddn "'));
  assert.deepStrictEqual([...text.matchAll(/^module "([^"]+)";$/gm)].map(m => m[1]).sort(),
    ['designer.sample', 'meridian.procurement.formats', 'meridian.procurement.review', 'meridian.procurement.views']);
  // Re-opened via the public surface: every view of every root is present.
  const ws = D.createWorkspace({ 'bundle.ddn': text });
  const expect = D.createWorkspace(FILES).entries().reduce((n, e) => n + e.views.length, 0);
  assert.strictEqual(ws.entries().reduce((n, e) => n + e.views.length, 0), expect);
  const ov = { page: 'content', look: 'classic', theme: 'default' };
  const live = D.createWorkspace(FILES);
  for (const [entry, view] of [['model.ddn', 'overview'], ['projections/views.ddn', 'raci'], ['projections/views.ddn', 'gantt'], ['projections/views.ddn', 'sequence']])
    assert.strictEqual(ws.renderSync({ entry: 'bundle.ddn', view, overrides: ov }).svg, live.renderSync({ entry, view, overrides: ov }).svg, view + ' re-renders byte-identically');
  // Determinism: two runs give identical bytes.
  assert.strictEqual(CMD.bundleWorkspace(D, FILES, 'model.ddn'), text);
  // Entry order honoured: bundling from the projections root still yields one file.
  const text2 = CMD.bundleWorkspace(D, FILES, 'projections/views.ddn');
  assert.ok(text2.includes('module "designer.sample";') && text2.includes('module "meridian.procurement.review";'));
  // cli check passes on the emitted file.
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'b1014-bundle-')), 'bundle.ddn');
  fs.writeFileSync(tmp, text);
  const report = JSON.parse(cp.execFileSync('node', [path.join(ROOT, 'notation', 'cli', 'cli.js'), 'check', tmp, '--workspace', path.dirname(tmp)], { stdio: 'pipe' }).toString());
  assert.ok(String(report.status).startsWith('pass'), 'cli check failed: ' + JSON.stringify(report));
});

// 3. Chrome greps: Display tab, pop-out buttons with tooltips, resize CSS,
//    Image/Text groups, three Text options, panelRoot refactor completeness.
test('greps: Display tab, pop-out buttons + tooltips, resize CSS, export groups, panelRoot', () => {
  assert.ok(body.includes('data-left="display"'), 'Display tab button in the shelf');
  for (const id of ['popoutLeft', 'popoutInspector']) {
    assert.ok(body.includes('id="' + id + '"'), id + ' present');
    const tag = body.match(new RegExp('<button[^>]*id="' + id + '"[^>]*>'))[0];
    assert.ok(tag.includes('re-docks when the window closes'), id + ' tooltip');
  }
  assert.ok(/aside\.floating\{[^}]*resize:both/.test(css), 'floating panels resize:both');
  assert.ok(/aside\.floating\{[^}]*min-width:220px/.test(css) && /aside\.floating\{[^}]*min-height:160px/.test(css), 'float min constraints 220×160');
  assert.ok(css.includes('aside.floating::after'), 'visible resize grip affordance');
  for (const needle of ['<h3>Text</h3>', '<h3>Image</h3>', 'CMD.TEXT_FORMATS', 'CMD.bundleWorkspace']) assert.ok(app.includes(needle), 'app.js missing ' + needle);
  for (const label of ['Current file (.ddn)', 'Single file — entire workspace (.ddn)', 'ZIP archive (all sources)'])
    assert.ok(app.includes(label) || CMD.TEXT_FORMATS.some(f => f.label === label), 'missing Text option ' + label);
  assert.ok(app.includes('function panelRoot(name)'), 'panelRoot introduced');
  const stripped = app.replace(/roots\.leftBody=\$\('#leftBody'\);[^\n]*\n[^\n]*\n/, '');
  assert.ok(!stripped.includes("$('#leftBody')"), 'leftBody id lookup left after refactor');
  assert.ok(!stripped.includes("$('#inspectorBody')"), 'inspectorBody id lookup left after refactor');
  assert.ok(!stripped.includes("$('#selectionHeader')"), 'selectionHeader id lookup left after refactor');
  assert.ok(app.includes('window.open(') && app.includes('adoptNode'), 'window pop-out mechanism');
  assert.ok(app.includes('pagehide') && app.includes('beforeunload'), 'child close re-dock hooks');
});

// 4. build-standalone byte-identity re-asserted (ED-001/B1-012 gate shape).
test('build-standalone.mjs regenerates byte-identical output twice', () => {
  const d1 = fs.mkdtempSync(path.join(os.tmpdir(), 'b1014-a-')), d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'b1014-b-'));
  for (const d of [d1, d2]) cp.execFileSync('node', [path.join(PROTO, 'build-standalone.mjs'), '--out', d], { stdio: 'pipe' });
  for (const f of ['index.html', 'standalone.html']) {
    assert.strictEqual(fs.readFileSync(path.join(d1, f), 'utf8'), fs.readFileSync(path.join(d2, f), 'utf8'), f + ' not deterministic');
    assert.strictEqual(fs.readFileSync(path.join(d1, f), 'utf8'), fs.readFileSync(path.join(PROTO, f), 'utf8'), f + ' differs from committed regeneration');
  }
});

// 5. Headless chromium driver run against the REAL committed standalone.html.
//    The downloaded single-file bundle is re-checked with the CLI in node.
test('headless driver: display tab, downloads, resized float, window pop-out with child edit', () => {
  const shellDir = path.join(os.homedir(), '.cache', 'ms-playwright');
  const shell = fs.readdirSync(shellDir).filter(d => d.startsWith('chromium_headless_shell-')).sort().pop();
  assert.ok(shell, 'no chromium headless shell under ' + shellDir);
  const bin = path.join(shellDir, shell, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
  assert.ok(fs.existsSync(bin), 'missing ' + bin);
  const standalone = fs.readFileSync(path.join(PROTO, 'standalone.html'), 'utf8');
  const driver = fs.readFileSync(path.join(__dirname, 'b1-014-display-and-popout.driver.js'), 'utf8');
  assert.ok(!driver.includes('</script>'), 'driver must not close its script tag');
  const page = standalone.replace('</body>', () => '<script>' + driver + '\n</script></body>');
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'b1014-page-')), 'driver.html');
  fs.writeFileSync(tmp, page);
  const dom = cp.execFileSync(bin, ['--headless', '--disable-gpu', '--no-sandbox', '--window-size=1500,1000', '--virtual-time-budget=30000', '--dump-dom', 'file://' + tmp], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 }).toString();
  const m = dom.match(/<pre id="b1014Result">(\{[\s\S]*?)<\/pre>/);
  assert.ok(m, 'driver result block missing — page or scenario failed to run');
  const r = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  assert.strictEqual(r.ok, true, 'driver scenario threw: ' + (r.error || 'unknown'));
  const EXPECTED = ['api',
    'displayTabButton', 'displayTabPopulated', 'perKindRowsLabelled', 'colourSwatches', 'relationControls',
    'globalFontOverride', 'sourceBytesUnchanged',
    'perKindTypographyRule', 'kindColourRule', 'verbColourRule', 'objectColourRule', 'overlayPersisted', 'sourceBytesUnchanged2',
    'relationRoutingPerVerb', 'masterReset',
    'exportGroups', 'threeTextOptions', 'currentFileDownload', 'bundleName', 'bundleSectioned', 'bundleReopens', 'bundleRendersIdentical', 'zipDownload',
    'floatResizeCSS', 'floatResized',
    'popoutOpens', 'popoutHasPanel', 'editCommitsFromChild', 'redockRestores',
    'popoutDocksFloat', 'paletteWorksFromChild', 'leftRedocks'];
  for (const key of EXPECTED) assert.strictEqual(r[key], true, 'driver check failed: ' + key + ' = ' + JSON.stringify(r[key]));
  // The bundle downloaded in the browser passes cli check and re-renders
  // byte-identically to the live view (node side, independent of the page).
  const btmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'b1014-dl-')), 'workspace.ddn');
  fs.writeFileSync(btmp, r.bundleText);
  const report = JSON.parse(cp.execFileSync('node', [path.join(ROOT, 'notation', 'cli', 'cli.js'), 'check', btmp, '--workspace', path.dirname(btmp)], { stdio: 'pipe' }).toString());
  assert.ok(String(report.status).startsWith('pass'), 'cli check failed: ' + JSON.stringify(report));
  const ws = D.createWorkspace({ 'bundle.ddn': r.bundleText });
  const ov = { page: 'content', look: 'classic', theme: 'default' };
  assert.strictEqual(ws.renderSync({ entry: 'bundle.ddn', view: 'overview', overrides: ov }).svg,
    D.createWorkspace(FILES).renderSync({ entry: 'model.ddn', view: 'overview', overrides: ov }).svg, 'downloaded bundle re-renders byte-identically');
});

console.log(`B1-014 display and pop-out ${pass}/${pass + fail}`);
if (fail) process.exitCode = 1;
