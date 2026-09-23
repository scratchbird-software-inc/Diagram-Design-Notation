/* SPDX-License-Identifier: GPL-2.0-or-later. B1-019: byte-freshness gate for
 * the generated asset modules and every committed dist artifact (D3/D8).
 * Rebuilds into a temp dir and byte-compares against the committed files. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..'), repo = path.resolve(root, '..'), results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { results.push({ name, pass: false }); console.error('FAIL', name, e.code || '', e.message); process.exitCode = 1; } }

test('runtime asset modules are fresh (standard/registry → notation/runtime/assets)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddn-assets-'));
  cp.execFileSync(process.execPath, [path.join(repo, 'tools/build-assets.js')], { env: { ...process.env, DDN_ASSETS_OUT: tmp }, stdio: 'pipe' });
  const committed = fs.readdirSync(path.join(root, 'runtime/assets')).sort();
  assert.deepEqual(committed, fs.readdirSync(tmp).sort(), 'asset module set drifted');
  for (const f of committed)
    assert.equal(fs.readFileSync(path.join(tmp, f), 'utf8'), fs.readFileSync(path.join(root, 'runtime/assets', f), 'utf8'), f + ' stale — run npm --prefix notation run build:sdk');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('dist artifacts are byte-fresh (Rollup rebuild matches committed files)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddn-dist-'));
  const manifest = path.join(tmp, 'sdk-build.json');
  cp.execFileSync(process.execPath, [path.join(repo, 'tools/build-sdk.js')], { env: { ...process.env, DDN_SDK_OUT: tmp, DDN_SDK_MANIFEST: manifest }, stdio: 'pipe' });
  const produced = fs.readdirSync(tmp).filter(f => f !== 'sdk-build.json').sort();
  const expected = fs.readdirSync(path.join(root, 'dist')).filter(f => /\.(js|mjs|map|css|d\.ts|d\.mts|md)$/.test(f)).sort();
  assert.deepEqual(produced, expected, 'dist file set drifted: ' + JSON.stringify({ produced, expected }));
  for (const f of produced)
    assert.ok(fs.readFileSync(path.join(tmp, f)).equals(fs.readFileSync(path.join(root, 'dist', f))), f + ' stale — run npm --prefix notation run build:sdk');
  assert.equal(fs.readFileSync(manifest, 'utf8'), fs.readFileSync(path.join(repo, 'release/validation/sdk-build.json'), 'utf8'), 'sdk-build.json stale');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('portable studio pages carry the current minified runtime', () => {
  const before = ['portable-editor.html', 'portable-gallery.html'].map(f => fs.readFileSync(path.join(root, 'studio', f), 'utf8'));
  cp.execFileSync(process.execPath, [path.join(repo, 'tools/build-portable-studio.js')], { stdio: 'pipe' });
  const after = ['portable-editor.html', 'portable-gallery.html'].map(f => fs.readFileSync(path.join(root, 'studio', f), 'utf8'));
  assert.deepEqual(after, before, 'portable studio pages stale — run npm --prefix notation run build:studio-portable');
  for (const html of after) assert.ok(html.includes('ddn.global.min.js'), 'portable page must inline the minified runtime');
});

const passed = results.filter(r => r.pass).length;
console.log(`dist-freshness ${passed}/${results.length}`);
if (passed !== results.length) process.exitCode = 1;
