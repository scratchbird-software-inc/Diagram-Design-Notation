/* SPDX-License-Identifier: GPL-2.0-or-later. B1-071: extracted from tool.js — presentation-override CSS rules and the component override mapping.
 * UMD: inlined into the single-file tool/viewer builds and required by node tests. */
(function (host) {
'use strict';
const O = typeof module === 'object' && module.exports ? require('./options.js') : host.DDNOptions;
const FONT_STACKS = O.FONT_STACKS;
const ROUTING_VALUES = O.ROUTING_VALUES;

const slug = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function cssString(s) { return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\a '); }

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
 * long labels can overflow; the global font-size control reflows instead.
 * Phase 9 (owner-approved font editor): the specials the notation cannot
 * express in source ride the same session-preview CSS channel — bold, italic,
 * strike-through, small-caps and text colour — all pure CSS on SVG text, all
 * session-only, never serialized into the source. */
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
  if (style && style.bold) decls.push('font-weight: 700');
  if (style && style.italic) decls.push('font-style: italic');
  if (style && style.strike) decls.push('text-decoration: line-through');
  if (style && style.smallCaps) decls.push('font-variant-caps: small-caps');
  if (style && style.colour != null && style.colour !== '') {
    if (!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(style.colour))) throw new Error('colour must be #rgb or #rrggbb');
    decls.push('fill: ' + style.colour);
  }
  if (!decls.length) throw new Error('typography rule needs a family or a size');
  return '.ddn-svg .ddn-kind-' + slug(code) + ' text { ' + decls.join('; ') + '; }';
}

/* Shared recent-colours history (phase 9 colour picker): validates and folds
 * one picked colour into an MRU list, most-recent-first, deduplicated,
 * case-folded, capped (the drawer widgets persist the result in
 * localStorage). */
const COLOUR_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
function recentColours(list, colour, max) {
  const cap = max || 10;
  const out = (Array.isArray(list) ? list : []).filter(c => typeof c === 'string' && COLOUR_RE.test(c));
  if (colour == null || colour === '') return out.slice(0, cap);
  if (!COLOUR_RE.test(String(colour))) throw new Error('colour must be #rgb or #rrggbb');
  const c = String(colour).toLowerCase();
  return [c, ...out.filter(x => x.toLowerCase() !== c)].slice(0, cap);
}

/* Phase 10 (owner-approved unified editors): per-relation colour, line dash /
 * weight, and shape outline rules — all session-preview CSS, never serialized.
 * Dash/weight rules scope to g[data-route-pieces] so endpoint arrowheads (the
 * sibling transform-group inside .ddn-rel) keep their crisp geometry; stroke
 * width does not rescale arrowheads (documented cosmetic limit). */
function relationColourRuleFor(id, colour) {
  if (!COLOUR_RE.test(String(colour))) throw new Error('colour must be #rgb or #rrggbb');
  return '.ddn-svg .ddn-rel[data-id="' + cssString(id) + '"] path { stroke: ' + colour + '; }';
}
function lineStyleRuleFor(sel, style) {
  const decls = [];
  if (style && style.weight != null && style.weight !== '') {
    const n = Number(style.weight);
    if (!Number.isFinite(n) || n < 0.25 || n > 12) throw new Error('stroke weight must be between 0.25 and 12px');
    decls.push('stroke-width: ' + n + 'px');
  }
  if (style && style.dash != null && String(style.dash).trim() !== '') {
    const d = String(style.dash).trim();
    if (!/^[0-9., ]+$/.test(d)) throw new Error('dash pattern must be numbers and spaces, e.g. "6 4"');
    decls.push('stroke-dasharray: ' + d);
  }
  if (!decls.length) throw new Error('line style needs a weight or a dash pattern');
  return sel + ' > g[data-route-pieces] path { ' + decls.join('; ') + '; }';
}
/* Shape outlines: the node group's direct shape children (rect/path/circle/
 * ellipse/polygon), the same selector set fill overrides use — CSS beats the
 * presentation attributes the renderer paints with. */
function outlineRuleFor(sel, style) {
  const decls = [];
  if (style && style.colour != null && style.colour !== '') {
    if (!COLOUR_RE.test(String(style.colour))) throw new Error('colour must be #rgb or #rrggbb');
    decls.push('stroke: ' + style.colour);
  }
  if (style && style.weight != null && style.weight !== '') {
    const n = Number(style.weight);
    if (!Number.isFinite(n) || n < 0.25 || n > 12) throw new Error('outline weight must be between 0.25 and 12px');
    decls.push('stroke-width: ' + n + 'px');
  }
  if (style && style.dash != null && String(style.dash).trim() !== '') {
    const d = String(style.dash).trim();
    if (!/^[0-9., ]+$/.test(d)) throw new Error('dash pattern must be numbers and spaces, e.g. "4 3"');
    decls.push('stroke-dasharray: ' + d);
  }
  if (!decls.length) throw new Error('outline style needs a colour, a weight or a dash pattern');
  const sels = ['path', 'rect', 'circle', 'ellipse', 'polygon'].map(tag => sel + ' > ' + tag);
  return sels.join(', ') + ' { ' + decls.join('; ') + '; }';
}

/* The whole CSS overlay for the current presentation + selection highlight. */
function overrideCss(presentation, selectedRelation) {
  const p = presentation || {}, rules = [];
  for (const [code, style] of Object.entries(p.typography || {})) rules.push(typographyRuleFor(code, style));
  for (const [code, col] of Object.entries(p.kindColours || {})) rules.push(overrideRuleFor({ type: 'kind', code }, col));
  for (const [code, col] of Object.entries(p.verbColours || {})) rules.push(overrideRuleFor({ type: 'verb', code }, col));
  for (const [id, col] of Object.entries(p.objectColours || {})) rules.push(overrideRuleFor({ type: 'object', id }, col));
  for (const [id, col] of Object.entries(p.relationColours || {})) rules.push(relationColourRuleFor(id, col));
  for (const [key, style] of Object.entries(p.lineStyles || {})) {
    const sel = key.startsWith('rel:')
      ? '.ddn-svg .ddn-rel[data-id="' + cssString(key.slice(4)) + '"]'
      : '.ddn-svg .ddn-verb-' + slug(key.startsWith('verb:') ? key.slice(5) : key);
    rules.push(lineStyleRuleFor(sel, style));
  }
  for (const [code, style] of Object.entries(p.kindOutlines || {})) rules.push(outlineRuleFor('.ddn-svg .ddn-kind-' + slug(code), style));
  for (const [id, style] of Object.entries(p.objectOutlines || {})) rules.push(outlineRuleFor('.ddn-svg [data-id="' + cssString(id) + '"], .ddn-svg [data-ddn-id="' + cssString(id) + '"]', style));
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
  /* B1-100: mind-map per-entity window caps ride the mindNodes presentation
   * channel (never written into source). */
  if (p.mindNodes && Object.keys(p.mindNodes).length) o.mindNodes = { ...p.mindNodes };
  return o;
}

/* B1-050 (D2): inverse of the component override channel (api.js apply()).
 * Maps set presentation options back to the view profile properties they
 * came from, so getSource({includeAppearance:true}) can serialize the current
 * presentation INTO the source through authoring.setViewProfile. Mirrors
 * apply() branch-for-branch; the D5 round-trip test (SVG byte-identical after
 * reload without overrides) guards the correspondence. */
function overrideProfileWrites(o) {
  const groups = {}, Q = n => ({ $quantity: n, unit: 'px' });
  const put = (g, k, v) => { (groups[g] = groups[g] || {})[k] = v; };
  const src = v => v == null || v === 'source';
  o = o || {};
  if (!src(o.mark)) put('projection', 'mark', o.mark);
  if (!src(o.endpointOrdering)) put('layout', 'endpoint_ordering', o.endpointOrdering);
  if (!src(o.placement)) { put('layout', 'algorithm', o.placement); if (src(o.center)) put('layout', 'center', 'pins'); }
  if (o.autoPlace != null) put('layout', 'auto_place', o.autoPlace);
  if (o.gridStep != null) put('layout', 'grid_step', Q(o.gridStep));
  if (!src(o.center)) put('layout', 'center', o.center);
  if (!src(o.routing)) { put('layout', 'routing', o.routing === 'rounded' ? 'curved' : o.routing); put('layout', 'curve', o.routing === 'rounded' ? 'rounded' : 'bezier'); }
  if (o.curveTension != null) put('layout', 'curve_tension', o.curveTension);
  if (o.curveRadius != null) put('layout', 'curve_radius', Q(o.curveRadius));
  if (!src(o.crossings)) put('layout', 'crossings', o.crossings);
  for (const k of ['theme', 'font']) if (!src(o[k])) put('style', k, o[k]);
  for (const k of ['look', 'roughness', 'hachure']) if (o[k] != null) put('style', k, o[k]);
  if (o.fontSize != null) put('style', 'font_size', Q(o.fontSize));
  for (const k of ['fields', 'domains', 'datatypes', 'kind']) if (!src(o[k])) put('display', k, o[k]);
  if (o.depth != null) put('display', 'depth', o.depth);
  if (!src(o.labels)) put('legend', 'mode', o.labels);
  for (const k of ['legend', 'title', 'footer']) if (!src(o[k])) put('chrome', k, o[k]);
  if (!src(o.page)) {
    put('publication', 'size', 'figure');
    put('publication', 'width', Q(o.width != null ? o.width : 1600));
    put('publication', 'height', Q(o.height != null ? o.height : 1000));
    put('publication', 'fit', 'contain');
    put('publication', 'overflow', 'error');
    if (o.page === 'content') { put('publication', 'size', 'content'); put('publication', 'fit', 'none'); }
    if (o.page === 'web') { put('publication', 'width', Q(1600)); put('publication', 'height', Q(1000)); }
    if (o.page.startsWith('a4-')) { put('publication', 'size', 'a4'); put('publication', 'orientation', o.page.endsWith('portrait') ? 'portrait' : 'landscape'); }
    if (o.page.startsWith('letter-')) { put('publication', 'size', 'letter'); put('publication', 'orientation', o.page.endsWith('portrait') ? 'portrait' : 'landscape'); }
  }
  const routes = {};
  for (const [key, v] of Object.entries(o.relationRouting || {}))
    routes[key] = v === 'rounded' ? { routing: 'curved', curve: 'rounded' } : { routing: v };
  return { groups, routes };
}

/* The CSS-overlay presentation state (per-kind/verb/object colours, per-kind
 * typography) has no standard-DDN representation (spec 04: arbitrary source
 * CSS and per-view palette aliases are not allowed). It round-trips as the
 * view's x_tool_presentation extension record; null when no overlay is set. */
function cssOverlayRecord(presentation) {
  const p = presentation || {}, out = {};
  for (const k of ['kindColours', 'verbColours', 'objectColours', 'typography', 'relationColours', 'lineStyles', 'kindOutlines', 'objectOutlines'])
    if (p[k] && typeof p[k] === 'object' && Object.keys(p[k]).length) out[k] = JSON.parse(JSON.stringify(p[k]));
  return Object.keys(out).length ? out : null;
}

const api = { slug, cssString, overrideRuleFor, typographyRuleFor, recentColours, relationColourRuleFor, lineStyleRuleFor, outlineRuleFor, overrideCss, toolOverrides, overrideProfileWrites, cssOverlayRecord };
if (typeof module === 'object' && module.exports) module.exports = api;
host.DDNToolPresentation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
