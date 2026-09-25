/* SPDX-License-Identifier: GPL-2.0-or-later. B1-027 unified DDN diagram tool.
 * One page replacing the end-user viewer (B1-007), the studio gallery and the
 * studio editor: a diagram stage with pan/zoom, an icon toolbar, and pop-in
 * drawers (appearance top, source bottom, files left, export right) whose
 * open/closed/none/api state is configurable per drawer via ?drawers=, a settings
 * popup persisted to localStorage, and ?mode= presets (D2-D4).
 *
 * Rendering reuses the shared <ddn-example> component (DDNLive.mount) as the
 * render nucleus (D1); its internal chrome is hidden with an injected shadow
 * stylesheet and every feature is driven through its public surface
 * (setOptions/action/redraw) plus DDNLive.authoring / DDNLive.io.
 *
 * Pure functions are exported for node unit tests; the DOM boot runs only in
 * a browser with DDNLive loaded. */
(function (host) {
'use strict';

/* --- pure functions (unit tested in node) --- */

const DRAWERS = ['appearance', 'source', 'files', 'export', 'animation'];
/* B1-049: `api` = icon hidden and not user-openable, but openable by host code
 * via DDNTool.setDrawer — unlike `none`, which is unavailable to everyone.
 * The gear popup offers only GEAR_STATES (`api` is a host feature). */
const DRAWER_STATES = ['open', 'closed', 'none', 'api'];
const GEAR_STATES = ['open', 'closed', 'none'];
const STORAGE_KEY = 'ddn-tool-drawers';

/* D4: mode presets. toolbar=false hides the whole icon toolbar (embed use);
 * icons=false shows only the viewport controls. Explicit ?drawers= pairs and
 * saved localStorage settings override the preset drawer states. */
const MODES = {
  diagram: { toolbar: false, icons: false, drawers: { appearance: 'none', source: 'none', files: 'none', export: 'none', animation: 'none' } },
  view: { toolbar: true, icons: false, drawers: { appearance: 'none', source: 'none', files: 'none', export: 'none', animation: 'none' } },
  explore: { toolbar: true, icons: true, drawers: { appearance: 'closed', source: 'closed', files: 'closed', export: 'closed', animation: 'closed' } },
  edit: { toolbar: true, icons: true, drawers: { appearance: 'closed', source: 'open', files: 'closed', export: 'closed', animation: 'closed' } }
};
const DEFAULT_MODE = 'explore';

function parseMode(v) { return Object.prototype.hasOwnProperty.call(MODES, v) ? v : null; }

/* D3: `?drawers=appearance:closed,source:none` — strict validation; malformed
 * pairs, unknown drawers and unknown states are ignored, never fatal. */
function parseDrawersParam(str) {
  const out = {};
  if (str == null || str === '') return out;
  for (const pair of String(str).split(',')) {
    const m = /^\s*([A-Za-z]+)\s*:\s*([A-Za-z]+)\s*$/.exec(pair);
    if (!m) continue;
    if (!DRAWERS.includes(m[1]) || !DRAWER_STATES.includes(m[2])) continue;
    out[m[1]] = m[2];
  }
  return out;
}

/* A stored/localStorage drawer config is trusted only per validated pair. */
function cleanDrawerConfig(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const k of DRAWERS) if (DRAWER_STATES.includes(obj[k])) out[k] = obj[k];
  return out;
}

/* B1-049 (D2): `?toolbar=off` hides the whole icon toolbar WITHOUT changing
 * drawer availability (unlike mode=diagram, which also forces drawers none).
 * Only the exact value `off` counts; anything else is ignored. */
function parseToolbarParam(v) { return v != null && String(v).toLowerCase() === 'off' ? 'off' : null; }

/* Precedence (D3): preset (D4) < localStorage < URL param. `?toolbar=off`
 * beats the preset's toolbar:true but never touches drawer states. */
function resolveDrawerConfig(mode, stored, urlDrawers, urlToolbar) {
  const preset = MODES[parseMode(mode) || DEFAULT_MODE];
  const drawers = { ...preset.drawers, ...cleanDrawerConfig(stored), ...parseDrawersParam(urlDrawers) };
  return { mode: parseMode(mode) || DEFAULT_MODE, toolbar: preset.toolbar && parseToolbarParam(urlToolbar) !== 'off', icons: preset.icons, drawers };
}

/* Fit scale of an sw×sh SVG inside a cw×ch container (same semantics as the
 * B1-007 viewer): 'page' = min fit; 'width' = cw/sw; 'height' = ch/sh; '100' = 1. */
function computeFitScale(mode, cw, ch, sw, sh) {
  if (!(sw > 0) || !(sh > 0) || !(cw > 0) || !(ch > 0)) return 1;
  if (mode === 'width') return cw / sw;
  if (mode === 'height') return ch / sh;
  if (mode === 'page') return Math.min(cw / sw, ch / sh);
  if (mode === '100') return 1;
  throw new Error('unknown fit mode: ' + mode);
}

const slug = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
function cssString(s) { return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\a '); }

/* Runtime font stacks (notation/runtime/ddn-text.js FONTS). */
const FONT_STACKS = {
  sans: 'DejaVu Sans, Arial, sans-serif',
  serif: 'DejaVu Serif, Georgia, serif',
  mono: 'DejaVu Sans Mono, monospace',
  handwriting: 'Comic Neue, Segoe Print, Bradley Hand, Comic Sans MS, cursive'
};
const ROUTING_VALUES = ['orthogonal', 'straight', 'curved', 'rounded'];

/* B1-046 (D2): DDN071 bounds, mirroring the check in ddn-render.js — the
 * smallest text role is 11/16 of the base font (capped at 11px absolute and at
 * 12·scale with relations; page scale and embedding_scale can only shrink it),
 * and publication.minimum_text defaults to 8pt ≈ 10.67px. The tool's floor is the
 * smallest base font that keeps that role at/above the minimum at full scale,
 * so the drawer cannot offer values the renderer must reject. */
const MIN_TEXT_PX = 8 * 96 / 72; // publication.minimum_text default: 8pt ≈ 10.67px
/* Read a profile quantity ({$quantity, unit} or plain number) as px. */
function quantityPx(v, dflt) {
  if (v == null) return dflt;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && Number.isFinite(v.$quantity)) {
    if (v.unit === 'pt') return v.$quantity * 96 / 72;
    if (v.unit == null || v.unit === 'px') return v.$quantity;
  }
  return dflt;
}
function smallestRolePx(baseFontPx) {
  const b = Number(baseFontPx);
  if (!Number.isFinite(b)) throw new Error('base font must be a number of px');
  return Math.min(11 * b / 16, 11);
}
function baseFontFloor(minTextPx) {
  const m = minTextPx == null ? MIN_TEXT_PX : Number(minTextPx);
  if (!Number.isFinite(m) || m <= 0) throw new Error('minimum text must be a positive number of px');
  return Math.max(1, Math.ceil(16 * m / 11 - 1e-9));
}
/* Friendly pre-render validation (D2): null when the base font is satisfiable,
 * else a message naming the implied minimum — the stage is never touched for
 * a preventable input error. */
function baseFontProblem(baseFontPx, minTextPx) {
  if (baseFontPx == null) return null;
  const m = minTextPx == null ? MIN_TEXT_PX : Number(minTextPx);
  const smallest = smallestRolePx(baseFontPx);
  if (smallest >= m) return null;
  return 'Base font ' + baseFontPx + 'px would make the smallest text ' + smallest.toFixed(2) +
    'px, below the ' + m.toFixed(2) + 'px minimum (DDN071) — use ≥' + baseFontFloor(m) +
    'px (or lower publication.minimum_text in the source)';
}

/* Presentation-override CSS rules (adapted from the B1-007/B1-011 viewer to
 * the component SVG, which keys occurrences with data-id). CSS beats SVG
 * presentation attributes, so these restyle the render without touching the
 * source. */
function overrideRuleFor(target, value) {
  if (!target || typeof target !== 'object') throw new Error('override target required');
  if (!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(value))) throw new Error('colour must be #rgb or #rrggbb');
  if (target.type === 'kind') {
    const c = slug(target.code);
    return '.ddn-svg .ddn-kind-' + c + ' > path, .ddn-svg .ddn-kind-' + c + ' > rect, .ddn-svg .ddn-kind-' + c + ' > circle, .ddn-svg .ddn-kind-' + c + ' > ellipse, .ddn-svg .ddn-kind-' + c + ' > polygon { fill: ' + value + '; }';
  }
  if (target.type === 'verb') {
    const c = slug(target.code);
    return '.ddn-svg .ddn-verb-' + c + ' path { stroke: ' + value + '; }';
  }
  if (target.type === 'object') {
    const sel = '.ddn-svg [data-id="' + cssString(target.id) + '"], .ddn-svg [data-ddn-id="' + cssString(target.id) + '"]';
    return sel + ' > path, ' + sel + ' > rect, ' + sel + ' > circle, ' + sel + ' > ellipse, ' + sel + ' > polygon { fill: ' + value + '; }';
  }
  throw new Error('unknown override type: ' + target.type);
}

/* Per-kind typography CSS overlay (viewer B1-011 D2 semantics): no reflow, so
 * long labels can overflow; the global font-size control reflows instead. */
function typographyRuleFor(code, style) {
  const decls = [];
  if (style && style.family != null && style.family !== 'source') {
    const stack = FONT_STACKS[style.family];
    if (!stack) throw new Error('unknown font family: ' + style.family);
    decls.push('font-family: ' + stack);
  }
  if (style && style.size != null && style.size !== 'source') {
    const n = Number(style.size);
    if (!Number.isFinite(n) || n < 8 || n > 24) throw new Error('font size must be between 8 and 24px');
    decls.push('font-size: ' + n + 'px');
  }
  if (!decls.length) throw new Error('typography rule needs a family or a size');
  return '.ddn-svg .ddn-kind-' + slug(code) + ' text { ' + decls.join('; ') + '; }';
}

/* The whole CSS overlay for the current presentation + selection highlight. */
function overrideCss(presentation, selectedRelation) {
  const p = presentation || {}, rules = [];
  for (const [code, style] of Object.entries(p.typography || {})) rules.push(typographyRuleFor(code, style));
  for (const [code, col] of Object.entries(p.kindColours || {})) rules.push(overrideRuleFor({ type: 'kind', code }, col));
  for (const [code, col] of Object.entries(p.verbColours || {})) rules.push(overrideRuleFor({ type: 'verb', code }, col));
  for (const [id, col] of Object.entries(p.objectColours || {})) rules.push(overrideRuleFor({ type: 'object', id }, col));
  if (selectedRelation) rules.push('.ddn-svg [data-id="' + cssString(selectedRelation) + '"] path { stroke: #d97706; stroke-width: 2.5px; }');
  return rules.join('\n');
}

/* Component render overrides from the presentation state: per-verb and
 * per-relation routing merge into the component's relationRouting channel
 * (relation ids win over verb keywords). */
function toolOverrides(presentation) {
  const p = presentation || {}, o = { ...(p.options || {}) };
  const rr = { ...(p.verbRouting || {}), ...(p.relationRouting || {}) };
  for (const [k, v] of Object.entries(rr)) {
    if (v == null || v === 'source') { delete rr[k]; continue; }
    if (!ROUTING_VALUES.includes(v)) throw new Error('unknown routing for ' + k + ': ' + v);
  }
  if (Object.keys(rr).length) o.relationRouting = rr;
  return o;
}

/* Flatten ws.entries() into a picker list [{entry, view, label}]. */
function viewListFrom(entries) {
  if (!Array.isArray(entries)) throw new Error('entries array required');
  const out = [];
  for (const e of entries) for (const v of (e && e.views) || []) out.push({ entry: e.file, view: v.id, label: e.file + ' · ' + (v.name || v.id) });
  return out;
}

function isPlausibleSourceFile(f) {
  if (!f || typeof f.name !== 'string') return false;
  return /\.ddn($|\.)/i.test(f.name) || /\.(zip|json)$/i.test(f.name) || (typeof f.type === 'string' && f.type.startsWith('text/'));
}

const MAX_FILE_BYTES = 50_000_000;

/* Raster export allocates a scale× canvas from the source-declared page size;
 * clamp each side so a hostile/buggy publication size cannot request an
 * enormous canvas. */
const MAX_RASTER_PX = 16384;
function rasterCanvasSize(w, h, scale) {
  const s = scale || 2;
  if (!(w > 0) || !(h > 0)) throw new Error('nothing rendered yet');
  const cw = Math.round(w * s), ch = Math.round(h * s);
  if (cw > MAX_RASTER_PX || ch > MAX_RASTER_PX)
    throw new Error('raster export refused: ' + cw + '×' + ch + ' px exceeds the ' + MAX_RASTER_PX + ' px per-side cap; the source declares a very large page');
  return { width: cw, height: ch };
}

/* `?src=<relative .ddn path>` deep link (B1-023 D1, reused per B1-027 D5).
 * Strictly relative: any scheme, scheme-relative host, or absolute path is
 * rejected — the tool only ever fetches siblings of its own page. */
function srcFromQuery(search) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const src = params.get('src');
  if (src == null) return null;
  const v = src.trim();
  if (!v) throw new Error('?src= is empty — give a relative path to a .ddn file');
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) throw new Error('?src= must be a relative path, not a URL with a scheme: ' + v);
  if (v.startsWith('//') || v.startsWith('/')) throw new Error('?src= must be a relative path (no host, no absolute path): ' + v);
  if (!/\.ddn$/i.test(v.split(/[?#]/)[0])) throw new Error('?src= must point at a .ddn source: ' + v);
  return v;
}

function srcFetchErrorMessage(err, protocol, src) {
  if (protocol === 'file:')
    return 'cannot fetch ' + src + ' — browsers block file:// page fetches. Serve the site over HTTP (npm run serve) or use Open / paste instead.';
  return err && err.message || 'fetch failed';
}

/* B1-026 import closure, reused for both ?src= deep links and ?entry= paths
 * that are not in the bundled catalogue (D5). Cycle-safe; every fetched text
 * is size-capped; failures name the missing file. */
function srcImportClosure(src, pageHref, fetchFn, parseImports, resolvePath) {
  const files = Object.create(null);
  const entryName = src.split('/').pop().split(/[?#]/)[0];
  const pull = (url, name) => fetchFn(url).then(r => {
    if (!r.ok) throw new Error(name + ' — HTTP ' + r.status + ' (' + url + ')');
    return r.text();
  }).then(text => {
    if (text.length > MAX_FILE_BYTES)
      throw new Error(name + ' is ' + Math.round(text.length / 1e6) + ' MB — the tool accepts sources up to ' + (MAX_FILE_BYTES / 1e6) + ' MB');
    if (Object.prototype.hasOwnProperty.call(files, name)) return null;
    files[name] = text;
    return Promise.all(parseImports(text, name).map(p =>
      pull(new URL(p, url), resolvePath(name, p))));
  });
  return pull(new URL(src, pageHref), entryName).then(() => ({ files, entryName }));
}

/* SVG export string with the active CSS overrides embedded (viewer semantics):
 * an exported file looks like the screen, overrides and all. */
function exportSvgWithOverrides(svgText, css) {
  if (!svgText) throw new Error('nothing rendered yet');
  if (!css) return svgText;
  return svgText.replace(/<svg /, () => '<svg data-ddn-tool-export="presentation-overrides" ').replace(/(<svg[^>]*>)/, m => m + '<style>' + css + '</style>');
}

/* B1-033 (D5): animation controller pure parts.
 * hopWindowsFromMarkers reads the renderer's data-hop attributes
 * ([{hop, start, end}]) into sorted per-hop time windows — hop boundaries are
 * route-length/speed derived by the renderer and exposed on the markers. */
function hopWindowsFromMarkers(markers) {
  if (!Array.isArray(markers)) throw new Error('markers array required');
  const seen = new Map();
  for (const m of markers) {
    if (!m || !Number.isFinite(m.start) || !Number.isFinite(m.end) || !(m.end > m.start))
      throw new Error('invalid hop window: ' + JSON.stringify(m));
    if (!seen.has(m.hop)) seen.set(m.hop, { hop: m.hop, start: m.start, end: m.end });
  }
  return [...seen.values()].sort((a, b) => a.start - b.start || a.end - b.end);
}
/* nextHopTime: pausing mid-hop i advances to the END of hop i (the marker
 * arrives at the next element); exactly on a boundary advances one full hop;
 * past the last boundary wraps to the first. */
function nextHopTime(current, windows) {
  if (!windows.length) throw new Error('no hops to step through');
  const eps = 1e-6;
  for (const w of windows) if (w.end > current + eps) return w.end;
  return windows[0].end;
}
/* Speed multiplier re-times a base SMIL duration (documented D5 approach:
 * re-setting dur beats setCurrentTime scaling because it survives re-renders
 * and needs no per-frame controller loop). */
function scaledDuration(baseDur, multiplier) {
  if (!(baseDur > 0)) throw new Error('base duration must be positive');
  if (![0.5, 1, 2, 4].includes(multiplier)) throw new Error('speed multiplier must be 0.5, 1, 2 or 4');
  return baseDur / multiplier;
}

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

const pure = {
  DRAWERS, DRAWER_STATES, GEAR_STATES, MODES, DEFAULT_MODE, STORAGE_KEY, parseMode, parseDrawersParam, cleanDrawerConfig, resolveDrawerConfig, parseToolbarParam,
  computeFitScale, overrideRuleFor, typographyRuleFor, overrideCss, toolOverrides, viewListFrom,
  isPlausibleSourceFile, rasterCanvasSize, srcFromQuery, srcFetchErrorMessage, srcImportClosure,
  exportSvgWithOverrides, MAX_FILE_BYTES, MAX_RASTER_PX, FONT_STACKS, ROUTING_VALUES,
  MIN_TEXT_PX, quantityPx, smallestRolePx, baseFontFloor, baseFontProblem,
  hopWindowsFromMarkers, nextHopTime, scaledDuration,
  parseWorkerParam, workerDisabledReason, packMetrics, unpackMetrics, createRenderBridge
};
if (typeof module === 'object' && module.exports) module.exports = pure;
if (typeof document === 'undefined' || !host.DDNLive) { host.DDNTool = pure; return; }

/* --- browser boot --- */
const A = host.DDNLive;
const $ = id => document.getElementById(id);
const DATA = globalThis.DDNLiveData || { files: {}, catalogue: { entries: [] } };

const freshSource = `ddn "0.5";\nmodule "my.design";\n\n// Definitions are shared; layout and appearance belong to the view.\ndata model {\n    object client "Client application" { kind: application; }\n    object service "Order service" { kind: application; }\n    object orders "Orders" {\n        kind: table;\n        fields { field order_id; field customer_id; field status; }\n    }\n    relation request "Submit order" @client -> @service { kind: flow; }\n    relation write "Persist accepted order" @service -> @orders { kind: flow; }\n}\n\nview overview "Order processing" {\n    data: [@model];\n    layout { algorithm: auto; routing: curved; crossings: gap; }\n    style { look: classic; theme: night; }\n    publication { size: content; fit: none; }\n    legend { mode: tokens; placement: right; }\n}\n`;

const els = {
  toolbar: $('ddn-toolbar'), picker: $('ddn-view-picker'),
  busy: $('ddn-busy'),
  fitPage: $('ddn-fit-page'), fitWidth: $('ddn-fit-width'), fitHeight: $('ddn-fit-height'), fit100: $('ddn-fit-100'),
  zoomOut: $('ddn-zoom-out'), zoomIn: $('ddn-zoom-in'), zoom: $('ddn-zoom'), zoomPct: $('ddn-zoom-pct'),
  dragMode: $('ddn-drag-mode'), settings: $('ddn-settings'), settingsPopup: $('ddn-settings-popup'),
  settingsRows: $('ddn-settings-rows'),
  stage: $('ddn-stage'), diagramHost: $('ddn-diagram'), hint: $('ddn-hint'), status: $('ddn-tool-status'),
  appearanceBody: $('ddn-appearance-body'),
  open: $('ddn-open'), openFolder: $('ddn-open-folder'), merge: $('ddn-merge'), newProject: $('ddn-new-project'),
  fileInput: $('ddn-file-input'), folderInput: $('ddn-folder-input'),
  catalogue: $('ddn-catalogue'), catalogueSearch: $('ddn-catalogue-search'),
  fileList: $('ddn-file-list'), fileCount: $('ddn-file-count'),
  fileNew: $('ddn-file-new'), fileRename: $('ddn-file-rename'), fileDelete: $('ddn-file-delete'),
  downloadFile: $('ddn-download-file'), downloadZip: $('ddn-download-zip'), downloadJson: $('ddn-download-json'),
  paste: $('ddn-paste'), loadPaste: $('ddn-load-paste'),
  sourceFile: $('ddn-source-file'), source: $('ddn-source'), sourceError: $('ddn-source-error'),
  apply: $('ddn-apply'), discard: $('ddn-discard'), liveApply: $('ddn-live-apply'), dirty: $('ddn-dirty'),
  undo: $('ddn-undo'), redo: $('ddn-redo'), find: $('ddn-find'), replace: $('ddn-replace'), goto: $('ddn-goto'),
  inspector: $('ddn-inspector'), inspectorControls: $('ddn-inspector-controls'), selectionSummary: $('ddn-selection-summary'),
  labelValue: $('ddn-label-value'), setLabel: $('ddn-set-label'), kindValue: $('ddn-kind-value'), setKind: $('ddn-set-kind'),
  posX: $('ddn-pos-x'), posY: $('ddn-pos-y'), pin: $('ddn-pin'), unpin: $('ddn-unpin'), hide: $('ddn-hide'),
  addField: $('ddn-add-field'), goSource: $('ddn-go-source'), deleteDef: $('ddn-delete-def'),
  addElement: $('ddn-add-element'), addRelation: $('ddn-add-relation'),
  exportSvg: $('ddn-export-svg'), exportPng: $('ddn-export-png'), exportWebp: $('ddn-export-webp'), saveExample: $('ddn-save-example'),
  exportMotion: $('ddn-export-motion'),
  animEmpty: $('ddn-anim-empty'), animControls: $('ddn-anim-controls'), animToggle: $('ddn-anim-toggle'),
  animStep: $('ddn-anim-step'), animSpeed: $('ddn-anim-speed'), animFlow: $('ddn-anim-flow'),
  animFlowField: $('ddn-anim-flow-field'), animStatus: $('ddn-anim-status')
};
const drawerEls = { files: $('ddn-drawer-files'), appearance: $('ddn-drawer-appearance'), source: $('ddn-drawer-source'), export: $('ddn-drawer-export'), animation: $('ddn-drawer-animation') };
const iconEls = { files: $('ddn-icon-files'), appearance: $('ddn-icon-appearance'), source: $('ddn-icon-source'), export: $('ddn-icon-export'), animation: $('ddn-icon-animation') };

function emptyPresentation() {
  return { options: {}, typography: {}, kindColours: {}, verbColours: {}, objectColours: {}, verbRouting: {}, relationRouting: {} };
}
const state = {
  ws: null, diagram: null, entry: '', view: '', viewList: [],
  currentFile: '', bufferDirty: false, saved: {}, mergeNext: false, search: '',
  presentation: emptyPresentation(), selected: null, selectedRelation: null,
  fit: 'page', config: resolveDrawerConfig(DEFAULT_MODE, null, null),
  catalogueIndex: -1, overrideStyle: null, panning: false
};
let timer = null, unsubscribe = null;

/* ------------------------------------------------ render worker (B1-043, D1/D2)
 * One persistent Blob-URL worker per page, created from the source string the
 * build embeds as globalThis.DDN_WORKER_SOURCE (D6 — the tool stays a single
 * self-contained file; nothing external is fetched). `?worker=off`, a missing
 * Worker API, and file:// pages keep the synchronous path; a metric mismatch
 * or worker failure degrades permanently to sync (never a wrong picture). */
const workerState = { bridge: null, reason: null };
function renderMode() { return workerState.bridge && !workerState.bridge.degraded ? 'worker' : 'sync'; }
let measureCanvas = null;
function referenceMeasure(text, size, role, weight) {
  const stack = FONT_STACKS[role] || role;
  try {
    if (measureCanvas === null) measureCanvas = document.createElement('canvas').getContext('2d') || false;
    if (!measureCanvas) return null;
    measureCanvas.font = weight + ' ' + size + 'px ' + stack;
    const m = measureCanvas.measureText(String(text));
    return { width: m.width, ascent: m.actualBoundingBoxAscent || size * .85, descent: m.actualBoundingBoxDescent || size * .25 };
  } catch { return null; }
}
function installRenderWorker() {
  const reason = workerDisabledReason({
    protocol: host.location && host.location.protocol,
    param: new URLSearchParams(location.search).get('worker'),
    hasWorker: typeof host.Worker === 'function',
    hasSource: typeof host.DDN_WORKER_SOURCE === 'string' && host.DDN_WORKER_SOURCE.length > 0
  });
  workerState.reason = reason;
  if (reason) return;
  try {
    const url = URL.createObjectURL(new Blob([host.DDN_WORKER_SOURCE], { type: 'text/javascript' }));
    const w = new Worker(url);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    workerState.bridge = createRenderBridge({
      worker: w,
      measure: referenceMeasure,
      onDegraded: e => {
        els.diagramHost.setAttribute('data-ddn-render-mode', 'sync');
        status('render worker disabled (' + (e && e.message || e) + ') — synchronous rendering');
      }
    });
    w.postMessage({ type: 'init', registry: A.engineAssets.registry, glyphs: A.engineAssets.glyphs });
    A.setRenderBridge(workerState.bridge);
  } catch (e) {
    workerState.reason = (e && e.message) || 'worker creation failed';
    workerState.bridge = null;
  }
}

function status(msg) {
  const base = state.entry ? state.entry + ' · view "' + state.view + '"' : 'no source loaded';
  els.status.textContent = base + (msg ? ' — ' + msg : '');
}
function fail(msg) { els.status.textContent = 'Error: ' + msg; }
function guard(fn) { try { const r = fn(); if (r && r.catch) r.catch(e => error(e)); return r; } catch (e) { error(e); } }
function error(e) {
  fail((e && e.code ? e.code + ': ' : '') + (e && e.message || e));
  els.sourceError.textContent = (e && e.source ? e.source + ': ' : '') + ((e && e.code) || 'ERROR') + ' ' + (e && e.message || e);
}

/* ------------------------------------------------ drawer configuration (D3/D4) */

function loadStoredDrawers() {
  try { return cleanDrawerConfig(JSON.parse(host.localStorage.getItem(STORAGE_KEY) || 'null')); } catch { return {}; }
}
function applyDrawerConfig() {
  const c = state.config;
  els.toolbar.hidden = !c.toolbar;
  for (const el of document.querySelectorAll('[data-drawer-icons]')) el.hidden = !c.icons;
  for (const el of document.querySelectorAll('[data-viewport]')) el.hidden = false; // viewport shown whenever the toolbar is
  els.settings.hidden = !c.icons;
  for (const name of DRAWERS) {
    const st = c.drawers[name];
    drawerEls[name].dataset.state = c.icons ? (st === 'api' ? 'closed' : st) : 'none';
    iconEls[name].hidden = !c.icons || st === 'none' || st === 'api';
    iconEls[name].classList.toggle('active', c.icons && st === 'open');
  }
  // B1-033: the animation icon exists only when the render contains motion.
  const animSvg = svgEl();
  if (!(animSvg && animSvg.querySelector('.ddn-motion, .ddn-flow'))) iconEls.animation.hidden = true;
  // Drawer open/close resizes the stage; re-fit once the transition settles.
  clearTimeout(state._fitTimer);
  state._fitTimer = setTimeout(() => applyFit(), 220);
}
function setDrawer(name, st, persist) {
  if (!DRAWERS.includes(name) || !DRAWER_STATES.includes(st)) throw new Error('unknown drawer or state: ' + name + ':' + st);
  // B1-049 (D3): `none` is unavailable to everyone — host code must first
  // reconfigure it (closed/api). `api` drawers are exactly the host-openable case.
  if (st === 'open' && state.config.drawers[name] === 'none')
    throw new Error('drawer "' + name + '" is none — unavailable; set it to closed or api before opening');
  state.config.drawers[name] = st;
  applyDrawerConfig();
  if (persist) saveStoredDrawers();
}
function setToolbar(visible) {
  state.config.toolbar = !!visible;
  applyDrawerConfig();
}
function saveStoredDrawers() {
  try { host.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config.drawers)); } catch { /* private mode */ }
}
for (const name of DRAWERS) {
  iconEls[name].addEventListener('click', () => {
    const cur = state.config.drawers[name];
    setDrawer(name, cur === 'open' ? 'closed' : 'open', true);
  });
  drawerEls[name].querySelector('[data-close]').addEventListener('click', () => setDrawer(name, 'closed', true));
}

/* Settings popup: per-drawer open/closed/none selectors persisted to
 * localStorage; URL ?drawers= still wins on the next load (D3). */
function settingsUI() {
  els.settingsRows.replaceChildren(...DRAWERS.map(name => {
    const label = document.createElement('label');
    label.textContent = name[0].toUpperCase() + name.slice(1) + ' drawer ';
    const sel = document.createElement('select');
    sel.dataset.drawer = name;
    for (const st of GEAR_STATES) sel.add(new Option(st, st));
    // B1-049: a host-set `api` state is shown (disabled) but never offered.
    if (!GEAR_STATES.includes(state.config.drawers[name])) {
      const cur = new Option(state.config.drawers[name] + ' (host)', state.config.drawers[name]);
      cur.disabled = true;
      sel.add(cur);
    }
    sel.value = state.config.drawers[name];
    sel.addEventListener('change', () => setDrawer(name, sel.value, false));
    label.append(sel);
    return label;
  }));
}
els.settings.addEventListener('click', () => { settingsUI(); els.settingsPopup.hidden = !els.settingsPopup.hidden; });
$('ddn-settings-close').addEventListener('click', () => { els.settingsPopup.hidden = true; });
$('ddn-settings-save').addEventListener('click', () => { saveStoredDrawers(); els.settingsPopup.hidden = true; status('drawer settings saved in this browser'); });
$('ddn-settings-clear').addEventListener('click', () => {
  try { host.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  state.config = resolveDrawerConfig(new URLSearchParams(location.search).get('mode'), null, new URLSearchParams(location.search).get('drawers'), new URLSearchParams(location.search).get('toolbar'));
  applyDrawerConfig(); settingsUI(); status('saved drawer settings cleared');
});

/* ------------------------------------------------ component mount (D1) */

/* Hide the component's built-in chrome: the unified page supplies the chrome
 * and drives the component through its public surface. The shadow root is
 * open by design (the studio editor attaches drag the same way). */
const BARE_CSS = ':host{height:100%}.top,.tools,.advanced,.viewport-tools,.source,.diagnostics,.status{display:none!important}' +
  '.shell{height:100%;border:0;border-radius:0;display:flex;flex-direction:column}.stage{flex:1;height:auto;min-height:0;padding:8px}.error:empty{display:none}';
function mount() {
  if (state.diagram) state.diagram.destroy();
  state.diagram = null;
  if (!state.entry || !state.view) { els.hint.style.display = ''; return; }
  const diagram = A.mount(els.diagramHost, { workspace: state.ws, entry: state.entry, view: state.view, overrides: toolOverrides(state.presentation), title: state.view });
  state.diagram = diagram;
  diagram.setAttribute('source-hidden', '');
  const bare = document.createElement('style');
  bare.textContent = BARE_CSS;
  diagram.shadowRoot.append(bare);
  state.overrideStyle = document.createElement('style');
  state.overrideStyle.id = 'ddn-tool-overrides';
  diagram.shadowRoot.append(state.overrideStyle);
  diagram.addEventListener('ddn-render-start', () => {
    /* D7: non-blocking busy affordance — the previous picture dims (the
     * component's stale idiom) and the stage spinner shows until the
     * matching ddn-render/ddn-error. */
    els.diagramHost.classList.add('ddn-rendering');
    if (els.busy) els.busy.hidden = false;
  });
  diagram.addEventListener('ddn-render', e => {
    els.diagramHost.classList.remove('ddn-rendering');
    if (els.busy) els.busy.hidden = true;
    els.diagramHost.setAttribute('data-ddn-render-mode', renderMode());
    els.hint.style.display = 'none';
    els.sourceError.textContent = '';
    // Light-DOM render marker: shadow DOM is invisible to --dump-dom and to
    // host-page integration checks, so successful renders are announced here.
    els.diagramHost.setAttribute('data-ddn-rendered', e.detail.fingerprint || 'ok');
    els.diagramHost.setAttribute('data-ddn-render-ms', String(Math.round(e.detail.milliseconds || 0)));
    repopulateOverridePanels();
    applyOverrideCss();
    applyFit();
    attachDrag();
    refreshAnimation();
    status();
  });
  diagram.addEventListener('ddn-error', e => {
    els.diagramHost.classList.remove('ddn-rendering');
    if (els.busy) els.busy.hidden = true;
    els.diagramHost.removeAttribute('data-ddn-rendered');
    els.sourceError.textContent = e.detail.code + ': ' + e.detail.message;
    fail(e.detail.code + ': ' + e.detail.message);
  });
  diagram.addEventListener('ddn-select', e => guard(() => onSelect(e.detail)));
  diagram.addEventListener('ddn-navigate', e => guard(() => navigate(e.detail.view || e.detail.target)));
  diagram.ready.catch(() => {});
  attachPan();
}

function sceneSize() {
  const s = state.diagram && state.diagram.result && state.diagram.result.scene;
  return s ? { w: s.width, h: s.height } : { w: 0, h: 0 };
}
function stageEl() { return state.diagram && state.diagram.shadowRoot.querySelector('.stage'); }
function svgEl() { return state.diagram && state.diagram.shadowRoot.querySelector('.canvas>svg'); }

/* ------------------------------------------------ viewport: fit/zoom/pan */

function currentScale() {
  const svg = svgEl(), { w } = sceneSize();
  if (!svg || !w) return 1;
  return (parseFloat(svg.style.width) || w) / w;
}
function applyFit() {
  const d = state.diagram;
  if (!d || !d.result) return;
  const stage = stageEl();
  const { w, h } = sceneSize();
  if (state.fit === 'page' && state.zoom == null) { d.zoom = 'fit'; d.sizeSVG(); }
  else {
    const z = state.zoom != null ? state.zoom : computeFitScale(state.fit, Math.max(120, stage.clientWidth - 32), Math.max(120, stage.clientHeight - 32), w, h);
    d.zoom = z; d.sizeSVG();
  }
  const pct = Math.round(currentScale() * 100);
  els.zoomPct.textContent = pct + '%';
  els.zoom.value = String(Math.min(300, Math.max(10, pct)));
  for (const [b, m] of [[els.fitPage, 'page'], [els.fitWidth, 'width'], [els.fitHeight, 'height'], [els.fit100, '100']])
    b.classList.toggle('active', state.zoom == null && state.fit === m);
}
function setFit(mode) { state.fit = mode; state.zoom = null; applyFit(); }
function zoomStep(f) { state.zoom = Math.min(8, Math.max(0.05, currentScale() * f)); applyFit(); }
els.fitPage.addEventListener('click', () => setFit('page'));
els.fitWidth.addEventListener('click', () => setFit('width'));
els.fitHeight.addEventListener('click', () => setFit('height'));
els.fit100.addEventListener('click', () => setFit('100'));
els.zoomOut.addEventListener('click', () => zoomStep(1 / 1.25));
els.zoomIn.addEventListener('click', () => zoomStep(1.25));
els.zoom.addEventListener('input', () => { state.zoom = Number(els.zoom.value) / 100; applyFit(); });
host.addEventListener('resize', () => { if (state.diagram) applyFit(); });

/* Pan (D2 — new): pointer-drag anywhere on the stage scrolls the viewport.
 * A drag above 3px suppresses the trailing click so it does not select. */
function attachPan() {
  const stage = stageEl();
  if (!stage || stage.dataset.toolPan) return;
  stage.dataset.toolPan = 'true';
  let pan = null;
  stage.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (els.dragMode.checked && e.target.closest && e.target.closest('.ddn-node[data-id]')) return; // drag-to-pin owns node drags
    pan = { x: e.clientX, y: e.clientY, left: stage.scrollLeft, top: stage.scrollTop, moved: 0 };
  });
  stage.addEventListener('pointermove', e => {
    if (!pan) return;
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    pan.moved = Math.max(pan.moved, Math.hypot(dx, dy));
    if (pan.moved > 3) {
      stage.scrollLeft = pan.left - dx; stage.scrollTop = pan.top - dy;
      state.panning = true;
    }
  });
  const done = () => { pan = null; setTimeout(() => { state.panning = false; }, 0); };
  stage.addEventListener('pointerup', done);
  stage.addEventListener('pointercancel', done);
  stage.addEventListener('click', e => { if (state.panning) { e.stopPropagation(); e.preventDefault(); } }, true);
}

/* ------------------------------------------------ appearance drawer */

function appGroup(title) {
  const g = document.createElement('div');
  g.className = 'ddn-app-group';
  const h = document.createElement('h3'); h.textContent = title;
  g.append(h);
  els.appearanceBody.append(g);
  return g;
}
function field(parent, label, input) {
  const f = document.createElement('label');
  f.className = 'ddn-field';
  const s = document.createElement('span'); s.textContent = label;
  f.append(s, input);
  parent.append(f);
  return input;
}
function selectInput(options, ariaLabel) {
  const sel = document.createElement('select');
  if (ariaLabel) sel.setAttribute('aria-label', ariaLabel);
  for (const [value, label] of options) sel.add(new Option(label, value));
  return sel;
}
const titled = v => [v, v === 'source' ? 'As authored' : v.replace(/_/g, ' ')];

/* Option-field descriptors driven through diagram.setOptions (component
 * render override channel — these reflow correctly). */
const SELECT_FIELDS = [
  ['Style', [
    ['Drawing style', 'look', [['classic', 'Standard'], ['handDrawn', 'Hand-drawn'], ['neo', 'Neo']]],
    ['Palette', 'theme', () => A.choices.theme.map(titled)],
    ['Font role', 'font', () => A.choices.font.map(titled)],
    ['Routing', 'routing', () => A.choices.routing.map(titled)],
    ['Curve tension', 'curveTension', 'number', 0, 1, 0.05],
    ['Curve radius (px)', 'curveRadius', 'number', 0, 512, 1],
    ['Crossings', 'crossings', () => A.choices.crossings.map(titled)],
    ['Endpoint ordering', 'endpointOrdering', () => A.choices.endpointOrdering.map(titled)]
  ]],
  ['Layout', [
    ['Placement', 'placement', () => A.choices.placement.map(titled)],
    ['Auto-place', 'autoPlace', 'checkbox'],
    ['Layout centre', 'center', () => A.choices.center.map(titled)],
    ['Grid step (px)', 'gridStep', 'number', 8, 512, 8],
    ['Base font (px)', 'fontSize', 'number', baseFontFloor(), 64, 1],
    ['Pen roughness', 'roughness', 'number', 0, 3, 0.2],
    ['Hatch shading', 'hachure', 'checkbox']
  ]],
  ['Content', [
    ['Detail', 'fields', () => A.choices.fields.map(titled)],
    ['Field depth (levels)', 'depth', 'number', 0, 64, 1],
    ['Relation labels', 'labels', () => A.choices.labels.map(titled)],
    ['Domain bindings', 'domains', () => A.choices.domains.map(titled)],
    ['Datatypes', 'datatypes', () => A.choices.datatypes.map(titled)],
    ['Kind indicator', 'kind', () => A.choices.kind.map(titled)],
    ['Chart mark', 'mark', () => A.choices.mark.map(titled)]
  ]],
  ['Chrome', [
    ['Legend', 'legend', () => A.choices.legend.map(titled)],
    ['Title block', 'title', () => A.choices.title.map(titled)],
    ['Footer line', 'footer', () => A.choices.footer.map(titled)]
  ]],
  ['Page', [
    ['Page / artboard', 'page', () => A.choices.page.map(titled)],
    ['Width (px)', 'width', 'number', 400, 32000, 100],
    ['Height (px)', 'height', 'number', 400, 32000, 100]
  ]]
];
const optionInputs = {};
for (const [group, fields] of SELECT_FIELDS) {
  const g = appGroup(group);
  for (const [label, key, kind, min, max, step] of fields) {
    let input;
    if (kind === 'checkbox') {
      input = document.createElement('input'); input.type = 'checkbox';
      input.addEventListener('change', () => setOption(key, input.checked));
    } else if (kind === 'number') {
      input = document.createElement('input'); input.type = 'number';
      input.min = min; input.max = max; input.step = step; input.placeholder = 'source';
      input.addEventListener('change', () => setOption(key, input.value === '' ? null : Number(input.value)));
    } else {
      input = selectInput(typeof kind === 'function' ? kind() : kind, label);
      input.addEventListener('change', () => setOption(key, input.value));
    }
    optionInputs[key] = input;
    field(g, label, input);
  }
}
/* Viewport actions + reset live in the appearance drawer too (the toolbar
 * keeps the quick fit/zoom subset). */
{
  const g = appGroup('Viewport');
  const row = document.createElement('div'); row.className = 'ddn-row';
  const mk = (label, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ddn-mini'; b.textContent = label; b.title = title; b.addEventListener('click', () => guard(fn)); row.append(b); return b; };
  mk('Auto-layout now', 'Reflow unpinned elements', () => state.diagram && state.diagram.action('relayout'));
  mk('Centre pins', 'Scroll the pinned group into view', () => state.diagram && state.diagram.action('focus-pins'));
  mk('Reset appearance', 'Clear every presentation override', resetAppearance);
  g.append(row);
}
const coloursGroup = appGroup('Colours — kinds');
const verbsGroup = appGroup('Colours — relation classes');
const typoGroup = appGroup('Typography per kind');
const relationsGroup = appGroup('Routing per relation class');
const selectedGroup = appGroup('Clicked object / relation');

function setOption(key, value) {
  guard(() => {
    /* D2: a base font the renderer must reject (DDN071) is caught here, before
     * any render starts — the stage keeps the last good picture undimmed, the
     * input returns to the last committed value, and the message names the
     * remedy. */
    if (key === 'fontSize' && value != null) {
      const info = state.diagram && state.diagram.info;
      const mt = info && quantityPx(info.profiles.publication && info.profiles.publication.minimum_text, MIN_TEXT_PX);
      const problem = baseFontProblem(value, mt);
      if (problem) {
        const committed = state.presentation.options.fontSize;
        optionInputs.fontSize.value = committed == null ? '' : String(committed);
        els.sourceError.textContent = problem;
        status(problem);
        return;
      }
    }
    if (value == null || value === 'source') delete state.presentation.options[key];
    else state.presentation.options[key] = value;
    if (state.diagram) return state.diagram.setOptions(toolOverrides(state.presentation));
  });
}
function syncOptionInputs() {
  const d = state.diagram, opts = (d && d.options) || {};
  const info = d && d.info;
  for (const [key, input] of Object.entries(optionInputs)) {
    let v = opts[key];
    if (v == null) {
      if (key === 'autoPlace') v = info ? info.profiles.layout.auto_place !== false : true;
      else if (key === 'hachure') v = info ? info.profiles.style.hachure !== false : true;
      else if (key === 'width') v = 1600; else if (key === 'height') v = 1000;
      else v = input.type === 'number' ? '' : 'source';
    }
    if (input.type === 'checkbox') input.checked = !!v; else input.value = String(v);
    const caps = d && d.capabilities;
    const locked = !!(caps && (caps.sequence || caps.graphControls === false) && !['theme', 'font', 'fontSize', 'look', 'mark', 'page', 'width', 'height', 'roughness', 'hachure', 'legend', 'title', 'footer'].includes(key));
    input.disabled = locked;
    if (locked) input.title = 'Locked: this projection fixes coordinates and content.';
    else input.title = '';
    if (key === 'mark') input.disabled = !(caps && caps.projection === 'chart');
    if (key === 'width' || key === 'height') input.disabled = (opts.page !== 'custom') || !!(caps && caps.sequence);
    /* D2: the base-font floor follows the source's publication.minimum_text
     * (default 8pt ≈ 10.67px) so sources that relax the rule can use smaller fonts. */
    if (key === 'fontSize') {
      const mt = info && quantityPx(info.profiles.publication && info.profiles.publication.minimum_text, MIN_TEXT_PX);
      input.min = String(baseFontFloor(mt));
    }
  }
}

/* CSS-overlay panels (per-kind/verb/object colours, per-kind typography,
 * per-verb routing) — repopulated from the resolved model after each render. */
function colourRow(labelText, code, current, onPick, onClear) {
  const row = document.createElement('div'); row.className = 'ddn-colour-row';
  const lab = document.createElement('span'); lab.className = 'ddn-colour-label'; lab.textContent = labelText; lab.title = labelText;
  const inp = document.createElement('input'); inp.type = 'color'; inp.value = current || '#888888';
  inp.setAttribute('aria-label', 'colour override for ' + labelText);
  inp.addEventListener('input', () => onPick(code, inp.value));
  const clr = document.createElement('button'); clr.type = 'button'; clr.className = 'ddn-mini'; clr.textContent = 'clear';
  clr.addEventListener('click', () => onClear(code));
  row.append(lab, inp, clr);
  return row;
}
const familyOptions = () => [['source', 'source default']].concat(Object.entries(FONT_STACKS).map(([k, stack]) => [k, k + ' — ' + stack.split(',')[0]]));
const sizeOptions = () => [['source', 'source default'], ['8', '8 px'], ['9', '9 px'], ['10', '10 px'], ['11', '11 px'], ['12', '12 px'], ['14', '14 px'], ['16', '16 px'], ['18', '18 px'], ['20', '20 px'], ['24', '24 px']];
const routingOptions = () => [['source', 'default']].concat(ROUTING_VALUES.map(v => [v, v]));

function typographyRow(labelText, code) {
  const row = document.createElement('div'); row.className = 'ddn-colour-row';
  const lab = document.createElement('span'); lab.className = 'ddn-colour-label'; lab.textContent = labelText; lab.title = labelText;
  const cur = state.presentation.typography[code] || { family: 'source', size: 'source' };
  const fam = selectInput(familyOptions(), 'font family for ' + labelText); fam.value = cur.family || 'source';
  const siz = selectInput(sizeOptions(), 'font size for ' + labelText); siz.value = String(cur.size || 'source');
  const update = () => {
    if (fam.value === 'source' && siz.value === 'source') delete state.presentation.typography[code];
    else state.presentation.typography[code] = { family: fam.value, size: siz.value };
    applyOverrideCss();
  };
  fam.addEventListener('change', update); siz.addEventListener('change', update);
  const clr = document.createElement('button'); clr.type = 'button'; clr.className = 'ddn-mini'; clr.textContent = 'clear';
  clr.addEventListener('click', () => { delete state.presentation.typography[code]; repopulateOverridePanels(); applyOverrideCss(); });
  row.append(lab, fam, siz, clr);
  return row;
}
function verbRoutingRow(labelText, keyword) {
  const row = document.createElement('div'); row.className = 'ddn-colour-row';
  const lab = document.createElement('span'); lab.className = 'ddn-colour-label'; lab.textContent = labelText; lab.title = labelText;
  const sel = selectInput(routingOptions(), 'routing for ' + labelText);
  sel.value = state.presentation.verbRouting[keyword] || 'source';
  sel.addEventListener('change', () => {
    if (sel.value === 'source') delete state.presentation.verbRouting[keyword];
    else state.presentation.verbRouting[keyword] = sel.value;
    rerender();
  });
  const clr = document.createElement('button'); clr.type = 'button'; clr.className = 'ddn-mini'; clr.textContent = 'clear';
  clr.addEventListener('click', () => { delete state.presentation.verbRouting[keyword]; repopulateOverridePanels(); rerender(); });
  row.append(lab, sel, clr);
  return row;
}
function dim(note) { const p = document.createElement('p'); p.className = 'ddn-dim'; p.textContent = note; return p; }

function repopulateOverridePanels() {
  syncOptionInputs();
  let ir = null;
  try { ir = state.ws.resolve(state.entry, state.view); } catch { ir = null; }
  const kindByKeyword = new Map(A.kinds.map(k => [k.id, k]));
  const verbByKeyword = new Map(A.relations.map(r => [r.id, r]));
  const kinds = new Map(), verbs = new Map();
  if (ir) {
    const shown = new Set(ir.view.selected);
    for (const el of ir.elements || []) {
      if (!shown.has(el.id)) continue;
      const k = kindByKeyword.get(el.kind || (el.properties && el.properties.kind));
      if (k && !kinds.has(k.code)) kinds.set(k.code, k.label);
    }
    const relShown = new Set(ir.view.relations);
    for (const rel of ir.relations || []) {
      if (!relShown.has(rel.id)) continue;
      const v = verbByKeyword.get(rel.kind);
      if (v && !verbs.has(v.id)) verbs.set(v.id, v);
    }
  }
  coloursGroup.replaceChildren(...[...kinds].sort().map(([code, label]) =>
    colourRow(label + ' (' + code + ')', code, state.presentation.kindColours[code],
      (c, col) => { state.presentation.kindColours[c] = col; applyOverrideCss(); },
      c => { delete state.presentation.kindColours[c]; repopulateOverridePanels(); applyOverrideCss(); })));
  if (!kinds.size) coloursGroup.append(dim('none in this view'));
  verbsGroup.replaceChildren(...[...verbs].sort((a, b) => a[1].code < b[1].code ? -1 : 1).map(([keyword, v]) =>
    colourRow(v.label + ' (' + v.code + ')', v.code, state.presentation.verbColours[v.code],
      (c, col) => { state.presentation.verbColours[c] = col; applyOverrideCss(); },
      c => { delete state.presentation.verbColours[c]; repopulateOverridePanels(); applyOverrideCss(); })));
  if (!verbs.size) verbsGroup.append(dim('none in this view'));
  typoGroup.replaceChildren(...[...kinds].sort().map(([code, label]) => typographyRow(label + ' (' + code + ')', code)));
  if (!kinds.size) typoGroup.append(dim('none in this view'));
  relationsGroup.replaceChildren(...[...verbs].sort((a, b) => a[1].code < b[1].code ? -1 : 1).map(([keyword, v]) => verbRoutingRow(v.label + ' (' + keyword + ')', keyword)));
  if (!verbs.size) relationsGroup.append(dim('none in this view'));
  updateSelectedPanel();
}

function updateSelectedPanel() {
  const rows = [];
  if (state.selected) {
    rows.push(colourRow('Object ' + state.selected, state.selected, state.presentation.objectColours[state.selected],
      (id, col) => { state.presentation.objectColours[id] = col; applyOverrideCss(); },
      id => { delete state.presentation.objectColours[id]; updateSelectedPanel(); applyOverrideCss(); }));
  }
  if (state.selectedRelation) {
    const row = document.createElement('div'); row.className = 'ddn-colour-row';
    const lab = document.createElement('span'); lab.className = 'ddn-colour-label'; lab.textContent = 'Relation ' + state.selectedRelation; lab.title = state.selectedRelation;
    const sel = selectInput(routingOptions(), 'routing for relation ' + state.selectedRelation);
    sel.value = state.presentation.relationRouting[state.selectedRelation] || 'source';
    sel.addEventListener('change', () => {
      if (sel.value === 'source') delete state.presentation.relationRouting[state.selectedRelation];
      else state.presentation.relationRouting[state.selectedRelation] = sel.value;
      rerender();
    });
    const clr = document.createElement('button'); clr.type = 'button'; clr.className = 'ddn-mini'; clr.textContent = 'clear';
    clr.addEventListener('click', () => { delete state.presentation.relationRouting[state.selectedRelation]; updateSelectedPanel(); rerender(); });
    row.append(lab, sel, clr);
    rows.push(row);
  }
  if (!rows.length) rows.push(dim('click an object or relation in the diagram'));
  selectedGroup.replaceChildren(...rows);
}

function applyOverrideCss() {
  if (!state.overrideStyle) return;
  state.overrideStyle.textContent = overrideCss(state.presentation, state.selectedRelation);
  const p = state.presentation;
  const n = Object.keys(p.kindColours).length + Object.keys(p.verbColours).length + Object.keys(p.objectColours).length + Object.keys(p.typography).length;
  if (n) status(n + ' CSS override(s) active');
}
function rerender() {
  if (!state.diagram) return;
  guard(() => state.diagram.setOptions(toolOverrides(state.presentation)));
}
function resetAppearance() {
  state.presentation = emptyPresentation();
  state.selected = null; state.selectedRelation = null;
  state.fit = 'page'; state.zoom = null;
  if (state.diagram) {
    state.diagram.options = {};
    state.diagram.action('reset');
  }
  repopulateOverridePanels(); applyOverrideCss();
  status('appearance reset');
}

/* ------------------------------------------------ selection + inspector */

function onSelect(detail) {
  if (state.panning) return;
  const id = detail.sourceIds && detail.sourceIds.length === 1 ? detail.sourceIds[0] : (detail.sourceId || detail.id);
  let ir = null;
  try { ir = state.ws.resolve(state.entry, state.view); } catch { ir = null; }
  const relation = ir && ir.relations.find(r => r.id === id);
  if (relation) {
    state.selectedRelation = relation.id;
    state.selected = null;
    status('selected relation ' + relation.id);
  } else {
    state.selected = id;
    state.selectedRelation = null;
    status('selected ' + id);
  }
  applyOverrideCss();
  updateSelectedPanel();
  inspector(id, ir, relation);
}

function inspector(id, ir, relation) {
  if (!ir) return;
  const node = ir.elements.find(n => n.id === id);
  const fieldItem = ir.elements.flatMap(n => n.fields || []).find(f => f.id === id);
  const item = node || relation || fieldItem;
  if (!item) { els.inspectorControls.hidden = true; els.selectionSummary.textContent = 'Click an object or relation in the diagram.'; return; }
  els.inspectorControls.hidden = false;
  els.selectionSummary.textContent = item.name + ' · ' + (relation ? 'relationship' : fieldItem ? 'field' : node.kind) + ' — ' + id;
  els.labelValue.value = item.name || '';
  const choices = relation ? A.relations : A.kinds;
  els.kindValue.replaceChildren(...choices.map(k => new Option(k.label, k.id)));
  els.kindValue.value = item.kind || '';
  els.kindValue.disabled = els.setKind.disabled = !!fieldItem;
  const g = state.diagram && state.diagram.result && state.diagram.result.scene.nodes && state.diagram.result.scene.nodes.find(n => n.id === id);
  els.posX.value = g ? Math.round(g.x) : 0;
  els.posY.value = g ? Math.round(g.y) : 0;
  const noGraph = state.diagram && state.diagram.capabilities && state.diagram.capabilities.graphControls === false;
  for (const b of [els.pin, els.unpin, els.hide]) b.disabled = !node || noGraph;
  els.addField.disabled = !!relation;
}

function guided(action) {
  flush();
  action();
  showSource(state.currentFile);
  updateHistory();
  status('source edit applied — undo restores the previous source');
}
els.setLabel.addEventListener('click', () => guard(() => guided(() => A.authoring.setLabel(state.ws, state.entry, state.view, state.selected || state.selectedRelation, els.labelValue.value))));
els.setKind.addEventListener('click', () => guard(() => guided(() => A.authoring.setProperty(state.ws, state.entry, state.view, state.selected || state.selectedRelation, 'kind', els.kindValue.value))));
els.pin.addEventListener('click', () => guard(() => guided(() => A.authoring.pin(state.ws, state.entry, state.view, state.selected, Number(els.posX.value), Number(els.posY.value)))));
els.unpin.addEventListener('click', () => guard(() => guided(() => A.authoring.unpin(state.ws, state.entry, state.view, state.selected))));
els.hide.addEventListener('click', () => guard(() => guided(() => A.authoring.hide(state.ws, state.entry, state.view, state.selected))));
els.goSource.addEventListener('click', () => guard(() => {
  const s = A.authoring.sourceOf(state.ws, state.entry, state.view, state.selected || state.selectedRelation);
  setDrawer('source', 'open', true);
  showSource(s.file, s);
}));
els.deleteDef.addEventListener('click', () => guard(() => {
  if (confirm('Delete this semantic definition? Referenced definitions are blocked; use Hide for appearance-only removal.'))
    guided(() => A.authoring.deleteDefinition(state.ws, state.entry, state.view, state.selected || state.selectedRelation));
}));
els.addField.addEventListener('click', () => guard(() => {
  const id = prompt('Stable field identifier', 'new_field');
  if (!id) return;
  const name = prompt('Display name (optional)', '') || '';
  guided(() => A.authoring.addField(state.ws, state.entry, state.view, state.selected, { id, name }));
}));
els.addElement.addEventListener('click', () => guard(() => {
  const id = prompt('Stable identifier', 'new_element');
  if (!id) return;
  const name = prompt('Display name', 'New element') || id;
  const kind = prompt('Object kind keyword (' + A.kinds.slice(0, 6).map(k => k.id).join(', ') + ', …)', 'object');
  if (!kind) return;
  guided(() => A.authoring.addElement(state.ws, state.entry, state.view, { id, name, kind }));
}));
els.addRelation.addEventListener('click', () => guard(() => {
  flush();
  const ir = state.ws.resolve(state.entry, state.view);
  const ids = ir.elements.map(n => n.id);
  const id = prompt('Stable relation identifier', 'new_relation');
  if (!id) return;
  const name = prompt('Displayed description', 'Related to') || id;
  const from = prompt('Source endpoint id (' + ids.slice(0, 4).join(', ') + ', …)', ids[0] || '');
  if (!from) return;
  const to = prompt('Destination endpoint id', ids[1] || ids[0] || '');
  if (!to) return;
  const kind = prompt('Relationship kind keyword (' + A.relations.slice(0, 6).map(k => k.id).join(', ') + ', …)', 'assoc');
  if (!kind) return;
  guided(() => A.authoring.addRelation(state.ws, state.entry, state.view, { id, name, kind, from, to }));
}));

/* Drag-to-pin on the stage (ported from the studio editor): with the toolbar
 * toggle on, dragging a node pins its new position into the source. */
function attachDrag() {
  const diagram = state.diagram;
  const canvas = diagram && diagram.shadowRoot.querySelector('.canvas');
  if (!canvas || canvas.dataset.toolDrag) return;
  canvas.dataset.toolDrag = 'true';
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    if (!els.dragMode.checked || e.button !== 0) return;
    const el = e.target.closest('.ddn-node[data-id]');
    const g = diagram.result && diagram.result.scene.nodes && diagram.result.scene.nodes.find(n => n.id === (el && el.dataset.id));
    const drawing = el && el.closest('svg') && el.closest('svg').querySelector('g[id$="drawing"]');
    if (!el || !g || !drawing || diagram.capabilities.sequence || diagram.capabilities.graphControls === false) return;
    const inv = drawing.getScreenCTM() && drawing.getScreenCTM().inverse();
    if (!inv) return;
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(inv);
    drag = { el, g, id: g.id, start: point, dx: 0, dy: 0 };
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const inv = drawingInv(drag.el);
    if (!inv) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(inv);
    drag.dx = p.x - drag.start.x; drag.dy = p.y - drag.start.y;
    drag.el.setAttribute('transform', 'translate(' + drag.dx + ' ' + drag.dy + ')');
  });
  function drawingInv(el) {
    const drawing = el.closest('svg') && el.closest('svg').querySelector('g[id$="drawing"]');
    return drawing && drawing.getScreenCTM() && drawing.getScreenCTM().inverse();
  }
  const finish = (e, cancel) => {
    if (!drag) return;
    const d = drag; drag = null;
    d.el.removeAttribute('transform');
    if (!cancel && Math.hypot(d.dx, d.dy) > 2) guard(() => {
      flush();
      A.authoring.pin(state.ws, state.entry, state.view, d.id, d.g.x + d.dx, d.g.y + d.dy);
      showSource(state.currentFile);
      state.selected = d.id;
      status('pinned occurrence in source — undo restores the previous source');
    });
  };
  canvas.addEventListener('pointerup', e => finish(e));
  canvas.addEventListener('pointercancel', e => finish(e, true));
}
els.dragMode.addEventListener('change', () => {
  if (els.dragMode.checked && state.diagram && state.diagram.capabilities && (state.diagram.capabilities.sequence || state.diagram.capabilities.graphControls === false)) {
    els.dragMode.checked = false;
    status('drag-to-pin is unavailable in this projection');
  }
});

/* ------------------------------------------------ animation drawer (B1-033, D5)
 * SMIL playback controls over the rendered SVG. Default state is playing;
 * the pause choice is kept in memory for this session only (never persisted).
 * prefers-reduced-motion auto-pauses. The drawer body reports "No animation
 * in this view" — and the toolbar icon hides — when the render has no
 * .ddn-motion/.ddn-flow groups. */
const anim = { playing: true, userChoice: false, speed: 1, baseDurs: new WeakMap(), flows: [], selectedFlow: '' };

function reducedMotion() {
  try { return host.matchMedia && host.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/* Re-derive controller state from the freshly rendered SVG: base durations,
 * flow list, icon visibility. Re-applies the session pause/speed choice. */
function refreshAnimation() {
  const svg = svgEl();
  const motionEls = svg ? [...svg.querySelectorAll('.ddn-motion, .ddn-flow')] : [];
  const hasMotion = motionEls.length > 0;
  els.animEmpty.hidden = hasMotion;
  els.animControls.hidden = !hasMotion;
  // The icon is hidden when there is no animation to drive; a configured
  // 'open' state still applies once motion appears.
  iconEls.animation.hidden = !state.config.icons || state.config.drawers.animation === 'none' || !hasMotion;
  if (!hasMotion) { anim.flows = []; anim.selectedFlow = ''; return; }
  for (const el of svg.querySelectorAll('animateMotion, animate')) {
    if (!anim.baseDurs.has(el)) {
      const m = /^([0-9.]+)s$/.exec(el.getAttribute('dur') || '');
      if (m) anim.baseDurs.set(el, Number(m[1]));
    }
  }
  anim.flows = [...svg.querySelectorAll('.ddn-flow[data-flow]')].map(g => ({
    id: g.getAttribute('data-flow'),
    name: (g.querySelector('title') && g.querySelector('title').textContent) || g.getAttribute('data-flow'),
    dur: Number(g.getAttribute('data-dur')) || 0
  }));
  if (!anim.flows.some(f => f.id === anim.selectedFlow)) anim.selectedFlow = anim.flows.length ? anim.flows[0].id : '';
  els.animFlow.replaceChildren(...anim.flows.map(f => new Option(f.name + ' (' + f.dur.toFixed(2) + ' s cycle)', f.id)));
  els.animFlow.value = anim.selectedFlow;
  els.animFlowField.hidden = anim.flows.length < 2;
  applyAnimSpeed();
  applyAnimPlaying();
  animStatus();
}
function animStatus(note) {
  const parts = [];
  if (anim.flows.length) parts.push(anim.flows.length + ' flow' + (anim.flows.length > 1 ? 's' : ''));
  parts.push(anim.playing ? 'playing at ' + anim.speed + '×' : 'paused');
  els.animStatus.textContent = (note ? note + ' — ' : '') + parts.join(' · ');
}
function applyAnimPlaying() {
  const svg = svgEl();
  if (!svg) return;
  if (anim.playing) { if (svg.unpauseAnimations) svg.unpauseAnimations(); }
  else if (svg.pauseAnimations) svg.pauseAnimations();
  els.animToggle.textContent = anim.playing ? 'Pause' : 'Play';
}
function applyAnimSpeed() {
  const svg = svgEl();
  if (!svg) return;
  for (const el of svg.querySelectorAll('animateMotion, animate')) {
    const base = anim.baseDurs.get(el);
    if (base) el.setAttribute('dur', scaledDuration(base, anim.speed) + 's');
  }
}
els.animToggle.addEventListener('click', () => guard(() => {
  anim.playing = !anim.playing;
  anim.userChoice = true; // session-only, never persisted (D5)
  applyAnimPlaying();
  animStatus();
}));
els.animSpeed.addEventListener('change', () => guard(() => {
  anim.speed = Number(els.animSpeed.value);
  applyAnimSpeed();
  animStatus();
}));
els.animFlow.addEventListener('change', () => { anim.selectedFlow = els.animFlow.value; animStatus(); });
/* Step: pauses playback and seeks (setCurrentTime) exactly one hop forward.
 * With a selected flow the hop boundaries come from its data-hop markers;
 * without flows, one step is one full traversal of the longest motion route. */
els.animStep.addEventListener('click', () => guard(() => {
  const svg = svgEl();
  if (!svg || !svg.setCurrentTime) return;
  anim.playing = false;
  applyAnimPlaying();
  const now = svg.getCurrentTime();
  if (anim.selectedFlow) {
    const group = svg.querySelector('.ddn-flow[data-flow="' + cssString(anim.selectedFlow) + '"]');
    const flow = anim.flows.find(f => f.id === anim.selectedFlow);
    const windows = hopWindowsFromMarkers([...group.querySelectorAll('[data-hop-start]')].map(el => ({
      hop: Number(el.getAttribute('data-hop')),
      start: Number(el.getAttribute('data-hop-start')),
      end: Number(el.getAttribute('data-hop-end'))
    })));
    const cycle = now % flow.dur;
    const target = nextHopTime(cycle, windows);
    svg.setCurrentTime(now - cycle + target + (target <= cycle ? flow.dur : 0));
    animStatus('stepped to hop boundary ' + target.toFixed(2) + ' s of ' + flow.name);
  } else {
    const durs = [...svg.querySelectorAll('.ddn-motion[data-dur]')].map(el => Number(el.getAttribute('data-dur'))).filter(d => d > 0);
    if (!durs.length) return;
    const longest = Math.max(...durs);
    svg.setCurrentTime(now - (now % longest) + longest);
    animStatus('stepped one full traversal of the longest route (' + longest.toFixed(2) + ' s)');
  }
}));

/* ------------------------------------------------ loading / workspace */

function catalogueClosure(file) {
  const out = Object.create(null);
  const load = n => {
    if (Object.prototype.hasOwnProperty.call(out, n)) return;
    if (!Object.prototype.hasOwnProperty.call(DATA.files, n)) throw new Error('Missing example dependency: ' + n);
    out[n] = DATA.files[n];
    for (const imp of A.parse(out[n], n).imports) load(A.resolvePath(n, imp.path));
  };
  load(file);
  return out;
}

function dirty() {
  return state.bufferDirty
    || Object.entries((state.ws && state.ws.getFiles()) || {}).some(([p, t]) => state.saved[p] !== t)
    || Object.keys(state.saved).some(p => !state.ws || !Object.prototype.hasOwnProperty.call(state.ws.getFiles(), p));
}
function updateHistory() {
  const h = state.ws && state.ws.history();
  els.undo.disabled = !h || !h.canUndo;
  els.redo.disabled = !h || !h.canRedo;
}

function entriesUI(preferredView) {
  const list = viewListFrom(state.ws.entries());
  state.viewList = list;
  els.picker.replaceChildren(...list.map((v, i) => new Option(v.label, String(i))));
  let idx = list.findIndex(v => v.entry === state.entry && (preferredView ? v.view === preferredView : v.view === state.view));
  if (idx < 0) idx = list.findIndex(v => v.entry === state.entry);
  if (idx < 0) idx = 0;
  if (list.length) {
    els.picker.value = String(idx);
    state.entry = list[idx].entry;
    state.view = list[idx].view;
  } else { state.entry = ''; state.view = ''; }
}
els.picker.addEventListener('change', () => guard(() => {
  flush();
  const v = state.viewList[+els.picker.value];
  if (!v) return;
  state.entry = v.entry; state.view = v.view;
  mount();
  syncUrl();
}));

function filesUI() {
  const fs = state.ws.getFiles();
  els.fileCount.textContent = '(' + Object.keys(fs).length + ')';
  els.fileList.replaceChildren(...Object.keys(fs).sort().map(n => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.textContent = n; b.title = n;
    b.className = n === state.currentFile ? 'selected' : '';
    b.addEventListener('click', () => guard(() => { setDrawer('source', 'open', true); showSource(n); }));
    li.append(b);
    return li;
  }));
  els.sourceFile.replaceChildren(...Object.keys(fs).sort().map(n => new Option(n, n)));
  if (Object.prototype.hasOwnProperty.call(fs, state.currentFile)) els.sourceFile.value = state.currentFile;
}

function showSource(file, range) {
  flush();
  const fs = state.ws.getFiles();
  if (!Object.prototype.hasOwnProperty.call(fs, file)) return;
  state.currentFile = file;
  els.sourceFile.value = file;
  els.source.value = fs[file];
  state.bufferDirty = false;
  els.dirty.textContent = '';
  if (range) {
    els.source.focus();
    els.source.setSelectionRange(range.start, range.end);
    const lines = els.source.value.slice(0, range.start).split('\n').length;
    els.source.scrollTop = Math.max(0, (lines - 3) * 19);
  }
  filesUI();
}
function flush() {
  clearTimeout(timer);
  if (state.ws && state.bufferDirty && state.currentFile) {
    state.bufferDirty = false;
    state.ws.updateFiles({ [state.currentFile]: els.source.value });
    els.dirty.textContent = 'In memory · download to save';
  }
}
els.source.addEventListener('input', () => {
  state.bufferDirty = true;
  els.dirty.textContent = 'Unapplied edits';
  clearTimeout(timer);
  if (els.liveApply.checked) timer = setTimeout(() => guard(flush), 450);
});
els.source.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); els.apply.click(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); guard(downloadCurrentFile); }
  if (e.key === 'Tab') {
    e.preventDefault();
    const t = e.target, start = t.selectionStart;
    t.setRangeText('    ', start, t.selectionEnd, 'end');
    t.dispatchEvent(new Event('input'));
  }
});
els.sourceFile.addEventListener('change', () => guard(() => showSource(els.sourceFile.value)));
els.apply.addEventListener('click', () => guard(() => {
  flush();
  const before = state.entry + '#' + state.view;
  entriesUI(state.view);
  if (before !== state.entry + '#' + state.view) mount();
  else { state.diagram.ready = state.diagram.redraw(); state.diagram.ready.catch(() => {}); }
  updateHistory();
}));
els.discard.addEventListener('click', () => guard(() => showSource(state.currentFile)));
els.undo.addEventListener('click', () => guard(() => { flush(); state.ws.undo(); entriesUI(state.view); showSource(Object.prototype.hasOwnProperty.call(state.ws.getFiles(), state.currentFile) ? state.currentFile : Object.keys(state.ws.getFiles())[0]); updateHistory(); }));
els.redo.addEventListener('click', () => guard(() => { flush(); state.ws.redo(); entriesUI(state.view); showSource(Object.prototype.hasOwnProperty.call(state.ws.getFiles(), state.currentFile) ? state.currentFile : Object.keys(state.ws.getFiles())[0]); updateHistory(); }));
els.find.addEventListener('click', () => {
  const q = prompt('Find text', state.search);
  if (q === null || !q) return;
  state.search = q;
  const t = els.source, at = t.value.indexOf(q, t.selectionEnd), pos = at >= 0 ? at : t.value.indexOf(q);
  if (pos < 0) { status('text not found'); return; }
  t.focus(); t.setSelectionRange(pos, pos + q.length);
});
els.replace.addEventListener('click', () => {
  const q = prompt('Exact text to replace', state.search);
  if (!q) return;
  const to = prompt('Replace with', '');
  if (to === null) return;
  const matches = els.source.value.split(q).length - 1;
  if (!matches) { status('no matches'); return; }
  if (!confirm('Replace all ' + matches + ' exact text occurrences in the current file? This is text editing, not identifier refactoring.')) return;
  els.source.value = els.source.value.split(q).join(to);
  els.source.dispatchEvent(new Event('input'));
});
els.goto.addEventListener('click', () => {
  const n = Number(prompt('Line number', '1'));
  if (!Number.isInteger(n) || n < 1) return;
  const t = els.source, lines = t.value.split('\n'), at = lines.slice(0, n - 1).reduce((x, l) => x + l.length + 1, 0);
  t.focus();
  t.setSelectionRange(Math.min(at, t.value.length), Math.min(at, t.value.length));
  t.scrollTop = Math.max(0, (n - 4) * 19);
});

function load(files, entry, view, options) {
  flush();
  if (state.diagram) state.diagram.destroy();
  if (unsubscribe) unsubscribe();
  if (state.ws) state.ws.destroy();
  state.ws = A.createWorkspace(files);
  state.currentFile = '';
  state.bufferDirty = false;
  state.selected = null; state.selectedRelation = null;
  state.presentation = emptyPresentation();
  state.entry = entry || '';
  state.view = view || '';
  state.saved = { ...files };
  unsubscribe = state.ws.subscribe(() => { filesUI(); updateHistory(); });
  entriesUI(view);
  filesUI();
  showSource(Object.prototype.hasOwnProperty.call(files, state.entry) ? state.entry : Object.keys(files)[0]);
  els.inspectorControls.hidden = true;
  els.selectionSummary.textContent = 'Click an object or relation in the diagram.';
  mount();
  updateHistory();
  repopulateOverridePanels();
  status('opened ' + Object.keys(files).length + ' file(s) — nothing leaves this page');
}

function loadExample(index) {
  const ex = DATA.catalogue.entries[index];
  if (!ex) throw new Error('Example not found.');
  if (dirty() && !confirm('Replace this workspace? Download unsaved changes first.')) return;
  state.catalogueIndex = index;
  load(catalogueClosure(ex.entry), ex.entry, ex.view);
  syncUrl();
}

/* Catalogue picker (files drawer). */
function catalogueUI() {
  const q = els.catalogueSearch.value.toLowerCase();
  const rows = DATA.catalogue.entries.map((e, i) => ({ ...e, i }))
    .filter(e => !q || (e.title + ' ' + e.entry + ' ' + e.view + ' ' + (e.collection || '')).toLowerCase().includes(q));
  els.catalogue.replaceChildren(...rows.map(e => new Option(e.title + ' · ' + (e.collection || e.entry), String(e.i))));
  if (state.catalogueIndex >= 0 && rows.some(e => e.i === state.catalogueIndex)) els.catalogue.value = String(state.catalogueIndex);
}
els.catalogueSearch.addEventListener('input', catalogueUI);
els.catalogue.addEventListener('change', () => guard(() => loadExample(Number(els.catalogue.value))));

function navigate(target) {
  if (!target) return;
  // Child view in the same workspace (component ddn-navigate contract).
  for (const en of state.ws.entries()) {
    const doc = state.ws.analyze(en.file);
    for (const sec of doc.sections || []) {
      const vv = sec.declarations.find(n => n.type === 'view' && (sec.module + '::' + n.id === target || n.id === target));
      if (vv) { state.entry = en.file; state.view = vv.id; entriesUI(vv.id); mount(); syncUrl(); return; }
    }
  }
  const i = DATA.catalogue.entries.findIndex(x => target === x.module + '::' + x.view || x.entry === state.entry && target === x.view);
  if (i >= 0) loadExample(i);
  else status('linked view not present in this workspace: ' + target);
}

/* URL sync (D5): keep ?entry=&view= shareable like the studio gallery. */
function syncUrl() {
  try {
    const p = new URLSearchParams(location.search);
    p.delete('src');
    p.set('entry', state.entry);
    p.set('view', state.view);
    history.replaceState(null, '', '?' + p.toString());
  } catch { /* file:// */ }
}

/* ------------------------------------------------ files drawer I/O */

async function openFiles(input, directory) {
  const result = await A.io.open(input, { directory });
  if (state.mergeNext) {
    flush();
    const old = state.ws.getFiles(), collisions = Object.keys(result.files).filter(f => Object.prototype.hasOwnProperty.call(old, f));
    if (collisions.length && !confirm('Replace these existing source files?\n' + collisions.join('\n'))) return;
    state.ws.updateFiles(result.files);
    entriesUI(state.view);
    showSource(Object.keys(result.files)[0]);
    updateHistory();
    status('added ' + Object.keys(result.files).length + ' source file(s); ' + result.ignored.length + ' non-source items ignored');
  } else {
    if (dirty() && !confirm('Replace current workspace? Download unsaved changes first.')) return;
    state.catalogueIndex = -1;
    load(result.files, result.snapshot.entry, result.snapshot.view);
    if (result.ignored.length) status('opened workspace; ' + result.ignored.length + ' non-source files ignored');
  }
  state.mergeNext = false;
}
els.open.addEventListener('click', () => { state.mergeNext = false; els.fileInput.value = ''; els.fileInput.click(); });
els.merge.addEventListener('click', () => { state.mergeNext = true; els.fileInput.value = ''; els.fileInput.click(); });
els.openFolder.addEventListener('click', () => { state.mergeNext = false; els.folderInput.value = ''; els.folderInput.click(); });
els.fileInput.addEventListener('change', () => guard(() => openFiles(els.fileInput.files)));
els.folderInput.addEventListener('change', () => guard(() => openFiles(els.folderInput.files, true)));
els.newProject.addEventListener('click', () => {
  if (!dirty() || confirm('Replace current workspace? Download unsaved changes first.')) {
    state.catalogueIndex = -1;
    load({ 'main.ddn': freshSource }, 'main.ddn', 'overview');
  }
});
els.fileNew.addEventListener('click', () => guard(() => {
  const path = prompt('Workspace-relative filename', 'data/new.ddn');
  if (!path) return;
  A.pathChecked(path);
  if (Object.prototype.hasOwnProperty.call(state.ws.getFiles(), path)) throw new Error('File exists.');
  const m = 'user.' + path.replace(/[^A-Za-z0-9]/g, '_');
  state.ws.updateFiles({ [path]: 'ddn "0.5";\nmodule "' + m + '";\n\ndata model {\n    // Add definitions here.\n}\n' });
  setDrawer('source', 'open', true);
  showSource(path);
  updateHistory();
}));
els.fileRename.addEventListener('click', () => guard(() => {
  flush();
  const path = prompt('New workspace-relative path', state.currentFile);
  if (!path || path === state.currentFile) return;
  const old = state.currentFile;
  state.ws.renameFile(old, path);
  if (state.entry === old) state.entry = path;
  entriesUI(state.view);
  showSource(path);
  mount();
}));
els.fileDelete.addEventListener('click', () => guard(() => {
  flush();
  if (!confirm('Delete ' + state.currentFile + ' from this in-memory workspace?')) return;
  state.ws.removeFile(state.currentFile, { force: true });
  const first = Object.keys(state.ws.getFiles())[0] || '';
  entriesUI(state.view);
  if (first) showSource(first); else els.source.value = '';
  mount();
}));

function downloadCurrentFile() {
  flush();
  A.io.download(state.currentFile.split('/').at(-1), state.ws.getFiles()[state.currentFile]);
  state.saved[state.currentFile] = state.ws.getFiles()[state.currentFile];
  status('downloaded ' + state.currentFile + ' — imports remain separate; use the workspace ZIP for the complete design');
}
els.downloadFile.addEventListener('click', () => guard(downloadCurrentFile));
function snapshot() {
  flush();
  return state.ws.snapshot(state.entry, state.view, (state.diagram && state.diagram.getState().overrides) || {},
    state.diagram && state.diagram.result && state.diagram.result.scene.layout && state.diagram.result.scene.layout.autoPlace === false ? state.diagram._layoutState : null);
}
els.downloadZip.addEventListener('click', () => guard(() => {
  A.io.download('design.ddn-workspace.zip', A.io.toZIP(snapshot()), 'application/zip');
  state.saved = state.ws.getFiles();
  status('downloaded the complete workspace ZIP');
}));
els.downloadJson.addEventListener('click', () => guard(() => {
  A.io.download('design.ddn-workspace.json', A.io.toJSON(snapshot()), 'application/json');
  state.saved = state.ws.getFiles();
  status('downloaded the complete workspace JSON');
}));
els.loadPaste.addEventListener('click', () => guard(() => {
  const t = els.paste.value.trim();
  if (!t) throw new Error('paste a .ddn source first');
  if (dirty() && !confirm('Replace current workspace? Download unsaved changes first.')) return;
  state.catalogueIndex = -1;
  load({ 'pasted.ddn': els.paste.value }, 'pasted.ddn');
}));

/* Drop anywhere (viewer parity). */
for (const ev of ['dragover', 'drop']) document.addEventListener(ev, e => e.preventDefault());
document.addEventListener('drop', e => guard(() => {
  const all = [...((e.dataTransfer && e.dataTransfer.files) || [])];
  const list = all.filter(isPlausibleSourceFile);
  if (!list.length) { if (all.length) fail('drop a .ddn, .zip or .json file'); return; }
  return openFiles(list);
}));

/* Dirty guard (studio editor parity). */
host.addEventListener('beforeunload', e => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });

/* ------------------------------------------------ export drawer */

function exportSvgString() {
  if (!state.diagram || !state.diagram.result) throw new Error('nothing rendered yet');
  // Print/static targets: re-render through the noMotion render option (D4 —
  // a renderer switch, never string munging of the animated SVG).
  if (els.exportMotion && !els.exportMotion.checked) {
    const r = state.ws.renderSync({ entry: state.entry, view: state.view, overrides: toolOverrides(state.presentation), noMotion: true });
    return exportSvgWithOverrides(r.svg, overrideCss(state.presentation, null));
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    exportSvgWithOverrides(state.diagram.exportSVG(), overrideCss(state.presentation, null));
}
function download(name, href) {
  const a = document.createElement('a');
  a.href = href; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
els.exportSvg.addEventListener('click', () => guard(() => {
  const blob = new Blob([exportSvgString()], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  download((state.view || 'diagram') + '.svg', url);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  status('SVG exported');
}));
function rasterize(type) {
  const svg = exportSvgString();
  const { w, h } = sceneSize();
  const img = new Image();
  img.onload = () => {
    try {
      const size = rasterCanvasSize(w, h, 2);
      const c = document.createElement('canvas');
      c.width = size.width; c.height = size.height;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const name = (state.view || 'diagram') + (type === 'image/webp' ? '.webp' : '.png');
      if (type === 'image/webp' && c.toBlob) {
        c.toBlob(blob => {
          if (!blob) { fail('WebP encoding is not supported by this browser'); return; }
          const url = URL.createObjectURL(blob);
          download(name, url);
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          status('WebP exported at 2×');
        }, 'image/webp');
      } else {
        download(name, c.toDataURL(type));
        status((type === 'image/webp' ? 'WebP' : 'PNG') + ' exported at 2×');
      }
    } catch (err) { fail(err && err.message); }
  };
  img.onerror = () => fail('rasterisation failed');
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
els.exportPng.addEventListener('click', () => guard(() => rasterize('image/png')));
els.exportWebp.addEventListener('click', () => guard(() => rasterize('image/webp')));
els.saveExample.addEventListener('click', () => guard(() => {
  if (!state.diagram || !state.diagram.result) throw new Error('nothing rendered yet');
  const s = snapshot();
  if (state.diagram.result.keys) s.presentationKeys = state.diagram.result.keys;
  A.io.download((state.view || 'diagram') + '.ddn-workspace.json', JSON.stringify(s, null, 2), 'application/json');
  status('example snapshot saved');
}));

/* ------------------------------------------------ deep links + boot */

function loadFromSrc(src) {
  status('loading ' + src + ' …');
  srcImportClosure(src, host.location.href,
    url => fetch(url),
    (text, name) => A.parse(text, name).imports.map(imp => imp.path),
    (name, p) => A.resolvePath(name, p))
    .then(({ files, entryName }) => { state.catalogueIndex = -1; load(files, entryName); })
    .catch(e => fail(srcFetchErrorMessage(e, host.location && host.location.protocol, src)));
}

function boot() {
  const params = new URLSearchParams(location.search);
  installRenderWorker();
  if (workerState.reason) status('synchronous rendering: ' + workerState.reason);  state.config = resolveDrawerConfig(params.get('mode'), loadStoredDrawers(), params.get('drawers'), params.get('toolbar'));
  // D8: prefers-reduced-motion auto-pauses; the user can still press Play
  // (that session choice then wins until the page reloads).
  if (reducedMotion()) anim.playing = false;
  applyDrawerConfig();
  catalogueUI();
  let booted = false;
  try {
    const src = srcFromQuery(location.search);
    if (src) { loadFromSrc(src); booted = true; }
  } catch (e) { fail(e && e.message); booted = true; }
  if (!booted) {
    const entry = params.get('entry'), view = params.get('view');
    const idx = DATA.catalogue.entries.findIndex(e => e.entry === entry && (!view || e.view === view));
    if (entry && idx >= 0) { state.catalogueIndex = idx; guard(() => load(catalogueClosure(entry), entry, view || DATA.catalogue.entries[idx].view)); booted = true; }
    else if (entry && /\.ddn$/i.test(entry)) {
      // Arbitrary example path (D5): fetch with the import closure, like ?src=.
      status('loading ' + entry + ' …');
      srcImportClosure(entry, host.location.href,
        url => fetch(url),
        (text, name) => A.parse(text, name).imports.map(imp => imp.path),
        (name, p) => A.resolvePath(name, p))
        .then(({ files, entryName }) => load(files, entryName, view || undefined))
        .catch(e => fail(srcFetchErrorMessage(e, host.location && host.location.protocol, entry)));
      booted = true;
    }
  }
  if (!booted) {
    let initial = DATA.catalogue.entries.findIndex(e => e.entry.endsWith('adaptive-lab.ddn') && e.view === 'automatic');
    if (initial < 0) initial = 0;
    if (DATA.catalogue.entries.length) { state.catalogueIndex = initial; const ex = DATA.catalogue.entries[initial]; guard(() => load(catalogueClosure(ex.entry), ex.entry, ex.view)); }
    else load({ 'main.ddn': freshSource }, 'main.ddn', 'overview');
  }
  catalogueUI();
}

/* Documented test/integration surface; mirrors host.DDNViewer (D7). */
host.DDNTool = Object.assign({}, pure, {
  loadFiles: (files, entry, view) => load(files, entry, view),
  loadExample, setFit, zoomStep, applyOverrideCss, exportSvgString, rasterize,
  setDrawer, setToolbar, getDrawerConfig: () => JSON.parse(JSON.stringify(state.config)),
  setOption, resetAppearance,
  setKindTypography: (code, style) => { state.presentation.typography[code] = style; repopulateOverridePanels(); applyOverrideCss(); },
  setKindColour: (code, col) => { state.presentation.kindColours[code] = col; applyOverrideCss(); },
  setVerbColour: (code, col) => { state.presentation.verbColours[code] = col; applyOverrideCss(); },
  setObjectColour: (id, col) => { state.presentation.objectColours[id] = col; applyOverrideCss(); },
  selectObject: id => { state.selected = id; state.selectedRelation = null; updateSelectedPanel(); },
  selectRelation: id => { state.selectedRelation = id; state.selected = null; updateSelectedPanel(); applyOverrideCss(); },
  setVerbRouting: (verb, v) => { state.presentation.verbRouting[verb] = v; repopulateOverridePanels(); rerender(); },
  setRelationRouting: (id, v) => { state.presentation.relationRouting[id] = v; rerender(); },
  refreshAnimation,
  animationToggle: () => els.animToggle.click(),
  animationStep: () => els.animStep.click(),
  setAnimationSpeed: v => { els.animSpeed.value = String(v); els.animSpeed.dispatchEvent(new Event('change')); },
  selectFlow: id => { anim.selectedFlow = id; els.animFlow.value = id; },
  getAnimationState: () => ({ playing: anim.playing, speed: anim.speed, flows: anim.flows.map(f => ({ ...f })), selectedFlow: anim.selectedFlow }),
  showSource, flush, snapshot, openFiles,
  renderMode, getRenderWorkerState: () => ({ mode: renderMode(), disabledReason: workerState.reason, degraded: !!(workerState.bridge && workerState.bridge.degraded), verifiedMetrics: workerState.bridge ? workerState.bridge.verifiedMetrics : 0 }),
  state
});
/* Object.assign evaluates getters at copy time, so the live handles must be
 * defined afterwards to stay live. */
Object.defineProperties(host.DDNTool, {
  workspace: { enumerable: true, get: () => state.ws },
  diagram: { enumerable: true, get: () => state.diagram }
});
try { boot(); } catch (e) { els.status.textContent = 'Boot error: ' + (e && e.message) + ' @ ' + (e && e.stack || '').split('\n')[1]; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
