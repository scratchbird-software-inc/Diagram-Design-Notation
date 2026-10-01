#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. B1-101 slice 3: assemble the
 * presentation-devices art pack from the reviewed candidates in
 * /tmp/art-candidates/ (see tools/fetch-art-candidates.mjs). For every
 * candidate: license-gate (CC0/Public domain only), sanitize through the
 * runtime rules, minify, compute the four side anchors from the viewBox,
 * attach per-item provenance, and write
 * standard/registry/art-packs/presentation-devices__1.json + index.json.
 *
 *   node tools/build-art-pack.mjs [--only id,id,...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeArt } from '../notation/runtime/ddn-icon-sanitize.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = '/tmp/art-candidates';
const OUTDIR = path.join(REPO, 'standard/registry/art-packs');
const PACK_ID = 'presentation-devices@1';
const LICENSE_MAP = [
  [/^CC0/i, 'CC0-1.0'],
  [/^Public domain/i, 'CC0-1.0'], // recorded as CC0-equivalent; upstream says PD
];
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);

function viewBox(svg) {
  const m = svg.match(/viewBox="([^"]+)"/);
  if (m) { const v = m[1].trim().split(/[\s,]+/).map(Number); if (v.length === 4 && v.every(Number.isFinite) && v[2] > 0 && v[3] > 0) return v; }
  const w = parseFloat((svg.match(/\bwidth="([\d.]+)/) || [])[1]), h = parseFloat((svg.match(/\bheight="([\d.]+)/) || [])[1]);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return [0, 0, w, h];
  return null;
}
function minify(svg) {
  return svg
    .replace(/<\?xml[^>]*>\s*/g, '')
    .replace(/<!DOCTYPE[^>]*>\s*/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<metadata[\s\S]*?<\/metadata>/g, '')
    .replace(/<sodipodi:namedview[\s\S]*?(?:\/>|<\/sodipodi:namedview>)/g, '')
    .replace(/<sodipodi:[a-z]+[\s\S]*?<\/sodipodi:[a-z]+>/g, '')
    /* Toolchain attributes leak the upstream author's local file paths
     * (sodipodi:docname="/home/…"); they carry no drawing information. */
    .replace(/\s(?:sodipodi|inkscape):[a-z-]+="[^"]*"/gi, '')
    .replace(/\sxmlns:(?:sodipodi|inkscape)="[^"]*"/gi, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    /* Inkscape/Illustrator exports carry absurd coordinate precision; one
     * decimal is indistinguishable at presentation scale and routinely
     * halves path-heavy files. */
    .replace(/-?\d+\.\d{3,}/g, m => String(Number(Number(m).toFixed(1))))
    .trim();
}

const metas = fs.readdirSync(SRC).filter(f => f.endsWith('.json')).sort();
const items = [], skipped = [];
for (const mf of metas) {
  const meta = JSON.parse(fs.readFileSync(path.join(SRC, mf), 'utf8'));
  const id = meta.id;
  if (only.length && !only.includes(id)) continue;
  const lic = LICENSE_MAP.find(([re]) => re.test(meta.license));
  if (!lic) { skipped.push(id + ' (license ' + meta.license + ')'); continue; }
  let svg = fs.readFileSync(path.join(SRC, id + '.svg'), 'utf8');
  svg = minify(svg);
  const vb = viewBox(svg);
  if (!vb) { skipped.push(id + ' (no viewBox/width+height)'); continue; }
  if (!svg.trimStart().startsWith('<svg')) { skipped.push(id + ' (root not svg)'); continue; }
  const probe = { id: PACK_ID }, item = { id, svg };
  let bad = sanitizeArt(probe, item);
  if (bad && /budget/.test(bad.error)) {
    /* Second-pass compression for path-heavy exports: integer coordinates
     * are what clipart natively uses; only attempted when the byte budget is
     * the sole failure. */
    svg = svg.replace(/-?\d+\.\d+/g, m => String(Math.round(Number(m))));
    item.svg = svg;
    bad = sanitizeArt(probe, item);
  }
  if (bad) { skipped.push(id + ' (' + bad.error + ')'); continue; }
  const [vx, vy, vw, vh] = vb, r = n => Number(n.toFixed(2));
  items.push({
    id,
    name: id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
    svg,
    anchors: {
      north: [r(vx + vw / 2), r(vy)],
      east: [r(vx + vw), r(vy + vh / 2)],
      south: [r(vx + vw / 2), r(vy + vh)],
      west: [r(vx), r(vy + vh / 2)],
    },
    tags: [id.split('-')[0]],
    provenance: {
      title: meta.title.replace(/^File:/, '').replace(/\.svg$/, ''),
      author: meta.artist || 'Wikimedia Commons contributor',
      license: lic[1],
      source: meta.url.split('?')[0],
      retrieved: meta.retrieved,
    },
  });
}

const pack = {
  format: 'ddn-art-pack@1',
  id: PACK_ID,
  name: 'Presentation devices and places (Wikimedia Commons CC0/PD selection)',
  version: '1.0.0',
  license: 'CC0-1.0',
  attribution: 'Individual Wikimedia Commons authors (per-item provenance); all items CC0 or public domain',
  source: 'https://commons.wikimedia.org/',
  note: 'Presentation-idiom illustrations (computers, servers, network gear, buildings, people), curated one per slot from Wikimedia Commons with license verification at curation time. Detailed artwork, not 24x24 stroke icons; side anchors are the viewBox edge midpoints.',
  items,
};
fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(path.join(OUTDIR, 'presentation-devices__1.json'), JSON.stringify(pack, null, 1) + '\n');
fs.writeFileSync(path.join(OUTDIR, 'index.json'), JSON.stringify({
  format: 'ddn-art-pack-index@1',
  note: 'Shipped art packs. Art packs are opt-in: hosts register them explicitly (registerArtPack / CLI --pack); they are never inlined into runtime bundles.',
  packs: ['presentation-devices__1.json'],
}, null, 2) + '\n');
console.log('pack items=' + items.length, 'skipped=' + skipped.length, 'bytes=' + JSON.stringify(pack).length);
for (const s of skipped) console.log('SKIPPED', s);
