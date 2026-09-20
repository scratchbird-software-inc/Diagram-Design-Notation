// SPDX-License-Identifier: GPL-2.0-or-later.
// ED-006 behavior suite: panels editor commands (add/rename/remove/respan panels,
// item moves between item-panels, child-view slot binds, fixed-grid canvas guards).
// Harness style imitates notation/tests/projections.js. No dependencies.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const D = require('../../notation/dist/ddn.global.js');
const CMD = require('../prototype/commands.js');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

const ENTRY = 'examples/projections/views.ddn';
const M = 'meridian.procurement.review::';
function fixtureFiles() {
  const files = {};
  for (const f of ['model.ddn', 'views.ddn', 'formats.ddn'])
    files['examples/projections/' + f] = fs.readFileSync(path.join(__dirname, '..', '..', 'examples', 'projections', f), 'utf8');
  return files;
}
function qualityFiles() {
  const files = {};
  for (const f of ['model.ddn', 'views.ddn', 'formats.ddn', 'details.ddn'])
    files['examples/quality/' + f] = fs.readFileSync(path.join(__dirname, '..', '..', 'examples', 'quality', f), 'utf8');
  return files;
}
const QENTRY = 'examples/quality/views.ddn', QM = 'meridian.quality.review::';
function canvasFiles() {
  return {
    'examples/basics/31-canvas-pack-a.ddn': fs.readFileSync(path.join(__dirname, '..', '..', 'examples', 'basics', '31-canvas-pack-a.ddn'), 'utf8'),
    'examples/basics/shared.ddn': fs.readFileSync(path.join(__dirname, '..', '..', 'examples', 'basics', 'shared.ddn'), 'utf8'),
  };
}
const CENTRY = 'examples/basics/31-canvas-pack-a.ddn', CM = 'ddn.examples.canvas-pack-a::';
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
function panelOf(plan, id) { const p = plan.panels.find(v => v.id === id); assert.ok(p, 'panel missing from plan: ' + id); return p; }
// A rejected command must leave the real workspace byte-identical at the same revision.
function refused(ws, fn) {
  const before = ws.getFiles(), rev = ws.revision;
  let code = null, message = '';
  try { fn(); } catch (e) { code = e.code; message = e.message; }
  assert.ok(code, 'command did not reject');
  assert.strictEqual(ws.revision, rev, 'rejected command changed the workspace revision');
  assert.deepStrictEqual(ws.getFiles(), before, 'rejected command left partial writes');
  return { code, message };
}

// 1. Baseline plan: swot returns 4 panels at the expected grid slots with items resolved.
test('baseline plan: swot has 4 panels at expected grid slots with items resolved', () => {
  const ws = D.createWorkspace(fixtureFiles());
  const plan = ws.projectionPlan(ENTRY, 'swot');
  assert.strictEqual(plan.kind, 'panels');
  assert.strictEqual(plan.profile, 'panels.basic@1');
  assert.strictEqual(plan.columns, 2);
  assert.strictEqual(plan.panels.length, 4);
  const slots = { s: [0, 0], w: [0, 1], o: [1, 0], t: [1, 1] };
  for (const [id, [row, column]] of Object.entries(slots)) {
    const p = panelOf(plan, id);
    assert.strictEqual(p.row, row); assert.strictEqual(p.column, column);
    assert.strictEqual(p.rowspan, 1); assert.strictEqual(p.colspan, 1);
    assert.strictEqual(p.items.length, 1);
    assert.strictEqual(p.items[0].node.id, M + 'notes.' + ({ s: 'strength', w: 'weakness', o: 'opportunity', t: 'threat' })[id]);
    assert.ok(p.items[0].text.length > 0, 'item body text not bound');
  }
  assert.deepStrictEqual([...plan.sourceIds].sort(), [M + 'notes.strength', M + 'notes.weakness', M + 'notes.opportunity', M + 'notes.threat'].sort());
  ws.destroy();
});

// 2. Move item. The literal swot o -> s move would empty panel o; the runtime keeps
//    empty item lists strict DDN-PJ009 (landed guards: notation/tests/pyramid.js,
//    canvas-pack-a/b, empathy-scorecard), so that gesture refuses coded before
//    commit. The VE-005 proof runs on journey's two-item verify panel: the move
//    commits, the re-plan shows the item under the target panel, the source diff
//    touches only the view's panels array and the note definitions stay
//    byte-identical (shared model untouched).
test('move item: emptying swot panel o refuses DDN-PJ009; journey review verify -> input commits with the diff confined to the panels array', () => {
  const ws = D.createWorkspace(fixtureFiles());
  assert.strictEqual(refused(ws, () => CMD.movePanelItem(D, ws, ENTRY, 'swot', { itemId: M + 'notes.opportunity', fromPanelId: 'o', toPanelId: 's' })).code, 'DDN-PJ009');
  const before = ws.getFiles();
  CMD.movePanelItem(D, ws, ENTRY, 'journey', { itemId: M + 'notes.review', fromPanelId: 'verify', toPanelId: 'input' });
  const plan = ws.projectionPlan(ENTRY, 'journey');
  assert.deepStrictEqual(panelOf(plan, 'input').items.map(i => i.node.id), [M + 'notes.inputs', M + 'notes.review']);
  assert.deepStrictEqual(panelOf(plan, 'verify').items.map(i => i.node.id), [M + 'notes.verification']);
  const after = ws.getFiles();
  assert.strictEqual(after['examples/projections/model.ddn'], before['examples/projections/model.ddn'], 'shared note definitions edited by an item move');
  assert.strictEqual(after['examples/projections/formats.ddn'], before['examples/projections/formats.ddn']);
  const d = diffSpan(before[ENTRY], after[ENTRY]);
  const block = blockSpan(after[ENTRY], 'view journey ');
  assert.ok(d.s >= block.start && d.ea <= block.end, 'item move escaped the journey view block');
  const projection = blockSpan(after[ENTRY].slice(block.start, block.end), 'projection');
  assert.ok(d.s - block.start >= projection.start && d.ea - block.start <= projection.end, 'item move touched more than the projection group');
  for (const v of ['swot', 'sipoc', 'gantt', 'chart_bar']) {
    const b0 = blockSpan(before[ENTRY], 'view ' + v + ' '), b1 = blockSpan(after[ENTRY], 'view ' + v + ' ');
    assert.strictEqual(after[ENTRY].slice(b1.start, b1.end), before[ENTRY].slice(b0.start, b0.end), 'unrelated view block altered: ' + v);
  }
  ws.destroy();
});

// 3. Add item: one note definition plus the ref in the panel's items; one undo
//    removes both.
test('add item: addPanelItem creates one note and inserts its ref; one undo removes both the definition and the array entry', () => {
  const ws = D.createWorkspace(fixtureFiles()), before = ws.getFiles();
  const made = CMD.addPanelItem(D, ws, ENTRY, 'swot', { panelId: 'o', id: 'riskwatch', label: 'Risk watch', description: 'Synthetic: weekly supplier-outage watch list.' });
  const plan = ws.projectionPlan(ENTRY, 'swot');
  assert.deepStrictEqual(panelOf(plan, 'o').items.map(i => i.node.id), [M + 'notes.opportunity', made.select]);
  const note = ws.resolve(ENTRY, 'swot').elements.find(e => e.id === made.select);
  assert.strictEqual(note.kind, 'note');
  assert.strictEqual(note.properties.description, 'Synthetic: weekly supplier-outage watch list.');
  assert.strictEqual(panelOf(plan, 'o').items[1].text, 'Synthetic: weekly supplier-outage watch list.');
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before, 'one undo did not remove definition and array entry');
  ws.destroy();
});

// 4. Rename + respan on journey (colspan:3 panels); an overlap attempt rejects
//    DDN-PJ021 via scratch re-plan with nothing committed.
test('rename + respan: journey panels update only the panels array; overlapping spans reject DDN-PJ021 with nothing committed', () => {
  const ws = D.createWorkspace(fixtureFiles()), before = ws.getFiles();
  CMD.renamePanel(D, ws, ENTRY, 'journey', { panelId: 'actor', title: 'ACTOR SENTIMENT' });
  CMD.movePanelSpan(D, ws, ENTRY, 'journey', { panelId: 'verify', row: 2, column: 0, colspan: 2 });
  const plan = ws.projectionPlan(ENTRY, 'journey');
  assert.strictEqual(panelOf(plan, 'actor').title, 'ACTOR SENTIMENT');
  const verify = panelOf(plan, 'verify');
  assert.strictEqual(verify.row, 2); assert.strictEqual(verify.colspan, 2);
  const after = ws.getFiles();
  assert.strictEqual(after['examples/projections/model.ddn'], before['examples/projections/model.ddn']);
  const d = diffSpan(before[ENTRY], after[ENTRY]);
  const block = blockSpan(after[ENTRY], 'view journey ');
  assert.ok(d.s >= block.start && d.ea <= block.end, 'rename/respan escaped the journey view block');
  assert.strictEqual(refused(ws, () => CMD.movePanelSpan(D, ws, ENTRY, 'journey', { panelId: 'out', row: 0, column: 1 })).code, 'DDN-PJ021');
  ws.destroy();
});

// 5. VE-AC-055: move the dashboard_operations slot1 child panel to a free cell.
//    Only the parent view's panels array changes; every child view block and every
//    other file stays byte-identical; ir.view.children still maps slot1.
test('VE-AC-055: moving child panel slot1 in the dashboard grid changes only the parent panels array; children and other files byte-identical', () => {
  const files = qualityFiles(), before = { ...files };
  const ws = D.createWorkspace(files);
  CMD.movePanelSpan(D, ws, QENTRY, 'dashboard_operations', { panelId: 'slot1', row: 2, column: 0 });
  const after = ws.getFiles();
  for (const f of Object.keys(before)) if (f !== QENTRY) assert.strictEqual(after[f], before[f], 'file altered by a parent layout move: ' + f);
  for (const v of ['dashboard_quality', 'dashboard_repeated', 'grouped_bars', 'waterfall', 'raci', 'decision_unique']) {
    const b0 = blockSpan(before[QENTRY], 'view ' + v + ' '), b1 = blockSpan(after[QENTRY], 'view ' + v + ' ');
    assert.strictEqual(after[QENTRY].slice(b1.start, b1.end), before[QENTRY].slice(b0.start, b0.end), 'child/other view block altered: ' + v);
  }
  const d = diffSpan(before[QENTRY], after[QENTRY]);
  const block = blockSpan(after[QENTRY], 'view dashboard_operations ');
  assert.ok(d.s >= block.start && d.ea <= block.end, 'move escaped the parent view block');
  const plan = ws.projectionPlan(QENTRY, 'dashboard_operations');
  assert.strictEqual(panelOf(plan, 'slot1').row, 2);
  const children = ws.resolve(QENTRY, 'dashboard_operations').view.children;
  assert.deepStrictEqual(children.map(c => c.slot), ['slot0', 'slot1', 'slot2', 'slot3'], 'child-view slot mapping changed');
  assert.strictEqual(children.find(c => c.slot === 'slot1').ir.view.id, QM.replace('review', 'views') + 'waterfall');
  ws.destroy();
});

// 6. VE-AC-056: binding a composed dashboard inside another composed dashboard
//    refuses before commit with DDN-QP002 wording; a 13th child slot refuses with
//    DDN-QP003 wording. Real revision unchanged.
test('VE-AC-056: recursive dashboard bind refuses DDN-QP002 before commit; a 13th child slot refuses DDN-QP003', () => {
  const ws = D.createWorkspace(qualityFiles());
  const nested = refused(ws, () => CMD.bindPanelChildView(D, ws, QENTRY, 'dashboard_operations', { panelId: 'slot1', childViewId: 'dashboard_quality' }));
  assert.strictEqual(nested.code, 'DDN-QP002');
  assert.ok(/one child-view level/.test(nested.message), 'DDN-QP002 wording changed: ' + nested.message);
  // Grow dashboard_repeated to twelve child slots plus one item panel, then try
  // to bind the item panel as the 13th child.
  const panels = [];
  for (let i = 0; i < 12; i++) panels.push({ id: 's' + i, title: 'Pareto ' + i, row: Math.floor(i / 2), column: i % 2, view: QM.replace('review', 'views') + 'pareto' });
  panels.push({ id: 'extra', title: 'Notes', row: 6, column: 0, items: [QM + 'notes.note'] });
  CMD.setPanels(D, ws, QENTRY, 'dashboard_repeated', { panels });
  assert.strictEqual(ws.projectionPlan(QENTRY, 'dashboard_repeated').panels.length, 13);
  assert.strictEqual(ws.resolve(QENTRY, 'dashboard_repeated').view.children.length, 12);
  const thirteenth = refused(ws, () => CMD.bindPanelChildView(D, ws, QENTRY, 'dashboard_repeated', { panelId: 'extra', childViewId: 'pareto' }));
  assert.strictEqual(thirteenth.code, 'DDN-QP003');
  assert.ok(/twelve embedded child views/.test(thirteenth.message), 'DDN-QP003 wording changed: ' + thirteenth.message);
  ws.destroy();
});

// 7. Item-into-view-slot: movePanelItem targeting a view panel rejects with
//    DDN-QP001 semantics.
test('item into view slot: movePanelItem targeting a child-view panel rejects DDN-QP001', () => {
  const ws = D.createWorkspace(qualityFiles());
  CMD.setPanels(D, ws, QENTRY, 'dashboard_repeated', {
    panels: [
      { id: 'slot0', title: 'Pareto', row: 0, column: 0, view: QM.replace('review', 'views') + 'pareto' },
      { id: 'notes', title: 'Notes', row: 0, column: 1, items: [QM + 'notes.note'] },
    ],
  });
  const r = refused(ws, () => CMD.movePanelItem(D, ws, QENTRY, 'dashboard_repeated', { itemId: QM + 'notes.note', fromPanelId: 'notes', toPanelId: 'slot0' }));
  assert.strictEqual(r.code, 'DDN-QP001');
  assert.ok(/cannot also contain items/.test(r.message), 'DDN-QP001 wording changed: ' + r.message);
  const add = refused(ws, () => CMD.addPanelItem(D, ws, QENTRY, 'dashboard_repeated', { panelId: 'slot0', id: 'rogue', label: 'Rogue' }));
  assert.strictEqual(add.code, 'DDN-QP001');
  ws.destroy();
});

// 8. Canvas guard (RT-013 landed): on the canvas.bmc@1 fixture, removePanel('kp')
//    is refused and the scratch re-plan raises DDN-PJ080; an item edit inside vp
//    commits cleanly; an extra annotation panel in a free cell commits.
test('canvas guard: removePanel(kp) refuses DDN-PJ080; item edit inside vp commits; annotation panel in a free cell commits', () => {
  const ws = D.createWorkspace(canvasFiles());
  const r = refused(ws, () => CMD.removePanel(D, ws, CENTRY, 'bmc', { panelId: 'kp' }));
  assert.strictEqual(r.code, 'DDN-PJ080');
  assert.ok(/canvas\.bmc@1 requires panel "kp"/.test(r.message), 'DDN-PJ080 wording changed: ' + r.message);
  const made = CMD.addPanelItem(D, ws, CENTRY, 'bmc', { panelId: 'vp', id: 'vp_note', label: 'Evening pitch', description: 'Synthetic: a second value proposition for the evening pitch.' });
  assert.deepStrictEqual(panelOf(ws.projectionPlan(CENTRY, 'bmc'), 'vp').items.map(i => i.node.id), [CM + 'canvas.bmc_vp', made.select]);
  CMD.addPanel(D, ws, CENTRY, 'bmc', { id: 'annotation', title: 'ANNOTATION', row: 3, column: 0, colspan: 10, items: [CM + 'canvas.bmc_ka'] });
  const plan = ws.projectionPlan(CENTRY, 'bmc');
  assert.strictEqual(plan.panels.length, 10);
  assert.strictEqual(panelOf(plan, 'annotation').row, 3);
  ws.undo();
  assert.strictEqual(ws.projectionPlan(CENTRY, 'bmc').panels.length, 9);
  // An empty annotation panel stays strict DDN-PJ009 (landed guard canvas-pack-a.js).
  assert.strictEqual(refused(ws, () => CMD.addPanel(D, ws, CENTRY, 'bmc', { id: 'blank', title: 'BLANK', row: 3, column: 0, colspan: 10 })).code, 'DDN-PJ009');
  ws.destroy();
});

// 9. Round-trip: fixture comments and all untouched view blocks byte-identical;
//    CLI check passes on the edited files (written to /tmp for the render proof).
test('round-trip: comments and untouched view blocks byte-identical after all edits; CLI check passes', () => {
  const files = fixtureFiles();
  const before = { ...files };
  const comments = files[ENTRY].split('\n').concat(files['examples/projections/model.ddn'].split('\n')).filter(l => l.trim().startsWith('//'));
  assert.ok(comments.length > 0, 'fixture has no comments to protect');
  const ws = D.createWorkspace(files);
  CMD.movePanelItem(D, ws, ENTRY, 'journey', { itemId: M + 'notes.review', fromPanelId: 'verify', toPanelId: 'input' });
  CMD.addPanelItem(D, ws, ENTRY, 'swot', { panelId: 'o', id: 'riskwatch', label: 'Risk watch', description: 'Synthetic: weekly supplier-outage watch list.' });
  CMD.renamePanel(D, ws, ENTRY, 'journey', { panelId: 'actor', title: 'ACTOR SENTIMENT' });
  CMD.movePanelSpan(D, ws, ENTRY, 'journey', { panelId: 'verify', row: 2, column: 0, colspan: 2 });
  CMD.addPanel(D, ws, ENTRY, 'journey', { id: 'annotation', title: 'ANNOTATION', row: 3, column: 0, colspan: 3, items: [M + 'notes.threat'] });
  const after = ws.getFiles();
  for (const c of comments) assert.ok(after[ENTRY].includes(c) || after['examples/projections/model.ddn'].includes(c), 'comment lost: ' + c);
  for (const v of ['sipoc', 'gantt', 'chart_bar', 'raci', 'matrix_general']) {
    const b0 = blockSpan(before[ENTRY], 'view ' + v + ' '), b1 = blockSpan(after[ENTRY], 'view ' + v + ' ');
    assert.strictEqual(after[ENTRY].slice(b1.start, b1.end), before[ENTRY].slice(b0.start, b0.end), 'unrelated view block altered: ' + v);
  }
  assert.strictEqual(after['examples/projections/model.ddn'], before['examples/projections/model.ddn'], 'shared model edited');
  const tmp = '/tmp/ed-006-workspace';
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(path.join(tmp, 'examples', 'projections'), { recursive: true });
  for (const [f, text] of Object.entries(after)) fs.writeFileSync(path.join(tmp, f), text);
  const cli = path.join(__dirname, '..', '..', 'notation', 'cli', 'cli.js');
  const out = cp.spawnSync(process.execPath, [cli, 'check', path.join(tmp, ENTRY), '--workspace', tmp], { encoding: 'utf8' });
  assert.strictEqual(out.status, 0, 'CLI check failed: ' + out.stdout + out.stderr);
  ws.destroy();
});

// 10. Determinism: the same command sequence on two fresh workspaces yields
//     identical files.
test('determinism: identical command sequence on two fresh workspaces yields identical files', () => {
  const run = () => {
    const ws = D.createWorkspace(fixtureFiles());
    CMD.movePanelItem(D, ws, ENTRY, 'journey', { itemId: M + 'notes.review', fromPanelId: 'verify', toPanelId: 'input' });
    CMD.addPanelItem(D, ws, ENTRY, 'swot', { panelId: 'o', id: 'riskwatch', label: 'Risk watch', description: 'Synthetic: weekly supplier-outage watch list.' });
    CMD.renamePanel(D, ws, ENTRY, 'journey', { panelId: 'actor', title: 'ACTOR SENTIMENT' });
    CMD.movePanelSpan(D, ws, ENTRY, 'journey', { panelId: 'verify', row: 2, column: 0, colspan: 2 });
    const out = ws.getFiles();
    ws.destroy();
    return out;
  };
  assert.deepStrictEqual(run(), run());
});

console.log('ED-006 ' + pass + '/' + (pass + fail));
if (fail) process.exitCode = 1;
