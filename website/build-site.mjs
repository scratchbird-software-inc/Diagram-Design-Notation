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
import { createRequire } from 'node:module';
import * as REFDATA from '../tools/reference-data.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx >= 0 ? path.resolve(process.argv[outIdx + 1]) : path.join(REPO, 'website');
const VERSION = JSON.parse(fs.readFileSync(path.join(REPO, 'notation/package.json'), 'utf8')).version;

/* B1-053 (D6): every count the site quotes is generated from the source of
 * truth at build time so the numbers stop drifting. */
const readJson = rel => JSON.parse(fs.readFileSync(path.join(REPO, rel), 'utf8'));
const PROFILE_CATALOGUE = readJson('standard/registry/profiles/catalogue.json');
const PROFILE_COUNT = PROFILE_CATALOGUE.profiles.length;
const PROJECTION_KIND_COUNT = new Set(PROFILE_CATALOGUE.profiles.map(p => p.projection)).size;
const SPEC_CHAPTER_COUNT = fs.readdirSync(path.join(REPO, 'standard/specification')).filter(f => f.endsWith('.md')).length;
const GALLERY_COVERAGE = readJson('website/examples/gallery/coverage.json');
const GALLERY_SVG_COUNT = Object.keys(GALLERY_COVERAGE.profiles).length +
  Object.values(GALLERY_COVERAGE.sheets).reduce((n, s) => n + s.views.length, 0) +
  (GALLERY_COVERAGE.corpus ? GALLERY_COVERAGE.corpus.length : 0);
/* B1-101 slice 2: icon pack viewer page — pack data from the ddn-icon-pack@1
 * sources (license/attribution visible), not the aggregated runtime asset. */
const ICON_PACKS = readJson('standard/registry/icon-packs/index.json').packs.map(f =>
  readJson('standard/registry/icon-packs/' + f));
const ICON_TOTAL = ICON_PACKS.reduce((n, p) => n + p.icons.length, 0);
const REF_FACTS = readJson('standard/submission/facts.json');
const REF_FACT = path2 => path2.split('.').reduce((o, k) => o?.[k], REF_FACTS)?.value;

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
  ['Icons', 'icons/index.html', 'icons'],
  ['Guide', 'guide/index.html', 'guide'],
  ['Reference', 'reference/index.html', 'reference'],
  ['Docs', 'docs/index.html', 'docs'],
  ['Standard', 'standard/index.html', 'standard'],
  ['Tools', 'tools/index.html', 'tools'],
  ['Download', 'download/index.html', 'download'],
  ['Wiki', 'https://github.com/scratchbird-software-inc/Diagram-Design-Notation/wiki', 'wiki'],
];

function favicons(base) {
  return '<link rel="icon" type="image/svg+xml" href="' + base + 'assets/brand/favicon.svg">\n' +
    '<link rel="icon" type="image/png" sizes="32x32" href="' + base + 'assets/brand/favicon-32.png">\n' +
    '<link rel="icon" type="image/png" sizes="64x64" href="' + base + 'assets/brand/favicon-64.png">\n';
}

function shell({ base, title, active, body, description }) {
  const nav = NAV.map(([label, href, key]) =>
    '<a href="' + (/^https?:\/\//.test(href) ? href : base + href) + '"' + (key === active ? ' class="active"' : '') + '>' + label + '</a>').join('\n      ');
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + esc(title) + '</title>\n' +
    (description ? '<meta name="description" content="' + esc(description) + '">\n' : '') +
    favicons(base) +
    '<link rel="stylesheet" href="' + base + 'assets/site.css">\n</head>\n<body>\n' +
    '<header class="site-header"><div class="bar">\n' +
    '  <a class="wordmark" href="' + base + 'index.html"><img class="logo" src="' + base + 'assets/brand/ddn.svg" alt="DDN logo">' +
    '<span class="name">ddn<small>Diagram Design Notation</small></span></a>\n' +
    '  <button class="nav-toggle" aria-label="Toggle navigation">☰</button>\n' +
    '  <nav class="site-nav">\n      ' + nav + '\n  </nav>\n</div></header>\n' +
    body + '\n' +
    '<footer class="site-footer"><div class="inner">\n' +
    '  <span>ddn ' + VERSION + ' — open-source dialect · free ddn-viewer · free ddn-designer · proposed standard, pre-1.0</span>\n' +
    '  <span><img src="' + base + 'assets/brand/scratchweaver.svg" alt="ScratchWeaver logo" style="height:14px;vertical-align:-2px"> A <a href="https://scratchbird.ca/weaver"><strong>ScratchWeaver</strong></a>-sponsored open-source project · <a href="https://www.scratchbird.ca">ScratchBird Software Inc.</a> · GPL-2.0-or-later</span>\n' +
    '  <a href="' + base + 'license/index.html">License: GPL-2.0-or-later</a>\n' +
    '  <a href="' + base + 'docs/index.html">Docs</a>\n' +
    '  <a href="' + base + 'standard/index.html">Standard</a>\n' +
    '  <a href="' + base + 'download/index.html">Download</a>\n' +
    '  <a href="https://github.com/scratchbird-software-inc/Diagram-Design-Notation/wiki">Wiki</a>\n' +
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
    /* The gallery source lives two levels deeper than the mirror; its
     * site-root-relative links ('<attr>="../../…"') are retargeted one level up.
     * Query-string values (e.g. ?entry=../examples/…) are resolved by the tool
     * against its own page and never start with "../../" right after a quote. */
    const html = fs.readFileSync(p, 'utf8').split('"../../').join('"../');
    writeOut(rel, withFavicons(html, rel));
  }
  else copyOut(rel, p);
}

/* Field guide (B1-098): the generated 0.7 edition mirrored under guide/.
 * Lesson pages reference the repo runtime at src="../../notation/dist/*"; the
 * site serves the same bundles at dist/*, which resolves identically from
 * guide/lessons/ once retargeted one level up. The portable edition is a
 * single inlined file and needs no retargeting. Chapter .ddn sources under
 * field-guide/sources/ stay repo-side (lessons embed everything they need). */
const GUIDE_CATALOGUE = readJson('field-guide/catalogue.json');
const GUIDE_CHAPTER_COUNT = GUIDE_CATALOGUE.meta.chapterCount;
const guideSrc = path.join(REPO, 'field-guide');
for (const p of walk(guideSrc)) {
  if (p.split(path.sep).includes('sources')) continue;
  const rel = path.posix.join('guide', path.relative(guideSrc, p).split(path.sep).join('/'));
  if (p.endsWith('.html')) {
    const html = fs.readFileSync(p, 'utf8').split('src="../../notation/dist/').join('src="../../dist/');
    writeOut(rel, withFavicons(html, rel));
  }
  else copyOut(rel, p);
}

// Notation plates browser (already a single self-contained page with inlined SVGs).
// Its template links are repo-relative; retarget them to site pages for the mirror,
// then wrap it in the same site navigator as every other page (B1-053 D1).
function withSiteChrome(html, base, active) {
  const header = shell({ base, title: '', active, body: '', description: null })
    .match(/<header class="site-header">[\s\S]*?<\/header>/)[0];
  const footer = '<footer class="site-footer"><div class="inner">\n' +
    '  <span>ddn ' + VERSION + ' — open-source dialect · free ddn-viewer · free ddn-designer · proposed standard, pre-1.0</span>\n' +
    '  <span><img src="' + base + 'assets/brand/scratchweaver.svg" alt="ScratchWeaver logo" style="height:14px;vertical-align:-2px"> A <a href="https://scratchbird.ca/weaver"><strong>ScratchWeaver</strong></a>-sponsored open-source project · <a href="https://www.scratchbird.ca">ScratchBird Software Inc.</a> · GPL-2.0-or-later</span>\n' +
    '  <a href="' + base + 'license/index.html">License: GPL-2.0-or-later</a>\n' +
    '  <a href="' + base + 'docs/index.html">Docs</a>\n' +
    '  <a href="' + base + 'standard/index.html">Standard</a>\n' +
    '  <a href="' + base + 'download/index.html">Download</a>\n' +
    '  <a href="https://github.com/scratchbird-software-inc/Diagram-Design-Notation/wiki">Wiki</a>\n' +
    '  <span class="spacer"></span>\n' +
    '  <span>All processing is local to this page.</span>\n</div></footer>\n';
  return html
    .replace('</head>', '<link rel="stylesheet" href="' + base + 'assets/site.css">\n</head>')
    .replace(/<body>/, '<body>\n' + header)
    .replace(/<\/body>/, footer + '<script src="' + base + 'assets/site.js"></script>\n</body>');
}
writeOut('plates/index.html',
  withSiteChrome(
    withFavicons(readRepo('standard/plates/index.html')
      .split('href="../../index.html"').join('href="../index.html"')
      .split('href="../../website/index.html"').join('href="../index.html"')
      .split('href="../registry/catalogue.json"').join('href="../standard/index.html"')
      .split('href="../specification/04-notation-and-looks.md"').join('href="../standard/specification/04-notation-and-looks.html"'), 'plates/index.html'),
    '../', 'standard'));

// License texts.
copyOut('license/LICENSE', path.join(REPO, 'LICENSE'));
copyOut('license/NOTICE.md', path.join(REPO, 'NOTICE.md'));

/* AI authoring reference (B1-030/B1-047): assembled fresh from the registry
 * and runtime sources at every site build — the served file cannot drift.
 * The ```ddn examples inside it are validated by tests/ai-reference.js. */
const AI_REFERENCE = (await import(path.join(REPO, 'tools/build-ai-reference.mjs'))).assemble({ validate: false });
writeOut('download/DDN-AI-REFERENCE.md', AI_REFERENCE.text);

/* ------------------------------------------------------- standalone mirrors */

// Unified diagram tool (B1-027): single self-contained file, no relative refs.
// Canonical path /tools/index.html (D6); the retired tool URLs below — viewer,
// studio gallery, studio editor (B1-027) and the visual designer prototype
// (B1-051) — become redirect stubs that forward src/entry/view/mode/drawers.
copyOut('tools/index.html', path.join(REPO, 'notation/tool/ddn-tool.html'));

// Redirect stubs (B1-027 D6, B1-051 D3): meta-refresh + JS param mapping,
// shared mapper inlined from notation/tool/src/redirect.js so tests exercise
// the same code. forceMode ('design' for the retired designer) is appended
// when the legacy URL carries no explicit mode.
const redirectJs = readRepo('notation/tool/src/redirect.js').trimEnd();
if (redirectJs.includes('</script')) throw new Error('redirect.js contains </script; inlining would break the stubs');
function redirectStub(oldPath, forceMode) {
  const moved = forceMode === 'design'
    ? 'the designer is now the unified diagram tool itself, in design mode — one tool, two modes.'
    : 'the viewer, studio gallery and studio editor are now one page.';
  return '<!doctype html>\n<!-- SPDX-License-Identifier: GPL-2.0-or-later. ' + (forceMode === 'design' ? 'The designer' : 'The viewer') + ': ' + oldPath + ' was\n' +
    '     replaced by the unified diagram tool at /tools/index.html' + (forceMode ? '?mode=' + forceMode : '') + '. Generated by\n' +
    '     website/build-site.mjs — edit notation/tool/src/redirect.js, not this file. -->\n' +
    '<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Moved — the DDN tool</title>\n' +
    '<link rel="icon" type="image/svg+xml" href="../../assets/brand/favicon.svg">\n' +
    '<meta http-equiv="refresh" content="0; url=../index.html' + (forceMode ? '?mode=' + forceMode : '') + '">\n</head>\n<body>\n' +
    '<p>This tool moved: ' + moved + '\n' +
    'Open the <a id="ddn-redirect-target" href="../index.html' + (forceMode ? '?mode=' + forceMode : '') + '">unified DDN diagram tool</a>.</p>\n' +
    '<script>\n' + redirectJs + '\n</' + 'script>\n' +
    '<script>(function(){var q=DDNRedirect.mapLegacyParams(location.search,location.href,"../index.html");' +
    (forceMode ? 'if(!/[?&]mode=/.test(q))q+=(q?"&":"?")+"mode=' + forceMode + '";' : '') +
    'var t="../index.html"+q;' +
    'document.getElementById("ddn-redirect-target").href=t;location.replace(t);})();</' + 'script>\n' +
    '</body>\n</html>\n';
}
writeOut('tools/viewer/index.html', redirectStub('tools/viewer/index.html'));
writeOut('tools/studio/index.html', redirectStub('tools/studio/index.html'));
writeOut('tools/studio/editor.html', redirectStub('tools/studio/editor.html'));
// B1-051 (D3): the visual designer prototype is retired; its URL now forwards
// to the unified tool in design mode, preserving ?src=/entry=/view=.
writeOut('tools/designer/index.html', redirectStub('tools/designer/index.html', 'design'));

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
mdJobs.push({ absSource: path.join(REPO, 'website/examples/README.md'), outRel: 'examples/README.html', active: 'gallery' });

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
  ['download/DDN-AI-REFERENCE.md', 'AI authoring reference — let a chat AI write your DDN', 'The whole dialect in one generated file: paste it into Claude, ChatGPT or any chat AI, describe your diagram in plain language, and paste the DDN it writes into the tool. The validator catches mistakes by code.', 'generated · always current'],
  ['guide/index.html', 'Diagram field guide — read, change, verify', GUIDE_CHAPTER_COUNT + ' chapters: every major notation family and chart type as a live, source-editable example with a guided first edit whose render-changing evidence is shipped in the page. Also as one self-contained portable file.', 'live · works offline'],
  ['reference/index.html', 'Reference — every element kind and relation', 'The complete shelf catalogue: all ' + REF_FACT('registry.totalKinds') + ' element kinds and ' + REF_FACT('registry.totalRelations') + ' relations by family — each with its rendered symbol, a plain-language meaning, accepted properties, and a paste-ready working example. Generated from the registry.', 'registry-generated'],
  ['gallery/index.html', 'Gallery — full notation coverage and every example', 'One pre-rendered SVG per installed profile (all ' + PROFILE_COUNT + '), variation sheets (every chart mark flat and isometric, look × palette, routing × style, layout algorithm, spacing level), and the complete example corpus — every runnable .ddn the project ships — ' + GALLERY_SVG_COUNT + ' CLI renders, each with an explanation, browsable DDN source, and wiki/viewer/designer links.', 'static · file:// safe'],
  ['tools/index.html?mode=design', 'Designer — the tool in design mode', 'The designer IS the viewer with more functionality: drag-to-pin, click-to-place from the full kind palette (notation-plate glyphs), click-source-click-target connecting, inspector edits with undo, live source — one page, one I/O contract.', 'standalone · no server'],
  ['tools/index.html', 'Unified diagram tool', 'One page for viewing, exploring, editing and designing: pan/zoom stage with fit modes, pop-in drawers for appearance, source, files and export configured per drawer (?drawers=, ?mode= presets — view, explore, edit, design), colour/typography overrides, guided edits with undo, SVG/PNG/WebP export, workspace I/O.', 'standalone · no server'],
  ['standard/index.html', 'The open standard', SPEC_CHAPTER_COUNT + ' specification chapters, the EBNF grammar, JSON schemas, the versioning policy, and the machine-readable registry.', 'rendered from Markdown'],
];

writeOut('index.html', shell({
  base: '', active: 'home',
  title: 'ddn — the Diagram Design Notation project, a ScratchWeaver-sponsored open-source project',
  description: 'DDN: author data, format, and view declarations separately in plain-text .ddn files; one semantic model projects into ERDs, flowcharts, charts, timelines, matrices, and 70+ more diagram types. Zero-dependency JavaScript, deterministic SVG, GPL-2.0-or-later.',
  body:
    '<section class="hero"><div class="inner">\n' +
    '  <h1>One semantic model. Every diagram you need.</h1>\n' +
    '  <p class="pitch"><strong>ddn</strong> — Diagram Design Notation — is an open-source diagram dialect sponsored by the <a href="https://scratchbird.ca/weaver"><strong>ScratchWeaver</strong></a> project (<a href="https://www.scratchbird.ca">ScratchBird Software Inc.</a>), with the free <strong>ddn-viewer</strong> and free <strong>ddn-designer</strong> tools. ' +
    'It is a model-first diagram language and open standard proposal: ' +
    'declare data, format, and views separately in plain-text <code>.ddn</code> files, and project one model into ERDs, DFDs, ' +
    'flowcharts, C4 views, matrices, charts, timelines, fishbones, decision tables, wireframes, and dozens more — ' +
    'with a zero-dependency JavaScript runtime and deterministic SVG output.</p>\n' +
    '  <div class="cta-row">\n' +
    '    <a class="cta primary" href="tools/index.html?mode=design">Open the designer</a>\n' +
    '    <a class="cta secondary" href="guide/index.html">Field guide — learn by doing</a>\n' +
    '    <a class="cta secondary" href="https://github.com/scratchbird-software-inc/Diagram-Design-Notation/wiki">Wiki — learn DDN</a>\n' +
    '    <a class="cta secondary" href="docs/developers/embedding.html">Embed the runtime</a>\n' +
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
    '<section>\n  <h2>The product family</h2>\n  <div class="grid">\n' +
    '    <div class="card"><h3>ddn · ddn-viewer · ddn-designer — open source (this project)</h3><p>The dialect itself (<strong>ddn</strong>), the reference runtime, the free <strong>ddn-viewer</strong> (display and verify .ddn diagrams) and the free <strong>ddn-designer</strong> (simple edits and small diagrams) — GPL-2.0-or-later. The free tools ship the complete notation and rendering core; only tool depth differs from the commercial offerings. Sister project: <a href="https://github.com/scratchbird-software-inc/ScratchBird">ScratchBird on GitHub</a> · <a href="https://github.com/scratchbird-software-inc/ScratchBird/wiki">ScratchBird wiki</a>.</p></div>\n' +
    '    <div class="card"><h3><a href="https://scratchbird.ca/weaver">ScratchWeaver</a> — sponsoring project</h3><p>ScratchWeaver sponsors the open-source ddn family and is also the full commercial diagramming suite (subscription, with some on-site licensing) built on ddn as its file storage and communication format.</p></div>\n' +
    '    <div class="card"><h3>ScratchRobin — commercial console</h3><p>The database management console, BI and data-analytics package that uses DDN and owns backend capabilities such as KEEL. KEEL is not part of DDN, the viewer, or the designer, and never will be. <a href="https://github.com/scratchbird-software-inc/CDEadmin">ScratchRobin on GitHub</a>.</p></div>\n' +
    '\n  </div>\n</section>\n' +
    '<p><small>Draft proposal, pre-1.0 — the project provides profiles/projections for well-known diagram families, including all fourteen UML 2.5.1 diagram families with documented exclusions (no XMI/OCL exchange, executable behavior or conformance certification).</small></p>\n' +
    '</main>\n' +
    '<script>\n' + runtime + '\n</' + 'script>\n' +
    '<script>\n' + demoScript + '\n</' + 'script>\n',
}));

// Features page.
const FEATURES = [
  ['Model-first authoring', 'Data, format, and view declarations live in separate, composable sections of plain-text .ddn files. One semantic model projects into many diagram types — edit the model once, every view follows.'],
  [PROFILE_COUNT + ' installed profiles, ' + PROJECTION_KIND_COUNT + ' projection kinds', 'ERDs (Chen and crow’s-foot), DFDs, flowcharts, C4 views, RACI/CRUD matrices, bar/line/pie/radar/funnel/gauge/candlestick charts, treemaps, Sankey, Gantt, fishbones, decision tables, org charts, WBS, mind maps, concept maps, EPC chains, strategy canvases, journey and story maps, pyramids, Venn, sequence, communication, object, state machine, activity, BPMN-style, timing, interaction overview, CMMN-style, SysML-style, ArchiMate-style, PERT/CPM, fault/event trees, network diagrams, wireframes, family trees, geographic maps — plus the Category-2 chart pack: histograms, density/Q-Q/quantile-dot/box/violin/beeswarm/top-K distributions, tidy and radial trees, circle packing, sunbursts, packed bubbles, heatmaps, calendars, parallel coordinates, word clouds, arc diagrams, seeded force networks and hierarchical edge bundling, with error-bar and regression/loess overlays — see the <a href="../gallery/index.html">gallery</a>.'],
  ['CMMN 1.1 — case diagrams', 'Full CMMN notation: case plan containers, typed tasks with decorator badges (required, repetition, manual activation, completion), timer and user event listeners, sentries with on-part/if-part criteria attached to plan-item borders, planning tables, and case file items — see the <a href="../gallery/index.html">gallery</a> for a rendered example.'],
  ['IEC 61131-3 function blocks', 'FBD blocks with name/type headers and typed pins (BOOL/INT/REAL/TIME…), type-checked wires, negation bubbles, and feedback loops — see the <a href="../gallery/index.html">gallery</a> for a rendered motor-control diagram.'],
  ['IEC 61131-3 ladder diagrams', 'LD rungs between power rails — NO/NC contacts, output coils (normal/set/reset/negated), parallel OR branches inferred from the wiring, hosted FBD blocks, labels and jumps, laid out by a dedicated rung algorithm — see the <a href="../gallery/index.html">gallery</a> for a rendered motor-control ladder.'],
  ['SDL (ITU-T Z.100)', 'System views with blocks, gates, channels and signal lists, plus SDL process diagrams — start, states, input/output flags, decisions, tasks, saves, creates and procedure references — see the <a href="../gallery/index.html">gallery</a> for a rendered example.'],
  ['Icon packs', 'Symbols ship as open ddn-icon-pack@1 documents (<a href="../standard/specification/49-icon-packs.html">specification</a> + JSON schema) — ' + ICON_PACKS.length + ' packs, ' + ICON_TOTAL + ' icons, browsable with multi-size previews and a copyable x_icon reference in the <a href="../icons/index.html">icon pack viewer</a>. Author and register your own pack at runtime — validated and sanitized identically (no scripts, handlers or external references, 20 KiB cap). Common-practice artwork pending standards review; no vendor packs.'],
  ['Value stream mapping', 'Process boxes with data rows, the VA/NVA timeline ladder strip with totals, inventory triangles, push/pull and material arrows, electronic (zigzag) and manual information arrows, supermarket, kaizen bursts and operators — see the <a href="../gallery/index.html">gallery</a> for a rendered current-state map.'],
  ['ORM 2 object-role modeling', 'Entity and value types (solid/dashed ellipses), fact types as role-box predicate rows with uniqueness bars and mandatory dots, n-ary predicates, subset/equality/exclusion constraint arcs, value constraints, objectification and derivation text — see the <a href="../gallery/index.html">gallery</a> for a rendered fact model.'],
  ['Petri nets (ISO/IEC 15909)', 'Places with token markings, transition bars, weighted arcs, inhibitor arcs and test/read arcs, with bipartite-graph validation — notation only, no reachability analysis — see the <a href="../gallery/index.html">gallery</a> for a rendered producer/consumer net.'],
  ['IDEF0 function modeling', 'IEEE 1320.1 activity boxes with side-typed ICOM ports (Inputs left, Controls top, Outputs right, Mechanisms bottom), A-0 decomposition numbering, labeled flow arrows with fork/join, tunneled arrows and call arrows — see the <a href="../gallery/index.html">gallery</a> for a rendered example.'],
  ['MSC (ITU-T Z.120) sequence charts', 'Message sequence charts via the UML sequence machinery, plus HMSC references with «ref» boxes, coregions, instance creation/stop symbols, message loss, and inline expressions — see the <a href="../gallery/index.html">gallery</a> for a rendered example.'],
  ['C4 deployment & dynamic + full EPC', 'C4 deployment diagrams (3D nodes, artifacts, deploy paths) and dynamic diagrams (numbered messages) via the UML machinery, with tag-chip styling; full EPC notation with organizational units, roles, information objects, process links and split/join fan-balancing — see the <a href="../gallery/index.html">gallery</a> for rendered examples.'],
  ['ISO 5807 flowcharts — full symbol set', 'The complete ISO 5807 flowchart vocabulary: manual input, manual operation, preparation, display, delay, loop limits, merge/extract, card, collate, sort and parallel mode alongside the classic symbols — see the <a href="../gallery/index.html">gallery</a> for a rendered example.'],
  ['Drill-down thumbnails', 'Nodes can bind a detail view three ways: a reference badge, a live inline child, or a simplified thumbnail — silhouettes and edges with every text run suppressed. Frozen thumbnails embed a stored snapshot that only changes when the host deliberately rewrites it — see the <a href="../gallery/index.html">gallery</a> for a rendered example.'],
  ['ISO/IEC/IEEE 42010 alignment', 'An informative annex maps architecture-description concepts — stakeholders, concerns, viewpoints governing views, model kinds, correspondence rules, rationale — onto DDN views, profiles, UAF summary kinds and annotation machinery; read <a href="../standard/specification/48-iso42010-alignment.html">the alignment annex</a>.'],
  ['UAF 1.2 — the full architecture grid', 'All twelve UAF domains: strategic (capabilities, enterprise goals), operational, services, systems, personnel, resources, security, projects, standards, actual resources, dictionary, and summary — with stereotyped verbs («exhibits», «performs», «mitigates», «compliesWith»…) and the capability tag silhouette — see the <a href="../gallery/index.html">gallery</a> for one rendered view per domain.'],
  ['SoaML 1.0.1 — service architectures', 'Full SoaML notation: participants and agents with «Service»/«Request» port badges, service interfaces and contracts with provider/consumer roles, capabilities, message types and milestones, contract-typed assembly connectors with service↔request conformance checks, and choreography bindings to UML sequence or state machine views — see the <a href="../gallery/index.html">gallery</a> for a rendered example.'],
  ['DMN 1.4 — decision requirements diagrams', 'Decision requirements diagrams with the full node set (decisions, business knowledge models, input data, knowledge sources, decision services) and the three requirement connectors, wired to the decision-table engine — hit-policy labels, completeness cells, multi-output tables. Expression evaluation stays with host applications, never the notation — see the <a href="../gallery/index.html">gallery</a> for rendered examples.'],
  ['SysML 1.6 — all nine diagram families', 'Full SysML notation: requirements diagrams with the seven requirement dependencies and test cases, block definition compartments with units, internal block port typing (proxy/full/conjugated, nested, multiplicity), parametric constraints with parameter compartments, package diagrams, allocation, and the four behavioral families (use case, activity with rate/probability edges, sequence, state machine) — see the <a href="../gallery/index.html">gallery</a> for rendered examples.'],
  ['BPMN 2.0.2 — all four diagram families', 'Full BPMN notation: the complete event system (14 triggers, boundary events), six gateway types with true glyphs, the full activity set with markers, data objects and stores, flow variants, pools and lanes, choreography participant bands, and conversation diagrams — see the <a href="uml.html">UML page</a> for the sister OMG coverage and the <a href="../gallery/index.html">gallery</a> for rendered plates.'],
  ['Deterministic rendering', 'Same source → same SVG bytes, every time. No randomness, no wall-clock in layout or render paths. Golden tests byte-compare the corpus.'],
  ['Zero dependencies', 'Pure JavaScript runtime (browser and Node 22+). No build step, no framework, no external fonts or CDNs — every page of this site works from file://.'],
  ['Workspace bundling & self-contained files', 'A full design can live in one .ddn file — model, data, views, and formats as marked module sections — with workspace bundling that renders byte-identical to the original multi-file workspace.'],
  ['Host-page integration', 'Rendered SVG carries deterministic CSS class hooks on every mark; a host page can restyle diagrams with its own stylesheet. Modular bundles (ddn-core, ddn-graph, ddn-projections, ddn-quality, plus the optional ddn-geo for geographic maps and ddn-iso for isometric depth) let pages ship only what they use, with coded refusals (DDN-E010) when a renderer is absent — a missing ddn-geo or ddn-iso degrades to a visible "Map view requires ddn-geo.js" / "Isometric view requires ddn-iso.js" placeholder, never silently. Live data refresh swaps records while everything else stays byte-identical.'],
];
writeOut('features/index.html', page('../', 'features', 'Features — DDN',
  '<h1 class="page-title">Features</h1>\n' +
  '<p class="lede">What the Diagram Design Notation runtime gives you today, at version ' + VERSION + '.</p>\n' +
  '<div class="grid">\n' +
  FEATURES.map(([h, p]) => '  <div class="card"><h3>' + h + '</h3><p>' + p + '</p></div>').join('\n') +
  '\n</div>\n' +
  '<p><a class="cta primary" href="uml.html">UML 2.5.1: all fourteen diagram families</a> <a class="cta secondary" href="../tools/index.html?mode=design">Open the designer</a> <a class="cta secondary" href="../gallery/index.html#corpus">Browse the examples in the gallery</a></p>'));

// Tools landing: the unified tool itself is served at /tools/index.html (B1-027
// D6); sister tools are linked from the homepage cards and this jump strip is
// no longer a separate page.

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
// UML support page (B1-062): per-family detail, generated profile counts.
const UML_FAMILIES = [
  ['Class', 'uml.structure@2', 'uml-structure-2', 'basics-75-uml-class-complete', 'Types, attributes and operations with visibility, multiplicity and role names on association ends, aggregation and composition diamonds, navigability arrows, qualifiers, association classes, n-ary associations, generalization sets, templates, enumerations, derived members, and provided/required interfaces.'],
  ['Object', 'uml.object@2', 'uml-object-2', 'basics-81-uml-remainder', 'Instances with underlined name : Classifier titles, slot values checked against the classifier\u2019s datatypes, and instance links with multiplicity labels.'],
  ['Package', 'uml.structure@2', 'uml-structure-2', 'basics-81-uml-remainder', 'Package boxes with nesting, «import» / «access» / «merge» dependencies, and +/\u2212 visibility on packaged elements.'],
  ['Deployment', 'uml.deployment@1', 'uml-deployment-1', 'basics-78-uml-deployment', 'Nodes, devices and execution environments as 3D boxes, artifacts as document icons, «deploy» and «manifest» dependencies, and communication paths with multiplicity.'],
  ['Composite structure', 'uml.composite@1', 'uml-composite-1', 'basics-79-uml-composite', 'Parts inside classifiers (role: Type [multiplicity] rows), ports on boundaries, and connectors with role names and multiplicity.'],
  ['Component', 'uml.composite@1', 'uml-composite-1', 'basics-79-uml-composite', 'Components with ports, assembly ball-and-socket connectors, delegation connectors, and provided/required lollipop-and-socket interfaces.'],
  ['Use case', 'uml.usecase@3', 'uml-usecase-3', 'basics-81-uml-remainder', 'Actors, use-case ellipses with extension points, subject boundaries, include/extend/generalization, and extend conditions on the edge label.'],
  ['Activity', 'uml.activity@2', 'uml-activity-2', 'basics-80-uml-activity', 'Actions, decisions vs merges, fork/join bars, object nodes, swimlanes, pins with parameter sets and streaming, send/accept signal pentagons, time events, flow final, interruptible and structured regions, exception handlers, and connector circles.'],
  ['State machine', 'uml.statemachine@1', 'uml-statemachine-1', 'basics-77-uml-statemachine-complete', 'States with entry/exit/do activities and internal transitions, history (H/H*), junction/choice/entry-point/exit-point/fork/join/terminate pseudostates, trigger [guard] / effect transitions, submachines, time events, composite states and parallel regions.'],
  ['Sequence', 'uml.sequence@2', 'uml-sequence-2', 'basics-76-uml-sequence-complete', 'Lifelines with combined fragments (alt/opt/loop/break/par and friends, nested, with guards), gates, creation and destruction, synchronous/asynchronous arrowheads, replies, lost/found messages, execution bars, time/duration constraints, and state invariants.'],
  ['Communication', 'uml.communication@2', 'uml-communication-2', 'basics-81-uml-remainder', 'Numbered messages on a graph layout, combined fragments around message groups, and {time}/{duration} constraints.'],
  ['Timing', 'uml.timing@2', 'uml-timing-2', 'basics-81-uml-remainder', 'State bands per lifeline with duration/slew annotations, time/duration constraints, state compaction, and messages between lifelines.'],
  ['Interaction overview', 'uml.interaction_overview@2', 'uml-interaction-overview-2', 'basics-81-uml-remainder', 'A flowchart of whole interactions: referenced interactions expand inline inside their node, with interaction-use gates and arguments.'],
  ['Profile', 'uml.profile@1', 'uml-profile-1', 'basics-81-uml-remainder', 'Metaclasses and stereotypes with compartments, the filled-triangle extension arrow, and «apply» profile application between packages.'],
];
const umlCards = UML_FAMILIES.map(([name, profile, plate, corpus, blurb]) =>
  '  <div class="card"><h3>' + name + ' <small><code>' + profile + '</code></small></h3><p>' + blurb + '</p>' +
  '<p><a href="../gallery/profiles/' + plate + '.svg">Profile plate</a> · <a href="../gallery/corpus/' + corpus + '.svg">Example</a> · <a href="https://github.com/scratchbird-software-inc/Diagram-Design-Notation/wiki/Diagrams-UML">Wiki guide</a></p></div>').join('\n');
writeOut('features/uml.html', page('../', 'features', 'UML 2.5.1 diagram support — DDN',
  '<h1 class="page-title">UML 2.5.1 — all fourteen diagram families</h1>\n' +
  '<p class="lede">Every UML 2.5.1 diagram family ships as a named, tested DDN profile. One end-to-end example per family is checked and rendered by the test suite. The known exclusions — no XMI/OCL exchange, no executable behavior, no conformance certification — are listed in plain language on the <a href="https://github.com/scratchbird-software-inc/Diagram-Design-Notation/wiki/UML-not-supported">wiki exclusions page</a>.</p>\n' +
  '<div class="grid">\n' + umlCards + '\n</div>\n' +
  '<p><a class="cta primary" href="../tools/index.html?mode=design">Open the designer</a> <a class="cta secondary" href="../gallery/index.html">Browse the gallery</a></p>'));

writeOut('docs/index.html', page('../', 'docs', 'Documentation — DDN',
  '<h1 class="page-title">Documentation</h1>\n' +
  '<p class="lede">Developer documentation for embedding, the workspace API, styling hooks, data refresh, and authoring .ddn sources — rendered from the Markdown in <code>website/docs/</code>.</p>\n' +
  '<h2>Developer guide</h2>\n' + docList(path.join(REPO, 'website/docs/developers'), 'docs/developers', 'developers/') +
  '<h2>Engineering notes</h2>\n' + docList(path.join(REPO, 'website/docs/notes'), 'docs/notes', 'notes/')));

// Standard landing.
writeOut('standard/index.html', page('../', 'standard', 'The DDN standard — DDN',
  '<h1 class="page-title">The Diagram Design Notation standard</h1>\n' +
  '<p class="lede">A proposed open standard, pre-1.0: specification chapters, the versioning policy, the EBNF grammar, JSON schemas, and the machine-readable registry. The normative source lives in <code>standard/</code> at the repository root; these pages are rendered copies. DDN provides profiles/projections for well-known diagram families, including all fourteen UML 2.5.1 diagram families with documented exclusions (no XMI/OCL exchange, executable behavior or conformance certification).</p>\n' +
  '<h2>Specification (' + SPEC_CHAPTER_COUNT + ' chapters)</h2>\n' +
  docList(path.join(REPO, 'standard/specification'), 'standard/specification', 'specification/') +
  '<h2>Governance</h2>\n' +
  '<ul>\n  <li><a href="governance/VERSIONING.html">Versioning policy</a></li>\n  <li><a href="governance/RFC-TEMPLATE.html">RFC template</a></li>\n</ul>\n' +
  '<h2>Notation plates</h2>\n<p><a href="../plates/index.html">SVG plates of the full vocabulary</a> — object kinds, facets, relationship families, looks, and routing.</p>'));

/* B1-053 addendum (D7): the examples browser is retired — the gallery now
 * carries the complete example corpus with explanations, browsable sources and
 * viewer/designer deep links, making a separate index redundant. The URL stays
 * working for external links as a redirect stub to the gallery, matching the
 * retired viewer/studio/designer stubs. The raw .ddn files themselves are
 * still served (the gallery links them), and examples/README.html keeps
 * documenting them. */
writeOut('examples/index.html',
  '<!doctype html>\n<!-- SPDX-License-Identifier: GPL-2.0-or-later. The examples index was\n' +
  '     folded into the gallery, which now renders the complete example corpus with\n' +
  '     explanations, DDN sources and viewer/designer deep links. Generated by\n' +
  '     website/build-site.mjs. -->\n' +
  '<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Moved — DDN examples are in the gallery</title>\n' +
  '<link rel="icon" type="image/svg+xml" href="../assets/brand/favicon.svg">\n' +
  '<meta http-equiv="refresh" content="0; url=../gallery/index.html#corpus">\n</head>\n<body>\n' +
  '<p>The examples index moved: every example is now rendered in the gallery with its explanation, DDN source and tool links.\n' +
  'Open the <a id="ddn-redirect-target" href="../gallery/index.html#corpus">example corpus in the gallery</a>.</p>\n' +
  '<script>location.replace("../gallery/index.html#corpus");</' + 'script>\n' +
  '</body>\n</html>\n');

// Download page: clone/npm instructions + dist bundle table with byte sizes.
const distRows = fs.readdirSync(path.join(REPO, 'notation/dist')).sort()
  .filter(f => /\.(js|mjs|css|d\.ts|d\.mts|map)$/.test(f))
  .map(f => '<tr><td><a href="../dist/' + f + '"><code>' + f + '</code></a></td><td>' + fs.statSync(path.join(REPO, 'notation/dist', f)).size + '</td></tr>');
writeOut('download/index.html', page('../', 'download', 'Download — DDN',
  '<h1 class="page-title">Download</h1>\n' +
  '<p class="lede">ddn ' + VERSION + ' — the open-source Diagram Design Notation project, sponsored by <a href="https://scratchbird.ca/weaver">ScratchWeaver</a> (<a href="https://www.scratchbird.ca">ScratchBird Software Inc.</a>) — is pre-1.0 and <strong>not yet published to the npm registry</strong>. Today you get it by cloning the repository; the runtime bundles below are also served directly from this site, and <code>npm pack</code> in <code>notation/</code> produces the installable <code>@ddn/notation</code> tarball. The publish path is ready: CI runs <code>npm publish --dry-run</code> on every push and would publish on <code>v*</code> tags once the <code>NPM_TOKEN</code> secret is configured (it skips gracefully until then; the committed <code>private: true</code> is an accident guard stripped only by the tag-gated publish job). Embedding? Start from the <a href="../docs/developers/embedding.html">embedding quickstart</a>.</p>\n' +
  '<h2>Clone the repository</h2>\n' +
  '<pre><code>git clone &lt;repo-url&gt; data-design-notation\ncd data-design-notation\nnpm test          # full verification suite, exit 0 expected</code></pre>\n' +
  '<h2>Runtime bundles</h2>\n' +
  '<p>Load <code>ddn.global.js</code> for everything, or compose the modular bundles (<code>ddn-core</code> → <code>ddn-graph</code> → <code>ddn-projections</code>/<code>ddn-quality</code>, plus the optional <code>ddn-geo</code> for map views and <code>ddn-iso</code> for isometric depth). Every bundle ships three formats: use the <strong>minified <code>.min.js</code> IIFEs for production embeds</strong>, the <strong><code>.mjs</code> ES modules for modern bundlers and module pages</strong> (tree-shakeable; browsers need a static server for module imports — no <code>file://</code>), and the readable <code>.js</code> builds for debugging (source maps included). See the <a href="../docs/developers/modules.html">modules guide</a>, the <a href="../docs/developers/embedding.html">embedding quickstart</a> and the <a href="../examples/embed/script-tag-global.html">embed example pages</a>.</p>\n' +
  '<table>\n<thead><tr><th>Bundle</th><th>Bytes</th></tr></thead><tbody>\n' + distRows.join('\n') + '\n</tbody></table>\n' +
  '<h2>Field guide</h2>\n' +
  '<p>The <a href="../guide/index.html">Diagram Field Guide</a> (' + GUIDE_CHAPTER_COUNT + ' chapters) also ships as <a href="../guide/portable.html">one portable, self-contained HTML file</a> — the whole edition: live examples, guided edits and the full runtime inlined; save it and it works offline.</p>\n' +
  '<h2>Reference</h2>\n' +
  '<p>The <a href="../reference/index.html">element kind and relation reference</a> lists every one of the ' + REF_FACT('registry.totalKinds') + ' kinds and ' + REF_FACT('registry.totalRelations') + ' relations with its rendered symbol, meaning and a paste-ready example — generated from the registry at every site build.</p>\n' +
  '<h2>AI authoring reference</h2>\n' +
  '<p><a href="DDN-AI-REFERENCE.md"><strong>DDN-AI-REFERENCE.md</strong></a> (' + Math.round(Buffer.byteLength(AI_REFERENCE.text, 'utf8') / 1024) + ' KiB, regenerated from the registry at every site build) is the whole DDN dialect in one file — vocabulary, properties, projections, all ' + AI_REFERENCE.diagnosticCount + ' diagnostic codes with fixes, the full grammar, and two dozen worked recipes — written so a chat AI can author valid DDN from it. How to use it:</p>\n' +
  '<ol>\n' +
  '  <li>Download <a href="DDN-AI-REFERENCE.md">the reference file</a>.</li>\n' +
  '  <li>Paste it into your AI chat (Claude, ChatGPT, …) or attach it as context.</li>\n' +
  '  <li>Describe the diagram you want in plain language — the AI writes the DDN source.</li>\n' +
  '  <li>Paste that source into the <a href="../tools/index.html">live tool</a> — it renders immediately, and the validator catches anything the AI got wrong, by code.</li>\n' +
  '</ol>\n' +
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

/* Icon pack viewer (B1-101 slice 2): browse every installed pack with
 * multi-size previews, search by name/id/tag/kind, and copy the exact x_icon
 * reference. */
const iconViewerData = JSON.stringify(ICON_PACKS.map(p => ({
  id: p.id, name: p.name, license: p.license || '', attribution: p.attribution || '', source: p.source || '', note: p.note || '',
  icons: p.icons.map(i => ({ id: i.id, name: i.name, tags: i.tags || [], kinds: i.kinds || [], svg: i.svg })),
}))).replace(/</g, '\\u003c');
writeOut('icons/index.html', page('../', 'icons', 'Icon packs — browse, preview, copy the x_icon reference',
  '<h1 class="page-title">Icon packs</h1>\n' +
  '<p class="lede">' + ICON_PACKS.length + ' installed packs, ' + ICON_TOTAL + ' icons. Every icon renders at 16/24/32/48 px; click a card to copy the exact <code>x_icon</code> reference for your source. Packs are open <a href="../standard/specification/49-icon-packs.html">ddn-icon-pack@1</a> documents — license and attribution are shown per pack. Looking for detailed presentation illustrations instead of stroke icons? Those are <strong>art packs</strong> — <a href="art.html">browse them here</a>.</p>\n' +
  '<div class="icon-browser">\n' +
  '  <div class="icon-browser-bar"><input id="icon-q" type="search" placeholder="Search name, id, tag or kind…" aria-label="Search icons"><span id="icon-count" class="icon-count"></span></div>\n' +
  '  <div id="icon-pack-filters" class="icon-pack-filters" role="group" aria-label="Filter by pack"></div>\n' +
  '  <div id="icon-packs"></div>\n' +
  '</div>\n' +
  '<div id="icon-copied" role="status" aria-live="polite"></div>\n' +
  '<style>\n' +
  '.icon-browser-bar{display:flex;gap:12px;align-items:center;margin:12px 0}#icon-q{flex:1;max-width:520px;padding:8px 10px;font-size:15px}\n' +
  '.icon-count{color:var(--muted,#5b6570);font-size:13px;white-space:nowrap}\n' +
  '.icon-pack-filters{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 18px}\n' +
  '.icon-pack-filters button{border:1px solid currentColor;border-radius:14px;background:none;padding:3px 10px;font-size:12.5px;cursor:pointer;opacity:.75}\n' +
  '.icon-pack-filters button[aria-pressed="true"]{opacity:1;font-weight:650}\n' +
  '.icon-pack{margin:0 0 30px}.icon-pack>h2{margin:0 0 2px;font-size:19px}\n' +
  '.icon-pack-meta{font-size:12.5px;color:var(--muted,#5b6570);margin:0 0 10px}\n' +
  '.icon-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}\n' +
  '.icon-card{border:1px solid #d4d9df;border-radius:8px;background:#fff;padding:8px;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:6px}\n' +
  '.icon-card:hover{border-color:#0c75bd}.icon-card:focus-visible{outline:2px solid #0c75bd}\n' +
  '.icon-sizes{display:flex;align-items:flex-end;gap:10px;color:#22303c;height:52px}\n' +
  '.icon-sizes svg{display:block}\n' +
  '.icon-name{font-size:12.5px;font-weight:600}.icon-ref{font-size:11px;color:var(--muted,#5b6570);font-family:ui-monospace,monospace;word-break:break-all}\n' +
  '#icon-copied{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:#22303c;color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .25s;pointer-events:none;max-width:80vw}\n' +
  '</style>\n' +
  '<script>const ICON_PACKS = ' + iconViewerData + ';</script>\n' +
  '<script>(function(){\n' +
  'var packsEl=document.getElementById("icon-packs"),q=document.getElementById("icon-q"),count=document.getElementById("icon-count"),filters=document.getElementById("icon-pack-filters"),copied=document.getElementById("icon-copied");\n' +
  'var activePack=null,copiedTimer=null;\n' +
  'function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;")}\n' +
  'function xref(p,i){return "x_icon: { library: \\""+p.id+"\\", icon: \\""+i.id+"\\" };";}\n' +
  'function copy(text,label){var settled=false;function done(){if(settled)return;settled=true;copied.textContent="Copied: "+text;copied.style.opacity=1;clearTimeout(copiedTimer);copiedTimer=setTimeout(function(){copied.style.opacity=0;},2200);}\n' +
  '  if(navigator.clipboard&&navigator.clipboard.writeText){try{navigator.clipboard.writeText(text).then(done,function(){fallback();});}catch(e){fallback();}}else fallback();\n' +
  '  setTimeout(function(){if(!settled)fallback();},700);\n' +
  '  function fallback(){var ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();try{document.execCommand("copy");}catch(e){}ta.remove();done();}}\n' +
  'function match(p,i,needle){if(activePack&&p.id!==activePack)return false;if(!needle)return true;var hay=(i.id+" "+i.name+" "+p.id+" "+p.name+" "+i.tags.join(" ")+" "+i.kinds.join(" ")).toLowerCase();return needle.split(/\\s+/).every(function(w){return hay.indexOf(w)>=0;});}\n' +
  'function render(){var needle=q.value.trim().toLowerCase(),shown=0;packsEl.replaceChildren();\n' +
  '  ICON_PACKS.forEach(function(p){var icons=p.icons.filter(function(i){return match(p,i,needle);});if(!icons.length)return;shown+=icons.length;\n' +
  '    var sec=document.createElement("section");sec.className="icon-pack";\n' +
  '    var meta=esc(p.license)+(p.attribution?" · "+esc(p.attribution):"")+(p.source?" · <a href=\\""+esc(p.source)+"\\">source</a>":"")+(p.note?" — "+esc(p.note):"");\n' +
  '    sec.innerHTML="<h2>"+esc(p.name)+" <span class=\\"icon-count\\">"+p.id+" · "+icons.length+" icons</span></h2><p class=\\"icon-pack-meta\\">"+meta+"</p>";\n' +
  '    var grid=document.createElement("div");grid.className="icon-grid";\n' +
  '    icons.forEach(function(i){var card=document.createElement("button");card.type="button";card.className="icon-card";card.title="Copy "+xref(p,i);\n' +
  '      card.innerHTML="<span class=\\"icon-sizes\\">"+[16,24,32,48].map(function(s){return "<span style=\\"width:"+s+"px;height:"+s+"px\\">"+i.svg.replace("<svg ","<svg width=\\""+s+"\\" height=\\""+s+"\\" ")+"</span>";}).join("")+"</span><span class=\\"icon-name\\">"+esc(i.name)+"</span><span class=\\"icon-ref\\">"+esc(p.id+" / "+i.id)+"</span>";\n' +
  '      card.addEventListener("click",function(){copy(xref(p,i));});grid.appendChild(card);});\n' +
  '    sec.appendChild(grid);packsEl.appendChild(sec);});\n' +
  '  count.textContent=shown+" of "+ICON_PACKS.reduce(function(n,p){return n+p.icons.length;},0)+" icons";}\n' +
  'var chipDefs=[["All packs",null]].concat(ICON_PACKS.map(function(p){return [p.id,p.id];}));\n' +
  'filters.replaceChildren.apply(filters,chipDefs.map(function(pair){var b=document.createElement("button");b.type="button";b.textContent=pair[0];b.setAttribute("aria-pressed",pair[1]===activePack?"true":"false");b.addEventListener("click",function(){activePack=pair[1];filters.querySelectorAll("button").forEach(function(x){x.setAttribute("aria-pressed",x===b?"true":"false");});render();});return b;}));\n' +
  'q.addEventListener("input",render);render();\n' +
  '})();</script>'));


/* Art pack viewer (B1-101 follow-up, owner gap report): the presentation
 * illustrations are art packs (ddn-art-pack@1), not icon packs — a sibling
 * page so the icon viewer keeps its 24x24-stroke semantics. Every item in
 * every installed art pack, large preview, tags, anchors, and a copyable
 * x_art snippet, plus how-to-use and how-to-add sections. Pack data comes
 * from standard/registry/art-packs/ (counts never hardcoded). */
const ART_PACKS = readJson('standard/registry/art-packs/index.json').packs.map(f =>
  readJson('standard/registry/art-packs/' + f));
const ART_TOTAL = ART_PACKS.reduce((n, p) => n + p.items.length, 0);
const artViewerData = JSON.stringify(ART_PACKS.map(p => ({
  id: p.id, name: p.name, license: p.license || '', attribution: p.attribution || '', source: p.source || '', note: p.note || '',
  items: p.items.map(i => ({ id: i.id, name: i.name, tags: i.tags || [], anchors: Object.keys(i.anchors || {}).length, svg: i.svg })),
}))).replace(/</g, '\\u003c');
writeOut('icons/art.html', page('../', 'icons', 'Art packs — presentation illustrations, browse and copy the x_art reference',
  '<h1 class="page-title">Art packs — presentation illustrations</h1>\n' +
  '<p class="lede">' + ART_PACKS.length + ' installed art pack' + (ART_PACKS.length === 1 ? '' : 's') + ', ' + ART_TOTAL + ' items — detailed illustrations (computers, servers, network gear, buildings, people) for presentation-style diagrams, not 24×24 stroke icons. Click a card to copy the exact <code>x_art</code> reference. Packs are open <a href="../standard/specification/50-art-packs.html">ddn-art-pack@1</a> documents with per-item provenance. (Stroke icons live in the <a href="index.html">icon pack viewer</a>.)</p>\n' +
  '<section class="card" style="border:1px solid #d4d9df;border-radius:8px;background:#fff;padding:12px 16px;margin:0 0 14px"><h2 style="margin-top:0">How to use art in your diagrams</h2>\n' +
  '<ol style="margin:0;padding-left:1.3em">\n' +
  '<li>Find an item below and click its card — the exact <code>x_art</code> snippet is on your clipboard, e.g. <code>x_art: { library: "presentation-devices@1", item: "server" };</code></li>\n' +
  '<li>Paste it into any object in your <code>data</code> block. The illustration fills the node below its header; the item\'s declared <strong>anchors</strong> (north/east/south/west edge midpoints, plus any named points) are exactly where relations attach — a <code>port</code> member whose name matches an anchor snaps to it.</li>\n' +
  '<li><strong>Register the pack where you render.</strong> Art packs are never inlined into the tools: CLI renders take <code>--pack standard/registry/art-packs/presentation-devices__1.json</code>; hosts call <code>DDNLive.registerArtPack(pack)</code>. Without the pack, every art node draws an honest dashed placeholder naming the missing reference — never an error, never a fake image.</li>\n' +
  '</ol></section>\n' +
  '<section class="card" style="border:1px solid #d4d9df;border-radius:8px;background:#fff;padding:12px 16px;margin:0 0 14px"><h2 style="margin-top:0">How to add items</h2>\n' +
  '<p style="margin:0">An art pack is a single JSON document: a manifest (id, name, version, license, attribution, source) plus <code>items</code> — each with <code>id</code>, <code>name</code>, inline <code>svg</code> (≤ 64 KiB, arbitrary viewBox), required <strong>connection anchors</strong> (<code>north</code>/<code>east</code>/<code>south</code>/<code>west</strong> in viewBox coordinates, plus optional named points), and mandatory per-item <strong>provenance</strong> (title, author, license, source URL, retrieval date). The hard gate is licensing: every item\'s license must be verified at curation time — CC0 / public domain preferred; items whose terms can\'t be verified do not ship. Registration sanitizes exactly like icon artwork (DDN-PJ206 manifest / DDN-PJ207 unsafe SVG: no scripts, handlers, or external references). Curation and assembly tooling lives in the repository: <code>tools/curate-art.mjs</code>, <code>tools/fetch-art-candidates.mjs</code>, <code>tools/fetch-art-freesvg.mjs</code>, <code>tools/review-art-freesvg.mjs</code>, <code>tools/build-art-pack.mjs</code>. Full format: <a href="../standard/specification/50-art-packs.html">specification chapter 50</a> + the <a href="../docs/developers/icon-packs.html#art-packs-presentation-illustrations">developer guide</a>.</p></section>\n' +
  '<div class="icon-browser">\n' +
  '  <div class="icon-browser-bar"><input id="art-q" type="search" placeholder="Search name, id or tag…" aria-label="Search art items"><span id="art-count" class="icon-count"></span></div>\n' +
  '  <div id="art-pack-filters" class="icon-pack-filters" role="group" aria-label="Filter by pack"></div>\n' +
  '  <div id="art-packs"></div>\n' +
  '</div>\n' +
  '<div id="icon-copied" role="status" aria-live="polite"></div>\n' +
  '<style>\n' +
  '.art-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}\n' +
  '.art-card{border:1px solid #d4d9df;border-radius:8px;background:#fff;padding:8px;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:6px}\n' +
  '.art-card:hover{border-color:#0c75bd}.art-card:focus-visible{outline:2px solid #0c75bd}\n' +
  '.art-preview{height:110px;display:flex;align-items:center;justify-content:center;color:#22303c}\n' +
  '.art-preview svg{max-width:100%;max-height:110px}\n' +
  '.art-tags{font-size:11px;color:var(--muted,#5b6570)}\n' +
  '</style>\n' +
  '<script>const ART_PACKS = ' + artViewerData + ';</script>\n' +
  '<script>(function(){\n' +
  'var packsEl=document.getElementById("art-packs"),q=document.getElementById("art-q"),count=document.getElementById("art-count"),filters=document.getElementById("art-pack-filters"),copied=document.getElementById("icon-copied");\n' +
  'var activePack=null,copiedTimer=null;\n' +
  'function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;")}\n' +
  'function xref(p,i){return "x_art: { library: \\""+p.id+"\\", item: \\""+i.id+"\\" };";}\n' +
  'function copy(text){var settled=false;function done(){if(settled)return;settled=true;copied.textContent="Copied: "+text;copied.style.opacity=1;clearTimeout(copiedTimer);copiedTimer=setTimeout(function(){copied.style.opacity=0;},2200);}\n' +
  '  if(navigator.clipboard&&navigator.clipboard.writeText){try{navigator.clipboard.writeText(text).then(done,function(){fallback();});}catch(e){fallback();}}else fallback();\n' +
  '  setTimeout(function(){if(!settled)fallback();},700);\n' +
  '  function fallback(){var ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();try{document.execCommand("copy");}catch(e){}ta.remove();done();}}\n' +
  'function match(p,i,needle){if(activePack&&p.id!==activePack)return false;if(!needle)return true;var hay=(i.id+" "+i.name+" "+p.id+" "+p.name+" "+i.tags.join(" ")).toLowerCase();return needle.split(/\\s+/).every(function(w){return hay.indexOf(w)>=0;});}\n' +
  'function render(){var needle=q.value.trim().toLowerCase(),shown=0;packsEl.replaceChildren();\n' +
  '  ART_PACKS.forEach(function(p){var items=p.items.filter(function(i){return match(p,i,needle);});if(!items.length)return;shown+=items.length;\n' +
  '    var sec=document.createElement("section");sec.className="icon-pack";\n' +
  '    var meta=esc(p.license)+(p.attribution?" · "+esc(p.attribution):"")+(p.source?" · <a href=\\""+esc(p.source)+"\\">source</a>":"")+(p.note?" — "+esc(p.note):"");\n' +
  '    sec.innerHTML="<h2>"+esc(p.name)+" <span class=\\"icon-count\\">"+p.id+" · "+items.length+" items</span></h2><p class=\\"icon-pack-meta\\">"+meta+"</p>";\n' +
  '    var grid=document.createElement("div");grid.className="art-grid";\n' +
  '    items.forEach(function(i){var card=document.createElement("button");card.type="button";card.className="art-card";card.title="Copy "+xref(p,i);\n' +
  '      card.innerHTML="<span class=\\"art-preview\\">"+i.svg+"</span><span class=\\"icon-name\\">"+esc(i.name)+"</span><span class=\\"icon-ref\\">"+esc(p.id+" / "+i.id)+"</span><span class=\\"art-tags\\">"+(i.tags.length?"tags: "+esc(i.tags.join(", "))+" · ":"")+i.anchors+" anchors</span>";\n' +
  '      card.addEventListener("click",function(){copy(xref(p,i));});grid.appendChild(card);});\n' +
  '    sec.appendChild(grid);packsEl.appendChild(sec);});\n' +
  '  count.textContent=shown+" of "+ART_PACKS.reduce(function(n,p){return n+p.items.length;},0)+" items";}\n' +
  'var chipDefs=[["All packs",null]].concat(ART_PACKS.map(function(p){return [p.id,p.id];}));\n' +
  'filters.replaceChildren.apply(filters,chipDefs.map(function(pair){var b=document.createElement("button");b.type="button";b.textContent=pair[0];b.setAttribute("aria-pressed",pair[1]===activePack?"true":"false");b.addEventListener("click",function(){activePack=pair[1];filters.querySelectorAll("button").forEach(function(x){x.setAttribute("aria-pressed",x===b?"true":"false");});render();});return b;}));\n' +
  'q.addEventListener("input",render);render();\n' +
  '})();</script>'));


/* ---------------------------------------------------- reference section ----
 * Every element kind and relation, generated from the runtime registries
 * with the shared data/prose/example builders in tools/reference-data.mjs
 * (single source of truth — the wiki reference generator consumes the same
 * module). Structure: one landing page + per-family kind pages (12) +
 * per-family relation pages (8) + a relations overview; one validated,
 * rendered example plate per kind and relation. Counts come from facts.json.
 * Page count stays at 22 on purpose: per-kind pages would add ~560 pages for
 * no information gain over anchored per-family pages. */

const REF = (() => {
  const require2 = createRequire(import.meta.url);
  const A = require2(path.join(REPO, 'notation/dist/ddn.global.js'));
  require2(path.join(REPO, 'notation/dist/ddn-graph.js'));
  require2(path.join(REPO, 'notation/dist/ddn-iso.js'));
  require2(path.join(REPO, 'notation/dist/ddn-geo.js'));
  return A;
})();
const refCore = (await import('../notation/runtime/assets/catalogue.js')).default;
const refProf = (await import('../notation/runtime/assets/profiles-catalogue.js')).default;
const WIKI_BASE = 'https://github.com/scratchbird-software-inc/Diagram-Design-Notation/wiki';

/* md-inline for the shared prose: escaping, `code`, **bold**, *italic*, and
 * [label](target) links — bare Wiki-Page targets become absolute wiki links,
 * anchors/URLs/relative links pass through. */
function refInline(text) {
  let t = esc(String(text));
  t = t.replace(/`([^`]+)`/g, (m, c) => '<code>' + c + '</code>');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, u) => {
    const href = /^(https?:|#|\.|\/)/.test(u) ? u : WIKI_BASE + '/' + u;
    return '<a href="' + href + '">' + label + '</a>';
  });
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return t;
}
const refPara = text => '<p>' + refInline(text) + '</p>';
const refSlugProfile = id => id.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
const REF_CSS = '<style>\n' +
  '.ref-toc{columns:3;font-size:13px;margin:0 0 18px}.ref-toc a{display:block;padding:1px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n' +
  '.ref-entry{border-top:1px solid #d9e2ec;padding:14px 0 6px}.ref-entry h3{margin:0 0 8px;font-size:17px}\n' +
  '.ref-plate{display:block;max-width:340px;border:1px solid #d4d9df;border-radius:8px;background:#fff;padding:6px;margin:4px 0 8px}\n' +
  '.ref-entry p{margin:4px 0;font-size:14px}.ref-entry details{margin:6px 0 12px}.ref-entry pre{max-height:320px;overflow:auto}\n' +
  '.ref-gall{font-size:12.5px}.ref-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin:14px 0}\n' +
  '.ref-cards a{display:block;border:1px solid #d4d9df;border-radius:8px;padding:10px 12px;background:#fff;text-decoration:none}.ref-cards a:hover{border-color:#0c75bd}\n' +
  '.ref-cards b{display:block;font-size:14.5px}.ref-cards span{font-size:12.5px;color:#5b6570}\n' +
  '</style>';

const refFailures = [];
function refProve(id, src, relOut) {
  try {
    const ws = REF.createWorkspace({ 'demo.ddn': src });
    const r = ws.renderSync({ entry: 'demo.ddn', view: 'picture' });
    ws.destroy();
    writeOut(relOut, r.svg);
    return true;
  } catch (e) {
    refFailures.push({ id, err: String(e && (e.code ? e.code + ' ' : '') + (e.message || e)).slice(0, 300) });
    return false;
  }
}

const refAllKinds = [...refCore.kinds.map(k => ({ ...k, profile: false })), ...refProf.kinds.map(k => ({ ...k, profile: true }))];
const refByFamily = {};
for (const k of refAllKinds) (refByFamily[k.family] = refByFamily[k.family] || []).push(k);
const refAllRels = [...refCore.relationships.map(r => ({ ...r, profile: false })), ...refProf.relationships.map(r => ({ ...r, profile: true, end: r.end || 'filled' }))];
const refRelFamilyMap = { data_flow: 'flow' };
const refRelByFamily = {};
for (const r of refAllRels) { const f = refRelFamilyMap[r.family] || r.family; (refRelByFamily[f] = refRelByFamily[f] || []).push(r); }

function refKindEntry(k, family) {
  const name = k.text_label || k.name, kw = REFDATA.kwFile(k.keyword);
  const profiles = REFDATA.profilesFor(refProf, k.keyword);
  const bits = [];
  if (profiles.length) bits.push('profiles such as ' + profiles.slice(0, 3).map(p => '<code>' + esc(p) + '</code>').join(', '));
  const gallery = profiles.length
    ? ' · <span class="ref-gall">gallery: ' + profiles.slice(0, 3).map(p => '<a href="../gallery/profiles/' + refSlugProfile(p) + '.svg">' + esc(p) + '</a>').join(', ') + '</span>'
    : '';
  return '<section class="ref-entry" id="k-' + kw + '">\n' +
    '<h3>' + esc(name) + ' (<code>' + esc(k.keyword) + '</code>)</h3>\n' +
    '<img class="ref-plate" alt="The ' + esc(name) + ' symbol" src="assets/kinds/' + kw + '.svg">\n' +
    refPara('**What it looks like.** ' + REFDATA.kindLooks(k, family)) +
    refPara('**What it represents.** ' + (k.meaning ? k.meaning.replace(/\.$/, '') : name + ' — a ' + family + ' kind.') + '.') +
    (bits.length ? refPara('**Where it shows up.** ' + bits.join('; ') + '.' + gallery) : '') +
    refPara('**What you can add.** Everything optional: ' + REFDATA.FAMILIES[family].props) +
    '<details><summary>Example — paste it into the tool’s source drawer and Apply</summary><pre><code>' + esc(REFDATA.kindExample(k, name).trimEnd()) + '</code></pre></details>\n' +
    '</section>';
}

function refRelEntry(r, family) {
  const kw = REFDATA.kwFile(r.keyword);
  const ends = [];
  if (r.start && r.start !== 'none') ends.push('starts with a ' + r.start + ' mark');
  if (r.end && r.end !== 'none') ends.push('ends with a ' + (r.end === 'filled' ? 'filled arrowhead' : r.end === 'open' ? 'open arrowhead' : r.end + ' mark'));
  const dir = r.direction || (ends.length ? 'It ' + ends.join(' and ') + ' — read it in the arrow direction: “From → To”.' : 'It has no arrowheads — the relation is symmetric in meaning; the label does the talking.');
  const meaning = r.meaning ? r.meaning.replace(/\.$/, '') : (r.verb || r.name);
  const extra = family === 'structural'
    ? refPara('**Endpoint options.** The example shows crow’s-foot marks (`zeromany` on the source, `one` on the target). Swap in `one`, `zeroone`, `many`, or use `diamond`/`triangle` for containment and generalization.')
    : '';
  return '<section class="ref-entry" id="r-' + kw + '">\n' +
    '<h3>' + esc(r.name) + ' (<code>' + esc(r.keyword) + '</code>)</h3>\n' +
    '<img class="ref-plate" alt="What the “' + esc(r.name) + '” line looks like" src="assets/relations/' + kw + '.svg">\n' +
    refPara('**What it means.** ' + meaning + '. ' + dir) + extra +
    '<details><summary>Example — paste it into the tool’s source drawer and Apply</summary><pre><code>' + esc(refRelExampleSrc(r)) + '</code></pre></details>\n' +
    '</section>';
}

function refRelExampleSrc(r) {
  if (REFDATA.REL_EXAMPLE[r.keyword]) return REFDATA.REL_EXAMPLE[r.keyword](r).trimEnd();
  if (r.profile) {
    const pick = list => (list && list[0] && list[0] !== '*') ? list[0] : 'object';
    return REFDATA.relExample(r, { source: pick(r.source), target: pick(r.target) }).trimEnd();
  }
  return REFDATA.relExample(r).trimEnd();
}

/* Render every plate first (fail the build loudly on any regression — the
 * same 100%-coverage guarantee the wiki generator's coverage gate enforces). */
for (const k of refAllKinds) {
  const kw = REFDATA.kwFile(k.keyword);
  if (!refProve('kind-' + kw, REFDATA.kindExample(k, k.text_label || k.name), 'reference/assets/kinds/' + kw + '.svg'))
    throw new Error('reference plate failed for kind ' + k.keyword + ': ' + refFailures.at(-1).err);
}
for (const r of refAllRels) {
  const kw = REFDATA.kwFile(r.keyword);
  let ok = false;
  if (REFDATA.REL_EXAMPLE[r.keyword]) ok = refProve('rel-' + kw, REFDATA.REL_EXAMPLE[r.keyword](r), 'reference/assets/relations/' + kw + '.svg');
  else if (r.profile) {
    const pick = list => (list && list[0] && list[0] !== '*') ? list[0] : 'object';
    const sK = pick(r.source), tK = pick(r.target);
    for (const p of [''].concat(REFDATA.profilesFor(refProf, r.keyword))) {
      if (refProve('rel-' + kw, REFDATA.relExample(r, { source: sK, target: tK, profile: p || undefined }), 'reference/assets/relations/' + kw + '.svg')) { ok = true; break; }
    }
  } else ok = refProve('rel-' + kw, REFDATA.relExample(r), 'reference/assets/relations/' + kw + '.svg');
  if (!ok) throw new Error('reference plate failed for relation ' + r.keyword + ': ' + refFailures.at(-1).err);
}

/* Kind family pages. */
const refKindPageList = [];
for (const [family, meta] of Object.entries(REFDATA.FAMILIES)) {
  const kinds = refByFamily[family] || [];
  const fileSlug = 'kinds-' + family;
  refKindPageList.push({ family, title: meta.title, file: fileSlug, count: kinds.length, into: meta.into });
  const toc = kinds.map(k => '<a href="#k-' + REFDATA.kwFile(k.keyword) + '">' + esc(k.text_label || k.name) + ' · <code>' + esc(k.keyword) + '</code></a>').join('\n');
  const body = REF_CSS + '\n<h1 class="page-title">Reference — ' + esc(meta.title) + '</h1>\n' +
    refPara(meta.into) +
    refPara('This page lists every **' + ({ sql: 'SQL' }[family] || family[0].toUpperCase() + family.slice(1)) + '** element kind in DDN — **' + kinds.length + '** of them. Each one shows its symbol, what it means, what extra information it accepts, and a tiny working example. Every example on this page passes the tool’s own check and render steps.') +
    refPara('Diagram guides on the wiki: ' + meta.pages.map(p => '[' + p.replace('Diagrams-', '').replace(/-/g, ' ') + '](' + p + ')').join(' · ') + ' · relations: [all relation families](relations.html) · [reference index](index.html).') +
    '<div class="ref-toc">' + toc + '</div>\n' +
    kinds.map(k => refKindEntry(k, family)).join('\n') +
    '<hr><p><small>Applies to DDN ' + VERSION + ' · generated from the registry by <code>website/build-site.mjs</code> · wiki counterpart: <a href="' + WIKI_BASE + '/Ref-Kinds-' + family[0].toUpperCase() + family.slice(1) + '">Ref-Kinds-' + family[0].toUpperCase() + family.slice(1) + '</a>.</small></p>';
  writeOut('reference/' + fileSlug + '.html', page('../', 'reference', 'Reference — ' + meta.title + ' — DDN', body,
    'Every ' + family + ' element kind in DDN (' + kinds.length + '): symbol, meaning, properties and a working example, generated from the registry.'));
}

/* Relation family pages. */
const refRelPageList = [];
for (const [family, meta] of Object.entries(REFDATA.REL_FAMILIES)) {
  const rels = refRelByFamily[family] || [];
  const fileSlug = 'relations-' + family;
  refRelPageList.push({ family, title: meta.title, file: fileSlug, count: rels.length, into: meta.into });
  const toc = rels.map(r => '<a href="#r-' + REFDATA.kwFile(r.keyword) + '">' + esc(r.name) + ' · <code>' + esc(r.keyword) + '</code></a>').join('\n');
  const body = REF_CSS + '\n<h1 class="page-title">Reference — ' + esc(meta.title) + '</h1>\n' +
    refPara(meta.into) +
    refPara('This page lists every **' + family[0].toUpperCase() + family.slice(1) + '** relation in DDN — **' + rels.length + '** of them. Relations are declared inside a `data` block: `relation id "label" @from -> @to { kind: …; }`. Every example on this page passes the tool’s own check and render steps.') +
    refPara(meta.marks) +
    refPara('Element kinds: [all element families](index.html) · relations overview: [relations, the short version](relations.html).') +
    '<div class="ref-toc">' + toc + '</div>\n' +
    rels.map(r => refRelEntry(r, family)).join('\n') +
    '<hr><p><small>Applies to DDN ' + VERSION + ' · generated from the registry by <code>website/build-site.mjs</code> · wiki counterpart: <a href="' + WIKI_BASE + '/' + meta.file + '">' + meta.file + '</a>.</small></p>';
  writeOut('reference/' + fileSlug + '.html', page('../', 'reference', 'Reference — ' + meta.title + ' — DDN', body,
    'Every ' + family + ' relation in DDN (' + rels.length + '): line marks, meaning, constraints and a working example, generated from the registry.'));
}

/* Relations overview page (Ref-Relations-Home equivalent). */
{
  const gists = {
    structural: 'things belong together; the only lines that carry cardinality marks',
    flow: 'data moves this way',
    dependency: 'this needs that — no data implied',
    mapping: 'this stands for that',
    control: 'what happens next',
    lineage: 'where this came from',
    governance: 'who owns it, which rules apply',
    annotation: 'margin notes attached to the model',
  };
  const cards = Object.entries(REFDATA.REL_FAMILIES).map(([f, m]) =>
    '<a href="relations-' + f + '.html"><b>' + esc(m.title) + '</b><span>' + (refRelByFamily[f] || []).length + ' relations — ' + esc(gists[f]) + '</span></a>').join('\n');
  const body = REF_CSS + '\n<h1 class="page-title">Reference — relations, the short version</h1>\n' +
    refPara('Relations are the lines. In DDN every line is *typed*: it declares what kind of connection it is, and the drawing follows from that — dashed open arrows for dependencies, solid filled arrows for flows and control, crow’s feet for structural cardinality. You never draw an arrowhead by hand; you say what the connection *means*. Pick a family to browse all **' + REF_FACT('registry.totalRelations') + '** relation kinds:') +
    '<div class="ref-cards">' + cards + '</div>\n' +
    refPara(REFDATA.ROUTING_NOTE) +
    '<hr><p><small>Applies to DDN ' + VERSION + ' · wiki counterpart: <a href="' + WIKI_BASE + '/Ref-Relations-Home">Ref-Relations-Home</a>.</small></p>';
  writeOut('reference/relations.html', page('../', 'reference', 'Reference — relations — DDN', body,
    'All ' + REF_FACT('registry.totalRelations') + ' DDN relation kinds by family: line marks, meaning and working examples.'));
}

/* Landing page (Ref-Element-reference equivalent). */
{
  const kindCards = refKindPageList.map(p =>
    '<a href="' + p.file + '.html"><b>' + esc(p.title) + '</b><span>' + p.count + ' kinds</span></a>').join('\n');
  const relCards = refRelPageList.map(p =>
    '<a href="' + p.file + '.html"><b>' + esc(p.title) + '</b><span>' + p.count + ' relations</span></a>').join('\n');
  const body = REF_CSS + '\n<h1 class="page-title">Reference — every element kind and relation</h1>\n' +
    '<p class="lede">' + refInline('This is the complete shelf catalogue of DDN. Every **element kind** (the boxes and symbols you can place — **' + REF_FACT('registry.totalKinds') + '** of them) and every **relation** (the lines between them — **' + REF_FACT('registry.totalRelations') + '** of them) gets its symbol, a plain-language meaning, the extra information it accepts, and a small example you can paste into the [tool](../tools/index.html) as-is. Every example in this reference passes the tool’s own check and render steps.') + '</p>\n' +
    refPara('Why so many kinds? Because a diagram that says *exactly* what a thing is — a queue, not a box labelled "queue-ish" — never needs a footnote. You don’t need to know them all. Skim the family that matches your job, steal an example, and come back when you meet something new.') +
    '<h2>Element kinds by family</h2>\n<div class="ref-cards">' + kindCards + '</div>\n' +
    '<h2>Relations by family</h2>\n<div class="ref-cards">' + relCards + '</div>\n' +
    '<h2>Art packs — presentation illustrations</h2>\n' +
    refPara('Art packs are **not** kinds or relations — they are presentation *illustrations* (detailed artwork for slide-deck diagrams) bound to any node with `x_art`, and users looking for them often land here first. Browse every item with previews and a copyable reference in the [art pack viewer](../icons/art.html); stroke-symbol packs live in the [icon pack viewer](../icons/index.html). Installed art packs:') +
    '<div class="ref-cards">' + ART_PACKS.map(p => '<a href="../icons/art.html"><b>' + esc(p.name) + '</b><span><code>' + esc(p.id) + '</code> · ' + p.items.length + ' items · ' + esc(p.license) + '</span></a>').join('\n') + '</div>\n' +
    '<h2>How to read a kind page</h2>\n' +
    refPara('Each kind entry shows four things: **what it looks like** (the drawn symbol), **what it represents** (the idea, not the picture), **where it shows up** (the diagram types that use it), and **what you can add** (optional properties — labels, datatypes, keys, notes and so on). The examples are minimal on purpose: they pin nothing down, so DDN picks the layout and you see the kind’s own defaults.') +
    refPara('Style never changes meaning. A `table` drawn hand-drawn, neo, or plain is still a table — looks come from [styles](Guide-Layout-and-appearance), meaning comes from the kind.') +
    '<h2>Looking the other way</h2>\n' +
    refPara('If you know the *diagram* you want and need its symbols, start from the gallery instead — [every installed profile rendered](../gallery/index.html) — or the wiki’s [diagram type pages](' + 'Ref-Diagram-types' + ').') +
    '<hr><p><small>Applies to DDN ' + VERSION + ' · generated from the registry by <code>website/build-site.mjs</code> · wiki counterpart: <a href="' + WIKI_BASE + '/Ref-Element-reference">Ref-Element-reference</a>.</small></p>';
  writeOut('reference/index.html', page('../', 'reference', 'Reference — every element kind and relation — DDN', body,
    'The complete DDN shelf catalogue: all ' + REF_FACT('registry.totalKinds') + ' element kinds and ' + REF_FACT('registry.totalRelations') + ' relations with symbols, meanings and working examples, generated from the registry.'));
}


/* ---------------------------------------------------------------- manifest */

written.sort();
const manifest = {};
for (const rel of written) manifest[rel] = crypto.createHash('sha256').update(fs.readFileSync(path.join(OUT, rel))).digest('hex');
writeOut('.generated-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log('build-site: ' + written.length + ' files → ' + path.relative(REPO, OUT));
