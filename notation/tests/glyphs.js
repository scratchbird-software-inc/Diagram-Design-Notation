// SPDX-License-Identifier: GPL-2.0-or-later.
// B1-012 suite: public glyph accessor api.glyphs.forKind — the designer chrome
// renders the notation's own plate vocabulary from the runtime bundle.
// Harness style imitates notation/tests/projections.js. No dependencies.
'use strict';
const assert = require('assert');
const D = require('../dist/ddn.global.js');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

// 1. Positive: a kind with a registered glyph returns its plate symbol.
test('forKind returns the registered glyph for a kind keyword', () => {
  const g = D.glyphs.forKind('table');
  assert.ok(g, 'glyph expected for table');
  assert.strictEqual(g.kind, 'table');
  assert.strictEqual(g.glyph, 'table');
  assert.strictEqual(g.viewBox, '0 0 24 24');
  assert.ok(g.svg.includes('<title>table</title>'), 'symbol body is the plate artwork');
  assert.ok(/<(rect|path|circle|line|polyline|polygon|ellipse)/.test(g.svg), 'symbol body carries drawable marks');
  assert.ok(g.meaning.includes('relational table'), 'registry meaning rides along for tooltips');
});

// 2. Registry-id lookup and profile kinds resolve through the same accessor.
test('forKind accepts registry ids and profile kind keywords', () => {
  const byKeyword = D.glyphs.forKind('table');
  const byId = D.glyphs.forKind('kind.tbl');
  assert.deepStrictEqual(byId, byKeyword, 'registry id resolves to the same glyph');
  const start = D.glyphs.forKind('flow.start');
  assert.ok(start && start.glyph === 'object' && start.svg.includes('<title>object</title>'), 'profile kinds fall back to their base glyph');
});

// 3. Coverage: every kind the API lists resolves a real plate symbol.
test('every listed kind resolves a glyph symbol from the plate library', () => {
  assert.ok(D.kinds.length >= 150, 'kind list populated');
  for (const k of D.kinds) {
    const g = D.glyphs.forKind(k.id);
    assert.ok(g, 'no glyph for kind ' + k.id);
    assert.ok(g.viewBox.split(' ').length === 4, 'viewBox well formed for ' + k.id);
  }
});

// 4. Absent behavior: unknown kinds and invalid input answer null, never a
//    mislabeled or fabricated glyph.
test('forKind answers null for unknown kinds and invalid input', () => {
  assert.strictEqual(D.glyphs.forKind('no.such.kind'), null);
  assert.strictEqual(D.glyphs.forKind(''), null);
  assert.strictEqual(D.glyphs.forKind(null), null);
  assert.strictEqual(D.glyphs.forKind(undefined), null);
  assert.strictEqual(D.glyphs.forKind(42), null);
});

// 5. Safety: returned artwork is plate defs only — no scripts or handlers.
test('glyph artwork carries no scripts, events or external references', () => {
  for (const k of D.kinds) {
    const g = D.glyphs.forKind(k.id);
    assert.ok(!/<script|on[a-z]+=|javascript:/i.test(g.svg), 'unsafe artwork for ' + k.id);
    assert.ok(!g.svg.includes('</symbol'), 'symbol wrapper is not included for ' + k.id);
  }
});

// 6. Determinism: repeated calls return byte-identical payloads.
test('forKind is deterministic', () => {
  assert.strictEqual(JSON.stringify(D.glyphs.forKind('entity')), JSON.stringify(D.glyphs.forKind('entity')));
  assert.strictEqual(JSON.stringify(D.glyphs.forKind('uml.class')), JSON.stringify(D.glyphs.forKind('uml.class')));
});

console.log(`glyphs ${pass}/${pass + fail}`);
if (fail) process.exitCode = 1;
