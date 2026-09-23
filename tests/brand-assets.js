/* SPDX-License-Identifier: GPL-2.0-or-later. B1-020 (D1/D6): ScratchWeaver brand assets —
 * presence, self-containment, byte-freshness of the generated assets/brand/ tree, and
 * brand references in the built website and standalone tool pages. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'),
  os = require('node:os'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { results.push({ name, pass: false }); console.error('FAIL', name, e.stack); process.exitCode = 1; } }

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}

const BRAND_FILES = ['scratchweaver.svg', 'scratchweaver.png', 'favicon.svg', 'favicon-32.png', 'favicon-64.png'];

test('assets/brand/ contains the five brand files', () => {
  for (const f of BRAND_FILES) assert.ok(fs.statSync(path.join(root, 'assets/brand', f)).size > 0, f + ' missing or empty');
});

test('scratchweaver.svg is self-contained with a synthesized viewBox and no editor cruft', () => {
  const svg = fs.readFileSync(path.join(root, 'assets/brand/scratchweaver.svg'), 'utf8');
  assert.match(svg, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[\d.\- ]+"/);
  assert.ok(svg.includes('fill:#0c75bd'), 'logo blue missing');
  assert.ok(!/inkscape:|sodipodi:/.test(svg), 'inkscape/sodipodi attributes left in the logo');
  assert.ok(!/href=|src=|url\(\s*['"]?https?:/.test(svg), 'external reference in the logo');
});

test('build:brand is fresh (re-run into temp dir byte-matches committed assets)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddn-brand-'));
  cp.execFileSync(process.execPath, [path.join(root, 'tools/build-brand.mjs')],
    { env: { ...process.env, DDN_BRAND_OUT: tmp }, stdio: 'pipe' });
  const produced = fs.readdirSync(tmp).sort();
  assert.deepEqual(produced, BRAND_FILES.slice().sort(), 'generated file set changed — run npm run build:brand');
  for (const f of produced) {
    assert.ok(fs.readFileSync(path.join(tmp, f)).equals(fs.readFileSync(path.join(root, 'assets/brand', f))),
      f + ' stale — run npm run build:brand');
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('website shell pages carry the logo, favicons, wordmark, and ScratchBird footer', () => {
  const home = fs.readFileSync(path.join(root, 'website/index.html'), 'utf8');
  assert.ok(home.includes('assets/brand/scratchweaver.svg'), 'logo missing from home header');
  assert.ok(home.includes('assets/brand/favicon.svg') && home.includes('assets/brand/favicon-32.png'), 'favicons missing');
  assert.ok(home.includes('>ScratchWeaver<small>Diagram Design Notation</small>'), 'wordmark missing');
  assert.ok(home.includes('A ScratchBird Software Inc. project · GPL-2.0-or-later'), 'footer provenance missing');
  const download = fs.readFileSync(path.join(root, 'website/download/index.html'), 'utf8');
  assert.ok(download.includes('ScratchWeaver'), 'download page does not mention the product name');
});

test('every HTML page under website/ has a favicon link', () => {
  const missing = [];
  for (const p of walk(path.join(root, 'website'))) {
    if (p.endsWith('.html') && !fs.readFileSync(p, 'utf8').includes('rel="icon"')) missing.push(path.relative(root, p));
  }
  assert.deepEqual(missing, [], 'pages without favicons:\n' + missing.slice(0, 20).join('\n'));
});

test('standalone tool pages carry the ScratchWeaver brand and a favicon', () => {
  for (const rel of ['tools/viewer/index.html', 'tools/designer/index.html',
    'tools/studio/index.html', 'tools/studio/editor.html']) {
    const html = fs.readFileSync(path.join(root, 'website', rel), 'utf8');
    assert.ok(html.includes('ScratchWeaver'), rel + ' missing the product name');
    assert.ok(html.includes('rel="icon"'), rel + ' missing a favicon');
  }
});

const passed = results.filter(r => r.pass).length;
console.log('Brand assets ' + passed + '/' + results.length);
