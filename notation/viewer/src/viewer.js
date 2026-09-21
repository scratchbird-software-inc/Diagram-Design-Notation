/* SPDX-License-Identifier: GPL-2.0-or-later. B1-007 end-user viewer logic.
 * Pure functions (computeFitScale, overrideRuleFor, viewListFrom) are exported
 * for node unit tests; the DOM boot runs only in a browser with DDNLive loaded.
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

const pure = { computeFitScale, overrideRuleFor, viewListFrom };
if (typeof module === 'object' && module.exports) module.exports = pure;
if (typeof document === 'undefined' || !host.DDNLive) { host.DDNViewer = pure; return; }

/* --- browser boot --- */
const DDNLive = host.DDNLive;
const $ = id => document.getElementById(id);
const els = {
  open: $('ddn-open'), fileInput: $('ddn-file'), paste: $('ddn-paste'), loadPaste: $('ddn-load-paste'),
  picker: $('ddn-view-picker'), fitPage: $('ddn-fit-page'), fitWidth: $('ddn-fit-width'),
  fitHeight: $('ddn-fit-height'), fit100: $('ddn-fit-100'), zoomOut: $('ddn-zoom-out'),
  zoomIn: $('ddn-zoom-in'), zoomPct: $('ddn-zoom-pct'), font: $('ddn-font'),
  kinds: $('ddn-kind-list'), verbs: $('ddn-verb-list'), objectPanel: $('ddn-object-panel'),
  objectId: $('ddn-object-id'), objectColour: $('ddn-object-colour'), objectClear: $('ddn-object-clear'),
  reset: $('ddn-reset'), exportSvg: $('ddn-export-svg'), exportPng: $('ddn-export-png'),
  status: $('ddn-status'), stage: $('ddn-stage'), paper: $('ddn-paper'), hint: $('ddn-hint')
};
const overrideStyle = document.createElement('style');
overrideStyle.id = 'ddn-presentation-overrides';
document.head.appendChild(overrideStyle);

const state = {
  files: {}, entry: null, view: null, ws: null,
  fit: 'page', zoom: null, font: '',
  kindColours: {}, verbColours: {}, objectColours: {}, selected: null,
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
    const first = list.find(v => v.entry === entry) || list[0];
    els.picker.innerHTML = '';
    for (const v of list) {
      const o = document.createElement('option');
      o.value = v.entry + '' + v.view; o.textContent = v.label;
      els.picker.appendChild(o);
    }
    els.picker.value = first.entry + '' + first.view;
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
    if (v && !verbs.has(v.code)) verbs.set(v.code, v.label);
  }
  els.kinds.innerHTML = '<h3>Object kinds</h3>';
  if (!kinds.size) els.kinds.insertAdjacentHTML('beforeend', '<p class="ddn-dim">none in this view</p>');
  for (const [code, label] of [...kinds].sort()) els.kinds.appendChild(colourRow(label + ' (' + code + ')', code, state.kindColours[code],
    (c, col) => { state.kindColours[c] = col; applyOverrides(); },
    c => { delete state.kindColours[c]; repopulateOverrides(); applyOverrides(); }));
  els.verbs.innerHTML = '<h3>Relation classes</h3>';
  if (!verbs.size) els.verbs.insertAdjacentHTML('beforeend', '<p class="ddn-dim">none in this view</p>');
  for (const [code, label] of [...verbs].sort()) els.verbs.appendChild(colourRow(label + ' (' + code + ')', code, state.verbColours[code],
    (c, col) => { state.verbColours[c] = col; applyOverrides(); },
    c => { delete state.verbColours[c]; repopulateOverrides(); applyOverrides(); }));
}

function overrideCss() {
  const rules = [];
  if (state.font.trim()) rules.push(overrideRuleFor({ type: 'font' }, state.font));
  for (const [code, col] of Object.entries(state.kindColours)) rules.push(overrideRuleFor({ type: 'kind', code }, col));
  for (const [code, col] of Object.entries(state.verbColours)) rules.push(overrideRuleFor({ type: 'verb', code }, col));
  for (const [id, col] of Object.entries(state.objectColours)) rules.push(overrideRuleFor({ type: 'object', id }, col));
  return rules.join('\n');
}

function applyOverrides() {
  overrideStyle.textContent = overrideCss();
  const n = Object.keys(state.kindColours).length + Object.keys(state.verbColours).length + Object.keys(state.objectColours).length + (state.font.trim() ? 1 : 0);
  status(n ? n + ' override(s) active' : null);
}

function render() {
  try {
    const r = state.ws.renderSync({ entry: state.entry, view: state.view });
    state.svgText = r.svg;
    els.paper.innerHTML = r.svg;
    const svg = els.paper.querySelector('svg');
    state.svgW = parseFloat(svg.getAttribute('width')) || 800;
    state.svgH = parseFloat(svg.getAttribute('height')) || 600;
    els.hint.style.display = 'none';
    state.selected = null;
    updateObjectPanel();
    repopulateOverrides();
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
  if (has) els.objectColour.value = state.objectColours[state.selected] || '#888888';
}

els.paper.addEventListener('click', e => {
  const g = e.target && e.target.closest ? e.target.closest('[data-ddn-id]') : null;
  if (!g || !els.paper.contains(g)) return;
  state.selected = g.getAttribute('data-ddn-id');
  updateObjectPanel();
  status('selected object ' + state.selected);
});
els.objectColour.addEventListener('input', () => {
  if (!state.selected) return;
  state.objectColours[state.selected] = els.objectColour.value;
  applyOverrides();
});
els.objectClear.addEventListener('click', () => {
  if (!state.selected) return;
  delete state.objectColours[state.selected];
  updateObjectPanel(); applyOverrides();
});

els.open.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', () => {
  const files = {};
  const list = [...els.fileInput.files];
  if (!list.length) return;
  Promise.all(list.map(f => f.text().then(t => { files[f.name] = t; })))
    .then(() => { els.paste.value = files[list[0].name]; loadFiles(files, list[0].name); })
    .catch(e => fail(e && e.message));
});
els.loadPaste.addEventListener('click', () => {
  const t = els.paste.value.trim();
  if (!t) { fail('paste a .ddn source first'); return; }
  loadFiles({ 'pasted.ddn': els.paste.value }, 'pasted.ddn');
});
for (const ev of ['dragover', 'drop']) document.addEventListener(ev, e => e.preventDefault());
document.addEventListener('drop', e => {
  const list = [...(e.dataTransfer && e.dataTransfer.files || [])].filter(f => /\.ddn$|\.ddn\./i.test(f.name) || true);
  if (!list.length) return;
  const files = {};
  Promise.all(list.map(f => f.text().then(t => { files[f.name] = t; })))
    .then(() => { els.paste.value = files[list[0].name]; loadFiles(files, list[0].name); })
    .catch(err => fail(err && err.message));
});
els.picker.addEventListener('change', () => {
  const [entry, view] = els.picker.value.split('');
  state.entry = entry; state.view = view; render();
});
els.fitPage.addEventListener('click', () => setFit('page'));
els.fitWidth.addEventListener('click', () => setFit('width'));
els.fitHeight.addEventListener('click', () => setFit('height'));
els.fit100.addEventListener('click', () => setFit('100'));
els.zoomOut.addEventListener('click', () => zoomStep(1 / 1.25));
els.zoomIn.addEventListener('click', () => zoomStep(1.25));
els.font.addEventListener('input', () => { state.font = els.font.value; applyOverrides(); });
els.reset.addEventListener('click', () => {
  state.font = ''; els.font.value = '';
  state.kindColours = {}; state.verbColours = {}; state.objectColours = {};
  repopulateOverrides(); updateObjectPanel(); applyOverrides();
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
      const c = document.createElement('canvas');
      c.width = Math.round(state.svgW * 2); c.height = Math.round(state.svgH * 2);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      download((state.view || 'diagram') + '.png', c.toDataURL('image/png'));
      status('PNG exported at 2×');
    };
    img.onerror = () => fail('PNG rasterisation failed');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  } catch (e) { fail(e && e.message); }
});

host.DDNViewer = Object.assign({}, pure, {
  loadFiles, setFit, zoomStep, render, applyOverrides, exportSvgString,
  setFont: v => { els.font.value = v; state.font = v; applyOverrides(); },
  setKindColour: (code, col) => { state.kindColours[code] = col; applyOverrides(); },
  setVerbColour: (code, col) => { state.verbColours[code] = col; applyOverrides(); },
  setObjectColour: (id, col) => { state.objectColours[id] = col; applyOverrides(); },
  selectObject: id => { state.selected = id; updateObjectPanel(); },
  resetOverrides: () => els.reset.click(),
  sourceText: () => els.paste.value,
  state
});
status('open a .ddn file, drop it anywhere, or paste a source');
})(typeof globalThis !== 'undefined' ? globalThis : this);
