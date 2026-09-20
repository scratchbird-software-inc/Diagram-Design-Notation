// SPDX-License-Identifier: GPL-2.0-or-later.
// ED-008 behavior/contract suite: edge reconnection commands (reconnect
// source/target) with identity preservation, contract validation and one-undo
// restore. Primary fixture = the prototype's own workspace.json read from disk.
// Harness style imitates notation/tests/projections.js. No dependencies.
'use strict';
const assert = require('assert');
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const D = require('../../notation/dist/ddn.global.js');
const CMD = require('../prototype/commands.js');
const RELMAP = require('../contracts/relation-ui-map.json');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

const FILES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'prototype', 'workspace.json'), 'utf8'));
const M = 'designer.sample::';
const ENTRY = 'model.ddn', VIEW = 'overview';
const fresh = (files) => D.createWorkspace(files || FILES);
const endId = e => e.field || e.member || e.port || e.element;
function relationBlock(text, files2, id) {
  const ws = fresh(files2); const ir = ws.resolve(ENTRY, VIEW);
  const r = ir.relations.find(x => x.id === id); const s = r.source;
  const out = text.slice(s.start, s.end); ws.destroy(); return out;
}
// Mirror of app.js usage()/selectionOwner(): views that select the definition.
function usage(ws, entry, id) {
  const ir = ws.resolve(entry, VIEW);
  const owner = ir.elements.find(n => n.id === id || n.fields.some(f => f.id === id))?.id || null;
  const names = [];
  for (const v of ws.views(entry)) {
    try { const p = ws.resolve(entry, v.id); if (p.view.selected.includes(owner || id) || p.view.relations.includes(id)) names.push(v.id); } catch { }
  }
  return names;
}

// 1. VE-AC-023 happy path: reconnect order_customer.to from customer.id to
// customer.display_name; identity preserved byte-level; one undo restores.
test('VE-AC-023 happy path: to-endpoint field move preserves identity; one undo restores exact bytes', () => {
  const before = FILES[ENTRY];
  const ws = fresh();
  const idBefore = ws.resolve(ENTRY, VIEW).relations.find(r => r.id === M + 'model.order_customer');
  const blockBefore = before.slice(idBefore.source.start, idBefore.source.end);
  CMD.reconnectRelation(D, ws, ENTRY, VIEW, { relationId: M + 'model.order_customer', end: 'to', endpoint: { elementId: M + 'model.customer', memberId: M + 'model.customer.display_name' } }, RELMAP);
  const after = ws.getFiles()[ENTRY];
  const r = ws.resolve(ENTRY, VIEW).relations.find(x => x.id === M + 'model.order_customer');
  assert.ok(r, 'relation id changed or lost after reconnect');
  assert.strictEqual(endId(r.to), M + 'model.customer.display_name');
  assert.strictEqual(endId(r.from), M + 'model.orders.customer_id', 'from endpoint moved');
  const blockAfter = after.slice(r.source.start, r.source.end);
  assert.strictEqual(blockAfter, blockBefore.replace('@model.customer.id', '@model.customer.display_name'),
    'more than the second @-path changed (label, kind, enforcement or the from span differ)');
  for (const kept of ['"Customer reference"', 'kind: ref;', 'enforcement: undecided;', '@model.orders.customer_id'])
    assert.ok(blockAfter.includes(kept), 'identity span altered: ' + kept);
  assert.strictEqual((blockAfter.match(/@model\.orders\.customer_id/g) || []).length, 1, 'from-endpoint span not byte-identical');
  ws.undo();
  assert.strictEqual(ws.getFiles()[ENTRY], before, 'one undo did not restore the exact original file');
  ws.destroy();
});

// 2. Element-level reconnect: invoice_post.from from model.invoice to
// model.orders (object endpoints, no member) — valid per flow's contract.
test('element-level reconnect: invoice_post from invoice to orders per flow contract', () => {
  const contract = RELMAP.relations.find(x => x.id === 'flow').semantic_contract;
  assert.ok(contract.source.includes('table') && contract.member_endpoints === true, 'flow contract premise changed');
  const ws = fresh();
  const out = CMD.reconnectRelation(D, ws, ENTRY, VIEW, { relationId: M + 'model.invoice_post', end: 'from', endpoint: { elementId: M + 'model.orders' } }, RELMAP);
  assert.strictEqual(out.previous, 'model.invoice');
  assert.strictEqual(out.proposed, 'model.orders');
  const r = ws.resolve(ENTRY, VIEW).relations.find(x => x.id === M + 'model.invoice_post');
  assert.strictEqual(endId(r.from), M + 'model.orders');
  assert.strictEqual(endId(r.to), M + 'model.posting', 'other endpoint moved');
  assert.ok(ws.renderSync({ entry: ENTRY, view: VIEW }).svg.includes('<svg'), 'view does not re-render after move');
  ws.destroy();
});

// 3. Identity across views: after test 1 both overview and names re-render with
// the same relation id and new field endpoint; the impact model lists both.
test('identity across views: overview and names share the moved relation; impact lists both', () => {
  const ws = fresh();
  CMD.reconnectRelation(D, ws, ENTRY, VIEW, { relationId: M + 'model.order_customer', end: 'to', endpoint: { elementId: M + 'model.customer', memberId: M + 'model.customer.display_name' } }, RELMAP);
  for (const v of ['overview', 'names']) {
    const ir = ws.resolve(ENTRY, v);
    const r = ir.relations.find(x => x.id === M + 'model.order_customer');
    assert.ok(r, 'relation missing in view ' + v);
    assert.strictEqual(endId(r.to), M + 'model.customer.display_name', 'view ' + v + ' did not pick up the shared edit');
    assert.ok(ws.renderSync({ entry: ENTRY, view: v }).svg.includes('<svg'), 'view ' + v + ' failed to re-render');
  }
  assert.deepStrictEqual(usage(ws, ENTRY, M + 'model.order_customer'), ['overview', 'names'], 'impact model does not list both views');
  ws.destroy();
});

// 4. Negatives: each rejected before staging with a plain-language reason; the
// real revision and bytes never change.
test('negatives: six illegal reconnections reject before staging; workspace unchanged', () => {
  const cause = RELMAP.relations.find(x => x.id === 'quality.cause').semantic_contract;
  assert.ok(cause.member_endpoints === false && cause.allow_self === false, 'quality.cause contract premise changed');
  const assign = RELMAP.relations.find(x => x.id === 'analysis.assignment').semantic_contract;
  assert.deepStrictEqual(assign.target, ['analysis.role', 'team'], 'analysis.assignment contract premise changed');
  const P = 'meridian.procurement.review::';
  const cases = [
    ['member of another element', () => [ENTRY, VIEW, { relationId: M + 'model.order_customer', end: 'to', endpoint: { elementId: M + 'model.customer', memberId: M + 'model.orders.id' } }], 'DDN-I033', /does not belong/],
    ['member and port together (schema rule)', () => [ENTRY, VIEW, { relationId: M + 'model.order_customer', end: 'to', endpoint: { elementId: M + 'model.customer', memberId: M + 'model.customer.id', portId: M + 'model.customer.p1' } }], 'DDN-I033', /never both/],
    ['member endpoint on quality.cause (member_endpoints:false)', () => ['projections/views.ddn', 'fishbone', { relationId: P + 'causes.c_calibration', end: 'to', endpoint: { elementId: P + 'causes.cat0', memberId: P + 'causes.cat0.note' } }], 'DDN-I033', /does not accept a field endpoint/],
    ['self-loop on quality.cause (allow_self:false)', () => ['projections/views.ddn', 'fishbone', { relationId: P + 'causes.c_calibration', end: 'from', endpoint: { elementId: P + 'causes.cat0' } }], 'DDN-I033', /cannot loop back/],
    ['target kind outside analysis.assignment target list', () => ['projections/views.ddn', 'raci', { relationId: P + 'responsibilities.order_r', end: 'to', endpoint: { elementId: P + 'process.receive' } }], 'DDN-I033', /must be one of/],
    ['endpoint element does not exist', () => [ENTRY, VIEW, { relationId: M + 'model.order_customer', end: 'to', endpoint: { elementId: M + 'model.ghost' } }], 'DDN-E002', /not found/],
  ];
  for (const [name, make, code, reason] of cases) {
    const ws = fresh();
    const [entry, view, args] = make();
    const revBefore = ws.revision, filesBefore = ws.getFiles();
    assert.throws(() => CMD.reconnectRelation(D, ws, entry, view, args, RELMAP),
      e => e.code === code && reason.test(e.message), name + ': expected ' + code + ' with a plain-language reason');
    assert.strictEqual(ws.revision, revBefore, name + ': revision moved on rejection');
    assert.deepStrictEqual(ws.getFiles(), filesBefore, name + ': bytes changed on rejection');
    ws.destroy();
  }
});

// 5. Route retention: a route @model.order_customer override in the view stays
// byte-identical and still resolves after the relation is reconnected.
test('route retention: route override block byte-identical and resolving after the move', () => {
  const ROUTE = '\n    route @model.order_customer { source_side: east; target_side: west; }';
  const files = { ...FILES };
  files[ENTRY] = FILES[ENTRY].replace('view overview "Customer orders / structural view" {\n    data: [@model]; format: @common.design;\n}',
    'view overview "Customer orders / structural view" {\n    data: [@model]; format: @common.design;' + ROUTE + '\n}');
  assert.notStrictEqual(files[ENTRY], FILES[ENTRY], 'inline fixture mutation did not apply');
  const ws = fresh(files);
  assert.ok(ws.renderSync({ entry: ENTRY, view: VIEW }).svg.includes('<svg'), 'fixture with route override does not render');
  CMD.reconnectRelation(D, ws, ENTRY, VIEW, { relationId: M + 'model.order_customer', end: 'to', endpoint: { elementId: M + 'model.customer', memberId: M + 'model.customer.display_name' } }, RELMAP);
  const after = ws.getFiles()[ENTRY];
  assert.ok(after.includes(ROUTE.trim()), 'route override block altered by the reconnect');
  const out = ws.renderSync({ entry: ENTRY, view: VIEW });
  assert.ok(out.svg.includes('<svg'), 'route override no longer resolves after the move');
  assert.ok(out.scene.routes.some(r => r.id === M + 'model.order_customer' && r.source_side === 'east' && r.target_side === 'west'), 'route override not applied to the moved edge');
  ws.destroy();
});

// 6. Contract: a reconnectRelation envelope validates against the schema
// branch's required keys/shape; memberId+portId is rejected by the not clause.
test('contract: reconnectRelation branch shape; member XOR port enforced by the not clause', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contracts', 'command.schema.json'), 'utf8'));
  const examples = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contracts', 'command.examples.json'), 'utf8'));
  const branch = schema.oneOf.filter(b => b.properties?.type?.const === 'reconnectRelation');
  assert.strictEqual(branch.length, 1, 'exactly one reconnectRelation branch required');
  const b = branch[0];
  const check = (value, node, where) => {
    for (const k of node.required || []) assert.ok(Object.prototype.hasOwnProperty.call(value, k), where + ' missing required key ' + k);
    if (node.additionalProperties === false)
      for (const k of Object.keys(value)) assert.ok(Object.prototype.hasOwnProperty.call(node.properties, k), where + ' has additional property ' + k);
    if (node.not && node.not.required && node.not.required.every(k => Object.prototype.hasOwnProperty.call(value, k)))
      throw new Error(where + ' violates the not clause (' + node.not.required.join('+') + ')');
  };
  const fixture = examples.find(e => e.type === 'reconnectRelation');
  assert.ok(fixture, 'command.examples.json has no reconnectRelation fixture');
  check(fixture, b, 'envelope');
  check(fixture.payload, b.properties.payload, 'payload');
  check(fixture.payload.endpoint, b.properties.payload.properties.endpoint, 'endpoint');
  assert.deepStrictEqual(b.properties.payload.properties.end.enum, ['from', 'to']);
  assert.deepStrictEqual(b.properties.payload.properties.endpoint.not.required, ['memberId', 'portId']);
  const both = { ...fixture.payload.endpoint, memberId: 'a.b', portId: 'a.p1' };
  assert.throws(() => check(both, b.properties.payload.properties.endpoint, 'endpoint'), /not clause/);
  // The same shape runs the real command (endpoint fixture resolves in the prototype workspace).
  const ws = fresh();
  const revBefore = ws.revision, filesBefore = ws.getFiles();
  assert.throws(() => CMD.reconnectRelation(D, ws, ENTRY, VIEW, { relationId: M + 'model.order_customer', end: 'to', endpoint: { elementId: M + 'model.customer', memberId: M + 'model.customer.id', portId: M + 'model.customer.p1' } }, RELMAP), /never both/);
  assert.strictEqual(ws.revision, revBefore); assert.deepStrictEqual(ws.getFiles(), filesBefore);
  ws.destroy();
});

// 7. Round-trip + determinism: fixture comment and the second relation's full
// span byte-identical after all edits; two fresh workspaces + same command →
// identical files; CLI check passes on the edited files.
test('round-trip + determinism: comment and unrelated relation byte-identical; CLI check passes', () => {
  const COMMENT = '// Shared definition edits must preserve this comment.';
  const blockInvoiceBefore = relationBlock(FILES[ENTRY], FILES, M + 'model.invoice_order');
  const run = () => {
    const ws = fresh();
    CMD.reconnectRelation(D, ws, ENTRY, VIEW, { relationId: M + 'model.order_customer', end: 'to', endpoint: { elementId: M + 'model.customer', memberId: M + 'model.customer.display_name' } }, RELMAP);
    CMD.reconnectRelation(D, ws, ENTRY, VIEW, { relationId: M + 'model.invoice_post', end: 'from', endpoint: { elementId: M + 'model.orders' } }, RELMAP);
    const files = ws.getFiles(); ws.destroy(); return files;
  };
  const a = run(), b = run();
  assert.deepStrictEqual(a, b, 'same command battery on fresh workspaces diverged');
  assert.ok(a[ENTRY].includes(COMMENT), 'fixture comment lost');
  assert.strictEqual(relationBlock(a[ENTRY], a, M + 'model.invoice_order'), blockInvoiceBefore, 'unrelated relation span altered');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ed-008-'));
  for (const [name, text] of Object.entries(a)) { fs.mkdirSync(path.join(dir, path.dirname(name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), text); }
  const out = cp.spawnSync(process.execPath, [path.join(__dirname, '..', '..', 'notation', 'cli', 'cli.js'), 'check', ENTRY, '--workspace', '.'], { encoding: 'utf8', cwd: dir });
  assert.strictEqual(out.status, 0, 'CLI check failed on edited files: ' + out.stderr + out.stdout);
  assert.ok(out.stdout.includes('pass-core'), 'CLI check did not pass-core: ' + out.stdout);
});

console.log(`ED-008 ${pass}/${pass + fail}`);
if (fail) process.exitCode = 1;
