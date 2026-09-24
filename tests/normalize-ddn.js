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
/* B1-037 D7: compact authoring syntax is an author choice. The normalizer strips
 * default-equal pins but never rewrites verbose↔compact; compact input is
 * preserved (typed declarations stay typed, bare members stay bare). */
{
  const fs = require('node:fs'), os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddn-norm-compact-'));
  const file = path.join(dir, 'fixture.ddn');
  const compact = `ddn "0.5";
module "tests.norm.compact";
data m {
  table customer "Customer" { fields { customer_id { key: primary; } name; } }
  queue inbound { ports { input { direction: in; } } }
  relation r @customer.customer_id -> @inbound.input { kind: flow; }
  ref owner @customer [one] -> @inbound [zeromany] { enforcement: undecided; }
  relations depends { dep @inbound -> @customer; }
}
view v { data: [@m]; layout { frame_overflow: expand; } }
`;
  fs.writeFileSync(file, compact);
  const run = cp.spawnSync(process.execPath, [path.join(root, 'tools/normalize-ddn.mjs'), file], { encoding: 'utf8' });
  if (run.status !== 0) { console.error('FAIL normalize compact preservation:', run.stderr.trim() || run.stdout.trim()); process.exit(1); }
  const out = fs.readFileSync(file, 'utf8');
  fs.rmSync(dir, { recursive: true, force: true });
  const typedKept = out.includes('table customer "Customer"') && out.includes('queue inbound {');
  const bareKept = out.includes('customer_id { key: primary; }') && out.includes('name;') && out.includes('input { direction: in; }');
  const relationsKept = out.includes('ref owner @customer [one] -> @inbound [zeromany]') && out.includes('relations depends {') && out.includes('dep @inbound -> @customer;');
  const notRewritten = !out.includes('object customer') && !out.includes('kind: table') && !out.includes('field customer_id') && !out.includes('port input') && !out.includes('relation owner') && !out.includes('kind: ref') && !out.includes('relation dep');
  const pinStripped = !out.includes('frame_overflow');
  if (!typedKept || !bareKept || !relationsKept || !notRewritten || !pinStripped) {
    console.error('FAIL normalize compact preservation:', JSON.stringify({ typedKept, bareKept, relationsKept, notRewritten, pinStripped }), '\n' + out); process.exit(1);
  }
  console.log('PASS normalize preserves compact authoring syntax (strips pins only)');
}
/* B1-039 D5: one-line view headers are an author choice too. The normalizer
 * strips default-equal pins in a header view's body but never expands the
 * header to the canonical data + projection form. */
{
  const fs = require('node:fs'), os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddn-norm-viewhdr-'));
  const file = path.join(dir, 'fixture.ddn');
  const compact = `ddn "0.5";
module "tests.norm.viewhdr";
data m { table customer "Customer" { fields { id; } } }
view erd "ERD": @m as "erd.crowfoot@1" { layout { frame_overflow: expand; } }
view plain: @m;
`;
  fs.writeFileSync(file, compact);
  const run = cp.spawnSync(process.execPath, [path.join(root, 'tools/normalize-ddn.mjs'), file], { encoding: 'utf8' });
  if (run.status !== 0) { console.error('FAIL normalize view-header preservation:', run.stderr.trim() || run.stdout.trim()); process.exit(1); }
  const out = fs.readFileSync(file, 'utf8');
  fs.rmSync(dir, { recursive: true, force: true });
  const headerKept = out.includes('view erd "ERD": @m as "erd.crowfoot@1"') && out.includes('view plain: @m;');
  const notRewritten = !out.includes('data: [@m]') && !out.includes('projection');
  const pinStripped = !out.includes('frame_overflow');
  if (!headerKept || !notRewritten || !pinStripped) {
    console.error('FAIL normalize view-header preservation:', JSON.stringify({ headerKept, notRewritten, pinStripped }), '\n' + out); process.exit(1);
  }
  console.log('PASS normalize preserves compact view headers (strips pins only)');
}
/* B1-040 D5: keyed tabular records are an author choice too. The normalizer
 * strips default-equal pins but never expands a records block to per-row
 * canonical objects. */
{
  const fs = require('node:fs'), os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddn-norm-records-'));
  const file = path.join(dir, 'fixture.ddn');
  const compact = `ddn "0.5";
module "tests.norm.records";
records metrics {
  columns: label, value, unit;
  label_column: label;
  row m1: "Alpha", 10, "ms";
  row m2: missing, null, "ms" { note: "outlier"; };
}
view v { data: [@metrics]; layout { frame_overflow: expand; } }
`;
  fs.writeFileSync(file, compact);
  const run = cp.spawnSync(process.execPath, [path.join(root, 'tools/normalize-ddn.mjs'), file], { encoding: 'utf8' });
  if (run.status !== 0) { console.error('FAIL normalize records preservation:', run.stderr.trim() || run.stdout.trim()); process.exit(1); }
  const out = fs.readFileSync(file, 'utf8');
  fs.rmSync(dir, { recursive: true, force: true });
  const rowsKept = out.includes('records metrics {') && out.includes('row m1: "Alpha", 10, "ms";') && out.includes('row m2: missing, null, "ms" { note: "outlier"; };');
  const notRewritten = !out.includes('object m1') && !out.includes('object m2') && !out.includes('kind: record') && !out.includes('x_record');
  const pinStripped = !out.includes('frame_overflow');
  if (!rowsKept || !notRewritten || !pinStripped) {
    console.error('FAIL normalize records preservation:', JSON.stringify({ rowsKept, notRewritten, pinStripped }), '\n' + out); process.exit(1);
  }
  console.log('PASS normalize preserves keyed tabular records (strips pins only)');
}
