/* SPDX-License-Identifier: GPL-2.0-or-later. B1-018a runtime parser/render audit
 * hardening regressions. Each test is the executed repro from
 * audit/runtime-parser.md and audit/runtime-render.md. Hostile-input
 * conditions must surface as coded DDN errors or bounded work, never uncaught
 * RangeError / hangs / injected markup.
 * DDN_RT overrides the runtime directory (used to demonstrate fail-before). */
'use strict';
const RT = process.env.DDN_RT || '../runtime';
const D = require(RT + '/ddn-core.js').default, C = require(RT + '/ddn-contracts.js').default,
  X = require(RT + '/ddn-export.js').default, T = require(RT + '/ddn-text.js').default,
  L = require(RT + '/ddn-layout.js').default, P = require(RT + '/ddn-patterns.js').default,
  R = require(RT + '/ddn-render.js').default, Shapes = require(RT + '/ddn-shapes.js').default,
  Palette = require(RT + '/ddn-palette.js').default;
const assert = require('node:assert/strict');
const reg = require('../../standard/registry/catalogue.json');
const results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { results.push({ name, pass: false }); console.error('FAIL', name, e.stack); process.exitCode = 1; } }
const throws = (fn, code) => assert.throws(fn, e => { if (e.code !== code) console.error('Expected', code, 'got', e.code, e.message); return e.code === code; });
const node22 = (n, rels, opts = {}) => L.layoutNodes(n, rels, { layout: { algorithm: 'layered', direction: 'right', gap: 100, row_gap: 100, columns: 3, ...opts } }, {});
const chain = (n) => { const nodes = [], rels = []; for (let i = 0; i < n; i++)nodes.push({ id: 'n' + i, w: 100, h: 60 }); for (let i = 1; i < n; i++)rels.push({ id: 'r' + i, kind: 'ref', from: { element: 'n' + (i - 1) }, to: { element: 'n' + i } }); return { nodes, rels }; };

// ---- Parser lane: runtime-parser.md ----

test('P1: bundle() with module id containing "/" degrades to DDN-W014, no lexer crash', () => {
  const files = {
    'lib.ddn': 'ddn "0.5";\nmodule "a/b";\ndata q {\n object thing { kind: table; }\n}\n',
    'main.ddn': 'ddn "0.5";\nimport "lib.ddn" as lib;\nmodule "m";\nview v {\n data: [@lib.q];\n}\n',
  };
  const out = D.bundle(files, 'main.ddn');
  assert.ok(out.diagnostics.some(d => d.code === 'DDN-W014' && /not expressible/.test(d.message)), 'expected DDN-W014: ' + JSON.stringify(out.diagnostics));
});

test('P2: bundle() keys external imports by alias; conflicting targets warn once', () => {
  const files = {
    // ext1.ddn / ext2.ddn are deliberately absent from the workspace: they are external.
    'a.ddn': 'ddn "0.5";\nimport "ext2.ddn" as shared;\nmodule "ma";\ndata da {\n object ay;\n}\n',
    'main.ddn': 'ddn "0.5";\nimport "ext1.ddn" as shared;\nimport "a.ddn" as aa;\nmodule "m";\ndata dm {\n object z;\n}\nview v {\n data: [@dm, @aa.da];\n}\n',
  };
  const out = D.bundle(files, 'main.ddn');
  const kept = out.text.split('\n').filter(l => l.startsWith('import '));
  assert.equal(kept.length, 1, 'only the first external alias may survive: ' + kept.join(' | '));
  assert.ok(out.diagnostics.some(d => d.code === 'DDN-W014' && /Conflicting external import alias shared/.test(d.message) && d.message.includes('ext1.ddn') && d.message.includes('ext2.ddn')));
  D.parse(out.text, 'bundled.ddn'); // the bundle itself must remain parseable
});

test('P3: workflowErrors reachability is near-linear on wide inputs', () => {
  const mk = n => ({ states: Array.from({ length: n }, (_, i) => 's' + i), initial: 's0', terminal: ['s' + (n - 1)], transitions: Array.from({ length: n - 1 }, (_, i) => ({ id: 't' + i, from: 's' + i, to: 's' + (i + 1), event: 'e' + i, max_visits: 1 })) });
  const t0 = Date.now(); C.workflowErrors(mk(2000)); const t1 = Date.now(); C.workflowErrors(mk(16000)); const t2 = Date.now();
  assert.ok(t2 - t0 < 2000, 'quadratic reachability: ' + (t1 - t0) + 'ms / ' + (t2 - t1) + 'ms');
});

test('P4a: workflowErrors cycle-cut DFS is iterative (deep chain, coded error)', () => {
  const n = 20000;
  const w = { states: Array.from({ length: n }, (_, i) => 's' + i), initial: 's0', terminal: ['s' + (n - 1)], transitions: Array.from({ length: n - 1 }, (_, i) => ({ id: 't' + i, from: 's' + i, to: 's' + (i + 1), event: 'e' + i })) };
  const errors = C.workflowErrors(w); // must not RangeError; the unbounded chain is one long cycle-free path
  assert.deepEqual(errors, []);
});

test('P4b: createWorkspace load() is iterative across a deep import chain', () => {
  const n = 8000, files = {};
  for (let i = 0; i < n; i++)files['f' + i + '.ddn'] = 'ddn "0.5";\n' + (i + 1 < n ? 'import "f' + (i + 1) + '.ddn" as n;\n' : '') + 'module "m' + i + '";\ndata d {\n object o;\n}\n';
  const ws = D.createWorkspace(files, 'f0.ddn');
  assert.equal(ws.docs.size, n);
});

test('P4c: bundle() visit is iterative across a deep import chain', () => {
  const n = 8000, files = {};
  for (let i = 0; i < n; i++)files['f' + i + '.ddn'] = 'ddn "0.5";\n' + (i + 1 < n ? 'import "f' + (i + 1) + '.ddn" as n;\n' : '') + 'module "m' + i + '";\ndata d {\n object o;\n}\n';
  const out = D.bundle(files, 'f0.ddn');
  assert.ok(out.text.startsWith('ddn "0.5";'));
});

test('P5: uid "__proto__" cannot corrupt placement/route maps', () => {
  const src = 'ddn "0.5";\nmodule "m";\ndata d {\n object o { uid: "__proto__"; }\n}\nview v {\n data: [@d];\n place @d.o { at: [10px, 20px]; }\n}\n';
  const ir = D.build({ 'm.ddn': src }, 'm.ddn', 'v', reg).ir;
  assert.equal(Object.getPrototypeOf(ir.view.placements), null);
  assert.deepEqual(Object.keys(ir.view.placements), ['__proto__']);
  assert.equal(ir.view.placements['__proto__'].at[0].$quantity, 10);
});

test('P6: module ids deeper than 16 dotted segments resolve as sibling references', () => {
  const mid = Array.from({ length: 18 }, (_, i) => 'm' + i).join('.');
  const src = 'ddn "0.5";\nmodule "a";\ndata da {\n object x;\n}\nview v {\n data: [@da, @' + mid + '.db];\n}\nmodule "' + mid + '";\ndata db {\n object y;\n}\n';
  const ir = D.build({ 'm.ddn': src }, 'm.ddn', 'v', reg).ir;
  assert.equal(ir.elements.length, 2);
});

test('P8: publication geometry must be finite and bounded (DDN046)', () => {
  const wrap = pub => 'ddn "0.5";\nmodule "m";\ndata d {\n object o;\n}\nview v {\n data: [@d];\n publication { ' + pub + ' }\n}\n';
  throws(() => D.build({ 'm.ddn': wrap('width: 1e308in;') }, 'm.ddn', 'v', reg), 'DDN046');
  throws(() => D.build({ 'm.ddn': wrap('height: 200000px;') }, 'm.ddn', 'v', reg), 'DDN046');
  throws(() => D.build({ 'm.ddn': wrap('margin: 1e308in;') }, 'm.ddn', 'v', reg), 'DDN046');
  D.build({ 'm.ddn': wrap('width: 1280px; height: 800px; margin: 32px;') }, 'm.ddn', 'v', reg); // sane input unchanged
});

test('P10: normalizePath diagnostics name the offending import path', () => {
  assert.throws(() => D.createWorkspace({ 'a.ddn': 'ddn "0.5";\nimport "https://evil.example/x.ddn" as e;\nmodule "m";\ndata d {\n object o;\n}\n' }, 'a.ddn'),
    e => e.code === 'DDN020' && e.message.includes('https://evil.example/x.ddn'));
});

// ---- Render lane: runtime-render.md ----

test('R1: SQL export sanitizes ids/kinds inside -- comments', () => {
  const src = 'ddn "0.3";\nmodule "m";\ndata d {\n object evil { kind: note; }\n object t "T" { kind: table; fields { field f; } }\n}\nview v {\n data: [@d];\n export { mode: redacted; format: sql; elements: [@d.evil, @d.t]; fields: [@d.t.f]; }\n publication { size: content; fit: none; }\n}\n';
  const ir = D.build({ 'm.ddn': src }, 'm.ddn', 'v', reg).ir;
  const evil = ir.elements.find(n => n.name === 'evil');
  evil.id = 'ns::x\n); DROP TABLE users; --'; // programmatic IR ids are arbitrary strings
  ir.view.profiles.export.elements[0] = { $ref: evil.id };
  const out = X.sql(ir);
  for (const line of out.split('\n')) assert.ok(!line.includes('DROP TABLE') || line.startsWith('--'), 'injected SQL escaped the comment: ' + line);
  assert.ok(out.includes('-- skipped: ns::x?); DROP TABLE users; -- (kind note is not table)'), out);
});

test('R2: layout/pattern DFS are iterative on deep chains', () => {
  const { nodes, rels } = chain(20000);
  node22(nodes.map(n => ({ ...n })), rels); // layered: iterative Tarjan, no RangeError
  const { nodes: tn, rels: tr } = chain(20000);
  L.layoutNodes(tn, tr, { layout: { algorithm: 'tree', direction: 'right', gap: 100, row_gap: 100, columns: 3 } }, {}); // tree: iterative walks
  const { nodes: pn, rels: pr } = chain(20000);
  const ir = { view: { placements: {}, frames: [] } };
  P.place(pn, pr, ir, { layout: { algorithm: 'layered', direction: 'right', gap: 100, grid_step: 32, center: 'pins' } }); // patterns: iterative directedRanks
});

test('R3: text-metrics request capture is bounded (FIFO cap)', () => {
  T.clearRequests();
  for (let i = 0; i < 6000; i++)T.measure('unique label number ' + i, 14, 'sans', 400);
  assert.ok(T.pending().length <= 4096, 'requests map unbounded: ' + T.pending().length);
  T.clearRequests();
});

test('R4: registry colour/dash/silhouette values are escaped in SVG attributes', () => {
  const evil = 'red" onload="alert(1)';
  const custom = { ...reg, kinds: reg.kinds.map(k => k.keyword === 'object' ? { ...k, colour: evil, fill: evil } : k) };
  const src = 'ddn "0.5";\nmodule "m";\ndata d {\n object o "O" { kind: object; }\n}\nview v {\n data: [@d];\n}\n';
  const { svg } = R.render(D.build({ 'm.ddn': src }, 'm.ddn', 'v', custom).ir, custom);
  assert.ok(!svg.includes(evil), 'raw registry colour reached the SVG');
  assert.ok(svg.includes('red&quot; onload=&quot;alert(1)'));
  const shape = Shapes.render({ n: { id: 'x', name: 'x', properties: {}, fields: [] }, k: { code: 'X', name: 'X' }, x: 0, y: 0, w: 100, h: 60, scale: 1, titleLines: ['x'], fieldRows: [], silhouette: 'round" onload="alert(1)' }, { style: { look: 'classic', theme: 'default', font: 'sans' }, layout: {} }, Palette.themes.default);
  assert.ok(!shape.includes('data-shape="round" onload="alert(1)"'), shape.slice(0, 200));
  assert.ok(shape.includes('data-shape="round&quot;'));
});

test('R5: subdiagram href rejects unsafe schemes with DDN078', () => {
  const src = 'ddn "0.5";\nmodule "m";\ndata d {\n object o;\n}\nview inner {\n data: [@d];\n}\nview outer {\n data: [@d];\n subdiagram s { view: @m.inner; mode: reference; at: [0px, 0px]; }\n}\n';
  const ir = D.build({ 'm.ddn': src }, 'm.ddn', 'outer', reg).ir;
  R.render(structuredClone(ir), reg); // safe parsed target renders
  const hostile = structuredClone(ir);
  hostile.view.subdiagrams[0].targetLocal = 'javascript:alert(1)';
  throws(() => R.render(hostile, reg), 'DDN078');
});

test('R6: reduce-based min/max — bounds of a 500k-node model does not RangeError', () => {
  const nodes = Array.from({ length: 500000 }, (_, i) => ({ id: 'n' + i, x: i % 1000, y: i % 700, w: 10, h: 10 }));
  const b = P.bounds(nodes);
  assert.equal(b.w, 1009);
});

test('R8: sample tables cap rendered rows with an explicit remainder note', () => {
  const rows = Array.from({ length: 1500 }, (_, i) => ['v' + i]);
  const src = 'ddn "0.5";\nmodule "m";\ndata d {\n object t "T" { kind: table; fields { field f; } }\n sample s "S" { columns: [@d.t.f]; rows: ' + JSON.stringify(rows) + '; }\n}\nview v {\n data: [@d];\n publication { size: content; fit: none; }\n}\n';
  const { svg } = R.render(D.build({ 'm.ddn': src }, 'm.ddn', 'v', reg).ir, reg);
  assert.ok(svg.includes('+500 rows not rendered'), 'expected remainder note');
  assert.ok(svg.includes('v999') && !svg.includes('v1000'));
});

test('R9: unknown style.font falls back to the sans family in the style block', () => {
  const src = 'ddn "0.5";\nmodule "m";\ndata d {\n object o;\n}\nview v {\n data: [@d];\n}\n';
  const ir = D.build({ 'm.ddn': src }, 'm.ddn', 'v', reg).ir;
  ir.view.profiles.style.font = 'not-a-font';
  const { svg } = R.render(ir, reg);
  assert.ok(!svg.includes('font-family:undefined'));
});

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
