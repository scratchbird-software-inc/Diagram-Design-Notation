#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. B1-043: measure the worker render
 * boundary against the synchronous path on the medium-graph benchmark case
 * (32-node / 31-relation balanced tree, same generator as tools/benchmark.mjs),
 * on the CURRENT B1-042-optimized router.
 *
 *   node tools/benchmark-worker.mjs            # median of 9 iterations
 *   node tools/benchmark-worker.mjs --smoke    # one iteration
 *
 * Metrics per path:
 *   latencyMs      request-to-display: ws.render()/renderSync() wall time
 *   mainBusyMs     main thread blocked: sync = full render; worker = prepare +
 *                  metric verification + finalize (probe-measured), i.e. the
 *                  time the UI is actually unresponsive
 *   workerBusyMs   computation time inside the worker (worker-reported)
 *   maxProbeDelayMs  responsiveness proxy: worst delay of 1 ms timer probes
 *                  scheduled while the render is in flight
 *
 * Node note: node:worker_threads runs the worker on its own OS thread, so the
 * parallelism measured here matches what a browser gets; measurement itself is
 * the estimator on both sides (no DOM), which is exactly the D5 node equality
 * setup. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ITERATIONS = process.argv.includes('--smoke') ? 1 : 9;

const A = (await import(pathToFileURL(path.join(REPO, 'notation/dist/ddn.global.js')))).default;
const Text = globalThis.__DDN_MODULE_REGISTRY__.namespaces.DDNText;
const T = (await import(pathToFileURL(path.join(REPO, 'notation/tool/src/tool.js')))).default;

/* Same generator as tools/benchmark.mjs (medium-graph). */
function generatedTree(id, n, fan) {
  const lines = ['ddn "0.5";', 'module "bench.' + id + '";', '', 'data model {'];
  for (let i = 1; i <= n; i++) lines.push('    object n' + i + ' "Node ' + i + '" { kind: application; }');
  let rel = 0;
  for (let i = 2; i <= n; i++) lines.push('    relation r' + (++rel) + ' @n' + (Math.floor((i - 2) / fan) + 1) + ' -> @n' + i + ' { kind: flow; }');
  lines.push('}', '', 'view main "' + id + '" {', '    data: [@model];', '    layout { algorithm: tree; routing: orthogonal; }', '    publication { size: content; fit: none; }', '}', '');
  return { files: { 'main.ddn': lines.join('\n') }, entry: 'main.ddn', view: 'main' };
}
const CASE = generatedTree('medium', 32, 2);

/* 1 ms timer probes during the render: worst overshoot = main-thread stall. */
/* 1 ms timer probes during the render: worst overshoot = main-thread stall.
 * stop() keeps sampling ~12 ms past the call so a synchronous render's
 * backlog is captured too. */
function probes() {
  const delays = [];
  let on = true, t = performance.now();
  const arm = () => setTimeout(() => { const n = performance.now(); delays.push(n - t - 1); t = n; if (on) arm(); }, 1);
  arm();
  return { stop: () => new Promise(res => setTimeout(() => { on = false; res(Math.max(0, ...delays)); }, 12)) };
}
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

const workerSource = fs.readFileSync(path.join(REPO, 'notation/dist/ddn.global.js'), 'utf8') + '\n;\n' +
  fs.readFileSync(path.join(REPO, 'notation/tool/src/worker.js'), 'utf8');

const rows = { sync: [], worker: [] };
/* D2: one persistent worker with warm module state across all iterations —
 * exactly how the tool page reuses its worker across renders. */
const w = new Worker(workerSource, { eval: true });
const port = { postMessage: (m, t) => w.postMessage(m, t), terminate: () => w.terminate() };
w.on('message', m => port.onmessage && port.onmessage({ data: m }));
w.on('error', e => port.onerror && port.onerror(e));
let timing = null;
const bridge = T.createRenderBridge({ worker: port, measure: (t, s, r, wt) => Text.measure(t, s, r, wt), onTiming: t => { timing = t; } });
port.postMessage({ type: 'init', registry: A.engineAssets.registry, glyphs: A.engineAssets.glyphs });
await new Promise(r => { const h = m => { if (m && m.type === 'ready') { w.off('message', h); r(); } }; w.on('message', h); });
for (let i = 0; i < ITERATIONS; i++) {
  /* Sync path (fresh workspace: cold, cache-free like a first display). */
  {
    const ws = A.createWorkspace(CASE.files);
    const p = probes();
    const t0 = performance.now();
    const out = ws.renderSync({ entry: CASE.entry, view: CASE.view });
    const wall = performance.now() - t0;
    const maxProbe = await p.stop();
    rows.sync.push({ latencyMs: wall, mainBusyMs: wall, workerBusyMs: 0, maxProbeDelayMs: maxProbe, svgBytes: out.svg.length });
    ws.destroy();
  }
  /* Worker path (persistent worker + bridge, exactly the tool's wiring). */
  {
    A.setRenderBridge(bridge);
    const ws = A.createWorkspace(CASE.files);
    const p = probes();
    const t0 = performance.now();
    const out = await ws.render({ entry: CASE.entry, view: CASE.view });
    const wall = performance.now() - t0;
    const maxProbe = await p.stop();
    A.setRenderBridge(null);
    /* mainBusy = the non-worker part of the latency: prepare + post + verify +
     * finalize. workerBusyMs comes back in the batched response. */
    const mainBusy = Math.max(0, wall - (timing ? timing.workerBusyMs : 0));
    rows.worker.push({ latencyMs: wall, mainBusyMs: mainBusy, workerBusyMs: timing ? timing.workerBusyMs : NaN, maxProbeDelayMs: maxProbe, svgBytes: out.svg.length });
    if (out.svg.length !== rows.sync[rows.sync.length - 1].svgBytes) throw new Error('worker/sync SVG size mismatch');
    ws.destroy();
  }
}
await w.terminate();

const line = (name, r) => `| ${name} | ${median(r.map(x => x.latencyMs)).toFixed(1)} | ${median(r.map(x => x.mainBusyMs)).toFixed(1)} | ${median(r.map(x => x.workerBusyMs)).toFixed(1)} | ${median(r.map(x => x.maxProbeDelayMs)).toFixed(1)} | ${r[0].svgBytes} |`;
console.log('worker render benchmark — medium-graph (32 nodes / 31 relations, orthogonal tree), ' + ITERATIONS + ' iterations, median');
console.log('| path | latency ms | main-busy ms | worker-busy ms | max probe delay ms | svg bytes |');
console.log('|---|---|---|---|---|---|');
console.log(line('sync (renderSync)', rows.sync));
console.log(line('worker (render + bridge)', rows.worker));
