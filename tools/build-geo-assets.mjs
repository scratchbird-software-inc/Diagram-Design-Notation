#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. B1-025 (D2): build assets/geo/world-110m.json.
 * Downloads the public-domain Natural Earth 110m country boundaries (via the
 * world-atlas TopoJSON mirror), decodes the topology to plain GeoJSON
 * (FeatureCollection; Polygon/MultiPolygon only), rounds coordinates to the
 * source's own 0.01-degree grid, and enforces the documented ~100KB budget.
 * Deterministic given the pinned upstream URL; run manually, output committed. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_SRC = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const OUT = path.join(root, 'assets/geo/world-110m.json');
const BUDGET = 115 * 1024; // ~100KB budget with headroom; enforced below

/* Minimal TopoJSON -> GeoJSON decoder (Polygon/MultiPolygon geometries with
 * quantized integer arcs and a translate/scale transform). Build-time only. */
function decode(topo) {
  const { transform, arcs } = topo;
  /* 110m source grid is 0.01°; we publish at 0.1° (≈11 km) with consecutive
   * duplicates dropped — the ~100KB asset budget is part of the contract. */
  const decoded = arcs.map(arc => {
    let x = 0, y = 0;
    const pts = [];
    for (const [dx, dy] of arc) {
      x += dx; y += dy;
      const p = [
        Math.round((x * transform.scale[0] + transform.translate[0]) * 10) / 10,
        Math.round((y * transform.scale[1] + transform.translate[1]) * 10) / 10,
      ];
      const last = pts[pts.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
    }
    return pts;
  });
  /* Douglas-Peucker at 0.2° keeps the overview shapes inside the asset budget. */
  const dp = pts => {
    if (pts.length <= 4) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      const [ax, ay] = pts[a], [bx, by] = pts[b];
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      let max = 0, mi = -1;
      for (let i = a + 1; i < b; i++) {
        const [px, py] = pts[i];
        const d = len2 ? Math.abs((py - ay) * dx - (px - ax) * dy) / Math.sqrt(len2) : Math.hypot(px - ax, py - ay);
        if (d > max) { max = d; mi = i; }
      }
      if (max > 0.2 && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  };
  const ring = inds => {
    const pts = [];
    for (const i of inds) {
      const arc = i >= 0 ? decoded[i] : decoded[~i].slice().reverse();
      for (let j = pts.length ? 1 : 0; j < arc.length; j++) pts.push(arc[j]);
    }
    return dp(pts);
  };
  const polygon = arcs => arcs.map(ring);
  const features = topo.objects.countries.geometries.map(g => ({
    type: 'Feature',
    id: g.id,
    properties: { name: g.properties?.name ?? '' },
    geometry: g.type === 'Polygon'
      ? { type: 'Polygon', coordinates: polygon(g.arcs) }
      : { type: 'MultiPolygon', coordinates: g.arcs.map(polygon) },
  }));
  return { type: 'FeatureCollection', features };
}

const res = await fetch(URL_SRC);
if (!res.ok) throw new Error('fetch failed: ' + res.status + ' ' + URL_SRC);
const geo = decode(await res.json());
const text = JSON.stringify(geo) + '\n';
if (Buffer.byteLength(text) > BUDGET)
  throw new Error('world-110m.json exceeds the ~100KB asset budget: ' + Buffer.byteLength(text) + ' bytes');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, text);
console.log('assets/geo/world-110m.json:', geo.features.length, 'features,', Buffer.byteLength(text), 'bytes (budget ' + BUDGET + ')');
