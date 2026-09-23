/* SPDX-License-Identifier: GPL-2.0-or-later. B1-017 (D4): website link integrity + build freshness.
 *
 * 1. Parses every HTML page under website/ for href/src, resolves each relative link
 *    against its page, and asserts the target exists on disk. External http(s)
 *    links are collected and listed, not fetched.
 * 2. Asserts no link escapes above website/ (no ../ past the root) and that no
 *    file in website/ contains absolute file:/// or /home/ paths.
 * 3. Freshness: re-runs website/build-site.mjs --out <tmp> and byte-compares
 *    every generated file (per .generated-manifest.json) against the committed
 *    output — git is not required.
 */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'),
  os = require('node:os'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const site = path.join(root, 'website');
const results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { results.push({ name, pass: false }); console.error('FAIL', name, e.stack); process.exitCode = 1; } }

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}

const htmlFiles = [...walk(site)].filter(p => p.endsWith('.html'));
const external = new Set();

test('every relative href/src in website/**/*.html resolves to a file on disk', () => {
  const broken = [];
  for (const page of htmlFiles) {
    const text = fs.readFileSync(page, 'utf8');
    for (const m of text.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const u = m[1];
      if (u.includes('${') || u.includes('`') || /[()]/.test(u)) continue; // JS template/regex inside standalone pages, not a real link
      if (/^(https?:|mailto:|data:|javascript:)/.test(u)) { external.add(u.replace(/#.*$/, '').slice(0, 120)); continue; }
      if (u.startsWith('#')) continue;
      const target = u.split('#')[0].split('?')[0];
      if (!target) continue;
      const abs = path.resolve(path.dirname(page), target);
      if (!fs.existsSync(abs)) broken.push(path.relative(site, page) + ' -> ' + u);
      else if (fs.statSync(abs).isDirectory() && !fs.existsSync(path.join(abs, 'index.html'))) broken.push(path.relative(site, page) + ' -> ' + u + ' (directory without index.html)');
    }
  }
  assert.deepEqual(broken, [], 'broken links:\n' + broken.slice(0, 40).join('\n'));
});

test('no link escapes above website/ and no absolute local paths in website/', () => {
  const escapes = [];
  for (const p of walk(site)) {
    const text = fs.readFileSync(p, 'utf8');
    if (/(file:\/\/\/|\/home\/)/.test(text)) escapes.push(path.relative(site, p) + ': contains file:/// or /home/ path');
    if (!p.endsWith('.html')) continue;
    for (const m of text.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const u = m[1];
      if (u.includes('${') || u.includes('`') || /[()]/.test(u)) continue;
      if (/^(https?:|mailto:|data:|javascript:|#)/.test(u)) continue;
      const abs = path.resolve(path.dirname(p), u.split('#')[0].split('?')[0]);
      if (!abs.startsWith(site + path.sep) && abs !== site) escapes.push(path.relative(site, p) + ' escapes website/: ' + u);
    }
  }
  assert.deepEqual(escapes, [], escapes.slice(0, 40).join('\n'));
});

/* B1-023 (D2/D5): every examples-page row links the viewer with a ?src= deep
 * link whose target exists; single-file rows (no `import "..."` lines) also
 * link the designer, import-bearing rows are viewer-only with the note. */
test('examples page: per-row viewer/designer ?src= links match the D2 rule and resolve on disk', () => {
  const pagePath = path.join(site, 'examples/index.html');
  const html = fs.readFileSync(pagePath, 'utf8');
  const examplesRoot = path.join(site, 'examples');
  const ddnFiles = [...walk(examplesRoot)].filter(p => p.endsWith('.ddn'))
    .map(p => path.relative(examplesRoot, p).split(path.sep).join('/')).sort();
  const errors = [];
  for (const f of ddnFiles) {
    const enc = f.split('/').map(encodeURIComponent).join('/');
    const viewer = '../tools/viewer/index.html?src=../../examples/' + enc;
    const designer = '../tools/designer/index.html?src=../../examples/' + enc;
    if (!html.includes('href="' + viewer + '"')) errors.push(f + ': viewer link missing');
    const imports = /^[ \t]*import[ \t]+"/m.test(fs.readFileSync(path.join(examplesRoot, f), 'utf8'));
    const hasDesigner = html.includes('href="' + designer + '"');
    if (imports && hasDesigner) errors.push(f + ': import-bearing example must be viewer-only');
    if (!imports && !hasDesigner) errors.push(f + ': single-file example must link the designer');
    const abs = path.resolve(path.dirname(pagePath), viewer.split('?')[0]);
    if (!fs.existsSync(abs)) errors.push(f + ': viewer page missing at ' + abs);
  }
  const viewerLinks = (html.match(/href="\.\.\/tools\/viewer\/index\.html\?src=/g) || []).length;
  const designerLinks = (html.match(/href="\.\.\/tools\/designer\/index\.html\?src=/g) || []).length;
  assert.strictEqual(viewerLinks, ddnFiles.length, 'one viewer link per example');
  console.log('  examples: ' + ddnFiles.length + ' files · ' + viewerLinks + ' viewer links · ' + designerLinks + ' designer links · ' + (ddnFiles.length - designerLinks) + ' viewer-only (multi-file)');
  assert.deepEqual(errors, [], errors.slice(0, 20).join('\n'));
});

test('build:site is fresh (re-run into temp dir byte-matches committed output)', () => {
  const manifestPath = path.join(site, '.generated-manifest.json');
  assert.ok(fs.existsSync(manifestPath), '.generated-manifest.json missing — run npm run build:site');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddn-site-'));
  cp.execFileSync(process.execPath, [path.join(site, 'build-site.mjs'), '--out', tmp], { stdio: 'pipe' });
  const committed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const rebuilt = JSON.parse(fs.readFileSync(path.join(tmp, '.generated-manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(rebuilt), Object.keys(committed), 'generated file set changed — run npm run build:site');
  const stale = [];
  for (const [rel, hash] of Object.entries(committed)) {
    const a = fs.readFileSync(path.join(site, rel));
    const b = fs.readFileSync(path.join(tmp, rel));
    if (!a.equals(b)) stale.push(rel);
    assert.equal(rebuilt[rel], hash, rel + ' hash mismatch');
  }
  assert.deepEqual(stale, [], 'stale generated files — run npm run build:site:\n' + stale.slice(0, 20).join('\n'));
  fs.rmSync(tmp, { recursive: true, force: true });
});

console.log('External links collected (not fetched): ' + external.size);
const passed = results.filter(r => r.pass).length;
console.log('Website links ' + passed + '/' + results.length);
