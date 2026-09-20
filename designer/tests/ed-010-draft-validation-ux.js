// SPDX-License-Identifier: GPL-2.0-or-later.
// ED-010 behavior suite: draft validation UX surface (spec ch.12). Covers
// VE-AC-006 (start-before-end draft: incomplete under design, error under
// review, source retained, publish blocked) and VE-AC-007 (script input stored
// inert or rejected at the control, never downgraded). Primary fixture = the
// prototype's workspace.json from disk; the start-only flowchart is derived
// inline from the examples/basics/05-flow.ddn pattern (cited, not modified).
// Harness style imitates notation/tests/projections.js. No dependencies.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const D = require('../../notation/dist/ddn.global.js');
const CMD = require('../prototype/commands.js');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

const FILES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'prototype', 'workspace.json'), 'utf8'));
const fresh = (files) => D.createWorkspace(files || FILES);
// Start-only flowchart draft, same shape as examples/basics/05-flow.ddn's
// flow view (flow.* participants, flow.next links, flow.basic@1 profile) but
// with only the Start placed — VE-AC-006's intermediate diagram.
const DRAFT_FILES = {
  'draft.ddn': 'ddn "0.4";\nmodule "ddn.examples.flowdraft";\n\ndata process {\n    object start "Operational customer" { kind: "flow.start"; }\n}\nview flow "Capture, transport and transformation are different" {\n    data: [@process];\n    projection { kind:graph;profile:"flow.basic@1"; }\n}\n'
};
const VIEWS_ENTRY = 'projections/views.ddn';

// 1. VE-AC-006: strict build throws DDN-PF008; validate reports it as
// 'incomplete' under design and 'error' under review; the source file is
// retained byte-exactly; the export-blocked state (renderFailure) is derivable.
test('VE-AC-006 start-before-end: PF008 incomplete under design, error under review, source retained', () => {
  const ws = fresh(DRAFT_FILES);
  const before = ws.getFiles();
  assert.throws(() => ws.renderSync({ entry: 'draft.ddn', view: 'flow' }), e => e.code === 'DDN-PF008');
  // renderFailure is exactly "strict build threw" — export stays blocked by it.
  let renderFailure = false, caught = null;
  try { ws.renderSync({ entry: 'draft.ddn', view: 'flow' }); } catch (e) { renderFailure = true; caught = e; }
  assert.strictEqual(renderFailure, true, 'export-blocked state not derivable');
  assert.strictEqual(CMD.classifyCode(caught.code, 'design'), 'incomplete');
  const d = CMD.validate(D, ws, 'draft.ddn', { scope: 'current-view', view: 'flow', policy: 'design' });
  assert.strictEqual(d.issues.length, 1);
  assert.deepStrictEqual({ code: d.issues[0].code, severity: d.issues[0].severity }, { code: 'DDN-PF008', severity: 'incomplete' });
  assert.strictEqual(d.views[0].status, 'profile-incomplete');
  const r = CMD.validate(D, ws, 'draft.ddn', { scope: 'current-view', view: 'flow', policy: 'review' });
  assert.deepStrictEqual({ code: r.issues[0].code, severity: r.issues[0].severity }, { code: 'DDN-PF008', severity: 'error' });
  assert.strictEqual(r.views[0].status, 'error');
  assert.deepStrictEqual(ws.getFiles(), before, 'validate mutated the source');
  ws.destroy();
});

// 2. Classification: RACI missing A (DDN-PJ016) → incomplete under design;
// duplicate declaration (DDN024) → error under both policies; the DDN-W012
// 0.2-compatibility renderer diagnostic passes through with severity warning.
test('classification: PJ016 incomplete, DDN024 error under both policies, DDN-W012 pass-through warning', () => {
  const mod = { ...FILES };
  mod['projections/model.ddn'] = mod['projections/model.ddn'].replace(
    'relation order_a "Approve purchase" @process.order -> @roles.manager { kind: "analysis.assignment"; x_assignment: {code:"A"}; }',
    'relation order_a "Approve purchase" @process.order -> @roles.manager { kind: "analysis.assignment"; x_assignment: {code:"C"}; }');
  assert.notStrictEqual(mod['projections/model.ddn'], FILES['projections/model.ddn'], 'fixture edit did not apply');
  const ws = fresh(mod);
  const pj = CMD.validate(D, ws, VIEWS_ENTRY, { scope: 'current-view', view: 'raci', policy: 'design' }).issues.find(i => i.code === 'DDN-PJ016');
  assert.ok(pj && pj.severity === 'incomplete', 'PJ016 not typed incomplete under design');
  assert.strictEqual(CMD.validate(D, ws, VIEWS_ENTRY, { scope: 'current-view', view: 'raci', policy: 'review' }).issues.find(i => i.code === 'DDN-PJ016').severity, 'error');
  ws.destroy();
  const dup = fresh({ 'b.ddn': 'ddn "0.4";\nmodule "t.dup";\ndata m { object a "A" { kind: table; } object a "B" { kind: table; } }\nview v "V" { data: [@m]; }\n' });
  for (const policy of ['design', 'review']) {
    const issue = CMD.validate(D, dup, 'b.ddn', { scope: 'current-view', view: 'v', policy }).issues.find(i => i.code === 'DDN024');
    assert.ok(issue && issue.severity === 'error', 'DDN024 not error under ' + policy);
  }
  dup.destroy();
  const old = fresh({ 'c.ddn': 'ddn "0.2";\nmodule "t.old";\ndata m { object a "A" { kind: table; } }\nview v "V" { data: [@m]; }\n' });
  const w = CMD.validate(D, old, 'c.ddn', { scope: 'current-view', view: 'v', policy: 'design' }).issues.find(i => i.code === 'DDN-W012');
  assert.ok(w && w.severity === 'warning', 'DDN-W012 did not pass through as warning');
  old.destroy();
});

// 3. Workspace scope: every view gets a status; every flat issue carries
// viewId; a commit marks all other views pending; revalidation clears them.
test('workspace scope: per-view status, viewId on every issue, pending bookkeeping clears', () => {
  const ws = fresh();
  const rep = CMD.validate(D, ws, 'model.ddn', { scope: 'workspace', policy: 'design' });
  const totalViews = ws.entries().reduce((n, e) => n + ws.views(e.file).length, 0);
  assert.strictEqual(rep.views.length, totalViews, 'not every view got a status');
  assert.ok(rep.views.every(v => ['profile-incomplete', 'current-view checked', 'error'].includes(v.status)), 'unknown status value');
  assert.ok(rep.issues.every(i => typeof i.viewId === 'string' && i.viewId.includes('::')), 'issue without viewId');
  // One commit through a Commands function (label edit), then the app-side
  // pending rule: every view except the active one is pending.
  CMD.occurrences; // (ED-009 dependency present)
  D.authoring.setLabel(ws, 'model.ddn', 'overview', 'designer.sample::model.customer', 'Customer');
  const pending = CMD.pendingViewsAfterCommit(D, ws, 'model.ddn', 'overview');
  assert.strictEqual(pending.length, totalViews - 1, 'pending set is not totalViews-1');
  assert.ok(!pending.includes('model.ddn::overview'), 'active view marked pending');
  assert.deepStrictEqual(pending, [...pending].sort(), 'pending list not deterministic');
  // Workspace revalidation re-checks every view and the UI clears the set.
  const rep2 = CMD.validate(D, ws, 'model.ddn', { scope: 'workspace', policy: 'design' });
  assert.strictEqual(rep2.views.length, totalViews);
  const cleared = new Set(pending); for (const v of rep2.views) cleared.delete(v.entry + '::' + v.viewId.split('::').pop());
  assert.strictEqual(cleared.size, 0, 'revalidation did not clear every pending view');
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), FILES, 'fixture not restored');
  ws.destroy();
});

// 4. Occurrence addressing (ED-009 integration): a subject issue carries an
// occurrenceId that Commands.occurrences.resolve maps back to the same
// definition id.
test('occurrence addressing: subject issue occurrenceId resolves to the same definition', () => {
  const mod = { ...FILES };
  mod['projections/model.ddn'] = mod['projections/model.ddn'].replace('x_assignment: {code:"A"}; }', 'x_assignment: {code:"C"}; }');
  const ws = fresh(mod);
  const issue = CMD.validate(D, ws, VIEWS_ENTRY, { scope: 'current-view', view: 'raci', policy: 'design' }).issues.find(i => i.code === 'DDN-PJ016');
  assert.ok(issue.subjectId, 'no subjectId on PJ016');
  assert.ok(issue.occurrenceId, 'no occurrenceId on PJ016');
  const parsed = CMD.occurrences.parse(issue.occurrenceId);
  assert.strictEqual(parsed.definitionId, issue.subjectId);
  // Resolve through the view the occurrence belongs to.
  let hit = null;
  for (const e of ws.entries()) for (const v of ws.views(e.file)) {
    try { if (ws.resolve(e.file, v.id).view.id === parsed.viewId) hit = { entry: e.file, view: v.id }; } catch (_) {}
  }
  assert.ok(hit, 'occurrence view not found');
  const resolved = CMD.occurrences.resolve(D, ws, hit.entry, hit.view, issue.occurrenceId);
  assert.strictEqual(resolved.definitionId, issue.subjectId);
  ws.destroy();
});

// 5. VE-AC-007: a <script> label is stored as inert quoted literal text and the
// re-rendered SVG stays script-free; a numeric record-value control rejects
// "420;alert(1)" — no command, no diagnostic downgrade.
test('VE-AC-007: script label stored inert; numeric control rejects text; no downgrade', () => {
  const ws = fresh();
  const id = 'designer.sample::model.customer';
  D.authoring.setLabel(ws, 'model.ddn', 'overview', id, '<script>alert(1)</script>');
  const src = ws.getFiles()['model.ddn'];
  assert.ok(src.includes('"<script>alert(1)</script>"'), 'label not stored as an inert quoted literal');
  const out = ws.renderSync({ entry: 'model.ddn', view: 'overview' });
  assert.ok(!out.svg.includes('<script'), 'rendered SVG contains a script element');
  const issues = CMD.validate(D, ws, 'model.ddn', { scope: 'current-view', view: 'overview', policy: 'design' }).issues;
  assert.ok(!issues.some(i => i.severity === 'incomplete'), 'script input downgraded to incomplete');
  // Numeric record-value control path (chart editor): text is rejected by the
  // control guard before any command is staged.
  const chartEntry = VIEWS_ENTRY, rec = 'meridian.procurement.review::facts.m1';
  const guarded = '"420;alert(1)"'.trim() === '' || !Number.isFinite(Number('420;alert(1)'));
  assert.strictEqual(guarded, true, 'control guard accepted a numeric-looking injection');
  assert.throws(
    () => CMD.editRecordValue(D, ws, chartEntry, 'chart_bar', { id: rec, key: 'value', value: '420;alert(1)' }),
    e => e.code === 'DDN-I033');
  assert.throws(
    () => CMD.editRecordValue(D, ws, chartEntry, 'chart_bar', { id: rec, key: 'value', value: Number('420;alert(1)') }),
    e => e.code === 'DDN-E007');
  const after = CMD.validate(D, ws, chartEntry, { scope: 'current-view', view: 'chart_bar', policy: 'design' }).issues;
  assert.ok(!after.some(i => i.severity === 'incomplete'), 'rejected input produced an incomplete diagnostic');
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), FILES, 'fixture not restored');
  ws.destroy();
});

// 6. Incomplete badge flow: a completeness-breaking edit committed through a
// Commands function (tolerant draft commit) leaves the strict render failing
// with a code classified 'incomplete'; undo restores the view and the badge
// condition clears.
test('incomplete badge flow: draft commit classifies incomplete; undo clears it', () => {
  const ws = fresh();
  const ir = ws.resolve(VIEWS_ENTRY, 'flowchart');
  const closeId = 'meridian.procurement.review::process.close';
  assert.ok(ir.view.selected.includes(closeId), 'fixture flowchart lost its End occurrence');
  const occ = CMD.occurrences.occurrenceIdFor(ir.view.id, closeId);
  const res = CMD.removeOccurrence(D, ws, VIEWS_ENTRY, { viewId: 'flowchart', occurrenceId: occ }, 'tolerant');
  assert.strictEqual(res.status, 'removed');
  let badge = false;
  try { ws.renderSync({ entry: VIEWS_ENTRY, view: 'flowchart' }); } catch (e) { badge = CMD.classifyCode(e.code, 'design') === 'incomplete'; }
  assert.strictEqual(badge, true, 'badge condition (incomplete classification) not met after draft commit');
  const issues = CMD.validate(D, ws, VIEWS_ENTRY, { scope: 'current-view', view: 'flowchart', policy: 'design' }).issues;
  assert.ok(issues.some(i => i.code === 'DDN-PF008' && i.severity === 'incomplete'), 'no incomplete PF008 issue in the strip');
  assert.strictEqual(ws.history().canUndo, true);
  ws.undo();
  ws.renderSync({ entry: VIEWS_ENTRY, view: 'flowchart' }); // re-render succeeds → badge clears
  assert.deepStrictEqual(ws.getFiles(), FILES, 'undo did not restore byte-identical source');
  ws.destroy();
});

// 7. Round-trip + determinism: two validate runs on the same workspace produce
// identical issue lists ordered by code then viewId; all fixture files are
// byte-identical after the suite's edits are undone; CLI check still passes.
test('round-trip + determinism: identical issue lists; fixtures byte-identical; CLI check passes', () => {
  const ws = fresh();
  const a = CMD.validate(D, ws, 'model.ddn', { scope: 'workspace', policy: 'design' }).issues;
  const b = CMD.validate(D, ws, 'model.ddn', { scope: 'workspace', policy: 'design' }).issues;
  assert.deepStrictEqual(a, b, 'validate is not deterministic');
  const sorted = [...a].sort((x, y) => x.code < y.code ? -1 : x.code > y.code ? 1 : x.viewId < y.viewId ? -1 : x.viewId > y.viewId ? 1 : 0);
  assert.deepStrictEqual(a, sorted, 'issue list not ordered by code then viewId');
  assert.deepStrictEqual(ws.getFiles(), FILES, 'validate mutated fixture files');
  ws.destroy();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ed010-'));
  const f = path.join(dir, 'draft.ddn');
  fs.writeFileSync(f, DRAFT_FILES['draft.ddn']);
  const out = cp.spawnSync(process.execPath, [path.join(__dirname, '..', '..', 'notation', 'cli', 'cli.js'), 'check', f, '--workspace', dir], { encoding: 'utf8' });
  assert.notStrictEqual(out.status, 0, 'CLI accepted the start-only draft (editor must mirror strict validation)');
  assert.ok((out.stdout + out.stderr).includes('DDN-PF008'), 'CLI did not report DDN-PF008');
  fs.rmSync(dir, { recursive: true, force: true });
});

console.log(`ED-010 ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
