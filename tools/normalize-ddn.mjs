#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later
 * B1-021 corpus normalizer (D2). Zero-dependency Node ESM; uses the runtime
 * sources directly (notation/runtime is ESM). For every .ddn file:
 *   - bumps legacy source headers (0.2/0.3/0.4) to the newest dialect (0.5);
 *   - removes declaration properties whose value equals the effective default
 *     (global DEFAULTS in ddn-core, merged through the view's format bundle and
 *     referenced profile declarations, incl. the layout.center pinned-pattern
 *     fallback) — conservative: refs, arrays and records are never stripped;
 *   - drops dead empty group blocks;
 *   - keeps default-equal properties that are the file's evident purpose
 *     (D3 keep-vs-strip heuristic, every keep is logged).
 * Never touches data semantics (data/field/relation/sample values are content).
 *
 * Modes:
 *   node tools/normalize-ddn.mjs [paths...]            write mode (default: repo corpus)
 *   node tools/normalize-ddn.mjs --check [paths...]    exit 1 when any file would change
 *   node tools/normalize-ddn.mjs --verify [paths...]   write + render every view before/after,
 *                                                      report byte-identical vs changed renders
 *   --report FILE   JSON stats (pins removed by type, keeps, bytes, renders)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import DDN from '../notation/runtime/ddn-core.js';
import Render from '../notation/runtime/ddn-full.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NEWEST = '0.5';
const GROUP_TYPES = Object.keys(DDN.DEFAULTS); // projection, notation, style, layout, display, publication, legend, validation, export

/* D3 keep-vs-strip: when the file's evident purpose is demonstrating a
 * property axis (filename / view id / view title keyword), the property is
 * content and is KEPT even when default-equal. */
const KEEP_RULES = [
  [/routing|route|curve/i, ['layout.routing', 'layout.curve', 'layout.curve_tension', 'layout.curve_radius', 'layout.crossings']],
  [/look|theme|palette|font|handdrawn|css/i, ['style.look', 'style.theme', 'style.font', 'style.font_size', 'style.roughness', 'style.hachure']],
  [/layout|placement|algorithm/i, ['layout.algorithm', 'layout.direction', 'layout.center', 'layout.columns', 'layout.optimize', 'layout.endpoint_ordering', 'layout.frame_overflow']],
  [/spacing/i, ['spacing', 'layout.gap', 'layout.row_gap', 'layout.object_clearance', 'layout.edge_clearance', 'layout.port_clearance', 'layout.grid_step']],
  [/legend/i, ['legend.mode', 'legend.placement', 'legend.width']],
  [/publication|print|export/i, ['publication.size', 'publication.width', 'publication.height', 'publication.margin', 'publication.fit', 'publication.orientation']],
  [/display|fields|compact/i, ['display.fields', 'display.kind', 'display.maturity', 'display.badges', 'display.relations', 'display.samples', 'display.domains', 'display.datatypes', 'display.depth']],
  [/projection|chart|radar|funnel|gauge|candlestick|treemap|sankey|matrix|table|timeline|fishbone|decision|sequence|timing|chen|panels/i, ['projection.kind', 'projection.profile']],
];

const args = process.argv.slice(2);
const opt = { check: args.includes('--check'), verify: args.includes('--verify'), verbose: args.includes('--verbose'), report: null };
const ri = args.indexOf('--report');
if (ri >= 0) opt.report = args[ri + 1];
const paths = args.filter((a, i) => !a.startsWith('--') && (ri < 0 || i !== ri + 1));

function collect(inputs) {
  const out = [];
  for (const input of inputs.length ? inputs : ['website/examples', 'website/gallery/src']) {
    const abs = path.resolve(ROOT, input);
    const stat = fs.statSync(abs);
    if (stat.isFile()) { if (abs.endsWith('.ddn')) out.push(abs); continue; }
    const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(p); } else if (e.name.endsWith('.ddn')) out.push(p); } };
    walk(abs);
  }
  return [...new Set(out)];
}

/* Load a file plus its transitive imports (same rules as the CLI), returning
 * the files map keyed by workspace-relative posix path. */
function loadWorkspace(abs) {
  const root = path.dirname(abs), entry = path.basename(abs), files = {}, visited = new Set();
  const load = name => {
    if (visited.has(name)) return; visited.add(name);
    const text = fs.readFileSync(path.join(root, name), 'utf8');
    files[name] = text;
    for (const imp of DDN.parse(text, name).imports) load(path.posix.normalize(path.posix.join(path.posix.dirname(name), imp.path)));
  };
  load(entry);
  return { files, entry };
}

const canon = v => JSON.stringify(v, (k, x) => {
  if (x && typeof x === 'object' && !Array.isArray(x)) return Object.fromEntries(Object.keys(x).sort().map(k2 => [k2, x[k2]]));
  return x;
});
const scalar = v => v === null || ['string', 'number', 'boolean'].includes(typeof v) || (v && typeof v === 'object' && Number.isFinite(v.$quantity));
const isRef = v => v && typeof v === 'object' && v.$ref;

/* Effective default for group type T key K in a view, honouring the format
 * bundle and the referenced profile declaration (mirrors ddn-core build). */
function chainValue(ws, view, T, K, groupProps) {
  let base = DDN.DEFAULTS[T] ? DDN.DEFAULTS[T][K] : undefined;
  let bundle = null;
  try {
    if (isRef(view.props.format)) { const b = ws.resolve(view.props.format, view); if (b.type === 'bundle') bundle = b; }
    const r = view.props[T] || (bundle && bundle.props[T]);
    if (isRef(r)) { const def = ws.resolve(r, view.props[T] ? view : bundle); if (def && Object.hasOwn(def.props, K)) base = def.props[K]; }
  } catch { return undefined; }
  if (T === 'layout' && K === 'center') {
    // Omitted centre follows the pinned-pattern policy (ddn-core build).
    let specified = false, algorithm = 'auto';
    try {
      const r = view.props.layout || (bundle && bundle.props.layout);
      if (isRef(r)) { const def = ws.resolve(r, view.props.layout ? view : bundle); if (def) { specified = Object.hasOwn(def.props, 'center'); if (def.props.algorithm) algorithm = def.props.algorithm; } }
    } catch { /* keep */ }
    if (groupProps && Object.hasOwn(groupProps, 'algorithm')) algorithm = groupProps.algorithm;
    if (!specified && ['auto', 'fit_grid', 'circular', 'radial', 'spanning_tree', 'organic'].includes(algorithm)) base = 'pins';
  }
  return base;
}

function keepReason(file, view, dotted) {
  const hay = path.basename(file, '.ddn') + ' ' + (view ? (view.id || '') + ' ' + (view.label || '') : '');
  for (const [re, props] of KEEP_RULES) if (props.includes(dotted) && re.test(hay)) return 'demonstrates ' + dotted + ' (matched ' + re + ')';
  return null;
}

/* Property entries of a declaration body at brace depth 0, with text spans. */
function propEntries(text, tokens, node) {
  const entries = [];
  let i = tokens.findIndex(t => t.start >= node.bodyStart);
  let depth = 0;
  for (; i < tokens.length && tokens[i].start < node.bodyEnd; i++) {
    const t = tokens[i];
    if (t.type === '{' || t.type === '[') depth++;
    else if (t.type === '}' || t.type === ']') depth--;
    else if (depth === 0 && t.type === 'id' && tokens[i + 1] && tokens[i + 1].type === ':') {
      let j = i + 2, d2 = 0;
      while (j < tokens.length) {
        const u = tokens[j];
        if (u.type === '{' || u.type === '[') d2++;
        else if (u.type === '}' || u.type === ']') d2--;
        else if (d2 === 0 && u.type === ';') break;
        j++;
      }
      if (j >= tokens.length) break;
      entries.push({ key: t.value, start: t.start, end: tokens[j].end, value: node.props[t.value] });
      i = j;
    }
  }
  return entries;
}

/* Delete [start,end); swallow trailing inline whitespace; when the statement
 * owns its line, drop the whole line. */
function lineSpan(text, start, end) {
  let s = start, e = end;
  const before = text.slice(text.lastIndexOf('\n', start - 1) + 1, start);
  const ownLine = /^\s*$/.test(before);
  if (ownLine) s = start - before.length;
  let k = end;
  while (k < text.length && (text[k] === ' ' || text[k] === '\t')) k++;
  if (text[k] === '\n') { if (ownLine) e = k + 1; }
  else e = k;
  return [s, e];
}

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'standard/registry/catalogue.json'), 'utf8'));
const glyphDefs = fs.readFileSync(path.join(ROOT, 'standard/registry/glyph-library.svg'), 'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];

function renderViews(abs, textOverride) {
  const { files, entry } = loadWorkspace(abs);
  if (textOverride !== undefined) files[entry] = textOverride;
  const ast = DDN.parse(files[entry], entry);
  const views = ast.declarations.filter(n => n.type === 'view');
  const out = new Map();
  for (const v of views) {
    const { ir } = DDN.build(files, entry, v.id, registry);
    out.set(v.id, Render.render(ir, registry, glyphDefs).svg);
  }
  return out;
}

function normalizeFile(abs) {
  const original = fs.readFileSync(abs, 'utf8');
  const stats = { pins: {}, keeps: [], header: false, emptyBlocks: 0, collapsed: 0, errors: [] };
  const bump = (type, key) => { const k = type + '.' + key; stats.pins[k] = (stats.pins[k] || 0) + 1; };

  let ws = null;
  const getWs = () => { if (!ws) { const { files, entry } = loadWorkspace(abs); ws = DDN.createWorkspace(files, entry); } return ws; };

  let text = original;
  // Fixpoint: stripping props can empty a group block; empty view override
  // groups are dropped and empty profile-declaration bodies collapse to `;`.
  for (let iter = 0; iter < 4; iter++) {
    const ast = DDN.parse(text, abs);
    const tokens = DDN.lex(text, abs);
    const edits = [];

    if (iter === 0 && ast.version !== NEWEST) {
      const vtok = tokens.find(t => t.type === 'string');
      edits.push({ start: vtok.start + 1, end: vtok.end - 1, text: NEWEST });
      stats.header = ast.version + '->' + NEWEST;
    }

    const visit = (node, view) => {
      const isProfileDecl = !node.group && GROUP_TYPES.includes(node.type);
      const isViewGroup = node.group && GROUP_TYPES.includes(node.type) && view;
      const empty = !Object.keys(node.props).length && !node.children.length;
      if (isViewGroup && empty) {
        const [s, e] = lineSpan(text, node.start, node.end);
        edits.push({ start: s, end: e, text: '' });
        stats.emptyBlocks++;
        return;
      }
      if (isProfileDecl && empty && node.bodyStart !== undefined) {
        // `notation core { }` -> `notation core;` (declaration stays referable).
        const close = node.bodyEnd + 1;
        let open = node.bodyStart - 1;
        while (open > node.start && (text[open - 1] === ' ' || text[open - 1] === '\t')) open--;
        const rest = text.slice(close).match(/^\s*/)[0];
        const hasSemi = text.slice(close + rest.length).startsWith(';');
        edits.push({ start: open, end: close, text: hasSemi ? '' : ';' });
        stats.collapsed++;
        return;
      }
      if ((isProfileDecl || isViewGroup) && node.bodyStart !== undefined) {
        const groupProps = node.props;
        for (const p of propEntries(text, tokens, node)) {
          const dotted = node.type + '.' + p.key;
          if (!scalar(p.value) || isRef(p.value)) continue;              // conservative: content/complex values stay
          if (!Object.hasOwn(DDN.DEFAULTS[node.type] || {}, p.key)) continue;
          let eff;
          if (isProfileDecl) eff = DDN.DEFAULTS[node.type][p.key];
          else eff = chainValue(getWs(), view, node.type, p.key, groupProps);
          if (eff === undefined || !scalar(eff) || canon(eff) !== canon(p.value)) continue;
          const keep = keepReason(abs, isViewGroup ? view : null, dotted);
          if (keep) { stats.keeps.push(dotted + ' @ ' + (view ? view.id : node.id) + ': ' + keep); continue; }
          const [s, e] = lineSpan(text, p.start, p.end);
          edits.push({ start: s, end: e, text: '' });
          bump(node.type, p.key);
        }
      }
      if (node.type === 'view' && node.bodyStart !== undefined) {
        for (const p of propEntries(text, tokens, node)) {
          if (p.key !== 'spacing' || p.value !== 'normal') continue;
          const keep = keepReason(abs, node, 'spacing');
          if (keep) { stats.keeps.push('spacing @ ' + node.id + ': ' + keep); continue; }
          const [s, e] = lineSpan(text, p.start, p.end);
          edits.push({ start: s, end: e, text: '' });
          bump('view', 'spacing');
        }
      }
      for (const c of node.children) visit(c, node.type === 'view' ? node : view);
    };
    for (const n of ast.declarations) visit(n, null);

    if (!edits.length) break;
    edits.sort((a, b) => b.start - a.start);
    for (const e of edits) text = text.slice(0, e.start) + e.text + text.slice(e.end);
  }
  try { DDN.parse(text, abs); } catch (err) { stats.errors.push('normalized text does not parse: ' + err.message); return { file: abs, changed: false, stats, before: original.length, after: original.length }; }
  return { file: abs, changed: text !== original, stats, before: original.length, after: text.length, text };
}

const isMain = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1])) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const files = isMain ? collect(paths.map(p => path.relative(ROOT, path.resolve(p)) || '.')) : [];
const results = [];
let wouldChange = 0, rendersIdentical = 0, rendersChanged = 0;
for (const abs of files) {
  let r;
  try { r = normalizeFile(abs); }
  catch (err) { results.push({ file: abs, changed: false, stats: { pins: {}, keeps: [], errors: [err.message] }, before: 0, after: 0 }); continue; }
  results.push(r);
  if (!r.changed) continue;
  wouldChange++;
  if (opt.verify && !opt.check) {
    let before, after;
    try { before = renderViews(abs); after = renderViews(abs, r.text); }
    catch (err) { r.stats.errors.push('verify render failed: ' + err.message); continue; }
    r.renders = {};
    for (const [v, svg] of before) {
      const same = after.get(v) === svg;
      r.renders[v] = same ? 'identical' : 'CHANGED';
      if (same) rendersIdentical++; else rendersChanged++;
    }
  }
  if (!opt.check) fs.writeFileSync(abs, r.text, 'utf8');
}

if (isMain) {
const sum = (f) => results.reduce((a, r) => a + f(r), 0);
const pinsByType = {};
for (const r of results) for (const [k, n] of Object.entries(r.stats.pins || {})) pinsByType[k] = (pinsByType[k] || 0) + n;
const summary = {
  files: results.length,
  filesChanged: wouldChange,
  bytesBefore: sum(r => r.before),
  bytesAfter: sum(r => r.after),
  pinsByType,
  keeps: [...new Set(results.flatMap(r => (r.stats.keeps || []).map(k => path.relative(ROOT, r.file) + ': ' + k)))],
  headersBumped: results.filter(r => r.stats.header).length,
  emptyBlocksDropped: sum(r => r.stats.emptyBlocks || 0),
  rendersIdentical, rendersChanged,
  errors: results.flatMap(r => (r.stats.errors || []).map(e => path.relative(ROOT, r.file) + ': ' + e)),
  changedFiles: results.filter(r => r.changed).map(r => ({ file: path.relative(ROOT, r.file), before: r.before, after: r.after, renders: r.renders })),
};
if (opt.report) fs.writeFileSync(opt.report, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, changedFiles: summary.changedFiles.length + ' files' }, null, 2));
if (opt.verbose) for (const r of results.filter(r => r.changed)) console.log(path.relative(ROOT, r.file), r.before, '->', r.after, r.renders ? JSON.stringify(r.renders) : '');
if (opt.check && wouldChange) { console.error('normalize-ddn --check: ' + wouldChange + ' file(s) are not minimal'); process.exitCode = 1; }
if (summary.errors.length) process.exitCode = 2;
}

export { normalizeFile, collect };
