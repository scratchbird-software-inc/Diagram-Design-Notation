/* SPDX-License-Identifier: GPL-2.0-or-later. B1-043 render worker bootstrap.
 * The build (tools/build-tool.js) concatenates the DDN runtime bundle in front
 * of this file, so the namespaces below are already published when it runs.
 * Protocol (D4 — one request, one batched response per render):
 *   ← {type:'init', registry, glyphs}          once, cached module state (D2)
 *   ← {type:'render', rev, ir, opts, needIR, metrics:{texts, roles, meta, vals}}
 *   → {type:'rendered', rev, ok:true, svg, scene, diagnostics, ir?, used, busyMs}
 *   → {type:'rendered', rev, ok:false, code, message}
 * metrics/used are packed tables: texts[] strings, roles[] font roles, and one
 * Float64Array triple per entry — meta: [size, roleIndex, weight], vals:
 * [width, ascent, descent]. Numeric indices + typed arrays only; DDN stable
 * ids stay inside ir/scene, which structured-clone carries.
 * Runs in browser dedicated workers (Blob URL) and node:worker_threads. */
(function () {
'use strict';
const ns = (globalThis.__DDN_MODULE_REGISTRY__ || {}).namespaces || {};
const Text = ns.DDNText, Engine = ns.DDNEngine;
if (!Text || !Engine) throw new Error('DDN render worker: runtime bundle did not publish DDNText/DDNEngine');

/* Port abstraction: browser worker globals vs node:worker_threads. */
const port = (() => {
  if (typeof importScripts === 'function' || (typeof window === 'undefined' && typeof self === 'object' && self && typeof self.postMessage === 'function'))
    return { post: (m, t) => self.postMessage(m, t), on: fn => { self.onmessage = e => fn(e.data); } };
  if (typeof require === 'function') try {
    const wt = require('node:worker_threads');
    if (wt && !wt.isMainThread && wt.parentPort) return { post: (m, t) => wt.parentPort.postMessage(m, t), on: fn => wt.parentPort.on('message', fn) };
  } catch { /* not a node worker */ }
  return null;
})();
if (!port) throw new Error('DDN render worker: no worker message port available');

let registry = null, glyphs = null;

/* Measurement (D3): dims are supplied INTO the worker as a pre-measured seed
 * table (verified on the main thread against its canvas); misses measure with
 * an OffscreenCanvas, which reports the same font metrics as the main-thread
 * canvas. With no canvas at all (node) the module's pinned cache + estimator
 * path is used — the seed is installed through setMetrics for exactly that. */
let canvas = null;
try { if (typeof OffscreenCanvas === 'function') canvas = new OffscreenCanvas(1, 1).getContext('2d'); } catch { /* no canvas in this worker */ }
const seededByStack = new Map();
if (canvas) Text.setProvider((s, size, stack, weight) => {
  s = String(s ?? '');
  const hit = seededByStack.get(JSON.stringify([s, +size, stack, weight]));
  if (hit) return { ...hit, method: 'browser-canvas' };
  canvas.font = weight + ' ' + size + 'px ' + stack;
  const m = canvas.measureText(s);
  return { width: m.width, ascent: m.actualBoundingBoxAscent || size * .85, descent: m.actualBoundingBoxDescent || size * .25, method: 'browser-canvas' };
}, 'browser-canvas');

/* Record every (text, size, role, weight) tuple measured during a render so
 * the main thread can verify them against its own canvas (D5 determinism)
 * and seed them forward. Text.measure is a namespace property; every runtime
 * module calls it through the shared namespace object, so wrapping here
 * covers all renderers. */
const origMeasure = Text.measure;
let collecting = null;
Text.measure = function (s, size = 14, font = 'sans', weight = 400) {
  const r = origMeasure(String(s ?? ''), size, font, weight);
  if (collecting) {
    const k = Text.key(s, size, font, weight);
    if (!collecting.seen.has(k)) {
      collecting.seen.add(k);
      let ri = collecting.roles.indexOf(font);
      if (ri < 0) { collecting.roles.push(font); ri = collecting.roles.length - 1; }
      collecting.texts.push(String(s ?? ''));
      collecting.meta.push(+size, ri, weight);
      collecting.vals.push(r.width, r.ascent, r.descent);
    }
  }
  return r;
};

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

function unpack(table) {
  const out = [], roles = (table && table.roles) || [];
  const texts = (table && table.texts) || [], meta = (table && table.meta) || [], vals = (table && table.vals) || [];
  for (let i = 0; i < texts.length; i++)
    out.push({ text: texts[i], size: meta[i * 3], role: roles[meta[i * 3 + 1]], weight: meta[i * 3 + 2], width: vals[i * 3], ascent: vals[i * 3 + 1], descent: vals[i * 3 + 2] });
  return out;
}

port.on(m => {
  if (!m || typeof m !== 'object') return;
  if (m.type === 'init') { registry = m.registry; glyphs = m.glyphs; port.post({ type: 'ready' }); return; }
  if (m.type !== 'render') return;
  const t0 = now();
  seededByStack.clear();
  const cacheSeed = Object.create(null);
  for (const e of unpack(m.metrics)) {
    cacheSeed[Text.key(e.text, e.size, e.role, e.weight)] = { width: e.width, ascent: e.ascent, descent: e.descent };
    seededByStack.set(JSON.stringify([e.text, e.size, Text.FONTS[e.role] || e.role, e.weight]), { width: e.width, ascent: e.ascent, descent: e.descent });
  }
  Text.setMetrics({ measurements: cacheSeed });
  collecting = { seen: new Set(), texts: [], roles: [], meta: [], vals: [] };
  try {
    const out = Engine.render(m.ir, registry, glyphs, m.opts || {});
    const used = { texts: collecting.texts, roles: collecting.roles, meta: new Float64Array(collecting.meta), vals: new Float64Array(collecting.vals) };
    port.post({
      type: 'rendered', rev: m.rev, ok: true, svg: out.svg, scene: out.scene, diagnostics: out.diagnostics || [],
      ...(m.needIR ? { ir: out._ir || m.ir } : {}), used, busyMs: now() - t0
    }, [used.meta.buffer, used.vals.buffer]);
  } catch (e) {
    port.post({ type: 'rendered', rev: m.rev, ok: false, code: (e && e.code) || 'ERROR', message: String((e && e.message) || e) });
  } finally { collecting = null; }
});
})();
