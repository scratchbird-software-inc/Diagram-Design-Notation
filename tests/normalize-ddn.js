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
