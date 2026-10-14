/* SPDX-License-Identifier: GPL-2.0-or-later. B1-020 (D1/D6) + B1-067: DDN brand assets —
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

const BRAND_FILES = [
  'ddn.svg', 'ddn-dark.svg', 'ddn.png',
  'scratchweaver.svg', 'scratchweaver-dark.svg', 'scratchweaver.png',
  'scratchbird.svg', 'scratchbird-dark.svg',
  'scratchrobin.svg', 'scratchrobin-dark.svg',
  'opensource.svg', 'opensource-dark.svg',
  'favicon.svg', 'favicon-32.png', 'favicon-64.png',
  ...['ddn', 'scratchweaver', 'scratchbird', 'scratchrobin', 'opensource']
    .flatMap(name => [name + '.ico', name + '-dark.ico']),
  'favicon.ico',
];

test('assets/brand/ contains the family marks and dark variants', () => {
  for (const f of BRAND_FILES) assert.ok(fs.statSync(path.join(root, 'assets/brand', f)).size > 0, f + ' missing or empty');
});

test('ddn.svg is self-contained with a synthesized viewBox and no editor cruft', () => {
  const svg = fs.readFileSync(path.join(root, 'assets/brand/ddn.svg'), 'utf8');
  assert.match(svg, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[\d.\- ]+"/);
  assert.ok(svg.includes('#0c75bd'), 'logo blue missing');
  assert.ok(!/inkscape:|sodipodi:/.test(svg), 'inkscape/sodipodi attributes left in the logo');
  assert.ok(!/href=|src=|url\(\s*['"]?https?:/.test(svg), 'external reference in the logo');
  const inverse = fs.readFileSync(path.join(root, 'assets/brand/ddn-dark.svg'), 'utf8');
  assert.ok(inverse.includes('#ffffff'), 'blue-to-white inverse missing');
  assert.ok(fs.readFileSync(path.join(root, 'assets/brand/scratchrobin-dark.svg'), 'utf8').includes('#0c75bd'),
    'white-to-blue inverse missing');
});

test('every ICO embeds transparent PNG frames at all standard sizes', () => {
  const expected = [16, 24, 32, 48, 64, 128, 256];
  for (const filename of BRAND_FILES.filter(f => f.endsWith('.ico'))) {
    const bytes = fs.readFileSync(path.join(root, 'assets/brand', filename));
    assert.equal(bytes.readUInt16LE(0), 0, filename);
    assert.equal(bytes.readUInt16LE(2), 1, filename);
    assert.equal(bytes.readUInt16LE(4), expected.length, filename);
    for (const [index, size] of expected.entries()) {
      const entry = 6 + index * 16;
      const actual = bytes[entry] || 256;
      const length = bytes.readUInt32LE(entry + 8);
      const offset = bytes.readUInt32LE(entry + 12);
      assert.equal(actual, size, filename);
      assert.equal(bytes[entry + 1] || 256, size, filename);
      assert.equal(bytes.subarray(offset, offset + 8).toString('hex'), '89504e470d0a1a0a', filename);
      assert.equal(bytes.readUInt32BE(offset + 16), size, filename);
      assert.equal(bytes.readUInt32BE(offset + 20), size, filename);
      assert.ok(offset + length <= bytes.length, filename);
    }
  }
  assert.ok(fs.readFileSync(path.join(root, 'assets/brand/favicon.ico'))
    .equals(fs.readFileSync(path.join(root, 'assets/brand/ddn.ico'))));
});

test('build:brand is fresh when owner artwork is available', () => {
  const source = process.env.DDN_BRAND_SOURCE || '/home/dcalford/Sandbox/ScratchBirdLogos.svg';
  const png = process.env.DDN_WEAVER_PNG || '/home/dcalford/Sandbox/ScratchWeaver.png';
  if (!fs.existsSync(source) || !fs.existsSync(png)) {
    console.log('SKIP owner artwork not installed; committed SVG and site checks still run');
    return;
  }
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
  assert.ok(home.includes('assets/brand/ddn-dark.svg'), 'inverse logo missing from home header');
  assert.ok(home.includes('assets/brand/favicon.svg') && home.includes('assets/brand/favicon-32.png'), 'favicons missing');
  assert.ok(home.includes('assets/brand/favicon.ico'), 'multi-resolution favicon missing');
  assert.ok(home.includes('>ddn<small>Diagram Design Notation</small>'), 'wordmark missing');
  assert.ok(home.includes('assets/brand/scratchweaver-dark.svg'), 'inverse sponsor mark missing from footer');
  assert.ok(home.includes('ScratchWeaver-sponsored') || home.includes('ScratchWeaver project'), 'ScratchWeaver sponsor framing missing');
  assert.ok(home.includes('ScratchWeaver</strong></a>-sponsored open-source project') && home.includes('href="https://scratchbird.ca/weaver"') && home.includes('href="https://www.scratchbird.ca"'), 'footer provenance/link missing');
  const download = fs.readFileSync(path.join(root, 'website/download/index.html'), 'utf8');
  assert.ok(download.includes('open-source Diagram Design Notation project'), 'download page does not name the project');
});

test('every HTML page under website/ has a favicon link', () => {
  const missing = [];
  for (const p of walk(path.join(root, 'website'))) {
    if (p.endsWith('.html') && !fs.readFileSync(p, 'utf8').includes('rel="icon"')) missing.push(path.relative(root, p));
  }
  assert.deepEqual(missing, [], 'pages without favicons:\n' + missing.slice(0, 20).join('\n'));
});

test('standalone tool pages carry the ddn-viewer/ddn-designer brand and a favicon', () => {
  for (const rel of ['tools/index.html', 'tools/designer/index.html',
    'tools/viewer/index.html', 'tools/studio/index.html', 'tools/studio/editor.html']) {
    const html = fs.readFileSync(path.join(root, 'website', rel), 'utf8');
    assert.ok(html.includes('ddn'), rel + ' missing the project name');
    assert.ok(html.includes('rel="icon"'), rel + ' missing a favicon');
  }
});

const passed = results.filter(r => r.pass).length;
console.log('Brand assets ' + passed + '/' + results.length);
