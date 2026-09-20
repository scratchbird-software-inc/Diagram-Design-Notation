// SPDX-License-Identifier: GPL-2.0-or-later.
// ED-009 behavior/contract suite: the occurrence addressing layer
// (Commands.occurrences) — deterministic occ: ids, one-appearance-per-view
// restriction (VE-AC-036), remove/restore round-trips, relation-occurrence and
// unsupported-descriptor explicit responses. Primary fixture = the prototype's
// own workspace.json read from disk, plus an inline explicit-select fixture.
// Harness style imitates notation/tests/projections.js. No dependencies.
'use strict';
const assert = require('assert');
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const D = require('../../notation/dist/ddn.global.js');
const CMD = require('../prototype/commands.js');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

const FILES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'prototype', 'workspace.json'), 'utf8'));
const M = 'designer.sample::';
const ENTRY = 'model.ddn', VIEW = 'overview';
const VIEW_UID = M + 'overview';
const fresh = (files) => D.createWorkspace(files || FILES);
const occFor = (def) => 'occ:' + VIEW_UID + ':' + def;
const OCC = CMD.occurrences;

// 1. Deterministic ids: occurrenceIdFor/list yields the documented format;
// parse round-trips it; a label edit does not change any occurrenceId.
test('deterministic ids: format, parse round-trip, label edit stability', () => {
  const ws = fresh();
  const id = OCC.occurrenceIdFor(VIEW_UID, M + 'model.customer');
  assert.strictEqual(id, 'occ:designer.sample::overview:designer.sample::model.customer');
  assert.deepStrictEqual(OCC.parse(id), { viewId: VIEW_UID, definitionId: M + 'model.customer' });
  assert.strictEqual(OCC.list(D, ws, ENTRY, VIEW).find(o => o.definitionId === M + 'model.customer').occurrenceId, id);
  D.authoring.setLabel(ws, ENTRY, VIEW, M + 'model.customer', 'Renamed customer');
  assert.strictEqual(OCC.list(D, ws, ENTRY, VIEW).find(o => o.definitionId === M + 'model.customer').occurrenceId, id, 'label edit changed the occurrenceId');
  assert.throws(() => OCC.parse('occ:broken'), e => e.code === 'DDN-I033');
  ws.destroy();
});

// 2. list coverage: every view.selected element and every view.relations
// relation of overview yields exactly one occurrence record; counts match
// ws.resolve.
test('list coverage: one record per selected element and per visible relation', () => {
  const ws = fresh();
  const ir = ws.resolve(ENTRY, VIEW);
  const list = OCC.list(D, ws, ENTRY, VIEW);
  const elements = list.filter(o => o.role === 'element'), relations = list.filter(o => o.role === 'relation');
  assert.strictEqual(elements.length, ir.view.selected.length, 'element occurrence count != view.selected count');
  assert.strictEqual(relations.length, ir.view.relations.length, 'relation occurrence count != view.relations count');
  assert.deepStrictEqual(elements.map(o => o.definitionId), ir.view.selected);
  assert.deepStrictEqual(relations.map(o => o.definitionId), ir.view.relations);
  assert.ok(list.every(o => o.viewId === VIEW_UID && o.occurrenceId === occFor(o.definitionId)), 'record shape drift');
  assert.strictEqual(new Set(list.map(o => o.occurrenceId)).size, list.length, 'duplicate occurrence ids');
  ws.destroy();
});

// 3. VE-AC-036 alias request: addExistingToView for model.customer on overview
// (already selected; the fixture view has no explicit select) returns
// status:'already-present' with the fixed restriction string and the existing
// occurrenceId; NO source change.
test('VE-AC-036 alias request: already-present + one-appearance-per-view, zero source change', () => {
  const ws = fresh();
  const revBefore = ws.revision, filesBefore = ws.getFiles();
  const elementsBefore = ws.resolve(ENTRY, VIEW).elements.length;
  const out = OCC.addExistingToView(D, ws, ENTRY, { definitionId: M + 'model.customer', viewId: VIEW });
  assert.strictEqual(out.status, 'already-present');
  assert.strictEqual(out.restriction, 'one-appearance-per-view');
  assert.strictEqual(out.occurrenceId, occFor(M + 'model.customer'));
  assert.strictEqual(out.select, M + 'model.customer', 'focus target is the existing occurrence');
  assert.strictEqual(ws.revision, revBefore, 'revision moved on an alias request');
  assert.deepStrictEqual(ws.getFiles(), filesBefore, 'files changed on an alias request — a disguised clone?');
  assert.strictEqual(ws.resolve(ENTRY, VIEW).elements.length, elementsBefore, 'a new object appeared in the resolved view');
  ws.destroy();
});

// 4. Remove + restore: removeOccurrence on model.invoice appends it to
// exclude; list no longer contains it and its two incident relations vanish;
// addExistingToView then returns restored and the view re-renders
// byte-identically to the original.
test('remove + restore: exclude append, incident relations vanish, byte-identical render after restore', () => {
  const ws = fresh();
  const svgBefore = ws.renderSync({ entry: ENTRY, view: VIEW }).svg;
  const invoice = occFor(M + 'model.invoice');
  const rem = OCC.removeOccurrence(D, ws, ENTRY, { viewId: VIEW, occurrenceId: invoice });
  assert.strictEqual(rem.status, 'removed');
  assert.ok(ws.getFiles()[ENTRY].includes('exclude: [@model.invoice];'), 'exclude append missing');
  const ir = ws.resolve(ENTRY, VIEW);
  assert.ok(!ir.view.selected.includes(M + 'model.invoice'), 'invoice still selected after remove');
  assert.ok(!OCC.list(D, ws, ENTRY, VIEW).some(o => o.definitionId === M + 'model.invoice'), 'list still contains the removed occurrence');
  for (const rel of [M + 'model.invoice_order', M + 'model.invoice_post'])
    assert.ok(!ir.view.relations.includes(rel), 'incident relation ' + rel + ' still visible after endpoint hide');
  const restored = OCC.addExistingToView(D, ws, ENTRY, { definitionId: M + 'model.invoice', viewId: VIEW });
  assert.strictEqual(restored.status, 'restored');
  assert.strictEqual(restored.occurrenceId, invoice);
  assert.strictEqual(ws.renderSync({ entry: ENTRY, view: VIEW }).svg, svgBefore, 'view does not re-render byte-identically after restore');
  ws.undo(); ws.undo();
  assert.deepStrictEqual(ws.getFiles(), FILES, 'two undos did not restore the fixture bytes');
  ws.destroy();
});

// 5. Relation occurrence removal returns status:'unsupported' with a reason
// naming the 0.5 restriction; no source change.
test('relation occurrence removal: explicit unsupported response, source-neutral', () => {
  const ws = fresh();
  const revBefore = ws.revision, filesBefore = ws.getFiles();
  const out = OCC.removeOccurrence(D, ws, ENTRY, { viewId: VIEW, occurrenceId: occFor(M + 'model.invoice_order') });
  assert.strictEqual(out.status, 'unsupported');
  assert.ok(/0\.5 runtime has no independent relation-hide/.test(out.reason), 'reason does not name the 0.5 restriction: ' + out.reason);
  assert.strictEqual(ws.revision, revBefore, 'revision moved on the unsupported response');
  assert.deepStrictEqual(ws.getFiles(), filesBefore, 'source changed on the unsupported response');
  ws.destroy();
});

// 6. Explicit-select fixture: a view with select: [@model.customer,
// @model.orders] — addExistingToView for model.invoice appends its ref to the
// select span only; one undo restores exact bytes; a caller-supplied wrong
// occurrenceId is rejected.
test('explicit-select fixture: select-span append only, one-undo byte restore, wrong occurrenceId rejected', () => {
  const files = { ...FILES };
  files[ENTRY] = FILES[ENTRY].replace(
    'view overview "Customer orders / structural view" {\n    data: [@model]; format: @common.design;\n}',
    'view overview "Customer orders / structural view" {\n    data: [@model]; format: @common.design;\n    select: [@model.customer, @model.orders];\n}');
  assert.notStrictEqual(files[ENTRY], FILES[ENTRY], 'inline fixture mutation did not apply');
  const ws = fresh(files);
  const before = ws.getFiles()[ENTRY];
  const out = OCC.addExistingToView(D, ws, ENTRY, { definitionId: M + 'model.invoice', viewId: VIEW });
  assert.strictEqual(out.status, 'added');
  const after = ws.getFiles()[ENTRY];
  assert.ok(after.includes('select: [@model.customer, @model.orders, @model.invoice];'), 'ref not appended to the select span');
  assert.strictEqual(after.replace('select: [@model.customer, @model.orders, @model.invoice];', 'select: [@model.customer, @model.orders];'), before, 'more than the select span changed');
  assert.ok(ws.resolve(ENTRY, VIEW).view.selected.includes(M + 'model.invoice'), 'invoice not selected after add');
  ws.undo();
  assert.strictEqual(ws.getFiles()[ENTRY], before, 'one undo did not restore the exact bytes');
  assert.throws(() => OCC.addExistingToView(D, ws, ENTRY, { definitionId: M + 'model.invoice', viewId: VIEW, occurrenceId: 'occ:designer.sample::names:' + M + 'model.invoice' }),
    e => e.code === 'DDN-I033' && /never invents ids/.test(e.message), 'caller-supplied wrong occurrenceId not rejected');
  ws.destroy();
});

// 7. moveOccurrences: two positions in one command produce one undo entry; the
// second call with pin:false releases both place blocks; the place @… spans
// are added/removed exactly.
test('moveOccurrences: one undo entry for two positions; pin:false releases both place spans', () => {
  const ws = fresh();
  const before = ws.getFiles()[ENTRY];
  const out = OCC.moveOccurrences(D, ws, ENTRY, {
    viewId: VIEW, positions: [
      { occurrenceId: occFor(M + 'model.customer'), x: 100, y: 200, pin: true },
      { occurrenceId: occFor(M + 'model.orders'), x: 300, y: 400, pin: true },
    ]
  });
  assert.strictEqual(out.moved, 2);
  const pinned = ws.getFiles()[ENTRY];
  assert.strictEqual((pinned.match(/place @model\.customer \{ at: \[100px, 200px\]; \}/g) || []).length, 1, 'customer place span not added exactly once');
  assert.strictEqual((pinned.match(/place @model\.orders \{ at: \[300px, 400px\]; \}/g) || []).length, 1, 'orders place span not added exactly once');
  ws.undo();
  assert.strictEqual(ws.getFiles()[ENTRY], before, 'one undo did not restore both pins — not one transaction');
  assert.ok(ws.history().canRedo, 'the whole move was not one history entry');
  OCC.moveOccurrences(D, ws, ENTRY, {
    viewId: VIEW, positions: [
      { occurrenceId: occFor(M + 'model.customer'), x: 100, y: 200, pin: true },
      { occurrenceId: occFor(M + 'model.orders'), x: 300, y: 400, pin: true },
    ]
  });
  OCC.moveOccurrences(D, ws, ENTRY, {
    viewId: VIEW, positions: [
      { occurrenceId: occFor(M + 'model.customer'), x: 0, y: 0, pin: false },
      { occurrenceId: occFor(M + 'model.orders'), x: 0, y: 0, pin: false },
    ]
  });
  const released = ws.getFiles()[ENTRY];
  assert.ok(!/place @model\.(customer|orders)/.test(released), 'place spans survive the pin:false release');
  assert.throws(() => OCC.moveOccurrences(D, ws, ENTRY, { viewId: VIEW, positions: [{ occurrenceId: occFor(M + 'model.invoice_order'), x: 1, y: 1, pin: true }] }),
    e => e.code === 'DDN-I033' && /Relation occurrences are derived/.test(e.message), 'relation occurrence pin not rejected');
  ws.destroy();
});

// 8. setViewOverride: visibility+remove equals the hide path; pin with [x,y]
// equals A.pin; descriptorId style returns status:'unsupported'.
test('setViewOverride: visibility=hide path, pin=A.pin, style explicitly unsupported', () => {
  const a = fresh(), b = fresh();
  const invoice = occFor(M + 'model.invoice');
  const out = OCC.setViewOverride(D, a, ENTRY, { viewId: VIEW, occurrenceId: invoice, descriptorId: 'visibility', action: 'remove' });
  assert.strictEqual(out.status, 'applied');
  D.authoring.hide(b, ENTRY, VIEW, M + 'model.invoice');
  assert.deepStrictEqual(a.getFiles(), b.getFiles(), 'visibility+remove differs from the plain hide path');
  const c = fresh(), d = fresh();
  OCC.setViewOverride(D, c, ENTRY, { viewId: VIEW, occurrenceId: occFor(M + 'model.orders'), descriptorId: 'pin', action: 'set', value: [50, 60] });
  D.authoring.pin(d, ENTRY, VIEW, M + 'model.orders', 50, 60);
  assert.deepStrictEqual(c.getFiles(), d.getFiles(), 'pin+[x,y] differs from A.pin');
  const rev = a.revision, files = a.getFiles();
  const un = OCC.setViewOverride(D, a, ENTRY, { viewId: VIEW, occurrenceId: occFor(M + 'model.orders'), descriptorId: 'style', action: 'set', value: 'emphasis' });
  assert.strictEqual(un.status, 'unsupported');
  assert.ok(/occurrence-contract RFC/.test(un.reason), 'style reason does not cite the ch.11 RFC scope: ' + un.reason);
  assert.strictEqual(a.revision, rev, 'revision moved on the unsupported descriptor');
  assert.deepStrictEqual(a.getFiles(), files, 'source changed on the unsupported descriptor');
  a.destroy(); b.destroy(); c.destroy(); d.destroy();
});

// 9. Round-trip + determinism: fixture comment byte-identical after all
// commands; two fresh workspaces + same commands → identical files; CLI check
// passes on the edited files.
test('round-trip + determinism: comment byte-identical; two runs identical; CLI check passes', () => {
  const COMMENT = '// Shared definition edits must preserve this comment.';
  const run = () => {
    const ws = fresh();
    OCC.removeOccurrence(D, ws, ENTRY, { viewId: VIEW, occurrenceId: occFor(M + 'model.invoice') });
    OCC.addExistingToView(D, ws, ENTRY, { definitionId: M + 'model.invoice', viewId: VIEW });
    OCC.addExistingToView(D, ws, ENTRY, { definitionId: M + 'model.customer', viewId: VIEW });
    OCC.removeOccurrence(D, ws, ENTRY, { viewId: VIEW, occurrenceId: occFor(M + 'model.invoice_order') });
    OCC.moveOccurrences(D, ws, ENTRY, { viewId: VIEW, positions: [{ occurrenceId: occFor(M + 'model.customer'), x: 120, y: 240, pin: true }] });
    OCC.setViewOverride(D, ws, ENTRY, { viewId: VIEW, occurrenceId: occFor(M + 'model.orders'), descriptorId: 'pin', action: 'set', value: [50, 60] });
    const files = ws.getFiles(); ws.destroy(); return files;
  };
  const a = run(), b = run();
  assert.deepStrictEqual(a, b, 'same command battery on fresh workspaces diverged');
  assert.ok(a[ENTRY].includes(COMMENT), 'fixture comment lost');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ed-009-'));
  for (const [name, text] of Object.entries(a)) { fs.mkdirSync(path.join(dir, path.dirname(name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), text); }
  const out = cp.spawnSync(process.execPath, [path.join(__dirname, '..', '..', 'notation', 'cli', 'cli.js'), 'check', ENTRY, '--workspace', '.'], { encoding: 'utf8', cwd: dir });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.strictEqual(out.status, 0, 'CLI check failed on edited files: ' + out.stderr + out.stdout);
  assert.ok(out.stdout.includes('pass-core'), 'CLI check did not pass-core: ' + out.stdout);
});

console.log(`ED-009 ${pass}/${pass + fail}`);
if (fail) process.exitCode = 1;
