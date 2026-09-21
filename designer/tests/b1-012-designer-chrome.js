// SPDX-License-Identifier: GPL-2.0-or-later.
// B1-012 behavior suite: designer chrome — compact density + toggle, draggable
// splitters, detach/re-attach floating panels, plate-glyph palette icons,
// descriptive tooltips, and SVG/PNG/WebP export.
// Harness style imitates notation/tests/projections.js. No dependencies.
//
// Acceptance-plan note: no VE-AC case covers designer chrome (same situation as
// ED-013's template starters). The gap is recorded here and in the report;
// nothing is flipped in designer/tests/acceptance-plan.json.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

const ROOT = path.join(__dirname, '..', '..');
const PROTO = path.join(ROOT, 'designer', 'prototype');
const CMD = require(path.join(PROTO, 'commands.js'));
const body = fs.readFileSync(path.join(PROTO, 'body.html'), 'utf8');
const app = fs.readFileSync(path.join(PROTO, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(PROTO, 'style.css'), 'utf8');

// 1. Pure units: splitter clamp math, drag direction, detached grid columns.
test('splitter math: clamps, drag direction, detached columns, defaults', () => {
  const S = CMD.splitters;
  assert.deepStrictEqual(S.SPLITTER_LIMITS, { left: [160, 420], inspector: [220, 520] });
  assert.deepStrictEqual(S.SPLITTER_DEFAULTS, { left: 230, inspector: 306 });
  assert.strictEqual(S.clampWidth('left', 100), 160);
  assert.strictEqual(S.clampWidth('left', 9999), 420);
  assert.strictEqual(S.clampWidth('inspector', 100), 220);
  assert.strictEqual(S.clampWidth('inspector', 9999), 520);
  assert.strictEqual(S.splitterDrag('left', 230, 300, 400), 330, 'left grows rightward');
  assert.strictEqual(S.splitterDrag('inspector', 306, 1200, 1100), 406, 'inspector grows leftward');
  assert.strictEqual(S.splitterDrag('left', 230, 300, 9000), 420, 'drag clamps at the limit');
  assert.strictEqual(S.gridColumns(230, 306), '230px 6px minmax(360px,1fr) 6px 306px');
  assert.strictEqual(S.gridColumns(0, 306), '0px 0px minmax(360px,1fr) 6px 306px', 'detached left collapses its column and splitter');
  assert.strictEqual(S.gridColumns(230, 0), '230px 6px minmax(360px,1fr) 0px 0px', 'detached inspector collapses its column and splitter');
  assert.throws(() => S.clampWidth('middle', 100), e => e.code === 'DDN-I033');
});

// 2. Pure units: density var map and export format table.
test('density map: compact default, comfortable restores the old chrome sizes', () => {
  assert.strictEqual(CMD.DENSITY_DEFAULT, 'compact');
  const c = CMD.DENSITY.compact, f = CMD.DENSITY.comfortable;
  assert.strictEqual(c['--ui-font'], '12px');
  assert.strictEqual(c['--ui-btn-h'], '28px');
  assert.strictEqual(c['--ui-pad'], '8px');
  assert.strictEqual(c['--ui-gap'], '6px');
  assert.strictEqual(f['--ui-font'], '14px', 'comfortable ≈ the old base font');
  assert.strictEqual(f['--ui-btn-h'], '34px', 'comfortable ≈ the old button height');
  assert.deepStrictEqual(Object.keys(c).sort(), Object.keys(f).sort(), 'both densities set the same variables');
});
test('export format table: DDN/ZIP unguarded, SVG/PNG/WebP render-guarded, fixed filenames', () => {
  const byId = Object.fromEntries(CMD.EXPORT_FORMATS.map(f => [f.id, f]));
  assert.strictEqual(byId.svg.file, 'designer-prototype.svg');
  assert.strictEqual(byId.png.file, 'designer-prototype.png');
  assert.strictEqual(byId.webp.file, 'designer-prototype.webp');
  assert.strictEqual(byId.png.mime, 'image/png');
  assert.strictEqual(byId.webp.mime, 'image/webp');
  assert.strictEqual(byId.png.scale, 2);
  assert.strictEqual(byId.webp.scale, 2);
  assert.ok(byId.svg.guarded && byId.png.guarded && byId.webp.guarded, 'renderFailure guard blocks every diagram format');
  assert.ok(!byId.ddn.guarded && !byId.zip.guarded, 'source downloads stay available for drafts');
});

// 3. Generated-chrome greps: every static button in body.html carries a
//    non-empty title (D4); every app.js-emitted button tag carries title too.
test('D4 grep: every <button> in body.html and app.js carries a title', () => {
  for (const m of body.matchAll(/<button\b[^>]*>/g))
    assert.ok(/title="[^"]+"/.test(m[0]), 'body.html button without title: ' + m[0]);
  for (const m of app.matchAll(/<button\b/g)) {
    const window = app.slice(m.index, m.index + 900);
    const end = window.indexOf('</button>');
    const tag = end > -1 ? window.slice(0, end) : window;
    assert.ok(tag.includes('title='), 'app.js button without title near: ' + tag.slice(0, 90));
  }
});

// 4. Density vars + export modal + glyph mechanism greps.
test('greps: density vars, comfortable override, export formats, WebP detect, glyphs', () => {
  for (const v of ['--ui-font', '--ui-pad', '--ui-btn-h', '--ui-gap']) assert.ok(css.includes(v), 'missing ' + v);
  assert.ok(css.includes('body[data-density=comfortable]'), 'comfortable override block');
  assert.ok(css.includes('--ui-font:12px') && css.includes('--ui-btn-h:28px'), 'compact defaults in :root');
  for (const label of ['Current SVG', 'Current PNG (2×)', 'Current WebP (2×)']) assert.ok(app.includes("'" + label + "'"), 'export modal missing ' + label);
  assert.ok(app.includes("toDataURL('image/webp').startsWith('data:image/webp')"), 'WebP feature-detect idiom present');
  assert.ok(app.includes('D.glyphs.forKind'), 'palette uses the runtime glyph accessor');
  assert.ok(app.includes('renderFailure'), 'renderFailure guard kept');
});

// 5. build-standalone byte-identity re-asserted (ED-001 gate shape).
test('build-standalone.mjs regenerates byte-identical output twice', () => {
  const d1 = fs.mkdtempSync(path.join(os.tmpdir(), 'b1012-a-')), d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'b1012-b-'));
  for (const d of [d1, d2]) cp.execFileSync('node', [path.join(PROTO, 'build-standalone.mjs'), '--out', d], { stdio: 'pipe' });
  for (const f of ['index.html', 'standalone.html']) {
    assert.strictEqual(fs.readFileSync(path.join(d1, f), 'utf8'), fs.readFileSync(path.join(d2, f), 'utf8'), f + ' not deterministic');
    assert.strictEqual(fs.readFileSync(path.join(d1, f), 'utf8'), fs.readFileSync(path.join(PROTO, f), 'utf8'), f + ' differs from committed regeneration');
  }
});

// 6. Headless chromium driver run: the driver page is generated from the REAL
//    committed standalone.html plus the committed driver scenario, so the
//    exercised chrome can never drift from the shipped one.
test('headless driver: density, splitters, detach/float/reattach, tooltips, raster, matrix interop', () => {
  const shellDir = path.join(os.homedir(), '.cache', 'ms-playwright');
  const shell = fs.readdirSync(shellDir).filter(d => d.startsWith('chromium_headless_shell-')).sort().pop();
  assert.ok(shell, 'no chromium headless shell under ' + shellDir);
  const bin = path.join(shellDir, shell, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
  assert.ok(fs.existsSync(bin), 'missing ' + bin);
  const standalone = fs.readFileSync(path.join(PROTO, 'standalone.html'), 'utf8');
  const driver = fs.readFileSync(path.join(__dirname, 'b1-012-designer-chrome.driver.js'), 'utf8');
  assert.ok(!driver.includes('</script>'), 'driver must not close its script tag');
  const page = standalone.replace('</body>', () => '<script>' + driver + '\n</script></body>');
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'b1012-page-')), 'driver.html');
  fs.writeFileSync(tmp, page);
  const dom = cp.execFileSync(bin, ['--headless', '--disable-gpu', '--no-sandbox', '--window-size=1500,1000', '--virtual-time-budget=25000', '--dump-dom', 'file://' + tmp], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 }).toString();
  const m = dom.match(/<pre id="b1012Result">(\{[\s\S]*?)<\/pre>/);
  assert.ok(m, 'driver result block missing — page or scenario failed to run');
  const r = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  assert.strictEqual(r.ok, true, 'driver scenario threw: ' + (r.error || 'unknown'));
  const EXPECTED = ['api', 'densityDefaultCompact', 'densityToggleComfortable', 'densitySizesDiffer', 'densityToggleBack',
    'everyButtonTitled', 'paletteTooltip', 'exportTooltip', 'detachTooltip',
    'paletteGlyph', 'glyphAbsentNull',
    'splitterDragLeft', 'splitterPersisted', 'splitterClamp', 'splitterReset', 'splitterDragInspector',
    'detachFloats', 'detachCollapsesColumn', 'canvasGrew', 'floatDraggable', 'reattachTitle', 'inspectorLiveWhileFloating',
    'reattachRestores', 'leftFloats', 'leftReattaches', 'floatNotPersisted',
    'matrixEditCommits', 'matrixCellShows',
    'sheetTogglePresent', 'sheetCollapses', 'sheetExpands',
    'exportModalFormats', 'webpEnabledWhenSupported', 'pngPrefix', 'webpPrefix', 'noMislabeledWebp'];
  for (const key of EXPECTED) assert.strictEqual(r[key], true, 'driver check failed: ' + key + ' = ' + JSON.stringify(r[key]));
});

console.log(`B1-012 designer chrome ${pass}/${pass + fail}`);
if (fail) process.exitCode = 1;
