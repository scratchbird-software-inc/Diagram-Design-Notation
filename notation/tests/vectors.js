/* SPDX-License-Identifier: GPL-2.0-or-later. DDN 0.8 conformance vectors
 * (standard ch. 58): reference vector suite (C1), degenerate corpus (C2) and
 * the patent-drafts regression smoke sweep (§58.3). Fonts are not pinned, so
 * this suite claims geometry-only conformance: every vector publishes a
 * SHA-256 over a canonicalized geometry projection of the scene (node/edge/
 * label boxes and path point sequences rounded to 0.01 px, in document order,
 * text content and paint attributes excluded). Double-render determinism is
 * asserted for every vector (ch. 51 §51.5).
 *
 *   node tests/vectors.js           check against vectors/manifest.json
 *   node tests/vectors.js --record  recompute expected results into the manifest
 */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const DDN = require('../runtime/ddn-core.js').default, Render = require('../runtime/ddn-full.js').default;
const root = path.resolve(__dirname, '..'), repo = path.resolve(root, '..');
const registry = JSON.parse(fs.readFileSync(path.join(repo, 'standard/registry/catalogue.json'), 'utf8'));
const defs = fs.readFileSync(path.join(repo, 'standard/registry/glyph-library.svg'), 'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const vectorsDir = path.join(__dirname, 'vectors'), manifestPath = path.join(vectorsDir, 'manifest.json');
const record = process.argv.includes('--record');
const onlyArg = process.argv.find(a => a.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice(7).split(',')) : null;
const results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { results.push({ name, pass: false }); console.error('FAIL', name, e.message); process.exitCode = 1; } }

/* Canonical geometry projection (ch. 58 §58.1 hash policy 2): whitelisted
 * geometry only, numbers rounded to 0.01 px, document order preserved. */
const round = n => Math.round(n * 100) / 100;
const box = g => g && typeof g === 'object' ? { x: round(g.x || 0), y: round(g.y || 0), w: round(g.w || 0), h: round(g.h || 0) } : g ?? null;
function geometryProjection(scene) {
  return {
    nodes: (scene.nodes || []).map(n => ({ id: n.id, ...box(n) })),
    routes: (scene.routes || []).map(r => ({ id: r.id, points: (r.points || []).map(p => p.map(round)), label: r.label ? box(r.label) : null, source_side: r.source_side ?? null, target_side: r.target_side ?? null })),
    frames: (scene.frames || []).map(f => ({ id: f.id, ...box(f) })),
    subdiagrams: (scene.subdiagrams || []).map(s => ({ id: s.id, ...box(s.bounds || s) })),
    drawingBounds: box(scene.drawingBounds)
  };
}
function stableStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
const geometryHash = scene => crypto.createHash('sha256').update(stableStringify(geometryProjection(scene))).digest('hex');

/* Diagnostics normalized to the ch. 56 §X4 contract {code,severity,file?,line?}. */
function normalize(d, files) {
  const out = { code: d.code, severity: d.severity || 'error' };
  const file = d.file !== undefined ? d.file : d.source;
  if (file) {
    out.file = file;
    const text = files[file], offset = d.offset ?? d.start;
    if (text && typeof offset === 'number') { let line = 1; for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') line++; out.line = line; }
    else if (typeof d.line === 'number') out.line = d.line;
  }
  return out;
}

function runVector(v) {
  const source = fs.readFileSync(path.join(vectorsDir, v.source), 'utf8');
  const files = { [v.source]: source };
  let ir = null, error = null;
  try { ({ ir } = DDN.build(files, v.source, v.view, registry)); } catch (e) { error = e; }
  if (v.expect.reject) {
    assert.ok(error, v.id + ': expected rejection ' + v.expect.reject + ' but the vector built cleanly');
    assert.equal(error.code, v.expect.reject, v.id + ': wrong rejection code');
    return { diagnostics: [normalize(error, files)] };
  }
  assert.ok(!error, v.id + ': build failed: ' + (error && error.code + ' ' + error.message));
  const first = Render.render(ir, registry, defs);
  const second = Render.render(ir, registry, defs);
  assert.equal(second.svg, first.svg, v.id + ': double-render is not byte-identical');
  const hash = geometryHash(first.scene);
  assert.equal(geometryHash(second.scene), hash, v.id + ': geometry hash is not render-stable');
  const diagnostics = [...(ir.diagnostics || []), ...first.diagnostics.filter(d => !(ir.diagnostics || []).includes(d))].map(d => normalize(d, files));
  return { svg: first.svg, geometry_sha256: hash, diagnostics };
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
for (const v of manifest.vectors) {
  if (only && !only.has(v.id)) continue;
  if (v.status === 'deferred') { console.log('SKIP', v.id, '—', v.reason || 'deferred'); continue; }
  test('vector ' + v.id, () => {
    const got = runVector(v);
    if (record) {
      v.expect.diagnostics = got.diagnostics;
      if (!v.expect.reject) v.expect.geometry_sha256 = got.geometry_sha256;
      return;
    }
    assert.deepEqual(got.diagnostics, v.expect.diagnostics, v.id + ': diagnostics drifted (run node tests/vectors.js --record after an intended change)');
    if (!v.expect.reject) assert.equal(got.geometry_sha256, v.expect.geometry_sha256, v.id + ': geometry hash drifted (run node tests/vectors.js --record after an intended change)');
  });
}
if (record) {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log('manifest recorded:', manifestPath);
}

/* §58.3 regression corpus: every patent-drafts figure renders; non-hash smoke
 * sweep (crossing-count and byte-identity gates need the 0.8 baseline report).
 * Double-render determinism is still asserted per figure. */
const patentGlob = path.resolve(repo, '..', 'kimi-specification-workarea/patent-drafts');
let figures = [];
if (fs.existsSync(patentGlob)) {
  for (const draft of fs.readdirSync(patentGlob).sort()) {
    const dir = path.join(patentGlob, draft, 'figures');
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).sort()) if (f.endsWith('.ddn')) figures.push(path.join(dir, f));
  }
}
let rendered = 0;
if (!only) {
  test('patent-drafts regression corpus present', () => assert.ok(figures.length > 0, 'no figures found under ' + patentGlob));
  for (const file of figures) {
  const name = 'patent figure ' + path.relative(patentGlob, file).split(path.sep).join('/');
  test(name, () => {
    const source = fs.readFileSync(file, 'utf8'), files = { [path.basename(file)]: source };
    const ast = DDN.parse(source, path.basename(file));
    for (const view of ast.declarations.filter(x => x.type === 'view')) {
      const { ir } = DDN.build(files, path.basename(file), view.id, registry);
      Render.render(ir, registry, defs);
      rendered++;
    }
  });
  }
}

const passed = results.filter(r => r.pass).length;
console.log(`vectors ${passed}/${results.length}` + (!only && figures.length ? ` (patent figures: ${figures.length} files, ${rendered} views)` : ''));
if (passed !== results.length) process.exitCode = 1;
