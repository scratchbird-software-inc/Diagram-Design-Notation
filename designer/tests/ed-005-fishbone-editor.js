// SPDX-License-Identifier: GPL-2.0-or-later.
// ED-005 behavior suite: fishbone editor commands (effect/category/cause editing,
// attach-existing-cause reuse with distinct occurrence paths).
// Harness style imitates notation/tests/projections.js. No dependencies.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const D = require('../../notation/dist/ddn.global.js');
const CMD = require('../prototype/commands.js');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

const ENTRY = 'examples/quality/views.ddn', VIEW = 'fishbone';
const M = 'meridian.quality.review::';
const EFFECT = M + 'causes.effect', CAT0 = M + 'causes.cat0', CAT1 = M + 'causes.cat1';
const CAL = M + 'causes.calibration';
function fixtureFiles() {
  const files = {};
  for (const f of ['model.ddn', 'views.ddn', 'formats.ddn', 'details.ddn'])
    files['examples/quality/' + f] = fs.readFileSync(path.join(__dirname, '..', '..', 'website', 'examples', 'quality', f), 'utf8');
  return files;
}
function diffSpan(a, b) {
  let s = 0; while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let ea = a.length, eb = b.length;
  while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
  return { s, ea, eb };
}
function blockSpan(text, marker) {
  const start = text.indexOf(marker);
  assert.ok(start >= 0, 'marker not found: ' + marker);
  let depth = 0, end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}') { depth--; if (!depth) { end = i + 1; break; } }
  }
  assert.ok(end > start, 'block not closed: ' + marker);
  return { start, end };
}
function occurrenceMap(plan) {
  const m = new Map();
  (function walk(n) {
    const id = n.node && n.node.id;
    if (id) { if (!m.has(id)) m.set(id, []); m.get(id).push(n.occurrence); }
    for (const c of n.children || []) walk(c);
  })({ node: { id: plan.effect.id }, occurrence: plan.effect.id, children: plan.categories });
  return m;
}

// 1. Baseline plan: effect + 6 categories; every node's occurrence is a /-joined
//    path ending at the node id (mirrors ddn-quality-data.js branch()).
test('baseline plan: effect and 6 categories; every occurrence string is a /-joined path ending at the node id', () => {
  const ws = D.createWorkspace(fixtureFiles());
  const plan = ws.projectionPlan(ENTRY, VIEW);
  assert.strictEqual(plan.effect.id, EFFECT);
  assert.strictEqual(plan.categories.length, 6);
  let nodes = 0;
  (function walk(n, path) {
    nodes++;
    const expected = [...path, n.node.id].join('/');
    assert.strictEqual(n.occurrence, expected, 'occurrence path mismatch at ' + n.node.id);
    assert.ok(n.occurrence.endsWith('/' + n.node.id) || n.occurrence === n.node.id, 'occurrence does not end at the node id');
    for (const c of n.children || []) walk(c, [...path, n.node.id]);
  })({ node: { id: plan.effect.id }, occurrence: plan.effect.id, children: plan.categories }, []);
  assert.ok(nodes >= 20, 'walk did not visit the whole rib tree');
  // The fixture already reuses calibration on two branches.
  const occ = occurrenceMap(plan).get(CAL);
  assert.strictEqual(occ.length, 2, 'fixture calibration should already appear twice');
  assert.ok(occ[0] !== occ[1], 'reused cause shares an occurrence path');
  ws.destroy();
});

// 2. Add category: one quality.category object + one relation to the effect in a
//    single undo step; re-plan shows the new first-level rib.
test('add category: one object and one relation in a single undo step; re-plan shows the 7th first-level rib', () => {
  const ws = D.createWorkspace(fixtureFiles()), before = ws.getFiles();
  const made = CMD.addFishboneCategory(D, ws, ENTRY, VIEW, { id: 'cat6', label: 'Machines' });
  const plan = ws.projectionPlan(ENTRY, VIEW);
  assert.strictEqual(plan.categories.length, 7);
  const rib = plan.categories.find(c => c.node.id === made.select);
  assert.ok(rib, 'new category rib not in the re-planned tree');
  assert.strictEqual(rib.node.kind, 'quality.category');
  assert.strictEqual(rib.occurrence, EFFECT + '/' + made.select);
  const rel = ws.resolve(ENTRY, VIEW).relations.find(r => r.id === rib.relationId);
  assert.strictEqual(rel.kind, 'quality.cause', 'rib does not use the view’s named cause verb');
  assert.strictEqual(rel.to.element, EFFECT);
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before, 'one undo did not remove object and relation');
  ws.destroy();
});

// 3. Add cause under a category and under another cause (depth 2); re-plan shows
//    both; source diff of the second add touches only the editor_data block.
test('add cause: under a category and under another cause (depth 2); re-plan shows both; diff confined to the editor_data block', () => {
  const ws = D.createWorkspace(fixtureFiles());
  const cat = CMD.addFishboneCategory(D, ws, ENTRY, VIEW, { id: 'cat6', label: 'Machines' });
  CMD.addFishboneCause(D, ws, ENTRY, VIEW, { id: 'dust', label: 'Airborne dust', parentId: cat.select });
  const before2 = ws.getFiles()['examples/quality/views.ddn'];
  const dust = ws.resolve(ENTRY, VIEW).elements.find(e => e.local === 'dust');
  CMD.addFishboneCause(D, ws, ENTRY, VIEW, { id: 'filters', label: 'Clogged filters', parentId: dust.id });
  const plan = ws.projectionPlan(ENTRY, VIEW);
  const occ = occurrenceMap(plan);
  assert.deepStrictEqual(occ.get(dust.id).length, 1);
  const filters = ws.resolve(ENTRY, VIEW).elements.find(e => e.local === 'filters');
  assert.deepStrictEqual(occ.get(filters.id), [EFFECT + '/' + cat.select + '/' + dust.id + '/' + filters.id], 'depth-2 cause occurrence path wrong');
  const after2 = ws.getFiles()['examples/quality/views.ddn'];
  const d = diffSpan(before2, after2);
  const block = blockSpan(after2, 'data editor_data');
  assert.ok(d.s >= block.start && d.s <= block.end, 'second cause edit escaped the editor_data block');
  const files = ws.getFiles(), base = fixtureFiles();
  assert.strictEqual(files['examples/quality/model.ddn'], base['examples/quality/model.ddn'], 'shared model edited by a fishbone add');
  assert.strictEqual(files['examples/quality/details.ddn'], base['examples/quality/details.ddn']);
  assert.strictEqual(files['examples/quality/formats.ddn'], base['examples/quality/formats.ddn']);
  ws.destroy();
});

// 4. VE-AC-057 reuse: attachExistingCause attaches the existing calibration cause
//    under a second (new) parent; the re-planned tree holds the same node id at
//    one more distinct occurrence path, exactly one new relation in source, and
//    no new object (element count delta 0).
test('VE-AC-057 reuse: attachExistingCause gives calibration one more distinct occurrence; zero new objects, exactly one new relation', () => {
  const ws = D.createWorkspace(fixtureFiles()), before = ws.getFiles();
  const occBefore = occurrenceMap(ws.projectionPlan(ENTRY, VIEW)).get(CAL);
  const countObjects = text => (text.match(/\bobject\s+/g) || []).length;
  const countRelations = text => (text.match(/\brelation\s+/g) || []).length;
  const modelBefore = before['examples/quality/model.ddn'], viewsBefore = before['examples/quality/views.ddn'];
  const objsBefore = countObjects(modelBefore) + countObjects(viewsBefore);
  const relsBefore = countRelations(modelBefore) + countRelations(viewsBefore);
  CMD.attachExistingCause(D, ws, ENTRY, VIEW, { causeId: CAL, parentId: CAT1, relationId: 'calibration_materials' });
  const plan = ws.projectionPlan(ENTRY, VIEW);
  const occAfter = occurrenceMap(plan).get(CAL);
  assert.strictEqual(occAfter.length, occBefore.length + 1, 'no new occurrence path for the reused cause');
  assert.strictEqual(new Set(occAfter).size, occAfter.length, 'occurrence paths are not distinct');
  assert.ok(occAfter.some(o => o === EFFECT + '/' + CAT1 + '/' + CAL), 'new occurrence not under the second parent');
  const files = ws.getFiles();
  const objsAfter = countObjects(files['examples/quality/model.ddn']) + countObjects(files['examples/quality/views.ddn']);
  const relsAfter = countRelations(files['examples/quality/model.ddn']) + countRelations(files['examples/quality/views.ddn']);
  assert.strictEqual(objsAfter - objsBefore, 0, 'attach created an object — reuse must never clone the definition');
  assert.strictEqual(relsAfter - relsBefore, 1, 'attach must create exactly one relation');
  assert.ok(files['examples/quality/views.ddn'].includes('@m.causes.calibration -> @m.causes.cat1'), 'new rib does not bind the same cause id to the second branch');
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before);
  ws.destroy();
});

// 5. Negatives: cause directly under the effect rejects via scratch re-plan with
//    DDN-QF001; a 13th category rejects before commit (DDN-QF003 cap); a
//    fabricated cycle (category attached under its own descendant) raises
//    DDN-QF002. Real workspace revision unchanged each time.
test('negatives: direct-under-effect DDN-QF001; 13th category DDN-QF003; category-under-descendant cycle DDN-QF002; workspace untouched', () => {
  const ws = D.createWorkspace(fixtureFiles());
  const check = fn => {
    const before = ws.getFiles(), rev = ws.revision;
    let code = null;
    try { fn(); } catch (e) { code = e.code; }
    assert.ok(code, 'command did not reject');
    assert.strictEqual(ws.revision, rev, 'rejected command changed the workspace revision');
    assert.deepStrictEqual(ws.getFiles(), before, 'rejected command left partial writes');
    return code;
  };
  assert.strictEqual(check(() => CMD.addFishboneCause(D, ws, ENTRY, VIEW, { id: 'bad_direct', parentId: EFFECT })), 'DDN-QF001');
  assert.strictEqual(check(() => CMD.attachExistingCause(D, ws, ENTRY, VIEW, { causeId: CAT0, parentId: CAL, relationId: 'fabricated_cycle' })), 'DDN-QF002');
  // Depth cap: effect(0) > category(1) > cause(2..4) is the limit; the fifth
  // nested cause exceeds 4 cause levels (DDN-QF003).
  CMD.addFishboneCause(D, ws, ENTRY, VIEW, { id: 'chain1', parentId: CAT0 });
  for (const n of [2, 3]) CMD.addFishboneCause(D, ws, ENTRY, VIEW, { id: 'chain' + n, parentId: ws.resolve(ENTRY, VIEW).elements.find(e => e.local === 'chain' + (n - 1)).id });
  const chain3 = ws.resolve(ENTRY, VIEW).elements.find(e => e.local === 'chain3').id;
  assert.strictEqual(check(() => CMD.addFishboneCause(D, ws, ENTRY, VIEW, { id: 'chain4', parentId: chain3 })), 'DDN-QF003');
  ws.destroy();
  // Category cap on a fresh workspace: 6 fixture categories + 6 added = 12; the 13th rejects.
  const ws2 = D.createWorkspace(fixtureFiles());
  for (let i = 6; i < 12; i++) CMD.addFishboneCategory(D, ws2, ENTRY, VIEW, { id: 'cap' + i, label: 'Cap ' + i });
  assert.strictEqual(ws2.projectionPlan(ENTRY, VIEW).categories.length, 12);
  const before = ws2.getFiles(), rev = ws2.revision;
  assert.throws(() => CMD.addFishboneCategory(D, ws2, ENTRY, VIEW, { id: 'cap13', label: 'Thirteenth' }), e => e.code === 'DDN-QF003');
  assert.strictEqual(ws2.revision, rev, 'rejected 13th category changed the workspace');
  assert.deepStrictEqual(ws2.getFiles(), before);
  ws2.destroy();
});

// 6. Remove rib: removeFishboneCause deletes only the relation; the cause object
//    and its other occurrence still resolve; undo restores exact bytes.
test('remove rib: only the relation is deleted; the cause object and its other occurrence still resolve; undo restores exact bytes', () => {
  const ws = D.createWorkspace(fixtureFiles()), before = ws.getFiles();
  const ribId = M + 'causes.c_calibration';
  CMD.removeFishboneCause(D, ws, ENTRY, VIEW, { relationId: ribId });
  const ir = ws.resolve(ENTRY, VIEW);
  const cause = ir.elements.find(e => e.id === CAL);
  assert.ok(cause, 'cause definition deleted with its rib');
  assert.ok(!ws.getFiles()['examples/quality/model.ddn'].includes('relation c_calibration'), 'relation still in source');
  assert.ok(ws.getFiles()['examples/quality/model.ddn'].includes('object calibration'), 'cause object removed from source');
  const occ = occurrenceMap(ws.projectionPlan(ENTRY, VIEW)).get(CAL);
  assert.deepStrictEqual(occ, [EFFECT + '/' + M + 'causes.cat3' + '/' + CAL], 'second occurrence no longer resolves');
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before, 'undo did not restore exact bytes');
  ws.destroy();
});

// 7. Effect rename: setFishboneEffectLabel edits only the label token; the
//    effect: @m.causes.effect binding and all ribs are byte-identical.
test('effect rename: only the label token changes; the effect binding and every rib stay byte-identical', () => {
  const files = fixtureFiles();
  const modelBefore = files['examples/quality/model.ddn'], viewsBefore = files['examples/quality/views.ddn'];
  const ws = D.createWorkspace(files);
  CMD.setFishboneEffectLabel(D, ws, ENTRY, VIEW, { label: 'Dimensional inspection escapes' });
  const after = ws.getFiles();
  assert.strictEqual(after['examples/quality/views.ddn'], viewsBefore, 'rename touched the views file (effect binding must stay byte-identical)');
  const modelAfter = after['examples/quality/model.ddn'];
  const d = diffSpan(modelBefore, modelAfter);
  const block = blockSpan(modelBefore, 'object effect');
  assert.ok(d.s >= block.start && d.ea <= block.end, 'rename escaped the effect object block');
  assert.ok(modelAfter.includes('object effect "Dimensional inspection escapes"'), 'new label not written');
  const ribsBefore = (modelBefore.match(/\brelation\s+\w+/g) || []).join('\n');
  const ribsAfter = (modelAfter.match(/\brelation\s+\w+/g) || []).join('\n');
  assert.strictEqual(ribsAfter, ribsBefore, 'a rib changed during an effect rename');
  ws.undo();
  assert.strictEqual(ws.getFiles()['examples/quality/model.ddn'], modelBefore);
  ws.destroy();
});

// 8. Round-trip: fixture comments and unrelated views byte-identical after all
//    edits; CLI check passes on the edited files; edited copy written to /tmp for
//    the step-6 CLI render proof.
test('round-trip: comments and unrelated views byte-identical after all edits; CLI check passes', () => {
  const files = fixtureFiles();
  const modelBefore = files['examples/quality/model.ddn'], viewsBefore = files['examples/quality/views.ddn'];
  const comments = [...modelBefore.split('\n'), ...viewsBefore.split('\n')].filter(l => l.trim().startsWith('//'));
  assert.ok(comments.length > 0, 'fixture has no comments to protect');
  const ws = D.createWorkspace(files);
  const cat = CMD.addFishboneCategory(D, ws, ENTRY, VIEW, { id: 'cat6', label: 'Machines' });
  CMD.addFishboneCause(D, ws, ENTRY, VIEW, { id: 'dust', label: 'Airborne dust', parentId: cat.select });
  CMD.attachExistingCause(D, ws, ENTRY, VIEW, { causeId: CAL, parentId: cat.select, relationId: 'calibration_machines' });
  CMD.setFishboneEffectLabel(D, ws, ENTRY, VIEW, { label: 'Dimensional inspection escapes' });
  const modelAfter = ws.getFiles()['examples/quality/model.ddn'], viewsAfter = ws.getFiles()['examples/quality/views.ddn'];
  for (const c of comments) assert.ok(modelAfter.includes(c) || viewsAfter.includes(c), 'comment lost: ' + c);
  for (const v of ['fishbone_sketch', 'heat_numeric', 'heat_bands', 'raci', 'crud']) {
    const b0 = blockSpan(viewsBefore, 'view ' + v + ' '), b1 = blockSpan(viewsAfter, 'view ' + v + ' ');
    assert.strictEqual(viewsAfter.slice(b1.start, b1.end), viewsBefore.slice(b0.start, b0.end), 'unrelated view block altered: ' + v);
  }
  const tmp = '/tmp/ed-005-workspace';
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(path.join(tmp, 'examples', 'quality'), { recursive: true });
  for (const [f, text] of Object.entries(ws.getFiles())) fs.writeFileSync(path.join(tmp, f), text);
  const cli = path.join(__dirname, '..', '..', 'notation', 'cli', 'cli.js');
  const out = cp.spawnSync(process.execPath, [cli, 'check', path.join(tmp, ENTRY), '--workspace', tmp], { encoding: 'utf8' });
  assert.strictEqual(out.status, 0, 'CLI check failed: ' + out.stdout + out.stderr);
  ws.destroy();
});

// 9. Determinism: the same command sequence on two fresh workspaces yields
//    identical files.
test('determinism: identical command sequence on two fresh workspaces yields identical files', () => {
  const run = () => {
    const ws = D.createWorkspace(fixtureFiles());
    const cat = CMD.addFishboneCategory(D, ws, ENTRY, VIEW, { id: 'cat6', label: 'Machines' });
    CMD.addFishboneCause(D, ws, ENTRY, VIEW, { id: 'dust', label: 'Airborne dust', parentId: cat.select });
    CMD.attachExistingCause(D, ws, ENTRY, VIEW, { causeId: CAL, parentId: cat.select, relationId: 'calibration_machines' });
    CMD.setFishboneEffectLabel(D, ws, ENTRY, VIEW, { label: 'Dimensional inspection escapes' });
    const out = ws.getFiles();
    ws.destroy();
    return out;
  };
  assert.deepStrictEqual(run(), run());
});

console.log('ED-005 ' + pass + '/' + (pass + fail));
if (fail) process.exitCode = 1;
