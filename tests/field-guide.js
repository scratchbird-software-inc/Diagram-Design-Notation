/* SPDX-License-Identifier: GPL-2.0-or-later. B1-098: field-guide freshness +
 * contract gate (run 1: generator skeleton + pilot chapters). Regenerates the
 * guide into a temp dir and byte-compares, verifies catalogue/facts
 * integrity, and re-proves every chapter's exercise evidence. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '..'), FG = path.join(repo, 'field-guide'), results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { results.push({ name, pass: false }); console.error('FAIL', name, e.code || '', e.message); process.exitCode = 1; } }
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

test('field-guide output is byte-fresh (build-field-guide rebuild matches committed)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddn-fg-'));
  cp.execFileSync(process.execPath, [path.join(repo, 'tools/build-field-guide.mjs'), '--out', tmp], { stdio: 'pipe' });
  const produced = [];
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); (fs.statSync(p).isDirectory() ? walk : x => produced.push(x))(p); } };
  walk(tmp);
  const rel = p => path.relative(tmp, p).replace(/\\/g, '/');
  const committed = ['catalogue.json', 'coverage.json', 'example-index.json', 'chapter-plan.json', 'FIELD-GUIDE.md', 'index.html', 'portable.html',
    ...fs.readdirSync(path.join(FG, 'lessons')).map(f => 'lessons/' + f)];
  assert.deepEqual(produced.map(rel).sort(), committed.sort(), 'field-guide file set drifted');
  for (const f of committed)
    assert.ok(fs.readFileSync(path.join(tmp, f)).equals(fs.readFileSync(path.join(FG, f))), f + ' stale — run node tools/build-field-guide.mjs');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('catalogue integrity: counts trace to facts.json and every chapter has runtime + exercise evidence', () => {
  const catalogue = JSON.parse(fs.readFileSync(path.join(FG, 'catalogue.json'), 'utf8'));
  const facts = JSON.parse(fs.readFileSync(path.join(repo, 'standard/submission/facts.json'), 'utf8'));
  assert.equal(catalogue.meta.facts.profiles, facts.profiles.installed.value, 'profiles count matches facts');
  assert.equal(catalogue.meta.facts.projectionKinds, facts.profiles.projectionKinds.value, 'projection kinds match facts');
  assert.equal(catalogue.meta.facts.totalKinds, facts.registry.totalKinds.value, 'kinds match facts');
  const plan = JSON.parse(fs.readFileSync(path.join(FG, 'chapter-plan.json'), 'utf8'));
  assert.equal(catalogue.meta.plannedChapterCount, plan.length, 'plan count consistent');
  assert.equal(plan.filter(p => p.status === 'pilot').length, catalogue.lessons.length, 'pilot count consistent');
  for (const l of catalogue.lessons) {
    for (const k of ['id', 'title', 'category', 'status', 'entry', 'view', 'what', 'why', 'when', 'read', 'inputs', 'pitfalls', 'limits', 'runtime', 'files', 'sourceTour', 'viewSource', 'walkthrough', 'experiment', 'exerciseEvidence', 'editTask'])
      assert.ok(l[k] !== undefined, l.id + ': missing contract field ' + k);
    assert.ok(l.runtime.sha256 && l.runtime.modelFingerprint, l.id + ': runtime evidence');
    assert.ok(l.exerciseEvidence.changed === true, l.id + ': exercise must change the render');
    assert.ok(l.exerciseEvidence.undoRestoresBefore === true, l.id + ': undo must restore shipped bytes');
    assert.ok(fs.existsSync(path.join(repo, l.entry)), l.id + ': entry file exists');
  }
});

test('every chapter fixture re-renders to the recorded sha256 (evidence is fresh)', () => {
  const catalogue = JSON.parse(fs.readFileSync(path.join(FG, 'catalogue.json'), 'utf8'));
  const A = require(path.join(repo, 'notation/dist/ddn.global.js'));
  // Same optional-module wiring as the builder (iso/geo projections render
  // missing-module placeholders otherwise).
  require(path.join(repo, 'notation/dist/ddn-graph.js'));
  require(path.join(repo, 'notation/dist/ddn-iso.js'));
  require(path.join(repo, 'notation/dist/ddn-geo.js'));
  try {
    const asset = path.join(repo, 'assets/geo/world-110m.json');
    if (fs.existsSync(asset) && globalThis.DDNGeo) {
      const g = fs.readFileSync(asset, 'utf8');
      globalThis.DDNGeo.registerGeography('assets/geo/world-110m.json', g);
      globalThis.DDNGeo.registerGeography('world-110m', g);
    }
  } catch {}
  // Same art-pack wiring as the builder: x_art chapters render with the
  // shipped pack registered (placeholder renders otherwise).
  try {
    const idx = path.join(repo, 'standard/registry/art-packs/index.json');
    if (fs.existsSync(idx)) for (const f of JSON.parse(fs.readFileSync(idx, 'utf8')).packs)
      A.registerArtPack(JSON.parse(fs.readFileSync(path.join(repo, 'standard/registry/art-packs', f), 'utf8')));
  } catch {}
  for (const l of catalogue.lessons) {
    const files = {};
    const visit = name => {
      if (Object.hasOwn(files, name)) return;
      files[name] = fs.readFileSync(path.join(repo, name), 'utf8');
      const ast = A.parse(files[name], name);
      for (const imp of ast.imports) visit(A.resolvePath(name, imp.path));
      const walk = n => { if (n.type === 'architecture') for (const f of (n.props && n.props.files) || []) visit(A.resolvePath(name, f)); if (n.props && n.props.x_link && n.props.x_link.file) visit(A.resolvePath(name, n.props.x_link.file)); for (const c of n.children || []) walk(c); };
      for (const sec of ast.sections || []) for (const d of sec.declarations || []) walk(d);
    };
    visit(l.entry);
    const ws = A.createWorkspace(files);
    const r = ws.renderSync({ entry: l.entry, view: l.view });
    assert.equal(sha256(r.svg), l.runtime.sha256, l.id + ': render drifted — rebuild the guide');
    ws.destroy();
  }
});

test('lesson pages are self-contained apart from the repo-relative runtime script', () => {
  const committed = fs.readdirSync(path.join(FG, 'lessons')).filter(f => f.endsWith('.html'));
  assert.ok(committed.length >= 6, 'pilot lesson pages present');
  for (const f of committed) {
    const html = fs.readFileSync(path.join(FG, 'lessons', f), 'utf8');
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(u => !u.startsWith('#') && !u.startsWith('data:')
      // outbound navigation link to the project wiki — a hyperlink, not a
      // remote resource; nothing is fetched from it to render the page
      && u !== 'https://github.com/scratchbird-software-inc/Diagram-Design-Notation/wiki');
    for (const u of refs)
      assert.ok(!/^(?:[a-z]+:)?\/\//.test(u), f + ': absolute or protocol-relative reference ' + u);
    assert.ok(!/https?:\/\//.test(html.replace(/<footer>[\s\S]*<\/footer>/, '').replace(/https?:\/\/www\.w3\.org\/(?:2000\/svg|1999\/xlink)/g, '').replace(/https:\/\/github\.com\/scratchbird-software-inc\/Diagram-Design-Notation\/wiki/g, '')), f + ': no remote references outside footer');
  }
});

const passed = results.filter(r => r.pass).length;
console.log(`Field guide ${passed}/${results.length}`);
if (passed !== results.length) process.exitCode = 1;
