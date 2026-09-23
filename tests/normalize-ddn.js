#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. B1-021 D6: permanent minimality gate.
 * Runs tools/normalize-ddn.mjs --check over the shipped .ddn corpus; any
 * regression to pinned-by-default properties, legacy headers, or dead empty
 * blocks fails the suite. */
'use strict';
const cp = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const r = cp.spawnSync(process.execPath, [path.join(root, 'tools/normalize-ddn.mjs'), '--check'], { encoding: 'utf8' });
const summary = r.stdout.trim().split('\n').pop();
try { const s = JSON.parse(summary); console.log('normalize-ddn corpus:', s.files, 'files,', s.filesChanged, 'non-minimal,', s.errors.length, 'errors'); }
catch { console.log(r.stdout); }
if (r.stderr.trim()) console.error(r.stderr.trim());
if (r.status !== 0) { console.error('FAIL normalize-ddn --check (exit ' + r.status + '): corpus is not minimal — run `node tools/normalize-ddn.mjs`'); process.exit(1); }
console.log('PASS normalize-ddn --check: corpus is minimal, current-dialect');

/* B1-022: explicit `frame_overflow: expand` is the RFC-118 default and must be
 * strippable; `confine` (non-default) must survive. */
{
  const fs = require('node:fs'), os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddn-norm-'));
  const file = path.join(dir, 'fixture.ddn');
  fs.writeFileSync(file, `ddn "0.5";
module "tests.norm.frameoverflow";
data m { object box "B" { kind: block; } object a "A" { kind: block; } }
view v1 "Expand" { data: [@m]; select: [@m.a]; layout { frame_overflow: expand; } frame f "F" { scope: @m.box; members: [@m.a]; } }
view v2 "Confine" { data: [@m]; select: [@m.a]; layout { frame_overflow: confine; } frame f "F" { scope: @m.box; members: [@m.a]; } }
`);
  const run = cp.spawnSync(process.execPath, [path.join(root, 'tools/normalize-ddn.mjs'), file], { encoding: 'utf8' });
  if (run.status !== 0) { console.error('FAIL normalize frame_overflow strip:', run.stderr.trim() || run.stdout.trim()); process.exit(1); }
  const out = fs.readFileSync(file, 'utf8');
  const expandGone = !out.includes('frame_overflow: expand');
  const confineKept = /view v2[\s\S]*?frame_overflow: confine/.test(out);
  fs.rmSync(dir, { recursive: true, force: true });
  if (!expandGone || !confineKept) { console.error('FAIL normalize frame_overflow: expand stripped =', expandGone, ', confine kept =', confineKept); process.exit(1); }
  console.log('PASS normalize strips default frame_overflow: expand, keeps confine');
}
