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
for (const view of ['main', 'subset', 'header', 'metrics_graph', 'metrics_chart'])
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
    .replace('view header "One-line header / compact view declaration": @model as "ddn@1" {', 'view header "One-line header / compact view declaration" { data: [@model]; projection { kind: graph; profile: "ddn@1"; }')
    .replace(`records metrics {
 columns: label, value, unit;
 label_column: label;
 row m1: "Alpha", 10, "ms";
 row m2: "Beta", 20, "ms";
 row m3: "Gamma", 15, "ms";
 row m4: "Delta", 25, "ms";
 row m5: missing, null, "ms" { note: "awaiting measurement"; };
}`, `data metrics {
 object m1 "Alpha" { kind: record; x_record: { label: "Alpha", value: 10, unit: "ms" }; }
 object m2 "Beta" { kind: record; x_record: { label: "Beta", value: 20, unit: "ms" }; }
 object m3 "Gamma" { kind: record; x_record: { label: "Gamma", value: 15, unit: "ms" }; }
 object m4 "Delta" { kind: record; x_record: { label: "Delta", value: 25, unit: "ms" }; }
 object m5 "m5" { kind: record; x_record: { label: missing, value: null, unit: "ms" }; note: "awaiting measurement"; }
}`);
  assert.notEqual(twin, files['12-nested-fields.ddn'], 'twin mutation targets missing');
  for (const view of ['detailed', 'large', 'collapsed', 'header', 'metrics_chart']) {
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

/* ------------------------------------------------------------------------
 * B1-040 phase 4: keyed tabular records. Same equivalence gate: the parser
 * desugars each `row <id>:` to the identical canonical record object, so
 * compact and verbose sources build equal semanticJSON, byte-identical SVG
 * and identical diagnostics. Row ids ARE the B1-029 refresh keys.
 * --------------------------------------------------------------------- */

/* Baseline pair from the item (label_column + missing/null + a row body),
 * rendered as a chart to prove projections consume the desugared records. */
const recCompact = `ddn "0.5"; module "t";
records metrics {
 columns: label, value, unit;
 label_column: label;
 row m1: "Alpha", 10, "ms";
 row m2: "Beta", 20, "ms";
 row m3: "Gamma", 30, "ms" { note: "outlier"; };
}
view chart_view {
 data: [@metrics];
 projection { kind: chart; profile: "chart.basic@1"; records: [@metrics.m1, @metrics.m2, @metrics.m3]; mark: bar; x: "x_record.label"; y: "x_record.value"; unit: "ms"; width: 900px; height: 560px; }
 publication { size: content; fit: none; }
}`;
const recVerbose = `ddn "0.5"; module "t";
data metrics {
 object m1 "Alpha" { kind: record; x_record: { label: "Alpha", value: 10, unit: "ms" }; }
 object m2 "Beta" { kind: record; x_record: { label: "Beta", value: 20, unit: "ms" }; }
 object m3 "Gamma" { kind: record; x_record: { label: "Gamma", value: 30, unit: "ms" }; note: "outlier"; }
}
view chart_view {
 data: [@metrics];
 projection { kind: chart; profile: "chart.basic@1"; records: [@metrics.m1, @metrics.m2, @metrics.m3]; mark: bar; x: "x_record.label"; y: "x_record.value"; unit: "ms"; width: 900px; height: 560px; }
 publication { size: content; fit: none; }
}`;
test('equivalence gate: records block with label_column, row body, chart render', () => {
  assertEquivalent(recCompact, recVerbose, 'chart_view', 'records block');
});

/* Every scalar literal class keeps its canonical semantics positionally. */
test('equivalence gate: every scalar literal class in row position', () => {
  const cols = 's, n, q, b, nil, miss, und, na, conf, bare';
  const vals = '"txt", -3.5, 12px, true, null, missing, undecided, not_applicable, conflicting, plain';
  const verb = '{ s: "txt", n: -3.5, q: 12px, b: true, nil: null, miss: missing, und: undecided, na: not_applicable, conf: conflicting, bare: plain }';
  assertEquivalent(
    `ddn "0.5"; module "t"; records r { columns: ${cols}; row r1: ${vals}; } view v { data: [@r]; }`,
    `ddn "0.5"; module "t"; data r { object r1 "r1" { kind: record; x_record: ${verb}; } } view v { data: [@r]; }`,
    'v', 'scalar literal classes');
  const ir = build(`ddn "0.5"; module "t"; records r { columns: ${cols}; row r1: ${vals}; } view v { data: [@r]; }`).ir;
  const xr = ir.elements[0].properties.x_record;
  assert.equal(xr.nil, null);
  assert.deepEqual(xr.miss, { $missing: true });
  assert.deepEqual(xr.und, { $state: 'undecided' });
  assert.deepEqual(xr.na, { $state: 'not_applicable' });
  assert.deepEqual(xr.conf, { $state: 'conflicting' });
  assert.equal(xr.bare, 'plain');
  assert.deepEqual(xr.q, { $quantity: 12, unit: 'px' });
});

/* Label rules: label_column string wins; finite numbers coerce; any other
 * scalar (missing/null/state) falls back to the row id; no label_column at
 * all means the row id is the label (the refresh tool's own convention). */
test('label_column variants: string, number coercion, missing/null fallback', () => {
  const ir = build(`ddn "0.5"; module "t";
records r { columns: label, v; label_column: label;
 row a: "Alpha", 1; row b: 42, 2; row c: missing, 3; row d: null, 4; row e: undecided, 5; }
records plain { columns: v; row z: 9; }
view v { data: [@r, @plain]; }`).ir;
  const names = Object.fromEntries(ir.elements.map(n => [n.ref.split('.').pop(), n.name]));
  assert.deepEqual(names, { a: 'Alpha', b: '42', c: 'c', d: 'd', e: 'e', z: 'z' });
  const xr = ir.elements.find(n => n.name === 'c').properties.x_record;
  assert.deepEqual(xr.label, { $missing: true }, 'label column value stays in the record payload');
});

/* Canonical data members mix into a records body (this is what makes refresh
 * round-trips legal); an empty records block is an empty data block. */
test('canonical members mix into a records block; empty block is empty data', () => {
  assertEquivalent(
    'ddn "0.5"; module "t"; records r { columns: v; row a: 1; object b "B" { kind: record; x_record: { v: 2 }; } table t { fields { f; } } } view v { data: [@r]; }',
    'ddn "0.5"; module "t"; data r { object a "a" { kind: record; x_record: { v: 1 }; } object b "B" { kind: record; x_record: { v: 2 }; } object t { kind: table; fields { field f; } } } view v { data: [@r]; }',
    'v', 'mixed records body');
  assertEquivalent(
    'ddn "0.5"; module "t"; records r { columns: v; } view v { data: [@r]; }',
    'ddn "0.5"; module "t"; data r { } view v { data: [@r]; }',
    'v', 'empty records block');
});

/* Coded errors. */
test('column count mismatch names the row and expected/actual counts (DDN-E016)', () => {
  for (const [vals, expected, actual] of [['1, 2', 1, 2], ['1, 2, 3, 4', 3, 4]]) {
    const cols = expected === 1 ? 'v' : 'a, b, c';
    try {
      DDN.parse(`ddn "0.5"; module "t"; records r { columns: ${cols}; row bad: ${vals}; }`);
      assert.fail('expected DDN-E016');
    } catch (e) {
      assert.equal(e.code, 'DDN-E016');
      assert.match(e.message, /Row bad/);
      assert.match(e.message, new RegExp(actual + ' value'));
      assert.match(e.message, new RegExp(expected + ' column'));
    }
  }
});
test('records directives: order, singularity and membership are coded errors', () => {
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; records r { row a: 1; columns: v; }'), e => e.code === 'DDN-E016' && /columns before its first row/.test(e.message));
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; records r { columns: v; row a: 1; columns: v; }'), e => e.code === 'DDN-E016' && /precede every row/.test(e.message));
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; records r { columns: v, v; }'), e => e.code === 'DDN011');
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; records r { columns: v; columns: w; }'), e => e.code === 'DDN011');
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; records r { columns: v; label_column: v; label_column: v; }'), e => e.code === 'DDN011');
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; records r { columns: v; label_column: nope; row a: 1; }'), e => e.code === 'DDN-E016' && /not one of the declared columns/.test(e.message));
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; records r { label_column: v; }'), e => e.code === 'DDN-E016');
});
test('row values are scalar literals only; row bodies carry properties only (DDN-E016)', () => {
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; records r { columns: v; row a: @r.a; }'), e => e.code === 'DDN-E016');
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; records r { columns: v; row a: [1]; }'), e => e.code === 'DDN-E016');
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; records r { columns: v; row a: { x: 1 }; }'), e => e.code === 'DDN-E016');
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; records r { columns: v; row a: 1 { fields { f; } } }'), e => e.code === 'DDN-E016' && /properties only/.test(e.message));
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; records r { columns: v; row a: 1 { kind: record; } }'), e => e.code === 'DDN011');
  assert.throws(() => DDN.parse('ddn "0.5"; module "t"; records r { columns: v; row a: 1 { x_record: {}; } }'), e => e.code === 'DDN011');
});
test('a records block is a data block to tools (label keeps its position)', () => {
  const doc = DDN.parse('ddn "0.5"; module "t"; records r "R" { columns: v; }');
  assert.equal(doc.declarations[0].type, 'data');
  assert.equal(doc.declarations[0].label, 'R');
});

/* D4: row ids ARE the B1-029 refresh keys — keyed add/remove/update against a
 * compact records block. Selector-only graph view: changes are legal. */
const recGraphSrc = `ddn "0.5";
module "t";
records metrics {
 columns: label, value, unit;
 label_column: label;
 row m1: "Alpha", 10, "ms";
 row m2: "Beta", 20, "ms";
 row m3: "Gamma", 15, "ms" { note: "outlier"; };
}
view graph_view { data: [@metrics]; publication { size: content; fit: none; } }
`;
test('keyed refresh on a compact records block: add, remove, update commit', () => {
  const ws = A.createWorkspace({ 'fixture.ddn': recGraphSrc });
  const before = ws.renderSync({ entry: 'fixture.ddn', view: 'graph_view' }).svg;
  const r = ws.replaceData('metrics', [
    { key: 'm1', label: 'Alpha', value: 16, unit: 'ms' },
    { key: 'm3', label: 'Gamma', value: 20, unit: 'ms' },
    { key: 'm9', label: 'Omega', value: 7, unit: 'ms' }]);
  assert.equal(r.committed, true, JSON.stringify(r.diagnostics));
  assert.deepEqual(r.added, ['m9']);
  assert.deepEqual(r.removed, ['m2']);
  assert.deepEqual(r.updated.sort(), ['m1', 'm3']);
  const text = ws.getFiles()['fixture.ddn'];
  assert.ok(!/row m2/.test(text), 'removed row statement deleted');
  assert.ok(text.includes('object m1 "Alpha" { kind: record; x_record: { "label": "Alpha", "value": 16, "unit": "ms" }; }'), 'updated row rewritten in canonical form: ' + text);
  assert.ok(text.includes('object m3 "Gamma"') && text.includes('note: "outlier";'), 'extra row body properties preserved');
  assert.ok(text.includes('object m9'), 'added record appended in canonical form');
  assert.ok(text.includes('columns: label, value, unit;'), 'untouched directives preserved');
  const after = ws.renderSync({ entry: 'fixture.ddn', view: 'graph_view' });
  assert.match(after.svg, /<svg/);
  assert.notEqual(after.svg, before, 'updated values change the rendered graph labels/records');
  const xr = Object.fromEntries(ws.resolve('fixture.ddn', 'graph_view').elements.map(e => [e.ref.split('.').pop(), e.properties.x_record]));
  assert.equal(xr.m1.value, 16); assert.equal(xr.m9.value, 7); assert.equal(xr.m2, undefined);
});
test('keyed refresh with identical values re-renders byte-identical', () => {
  const ws = A.createWorkspace({ 'fixture.ddn': recGraphSrc });
  const before = ws.renderSync({ entry: 'fixture.ddn', view: 'graph_view' }).svg;
  const r = ws.replaceData('metrics', [
    { key: 'm1', label: 'Alpha', value: 10, unit: 'ms' },
    { key: 'm2', label: 'Beta', value: 20, unit: 'ms' },
    { key: 'm3', label: 'Gamma', value: 15, unit: 'ms' }]);
  assert.equal(r.committed, true, JSON.stringify(r.diagnostics));
  assert.equal(ws.renderSync({ entry: 'fixture.ddn', view: 'graph_view' }).svg, before);
});
test('refresh removal of a view-referenced row is rejected transactionally', () => {
  const src = recGraphSrc + `view chart_view {
 data: [@metrics];
 projection { kind: chart; profile: "chart.basic@1"; records: [@metrics.m1, @metrics.m2]; mark: bar; x: "x_record.label"; y: "x_record.value"; unit: "ms"; width: 900px; height: 560px; }
 publication { size: content; fit: none; }
}
`;
  const ws = A.createWorkspace({ 'fixture.ddn': src });
  const before = ws.getFiles();
  const r = ws.replaceData('metrics', [{ key: 'm1', label: 'Alpha', value: 10, unit: 'ms' }]);
  assert.equal(r.committed, false);
  assert.ok(r.diagnostics.some(d => d.failure === 'removed-record-referenced' && d.record === 'm2'));
  assert.deepEqual(ws.getFiles(), before, 'nothing commits on a rejected refresh');
});
test('authoring setRecordValue rewrites a compact row canonically', () => {
  const ws = A.createWorkspace({ 'fixture.ddn': recGraphSrc });
  A.authoring.setRecordValue(ws, 'fixture.ddn', 'graph_view', 't::metrics.m3', 'value', 99);
  const text = ws.getFiles()['fixture.ddn'];
  assert.ok(text.includes('object m3 "Gamma" { kind: record; x_record: { "label": "Gamma", "value": 99, "unit": "ms" }; note: "outlier"; }'), text);
  assert.match(ws.renderSync({ entry: 'fixture.ddn', view: 'graph_view' }).svg, /<svg/);
});

const failed = results.filter(x => x.status === 'fail');
console.log(JSON.stringify({ tests: results.length, passed: results.length - failed.length, failed: failed.length }));
if (failed.length) process.exitCode = 1;
