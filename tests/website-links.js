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

/* B1-053 (D7): the examples index is retired — a redirect stub to the gallery
 * (matching the retired viewer/studio/designer stubs), because the gallery now
 * renders the complete example corpus with the full detail treatment. */
test('retired examples index is a redirect stub to the gallery corpus', () => {
  const stub = fs.readFileSync(path.join(site, 'examples', 'index.html'), 'utf8');
  assert.ok(stub.includes('url=../gallery/index.html#corpus'), 'meta refresh to the gallery missing');
  assert.ok(stub.includes('ddn-redirect-target'), 'redirect target anchor missing');
  assert.ok(!stub.includes('<table>'), 'stub still ships the retired examples table');
});

/* B1-053 (D7): every view-bearing example file the retired index listed must
 * carry tool deep links on the gallery page (?entry=&view= links, opened in
 * the crawl in tests/example-links-http.js). Library files (no views) must NOT
 * be linked. Detection mirrors tools/build-gallery.js corpusEntries(): basics
 * NN-*.ddn, projections/quality entries, top-level use-cases, live labs;
 * combined variants and gallery/src sheet sources are covered elsewhere. */
test('gallery page deep-links every view-bearing example file', () => {
  const html = fs.readFileSync(path.join(site, 'gallery', 'index.html'), 'utf8');
  const examplesRoot = path.join(site, 'examples');
  const entries = [];
  const push = rel => { if (!rel.endsWith('.combined.ddn')) entries.push(rel); };
  for (const f of fs.readdirSync(path.join(examplesRoot, 'basics')).sort())
    if (/^\d+-.*\.ddn$/.test(f)) push('basics/' + f);
  for (const dir of ['projections', 'quality', 'use-cases', 'live'])
    for (const f of fs.readdirSync(path.join(examplesRoot, dir)).sort())
      if (f.endsWith('.ddn')) push(dir + '/' + f);
  const hasViews = rel => /^[ \t]*view[ \t]/m.test(fs.readFileSync(path.join(examplesRoot, rel), 'utf8'));
  const errors = [];
  let linked = 0, libraries = 0;
  for (const rel of entries) {
    const enc = rel.split('/').map(encodeURIComponent).join('/');
    const encCombined = rel.replace(/\.ddn$/, '.combined.ddn').split('/').map(encodeURIComponent).join('/');
    /* Multi-file examples are deep-linked via their verified combined
     * single-file variant (the gallery detail block names both). */
    const linked_here = html.includes('entry=../examples/' + enc + '&amp;view=') ||
      html.includes('entry=../examples/' + encCombined + '&amp;view=');
    if (!hasViews(rel)) {
      libraries++;
      if (linked_here) errors.push(rel + ': view-less library file must not carry a tool deep link');
      continue;
    }
    if (!linked_here) errors.push(rel + ': no tool deep link on the gallery page');
    else linked++;
  }
  console.log('  corpus: ' + entries.length + ' example files · ' + linked + ' deep-linked on the gallery page · ' + libraries + ' library files (no link)');
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
