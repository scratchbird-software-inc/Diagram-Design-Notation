// SPDX-License-Identifier: GPL-2.0-or-later.
// ED-007 behavior suite: decision table editor commands (rule.row CRUD, typed
// predicate/outcome edits, records reorder, hit-policy/coverage view writes,
// analysis drafts VE-AC-059/060, fixture evaluation). Harness style imitates
// notation/tests/projections.js. No dependencies.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const D = require('../../notation/dist/ddn.global.js');
const CMD = require('../prototype/commands.js');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

const ENTRY = 'examples/quality/views.ddn';
const M = 'meridian.quality.review::';
function fixtureFiles() {
  const files = {};
  for (const f of ['model.ddn', 'views.ddn', 'formats.ddn', 'details.ddn'])
    files['examples/quality/' + f] = fs.readFileSync(path.join(__dirname, '..', '..', 'website', 'examples', 'quality', f), 'utf8');
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

// 1. Baseline plan: decision_unique returns 2 inputs, 2 outputs, 3 rules,
//    policy unique, analysis proved over the declared domains.
test('baseline plan: decision_unique has 2 inputs, 2 outputs, 3 rules, unique policy, proved analysis', () => {
  const ws = D.createWorkspace(fixtureFiles());
  const plan = ws.projectionPlan(ENTRY, 'decision_unique');
  assert.strictEqual(plan.kind, 'decision');
  assert.strictEqual(plan.inputs.length, 2);
  assert.strictEqual(plan.outputs.length, 2);
  assert.strictEqual(plan.rules.length, 3);
  assert.strictEqual(plan.policy, 'unique');
  assert.strictEqual(plan.analysis.status, 'proved-over-declared-domains');
  ws.destroy();
});

// 2. Add rule: one rule.row definition with the given x_rule plus the records
//    ref, one transaction; re-plan shows 4 rules; one undo removes both.
test('add rule: addDecisionRule creates one rule.row with x_rule and appends its ref; one undo removes both', () => {
  const ws = D.createWorkspace(fixtureFiles()), before = ws.getFiles();
  const made = CMD.addDecisionRule(D, ws, ENTRY, 'decision_first', {
    id: 'edge', label: 'Edge case',
    when: { severity: { op: 'eq', value: 'low' }, score: { op: 'interval', min: 10, max: 10 } },
    then: { route: 'edge', audit: false },
  });
  const plan = ws.projectionPlan(ENTRY, 'decision_first');
  assert.strictEqual(plan.rules.length, 4);
  assert.deepStrictEqual(plan.rules.map(r => r.id), [M + 'rules.high', M + 'rules.default', M + 'rules.low_pass', made.select]);
  const rule = plan.rules[3];
  assert.deepStrictEqual(rule.when, { severity: { op: 'eq', value: 'low' }, score: { op: 'interval', min: 10, max: 10 } });
  assert.deepStrictEqual(rule.then, { route: 'edge', audit: false });
  const el = ws.resolve(ENTRY, 'decision_first').elements.find(e => e.id === made.select);
  assert.strictEqual(el.kind, 'rule.row');
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before, 'one undo did not remove the definition and the array entry');
  ws.destroy();
});

// 3. Edit rule: changing then.route touches only that rule's x_rule span;
//    sibling rules and every other file stay byte-identical.
test('edit rule: editDecisionRule rewrites only the target rule x_rule span; siblings byte-identical', () => {
  const ws = D.createWorkspace(fixtureFiles()), before = ws.getFiles();
  CMD.editDecisionRule(D, ws, ENTRY, 'decision_unique', { ruleId: M + 'rules.low_pass', then: { route: 'release_fast', audit: false } });
  const plan = ws.projectionPlan(ENTRY, 'decision_unique');
  assert.deepStrictEqual(plan.rules.find(r => r.id === M + 'rules.low_pass').then, { route: 'release_fast', audit: false });
  const after = ws.getFiles();
  assert.strictEqual(after[ENTRY], before[ENTRY], 'view file touched by a shared rule edit');
  const m0 = before['examples/quality/model.ddn'], m1 = after['examples/quality/model.ddn'];
  const target = blockSpan(m1, 'object low_pass ');
  const d = diffSpan(m0, m1);
  assert.ok(d.s >= target.start && d.ea <= target.end, 'edit escaped the low_pass object span');
  for (const sib of ['object high ', 'object low_review ', 'object default ', 'object audit ', 'object check ']) {
    const b0 = blockSpan(m0, sib), b1 = blockSpan(m1, sib);
    assert.strictEqual(m1.slice(b1.start, b1.end), m0.slice(b0.start, b0.end), 'sibling rule altered: ' + sib);
  }
  ws.destroy();
});

// 4. VE-AC-059: an overlapping interval rule under the unique policy commits as
//    a draft; the committed re-plan throws DDN-QD004 naming both rule ids and a
//    witness input; render (publish path) stays blocked; one undo restores the
//    passing table byte-exactly.
test('VE-AC-059: overlapping unique-hit rule commits as draft; DDN-QD004 names both ids and a witness; undo restores byte-exactly', () => {
  const ws = D.createWorkspace(fixtureFiles()), before = ws.getFiles();
  CMD.addDecisionRule(D, ws, ENTRY, 'decision_unique', {
    id: 'overlap_low', label: 'Overlapping low band',
    when: { severity: { op: 'eq', value: 'low' }, score: { op: 'interval', min: 3, max: 6 } },
    then: { route: 'hold', audit: true },
  });
  const committed = ws.getFiles();
  assert.notDeepStrictEqual(committed, before, 'overlap draft was not committed');
  assert.ok(committed[ENTRY].includes('overlap_low'), 'records ref missing from committed draft');
  let err = null;
  try { ws.projectionPlan(ENTRY, 'decision_unique'); } catch (e) { err = e; }
  assert.ok(err, 'committed re-plan did not throw');
  assert.strictEqual(err.code, 'DDN-QD004');
  assert.ok(err.message.includes('low_pass') && err.message.includes('overlap_low'), 'message does not name both rule ids: ' + err.message);
  const witness = err.message.match(/witness (\{.*\})/);
  assert.ok(witness, 'message carries no witness input: ' + err.message);
  const w = JSON.parse(witness[1]);
  assert.strictEqual(w.severity, 'low');
  assert.ok(w.score >= 3 && w.score < 5, 'witness is not inside the overlap band: ' + witness[1]);
  // Publish/export path stays blocked by the runtime's own error.
  let renderErr = null;
  try { ws.renderSync({ entry: ENTRY, view: 'decision_unique' }); } catch (e) { renderErr = e; }
  assert.ok(renderErr && renderErr.code === 'DDN-QD004', 'render not blocked by DDN-QD004');
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before, 'one undo did not restore the passing table byte-exactly');
  assert.strictEqual(ws.projectionPlan(ENTRY, 'decision_unique').analysis.status, 'proved-over-declared-domains');
  ws.destroy();
});

// 5. VE-AC-060: analysis_budget below the atom count throws DDN-QD008 for the
//    unique/complete view and for the collect/complete view; a coverage:none
//    variant returns status budget_exceeded — unestablished, never success.
test('VE-AC-060: budget exceeded throws DDN-QD008 for unique+complete and collect+complete; coverage:none reports budget_exceeded, never success', () => {
  const ws = D.createWorkspace(fixtureFiles());
  CMD.editProjectionProperty(D, ws, ENTRY, 'decision_unique', { key: 'analysis_budget', value: 1 }, 'tolerant');
  let err = null;
  try { ws.projectionPlan(ENTRY, 'decision_unique'); } catch (e) { err = e; }
  assert.ok(err && err.code === 'DDN-QD008', 'unique+complete did not throw DDN-QD008, got ' + (err && err.code));
  assert.ok(/NOT established/.test(err.message), 'DDN-QD008 wording changed: ' + err.message);
  ws.destroy();
  const ws2 = D.createWorkspace(fixtureFiles());
  CMD.editProjectionProperty(D, ws2, ENTRY, 'decision_collect', { key: 'analysis_budget', value: 1 }, 'tolerant');
  err = null;
  try { ws2.projectionPlan(ENTRY, 'decision_collect'); } catch (e) { err = e; }
  assert.ok(err && err.code === 'DDN-QD008', 'collect+complete did not throw DDN-QD008, got ' + (err && err.code));
  ws2.destroy();
  // coverage:'none' scratch variant: the plan returns, but the analysis status
  // is budget_exceeded — the editor model reports unestablished, not success.
  const files = fixtureFiles();
  const block = blockSpan(files[ENTRY], 'view decision_collect ');
  let text = files[ENTRY].slice(block.start, block.end);
  text = text.replace('coverage: "complete"; analysis_budget: 4096;', 'coverage: "none"; analysis_budget: 1;');
  files[ENTRY] = files[ENTRY].slice(0, block.start) + text + files[ENTRY].slice(block.end);
  const ws3 = D.createWorkspace(files);
  const plan = ws3.projectionPlan(ENTRY, 'decision_collect');
  assert.strictEqual(plan.analysis.status, 'budget_exceeded');
  assert.notStrictEqual(plan.analysis.status, 'proved-over-declared-domains', 'budget-exceeded presented as success');
  ws3.destroy();
});

// 6. Reorder: swapping two refs on decision_first makes the newly-first rule
//    win a fixture matching both; a non-permutation array is rejected.
test('reorder: reorderDecisionRules swaps refs on decision_first; fixture selects the newly-first rule; non-permutation rejected', () => {
  const ws = D.createWorkspace(fixtureFiles());
  const plan = ws.projectionPlan(ENTRY, 'decision_first');
  const both = { severity: 'high', score: 3 }; // matches high and default
  assert.deepStrictEqual(CMD.evaluateDecisionFixture(D, ws, ENTRY, 'decision_first', { input: both }).selected, [M + 'rules.high']);
  const ids = plan.rules.map(r => r.id); // [high, default, low_pass]
  CMD.reorderDecisionRules(D, ws, ENTRY, 'decision_first', { orderedIds: [ids[1], ids[0], ids[2]] });
  assert.deepStrictEqual(ws.projectionPlan(ENTRY, 'decision_first').rules.map(r => r.id), [ids[1], ids[0], ids[2]]);
  assert.deepStrictEqual(CMD.evaluateDecisionFixture(D, ws, ENTRY, 'decision_first', { input: both }).selected, [M + 'rules.default']);
  const r = refused(ws, () => CMD.reorderDecisionRules(D, ws, ENTRY, 'decision_first', { orderedIds: [ids[0], ids[1]] }));
  assert.strictEqual(r.code, 'DDN-I033');
  const dup = refused(ws, () => CMD.reorderDecisionRules(D, ws, ENTRY, 'decision_first', { orderedIds: [ids[0], ids[0], ids[1]] }));
  assert.strictEqual(dup.code, 'DDN-I033');
  ws.destroy();
});

// 7. Hit policy edit: setDecisionPolicy writes hit_policy into the projection
//    group only; re-plan policy is first; an illegal value rejects before staging.
test('hit policy edit: setDecisionPolicy writes the projection group only; illegal value rejected before staging', () => {
  const ws = D.createWorkspace(fixtureFiles()), before = ws.getFiles();
  const r = refused(ws, () => CMD.setDecisionPolicy(D, ws, ENTRY, 'decision_unique', { hitPolicy: 'any' }));
  assert.strictEqual(r.code, 'DDN-I033');
  CMD.setDecisionPolicy(D, ws, ENTRY, 'decision_unique', { hitPolicy: 'first' });
  assert.strictEqual(ws.projectionPlan(ENTRY, 'decision_unique').policy, 'first');
  const after = ws.getFiles();
  assert.ok(after[ENTRY].includes('hit_policy: "first";'), 'hit_policy not written into source');
  assert.strictEqual(after['examples/quality/model.ddn'], before['examples/quality/model.ddn'], 'shared model touched by a view-scope write');
  const d = diffSpan(before[ENTRY], after[ENTRY]);
  const block = blockSpan(after[ENTRY], 'view decision_unique ');
  assert.ok(d.s >= block.start && d.ea <= block.end, 'policy write escaped the decision_unique view block');
  const projection = blockSpan(after[ENTRY].slice(block.start, block.end), 'projection');
  assert.ok(d.s - block.start >= projection.start && d.ea - block.start <= projection.end, 'policy write escaped the projection group');
  const badCoverage = refused(ws, () => CMD.setDecisionPolicy(D, ws, ENTRY, 'decision_unique', { coverage: 'partial' }));
  assert.strictEqual(badCoverage.code, 'DDN-I033');
  ws.destroy();
});

// 8. Delete: removing an added rule deletes definition + ref in one undo step;
//    deleting a rule referenced by a second view surfaces DDN-E004.
test('delete: deleteDecisionRule removes definition + ref in one undo step; a second referencing view surfaces DDN-E004', () => {
  const ws = D.createWorkspace(fixtureFiles());
  CMD.addDecisionRule(D, ws, ENTRY, 'decision_first', {
    id: 'temp_rule', label: 'Temporary',
    when: { severity: { op: 'eq', value: 'high' } },
    then: { route: 'temp', audit: false },
  });
  const before2 = ws.getFiles();
  assert.strictEqual(ws.projectionPlan(ENTRY, 'decision_first').rules.length, 4);
  CMD.deleteDecisionRule(D, ws, ENTRY, 'decision_first', { ruleId: 'meridian.quality.views::editor_data.temp_rule' });
  assert.strictEqual(ws.projectionPlan(ENTRY, 'decision_first').rules.length, 3);
  assert.ok(!ws.resolve(ENTRY, 'decision_first').elements.some(e => e.local === 'temp_rule'), 'definition survived the delete');
  ws.undo();
  assert.deepStrictEqual(ws.getFiles(), before2, 'one undo did not restore definition + ref');
  ws.destroy();
  // Craft a second decision view referencing rules.check, then delete it from
  // decision_collect: the shared reference guard fires DDN-E004.
  const files = fixtureFiles();
  files[ENTRY] += '\nview decision_shadow "Shadow copy" {\n    data: [@m.rules];\n    format: @f.shared.common;\n    projection { kind: "decision"; profile: "decision.rules@1"; records: [@m.rules.high, @m.rules.check, @m.rules.audit]; inputs: [{ "key": "severity", "type": "enum", "values": ["low", "high"] }, { "key": "score", "type": "number", "min": 0, "max": 10 }]; outputs: ["route", "audit"]; hit_policy: "collect"; coverage: "complete"; analysis_budget: 4096; }\n    select: [@m.rules.high, @m.rules.check, @m.rules.audit];\n\n}\n';
  const ws2 = D.createWorkspace(files);
  const r = refused(ws2, () => CMD.deleteDecisionRule(D, ws2, ENTRY, 'decision_collect', { ruleId: M + 'rules.check' }));
  assert.strictEqual(r.code, 'DDN-E004');
  ws2.destroy();
});

// 9. Fixture evaluation: an in-domain input matches the expected rule; an
//    out-of-domain input raises DDN-QD006 as an input error, not a crash.
test('fixture evaluation: in-domain input selects the expected rule; out-of-domain raises DDN-QD006', () => {
  const ws = D.createWorkspace(fixtureFiles());
  const r = CMD.evaluateDecisionFixture(D, ws, ENTRY, 'decision_unique', { input: { severity: 'low', score: 3 } });
  assert.strictEqual(r.status, 'matched');
  assert.deepStrictEqual(r.selected, [M + 'rules.low_pass']);
  assert.deepStrictEqual(r.outputs, [{ route: 'release', audit: false }]);
  const e = refused(ws, () => CMD.evaluateDecisionFixture(D, ws, ENTRY, 'decision_unique', { input: { severity: 'low', score: 99 } }));
  assert.strictEqual(e.code, 'DDN-QD006');
  const unknown = refused(ws, () => CMD.evaluateDecisionFixture(D, ws, ENTRY, 'decision_unique', { input: { bogus: 1 } }));
  assert.strictEqual(unknown.code, 'DDN-QD006');
  ws.destroy();
});

// 10. Round-trip + determinism: fixture comments and unrelated views stay
//     byte-identical after all edits; two fresh workspaces running the same
//     commands produce identical files; CLI check passes on the edited files.
test('round-trip + determinism: comments and unrelated views byte-identical; identical command runs; CLI check passes', () => {
  const files = fixtureFiles();
  const before = { ...files };
  const comments = files[ENTRY].split('\n').concat(files['examples/quality/model.ddn'].split('\n')).filter(l => l.trim().startsWith('//'));
  assert.ok(comments.length > 0, 'fixture has no comments to protect');
  const run = input => {
    const ws = D.createWorkspace(input);
    CMD.addDecisionRule(D, ws, ENTRY, 'decision_first', {
      id: 'edge', label: 'Edge case',
      when: { severity: { op: 'eq', value: 'low' }, score: { op: 'interval', min: 10, max: 10 } },
      then: { route: 'edge', audit: false },
    });
    CMD.editDecisionRule(D, ws, ENTRY, 'decision_unique', { ruleId: M + 'rules.low_pass', then: { route: 'release_fast', audit: false } });
    CMD.setDecisionPolicy(D, ws, ENTRY, 'decision_unique', { hitPolicy: 'first' });
    const ids = ws.projectionPlan(ENTRY, 'decision_first').rules.map(r => r.id);
    CMD.reorderDecisionRules(D, ws, ENTRY, 'decision_first', { orderedIds: [ids[1], ids[0], ...ids.slice(2)] });
    const out = ws.getFiles();
    ws.destroy();
    return out;
  };
  const after = run(files);
  assert.deepStrictEqual(run(fixtureFiles()), after, 'identical command sequence produced different files');
  for (const c of comments) assert.ok(after[ENTRY].includes(c) || after['examples/quality/model.ddn'].includes(c), 'comment lost: ' + c);
  for (const v of ['decision_collect', 'lifecycle_trace', 'measurement_table', 'dashboard_quality']) {
    const b0 = blockSpan(before[ENTRY], 'view ' + v + ' '), b1 = blockSpan(after[ENTRY], 'view ' + v + ' ');
    assert.strictEqual(after[ENTRY].slice(b1.start, b1.end), before[ENTRY].slice(b0.start, b0.end), 'unrelated view block altered: ' + v);
  }
  assert.strictEqual(after['examples/quality/formats.ddn'], before['examples/quality/formats.ddn']);
  assert.strictEqual(after['examples/quality/details.ddn'], before['examples/quality/details.ddn']);
  const tmp = '/tmp/ed-007-workspace';
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(path.join(tmp, 'examples', 'quality'), { recursive: true });
  for (const [f, text] of Object.entries(after)) fs.writeFileSync(path.join(tmp, f), text);
  const cli = path.join(__dirname, '..', '..', 'notation', 'cli', 'cli.js');
  const out = cp.spawnSync(process.execPath, [cli, 'check', path.join(tmp, ENTRY), '--workspace', tmp], { encoding: 'utf8' });
  assert.strictEqual(out.status, 0, 'CLI check failed: ' + out.stdout + out.stderr);
});

console.log('ED-007 ' + pass + '/' + (pass + fail));
if (fail) process.exitCode = 1;
