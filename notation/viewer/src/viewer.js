/* SPDX-License-Identifier: GPL-2.0-or-later. B1-007/B1-011 end-user viewer logic.
 * Pure functions (computeFitScale, overrideRuleFor, typographyRuleFor,
 * relationOverrideState, viewerOverrides, viewListFrom, isPlausibleSourceFile,
 * rasterCanvasSize) are exported for node
 * unit tests; the DOM boot runs only in a browser with DDNLive loaded.
 * No Chrome-only APIs: file reading uses File/input elements, raster export uses
 * a 2D canvas + toDataURL, downloads use Blob + object URLs — all supported by
 * current Chrome and Firefox, including from file://. */
(function (host) {
'use strict';

/* --- pure functions (unit tested in node) --- */

/* Fit scale of an sw×sh SVG inside a cw×ch container.
 * 'page' = min(width,height) fit; 'width' = cw/sw; 'height' = ch/sh; '100' = 1. */
function computeFitScale(mode, cw, ch, sw, sh) {
  if (!(sw > 0) || !(sh > 0) || !(cw > 0) || !(ch > 0)) return 1;
  if (mode === 'width') return cw / sw;
  if (mode === 'height') return ch / sh;
  if (mode === 'page') return Math.min(cw / sw, ch / sh);
  if (mode === '100') return 1;
  throw new Error('unknown fit mode: ' + mode);
}

const slug = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/* Escape a value for use inside a double-quoted CSS attribute selector. */
function cssString(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\a ');
}

/* Runtime font stacks (notation/runtime/ddn-text.js FONTS) — the family
 * dropdowns display these real rendered names for the four runtime keywords. */
const FONT_STACKS = {
  sans: 'DejaVu Sans, Arial, sans-serif',
  serif: 'DejaVu Serif, Georgia, serif',
  mono: 'DejaVu Sans Mono, monospace',
  handwriting: 'Comic Neue, Segoe Print, Bradley Hand, Comic Sans MS, cursive'
};
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24];
const ROUTING_VALUES = ['orthogonal', 'straight', 'curved', 'rounded'];
const CROSSING_VALUES = ['gap', 'bridge', 'square_bridge'];
const ENDPOINT_ORDERING_VALUES = ['optimize', 'preserve'];

/* One presentation-override CSS rule. CSS always beats SVG presentation
 * attributes, so these rules restyle the render without touching the source.
 * target: {type:'font', stack} | {type:'kind', code} | {type:'verb', code}
 *       | {type:'object', id}; colour/font-family value in `value`. */
function overrideRuleFor(target, value) {
  if (!target || typeof target !== 'object') throw new Error('override target required');
  if (target.type === 'font') {
    const stack = String(value || '').trim();
    if (!stack) throw new Error('font stack required');
    return '.ddn-svg, .ddn-svg text, .ddn-svg tspan { font-family: ' + stack + '; }';
  }
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
    const sel = '.ddn-svg [data-ddn-id="' + cssString(target.id) + '"]';
    return sel + ' > path, ' + sel + ' > rect, ' + sel + ' > circle, ' + sel + ' > ellipse, ' + sel + ' > polygon { fill: ' + value + '; }';
  }
  throw new Error('unknown override type: ' + target.type);
}

/* Per-kind typography CSS overlay (B1-011 D2). `style` is
 * {family:'source'|sans|serif|mono|handwriting, size:'source'|<px 8-24>}.
 * This is a viewer stylesheet overlay: it does NOT re-run layout, so long
 * labels can overflow their shapes (the global font-size dropdown is the
 * reflow-safe control — it goes through the render override channel). */
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

/* Merge the relations presentation state into a renderSync overrides object
 * (B1-011 D3-D6). 'source'/empty entries are dropped so the override channel
 * stays inactive on untouched controls. Relation-id keys win over verb keys.
 * Crossings and endpoint ordering are view-level only (pairwise canvas
 * postprocessing), so they only ever come from the master row. */
function relationOverrideState(relations) {
  const r = relations || {}, o = {};
  if (r.routing != null && r.routing !== 'source') {
    if (!ROUTING_VALUES.includes(r.routing)) throw new Error('unknown routing: ' + r.routing);
    o.routing = r.routing;
  }
  if (r.crossings != null && r.crossings !== 'source') {
    if (!CROSSING_VALUES.includes(r.crossings)) throw new Error('unknown crossings: ' + r.crossings);
    o.crossings = r.crossings;
  }
  if (r.endpointOrdering != null && r.endpointOrdering !== 'source') {
    if (!ENDPOINT_ORDERING_VALUES.includes(r.endpointOrdering)) throw new Error('unknown endpoint ordering: ' + r.endpointOrdering);
    o.endpointOrdering = r.endpointOrdering;
  }
  if (r.curveTension != null && r.curveTension !== '') {
    const t = Number(r.curveTension);
    if (!Number.isFinite(t) || t < 0 || t > 1) throw new Error('curve tension must be between 0 and 1');
    o.curveTension = t;
  }
  if (r.curveRadius != null && r.curveRadius !== '') {
    const n = Number(r.curveRadius);
    if (!Number.isFinite(n) || n < 0 || n > 512) throw new Error('curve radius must be between 0 and 512px');
    o.curveRadius = n;
  }
  const rr = {};
  for (const [k, v] of Object.entries(r.verbRouting || {})) {
    if (v == null || v === 'source') continue;
    if (!ROUTING_VALUES.includes(v)) throw new Error('unknown routing for verb ' + k + ': ' + v);
    rr[k] = v;
  }
  for (const [k, v] of Object.entries(r.relationRouting || {})) {
    if (v == null || v === 'source') continue;
    if (!ROUTING_VALUES.includes(v)) throw new Error('unknown routing for relation ' + k + ': ' + v);
    rr[k] = v;
  }
  if (Object.keys(rr).length) o.relationRouting = rr;
  return o;
}

/* Full renderSync overrides from the unified presentation state (B1-011 D7):
 * global font family/size go through the override channel (proper reflow);
 * relation options come from relationOverrideState. Per-kind typography and
 * colours stay CSS-only (see overrideCss). */
function viewerOverrides(presentation) {
  const p = presentation || {}, o = relationOverrideState(p.relations);
  const f = p.font || {};
  if (f.family != null && f.family !== 'source') {
    if (!FONT_STACKS[f.family]) throw new Error('unknown font family: ' + f.family);
    o.font = f.family;
  }
  if (f.size != null && f.size !== 'source') {
    const n = Number(f.size);
    if (!Number.isFinite(n) || n < 8 || n > 64) throw new Error('font size must be between 8 and 64px');
    o.fontSize = n;
  }
  return o;
}

/* Flatten the workspace entries() surface into a picker list:
 * [{entry, view, label}]. Accepts the array returned by ws.entries(). */
function viewListFrom(entries) {
  if (!Array.isArray(entries)) throw new Error('entries array required');
  const out = [];
  for (const e of entries) {
    for (const v of (e && e.views) || []) out.push({ entry: e.file, view: v.id, label: e.file + ' · ' + (v.name || v.id) });
  }
  return out;
}

/* A dropped/selected file is plausible DDN source when its name ends in .ddn
 * (or embeds .ddn., e.g. archive members) or the browser typed it as text. */
function isPlausibleSourceFile(f) {
  if (!f || typeof f.name !== 'string') return false;
  return /\.ddn($|\.)/i.test(f.name) || (typeof f.type === 'string' && f.type.startsWith('text/'));
}

/* Dropped/selected files are read fully into memory before parsing, so cap
 * them; a multi-GB drop would otherwise hang or crash the tab. */
const MAX_FILE_BYTES = 50_000_000;

/* Raster export allocates a scale× canvas from the source-declared page size;
 * clamp each side so a hostile/buggy publication size cannot request an
 * enormous canvas. Throws on sizes beyond the cap. */
const MAX_RASTER_PX = 16384;
function rasterCanvasSize(w, h, scale) {
  const s = scale || 2;
  if (!(w > 0) || !(h > 0)) throw new Error('nothing rendered yet');
  const cw = Math.round(w * s), ch = Math.round(h * s);
  if (cw > MAX_RASTER_PX || ch > MAX_RASTER_PX)
    throw new Error('PNG export refused: ' + cw + '×' + ch + ' px exceeds the ' + MAX_RASTER_PX + ' px per-side cap; the source declares a very large page');
  return { width: cw, height: ch };
}

/* B1-023 (D1): `?src=<relative .ddn path>` deep link. Returns the src value
 * from a query string, or null when absent. Strictly relative: any scheme
 * (javascript:/data:/https:), scheme-relative //host, or absolute /path is
 * rejected — the viewer only ever fetches siblings of its own page. */
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

/* Fetch failures over file:// are browser restrictions, not missing files —
 * say so plainly instead of surfacing a bare TypeError. */
function srcFetchErrorMessage(err, protocol, src) {
  if (protocol === 'file:')
    return 'cannot fetch ' + src + ' — browsers block file:// page fetches. Serve the site over HTTP (npm run serve) or use Open file / paste instead.';
  return err && err.message || 'fetch failed';
}

const pure = { computeFitScale, overrideRuleFor, typographyRuleFor, relationOverrideState, viewerOverrides, viewListFrom, isPlausibleSourceFile, rasterCanvasSize, srcFromQuery, srcFetchErrorMessage, MAX_FILE_BYTES, MAX_RASTER_PX, FONT_STACKS, FONT_SIZES, ROUTING_VALUES, CROSSING_VALUES, ENDPOINT_ORDERING_VALUES };
if (typeof module === 'object' && module.exports) module.exports = pure;
if (typeof document === 'undefined' || !host.DDNLive) { host.DDNViewer = pure; return; }

/* --- browser boot --- */
const DDNLive = host.DDNLive;
const $ = id => document.getElementById(id);
const els = {
  open: $('ddn-open'), fileInput: $('ddn-file'), paste: $('ddn-paste'), loadPaste: $('ddn-load-paste'),
  picker: $('ddn-view-picker'), fitPage: $('ddn-fit-page'), fitWidth: $('ddn-fit-width'),
  fitHeight: $('ddn-fit-height'), fit100: $('ddn-fit-100'), zoomOut: $('ddn-zoom-out'),
  zoomIn: $('ddn-zoom-in'), zoomPct: $('ddn-zoom-pct'),
  fontFamily: $('ddn-font-family'), fontSize: $('ddn-font-size'),
  typeList: $('ddn-type-list'), typeReset: $('ddn-type-reset'),
  kinds: $('ddn-kind-list'), verbs: $('ddn-verb-list'), objectPanel: $('ddn-object-panel'),
  objectId: $('ddn-object-id'), objectColour: $('ddn-object-colour'), objectClear: $('ddn-object-clear'),
  relRouting: $('ddn-rel-routing'), relTension: $('ddn-rel-tension'), relRadius: $('ddn-rel-radius'),
  relCrossings: $('ddn-rel-crossings'), relEndpointOrdering: $('ddn-rel-endpoint-ordering'),
  verbRoutingList: $('ddn-verb-routing-list'), relationsReset: $('ddn-relations-reset'),
  relationPanel: $('ddn-relation-panel'), relationId: $('ddn-relation-id'),
  relationRouting: $('ddn-relation-routing'), relationClear: $('ddn-relation-clear'),
  reset: $('ddn-reset'), exportSvg: $('ddn-export-svg'), exportPng: $('ddn-export-png'),
  status: $('ddn-status'), stage: $('ddn-stage'), paper: $('ddn-paper'), hint: $('ddn-hint')
};
const overrideStyle = document.createElement('style');
overrideStyle.id = 'ddn-presentation-overrides';
document.head.appendChild(overrideStyle);

/* Unified presentation state (D7): global font (override channel), per-kind
 * typography (CSS), colour overrides (CSS), relation options (override channel). */
function emptyPresentation() {
  return {
    font: { family: 'source', size: 'source' },
    typography: {},
    kindColours: {}, verbColours: {}, objectColours: {},
    relations: { routing: 'source', curveTension: '', curveRadius: '', crossings: 'source', endpointOrdering: 'source', verbRouting: {}, relationRouting: {} }
  };
}
const state = {
  files: {}, entry: null, view: null, ws: null, viewList: [],
  fit: 'page', zoom: null,
  presentation: emptyPresentation(),
  selected: null, selectedRelation: null,
  svgText: '', svgW: 0, svgH: 0
};

function status(msg) {
  const base = state.entry ? state.entry + ' · view "' + state.view + '"' : 'no source loaded';
  els.status.textContent = base + (msg ? ' — ' + msg : '') + ' — presentation overrides; source unchanged';
}

function fail(msg) { els.status.textContent = 'Error: ' + msg; }

function loadFiles(files, entry) {
  try {
    const ws = DDNLive.createWorkspace(files);
    const list = viewListFrom(ws.entries());
    if (!list.length) { fail('no view declared in the loaded source'); return; }
    state.ws = ws; state.files = files;
    // Fresh document: selection and presentation state from any previously
    // loaded source must not carry over (overrides key on object ids).
    state.selected = null; state.selectedRelation = null;
    state.presentation = emptyPresentation();
    syncTypographyControls(); syncRelationControls();
    const first = list.find(v => v.entry === entry) || list[0];
    state.viewList = list;
    els.picker.innerHTML = '';
    list.forEach((v, i) => {
      const o = document.createElement('option');
      // Index into state.viewList: entry/view ids may contain any character,
      // so a concatenated separator encoding can never round-trip safely.
      o.value = String(i); o.textContent = v.label;
      els.picker.appendChild(o);
    });
    els.picker.value = String(list.indexOf(first));
    state.entry = first.entry; state.view = first.view;
    render();
  } catch (e) { fail(e && e.message); }
}

function colourRow(labelText, code, current, onPick, onClear) {
  const row = document.createElement('div'); row.className = 'ddn-colour-row';
  const lab = document.createElement('span'); lab.className = 'ddn-colour-label'; lab.textContent = labelText;
  const inp = document.createElement('input'); inp.type = 'color'; inp.value = current || '#888888';
  inp.setAttribute('aria-label', 'colour override for ' + labelText);
  inp.addEventListener('input', () => onPick(code, inp.value));
  const clr = document.createElement('button'); clr.type = 'button'; clr.className = 'ddn-mini'; clr.textContent = 'clear';
  clr.addEventListener('click', () => onClear(code));
  row.append(lab, inp, clr);
  return row;
}

function fillSelect(sel, options, current, ariaLabel) {
  sel.innerHTML = '';
  for (const [value, label] of options) {
    const o = document.createElement('option');
    o.value = value; o.textContent = label;
    sel.appendChild(o);
  }
  sel.value = current;
  if (ariaLabel) sel.setAttribute('aria-label', ariaLabel);
  return sel;
}
const familyOptions = () => [['source', 'source default']].concat(Object.entries(FONT_STACKS).map(([k, stack]) => [k, k + ' — ' + stack.split(',')[0]]));
const sizeOptions = () => [['source', 'source default']].concat(FONT_SIZES.map(n => [String(n), n + ' px']));
const routingOptions = () => [['source', 'default']].concat(ROUTING_VALUES.map(v => [v, v]));

function typographyRow(labelText, code) {
  const row = document.createElement('div'); row.className = 'ddn-colour-row ddn-typo-row';
  const lab = document.createElement('span'); lab.className = 'ddn-colour-label'; lab.textContent = labelText;
  const cur = state.presentation.typography[code] || { family: 'source', size: 'source' };
  const fam = fillSelect(document.createElement('select'), familyOptions(), cur.family || 'source', 'font family for ' + labelText);
  fam.classList.add('ddn-fam');
  const siz = fillSelect(document.createElement('select'), sizeOptions(), String(cur.size || 'source'), 'font size for ' + labelText);
  siz.classList.add('ddn-siz');
  const update = () => {
    if (fam.value === 'source' && siz.value === 'source') delete state.presentation.typography[code];
    else state.presentation.typography[code] = { family: fam.value, size: siz.value };
    applyOverrides();
  };
  fam.addEventListener('change', update); siz.addEventListener('change', update);
  const clr = document.createElement('button'); clr.type = 'button'; clr.className = 'ddn-mini'; clr.textContent = 'clear';
  clr.addEventListener('click', () => { delete state.presentation.typography[code]; repopulateOverrides(); applyOverrides(); });
  row.append(lab, fam, siz, clr);
  return row;
}

function verbRoutingRow(labelText, keyword) {
  const row = document.createElement('div'); row.className = 'ddn-colour-row';
  const lab = document.createElement('span'); lab.className = 'ddn-colour-label'; lab.textContent = labelText;
  const cur = state.presentation.relations.verbRouting[keyword] || 'source';
  const sel = fillSelect(document.createElement('select'), routingOptions(), cur, 'routing for ' + labelText);
  sel.addEventListener('change', () => {
    if (sel.value === 'source') delete state.presentation.relations.verbRouting[keyword];
    else state.presentation.relations.verbRouting[keyword] = sel.value;
    render();
  });
  const clr = document.createElement('button'); clr.type = 'button'; clr.className = 'ddn-mini'; clr.textContent = 'clear';
  clr.addEventListener('click', () => { delete state.presentation.relations.verbRouting[keyword]; repopulateOverrides(); render(); });
  row.append(lab, sel, clr);
  return row;
}

function repopulateOverrides() {
  const ir = state.ws.resolve(state.entry, state.view);
  const kindByKeyword = new Map(DDNLive.kinds.map(k => [k.id, k]));
  const verbByKeyword = new Map(DDNLive.relations.map(r => [r.id, r]));
  const kinds = new Map(), verbs = new Map();
  for (const el of ir.elements || []) {
    const k = kindByKeyword.get(el.kind || (el.properties && el.properties.kind));
    if (k && !kinds.has(k.code)) kinds.set(k.code, k.label);
  }
  for (const rel of ir.relations || []) {
    const v = verbByKeyword.get(rel.kind);
    if (v && !verbs.has(v.id)) verbs.set(v.id, v);
  }
  els.typeList.innerHTML = '<h3>Typography per kind</h3><p class="ddn-dim">CSS overlay — resizes do not reflow the layout (the global size dropdown does).</p>';
  if (!kinds.size) els.typeList.insertAdjacentHTML('beforeend', '<p class="ddn-dim">none in this view</p>');
  for (const [code, label] of [...kinds].sort()) els.typeList.appendChild(typographyRow(label + ' (' + code + ')', code));
  els.kinds.innerHTML = '<h3>Object kinds</h3>';
  if (!kinds.size) els.kinds.insertAdjacentHTML('beforeend', '<p class="ddn-dim">none in this view</p>');
  for (const [code, label] of [...kinds].sort()) els.kinds.appendChild(colourRow(label + ' (' + code + ')', code, state.presentation.kindColours[code],
    (c, col) => { state.presentation.kindColours[c] = col; applyOverrides(); },
    c => { delete state.presentation.kindColours[c]; repopulateOverrides(); applyOverrides(); }));
  els.verbs.innerHTML = '<h3>Relation classes</h3>';
  if (!verbs.size) els.verbs.insertAdjacentHTML('beforeend', '<p class="ddn-dim">none in this view</p>');
  for (const [keyword, v] of [...verbs].sort((a, b) => a[1].code < b[1].code ? -1 : 1)) els.verbs.appendChild(colourRow(v.label + ' (' + v.code + ')', v.code, state.presentation.verbColours[v.code],
    (c, col) => { state.presentation.verbColours[c] = col; applyOverrides(); },
    c => { delete state.presentation.verbColours[c]; repopulateOverrides(); applyOverrides(); }));
  els.verbRoutingList.innerHTML = '';
  if (!verbs.size) els.verbRoutingList.insertAdjacentHTML('beforeend', '<p class="ddn-dim">none in this view</p>');
  for (const [keyword, v] of [...verbs].sort((a, b) => a[1].code < b[1].code ? -1 : 1)) els.verbRoutingList.appendChild(verbRoutingRow(v.label + ' (' + keyword + ')', keyword));
}

function overrideCss() {
  const p = state.presentation, rules = [];
  for (const [code, style] of Object.entries(p.typography)) rules.push(typographyRuleFor(code, style));
  for (const [code, col] of Object.entries(p.kindColours)) rules.push(overrideRuleFor({ type: 'kind', code }, col));
  for (const [code, col] of Object.entries(p.verbColours)) rules.push(overrideRuleFor({ type: 'verb', code }, col));
  for (const [id, col] of Object.entries(p.objectColours)) rules.push(overrideRuleFor({ type: 'object', id }, col));
  if (state.selectedRelation) rules.push('.ddn-svg [data-id="' + cssString(state.selectedRelation) + '"] path { stroke: #d97706; stroke-width: 2.5px; }');
  return rules.join('\n');
}

function applyOverrides() {
  overrideStyle.textContent = overrideCss();
  const p = state.presentation;
  const n = Object.keys(p.kindColours).length + Object.keys(p.verbColours).length + Object.keys(p.objectColours).length + Object.keys(p.typography).length;
  status(n ? n + ' CSS override(s) active' : null);
}

/* Sanitize renderer output before it enters the live DOM (ported from the
 * designer's safeSVG, designer/prototype/app.js): parse as image/svg+xml,
 * strip script/foreignObject, all on* attributes and non-fragment hrefs,
 * then insert an imported node — never innerHTML. The renderer escapes all
 * diagram text today; this keeps a future escaping gap from becoming XSS. */
function safeSVG(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid SVG');
  doc.querySelectorAll('script,foreignObject').forEach(x => x.remove());
  doc.querySelectorAll('*').forEach(e => {
    for (const a of [...e.attributes]) {
      if (/^on/i.test(a.name) || ((a.name === 'href' || a.name === 'xlink:href') && !a.value.startsWith('#'))) e.removeAttribute(a.name);
    }
  });
  return document.importNode(doc.documentElement, true);
}

function render() {
  try {
    const r = state.ws.renderSync({ entry: state.entry, view: state.view, overrides: viewerOverrides(state.presentation) });
    state.svgText = r.svg;
    els.paper.replaceChildren(safeSVG(r.svg));
    const svg = els.paper.querySelector('svg');
    state.svgW = parseFloat(svg.getAttribute('width')) || 800;
    state.svgH = parseFloat(svg.getAttribute('height')) || 600;
    els.hint.style.display = 'none';
    repopulateOverrides();
    updateObjectPanel();
    updateRelationPanel();
    applyOverrides();
    applyFit();
  } catch (e) { fail(e && e.message); }
}

function currentScale() {
  if (state.zoom != null) return state.zoom;
  const cw = els.stage.clientWidth - 48, ch = els.stage.clientHeight - 48;
  return computeFitScale(state.fit, cw, ch, state.svgW, state.svgH);
}

function applyFit() {
  const s = currentScale();
  els.paper.style.width = state.svgW + 'px';
  els.paper.style.height = state.svgH + 'px';
  els.paper.style.transform = 'scale(' + s + ')';
  els.zoomPct.textContent = Math.round(s * 100) + '%';
  for (const [b, m] of [[els.fitPage, 'page'], [els.fitWidth, 'width'], [els.fitHeight, 'height'], [els.fit100, '100']])
    b.classList.toggle('active', state.zoom == null && state.fit === m);
  status();
}

function setFit(mode) { state.fit = mode; state.zoom = null; applyFit(); }
function zoomStep(f) {
  state.zoom = Math.min(8, Math.max(0.05, currentScale() * f));
  applyFit();
}

function updateObjectPanel() {
  const has = !!state.selected;
  els.objectPanel.classList.toggle('ddn-dim', !has);
  els.objectId.textContent = has ? state.selected : '(click an object in the diagram)';
  els.objectColour.disabled = !has; els.objectClear.disabled = !has;
  if (has) els.objectColour.value = state.presentation.objectColours[state.selected] || '#888888';
}

function updateRelationPanel() {
  const has = !!state.selectedRelation;
  els.relationPanel.classList.toggle('ddn-dim', !has);
  els.relationId.textContent = has ? state.selectedRelation : '(click a relation in the diagram)';
  els.relationRouting.disabled = !has; els.relationClear.disabled = !has;
  els.relationRouting.value = has ? (state.presentation.relations.relationRouting[state.selectedRelation] || 'source') : 'source';
}

els.paper.addEventListener('click', e => {
  if (!e.target || !e.target.closest) return;
  const rel = e.target.closest('.ddn-relation[data-id]');
  if (rel && els.paper.contains(rel)) {
    state.selectedRelation = rel.getAttribute('data-id');
    updateRelationPanel(); applyOverrides();
    status('selected relation ' + state.selectedRelation);
    return;
  }
  const g = e.target.closest('[data-ddn-id]');
  if (!g || !els.paper.contains(g)) return;
  state.selected = g.getAttribute('data-ddn-id');
  updateObjectPanel();
  status('selected object ' + state.selected);
});
els.objectColour.addEventListener('input', () => {
  if (!state.selected) return;
  state.presentation.objectColours[state.selected] = els.objectColour.value;
  applyOverrides();
});
els.objectClear.addEventListener('click', () => {
  if (!state.selected) return;
  delete state.presentation.objectColours[state.selected];
  updateObjectPanel(); applyOverrides();
});
els.relationRouting.addEventListener('change', () => {
  if (!state.selectedRelation) return;
  if (els.relationRouting.value === 'source') delete state.presentation.relations.relationRouting[state.selectedRelation];
  else state.presentation.relations.relationRouting[state.selectedRelation] = els.relationRouting.value;
  render();
});
els.relationClear.addEventListener('click', () => {
  if (!state.selectedRelation) return;
  delete state.presentation.relations.relationRouting[state.selectedRelation];
  updateRelationPanel(); render();
});

els.open.addEventListener('click', () => els.fileInput.click());
/* Read a FileList into a null-prototype name→text map: size-capped, duplicate
 * basenames keep the first file, and a file literally named "__proto__"
 * cannot trip the prototype setter. */
function readSourceFiles(list) {
  const files = Object.create(null), dupes = [];
  return Promise.all(list.map(f => {
    if (f.size > MAX_FILE_BYTES)
      throw new Error(f.name + ' is ' + Math.round(f.size / 1e6) + ' MB — the viewer accepts sources up to ' + (MAX_FILE_BYTES / 1e6) + ' MB');
    return f.text().then(t => {
      if (Object.prototype.hasOwnProperty.call(files, f.name)) { dupes.push(f.name); return; }
      files[f.name] = t;
    });
  })).then(() => ({ files, dupes }));
}
els.fileInput.addEventListener('change', () => {
  const list = [...els.fileInput.files];
  // Reset so re-selecting the same (edited) file fires change again.
  els.fileInput.value = '';
  if (!list.length) return;
  readSourceFiles(list)
    .then(({ files, dupes }) => {
      els.paste.value = files[list[0].name];
      loadFiles(files, list[0].name);
      if (dupes.length) status('duplicate name skipped: ' + dupes.join(', '));
    })
    .catch(e => fail(e && e.message));
});
els.loadPaste.addEventListener('click', () => {
  const t = els.paste.value.trim();
  if (!t) { fail('paste a .ddn source first'); return; }
  loadFiles({ 'pasted.ddn': els.paste.value }, 'pasted.ddn');
});

/* B1-023 (D1): deep link — `index.html?src=<relative .ddn path>` fetches the
 * source next to the page and loads it as a single-file workspace, first view
 * selected. The fetched text is size-capped like a dropped file and parsed via
 * the normal loadFiles path, so parse errors show in the standard status line. */
function loadFromSrc(src) {
  status('loading ' + src + ' …');
  fetch(src)
    .then(r => { if (!r.ok) throw new Error(src + ' — HTTP ' + r.status); return r.text(); })
    .then(text => {
      if (text.length > MAX_FILE_BYTES)
        throw new Error(src + ' is ' + Math.round(text.length / 1e6) + ' MB — the viewer accepts sources up to ' + (MAX_FILE_BYTES / 1e6) + ' MB');
      const name = src.split('/').pop().split(/[?#]/)[0];
      els.paste.value = text;
      loadFiles({ [name]: text }, name);
    })
    .catch(e => fail(srcFetchErrorMessage(e, host.location && host.location.protocol, src)));
}
for (const ev of ['dragover', 'drop']) document.addEventListener(ev, e => e.preventDefault());
document.addEventListener('drop', e => {
  const all = [...(e.dataTransfer && e.dataTransfer.files || [])];
  const list = all.filter(isPlausibleSourceFile);
  if (!list.length) { if (all.length) fail('drop a .ddn or text file'); return; }
  readSourceFiles(list)
    .then(({ files, dupes }) => {
      els.paste.value = files[list[0].name];
      loadFiles(files, list[0].name);
      if (dupes.length) status('duplicate name skipped: ' + dupes.join(', '));
    })
    .catch(err => fail(err && err.message));
});
els.picker.addEventListener('change', () => {
  const v = (state.viewList || [])[+els.picker.value];
  if (!v) return;
  state.entry = v.entry; state.view = v.view; render();
});
els.fitPage.addEventListener('click', () => setFit('page'));
els.fitWidth.addEventListener('click', () => setFit('width'));
els.fitHeight.addEventListener('click', () => setFit('height'));
els.fit100.addEventListener('click', () => setFit('100'));
els.zoomOut.addEventListener('click', () => zoomStep(1 / 1.25));
els.zoomIn.addEventListener('click', () => zoomStep(1.25));

function syncTypographyControls() {
  els.fontFamily.value = state.presentation.font.family;
  els.fontSize.value = state.presentation.font.size;
}
els.fontFamily.addEventListener('change', () => { state.presentation.font.family = els.fontFamily.value; render(); });
els.fontSize.addEventListener('change', () => { state.presentation.font.size = els.fontSize.value; render(); });
els.typeReset.addEventListener('click', () => {
  state.presentation.font = { family: 'source', size: 'source' };
  state.presentation.typography = {};
  syncTypographyControls(); repopulateOverrides(); render();
});

function syncRelationControls() {
  const r = state.presentation.relations;
  els.relRouting.value = r.routing;
  els.relTension.value = r.curveTension;
  els.relRadius.value = r.curveRadius;
  els.relCrossings.value = r.crossings;
  els.relEndpointOrdering.value = r.endpointOrdering;
}
els.relRouting.addEventListener('change', () => { state.presentation.relations.routing = els.relRouting.value; render(); });
els.relTension.addEventListener('change', () => { state.presentation.relations.curveTension = els.relTension.value; render(); });
els.relRadius.addEventListener('change', () => { state.presentation.relations.curveRadius = els.relRadius.value; render(); });
els.relCrossings.addEventListener('change', () => { state.presentation.relations.crossings = els.relCrossings.value; render(); });
els.relEndpointOrdering.addEventListener('change', () => { state.presentation.relations.endpointOrdering = els.relEndpointOrdering.value; render(); });
els.relationsReset.addEventListener('click', () => {
  state.presentation.relations = emptyPresentation().relations;
  state.selectedRelation = null;
  syncRelationControls(); repopulateOverrides(); updateRelationPanel(); render();
});

els.reset.addEventListener('click', () => {
  state.presentation = emptyPresentation();
  state.selected = null; state.selectedRelation = null;
  syncTypographyControls(); syncRelationControls();
  repopulateOverrides(); updateObjectPanel(); updateRelationPanel(); render();
});
host.addEventListener('resize', () => { if (state.ws) applyFit(); });

function exportSvgString() {
  if (!state.svgText) throw new Error('nothing rendered yet');
  const css = overrideCss();
  if (!css) return state.svgText;
  return state.svgText.replace(/<svg /, () => '<svg data-ddn-viewer-export="presentation-overrides" ').replace(/(<svg[^>]*>)/, () => '$1<style>' + css + '</style>');
}

function download(name, href) {
  const a = document.createElement('a');
  a.href = href; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}

els.exportSvg.addEventListener('click', () => {
  try {
    const blob = new Blob([exportSvgString()], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    download((state.view || 'diagram') + '.svg', url);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    status('SVG exported');
  } catch (e) { fail(e && e.message); }
});
els.exportPng.addEventListener('click', () => {
  try {
    const svg = exportSvgString();
    const img = new Image();
    img.onload = () => {
      try {
        const size = rasterCanvasSize(state.svgW, state.svgH, 2);
        const c = document.createElement('canvas');
        c.width = size.width; c.height = size.height;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        download((state.view || 'diagram') + '.png', c.toDataURL('image/png'));
        status('PNG exported at 2×');
      } catch (err) { fail(err && err.message); }
    };
    img.onerror = () => fail('PNG rasterisation failed');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  } catch (e) { fail(e && e.message); }
});

host.DDNViewer = Object.assign({}, pure, {
  loadFiles, setFit, zoomStep, render, applyOverrides, exportSvgString,
  setFontFamily: v => { state.presentation.font.family = v; syncTypographyControls(); render(); },
  setFontSize: v => { state.presentation.font.size = String(v); syncTypographyControls(); render(); },
  setKindTypography: (code, style) => { state.presentation.typography[code] = style; repopulateOverrides(); applyOverrides(); },
  setKindColour: (code, col) => { state.presentation.kindColours[code] = col; applyOverrides(); },
  setVerbColour: (code, col) => { state.presentation.verbColours[code] = col; applyOverrides(); },
  setObjectColour: (id, col) => { state.presentation.objectColours[id] = col; applyOverrides(); },
  selectObject: id => { state.selected = id; updateObjectPanel(); },
  setRouting: v => { state.presentation.relations.routing = v; syncRelationControls(); render(); },
  setCurveTension: v => { state.presentation.relations.curveTension = String(v); syncRelationControls(); render(); },
  setCurveRadius: v => { state.presentation.relations.curveRadius = String(v); syncRelationControls(); render(); },
  setCrossings: v => { state.presentation.relations.crossings = v; syncRelationControls(); render(); },
  setEndpointOrdering: v => { state.presentation.relations.endpointOrdering = v; syncRelationControls(); render(); },
  setVerbRouting: (verb, v) => { state.presentation.relations.verbRouting[verb] = v; repopulateOverrides(); render(); },
  selectRelation: id => { state.selectedRelation = id; updateRelationPanel(); applyOverrides(); },
  setRelationRouting: (id, v) => { state.presentation.relations.relationRouting[id] = v; render(); },
  resetTypography: () => els.typeReset.click(),
  resetRelations: () => els.relationsReset.click(),
  resetOverrides: () => els.reset.click(),
  sourceText: () => els.paste.value,
  state
});
status('open a .ddn file, drop it anywhere, or paste a source');
/* Deep link boot (B1-023): runs after every control is wired so the loaded
 * source lands in a fully initialised viewer. */
try {
  const bootSrc = srcFromQuery(host.location && host.location.search);
  if (bootSrc) loadFromSrc(bootSrc);
} catch (e) { fail(e && e.message); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
