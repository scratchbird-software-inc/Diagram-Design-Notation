/* SPDX-License-Identifier: GPL-2.0-or-later. B1-010 permanent gallery/developer-docs coverage gate (D4). */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { results.push({ name, pass: false }); console.error('FAIL', name, e.stack); } }

const catalogue = require(path.join(root, 'standard/registry/profiles/catalogue.json'));
const coveragePath = path.join(root, 'website/examples/gallery/coverage.json');
const galleryDir = path.join(root, 'website/examples/gallery');
const docsDir = path.join(root, 'website/docs/developers');

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}

test('coverage.json exists and names every installed profile', () => {
  assert.ok(fs.existsSync(coveragePath), 'website/examples/gallery/coverage.json missing — run npm run build:gallery');
  const cov = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  const installed = catalogue.profiles.map(p => p.id).sort();
  const covered = Object.keys(cov.profiles).sort();
  const missing = installed.filter(id => !covered.includes(id));
  assert.deepEqual(missing, [], 'installed profiles without a gallery entry: ' + missing.join(', '));
});

test('every coverage entry points at a real source view and SVG', () => {
  const cov = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  for (const [id, c] of Object.entries(cov.profiles)) {
    assert.ok(fs.existsSync(path.join(root, c.entry)), id + ': missing source ' + c.entry);
    const src = fs.readFileSync(path.join(root, c.entry), 'utf8');
    assert.ok(src.includes('view ' + c.view + ' '), id + ': view ' + c.view + ' not declared in ' + c.entry);
    assert.ok(fs.existsSync(path.join(galleryDir, c.svg)), id + ': missing SVG ' + c.svg);
  }
});

test('every gallery SVG is non-empty and contains <svg', () => {
  const svgs = [...walk(galleryDir)].filter(p => p.endsWith('.svg'));
  assert.ok(svgs.length >= catalogue.profiles.length, 'suspiciously few gallery SVGs: ' + svgs.length);
  for (const p of svgs) {
    const text = fs.readFileSync(p, 'utf8');
    assert.ok(text.length > 200 && text.includes('<svg'), path.relative(root, p) + ' is not a rendered SVG');
  }
});

test('gallery page links only existing SVGs and inlines no runtime', () => {
  const html = fs.readFileSync(path.join(galleryDir, 'index.html'), 'utf8');
  assert.ok(!html.includes('ddn.global.js') && !html.includes('createWorkspace'), 'gallery page must not inline the runtime');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+\.svg)"/g)].map(m => m[1]);
  assert.ok(refs.length >= catalogue.profiles.length, 'gallery page links too few SVGs');
  for (const r of refs) assert.ok(fs.existsSync(path.join(galleryDir, r)), 'gallery page links missing ' + r);
});

/* B1-035: the gallery must show the isometric diagram types — one iso plate per
 * extrudable mark (bar, pie, donut, area, treemap) in both the marks sheet and
 * the dedicated iso sheet, plus one iso graph plate. Iso plates are presentation
 * variants of existing profiles, so they live in sheets, never in profiles. */
test('iso plates exist for every extrudable mark plus the iso graph', () => {
  const cov = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  for (const id of Object.keys(cov.profiles)) assert.ok(!id.startsWith('iso'), 'iso variants are sheets, not profiles');
  const marks = cov.sheets.marks.views.filter(v => v.iso).map(v => v.view).sort();
  assert.deepEqual(marks, ['mark_iso_area', 'mark_iso_bar', 'mark_iso_donut', 'mark_iso_multiseries', 'mark_iso_pie', 'mark_iso_treemap'], 'marks sheet iso variants');
  const charts = cov.sheets.iso.views.map(v => v.view).sort();
  assert.deepEqual(charts, ['iso_area', 'iso_bar', 'iso_donut', 'iso_multiseries_bar', 'iso_pie', 'iso_treemap'], 'iso chart sheet views');
  assert.ok(cov.sheets.iso.views.every(v => v.iso), 'every iso sheet plate must be extruded');
  assert.deepEqual(cov.sheets.isograph.views.map(v => v.view), ['iso_map'], 'iso graph plate');
  const isoViews = Object.values(cov.sheets).flatMap(s => s.views.filter(v => v.iso));
  assert.ok(isoViews.length >= 13, 'expected at least 13 iso plates, got ' + isoViews.length);
  for (const v of isoViews) {
    const p = path.join(galleryDir, v.svg);
    assert.ok(fs.existsSync(p), 'missing iso SVG ' + v.svg);
    const text = fs.readFileSync(p, 'utf8');
    assert.ok(text.length > 200 && text.includes('ddn-iso'), v.svg + ' is not an extruded iso render');
  }
  const html = fs.readFileSync(path.join(galleryDir, 'index.html'), 'utf8');
  const captions = html.match(/ddn-iso\.js/g) || [];
  assert.ok(captions.length >= isoViews.length, 'each iso plate must caption the live ddn-iso.js requirement');
});

/* B1-053 (D7): the retired examples index folded into the gallery — every
 * view-bearing example file it listed must appear in coverage.json's corpus
 * (one figure per file) and its SVG must exist. Library files (no views) are
 * excluded by construction. Detection mirrors tools/build-gallery.js
 * corpusEntries() exactly, using the workspace API for view detection. */
test('corpus covers every view-bearing example file', () => {
  const A = require(path.join(root, 'notation/dist/ddn.global.js'));
  const cov = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  assert.ok(Array.isArray(cov.corpus), 'coverage.json has no corpus array — run npm run build:gallery');
  const covered = new Set(cov.corpus.map(c => c.entry));
  const exRoot = path.join(root, 'website/examples');
  const entries = [];
  const push = rel => { if (!rel.endsWith('.combined.ddn')) entries.push(rel); };
  for (const f of fs.readdirSync(path.join(exRoot, 'basics')).sort())
    if (/^\d+-.*\.ddn$/.test(f)) push('website/examples/basics/' + f);
  for (const dir of ['projections', 'quality', 'use-cases', 'live'])
    for (const f of fs.readdirSync(path.join(exRoot, dir)).sort())
      if (f.endsWith('.ddn')) push('website/examples/' + dir + '/' + f);
  const missing = [];
  for (const entry of entries) {
    let views = 0;
    try {
      const files = {};
      const visit = name => {
        if (Object.hasOwn(files, name)) return;
        files[name] = fs.readFileSync(path.join(root, name), 'utf8');
        for (const imp of A.parse(files[name], name).imports) visit(A.resolvePath(name, imp.path));
      };
      visit(entry);
      const ws = A.createWorkspace(files);
      views = ws.views(entry).length;
      ws.destroy();
    } catch { /* unparseable — not a corpus entry */ }
    if (views && !covered.has(entry)) missing.push(entry);
    if (views) {
      const c = cov.corpus.find(x => x.entry === entry);
      if (c) assert.ok(fs.existsSync(path.join(galleryDir, c.svg)), entry + ': missing corpus SVG ' + c.svg);
    }
  }
  assert.deepEqual(missing, [], 'example files missing from the gallery corpus: ' + missing.join(', '));
});

test('every method named in api-reference.md exists in public.d.ts', () => {
  const doc = fs.readFileSync(path.join(docsDir, 'api-reference.md'), 'utf8');
  const dts = fs.readFileSync(path.join(root, 'notation/studio/src/public.d.ts'), 'utf8');
  const names = new Set();
  for (const m of doc.matchAll(/^### `([A-Za-z_][A-Za-z0-9_]*)\(/gm)) names.add(m[1]);
  for (const m of doc.matchAll(/^### `([A-Za-z_][A-Za-z0-9_]*)` and `([A-Za-z_][A-Za-z0-9_]*)\(/gm)) { names.add(m[1]); names.add(m[2]); }
  assert.ok(names.size >= 20, 'api-reference.md documents suspiciously few methods: ' + names.size);
  const missing = [...names].filter(n => !dts.includes(n));
  assert.deepEqual(missing, [], 'api-reference.md names methods absent from public.d.ts: ' + missing.join(', '));
});

test('docs/developers contains no TODO/FIXME/XXX markers', () => {
  for (const p of walk(docsDir)) {
    if (!p.endsWith('.md')) continue;
    const text = fs.readFileSync(p, 'utf8');
    assert.ok(!/(TODO|FIXME|XXX)/.test(text), path.relative(root, p) + ' contains a placeholder marker');
  }
});

const passed = results.filter(r => r.pass).length;
console.log(`Gallery coverage ${passed}/${results.length}`);
if (passed !== results.length) process.exitCode = 1;
