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

/* B1-023 (D2/D5) + B1-027 (D8) + B1-048 (D6) + B1-051 (D3): every examples-page
 * row for a view-bearing file links the unified tool with a ?src= deep link
 * whose target exists; single-file rows (no `import "..."` lines) also link
 * the same tool in design mode (?mode=design — the retired designer prototype
 * URL is now a redirect stub), import-bearing rows stay explore-only with the
 * note. Files with no top-level `view` declaration are library files: no mode
 * can render them, so they carry the library note and NO "Open in" link. */
test('examples page: per-row tool/designer ?src= links match the D2 rule and resolve on disk', () => {
  const pagePath = path.join(site, 'examples/index.html');
  const html = fs.readFileSync(pagePath, 'utf8');
  const examplesRoot = path.join(site, 'examples');
  const ddnFiles = [...walk(examplesRoot)].filter(p => p.endsWith('.ddn'))
    .map(p => path.relative(examplesRoot, p).split(path.sep).join('/')).sort();
  const errors = [];
  let viewBearing = 0, libraries = 0;
  for (const f of ddnFiles) {
    const enc = f.split('/').map(encodeURIComponent).join('/');
    const tool = '../tools/index.html?src=../examples/' + enc + '&amp;mode=explore';
    const designer = '../tools/index.html?src=../examples/' + enc + '&amp;mode=design';
    const src = fs.readFileSync(path.join(examplesRoot, f), 'utf8');
    const imports = /^[ \t]*import[ \t]+"/m.test(src);
    const views = /^[ \t]*view[ \t]/m.test(src);
    if (!views) {
      libraries++;
      if (html.includes('src=../examples/' + enc)) errors.push(f + ': view-less library file must not carry an Open-in link');
      continue;
    }
    viewBearing++;
    if (!html.includes('href="' + tool + '"')) errors.push(f + ': tool link missing');
    const hasDesigner = html.includes('href="' + designer + '"');
    if (imports && hasDesigner) errors.push(f + ': import-bearing example must be explore-only');
    if (!imports && !hasDesigner) errors.push(f + ': single-file example must link design mode');
    const abs = path.resolve(path.dirname(pagePath), tool.split('?')[0]);
    if (!fs.existsSync(abs)) errors.push(f + ': tool page missing at ' + abs);
  }
  const toolLinks = (html.match(/href="\.\.\/tools\/index\.html\?src=[^"]*&amp;mode=explore"/g) || []).length;
  const designerLinks = (html.match(/href="\.\.\/tools\/index\.html\?src=[^"]*&amp;mode=design"/g) || []).length;
  assert.strictEqual(toolLinks, viewBearing, 'one explore link per view-bearing example');
  console.log('  examples: ' + ddnFiles.length + ' files · ' + toolLinks + ' tool links · ' + designerLinks + ' design-mode links · ' + (viewBearing - designerLinks) + ' explore-only (multi-file) · ' + libraries + ' library files (no link)');
  assert.deepEqual(errors, [], errors.slice(0, 20).join('\n'));
});

/* B1-051 (D3): the retired designer prototype URL is a param-preserving
 * redirect stub to ?mode=design, like the B1-027 viewer/studio stubs. */
test('retired designer URL is a redirect stub to the tool in design mode', () => {
  const stub = fs.readFileSync(path.join(site, 'tools', 'designer', 'index.html'), 'utf8');
  assert.ok(stub.includes('ddn-redirect-target'), 'redirect target anchor missing');
  assert.ok(stub.includes('"mode=design"') || stub.includes('?mode=design'), 'stub does not force mode=design');
  assert.ok(stub.includes('mapLegacyParams'), 'shared legacy-param mapper not inlined');
  assert.ok(!stub.includes('id="paper"'), 'stub still ships the retired prototype');
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
