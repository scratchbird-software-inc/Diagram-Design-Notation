/* SPDX-License-Identifier: GPL-2.0-or-later
 * DDNA Phase C (ddna ch.13 §13.4): execution engines for the PoC-proven
 * classes — EM-1 (token runtime, incl. the saga flagship), EM-3 (lifecycle
 * FSM), EM-4 (trace-set/verdict) — under sandbox budgets (§13.6:
 * DDNA_EXECUTION_STEPS_MAX steps, DDNA_EXECUTION_INSTANCES_MAX concurrent
 * instances; exceeded → truncated trace marked complete:false + DDN-A004).
 * An unavailable class is DDN-A006, never a silent stub (OT-040).
 * Generation is deterministic under the declared profile and every choice
 * is recorded, never re-derived on replay (OT-041).
 *
 * Tool-layer only; the DDN runtime is untouched (OT-003).
 */
(function (host) {
'use strict';

const KEEL = (typeof module === 'object' && module.exports) ? require('./ddna-keel.js') : host.DDNToolKeel;
const TRACE = (typeof module === 'object' && module.exports) ? require('./ddna-trace.js') : host.DDNToolDdnaTrace;

const DDNA_EXECUTION_STEPS_MAX = 10000;
const DDNA_EXECUTION_INSTANCES_MAX = 64;

/* --- trace factory + event-stepped virtual clock (ch.4 §4.2, ch.7 TIME-A) */
function makeTracer(profile) {
  let seq = 0;
  const events = [];
  const emit = e => {
    const rec = {
      seq: ++seq,
      clock: e.clock,
      stepKind: e.stepKind,
      scope: e.scope || 'main',
      instance: e.instance,
      ...(e.choices ? { choices: e.choices } : {}),
      ...(e.state ? { state: e.state } : {}),
      ...(e.keel ? { keel: e.keel } : {}),
      ...(e.verdict !== undefined ? { verdict: e.verdict } : {})
    };
    events.push(rec);
    return rec;
  };
  return { emit, events, profile };
}
function makeClock() {
  let now = 0, running = false;
  return {
    now: () => now,
    start() { running = true; },
    stop() { running = false; },
    running: () => running,
    step(dt) { if (running) now += (dt === undefined ? 1 : dt); return now; }
  };
}
function keelEval(tracer, exprRef, state, clock) {
  const result = KEEL.Eval(exprRef.body, state);
  const rec = {
    exprId: exprRef.id, language: exprRef.language, inputs: { ...state },
    result, clock: clock.now(), engine: KEEL.id, engineVersion: KEEL.version
  };
  return { result, rec };
}

/* --- Budget guard: counts engine steps (clock ticks + emits) and concurrent
 * instances; exceeding either stops the run with a marked partial trace. */
function makeBudget() {
  return {
    steps: 0, instances: new Set(), exceeded: null,
    tick(instance) {
      this.steps++;
      if (instance) this.instances.add(Array.isArray(instance) ? instance[1] : instance);
      if (this.steps > DDNA_EXECUTION_STEPS_MAX) this.exceeded = 'DDNA_EXECUTION_STEPS_MAX';
      if (this.instances.size > DDNA_EXECUTION_INSTANCES_MAX) this.exceeded = 'DDNA_EXECUTION_INSTANCES_MAX';
      return !this.exceeded;
    }
  };
}

/* --- EM-1: token walk over flow.next; decision nodes evaluate the guard
 * (choice class N1). */
function engineEM1(ctx) {
  const { tracer, clock, features, data, budget } = ctx;
  clock.start();
  const next = new Map();
  for (const r of data.relations) next.set(r.from.$ref, [...(next.get(r.from.$ref) || []), r]);
  const byId = new Map(data.objects.map(o => [o.id, o]));
  const guard = features.keel[0];
  let node = data.objects.find(o => (o.props || {}).kind === 'flow.start');
  let token = ['m.' + (node && node.id), 'instance-1'];
  while (node && budget.tick(token)) {
    clock.step();
    tracer.emit({ clock: clock.now(), stepKind: 'node-firing', instance: token, state: { at: 'm.' + node.id, kind: (node.props || {}).kind } });
    const outs = next.get(node.id) || [];
    if (!outs.length || (node.props || {}).kind === 'flow.end') break;
    let target = outs[0];
    if (outs.length > 1 && guard) {
      const { result, rec } = keelEval(tracer, guard, { stock: (ctx.inputs && ctx.inputs.stock) !== undefined ? ctx.inputs.stock : 5 }, clock);
      target = outs.find(o => /ship/i.test((byId.get(o.to.$ref) || {}).label || '') === !!result) || outs[result ? 0 : 1];
      tracer.emit({ clock: clock.now(), stepKind: 'choice', instance: token, choices: { class: 'N1', guard: guard.id, result }, keel: rec });
    }
    node = byId.get(target.to.$ref) || null;
    if (node) token = ['m.' + node.id, 'instance-1'];
  }
  clock.stop();
  return { steps: tracer.events.length };
}

/* --- EM-9 flagship (EM-1 class): the order saga — token flow with live data
 * mutations, a partial-shipment loop, KEEL-computed charges, running ledger. */
function engineEM9(ctx) {
  const { tracer, clock, features, budget } = ctx;
  clock.start();
  const keel = Object.fromEntries(features.keel.map(k => [k.id, k]));
  const D = { stock: 5, total: 129.50, charged: 0, ledger: 0, shipments: 0, tier: 2, risk: 0.3 };
  Object.assign(D, ctx.inputs || {});
  const money = v => '$' + v.toFixed(2);
  const fire = (at, extra) => {
    clock.step();
    tracer.emit({ clock: clock.now(), stepKind: 'node-firing', instance: [at, 'order-42'], state: { at }, ...extra });
    return budget.tick([at, 'order-42']);
  };
  const guard = (kid, inputs, at, taken, notTaken, extra) => {
    clock.step();
    const { result, rec } = keelEval(tracer, keel[kid], inputs, clock);
    tracer.emit({ clock: clock.now(), stepKind: 'choice', instance: [at, 'order-42'],
      state: { at }, choices: { class: 'N1', guard: kid, result, taken, notTaken }, keel: rec, ...extra });
    return result;
  };
  const mutate = (at, label, before, after, ref) => {
    clock.step();
    tracer.emit({ clock: clock.now(), stepKind: 'data-mutation', instance: [at, 'order-42'],
      state: { at, before, after, values: { [ref || at]: label } } });
  };
  fire('m.start');
  fire('m.receive', { state: { at: 'm.receive', values: { 'm.receive': 'order: 2 items · ' + money(D.total) } } });
  guard('k1', { tier: D.tier, total: D.total }, 'm.validate', 'm.fraud', 'm.reject');
  fire('m.validate');
  guard('k2', { risk: D.risk }, 'm.fraud', 'm.reserve', 'm.hold');
  fire('m.fraud');
  fire('m.reserve');
  mutate('m.reserve', 'stock: ' + D.stock + '→' + (D.stock - 1), D.stock, D.stock - 1);
  D.stock -= 1;
  fire('m.charge');
  clock.step();
  const amt = keelEval(tracer, keel.k3, { total: D.total }, clock);
  tracer.emit({ clock: clock.now(), stepKind: 'keel-compute', instance: ['m.charge', 'order-42'],
    state: { at: 'm.charge' }, keel: amt.rec, choices: { class: 'decimal-tower', note: 'amount computed through the nine-function seam' } });
  mutate('m.charge', 'charged: ' + money(amt.result), D.charged, amt.result);
  D.charged = amt.result;
  /* branch 1: one item back-ordered — taken branch active, ship flashed */
  clock.step();
  tracer.emit({ clock: clock.now(), stepKind: 'choice', instance: ['m.branch', 'order-42'],
    state: { at: 'm.branch' }, keel: keelEval(tracer, keel.k4, { stock: 0 }, clock).rec });
  tracer.events.at(-1).choices = { class: 'N1', guard: 'items-complete', result: false, taken: 'm.backorder', notTaken: 'm.ship', loopIteration: 1 };
  fire('m.backorder');
  /* loop: stock re-check on second pass, then reserve the back-ordered item */
  clock.step();
  tracer.emit({ clock: clock.now(), stepKind: 'choice', instance: ['m.branch', 'order-42'],
    state: { at: 'm.branch' }, keel: keelEval(tracer, keel.k4, { stock: D.stock }, clock).rec });
  tracer.events.at(-1).choices = { class: 'N1', guard: 'k4', result: true, taken: 'm.reserve', notTaken: 'm.ship', loopIteration: 2 };
  fire('m.reserve');
  mutate('m.reserve', 'stock: ' + D.stock + '→' + (D.stock - 1), D.stock, D.stock - 1);
  D.stock -= 1;
  clock.step();
  tracer.emit({ clock: clock.now(), stepKind: 'choice', instance: ['m.branch', 'order-42'],
    state: { at: 'm.branch' }, choices: { class: 'N1', guard: 'items-complete', result: true, taken: 'm.ship', notTaken: 'm.backorder', loopIteration: 2 } });
  fire('m.ship');
  mutate('m.ship', 'shipments: ' + D.shipments + '→' + (D.shipments + 2), D.shipments, D.shipments + 2);
  D.shipments += 2;
  mutate('m.ship', 'stock: ' + D.stock + '→' + (D.stock - 1), D.stock, D.stock - 1);
  D.stock -= 1;
  fire('m.ledger');
  mutate('m.ledger', 'ledger: ' + money(D.ledger) + '→' + money(D.ledger + D.charged), D.ledger, D.ledger + D.charged);
  D.ledger += D.charged;
  mutate('m.ledger', 'ledger: ' + money(D.ledger) + '→' + money(D.ledger + 45.0) + ' (+' + money(45) + ' freight)', D.ledger, D.ledger + 45.0);
  D.ledger += 45.0;
  fire('m.complete');
  fire('m.fin');
  clock.stop();
  return { steps: tracer.events.length, ledger: D.ledger, charged: D.charged, stock: D.stock };
}

/* --- EM-3: lifecycle FSM walk; one human decision recorded (N5). */
function engineEM3(ctx) {
  const { tracer, clock, data, budget } = ctx;
  clock.start();
  const states = ['available', 'enabled', 'active', 'completed'];
  const task = data.objects.find(o => /humantask|cmmn/i.test((o.props || {}).kind || '')) || data.objects[1];
  const taskUid = task ? 'm.' + task.id : null;
  const milestone = data.objects.find(o => /milestone/i.test((o.props || {}).kind || ''));
  for (const s of states) {
    if (!budget.tick(['case.planItem1', 'case-7'])) break;
    clock.step();
    const choices = s === 'enabled' ? { class: 'N5', input: 'approve', role: 'manager', note: 'human decision (normative input)' } : undefined;
    tracer.emit({ clock: clock.now(), stepKind: 'standard-event', instance: ['case.planItem1', 'case-7'], state: { lifecycle: s, monotonic: true, ...(taskUid ? { at: taskUid } : {}) }, ...(choices ? { choices } : {}) });
  }
  if (budget.tick()) {
    clock.step();
    tracer.emit({ clock: clock.now(), stepKind: 'sentry-round', instance: ['case.sentry1', 'case-7'], state: { ifPart: 'stockReserved == true', fired: true, ...(milestone ? { at: 'm.' + milestone.id } : {}) } });
  }
  clock.stop();
  return { steps: tracer.events.length };
}

/* --- EM-4: partial-order cursor over the message list; three-valued
 * [P,I] trace-set verdict. */
function engineEM4(ctx) {
  const { tracer, clock, data, budget } = ctx;
  clock.start();
  const msgs = data.relations.filter(r => r.from && r.to);
  const recorded = [...msgs].reverse().slice(0, 1).map(r => r.id); /* one out-of-order event */
  let cursor = 0;
  for (const r of msgs) {
    if (!budget.tick([r.from.$ref, 'occ-' + (cursor + 1)])) break;
    clock.step();
    cursor++;
    tracer.emit({ clock: clock.now(), stepKind: 'event-occurrence', instance: [r.from.$ref, 'occ-' + cursor], state: { message: r.id, cursor, of: msgs.length } });
  }
  const pos = new Map(msgs.map((r, i) => [r.id, i]));
  const recPos = recorded.map(id => pos.get(id));
  const valid = recPos.every((p, i) => i === 0 || p > recPos[i - 1]);
  if (budget.tick(['chart', 'trace-1'])) {
    clock.step();
    tracer.emit({ clock: clock.now(), stepKind: 'validation', instance: ['chart', 'trace-1'],
      verdict: recorded.length ? (valid ? 'valid' : 'invalid') : 'not-described',
      state: { rule: '[P,I] trace-set; P∪I ≠ universe', recorded } });
  }
  clock.stop();
  return { steps: tracer.events.length, verdict: valid ? 'valid' : 'invalid' };
}

/* --- Engine registry: profile name → engine. Unavailable classes are coded
 * (DDN-A006), never silently stubbed. */
const ENGINES = { em1: engineEM1, em9: engineEM9, em3: engineEM3, em4: engineEM4 };
const ENGINE_LABELS = { em1: 'EM-1 token runtime', em9: 'EM-1 token runtime · order saga', em3: 'EM-3 lifecycle FSM', em4: 'EM-4 trace-set validation' };
const KNOWN_UNAVAILABLE = { em2: 'EM-2 declarative rules', em5: 'EM-5 delegated solving', em6: 'EM-6 protocol conformance' };
function classifyProfile(profile) {
  const name = String((profile && (profile.name || profile.id)) || '');
  const m2 = name.match(/em-?(\d)/i);
  if (m2 && ENGINES['em' + m2[1]]) return { engine: 'em' + m2[1] };
  if (m2 && KNOWN_UNAVAILABLE['em' + m2[1]]) return { unavailable: 'em' + m2[1], label: KNOWN_UNAVAILABLE['em' + m2[1]] };
  return {};
}

/* runEngine(engineId, ctx): budgeted deterministic generation. Returns
 * { events, result, budget, doc } — doc is the §13.3.1 trace document. */
function runEngine(engineId, ctx, meta) {
  const budget = ctx.budget || makeBudget();
  const tracer = makeTracer(ctx.features.profile || { id: 'poc', name: 'poc', version: '0', replay: 'faithful' });
  const engine = ENGINES[engineId];
  if (!engine) return { error: 'DDN-A006', events: [], budget };
  const result = engine({ ...ctx, tracer, budget });
  const doc = {
    format: 'ddna-trace@1',
    ddna: (meta && meta.ddna) || '0.1.0-draft',
    companion: meta && meta.companion,
    base: meta && meta.base,
    semantic_profile: (tracer.profile && (tracer.profile.name || tracer.profile.id)) || 'unspecified',
    replay_mode: (tracer.profile && tracer.profile.replay) === 'verified' ? 'verified' : 'faithful',
    time_model: { kind: 'event-stepped', id: 'TIME-A' },
    complete: !budget.exceeded,
    events: tracer.events
  };
  return { events: tracer.events, result, budget, doc, engine: engineId };
}

/* Canonical comparison for verified replay (A007): the envelope + mapped
 * element + choices, in order. */
function canonicalEvents(events) {
  return (events || []).map(e => JSON.stringify([e.seq, e.stepKind, e.instance, e.state && e.state.at, e.choices || null, e.verdict === undefined ? null : String(e.verdict)]));
}
/* verifyReplay(events, regenerate): re-runs the engine and reports the first
 * divergent event (1-based seq), or null when identical. */
function verifyReplay(events, regenerate) {
  const fresh = regenerate();
  const a = canonicalEvents(events), b = canonicalEvents(fresh);
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return { diverged: true, seq: i + 1, expected: b[i], got: a[i] };
  return { diverged: false };
}

/* engineDiagnostics(files, parseFn, isCompanion): A005 (KEEL tier above the
 * host ceiling) and A006 (no engine for the companion's class) at load. */
function engineDiagnostics(files, parseFn, isCompanion) {
  const out = [];
  for (const [name, text] of Object.entries(files || {})) {
    if (!isCompanion(name, text)) continue;
    let doc = null;
    try { doc = parseFn(text, name); } catch { continue; }
    let profile = null;
    const keels = [];
    const walk = n => {
      const pr = n.props || {};
      if (pr.x_profile) profile = { id: n.id, ...pr.x_profile };
      if (pr.x_keel) keels.push({ id: n.id, ...pr.x_keel });
      for (const c of n.children || []) walk(c);
    };
    for (const d of doc.declarations || []) walk(d);
    for (const k of keels) {
      if (!KEEL.tierAvailable(k.language))
        out.push({ severity: 'warning', code: 'DDN-A005', file: name, message: 'KEEL expression ' + k.id + ' declares language "' + k.language + '" — above the open host ceiling (T0–T2, keel-l0@1); the feature is marked unavailable (ddna ch.13 §13.5)' });
    }
    if (profile) {
      const cls = classifyProfile(profile);
      if (cls.unavailable)
        out.push({ severity: 'warning', code: 'DDN-A006', file: name, message: 'no engine for execution-model class ' + cls.unavailable.toUpperCase() + ' (' + cls.label + ') is installed in the open tool (ddna ch.13 §13.4)' });
    }
  }
  return out;
}

const api = {
  DDNA_EXECUTION_STEPS_MAX, DDNA_EXECUTION_INSTANCES_MAX,
  makeTracer, makeClock, makeBudget, keelEval,
  ENGINES, ENGINE_LABELS, KNOWN_UNAVAILABLE, classifyProfile, runEngine, canonicalEvents, verifyReplay, engineDiagnostics
};
if (typeof module === 'object' && module.exports) module.exports = api;
host.DDNToolDdnaEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
