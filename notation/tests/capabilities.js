/* SPDX-License-Identifier: GPL-2.0-or-later. Designer redesign phase 2:
 * capability metadata (ddn-capabilities.js) — allowed_in derivation, view
 * capability matching, endpoint-pair verb legality, and the DDNLive surface
 * (kinds/relations allowed_in, legalVerbs). */
'use strict';
const assert = require('node:assert/strict');
const Capabilities = require('../runtime/ddn-capabilities.js').default;
const A = require('../dist/ddn.global.js');

const results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { results.push({ name, pass: false }); console.error('FAIL', name, e.stack); process.exitCode = 1; } }

const registry = A.engineAssets.registry;
const maps = Capabilities.deriveAllowedIn(registry, A.profileCatalogue);
const knownTags = new Set();
for (const p of A.profileCatalogue.profiles) { knownTags.add(p.id); knownTags.add(p.projection); }

test('every registered kind and relation has a non-empty allowed_in of known tags', () => {
  for (const k of registry.kinds) {
    const a = maps.kinds[k.keyword];
    assert.ok(a && a.length, 'kind ' + k.keyword + ' has no capabilities');
    for (const t of a) assert.ok(knownTags.has(t), 'kind ' + k.keyword + ': unknown tag ' + t);
  }
  for (const r of registry.relationships) {
    const a = maps.relations[r.keyword];
    assert.ok(a && a.length, 'relation ' + r.keyword + ' has no capabilities');
    for (const t of a) assert.ok(knownTags.has(t), 'relation ' + r.keyword + ': unknown tag ' + t);
  }
});

test('generic kinds default to graph; validator-backed extras are present', () => {
  assert.deepEqual(maps.kinds['table'], ['graph']);
  for (const t of ['graph', 'mindmap.basic@1', 'concept.map@1']) assert.ok(maps.kinds['object'].includes(t), 'object missing ' + t);
  assert.ok(maps.kinds['entity'].includes('chen'), 'entity participates in chen projections');
  assert.ok(maps.kinds['analysis.role'].includes('org.tree@1') && !maps.kinds['analysis.role'].includes('wbs.tree@1'), 'analysis.role belongs to org.tree@1 only');
  assert.ok(maps.kinds['analysis.task'].includes('wbs.tree@1'), 'analysis.task belongs to wbs.tree@1');
});

test('profile kinds carry their owning profile ids plus non-graph projection tags', () => {
  for (const t of ['flow.basic@1', 'flow.documented@2', 'flow.iso5807@1']) assert.ok(maps.kinds['flow.process'].includes(t), 'flow.process missing ' + t);
  assert.ok(!maps.kinds['flow.process'].includes('graph'), 'bare graph tag belongs to unprofiled views');
  for (const t of ['uml.activity@1', 'uml.activity@2', 'sysml.activity@1', 'bpmn.process@1']) assert.ok(maps.kinds['flow.process'].includes(t), 'flow.process cross-profile ' + t);
  assert.ok(maps.kinds['uml.class'].includes('uml.structure@2'), 'uml.class in uml.structure@2');
  assert.ok(maps.kinds['uml.class'].includes('sequence'), 'uml.class appears in sequence projections');
  assert.ok(maps.kinds['rule.row'].includes('decision') && maps.kinds['rule.row'].includes('decision.rules@1'), 'rule.row is decision vocabulary');
  assert.ok(maps.kinds['quality.cause'].includes('fishbone.basic@1'), 'quality.cause is fishbone vocabulary');
  assert.ok(maps.kinds['tree.gate'].includes('fault.tree@1') && maps.kinds['tree.gate'].includes('event.tree@1'), 'tree.* belongs to fault/event trees');
});

test('verb allowed_in: flow.next stays with flowchart profiles; uml.flow reaches activity/bpmn', () => {
  assert.deepEqual(maps.relations['flow.next'].filter(t => t.startsWith('bpmn.')), [], 'flow.next is not BPMN vocabulary');
  for (const t of ['uml.activity@2', 'bpmn.process@1']) assert.ok(maps.relations['uml.flow'].includes(t), 'uml.flow missing ' + t);
  for (const t of ['mindmap.basic@1', 'erd.crowfoot@1', 'graph']) assert.ok(maps.relations['assoc'].includes(t), 'assoc missing ' + t);
  assert.ok(maps.relations['reports_to'].includes('org.tree@1'), 'reports_to belongs to org.tree@1');
});

test('viewCapabilities + allowedInView filter by projection kind and profile id', () => {
  assert.deepEqual(Capabilities.viewCapabilities({ kind: 'graph', profile: 'uml.structure@2' }), ['uml.structure@2']);
  assert.deepEqual(Capabilities.viewCapabilities({ kind: 'graph', profile: 'ddn@1' }), ['graph']);
  assert.deepEqual(Capabilities.viewCapabilities({ kind: 'chart', profile: 'chart.basic@1' }), ['chart', 'chart.basic@1']);
  assert.ok(Capabilities.allowedInView(maps.kinds['uml.class'], { kind: 'graph', profile: 'uml.structure@2' }));
  assert.ok(!Capabilities.allowedInView(maps.kinds['flow.process'], { kind: 'graph', profile: 'uml.structure@2' }));
  assert.ok(Capabilities.allowedInView(maps.kinds['table'], { kind: 'graph', profile: 'ddn@1' }));
  assert.ok(!Capabilities.allowedInView(maps.kinds['uml.class'], { kind: 'graph', profile: 'ddn@1' }));
});

test('legalVerbs matches the endpoint_contract data the core validator enforces', () => {
  const table2table = Capabilities.legalVerbs(registry, 'table', 'table');
  assert.ok(table2table.includes('assoc') && table2table.includes('ref') && table2table.includes('subtype'));
  assert.ok(!table2table.includes('reports_to'));
  assert.ok(Capabilities.legalVerbs(registry, 'flow.start', 'flow.process').includes('flow.next'));
  assert.ok(!Capabilities.legalVerbs(registry, 'flow.start', 'flow.process').includes('reports_to'));
});

test('DDNLive surface: kinds/relations carry allowed_in + group; legalVerbs exposed', () => {
  const k = A.kinds.find(x => x.id === 'uml.class');
  assert.ok(k && k.allowed_in.includes('uml.structure@2'), 'A.kinds entry missing allowed_in');
  assert.strictEqual(A.kinds.find(x => x.id === 'table').group, 'Data');
  assert.strictEqual(A.kinds.find(x => x.id === 'uml.class').group, 'Meaning');
  const r = A.relations.find(x => x.id === 'reports_to');
  assert.ok(r && r.allowed_in.includes('org.tree@1'), 'A.relations entry missing allowed_in');
  assert.deepEqual(A.legalVerbs('table', 'table'), Capabilities.legalVerbs(registry, 'table', 'table'));
  assert.ok(A.capabilities.paletteGroups.length === 8, 'eight palette groups');
});

test('designer contracts carry the same allowed_in the runtime derives (generator freshness)', () => {
  const cp = require('node:child_process'), path = require('node:path');
  const gen = path.resolve(__dirname, '..', '..', 'designer', 'contracts', 'build-allowed-in.mjs');
  const r = cp.spawnSync(process.execPath, [gen, '--check'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, 'contracts stale: ' + (r.stderr || r.stdout));
  const KINDMAP = require('../../designer/contracts/kind-ui-map.json');
  for (const e of KINDMAP.kinds) assert.deepEqual(e.allowed_in, maps.kinds[e.kind], 'contract drift on ' + e.kind);
});
