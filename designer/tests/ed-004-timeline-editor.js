// SPDX-License-Identifier: GPL-2.0-or-later.
// ED-004 behavior suite: timeline editor commands (records, dates, dependencies).
// Harness style imitates notation/tests/projections.js. No dependencies.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const D = require('../../notation/dist/ddn.global.js');
const CMD = require('../prototype/commands.js');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

const ENTRY = 'projections/views.ddn', VIEW = 'gantt';
const M = 'meridian.procurement.review::';
const ORDER = M + 'process.order', RECEIVE = M + 'process.receive', POST = M + 'process.post';
const OBR = M + 'schedule.order_before_receive';
function fixtureFiles() {
  const files = {};
  for (const f of ['model.ddn', 'views.ddn', 'formats.ddn'])
    files['projections/' + f] = fs.readFileSync(path.join(__dirname, '..', '..', 'examples', 'projections', f), 'utf8');
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

// 1. Baseline plan: 3 items in record order, 2 dependencies, fixture dates.
test('baseline plan: 3 items in record order and 2 dependencies; first item start/end match the fixture', () => {
  const ws = D.createWorkspace(fixtureFiles());
  const plan = ws.projectionPlan(ENTRY, VIEW);
  assert.deepStrictEqual(plan.items.map(i => i.id), [ORDER, RECEIVE, POST]);
  assert.strictEqual(plan.dependencies.length, 2);
  assert.strictEqual(plan.items[0].start, '2026-01-05');
  assert.strictEqual(plan.items[0].end, '2026-01-07');
  assert.deepStrictEqual(plan.dependencies.map(r => r.id), [OBR, M + 'schedule.receive_before_post']);
  ws.destroy();
});

// 2. VE-AC-054: date edit moves receive start; axis is a function of data; no place/at anywhere.
test('VE-AC-054 date edit: receive start 2026-01-08 -> 2026-01-09 rewrites only its x_record span; no place/@ source exists', () => {
  const files = fixtureFiles(), before = { ...files };
  const ws = D.createWorkspace(files);
  const modelBefore = files['projections/model.ddn'];
  const aBefore = ws.projectionPlan(ENTRY, VIEW).items[1].a;
  CMD.setTimelineDates(D, ws, ENTRY, VIEW, { recordId: RECEIVE, start: '2026-01-09' });
  const item = ws.projectionPlan(ENTRY, VIEW).items[1];
  assert.strictEqual(item.start, '2026-01-09');
  assert.ok(item.a > aBefore, 'axis position (a) did not move with the data');
  const modelAfter = ws.getFiles()['projections/model.ddn'];
  const d = diffSpan(modelBefore, modelAfter);
  const block = blockSpan(modelBefore, 'object receive');
  assert.ok(d.s >= block.start && d.ea <= block.end, 'edit escaped the receive record block');
  assert.ok(modelAfter.slice(block.start, block.end).includes('"2026-01-09"'), 'new start not written into receive');
  const others = { ...ws.getFiles() }; delete others['projections/model.ddn'];
  const rest = fixtureFiles(); delete rest['projections/model.ddn'];
  assert.deepStrictEqual(others, rest, 'edit touched a second file');
  for (const f of Object.values(ws.getFiles())) assert.ok(!f.includes('place @'), 'a pin (place @) appeared in source');
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before);
  ws.destroy();
});

// 3. Equal dates are a legal milestone: start == end on post renders a diamond, plan reports a === b.
test('equal dates legal: start == end on post is a milestone; re-render succeeds and plan reports a === b', () => {
  const ws = D.createWorkspace(fixtureFiles());
  CMD.setTimelineDates(D, ws, ENTRY, VIEW, { recordId: POST, start: '2026-01-13', end: '2026-01-13' });
  const item = ws.projectionPlan(ENTRY, VIEW).items[2];
  assert.strictEqual(item.a, item.b, 'milestone does not report a === b');
  const svg = ws.renderSync({ entry: ENTRY, view: VIEW }).svg;
  assert.ok(svg.includes('<path'), 'milestone diamond path missing from the render');
  ws.undo();
  assert.strictEqual(ws.projectionPlan(ENTRY, VIEW).items[2].end, '2026-01-16');
  ws.destroy();
});

// 4. Negatives: end < start and malformed dates reject; forced writes surface runtime DDN-PJ040; revision unchanged.
test('negative dates: end < start and malformed date rejected by the command; forced helper write raises DDN-PJ040', () => {
  const ws = D.createWorkspace(fixtureFiles()), before = ws.getFiles(), rev = ws.revision;
  assert.throws(() => CMD.setTimelineDates(D, ws, ENTRY, VIEW, { recordId: RECEIVE, start: '2026-01-12', end: '2026-01-08' }), e => e.code === 'DDN-I033');
  assert.throws(() => CMD.setTimelineDates(D, ws, ENTRY, VIEW, { recordId: RECEIVE, start: '2026-13-01' }), e => e.code === 'DDN-I033');
  assert.strictEqual(ws.revision, rev, 'rejected commands changed the workspace revision');
  assert.deepStrictEqual(ws.getFiles(), before, 'rejected commands left partial writes');
  // Forced through the raw helper, commit-time validation raises the runtime code.
  assert.throws(() => D.authoring.setRecordValue(ws, ENTRY, VIEW, RECEIVE, 'start', '2026-01-20'), e => e.code === 'DDN-PJ040');
  assert.throws(() => D.authoring.setRecordValue(ws, ENTRY, VIEW, RECEIVE, 'start', '2026-13-01'), e => e.code === 'DDN-PJ040');
  assert.strictEqual(ws.revision, rev, 'forced invalid write changed the workspace revision');
  assert.deepStrictEqual(ws.getFiles(), before);
  ws.destroy();
});

// 5. Dependency link: order -> post creates one analysis.precedes relation; one undo removes both.
test('dependency link: order -> post appends one analysis.precedes relation; re-plan shows 3 dependencies; one undo restores', () => {
  const ws = D.createWorkspace(fixtureFiles()), before = ws.getFiles();
  CMD.linkTimelineDependency(D, ws, ENTRY, VIEW, { id: 'order_before_post', label: 'Order precedes posting', fromId: ORDER, toId: POST });
  const plan = ws.projectionPlan(ENTRY, VIEW);
  assert.strictEqual(plan.dependencies.length, 3);
  const made = plan.dependencies.find(r => r.from.element === ORDER && r.to.element === POST);
  assert.ok(made, 'new dependency not in the plan');
  assert.strictEqual(made.kind, 'analysis.precedes');
  const rel = ws.resolve(ENTRY, VIEW).relations.find(r => r.id === made.id);
  assert.ok(rel, 'relation missing from the resolved view');
  ws.undo();
  assert.strictEqual(ws.projectionPlan(ENTRY, VIEW).dependencies.length, 2, 'binding survived undo');
  assert.deepStrictEqual(ws.getFiles(), before, 'one undo did not remove relation and binding');
  ws.destroy();
});

// 6. Negative dependencies: contradiction raises DDN-PJ042; a synthetic two-link cycle raises DDN-PJ043.
test('negative dependency: post -> order contradicts dates (DDN-PJ042); same-day milestone two-link cycle raises DDN-PJ043', () => {
  const ws = D.createWorkspace(fixtureFiles()), before = ws.getFiles(), rev = ws.revision;
  assert.throws(() => CMD.linkTimelineDependency(D, ws, ENTRY, VIEW, { id: 'post_before_order', label: 'x', fromId: POST, toId: ORDER }), e => e.code === 'DDN-PJ042');
  assert.strictEqual(ws.revision, rev, 'rejected link changed the workspace revision');
  assert.deepStrictEqual(ws.getFiles(), before);
  // Cycle without a date contradiction: two zero-length milestones on the same day.
  CMD.setTimelineDates(D, ws, ENTRY, VIEW, { recordId: ORDER, start: '2026-01-08', end: '2026-01-08' });
  CMD.setTimelineDates(D, ws, ENTRY, VIEW, { recordId: RECEIVE, start: '2026-01-08', end: '2026-01-08' });
  assert.throws(() => CMD.linkTimelineDependency(D, ws, ENTRY, VIEW, { id: 'receive_before_order', label: 'x', fromId: RECEIVE, toId: ORDER }), e => e.code === 'DDN-PJ043');
  assert.strictEqual(ws.projectionPlan(ENTRY, VIEW).dependencies.length, 2, 'rejected cycle link committed');
  ws.destroy();
});

// 7. Unlink keeps the relation: view reference removed; relation still resolves and stays in source.
test('unlink keeps relation: the view reference is removed; the shared relation still resolves and renders nowhere else', () => {
  const ws = D.createWorkspace(fixtureFiles()), before = ws.getFiles();
  CMD.unlinkTimelineDependency(D, ws, ENTRY, VIEW, { relationId: OBR });
  assert.strictEqual(ws.projectionPlan(ENTRY, VIEW).dependencies.length, 1);
  const rel = ws.resolve(ENTRY, VIEW).relations.find(r => r.id === OBR);
  assert.ok(rel, 'shared relation vanished from the resolved view');
  assert.strictEqual(rel.kind, 'analysis.precedes');
  assert.ok(ws.getFiles()['projections/model.ddn'].includes('relation order_before_receive'), 'relation definition removed from source');
  // The relation is not selected by any sibling view; the model still resolves everywhere.
  for (const v of ['flowchart', 'responsibility_graph', 'raci', 'schedule_table']) ws.resolve(ENTRY, v);
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before);
  ws.destroy();
});

// 8. Round-trip: comments and non-gantt view blocks byte-identical; CLI check passes on the edited files.
test('round-trip: fixture comments and non-gantt view blocks byte-identical after edits; CLI check passes', () => {
  const files = fixtureFiles();
  const modelBefore = files['projections/model.ddn'], viewsBefore = files['projections/views.ddn'];
  const comments = modelBefore.split('\n').filter(l => l.trim().startsWith('//'));
  assert.ok(comments.length > 0, 'fixture has no comments to protect');
  const ws = D.createWorkspace(files);
  CMD.setTimelineDates(D, ws, ENTRY, VIEW, { recordId: RECEIVE, start: '2026-01-09' });
  CMD.linkTimelineDependency(D, ws, ENTRY, VIEW, { id: 'order_before_post', label: 'Order precedes posting', fromId: ORDER, toId: POST });
  CMD.addTimelineRecord(D, ws, ENTRY, VIEW, { id: 'audit', label: 'Audit evidence', start: '2026-01-14', end: '2026-01-14' });
  CMD.unlinkTimelineDependency(D, ws, ENTRY, VIEW, { relationId: OBR });
  const modelAfter = ws.getFiles()['projections/model.ddn'], viewsAfter = ws.getFiles()['projections/views.ddn'];
  for (const c of comments) assert.ok(modelAfter.includes(c), 'comment lost: ' + c);
  for (const v of ['flowchart', 'responsibility_graph', 'raci', 'chart_bar', 'schedule_table', 'decision_table']) {
    const b0 = blockSpan(viewsBefore, 'view ' + v + ' '), b1 = blockSpan(viewsAfter, 'view ' + v + ' ');
    assert.strictEqual(viewsAfter.slice(b1.start, b1.end), viewsBefore.slice(b0.start, b0.end), 'view block altered: ' + v);
  }
  // Edited copy out to /tmp for the CLI render proof (work item step 5).
  const tmp = '/tmp/ed-004-workspace';
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(path.join(tmp, 'projections'), { recursive: true });
  for (const [f, text] of Object.entries(ws.getFiles())) fs.writeFileSync(path.join(tmp, f), text);
  const cli = path.join(__dirname, '..', '..', 'notation', 'cli', 'cli.js');
  const out = cp.spawnSync(process.execPath, [cli, 'check', path.join(tmp, 'projections/views.ddn'), '--workspace', tmp], { encoding: 'utf8' });
  assert.strictEqual(out.status, 0, 'CLI check failed: ' + out.stdout + out.stderr);
  ws.destroy();
});

// 9. Determinism: the same command sequence on two fresh workspaces yields identical files.
test('determinism: identical command sequence on two fresh workspaces yields identical files', () => {
  const run = () => {
    const ws = D.createWorkspace(fixtureFiles());
    CMD.setTimelineDates(D, ws, ENTRY, VIEW, { recordId: RECEIVE, start: '2026-01-09', end: '2026-01-13' });
    CMD.linkTimelineDependency(D, ws, ENTRY, VIEW, { id: 'order_before_post', label: 'Order precedes posting', fromId: ORDER, toId: POST });
    CMD.addTimelineRecord(D, ws, ENTRY, VIEW, { id: 'audit', label: 'Audit evidence', start: '2026-01-14', end: '2026-01-14' });
    const out = ws.getFiles();
    ws.destroy();
    return out;
  };
  assert.deepStrictEqual(run(), run());
});

console.log('ED-004 ' + pass + '/' + (pass + fail));
if (fail) process.exitCode = 1;
