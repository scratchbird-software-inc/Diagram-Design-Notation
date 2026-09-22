/* SPDX-License-Identifier: GPL-2.0-or-later. B1-007 end-user viewer: build determinism, pure-function units, generated-markup checks. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..', '..');
const V = require('../viewer/src/viewer.js');
const A = require('../dist/ddn.global.js');
const results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { results.push({ name, pass: false }); console.error('FAIL', name, e.stack); process.exitCode = 1; } }

const fixture = `ddn "0.5";
module "demo";
data demo {
    object alpha "Alpha table" { kind: table; }
    object beta "Beta table" { kind: table; }
    relation ab "writes" @demo.alpha -> @demo.beta { kind: ref; }
}
format f {
    style s { look: classic; theme: default; font: sans; }
    layout g { algorithm: grid; columns: 2; gap: 120px; routing: orthogonal; }
    legend c { mode: tokens; placement: right; }
    publication p { size: content; fit: none; }
    bundle b { style:@s; layout:@g; legend:@c; publication:@p; }
}
view overview "Overview" {
    data: [@demo]; format: @f.b;
}
view compact "Compact" {
    data: [@demo]; format: @f.b;
    display { fields:none; }
}
`;

test('build:viewer is deterministic — three runs give byte-identical output matching the committed file', () => {
  const committed = fs.readFileSync(path.join(root, 'notation/viewer/ddn-viewer.html'), 'utf8');
  let prev = null;
  for (let i = 0; i < 3; i++) {
    cp.execFileSync('node', [path.join(root, 'tools/build-viewer.js')], { stdio: 'pipe' });
    const bytes = fs.readFileSync(path.join(root, 'notation/viewer/ddn-viewer.html'), 'utf8');
    if (prev !== null) assert.strictEqual(bytes, prev, 'run ' + i + ' differs');
    prev = bytes;
  }
  assert.strictEqual(prev, committed, 'committed ddn-viewer.html differs from a fresh build — run npm --prefix notation run build:viewer');
});

test('generated viewer contains the inlined runtime and every control', () => {
  const html = fs.readFileSync(path.join(root, 'notation/viewer/ddn-viewer.html'), 'utf8');
  assert.ok(html.includes('makeLiveAPI'), 'inlined runtime missing');
  assert.ok(!html.includes('<script src='), 'external script reference defeats file:// single-file use');
  assert.ok(!html.includes('href="notation/') && !html.includes('src="notation/'), 'external resource reference found');
  for (const id of ['ddn-open', 'ddn-file', 'ddn-paste', 'ddn-load-paste', 'ddn-view-picker',
    'ddn-fit-page', 'ddn-fit-width', 'ddn-fit-height', 'ddn-fit-100', 'ddn-zoom-out', 'ddn-zoom-in', 'ddn-zoom-pct',
    'ddn-font-family', 'ddn-font-size', 'ddn-type-list', 'ddn-type-reset',
    'ddn-kind-list', 'ddn-verb-list', 'ddn-object-panel', 'ddn-object-colour',
    'ddn-rel-routing', 'ddn-rel-tension', 'ddn-rel-radius', 'ddn-rel-crossings', 'ddn-rel-endpoint-ordering',
    'ddn-verb-routing-list', 'ddn-relation-panel', 'ddn-relation-id', 'ddn-relation-routing', 'ddn-relation-clear', 'ddn-relations-reset',
    'ddn-reset', 'ddn-export-svg', 'ddn-export-png', 'ddn-status', 'ddn-stage', 'ddn-paper'])
    assert.ok(html.includes('id="' + id + '"'), 'control #' + id + ' missing');
  assert.ok(!html.includes('id="ddn-font"'), 'free-text font input must be gone (D1: dropdowns only)');
  for (const opt of ['sans', 'serif', 'mono', 'handwriting'])
    assert.ok(html.includes('value="' + opt + '"'), 'font family option ' + opt + ' missing');
  for (const size of ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24'])
    assert.ok(html.includes('value="' + size + '">' + size + ' px'), 'font size option ' + size + ' missing');
  for (const v of ['orthogonal', 'straight', 'curved', 'rounded'])
    assert.ok(html.includes('value="' + v + '"'), 'routing option ' + v + ' missing');
  for (const v of ['gap', 'bridge', 'square_bridge'])
    assert.ok(html.includes('value="' + v + '"'), 'crossings option ' + v + ' missing');
  for (const v of ['optimize', 'preserve'])
    assert.ok(html.includes('value="' + v + '"'), 'endpoint ordering option ' + v + ' missing');
  const chrome = fs.readFileSync(path.join(root, 'notation/viewer/src/template.html'), 'utf8') + fs.readFileSync(path.join(root, 'notation/viewer/src/viewer.js'), 'utf8');
  assert.ok(!/(?<!con)junction/i.test(chrome), 'no junctions control in the viewer chrome (D3: rejected semantics, documented)');
  const vcss = fs.readFileSync(path.join(root, 'notation/viewer/src/viewer.css'), 'utf8');
  assert.ok(chrome.includes("ddn-colour-row ddn-typo-row") && chrome.includes("ddn-fam") && chrome.includes("ddn-siz"), 'typography rows must carry labelled structure classes');
  assert.ok(vcss.includes('#ddn-type-list .ddn-typo-row .ddn-colour-label { flex: 1 1 100%'), 'typography kind label must own a full line');
  assert.ok(vcss.includes('.ddn-fam { flex: 1 1 auto; min-width: 0; }'), 'family dropdown must flex to available width');
  assert.ok(vcss.includes('.ddn-siz { flex: 0 0 68px; width: 68px; }'), 'size dropdown must be fixed narrow');
  assert.ok(!/#ddn-type-list select \{[^}]*max-width/.test(vcss), 'blanket select max-width (label-squeezing) must be gone');
  assert.ok(html.includes('presentation overrides'), 'presentation-only status language missing');
  assert.ok(!/showDirectoryPicker|OffscreenCanvas|showOpenFilePicker/.test(html), 'Chrome-only API found (D4 forbids)');
});

test('computeFitScale: page=min, width, height, 100%', () => {
  assert.equal(V.computeFitScale('width', 500, 300, 1000, 600), 0.5);
  assert.equal(V.computeFitScale('height', 500, 300, 1000, 600), 0.5);
  assert.equal(V.computeFitScale('height', 500, 900, 1000, 600), 1.5);
  assert.equal(V.computeFitScale('page', 500, 300, 1000, 1000), 0.3);
  assert.equal(V.computeFitScale('page', 2000, 2000, 1000, 500), 2);
  assert.equal(V.computeFitScale('100', 500, 300, 1000, 600), 1);
  assert.equal(V.computeFitScale('page', 0, 300, 1000, 600), 1, 'degenerate container falls back to 1');
  assert.throws(() => V.computeFitScale('bogus', 1, 1, 1, 1), /unknown fit mode/);
});

test('overrideRuleFor: kind, verb, object, font rules match the rendered hooks', () => {
  assert.equal(V.overrideRuleFor({ type: 'kind', code: 'SVC' }, '#ff0000'),
    '.ddn-svg .ddn-kind-svc > path, .ddn-svg .ddn-kind-svc > rect, .ddn-svg .ddn-kind-svc > circle, .ddn-svg .ddn-kind-svc > ellipse, .ddn-svg .ddn-kind-svc > polygon { fill: #ff0000; }');
  assert.equal(V.overrideRuleFor({ type: 'verb', code: 'FLOW' }, '#00ff00'),
    '.ddn-svg .ddn-verb-flow path { stroke: #00ff00; }');
  assert.equal(V.overrideRuleFor({ type: 'object', id: 'm::x.y' }, '#123456'),
    '.ddn-svg [data-ddn-id="m::x.y"] > path, .ddn-svg [data-ddn-id="m::x.y"] > rect, .ddn-svg [data-ddn-id="m::x.y"] > circle, .ddn-svg [data-ddn-id="m::x.y"] > ellipse, .ddn-svg [data-ddn-id="m::x.y"] > polygon { fill: #123456; }');
  assert.equal(V.overrideRuleFor({ type: 'font' }, 'Georgia, serif'),
    '.ddn-svg, .ddn-svg text, .ddn-svg tspan { font-family: Georgia, serif; }');
  assert.throws(() => V.overrideRuleFor({ type: 'kind', code: 'SVC' }, 'red'), /#rgb or #rrggbb/);
  assert.throws(() => V.overrideRuleFor({ type: 'bogus' }, '#fff'), /unknown override type/);
  assert.throws(() => V.overrideRuleFor({ type: 'font' }, '  '), /font stack required/);
  assert.ok(V.overrideRuleFor({ type: 'object', id: 'a"b' }, '#fff').includes('a\\"b'), 'quote escaped in selector');
});

test('viewListFrom flattens ws.entries() into picker rows', () => {
  const ws = A.createWorkspace({ 'fixture.ddn': fixture });
  const list = V.viewListFrom(ws.entries());
  assert.deepEqual(list, [
    { entry: 'fixture.ddn', view: 'overview', label: 'fixture.ddn · Overview' },
    { entry: 'fixture.ddn', view: 'compact', label: 'fixture.ddn · Compact' }
  ]);
  assert.throws(() => V.viewListFrom('nope'), /entries array/);
  ws.destroy();
});

test('fixture renders: override selectors (kind class, data-ddn-id, verb class) exist in real output', () => {
  const ws = A.createWorkspace({ 'fixture.ddn': fixture });
  const r = ws.renderSync({ entry: 'fixture.ddn', view: 'overview' });
  const kindCode = A.kinds.find(k => k.id === 'table').code.toLowerCase();
  const verbCode = A.relations.find(x => x.id === 'ref').code.toLowerCase();
  assert.ok(r.svg.includes('class="ddn-node ddn-kind-' + kindCode + '"'), 'kind class hook');
  assert.ok(r.svg.includes('data-ddn-id="demo::demo.alpha"'), 'per-object data-ddn-id hook');
  assert.ok(r.svg.includes('ddn-verb-' + verbCode), 'verb class hook');
  assert.ok(!r.diagnostics.some(d => d.severity === 'error'));
  assert.equal(r.svg, ws.renderSync({ entry: 'fixture.ddn', view: 'overview' }).svg, 'render determinism');
  ws.destroy();
});

test('typographyRuleFor: per-kind family/size CSS overlay rules', () => {
  assert.equal(V.typographyRuleFor('TBL', { family: 'mono', size: 'source' }),
    '.ddn-svg .ddn-kind-tbl text { font-family: ' + V.FONT_STACKS.mono + '; }');
  assert.equal(V.typographyRuleFor('tbl', { family: 'source', size: '20' }),
    '.ddn-svg .ddn-kind-tbl text { font-size: 20px; }');
  assert.equal(V.typographyRuleFor('tbl', { family: 'serif', size: 12 }),
    '.ddn-svg .ddn-kind-tbl text { font-family: ' + V.FONT_STACKS.serif + '; font-size: 12px; }');
  assert.throws(() => V.typographyRuleFor('tbl', { family: 'source', size: 'source' }), /needs a family or a size/);
  assert.throws(() => V.typographyRuleFor('tbl', { family: 'comic' }), /unknown font family/);
  assert.throws(() => V.typographyRuleFor('tbl', { size: '30' }), /between 8 and 24/);
});

test('relationOverrideState: source/empty entries drop out; ids merge over verbs; validation', () => {
  assert.deepEqual(V.relationOverrideState({ routing: 'source', crossings: 'source', endpointOrdering: 'source', curveTension: '', curveRadius: '', verbRouting: {}, relationRouting: {} }), {});
  assert.deepEqual(V.relationOverrideState({ routing: 'rounded', crossings: 'bridge', endpointOrdering: 'preserve', curveTension: '0.7', curveRadius: '40', verbRouting: { ref: 'curved', flow: 'source' }, relationRouting: { 'm::r1': 'orthogonal' } }),
    { routing: 'rounded', crossings: 'bridge', endpointOrdering: 'preserve', curveTension: 0.7, curveRadius: 40, relationRouting: { ref: 'curved', 'm::r1': 'orthogonal' } });
  assert.throws(() => V.relationOverrideState({ routing: 'zigzag' }), /unknown routing/);
  assert.throws(() => V.relationOverrideState({ crossings: 'hop' }), /unknown crossings/);
  assert.throws(() => V.relationOverrideState({ endpointOrdering: 'shuffle' }), /unknown endpoint ordering/);
  assert.throws(() => V.relationOverrideState({ curveTension: '1.2' }), /between 0 and 1/);
  assert.throws(() => V.relationOverrideState({ curveRadius: '999' }), /between 0 and 512/);
  assert.throws(() => V.relationOverrideState({ verbRouting: { ref: 'wiggly' } }), /unknown routing for verb ref/);
  assert.throws(() => V.relationOverrideState({ relationRouting: { 'm::r1': 'wiggly' } }), /unknown routing for relation m::r1/);
});

test('viewerOverrides: global font via the reflow override channel merged with relation options', () => {
  assert.deepEqual(V.viewerOverrides({ font: { family: 'source', size: 'source' }, relations: { routing: 'source' } }), {});
  assert.deepEqual(V.viewerOverrides({ font: { family: 'serif', size: '18' }, relations: { routing: 'curved', crossings: 'gap' } }),
    { font: 'serif', fontSize: 18, routing: 'curved', crossings: 'gap' });
  assert.throws(() => V.viewerOverrides({ font: { family: 'papyrus' } }), /unknown font family/);
  assert.throws(() => V.viewerOverrides({ font: { size: '7' } }), /between 8 and 64/);
});

/* --- B1-018b audit-hardening regressions --- */

test('view picker: index-based option values always round-trip into the view list', () => {
  const ws = A.createWorkspace({ 'fixture.ddn': fixture });
  const list = V.viewListFrom(ws.entries());
  // The pre-fix encoding concatenated entry+view with an empty separator and
  // split('') on read, so any switch landed on entry=<first char> → LIVE012.
  // Index values are immune to every character legal in file/view ids.
  for (let i = 0; i < list.length; i++)
    assert.deepEqual(list[+String(i)], list[i]);
  const src = fs.readFileSync(path.join(root, 'notation/viewer/src/viewer.js'), 'utf8');
  assert.ok(!src.includes(".split('')"), "empty-separator split('') is still present");
  assert.ok(src.includes('o.value = String(i)'), 'picker options are not index-valued');
  assert.ok(src.includes('(state.viewList || [])[+els.picker.value]'), 'picker change handler does not resolve via the view list');
  ws.destroy();
});

test('viewer render path sanitizes renderer SVG (safeSVG port, no innerHTML sink)', () => {
  const src = fs.readFileSync(path.join(root, 'notation/viewer/src/viewer.js'), 'utf8');
  assert.ok(src.includes('function safeSVG('), 'safeSVG sanitizer missing');
  assert.ok(src.includes('els.paper.replaceChildren(safeSVG(r.svg))'), 'render() does not insert sanitized nodes');
  assert.ok(!src.includes('els.paper.innerHTML'), 'raw innerHTML sink remains');
  assert.ok(src.includes("doc.querySelectorAll('script,foreignObject')"), 'script/foreignObject strip missing');
  assert.ok(src.includes("/^on/i.test(a.name)"), 'on* attribute strip missing');
  const built = fs.readFileSync(path.join(root, 'notation/viewer/ddn-viewer.html'), 'utf8');
  assert.ok(built.includes('els.paper.replaceChildren(safeSVG(r.svg))'), 'built ddn-viewer.html is stale — run npm --prefix notation run build:viewer');
});

test('isPlausibleSourceFile: .ddn names or text/* types, everything else rejected', () => {
  assert.ok(V.isPlausibleSourceFile({ name: 'model.ddn' }));
  assert.ok(V.isPlausibleSourceFile({ name: 'MODEL.DDN' }));
  assert.ok(V.isPlausibleSourceFile({ name: 'bundle.ddn.txt' }));
  assert.ok(V.isPlausibleSourceFile({ name: 'notes', type: 'text/plain' }));
  assert.ok(!V.isPlausibleSourceFile({ name: 'photo.png', type: 'image/png' }), 'the pre-fix || true filter accepted this');
  assert.ok(!V.isPlausibleSourceFile({ name: 'archive.zip', type: 'application/zip' }));
  assert.ok(!V.isPlausibleSourceFile({ name: 'binary.bin' }));
  assert.ok(!V.isPlausibleSourceFile(null));
  const src = fs.readFileSync(path.join(root, 'notation/viewer/src/viewer.js'), 'utf8');
  assert.ok(!src.includes('|| true'), 'dead filter clause remains');
});

test('file open: size cap, __proto__/duplicate-safe store, input reset', () => {
  const src = fs.readFileSync(path.join(root, 'notation/viewer/src/viewer.js'), 'utf8');
  assert.strictEqual(V.MAX_FILE_BYTES, 50_000_000);
  assert.ok(src.includes('f.size > MAX_FILE_BYTES'), 'no size cap before f.text()');
  assert.ok(src.includes('Object.create(null)'), 'files store is not prototype-safe');
  assert.ok(src.includes("els.fileInput.value = ''"), 'file input is not reset after load');
  assert.ok(src.includes('duplicate name skipped'), 'duplicate basenames silently overwrite');
});

test('rasterCanvasSize: 2× canvas, capped per side, degenerate sizes rejected', () => {
  assert.deepEqual(V.rasterCanvasSize(100, 50, 2), { width: 200, height: 100 });
  assert.deepEqual(V.rasterCanvasSize(8000, 8192, 2), { width: 16000, height: 16384 });
  assert.throws(() => V.rasterCanvasSize(9000, 100, 2), /16384/, 'oversize page must refuse, not allocate');
  assert.throws(() => V.rasterCanvasSize(100, 9000, 2), /PNG export refused/);
  assert.throws(() => V.rasterCanvasSize(0, 0, 2), /nothing rendered/);
});

test('loadFiles resets selection and presentation state from any previous document', () => {
  const src = fs.readFileSync(path.join(root, 'notation/viewer/src/viewer.js'), 'utf8');
  const m = src.match(/function loadFiles\(files, entry\) \{[\s\S]*?render\(\);/);
  assert.ok(m, 'loadFiles not found');
  assert.ok(m[0].includes('state.selected = null'), 'stale object selection carried across loads');
  assert.ok(m[0].includes('state.selectedRelation = null'), 'stale relation selection carried across loads');
  assert.ok(m[0].includes('state.presentation = emptyPresentation()'), 'stale presentation overrides carried across loads');
});

const n = results.length, ok = results.filter(r => r.pass).length;
console.log(`Viewer ${ok}/${n}`);
