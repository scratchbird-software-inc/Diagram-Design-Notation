/* SPDX-License-Identifier: GPL-2.0-or-later. B1-071: extracted from tool.js — render-worker bridge: params, metric packing, verified bridge state machine.
 * UMD: inlined into the single-file tool/viewer builds and required by node tests. */
(function (host) {
'use strict';
/* ------------------------------------------------ B1-043 render worker bridge
 * Coarse boundary (review/D3): the main thread keeps compile, override
 * application, geometry caching and result bookkeeping; only Engine.render
 * (layout + routing + SVG build) crosses into a persistent worker. The
 * request carries the applied IR (measured-dimension inputs, pins, ports,
 * constraints and existing geometry all live there), the engine options and
 * a packed pre-measured text table; one batched response returns svg + scene
 * + diagnostics + the exact set of measured tuples (D4: no chatter).
 * Determinism (D5): every measured tuple the worker reports is verified
 * against the main-thread measurement service; a mismatch discards the
 * worker result and permanently degrades to the synchronous path, so the
 * displayed SVG is always byte-identical to a sync render. */

/* `?worker=off` (D1): explicit sync fallback. Any other value (or absence)
 * leaves the default auto behaviour. */
function parseWorkerParam(v) { return v == null || v === '' ? 'auto' : (String(v).toLowerCase() === 'off' ? 'off' : 'auto'); }

/* Why the worker cannot run here, or null when it can. Blob-URL workers are
 * verified to run from both http:// and file:// pages in Chromium (B1-043
 * spike, chrome-headless-shell-1234), so file:// keeps the worker too; a
 * browser that rejects them trips the bridge's onerror degrade path and the
 * tool continues synchronously — same end state as ?worker=off. */
function workerDisabledReason({ param, hasWorker, hasSource }) {
  if (parseWorkerParam(param) === 'off') return '?worker=off';
  if (!hasSource) return 'no embedded worker source';
  if (!hasWorker) return 'Worker API unavailable';
  return null;
}

/* Packed metrics table (D4): string + role tables, Float64Array triples. */
function packMetrics(entries) {
  if (!Array.isArray(entries)) throw new Error('metric entries array required');
  const texts = [], roles = [], meta = new Float64Array(entries.length * 3), vals = new Float64Array(entries.length * 3);
  entries.forEach((e, i) => {
    let ri = roles.indexOf(e.role);
    if (ri < 0) { roles.push(e.role); ri = roles.length - 1; }
    texts.push(String(e.text));
    meta[i * 3] = e.size; meta[i * 3 + 1] = ri; meta[i * 3 + 2] = e.weight;
    vals[i * 3] = e.width; vals[i * 3 + 1] = e.ascent; vals[i * 3 + 2] = e.descent;
  });
  return { texts, roles, meta, vals };
}

function unpackMetrics(p) {
  const out = [], texts = (p && p.texts) || [], roles = (p && p.roles) || [], meta = (p && p.meta) || [], vals = (p && p.vals) || [];
  for (let i = 0; i < texts.length; i++)
    out.push({ text: texts[i], size: meta[i * 3], role: roles[meta[i * 3 + 1]], weight: meta[i * 3 + 2], width: vals[i * 3], ascent: vals[i * 3 + 1], descent: vals[i * 3 + 2] });
  return out;
}

function workerBridgeError(code, message, fallback) {
  const e = new Error(message);
  e.code = code;
  if (fallback) e.workerFallback = true;
  return e;
}

/* Host-agnostic bridge factory: `worker` is any Worker-like port
 * (postMessage(msg, transfer), onmessage/onerror setters, terminate());
 * `measure(text, size, role, weight)` is the main-thread reference
 * measurement used to verify every tuple the worker reports (D5). */
function createRenderBridge({ worker, measure, onDegraded, onTiming, seedLimit = 8192 }) {
  if (!worker || typeof worker.postMessage !== 'function') throw new Error('worker port required');
  if (typeof measure !== 'function') throw new Error('reference measure function required');
  let latest = 0, degraded = false;
  const pending = new Map(), verified = new Map();
  const key = e => JSON.stringify([e.text, e.size, e.role, e.weight]);
  function degrade(err) {
    if (degraded) return;
    degraded = true;
    const list = [...pending.values()]; pending.clear();
    for (const p of list) p.reject(err);
    if (onDegraded) try { onDegraded(err); } catch { /* host hook */ }
  }
  worker.onmessage = ev => {
    const m = (ev && ev.data !== undefined ? ev.data : ev) || {};
    if (m.type === 'ready') return;
    if (m.type !== 'rendered') return;
    const p = pending.get(m.rev);
    pending.delete(m.rev);
    if (!p) return; // superseded request whose response arrived late (D8)
    if (!m.ok) { p.reject(workerBridgeError(m.code || 'ERROR', m.message || 'worker render failed')); return; }
    /* Verify every measured tuple against the main-thread reference before
     * the result is allowed on screen (D5). */
    let t0 = 0;
    if (onTiming) t0 = nowMs();
    for (const e of unpackMetrics(m.used)) {
      const k = key(e);
      if (verified.has(k)) continue;
      const ref = measure(e.text, e.size, e.role, e.weight);
      if (!ref || ref.width !== e.width || ref.ascent !== e.ascent || ref.descent !== e.descent) {
        const err = workerBridgeError('DDN-W950', 'worker text metric mismatch for ' + JSON.stringify(e.text).slice(0, 40) + ' — degraded to synchronous rendering', true);
        degrade(err);
        p.reject(err);
        return;
      }
      verified.set(k, e);
      if (verified.size > seedLimit) verified.delete(verified.keys().next().value);
    }
    if (onTiming) onTiming({ rev: m.rev, verifyMs: nowMs() - t0, workerBusyMs: m.busyMs });
    p.resolve({ svg: m.svg, scene: m.scene, diagnostics: m.diagnostics || [], _ir: m.ir });
  };
  worker.onerror = ev => {
    degrade(workerBridgeError('DDN-W951', 'render worker failed: ' + ((ev && ev.message) || 'unknown') + ' — synchronous rendering from here', true));
  };
  function nowMs() { return (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()); }
  return {
    get degraded() { return degraded; },
    get verifiedMetrics() { return verified.size; },
    render(ir, engineOpts, { redacted = false } = {}) {
      if (degraded) return Promise.reject(workerBridgeError('DDN-W951', 'render worker degraded', true));
      /* D8: a new request supersedes every in-flight one; late responses for
       * superseded revisions are dropped on receipt above. */
      for (const [rev, p] of pending) { p.reject(workerBridgeError('DDN-W952', 'render superseded by a newer request')); pending.delete(rev); }
      const rev = ++latest;
      const packed = packMetrics([...verified.values()]);
      return new Promise((resolve, reject) => {
        pending.set(rev, { resolve, reject });
        try {
          worker.postMessage({ type: 'render', rev, ir, opts: engineOpts, needIR: redacted === true, metrics: packed }, [packed.meta.buffer, packed.vals.buffer]);
        } catch (e) {
          pending.delete(rev);
          const err = workerBridgeError('DDN-W951', 'render worker post failed: ' + (e && e.message), true);
          degrade(err);
          reject(err);
        }
      });
    },
    terminate() { degraded = true; try { worker.terminate && worker.terminate(); } catch { /* gone */ } }
  };
}

const api = { parseWorkerParam, workerDisabledReason, packMetrics, unpackMetrics, workerBridgeError, createRenderBridge };
if (typeof module === 'object' && module.exports) module.exports = api;
host.DDNToolBridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
