#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later.
 * B1-010 gallery generator (D1/D2/D5).
 *
 * Builds website/examples/gallery/:
 *   - one rendered SVG per installed profile (coverage map: profile -> nearest
 *     existing basics/projections example; profiles with no example would need a
 *     new minimal source under website/examples/gallery/src/ — the generator FAILS when
 *     an installed profile has no mapped example),
 *   - variation sheets: chart marks, looks x palettes, routing x look,
 *     layout algorithms, spacing levels,
 *   - coverage.json (the machine-readable coverage map consumed by
 *     notation/tests/gallery-coverage.js),
 *   - index.html: a static, file://-safe page linking the pre-rendered SVGs
 *     (no inlined runtime).
 *
 * Every SVG is produced by the real CLI render path
 * (notation/cli/cli.js render). Generation is deterministic: sorted inputs,
 * fixed templates, no timestamps or random values.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'notation/cli/cli.js');
const OUT = path.join(ROOT, 'website/examples/gallery');
const SRC = path.join(OUT, 'src');
const A = require(path.join(ROOT, 'notation/dist/ddn.global.js'));

const pkg = require(path.join(ROOT, 'package.json'));
const catalogue = require(path.join(ROOT, 'standard/registry/profiles/catalogue.json'));

/* Variation sheets: gallery src file -> the views that make up the sheet. */
const SHEETS = [
  { id: 'marks', title: 'Chart marks', file: 'marks.ddn', blurb: 'Every chart mark the runtime renders: bar, line, area, point, pie, donut (chart.basic@1) and radar, funnel, gauge, candlestick, treemap, sankey (their own profiles).' },
  { id: 'looks', title: 'Looks × palettes', file: 'looks.ddn', blurb: 'Every look (classic, handDrawn, neo) crossed with every palette theme (default, neutral, dark, night, forest, base).' },
  { id: 'routing', title: 'Routing × look', file: 'routing.ddn', blurb: 'Every routing mode (orthogonal, straight, curved bezier, curved rounded) crossed with every look.' },
  { id: 'layouts', title: 'Layout algorithms', file: 'layouts.ddn', blurb: 'Every placement algorithm: native grid, manual (pinned), layered, tree, mindmap, grouped, and the pattern-based fit_grid, circular, radial, spanning_tree, organic.' },
  { id: 'spacing', title: 'Spacing levels', file: 'spacing.ddn', blurb: 'The four spacing hints (tight, normal, loose, expanded) on one graph (B1-008).' }
];

const slug = id => id.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Example entry files scanned for profile coverage, in priority order. */
function exampleEntries() {
  const basics = fs.readdirSync(path.join(ROOT, 'website/examples/basics'))
    .filter(f => /^\d+-.*\.ddn$/.test(f)).sort()
    .map(f => path.join('website/examples/basics', f));
  const projections = fs.readdirSync(path.join(ROOT, 'website/examples/projections'))
    .filter(f => f.endsWith('.ddn')).sort()
    .map(f => path.join('website/examples/projections', f));
  const quality = fs.readdirSync(path.join(ROOT, 'website/examples/quality'))
    .filter(f => f.endsWith('.ddn')).sort()
    .map(f => path.join('website/examples/quality', f));
  const gallerySrc = fs.existsSync(SRC)
    ? fs.readdirSync(SRC).filter(f => f.endsWith('.ddn')).sort().map(f => path.join('website/examples/gallery/src', f))
    : [];
  return [...basics, ...projections, ...quality, ...gallerySrc];
}

/* Load an entry plus its transitive imports into a workspace file map. */
function filesFor(entry) {
  const files = {};
  const visit = name => {
    if (Object.hasOwn(files, name)) return;
    files[name] = fs.readFileSync(path.join(ROOT, name), 'utf8');
    for (const imp of A.parse(files[name], name).imports) visit(A.resolvePath(name, imp.path));
  };
  visit(entry);
  return files;
}

/* Render one view through the real CLI path. */
function render(entry, view, outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  execFileSync(process.execPath, [CLI, 'render', entry, '--view', view, '--out', outFile, '--workspace', path.dirname(entry)], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
  const svg = fs.readFileSync(outFile, 'utf8');
  if (!svg.includes('<svg')) throw new Error('Render did not produce SVG: ' + outFile);
}

/* Build the profile coverage map: first entry (priority order) whose view
 * resolves to the profile wins. Fails when a profile has no example. */
function buildCoverageMap() {
  const profiles = catalogue.profiles.map(p => p.id).sort();
  const remaining = new Map(profiles.map(id => [id, null]));
  for (const entry of exampleEntries()) {
    if (![...remaining.values()].includes(null)) break;
    let ws;
    try { ws = A.createWorkspace(filesFor(entry)); } catch { continue; }
    for (const v of ws.views(entry)) {
      let profile;
      try { profile = ws.resolve(entry, v.id).view.profiles.projection.profile; } catch { continue; }
      if (remaining.get(profile) === null) remaining.set(profile, { entry, view: v.id, title: v.name });
    }
    ws.destroy();
  }
  const missing = [...remaining.entries()].filter(([, v]) => v === null).map(([id]) => id);
  if (missing.length) {
    console.error('Gallery coverage gap: no example renders these installed profiles:');
    for (const id of missing) console.error('  - ' + id + '  (add a minimal real source under website/examples/gallery/src/)');
    process.exit(1);
  }
  return remaining;
}

function sheetViews(file) {
  const entry = path.join('website/examples/gallery/src', file);
  const ws = A.createWorkspace(filesFor(entry));
  const views = ws.views(entry).map(v => ({ id: v.id, title: v.name }));
  ws.destroy();
  return views;
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const coverage = buildCoverageMap();
  const jobs = []; // {section, entry, view, title, svg, relSvg}

  for (const [profile, c] of [...coverage.entries()].sort()) {
    const relSvg = 'profiles/' + slug(profile) + '.svg';
    jobs.push({ section: 'profiles', profile, entry: c.entry, view: c.view, title: c.title, relSvg });
  }
  for (const sheet of SHEETS) {
    for (const v of sheetViews(sheet.file)) {
      jobs.push({ section: sheet.id, entry: path.join('website/examples/gallery/src', sheet.file), view: v.id, title: v.title, relSvg: sheet.id + '/' + v.id.replace(/^mark_/, '') + '.svg' });
    }
  }

  for (const job of jobs) {
    render(job.entry, job.view, path.join(OUT, job.relSvg));
    process.stdout.write('rendered ' + job.relSvg + '\n');
  }

  const coverageJson = {
    version: pkg.version,
    generatedBy: 'tools/build-gallery.js (every SVG via notation/cli/cli.js render)',
    profiles: Object.fromEntries([...coverage.entries()].sort().map(([id, c]) => [id, { entry: c.entry, view: c.view, title: c.title, svg: 'profiles/' + slug(id) + '.svg' }])),
    sheets: Object.fromEntries(SHEETS.map(s => [s.id, { title: s.title, source: 'website/examples/gallery/src/' + s.file, views: sheetViews(s.file).map(v => ({ view: v.id, title: v.title, svg: s.id + '/' + v.id.replace(/^mark_/, '') + '.svg' })) }]))
  };
  fs.writeFileSync(path.join(OUT, 'coverage.json'), JSON.stringify(coverageJson, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'index.html'), page(coverageJson));
  process.stdout.write('gallery: ' + jobs.length + ' SVGs, coverage.json, index.html\n');
}

function page(cov) {
  const families = new Map();
  for (const [id, c] of Object.entries(cov.profiles)) {
    const fam = id.split('.')[0].split('@')[0];
    if (!families.has(fam)) families.set(fam, []);
    families.get(fam).push([id, c]);
  }
  const profileSections = [...families.entries()].sort().map(([fam, rows]) =>
    `<section class="family" id="family-${esc(fam)}">\n<h3>${esc(fam)}</h3>\n<div class="grid">\n` +
    rows.map(([id, c]) => `<figure id="profile-${esc(slug(id))}"><a href="${esc(c.svg)}"><img src="${esc(c.svg)}" alt="${esc(id)} — ${esc(c.title)}" loading="lazy"></a><figcaption><code>${esc(id)}</code><br>${esc(c.title)}<br><small>${esc(c.entry)} · view <code>${esc(c.view)}</code></small></figcaption></figure>`).join('\n') +
    `\n</div>\n</section>`).join('\n');
  const sheetSections = Object.entries(cov.sheets).map(([id, s]) =>
    `<section class="sheet" id="sheet-${esc(id)}">\n<h3>${esc(s.title)}</h3>\n<p>${esc(SHEETS.find(x => x.id === id).blurb)}</p>\n<div class="grid">\n` +
    s.views.map(v => `<figure><a href="${esc(v.svg)}"><img src="${esc(v.svg)}" alt="${esc(v.title)}" loading="lazy"></a><figcaption>${esc(v.title)}</figcaption></figure>`).join('\n') +
    `\n</div>\n</section>`).join('\n');
  const tableRows = Object.entries(cov.profiles).map(([id, c]) =>
    `<tr><td><code>${esc(id)}</code></td><td><a href="#profile-${esc(slug(id))}">${esc(c.title)}</a></td><td><code>${esc(c.entry)}</code></td><td><a href="${esc(c.svg)}">SVG</a></td></tr>`).join('\n');
  const profileCount = Object.keys(cov.profiles).length;
  const sheetCount = Object.values(cov.sheets).reduce((n, s) => n + s.views.length, 0);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DDN example gallery — full notation coverage</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;color:#203047;background:#f7f8fa}
header{padding:1.5rem 2rem;background:#203047;color:#fff}
header h1{margin:0 0 .25rem;font-size:1.4rem}
header p{margin:.15rem 0;opacity:.85;font-size:.9rem}
nav{padding:.75rem 2rem;background:#fff;border-bottom:1px solid #dde3ea;font-size:.85rem;line-height:1.9}
nav a{margin-right:.9rem;color:#285ea8;text-decoration:none;white-space:nowrap}
nav a:hover{text-decoration:underline}
main{padding:1.5rem 2rem;max-width:1500px}
h2{border-bottom:2px solid #285ea8;padding-bottom:.3rem;margin-top:2.5rem}
h3{margin:1.6rem 0 .6rem;color:#285ea8}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:1.1rem}
figure{margin:0;background:#fff;border:1px solid #dde3ea;border-radius:6px;padding:.6rem}
figure img{width:100%;height:auto;display:block}
figcaption{font-size:.8rem;margin-top:.45rem;color:#455}
figcaption code{font-size:.78rem}
table{border-collapse:collapse;width:100%;font-size:.85rem;background:#fff}
th,td{border:1px solid #dde3ea;padding:.35rem .6rem;text-align:left;vertical-align:top}
th{background:#eef2f7}
footer{padding:1.5rem 2rem;font-size:.8rem;color:#667}
</style>
</head>
<body>
<header>
<h1>DDN example gallery</h1>
<p>Full notation coverage for Diagram Design Notation ${esc(cov.version)}: ${profileCount} installed profiles plus ${sheetCount} variation renders — ${profileCount + sheetCount} SVGs, each produced by the reference CLI render path.</p>
<p>Static page: every diagram is a pre-rendered SVG; no runtime is inlined, so this page works from <code>file://</code>.</p>
</header>
<nav>
<strong>Sections:</strong>
<a href="#profiles">Profiles</a>
${Object.keys(cov.sheets).map(id => `<a href="#sheet-${esc(id)}">${esc(cov.sheets[id].title)}</a>`).join('\n')}
<a href="#coverage">Coverage table</a>
</nav>
<main>
<h2 id="profiles">Installed profiles (${profileCount})</h2>
<p>One render per installed profile from <code>standard/registry/profiles/catalogue.json</code>. Each entry reuses the nearest existing example under <code>website/examples/basics/</code> or <code>website/examples/projections/</code>; the coverage map is generated, not hand-written, and is enforced by <code>notation/tests/gallery-coverage.js</code>.</p>
${profileSections}
<h2 id="sheets">Variation sheets</h2>
${sheetSections}
<h2 id="coverage">Coverage table</h2>
<table>
<thead><tr><th>Profile</th><th>Example</th><th>Source</th><th>SVG</th></tr></thead>
<tbody>
${tableRows}
</tbody>
</table>
</main>
<footer>Generated deterministically by <code>tools/build-gallery.js</code> (<code>npm run build:gallery</code>). Regenerate after changing profiles, examples, or the runtime.</footer>
</body>
</html>
`;
}

main();
