/* SPDX-License-Identifier: GPL-2.0-or-later. Permanent honesty gate for AI-REFERENCE.md:
 * every complete ```ddn fenced block is extracted into a temp workspace and validated
 * with the reference CLI (`notation/cli/cli.js check`), exactly as the file instructs
 * AI authors to do. A block declaring the shared example module is written as
 * shared.ddn so the blocks that import it resolve. Any CLI error fails the suite. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'),
  cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'AI-REFERENCE.md');
const cli = path.join(root, 'notation', 'cli', 'cli.js');

if (!fs.existsSync(file)) {
  console.log('ai-reference: skipped: internal file absent (AI-REFERENCE.md is gitignored; drop the internal copy at the repo root to enable this gate)');
  process.exit(0);
}

const lines = fs.readFileSync(file, 'utf8').split('\n');
const blocks = [];
for (let i = 0; i < lines.length; i++) {
  if (!/^```ddn\s*$/.test(lines[i])) continue;
  let j = i + 1;
  while (j < lines.length && !/^```\s*$/.test(lines[j])) j++;
  if (j >= lines.length) throw new Error('AI-REFERENCE.md:' + (i + 1) + ' unterminated ```ddn fence');
  blocks.push({ line: i + 2, text: lines.slice(i + 1, j).join('\n') });
  i = j;
}
if (!blocks.length) throw new Error('no ```ddn blocks found in AI-REFERENCE.md');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddn-ai-reference-'));
let failed = 0, checked = 0;
try {
  for (const [i, b] of blocks.entries()) {
    b.name = /module "ddn\.examples\.shared";/.test(b.text) ? 'shared.ddn' : 'block' + (i + 1) + '.ddn';
    fs.writeFileSync(path.join(tmp, b.name), b.text + '\n', 'utf8');
  }
  for (const b of blocks) {
    // The shared library module carries no views; it is validated transitively
    // through every example that imports it, never as a check entry.
    if (b.name === 'shared.ddn') continue;
    const views = [...b.text.matchAll(/^view\s+([A-Za-z_][A-Za-z0-9_-]*)/gm)].map(m => m[1]);
    const runs = views.length ? views.map(v => ['--view', v]) : [[]];
    for (const extra of runs) {
      const r = cp.spawnSync(process.execPath,
        [cli, 'check', path.join(tmp, b.name), '--workspace', tmp, ...extra], { encoding: 'utf8' });
      checked++;
      const label = 'line ' + b.line + ' (' + b.name + (extra.length ? ' ' + extra.join(' ') : '') + ')';
      if (r.status !== 0) {
        failed++;
        console.error('FAIL AI-REFERENCE.md ' + label + ':');
        console.error((r.stderr || r.stdout).trim());
      } else console.log('PASS ' + label);
    }
  }
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

if (failed) { console.error(failed + ' of ' + checked + ' ```ddn blocks failed'); process.exitCode = 1; }
else console.log('ai-reference: ' + checked + ' check runs across ' + blocks.length + ' ```ddn blocks, all pass');
