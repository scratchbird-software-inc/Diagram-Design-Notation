// SPDX-License-Identifier: GPL-2.0-or-later.
// ED-001 behavior/contract suite: full kind palette from kind-ui-map.json.
// Harness style imitates notation/tests/projections.js. No dependencies.
'use strict';
const assert = require('assert');
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const D = require('../../notation/dist/ddn.global.js');
const CMD = require('../prototype/commands.js');
const KINDMAP = require('../contracts/kind-ui-map.json');
const RELMAP = require('../contracts/relation-ui-map.json');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

const GROUPS = ['Meaning', 'Data', 'Process', 'Systems', 'Scopes', 'People & control', 'Notes & evidence', 'Analysis'];
const ACTIONS = ['create-semantic-element', 'edit-projection-source-not-free-node', 'add-cause-under-parent', 'add-rule-in-decision-editor'];
const EXPECTED_GROUP_COUNTS = { 'Meaning': 15, 'Scopes': 27, 'Data': 57, 'Analysis': 15, 'Systems': 22, 'Process': 29, 'People & control': 15, 'Notes & evidence': 8 };

const FORMAT = 'format f {\n    style s { look: classic; theme: default; font: sans; }\n    layout l { algorithm: grid; columns: 3; gap: 120px; row_gap: 90px; routing: orthogonal; }\n    publication p { size: content; fit: none; }\n    bundle b { style:@s; layout:@l; publication:@p; }\n}\n';
function graphFiles() {
  return { 'model.ddn': 'ddn "0.5";\nmodule "ed001.fixture";\n// Fixture comment: must survive every edit byte-identically.\ndata m {\n    object anchor "Anchor" { kind: table; fields { field id; } }\n}\n' + FORMAT + 'view overview "Fixture view" {\n    data: [@m]; format: @f.b;\n}\n' };
}

// 1. Map integrity.
test('kind-ui-map: 188 entries, all kinds registered, groups and actions known', () => {
  assert.strictEqual(KINDMAP.kinds.length, 188);
  assert.strictEqual(KINDMAP.kindCount, 188);
  const counts = {};
  for (const k of KINDMAP.kinds) {
    assert.ok(D.kinds.some(x => x.id === k.kind), 'kind not registered in runtime: ' + k.kind);
    assert.ok(GROUPS.includes(k.palette_group), 'unknown palette_group ' + k.palette_group);
    assert.ok(ACTIONS.includes(k.creation_action), 'unknown creation_action ' + k.creation_action);
    counts[k.palette_group] = (counts[k.palette_group] || 0) + 1;
  }
  assert.deepStrictEqual(counts, EXPECTED_GROUP_COUNTS);
  assert.strictEqual(RELMAP.relations.length, 109);
});

// 2. VE-AC-002 / VE-AC-064 evidence loop: every mapped kind creates, resolves and renders.
test('all 188 kinds: createInView creates, resolves and renders (VE-AC-002/064)', () => {
  for (let i = 0; i < KINDMAP.kinds.length; i++) {
    const k = KINDMAP.kinds[i];
    const ws = D.createWorkspace(graphFiles());
    const id = 'k_' + i;
    const made = CMD.createInView(D, ws, 'model.ddn', 'overview', { id, name: 'New ' + k.name, kind: k.kind });
    const ir = ws.resolve('model.ddn', 'overview');
    const el = ir.elements.find(e => e.id === made.select);
    assert.ok(el, 'element missing after creation of ' + k.kind);
    assert.strictEqual(el.kind, k.kind, 'kind mismatch for ' + k.kind);
    const out = ws.renderSync({ entry: 'model.ddn', view: 'overview' });
    assert.ok(out.svg.includes('<svg'), 'render failed for ' + k.kind);
    ws.destroy();
  }
});

// 3. Round-trip: comments and unrelated spans survive; one undo restores exact bytes (VE-002/VE-003).
test('creation round-trip preserves comments, unrelated spans, and undo restores exact bytes', () => {
  const files = graphFiles(), original = files['model.ddn'];
  const ws = D.createWorkspace(files);
  CMD.createInView(D, ws, 'model.ddn', 'overview', { id: 'rt1', name: 'Round trip', kind: 'record' });
  const edited = ws.getFiles()['model.ddn'];
  assert.ok(edited.includes('// Fixture comment: must survive every edit byte-identically.'));
  assert.ok(edited.includes('object anchor "Anchor" { kind: table; fields { field id; } }'));
  ws.undo();
  assert.strictEqual(ws.getFiles()['model.ddn'], original);
  ws.destroy();
});

// 4. add-cause-under-parent in a fishbone view: object + relation in one undo step; guidance without parent.
const FISH = 'ddn "0.5";\nmodule "ed001.fish";\ndata causes {\n    object effect "Dimensional inspection failures" { kind: "quality.effect"; }\n    object cat0 "Equipment" { kind: "quality.category"; }\n    relation cat_to_effect0 "Possible cause category" @cat0 -> @effect { kind: "quality.cause"; }\n}\n' + FORMAT + 'view bones "Possible causes" {\n    data: [@causes]; format: @f.b;\n    projection { kind: "fishbone"; profile: "fishbone.basic@1"; effect: @causes.effect; relation: "quality.cause"; }\n}\n';
test('add-cause-under-parent: fishbone creation makes object and quality.cause relation in one undo step', () => {
  const ws = D.createWorkspace({ 'fish.ddn': FISH });
  const entry = KINDMAP.kinds.find(k => k.kind === 'quality.cause');
  const made = CMD.applyCreationAction(D, ws, 'fish.ddn', 'bones', { mapEntry: entry, id: 'cause_new', projectionKind: 'fishbone', selectedId: 'ed001.fish::causes.cat0' });
  const ir = ws.resolve('fish.ddn', 'bones');
  assert.ok(ir.elements.some(e => e.id === made.select && e.kind === 'quality.cause'));
  assert.ok(ir.relations.some(r => r.kind === 'quality.cause' && r.from.element === made.select && r.to.element === 'ed001.fish::causes.cat0'));
  assert.ok(ws.renderSync({ entry: 'fish.ddn', view: 'bones' }).svg.includes('<svg'));
  ws.undo();
  assert.strictEqual(ws.getFiles()['fish.ddn'], FISH);
  ws.destroy();
});
test('add-cause-under-parent: no valid parent cancels with coded guidance and no source change', () => {
  const ws = D.createWorkspace({ 'fish.ddn': FISH });
  const entry = KINDMAP.kinds.find(k => k.kind === 'quality.cause');
  assert.throws(() => CMD.applyCreationAction(D, ws, 'fish.ddn', 'bones', { mapEntry: entry, id: 'cause_x', projectionKind: 'fishbone', selectedId: null }), e => e.code === 'DDN-I033');
  assert.strictEqual(ws.getFiles()['fish.ddn'], FISH);
  ws.destroy();
});

// 5. edit-projection-source-not-free-node: chen.attribute adds a field; chen.association enters Connect with assoc preset.
const CHEN = 'ddn "0.5";\nmodule "ed001.chen";\ndata schema {\n    object supplier "Supplier" { kind: entity; fields { field supplier_id { key: primary; } field name; } }\n}\n' + FORMAT + 'view erd "Entities" {\n    data: [@schema]; format: @f.b;\n}\n';
test('chen.attribute: with an entity selected, adds a field on that entity (never a free node)', () => {
  const ws = D.createWorkspace({ 'chen.ddn': CHEN });
  const entry = KINDMAP.kinds.find(k => k.kind === 'chen.attribute');
  const before = ws.resolve('chen.ddn', 'erd').elements.find(e => e.local === 'supplier').fields.length;
  CMD.applyCreationAction(D, ws, 'chen.ddn', 'erd', { mapEntry: entry, id: 'attr_new', projectionKind: 'graph', selectedId: 'ed001.chen::schema.supplier', fieldId: 'established_on' });
  const ir = ws.resolve('chen.ddn', 'erd');
  const supplier = ir.elements.find(e => e.local === 'supplier');
  assert.strictEqual(supplier.fields.length, before + 1);
  assert.ok(supplier.fields.some(f => f.name === 'Attribute'));
  assert.strictEqual(ir.elements.length, 1, 'no free-floating node may be created');
  assert.ok(ws.getFiles()['chen.ddn'].includes('field established_on "Attribute";'));
  ws.destroy();
});
test('chen.attribute/chen.association: invalid context cancels with coded guidance and no source change', () => {
  const ws = D.createWorkspace({ 'chen.ddn': CHEN });
  const attr = KINDMAP.kinds.find(k => k.kind === 'chen.attribute');
  assert.throws(() => CMD.applyCreationAction(D, ws, 'chen.ddn', 'erd', { mapEntry: attr, id: 'attr_x', projectionKind: 'graph', selectedId: null }), e => e.code === 'DDN-I033');
  assert.strictEqual(ws.getFiles()['chen.ddn'], CHEN);
  const assoc = KINDMAP.kinds.find(k => k.kind === 'chen.association');
  const intent = CMD.applyCreationAction(D, ws, 'chen.ddn', 'erd', { mapEntry: assoc, id: 'assoc_1', projectionKind: 'graph', selectedId: 'ed001.chen::schema.supplier' });
  assert.deepStrictEqual(intent, { connect: { from: 'ed001.chen::schema.supplier', preset: 'assoc' } });
  assert.strictEqual(ws.getFiles()['chen.ddn'], CHEN, 'connect intent alone changes no source');
  assert.throws(() => CMD.applyCreationAction(D, ws, 'chen.ddn', 'erd', { mapEntry: assoc, id: 'assoc_2', projectionKind: 'graph', selectedId: null }), e => e.code === 'DDN-I033');
  ws.destroy();
});

// 5b. add-rule-in-decision-editor: definition created; appended to records only in a decision projection.
const RULES = 'ddn "0.5";\nmodule "ed001.rules";\ndata rules {\n    object high "High severity" { kind: "rule.row"; x_rule: { "when": { "severity": { "op": "eq", "value": "high" } }, "then": { "route": "quarantine", "audit": true } }; }\n}\n' + FORMAT + 'view policy "Disposition policy" {\n    data: [@rules]; format: @f.b;\n    projection { kind: "decision"; profile: "decision.rules@1"; records: [@rules.high]; inputs: [{ "key": "severity", "type": "enum", "values": ["low", "high"] }]; outputs: ["route", "audit"]; hit_policy: "first"; coverage: "none"; analysis_budget: 4096; }\n}\n';
test('add-rule-in-decision-editor: rule.row created and appended to decision records in one transaction', () => {
  const ws = D.createWorkspace({ 'rules.ddn': RULES });
  const entry = KINDMAP.kinds.find(k => k.kind === 'rule.row');
  CMD.applyCreationAction(D, ws, 'rules.ddn', 'policy', { mapEntry: entry, id: 'rule_new', projectionKind: 'decision' });
  const src = ws.getFiles()['rules.ddn'];
  assert.ok(src.includes('object rule_new "New Decision rule"'));
  assert.ok(src.includes('kind: "rule.row";'));
  assert.ok(src.includes('x_rule:'));
  assert.ok(src.includes('records: [@rules.high, @editor_data.rule_new];'));
  const ir = ws.resolve('rules.ddn', 'policy');
  assert.ok(ir.elements.some(e => e.local === 'rule_new' && e.kind === 'rule.row'));
  ws.undo();
  assert.strictEqual(ws.getFiles()['rules.ddn'], RULES);
  ws.destroy();
});
test('add-rule-in-decision-editor: in a plain graph view the definition is created without records edits', () => {
  const ws = D.createWorkspace(graphFiles());
  const entry = KINDMAP.kinds.find(k => k.kind === 'rule.row');
  const made = CMD.applyCreationAction(D, ws, 'model.ddn', 'overview', { mapEntry: entry, id: 'rule_g', projectionKind: 'graph' });
  assert.ok(ws.resolve('model.ddn', 'overview').elements.some(e => e.id === made.select && e.kind === 'rule.row'));
  assert.ok(!ws.getFiles()['model.ddn'].includes('records:'));
  ws.destroy();
});

// 6. editProjectionProperty: exact span replacement, neighbors untouched, DDN-D001 on unknown keys.
const CHART = 'ddn "0.5";\nmodule "ed001.chart";\ndata facts { object m1 "Jan" { kind: record; x_record: {month:"Jan",value:4}; } object m2 "Feb" { kind: record; x_record: {month:"Feb",value:5}; } }\n' + FORMAT + 'view chart "Monthly" {\n    data: [@facts]; format: @f.b;\n    projection { kind:chart;profile:"chart.basic@1";records:[@facts.m1, @facts.m2];mark:bar;x:"x_record.month";y:"x_record.value"; }\n}\nview other "Unrelated view" {\n    data: [@facts]; format: @f.b;\n}\n';
test('editProjectionProperty: mark replacement touches only the projection group; unknown key throws DDN-D001', () => {
  const ws = D.createWorkspace({ 'chart.ddn': CHART });
  CMD.editProjectionProperty(D, ws, 'chart.ddn', 'chart', { key: 'mark', value: 'line' });
  const out = ws.getFiles()['chart.ddn'];
  assert.ok(out.includes('mark: "line";'), 'mark replaced');
  assert.ok(!out.includes('mark:bar'), 'old mark gone');
  const following = 'view other "Unrelated view" {\n    data: [@facts]; format: @f.b;\n}\n';
  assert.ok(out.endsWith(following), 'following view block byte-identical');
  assert.ok(out.includes('records:[@facts.m1, @facts.m2];'), 'neighboring key untouched');
  assert.ok(ws.renderSync({ entry: 'chart.ddn', view: 'chart' }).svg.includes('<svg'));
  assert.throws(() => CMD.editProjectionProperty(D, ws, 'chart.ddn', 'chart', { key: 'widths', value: 10 }), e => e.code === 'DDN-D001');
  CMD.editProjectionProperty(D, ws, 'chart.ddn', 'chart', { key: 'records', value: [{ $ref: 'facts.m1' }] });
  assert.ok(ws.getFiles()['chart.ddn'].includes('records: [@facts.m1];'));
  ws.destroy();
});

// 7. Deterministic page and UI-map regeneration.
test('build-standalone.mjs and build-ui-maps.mjs regenerate byte-identical output', () => {
  const root = path.join(__dirname, '..', '..');
  const d1 = fs.mkdtempSync(path.join(os.tmpdir(), 'ed001-a-')), d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ed001-b-'));
  for (const d of [d1, d2]) {
    cp.execFileSync('node', [path.join(root, 'designer/prototype/build-standalone.mjs'), '--out', d], { stdio: 'pipe' });
    cp.execFileSync('node', [path.join(root, 'designer/prototype/build-ui-maps.mjs'), '--out', d], { stdio: 'pipe' });
  }
  for (const f of ['index.html', 'standalone.html', 'kind-ui-map.js', 'relation-ui-map.js']) {
    assert.strictEqual(fs.readFileSync(path.join(d1, f), 'utf8'), fs.readFileSync(path.join(d2, f), 'utf8'), f + ' not deterministic');
    assert.strictEqual(fs.readFileSync(path.join(d1, f), 'utf8'), fs.readFileSync(path.join(root, 'designer/prototype', f), 'utf8'), f + ' differs from committed regeneration');
  }
  const standalone = fs.readFileSync(path.join(d1, 'standalone.html'), 'utf8');
  assert.ok(standalone.includes('Data-Design-Notation ↗'), 'standalone keeps its header link');
  assert.ok((standalone.match(/INLINE:BEGIN/g) || []).length === 5, 'five inline markers');
});

console.log(`ED-001 ${pass}/${pass + fail}`);
if (fail) process.exitCode = 1;
