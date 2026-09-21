// SPDX-License-Identifier: GPL-2.0-or-later.
// ED-012 behavior suite: sequence diagram editor for RT-101's uml.sequence@1
// projection (lifelines, messages, returns, declaration-order moves). Covers
// VE-AC-062 ("Renumber sequence callouts" → "Predecessor graph unchanged" —
// byte-proven) and VE-AC-063 ("Choose organic on participant-lane sequence" →
// "Not offered and API rejects incompatible layout" — LIVE021 asserted).
// Fixtures: the prototype workspace.json (extended with data interactions +
// view sequence, mirroring RT-101's examples/basics/41-sequence-diagram.ddn,
// which is cited and verified from disk). The step-1 gate fails loudly when
// any RT-101 artifact is absent. Harness style imitates
// notation/tests/projections.js. No dependencies.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const D = require('../../notation/dist/ddn.global.js');
const CMD = require('../prototype/commands.js');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

const ROOT = path.join(__dirname, '..', '..');
const PROTO = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'prototype', 'workspace.json'), 'utf8'));
const EXAMPLE = path.join(ROOT, 'website/examples/basics/41-sequence-diagram.ddn');
const fresh = () => D.createWorkspace(JSON.parse(JSON.stringify(PROTO)));
const E = 'projections/views.ddn', V = 'sequence';
const M = 'meridian.procurement.views::interactions.';
const msgIds = ws => ws.projectionPlan(E, V).messages.map(r => r.id);
const partIds = ws => ws.projectionPlan(E, V).participants.map(n => n.id);
const declText = (ws, id) => { const s = D.authoring.sourceOf(ws, E, V, id); return ws.getFiles()[s.file].slice(s.start, s.end); };

// 1. Step-1 gate: every RT-101 artifact named by the work item exists, the
// ED-009 occurrence namespace exists, and the fixture's plan baseline is in
// declaration order (three participants, three messages, one x_return).
test('gate: RT-101 artifacts + ED-009 occurrences + baseline plan in declaration order', () => {
  const profiles = JSON.parse(fs.readFileSync(path.join(ROOT, 'standard/registry/profiles/catalogue.json'), 'utf8'));
  const seq = profiles.profiles.find(p => p.id === 'uml.sequence@1');
  assert.ok(seq && seq.projection === 'sequence', 'GATE: uml.sequence@1 profile missing — RT-101 not landed');
  const msg = (profiles.relationships || []).find(r => (r.keyword || r.id) === 'uml.message');
  assert.ok(msg, 'GATE: uml.message relationship contract missing — RT-101 not landed');
  assert.strictEqual(msg.allow_self, true, 'GATE: uml.message allow_self is not true');
  assert.strictEqual(msg.member_endpoints, false, 'GATE: uml.message member_endpoints is not false');
  assert.deepStrictEqual(msg.source, ['*']); assert.deepStrictEqual(msg.target, ['*']);
  const core = fs.readFileSync(path.join(ROOT, 'notation/runtime/ddn-core.js'), 'utf8');
  assert.ok(core.includes("'sequence'"), "GATE: 'sequence' missing from CHOICES.projection.kind");
  const pdata = fs.readFileSync(path.join(ROOT, 'notation/runtime/ddn-projection-data.js'), 'utf8');
  assert.ok(pdata.includes('sequence:[...common]'), 'GATE: supported.sequence missing from ddn-projection-data.js');
  assert.ok(pdata.includes('DDN-PJ110'), 'GATE: DDN-PJ110 check missing');
  const projs = fs.readFileSync(path.join(ROOT, 'notation/runtime/ddn-projections.js'), 'utf8');
  assert.ok(projs.includes('DDN-PJW03'), 'GATE: DDN-PJW03 warning missing');
  const ext = fs.readFileSync(path.join(ROOT, 'standard/registry/extensions.json'), 'utf8');
  assert.ok(ext.includes('"x_return"'), 'GATE: x_return contract missing from extensions.json');
  assert.ok(fs.existsSync(EXAMPLE), 'GATE: website/examples/basics/41-sequence-diagram.ddn missing');
  assert.strictEqual(typeof CMD.occurrences, 'object', 'GATE: Commands.occurrences missing — ED-009 not landed');
  assert.strictEqual(typeof CMD.moveDeclaration, 'function');
  const ws = fresh();
  assert.deepStrictEqual(partIds(ws), [M + 'customer_app', M + 'checkout', M + 'inventory'], 'participants not in declaration order');
  assert.deepStrictEqual(msgIds(ws), [M + 'submit_order', M + 'reserve_stock', M + 'reserve_stock_reply'], 'messages not in declaration order');
  const reply = ws.resolve(E, V).relations.find(r => r.id === M + 'reserve_stock_reply');
  assert.strictEqual(reply.properties.x_return, true, 'the fixture return is not x_return:true');
  ws.destroy();
});

// 2. Add message: checkout → inventory appends one uml.message as the last
// row; re-plan shows it last; one undo removes it.
test('add message: appends last row; re-plan shows it last; one undo removes it', () => {
  const ws = fresh(), before = ws.getFiles();
  const r = CMD.addSequenceMessage(D, ws, E, V, { id: 'check_stock', label: 'Check stock', fromId: M + 'checkout', toId: M + 'inventory' });
  assert.deepStrictEqual(msgIds(ws).map(x => x.split('.').pop()), ['submit_order', 'reserve_stock', 'reserve_stock_reply', 'check_stock']);
  assert.strictEqual(msgIds(ws).at(-1), r.select);
  const rel = ws.resolve(E, V).relations.find(x => x.id === r.select);
  assert.strictEqual(rel.kind, 'uml.message');
  assert.strictEqual(rel.from.element, M + 'checkout');
  assert.strictEqual(rel.to.element, M + 'inventory');
  assert.strictEqual(ws.history().canUndo, true);
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before, 'one undo did not restore exact bytes');
  ws.destroy();
});

// 3. Insert message: beforeId positions the new relation between two existing
// rows (one atomic create+position transaction); re-plan order reflects it.
test('insert message: beforeId positions between existing rows; re-plan order reflects it', () => {
  const ws = fresh();
  const r = CMD.addSequenceMessage(D, ws, E, V, { id: 'validate_cart', label: 'Validate cart', fromId: M + 'checkout', toId: M + 'customer_app', beforeId: M + 'reserve_stock' });
  assert.deepStrictEqual(msgIds(ws), [M + 'submit_order', M + 'validate_cart', M + 'reserve_stock', M + 'reserve_stock_reply']);
  assert.strictEqual(r.select, M + 'validate_cart', 'the positioned relation must live in the interactions block');
  assert.ok(declText(ws, r.select).includes('kind: "uml.message";'));
  ws.destroy();
});

// 4. Return toggle: setMessageReturn(true) writes x_return: true; (exact span)
// and the SVG path gains a dash pattern; toggling off removes the property.
test('return toggle: exact x_return span; SVG dash pattern; removal leaves no x_return', () => {
  const ws = fresh();
  CMD.setMessageReturn(D, ws, E, V, { relationId: M + 'submit_order', isReturn: true });
  const span = declText(ws, M + 'submit_order');
  assert.ok(span.includes('x_return: true;'), 'exact span missing: ' + span);
  let group = ws.renderSync({ entry: E, view: V }).svg.match(new RegExp('<g class="ddn-mark[^"]*" data-id="' + M.replace(/\./g, '\\.') + 'submit_order"[\\s\\S]*?</g>'))[0];
  assert.ok(group.includes('stroke-dasharray="5 4"'), 'the message path did not gain a dash pattern');
  CMD.setMessageReturn(D, ws, E, V, { relationId: M + 'submit_order', isReturn: false });
  assert.ok(!declText(ws, M + 'submit_order').includes('x_return'), 'x_return text remains after removal');
  assert.strictEqual(ws.resolve(E, V).relations.find(r => r.id === M + 'submit_order').properties.x_return, undefined);
  // The other return (reserve_stock_reply) is untouched.
  assert.ok(declText(ws, M + 'reserve_stock_reply').includes('x_return: true;'));
  ws.destroy();
});

// 5. VE-AC-062: moveDeclaration a message two rows up and a lifeline one
// position left. Every relation's full declaration text is byte-identical
// (only positions changed); no endpoint or x_return changed; the plan order
// updated; undos restore the original bytes.
test('VE-AC-062 reorder: declaration texts byte-identical; endpoints/x_return unchanged; undo restores bytes', () => {
  const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'acceptance-plan.json'), 'utf8'));
  const ac = (plan.cases || plan).find(c => c.id === 'VE-AC-062');
  assert.strictEqual(ac.expected, 'Predecessor graph unchanged', 'VE-AC-062 expected text changed');
  const ws = fresh(), before = ws.getFiles();
  const declsBefore = Object.fromEntries(msgIds(ws).map(id => [id, declText(ws, id)]));
  const endsBefore = Object.fromEntries(ws.resolve(E, V).relations.filter(r => r.kind === 'uml.message').map(r => [r.id, [r.from.element, r.to.element, r.properties.x_return === true]]));
  CMD.moveDeclaration(D, ws, E, V, { definitionId: M + 'reserve_stock_reply', beforeId: M + 'submit_order' });
  const mid = ws.getFiles();
  CMD.reorderLifelines(D, ws, E, V, { participantId: M + 'inventory', beforeId: M + 'checkout' });
  assert.deepStrictEqual(msgIds(ws), [M + 'reserve_stock_reply', M + 'submit_order', M + 'reserve_stock'], 'message order did not update');
  assert.deepStrictEqual(partIds(ws), [M + 'customer_app', M + 'inventory', M + 'checkout'], 'lifeline order did not update');
  for (const id of Object.keys(declsBefore)) assert.strictEqual(declText(ws, id), declsBefore[id], 'relation declaration text changed: ' + id);
  const endsAfter = Object.fromEntries(ws.resolve(E, V).relations.filter(r => r.kind === 'uml.message').map(r => [r.id, [r.from.element, r.to.element, r.properties.x_return === true]]));
  assert.deepStrictEqual(endsAfter, endsBefore, 'an endpoint or x_return drifted — predecessor graph changed');
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), mid, 'first undo did not restore the intermediate state');
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before, 'second undo did not restore the original bytes');
  ws.destroy();
});

// 6. Lifeline add/remove: addExistingToView appends the select span; the
// re-plan includes the new lifeline with the runtime's own DDN-PJW03 warning
// surfaced; A.hide removes it again; both are single undo entries.
test('lifeline add/remove: addExistingToView + hide; DDN-PJW03 surfaced; single undo entries', () => {
  const ws = fresh(), before = ws.getFiles();
  const out = CMD.occurrences.addExistingToView(D, ws, E, { definitionId: M + 'delivery', viewId: V });
  assert.strictEqual(out.status, 'added');
  assert.ok(ws.getFiles()[E].includes('select: [@interactions.customer_app, @interactions.checkout, @interactions.inventory, @interactions.delivery];'), 'select span not appended: ' + ws.getFiles()[E].split('\n').find(l => l.includes('select:')));
  assert.deepStrictEqual(partIds(ws), [M + 'customer_app', M + 'checkout', M + 'inventory', M + 'delivery']);
  const warnings = ws.renderSync({ entry: E, view: V }).diagnostics.filter(d => d.code === 'DDN-PJW03');
  assert.strictEqual(warnings.length, 1, 'DDN-PJW03 not surfaced');
  assert.ok(warnings[0].message.includes('Delivery'), 'DDN-PJW03 does not name the silent participant');
  const added = ws.getFiles();
  D.authoring.hide(ws, E, V, M + 'delivery');
  assert.deepStrictEqual(partIds(ws), [M + 'customer_app', M + 'checkout', M + 'inventory'], 'hide did not remove the lifeline');
  assert.strictEqual(ws.renderSync({ entry: E, view: V }).diagnostics.filter(d => d.code === 'DDN-PJW03').length, 0);
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), added, 'hide undo did not restore the added state');
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before, 'add undo did not restore the original bytes');
  ws.destroy();
});

// 7. Self-message: checkout → checkout commits (allow_self:true in the
// contract, verified in test 1) and renders a loop mark.
test('self-message: commits under allow_self:true and renders a loop mark', () => {
  const ws = fresh();
  const r = CMD.addSequenceMessage(D, ws, E, V, { id: 'audit_self', label: 'Audit log', fromId: M + 'checkout', toId: M + 'checkout' });
  assert.ok(msgIds(ws).includes(r.select));
  const group = ws.renderSync({ entry: E, view: V }).svg.match(new RegExp('<g class="ddn-mark[^"]*" data-id="' + r.select.replace(/\./g, '\\.') + '"[\\s\\S]*?</g>'))[0];
  assert.match(group, /M[\d.]+ [\d.]+H[\d.]+V[\d.]+H[\d.]+/, 'self-message loop mark missing: ' + group.slice(0, 160));
  ws.destroy();
});

// 8. Negative: a message whose endpoint is not a selected object → scratch
// re-plan DDN-PJ110, nothing commits; a member endpoint attempt rejects
// against the uml.message contract (member_endpoints:false).
test('negative: non-object endpoint → DDN-PJ110 with no commit; member endpoint → contract rejection', () => {
  const ws = fresh();
  // Bring the non-object sample declaration into the select so the message is
  // visible; the scratch re-plan must then reject DDN-PJ110.
  const sel = ws.resolve(E, V).view.selected.map(id => ({ $ref: id.split('::')[1] }));
  CMD.editViewProperty(D, ws, E, V, { key: 'select', value: [...sel, { $ref: 'interactions.snap' }] });
  const staged = ws.getFiles();
  assert.throws(() => CMD.addSequenceMessage(D, ws, E, V, { id: 'bad_report', fromId: M + 'checkout', toId: M + 'snap' }), e => e.code === 'DDN-PJ110', 'expected DDN-PJ110');
  assert.deepStrictEqual(ws.getFiles(), staged, 'rejected edit wrote source');
  assert.throws(() => CMD.addSequenceMessage(D, ws, E, V, { id: 'bad_member', fromId: M + 'checkout.id', toId: M + 'inventory' }), e => e.code === 'DDN-I033' && /member_endpoints:false/.test(e.message), 'expected member_endpoints contract rejection');
  assert.deepStrictEqual(ws.getFiles(), staged, 'member-endpoint attempt wrote source');
  ws.undo();
  ws.destroy();
});

// 9. VE-AC-063: organic placement on the sequence view throws LIVE021; the
// editor surface offers no placement/Arrange control; no place/route source
// is ever produced.
test('VE-AC-063: organic placement throws LIVE021; no placement control offered; no place/route source', () => {
  const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'acceptance-plan.json'), 'utf8'));
  const ac = (plan.cases || plan).find(c => c.id === 'VE-AC-063');
  assert.strictEqual(ac.expected, 'Not offered and API rejects incompatible layout', 'VE-AC-063 expected text changed');
  const ws = fresh();
  assert.throws(() => ws.renderSync({ entry: E, view: V, overrides: { placement: 'organic' } }), e => e.code === 'LIVE021', 'expected LIVE021 for organic placement');
  assert.throws(() => ws.renderSync({ entry: E, view: V, overrides: { routing: 'curved' } }), e => e.code === 'LIVE021', 'expected LIVE021 for routing override');
  // Mirror of the prototype's graph() gate: the sequence sheet and inspector
  // branch must expose no placement/Arrange control.
  const app = fs.readFileSync(path.join(__dirname, '..', 'prototype', 'app.js'), 'utf8');
  const sheet = app.slice(app.indexOf('function renderSequenceSheet()'), app.indexOf('function sequenceConnectModal'));
  assert.ok(!/layoutPick|arrangeBtn|selectControl\(|overrides\.placement/.test(sheet), 'the sequence sheet exposes a placement/Arrange control');
  for (const text of Object.values(ws.getFiles())) {
    assert.ok(!/place @/.test(text), 'place source produced');
    assert.ok(!/route @/.test(text), 'route source produced');
  }
  ws.destroy();
});

// 10. Round-trip + determinism: fixture comments and unrelated views
// byte-identical; two fresh workspaces + the same commands → identical
// files; the CLI check passes on the edited files.
test('round-trip + determinism: unrelated source byte-identical; two runs identical; CLI check passes', () => {
  const sequence = () => {
    const ws = fresh();
    CMD.addSequenceMessage(D, ws, E, V, { id: 'check_stock', label: 'Check stock', fromId: M + 'checkout', toId: M + 'inventory' });
    CMD.setMessageReturn(D, ws, E, V, { relationId: M + 'submit_order', isReturn: true });
    CMD.moveDeclaration(D, ws, E, V, { definitionId: M + 'reserve_stock_reply', beforeId: M + 'submit_order' });
    CMD.reorderLifelines(D, ws, E, V, { participantId: M + 'inventory', beforeId: M + 'checkout' });
    CMD.setMessageLabel(D, ws, E, V, { relationId: M + 'reserve_stock', label: 'Reserve stock now' });
    const out = ws.getFiles();
    ws.destroy();
    return out;
  };
  const run1 = sequence(), run2 = sequence();
  assert.deepStrictEqual(run1, run2, 'same commands on fresh workspaces diverged');
  // Unrelated files byte-identical; the views file up to data interactions
  // (every other view block and all comments) byte-identical.
  for (const f of Object.keys(PROTO)) if (f !== E) assert.strictEqual(run1[f], PROTO[f], f + ' changed');
  assert.strictEqual(run1[E].slice(0, run1[E].indexOf('data interactions {')), PROTO[E].slice(0, PROTO[E].indexOf('data interactions {')), 'unrelated view blocks or comments changed');
  assert.ok(run1['model.ddn'].includes('// Synthetic design; no production/customer information.'), 'fixture comment lost');
  // CLI check on the edited files (temp workspace copy).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ed-012-'));
  for (const [name, text] of Object.entries(run1)) {
    const p = path.join(dir, name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
  }
  const cli = path.join(ROOT, 'notation/cli/cli.js');
  const r = cp.spawnSync(process.execPath, [cli, 'check', path.join(dir, E), '--workspace', dir], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, 'CLI check failed: ' + r.stdout + r.stderr);
  assert.ok(r.stdout.includes('"status": "pass-core"'), 'CLI check did not pass: ' + r.stdout);
  // CLI render proof: the new message row and the dashed return are in the SVG.
  const svg = path.join(dir, 'out.svg');
  const rr = cp.spawnSync(process.execPath, [cli, 'render', path.join(dir, E), '--workspace', dir, '--view', 'sequence', '--out', svg], { encoding: 'utf8' });
  assert.strictEqual(rr.status, 0, 'CLI render failed: ' + rr.stdout + rr.stderr);
  const text = fs.readFileSync(svg, 'utf8');
  assert.ok(text.includes('Check stock'), 'new message row missing from CLI render');
  const submit = text.match(new RegExp('<g class="ddn-mark[^"]*" data-id="' + M.replace(/\./g, '\\.') + 'submit_order"[\\s\\S]*?</g>'))[0];
  assert.ok(submit.includes('stroke-dasharray="5 4"'), 'dashed return missing from CLI render');
});
console.log('ED-012 ' + pass + '/' + (pass + fail));
if (fail) process.exitCode = 1;
