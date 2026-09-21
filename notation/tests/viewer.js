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

const n = results.length, ok = results.filter(r => r.pass).length;
console.log(`Viewer ${ok}/${n}`);
