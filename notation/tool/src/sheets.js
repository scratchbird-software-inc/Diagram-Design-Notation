/* SPDX-License-Identifier: GPL-2.0-or-later. Designer redesign phase 5 —
 * the Type sheet framework: a bottom drawer whose body is dispatched by the
 * active view's capability (projection kind + profile, phase 2). A sheet body
 * registers in SHEETS with the profile ids it serves; sheetForProjection
 * resolves the body for a view; typeSheetAutoState drives the drawer's
 * auto-open/auto-close. The first registered body is the CMMN case-plan sheet
 * (cmmn.basic@1 / cmmn.complete@1): case-plan outline tree, sentry editor,
 * decorator flags, planning table editor. Phase 6a registers the UML
 * structure/activity/sequence, BPMN and patent bodies (below); phase 6b adds
 * the data-projection sheets.
 *
 * Pure layer (node-testable, no DOM):
 *  · sheetForProjection / typeSheetAutoState — dispatch + auto-open semantics
 *  · cmmnOutline — the case-plan tree (stage frames scope members; unframed
 *    items sit at the case root), from the resolved IR (elements + view.frames)
 *  · sentryCommit — x_sentry record commit semantics (on required; attach /
 *    on_part are references; if_part is criterion text)
 *  · decoratorCommit — tri-state optional booleans on x_cmmn (set / true /
 *    false; removing the last flag removes the record)
 *  · planningCommit — x_planning.items list commit (1..10 non-empty strings;
 *    an empty list removes the property)
 * UMD: inlined into the single-file tool build and required by node tests. */
(function (host) {
'use strict';

/* --- sheet registry (dispatch by view capability) ---
 * `profiles` are the projection profile ids the body serves; `viewKinds` are
 * view kinds (e.g. patent-figure attaching patent.legal@1) — either may match.
 * The projection kind must additionally match `kinds` when listed. */
const SHEETS = [
  { id: 'cmmn', label: 'CMMN case plan', profiles: ['cmmn.basic@1', 'cmmn.complete@1'], kinds: ['graph'] },
  /* Phase 6a bodies. */
  { id: 'uml-structure', label: 'UML structure', profiles: ['uml.structure@1', 'uml.structure@2'], kinds: ['graph'] },
  { id: 'uml-activity', label: 'UML activity lanes', profiles: ['uml.activity@1', 'uml.activity@2'], kinds: ['graph'] },
  { id: 'uml-sequence', label: 'UML sequence', profiles: ['uml.sequence@1', 'uml.sequence@2'], kinds: ['sequence'] },
  { id: 'bpmn', label: 'BPMN events & gateways', profiles: ['bpmn.basic@1', 'bpmn.process@1', 'bpmn.choreography@1', 'bpmn.conversation@1'], kinds: ['graph'] },
  /* patent.legal@1 attaches through the view KIND (patent-figure), never the
   * projection profile — dispatch matches viewKinds (the caller enriches the
   * projection object with viewKind from ir.view.kind). */
  { id: 'patent', label: 'Patent numerals & anchors', viewKinds: ['patent-figure'], kinds: ['graph'] }
];

function sheetForProjection(projection, sheets) {
  const p = projection || {};
  for (const s of sheets || SHEETS) {
    if (s.kinds && !s.kinds.includes(p.kind || 'graph')) continue;
    if (s.profiles && s.profiles.includes(p.profile)) return s;
    if (s.viewKinds && s.viewKinds.includes(p.viewKind)) return s;
  }
  return null;
}

/* Drawer auto-open/auto-close. `current` is the drawer's configured state.
 * Returns the state the drawer should move to, or null to leave it alone:
 *  · 'none' drawers are unavailable — never touched;
 *  · a view with a registered sheet auto-opens a closed drawer;
 *  · a plain view auto-closes an open drawer (the sheet shows its empty state
 *    only when the user explicitly re-opens it there). */
function typeSheetAutoState(hasSheet, current) {
  if (current === 'none' || current === 'api') return null;
  if (hasSheet && current === 'closed') return 'open';
  if (!hasSheet && current === 'open') return 'closed';
  return null;
}

/* --- CMMN case-plan model ---
 * Kind roles for the outline; unknown kinds (e.g. analysis.task inside a
 * cmmn.basic view) classify as 'other' and still list. */
const CMMN_ROLES = {
  'cmmn.caseplan': 'plan', 'cmmn.stage': 'stage',
  'cmmn.task': 'task', 'cmmn.humantask': 'task', 'cmmn.processtask': 'task', 'cmmn.decisiontask': 'task',
  'cmmn.milestone': 'milestone', 'cmmn.casefile': 'casefile',
  'cmmn.timerevent': 'event', 'cmmn.userevent': 'event',
  'cmmn.sentry': 'sentry'
};
function cmmnRole(kind) { return CMMN_ROLES[kind] || 'other'; }

/* cmmnOutline(ir) → { roots: [node], byUid: {uid: node} }.
 * node: {uid, local, name, kind, role, frameId, children}.
 * Hierarchy source: view frames scoped to a stage element are that stage's
 * children (in member order); every element not a member of any stage frame
 * sits at the case root (plan elements first, then source order). A frame
 * whose scope is not a stage in this view contributes nothing. */
function cmmnOutline(ir) {
  const elements = (ir && ir.elements) || [];
  const frames = (ir && ir.view && ir.view.frames) || [];
  const byUid = {};
  for (const n of elements) {
    byUid[n.id] = { uid: n.id, local: n.local || n.id.split('.').pop(), name: n.name || n.id, kind: n.kind, role: cmmnRole(n.kind), frameId: null, children: [] };
  }
  const inFrame = new Set();
  for (const f of frames) {
    const stage = byUid[f.scope];
    if (!stage || stage.role !== 'stage') continue;
    stage.frameId = f.id.split('.').pop();
    for (const m of f.members || []) {
      const child = byUid[m];
      if (!child || child === stage) continue;
      stage.children.push(child);
      inFrame.add(m);
    }
  }
  const roots = elements.map(n => byUid[n.id]).filter(n => !inFrame.has(n.uid));
  roots.sort((a, b) => (a.role === 'plan' ? 0 : 1) - (b.role === 'plan' ? 0 : 1));
  return { roots, byUid };
}

/* sentryCommit(current, draft): the x_sentry commit decision.
 * draft: {on: 'entry'|'exit'|'', attach: refPath|'', onPart: refPath|'',
 *         ifPart: criterionText|''}. `on` is required by the contract; blank
 * optional fields are omitted from the record. Returns
 * {action:'set', value} | {action:'none'} | {action:'error', code, message}.
 * (Removing x_sentry wholesale is a separate explicit action — a sentry
 * without x_sentry is DDN-PJ120-invalid, so a blank form never commits a
 * removal here.) */
function sentryCommit(current, draft) {
  const d = draft || {};
  if (d.on !== 'entry' && d.on !== 'exit') return { action: 'error', code: 'DDN-UI07', message: 'A sentry needs its trigger: on = entry or exit.' };
  const refOK = s => /^@?[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*$/.test(s);
  const value = { on: d.on };
  if (d.attach && String(d.attach).trim()) {
    const r = String(d.attach).trim().replace(/^@/, '');
    if (!refOK(r)) return { action: 'error', code: 'DDN-UI07', message: 'attach must be a reference path (a stage or task).' };
    value.attach = { $ref: r };
  }
  if (d.onPart && String(d.onPart).trim()) {
    const r = String(d.onPart).trim().replace(/^@/, '');
    if (!refOK(r)) return { action: 'error', code: 'DDN-UI07', message: 'on_part must be a reference path (the event the sentry listens to).' };
    value.on_part = { $ref: r };
  }
  if (d.ifPart && String(d.ifPart).trim()) value.if_part = String(d.ifPart).trim();
  if (JSON.stringify(value) === JSON.stringify(current || undefined)) return { action: 'none' };
  return { action: 'set', value };
}

/* decoratorCommit(current, flag, tri): one tri-state optional boolean on the
 * x_cmmn record. tri: 'unset' (remove the key) | 'true' | 'false'. Removing
 * the last flag removes the whole x_cmmn property (an empty record is never
 * written). Returns {action:'set'|'remove'|'none', value?}. */
const CMMN_DECORATOR_FLAGS = ['discretionary', 'nonblocking', 'required', 'repetition', 'manual_activation', 'completion', 'collapsed'];
function decoratorCommit(current, flag, tri) {
  if (!CMMN_DECORATOR_FLAGS.includes(flag)) return { action: 'error', code: 'DDN-UI09', message: 'Unknown CMMN decorator flag: ' + flag };
  if (!['unset', 'true', 'false'].includes(tri)) return { action: 'error', code: 'DDN-UI09', message: 'A decorator flag is tri-state: unset, true or false.' };
  const next = { ...(current || {}) };
  if (tri === 'unset') delete next[flag];
  else next[flag] = tri === 'true';
  if (JSON.stringify(next) === JSON.stringify(current || {})) return { action: 'none' };
  if (!Object.keys(next).length) return current === undefined ? { action: 'none' } : { action: 'remove' };
  return { action: 'set', value: next };
}

/* planningCommit(items): the x_planning commit decision for a planning-table
 * item list. items are criterion texts (the contract is a string list, 1..10,
 * non-empty); blank rows drop out, an all-empty list removes the property. */
function planningCommit(items, current) {
  const list = (items || []).map(s => String(s == null ? '' : s).trim()).filter(Boolean);
  if (list.length > 10) return { action: 'error', code: 'DDN-UI08', message: 'A planning table holds at most 10 items.' };
  if (!list.length) return current === undefined ? { action: 'none' } : { action: 'remove' };
  if (JSON.stringify(list) === JSON.stringify((current && current.items) || [])) return { action: 'none' };
  return { action: 'set', value: { items: list } };
}

/* Roles that may carry a planning table / decorator flags in the sheet UI. */
const CMMN_PLANNING_ROLES = ['stage', 'task'];
const CMMN_DECORATOR_ROLES = ['stage', 'task', 'milestone'];

/* ================= Phase 6a pure layer =================
 * UML multiplicity grammar (mirrors the DDN-PJ149/151 check in
 * ddn-profiles.js; the commit-time build stays the authority). */
const MULT_RE = /^(\d+|\*)(\.\.(\d+|\*))?$/;
const refOK = s => /^@?[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*$/.test(s);
const cleanRef = s => String(s || '').trim().replace(/^@/, '');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* memberCommit(current, draft, ownerKind): the x_member commit decision for
 * one classifier member row (DDN-PJ154 authority). draft: {kind, visibility,
 * static, abstract, derived, multiplicity, modifiers[]}; blank/unchecked
 * fields are omitted from the record. kind 'literal' is enumeration-only; an
 * enumeration member record must declare kind 'literal'. An all-blank record
 * removes the property. */
function memberCommit(current, draft, ownerKind) {
  const d = draft || {};
  if (!['', 'attribute', 'operation', 'literal'].includes(d.kind || '')) return { action: 'error', code: 'DDN-UI10', message: 'Member kind is attribute, operation or literal.' };
  if (!['', 'public', 'private', 'protected', 'package'].includes(d.visibility || '')) return { action: 'error', code: 'DDN-UI10', message: 'Visibility is public, private, protected or package.' };
  if (d.kind === 'literal' && ownerKind !== 'uml.enumeration') return { action: 'error', code: 'DDN-UI10', message: 'x_member kind literal applies to uml.enumeration members only (DDN-PJ154).' };
  if (ownerKind === 'uml.enumeration' && d.kind !== 'literal') return { action: 'error', code: 'DDN-UI10', message: 'uml.enumeration members must be x_member kind literal (DDN-PJ154).' };
  const value = {};
  if (d.kind) value.kind = d.kind;
  if (d.visibility) value.visibility = d.visibility;
  for (const k of ['static', 'abstract', 'derived']) if (d[k] === true) value[k] = true;
  if (d.multiplicity && String(d.multiplicity).trim()) value.multiplicity = String(d.multiplicity).trim();
  const mods = [...new Set((d.modifiers || []).filter(m => ['ordered', 'unique', 'readOnly'].includes(m)))];
  if (mods.length > 3) return { action: 'error', code: 'DDN-UI10', message: 'At most three member modifiers ({ordered}/{unique}/{readOnly}).' };
  if (mods.length) value.modifiers = mods;
  if (!Object.keys(value).length) return current === undefined ? { action: 'none' } : { action: 'remove' };
  if (same(value, current)) return { action: 'none' };
  return { action: 'set', value };
}

/* templateCommit(params, current): x_template.parameters string list (1..8
 * non-empty; an empty list removes the property). */
function templateCommit(params, current) {
  const list = (params || []).map(s => String(s == null ? '' : s).trim()).filter(Boolean);
  if (list.length > 8) return { action: 'error', code: 'DDN-UI08', message: 'A template box holds at most 8 parameters.' };
  if (!list.length) return current === undefined ? { action: 'none' } : { action: 'remove' };
  if (same(list, (current && current.parameters) || [])) return { action: 'none' };
  return { action: 'set', value: { parameters: list } };
}

/* assocClassCommit(current, refPath): x_association_class — class is a
 * required reference (blank removes the whole property). */
function assocClassCommit(current, refPath) {
  const r = cleanRef(refPath);
  if (!r) return current === undefined ? { action: 'none' } : { action: 'remove' };
  if (!refOK(r)) return { action: 'error', code: 'DDN-UI13', message: 'The association class must be a reference path (a uml.class).' };
  const value = { class: { $ref: r } };
  if (same(value, current)) return { action: 'none' };
  return { action: 'set', value };
}

/* naryCommit(current, ends): x_nary.ends — 1..6 ends, each with a required
 * element reference and optional role/multiplicity; multiplicity pre-checked
 * against the UML grammar and duplicate end references rejected (DDN-PJ151
 * distinctness; kind legality stays with the commit-time build). */
function naryCommit(current, ends) {
  const list = (ends || []).map(e => ({ element: cleanRef(e && e.element), role: String((e && e.role) || '').trim(), multiplicity: String((e && e.multiplicity) || '').trim() }))
    .filter(e => e.element || e.role || e.multiplicity);
  if (!list.length) return current === undefined ? { action: 'none' } : { action: 'remove' };
  if (list.length > 6) return { action: 'error', code: 'DDN-UI13', message: 'An n-ary association carries at most 6 extra ends.' };
  const seen = new Set();
  const value = { ends: list.map(e => {
    if (!e.element) throw null;
    if (!refOK(e.element)) return { error: 'Each n-ary end needs a reference path (a classifier).' };
    if (seen.has(e.element)) return { error: 'N-ary ends must be distinct; ' + e.element + ' appears twice.' };
    seen.add(e.element);
    if (e.multiplicity && !MULT_RE.test(e.multiplicity)) return { error: 'N-ary end multiplicity must be a UML multiplicity (1, 0..1, 0..*, 1..*, *); found "' + e.multiplicity + '".' };
    const end = { element: { $ref: e.element } };
    if (e.role) end.role = e.role;
    if (e.multiplicity) end.multiplicity = e.multiplicity;
    return end;
  }) };
  const bad = value.ends.find(e => e && e.error);
  if (bad) return { action: 'error', code: 'DDN-UI13', message: bad.error };
  if (value.ends.some(e => !e)) return { action: 'error', code: 'DDN-UI13', message: 'Each n-ary end needs a reference path (a classifier).' };
  if (same(value, current)) return { action: 'none' };
  return { action: 'set', value };
}

/* gensetCommit(current, draft): x_genset on a uml.generalization — name is
 * required; disjoint/complete are tri-state optional booleans. */
function gensetCommit(current, draft) {
  const d = draft || {};
  const name = String(d.name || '').trim();
  if (!name) return { action: 'error', code: 'DDN-UI13', message: 'A generalization set needs a name (DDN-PJ152 groups by it).' };
  const value = { name };
  for (const k of ['disjoint', 'complete']) {
    if (!['unset', 'true', 'false'].includes(d[k] || 'unset')) return { action: 'error', code: 'DDN-UI13', message: k + ' is tri-state: unset, true or false.' };
    if (d[k] === 'true') value[k] = true;
    if (d[k] === 'false') value[k] = false;
  }
  if (same(value, current)) return { action: 'none' };
  return { action: 'set', value };
}

/* laneRectCommit(draft): lane geometry decision. draft {fit, x, y, w, h} —
 * fit clears explicit at/size; otherwise all four are required finite numbers
 * with positive W/H. Returns {action:'set', at:[x,y], size:[w,h]} |
 * {action:'fit'} | {action:'error'}. */
function laneRectCommit(draft) {
  const d = draft || {};
  if (d.fit === true) return { action: 'fit' };
  const nums = ['x', 'y', 'w', 'h'].map(k => Number(d[k]));
  if (!nums.every(Number.isFinite)) return { action: 'error', code: 'DDN-UI11', message: 'Lane X/Y/W/H are required finite numbers. Nothing was changed.' };
  if (nums[2] <= 0 || nums[3] <= 0) return { action: 'error', code: 'DDN-UI11', message: 'Lane W/H must be positive. Nothing was changed.' };
  return { action: 'set', at: [nums[0], nums[1]], size: [nums[2], nums[3]] };
}

/* laneMembersPlan(frames, frameLocalId, uid, assign): membership delta with
 * the one-lane-per-element policy — assigning to a lane removes the element
 * from every other lane. Returns {writes: [{frameId, members}]} (only changed
 * frames). */
function laneMembersPlan(frames, frameLocalId, uid, assign) {
  const local = f => String(f.id).split('::').pop().split('.').pop();
  const removals = [], adds = [];
  for (const f of frames || []) {
    const has = (f.members || []).includes(uid), isTarget = local(f) === frameLocalId || f.id === frameLocalId;
    if (isTarget && assign && !has) adds.push({ frameId: local(f), members: [...(f.members || []), uid] });
    else if ((!isTarget || !assign) && has) removals.push({ frameId: local(f), members: (f.members || []).filter(m => m !== uid) });
  }
  /* Removals before adds: the interim state never double-books an element. */
  return { writes: [...removals, ...adds] };
}

/* messageCommit(current, draft): x_message record — every field optional;
 * blank fields are omitted, an all-blank record removes the property. `at` is
 * a finite number when given. */
function messageCommit(current, draft) {
  const d = draft || {};
  if (d.sort && !['synch', 'asynch', 'create', 'delete', 'reply', 'lost', 'found'].includes(d.sort)) return { action: 'error', code: 'DDN-UI14', message: 'Message sort is synch, asynch, create, delete, reply, lost or found.' };
  if (d.gate && !['source', 'target'].includes(d.gate)) return { action: 'error', code: 'DDN-UI14', message: 'A gate is source or target.' };
  const value = {};
  for (const k of ['seq', 'sort', 'gate', 'time', 'duration']) if (d[k] && String(d[k]).trim()) value[k] = String(d[k]).trim();
  if (d.at !== undefined && d.at !== null && String(d.at).trim() !== '') {
    const n = Number(d.at);
    if (!Number.isFinite(n)) return { action: 'error', code: 'DDN-UI14', message: 'x_message.at must be a finite number.' };
    value.at = n;
  }
  if (!Object.keys(value).length) return current === undefined ? { action: 'none' } : { action: 'remove' };
  if (same(value, current)) return { action: 'none' };
  return { action: 'set', value };
}

const FRAGMENT_OPERATORS = ['alt', 'opt', 'loop', 'break', 'par', 'neg', 'critical', 'seq', 'strict', 'ignore', 'consider', 'assert', 'coreg'];
/* fragmentCommit(current, draft): x_fragment — {operator, operands:[{guard,
 * messages:[refPath]}]}; 1..12 operands, each with at least one covered
 * message reference; guard text optional. (Nested fragments stay a source
 * affair; the sheet edits one level.) */
function fragmentCommit(current, draft) {
  const d = draft || {};
  if (!FRAGMENT_OPERATORS.includes(d.operator)) return { action: 'error', code: 'DDN-UI15', message: 'Fragment operator is one of ' + FRAGMENT_OPERATORS.join(', ') + '.' };
  const operands = (d.operands || []).map(o => ({
    guard: String((o && o.guard) || '').trim(),
    messages: ((o && o.messages) || []).map(cleanRef).filter(Boolean)
  }));
  if (!operands.length || operands.length > 12) return { action: 'error', code: 'DDN-UI15', message: 'A combined fragment carries 1..12 operands.' };
  const value = { operator: d.operator, operands: operands.map(o => {
    if (!o.messages.length) return { error: 'Every operand covers at least one message.' };
    const bad = o.messages.find(m => !refOK(m));
    if (bad) return { error: 'Operand messages are reference paths; "' + bad + '" is not.' };
    const op = { messages: o.messages.map(m => ({ $ref: m })) };
    if (o.guard) op.guard = o.guard;
    return op;
  }) };
  const bad = value.operands.find(o => o && o.error);
  if (bad) return { action: 'error', code: 'DDN-UI15', message: bad.error };
  if (same(value, current)) return { action: 'none' };
  return { action: 'set', value };
}

const EVENT_TYPES = ['none', 'message', 'timer', 'signal', 'error', 'escalation', 'compensation', 'conditional', 'link', 'terminate', 'cancel', 'multiple', 'parallel_multiple'];
const EVENT_POSITIONS = ['start', 'intermediate', 'end', 'boundary'];
/* eventCommit(current, draft): x_event — type required; position optional;
 * interrupting tri-state; on an optional reference (the activity a boundary
 * event interrupts). */
function eventCommit(current, draft) {
  const d = draft || {};
  if (!EVENT_TYPES.includes(d.type)) return { action: 'error', code: 'DDN-UI16', message: 'An event needs its type (' + EVENT_TYPES.join(', ') + ').' };
  if (d.position && !EVENT_POSITIONS.includes(d.position)) return { action: 'error', code: 'DDN-UI16', message: 'Event position is start, intermediate, end or boundary.' };
  const value = { type: d.type };
  if (d.position) value.position = d.position;
  if (d.interrupting === 'true') value.interrupting = true;
  if (d.interrupting === 'false') value.interrupting = false;
  const on = cleanRef(d.on);
  if (on) {
    if (!refOK(on)) return { action: 'error', code: 'DDN-UI16', message: 'on must be a reference path (the interrupted activity).' };
    value.on = { $ref: on };
  }
  if (same(value, current)) return { action: 'none' };
  return { action: 'set', value };
}

const GATEWAY_TYPES = ['exclusive', 'parallel', 'inclusive', 'complex', 'event', 'event_exclusive'];
/* gatewayCommit(current, type): x_gateway — type required. */
function gatewayCommit(current, type) {
  if (!GATEWAY_TYPES.includes(type)) return { action: 'error', code: 'DDN-UI16', message: 'Gateway type is one of ' + GATEWAY_TYPES.join(', ') + '.' };
  const value = { type };
  if (same(value, current)) return { action: 'none' };
  return { action: 'set', value };
}

/* boolPropCommit(current, tri): a standalone boolean property (x_interrupt,
 * x_return) — tri 'true'/'false'/'unset' where 'unset' removes the property. */
function boolPropCommit(current, tri) {
  if (!['unset', 'true', 'false'].includes(tri)) return { action: 'error', code: 'DDN-UI09', message: 'Tri-state only: unset, true or false.' };
  if (tri === 'unset') return current === undefined ? { action: 'none' } : { action: 'remove' };
  const v = tri === 'true';
  if (current === v) return { action: 'none' };
  return { action: 'set', value: v };
}

/* numeralCommit(raw): one patent reference numeral — blank removes, otherwise
 * an integer 1..99999 (mirrors DDN-VP05; uniqueness stays with DDN-VP06 at
 * commit time and the adjacent coded warning from numeralConflicts). */
function numeralCommit(raw, current) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return current === undefined ? { action: 'none' } : { action: 'remove' };
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 1 || n > 99999) return { action: 'error', code: 'DDN-UI12', message: 'A numeral is an integer in 1-99999 (blank removes).' };
  if (current === n) return { action: 'none' };
  return { action: 'set', value: n };
}

/* numeralConflicts(elements): numerals declared by more than one element in
 * the view — [{numeral, uids}] — for the adjacent coded (DDN-VP06) warning. */
function numeralConflicts(elements) {
  const byNum = new Map();
  for (const n of elements || []) {
    const num = n.properties && n.properties.numeral;
    if (num === undefined) continue;
    if (!byNum.has(num)) byNum.set(num, []);
    byNum.get(num).push(n.id);
  }
  return [...byNum.entries()].filter(([, uids]) => uids.length > 1).map(([numeral, uids]) => ({ numeral, uids }));
}

/* renumberPlan(elements, {start, step}): the renumber pass — every element
 * currently bearing a numeral is reassigned sequentially (start, start+step,
 * …) in view (source/reading) order. Returns {assignments, changes, skipped}
 * where assignments maps uid → numeral for the elements whose numeral moves. */
function renumberPlan(elements, { start = 10, step = 10 } = {}) {
  if (!Number.isSafeInteger(start) || start < 1 || !Number.isSafeInteger(step) || step < 1) return { error: { code: 'DDN-UI12', message: 'Renumber start/step are positive integers.' } };
  const numbered = (elements || []).filter(n => n.properties && n.properties.numeral !== undefined);
  if (start + step * (numbered.length - 1) > 99999 && numbered.length) return { error: { code: 'DDN-UI12', message: 'Renumbering ' + numbered.length + ' elements from ' + start + ' by ' + step + ' exceeds the 99999 numeral cap.' } };
  const assignments = {}, changes = [];
  numbered.forEach((n, i) => {
    const to = start + step * i, from = n.properties.numeral;
    if (from !== to) { assignments[n.id] = to; changes.push({ uid: n.id, name: n.name || n.local || n.id, from, to }); }
  });
  return { assignments, changes, skipped: numbered.length - changes.length };
}

/* refAnchorScan(ir): the ref: anchors currently declared in element/relation
 * labels and text (chapter 55 §S4 grammar) — [{site, siteName, anchor}]. */
const REF_RE = /\bref:([A-Za-z_][A-Za-z0-9_-]*)/g;
function refAnchorScan(ir) {
  const out = [];
  const scan = (text, site, siteName) => {
    if (typeof text !== 'string' || !text.includes('ref:')) return;
    for (const m of text.matchAll(REF_RE)) out.push({ site, siteName, anchor: m[1] });
  };
  for (const n of (ir && ir.elements) || []) { scan(n.name, n.id, n.name || n.local); scan(n.properties && n.properties.text, n.id, n.name || n.local); }
  for (const r of (ir && ir.relations) || []) { scan(r.name, r.id, r.name || r.id); scan(r.properties && r.properties.text, r.id, r.name || r.id); }
  return out;
}

const pure = {
  SHEETS, sheetForProjection, typeSheetAutoState,
  CMMN_ROLES, cmmnRole, cmmnOutline,
  sentryCommit, decoratorCommit, planningCommit,
  CMMN_DECORATOR_FLAGS, CMMN_PLANNING_ROLES, CMMN_DECORATOR_ROLES,
  /* Phase 6a */
  MULT_RE, memberCommit, templateCommit, assocClassCommit, naryCommit, gensetCommit,
  laneRectCommit, laneMembersPlan, messageCommit, FRAGMENT_OPERATORS, fragmentCommit,
  EVENT_TYPES, EVENT_POSITIONS, eventCommit, GATEWAY_TYPES, gatewayCommit, boolPropCommit,
  numeralCommit, numeralConflicts, renumberPlan, refAnchorScan
};
if (typeof document === 'undefined') {
  if (typeof module === 'object' && module.exports) module.exports = pure;
  host.DDNToolSheets = pure;
  return;
}

/* ================= DOM layer (browser only) ================= */

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
function mini(label, title, fn) {
  const b = el('button', 'ddn-mini', label);
  b.type = 'button';
  if (title) b.title = title;
  b.addEventListener('click', fn);
  return b;
}

/* The CMMN sheet body. `target` is {outline, editor} — the drawer's two panes.
 * hooks (supplied by tool.js):
 *   ir()              → the resolved IR for the active view
 *   guided(fn, onError) → run fn inside one guided, core-validated, undoable
 *                       commit wrapper; coded errors land via onError
 *   addElement(kind) / reparent(uid, stageUid|null) / removeFromStage(uid) /
 *   deleteItem(uid) / setExtension(uid, key, rec|undefined)
 *   select(uid)       → sync the canvas/inspector selection
 *   selectedUid()     → current canvas selection (for tree highlight)
 *   candidates()      → [{ref, label, kind}] reference-picker candidates
 *   descriptors()     → generated form descriptors (x_cmmn labels/help)
 * Renderers for further sheet ids register in RENDERERS (phase 6). */
function renderCmmnSheet(target, hooks) {
  const outlineEl = target.outline, editorEl = target.editor;
  outlineEl.replaceChildren();
  editorEl.replaceChildren();
  let sheetSel = null;

  const descFor = key => (hooks.descriptors() || []).find(d => d.key === key);
  const labelFor = (key, sub) => {
    const d = descFor(key);
    const f = d && (d.fields || []).find(x => x.key === sub);
    return (f && f.label) || sub;
  };

  function refresh() { paint(); }

  function paint() {
    const ir = hooks.ir();
    if (!ir) return;
    const tree = cmmnOutline(ir);
    if (sheetSel && !tree.byUid[sheetSel]) sheetSel = null;
    paintOutline(tree);
    paintEditor(ir, tree);
  }

  function paintOutline(tree) {
    outlineEl.replaceChildren();
    const bar = el('div', 'ddn-sheet-toolbar');
    /* New tasks/sentries/milestones join the selected stage's frame (the
     * outline selection is the user's working context); stages get their own
     * frame. The tool-side hook performs the source writes. */
    const intoStage = () => {
      const selNode = sheetSel && tree.byUid[sheetSel];
      if (!selNode) return null;
      if (selNode.role === 'stage') return selNode.uid;
      const parent = tree.roots.find(r => r.role === 'stage' && r.children.some(c => c.uid === selNode.uid));
      return parent ? parent.uid : null;
    };
    const add = (label, kind, title) => bar.append(mini(label, title, () => {
      hooks.guided(() => hooks.addElement(kind, intoStage()));
    }));
    add('+ Stage', 'cmmn.stage', 'Add a case stage (creates its stage frame in this view)');
    add('+ Task', 'cmmn.humantask', 'Add a task (adds it to the selected stage when one is selected)');
    add('+ Milestone', 'cmmn.milestone', 'Add a milestone');
    add('+ Case file', 'cmmn.casefile', 'Add a case file item');
    add('+ Sentry', 'cmmn.sentry', 'Add an entry sentry (attached to the selected stage when one is selected)');
    outlineEl.append(bar);
    const canvasSel = hooks.selectedUid && hooks.selectedUid();
    const renderNodes = (nodes, hostUl) => {
      for (const n of nodes) {
        const li = document.createElement('li');
        const row = el('div', 'ddn-sheet-node');
        row.setAttribute('role', 'treeitem');
        row.setAttribute('aria-selected', String(n.uid === sheetSel || n.uid === canvasSel));
        const name = el('span', '', n.name || n.local);
        name.style.flex = '1';
        const flags = n.uid && (hooks.ir().elements.find(e => e.id === n.uid) || {}).properties;
        const xc = flags && flags.x_cmmn;
        const on = xc ? Object.keys(xc).filter(k => xc[k] === true) : [];
        row.append(name, el('span', 'ddn-sheet-kind', n.role));
        if (on.length) row.append(el('span', 'ddn-sheet-flags-on', on.join(' ')));
        row.addEventListener('click', () => { sheetSel = n.uid; hooks.select(n.uid); paint(); });
        li.append(row);
        if (n.children.length) {
          const ul = document.createElement('ul');
          renderNodes(n.children, ul);
          li.append(ul);
        }
        hostUl.append(li);
      }
    };
    const ul = el('ul', 'ddn-sheet-tree');
    ul.setAttribute('role', 'tree');
    renderNodes(tree.roots, ul);
    outlineEl.append(ul);
  }

  function paintEditor(ir, tree) {
    editorEl.replaceChildren();
    const uid = sheetSel;
    if (!uid || !tree.byUid[uid]) {
      editorEl.append(el('p', 'ddn-dim', 'Select an item in the outline to edit its sentry, decorator flags, planning table or stage membership.'));
      return;
    }
    const node = tree.byUid[uid];
    const model = ir.elements.find(e => e.id === uid);
    const props = (model && model.properties) || {};
    editorEl.append(el('h4', '', (node.name || node.local) + ' — ' + node.kind));
    const err = el('p', 'ddn-sheet-error');
    const commit = fn => hooks.guided(fn, m => { err.textContent = m || ''; });
    editorEl.append(err);

    /* Stage membership (reparent): move between stage frames or to the case
     * root. Sentries must stay inside a stage frame (DDN-PJ120), so "case
     * root" is not offered for them. */
    const stages = tree.roots.concat(tree.roots.flatMap(r => r.children)).filter(n => n.role === 'stage');
    const memberRow = el('label', 'ddn-field');
    memberRow.append(el('span', '', 'Stage membership '));
    const sel = document.createElement('select');
    const parentStage = stages.find(s => s.children.some(c => c.uid === uid));
    if (node.role !== 'sentry') sel.add(new Option('Case root (no stage)', ''));
    for (const s of stages) sel.add(new Option(s.name || s.local, s.uid));
    sel.value = parentStage ? parentStage.uid : (node.role === 'sentry' && stages.length ? stages[0].uid : '');
    sel.addEventListener('change', () => commit(() => hooks.reparent(uid, sel.value || null)));
    memberRow.append(sel);
    editorEl.append(memberRow);

    if (node.role === 'sentry') paintSentry(editorEl, uid, props, commit);
    if (CMMN_DECORATOR_ROLES.includes(node.role)) paintDecorators(editorEl, uid, props, commit);
    if (CMMN_PLANNING_ROLES.includes(node.role) || props.x_planning) paintPlanning(editorEl, uid, props, commit);

    const row = el('div', 'ddn-row');
    if (parentStage) row.append(mini('Remove from stage', 'Take this item out of ' + (parentStage.name || parentStage.local) + ' (the definition stays)', () => commit(() => hooks.removeFromStage(uid))));
    row.append(mini('Delete definition', 'Delete this definition from the model (refused while other definitions reference it)', () => commit(() => { hooks.deleteItem(uid); sheetSel = null; })));
    editorEl.append(row);
  }

  function paintSentry(panel, uid, props, commit) {
    panel.append(el('h4', '', 'Sentry'));
    const cur = props.x_sentry || {};
    const cands = hooks.candidates ? hooks.candidates() : [];
    const list = el('datalist');
    list.id = 'ddn-sheet-refs';
    list.replaceChildren(...cands.map(c => new Option((c.label || c.ref) + (c.kind ? ' — ' + c.kind : ''), '@' + c.ref)));
    const onSel = document.createElement('select');
    onSel.add(new Option('entry', 'entry'));
    onSel.add(new Option('exit', 'exit'));
    onSel.value = cur.on || 'entry';
    const mkRef = (label, value) => {
      const f = el('label', 'ddn-field');
      const i = document.createElement('input');
      i.type = 'text'; i.placeholder = '@reference (blank = none)';
      i.value = value && value.$ref ? '@' + value.$ref : '';
      i.setAttribute('list', list.id);
      f.append(el('span', '', label + ' '), i);
      return { f, i };
    };
    const attach = mkRef('Attach to (stage/task)', cur.attach);
    const onPart = mkRef('On part (event listener)', cur.on_part);
    const ifF = el('label', 'ddn-field');
    const ifI = document.createElement('input');
    ifI.type = 'text'; ifI.placeholder = 'criterion text (blank = none)';
    ifI.value = cur.if_part || '';
    ifF.append(el('span', '', 'If part '), ifI);
    const onF = el('label', 'ddn-field');
    onF.append(el('span', '', 'On '), onSel);
    panel.append(onF, attach.f, onPart.f, ifF, list);
    panel.append(mini('Apply sentry', 'Write x_sentry (one undoable, core-validated transaction)', () => commit(() => {
      const out = sentryCommit(props.x_sentry, { on: onSel.value, attach: attach.i.value, onPart: onPart.i.value, ifPart: ifI.value });
      if (out.action === 'error') throw Object.assign(new Error(out.message), { code: out.code });
      if (out.action === 'set') hooks.setExtension(uid, 'x_sentry', out.value);
    })));
  }

  /* Decorator flags: tri-state optional booleans (unset/true/false) on x_cmmn.
   * Labels come from the generated descriptor registry where present (phase
   * 4 contract), one guided setElementExtension transaction per flag change. */
  function paintDecorators(panel, uid, props, commit) {
    panel.append(el('h4', '', 'Plan-item decorators (x_cmmn)'));
    const row = el('div', 'ddn-sheet-flags');
    const cur = props.x_cmmn || {};
    for (const flag of CMMN_DECORATOR_FLAGS) {
      const lab = el('label');
      const s = document.createElement('select');
      s.add(new Option('unset', 'unset'));
      s.add(new Option('true', 'true'));
      s.add(new Option('false', 'false'));
      s.value = cur[flag] === true ? 'true' : cur[flag] === false ? 'false' : 'unset';
      s.setAttribute('aria-label', labelFor('x_cmmn', flag));
      s.addEventListener('change', () => commit(() => {
        const out = decoratorCommit(props.x_cmmn, flag, s.value);
        if (out.action === 'set') hooks.setExtension(uid, 'x_cmmn', out.value);
        else if (out.action === 'remove') hooks.setExtension(uid, 'x_cmmn', undefined);
      }));
      lab.append(labelFor('x_cmmn', flag) + ' ', s);
      row.append(lab);
    }
    panel.append(row);
  }

  /* Planning table editor: x_planning.items as reorderable rows. */
  function paintPlanning(panel, uid, props, commit) {
    panel.append(el('h4', '', 'Planning table (x_planning)'));
    const cur = (props.x_planning && props.x_planning.items) || [];
    const rows = el('div');
    const items = cur.slice();
    const paintRows = () => {
      rows.replaceChildren(...items.map((text, i) => {
        const r = el('div', 'ddn-sheet-plan-row');
        const input = document.createElement('input');
        input.type = 'text'; input.value = text; input.setAttribute('aria-label', 'Planning item ' + (i + 1));
        input.addEventListener('input', () => { items[i] = input.value; });
        r.append(input,
          mini('↑', 'Move up', () => { if (i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; paintRows(); } }),
          mini('↓', 'Move down', () => { if (i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; paintRows(); } }),
          mini('×', 'Remove this row', () => { items.splice(i, 1); paintRows(); }));
        return r;
      }));
    };
    paintRows();
    panel.append(rows);
    const bar = el('div', 'ddn-row');
    bar.append(
      mini('Add item', 'Add a planning-table row', () => { items.push(''); paintRows(); }),
      mini('Apply planning table', 'Write x_planning (one undoable, core-validated transaction; an empty list removes the property)', () => commit(() => {
        const out = planningCommit(items, props.x_planning);
        if (out.action === 'error') throw Object.assign(new Error(out.message), { code: out.code });
        if (out.action === 'set') hooks.setExtension(uid, 'x_planning', out.value);
        else if (out.action === 'remove') hooks.setExtension(uid, 'x_planning', undefined);
      })));
    panel.append(bar);
  }

  paint();
  return { refresh };
}

/* ---- phase 6a shared DOM helpers ---- */

/* Apply a pure-layer commit decision through the extension hook. Throws the
 * coded error so the caller's guided wrapper surfaces it. `hook` defaults to
 * hooks.setExtension (element/field records); pass hooks.setRelationExtension
 * for relation records. */
function extCommit(hooks, uid, key, out, hook) {
  if (out.action === 'error') throw Object.assign(new Error(out.message), { code: out.code });
  const write = hook || hooks.setExtension;
  if (out.action === 'set') write(uid, key, out.value);
  else if (out.action === 'remove') write(uid, key, undefined);
}
function fieldRow(label, input) {
  const f = el('label', 'ddn-field');
  f.append(el('span', '', label + ' '), input);
  return f;
}
function selectOf(options, current, aria) {
  const s = document.createElement('select');
  for (const [v, l] of options) s.add(new Option(l, v));
  s.value = current;
  if (aria) s.setAttribute('aria-label', aria);
  return s;
}
function triOf(current, aria) {
  return selectOf([['unset', 'unset'], ['true', 'true'], ['false', 'false']], current === true ? 'true' : current === false ? 'false' : 'unset', aria);
}
function textInput(value, placeholder, aria) {
  const i = document.createElement('input');
  i.type = 'text';
  i.value = value == null ? '' : value;
  if (placeholder) i.placeholder = placeholder;
  if (aria) i.setAttribute('aria-label', aria);
  return i;
}
/* A reference picker: text input bound to a datalist of the view's elements,
 * answering the typed path. `resolve` maps a picked uid to the reference path
 * valid at the edit site (hooks.refFor). */
function refPicker(hooks, siteUid, currentRef, aria) {
  const id = 'ddn-refs-' + Math.random().toString(36).slice(2, 8);
  const list = el('datalist'); list.id = id;
  const cands = (hooks.candidates ? hooks.candidates() : []);
  for (const c of cands) list.append(new Option((c.label || c.ref) + (c.kind ? ' — ' + c.kind : ''), c.ref));
  const i = textInput(currentRef || '', '@reference (blank = none)', aria);
  i.setAttribute('list', id);
  return { input: i, list, path: () => cleanRef(i.value) };
}

/* ================= UML structure sheet =================
 * Member table for the selected class/enumeration (x_member, DDN-PJ154),
 * template parameter box (x_template), and structured association editors
 * (x_association_class / x_nary / x_genset — PJ150/151/152). End-label
 * editing lives in the Inspector (phase 3); this sheet manages per-class
 * members and the structured association attachments only. */
function renderStructureSheet(target, hooks) {
  const outlineEl = target.outline, editorEl = target.editor;
  outlineEl.replaceChildren(); editorEl.replaceChildren();
  let sel = null;

  const CLASSIFIERS = ['uml.class', 'uml.interface', 'uml.enumeration'];
  const isClassifier = n => CLASSIFIERS.includes(n.kind) || (n.fields || []).length > 0;

  function paint() {
    const ir = hooks.ir();
    if (!ir) return;
    if (sel && ![...ir.elements, ...ir.relations].some(x => x.id === sel)) sel = null;
    paintOutline(ir);
    paintEditor(ir);
  }

  function paintOutline(ir) {
    outlineEl.replaceChildren();
    const bar = el('div', 'ddn-sheet-toolbar');
    bar.append(el('span', 'ddn-dim', 'Select a classifier to edit its members, or an association/generalization for its structured attachment.'));
    outlineEl.append(bar);
    const ul = el('ul', 'ddn-sheet-tree');
    ul.setAttribute('role', 'tree');
    const item = (id, label, kindLabel) => {
      const li = document.createElement('li');
      const row = el('div', 'ddn-sheet-node');
      row.setAttribute('role', 'treeitem');
      row.setAttribute('aria-selected', String(id === sel || id === (hooks.selectedUid && hooks.selectedUid())));
      const name = el('span', '', label); name.style.flex = '1';
      row.append(name, el('span', 'ddn-sheet-kind', kindLabel));
      row.addEventListener('click', () => { sel = id; hooks.select(id); paint(); });
      li.append(row); ul.append(li);
    };
    for (const n of ir.elements.filter(isClassifier)) item(n.id, n.name || n.local, n.kind + ' · ' + (n.fields || []).length + ' member(s)');
    for (const r of ir.relations.filter(r => r.kind === 'uml.association' || r.kind === 'uml.generalization')) {
      const p = r.properties || {};
      const tags = [p.x_association_class && 'class', p.x_nary && (p.x_nary.ends || []).length + ' ends', p.x_genset && 'genset ' + p.x_genset.name].filter(Boolean).join(' · ');
      item(r.id, r.name || r.ref, r.kind + (tags ? ' · ' + tags : ''));
    }
    outlineEl.append(ul);
  }

  function paintEditor(ir) {
    editorEl.replaceChildren();
    const err = el('p', 'ddn-sheet-error');
    const commit = fn => hooks.guided(fn, m => { err.textContent = m || ''; });
    const node = sel && ir.elements.find(n => n.id === sel);
    const rel = sel && ir.relations.find(r => r.id === sel);
    if (node) paintClassifier(ir, node, commit);
    else if (rel) paintRelation(ir, rel, commit);
    else editorEl.append(el('p', 'ddn-dim', 'Select a classifier (members, template box) or an association/generalization (association class, n-ary ends, generalization set).'));
    editorEl.prepend(err);
  }

  function paintClassifier(ir, node, commit) {
    const props = node.properties || {};
    editorEl.append(el('h4', '', (node.name || node.local) + ' — ' + node.kind));
    /* Template parameter box (x_template; PJ153 restricts to class/interface,
     * which the commit-time build enforces). */
    editorEl.append(el('h4', '', 'Template parameters (x_template)'));
    const params = ((props.x_template && props.x_template.parameters) || []).slice();
    const rows = el('div');
    const paintParams = () => rows.replaceChildren(...params.map((text, i) => {
      const r = el('div', 'ddn-sheet-plan-row');
      const input = textInput(text, '', 'Template parameter ' + (i + 1));
      input.addEventListener('input', () => { params[i] = input.value; });
      r.append(input, mini('×', 'Remove this parameter', () => { params.splice(i, 1); paintParams(); }));
      return r;
    }));
    paintParams();
    editorEl.append(rows);
    const tb = el('div', 'ddn-row');
    tb.append(
      mini('Add parameter', 'Add a template parameter row', () => { params.push(''); paintParams(); }),
      mini('Apply template box', 'Write x_template (empty list removes the property)', () => commit(() => extCommit(hooks, node.id, 'x_template', templateCommit(params, props.x_template)))));
    editorEl.append(tb);

    /* Member table. */
    editorEl.append(el('h4', '', 'Members (x_member — DDN-PJ154)'));
    const table = el('table', 'ddn-sheet-table');
    const head = document.createElement('tr');
    for (const h of ['name', 'kind', 'visibility', 'S', 'A', 'D', 'multiplicity', 'modifiers', '']) head.append(el('th', '', h));
    table.append(head);
    for (const f of node.fields || []) {
      const m = (f.properties && f.properties.x_member) || {};
      const tr = document.createElement('tr');
      const nameI = textInput(f.name || f.local, '', 'Member name');
      nameI.addEventListener('change', () => { if (nameI.value && nameI.value !== (f.name || f.local)) commit(() => hooks.setLabel(f.id, nameI.value)); });
      const kindS = selectOf([['', '—'], ['attribute', 'attribute'], ['operation', 'operation'], ['literal', 'literal']], m.kind || '', 'Member kind');
      const visS = selectOf([['', '—'], ['public', '+ public'], ['private', '− private'], ['protected', '# protected'], ['package', '~ package']], m.visibility || '', 'Member visibility');
      const mkFlag = (k, title) => { const c = document.createElement('input'); c.type = 'checkbox'; c.checked = m[k] === true; c.title = title; c.setAttribute('aria-label', title); return c; };
      const stC = mkFlag('static', 'static'), abC = mkFlag('abstract', 'abstract'), deC = mkFlag('derived', 'derived');
      const multI = textInput(m.multiplicity || '', '1, 0..1, *', 'Multiplicity');
      const mods = new Set(m.modifiers || []);
      const modBox = el('span', 'ddn-sheet-flags');
      for (const mod of ['ordered', 'unique', 'readOnly']) {
        const lab = el('label');
        const c = document.createElement('input'); c.type = 'checkbox'; c.checked = mods.has(mod);
        c.setAttribute('aria-label', '{' + mod + '}');
        c.addEventListener('change', () => { c.checked ? mods.add(mod) : mods.delete(mod); });
        lab.append(c, ' {' + mod + '}');
        modBox.append(lab);
      }
      const apply = mini('Apply', 'Write x_member for this member (one undoable transaction)', () => commit(() => extCommit(hooks, f.id, 'x_member',
        memberCommit(f.properties && f.properties.x_member, { kind: kindS.value, visibility: visS.value, static: stC.checked, abstract: abC.checked, derived: deC.checked, multiplicity: multI.value, modifiers: [...mods] }, node.kind))));
      const del = mini('×', 'Delete this member (refused while referenced)', () => commit(() => hooks.deleteItem(f.id)));
      for (const cell of [nameI, kindS, visS, stC, abC, deC, multI, modBox]) { const td = document.createElement('td'); td.append(cell); tr.append(td); }
      const td = document.createElement('td'); td.append(apply, del); tr.append(td);
      table.append(tr);
    }
    editorEl.append(table);
    /* Add member. */
    const addRow = el('div', 'ddn-row');
    const newId = textInput('', 'member_id', 'New member identifier');
    const newName = textInput('', 'Member label', 'New member label');
    addRow.append(newId, newName, mini('Add member', 'Add a field to this classifier', () => commit(() => {
      if (!newId.value.trim()) throw Object.assign(new Error('A new member needs an identifier.'), { code: 'DDN-UI10' });
      hooks.addMember(node.id, { id: newId.value.trim(), name: newName.value.trim() });
    })));
    editorEl.append(addRow);
  }

  function paintRelation(ir, rel, commit) {
    const props = rel.properties || {};
    editorEl.append(el('h4', '', (rel.name || rel.ref) + ' — ' + rel.kind));
    const classes = (ir.elements || []).filter(n => n.kind === 'uml.class');
    if (rel.kind === 'uml.association') {
      /* Association class (PJ150). Resolved IR refs are uids; the picker shows
       * uids and the write converts through hooks.refFor (alias-aware). */
      editorEl.append(el('h4', '', 'Association class (x_association_class)'));
      const curUid = props.x_association_class && props.x_association_class.class && props.x_association_class.class.$ref;
      const pick = selectOf([['', '— none —'], ...classes.map(c => [c.id, (c.name || c.local) + ' (' + c.local + ')'])], curUid || '', 'Association class');
      const bar = el('div', 'ddn-row');
      bar.append(mini('Apply association class', 'Write x_association_class (blank removes it)', () => commit(() =>
        extCommit(hooks, rel.id, 'x_association_class', assocClassCommit(props.x_association_class, pick.value ? hooks.refFor(pick.value, rel.id) : ''), hooks.setRelationExtension))));
      editorEl.append(fieldRow('Class ', pick), bar);
      /* N-ary ends (PJ151). */
      editorEl.append(el('h4', '', 'N-ary ends (x_nary)'));
      const ends = ((props.x_nary && props.x_nary.ends) || []).map(e => ({
        element: (e.element && e.element.$ref) || '',
        role: e.role || '', multiplicity: e.multiplicity || ''
      }));
      const eRows = el('div');
      const paintEnds = () => eRows.replaceChildren(...ends.map((e, i) => {
        const r = el('div', 'ddn-sheet-plan-row');
        const ep = selectOf([['', '— classifier —'], ...ir.elements.filter(n => CLASSIFIERS.includes(n.kind)).map(n => [n.id, n.name || n.local])], e.element, 'End ' + (i + 1) + ' classifier');
        ep.addEventListener('change', () => { ends[i].element = ep.value; });
        const roleI = textInput(e.role, 'role', 'End role');
        roleI.addEventListener('input', () => { ends[i].role = roleI.value; });
        const multI = textInput(e.multiplicity, 'multiplicity', 'End multiplicity');
        multI.addEventListener('input', () => { ends[i].multiplicity = multI.value; });
        r.append(ep, roleI, multI, mini('×', 'Remove this end', () => { ends.splice(i, 1); paintEnds(); }));
        return r;
      }));
      paintEnds();
      const nb = el('div', 'ddn-row');
      nb.append(
        mini('Add end', 'Add an n-ary end row', () => { ends.push({ element: '', role: '', multiplicity: '' }); paintEnds(); }),
        mini('Apply n-ary ends', 'Write x_nary (empty list removes the property)', () => commit(() => extCommit(hooks, rel.id, 'x_nary',
          naryCommit(props.x_nary, ends.map(e => ({ element: e.element ? hooks.refFor(e.element, rel.id) : '', role: e.role, multiplicity: e.multiplicity }))), hooks.setRelationExtension))));
      editorEl.append(eRows, nb);
    }
    if (rel.kind === 'uml.generalization') {
      /* Generalization set (PJ152). */
      editorEl.append(el('h4', '', 'Generalization set (x_genset)'));
      const cur = props.x_genset || {};
      const nameI = textInput(cur.name || '', 'set name', 'Generalization set name');
      const dj = triOf(cur.disjoint, 'Disjoint'), cp = triOf(cur.complete, 'Complete');
      editorEl.append(fieldRow('Name ', nameI), fieldRow('Disjoint ', dj), fieldRow('Complete ', cp));
      editorEl.append(mini('Apply generalization set', 'Write x_genset', () => commit(() =>
        extCommit(hooks, rel.id, 'x_genset', gensetCommit(props.x_genset, { name: nameI.value, disjoint: dj.value, complete: cp.value }), hooks.setRelationExtension))));
      if (cur.name) editorEl.append(mini('Remove generalization set', 'Remove x_genset from this generalization', () => commit(() => hooks.setRelationExtension(rel.id, 'x_genset', undefined))));
    }
    editorEl.append(el('p', 'ddn-dim', 'End labels (role/multiplicity/qualifier per association end) are edited in the Inspector — this sheet carries the structured attachments only.'));
  }

  paint();
  return { refresh: paint };
}

/* ================= UML activity sheet =================
 * Lane/partition editor: view frames as lanes — add, rename, resize (X/Y/W/H)
 * or fit-to-members, and assign/unassign elements with the one-lane policy.
 * Assignment also maintains x_partition {lane} on the element (DDN-PJ114 is
 * re-checked by the commit-time build). */
function renderActivitySheet(target, hooks) {
  const outlineEl = target.outline, editorEl = target.editor;
  outlineEl.replaceChildren(); editorEl.replaceChildren();
  let sel = null;
  const local = f => String(f.id).split('::').pop().split('.').pop();

  function paint() {
    const ir = hooks.ir();
    if (!ir) return;
    const frames = (ir.view && ir.view.frames) || [];
    if (sel && !frames.some(f => local(f) === sel)) sel = null;
    paintOutline(ir, frames);
    paintEditor(ir, frames);
  }

  function paintOutline(ir, frames) {
    outlineEl.replaceChildren();
    const bar = el('div', 'ddn-sheet-toolbar');
    const idI = textInput('', 'lane_id', 'New lane identifier');
    const nameI = textInput('', 'Lane label', 'New lane label');
    bar.append(idI, nameI, mini('＋ New lane', 'Create an unscoped frame lane in this view', () => hooks.guided(() => {
      if (!idI.value.trim()) throw Object.assign(new Error('A lane needs an identifier.'), { code: 'DDN-UI11' });
      hooks.addLane({ id: idI.value.trim(), name: nameI.value.trim() || idI.value.trim() });
    })));
    outlineEl.append(bar);
    const ul = el('ul', 'ddn-sheet-tree');
    ul.setAttribute('role', 'tree');
    for (const f of frames) {
      const li = document.createElement('li');
      const row = el('div', 'ddn-sheet-node');
      row.setAttribute('role', 'treeitem');
      row.setAttribute('aria-selected', String(local(f) === sel));
      const name = el('span', '', f.name || local(f)); name.style.flex = '1';
      row.append(name, el('span', 'ddn-sheet-kind', (f.members || []).length + ' member(s)' + (f.at ? ' · pinned' : ' · auto')));
      row.addEventListener('click', () => { sel = local(f); paint(); });
      li.append(row); ul.append(li);
    }
    outlineEl.append(ul);
  }

  function paintEditor(ir, frames) {
    editorEl.replaceChildren();
    const err = el('p', 'ddn-sheet-error');
    const commit = fn => hooks.guided(fn, m => { err.textContent = m || ''; });
    const frame = frames.find(f => local(f) === sel);
    if (!frame) { editorEl.append(el('p', 'ddn-dim', 'Select a lane to rename, resize, or manage its members. Lanes are view-local visual groups; assignment also writes the element’s x_partition lane property.')); editorEl.prepend(err); return; }
    editorEl.append(el('h4', '', (frame.name || sel) + ' — lane'));
    editorEl.append(err);
    /* Rename + geometry. */
    const nameI = textInput(frame.name || '', '', 'Lane label');
    nameI.addEventListener('change', () => { if (nameI.value.trim() && nameI.value !== frame.name) commit(() => hooks.setFrameProperties(sel, { name: nameI.value.trim() })); });
    editorEl.append(fieldRow('Label ', nameI));
    const nums = {};
    const row = el('div', 'ddn-row');
    const at = frame.at || [], size = frame.size || [];
    const px = q => q && q.$quantity !== undefined ? q.$quantity : '';
    for (const [k, v] of [['x', px(at[0])], ['y', px(at[1])], ['w', px(size[0])], ['h', px(size[1])]]) {
      const i = document.createElement('input');
      i.type = 'number'; i.value = v === '' ? '' : Math.round(v); i.setAttribute('aria-label', 'Lane ' + k.toUpperCase() + ' (px)');
      i.style.width = '6em';
      nums[k] = i;
      row.append(fieldRow(k.toUpperCase() + ' ', i));
    }
    editorEl.append(row);
    const gb = el('div', 'ddn-row');
    gb.append(
      mini('Apply X/Y/W/H', 'Write explicit lane geometry (this view only)', () => commit(() => {
        const out = laneRectCommit({ x: nums.x.value, y: nums.y.value, w: nums.w.value, h: nums.h.value });
        if (out.action === 'error') throw Object.assign(new Error(out.message), { code: out.code });
        hooks.setFrameProperties(sel, { at: out.at, size: out.size });
      })),
      mini('Fit to members', 'Remove explicit at/size; the lane auto-fits its members', () => commit(() => hooks.setFrameProperties(sel, { at: null, size: null }))));
    editorEl.append(gb);
    /* Members. */
    editorEl.append(el('h4', '', 'Members'));
    const chips = el('div', 'ddn-sheet-flags');
    for (const m of frame.members || []) {
      const n = ir.elements.find(x => x.id === m);
      const chip = el('span', 'ddn-chip', (n && (n.name || n.local)) || m + ' ');
      chip.append(mini('×', 'Remove from this lane (also clears its x_partition)', () => commit(() => hooks.unassignFromLane(sel, m))));
      chips.append(chip);
    }
    if (!(frame.members || []).length) chips.append(el('span', 'ddn-dim', 'No members.'));
    editorEl.append(chips);
    const inFrames = new Set(frames.flatMap(f => f.members || []));
    const cands = (ir.elements || []).filter(n => !inFrames.has(n.id));
    const pick = selectOf(cands.map(n => [n.id, (n.name || n.local) + ' — ' + n.kind]), cands.length ? cands[0].id : '', 'Assign element');
    const ab = el('div', 'ddn-row');
    ab.append(pick, mini('Assign', 'Add to this lane (removes it from any other lane; writes x_partition {lane})', () => commit(() => { if (pick.value) hooks.assignToLane(sel, pick.value); })));
    editorEl.append(ab);
  }

  paint();
  return { refresh: paint };
}

/* ================= UML sequence sheet =================
 * Ported from the deprecated prototype's proven design: lifelines mirror the
 * projection plan's participants, messages its message rows; order is
 * DECLARATION order, so ↑/↓ is a moveDeclaration span move, never a pixel
 * drag or a view-list rewrite. Message label / dashed return (x_return
 * true-or-absent) / delete, plus the x_message annotation record and the
 * x_fragment combined-fragment editor. */
function renderSequenceSheet(target, hooks) {
  const outlineEl = target.outline, editorEl = target.editor;
  outlineEl.replaceChildren(); editorEl.replaceChildren();
  let selMsg = null;

  function paint() {
    const ir = hooks.ir();
    if (!ir) return;
    let plan = null, planError = null;
    try { plan = hooks.plan(); } catch (e) { planError = (e && e.code ? e.code + ': ' : '') + (e && e.message || e); }
    if (planError) {
      outlineEl.replaceChildren(el('p', 'ddn-sheet-error', planError + ' The sheet stays read-only; the source is unchanged.'));
      editorEl.replaceChildren();
      return;
    }
    if (selMsg && !plan.messages.some(r => r.id === selMsg)) selMsg = null;
    paintLifelines(ir, plan);
    paintMessages(ir, plan);
  }

  function paintLifelines(ir, plan) {
    outlineEl.replaceChildren();
    outlineEl.append(el('h4', '', 'Lifelines · declaration order'));
    const err = el('p', 'ddn-sheet-error');
    const commit = fn => hooks.guided(fn, m => { err.textContent = m || ''; });
    outlineEl.append(err);
    const ul = el('ul', 'ddn-sheet-tree');
    plan.participants.forEach((n, i) => {
      const li = document.createElement('li');
      const row = el('div', 'ddn-sheet-node');
      const name = el('span', '', n.name || String(n.id).split('.').pop()); name.style.flex = '1';
      row.append(name);
      row.append(
        mini('↑', 'Move one lifeline left (declaration span move)', () => commit(() => hooks.moveDeclaration(plan.participants[i].id, plan.participants[i - 1].id)), ),
        mini('↓', 'Move one lifeline right', () => commit(() => hooks.moveDeclaration(plan.participants[i + 1].id, plan.participants[i].id))),
        mini('remove', 'Hide this lifeline from the view; the shared definition is kept', () => commit(() => hooks.hide(n.id))));
      row.children[row.children.length - 3].disabled = i === 0;
      row.children[row.children.length - 2].disabled = i === plan.participants.length - 1;
      row.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') hooks.select(n.id); });
      li.append(row); ul.append(li);
    });
    outlineEl.append(ul);
    /* Add lifeline: existing definition (one occurrence) or a new participant. */
    const inPlan = new Set(plan.participants.map(n => n.id));
    const cands = (ir.elements || []).filter(n => n.type === 'object' && !inPlan.has(n.id));
    const bar = el('div', 'ddn-sheet-toolbar');
    const pick = selectOf(cands.map(n => [n.id, (n.name || n.local) + ' — ' + n.kind]), cands.length ? cands[0].id : '', 'Existing definition');
    bar.append(pick, mini('＋ Add existing', 'Add the selected existing definition as one lifeline occurrence (never a clone)', () => commit(() => { if (pick.value) hooks.selectInView(pick.value); })));
    const idI = textInput('', 'participant_id', 'New participant identifier');
    const nameI = textInput('', 'Label', 'New participant label');
    bar.append(idI, nameI, mini('＋ New', 'Create a new participant (shared definition)', () => commit(() => {
      if (!idI.value.trim()) throw Object.assign(new Error('A new participant needs an identifier.'), { code: 'DDN-UI14' });
      hooks.addElement('object', null, { id: idI.value.trim(), name: nameI.value.trim() || idI.value.trim() });
    })));
    outlineEl.append(bar);
  }

  function paintMessages(ir, plan) {
    editorEl.replaceChildren();
    const err = el('p', 'ddn-sheet-error');
    const commit = fn => hooks.guided(fn, m => { err.textContent = m || ''; });
    editorEl.append(el('h4', '', 'Messages · top-to-bottom declaration order'), err);
    const nameOf = id => { const n = ir.elements.find(x => x.id === id); return (n && (n.name || n.local)) || String(id).split('.').pop(); };
    const table = el('table', 'ddn-sheet-table');
    plan.messages.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (r.id === selMsg) tr.setAttribute('aria-selected', 'true');
      const labelI = textInput(r.name, '', 'Message ' + (i + 1) + ' label');
      labelI.addEventListener('change', () => { if (labelI.value !== r.name) commit(() => hooks.setLabel(r.id, labelI.value)); });
      const fromTo = el('span', 'ddn-sheet-kind', nameOf(r.from.element) + ' → ' + nameOf(r.to.element) + (r.from.element === r.to.element ? ' (self)' : ''));
      const ret = document.createElement('input');
      ret.type = 'checkbox'; ret.checked = (r.properties || {}).x_return === true; ret.setAttribute('aria-label', 'dashed return');
      ret.title = 'dashed return (x_return true-or-absent)';
      ret.addEventListener('change', () => commit(() => {
        const out = boolPropCommit((r.properties || {}).x_return, ret.checked ? 'true' : 'unset');
        if (out.action === 'set') hooks.setProperty(r.id, 'x_return', true);
        else if (out.action === 'remove') hooks.setProperty(r.id, 'x_return', undefined);
      }));
      const acts = el('span', 'ddn-row');
      const up = mini('↑', 'Move one row up (declaration span move)', () => commit(() => hooks.moveDeclaration(plan.messages[i].id, plan.messages[i - 1].id)));
      const down = mini('↓', 'Move one row down', () => commit(() => hooks.moveDeclaration(plan.messages[i + 1].id, plan.messages[i].id)));
      up.disabled = i === 0; down.disabled = i === plan.messages.length - 1;
      const edit = mini('edit', 'Edit x_message / x_fragment for this message', () => { selMsg = r.id; paint(); });
      const del = mini('delete', 'Delete this message relation (guarded delete)', () => commit(() => { hooks.deleteItem(r.id); selMsg = null; }));
      acts.append(up, down, edit, del);
      for (const cell of [labelI, fromTo, ret, acts]) { const td = document.createElement('td'); td.append(cell); tr.append(td); }
      table.append(tr);
    });
    editorEl.append(table);
    /* Add message: appended as the last row (declaration order); ↑ repositions. */
    const bar = el('div', 'ddn-sheet-toolbar');
    const fromS = selectOf(plan.participants.map(n => [n.id, n.name || String(n.id).split('.').pop()]), plan.participants[0] && plan.participants[0].id, 'From lifeline');
    const toS = selectOf(plan.participants.map(n => [n.id, n.name || String(n.id).split('.').pop()]), plan.participants[0] && plan.participants[0].id, 'To lifeline');
    const labelI = textInput('', 'Label', 'New message label');
    const retC = document.createElement('input'); retC.type = 'checkbox'; retC.setAttribute('aria-label', 'return message');
    const idI = textInput('', 'msg_id', 'Message identifier');
    bar.append(fromS, el('span', '', '→'), toS, labelI, fieldRow('return ', retC), idI,
      mini('＋ Add message', 'Append the message as the last row (one transaction; x_return inline)', () => commit(() => {
        hooks.addSequenceMessage({ id: idI.value.trim() || undefined, name: labelI.value.trim(), from: fromS.value, to: toS.value, isReturn: retC.checked });
      })));
    editorEl.append(bar);
    /* Selected message: x_message + x_fragment. */
    const rel = selMsg && (ir.relations || []).find(r => r.id === selMsg);
    if (rel) paintMessageDetail(ir, rel, commit);
  }

  function paintMessageDetail(ir, rel, commit) {
    const props = rel.properties || {};
    editorEl.append(el('h4', '', (rel.name || rel.ref) + ' — message detail'));
    /* x_message. */
    const m = props.x_message || {};
    const seqI = textInput(m.seq || '', 'seq (e.g. 1.2)', 'Sequence number');
    const sortS = selectOf([['', '—'], ...['synch', 'asynch', 'create', 'delete', 'reply', 'lost', 'found'].map(v => [v, v])], m.sort || '', 'Message sort');
    const gateS = selectOf([['', '—'], ['source', 'source'], ['target', 'target']], m.gate || '', 'Gate');
    const timeI = textInput(m.time || '', 'time constraint', 'Time');
    const durI = textInput(m.duration || '', 'duration constraint', 'Duration');
    const atI = textInput(m.at === undefined ? '' : String(m.at), 'y position', 'At');
    editorEl.append(fieldRow('Seq ', seqI), fieldRow('Sort ', sortS), fieldRow('Gate ', gateS), fieldRow('Time ', timeI), fieldRow('Duration ', durI), fieldRow('At ', atI));
    editorEl.append(mini('Apply message annotations', 'Write x_message (all-blank removes the property)', () => commit(() =>
      extCommit(hooks, rel.id, 'x_message', messageCommit(props.x_message, { seq: seqI.value, sort: sortS.value, gate: gateS.value, time: timeI.value, duration: durI.value, at: atI.value }), hooks.setRelationExtension))));
    /* x_fragment (one-level combined fragment editor). */
    editorEl.append(el('h4', '', 'Combined fragment (x_fragment)'));
    const fx = props.x_fragment || {};
    const opS = selectOf([['', '— none —'], ...FRAGMENT_OPERATORS.map(v => [v, v])], fx.operator || '', 'Fragment operator');
    const refPath = uid => { try { return hooks.refFor(uid, rel.id); } catch { return uid; } };
    const operands = (fx.operands || []).map(o => ({ guard: o.guard || '', messages: (o.messages || []).map(x => x.$ref ? refPath(x.$ref) : '') }));
    const oRows = el('div');
    const msgRefs = (ir.relations || []).filter(r => r.kind === 'uml.message');
    const paintOps = () => oRows.replaceChildren(...operands.map((o, i) => {
      const r = el('div', 'ddn-sheet-plan-row');
      const gI = textInput(o.guard, 'guard (optional)', 'Operand ' + (i + 1) + ' guard');
      gI.addEventListener('input', () => { operands[i].guard = gI.value; });
      const mI = textInput(o.messages.join(' '), 'message refs, space separated', 'Operand messages');
      mI.addEventListener('input', () => { operands[i].messages = mI.value.split(/\s+/); });
      mI.setAttribute('list', 'ddn-seq-msgrefs');
      r.append(el('span', '', 'operand ' + (i + 1)), gI, mI, mini('×', 'Remove this operand', () => { operands.splice(i, 1); paintOps(); }));
      return r;
    }));
    const dl = el('datalist'); dl.id = 'ddn-seq-msgrefs';
    for (const r of msgRefs) dl.append(new Option((r.name || r.ref) + ' — ' + r.kind, r.ref));
    paintOps();
    const fb = el('div', 'ddn-row');
    fb.append(
      mini('Add operand', 'Add a fragment operand', () => { operands.push({ guard: '', messages: [] }); paintOps(); }),
      mini('Apply fragment', 'Write x_fragment (operator blank removes the property)', () => commit(() => {
        if (!opS.value) { if (props.x_fragment) hooks.setRelationExtension(rel.id, 'x_fragment', undefined); return; }
        extCommit(hooks, rel.id, 'x_fragment', fragmentCommit(props.x_fragment, { operator: opS.value, operands }), hooks.setRelationExtension);
      })));
    editorEl.append(fieldRow('Operator ', opS), oRows, fb, dl,
      el('p', 'ddn-dim', 'Nested fragments stay a source affair; this editor writes one level. The fragment anchors to its first covered message.'));
  }

  paint();
  return { refresh: paint };
}

/* ================= BPMN sheet =================
 * Event editor (x_event type/position/interrupting/on), gateway type
 * (x_gateway), and x_interrupt on flow relations. */
function renderBpmnSheet(target, hooks) {
  const outlineEl = target.outline, editorEl = target.editor;
  outlineEl.replaceChildren(); editorEl.replaceChildren();
  let sel = null;
  const isEvent = n => ['flow.start', 'flow.end', 'flow.intermediate'].includes(n.kind) || (n.properties || {}).x_event !== undefined;
  const isGateway = n => n.kind === 'flow.gateway';

  function paint() {
    const ir = hooks.ir();
    if (!ir) return;
    if (sel && ![...ir.elements, ...ir.relations].some(x => x.id === sel)) sel = null;
    paintOutline(ir);
    paintEditor(ir);
  }

  function paintOutline(ir) {
    outlineEl.replaceChildren();
    outlineEl.append(el('p', 'ddn-dim', 'Events and gateways of this view; flow relations carry x_interrupt.'));
    const ul = el('ul', 'ddn-sheet-tree');
    ul.setAttribute('role', 'tree');
    const item = (id, label, kindLabel) => {
      const li = document.createElement('li');
      const row = el('div', 'ddn-sheet-node');
      row.setAttribute('role', 'treeitem');
      row.setAttribute('aria-selected', String(id === sel || id === (hooks.selectedUid && hooks.selectedUid())));
      const name = el('span', '', label); name.style.flex = '1';
      row.append(name, el('span', 'ddn-sheet-kind', kindLabel));
      row.addEventListener('click', () => { sel = id; hooks.select(id); paint(); });
      li.append(row); ul.append(li);
    };
    for (const n of ir.elements.filter(isEvent)) item(n.id, n.name || n.local, 'event · ' + (((n.properties || {}).x_event || {}).type || '—'));
    for (const n of ir.elements.filter(isGateway)) item(n.id, n.name || n.local, 'gateway · ' + (((n.properties || {}).x_gateway || {}).type || '—'));
    for (const r of ir.relations.filter(r => (r.properties || {}).x_interrupt !== undefined)) item(r.id, r.name || r.ref, r.kind + ' · x_interrupt ' + String(r.properties.x_interrupt));
    outlineEl.append(ul);
  }

  function paintEditor(ir) {
    editorEl.replaceChildren();
    const err = el('p', 'ddn-sheet-error');
    const commit = fn => hooks.guided(fn, m => { err.textContent = m || ''; });
    const node = sel && ir.elements.find(n => n.id === sel);
    const rel = sel && ir.relations.find(r => r.id === sel);
    if (node && isGateway(node)) paintGateway(node, commit);
    else if (node) paintEvent(node, commit);
    else if (rel) paintInterrupt(rel, commit);
    else editorEl.append(el('p', 'ddn-dim', 'Select an event or gateway to edit its extension record.'));
    editorEl.prepend(err);
  }

  function paintEvent(node, commit) {
    const cur = (node.properties || {}).x_event || {};
    editorEl.append(el('h4', '', (node.name || node.local) + ' — event (x_event)'));
    const typeS = selectOf(EVENT_TYPES.map(v => [v, v]), cur.type || 'none', 'Event type');
    const posS = selectOf([['', '—'], ...EVENT_POSITIONS.map(v => [v, v])], cur.position || '', 'Event position');
    const intS = triOf(cur.interrupting, 'Interrupting');
    let onPath = '';
    if (cur.on && cur.on.$ref) { try { onPath = hooks.refFor(cur.on.$ref, node.id); } catch { onPath = ''; } }
    const on = refPicker(hooks, node.id, onPath, 'Interrupts (on)');
    editorEl.append(fieldRow('Type ', typeS), fieldRow('Position ', posS), fieldRow('Interrupting ', intS), fieldRow('On ', on.input), on.list);
    const bar = el('div', 'ddn-row');
    bar.append(
      mini('Apply event', 'Write x_event (one undoable, core-validated transaction)', () => commit(() =>
        extCommit(hooks, node.id, 'x_event', eventCommit((node.properties || {}).x_event, { type: typeS.value, position: posS.value, interrupting: intS.value, on: on.path() })))),
      ...(cur.type ? [mini('Remove event record', 'Remove x_event', () => commit(() => hooks.setExtension(node.id, 'x_event', undefined)))] : []));
    editorEl.append(bar);
  }

  function paintGateway(node, commit) {
    const cur = (node.properties || {}).x_gateway || {};
    editorEl.append(el('h4', '', (node.name || node.local) + ' — gateway (x_gateway)'));
    const typeS = selectOf(GATEWAY_TYPES.map(v => [v, v]), cur.type || 'exclusive', 'Gateway type');
    editorEl.append(fieldRow('Type ', typeS));
    const bar = el('div', 'ddn-row');
    bar.append(
      mini('Apply gateway', 'Write x_gateway (bpmn.basic@1 accepts exclusive/parallel/inclusive — DDN-PJ117 is re-checked on commit)', () => commit(() =>
        extCommit(hooks, node.id, 'x_gateway', gatewayCommit((node.properties || {}).x_gateway, typeS.value)))),
      ...(cur.type ? [mini('Remove gateway record', 'Remove x_gateway', () => commit(() => hooks.setExtension(node.id, 'x_gateway', undefined)))] : []));
    editorEl.append(bar);
  }

  function paintInterrupt(rel, commit) {
    const cur = (rel.properties || {}).x_interrupt;
    editorEl.append(el('h4', '', (rel.name || rel.ref) + ' — x_interrupt'));
    const tri = triOf(cur, 'x_interrupt');
    tri.addEventListener('change', () => commit(() => {
      const out = boolPropCommit(cur, tri.value);
      if (out.action === 'set') hooks.setProperty(rel.id, 'x_interrupt', out.value);
      else if (out.action === 'remove') hooks.setProperty(rel.id, 'x_interrupt', undefined);
    }));
    editorEl.append(fieldRow('x_interrupt ', tri));
  }

  paint();
  return { refresh: paint };
}

/* ================= Patent sheet =================
 * Numeral field editor per element (1..99999 with the DDN-VP06 uniqueness
 * warning adjacent), the ref: anchor helper (list + insert), and the renumber
 * pass with transaction preview. */
function renderPatentSheet(target, hooks) {
  const outlineEl = target.outline, editorEl = target.editor;
  outlineEl.replaceChildren(); editorEl.replaceChildren();

  function paint(preview) {
    const ir = hooks.ir();
    if (!ir) return;
    const err = el('p', 'ddn-sheet-error');
    const commit = fn => hooks.guided(fn, m => { err.textContent = m || ''; });
    const conflicts = numeralConflicts(ir.elements);
    /* Numeral table. */
    outlineEl.replaceChildren();
    outlineEl.append(el('h4', '', 'Reference numerals (numeral · DDN-VP05/VP06)'), err);
    const table = el('table', 'ddn-sheet-table');
    for (const n of ir.elements) {
      const num = n.properties && n.properties.numeral;
      const tr = document.createElement('tr');
      const label = el('td', '', (n.name || n.local) + ' — ' + n.kind);
      const tdI = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = '1'; inp.max = '99999';
      inp.value = num === undefined ? '' : num;
      inp.setAttribute('aria-label', 'Numeral for ' + (n.name || n.local));
      inp.addEventListener('change', () => commit(() => {
        const out = numeralCommit(inp.value, num);
        if (out.action === 'error') throw Object.assign(new Error(out.message), { code: out.code });
        if (out.action === 'set') hooks.setNumerals({ [n.id]: out.value });
        else if (out.action === 'remove') hooks.setNumerals({ [n.id]: null });
      }));
      tdI.append(inp);
      const tdW = document.createElement('td');
      const clash = conflicts.find(c => c.numeral === num);
      if (clash) tdW.append(el('span', 'ddn-sheet-error', 'DDN-VP06: numeral ' + num + ' is shared by ' + clash.uids.length + ' elements — the commit-time build rejects it.'));
      tr.append(label, tdI, tdW);
      table.append(tr);
    }
    outlineEl.append(table);
    /* Renumber pass with preview. */
    const rb = el('div', 'ddn-row');
    const startI = textInput('10', 'start', 'Renumber start'); startI.style.width = '5em';
    const stepI = textInput('10', 'step', 'Renumber step'); stepI.style.width = '5em';
    rb.append(fieldRow('Start ', startI), fieldRow('Step ', stepI),
      mini('Preview renumbering', 'Assign sequential numerals in reading order to every numbered element (nothing is written yet)', () => {
        const plan = renumberPlan(ir.elements, { start: Number(startI.value), step: Number(stepI.value) });
        if (plan.error) { err.textContent = plan.error.code + ': ' + plan.error.message; return; }
        paint(plan);
      }));
    outlineEl.append(rb);
    /* Anchor helper + preview in the editor pane. */
    editorEl.replaceChildren();
    if (preview) {
      editorEl.append(el('h4', '', 'Renumber preview — ' + preview.changes.length + ' change(s), ' + preview.skipped + ' already sequential'));
      if (!preview.changes.length) editorEl.append(el('p', 'ddn-dim', 'Nothing to do: every numeral already matches the plan.'));
      const ul = el('ul', 'ddn-sheet-tree');
      for (const c of preview.changes) ul.append(el('li', '', c.name + ': ' + c.from + ' → ' + c.to));
      editorEl.append(ul);
      editorEl.append(mini('Commit renumbering', 'Write every numeral in one undoable, core-validated transaction (DDN-VP06 re-checked on commit)', () => commit(() => { hooks.setNumerals(preview.assignments); paint(); })));
    } else {
      editorEl.append(el('h4', '', 'ref: anchors'));
      const anchors = refAnchorScan(ir);
      if (!anchors.length) editorEl.append(el('p', 'ddn-dim', 'No ref: anchors declared yet.'));
      else {
        const ul = el('ul', 'ddn-sheet-tree');
        for (const a of anchors) ul.append(el('li', '', a.siteName + ' → ref:' + a.anchor));
        editorEl.append(ul);
      }
      editorEl.append(el('h4', '', 'Insert anchor'));
      const siteS = selectOf(ir.elements.map(n => [n.id, n.name || n.local]), ir.elements[0] && ir.elements[0].id, 'Anchor site (element)');
      const tgtS = selectOf(ir.elements.map(n => [n.id, n.name || n.local]), ir.elements[1] ? ir.elements[1].id : (ir.elements[0] && ir.elements[0].id), 'Anchor target');
      editorEl.append(fieldRow('Site ', siteS), fieldRow('Target ', tgtS));
      editorEl.append(mini('Insert ref: anchor', 'Append "ref:<target>" to the site element’s text (or label when it has no text)', () => commit(() => {
        if (siteS.value === tgtS.value) throw Object.assign(new Error('ref: anchors never self-reference (DDN-MK06).'), { code: 'DDN-UI12' });
        const site = ir.elements.find(n => n.id === siteS.value), tgt = ir.elements.find(n => n.id === tgtS.value);
        const anchor = (tgt.local || tgt.ref || '').split('.').pop();
        const props = site.properties || {};
        if (typeof props.text === 'string') hooks.setProperty(site.id, 'text', (props.text ? props.text + ' ' : '') + 'ref:' + anchor);
        else hooks.setLabel(site.id, ((site.name || '') + ' ref:' + anchor).trim());
      })));
    }
  }

  paint();
  return { refresh: paint };
}

/* Body renderers by sheet id. Phase 6b registers the data-projection sheets
 * (chart, matrix, decision, timeline, fishbone, panels) here — same hook
 * contract. */
const RENDERERS = {
  cmmn: renderCmmnSheet,
  'uml-structure': renderStructureSheet,
  'uml-activity': renderActivitySheet,
  'uml-sequence': renderSequenceSheet,
  bpmn: renderBpmnSheet,
  patent: renderPatentSheet
};

const api = { ...pure, RENDERERS, renderCmmnSheet };
if (typeof module === 'object' && module.exports) module.exports = api;
host.DDNToolSheets = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
