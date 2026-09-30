#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. B1-099: semantic-equivalence gate
 * for modernized .ddn examples. For each entry file it builds the OLD tree
 * (git HEAD content for files changed in the worktree, disk for the rest of
 * the import closure) and the NEW tree (worktree), then compares every view
 * declared in the entry:
 *
 *   - DDN.semanticJSON(ir) deep-equal   (canonical model, modulo source locs)
 *   - Render SVG byte-identical
 *   - validation diagnostics identical  (severity:code:message, in order)
 *
 * Usage: node tools/check-example-equivalence.mjs FILE…   (exit 1 on any diff)
 */
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const REPO = path.resolve(new URL('..', import.meta.url).pathname);
const DDN = require(path.join(REPO, 'notation/runtime/ddn-core.js')).default;
const Render = require(path.join(REPO, 'notation/runtime/ddn-render.js')).default;
const A = require(path.join(REPO, 'notation/dist/ddn.global.js'));
require(path.join(REPO, 'notation/dist/ddn-graph.js'));
require(path.join(REPO, 'notation/dist/ddn-iso.js'));
require(path.join(REPO, 'notation/dist/ddn-geo.js'));
try {
  const asset = path.join(REPO, 'assets/geo/world-110m.json');
  if (fs.existsSync(asset) && globalThis.DDNGeo) {
    const g = fs.readFileSync(asset, 'utf8');
    globalThis.DDNGeo.registerGeography('assets/geo/world-110m.json', g);
    globalThis.DDNGeo.registerGeography('world-110m', g);
  }
} catch {}
const reg = JSON.parse(fs.readFileSync(path.join(REPO, 'standard/registry/catalogue.json'), 'utf8'));
const defs = fs.readFileSync(path.join(REPO, 'standard/registry/glyph-library.svg'), 'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];

function gitShow(rel) {
  try { return cp.execFileSync('git', ['show', 'HEAD:' + rel], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return null; } // new file (no HEAD version)
}

/* Import-closure loader mirroring the guide builder's filesFor, with an
 * optional content override map (for the OLD tree). */
function closure(entry, overrides) {
  const files = {};
  const read = name => Object.hasOwn(overrides, name) ? overrides[name] : fs.readFileSync(path.join(REPO, name), 'utf8');
  const visit = name => {
    if (Object.hasOwn(files, name)) return;
    files[name] = read(name);
    const ast = A.parse(files[name], name);
    for (const imp of ast.imports) visit(A.resolvePath(name, imp.path));
    const walk = n => {
      if (n.type === 'architecture') for (const f of (n.props && n.props.files) || []) visit(A.resolvePath(name, f));
      if (n.props && n.props.x_link && n.props.x_link.file) visit(A.resolvePath(name, n.props.x_link.file));
      for (const c of n.children || []) walk(c);
    };
    for (const sec of ast.sections || []) for (const d of sec.declarations || []) walk(d);
  };
  visit(entry);
  return files;
}

function viewsOf(files, entry) {
  const views = [];
  const walk = n => { if (n.type === 'view') views.push(n.id); for (const c of n.children || []) walk(c); };
  for (const name of Object.keys(files)) {
    const ast = A.parse(files[name], name);
    for (const sec of ast.sections || []) for (const d of sec.declarations || []) walk(d);
  }
  return views;
}

function diag(ir) { return (ir.diagnostics || []).map(d => d.severity + ':' + d.code + ':' + d.message); }

/* Canonical parse-AST comparison, modulo source locations: the 0.7 parser
 * desugars compact forms to the identical canonical declaration AST, so
 * lossless rewrites must produce equal trees after stripping positions. */
function stripLocs(n) {
  if (Array.isArray(n)) return n.map(stripLocs);
  if (n && typeof n === 'object') {
    // View declarations: the compact-header desugar is marked in the AST
    // (headerProjection flag, data/projection child order); view semantics are
    // proven by the build-level gate (semanticJSON + SVG + diagnostics).
    if (n.type === 'view') return { type: 'view', id: n.id, label: n.label };
    const o = {};
    for (const k of Object.keys(n).sort()) {
      if (['start', 'end', 'source', 'bodyStart', 'bodyEnd', 'offset', '$offset', 'line', 'column', 'text'].includes(k)) continue;
      o[k] = stripLocs(n[k]);
    }
    return o;
  }
  return n;
}
function parseEqual(oldFiles, newFiles) {
  const names = [...new Set([...Object.keys(oldFiles), ...Object.keys(newFiles)])];
  for (const name of names) {
    if (!Object.hasOwn(oldFiles, name) || !Object.hasOwn(newFiles, name)) return 'file set differs at ' + name;
    const a = JSON.stringify(stripLocs(A.parse(oldFiles[name], name)));
    const b = JSON.stringify(stripLocs(A.parse(newFiles[name], name)));
    if (a !== b) return 'canonical AST differs in ' + name;
  }
  return null;
}

let failures = 0;
for (const f of process.argv.slice(2).filter(a => !a.startsWith('--'))) {
  const rel = path.relative(REPO, path.resolve(f));
  const oldText = gitShow(rel);
  const newText = fs.readFileSync(path.join(REPO, rel), 'utf8');
  if (oldText === null) { console.log('SKIP ' + rel + ' (new file, no HEAD baseline)'); continue; }
  if (oldText === newText) { console.log('SAME ' + rel); continue; }
  // overrides: every worktree file differs-from-HEAD inside the closure
  const overrides = { [rel]: oldText };
  const newFiles = closure(rel, {});
  for (const name of Object.keys(newFiles)) {
    if (name === rel) continue;
    const head = gitShow(name);
    if (head !== null && head !== newFiles[name]) overrides[name] = head;
  }
  const oldFiles = closure(rel, overrides);
  const views = viewsOf(newFiles, rel);
  let ok = true;
  const astDiff = parseEqual(oldFiles, newFiles);
  if (astDiff) { console.log('DIFF ' + rel + ': ' + astDiff); ok = false; }
  for (const view of views) {
    let a, b;
    try { a = DDN.build(oldFiles, rel, view, reg); } catch (e) { console.log('DIFF ' + rel + '#' + view + ': OLD tree fails to build: ' + e.code + ' ' + e.message.slice(0, 80)); ok = false; continue; }
    try { b = DDN.build(newFiles, rel, view, reg); } catch (e) { console.log('DIFF ' + rel + '#' + view + ': NEW tree fails to build: ' + e.code + ' ' + e.message.slice(0, 80)); ok = false; continue; }
    try {
      const sa = DDN.semanticJSON(a.ir), sb = DDN.semanticJSON(b.ir);
      if (JSON.stringify(sb) !== JSON.stringify(sa)) { console.log('DIFF ' + rel + '#' + view + ': semanticJSON'); ok = false; continue; }
      const da = diag(a.ir), db = diag(b.ir);
      if (JSON.stringify(db) !== JSON.stringify(da)) { console.log('DIFF ' + rel + '#' + view + ': diagnostics'); ok = false; continue; }
      const ra = Render.render(a.ir, reg, defs).svg, rb = Render.render(b.ir, reg, defs).svg;
      if (rb !== ra) { console.log('DIFF ' + rel + '#' + view + ': SVG bytes'); ok = false; continue; }
    } catch (e) { console.log('DIFF ' + rel + '#' + view + ': compare failed ' + (e.code || '') + ' ' + e.message.slice(0, 80)); ok = false; }
  }
  if (ok) console.log('EQUIV ' + rel + ' (' + views.length + ' views)');
  else failures++;
}
process.exit(failures ? 1 : 0);
