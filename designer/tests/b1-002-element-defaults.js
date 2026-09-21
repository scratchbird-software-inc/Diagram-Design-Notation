// SPDX-License-Identifier: GPL-2.0-or-later.
// B1-002 behavior suite: designer creation populates registry element defaults.
// Harness style imitates ed-001-full-kind-palette.js. No dependencies.
'use strict';
const assert = require('assert');
const D = require('../../notation/dist/ddn.global.js');
const CMD = require('../prototype/commands.js');
const KINDMAP = require('../contracts/kind-ui-map.json');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

const FORMAT = 'format f {\n    style s { look: classic; theme: default; font: sans; }\n    layout l { algorithm: grid; columns: 3; gap: 120px; row_gap: 90px; routing: orthogonal; }\n    publication p { size: content; fit: none; }\n    bundle b { style:@s; layout:@l; publication:@p; }\n}\n';
function graphFiles() {
  return { 'model.ddn': 'ddn "0.5";\nmodule "b1002.fixture";\n// Fixture comment: must survive every edit byte-identically.\ndata m {\n    object anchor "Anchor" { kind: table; fields { field id; } }\n}\n' + FORMAT + 'view overview "Fixture view" {\n    data: [@m]; format: @f.b;\n}\n' };
}
const mapEntry = kind => KINDMAP.kinds.find(k => k.kind === kind);

test('gate: every mapped kind resolves registry defaults through the public API', () => {
  assert.equal(typeof D.defaults.forKind, 'function');
  for (const k of KINDMAP.kinds) {
    const d = D.defaults.forKind(k.kind);
    assert.ok(d && typeof d === 'object' && !Array.isArray(d), 'defaults did not resolve for ' + k.kind);
  }
  assert.deepStrictEqual(D.defaults.forKind('cache'), { role: 'cache' });
  assert.deepStrictEqual(D.defaults.forKind('table'), {});
});

test('create via palette action writes the registry defaults into the source', () => {
  const ws = D.createWorkspace(graphFiles());
  const made = CMD.applyCreationAction(D, ws, 'model.ddn', 'overview', { mapEntry: mapEntry('cache'), id: 'c1' });
  const src = ws.getFiles()['model.ddn'];
  assert.ok(src.includes('object c1 '), 'definition missing');
  assert.ok(/object c1 "[^"]*" \{[^}]*kind: "cache";/.test(src), 'kind not written');
  assert.ok(/object c1 "[^"]*" \{[^}]*role: "cache";/.test(src), 'registry default role not written into source:\n' + src);
  const ir = ws.resolve('model.ddn', 'overview');
  const el = ir.elements.find(e => e.id === made.select);
  assert.strictEqual(el.kind, 'cache');
  assert.strictEqual(el.properties.role, 'cache');
  assert.ok(ws.renderSync({ entry: 'model.ddn', view: 'overview' }).svg.includes('<svg'));
  ws.destroy();
});

test('kinds with empty defaults create exactly the kind property, nothing more', () => {
  const ws = D.createWorkspace(graphFiles());
  CMD.applyCreationAction(D, ws, 'model.ddn', 'overview', { mapEntry: mapEntry('table'), id: 't1' });
  const ir = ws.resolve('model.ddn', 'overview');
  const el = ir.elements.find(e => e.local === 't1');
  assert.deepStrictEqual(el.properties, { kind: 'table' });
  ws.destroy();
});

test('explicit properties channel wins over registry defaults at creation', () => {
  const ws = D.createWorkspace(graphFiles());
  const made = CMD.createInView(D, ws, 'model.ddn', 'overview', { id: 'c2', name: 'Override', kind: 'cache', properties: { role: 'primary' } });
  const src = ws.getFiles()['model.ddn'];
  assert.ok(src.includes('role: "primary";'), 'explicit value not written');
  assert.ok(!src.includes('role: "cache";'), 'registry default overwrote the explicit value');
  const el = ws.resolve('model.ddn', 'overview').elements.find(e => e.id === made.select);
  assert.strictEqual(el.properties.role, 'primary');
  ws.destroy();
});

test('undo restores byte-exact source after a defaults-populating creation', () => {
  const files = graphFiles(), original = files['model.ddn'];
  const ws = D.createWorkspace(files);
  CMD.applyCreationAction(D, ws, 'model.ddn', 'overview', { mapEntry: mapEntry('cache'), id: 'c3', at: { x: 40, y: 60 } });
  assert.notStrictEqual(ws.getFiles()['model.ddn'], original);
  assert.ok(ws.undo());
  assert.strictEqual(ws.getFiles()['model.ddn'], original, 'undo did not restore exact bytes');
  assert.ok(ws.redo());
  assert.ok(ws.getFiles()['model.ddn'].includes('role: "cache";'));
  ws.destroy();
});

test('round-trip + determinism: fixture comment survives; two identical runs give identical files', () => {
  const run = () => {
    const ws = D.createWorkspace(graphFiles());
    CMD.applyCreationAction(D, ws, 'model.ddn', 'overview', { mapEntry: mapEntry('cache'), id: 'c4', at: { x: 10, y: 20 } });
    CMD.applyCreationAction(D, ws, 'model.ddn', 'overview', { mapEntry: mapEntry('snapshot'), id: 's1' });
    const out = ws.getFiles()['model.ddn'];
    ws.destroy();
    return out;
  };
  const a = run(), b = run();
  assert.strictEqual(a, b);
  assert.ok(a.includes('// Fixture comment: must survive every edit byte-identically.'));
  assert.ok(a.includes('temporal: "snapshot";'), 'snapshot default not populated');
});

console.log(`B1-002 element defaults ${pass}/${pass + fail}`);
if (fail) process.exitCode = 1;
