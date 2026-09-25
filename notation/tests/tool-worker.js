/* SPDX-License-Identifier: GPL-2.0-or-later. B1-043: worker-based rendering in
 * the unified tool (D1-D8). Covers the host-agnostic bridge (packed metrics
 * round-trip, stale-revision discard, degrade-to-sync fallback) and the real
 * coarse boundary end to end in node:worker_threads — the runtime is
 * worker-capable there, and with the estimator measurement path both sides
 * are deterministic, so worker output must equal sync output byte-for-byte
 * across the whole example corpus (D5). Browser canvas-vs-OffscreenCanvas
 * equality is covered separately by tests/tool-worker-http.js. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { Worker } = require('node:worker_threads');
const root = path.resolve(__dirname, '..', '..');
const T = require('../tool/src/tool.js');
const A = require('../dist/ddn.global.js');
const Text = globalThis.__DDN_MODULE_REGISTRY__.namespaces.DDNText;
const results = [], pending = [];
function test(name, fn) {
  const done = r => { results.push(r); if (r.pass) console.log('PASS', name); else { console.error('FAIL', name, r.err.stack); process.exitCode = 1; } };
  try {
    const out = fn();
    if (out && typeof out.then === 'function') pending.push(out.then(() => done({ name, pass: true }), err => done({ name, pass: false, err })));
    else done({ name, pass: true });
  } catch (e) { done({ name, pass: false, err: e }); }
}

/* ---- pure protocol pieces ---- */

test('parseWorkerParam: only "off" (any case) opts out', () => {
  assert.equal(T.parseWorkerParam(null), 'auto');
  assert.equal(T.parseWorkerParam(''), 'auto');
  assert.equal(T.parseWorkerParam('off'), 'off');
  assert.equal(T.parseWorkerParam('OFF'), 'off');
  assert.equal(T.parseWorkerParam('0'), 'auto');
  assert.equal(T.parseWorkerParam('on'), 'auto');
});

test('workerDisabledReason: param/source/API gates; file:// stays auto (runtime degrade covers failures)', () => {
  const ok = { protocol: 'http:', param: null, hasWorker: true, hasSource: true };
  assert.equal(T.workerDisabledReason(ok), null);
  assert.equal(T.workerDisabledReason({ ...ok, param: 'off' }), '?worker=off');
  assert.equal(T.workerDisabledReason({ ...ok, hasSource: false }), 'no embedded worker source');
  assert.equal(T.workerDisabledReason({ ...ok, hasWorker: false }), 'Worker API unavailable');
  assert.equal(T.workerDisabledReason({ ...ok, protocol: 'file:' }), null, 'Blob workers verified on file:// in Chromium');
});

test('packMetrics/unpackMetrics round-trip with typed arrays and role tables', () => {
  const entries = [
    { text: 'Order service', size: 16, role: 'sans', weight: 650, width: 101.5, ascent: 13.6, descent: 4 },
    { text: 'order_id', size: 12, role: 'mono', weight: 400, width: 61.4, ascent: 10.56, descent: 3.36 },
    { text: 'again', size: 16, role: 'sans', weight: 650, width: 45, ascent: 13.6, descent: 4 }
  ];
  const p = T.packMetrics(entries);
  assert.ok(p.meta instanceof Float64Array && p.vals instanceof Float64Array, 'typed arrays across the boundary');
  assert.deepEqual([...p.roles].sort(), ['mono', 'sans'], 'roles deduplicated into an index table');
  assert.deepEqual(T.unpackMetrics(p), entries);
  assert.deepEqual(T.unpackMetrics(T.packMetrics([])), []);
});

/* ---- bridge state machine with a scripted fake worker ---- */

function fakeWorker(script) {
  // script: (msg, respond) => {}; respond(reply) delivers asynchronously.
  const w = {
    onmessage: null, onerror: null,
    postMessage(m) { setTimeout(() => script(m, r => w.onmessage && w.onmessage({ data: r })), 0); },
    terminate() { }
  };
  return w;
}
const measure = (t, s, r, w) => Text.measure(t, s, r, w);
const IR = { fake: true };

test('bridge: stale revisions are rejected and their late responses dropped (D8)', async () => {
  const replies = [];
  const flush = async () => { await new Promise(r => setTimeout(r, 10)); for (const r of replies.splice(0)) r(); };
  const w = fakeWorker((m, respond) => replies.push(() => respond({
    type: 'rendered', rev: m.rev, ok: true, svg: '<svg rev="' + m.rev + '"/>', scene: {}, diagnostics: [],
    used: T.packMetrics([])
  })));
  const bridge = T.createRenderBridge({ worker: w, measure });
  const p1 = bridge.render(IR, {});
  const p2 = bridge.render(IR, {});
  await assert.rejects(p1, e => e.code === 'DDN-W952', 'superseded request rejected');
  await flush(); // both responses arrive late
  const out = await p2;
  assert.equal(out.svg, '<svg rev="2"/>', 'latest revision resolves');
  // a late response for an earlier revision must not resolve anything new
  const p3 = bridge.render(IR, {});
  await flush();
  assert.equal((await p3).svg, '<svg rev="3"/>');
});

test('bridge: metric mismatch degrades to fallback and rejects in-flight + future renders (D5)', async () => {
  const events = [];
  const w = fakeWorker((m, respond) => respond({
    type: 'rendered', rev: m.rev, ok: true, svg: '<svg/>', scene: {}, diagnostics: [],
    used: T.packMetrics([{ text: 'x', size: 14, role: 'sans', weight: 400, width: 999999, ascent: 1, descent: 1 }])
  }));
  const bridge = T.createRenderBridge({ worker: w, measure, onDegraded: e => events.push(e.code) });
  await assert.rejects(bridge.render(IR, {}), e => e.code === 'DDN-W950' && e.workerFallback === true);
  assert.equal(bridge.degraded, true);
  assert.deepEqual(events, ['DDN-W950'], 'host notified once');
  await assert.rejects(bridge.render(IR, {}), e => e.workerFallback === true, 'later renders short-circuit');
});

test('bridge: render errors propagate with their code; worker onerror degrades', async () => {
  const w = fakeWorker((m, respond) => respond({ type: 'rendered', rev: m.rev, ok: false, code: 'DDN076', message: 'too small' }));
  const bridge = T.createRenderBridge({ worker: w, measure });
  await assert.rejects(bridge.render(IR, {}), e => e.code === 'DDN076' && !e.workerFallback);
  assert.equal(bridge.degraded, false, 'render errors are not degradation');
  const w2 = fakeWorker(() => { });
  const bridge2 = T.createRenderBridge({ worker: w2, measure });
  const p = bridge2.render(IR, {});
  w2.onerror({ message: 'blob load failed' });
  await assert.rejects(p, e => e.code === 'DDN-W951' && e.workerFallback === true);
});

test('bridge: verified metrics are seeded forward; ws.render falls back to byte-identical sync on degrade', async () => {
  // A fake worker that lies about one metric: ws.render must degrade and the
  // fallback result must equal renderSync exactly.
  const files = { 'main.ddn': 'ddn "0.5";\nmodule "m.deg";\n\ndata model {\n object a "Alpha" { kind: table; fields { field id; } }\n object b "Beta" { kind: application; }\n relation r "uses" @a -> @b { kind: flow; }\n}\nview v "V" { data: [@model]; }\n' };
  const w = fakeWorker((m, respond) => respond({
    type: 'rendered', rev: m.rev, ok: true, svg: '<svg>wrong</svg>', scene: {}, diagnostics: [],
    used: T.packMetrics([{ text: 'lie', size: 13, role: 'sans', weight: 400, width: 1e6, ascent: 1, descent: 1 }])
  }));
  const bridge = T.createRenderBridge({ worker: w, measure });
  A.setRenderBridge(bridge);
  try {
    const ws = A.createWorkspace(files), ref = A.createWorkspace(files);
    const out = await ws.render({ entry: 'main.ddn', view: 'v' });
    const sync = ref.renderSync({ entry: 'main.ddn', view: 'v' });
    assert.equal(out.svg, sync.svg, 'degraded render fell back to sync');
    assert.ok(out.svg !== '<svg>wrong</svg>', 'the unverifiable worker picture was discarded');
    assert.equal(bridge.degraded, true);
  } finally { A.setRenderBridge(null); }
});

/* ---- D5: byte-identical SVG across the whole corpus over a real worker ---- */

test('corpus: worker render equals sync render byte-for-byte for every catalogue example', async () => {
  const sandbox = {};
  new Function('globalThis', fs.readFileSync(path.join(root, 'notation/studio/assets/workspaces.js'), 'utf8'))(sandbox);
  const DATA = sandbox.DDNLiveData;
  const workerSource = fs.readFileSync(path.join(root, 'notation/dist/ddn.global.js'), 'utf8') + '\n;\n' +
    fs.readFileSync(path.join(root, 'notation/tool/src/worker.js'), 'utf8');
  /* Four persistent workers (each a D2-style bridge) shard the corpus; every
   * bridge still obeys one-request/one-response per render (D4). */
  const bridges = [];
  for (let i = 0; i < 4; i++) {
    const w = new Worker(workerSource, { eval: true });
    const port = { postMessage: (m, t) => w.postMessage(m, t), terminate: () => w.terminate() };
    w.on('message', m => port.onmessage && port.onmessage({ data: m }));
    w.on('error', e => port.onerror && port.onerror(e));
    const bridge = T.createRenderBridge({ worker: port, measure });
    port.postMessage({ type: 'init', registry: A.engineAssets.registry, glyphs: A.engineAssets.glyphs });
    bridges.push(bridge);
  }
  try {
    const closure = file => {
      const out = Object.create(null);
      const load = n => {
        if (Object.prototype.hasOwnProperty.call(out, n)) return;
        out[n] = DATA.files[n];
        for (const imp of A.parse(out[n], n).imports) load(A.resolvePath(n, imp.path));
      };
      load(file);
      return out;
    };
    const one = async (e, bridge) => {
      const files = closure(e.entry);
      const sync = A.createWorkspace(files).renderSync({ entry: e.entry, view: e.view });
      /* Worker side through the same prepare/finalize halves renderSync uses,
       * so the comparison covers the exact shipped boundary. */
      const ws = A.createWorkspace(files);
      const prep = ws.prepareRender({ entry: e.entry, view: e.view });
      assert.equal(prep.hit, null, 'fresh workspace must miss the geometry cache');
      const res = await bridge.render(prep.v.ir, prep.engineOpts, { redacted: prep.p.export.mode === 'redacted' });
      const out = ws.finalizeRender(prep, res, performance.now());
      assert.equal(out.svg, sync.svg, 'worker/svg mismatch on ' + e.entry + '#' + e.view);
      assert.deepEqual(JSON.parse(JSON.stringify(out.scene)), JSON.parse(JSON.stringify(sync.scene)), 'worker/scene mismatch on ' + e.entry + '#' + e.view);
      assert.deepEqual(out.diagnostics, sync.diagnostics, 'worker/diagnostics mismatch on ' + e.entry + '#' + e.view);
      assert.equal(bridge.degraded, false, 'bridge degraded on ' + e.entry + '#' + e.view);
    };
    let checked = 0;
    const t0 = Date.now();
    const queue = DATA.catalogue.entries.slice();
    await Promise.all(bridges.map(async (bridge, lane) => {
      for (let i = lane; i < queue.length; i += bridges.length) { await one(queue[i], bridge); checked++; }
    }));
    // A second pass exercises the seeded-metric path (D3/D4) through ws.render.
    A.setRenderBridge(bridges[0]);
    for (const e of DATA.catalogue.entries.slice(0, 12)) {
      const files = closure(e.entry);
      const sync = A.createWorkspace(files).renderSync({ entry: e.entry, view: e.view });
      const out = await A.createWorkspace(files).render({ entry: e.entry, view: e.view });
      assert.equal(out.svg, sync.svg, 'seeded worker/svg mismatch on ' + e.entry + '#' + e.view);
    }
    console.log('  corpus checked:', checked, 'views;', bridges[0].verifiedMetrics, 'verified metrics seeded;', Date.now() - t0, 'ms');
    assert.ok(bridges[0].verifiedMetrics > 100, 'worker-reported measurements were verified against the main thread');
  } finally {
    A.setRenderBridge(null);
    await Promise.all(bridges.map(b => b.terminate()));
  }
});

/* ---- D4 parity (B1-046): an invalid override combination fails the SAME way
 * via the worker bridge and the synchronous path — same code, same message. */
test('D4 parity: DDN071 rejects identically via worker and sync rendering', async () => {
  const files = { 'main.ddn': 'ddn "0.5";\nmodule "m.font";\n\ndata model {\n object a "Alpha" { kind: application; }\n object b "Beta" { kind: application; }\n relation r "uses" @a -> @b { kind: flow; }\n}\nview v "V" { data: [@model]; publication { size: content; fit: none; overflow: error; } }\n' };
  const workerSource = fs.readFileSync(path.join(root, 'notation/dist/ddn.global.js'), 'utf8') + '\n;\n' +
    fs.readFileSync(path.join(root, 'notation/tool/src/worker.js'), 'utf8');
  const w = new Worker(workerSource, { eval: true });
  const port = { postMessage: (m, t) => w.postMessage(m, t), terminate: () => w.terminate() };
  w.on('message', m => port.onmessage && port.onmessage({ data: m }));
  w.on('error', e => port.onerror && port.onerror(e));
  const bridge = T.createRenderBridge({ worker: port, measure });
  port.postMessage({ type: 'init', registry: A.engineAssets.registry, glyphs: A.engineAssets.glyphs });
  A.setRenderBridge(bridge);
  try {
    let wErr = null, sErr = null;
    try { await A.createWorkspace(files).render({ entry: 'main.ddn', view: 'v', overrides: { fontSize: 8 } }); } catch (e) { wErr = e; }
    try { A.createWorkspace(files).renderSync({ entry: 'main.ddn', view: 'v', overrides: { fontSize: 8 } }); } catch (e) { sErr = e; }
    assert.ok(wErr && sErr, 'both paths must reject');
    assert.equal(wErr.code, 'DDN071'); assert.equal(sErr.code, 'DDN071');
    assert.equal(wErr.message, sErr.message, 'identical message in both modes');
    assert.match(wErr.message, /increase base font to ≥15\.5px/);
    assert.equal(bridge.degraded, false, 'a genuine render error is not a degradation');
  } finally {
    A.setRenderBridge(null);
    await bridge.terminate();
  }
});

const n = results.length;
Promise.all(pending).then(() => {
  const ok = results.filter(r => r.pass).length;
  console.log(`Tool worker rendering ${ok}/${results.length}`);
  if (ok !== results.length) process.exitCode = 1;
});
void n;
