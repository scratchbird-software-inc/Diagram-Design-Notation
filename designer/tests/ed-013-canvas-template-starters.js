// SPDX-License-Identifier: GPL-2.0-or-later.
// ED-013 behavior suite: canvas template starters (CANVAS_TEMPLATES registry +
// createCanvasFromTemplate) — all eight templates generate renderable views in
// one undoable command; grid legality is the runtime planner's own verdict;
// no invented content beyond the synthetic starter notes.
// Acceptance-plan status (item Context 7): of the 84 cases in
// designer/tests/acceptance-plan.json NONE covers template starters — this
// item flips no case (the gap is recorded in the report), so part (b) of the
// item's test plan does not apply.
// Harness style imitates notation/tests/projections.js. No dependencies.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const D = require('../../notation/dist/ddn.global.js');
const CMD = require('../prototype/commands.js');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

const ENTRY = 'model.ddn', M = 'designer.sample::';
function fixtureFiles() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'prototype', 'workspace.json'), 'utf8'));
}
function refused(ws, fn) {
  const before = ws.getFiles(), rev = ws.revision;
  let code = null, message = '';
  try { fn(); } catch (e) { code = e.code; message = e.message; }
  assert.ok(code, 'command did not reject');
  assert.strictEqual(ws.revision, rev, 'rejected command changed the workspace revision');
  assert.deepStrictEqual(ws.getFiles(), before, 'rejected command left partial writes');
  return { code, message };
}
function viewBlock(text, viewId) {
  const marker = 'view ' + viewId + ' ';
  const start = text.indexOf(marker);
  assert.ok(start >= 0, 'generated view block missing: ' + viewId);
  let depth = 0, end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}') { depth--; if (!depth) { end = i + 1; break; } }
  }
  assert.ok(end > start, 'view block not closed');
  return text.slice(start, end);
}

console.log('ED-013 note: no acceptance-plan case covers template starters (Context 7) — no case flipped; the gap is recorded in the report.');

// 0. Gate: the eight templates match the landed RT-013/014/016 profiles and grids.
test('gate: eight templates registered with the landed profiles, columns and block tables', () => {
  assert.strictEqual(CMD.CANVAS_TEMPLATES.length, 8);
  const byId = Object.fromEntries(CMD.CANVAS_TEMPLATES.map(t => [t.id, t]));
  assert.deepStrictEqual(Object.keys(byId), ['bmc', 'lean', 'swot', 'pest', 'pestle', 'porter5', 'empathy', 'scorecard']);
  assert.strictEqual(byId.bmc.profile, 'canvas.bmc@1'); assert.strictEqual(byId.bmc.columns, 10); assert.strictEqual(byId.bmc.blocks.length, 9);
  assert.strictEqual(byId.lean.profile, 'canvas.lean@1'); assert.strictEqual(byId.lean.columns, 10); assert.strictEqual(byId.lean.blocks.length, 9);
  assert.strictEqual(byId.swot.profile, 'panels.basic@1'); assert.strictEqual(byId.swot.columns, 2); assert.strictEqual(byId.swot.blocks.length, 4);
  assert.strictEqual(byId.pest.profile, 'canvas.pest@1'); assert.strictEqual(byId.pest.columns, 4); assert.strictEqual(byId.pest.blocks.length, 4);
  assert.strictEqual(byId.pestle.profile, 'canvas.pestle@1'); assert.strictEqual(byId.pestle.columns, 3); assert.strictEqual(byId.pestle.blocks.length, 6);
  assert.strictEqual(byId.porter5.profile, 'canvas.porter5@1'); assert.strictEqual(byId.porter5.columns, 3); assert.strictEqual(byId.porter5.blocks.length, 5);
  assert.strictEqual(byId.empathy.profile, 'canvas.empathy@1'); assert.strictEqual(byId.empathy.columns, 2); assert.strictEqual(byId.empathy.blocks.length, 5);
  assert.strictEqual(byId.scorecard.profile, 'canvas.scorecard@1'); assert.strictEqual(byId.scorecard.columns, 2); assert.strictEqual(byId.scorecard.blocks.length, 4);
  // Landed runtime CANVAS table covers the same profiles with the same ids.
  const rt = fs.readFileSync(path.join(__dirname, '..', '..', 'notation', 'runtime', 'ddn-projection-data.js'), 'utf8');
  for (const t of CMD.CANVAS_TEMPLATES) {
    if (t.profile === 'panels.basic@1') continue;
    assert.ok(rt.includes("'" + t.profile + "'"), 'runtime CANVAS table missing ' + t.profile);
    for (const [pid] of t.blocks) assert.ok(rt.includes("['" + pid + "',"), 'runtime CANVAS table missing panel ' + pid + ' of ' + t.profile);
  }
});

// 1. All eight templates generate: build + render + plan fidelity + one starter note per panel.
test('all eight templates generate a renderable view with the exact profile, columns, block ids and one starter note per panel', () => {
  for (const tpl of CMD.CANVAS_TEMPLATES) {
    const ws = D.createWorkspace(fixtureFiles());
    const viewId = tpl.id + '_canvas';
    const r = CMD.createCanvasFromTemplate(D, ws, ENTRY, { templateId: tpl.id, viewId, viewLabel: tpl.title });
    assert.strictEqual(r.blocks, tpl.blocks.length);
    const out = ws.renderSync({ entry: ENTRY, view: viewId });
    assert.ok(out.svg.includes('<svg'), tpl.id + ': no SVG rendered');
    const plan = ws.projectionPlan(ENTRY, viewId);
    assert.strictEqual(plan.kind, 'panels');
    assert.strictEqual(plan.profile, tpl.profile, tpl.id + ': profile mismatch');
    assert.strictEqual(plan.columns, tpl.columns, tpl.id + ': columns mismatch');
    assert.deepStrictEqual(plan.panels.map(p => p.id), tpl.blocks.map(b => b[0]), tpl.id + ': block ids mismatch');
    for (const [pid, title, row, column, rowspan, colspan] of tpl.blocks) {
      const p = plan.panels.find(v => v.id === pid);
      assert.strictEqual(p.title, title); assert.strictEqual(p.row, row); assert.strictEqual(p.column, column);
      assert.strictEqual(p.rowspan, rowspan); assert.strictEqual(p.colspan, colspan);
      assert.strictEqual(p.items.length, 1, tpl.id + '/' + pid + ': expected exactly one starter note');
      assert.strictEqual(p.items[0].node.id, M + 'model.' + viewId + '_' + pid);
      assert.strictEqual(p.items[0].text, tpl.notePrompt);
    }
    ws.destroy();
  }
});

// 2. One command, one undo: byte-exact restore.
test('one command, one undo: notes + view block are a single revision step; undo restores the files byte-exactly', () => {
  const ws = D.createWorkspace(fixtureFiles()), before = ws.getFiles(), rev = ws.revision;
  CMD.createCanvasFromTemplate(D, ws, ENTRY, { templateId: 'bmc', viewId: 'bmc_canvas', viewLabel: 'Business Model Canvas' });
  assert.strictEqual(ws.revision, rev + 1, 'template creation is not exactly one revision step');
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before, 'one undo did not restore the pre-template files byte-exactly');
  ws.destroy();
});

// 3. No-invention guard: exactly blocks.length notes, no relations, minimal view block.
test('no invention: exactly one note per block, zero relations, and the view block declares only data/format/projection', () => {
  const ws = D.createWorkspace(fixtureFiles());
  const tpl = CMD.CANVAS_TEMPLATES.find(t => t.id === 'bmc');
  const beforeIR = ws.resolve(ENTRY, 'overview');
  CMD.createCanvasFromTemplate(D, ws, ENTRY, { templateId: 'bmc', viewId: 'bmc_canvas', viewLabel: 'Business Model Canvas' });
  const afterIR = ws.resolve(ENTRY, 'overview');
  assert.strictEqual(afterIR.elements.length - beforeIR.elements.length, tpl.blocks.length, 'element delta is not exactly the block count');
  assert.strictEqual(afterIR.relations.length - beforeIR.relations.length, 0, 'relations were invented');
  const made = afterIR.elements.filter(n => !beforeIR.elements.some(b => b.id === n.id));
  assert.ok(made.every(n => n.kind === 'note'), 'a created object is not a note');
  assert.ok(made.every(n => n.properties.description === tpl.notePrompt), 'starter note description is not the synthetic notePrompt');
  const block = viewBlock(ws.getFiles()[ENTRY], 'bmc_canvas');
  for (const banned of ['select:', 'exclude:', 'display', 'layout', 'place ', 'route ']) assert.ok(!block.includes(banned), 'view block carries an invented property: ' + banned);
  assert.ok(block.includes('data: [@model];') && block.includes('format: @common.design;') && block.includes('projection {'), 'view block misses data/format/projection');
  ws.destroy();
});

// 4. Grid legality + corrupted table caught by the scratch build with DDN-PJ021, never committed.
test('grid legality: every template passes the runtime planner; a corrupted table entry rejects DDN-PJ021 in the scratch build with no commit', () => {
  const bmc = CMD.CANVAS_TEMPLATES.find(t => t.id === 'bmc');
  const saved = bmc.blocks.map(b => [...b]);
  try {
    bmc.blocks[1] = ['ka', 'KEY ACTIVITIES', 0, 0, 2, 2]; // collide with kp at (0,0)
    const ws = D.createWorkspace(fixtureFiles());
    const r = refused(ws, () => CMD.createCanvasFromTemplate(D, ws, ENTRY, { templateId: 'bmc', viewId: 'bmc_broken', viewLabel: 'Broken' }));
    assert.strictEqual(r.code, 'DDN-PJ021', 'overlap did not surface the runtime DDN-PJ021, got ' + r.code);
    ws.destroy();
  } finally { bmc.blocks = saved; }
  const ws = D.createWorkspace(fixtureFiles());
  CMD.createCanvasFromTemplate(D, ws, ENTRY, { templateId: 'bmc', viewId: 'bmc_canvas', viewLabel: 'Business Model Canvas' });
  assert.strictEqual(ws.projectionPlan(ENTRY, 'bmc_canvas').panels.length, 9, 'restored table no longer generates');
  ws.destroy();
});

// 5. Duplicate / invalid view id rejections; a second template coexists in the same file.
test('duplicate and invalid view ids reject coded with no write; a second canvas of another template coexists and both render', () => {
  const ws = D.createWorkspace(fixtureFiles());
  const dup = refused(ws, () => CMD.createCanvasFromTemplate(D, ws, ENTRY, { templateId: 'bmc', viewId: 'overview', viewLabel: 'Dup' }));
  assert.strictEqual(dup.code, 'DDN-I033');
  const bad = refused(ws, () => CMD.createCanvasFromTemplate(D, ws, ENTRY, { templateId: 'bmc', viewId: 'not valid', viewLabel: 'Bad' }));
  assert.strictEqual(bad.code, 'DDN-E001');
  CMD.createCanvasFromTemplate(D, ws, ENTRY, { templateId: 'bmc', viewId: 'bmc_canvas', viewLabel: 'Business Model Canvas' });
  const again = refused(ws, () => CMD.createCanvasFromTemplate(D, ws, ENTRY, { templateId: 'lean', viewId: 'bmc_canvas', viewLabel: 'Again' }));
  assert.strictEqual(again.code, 'DDN-I033');
  CMD.createCanvasFromTemplate(D, ws, ENTRY, { templateId: 'pest', viewId: 'pest_canvas', viewLabel: 'PEST analysis' });
  assert.strictEqual(ws.projectionPlan(ENTRY, 'bmc_canvas').profile, 'canvas.bmc@1');
  assert.strictEqual(ws.projectionPlan(ENTRY, 'pest_canvas').profile, 'canvas.pest@1');
  assert.ok(ws.renderSync({ entry: ENTRY, view: 'bmc_canvas' }).svg.includes('<svg'));
  assert.ok(ws.renderSync({ entry: ENTRY, view: 'pest_canvas' }).svg.includes('<svg'));
  assert.ok(ws.renderSync({ entry: ENTRY, view: 'overview' }).svg.includes('<svg'), 'pre-existing view no longer renders');
  ws.destroy();
});

// 6. ED-006 interop on the generated BMC: item move commits; fixed-grid guard holds.
test('ED-006 interop: movePanelItem moves the kp starter note into ka; removePanel(kp) stays refused by the fixed-grid guard', () => {
  const ws = D.createWorkspace(fixtureFiles());
  CMD.createCanvasFromTemplate(D, ws, ENTRY, { templateId: 'bmc', viewId: 'bmc_canvas', viewLabel: 'Business Model Canvas' });
  const starter = M + 'model.bmc_canvas_kp';
  // A direct move would empty kp (strict DDN-PJ009); seed a second kp note first,
  // then move the starter note itself — the gesture ED-006's sheet offers.
  const added = CMD.addPanelItem(D, ws, ENTRY, 'bmc_canvas', { panelId: 'kp', id: 'kp_extra', label: 'Second partner', description: 'Synthetic: second partner note.' });
  CMD.movePanelItem(D, ws, ENTRY, 'bmc_canvas', { itemId: starter, fromPanelId: 'kp', toPanelId: 'ka' });
  let plan = ws.projectionPlan(ENTRY, 'bmc_canvas');
  assert.deepStrictEqual(plan.panels.find(v => v.id === 'ka').items.map(i => i.node.id), [M + 'model.bmc_canvas_ka', starter]);
  assert.deepStrictEqual(plan.panels.find(v => v.id === 'kp').items.map(i => i.node.id), [added.select]);
  const guard = refused(ws, () => CMD.removePanel(D, ws, ENTRY, 'bmc_canvas', { panelId: 'kp' }));
  assert.strictEqual(guard.code, 'DDN-PJ080', 'fixed-grid guard did not fire DDN-PJ080, got ' + guard.code);
  plan = ws.projectionPlan(ENTRY, 'bmc_canvas');
  assert.strictEqual(plan.panels.length, 9, 'panel set changed by the refused remove');
  ws.destroy();
});

// 7. Profile fidelity: porter5 rivalry center cell; empathy persona colspan 2.
test('profile fidelity: porter5 rivalry is the center block at (1,1,1,1); empathy persona spans colspan 2', () => {
  const ws = D.createWorkspace(fixtureFiles());
  CMD.createCanvasFromTemplate(D, ws, ENTRY, { templateId: 'porter5', viewId: 'porter5_canvas', viewLabel: 'Porter five forces' });
  CMD.createCanvasFromTemplate(D, ws, ENTRY, { templateId: 'empathy', viewId: 'empathy_canvas', viewLabel: 'Empathy map' });
  const rivalry = ws.projectionPlan(ENTRY, 'porter5_canvas').panels.find(v => v.id === 'rivalry');
  assert.deepStrictEqual([rivalry.row, rivalry.column, rivalry.rowspan, rivalry.colspan], [1, 1, 1, 1]);
  const persona = ws.projectionPlan(ENTRY, 'empathy_canvas').panels.find(v => v.id === 'persona');
  assert.deepStrictEqual([persona.row, persona.column, persona.rowspan, persona.colspan], [1, 0, 1, 2]);
  ws.destroy();
});

// 8. Round-trip + determinism: fixture comments/pre-existing views byte-identical;
//    two fresh workspaces generate identical files; CLI check passes.
test('round-trip + determinism: pre-existing content byte-identical; two runs identical; CLI check passes on a generated file', () => {
  const files = fixtureFiles(), beforeText = files[ENTRY];
  const gen = () => { const ws = D.createWorkspace(fixtureFiles()); CMD.createCanvasFromTemplate(D, ws, ENTRY, { templateId: 'bmc', viewId: 'bmc_canvas', viewLabel: 'Business Model Canvas' }); const out = ws.getFiles(); ws.destroy(); return out; };
  const a = gen(), b = gen();
  assert.deepStrictEqual(a, b, 'two fresh generations differ');
  // Round-trip: removing exactly the generated notes and the appended view
  // block restores the pre-existing source byte-for-byte.
  const tpl = CMD.CANVAS_TEMPLATES.find(t => t.id === 'bmc');
  const notes = tpl.blocks.map(([pid, title]) => '    object bmc_canvas_' + pid + ' ' + JSON.stringify(title) + ' { kind: "note"; description: ' + JSON.stringify(tpl.notePrompt) + '; }').join('\n');
  let restored = a[ENTRY].replace('\n' + notes + '\n', '');
  assert.ok(restored !== a[ENTRY], 'generated notes not found at the expected span');
  restored = restored.slice(0, beforeText.length);
  assert.strictEqual(restored, beforeText, 'pre-existing source altered outside the generated spans');
  assert.ok(a[ENTRY].includes('// Synthetic design; no production/customer information.'), 'fixture comment lost');
  assert.ok(a[ENTRY].includes('// Shared definition edits must preserve this comment.'), 'fixture comment lost');
  for (const f of Object.keys(files)) if (f !== ENTRY) assert.strictEqual(a[f], files[f], 'unrelated file altered: ' + f);
  for (const v of ['overview', 'names']) assert.ok(a[ENTRY].includes(viewBlock(beforeText, v)), 'pre-existing view altered: ' + v);
  const tmp = '/tmp/ed-013-ws';
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  for (const [f, text] of Object.entries(a)) { fs.mkdirSync(path.join(tmp, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(tmp, f), text); }
  const cli = path.join(__dirname, '..', '..', 'notation', 'cli', 'cli.js');
  const r = cp.spawnSync(process.execPath, [cli, 'check', path.join(tmp, ENTRY), '--workspace', tmp], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, 'CLI check failed: ' + r.stdout + r.stderr);
  assert.ok(r.stdout.includes('"status": "pass-core"'), 'CLI check did not pass: ' + r.stdout);
  cp.execFileSync(process.execPath, [cli, 'render', path.join(tmp, ENTRY), '--workspace', tmp, '--view', 'bmc_canvas', '--out', '/tmp/ed-013.svg'], { encoding: 'utf8' });
  const svgText = fs.readFileSync('/tmp/ed-013.svg', 'utf8');
  for (const title of ['KEY PARTNERS', 'KEY ACTIVITIES', 'KEY RESOURCES', 'VALUE PROPOSITIONS', 'CUSTOMER RELATIONSHIPS', 'CHANNELS', 'CUSTOMER SEGMENTS', 'COST STRUCTURE', 'REVENUE STREAMS'])
    assert.ok(svgText.includes(title), 'CLI render misses block ' + title);
  assert.ok(svgText.includes('List the partners this model depends on.'), 'CLI render misses the starter note text');
});

process.on('exit', () => console.log('ED-013 ' + pass + '/' + (pass + fail)));
if (fail) process.exitCode = 1;
