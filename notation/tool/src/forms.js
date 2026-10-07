/* SPDX-License-Identifier: GPL-2.0-or-later. Designer redesign phase 4 —
 * descriptor-driven form generator (specification 05 "property descriptor"):
 * a property descriptor registry (generated from standard/registry/
 * data-properties.json + notation/runtime/ddn-profiles.js x_* extension
 * contracts by designer/contracts/build-form-descriptors.mjs, inlined into the
 * tool as DDN_FORM_DESCRIPTORS) rendered into real form controls.
 *
 * Pure layer (node-testable, no DOM):
 *  · valueState — unset vs null vs value (spec 05: null is a data value, not a
 *    generic unset marker)
 *  · evalWhen — the visibility predicate data AST (all/any/not/equals/
 *    hasCapability — never executable JavaScript)
 *  · parseDraft / formatDraft / commitOutcome — per-widget draft parsing and
 *    commit semantics: blank means REMOVE (removing a property is distinct
 *    from blanking it); invalid drafts carry a stable code, never commit
 *  · widgetForShape — the registry value_shape → widget mapping the generator
 *    and the runtime share
 *  · descriptorsForTarget / groupDescriptors — target filtering + visibility
 *    evaluation + group ordering
 *
 * DOM layer (browser only): renderForm builds the controls — text, number,
 * unit-retaining quantity, select, optional-boolean (set/true/false
 * tri-state), reference picker (existing definition vs needs-creation),
 * string list, structured record (nested group committing on Apply with a
 * serialized transaction preview). Short controls commit on Enter/blur only
 * when valid; Escape restores the previous draft; coded errors land adjacent
 * to the control.
 * UMD: inlined into the single-file tool build and required by node tests. */
(function (host) {
'use strict';

/* --- value states (spec 05) --- */
function valueState(v) {
  if (v === undefined) return 'unset';
  if (v === null) return 'null';
  return 'value';
}

/* --- visibility predicate AST (all/any/not/equals/hasCapability) ---
 * ctx: { props: {key: value}, capabilities: [tag, …] }. A descriptor without
 * `when` is always visible. Malformed nodes throw — descriptors are generated
 * data, so a bad AST is a build bug, not a user situation. */
function evalWhen(ast, ctx) {
  if (ast === null || ast === undefined) return true;
  const c = ctx || {}, props = c.props || {}, caps = c.capabilities || [];
  if (Array.isArray(ast.all)) return ast.all.every(a => evalWhen(a, c));
  if (Array.isArray(ast.any)) return ast.any.some(a => evalWhen(a, c));
  if (ast.not !== undefined) return !evalWhen(ast.not, c);
  if (ast.equals && typeof ast.equals === 'object') {
    const e = ast.equals;
    return JSON.stringify(props[e.key] === undefined ? null : props[e.key]) === JSON.stringify(e.value === undefined ? null : e.value);
  }
  if (typeof ast.hasCapability === 'string') return caps.includes(ast.hasCapability);
  throw new Error('unknown visibility predicate node: ' + JSON.stringify(ast));
}

/* --- registry value_shape → widget (shared with the generator) ---
 * Order matters: the first matching rule wins. Shapes the mapping cannot
 * express as a simple control become records (structured group) or text. */
function widgetForShape(shape) {
  const s = String(shape || '').toLowerCase();
  if (!s) return 'text';
  if (s === 'boolean') return 'optional-boolean';
  if (s.startsWith('enum: ')) return 'select';
  if (/^length \((px|pt)/.test(s)) return 'quantity';
  if (/\b(integer|number)\b/.test(s) && !/reference|record/.test(s)) return 'number';
  if (s === 'string[]' || /^(array of |arrays of |ordered field references$|rule\/assertion references$|result\/assertion references$|parameter-definition references$)/.test(s)) return 'string-list';
  if (/reference/.test(s) && !/record|string or reference|string\/reference|reference or string|reference\/string/.test(s)) return 'reference';
  if (/record|record\/|\/record/.test(s) || /reference or structured record/.test(s)) return 'record';
  const enumBody = s.replace(/\s+or\s+undecided$/, '');
  if (/^([a-z_][a-z_0-9]*(\s*[/|]\s*[a-z_][a-z_0-9]*)+)$/.test(enumBody)) return 'select';
  return 'text';
}
/* Choices for select widgets, parsed from the registry's enum-ish shapes
 * ("draft/review/approved…", "enum: north | south | east | west"); a trailing
 * "or undecided" is a state-policy remark, not a choice. */
function choicesForShape(shape) {
  const s = String(shape || '');
  const m = s.match(/^enum: (.+)$/i);
  const body = m ? m[1] : (widgetForShape(s) === 'select' ? s.toLowerCase().replace(/\s+or\s+undecided$/, '') : null);
  if (!body) return null;
  return body.split(/[/|]/).map(x => x.trim()).filter(x => /^[a-z_][a-z_0-9]*$/.test(x) && x !== 'or' && x !== 'undecided');
}

/* --- widget draft parsing + commit semantics ---
 * parseDraft(descriptor, raw) → { ok: true, value } | { ok: false, code, message }.
 * `raw` is the widget's draft shape: a string for text/number/select/
 * optional-boolean/reference/string-list, { value, unit } for quantity.
 * `undefined` as the parsed value means UNSET — committing removes the
 * property (distinct from blanking: a blank draft never writes ''/null). */
function parseDraft(d, raw) {
  const bad = (code, message) => ({ ok: false, code: (d.validation && d.validation.parse) || code, message });
  const blank = raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');
  switch (d.widget) {
    case 'text': {
      if (blank) return { ok: true, value: undefined };
      const v = String(raw).trim();
      if (d.nonempty === false) return { ok: true, value: String(raw) };
      return { ok: true, value: v };
    }
    case 'number': {
      if (blank) return { ok: true, value: undefined };
      const n = Number(raw);
      if (!Number.isFinite(n)) return bad('DDN-UI02', d.label + ' must be a finite number.');
      if (d.integer && !Number.isInteger(n)) return bad('DDN-UI02', d.label + ' must be a whole number.');
      if (d.min !== undefined && n < d.min) return bad('DDN-UI02', d.label + ' must be at least ' + d.min + '.');
      if (d.max !== undefined && n > d.max) return bad('DDN-UI02', d.label + ' must be at most ' + d.max + '.');
      return { ok: true, value: n };
    }
    case 'quantity': {
      const r = raw && typeof raw === 'object' ? raw : { value: raw, unit: (d.units || ['px'])[0] };
      if (r.value === undefined || r.value === null || String(r.value).trim() === '') return { ok: true, value: undefined };
      const n = Number(r.value);
      if (!Number.isFinite(n)) return bad('DDN-UI02', d.label + ' must be a finite number.');
      if (d.min !== undefined && n < d.min) return bad('DDN-UI02', d.label + ' must be at least ' + d.min + '.');
      if (d.max !== undefined && n > d.max) return bad('DDN-UI02', d.label + ' must be at most ' + d.max + '.');
      const unit = (d.units || ['px']).includes(r.unit) ? r.unit : (d.units || ['px'])[0];
      return { ok: true, value: { $quantity: n, unit } };
    }
    case 'select': {
      if (blank) return { ok: true, value: undefined };
      if (d.choices && !d.choices.includes(raw)) return bad('DDN-UI03', d.label + ' must be one of ' + d.choices.join(', ') + '.');
      return { ok: true, value: raw };
    }
    case 'optional-boolean': {
      if (blank) return { ok: true, value: undefined };
      if (raw === true || raw === 'true') return { ok: true, value: true };
      if (raw === false || raw === 'false') return { ok: true, value: false };
      return bad('DDN-UI03', d.label + ' is an optional boolean: set, true or false.');
    }
    case 'reference': {
      if (blank) return { ok: true, value: undefined };
      const id = String(raw).trim().replace(/^@/, '');
      /* Unicode identifiers (spec ch. 01 amendment): UAX #31 profile, mirrors ddn-core ID_SRC. */
      if (!new RegExp('^[\\p{ID_Start}_][\\p{ID_Continue}_-]*(\\.[\\p{ID_Start}_][\\p{ID_Continue}_-]*)*$','u').test(id)) return bad('DDN-UI04', d.label + ' must be a stable reference path (identifiers joined by dots).');
      return { ok: true, value: { $ref: id } };
    }
    case 'string-list': {
      if (blank) return { ok: true, value: undefined };
      const items = String(raw).split(',').map(x => x.trim()).filter(Boolean);
      if (!items.length) return { ok: true, value: undefined };
      return { ok: true, value: items };
    }
    case 'record': {
      /* Record drafts come from commitRecord (the DOM layer merges the nested
       * group's sub-drafts); a raw object passes through after a shape check. */
      if (raw === undefined) return { ok: true, value: undefined };
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bad('DDN-UI05', d.label + ' must be a record.');
      return { ok: true, value: raw };
    }
    default:
      return bad('DDN-UI01', 'Unknown widget ' + JSON.stringify(d.widget) + ' on descriptor ' + d.id + '.');
  }
}
/* commitOutcome(descriptor, raw): the full commit decision for a draft —
 * set / remove / error. A draft equal to the current value is `none` (no
 * transaction, no history entry). */
function commitOutcome(d, raw, current) {
  const p = parseDraft(d, raw);
  if (!p.ok) return { action: 'error', code: p.code, message: p.message };
  if (p.value === undefined) return current === undefined ? { action: 'none' } : { action: 'remove' };
  if (JSON.stringify(p.value) === JSON.stringify(current)) return { action: 'none' };
  return { action: 'set', value: p.value };
}
/* Record sub-drafts: values maps sub-key → parsed value (undefined = absent);
 * an all-absent record removes the property rather than writing {}. */
function commitRecord(d, values) {
  const out = {};
  for (const [k, v] of Object.entries(values || {})) if (v !== undefined) out[k] = v;
  return Object.keys(out).length ? { action: 'set', value: out } : { action: 'remove' };
}

/* formatDraft(descriptor, value): the raw draft a control shows for an
 * asserted value (inverse of parseDraft); undefined → the empty draft. */
function formatDraft(d, value) {
  if (value === undefined || value === null) return d.widget === 'quantity' ? { value: '', unit: (d.units || ['px'])[0] } : '';
  switch (d.widget) {
    case 'number': case 'select': case 'text': return String(value);
    case 'optional-boolean': return value === true ? 'true' : value === false ? 'false' : '';
    case 'quantity':
      if (typeof value === 'number') return { value: String(value), unit: (d.units || ['px'])[0] };
      if (value.$quantity !== undefined) return { value: String(value.$quantity), unit: value.unit || (d.units || ['px'])[0] };
      return { value: '', unit: (d.units || ['px'])[0] };
    case 'reference': return value.$ref ? '@' + value.$ref : String(value);
    case 'string-list': return Array.isArray(value) ? value.join(', ') : String(value);
    case 'record': return value;
    default: return String(value);
  }
}

/* descriptorsForTarget(descriptors, target, ctx): the visible, ordered
 * descriptor list for one target type ('element' | 'relation' | 'field' |
 * 'view'), visibility predicates evaluated against ctx. */
function descriptorsForTarget(descriptors, target, ctx) {
  return (descriptors || []).filter(d =>
    (d.targets || []).includes(target) && evalWhen(d.when, ctx));
}
/* groupDescriptors(list) → [{group, descriptors}] preserving first-appearance
 * order (the generator emits canonical group order). */
function groupDescriptors(list) {
  const out = [], byGroup = new Map();
  for (const d of list) {
    const g = d.group || 'Other';
    if (!byGroup.has(g)) { byGroup.set(g, []); out.push({ group: g, descriptors: byGroup.get(g) }); }
    byGroup.get(g).push(d);
  }
  return out;
}

const pure = {
  valueState, evalWhen, widgetForShape, choicesForShape,
  parseDraft, formatDraft, commitOutcome, commitRecord,
  descriptorsForTarget, groupDescriptors
};
if (typeof document === 'undefined') {
  if (typeof module === 'object' && module.exports) module.exports = pure;
  host.DDNToolForms = pure;
  return;
}

/* ================= DOM layer (browser only) ================= */

/* Small serializer for the record transaction preview — mirrors the canonical
 * authoring value writer (studio/src/authoring.js) closely enough for preview
 * (the commit path serializes authoritatively server-side of the workspace). */
function previewValue(v) {
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return '[' + v.map(previewValue).join(', ') + ']';
  if (v.$ref) return '@' + v.$ref;
  if (v.$quantity !== undefined) return String(v.$quantity) + v.unit;
  return '{ ' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + previewValue(x)).join(', ') + ' }';
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

/* attachCommit(input, restore, commit): spec-05 commit behavior for short
 * controls — Enter or blur commit only if valid, Escape restores the previous
 * draft. `commit` performs parse + commitOutcome and reports coded errors. */
function attachCommit(input, restore, commit) {
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); restore(); e.target && input.blur(); }
  });
  input.addEventListener('change', commit);
}

/* createControl(descriptor, hooks) → { root, sync(value), focus() }.
 * hooks: { commit(d, value|undefined) — throws coded errors; candidates(d) →
 * [{ref, label, kind}] for reference pickers; note(text) — advisory text. } */
function createControl(d, hooks) {
  const root = el('div', 'ddn-form-control');
  root.dataset.descriptor = d.id;
  const head = el('label', 'ddn-field');
  const lab = el('span', '', d.label);
  if (d.help) lab.title = d.help;
  head.append(lab);
  const errEl = el('p', 'ddn-form-error');
  errEl.hidden = true;
  const fail = e => {
    errEl.hidden = false;
    errEl.textContent = (e && e.code ? e.code + ': ' : '') + (e && e.message || e);
    if (hooks.note) hooks.note(errEl.textContent);
  };
  const clear = () => { errEl.hidden = true; errEl.textContent = ''; };

  let input, read, write;
  const simpleCommit = () => {
    const p = parseDraft(d, read());
    if (!p.ok) { fail(p); return; }
    try { hooks.commit(d, p.value); clear(); } catch (e) { fail(e); }
  };
  const mk = tag => { const i = document.createElement(tag); i.setAttribute('aria-label', d.label); return i; };

  if (d.widget === 'select' || d.widget === 'optional-boolean') {
    input = mk('select');
    input.add(new Option(d.widget === 'select' ? 'Not set (remove)' : 'Not set', ''));
    const opts = d.widget === 'optional-boolean' ? ['true', 'false'] : (d.choices || []);
    for (const v of opts) input.add(new Option(v, v));
    read = () => input.value;
    write = v => { input.value = v; };
    input.addEventListener('change', simpleCommit);
  } else if (d.widget === 'quantity') {
    input = mk('input'); input.type = 'number';
    if (d.min !== undefined) input.min = d.min;
    if (d.max !== undefined) input.max = d.max;
    input.step = d.step || 'any';
    input.placeholder = 'unset';
    const unit = mk('select');
    for (const u of d.units || ['px']) unit.add(new Option(u, u));
    read = () => ({ value: input.value, unit: unit.value });
    write = v => { input.value = v.value; unit.value = v.unit; };
    attachCommit(input, () => hooks.syncOne && hooks.syncOne(d), simpleCommit);
    unit.addEventListener('change', simpleCommit);
    head.append(input, unit);
  } else if (d.widget === 'reference') {
    input = mk('input'); input.type = 'text'; input.placeholder = '@definition.path (blank = remove)';
    const list = el('datalist');
    const listId = 'ddn-reflist-' + d.id.replace(/[^A-Za-z0-9_-]/g, '_');
    list.id = listId; input.setAttribute('list', listId);
    const hint = el('p', 'ddn-dim');
    hint.hidden = true;
    const refresh = () => {
      list.replaceChildren(...(hooks.candidates ? hooks.candidates(d) : []).map(c => {
        const o = new Option((c.label || c.ref) + (c.kind ? ' — ' + c.kind : ''), '@' + c.ref);
        return o;
      }));
    };
    const describe = () => {
      const raw = input.value.trim().replace(/^@/, '');
      if (!raw) { hint.hidden = true; return; }
      const c = (hooks.candidates ? hooks.candidates(d) : []).find(x => x.ref === raw);
      hint.hidden = false;
      hint.textContent = c
        ? 'Existing definition: ' + (c.label || c.ref) + (c.kind ? ' (' + c.kind + ')' : '')
        : 'No existing definition "' + raw + '" — create it first (Add palette / source); only existing references commit.';
    };
    input.addEventListener('focus', refresh);
    input.addEventListener('input', describe);
    read = () => input.value;
    write = v => { input.value = v; describe(); };
    attachCommit(input, () => hooks.syncOne && hooks.syncOne(d), () => {
      const raw = input.value.trim().replace(/^@/, '');
      if (raw && hooks.candidates && !(hooks.candidates(d) || []).some(x => x.ref === raw)) {
        fail({ code: 'DDN-UI06', message: 'Reference "' + raw + '" does not resolve to an existing definition; create it first.' });
        return;
      }
      simpleCommit();
    });
    head.append(input);
    root.append(head, list, hint, errEl);
    return { root, sync: v => { write(formatDraft(d, v)); clear(); }, focus: () => input.focus() };
  } else if (d.widget === 'record') {
    /* Structured record: nested sub-controls (one level) collecting drafts;
     * nothing commits until Apply, then the whole record is ONE transaction
     * with the serialized preview shown next to the Apply button. */
    input = null;
    const body = el('div', 'ddn-form-record');
    const subs = (d.fields || []).map(sub => {
      const subCtl = createControl({ ...sub, id: d.id + '.' + sub.key }, {
        commit: () => { /* drafts only — the record Apply commits */ updatePreview(); },
        candidates: hooks.candidates, note: hooks.note, syncOne: () => {}
      });
      /* Sub-controls must never commit on their own: strip the commit wiring
       * by re-reading drafts rather than hooking commit. */
      body.append(subCtl.root);
      return { sub, ctl: subCtl };
    });
    const preview = el('code', 'ddn-form-preview');
    const row = el('div', 'ddn-row');
    const applyB = el('button', 'ddn-mini', 'Apply');
    applyB.type = 'button';
    const removeB = el('button', 'ddn-mini', 'Remove property');
    removeB.type = 'button'; removeB.title = 'Remove the property from the source (distinct from blanking its fields)';
    row.append(applyB, removeB);
    const readSubs = () => {
      const values = {};
      for (const { sub, ctl } of subs) {
        const p = parseDraft(sub, ctl.draft());
        if (!p.ok) throw p;
        if (p.value !== undefined) values[sub.key] = p.value;
      }
      return values;
    };
    const updatePreview = () => {
      try { preview.textContent = d.key + ': ' + previewValue(readSubs()) + ';'; }
      catch (e) { preview.textContent = d.key + ': (invalid draft — ' + (e.message || e) + ')'; }
    };
    applyB.addEventListener('click', () => {
      let values;
      try { values = readSubs(); } catch (e) { fail(e); return; }
      const outcome = commitRecord(d, values);
      try { hooks.commit(d, outcome.action === 'remove' ? undefined : outcome.value); clear(); }
      catch (e) { fail(e); }
    });
    removeB.addEventListener('click', () => {
      try { hooks.commit(d, undefined); clear(); } catch (e) { fail(e); }
    });
    head.append(body);
    root.append(head, preview, row, errEl);
    return {
      root,
      sync: v => {
        const rec = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
        for (const { sub, ctl } of subs) ctl.sync(rec[sub.key]);
        updatePreview(); clear();
      },
      focus: () => {}
    };
  } else {
    /* text / number / string-list */
    input = mk('input');
    input.type = d.widget === 'number' ? 'number' : 'text';
    if (d.widget === 'number') {
      if (d.min !== undefined) input.min = d.min;
      if (d.max !== undefined) input.max = d.max;
      input.step = d.step || 'any';
    }
    input.placeholder = d.widget === 'string-list' ? 'comma-separated (blank = remove)' : 'blank = remove';
    read = () => input.value;
    write = v => { input.value = v; };
    attachCommit(input, () => hooks.syncOne && hooks.syncOne(d), simpleCommit);
  }
  if (input && d.widget !== 'quantity') head.append(input);
  root.append(head);
  /* Removing is distinct from blanking: an explicit remove affordance on
   * every removable simple control (blank also removes, per parseDraft). */
  const ctl = {
    root,
    draft: () => read(),
    sync: v => { write(formatDraft(d, v)); clear(); },
    focus: () => input && input.focus()
  };
  if (d.removable !== false && d.widget !== 'record') {
    const rm = el('button', 'ddn-mini ddn-remove-prop', 'Remove');
    rm.type = 'button'; rm.title = 'Remove this property from the source (not the same as a blank value)';
    rm.addEventListener('click', () => { try { hooks.commit(d, undefined); clear(); } catch (e) { fail(e); } });
    root.append(rm);
  }
  root.append(errEl);
  return ctl;
}

/* renderForm(parent, descriptors, opts) → { sync(), controls }.
 * opts: { getValue(d), commit(d, value|undefined), candidates(d), note(text),
 *         scopeLabel, flat } — one group <section> per descriptor group unless
 *         flat is set (the caller then supplies its own group container), each
 *         control labeled with its declared write scope (spec 05 scope layers). */
function renderForm(parent, descriptors, opts) {
  const o = opts || {};
  /* Flat mode renders into the caller's own group container (which carries
   * its header/scope pill) — only the generated controls are replaced. */
  if (o.flat) for (const n of [...parent.querySelectorAll('.ddn-form-control')]) n.remove();
  else parent.replaceChildren();
  const controls = [];
  const groups = o.flat ? [{ group: null, descriptors }] : groupDescriptors(descriptors);
  for (const g of groups) {
    const sec = o.flat ? parent : el('section', 'ddn-form-group');
    if (!o.flat) {
      const h = el('h4', '', g.group);
      if (o.scopeLabel) { const s = el('span', 'ddn-scope ddn-scope-source', o.scopeLabel); h.append(s); }
      sec.append(h);
    }
    for (const d of g.descriptors) {
      const ctl = createControl(d, {
        commit: (dd, v) => o.commit(dd, v),
        candidates: o.candidates,
        note: o.note,
        syncOne: dd => { const c = controls.find(x => x.d === dd); if (c) c.ctl.sync(o.getValue(dd)); }
      });
      controls.push({ d, ctl });
      sec.append(ctl.root);
    }
    if (!o.flat) parent.append(sec);
  }
  return {
    controls,
    sync() { for (const { d, ctl } of controls) ctl.sync(o.getValue(d)); }
  };
}

const api = { ...pure, renderForm, createControl, previewValue };
if (typeof module === 'object' && module.exports) module.exports = api;
host.DDNToolForms = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
