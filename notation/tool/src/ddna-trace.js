/* SPDX-License-Identifier: GPL-2.0-or-later
 * DDNA Phase B (ddna ch.13 §13.3): trace loading, the shared validator for
 * the sidecar and inline spellings (OT-020/021/022), identity coverage
 * (DDN-A003), shape checks (DDN-A002), and the §13.6 display limits
 * (DDN-A004). Tool-layer only — the DDN runtime is untouched (OT-003) and
 * replay never writes to source.
 *
 * Trace document (canonical sidecar *.ddnatrace.json, ch.13 §13.3.1):
 *   { format: "ddna-trace@1", ddna, companion, base, semantic_profile,
 *     replay_mode: "verified"|"faithful", time_model: {…}, events: […] }
 * The inline fixture spelling (OT-022) is x_trace: { name?, replay?,
 * applies_to: [@id …], events: [ … ] } on a companion declaration — the same
 * record model, the same validator.
 */
(function (host) {
'use strict';

/* §13.6 open-tool display limits (named constants, display-side only). */
const DDNA_TRACE_EVENTS_MAX = 10000;
const DDNA_TRACE_TABLE_ROWS_MAX = 500;
const DDNA_REPLAY_VALUE_OVERLAY_MAX = 64;

const REPLAY_MODES = ['verified', 'faithful'];
/* Workspace-relative path (DDN §53.3): inside the workspace, not absolute,
 * no parent escapes, no URLs. */
const wsPathOk = p => typeof p === 'string' && !!p.length && !p.startsWith('/') && !p.includes('..') && !/^[a-z][a-z0-9+.-]*:\/\//i.test(p);

function diag(severity, code, file, message) { return { severity, code, file, message }; }

/* Shape checks (DDN-A002). Returns { doc, diags } — doc is the parsed trace
 * when usable; diags list every violation (never throws). */
function validateTraceDocument(raw, path) {
  const diags = [];
  let doc = raw;
  if (typeof raw === 'string') {
    try { doc = JSON.parse(raw); }
    catch (e) { return { doc: null, diags: [diag('error', 'DDN-A002', path, 'trace file is not valid JSON: ' + (e && e.message))] }; }
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc))
    return { doc: null, diags: [diag('error', 'DDN-A002', path, 'trace document must be one JSON record')] };
  if (doc.format !== 'ddna-trace@1') diags.push(diag('error', 'DDN-A002', path, 'format must be "ddna-trace@1" (got ' + JSON.stringify(doc.format) + ')'));
  if (typeof doc.ddna !== 'string' || !doc.ddna) diags.push(diag('error', 'DDN-A002', path, 'the ddna standard version stamp is required'));
  for (const k of ['companion', 'base']) {
    if (!wsPathOk(doc[k]))
      diags.push(diag('error', 'DDN-A002', path, k + ' must be a workspace-relative path inside the workspace (DDN §53.3), got ' + JSON.stringify(doc[k])));
  }
  if (typeof doc.semantic_profile !== 'string' || !doc.semantic_profile) diags.push(diag('error', 'DDN-A002', path, 'semantic_profile stamp is required (ch.4 §4.2.5)'));
  if (!REPLAY_MODES.includes(doc.replay_mode)) diags.push(diag('error', 'DDN-A002', path, 'replay_mode must be verified|faithful (ch.4 §4.3), got ' + JSON.stringify(doc.replay_mode)));
  if (!doc.time_model || typeof doc.time_model !== 'object') diags.push(diag('error', 'DDN-A002', path, 'time_model record is required (ch.7 TIME-A)'));
  if (!Array.isArray(doc.events)) diags.push(diag('error', 'DDN-A002', path, 'events must be an array'));
  else diags.push(...validateEvents(doc.events, path));
  return { doc: diags.some(d => d.severity === 'error') ? null : doc, diags };
}

/* The ch.4 §4.2 envelope: monotonic seq, virtual clock, stepKind, instance
 * pair. Shared by both spellings. */
function validateEvents(events, path) {
  const diags = [];
  let lastSeq = 0, lastClock = -Infinity;
  events.forEach((e, i) => {
    const where = 'event #' + (i + 1) + (path ? ' of ' + path : '');
    if (!e || typeof e !== 'object' || Array.isArray(e)) { diags.push(diag('error', 'DDN-A002', path, where + ' must be a record')); return; }
    if (!Number.isInteger(e.seq) || e.seq <= lastSeq) diags.push(diag('error', 'DDN-A002', path, where + ' breaks the monotonic envelope sequence'));
    else lastSeq = e.seq;
    if (typeof e.clock !== 'number' || !Number.isFinite(e.clock)) diags.push(diag('error', 'DDN-A002', path, where + ' needs a finite virtual-clock value'));
    else if (e.clock < lastClock) diags.push(diag('error', 'DDN-A002', path, where + ' moves the virtual clock backwards'));
    else lastClock = e.clock;
    if (typeof e.stepKind !== 'string' || !e.stepKind) diags.push(diag('error', 'DDN-A002', path, where + ' needs a stepKind'));
    if (!Array.isArray(e.instance) || typeof e.instance[0] !== 'string') diags.push(diag('error', 'DDN-A002', path, where + ' needs an instance [elementKey, discriminator] pair'));
  });
  return diags;
}

/* Identity coverage (DDN-A003, OT-021): every event's element key must
 * resolve to a base identity covered by applies_to. Keys are block-relative
 * refs ('m.receive'); applies_to entries may be '@m.receive', 'm.receive' or
 * fully qualified 'module::m.receive' — normalize all to the block-relative
 * tail. */
function refTail(ref) {
  let s = typeof ref === 'string' ? ref : (ref && typeof ref === 'object' ? String(ref.$ref || '') : String(ref || ''));
  s = s.replace(/^@/, '');
  const i = s.indexOf('::');
  return i >= 0 ? s.slice(i + 2) : s;
}
function validateCoverage(events, appliesTo, baseIds, path) {
  const diags = [];
  const covered = new Set((appliesTo || []).map(refTail));
  const known = new Set(baseIds || []);
  const bad = new Map();
  for (const e of events || []) {
    const key = (e && e.state && e.state.at) || (e && e.instance && e.instance[0]);
    if (!key) continue;
    const tail = refTail(key);
    if (covered.size && !covered.has(tail)) bad.set(tail, 'not covered by the trace applies_to');
    else if (known.size && !known.has(tail)) bad.set(tail, 'not a base identity');
  }
  for (const [b, why] of bad) diags.push(diag('error', 'DDN-A003', path, 'trace event names ' + b + ' — ' + why));
  return diags;
}

/* Inline spelling (OT-022): x_trace on a companion declaration. */
function validateInlineTrace(rec, carrierId, companionPath) {
  const path = companionPath + '#' + carrierId;
  const diags = [];
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return { trace: null, diags: [diag('error', 'DDN-A002', path, 'x_trace must be a record')] };
  if (rec.file !== undefined && (typeof rec.file !== 'string' || !rec.file.endsWith('.ddnatrace.json')))
    diags.push(diag('error', 'DDN-A002', path, 'x_trace.file must name a *.ddnatrace.json sidecar'));
  if (rec.applies_to !== undefined && !Array.isArray(rec.applies_to)) diags.push(diag('error', 'DDN-A002', path, 'x_trace.applies_to must be a ref list'));
  if (rec.events !== undefined) {
    if (!Array.isArray(rec.events)) diags.push(diag('error', 'DDN-A002', path, 'inline x_trace.events must be an array'));
    else diags.push(...validateEvents(rec.events, path));
  }
  return { diags };
}

/* collectTraces(files, parseFn, traceFiles): every trace declared by the
 * workspace's companions — sidecar references resolved from the tool-level
 * sidecar store, inline events taken verbatim. Returns
 * { traces: [{ id, label, companion, doc, events, replayMode, profile,
 *   appliesTo, source }], diags }. */
function collectTraces(files, parseFn, traceFiles, isCompanion) {
  const traces = [];
  const diags = [];
  for (const [name, text] of Object.entries(files || {})) {
    if (!isCompanion(name, text)) continue;
    let doc = null;
    try { doc = parseFn(text, name); } catch { continue; }
    const walk = n => {
      const xt = n.props && n.props.x_trace;
      if (xt && typeof xt === 'object') {
        const carrier = n.id;
        const check = validateInlineTrace(xt, carrier, name);
        diags.push(...check.diags);
        const labelBase = xt.name || carrier;
        if (typeof xt.file === 'string') {
          const side = traceFiles && traceFiles[xt.file];
          if (side === undefined) {
            diags.push(diag('error', 'DDN-A001', name, 'x_trace sidecar ' + xt.file + ' is not loaded — the trace association is unresolved'));
          } else {
            const v = validateTraceDocument(side, xt.file);
            diags.push(...v.diags);
            if (v.doc) traces.push({ id: name + '#' + carrier, label: labelBase + ' (' + xt.file + ')', companion: name, doc: v.doc, events: v.doc.events, replayMode: v.doc.replay_mode, profile: v.doc.semantic_profile, appliesTo: xt.applies_to || [], source: 'sidecar' });
          }
        } else if (Array.isArray(xt.events)) {
          traces.push({ id: name + '#' + carrier, label: labelBase + ' (inline)', companion: name, doc: null, events: xt.events, replayMode: xt.replay || 'faithful', profile: xt.profile || 'inline', appliesTo: xt.applies_to || [], source: 'inline' });
        }
      }
      for (const c of n.children || []) walk(c);
    };
    for (const d of doc.declarations || []) walk(d);
  }
  /* §13.6: the event cap applies per trace; truncation is marked, never
   * silent (DDN-A004). */
  for (const t of traces) {
    if (t.events.length > DDNA_TRACE_EVENTS_MAX) {
      diags.push(diag('warning', 'DDN-A004', t.companion, 'trace ' + t.label + ' has ' + t.events.length + ' events — the open tool replays the first ' + DDNA_TRACE_EVENTS_MAX + ' (DDNA_TRACE_EVENTS_MAX); the rest is truncated, marked, not dropped silently'));
      t.truncated = DDNA_TRACE_EVENTS_MAX;
      t.events = t.events.slice(0, DDNA_TRACE_EVENTS_MAX);
    }
  }
  return { traces, diags };
}

/* traceDiagnostics: collectTraces + coverage (A003) against the served bases'
 * identity space. baseIdsFor(trace) → block-relative ids ('m.receive'). */
function traceDiagnostics(files, parseFn, traceFiles, isCompanion, baseIdsFor) {
  const { traces, diags } = collectTraces(files, parseFn, traceFiles, isCompanion);
  for (const t of traces) diags.push(...validateCoverage(t.events, t.appliesTo, baseIdsFor ? baseIdsFor(t) : [], t.id));
  return diags;
}

const api = {
  DDNA_TRACE_EVENTS_MAX, DDNA_TRACE_TABLE_ROWS_MAX, DDNA_REPLAY_VALUE_OVERLAY_MAX,
  validateTraceDocument, validateEvents, validateInlineTrace, validateCoverage, collectTraces, traceDiagnostics, refTail
};
if (typeof module === 'object' && module.exports) module.exports = api;
host.DDNToolDdnaTrace = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
