// SPDX-License-Identifier: GPL-2.0-or-later.
// ED-003 behavior suite: chart editor commands (records, marks, encodings).
// Harness style imitates notation/tests/projections.js. No dependencies.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
const D = require('../../notation/dist/ddn.global.js');
const CMD = require('../prototype/commands.js');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

const ENTRY = 'projections/views.ddn';
const M = 'meridian.procurement.review::';
function fixtureFiles() {
  const files = {};
  for (const f of ['model.ddn', 'views.ddn', 'formats.ddn'])
    files['projections/' + f] = fs.readFileSync(path.join(__dirname, '..', '..', 'examples', 'projections', f), 'utf8');
  return files;
}
function qualityFiles() {
  const dir = path.join(__dirname, '..', '..', 'examples', 'quality'), files = {};
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.ddn')))
    files['quality/' + f] = fs.readFileSync(path.join(dir, f), 'utf8');
  return files;
}
function recId(local) { return M + 'facts.' + local; }
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

// 1. Record value edit: m2 value 570 -> 600; Feb point y is 600; diff touches only the m2 x_record span; undo restores exact bytes.
test('record value edit: m2 value 570 to 600 rewrites only the m2 x_record span; undo restores exact bytes', () => {
  const files = fixtureFiles(), before = { ...files };
  const ws = D.createWorkspace(files);
  const modelBefore = files['projections/model.ddn'];
  CMD.editRecordValue(D, ws, ENTRY, 'chart_bar', { id: recId('m2'), key: 'value', value: 600 });
  const plan = ws.projectionPlan(ENTRY, 'chart_bar');
  assert.strictEqual(plan.points[1].y, 600);
  assert.deepStrictEqual(plan.points[1].sourceIds, [recId('m2')]);
  const modelAfter = ws.getFiles()['projections/model.ddn'];
  const d = diffSpan(modelBefore, modelAfter);
  const block = blockSpan(modelBefore, 'object m2');
  assert.ok(d.s >= block.start && d.ea <= block.end, 'edit escaped the m2 record block');
  assert.ok(modelAfter.slice(block.start, block.end).includes('"value": 600'), 'new value not written into m2');
  const others = { ...ws.getFiles() }; delete others['projections/model.ddn'];
  const rest = fixtureFiles(); delete rest['projections/model.ddn'];
  assert.deepStrictEqual(others, rest, 'edit touched a second file');
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before);
  ws.destroy();
});

// 2. Record add: full key set, binding appended, 7 points; one undo removes definition and binding.
test('record add: addChartRecord clones the key set and appends the binding; one undo removes both', () => {
  const ws = D.createWorkspace(fixtureFiles());
  CMD.addChartRecord(D, ws, ENTRY, 'chart_bar', { id: 'm7', name: 'Jul observation' });
  const ir = ws.resolve(ENTRY, 'chart_bar');
  const made = ir.elements.find(n => n.local === 'm7');
  assert.ok(made, 'new record missing from the resolved view');
  assert.strictEqual(made.kind, 'record');
  assert.deepStrictEqual(Object.keys(made.properties.x_record), Object.keys(ir.elements.find(n => n.local === 'm1').properties.x_record));
  const proj = ir.view.profiles.projection;
  assert.strictEqual(proj.records.length, 7, 'binding not appended to projection.records');
  assert.strictEqual(ws.projectionPlan(ENTRY, 'chart_bar').points.length, 7);
  ws.undo();
  const back = ws.resolve(ENTRY, 'chart_bar');
  assert.ok(!back.elements.some(n => n.local === 'm7'), 'definition survived undo');
  assert.strictEqual(back.view.profiles.projection.records.length, 6, 'binding survived undo');
  ws.destroy();
});

// 3. Record delete: unreferenced new record deletes; bound m1 surfaces DDN-E004; same-transaction unbind+delete works.
test('record delete: guarded delete refuses bound records (DDN-E004); unbind+delete in one transaction works', () => {
  const ws = D.createWorkspace(fixtureFiles()), before = ws.getFiles();
  // Bound record: m1 is referenced by this and other chart/table views.
  assert.throws(() => CMD.deleteChartRecord(D, ws, ENTRY, 'chart_bar', { id: recId('m1') }), e => e.code === 'DDN-E004');
  assert.deepStrictEqual(ws.getFiles(), before, 'refused delete left edits behind');
  // Raw deleteDefinition on a bound record also refuses, proving the binding removal is required.
  assert.throws(() => {
    const t = D.createWorkspace(fixtureFiles());
    try { D.authoring.deleteDefinition(t, ENTRY, 'chart_bar', recId('m2')); } finally { t.destroy(); }
  }, e => e.code === 'DDN-E004');
  // New record bound only here: deleteChartRecord removes binding + definition in one transaction.
  CMD.addChartRecord(D, ws, ENTRY, 'chart_bar', { id: 'm9', name: 'Extra observation' });
  const made = ws.resolve(ENTRY, 'chart_bar').elements.find(n => n.local === 'm9');
  CMD.deleteChartRecord(D, ws, ENTRY, 'chart_bar', { id: made.id });
  const ir = ws.resolve(ENTRY, 'chart_bar');
  assert.ok(!ir.elements.some(n => n.local === 'm9'), 'definition survived delete');
  assert.strictEqual(ir.view.profiles.projection.records.length, 6, 'binding survived delete');
  assert.strictEqual(ws.projectionPlan(ENTRY, 'chart_bar').points.length, 6);
  ws.undo(); ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before, 'two undos did not restore the fixture');
  ws.destroy();
});

// 4. Mark switch: line then pie then bar; SVG differs per mark; diff span stays inside the chart_bar projection group.
test('mark switch: setChartMark writes projection.mark and re-renders; diffs stay in the chart_bar view block', () => {
  const ws = D.createWorkspace(fixtureFiles());
  const viewsBefore = ws.getFiles()['projections/views.ddn'];
  const svg = mark => ws.renderSync({ entry: ENTRY, view: 'chart_bar' }).svg;
  const bar = svg();
  CMD.setChartMark(D, ws, ENTRY, 'chart_bar', { mark: 'line' });
  const viewsLine = ws.getFiles()['projections/views.ddn'];
  const cb = blockSpan(viewsLine, 'view chart_bar');
  assert.ok(/mark:\s*"line";/.test(viewsLine.slice(cb.start, cb.end)), 'mark line not written into the projection group');
  const line = svg();
  assert.notStrictEqual(line, bar, 'line SVG identical to bar SVG');
  const d1 = diffSpan(viewsBefore, viewsLine);
  const block = blockSpan(viewsBefore, 'view chart_bar');
  assert.ok(d1.s >= block.start && d1.ea <= block.end, 'mark diff escaped the chart_bar view block');
  CMD.setChartMark(D, ws, ENTRY, 'chart_bar', { mark: 'pie' });
  const pie = svg();
  assert.notStrictEqual(pie, line, 'pie SVG identical to line SVG');
  const d2 = diffSpan(viewsLine, ws.getFiles()['projections/views.ddn']);
  assert.ok(d2.s >= block.start && d2.ea <= block.end + 4, 'second mark diff escaped the chart_bar view block');
  CMD.setChartMark(D, ws, ENTRY, 'chart_bar', { mark: 'bar' });
  assert.strictEqual(svg(), bar, 'returning to bar did not restore the original SVG');
  ws.undo(); ws.undo(); ws.undo();
  assert.strictEqual(ws.getFiles()['projections/views.ddn'], viewsBefore, 'undo chain did not restore views.ddn bytes');
  ws.destroy();
});

// 5. Legal-mark enforcement: picker list from capabilities.marks; illegal marks pre-rejected by the command and rejected by the runtime.
test('legal marks: capabilities.marks is the picker source; pie on scatter is pre-rejected and DDN-PJ030 on commit', () => {
  const ws = D.createWorkspace(fixtureFiles());
  assert.deepStrictEqual(ws.inspect(ENTRY, 'scatter').capabilities.marks, ['source', 'point', 'line', 'area']);
  assert.throws(() => CMD.setChartMark(D, ws, ENTRY, 'scatter', { mark: 'pie' }), e => e.code === 'DDN-I033');
  // Bypassing the command pre-check reaches the runtime validator.
  assert.throws(() => CMD.editProjectionProperty(D, ws, ENTRY, 'scatter', { key: 'mark', value: 'pie' }), e => e.code === 'DDN-PJ030');
  assert.strictEqual(ws.resolve(ENTRY, 'scatter').view.profiles.projection.mark, 'point', 'rejected mark changed source');
  // Quality profile: restricted legal set and the same picker source.
  const qws = D.createWorkspace(qualityFiles());
  assert.deepStrictEqual(qws.inspect('quality/views.ddn', 'grouped_bars').capabilities.marks, ['source', 'bar', 'line', 'area', 'point']);
  CMD.setChartMark(D, qws, 'quality/views.ddn', 'grouped_bars', { mark: 'line' });
  assert.strictEqual(qws.resolve('quality/views.ddn', 'grouped_bars').view.profiles.projection.mark, 'line');
  qws.destroy();
  ws.destroy();
});

// 6. VE-AC-052: an aggregated point lists every contributing record id; no synthetic total record appears in source.
test('VE-AC-052 contributors: aggregated point sourceIds list both inputs; no synthetic record in source', () => {
  const files = fixtureFiles();
  files['projections/model.ddn'] = files['projections/model.ddn'].replace(
    'object m6 "Jun observation"',
    'object m7 "Jan repeat observation" { kind: record; x_record: {"month": "Jan", "date": "2026-01-15", "value": 100, "cost": 40, "count": 2, "unit": "CAD", "description": "Synthetic monthly procurement value"}; }\n    object m6 "Jun observation"');
  files['projections/views.ddn'] = files['projections/views.ddn'].replace(
    'records:[@m.facts.m1, @m.facts.m2, @m.facts.m3, @m.facts.m4, @m.facts.m5, @m.facts.m6];mark:bar;',
    'records:[@m.facts.m1, @m.facts.m2, @m.facts.m3, @m.facts.m4, @m.facts.m5, @m.facts.m6, @m.facts.m7];mark:bar;aggregate:"sum";');
  const ws = D.createWorkspace(files);
  const plan = ws.projectionPlan(ENTRY, 'chart_bar');
  assert.strictEqual(plan.points.length, 6, 'duplicate month did not aggregate into one point');
  const jan = plan.points.find(p => p.x === 'Jan');
  assert.deepStrictEqual(jan.sourceIds.sort(), [recId('m1'), recId('m7')].sort());
  assert.strictEqual(jan.y, 520, 'sum aggregate did not total both inputs');
  const source = ws.getFiles()['projections/model.ddn'] + ws.getFiles()['projections/views.ddn'];
  assert.ok(!/object\s+\w*total\w*\s/i.test(source), 'synthetic total record appeared in source');
  assert.strictEqual(ws.resolve(ENTRY, 'chart_bar').elements.filter(n => n.kind === 'record' && n.local.startsWith('m')).length, 7, 'editor model gained an invented record');
  ws.destroy();
});

// 7. VE-AC-053: binding unit USD against CAD records fails DDN-PJ034; revision and bytes unchanged.
test('VE-AC-053 units: setChartBinding unit USD against CAD records rejects DDN-PJ034 with no partial write', () => {
  const ws = D.createWorkspace(fixtureFiles()), before = ws.getFiles(), rev = ws.revision;
  assert.throws(() => CMD.setChartBinding(D, ws, ENTRY, 'chart_bar', { key: 'unit', value: 'USD' }), e => e.code === 'DDN-PJ034');
  assert.strictEqual(ws.revision, rev, 'rejected binding changed the workspace revision');
  assert.deepStrictEqual(ws.getFiles(), before, 'rejected binding left a partial write');
  ws.destroy();
});

// 8. Round-trip: fixture comments and all non-chart_bar view blocks byte-identical after the full edit battery.
test('round-trip: fixture comments and non-edited view blocks are byte-identical after every edit', () => {
  const files = fixtureFiles();
  const modelBefore = files['projections/model.ddn'], viewsBefore = files['projections/views.ddn'];
  const comments = modelBefore.split('\n').filter(l => l.trim().startsWith('//'));
  assert.ok(comments.length > 0, 'fixture has no comments to protect');
  const ws = D.createWorkspace(files);
  CMD.editRecordValue(D, ws, ENTRY, 'chart_bar', { id: recId('m2'), key: 'value', value: 600 });
  CMD.setChartMark(D, ws, ENTRY, 'chart_bar', { mark: 'line' });
  CMD.addChartRecord(D, ws, ENTRY, 'chart_bar', { id: 'm7', name: 'Jul observation' });
  CMD.deleteChartRecord(D, ws, ENTRY, 'chart_bar', { id: ws.resolve(ENTRY, 'chart_bar').elements.find(n => n.local === 'm7').id });
  CMD.setChartMark(D, ws, ENTRY, 'chart_bar', { mark: 'bar' });
  const modelAfter = ws.getFiles()['projections/model.ddn'], viewsAfter = ws.getFiles()['projections/views.ddn'];
  for (const c of comments) assert.ok(modelAfter.includes(c), 'comment lost: ' + c);
  for (const v of ['flowchart', 'responsibility_graph', 'raci', 'chart_line', 'scatter', 'time_series', 'record_table', 'gantt']) {
    const b0 = blockSpan(viewsBefore, 'view ' + v + ' '), b1 = blockSpan(viewsAfter, 'view ' + v + ' ');
    assert.strictEqual(viewsAfter.slice(b1.start, b1.end), viewsBefore.slice(b0.start, b0.end), 'view block altered: ' + v);
  }
  ws.undo(); ws.undo(); ws.undo(); ws.undo(); ws.undo();
  assert.deepStrictEqual(ws.getFiles(), files, 'undo history did not restore the fixture byte-exactly');
  ws.destroy();
});

// 9. Contract: the setProjectionBinding branch validates the example fixture and rejects extra envelope keys.
test('contract: setProjectionBinding branch shape validates the fixture and rejects additional properties', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contracts', 'command.schema.json'), 'utf8'));
  const examples = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contracts', 'command.examples.json'), 'utf8'));
  assert.strictEqual(schema.oneOf.length, 14, 'schema does not have exactly 14 branches (13 existing + setProjectionBinding)');
  const branch = schema.oneOf.filter(b => b.properties?.type?.const === 'setProjectionBinding');
  assert.strictEqual(branch.length, 1, 'exactly one setProjectionBinding branch required');
  const b = branch[0];
  const check = (value, node, where) => {
    for (const k of node.required || []) assert.ok(Object.prototype.hasOwnProperty.call(value, k), where + ' missing required key ' + k);
    if (node.additionalProperties === false)
      for (const k of Object.keys(value)) assert.ok(Object.prototype.hasOwnProperty.call(node.properties, k), where + ' has additional property ' + k);
  };
  const fixture = examples.find(e => e.type === 'setProjectionBinding');
  assert.ok(fixture, 'command.examples.json has no setProjectionBinding fixture');
  check(fixture, b, 'envelope');
  check(fixture.payload, b.properties.payload, 'payload');
  assert.ok(b.properties.payload.properties.key.enum.includes(fixture.payload.key), 'fixture key outside the binding allowlist');
  const extra = { ...fixture, bogus: true };
  assert.throws(() => check(extra, b, 'envelope'), /additional property bogus/);
  const extraPayload = { ...fixture, payload: { ...fixture.payload, bogus: 1 } };
  assert.throws(() => check(extraPayload.payload, b.properties.payload, 'payload'), /additional property bogus/);
  // Existing branches untouched.
  const types = schema.oneOf.map(x => x.properties.type.const);
  for (const t of ['createDefinition', 'addExistingToView', 'createRelation', 'reconnectRelation', 'setMeaningProperty', 'setViewOverride', 'moveOccurrences', 'applyLayout', 'convertKind', 'removeOccurrence', 'deleteDefinition', 'moveMember', 'setMatrixAssignments'])
    assert.ok(types.includes(t), 'existing branch missing: ' + t);
});

// 10. Determinism: the same edit battery on two fresh workspaces yields identical files.
test('determinism: identical edit battery on two fresh workspaces yields identical files', () => {
  const run = () => {
    const ws = D.createWorkspace(fixtureFiles());
    CMD.editRecordValue(D, ws, ENTRY, 'chart_bar', { id: recId('m2'), key: 'value', value: 600 });
    CMD.setChartMark(D, ws, ENTRY, 'chart_bar', { mark: 'line' });
    CMD.addChartRecord(D, ws, ENTRY, 'chart_bar', { id: 'm7', name: 'Jul observation' });
    CMD.editRecordValue(D, ws, ENTRY, 'chart_bar', { id: ws.resolve(ENTRY, 'chart_bar').elements.find(n => n.local === 'm7').id, key: 'value', value: 55 });
    const out = ws.getFiles();
    ws.destroy();
    return out;
  };
  assert.deepStrictEqual(run(), run());
});

console.log('ED-003 ' + pass + '/' + (pass + fail));
if (fail) process.exitCode = 1;
