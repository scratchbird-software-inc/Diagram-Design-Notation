// SPDX-License-Identifier: GPL-2.0-or-later.
// ED-002 behavior suite: matrix (RACI/CRUD/relations) cell editor commands.
// Harness style imitates notation/tests/projections.js. No dependencies.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
const D = require('../../notation/dist/ddn.global.js');
const CMD = require('../prototype/commands.js');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

const ENTRY = 'projections/views.ddn';
function fixtureFiles() {
  const files = {};
  for (const f of ['model.ddn', 'views.ddn', 'formats.ddn'])
    files['projections/' + f] = fs.readFileSync(path.join(__dirname, '..', '..', 'examples', 'projections', f), 'utf8');
  return files;
}
const M = 'meridian.procurement.review::';
const P = { order: M + 'process.order', receive: M + 'process.receive', post: M + 'process.post' };
const R = { buyer: M + 'roles.buyer', manager: M + 'roles.manager', warehouse: M + 'roles.warehouse', controller: M + 'roles.controller' };
function cellMap(plan) {
  const out = {};
  plan.rows.forEach((r, ri) => plan.columns.forEach((c, ci) => { out[r.id + '|' + c.id] = plan.cells[ri][ci]; }));
  return out;
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

// 1. Plan shape and fixture cell values.
test('projectionPlan(raci): 3 rows x 4 columns with the fixture R/A/C placements', () => {
  const ws = D.createWorkspace(fixtureFiles());
  const plan = ws.projectionPlan(ENTRY, 'raci');
  assert.strictEqual(plan.kind, 'matrix');
  assert.strictEqual(plan.profile, 'matrix.raci@1');
  assert.strictEqual(plan.rows.length, 3);
  assert.strictEqual(plan.columns.length, 4);
  const cells = cellMap(plan);
  const val = id => (cells[id] || []).map(a => a.value).join(',');
  assert.strictEqual(val(P.order + '|' + R.buyer), 'R');
  assert.strictEqual(val(P.order + '|' + R.manager), 'A');
  assert.strictEqual(val(P.receive + '|' + R.warehouse), 'R');
  assert.strictEqual(val(P.receive + '|' + R.manager), 'A');
  assert.strictEqual(val(P.post + '|' + R.buyer), 'R');
  assert.strictEqual(val(P.post + '|' + R.warehouse), 'C');
  assert.strictEqual(val(P.post + '|' + R.controller), 'A');
  assert.strictEqual(val(P.order + '|' + R.warehouse), '');
  assert.strictEqual(val(P.order + '|' + R.controller), '');
  assert.strictEqual(val(P.receive + '|' + R.buyer), '');
  assert.strictEqual(val(P.receive + '|' + R.controller), '');
  assert.strictEqual(val(P.post + '|' + R.manager), '');
  ws.destroy();
});

// 2. VE-AC-049: click empty (order, warehouse), add C; graph view shows the new assignment; one undo restores exact bytes.
test('VE-AC-049: empty-cell assignment round-trips to source and the responsibility graph; undo restores exact bytes', () => {
  const files = fixtureFiles(), before = { ...files };
  const ws = D.createWorkspace(files);
  CMD.setMatrixAssignments(D, ws, ENTRY, 'raci', { changes: [{ rowId: P.order, columnId: R.warehouse, value: 'C', id: 'order_warehouse_c' }] });
  const cells = cellMap(ws.projectionPlan(ENTRY, 'raci'));
  assert.strictEqual(cells[P.order + '|' + R.warehouse][0].value, 'C');
  const newId = M + 'process.order_warehouse_c';
  assert.strictEqual(cells[P.order + '|' + R.warehouse][0].id, newId);
  const graph = ws.resolve(ENTRY, 'responsibility_graph');
  assert.ok(graph.relations.some(r => r.id === newId), 'new assignment missing from responsibility_graph');
  assert.ok(/relation order_warehouse_c "Matrix assignment" @process\.order -> @roles\.warehouse \{ kind: "analysis\.assignment"; x_assignment: \{ "code": "C" \}; \}/.test(ws.getFiles()['projections/model.ddn']), 'new assignment source not written into the shared data block');
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before);
  ws.destroy();
});

// 3. Change path: (post, warehouse) C -> I touches only the x_assignment span.
test('change path: C to I on an existing assignment rewrites only the x_assignment property span', () => {
  const files = fixtureFiles(), before = files['projections/model.ddn'];
  const ws = D.createWorkspace(files);
  CMD.setMatrixAssignments(D, ws, ENTRY, 'raci', { changes: [{ rowId: P.post, columnId: R.warehouse, value: 'I' }] });
  const after = ws.getFiles()['projections/model.ddn'];
  assert.notStrictEqual(after, before);
  const d = diffSpan(before, after);
  const block = blockSpan(before, 'relation post_c');
  assert.ok(d.s >= block.start && d.ea <= block.end, 'edit escaped the post_c relation block');
  assert.ok(!before.slice(d.s, d.ea).includes('relation'), 'changed span crosses a relation boundary');
  assert.ok(after.slice(block.start, block.end + 24).includes('"code": "I"'), 'new value not written into post_c');
  const cells = cellMap(ws.projectionPlan(ENTRY, 'raci'));
  assert.strictEqual(cells[P.post + '|' + R.warehouse][0].value, 'I');
  const others = { ...ws.getFiles() }; delete others['projections/model.ddn'];
  assert.deepStrictEqual(others, (({ 'projections/model.ddn': _, ...rest }) => rest)(fixtureFiles()));
  ws.destroy();
});

// 4. Remove path: remove:true on (post, warehouse) deletes the relation block; undo restores it byte-exactly.
test('remove path: remove:true deletes the relation block; undo restores it byte-exactly', () => {
  const files = fixtureFiles(), before = { ...files };
  const ws = D.createWorkspace(files);
  CMD.setMatrixAssignments(D, ws, ENTRY, 'raci', { changes: [{ rowId: P.post, columnId: R.warehouse, remove: true }] });
  const after = ws.getFiles()['projections/model.ddn'];
  assert.ok(!after.includes('relation post_c'), 'relation block survived removal');
  const cells = cellMap(ws.projectionPlan(ENTRY, 'raci'));
  assert.strictEqual((cells[P.post + '|' + R.warehouse] || []).length, 0);
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before);
  ws.destroy();
});

// 5. VE-AC-050: batch move of A is one undo entry; a wrongly ordered split commits an invalid RACI row and is rejected.
test('VE-AC-050: moving A between roles is one atomic transaction; invalid intermediate states never commit', () => {
  const files = fixtureFiles(), before = { ...files };
  const ws = D.createWorkspace(files);
  CMD.setMatrixAssignments(D, ws, ENTRY, 'raci', {
    changes: [
      { rowId: P.post, columnId: R.controller, remove: true },
      { rowId: P.post, columnId: R.warehouse, value: 'A' },
    ],
  });
  let cells = cellMap(ws.projectionPlan(ENTRY, 'raci'));
  assert.strictEqual(cells[P.post + '|' + R.warehouse][0].value, 'A');
  assert.strictEqual((cells[P.post + '|' + R.controller] || []).length, 0);
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before, 'one undo did not restore the whole batch');
  // Wrongly ordered split: removing the only A first must throw DDN-PJ016 and leave source untouched.
  const ws2 = D.createWorkspace(fixtureFiles()), before2 = ws2.getFiles();
  assert.throws(
    () => CMD.setMatrixAssignments(D, ws2, ENTRY, 'raci', { changes: [{ rowId: P.post, columnId: R.controller, remove: true }] }),
    e => e.code === 'DDN-PJ016');
  assert.deepStrictEqual(ws2.getFiles(), before2, 'rejected intermediate commit left edits behind');
  ws.destroy(); ws2.destroy();
});

// 6. Negatives: alphabet pre-check, duplicate cell, out-of-matrix cell, joined cell.
test('negatives: illegal letter pre-check, duplicate cell, outside cell, joined cell all refuse', () => {
  const ws = D.createWorkspace(fixtureFiles()), before = ws.getFiles();
  assert.throws(
    () => CMD.setMatrixAssignments(D, ws, ENTRY, 'raci', { changes: [{ rowId: P.order, columnId: R.warehouse, value: 'X' }] }),
    e => e.code === 'DDN-I033');
  assert.throws(
    () => CMD.setMatrixAssignments(D, ws, ENTRY, 'raci', { changes: [{ rowId: P.order, columnId: R.warehouse, value: 'C' }, { rowId: P.order, columnId: R.warehouse, value: 'I' }] }),
    e => e.code === 'DDN-E007');
  assert.throws(
    () => CMD.setMatrixAssignments(D, ws, ENTRY, 'raci', { changes: [{ rowId: P.order, columnId: M + 'schema.po', value: 'C' }] }),
    e => e.code === 'DDN-E007');
  assert.deepStrictEqual(ws.getFiles(), before, 'refused edits left changes behind');
  ws.destroy();
  // Joined cell: a second assignment for (order, buyer) in a matrix.relations@1
  // view with duplicates:"join" makes the cell non-single-editable.
  const files = fixtureFiles();
  files['projections/model.ddn'] = files['projections/model.ddn'].replace(
    'relation order_r "Prepare order"',
    'relation order_r2 "Liaison" @process.order -> @roles.buyer { kind: "analysis.assignment"; x_assignment: {code:"C"}; }\n    relation order_r "Prepare order"');
  files['projections/views.ddn'] = files['projections/views.ddn'].replace(
    'relation:"analysis.assignment";value:"name";',
    'relation:"analysis.assignment";value:"x_assignment.code";duplicates:"join";');
  const ws2 = D.createWorkspace(files);
  assert.throws(
    () => CMD.setMatrixAssignments(D, ws2, ENTRY, 'matrix_general', { changes: [{ rowId: P.order, columnId: R.buyer, value: 'I' }] }),
    e => e.code === 'DDN-E007' && /joined cell is not a single editable assignment/.test(e.message));
  ws2.destroy();
});

// 7. Round-trip: comments and the flowchart view block stay byte-identical through live edits.
test('round-trip: fixture comments and the flowchart view block are byte-identical after edits', () => {
  const files = fixtureFiles();
  const modelBefore = files['projections/model.ddn'], viewsBefore = files['projections/views.ddn'];
  const flowchart = blockSpan(viewsBefore, 'view flowchart');
  const flowchartText = viewsBefore.slice(flowchart.start, flowchart.end);
  const comments = modelBefore.split('\n').filter(l => l.trim().startsWith('//'));
  assert.ok(comments.length > 0, 'fixture has no comments to protect');
  const ws = D.createWorkspace(files);
  CMD.setMatrixAssignments(D, ws, ENTRY, 'raci', { changes: [{ rowId: P.order, columnId: R.warehouse, value: 'C', id: 'rt_cell' }] });
  CMD.setMatrixAssignments(D, ws, ENTRY, 'raci', { changes: [{ rowId: P.post, columnId: R.warehouse, value: 'I' }] });
  const viewsAfter = ws.getFiles()['projections/views.ddn'];
  assert.strictEqual(viewsAfter, viewsBefore, 'views.ddn changed by matrix edits');
  const modelAfter = ws.getFiles()['projections/model.ddn'];
  for (const c of comments) assert.ok(modelAfter.includes(c), 'comment lost: ' + c);
  assert.ok(viewsAfter.includes(flowchartText), 'flowchart view block altered');
  ws.undo(); ws.undo();
  assert.deepStrictEqual(ws.getFiles(), fixtureFiles());
  ws.destroy();
});

// 8. Determinism: two fresh workspaces + the same batch produce identical files.
test('determinism: identical batch on two fresh workspaces yields identical files', () => {
  const batch = {
    changes: [
      { rowId: P.post, columnId: R.controller, remove: true },
      { rowId: P.post, columnId: R.warehouse, value: 'A' },
      { rowId: P.order, columnId: R.warehouse, value: 'C', id: 'det_cell' },
    ],
  };
  const run = () => { const ws = D.createWorkspace(fixtureFiles()); CMD.setMatrixAssignments(D, ws, ENTRY, 'raci', batch); const out = ws.getFiles(); ws.destroy(); return out; };
  assert.deepStrictEqual(run(), run());
});

console.log('ED-002 ' + pass + '/' + (pass + fail));
if (fail) process.exitCode = 1;
