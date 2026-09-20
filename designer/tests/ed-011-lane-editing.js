// SPDX-License-Identifier: GPL-2.0-or-later.
// ED-011 behavior suite: lane editing on view frames (spec ch.08 "Scope versus
// visual grouping"; VE-003/VE-005/VE-008). Covers VE-AC-040 ("Drag table
// inside a server frame" → no placement relationship inferred without explicit
// action, byte-proven). Fixtures: examples/basics/04-hybrid.ddn from disk
// (with its shared.ddn import), the prototype workspace.json, and an inline
// uml.activity@1 fixture modeled on RT-105's examples/basics/
// 45-activity-diagram.ddn (cited, not modified). The RT-105 partition path is
// gated on the landed artifacts and FAILS LOUDLY when they are absent.
// Harness style imitates notation/tests/projections.js. No dependencies.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const D = require('../../notation/dist/ddn.global.js');
const CMD = require('../prototype/commands.js');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

const ROOT = path.join(__dirname, '..', '..');
const HYBRID = {
  '04-hybrid.ddn': fs.readFileSync(path.join(ROOT, 'examples/basics/04-hybrid.ddn'), 'utf8'),
  'shared.ddn': fs.readFileSync(path.join(ROOT, 'examples/basics/shared.ddn'), 'utf8'),
};
const PROTO = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'prototype', 'workspace.json'), 'utf8'));
const fresh = (files) => D.createWorkspace(files || HYBRID);
const ENTRY = '04-hybrid.ddn', VIEW = 'deployment';
const UID = (local) => 'ddn.examples.hybrid::' + local;
// Inline uml.activity@1 fixture, modeled on RT-105's landed example
// examples/basics/45-activity-diagram.ddn (same frame-as-partition shape and
// publication block; fork/join-free so DDN-PJ115 balances 0=0).
const ACT = {
  'act.ddn': 'ddn "0.5";\nmodule "ddn.test.ed011activity";\n\ndata flow {\n    object start "Start" { kind: "flow.start"; x_partition: { "lane": "webshop" }; }\n    object pack "Pack order" { kind: "flow.process"; x_partition: { "lane": "warehouse" }; }\n    object end "End" { kind: "flow.end"; x_partition: { "lane": "webshop" }; }\n    relation r1 "go" @start -> @pack { kind: "uml.flow"; }\n    relation r2 "done" @pack -> @end { kind: "uml.flow"; }\n}\nview fulfilment "Order fulfilment" {\n    data: [@flow];\n    projection { kind: graph; profile: "uml.activity@1"; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n    frame webshop "Webshop" { members: [@flow.start, @flow.end]; }\n    frame warehouse "Warehouse" { members: [@flow.pack]; }\n}\n'
};
const ACT_UID = (local) => 'ddn.test.ed011activity::' + local;

// 1. Baseline: the resolved view lists both frames with the expected member uids.
test('baseline: 04-hybrid view resolves two frames with expected member uids', () => {
  const ws = fresh();
  const frames = ws.resolve(ENTRY, VIEW).view.frames;
  assert.strictEqual(frames.length, 2);
  const local = frames.find(f => f.id === UID('deployment.local_scope'));
  const cloud = frames.find(f => f.id === UID('deployment.cloud_scope'));
  assert.deepStrictEqual(local.members, [UID('model.primary'), UID('model.local')]);
  assert.deepStrictEqual(cloud.members, [UID('model.follower'), UID('model.cloud')]);
  assert.strictEqual(local.name, 'ON-PREMISES');
  ws.destroy();
});

// 2. Create: exactly one frame block is inserted; re-render shows three
// frames; one undo restores exact bytes. Also the prototype-overview smoke:
// create a lane, pin+assign invoice (the drop path), the committed frame
// block names its member.
test('create: one frame block, three frames on re-render, undo restores exact bytes', () => {
  const ws = fresh(), before = ws.getFiles();
  CMD.createLane(D, ws, ENTRY, VIEW, { id: 'dmz', label: 'DMZ', at: { x: 40, y: 400 }, size: { w: 420, h: 260 } });
  const src = ws.getFiles()[ENTRY];
  assert.strictEqual((src.match(/frame dmz "DMZ"/g) || []).length, 1, 'expected exactly one new frame block');
  assert.ok(src.includes('frame dmz "DMZ" { members: []; at: [40px, 400px]; size: [420px, 260px]; }'));
  assert.strictEqual(ws.renderSync({ entry: ENTRY, view: VIEW }).scene.frames.length, 3);
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before, 'undo did not restore exact bytes');
  ws.destroy();
  // Prototype overview smoke (workspace.json fixture): New lane + drop invoice.
  const p = fresh(PROTO);
  CMD.createLane(D, p, 'model.ddn', 'overview', { id: 'billing_lane', label: 'BILLING', at: { x: 40, y: 430 }, size: { w: 460, h: 300 } });
  const t = D.createWorkspace(p.getFiles());
  D.authoring.pin(t, 'model.ddn', 'overview', 'designer.sample::model.invoice', 80, 500);
  CMD.assignToLane(D, t, 'model.ddn', 'overview', { frameId: 'billing_lane', elementIds: ['designer.sample::model.invoice'] });
  const a = t.getFiles(), b = p.getFiles();
  p.applyEdits(Object.keys(a).filter(f => b[f] !== a[f]).map(f => ({ file: f, start: 0, end: b[f].length, text: a[f] })), { expectedRevision: p.revision, entry: 'model.ddn', view: 'overview' });
  assert.ok(p.getFiles()['model.ddn'].includes('frame billing_lane "BILLING" { members: [@model.invoice];'), 'committed frame block does not name the dropped member');
  p.destroy(); t.destroy();
});

// 3. Rename: only the label token changes; the members span is byte-identical.
test('rename: edits only the label token; members span byte-identical', () => {
  const ws = fresh(), before = ws.getFiles()[ENTRY];
  CMD.renameLane(D, ws, ENTRY, VIEW, { frameId: 'local_scope', label: 'ON-PREMISES (EAST)' });
  const after = ws.getFiles()[ENTRY];
  const membersSpan = s => s.match(/frame local_scope[^{]+\{ (members: \[[^\]]*\];) \}/)[1];
  assert.strictEqual(membersSpan(after), membersSpan(before), 'members span changed');
  assert.ok(after.includes('frame local_scope "ON-PREMISES (EAST)"'));
  assert.strictEqual(after.replace('frame local_scope "ON-PREMISES (EAST)"', 'frame local_scope "ON-PREMISES"'), before, 'rename touched bytes beyond the label token');
  ws.destroy();
});

// 4. Resize: at/size quantity pairs are written; fit-to-members removes both
// keys; the scene frame rect reflects each change.
test('resize: at/size quantity pairs; fit-to-members removes both; scene rect follows', () => {
  const ws = fresh();
  CMD.createLane(D, ws, ENTRY, VIEW, { id: 'dmz', label: 'DMZ', at: { x: 40, y: 400 }, size: { w: 420, h: 260 } });
  CMD.resizeLane(D, ws, ENTRY, VIEW, { frameId: 'dmz', at: { x: 50, y: 410 }, size: { w: 500, h: 300 } });
  let line = ws.getFiles()[ENTRY].split('\n').find(l => l.includes('frame dmz'));
  assert.ok(line.includes('at: [50px, 410px];') && line.includes('size: [500px, 300px];'), 'quantity pairs not written: ' + line);
  let rect = ws.renderSync({ entry: ENTRY, view: VIEW }).scene.frames.find(f => f.id === UID('deployment.dmz'));
  assert.deepStrictEqual([rect.x, rect.y, rect.w, rect.h], [50, 410, 500, 300]);
  CMD.resizeLane(D, ws, ENTRY, VIEW, { frameId: 'dmz', fit: true });
  line = ws.getFiles()[ENTRY].split('\n').find(l => l.includes('frame dmz'));
  assert.ok(!/at:|size:/.test(line), 'fit-to-members did not remove both keys: ' + line);
  rect = ws.renderSync({ entry: ENTRY, view: VIEW }).scene.frames.find(f => f.id === UID('deployment.dmz'));
  assert.deepStrictEqual([rect.x, rect.y, rect.w, rect.h], [0, 0, 300, 170], 'empty memberless frame did not fall back to the renderer default');
  ws.destroy();
});

// 5. VE-AC-040: assignToLane moves model.cloud from cloud_scope to
// local_scope. Both frames' members update in one transaction; every relation
// span and every non-frame view line is byte-identical — the acceptance
// case's expected text, byte-proven: no inferred relationship. One undo
// restores everything.
test('VE-AC-040 assignment: No placement relationship inferred without explicit action', () => {
  // Byte-prove the acceptance case's expected text before exercising it.
  const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'acceptance-plan.json'), 'utf8'));
  const ac = (plan.cases || plan).find(c => c.id === 'VE-AC-040');
  assert.strictEqual(ac.expected, 'No placement relationship inferred without explicit action', 'VE-AC-040 expected text changed');
  const ws = fresh(), before = ws.getFiles();
  const relationSpans = s => s.split('\n').filter(l => l.includes('relation '));
  CMD.assignToLane(D, ws, ENTRY, VIEW, { frameId: 'local_scope', elementIds: [UID('model.cloud')] });
  const after = ws.getFiles();
  const frames = ws.resolve(ENTRY, VIEW).view.frames;
  assert.deepStrictEqual(frames.find(f => f.id.endsWith('local_scope')).members, [UID('model.primary'), UID('model.local'), UID('model.cloud')]);
  assert.deepStrictEqual(frames.find(f => f.id.endsWith('cloud_scope')).members, [UID('model.follower')]);
  // No inferred relationship: every relation span byte-identical.
  assert.deepStrictEqual(relationSpans(after[ENTRY]), relationSpans(before[ENTRY]), 'a relation span changed');
  assert.deepStrictEqual(relationSpans(after['shared.ddn']), relationSpans(before['shared.ddn']));
  // Every non-frame line (view header, data block, comments, blanks) identical.
  const nonFrame = s => s.split('\n').filter(l => !/^\s*frame /.test(l));
  assert.deepStrictEqual(nonFrame(after[ENTRY]), nonFrame(before[ENTRY]), 'a non-frame line changed');
  assert.strictEqual(ws.history().canUndo, true);
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before, 'one undo did not restore everything');
  ws.destroy();
});

// 6. One-lane policy + coded rejection: moving an element already in another
// frame removes it from the old frame in the same commit (test 5 covers);
// assigning to a lane that does not exist is a coded rejection with no write.
test('one-lane policy: unknown lane is a coded rejection with no write', () => {
  const ws = fresh(), before = ws.getFiles();
  assert.throws(() => CMD.assignToLane(D, ws, ENTRY, VIEW, { frameId: 'no_such_lane', elementIds: [UID('model.cloud')] }), e => e.code === 'DDN-I033');
  assert.deepStrictEqual(ws.getFiles(), before, 'rejected assignment wrote source');
  // Element already in another frame: ends in exactly one lane.
  CMD.assignToLane(D, ws, ENTRY, VIEW, { frameId: 'cloud_scope', elementIds: [UID('model.primary')] });
  const frames = ws.resolve(ENTRY, VIEW).view.frames;
  assert.strictEqual(frames.filter(f => f.members.includes(UID('model.primary'))).length, 1, 'element in more than one lane');
  assert.deepStrictEqual(frames.find(f => f.id.endsWith('local_scope')).members, [UID('model.local')]);
  ws.destroy();
});

// 7. RT-105 partition path (gated — fails loudly when the artifacts are
// absent; never skipped silently). UML-activity partitions stay blocked until
// RT-105 lands.
test('RT-105 partition path: x_partition written/removed, PJ114 green in scratch', () => {
  const profiles = fs.readFileSync(path.join(ROOT, 'standard/registry/profiles/catalogue.json'), 'utf8');
  const extensions = fs.readFileSync(path.join(ROOT, 'standard/registry/extensions.json'), 'utf8');
  const quality = fs.readFileSync(path.join(ROOT, 'notation/runtime/ddn-profile-quality.js'), 'utf8');
  assert.ok(profiles.includes('"uml.activity@1"'), 'GATE: uml.activity@1 profile missing from the registry — RT-105 not landed');
  assert.ok(extensions.includes('"x_partition"'), 'GATE: x_partition contract missing from extensions.json — RT-105 not landed');
  assert.ok(quality.includes('DDN-PJ114'), 'GATE: DDN-PJ114 check missing from ddn-profile-quality.js — RT-105 not landed');
  const ws = fresh(ACT);
  ws.renderSync({ entry: 'act.ddn', view: 'fulfilment' });
  // assignToLane writes both the frame member ref and x_partition:{lane:"…"}.
  CMD.assignToLane(D, ws, 'act.ddn', 'fulfilment', { frameId: 'warehouse', elementIds: [ACT_UID('flow.start')] });
  let src = ws.getFiles()['act.ddn'];
  assert.ok(/object start "Start" \{ kind: "flow.start"; x_partition: \{ "lane": "warehouse" \}; \}/.test(src), 'x_partition not written: ' + src.split('\n').find(l => l.includes('object start')));
  assert.deepStrictEqual(ws.resolve('act.ddn', 'fulfilment').view.frames.find(f => f.id.endsWith('warehouse')).members, [ACT_UID('flow.pack'), ACT_UID('flow.start')]);
  // Renaming the lane, then re-assigning, keeps DDN-PJ114 green in scratch.
  CMD.renameLane(D, ws, 'act.ddn', 'fulfilment', { frameId: 'warehouse', label: 'Storage' });
  CMD.assignToLane(D, ws, 'act.ddn', 'fulfilment', { frameId: 'warehouse', elementIds: [ACT_UID('flow.end')] });
  src = ws.getFiles()['act.ddn'];
  assert.ok(src.includes('frame warehouse "Storage"'));
  ws.renderSync({ entry: 'act.ddn', view: 'fulfilment' });
  // unassignFromLane removes the member ref and the x_partition property.
  CMD.unassignFromLane(D, ws, 'act.ddn', 'fulfilment', { frameId: 'warehouse', elementIds: [ACT_UID('flow.start')] });
  src = ws.getFiles()['act.ddn'];
  assert.ok(!src.split('\n').find(l => l.includes('object start')).includes('x_partition'), 'x_partition not removed: ' + src.split('\n').find(l => l.includes('object start')));
  assert.ok(!ws.resolve('act.ddn', 'fulfilment').view.frames.find(f => f.id.endsWith('warehouse')).members.includes(ACT_UID('flow.start')));
  ws.renderSync({ entry: 'act.ddn', view: 'fulfilment' });
  ws.destroy();
});

// 8. Round-trip + determinism: fixture comments and non-view blocks
// byte-identical; two fresh workspaces + the same commands produce identical
// files; the CLI check passes on the edited files.
test('round-trip + determinism: unrelated blocks byte-identical; two runs identical; CLI check passes', () => {
  const sequence = (files) => {
    const ws = fresh(files);
    CMD.createLane(D, ws, ENTRY, VIEW, { id: 'dmz', label: 'DMZ', at: { x: 40, y: 400 }, size: { w: 420, h: 260 } });
    CMD.renameLane(D, ws, ENTRY, VIEW, { frameId: 'local_scope', label: 'ON-PREMISES (EAST)' });
    CMD.resizeLane(D, ws, ENTRY, VIEW, { frameId: 'dmz', at: { x: 50, y: 410 }, size: { w: 500, h: 300 } });
    CMD.assignToLane(D, ws, ENTRY, VIEW, { frameId: 'local_scope', elementIds: [UID('model.cloud')] });
    const out = ws.getFiles();
    ws.destroy();
    return out;
  };
  const run1 = sequence(HYBRID), run2 = sequence(HYBRID);
  assert.deepStrictEqual(run1, run2, 'same commands on fresh workspaces diverged');
  // Non-view blocks (the whole data model block) and comments byte-identical.
  const dataBlock = s => s.slice(s.indexOf('data model {'), s.indexOf('view deployment'));
  assert.strictEqual(dataBlock(run1[ENTRY]), dataBlock(HYBRID[ENTRY]), 'the shared data block changed');
  assert.strictEqual(run1['shared.ddn'], HYBRID['shared.ddn'], 'the shared import changed');
  // CLI check on the edited files (temp workspace copy).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ed-011-'));
  for (const [name, text] of Object.entries(run1)) fs.writeFileSync(path.join(dir, name), text);
  const cli = path.join(ROOT, 'notation/cli/cli.js');
  const r = cp.spawnSync(process.execPath, [cli, 'check', path.join(dir, '04-hybrid.ddn'), '--workspace', dir], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, 'CLI check failed: ' + r.stdout + r.stderr);
  assert.ok(r.stdout.includes('"status": "pass-core"'), 'CLI check did not pass: ' + r.stdout);
});
console.log('ED-011 ' + pass + '/' + (pass + fail));
if (fail) process.exitCode = 1;
