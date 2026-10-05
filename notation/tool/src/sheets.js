/* SPDX-License-Identifier: GPL-2.0-or-later. Designer redesign phase 5 —
 * the Type sheet framework: a bottom drawer whose body is dispatched by the
 * active view's capability (projection kind + profile, phase 2). A sheet body
 * registers in SHEETS with the profile ids it serves; sheetForProjection
 * resolves the body for a view; typeSheetAutoState drives the drawer's
 * auto-open/auto-close. The first registered body is the CMMN case-plan sheet
 * (cmmn.basic@1 / cmmn.complete@1): case-plan outline tree, sentry editor,
 * decorator flags, planning table editor. Phase 6 registers more bodies by
 * appending {id, label, profiles} entries and a render function to RENDERERS.
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
 * `profiles` are the projection profile ids the body serves. Dispatch keys on
 * the profile (a kind-only projection never owns a type vocabulary); the
 * projection kind must additionally match `kinds` when listed. */
const SHEETS = [
  { id: 'cmmn', label: 'CMMN case plan', profiles: ['cmmn.basic@1', 'cmmn.complete@1'], kinds: ['graph'] }
];

function sheetForProjection(projection, sheets) {
  const p = projection || {};
  for (const s of sheets || SHEETS) {
    if (s.profiles && s.profiles.includes(p.profile) && (!s.kinds || s.kinds.includes(p.kind || 'graph'))) return s;
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

const pure = {
  SHEETS, sheetForProjection, typeSheetAutoState,
  CMMN_ROLES, cmmnRole, cmmnOutline,
  sentryCommit, decoratorCommit, planningCommit,
  CMMN_DECORATOR_FLAGS, CMMN_PLANNING_ROLES, CMMN_DECORATOR_ROLES
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

/* Body renderers by sheet id. Phase 6 registers the remaining type sheets
 * (UML structure/activity/sequence, chart, matrix, decision, timeline,
 * fishbone, panels, BPMN affordances) here — same hook contract. */
const RENDERERS = { cmmn: renderCmmnSheet };

const api = { ...pure, RENDERERS, renderCmmnSheet };
if (typeof module === 'object' && module.exports) module.exports = api;
host.DDNToolSheets = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
