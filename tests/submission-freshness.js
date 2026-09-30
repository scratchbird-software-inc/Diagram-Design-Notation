/* SPDX-License-Identifier: GPL-2.0-or-later. B1-095: submission drift gate —
 * the standards-submission draft is generated from the actual registry,
 * specification and ddna/ sources; this test rebuilds it and byte-compares,
 * following the dist-freshness pattern. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');
const repo = path.resolve(__dirname, '..'), results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { results.push({ name, pass: false }); console.error('FAIL', name, e.code || '', e.message); process.exitCode = 1; } }

test('submission is byte-fresh (build-submission --check passes)', () => {
  cp.execFileSync(process.execPath, [path.join(repo, 'tools/build-submission.mjs'), '--check'], { stdio: 'pipe' });
});

test('facts.json values are sane and traceable to their sources', () => {
  const facts = JSON.parse(fs.readFileSync(path.join(repo, 'standard/submission/facts.json'), 'utf8'));
  const t = facts.registry.totalKinds.value;
  assert.ok(t > 300 && t === facts.registry.coreKinds.value + facts.registry.profileKinds.value, 'total kinds consistent');
  assert.ok(facts.registry.totalRelations.value > 150, 'relation verbs present');
  assert.ok(facts.profiles.installed.value > 100, 'profiles present');
  assert.ok(facts.icons.icons.value > 100, 'icons present');
  assert.ok(facts.docs.specChapters.value > 40, 'spec chapters present');
  assert.ok(facts.docs.ddnaFamilyChapters.value >= 12, 'all DDNA family chapters present');
  for (const [section, body] of Object.entries(facts)) {
    if (section === 'generated') continue;
    for (const f of Object.values(body))
      assert.ok(typeof f.source === 'string' && f.source.length > 0, 'every fact names its source');
  }
});

test('the drafts carry no internal identifiers or assigned numbers', () => {
  for (const f of ['ddn-submission.md', 'ddna-submission.md']) {
    const text = fs.readFileSync(path.join(repo, 'standard/submission', f), 'utf8');
    assert.ok(!/B1-\d{3}/.test(text), f + ': work-item id leaked');
    assert.ok(!/RFC-\d+/.test(text), f + ': change-record id leaked');
    assert.ok(!/RFC\s+(?:number\s+)?\d{3,}/i.test(text), f + ': assigned-looking RFC number');
    assert.ok(!/has been (submitted|accepted|adopted)/i.test(text), f + ': submission/adoption claim');
    assert.ok(/DRAFT proposal/.test(text), f + ': DRAFT status missing');
    assert.ok(!/\{\{[a-zA-Z.]+\}\}/.test(text), f + ': unrendered placeholder');
  }
});

const passed = results.filter(r => r.pass).length;
console.log(`Submission freshness ${passed}/${results.length}`);
if (passed !== results.length) process.exitCode = 1;
