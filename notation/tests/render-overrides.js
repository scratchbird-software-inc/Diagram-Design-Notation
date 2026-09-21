/* SPDX-License-Identifier: GPL-2.0-or-later. B1-011 render-time override channel: relationRouting
 * (per verb / per relation id, id wins; rounded→curved+rounded), curveTension/curveRadius,
 * LIVE022/LIVE023 key/value rejection, LIVE021/LIVE020 guards, source immutability, determinism. */
'use strict';
const A = require('../dist/ddn.global.js'), assert = require('node:assert/strict');
const results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { results.push({ name, pass: false }); console.error('FAIL', name, e.stack); process.exitCode = 1; } }
const throws = (fn, code) => assert.throws(fn, e => { if (e.code !== code) console.error('Expected', code, 'got', e.code, e.message); return e.code === code; });

const SRC = `ddn "0.5";
module "demo";
data demo {
    object alpha "Alpha table" { kind: table; }
    object beta "Beta table" { kind: table; }
    object gamma "Gamma table" { kind: table; }
    object delta "Delta table" { kind: table; }
    relation ab "writes" @demo.alpha -> @demo.beta { kind: ref; }
    relation bc "flows" @demo.beta -> @demo.gamma { kind: flow; }
    relation cd "reads" @demo.gamma -> @demo.delta { kind: ref; }
}
format f {
    style s { look: classic; theme: default; font: sans; }
    layout g { algorithm: grid; columns: 4; gap: 140px; routing: orthogonal; }
    legend c { mode: tokens; placement: right; }
    publication p { size: content; fit: none; }
    bundle b { style:@s; layout:@g; legend:@c; publication:@p; }
}
view overview "Overview" {
    data: [@demo]; format: @f.b;
}
`;
const CHART = `ddn "0.5";
module "demo.chart";
data facts {
    object r1 "A" { kind: record; x_record: {"k": "a", "v": 1}; }
    object r2 "B" { kind: record; x_record: {"k": "b", "v": 2}; }
}
view chart "Chart" {
    data: [@facts];
    projection { kind: chart; profile: "chart.basic@1"; records: [@facts.r1, @facts.r2]; mark: bar; x: "x_record.k"; y: "x_record.v"; }
    publication { size: content; fit: none; }
}
`;
const INTERACTION = `ddn "0.5";
module "demo.ix";
data d {
    object a "A" { kind: application; }
    object b "B" { kind: service; }
    relation m "Call" @a -> @b { kind: "uml.message"; }
}
format f {
    layout g { x_interaction: {"profile":"uml.sequence@1"}; }
    bundle bb { layout: @g; }
}
view v "Interaction" {
    data: [@d]; format: @f.bb;
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;

const ws = () => A.createWorkspace({ 'main.ddn': SRC });
const routeById = (r, id) => r.scene.routes.find(x => x.id === id);

test('relationRouting by verb: each verb maps to its routing family in the scene', () => {
  const w = ws();
  const r = w.renderSync({ entry: 'main.ddn', view: 'overview', overrides: { relationRouting: { ref: 'curved', flow: 'straight' } } });
  assert.equal(routeById(r, 'demo::demo.ab').routing, 'curved');
  assert.equal(routeById(r, 'demo::demo.cd').routing, 'curved');
  assert.equal(routeById(r, 'demo::demo.bc').routing, 'straight');
  w.destroy();
});

test('relation id key wins over verb key; verb key wins over view-level routing', () => {
  const w = ws();
  const r = w.renderSync({ entry: 'main.ddn', view: 'overview', overrides: { routing: 'straight', relationRouting: { ref: 'curved', 'demo::demo.ab': 'orthogonal' } } });
  assert.equal(routeById(r, 'demo::demo.ab').routing, 'orthogonal', 'id key beats verb key');
  assert.equal(routeById(r, 'demo::demo.cd').routing, 'curved', 'verb key beats view routing');
  assert.equal(routeById(r, 'demo::demo.bc').routing, 'straight', 'untouched verb follows view routing');
  w.destroy();
});

test('rounded maps to curved routing with rounded bends per relation', () => {
  const w = ws();
  const r = w.renderSync({ entry: 'main.ddn', view: 'overview', overrides: { relationRouting: { ref: 'rounded' } } });
  for (const id of ['demo::demo.ab', 'demo::demo.cd']) {
    assert.equal(routeById(r, id).routing, 'curved');
    assert.equal(routeById(r, id).curveFamily, 'rounded');
  }
  assert.equal(routeById(r, 'demo::demo.bc').routing, 'orthogonal');
  w.destroy();
});

test('unknown verb/relation key rejects LIVE022 naming the key', () => {
  const w = ws();
  throws(() => w.renderSync({ entry: 'main.ddn', view: 'overview', overrides: { relationRouting: { bogus_verb: 'curved' } } }), 'LIVE022');
  assert.throws(() => w.renderSync({ entry: 'main.ddn', view: 'overview', overrides: { relationRouting: { bogus_verb: 'curved' } } }), /bogus_verb/);
  w.destroy();
});

test('bad relationRouting value rejects LIVE023; non-record rejects LIVE022', () => {
  const w = ws();
  throws(() => w.renderSync({ entry: 'main.ddn', view: 'overview', overrides: { relationRouting: { ref: 'zigzag' } } }), 'LIVE023');
  throws(() => w.renderSync({ entry: 'main.ddn', view: 'overview', overrides: { relationRouting: ['ref'] } }), 'LIVE022');
  w.destroy();
});

test('LIVE021 on a data-bound chart view; LIVE020 on an interaction (fixed-lane) view', () => {
  const c = A.createWorkspace({ 'c.ddn': CHART });
  throws(() => c.renderSync({ entry: 'c.ddn', view: 'chart', overrides: { relationRouting: { ref: 'curved' } } }), 'LIVE021');
  c.destroy();
  const s = A.createWorkspace({ 's.ddn': INTERACTION });
  throws(() => s.renderSync({ entry: 's.ddn', view: 'v', overrides: { relationRouting: { 'uml.message': 'curved' } } }), 'LIVE020');
  s.destroy();
});

test('curveTension/curveRadius accepted in range, rejected LIVE003 out of range', () => {
  const w = ws();
  const r = w.renderSync({ entry: 'main.ddn', view: 'overview', overrides: { routing: 'curved', curveTension: 0.8 } });
  assert.equal(routeById(r, 'demo::demo.ab').appliedTension, 0.8);
  const rr = w.renderSync({ entry: 'main.ddn', view: 'overview', overrides: { routing: 'rounded', curveRadius: 48 } });
  assert.equal(routeById(rr, 'demo::demo.ab').curveFamily, 'rounded');
  assert.equal(routeById(rr, 'demo::demo.ab').curveRadius, 48);
  throws(() => w.renderSync({ entry: 'main.ddn', view: 'overview', overrides: { curveTension: 1.5 } }), 'LIVE003');
  throws(() => w.renderSync({ entry: 'main.ddn', view: 'overview', overrides: { curveTension: -0.1 } }), 'LIVE003');
  throws(() => w.renderSync({ entry: 'main.ddn', view: 'overview', overrides: { curveRadius: 513 } }), 'LIVE003');
  throws(() => w.renderSync({ entry: 'main.ddn', view: 'overview', overrides: { curveRadius: -4 } }), 'LIVE003');
  w.destroy();
});

test('curveTension/curveRadius are inert when the effective routing is not curved', () => {
  const w = ws();
  const plain = w.renderSync({ entry: 'main.ddn', view: 'overview' });
  const inert = w.renderSync({ entry: 'main.ddn', view: 'overview', overrides: { curveTension: 0.9, curveRadius: 64 } });
  assert.equal(inert.svg, plain.svg, 'orthogonal routing ignores curve quantities byte-for-byte');
  w.destroy();
});

test('overrides never mutate the workspace source bytes', () => {
  const w = ws(), before = w.getFiles();
  w.renderSync({ entry: 'main.ddn', view: 'overview', overrides: { routing: 'rounded', relationRouting: { ref: 'straight', 'demo::demo.bc': 'rounded' }, curveTension: 0.7, curveRadius: 24, crossings: 'bridge', endpointOrdering: 'preserve', font: 'serif', fontSize: 18 } });
  assert.deepEqual(w.getFiles(), before);
  w.destroy();
});

test('determinism: identical overrides render byte-identical SVG twice', () => {
  const w = ws();
  const overrides = { routing: 'curved', relationRouting: { ref: 'rounded', 'demo::demo.bc': 'orthogonal' }, curveTension: 0.6, curveRadius: 40 };
  const a = w.renderSync({ entry: 'main.ddn', view: 'overview', overrides });
  const b = w.renderSync({ entry: 'main.ddn', view: 'overview', overrides });
  assert.equal(a.svg, b.svg);
  w.destroy();
});

const n = results.length, ok = results.filter(r => r.pass).length;
console.log(`Render-overrides ${ok}/${n}`);
