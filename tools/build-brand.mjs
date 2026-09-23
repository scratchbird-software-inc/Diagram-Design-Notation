#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. B1-020 (D1): ScratchWeaver brand asset pipeline.
 *
 *   node tools/build-brand.mjs            # write generated files into assets/brand/
 *   DDN_BRAND_OUT=DIR node tools/build-brand.mjs   # write into DIR (freshness test)
 *
 * Regenerates assets/brand/ from the Sandbox brand sources:
 *   - scratchweaver.svg  — the `ScratchWeaverLogo` group of ScratchBirdLogos.svg,
 *                          extracted into a standalone, self-contained SVG with a
 *                          viewBox synthesized from the path extents
 *   - favicon.svg        — the same logo for browser tab icons
 *   - scratchweaver.png  — the 1164x1234 product logo, copied verbatim
 *   - favicon-32.png / favicon-64.png — rasterized from scratchweaver.svg
 *                          (rsvg-convert, inkscape, or ImageMagick, first found)
 *
 * Deterministic: fixed inputs, no timestamps. Node, no dependencies (the PNG
 * rasterizer shells out to a system tool, like tools/build-schemas.py uses python).
 */
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.DDN_BRAND_OUT ? path.resolve(process.env.DDN_BRAND_OUT) : path.join(REPO, 'assets/brand');
const SRC_SVG = '/home/dcalford/Sandbox/ScratchBirdLogos.svg';
const SRC_PNG = '/home/dcalford/Sandbox/ScratchWeaver.png';

for (const src of [SRC_SVG, SRC_PNG]) {
  if (!fs.existsSync(src)) throw new Error('brand source missing: ' + src);
}
const src = fs.readFileSync(SRC_SVG, 'utf8');

/* ------------------------------------------------- extract the logo group */
const labelIdx = src.indexOf('inkscape:label="ScratchWeaverLogo"');
if (labelIdx < 0) throw new Error('ScratchWeaverLogo group not found in ' + SRC_SVG);
const gStart = src.lastIndexOf('<g', labelIdx);
if (gStart < 0) throw new Error('opening <g for ScratchWeaverLogo not found');
let depth = 0, gEnd = -1;
for (const m of src.slice(gStart).matchAll(/<g[\s>]|<\/g>/g)) {
  depth += m[0].startsWith('</') ? -1 : 1;
  if (depth === 0) { gEnd = gStart + m.index + m[0].length; break; }
}
if (gEnd < 0) throw new Error('unbalanced <g> nesting around ScratchWeaverLogo');
let group = src.slice(gStart, gEnd);

// Strip inkscape/sodipodi cruft (label attributes and editor namespaces).
group = group.replace(/\s+inkscape:[a-z-]+="[^"]*"/gi, '').replace(/\s+sodipodi:[a-z-]+="[^"]*"/gi, '');

/* --------------------------------- synthesize a viewBox from path extents */
// Minimal path-data walker: tracks the current point through absolute/relative
// commands and records every coordinate pair (control points included; a
// slightly generous box is harmless). Arc endpoints only — radii/rotation args
// are skipped by arity.
const ARITY = { m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0 };
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
function record(x, y) {
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
}
for (const d of group.matchAll(/\sd="([^"]+)"/g)) {
  const tokens = d[1].match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let i = 0, cmd = '', cx = 0, cy = 0;
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd.toLowerCase() === 'z') { cmd = ''; continue; }
    const lower = cmd.toLowerCase(), rel = cmd === lower; // lowercase commands are relative
    const n = ARITY[lower];
    if (n === undefined) throw new Error('unsupported path command: ' + cmd);
    const args = tokens.slice(i, i + n).map(Number); i += n;
    const ax = k => rel ? cx + args[k] : args[k];
    const ay = k => rel ? cy + args[k] : args[k];
    if (lower === 'h') { cx = ax(0); record(cx, cy); }
    else if (lower === 'v') { cy = ay(0); record(cx, cy); }
    else {
      // record interior coordinate pairs (control points), then the endpoint
      const pairs = lower === 'a' ? [] : lower === 'c' ? [[0, 1], [2, 3]] : lower === 's' || lower === 'q' ? [[0, 1]] : [];
      for (const [px, py] of pairs) record(ax(px), ay(py));
      const [ex, ey] = lower === 'a' ? [n - 2, n - 1] : [n - 2, n - 1];
      cx = ax(ex); cy = ay(ey); record(cx, cy);
      if (lower === 'm') cmd = rel ? 'l' : 'L'; // implicit lineto after moveto
    }
  }
}
if (!isFinite(minX)) throw new Error('no path geometry found in ScratchWeaverLogo group');
// Pad by a couple of units so 1px strokes on the white detail paths are not clipped.
const pad = 2;
const fmt = n => String(Math.round(n * 100) / 100);
const viewBox = [fmt(minX - pad), fmt(minY - pad), fmt(maxX - minX + 2 * pad), fmt(maxY - minY + 2 * pad)].join(' ');

const logoSvg = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<!-- SPDX-License-Identifier: GPL-2.0-or-later. ScratchWeaver logo, extracted from the\n' +
  '     ScratchBirdLogos.svg ScratchWeaverLogo group by tools/build-brand.mjs. -->\n' +
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '">\n' + group + '\n</svg>\n';

/* ------------------------------------------------------------------ write */
fs.mkdirSync(OUT, { recursive: true });
const write = (rel, content) => fs.writeFileSync(path.join(OUT, rel), content);
write('scratchweaver.svg', logoSvg);
write('favicon.svg', logoSvg);
fs.copyFileSync(SRC_PNG, path.join(OUT, 'scratchweaver.png'));

/* ----------------------------------------------- rasterize the PNG icons */
const rasterizer = ['rsvg-convert', 'inkscape', 'convert'].find(c =>
  cp.spawnSync('which', [c], { stdio: 'pipe' }).status === 0);
if (!rasterizer) throw new Error('no SVG rasterizer found (need rsvg-convert, inkscape, or convert)');
for (const size of [32, 64]) {
  const out = path.join(OUT, 'favicon-' + size + '.png');
  if (rasterizer === 'rsvg-convert') {
    cp.execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', out, path.join(OUT, 'scratchweaver.svg')], { stdio: 'pipe' });
  } else if (rasterizer === 'inkscape') {
    cp.execFileSync('inkscape', [path.join(OUT, 'scratchweaver.svg'), '-w', String(size), '-h', String(size), '-o', out], { stdio: 'pipe' });
  } else {
    cp.execFileSync('convert', ['-background', 'none', path.join(OUT, 'scratchweaver.svg'), '-resize', size + 'x' + size, out], { stdio: 'pipe' });
  }
}
console.log('build-brand: 5 files → ' + path.relative(REPO, OUT) + ' (viewBox ' + viewBox + ', rasterizer ' + rasterizer + ')');
