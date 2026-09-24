/* SPDX-License-Identifier: GPL-2.0-or-later. Permanent honesty gate for the AI authoring
 * reference: every complete ```ddn fenced block is extracted into a temp workspace and
 * validated with the reference CLI (`notation/cli/cli.js check`), exactly as the file
 * instructs AI authors to do. A block declaring the shared example module is written as
 * shared.ddn so the blocks that import it resolve. Any CLI error fails the suite.
 *
 * Two copies are gated, whichever exist (both are gitignored internal files):
 *   1. <repo>/AI-REFERENCE.md                       (legacy drop-in copy; blocks only)
 *   2. ../kimi-DDN-workarea/DDN-AI-REFERENCE.md     (B1-030 generated copy)
 * For the generated copy this test additionally acts as a DRIFT GUARD: the
 * `<!-- generated: do not edit (NAME) -->` regions must match a fresh in-memory
 * generation by tools/build-ai-reference.mjs; any drift (registry/profile/property/
 * projection/diagnostic changes not reflected in the file) fails the suite.
 * When neither file exists the suite skips gracefully. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'),
  cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'notation', 'cli', 'cli.js');

const targets = [
  { file: path.join(root, 'AI-REFERENCE.md'), label: 'AI-REFERENCE.md', drift: false },
  { file: path.join(root, '..', 'kimi-DDN-workarea', 'DDN-AI-REFERENCE.md'), label: '../kimi-DDN-workarea/DDN-AI-REFERENCE.md', drift: true },
].filter(t => fs.existsSync(t.file));

if (!targets.length) {
  console.log('ai-reference: skipped: internal file absent (AI-REFERENCE.md is gitignored; drop the internal copy at the repo root to enable this gate)');
  process.exit(0);
}

function extractBlocks(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^```ddn\s*$/.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && !/^```\s*$/.test(lines[j])) j++;
    if (j >= lines.length) throw new Error(file + ':' + (i + 1) + ' unterminated ```ddn fence');
    blocks.push({ line: i + 2, text: lines.slice(i + 1, j).join('\n') });
    i = j;
  }
  if (!blocks.length) throw new Error('no ```ddn blocks found in ' + file);
  return blocks;
}

function checkBlocks(blocks, label) {
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
        const run = label + ' line ' + b.line + ' (' + b.name + (extra.length ? ' ' + extra.join(' ') : '') + ')';
        if (r.status !== 0) {
          failed++;
          console.error('FAIL ' + run + ':');
          console.error((r.stderr || r.stdout).trim());
        } else console.log('PASS ' + run);
      }
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  return { failed, checked };
}

function generatedRegions(text) {
  const regions = new Map();
  const re = /<!-- generated: do not edit \(([\w-]+)\) -->\n([\s\S]*?)\n<!-- \/generated \(\1\) -->/g;
  for (const m of text.matchAll(re)) regions.set(m[1], m[2]);
  return regions;
}

async function driftGuard(file) {
  const { assemble } = await import(path.join(root, 'tools', 'build-ai-reference.mjs'));
  const fresh = assemble({ validate: false }).text;
  const onDisk = generatedRegions(fs.readFileSync(file, 'utf8'));
  const expected = generatedRegions(fresh);
  if (!onDisk.size) {
    console.error('FAIL drift guard: no generated regions found in ' + file);
    return 1;
  }
  let failed = 0;
  for (const [name, body] of expected) {
    if (!onDisk.has(name)) { console.error('FAIL drift guard: region "' + name + '" missing from ' + file); failed++; continue; }
    if (onDisk.get(name) !== body) {
      failed++;
      const a = onDisk.get(name).split('\n'), b = body.split('\n');
      let line = 0;
      while (line < Math.max(a.length, b.length) && a[line] === b[line]) line++;
      console.error('FAIL drift guard: region "' + name + '" differs from fresh generation (first difference at region line ' + (line + 1) + ')');
      console.error('  on disk: ' + (a[line] === undefined ? '<absent>' : a[line].slice(0, 160)));
      console.error('  fresh:   ' + (b[line] === undefined ? '<absent>' : b[line].slice(0, 160)));
    } else console.log('PASS drift guard region "' + name + '" matches fresh generation');
  }
  for (const name of onDisk.keys())
    if (!expected.has(name)) { console.error('FAIL drift guard: unexpected region "' + name + '" in ' + file); failed++; }
  if (failed) console.error('drift guard: regenerate with `node tools/build-ai-reference.mjs`');
  return failed;
}

(async () => {
  let failed = 0, checked = 0;
  for (const t of targets) {
    const r = checkBlocks(extractBlocks(t.file), t.label);
    failed += r.failed; checked += r.checked;
    if (t.drift) failed += await driftGuard(t.file);
  }
  if (failed) { console.error(failed + ' failures across ' + checked + ' check runs'); process.exitCode = 1; }
  else console.log('ai-reference: ' + checked + ' check runs + drift guard, all pass');
})().catch(e => { console.error(e); process.exitCode = 1; });
