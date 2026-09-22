// SPDX-License-Identifier: GPL-2.0-or-later.
// B1-018b behavior suite: designer-side audit hardening fixes —
// validated splitter-width boot values from localStorage, removal of the dead
// file-open input, and the setView fallback scanning real workspace entries.
// Harness style imitates notation/tests/projections.js. No dependencies.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); } }

const ROOT = path.join(__dirname, '..', '..');
const PROTO = path.join(ROOT, 'designer', 'prototype');
const CMD = require(path.join(PROTO, 'commands.js'));
const body = fs.readFileSync(path.join(PROTO, 'body.html'), 'utf8');
const app = fs.readFileSync(path.join(PROTO, 'app.js'), 'utf8');

// 1. Splitter boot widths: localStorage is user-writable, so corrupt values
//    (Infinity, negatives, zero, garbage) must fall back to defaults instead
//    of throwing in gridColumns or collapsing a panel to 0px.
test('splitters.bootWidth: finite positive values pass through, everything else defaults', () => {
  const b = CMD.splitters.bootWidth, D = CMD.splitters.SPLITTER_DEFAULTS;
  assert.strictEqual(b('left', null), D.left);
  assert.strictEqual(b('left', ''), D.left);
  assert.strictEqual(b('left', 'abc'), D.left);
  assert.strictEqual(b('left', 'Infinity'), D.left, 'Infinity must not reach gridColumns');
  assert.strictEqual(b('left', '-500'), D.left, 'negative width must not collapse the panel');
  assert.strictEqual(b('left', '0'), D.left);
  assert.strictEqual(b('inspector', 'NaN'), D.inspector);
  assert.strictEqual(b('left', '250'), 250);
  assert.strictEqual(b('inspector', '306.4'), 306, 'rounds like clampWidth');
  assert.strictEqual(b('left', '9999'), 420, 'in-range-but-huge values clamp to the splitter limit');
  assert.strictEqual(b('left', '10'), 160, 'below-minimum values clamp up');
  assert.throws(() => b('bogus', '100'), e => e.code === 'DDN-I033');
});

// 2. Boot path in app.js routes every persisted width through the validator.
test('app.js boot: splitter widths validated, no raw +store.get coercion remains', () => {
  assert.ok(app.includes("CMD.splitters.bootWidth('left',store.get('ddn-designer-split-left'))"), 'left width not validated');
  assert.ok(app.includes("CMD.splitters.bootWidth('inspector',store.get('ddn-designer-split-inspector'))"), 'inspector width not validated');
  assert.ok(!app.includes("+store.get('ddn-designer-split"), 'raw numeric coercion of a stored width is still present');
});

// 3. Dead <input type="file" id="fileInput"> removed from every designer page.
test('dead fileInput element removed from source and generated designer pages', () => {
  assert.ok(!body.includes('id="fileInput"'), 'body.html still declares fileInput');
  assert.ok(!app.includes('fileInput'), 'app.js references fileInput');
  for (const f of ['index.html', 'standalone.html'])
    assert.ok(!fs.readFileSync(path.join(PROTO, f), 'utf8').includes('id="fileInput"'), f + ' is stale — run build-standalone.mjs');
  const mirror = path.join(ROOT, 'website', 'tools', 'designer', 'index.html');
  assert.ok(!fs.readFileSync(mirror, 'utf8').includes('id="fileInput"'), 'website mirror is stale — run npm run build:site');
});

// 4. setView unknown-view fallback scans the real workspace entries, not a
//    hardcoded two-file list.
test('setView fallback scans ws.entries(), no hardcoded entry list', () => {
  const m = app.match(/function setView\(v\)\{[\s\S]*?draw\(\);/);
  assert.ok(m, 'setView not found');
  assert.ok(m[0].includes('for(const e of ws.entries())'), 'fallback does not iterate workspace entries');
  assert.ok(!m[0].includes("['model.ddn','projections/views.ddn']"), 'hardcoded two-entry fallback list remains');
});

console.log('B1-018b designer hardening ' + pass + '/' + (pass + fail));
if (fail) process.exitCode = 1;
