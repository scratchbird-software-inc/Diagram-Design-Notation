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
for (const view of ['main', 'subset', 'header'])
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
    .replace('table order "Order" {fields {order_id; customer_id', 'object order "Order" {kind: table; fields {field order_id; field customer_id')
    .replace('view header "One-line header / compact view declaration": @model as "ddn@1" {', 'view header "One-line header / compact view declaration" { data: [@model]; projection { kind: graph; profile: "ddn@1"; }');
  assert.notEqual(twin, files['12-nested-fields.ddn'], 'twin mutation targets missing');
  for (const view of ['detailed', 'large', 'collapsed', 'header']) {
    const a = DDN.build({ ...files, 'twin.ddn': twin }, 'twin.ddn', view, reg);
    const b = DDN.build(files, '12-nested-fields.ddn', view, reg);
    assert.deepEqual(DDN.semanticJSON(b.ir), DDN.semanticJSON(a.ir));
    assert.equal(Render.render(b.ir, reg, defs).svg, Render.render(a.ir, reg, defs).svg);
  }
});

/* ---- B1-038 phase 2: verb-keyword relations + named batches (D1–D6) ---- */

/* Every built-in relationship keyword AND registered alias works as a compact
 * relation verb (D1): `verb r @a -> @b {}` ≡ `relation r @a -> @b { kind: verb; }`.
 * Structural keywords (flow) stay structural declarations, never verbs. */
const verbs = DDN.relationKindWords(reg);
test('compact-relation verb map covers every built-in relationship keyword', () => {
  const rels = DDN.profiles.registry(reg).relationships;
  for (const r of rels) if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(r.keyword) && !['flow', 'domain'].includes(r.keyword))
    assert.ok(verbs.has(r.keyword), 'missing compact relation verb ' + r.keyword);
  assert.ok(!verbs.has('flow'), 'flow must stay a structural element keyword');
  assert.ok(!verbs.has('domain'), 'domain must stay a structural element keyword');
});
test('equivalence gate: every compact verb vs verbose kind property', () => {
  for (const [word, keyword] of verbs)
    assertEquivalent(
      `ddn "0.5"; module "t"; data m { object a {} object b {} ${word} r @a -> @b {} } view v { data: [@m]; }`,
      `ddn "0.5"; module "t"; data m { object a {} object b {} relation r @a -> @b { kind: ${JSON.stringify(keyword)}; } } view v { data: [@m]; }`,
      'v', 'compact relation ' + word);
});
test('compact relation with label and brackets ≡ verbose marks (D1)', () => {
  assertEquivalent(
    'ddn "0.5"; module "t"; data m { object a {} object b {} ref places "places" @a [one] -> @b [zeromany] { enforcement: database; } } view v { data: [@m]; }',
    'ddn "0.5"; module "t"; data m { object a {} object b {} relation places "places" @a -> @b { kind: ref; source_mark: one; target_mark: zeromany; enforcement: database; } } view v { data: [@m]; }',
    'v', 'labelled ref with both brackets');
});
test('brackets optional per side; omitted bracket = omitted mark, never defaulted', () => {
  const cases = [
    ['@a -> @b', ''],
    ['@a [one] -> @b', 'source_mark: one; '],
    ['@a -> @b [zeromany]', 'target_mark: zeromany; '],
  ];
  for (const [endpoints, marks] of cases) {
    assertEquivalent(
      `ddn "0.5"; module "t"; data m { object a {} object b {} ref r ${endpoints} {} } view v { data: [@m]; }`,
      `ddn "0.5"; module "t"; data m { object a {} object b {} relation r @a -> @b { kind: ref; ${marks}} } view v { data: [@m]; }`,
      'v', 'bracket combination ' + endpoints);
    const ir = build(`ddn "0.5"; module "t"; data m { object a {} object b {} ref r ${endpoints} {} } view v { data: [@m]; }`).ir;
    assert.equal('source_mark' in ir.relations[0].properties, marks.includes('source_mark'), endpoints + ': source_mark omission drift');
    assert.equal('target_mark' in ir.relations[0].properties, marks.includes('target_mark'), endpoints + ': target_mark omission drift');
  }
});
test('compact form never implies enforcement (D2)', () => {
  const ir = build('ddn "0.5"; module "t"; data m { object a {} object b {} ref r @a -> @b {} } view v { data: [@m]; }').ir;
  assert.ok(!('enforcement' in ir.relations[0].properties));
});
test('field/port-terminated endpoints keep @obj.member syntax in compact form (D5)', () => {
  assertEquivalent(
    'ddn "0.5"; module "t"; data m { table a { fields { id; } } queue b { ports { p { direction: in; } } } transfers_to t @a.id -> @b.p; } view v { data: [@m]; }',
    'ddn "0.5"; module "t"; data m { object a { kind: table; fields { field id; } } object b { kind: queue; ports { port p { direction: in; } } } relation t @a.id -> @b.p { kind: flow; } } view v { data: [@m]; }',
    'v', 'member endpoints in compact relation');
});

/* Named batches (D4): shared properties merge under per-entry ones. */
test('named batch ≡ one canonical relation per entry, per-entry wins', () => {
  assertEquivalent(
    `ddn "0.5"; module "t"; data m { object x {} object y {} object z {}
     relations depends {
      enforcement: undecided;
      dep_a "a" @x -> @y;
      dep_b "b" @y -> @z { lane: hot; }
     } } view v { data: [@m]; publication { size: content; fit: none; } }`,
    `ddn "0.5"; module "t"; data m { object x {} object y {} object z {}
     relation dep_a "a" @x -> @y { kind: depends; enforcement: undecided; }
     relation dep_b "b" @y -> @z { kind: depends; enforcement: undecided; lane: hot; }
     } view v { data: [@m]; publication { size: content; fit: none; } }`,
    'v', 'batch with shared + override properties');
});
test('batch entries carry own id/label/endpoints — identity never positional', () => {
  const ir = build(`ddn "0.5"; module "t"; data m { object x {} object y {} object z {}
    relations depends { dep_a "a" @x -> @y; dep_b "b" @y -> @z; } } view v { data: [@m]; }`).ir;
  assert.deepEqual(ir.relations.map(r => [r.ref, r.name]), [['m.dep_a', 'a'], ['m.dep_b', 'b']]);
  assert.ok(ir.relations.every(r => r.kind === 'depends'));
});
test('batch header accepts registry aliases and extension-kind aliases (D6)', () => {
  const req = 'object q { kind: "req.requirement"; x_diagram: { code: "R1"; text: "t"; }; } object i { kind: "req.implementation"; }';
  const ir = build(`ddn "0.5"; module "t"; data m { ${req} relations satisfies { s1 @i -> @q; } } view v { data: [@m]; }`).ir;
  assert.equal(ir.relations[0].kind, 'req.satisfies');
  assertEquivalent(
    `ddn "0.5"; module "t"; data m { object a {} object b {} relations associated_with { r @a -> @b; } } view v { data: [@m]; }`,
    `ddn "0.5"; module "t"; data m { object a {} object b {} relation r @a -> @b { kind: assoc; } } view v { data: [@m]; }`,
    'v', 'batch via registry alias');
});
test('extension relation alias works as a compact verb (D6)', () => {
  const req = 'object q { kind: "req.requirement"; x_diagram: { code: "R1"; text: "t"; }; } object i { kind: "req.implementation"; }';
  assertEquivalent(
    `ddn "0.5"; module "t"; data m { ${req} satisfies s @i -> @q {} } view v { data: [@m]; }`,
    `ddn "0.5"; module "t"; data m { ${req} relation s @i -> @q { kind: "req.satisfies"; } } view v { data: [@m]; }`,
    'v', 'compact verb via extension alias');
});
test('kind: inside a batch (shared or entry) is a duplicate of the header kind (DDN011)', () => {
  assert.throws(() => build('ddn "0.5"; module "t"; data m { object a {} relations depends { kind: ref; d @a -> @a; } } view v { data: [@m]; }'), e => e.code === 'DDN011');
  assert.throws(() => build('ddn "0.5"; module "t"; data m { object a {} relations depends { d @a -> @a { kind: ref; } } } view v { data: [@m]; }'), e => e.code === 'DDN011');
});
test('batch entry needs endpoints and a terminator (DDN010)', () => {
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; data m { relations depends { d } } view v { data: [@m]; }'), e => e.code === 'DDN010');
});
test('kind: repeated in a compact verb body is a duplicate (DDN011)', () => {
  assert.throws(() => build('ddn "0.5"; module "t"; data m { object a {} object b {} ref r @a -> @b { kind: ref; } } view v { data: [@m]; }'), e => e.code === 'DDN011');
});

/* D3 ambiguity regressions: verb words are contextual. */
test('object NAMED after a verb keyword still parses', () => {
  for (const name of ['ref', 'depends', 'note', 'satisfies']) {
    const ir = build(`ddn "0.5"; module "t"; data m { object ${name} "Meta" { kind: table; } } view v { data: [@m]; }`).ir;
    assert.equal(ir.elements[0].name, 'Meta');
    assert.equal(ir.elements[0].kind, 'table');
  }
});
test('words that are both a kind and a verb disambiguate on endpoints', () => {
  for (const word of ['note', 'report', 'test', 'decision', 'issue', 'schedule', 'snapshot', 'export', 'trigger', 'namespace']) {
    const asObject = build(`ddn "0.5"; module "t"; data m { ${word} x "X" {} } view v { data: [@m]; }`).ir;
    assert.equal(asObject.elements[0].kind, word, word + ' with a block stays a typed object');
    const asRelation = build(`ddn "0.5"; module "t"; data m { object a {} object b {} ${word} x @a -> @b {} } view v { data: [@m]; }`).ir;
    assert.equal(asRelation.relations.length, 1, word + ' with endpoints is a relation');
    assert.equal(asRelation.relations[0].kind, word);
  }
});
test('verb word without endpoints parses but fails build like a canonical relation (DDN055)', () => {
  assert.throws(() => build('ddn "0.5"; module "t"; data m { ref r {} } view v { data: [@m]; }'), e => e.code === 'DDN055');
});
test('relations: as a property inside data is not a batch header', () => {
  const doc = DDN.parse('ddn "0.5"; module "t"; data m { relations: [@x]; } view v { data: [@m]; }');
  assert.equal(doc.declarations[0].props.relations[0].$ref, 'x');
});

/* D7: authoring edits preserve compact relation/batch syntax. */
test('authoring label edit preserves compact relation and batch syntax', () => {
  const w = A.createWorkspace({ 'main.ddn': compact });
  A.authoring.setLabel(w, 'main.ddn', 'main', 'tests.compact::model.fulfil_dep', 'Fulfil (edited)');
  const text = w.getFiles()['main.ddn'];
  assert.ok(text.includes('fulfil_dep "Fulfil (edited)" @fulfil -> @inbound;'), 'batch entry corrupted: ' + text.slice(0, 600));
  assert.ok(text.includes('assoc actor_link @visitor [one] -> @fulfil [zeromany];'), 'compact verb corrupted');
  assert.ok(text.includes('relations depends {'), 'batch header corrupted');
  const r = w.renderSync({ entry: 'main.ddn', view: 'main' });
  assert.ok(r.svg.includes('Fulfil (edited)'));
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

/* ---- B1-039 phase 3: compact view headers (D1–D5) ---- */

/* D2 verification, generated from the registry: EVERY registered profile id
 * maps to exactly one projection kind, and the header desugar sets
 * projection.kind from that mapping. */
test('every registered profile maps to exactly one projection kind (D2, generated from the catalogue)', () => {
  const cat = JSON.parse(fs.readFileSync(path.join(root, '../standard/registry/profiles/catalogue.json'), 'utf8'));
  assert.equal(new Set(cat.profiles.map(p => p.id)).size, cat.profiles.length, 'duplicate profile ids in the registry');
  const kinds = DDN.projectionProfileKinds();
  assert.equal(kinds.size, cat.profiles.length, 'runtime profile map disagrees with the registry');
  for (const p of cat.profiles) {
    const doc = DDN.parse(`ddn "0.5"; module "t"; data m {} view v: @m as ${JSON.stringify(p.id)};`);
    const g = doc.declarations.find(n => n.type === 'view').children.find(c => c.group && c.type === 'projection');
    assert.ok(g, p.id + ': header did not desugar to a projection group');
    assert.equal(g.props.kind, p.projection, p.id + ': kind mapping drift');
    assert.equal(g.props.profile, p.id);
  }
});

/* Equivalence gate: the example from the proposal — single source + profile. */
test('equivalence gate: header with profile ≡ canonical data + projection', () => {
  assertEquivalent(
    'ddn "0.5"; module "t"; data m { table customer { fields { id; } } table order { fields { oid; cid; } } ref owner @order.cid [one] -> @customer.id [zeromany] {} } view erd: @m as "erd.crowfoot@1";',
    'ddn "0.5"; module "t"; data m { table customer { fields { id; } } table order { fields { oid; cid; } } ref owner @order.cid [one] -> @customer.id [zeromany] {} } view erd { data: [@m]; projection { kind: graph; profile: "erd.crowfoot@1"; } }',
    'erd', 'header single source with profile');
});

/* Equivalence gate: multiple data sources in the explicit list form. */
test('equivalence gate: header with an explicit data-source list', () => {
  assertEquivalent(
    'ddn "0.5"; module "t"; data a { table x {} } data b { table y {} } view both: [@a, @b] as "ddn@1";',
    'ddn "0.5"; module "t"; data a { table x {} } data b { table y {} } view both { data: [@a, @b]; projection { kind: graph; profile: "ddn@1"; } }',
    'both', 'header list form');
});

/* D3: omitting `as` mirrors the default-profile behaviour exactly — no
 * projection block at all, defaults apply at build. */
test('equivalence gate: header without `as` ≡ view without projection (D3)', () => {
  assertEquivalent(
    'ddn "0.5"; module "t"; data m { table t1 { fields { id; } } } view v: @m;',
    'ddn "0.5"; module "t"; data m { table t1 { fields { id; } } } view v { data: [@m]; }',
    'v', 'header without profile');
  const ir = build('ddn "0.5"; module "t"; data m { table t1 {} } view v: @m;').ir;
  assert.deepEqual(ir.view.profiles.projection, { kind: 'graph', profile: 'ddn@1' });
});

/* D1: the label keeps its existing position after the id. */
test('equivalence gate: header with label, datasource and profile', () => {
  assertEquivalent(
    'ddn "0.5"; module "t"; data m { table t1 {} } view v "Label": @m as "ddn@1";',
    'ddn "0.5"; module "t"; data m { table t1 {} } view v "Label" { data: [@m]; projection { kind: graph; profile: "ddn@1"; } }',
    'v', 'header with label');
});

/* D4: an optional body merges exactly like canonical properties/groups; the
 * header supplies data + projection only. */
test('equivalence gate: header + body merge (D4)', () => {
  assertEquivalent(
    'ddn "0.5"; module "t"; data m { table customer { fields { id; } } table order { fields { oid; } } } view v: @m as "ddn@1" { select: [@m.customer]; layout { algorithm: layered; } publication { size: content; fit: none; } }',
    'ddn "0.5"; module "t"; data m { table customer { fields { id; } } table order { fields { oid; } } } view v { data: [@m]; projection { kind: graph; profile: "ddn@1"; } select: [@m.customer]; layout { algorithm: layered; } publication { size: content; fit: none; } }',
    'v', 'header with body merge');
});

/* D4 conflicts: the header owns the projection when `as` is present, so a body
 * projection block or property is a coded parse error (DDN-E015) — never a
 * silent override; a body data: property stays a plain duplicate (DDN011). */
test('header + body projection conflict is a coded parse error (DDN-E015)', () => {
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; data m {} view v: @m as "ddn@1" { projection { kind: graph; } }'), e => e.code === 'DDN-E015');
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; data m {} view v: @m as "ddn@1" { projection: @fmt.projection; }'), e => e.code === 'DDN-E015');
});
test('unknown profile in a header is a coded parse error, never a guess (D2)', () => {
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; data m {} view v: @m as "nope@9";'), e => e.code === 'DDN-E015');
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; data m {} view v: @m as "erd.crowfoot";'), e => e.code === 'DDN-E015');
});
test('header desugared projection group never carries an ambiguous kind (D2)', () => {
  for (const [id, kind] of DDN.projectionProfileKinds()) assert.ok(kind !== null, id + ' is ambiguous in the registry');
});
test('body data: after a header datasource is a duplicate property (DDN011)', () => {
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; data m {} view v: @m { data: [@m]; }'), e => e.code === 'DDN011');
});
test('header requires a datasource and a terminator (DDN010)', () => {
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; data m {} view v: ;'), e => e.code === 'DDN010');
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; data m {} view v: @m'), e => e.code === 'DDN010');
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; data m {} view v: @m as;'), e => e.code === 'DDN010');
});

/* Header form works for a non-default kind mapping too (uml.usecase@1 and
 * uml.usecase@2 share a stem but versioned ids stay unambiguous). */
test('versioned profile strings disambiguate shared stems (uml.usecase@1/@2)', () => {
  const kinds = DDN.projectionProfileKinds();
  assert.equal(kinds.get('uml.usecase@1'), 'graph');
  assert.equal(kinds.get('uml.usecase@2'), 'graph');
  const doc = DDN.parse('ddn "0.5"; module "t"; data m {} view v: @m as "uml.usecase@2";');
  assert.equal(doc.declarations.find(n => n.type === 'view').children[0].props.profile, 'uml.usecase@2');
});

/* A header-form view that renders a real non-default profile end to end. */
test('equivalence gate: crowfoot header renders byte-identically', () => {
  assertEquivalent(
    'ddn "0.5"; module "t"; data m { table a { fields { id; } } table b { fields { id; aid; } } assoc link @b.aid [zeromany] -> @a.id [one] {} } view erd: @m as "erd.crowfoot@1" { publication { size: content; fit: none; } }',
    'ddn "0.5"; module "t"; data m { table a { fields { id; } } table b { fields { id; aid; } } assoc link @b.aid [zeromany] -> @a.id [one] {} } view erd { data: [@m]; projection { kind: graph; profile: "erd.crowfoot@1"; } publication { size: content; fit: none; } }',
    'erd', 'crowfoot header with body');
});

/* Authoring edits stay token-precise on the header form. */
test('authoring label edit preserves the compact view header syntax', () => {
  const w = A.createWorkspace({ 'main.ddn': 'ddn "0.5"; module "t"; data m { table t1 {} } view v: @m as "ddn@1";\nview w2 "W" { data: [@m]; }' });
  const b = DDN.build(w.getFiles(), 'main.ddn', 'v', reg);
  A.authoring.setLabel(w, 'main.ddn', 'v', 't::v', 'Header view');
  const text = w.getFiles()['main.ddn'];
  assert.ok(text.includes('view v "Header view": @m as "ddn@1";'), 'header corrupted: ' + text);
  const r = w.renderSync({ entry: 'main.ddn', view: 'v' });
  assert.ok(r.svg.startsWith('<?xml'));
});

const failed = results.filter(x => x.status === 'fail');
console.log(JSON.stringify({ tests: results.length, passed: results.length - failed.length, failed: failed.length }));
if (failed.length) process.exitCode = 1;
