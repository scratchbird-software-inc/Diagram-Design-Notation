#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. B1-017 (D3): deterministic, zero-dependency
 * static site generator for website/.
 *
 *   node website/build-site.mjs            # write generated files into website/
 *   node website/build-site.mjs --out DIR  # write the same tree into DIR (freshness test)
 *
 * What it does:
 *   - copies tool artifacts into the site mirror (viewer, designer, studio, plates,
 *     gallery, dist bundles, LICENSE/NOTICE)
 *   - renders markdown (docs, examples README, standard specification + governance,
 *     studio tool docs) to shell-wrapped HTML with a small built-in md renderer
 *   - generates the static pages (home, features, tools, docs, standard, examples,
 *     download, license)
 *   - writes .generated-manifest.json (path → sha256) for the freshness test
 *
 * The script is idempotent and deterministic: fixed inputs, sorted traversal, no
 * timestamps. Generated outputs are committed (like notation/dist/).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx >= 0 ? path.resolve(process.argv[outIdx + 1]) : path.join(REPO, 'website');
const VERSION = JSON.parse(fs.readFileSync(path.join(REPO, 'notation/package.json'), 'utf8')).version;

const written = []; // paths relative to OUT, for the manifest
function writeOut(rel, content) {
  const target = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  written.push(rel.split(path.sep).join('/'));
}
function copyOut(rel, absSource) {
  writeOut(rel, fs.readFileSync(absSource));
}
const readRepo = rel => fs.readFileSync(path.join(REPO, rel), 'utf8');

function* walk(absDir) {
  for (const e of fs.readdirSync(absDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(absDir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}

/* ---------------------------------------------------------------- md renderer
 * Headings, lists, code fences, tables, links, bold/italic, inline code,
 * blockquotes, hr. Sufficient for this repo's docs; NOT a general markdown
 * library. Deterministic by construction. */

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// mdSourceAbs (absolute path of the .md being rendered) + mdHtmlMap (Map of
// absolute .md source → site-relative .html output) drive link rewriting:
// links to markdown we render become .html links; everything else passes through.
function renderMd(src, mdSourceAbs, mdHtmlMap, outRelDir) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;
  const inline = text => {
    let t = esc(text);
    t = t.replace(/`([^`]+)`/g, (m, c) => '<code>' + c + '</code>');
    t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, u) => '<img alt="' + alt + '" src="' + rewriteLink(u) + '">');
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, u) => '<a href="' + rewriteLink(u) + '">' + label + '</a>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return t;
  };
  const rewriteLink = u => {
    if (/^(https?:|mailto:|#)/.test(u)) return u;
    const [file, anchor] = u.split('#');
    if (!file.endsWith('.md')) return u;
    const abs = path.resolve(path.dirname(mdSourceAbs), file);
    const relHtml = mdHtmlMap.get(abs);
    if (!relHtml) return u;
    let out = path.posix.relative(outRelDir, relHtml) || path.posix.basename(relHtml);
    return out + (anchor ? '#' + anchor : '');
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      html.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)[0].length;
      html.push('<h' + level + '>' + inline(line.replace(/^#+\s*/, '')) + '</h' + level + '>');
      i++;
      continue;
    }
    if (/^\s*---+\s*$/.test(line)) { html.push('<hr>'); i++; continue; }
    if (/^>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      html.push('<blockquote>' + buf.map(inline).join('<br>') + '</blockquote>');
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(1).filter(r => !/^\s*\|?[\s:-]+\|[\s|:-]*$/.test(r) || /\|.*[a-zA-Z]/.test(r)).filter(r => !/^[\s|:-]+$/.test(r));
      html.push('<table><thead><tr>' + head.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' +
        body.map(r => '<tr>' + cells(r).map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>');
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      html.push('<ul>' + buf.map(b => '<li>' + inline(b) + '</li>').join('') + '</ul>');
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*\d+\.\s+/, ''));
      html.push('<ol>' + buf.map(b => '<li>' + inline(b) + '</li>').join('') + '</ol>');
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,6}\s|```|>|\s*[-*]\s+|\s*\d+\.\s+|\s*\|.*\||\s*---+\s*$)/.test(lines[i])) buf.push(lines[i++]);
    html.push('<p>' + inline(buf.join(' ')) + '</p>');
  }
  return html.join('\n');
}

/* ------------------------------------------------------------------- shell */

const NAV = [
  ['Home', 'index.html', 'home'],
  ['Features', 'features/index.html', 'features'],
  ['Gallery', 'gallery/index.html', 'gallery'],
  ['Examples', 'examples/index.html', 'examples'],
  ['Docs', 'docs/index.html', 'docs'],
  ['Standard', 'standard/index.html', 'standard'],
  ['Tools', 'tools/index.html', 'tools'],
  ['Download', 'download/index.html', 'download'],
];

function favicons(base) {
  return '<link rel="icon" type="image/svg+xml" href="' + base + 'assets/brand/favicon.svg">\n' +
    '<link rel="icon" type="image/png" sizes="32x32" href="' + base + 'assets/brand/favicon-32.png">\n' +
    '<link rel="icon" type="image/png" sizes="64x64" href="' + base + 'assets/brand/favicon-64.png">\n';
}

function shell({ base, title, active, body, description }) {
  const nav = NAV.map(([label, href, key]) =>
    '<a href="' + base + href + '"' + (key === active ? ' class="active"' : '') + '>' + label + '</a>').join('\n      ');
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + esc(title) + '</title>\n' +
    (description ? '<meta name="description" content="' + esc(description) + '">\n' : '') +
    favicons(base) +
    '<link rel="stylesheet" href="' + base + 'assets/site.css">\n</head>\n<body>\n' +
    '<header class="site-header"><div class="bar">\n' +
    '  <a class="wordmark" href="' + base + 'index.html"><img class="logo" src="' + base + 'assets/brand/scratchweaver.svg" alt="ScratchWeaver logo">' +
    '<span class="name">ScratchWeaver<small>Diagram Design Notation</small></span></a>\n' +
    '  <button class="nav-toggle" aria-label="Toggle navigation">☰</button>\n' +
    '  <nav class="site-nav">\n      ' + nav + '\n  </nav>\n</div></header>\n' +
    body + '\n' +
    '<footer class="site-footer"><div class="inner">\n' +
    '  <span>ScratchWeaver ' + VERSION + ' — the DDN toolkit · proposed standard, pre-1.0</span>\n' +
    '  <span>A <a href="https://www.scratchbird.ca">ScratchBird Software Inc.</a> project · GPL-2.0-or-later</span>\n' +
    '  <a href="' + base + 'license/index.html">License: GPL-2.0-or-later</a>\n' +
    '  <a href="' + base + 'docs/index.html">Docs</a>\n' +
    '  <a href="' + base + 'standard/index.html">Standard</a>\n' +
    '  <a href="' + base + 'download/index.html">Download</a>\n' +
    '  <span class="spacer"></span>\n' +
    '  <span>All processing is local to this page.</span>\n' +
    '</div></footer>\n' +
    '<script src="' + base + 'assets/site.js"></script>\n</body>\n</html>\n';
}

function page(base, active, title, inner, description) {
  return shell({ base, title, active, description, body: '<main class="site-main">\n' + inner + '\n</main>' });
}

/* ------------------------------------------------------------ asset copies */

// ScratchWeaver brand assets (B1-020): logo, favicons.
for (const f of fs.readdirSync(path.join(REPO, 'assets/brand')).sort()) {
  copyOut('assets/brand/' + f, path.join(REPO, 'assets/brand', f));
}

// Runtime bundles: served for the embed examples and the download page.
for (const f of fs.readdirSync(path.join(REPO, 'notation/dist')).sort()) {
  if (/\.(js|mjs|css|d\.ts|d\.mts|map)$/.test(f)) copyOut('dist/' + f, path.join(REPO, 'notation/dist', f));
}

// Gallery (pre-rendered SVGs, page, coverage map) — mirrored from the moved corpus.
// Mirrored HTML pages that carry no favicon of their own get the site favicons
// injected (standalone tool pages bring their own data-URI icons and are skipped).
function withFavicons(html, outRel) {
  if (!html.includes('</head>') || html.includes('rel="icon"')) return html;
  const depth = outRel.split('/').length - 1;
  const base = depth > 0 ? Array(depth).fill('..').join('/') + '/' : '';
  return html.replace('</head>', favicons(base) + '</head>');
}
const gallerySrc = path.join(REPO, 'website/examples/gallery');
for (const p of walk(gallerySrc)) {
  const rel = path.posix.join('gallery', path.relative(gallerySrc, p).split(path.sep).join('/'));
  if (p.endsWith('.html')) {
    // The gallery source lives two levels deeper than the mirror; retarget its
    // favicon hrefs to the mirror's depth, then inject favicons if it has none.
    const html = fs.readFileSync(p, 'utf8').split('href="../../assets/brand/').join('href="../assets/brand/');
    writeOut(rel, withFavicons(html, rel));
  }
  else copyOut(rel, p);
}

// Notation plates browser (already a single self-contained page with inlined SVGs).
// Its template links are repo-relative; retarget them to site pages for the mirror.
writeOut('plates/index.html',
  withFavicons(readRepo('standard/plates/index.html')
    .split('href="../../index.html"').join('href="../index.html"')
    .split('href="../../website/index.html"').join('href="../index.html"')
    .split('href="../registry/catalogue.json"').join('href="../standard/index.html"')
    .split('href="../specification/04-notation-and-looks.md"').join('href="../standard/specification/04-notation-and-looks.html"'), 'plates/index.html'));

// License texts.
copyOut('license/LICENSE', path.join(REPO, 'LICENSE'));
copyOut('license/NOTICE.md', path.join(REPO, 'NOTICE.md'));

/* ------------------------------------------------------- standalone mirrors */

// End-user viewer: already a single self-contained file, no relative refs.
copyOut('tools/viewer/index.html', path.join(REPO, 'notation/viewer/ddn-viewer.html'));

// Visual designer prototype: single file; one repo-relative link to fix.
writeOut('tools/designer/index.html',
  readRepo('designer/prototype/standalone.html').split('href="../../README.md"').join('href="../../index.html"'));

// Studio: portable library (landing) + portable editor, with nav/spec links
// retargeted to the rendered site pages.
writeOut('tools/studio/index.html',
  readRepo('notation/studio/portable-gallery.html')
    .split('href="../../docs/notes/ROUTING-PATCH.md"').join('href="../../docs/notes/ROUTING-PATCH.html"')
    .split('href="../../website/examples/README.md"').join('href="../../examples/index.html"')
    .split('href="../../standard/specification/00-status-and-scope.md"').join('href="../../standard/specification/00-status-and-scope.html"'));
writeOut('tools/studio/editor.html',
  readRepo('notation/studio/portable-editor.html')
    .split('href="docs/EDITOR.md"').join('href="docs/EDITOR.html"')
    .split('href="../../standard/specification/00-status-and-scope.md"').join('href="../../standard/specification/00-status-and-scope.html"')
    .split('href="../../standard/specification/01-language.md"').join('href="../../standard/specification/01-language.html"'));

/* --------------------------------------------------------- markdown renders
 * Map of absolute .md source → site-relative .html output, built first so
 * cross-links between rendered pages resolve to .html. */

const mdJobs = []; // { absSource, outRel, active, section }
function addMdTree(absDir, outDir, active) {
  for (const p of walk(absDir)) {
    if (!p.endsWith('.md')) continue;
    const rel = path.relative(absDir, p).split(path.sep).join('/').replace(/\.md$/, '.html');
    mdJobs.push({ absSource: p, outRel: path.posix.join(outDir, rel), active });
  }
}
addMdTree(path.join(REPO, 'website/docs'), 'docs', 'docs');
addMdTree(path.join(REPO, 'standard/specification'), 'standard/specification', 'standard');
addMdTree(path.join(REPO, 'standard/governance'), 'standard/governance', 'standard');
addMdTree(path.join(REPO, 'notation/studio/docs'), 'tools/studio/docs', 'tools');
mdJobs.push({ absSource: path.join(REPO, 'website/examples/README.md'), outRel: 'examples/README.html', active: 'examples' });

const mdHtmlMap = new Map(mdJobs.map(j => [j.absSource, j.outRel]));
for (const j of mdJobs) {
  const src = readRepo(path.relative(REPO, j.absSource));
  const titleMatch = src.match(/^#\s+(.+)$/m);
  const title = (titleMatch ? titleMatch[1].replace(/[`*]/g, '') : path.basename(j.outRel, '.html')) + ' — DDN';
  const outRelDir = path.posix.dirname(j.outRel);
  const depth = outRelDir.split('/').length;
  const base = depth > 0 ? Array(depth).fill('..').join('/') + '/' : '';
  const bodyHtml = renderMd(src, j.absSource, mdHtmlMap, outRelDir);
  const srcCommittedBeside = fs.existsSync(path.join(OUT, j.outRel.replace(/\.html$/, '.md'))) ||
    fs.existsSync(path.join(REPO, 'website', j.outRel.replace(/\.html$/, '.md')));
  writeOut(j.outRel, page(base, j.active, title,
    '<article class="md-body">\n' + bodyHtml + '\n</article>\n' +
    '<p><small>Rendered ' +
    (srcCommittedBeside ? 'from <a href="' + path.posix.basename(j.absSource) + '">' + path.posix.basename(j.absSource) + '</a> ' : 'from the repository source ') +
    'by <code>website/build-site.mjs</code>.</small></p>'));
}

/* ------------------------------------------------------------------- pages */

// Home: hero + live-render panel (runtime inlined, file://-safe) + feature grid.
// Minified production runtime (same globals/guards as ddn.global.js; the
// readable build stays in dist). sourceMappingURL is meaningless once inlined.
const runtime = readRepo('notation/dist/ddn.global.min.js').replace(/\n\/\/# sourceMappingURL=\S+\n$/, '\n');
if (runtime.includes('</script')) throw new Error('runtime contains </script; inlining would break the page');

const demoSource = `
ddn "0.5";
module "designer.sample";
// Synthetic design; no production/customer information.
data model {
    object customer "Customer" {
        kind: table;
        description: "A customer in the commerce domain";
        fields { field id; field display_name; field status; }
    }
    object orders "Order" {
        kind: table;
        fields { field id; field customer_id; field created_at; }
    }
    object invoice "Invoice" {
        kind: table;
        fields { field id; field order_id; field issued_at; }
    }
    object posting "Post to ledger" { kind: activity; }
    relation order_customer "Customer reference" @model.orders.customer_id -> @model.customer.id { kind: ref; enforcement: undecided; }
    relation invoice_order "Order reference" @model.invoice.order_id -> @model.orders.id { kind: ref; enforcement: undecided; }
    relation invoice_post "Approved invoice" @model.invoice -> @model.posting { kind: flow; }
}
format common {
    style standard { look: classic; theme: default; font: sans; }
    layout grid { algorithm: grid; columns: 2; gap: 130px; row_gap: 100px; routing: orthogonal; }
    legend compact { mode: tokens; placement: none; }
    publication screen { size: content; fit: none; }
    bundle design { style:@standard; layout:@grid; legend:@compact; publication:@screen; }
}
view overview "Customer orders / structural view" {
    data: [@model]; format: @common.design;
}
`;

const demoScript = '(function(){\n' +
  'var source = `' + demoSource + '`;\n' +
  'try {\n' +
  "  var ws = DDNLive.createWorkspace({'demo.ddn': source});\n" +
  "  var r = ws.renderSync({entry:'demo.ddn', view:'overview'});\n" +
  "  document.getElementById('live-demo').innerHTML = r.svg;\n" +
  '} catch (e) {\n' +
  "  document.getElementById('live-demo-error').textContent = 'Render failed: ' + (e && e.message);\n" +
  '}\n' +
  '})();';

const homeCards = [
  ['gallery/index.html', 'Gallery — full notation coverage', 'One pre-rendered SVG per installed profile (all 73) plus variation sheets: every chart mark, look × palette, routing × style, layout algorithm, and spacing level — 130 CLI renders.', 'static · file:// safe'],
  ['tools/designer/index.html', 'Visual designer — working prototype', 'Visual-first editor: full 188-kind palette, descriptor-driven inspector, live source transactions, matrix and chart editors, resizable and window-pop-out panels, SVG/PNG/WebP downloads.', 'standalone · no server'],
  ['tools/viewer/index.html', 'End-user viewer', 'Open or paste a .ddn source, pick any declared view, fit/zoom, restyle kinds and relations, export SVG/PNG. Presentation-only; the source is never modified.', 'standalone · no server'],
  ['tools/studio/index.html', 'Studio — source-first editor', 'Full-source editing with live rendering, guided graph edits, and workspace I/O. The reference editor for the notation.', 'standalone · no server'],
  ['standard/index.html', 'The open standard', '43 specification chapters, the EBNF grammar, JSON schemas, governance RFCs, and the machine-readable registry.', 'rendered from Markdown'],
  ['examples/index.html', 'Examples', '61 basics, projection and quality corpora, and 22 use-case scenarios as runnable .ddn sources — served raw for download.', 'browser + raw files'],
];

writeOut('index.html', shell({
  base: '', active: 'home',
  title: 'ScratchWeaver — the Diagram Design Notation toolkit from ScratchBird Software Inc.',
  description: 'DDN: author data, format, and view declarations separately in plain-text .ddn files; one semantic model projects into ERDs, flowcharts, charts, timelines, matrices, and 70+ more diagram types. Zero-dependency JavaScript, deterministic SVG, GPL-2.0-or-later.',
  body:
    '<section class="hero"><div class="inner">\n' +
    '  <h1>One semantic model. Every diagram you need.</h1>\n' +
    '  <p class="pitch"><strong>ScratchWeaver</strong> is the Diagram Design Notation (DDN) toolkit from ScratchBird Software Inc. ' +
    'DDN is a model-first diagram language and open standard proposal: ' +
    'declare data, format, and views separately in plain-text <code>.ddn</code> files, and project one model into ERDs, DFDs, ' +
    'flowcharts, C4 views, matrices, charts, timelines, fishbones, decision tables, wireframes, and dozens more — ' +
    'with a zero-dependency JavaScript runtime and deterministic SVG output.</p>\n' +
    '  <div class="cta-row">\n' +
    '    <a class="cta primary" href="tools/designer/index.html">Open the designer</a>\n' +
    '    <a class="cta secondary" href="standard/index.html">Read the standard</a>\n' +
    '  </div>\n</div></section>\n' +
    '<main class="site-main">\n' +
    '<section class="live-panel">\n' +
    '  <h2>Live render — generated in your browser, right now</h2>\n' +
    '  <p class="sub">The diagram below is rendered client-side by the DDN runtime inlined into this page. No server, no network.</p>\n' +
    '  <div class="live-render" id="live-demo"><p class="render-error" id="live-demo-error">Loading runtime…</p></div>\n' +
    '</section>\n' +
    '<section>\n  <h2>Explore the project</h2>\n  <div class="grid">\n' +
    homeCards.map(([href, h, p, small]) =>
      '    <a class="card" href="' + href + '"><h3>' + esc(h) + '</h3><p>' + esc(p) + '</p><small>' + esc(small) + '</small></a>').join('\n') +
    '\n  </div>\n</section>\n' +
    '<p><small>Draft proposal, pre-1.0 — the project provides profiles/projections for well-known diagram families and claims no UML/BPMN/DMN conformance certification.</small></p>\n' +
    '</main>\n' +
    '<script>\n' + runtime + '\n</' + 'script>\n' +
    '<script>\n' + demoScript + '\n</' + 'script>\n',
}));

// Features page.
const FEATURES = [
  ['Model-first authoring', 'Data, format, and view declarations live in separate, composable sections of plain-text .ddn files. One semantic model projects into many diagram types — edit the model once, every view follows.'],
  ['73 installed profiles', 'ERDs (Chen and crow’s-foot), DFDs, flowcharts, C4 views, RACI/CRUD matrices, bar/line/pie/radar/funnel/gauge/candlestick charts, treemaps, Sankey, Gantt, fishbones, decision tables, org charts, WBS, mind maps, concept maps, EPC chains, strategy canvases, journey and story maps, pyramids, Venn, sequence, communication, object, state machine, activity, BPMN-style, timing, interaction overview, CMMN-style, SysML-style, ArchiMate-style, PERT/CPM, fault/event trees, network diagrams, wireframes, family trees — see the <a href="../gallery/index.html">gallery</a>.'],
  ['Deterministic rendering', 'Same source → same SVG bytes, every time. No randomness, no wall-clock in layout or render paths. Golden tests byte-compare the corpus.'],
  ['Zero dependencies', 'Pure JavaScript runtime (browser and Node 22+). No build step, no framework, no external fonts or CDNs — every page of this site works from file://.'],
  ['Workspace bundling & self-contained files', 'A full design can live in one .ddn file — model, data, views, and formats as marked module sections — with workspace bundling that renders byte-identical to the original multi-file workspace.'],
  ['Host-page integration', 'Rendered SVG carries deterministic CSS class hooks on every mark; a host page can restyle diagrams with its own stylesheet. Modular bundles (ddn-core, ddn-graph, ddn-projections, ddn-quality) let pages ship only what they use, with coded refusals (DDN-E010) when a renderer is absent. Live data refresh swaps records while everything else stays byte-identical.'],
];
writeOut('features/index.html', page('../', 'features', 'Features — DDN',
  '<h1 class="page-title">Features</h1>\n' +
  '<p class="lede">What the Diagram Design Notation runtime gives you today, at version ' + VERSION + '.</p>\n' +
  '<div class="grid">\n' +
  FEATURES.map(([h, p]) => '  <div class="card"><h3>' + h + '</h3><p>' + p + '</p></div>').join('\n') +
  '\n</div>\n' +
  '<p><a class="cta primary" href="../tools/designer/index.html">Open the designer</a> <a class="cta secondary" href="../examples/index.html">Browse the examples</a></p>'));

// Tools landing.
writeOut('tools/index.html', page('../', 'tools', 'Tools — DDN',
  '<h1 class="page-title">Tools</h1>\n' +
  '<p class="lede">Every tool is a single self-contained HTML file — open it from disk or any static host. All processing is local.</p>\n' +
  '<div class="grid">\n' +
  '  <a class="card" href="designer/index.html"><h3>Visual designer</h3><p>Visual-first editor prototype: full kind palette, inspector, live source transactions, matrix and chart editors, display options, pop-out panels, SVG/PNG/WebP and .ddn/ZIP downloads.</p><small>standalone</small></a>\n' +
  '  <a class="card" href="viewer/index.html"><h3>End-user viewer</h3><p>Open or paste a .ddn source, pick a view, fit and zoom, restyle kinds and relations, export SVG/PNG. Deep-link any example with <code>?src=&lt;relative .ddn path&gt;</code> (serve over HTTP).</p><small>standalone</small></a>\n' +
  '  <a class="card" href="studio/index.html"><h3>Studio — example library</h3><p>Self-contained library of the full example corpus with live rendering: graphs, ERDs, matrices, panels, charts, timelines, layouts, looks, routing variants.</p><small>standalone</small></a>\n' +
  '  <a class="card" href="studio/editor.html"><h3>Studio — source editor</h3><p>Source-first editing with live rendering, guided graph edits, and workspace I/O.</p><small>standalone</small></a>\n' +
  '  <a class="card" href="../plates/index.html"><h3>Notation plates</h3><p>SVG plates of the vocabulary: object kinds, facets, relationship families, looks, and routing.</p><small>standalone</small></a>\n' +
  '</div>'));

// Docs landing: list rendered docs chapters.
function docList(absDir, outDir, base) {
  const items = [];
  for (const p of walk(absDir)) {
    if (!p.endsWith('.md')) continue;
    const src = fs.readFileSync(p, 'utf8');
    const title = (src.match(/^#\s+(.+)$/m) || [null, path.basename(p, '.md')])[1].replace(/[`*]/g, '');
    const rel = path.relative(absDir, p).split(path.sep).join('/').replace(/\.md$/, '.html');
    items.push([rel, title]);
  }
  return '<ul>\n' + items.map(([rel, t]) => '  <li><a href="' + base + rel + '">' + esc(t) + '</a></li>').join('\n') + '\n</ul>';
}
writeOut('docs/index.html', page('../', 'docs', 'Documentation — DDN',
  '<h1 class="page-title">Documentation</h1>\n' +
  '<p class="lede">Developer documentation for embedding, the workspace API, styling hooks, data refresh, and authoring .ddn sources — rendered from the Markdown in <code>website/docs/</code>.</p>\n' +
  '<h2>Developer guide</h2>\n' + docList(path.join(REPO, 'website/docs/developers'), 'docs/developers', 'developers/') +
  '<h2>Engineering notes</h2>\n' + docList(path.join(REPO, 'website/docs/notes'), 'docs/notes', 'notes/')));

// Standard landing.
writeOut('standard/index.html', page('../', 'standard', 'The DDN standard — DDN',
  '<h1 class="page-title">The Diagram Design Notation standard</h1>\n' +
  '<p class="lede">A proposed open standard, pre-1.0: specification chapters, governance RFCs, the EBNF grammar, JSON schemas, and the machine-readable registry. The normative source lives in <code>standard/</code> at the repository root; these pages are rendered copies. DDN provides profiles/projections for well-known diagram families and claims no UML/BPMN/DMN conformance certification.</p>\n' +
  '<h2>Specification (' + fs.readdirSync(path.join(REPO, 'standard/specification')).filter(f => f.endsWith('.md')).length + ' chapters)</h2>\n' +
  docList(path.join(REPO, 'standard/specification'), 'standard/specification', 'specification/') +
  '<h2>Governance</h2>\n' +
  '<ul>\n  <li><a href="governance/VERSIONING.html">Versioning policy</a></li>\n  <li><a href="governance/RFC-TEMPLATE.html">RFC template</a></li>\n</ul>\n' +
  '<h2>RFCs</h2>\n' + docList(path.join(REPO, 'standard/governance/rfcs'), 'standard/governance/rfcs', 'governance/rfcs/') +
  '<h2>Notation plates</h2>\n<p><a href="../plates/index.html">SVG plates of the full vocabulary</a> — object kinds, facets, relationship families, looks, and routing.</p>'));

// Examples browser: intro + raw .ddn listing grouped by directory.
const examplesRoot = path.join(REPO, 'website/examples');
const ddnFiles = [...walk(examplesRoot)].filter(p => p.endsWith('.ddn'))
  .map(p => path.relative(examplesRoot, p).split(path.sep).join('/')).sort();
const groups = new Map();
for (const f of ddnFiles) {
  const dir = f.includes('/') ? f.slice(0, f.indexOf('/')) : '.';
  if (!groups.has(dir)) groups.set(dir, []);
  groups.get(dir).push(f);
}
/* B1-023 (D2): per-example "open in" links. A file with `import "..." as …;`
 * lines is multi-file: it gets a viewer-only link plus a note (the designer is
 * a single-document surface). Detection is a line-anchored grep — imports are
 * top-level line statements in the grammar, so scanning the source text is
 * exact and keeps the site builder free of a runtime load. */
const hasImports = f => /^[ \t]*import[ \t]+"/m.test(fs.readFileSync(path.join(examplesRoot, f), 'utf8'));
const srcParam = f => '../../examples/' + f.split('/').map(encodeURIComponent).join('/');
writeOut('examples/index.html', page('../', 'examples', 'Examples — DDN',
  '<h1 class="page-title">Examples</h1>\n' +
  '<p class="lede">' + ddnFiles.length + ' runnable <code>.ddn</code> sources — served raw for download. ' +
  'Open any of them one click in the viewer (and single-file ones in the designer) via the links below, or render with the CLI: ' +
  '<code>node notation/cli/cli.js render website/examples/basics/01-customer.ddn --workspace website/examples/basics --out out.svg</code>. ' +
  'The tools take a <code>?src=</code> relative-path deep link (<code>tools/viewer/index.html?src=../../examples/basics/01-customer.ddn</code>) — serve the site over HTTP (<code>npm run serve</code>) for browser fetches. ' +
  'See the <a href="README.html">examples README</a> and the <a href="../gallery/index.html">rendered gallery</a>.</p>\n' +
  [...groups.entries()].map(([dir, files]) =>
    '<h2>' + esc(dir === '.' ? 'Top level' : dir + '/') + ' <small>(' + files.length + ')</small></h2>\n<table>\n<thead><tr><th>File</th><th>Bytes</th><th>Open in</th></tr></thead><tbody>\n' +
    files.map(f => {
      const size = fs.statSync(path.join(examplesRoot, f)).size;
      const open = hasImports(f)
        ? '<a href="../tools/viewer/index.html?src=' + srcParam(f) + '">Viewer</a> <small>(multi-file — viewer only)</small>'
        : '<a href="../tools/viewer/index.html?src=' + srcParam(f) + '">Viewer</a> · <a href="../tools/designer/index.html?src=' + srcParam(f) + '">Designer</a>';
      return '<tr><td><a href="' + f.split('/').map(encodeURIComponent).join('/') + '"><code>' + esc(f) + '</code></a></td><td>' + size + '</td><td>' + open + '</td></tr>';
    }).join('\n') + '\n</tbody></table>').join('\n')));

// Download page: clone/npm instructions + dist bundle table with byte sizes.
const distRows = fs.readdirSync(path.join(REPO, 'notation/dist')).sort()
  .filter(f => /\.(js|mjs|css|d\.ts|d\.mts|map)$/.test(f))
  .map(f => '<tr><td><a href="../dist/' + f + '"><code>' + f + '</code></a></td><td>' + fs.statSync(path.join(REPO, 'notation/dist', f)).size + '</td></tr>');
writeOut('download/index.html', page('../', 'download', 'Download — DDN',
  '<h1 class="page-title">Download</h1>\n' +
  '<p class="lede">ScratchWeaver ' + VERSION + ' — the product name of this Diagram Design Notation (DDN) toolkit from ScratchBird Software Inc. — is pre-1.0 and <code>private: true</code> — it is not yet published to npm. Today you get it by cloning the repository; the runtime bundles below are also served directly from this site.</p>\n' +
  '<h2>Clone the repository</h2>\n' +
  '<pre><code>git clone &lt;repo-url&gt; data-design-notation\ncd data-design-notation\nnpm test          # full verification suite, exit 0 expected</code></pre>\n' +
  '<h2>Runtime bundles</h2>\n' +
  '<p>Load <code>ddn.global.js</code> for everything, or compose the modular bundles (<code>ddn-core</code> → <code>ddn-graph</code> → <code>ddn-projections</code>/<code>ddn-quality</code>). Every bundle ships three formats: use the <strong>minified <code>.min.js</code> IIFEs for production embeds</strong>, the <strong><code>.mjs</code> ES modules for modern bundlers and module pages</strong> (tree-shakeable; browsers need a static server for module imports — no <code>file://</code>), and the readable <code>.js</code> builds for debugging (source maps included). See the <a href="../docs/developers/modules.html">modules guide</a> and the <a href="../examples/embed/core-graph.html">embed proof pages</a>.</p>\n' +
  '<table>\n<thead><tr><th>Bundle</th><th>Bytes</th></tr></thead><tbody>\n' + distRows.join('\n') + '\n</tbody></table>\n' +
  '<h2>License</h2>\n<p>GPL-2.0-or-later — see the <a href="../license/index.html">license page</a>.</p>'));

// License page.
writeOut('license/index.html', page('../', 'home', 'License — DDN',
  '<h1 class="page-title">License</h1>\n' +
  '<p class="lede">The Diagram Design Notation project — notation, runtime, designer, standard text, and this website — is free software under the <strong>GNU General Public License, version 2 only</strong> (GPL-2.0-or-later as declared in <code>package.json</code>; see <code>NOTICE.md</code> for the project notice).</p>\n' +
  '<ul>\n' +
  '  <li><a href="LICENSE">Full license text (LICENSE)</a></li>\n' +
  '  <li><a href="NOTICE.md">Project notice (NOTICE.md)</a></li>\n' +
  '</ul>\n' +
  '<p>Rendered SVG output produced by the runtime from your own .ddn sources is yours; the GPL covers the software and standard text themselves.</p>'));

/* ---------------------------------------------------------------- manifest */

written.sort();
const manifest = {};
for (const rel of written) manifest[rel] = crypto.createHash('sha256').update(fs.readFileSync(path.join(OUT, rel))).digest('hex');
writeOut('.generated-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log('build-site: ' + written.length + ' files → ' + path.relative(REPO, OUT));
