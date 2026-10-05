/* SPDX-License-Identifier: GPL-2.0-or-later. B1-071: extracted for the 2026-10
 * redesign phase 3 — Inspector drawer pure helpers: the Details-tab property
 * grouping keyed to standard/registry/data-properties.json, the cardinality
 * sentence preview (spec 05 "For one Customer, 0..many Orders"), the UML
 * association-end multiplicity grammar (DDN-PJ149), endpoint-mark cardinality
 * seeding, and the multi-selection mixed-value model (spec 05: intersect
 * controls, never coerce).
 * UMD: inlined into the single-file tool build and required by node tests. */
(function (host) {
'use strict';

/* path → group, keyed to standard/registry/data-properties.json (0.3.0-draft.2)
 * for the element/relation targets the inspector displays. `kind` splits by
 * target (Element identity vs Relations); field/port/sample/assertion paths
 * are out of scope for the element/relation Details tab. Unknown and x_*
 * extension properties land in EXTENSION_GROUP. Hand-maintained mirror: when
 * data-properties.json gains an element/relation path, add it here. */
const GROUP_ORDER = ['Identity and evidence', 'Element identity', 'Domains and bindings', 'Relations', 'Flow contract', 'Time and recovery', 'Deployment', 'Governance and SQL metadata', 'Motion and flow animation'];
const GROUP_FOR = {
  uid: 'Identity and evidence', description: 'Identity and evidence', aliases: 'Identity and evidence',
  level: 'Element identity', maturity: 'Element identity', meaning: 'Element identity', workload: 'Element identity',
  role: 'Element identity', location: 'Element identity', distribution: 'Element identity', representation: 'Element identity',
  allowed_values: 'Domains and bindings', unit: 'Domains and bindings', normalization: 'Domains and bindings', equality: 'Domains and bindings',
  platform: 'Domains and bindings', platform_version: 'Domains and bindings', precision: 'Domains and bindings', scale: 'Domains and bindings',
  source_mark: 'Relations', target_mark: 'Relations', enforcement: 'Relations', scope: 'Relations',
  source_min: 'Relations', source_max: 'Relations', target_min: 'Relations', target_max: 'Relations',
  capture: 'Flow contract', transport: 'Flow contract', transformation: 'Flow contract', cadence: 'Flow contract',
  delivery: 'Flow contract', payload: 'Flow contract', ordering: 'Flow contract', initial_load: 'Flow contract',
  delete_handling: 'Flow contract', retry: 'Flow contract', freshness: 'Flow contract',
  temporal: 'Time and recovery', time: 'Time and recovery', snapshot_at: 'Time and recovery', recovery_window: 'Time and recovery',
  provider: 'Deployment', region: 'Deployment', environment: 'Deployment', partition_key: 'Deployment',
  partition_rule: 'Deployment', replication_factor: 'Deployment', replica_role: 'Deployment', consistency: 'Deployment', residency: 'Deployment',
  owner: 'Governance and SQL metadata', classification: 'Governance and SQL metadata', contract: 'Governance and SQL metadata',
  quality: 'Governance and SQL metadata', dialect: 'Governance and SQL metadata', definition: 'Governance and SQL metadata',
  parameters: 'Governance and SQL metadata', refresh: 'Governance and SQL metadata', index_method: 'Governance and SQL metadata',
  motion: 'Motion and flow animation', marker: 'Motion and flow animation', marker_size: 'Motion and flow animation',
  marker_color: 'Motion and flow animation', rate: 'Motion and flow animation', speed: 'Motion and flow animation', pulse_color: 'Motion and flow animation'
};
const EXTENSION_GROUP = 'Extensions and other';
function groupFor(key, target) {
  if (key === 'kind') return target === 'relation' ? 'Relations' : 'Element identity';
  return GROUP_FOR[key] || EXTENSION_GROUP;
}
/* groupDetails(props, target) → [{group, entries:[[key, value], …]}] in
 * canonical group order, empty groups omitted. Read-only display data for the
 * Details tab; values pass through untouched (rendering is the caller's job). */
function groupDetails(props, target) {
  const byGroup = new Map();
  for (const [k, v] of Object.entries(props || {})) {
    const g = groupFor(k, target);
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push([k, v]);
  }
  const order = [...GROUP_ORDER, EXTENSION_GROUP];
  return order.filter(g => byGroup.has(g)).map(g => ({ group: g, entries: byGroup.get(g) }));
}

/* Cardinality sentence preview (spec 05): "For one Customer, 0..many Orders."
 * min/max are the relation's source_/target_ min/max properties; a missing
 * bound renders as "many" on the max side and the pair collapses to a bare
 * count word when min === max. Zero/many are endpoint meanings, not counts. */
function cardinalityText(min, max) {
  if (min === undefined && max === undefined) return null;
  if (min === undefined) return 'up to ' + (max === 1 ? 'one' : max);
  if (max === undefined) return min === 0 ? 'zero or more' : min === 1 ? 'one or more' : 'at least ' + min;
  if (min === max) return min === 0 ? 'zero' : min === 1 ? 'one' : String(min);
  return min + '..' + max;
}
function cardinalitySentence(fromName, toName, card) {
  const c = card || {};
  const s = cardinalityText(c.source_min, c.source_max), t = cardinalityText(c.target_min, c.target_max);
  if (!s && !t) return null;
  return 'For ' + (s || 'any number of') + ' ' + fromName + ', ' + (t || 'any number of') + ' ' + toName + '.';
}

/* Endpoint visual marks seed the cardinality sentence when no min/max
 * properties are asserted (crow's foot / structural participation marks). */
const MARK_CARDINALITY = {
  one: { min: 1, max: 1 }, zeroone: { min: 0, max: 1 },
  many: { min: 1 }, zeromany: { min: 0 }
};
function markCardinality(mark) {
  const c = MARK_CARDINALITY[mark];
  return c ? { ...c } : null;
}
const ENDPOINT_MARKS = ['none', 'filled', 'open', 'diamond', 'hollow_diamond', 'triangle', 'filled_triangle', 'lollipop', 'socket', 'one', 'zeroone', 'many', 'zeromany', 'slash'];

/* DDN-PJ149: UML association-end multiplicity grammar (1, 0..1, 0..*, 1..*, *).
 * The same regex ddn-profiles.js enforces at commit time. */
const UML_MULTIPLICITY = /^(\d+|\*)(\.\.(\d+|\*))?$/;
function umlMultiplicityOk(s) { return typeof s === 'string' && UML_MULTIPLICITY.test(s); }

/* Multi-selection (spec 05): the intersection of applicable controls with a
 * mixed-value state; a mixed value is reported, never coerced to whichever
 * value was read first. values is the per-item read of one property. */
function mixedValue(values) {
  const seen = [...new Set(values.map(v => JSON.stringify(v === undefined ? null : v)))];
  if (seen.length === 1) return { mixed: false, value: values[0] };
  return { mixed: true, value: undefined };
}
/* items: [{id, kind, isRelation}]. Returns the shared control surface:
 * common kind (or mixed), whether meaning-tab controls (label/kind editing)
 * apply, and the union/intersection split the UI needs. */
function multiSelection(items) {
  const list = (items || []).filter(Boolean);
  const kinds = mixedValue(list.map(i => i.kind || null));
  const allRelations = list.length > 0 && list.every(i => i.isRelation);
  const allElements = list.length > 0 && list.every(i => !i.isRelation);
  return {
    count: list.length,
    kind: kinds.mixed ? undefined : kinds.value,
    kindMixed: kinds.mixed,
    allRelations, allElements,
    /* Single-identity edits (label, description) never apply to a selection
     * of several identities; kind/occurrence controls do. */
    meaningEditable: list.length === 1,
    occurrenceEditable: list.length >= 1 && (allElements || allRelations)
  };
}

/* "Used in n views": views is [{entry, view, ids}] where ids is the resolved
 * uid list (elements + relations) of that view; returns the views containing
 * uid, in input order. */
function usedInViews(views, uid) {
  return (views || []).filter(v => (v.ids || []).includes(uid)).map(v => ({ entry: v.entry, view: v.view }));
}

const api = { GROUP_ORDER, EXTENSION_GROUP, groupFor, groupDetails, cardinalityText, cardinalitySentence, MARK_CARDINALITY, markCardinality, ENDPOINT_MARKS, UML_MULTIPLICITY, umlMultiplicityOk, mixedValue, multiSelection, usedInViews };
if (typeof module === 'object' && module.exports) module.exports = api;
host.DDNToolInspector = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
