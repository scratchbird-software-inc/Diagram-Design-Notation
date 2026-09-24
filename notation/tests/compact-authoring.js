/* SPDX-License-Identifier: GPL-2.0-or-later. B1-037 compact authoring, phase 1:
 * typed declarations (kind keywords as declaration keywords, extension kinds via
 * registry alias) and contextual field/port members. The acceptance gate (D1):
 * paired compact/verbose sources build to EQUAL DDN.semanticJSON, byte-identical
 * SVG and identical validation outcomes — the parser desugars both forms to the
 * identical canonical AST. Also: D4 ambiguity regressions and D8 tool round-trip. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const DDN = require('../runtime/ddn-core.js').default, Render = require('../runtime/ddn-render.js').default;
const A = require('../dist/ddn.global.js');
const root = path.resolve(__dirname, '..');
const reg = JSON.parse(fs.readFileSync(path.join(root, '../standard/registry/catalogue.json'), 'utf8'));
const defs = fs.readFileSync(path.join(root, '../standard/registry/glyph-library.svg'), 'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const results = [];
function test(name, fn) { try { fn(); results.push({ name, status: 'pass' }); console.log('PASS', name); } catch (e) { results.push({ name, status: 'fail', message: e.stack }); console.error('FAIL', name, e.message); } }
const build = (text, view = 'v', entry = 'main.ddn') => DDN.build({ [entry]: text }, entry, view, reg);
const diag = ir => ir.diagnostics.map(d => d.severity + ':' + d.code + ':' + d.message);

/* D1 equivalence gate: semanticJSON equality + byte-identical SVG + identical
 * validation outcomes for a compact/verbose pair. */
function assertEquivalent(compact, verbose, view, label) {
  const a = build(verbose, view, 'verbose.ddn'), b = build(compact, view, 'compact.ddn');
  assert.deepEqual(DDN.semanticJSON(b.ir), DDN.semanticJSON(a.ir), label + ': semanticJSON differs');
  assert.equal(Render.render(b.ir, reg, defs).svg, Render.render(a.ir, reg, defs).svg, label + ': SVG differs');
  assert.deepEqual(diag(b.ir), diag(a.ir), label + ': diagnostics differ');
}

/* Every built-in kind keyword AND registered alias works as a typed declaration
 * (D2/D3): `word x "X" {}` ≡ `object x "X" { kind: keyword; }`. */
const words = DDN.typedKindWords(reg);
test('typed-declaration word map covers every built-in kind keyword', () => {
  const kinds = DDN.profiles.registry(reg).kinds;
  for (const k of kinds) if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(k.keyword) && !['object', 'domain', 'sample', 'flow', 'assertion', 'relation'].includes(k.keyword))
    assert.ok(words.has(k.keyword), 'missing typed declaration keyword ' + k.keyword);
});
test('equivalence gate: every typed-declaration word vs verbose kind property', () => {
  for (const [word, keyword] of words)
    assertEquivalent(
      `ddn "0.5"; module "t"; data m { ${word} x "X" {} } view v { data: [@m]; }`,
      `ddn "0.5"; module "t"; data m { object x "X" { kind: ${JSON.stringify(keyword)}; } } view v { data: [@m]; }`,
      'v', 'typed declaration ' + word);
});
test('typed declaration without body desugars like verbose semicolon form', () => {
  assertEquivalent(
    'ddn "0.5"; module "t"; data m { topic events; } view v { data: [@m]; }',
    'ddn "0.5"; module "t"; data m { object events { kind: topic; } } view v { data: [@m]; }',
    'v', 'bodyless typed declaration');
});

/* Paired fixture corpus: keyed fields, ports, mixed explicit/bare members,
 * nested fields, labels, extension-kind alias, member endpoints. */
const fx = path.join(__dirname, 'fixtures', 'compact');
const compact = fs.readFileSync(path.join(fx, 'model-compact.ddn'), 'utf8');
const verbose = fs.readFileSync(path.join(fx, 'model-verbose.ddn'), 'utf8');
for (const view of ['main', 'subset'])
  test('equivalence gate: paired fixture corpus, view ' + view, () => {
    const a = DDN.build({ 'verbose.ddn': verbose }, 'verbose.ddn', view, reg);
    const b = DDN.build({ 'compact.ddn': compact }, 'compact.ddn', view, reg);
    assert.deepEqual(DDN.semanticJSON(b.ir), DDN.semanticJSON(a.ir));
    assert.equal(Render.render(b.ir, reg, defs).svg, Render.render(a.ir, reg, defs).svg);
    assert.deepEqual(diag(b.ir), diag(a.ir));
  });
test('extension kind via registry alias (uml.actor declares actor)', () => {
  const ir = build(compact, 'main', 'compact.ddn').ir;
  assert.equal(ir.elements.find(n => n.ref === 'model.visitor').kind, 'uml.actor');
});

/* D4 ambiguity regressions: kind words are contextual. */
test('object NAMED after a kind keyword still parses', () => {
  for (const name of ['table', 'fields', 'view', 'field', 'actor']) {
    const ir = build(`ddn "0.5"; module "t"; data m { object ${name} "Meta" { kind: table; } } view v { data: [@m]; }`).ir;
    assert.equal(ir.elements[0].name, 'Meta');
    assert.equal(ir.elements[0].kind, 'table');
  }
});
test('typed declaration whose id is itself a kind keyword', () => {
  const ir = build('ddn "0.5"; module "t"; data m { table table "T" {} } view v { data: [@m]; }').ir;
  assert.equal(ir.elements[0].kind, 'table'); assert.equal(ir.elements[0].name, 'T');
});
test('view/field kind words are typed declarations only inside data blocks', () => {
  const ir = build('ddn "0.5"; module "t"; data m { view s "S" {} field f "F" {} } view v { data: [@m]; }').ir;
  assert.deepEqual(ir.elements.map(n => n.kind).sort(), ['field', 'view']);
});
test('structural keywords keep their meaning in data position', () => {
  const ir = build('ddn "0.5"; module "t"; data m { domain d {} sample s { columns: []; rows: []; } flow f {} assertion a {} } view v { data: [@m]; }').ir;
  assert.deepEqual(ir.elements.map(n => n.type), ['domain', 'sample', 'flow', 'assertion']);
});
test('nested fields keyword still reads as a group, bare ids as fields', () => {
  const ir = build('ddn "0.5"; module "t"; data m { table t { fields { a { fields { b; } } } } } view v { data: [@m]; }').ir;
  assert.equal(ir.elements[0].fields.length, 2);
  assert.equal(ir.elements[0].fields[1].path, 'a.b');
});
test('explicit field/port keywords mix with bare members', () => {
  const ir = build('ddn "0.5"; module "t"; data m { table t { fields { a; field b; c; } ports { p; port q; } } } view v { data: [@m]; }').ir;
  assert.deepEqual(ir.elements[0].fields.map(f => f.local), ['a', 'b', 'c']);
  assert.deepEqual(ir.elements[0].ports.map(p => p.local), ['p', 'q']);
});
test('kind property repeated inside a typed body is a duplicate (DDN011)', () => {
  assert.throws(() => build('ddn "0.5"; module "t"; data m { table x { kind: table; } } view v { data: [@m]; }'), e => e.code === 'DDN011');
});
test('typed declaration with header endpoints is not a relation (DDN055)', () => {
  assert.throws(() => build('ddn "0.5"; module "t"; data m { table a {} table x @a -> @a {} } view v { data: [@m]; }'), e => e.code === 'DDN055');
});
test('bare member with endpoints is a syntax error (DDN010)', () => {
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; data m { table a {} table t { fields { a @x -> @y; } } } view v { data: [@m]; }'), e => e.code === 'DDN010');
});
test('unknown word is still an unknown declaration, not silently an object', () => {
  assert.throws(() => build('ddn "0.5"; module "t"; data m { unicorn x {} } view v { data: [@m]; }'), e => e.code === 'DDN042');
});
test('top-level typed word is rejected like any non data/format/view declaration', () => {
  assert.throws(() => build('ddn "0.5"; module "t"; table x {} view v { data: []; }'), e => e.code === 'DDN025');
});

/* The compact teaching example renders byte-identically to its verbose twin. */
test('basics 12-nested-fields compact example equals verbose expansion', () => {
  const dir = path.join(root, '../website/examples/basics');
  const files = {}; for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.ddn'))) files[f] = fs.readFileSync(path.join(dir, f), 'utf8');
  const twin = files['12-nested-fields.ddn']
    .replace('collection customer "Customer profile / nested structure" {', 'object customer "Customer profile / nested structure" { kind: collection;')
    .replace('table order "Order" {fields {order_id; customer_id', 'object order "Order" {kind: table; fields {field order_id; field customer_id');
  assert.notEqual(twin, files['12-nested-fields.ddn'], 'twin mutation targets missing');
  for (const view of ['detailed', 'large', 'collapsed']) {
    const a = DDN.build({ ...files, 'twin.ddn': twin }, 'twin.ddn', view, reg);
    const b = DDN.build(files, '12-nested-fields.ddn', view, reg);
    assert.deepEqual(DDN.semanticJSON(b.ir), DDN.semanticJSON(a.ir));
    assert.equal(Render.render(b.ir, reg, defs).svg, Render.render(a.ir, reg, defs).svg);
  }
});

/* D8: compact source round-trips through the unified tool load/render/export and
 * authoring edits preserve surrounding compact syntax. */
test('compact source round-trips through DDNLive load/render/export', () => {
  const w = A.createWorkspace({ 'main.ddn': compact });
  const r = w.renderSync({ entry: 'main.ddn', view: 'main' });
  assert.ok(r.svg.startsWith('<?xml'));
  const files = w.getFiles();
  assert.ok(files['main.ddn'].includes('table customer'), 'render rewrote compact source');
  assert.ok(files['main.ddn'].includes('customer_id { key: primary;'), 'render rewrote bare members');
});
test('authoring label edit preserves compact declaration syntax', () => {
  const w = A.createWorkspace({ 'main.ddn': compact });
  const uid = 'tests.compact::model.customer';
  A.authoring.setLabel(w, 'main.ddn', 'main', uid, 'Customer (edited)');
  const text = w.getFiles()['main.ddn'];
  assert.ok(text.includes('table customer "Customer (edited)"'), 'compact typed declaration corrupted: ' + text.slice(0, 400));
  assert.ok(text.includes('customer_id { key: primary; datatype: "uuid"; }'), 'bare member block corrupted');
  const r = w.renderSync({ entry: 'main.ddn', view: 'main' });
  assert.ok(r.svg.includes('Customer (edited)'));
});
test('authoring property edit inside a compact member block is token-precise', () => {
  const w = A.createWorkspace({ 'main.ddn': compact });
  A.authoring.setProperty(w, 'main.ddn', 'main', 'tests.compact::model.customer.customer_id', 'datatype', 'text');
  const text = w.getFiles()['main.ddn'];
  assert.ok(text.includes('customer_id { key: primary; datatype: "text"; }'), text.slice(0, 400));
  assert.ok(text.includes('table customer "Customer"'));
});
test('authoring addField emits canonical-verbose member into a compact block (legal mix)', () => {
  const w = A.createWorkspace({ 'main.ddn': compact });
  A.authoring.addField(w, 'main.ddn', 'main', 'tests.compact::model.customer', { id: 'loyalty', name: 'Loyalty' });
  const text = w.getFiles()['main.ddn'];
  assert.ok(text.includes('field loyalty "Loyalty";'), text.slice(0, 600));
  const ir = w.resolve('main.ddn', 'main');
  assert.ok(ir.elements.find(n => n.ref === 'model.customer').fields.some(f => f.local === 'loyalty'));
});

const failed = results.filter(x => x.status === 'fail');
console.log(JSON.stringify({ tests: results.length, passed: results.length - failed.length, failed: failed.length }));
if (failed.length) process.exitCode = 1;
