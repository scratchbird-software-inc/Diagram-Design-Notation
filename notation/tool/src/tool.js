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

/* --- pure functions (unit tested in node) ---
 * B1-071: decomposed into cohesive UMD modules under notation/tool/src/ —
 * options (shared option tables), params (drawer/mode model), pagefit
 * (fit/DDN071 pre-validation), presentation (override CSS), files (entry/src
 * loading), export (raster/SVG/animation), bridge (render worker). Each is
 * inlined ahead of this file by tools/build-tool.js; in node they are
 * required. Nothing below changed behaviourally. */
const __req = (name, path) => (typeof module === 'object' && module.exports) ? require(path) : host[name];
const OPT = __req('DDNOptions', './options.js');
const PAR = __req('DDNToolParams', './params.js');
const PGF = __req('DDNToolPagefit', './pagefit.js');
const PRE = __req('DDNToolPresentation', './presentation.js');
const FIL = __req('DDNToolFiles', './files.js');
const EXP = __req('DDNToolExport', './export.js');
const BRG = __req('DDNToolBridge', './bridge.js');

const { DRAWERS, DRAWER_STATES, GEAR_STATES, STORAGE_KEY, MODES, DEFAULT_MODE, parseMode, parseDrawersParam, cleanDrawerConfig, parseToolbarParam, resolveDrawerConfig } = PAR;
const { computeFitScale, quantityPx, smallestRolePx, baseFontFloor, baseFontProblem, pageDims, pageScaleFloor, artboardProblem } = PGF;
const { slug, cssString, overrideRuleFor, typographyRuleFor, overrideCss, toolOverrides, overrideProfileWrites, cssOverlayRecord } = PRE;
const { pickEntryView, viewListFrom, isPlausibleSourceFile, freshLocalId, srcFromQuery, srcFetchErrorMessage, srcImportClosure, templateList, suggestFileName, aliasForFile, importLineFor, stableDiagnostic } = FIL;
const { rasterCanvasSize, exportSvgWithOverrides, hopWindowsFromMarkers, nextHopTime, scaledDuration } = EXP;
const { parseWorkerParam, workerDisabledReason, packMetrics, unpackMetrics, workerBridgeError, createRenderBridge } = BRG;
const { FONT_STACKS, ROUTING_VALUES, MIN_TEXT_PX, MAX_FILE_BYTES, MAX_RASTER_PX } = OPT;

const pure = {
  DRAWERS, DRAWER_STATES, GEAR_STATES, MODES, DEFAULT_MODE, STORAGE_KEY, parseMode, parseDrawersParam, cleanDrawerConfig, resolveDrawerConfig, parseToolbarParam,
  computeFitScale, overrideRuleFor, typographyRuleFor, overrideCss, toolOverrides, viewListFrom,
  overrideProfileWrites, cssOverlayRecord, pickEntryView,
  isPlausibleSourceFile, freshLocalId, rasterCanvasSize, srcFromQuery, srcFetchErrorMessage, srcImportClosure,
  templateList, suggestFileName, aliasForFile, importLineFor, stableDiagnostic,
  exportSvgWithOverrides, MAX_FILE_BYTES, MAX_RASTER_PX, FONT_STACKS, ROUTING_VALUES,
  MIN_TEXT_PX, quantityPx, smallestRolePx, baseFontFloor, baseFontProblem,
  pageDims, pageScaleFloor, artboardProblem,
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

const TEMPLATES = globalThis.DDN_TOOL_TEMPLATES || { blank: freshSource };
const BLANK_SKELETON = TEMPLATES.blank || freshSource;

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
  templatePopup: $('ddn-template-popup'), templateList: $('ddn-template-list'),
  fileInput: $('ddn-file-input'), folderInput: $('ddn-folder-input'),
  catalogue: $('ddn-catalogue'), catalogueSearch: $('ddn-catalogue-search'),
  fileList: $('ddn-file-list'), fileCount: $('ddn-file-count'),
  fileNew: $('ddn-file-new'), fileRename: $('ddn-file-rename'), fileDelete: $('ddn-file-delete'),
  downloadFile: $('ddn-download-file'), downloadZip: $('ddn-download-zip'), downloadJson: $('ddn-download-json'),
  paste: $('ddn-paste'), loadPaste: $('ddn-load-paste'),
  sourceFile: $('ddn-source-file'), source: $('ddn-source'), sourceError: $('ddn-source-error'),
  sourceTabs: $('ddn-source-tabs'), jumpDef: $('ddn-jump-def'),
  diagnostics: $('ddn-diagnostics'), diagnosticsCount: $('ddn-diagnostics-count'),
  apply: $('ddn-apply'), discard: $('ddn-discard'), liveApply: $('ddn-live-apply'), dirty: $('ddn-dirty'),
  undo: $('ddn-undo'), redo: $('ddn-redo'), find: $('ddn-find'), replace: $('ddn-replace'), goto: $('ddn-goto'),
  inspector: $('ddn-inspector'), inspectorControls: $('ddn-inspector-controls'), selectionSummary: $('ddn-selection-summary'),
  labelValue: $('ddn-label-value'), setLabel: $('ddn-set-label'), kindValue: $('ddn-kind-value'), setKind: $('ddn-set-kind'),
  iconCurrent: $('ddn-icon-current'), iconBrowse: $('ddn-icon-browse'), iconClear: $('ddn-icon-clear'),
  iconPopup: $('ddn-icon-popup'), iconSearch: $('ddn-icon-search'), iconList: $('ddn-icon-list'),
  posX: $('ddn-pos-x'), posY: $('ddn-pos-y'), pin: $('ddn-pin'), unpin: $('ddn-unpin'), hide: $('ddn-hide'),
  addField: $('ddn-add-field'), goSource: $('ddn-go-source'), deleteDef: $('ddn-delete-def'), duplicate: $('ddn-duplicate'),
  addElement: $('ddn-add-element'), addRelation: $('ddn-add-relation'),
  designBar: $('ddn-design-bar'), designHint: $('ddn-design-hint'), tidy: $('ddn-tidy'),
  paletteToggle: $('ddn-palette-toggle'), palettePopup: $('ddn-palette-popup'),
  paletteSearch: $('ddn-palette-search'), paletteList: $('ddn-palette-list'),
  connect: $('ddn-connect'), connectPopup: $('ddn-connect-popup'),
  connectSummary: $('ddn-connect-summary'), connectVerb: $('ddn-connect-verb'),
  connectName: $('ddn-connect-name'), connectCreate: $('ddn-connect-create'), connectCancel: $('ddn-connect-cancel'),
  exportSvg: $('ddn-export-svg'), exportPng: $('ddn-export-png'), exportWebp: $('ddn-export-webp'), saveExample: $('ddn-save-example'),
  exportMotion: $('ddn-export-motion'),
  animEmpty: $('ddn-anim-empty'), animControls: $('ddn-anim-controls'), animToggle: $('ddn-anim-toggle'),
  animStep: $('ddn-anim-step'), animSpeed: $('ddn-anim-speed'), animFlow: $('ddn-anim-flow'),
  animFlowField: $('ddn-anim-flow-field'), animStatus: $('ddn-anim-status')
};
const drawerEls = { files: $('ddn-drawer-files'), appearance: $('ddn-drawer-appearance'), source: $('ddn-drawer-source'), export: $('ddn-drawer-export'), animation: $('ddn-drawer-animation') };
const iconEls = { files: $('ddn-icon-files'), appearance: $('ddn-icon-appearance'), source: $('ddn-icon-source'), export: $('ddn-icon-export'), animation: $('ddn-icon-animation') };

function emptyPresentation() {
  return { options: {}, typography: {}, kindColours: {}, verbColours: {}, objectColours: {}, verbRouting: {}, relationRouting: {}, mindNodes: {} };
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
  // B1-051: the design bar exists only in design mode; per-render capability
  // gating (updateDesignBar) refines its buttons.
  els.designBar.hidden = !c.design;
  if (c.design) updateDesignBar();
  else cancelDesignGesture();
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
    attachMindmap();
    applyMindScroll();
    attachDesign();
    updateDesignBar();
    refreshAnimation();
    diagnosticsUI();
    status();
  });
  diagram.addEventListener('ddn-error', e => {
    els.diagramHost.classList.remove('ddn-rendering');
    if (els.busy) els.busy.hidden = true;
    els.diagramHost.removeAttribute('data-ddn-rendered');
    els.sourceError.textContent = e.detail.code + ': ' + e.detail.message;
    diagnosticsUI();
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
    if (design.placing || design.connecting) return; // an armed design gesture owns the stage
    if (e.target.closest && e.target.closest('.ddn-mind-resize')) return; // mind-map resize owns this drag (B1-100)
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

/* D5 (B1-052): geometry context for artboardProblem, from the last rendered
 * scene — unscaled drawing bounds plus fixed chrome overhead (page minus
 * drawing area). The title block re-wraps when the artboard narrows, so the
 * header share is recomputed at the proposed width when the text measurer is
 * reachable; otherwise the current header stands (renderer DDN071 backstop). */
function artboardContext(proposedW) {
  const d = state.diagram, scene = d && d.result && d.result.scene;
  if (!scene || !scene.drawingBounds || !scene.drawingArea) return null;
  const info = d.info || {}, pub = info.profiles && info.profiles.publication || {}, style = info.profiles && info.profiles.style || {};
  const opts = d.options || {};
  const chromeW = scene.width - scene.drawingArea.w;
  let chromeH = scene.height - scene.drawingArea.h;
  const titleOpt = opts.title && opts.title !== 'source' ? opts.title : (info.profiles && info.profiles.chrome && info.profiles.chrome.title);
  if (titleOpt !== 'off' && proposedW != null) {
    const T = host.__DDN_MODULE_REGISTRY__ && host.__DDN_MODULE_REGISTRY__.namespaces.DDNText;
    if (T) {
      const margin = quantityPx(pub.margin, 32);
      const extraNow = scene.drawingArea.y - (110 - 20); // headBlock 110 when the title block is on
      const font = style.font || 'sans';
      const title = pub.title || d._title || '';
      const titleLines = title ? T.wrap(title, Math.max(40, proposedW - 2 * margin), 24, font, 650).length : 1;
      const captionLines = pub.caption ? T.wrap(pub.caption, Math.max(40, proposedW - 2 * margin), 13, font, 400).length : 0;
      const extra = (titleLines - 1) * 28 + (captionLines ? captionLines * 18 + 8 : 0);
      chromeH += extra - extraNow;
    }
  }
  return {
    contentW: scene.drawingBounds.w, contentH: scene.drawingBounds.h, chromeW, chromeH,
    minTextPx: quantityPx(pub.minimum_text, MIN_TEXT_PX),
    baseFontPx: opts.fontSize != null ? opts.fontSize : quantityPx(style.font_size, 16),
    hasRelations: !!(scene.routes && scene.routes.length),
    embeddingScale: quantityPx(pub.embedding_scale, 1)
  };
}
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
    /* D5 (B1-052): an artboard the renderer must reject (DDN071 via fit-scale
     * text shrink) is caught here too, before any render starts — same idiom
     * as the base-font check: inputs return to the last committed values, the
     * message names the smallest usable artboard, the stage stays undimmed. */
    if (['page', 'width', 'height'].includes(key)) {
      const opts = state.presentation.options;
      const page = key === 'page' ? value : (opts.page == null ? 'source' : opts.page);
      const width = key === 'width' ? value : (opts.width != null ? opts.width : 1600);
      const height = key === 'height' ? value : (opts.height != null ? opts.height : 1000);
      const dims = page == null || page === 'source' ? null : pageDims(page, width, height);
      const problem = dims && artboardProblem(dims.w, dims.h, artboardContext(dims.w));
      if (problem) {
        for (const k of ['page', 'width', 'height']) {
          const committed = opts[k];
          const input = optionInputs[k];
          if (k === 'page') input.value = committed == null ? 'source' : String(committed);
          else input.value = committed == null ? (k === 'width' ? '1600' : '1000') : String(committed);
        }
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
  const xi = node && node.properties && node.properties.x_icon;
  els.iconCurrent.textContent = xi ? xi.library + '/' + xi.icon : 'none';
  for (const b of [els.iconBrowse, els.iconClear]) b.disabled = !node;
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
/* DDN 0.8 (ch. 55 §S5): duplicate mints a NEW uid (<id>_copy, then _copy2, …)
 * — the copy starts unconnected, its numeral field empty, and ref: anchors
 * keep pointing at the original. A move (drag / cut+paste in source) never
 * mints: it edits placement only, so the uid is preserved by construction. */
els.duplicate.addEventListener('click', () => guard(() => {
  if (!state.selected) { status('select an element to duplicate'); return; }
  guided(() => {
    A.authoring.duplicate(state.ws, state.entry, state.view, state.selected);
    const after = state.ws.resolve(state.entry, state.view);
    const copy = after.elements.map(n => n.id).filter(u => /_copy\d*$/.test(u)).sort().at(-1);
    if (copy) { state.selected = copy; state.selectedRelation = null; }
    status('duplicated as ' + (copy || 'a new uid') + ' — new identity, unconnected; ref: anchors still point at the original');
  });
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
    if (design.placing || design.connecting) return; // an armed design gesture owns the stage
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
/* Mind-map entity interactions (B1-100): wheel over a note-heavy entity pans
 * its body rows inside the clip window (DOM pan, no re-render); dragging the
 * lower-right handle changes the entity's window cap through the mindNodes
 * presentation channel (re-render, presentation-only — source untouched). */
function attachMindmap() {
  const stage = stageEl();
  if (!stage || stage.dataset.toolMind) return;
  stage.dataset.toolMind = 'true';
  state.mindScroll = state.mindScroll || {};
  stage.addEventListener('wheel', e => {
    const rows = e.target.closest && e.target.closest('.ddn-mind-rows');
    if (!rows) return;
    const total = Number(rows.dataset.total), cap = Number(rows.dataset.cap);
    if (!(total > cap)) return;
    const id = rows.dataset.node;
    state.mindScroll[id] = Math.max(0, Math.min(total - cap, (state.mindScroll[id] || 0) + (e.deltaY > 0 ? 1 : -1)));
    applyMindScroll(stage);
    e.preventDefault(); e.stopPropagation();
  }, { passive: false });
  let rez = null;
  stage.addEventListener('pointerdown', e => {
    const handle = e.target.closest && e.target.closest('.ddn-mind-resize');
    if (!handle || e.button !== 0) return;
    const rows = stage.querySelector('.ddn-mind-rows[data-node="' + CSS.escape(handle.dataset.node) + '"]');
    if (!rows) return;
    rez = { id: handle.dataset.node, y0: e.clientY, cap0: Number(rows.dataset.cap), rowH: Number(rows.dataset.rowH) };
    if (stage.setPointerCapture) try { stage.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault(); e.stopPropagation();
  });
  stage.addEventListener('pointerup', e => {
    if (!rez) return;
    const d = rez; rez = null;
    const newCap = Math.max(1, Math.min(50, d.cap0 + Math.round((e.clientY - d.y0) / d.rowH)));
    if (newCap === d.cap0) return;
    state.presentation.mindNodes[d.id] = { lines: newCap };
    delete state.mindScroll[d.id];
    rerender();
    status('mind-map entity window: ' + newCap + ' line' + (newCap === 1 ? '' : 's') + ' (presentation only — source unchanged)');
  });
  stage.addEventListener('pointercancel', () => { rez = null; });
}
function applyMindScroll(stage) {
  const st = stage || stageEl();
  if (!st || !state.mindScroll) return;
  for (const [id, offset] of Object.entries(state.mindScroll)) {
    const rows = st.querySelector('.ddn-mind-rows[data-node="' + CSS.escape(id) + '"]');
    if (!rows) continue;
    const total = Number(rows.dataset.total), cap = Number(rows.dataset.cap), rowH = Number(rows.dataset.rowH);
    if (!(total > cap)) continue;
    const off = Math.max(0, Math.min(total - cap, offset));
    state.mindScroll[id] = off;
    rows.setAttribute('transform', 'translate(0 ' + (-off * rowH) + ')');
    const sc = st.querySelector('.ddn-mind-scroll[data-node="' + CSS.escape(id) + '"]');
    if (sc) {
      const thumb = sc.querySelector('.ddn-mind-scroll-thumb');
      const trackY = Number(sc.dataset.trackY), trackH = Number(sc.dataset.trackH), thumbH = Number(thumb.getAttribute('height'));
      thumb.setAttribute('y', trackY + (trackH - thumbH) * off / (total - cap));
    }
  }
}
els.dragMode.addEventListener('change', () => {
  if (els.dragMode.checked && state.diagram && state.diagram.capabilities && (state.diagram.capabilities.sequence || state.diagram.capabilities.graphControls === false)) {
    els.dragMode.checked = false;
    status('drag-to-pin is unavailable in this projection');
  }
});

/* ------------------------------------------------ B1-051 design mode (D1/D2)
 * The designer is the viewer with more functionality: in ?mode=design the
 * design bar appears with the two creation gestures the old prototype had and
 * the unified tool lacked —
 *   · click-to-place: pick an object kind from the palette (plate glyphs from
 *     DDNLive.glyphs, the same iconography as the notation plates), then click
 *     on the diagram — the element is created at that spot and pinned there;
 *   · connect: click a source element, click a target element, pick a verb —
 *     one relation is created between them.
 * Both gestures are thin drivers over DDNLive.authoring (addElement / pin /
 * addRelation), so every creation is one undoable source edit, exactly like an
 * inspector edit. Esc cancels an armed gesture. */
const design = { placing: null, connecting: false, from: null, to: null };

function graphEditable() {
  const caps = state.diagram && state.diagram.capabilities;
  return !!(state.diagram && state.diagram.result && caps && !caps.sequence && caps.graphControls !== false);
}
function designHint(text) { els.designHint.textContent = text || 'Palette: pick a kind, click on the diagram to place it. Connect: click source, then target.'; }
function cancelDesignGesture() {
  design.placing = null; design.connecting = false; design.from = null; design.to = null;
  els.paletteToggle.classList.remove('active');
  els.connect.classList.remove('active');
  els.palettePopup.hidden = true; els.connectPopup.hidden = true;
  designHint();
}
function armPlacement(kind) {
  cancelDesignGesture();
  design.placing = kind;
  els.paletteToggle.classList.add('active');
  const label = (A.kinds.find(k => k.id === kind) || {}).label || kind;
  designHint('Placing “' + label + '” — click on the diagram to drop it there (Esc cancels).');
  status('click-to-place armed: ' + kind);
}
function armConnect() {
  cancelDesignGesture();
  design.connecting = true;
  els.connect.classList.add('active');
  designHint('Connect: click the SOURCE element (Esc cancels).');
}
els.paletteToggle.addEventListener('click', () => {
  if (design.placing) { cancelDesignGesture(); return; }
  buildPalette();
  els.palettePopup.hidden = !els.palettePopup.hidden;
  els.connectPopup.hidden = true;
  if (!els.palettePopup.hidden) els.paletteSearch.focus();
});
els.connect.addEventListener('click', () => { if (design.connecting) cancelDesignGesture(); else armConnect(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && (design.placing || design.connecting || !els.palettePopup.hidden)) cancelDesignGesture(); });

/* Palette: every installed kind with its plate glyph (DDNLive.glyphs.forKind —
 * the 24×24 stroke icons of the notation plates). */
function buildPalette() {
  const q = els.paletteSearch.value.trim().toLowerCase();
  const kinds = A.kinds.filter(k => !q || (k.id + ' ' + k.label + ' ' + k.code).toLowerCase().includes(q));
  els.paletteList.replaceChildren(...kinds.map(k => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ddn-palette-item';
    b.title = 'Place a ' + k.label + ' (' + k.id + ') — then click on the diagram';
    const g = A.glyphs && A.glyphs.forKind(k.id);
    const icon = document.createElement('span'); icon.className = 'ddn-palette-glyph'; icon.setAttribute('aria-hidden', 'true');
    if (g) { icon.innerHTML = '<svg viewBox="' + g.viewBox + '">' + g.svg + '</svg>'; } else icon.textContent = k.code;
    const lab = document.createElement('span'); lab.textContent = k.label;
    b.append(icon, lab);
    b.addEventListener('click', () => armPlacement(k.id));
    return b;
  }));
  if (!kinds.length) els.paletteList.append(dim('no kind matches “' + els.paletteSearch.value + '”'));
}
/* Icon picker (B1-end-user icons): browse every shipped and host-registered
 * icon pack and bind an icon to the selected node via x_icon — a real model
 * property, so it is persisted in source like any other inspector edit. */
function allIcons() {
  const libs = (A.iconLibraries ? A.iconLibraries() : []).concat(A.hostIconPacks ? A.hostIconPacks() : []);
  const out = [];
  for (const lib of libs) for (const ic of lib.icons || []) out.push({ library: lib.id, icon: ic.id, name: ic.name, svg: ic.svg });
  return out;
}
function buildIconPicker() {
  const q = els.iconSearch.value.trim().toLowerCase();
  const icons = allIcons().filter(i => !q || (i.icon + ' ' + i.name + ' ' + i.library).toLowerCase().includes(q));
  els.iconList.replaceChildren(...icons.slice(0, 200).map(i => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ddn-icon-pick';
    b.title = i.name + ' (' + i.library + '/' + i.icon + ')';
    b.innerHTML = i.svg + '<span>' + i.name + '</span>';
    b.setAttribute('data-icon', i.library + '/' + i.icon);
    b.addEventListener('click', () => {
      if (!state.selected) return;
      guard(() => {
        flush();
        A.authoring.setProperty(state.ws, state.entry, state.view, state.selected, 'x_icon', { library: i.library, icon: i.icon });
        els.iconPopup.hidden = true;
        showSource(state.currentFile);
        inspector(state.selected, state.ws.resolve(state.entry, state.view), null);
        status('icon ' + i.library + '/' + i.icon + ' set on the selected occurrence');
      });
    });
    return b;
  }));
  if (!icons.length) els.iconList.append(dim('no icon matches “' + els.iconSearch.value + '”'));
  if (icons.length > 200) els.iconList.append(dim((icons.length - 200) + ' more — refine the search'));
}
els.iconBrowse.addEventListener('click', () => {
  if (!state.selected) { status('select an object first'); return; }
  buildIconPicker();
  els.iconPopup.hidden = !els.iconPopup.hidden;
  if (!els.iconPopup.hidden) els.iconSearch.focus();
});
els.iconSearch.addEventListener('input', buildIconPicker);
els.iconClear.addEventListener('click', () => {
  if (!state.selected) return;
  guard(() => {
    flush();
    A.authoring.setProperty(state.ws, state.entry, state.view, state.selected, 'x_icon', undefined);
    showSource(state.currentFile);
    inspector(state.selected, state.ws.resolve(state.entry, state.view), null);
    status('icon cleared from the selected occurrence');
  });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !els.iconPopup.hidden) els.iconPopup.hidden = true; });
els.paletteSearch.addEventListener('input', buildPalette);

/* World-coordinates of a stage pointer event (same drawing-group inverse CTM
 * as drag-to-pin), or null when the event is outside the rendered drawing. */
function stageWorldPoint(e) {
  const svg = svgEl();
  const drawing = svg && svg.querySelector('g[id$="drawing"]');
  const inv = drawing && drawing.getScreenCTM() && drawing.getScreenCTM().inverse();
  if (!inv) return null;
  return new DOMPoint(e.clientX, e.clientY).matrixTransform(inv);
}
function nodeIdAt(e) {
  const el = e.target && e.target.closest && e.target.closest('.ddn-node[data-id]');
  if (!el) return null;
  const g = state.diagram && state.diagram.result && state.diagram.result.scene.nodes && state.diagram.result.scene.nodes.find(n => n.id === el.dataset.id);
  return g ? g.id : null;
}

/* Click-to-place: create the element at the clicked spot and pin it there —
 * one guided source edit; the new element stays selected for renaming. */
function placeElement(kind, x, y) {
  guard(() => {
    flush();
    const ir = state.ws.resolve(state.entry, state.view);
    const id = freshLocalId(ir.elements.map(n2 => n2.id), kind);
    const label = (A.kinds.find(k => k.id === kind) || {}).label || kind;
    guided(() => {
      A.authoring.addElement(state.ws, state.entry, state.view, { id, name: 'New ' + label.toLowerCase(), kind });
      const after = state.ws.resolve(state.entry, state.view);
      const uid = after.elements.map(n2 => n2.id).find(u => u === id || u.endsWith('.' + id)) || id;
      if (Number.isFinite(x) && Number.isFinite(y) && graphEditable())
        A.authoring.pin(state.ws, state.entry, state.view, uid, x, y);
      state.selected = uid;
      state.selectedRelation = null;
      status('placed ' + uid + (Number.isFinite(x) ? ' at ' + Math.round(x) + ',' + Math.round(y) : '') + ' — rename it in the inspector');
    });
  });
}

/* Connect: create one relation between two clicked elements. */
function connectElements(from, to, kind, name) {
  guard(() => {
    flush();
    const ir = state.ws.resolve(state.entry, state.view);
    const id = freshLocalId(ir.relations.map(r => r.id), 'relation');
    const label = (A.relations.find(r => r.id === kind) || {}).label || kind;
    guided(() => {
      A.authoring.addRelation(state.ws, state.entry, state.view, { id, name: name || label, kind, from, to });
      const after = state.ws.resolve(state.entry, state.view);
      state.selectedRelation = after.relations.map(r => r.id).find(u => u === id || u.endsWith('.' + id)) || id;
      state.selected = null;
      status('connected ' + from + ' → ' + to + ' (' + kind + ') — relation ' + state.selectedRelation);
    });
  });
}
els.connectVerb.replaceChildren(...A.relations.map(r => new Option(r.label + ' (' + r.id + ')', r.id)));
els.connectVerb.value = 'assoc';
els.connectCreate.addEventListener('click', () => {
  const from = design.from, to = design.to, kind = els.connectVerb.value, name = els.connectName.value.trim();
  els.connectPopup.hidden = true;
  const keepConnecting = design.connecting;
  cancelDesignGesture();
  if (keepConnecting) armConnect(); // chain more connections without re-clicking the tool
  connectElements(from, to, kind, name);
});
els.connectCancel.addEventListener('click', () => cancelDesignGesture());

/* Design gesture clicks intercept the stage in the CAPTURE phase, ahead of the
 * component's own select/pan handlers, and are consumed (no selection, no pan)
 * until the gesture completes or Esc cancels. */
function attachDesign() {
  const stage = stageEl();
  if (!stage || stage.dataset.toolDesign) return;
  stage.dataset.toolDesign = 'true';
  stage.addEventListener('click', e => {
    if (!design.placing && !design.connecting) return;
    e.stopPropagation(); e.preventDefault();
    if (design.placing) {
      const p = stageWorldPoint(e);
      const kind = design.placing;
      cancelDesignGesture();
      if (!p) { status('click inside the diagram to place the element'); return; }
      placeElement(kind, p.x, p.y);
      return;
    }
    const id = nodeIdAt(e);
    if (!id) { designHint('Connect: click an ELEMENT — that click was empty canvas.'); return; }
    if (!design.from) { design.from = id; designHint('Connect: source is ' + id + ' — now click the TARGET (Esc cancels).'); return; }
    if (id === design.from) { designHint('Connect: target must differ from the source (' + id + ').'); return; }
    design.to = id;
    els.connectSummary.textContent = design.from + ' → ' + design.to;
    els.connectName.value = '';
    els.connectPopup.hidden = false;
  }, true);
  /* An armed gesture also owns pointer drags: suppress pan and drag-to-pin. */
  stage.addEventListener('pointerdown', e => { if (design.placing || design.connecting) e.stopPropagation(); }, true);
}

/* Per-render gating: creation gestures need a graph projection (the same rule
 * as drag-to-pin); on data-bound projections the buttons explain themselves. */
function updateDesignBar() {
  els.designBar.hidden = !state.config.design;
  if (!state.config.design) return;
  const ok = graphEditable();
  els.paletteToggle.disabled = !ok;
  els.connect.disabled = !ok;
  els.tidy.disabled = !ok;
  els.paletteToggle.title = ok ? 'Add element — pick a kind, then click on the diagram to place it' : 'Element placement needs a graph projection — this view is data-bound';
  els.connect.title = ok ? 'Connect two elements — click source, click target, pick a verb' : 'Connecting needs a graph projection — this view is data-bound';
  els.tidy.title = ok ? 'Tidy — re-run placement and routing; authored pins keep their positions' : 'Tidy needs a graph projection — this view is data-bound';
  if (!ok && (design.placing || design.connecting)) cancelDesignGesture();
}

/* DDN 0.8 (ch. 57 §D5) Tidy: re-runs placement and routing on the active view
 * with all authored pins respected (the runtime's normal render honours them;
 * endpoint_ordering, route policies and geometry checks are never relaxed).
 * Source is untouched unless the user confirms "pin result" — then the
 * computed positions of the FREE elements are written as place pins in one
 * undoable transaction; authored pins are never rewritten. */
function tidy() {
  const d = state.diagram;
  if (!d || !d.result) throw new Error('nothing rendered yet');
  flush();
  /* Same semantics as the component's "Auto-layout now": drop retained layout
   * state, re-enable automatic placement — authored pins are honoured by the
   * runtime's normal render. */
  d.action('relayout');
  return d.ready.then(() => {
    const scene = d.result && d.result.scene;
    const nodes = (scene && scene.nodes) || [];
    const pinned = new Set((scene && scene.layout && scene.layout.pinned) || []);
    const free = nodes.filter(n => !pinned.has(n.id));
    status('tidied — ' + pinned.size + ' pin(s) kept exactly, ' + free.length + ' free element(s) re-placed; routes recomputed');
    if (!free.length || !graphEditable()) return;
    if (!confirm('Pin result? Write the computed positions of the ' + free.length + ' unpinned element(s) as place pins in the source (one undoable edit). Cancel keeps the new layout as session state only.')) return;
    guard(() => {
      const positions = {};
      for (const n of free) positions[n.id] = { x: n.x, y: n.y };
      A.authoring.pinAll(state.ws, state.entry, state.view, positions);
      showSource(state.currentFile);
      updateHistory();
      status('pin result written for ' + free.length + ' element(s) — undo restores the previous source');
    });
  }, () => {});
}
els.tidy.addEventListener('click', () => guard(() => tidy()));

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
  /* DDN 0.8 (ch. 57 §D3): multi-pane editing — one editor tab per workspace
   * file; the tab set mirrors the entry's import closure plus added files. */
  els.sourceTabs.replaceChildren(...Object.keys(fs).sort().map(n => {
    const b = document.createElement('button');
    b.type = 'button'; b.role = 'tab';
    b.textContent = n; b.title = n;
    b.className = n === state.currentFile ? 'selected' : '';
    b.setAttribute('aria-selected', String(n === state.currentFile));
    b.addEventListener('click', () => guard(() => showSource(n)));
    return b;
  }));
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
  diagnosticsUI();
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
  gotoLine(n);
});
function gotoLine(n) {
  const t = els.source, lines = t.value.split('\n'), at = lines.slice(0, n - 1).reduce((x, l) => x + l.length + 1, 0);
  t.focus();
  t.setSelectionRange(Math.min(at, t.value.length), Math.min(at, t.value.length));
  t.scrollTop = Math.max(0, (n - 4) * 19);
}

/* DDN 0.8 (ch. 57 §D3) jump-to-definition: the @ref under the cursor resolves
 * to its declaring file:line through the workspace (never to a network URL). */
els.jumpDef.addEventListener('click', () => guard(() => {
  flush();
  const target = A.authoring.definitionAt(state.ws, state.entry, state.view, state.currentFile, els.source.selectionStart);
  if (!target) { status('no resolvable @ref at the cursor — place it on an @reference'); return; }
  showSource(target.file, { start: target.start, end: target.end });
  status('definition of ' + target.id + ' — ' + target.file + ':' + target.start);
}));

/* DDN 0.8 (ch. 57 §D3 + ch. 56 §X4) diagnostics list: every check diagnostic
 * in the stable JSON shape {code, severity, file?, line?, view?, message},
 * regenerated on each check (never accumulated); clicking navigates to
 * file:line. Sources: per-file parse of the current workspace text plus the
 * last render's diagnostic stream for the active view. */
function collectDiagnostics() {
  const files = state.ws ? state.ws.getFiles() : {};
  const out = [];
  for (const [name, text] of Object.entries(files)) {
    try { A.parse(text, name); }
    catch (e) { out.push(stableDiagnostic({ code: e && e.code, message: e && e.message || String(e), file: name, offset: e && (e.offset !== undefined ? e.offset : e.start) }, files)); }
  }
  const result = state.diagram && state.diagram.result;
  for (const d of (result && result.diagnostics) || []) out.push(stableDiagnostic(d, files, state.view));
  return out;
}
function diagnosticsUI() {
  const list = collectDiagnostics();
  const rank = { error: 0, warning: 1, info: 2 };
  list.sort((a, b) => (rank[a.severity] !== undefined ? rank[a.severity] : 0) - (rank[b.severity] !== undefined ? rank[b.severity] : 0) || String(a.file || '').localeCompare(String(b.file || '')) || (a.line || 0) - (b.line || 0));
  const errors = list.filter(d => d.severity === 'error').length;
  els.diagnosticsCount.textContent = list.length ? '(' + list.length + (errors ? ', ' + errors + ' error' + (errors === 1 ? '' : 's') : '') + ')' : '(clean)';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'none';
    li.textContent = 'No diagnostics — source parses and the active view rendered.';
    els.diagnostics.replaceChildren(li);
    return;
  }
  els.diagnostics.replaceChildren(...list.map(d => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button';
    b.className = 'sev-' + d.severity;
    const site = d.file ? ' ' + d.file + (d.line ? ':' + d.line : '') : '';
    b.textContent = d.severity.toUpperCase() + ' ' + d.code + site + ' — ' + d.message;
    b.title = JSON.stringify(d);
    b.addEventListener('click', () => guard(() => {
      if (!d.file || !state.ws || !Object.prototype.hasOwnProperty.call(state.ws.getFiles(), d.file)) return;
      showSource(d.file);
      if (d.line) gotoLine(d.line);
    }));
    li.append(b);
    return li;
  }));
}

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
  unsubscribe = state.ws.subscribe(() => { filesUI(); updateHistory(); emitSourceChange(); });
  entriesUI(view);
  filesUI();
  showSource(Object.prototype.hasOwnProperty.call(files, state.entry) ? state.entry : Object.keys(files)[0]);
  els.inspectorControls.hidden = true;
  els.selectionSummary.textContent = 'Click an object or relation in the diagram.';
  restoreToolPresentation();
  mount();
  updateHistory();
  repopulateOverridePanels();
  emitSourceChange();
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
/* DDN 0.8 (ch. 57 §D2): explicit "New document" — always visible; the document
 * starts EMPTY (a valid .ddn skeleton) or from a template keyed to the
 * registered view kinds (chapter 52). Templates are content files inlined at
 * build time; after creation the document is ordinary .ddn. */
function templatePickerUI() {
  const viewKinds = A.viewProfiles && A.viewProfiles.VIEW_KINDS;
  els.templateList.replaceChildren(...templateList(TEMPLATES, viewKinds).map(t => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t.label;
    b.setAttribute('role', 'option');
    b.addEventListener('click', () => guard(() => {
      els.templatePopup.hidden = true;
      if (dirty() && !confirm('Replace current workspace? Download unsaved changes first.')) return;
      state.catalogueIndex = -1;
      load({ 'main.ddn': TEMPLATES[t.id] }, 'main.ddn', 'main');
      status('new document from template "' + t.id + '" — ordinary .ddn from here on');
    }));
    return b;
  }));
}
els.newProject.addEventListener('click', () => {
  templatePickerUI();
  els.templatePopup.hidden = !els.templatePopup.hidden;
});
/* DDN 0.8 (ch. 57 §D3): add-file defaults follow the workspace naming
 * conventions (chapter 56 §X3) — a kebab-case .ddn sibling of the importing
 * file — and the tool offers to insert the matching `import "…" as …;` line
 * rather than leaving a dangling file. */
els.fileNew.addEventListener('click', () => guard(() => {
  const existing = state.ws.getFiles();
  const path = prompt('Workspace-relative filename (kebab-case .ddn)', suggestFileName(state.currentFile, existing));
  if (!path) return;
  A.pathChecked(path);
  if (!/^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*\.ddn$/.test(path))
    throw new Error('Naming convention: kebab-case .ddn path (got ' + path + ')');
  if (Object.prototype.hasOwnProperty.call(existing, path)) throw new Error('File exists.');
  const m = 'user.' + path.replace(/\.ddn$/i, '').replace(/[^A-Za-z0-9]/g, '_');
  state.ws.updateFiles({ [path]: 'ddn "0.6";\nmodule "' + m + '";\n\ndata model {\n    // Add definitions here.\n}\n' });
  /* Offer the matching import line in the current file (the importer). */
  const importer = state.currentFile, line = importLineFor(importer, path);
  if (line && importer !== path && confirm('Insert `' + line + '` into ' + importer + ' so the new file joins the workspace?')) {
    const text = state.ws.getFiles()[importer];
    const headerEnd = text.indexOf('\n', text.indexOf('module '));
    const at = headerEnd > 0 ? headerEnd + 1 : 0;
    state.ws.applyEdits([{ file: importer, start: at, end: at, text: line + '\n' }], { expectedRevision: state.ws.revision });
  }
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

/* ------------------------------------------------ B1-050 host I/O contract
 * setSource / getSource / onSourceChange — the documented in/out API for host
 * pages (embedding.md "Passing DDN in and out"). */

function toolError(code, msg) { const e = new Error(msg); e.code = code; return e; }
function coded(e) { return e && e.code ? e : toolError('DDN-T100', e && e.message || String(e)); }

/* D3: change notification. Fires (debounced SOURCE_NOTIFY_DEBOUNCE_MS after
 * the last source-affecting action, same idiom as live-apply) with
 * { revision, files, entry, view } after every workspace commit (source-drawer
 * apply/live-apply, inspector edit, drag-pin, undo/redo, file new/rename/
 * delete) and after every load/setSource. There is no implicit "session end"
 * event — the host keeps the latest payload or calls getSource itself. */
const sourceListeners = new Set();
const SOURCE_NOTIFY_DEBOUNCE_MS = 200;
let sourceNotifyTimer = null;
function emitSourceChange() {
  clearTimeout(sourceNotifyTimer);
  if (!sourceListeners.size) return;
  sourceNotifyTimer = setTimeout(() => {
    if (!state.ws) return;
    const payload = { revision: state.ws.revision, files: state.ws.getFiles(), entry: state.entry, view: state.view };
    for (const cb of [...sourceListeners]) { try { cb(payload); } catch (e) { console.error('DDNTool onSourceChange listener:', e); } }
  }, SOURCE_NOTIFY_DEBOUNCE_MS);
}
function onSourceChange(cb) {
  if (typeof cb !== 'function') throw toolError('DDN-T108', 'onSourceChange needs a callback function');
  sourceListeners.add(cb);
  return () => sourceListeners.delete(cb);
}
function offSourceChange(cb) { sourceListeners.delete(cb); }

/* x_tool_presentation restore: sources written by
 * getSource({includeAppearance:true}) carry the CSS-overlay presentation as a
 * view extension record; loading re-applies it so the round trip is
 * appearance-identical, not just layout-identical. */
function restoreToolPresentation() {
  try {
    const files = state.ws && state.ws.getFiles();
    if (!files || !Object.prototype.hasOwnProperty.call(files, state.entry)) return;
    const v = A.parse(files[state.entry], state.entry).declarations.find(n => n.type === 'view' && n.id === state.view);
    const rec = v && v.props && v.props.x_tool_presentation;
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return;
    for (const k of ['kindColours', 'verbColours', 'objectColours', 'typography'])
      if (rec[k] && typeof rec[k] === 'object' && !Array.isArray(rec[k])) state.presentation[k] = JSON.parse(JSON.stringify(rec[k]));
  } catch { /* overlay restore is best-effort; a broken record never blocks a load */ }
}

/* D1 — IN. Accepts a single-file source string or a { "name.ddn": text } map;
 * replaces the current workspace and resolves after the first render with
 * { revision, entry, view }. Failures reject with a coded error (LIVE010/011
 * for the map contract, DDN-T1xx for entry/view problems, the parser/builder
 * codes for broken source). Works in every mode, worker on or off. */
function setSource(source, opts) {
  let files, pick;
  try {
    if (typeof source === 'string') files = { 'main.ddn': source };
    else files = source;
    A.filesChecked(files);
    pick = pickEntryView(files, opts, (t, n) => A.parse(t, n));
  } catch (e) { return Promise.reject(coded(e)); }
  state.catalogueIndex = -1;
  try { load(files, pick.entry, pick.view); } catch (e) { return Promise.reject(coded(e)); }
  const d = state.diagram;
  if (!d) return Promise.reject(toolError('DDN-T105', 'setSource: source loaded but no view is mounted'));
  return d.ready.then(
    () => ({ revision: state.ws.revision, entry: state.entry, view: state.view }),
    e => Promise.reject(coded(e)));
}

/* D2 — OUT. Default: { files, entry, view, revision } — the current source of
 * truth, feeding straight back into setSource. opts.single flattens a
 * single-file workspace to a string (coded error on multi-file).
 * opts.includeAppearance first serializes the current presentation into the
 * current view's source through authoring.setViewProfile — the same canonical
 * serializer every save path uses — so the returned source re-renders
 * byte-identically with no overrides applied. */
function getSource(opts) {
  opts = opts || {};
  if (!state.ws) throw toolError('DDN-T106', 'getSource: no source loaded');
  flush();
  if (opts.includeAppearance) {
    if (!state.entry || !state.view) throw toolError('DDN-T106', 'getSource({ includeAppearance: true }) needs a mounted view');
    const writes = overrideProfileWrites(toolOverrides(state.presentation));
    /* Verb-keyed routing expands to one route member per visible relation of
     * that kind (apply() semantics); unknown keys are dropped, never fatal. */
    let ir = null;
    try { ir = state.ws.resolve(state.entry, state.view); } catch { ir = null; }
    const routes = {};
    if (ir) {
      const byId = new Set(ir.relations.map(r => r.id));
      for (const [key, hint] of Object.entries(writes.routes)) {
        if (byId.has(key)) { routes[key] = hint; continue; }
        for (const r of ir.relations) if (r.kind === key) routes[r.id] = hint;
      }
    }
    A.authoring.setViewProfile(state.ws, state.entry, state.view, writes.groups,
      { routes, presentation: cssOverlayRecord(state.presentation) });
    showSource(state.currentFile);
    updateHistory();
    status('appearance serialized into ' + state.entry + ' view "' + state.view + '"');
  }
  const files = state.ws.getFiles();
  if (opts.single) {
    const names = Object.keys(files);
    if (names.length !== 1)
      throw toolError('DDN-T107', 'getSource({ single: true }) needs a single-file workspace; this one has ' + names.length + ' files (' + names.join(', ') + ') — take the files map instead');
    return files[names[0]];
  }
  return { files, entry: state.entry, view: state.view, revision: state.ws.revision };
}

/* ------------------------------------------------ deep links + boot */

function loadFromSrc(src) {
  status('loading ' + src + ' …');
  srcImportClosure(src, host.location.href,
    url => fetch(url),
    (text, name) => {
        const ast = A.parse(text, name), out = ast.imports.map(imp => imp.path);
        /* B1-090: architecture bases and x_link files join the fetch closure. */
        const walk = n => {
          if (n.type === 'architecture') for (const f of (n.props && n.props.files) || []) out.push(f);
          if (n.props && n.props.x_link && n.props.x_link.file) out.push(n.props.x_link.file);
          for (const c of n.children || []) walk(c);
        };
        for (const sec of ast.sections || []) for (const d of sec.declarations || []) walk(d);
        return out;
      },
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
  // B1-051 (D1): design mode arms drag-to-pin by default (still toggleable).
  els.dragMode.checked = state.config.design === true;
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
        (text, name) => {
        const ast = A.parse(text, name), out = ast.imports.map(imp => imp.path);
        /* B1-090: architecture bases and x_link files join the fetch closure. */
        const walk = n => {
          if (n.type === 'architecture') for (const f of (n.props && n.props.files) || []) out.push(f);
          if (n.props && n.props.x_link && n.props.x_link.file) out.push(n.props.x_link.file);
          for (const c of n.children || []) walk(c);
        };
        for (const sec of ast.sections || []) for (const d of sec.declarations || []) walk(d);
        return out;
      },
        (name, p) => A.resolvePath(name, p))
        .then(({ files, entryName }) => load(files, entryName, view || undefined))
        .catch(e => fail(srcFetchErrorMessage(e, host.location && host.location.protocol, entry)));
      booted = true;
    }
  }
  if (!booted) {
    /* DDN 0.8 (ch. 57 §D2): the designer starts EMPTY — a valid blank .ddn
     * skeleton — unless it was passed a .ddn to open (?src=/?entry= handled
     * above). Viewer mode keeps the catalogue landing example. */
    if (state.config.design === true) {
      state.catalogueIndex = -1;
      load({ 'main.ddn': BLANK_SKELETON }, 'main.ddn', 'main');
    } else {
      let initial = DATA.catalogue.entries.findIndex(e => e.entry.endsWith('adaptive-lab.ddn') && e.view === 'automatic');
      if (initial < 0) initial = 0;
      if (DATA.catalogue.entries.length) { state.catalogueIndex = initial; const ex = DATA.catalogue.entries[initial]; guard(() => load(catalogueClosure(ex.entry), ex.entry, ex.view)); }
      else load({ 'main.ddn': freshSource }, 'main.ddn', 'overview');
    }
  }
  catalogueUI();
}

/* Documented test/integration surface; mirrors host.DDNViewer (D7). */
host.DDNTool = Object.assign({}, pure, {
  loadFiles: (files, entry, view) => load(files, entry, view),
  setSource, getSource, onSourceChange, offSourceChange,
  SOURCE_NOTIFY_DEBOUNCE_MS,
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
  /* B1-051 design-mode surface (D1/D2): the programmatic counterparts of the
   * design-bar gestures, for hosts and tests. */
  startPlacement: armPlacement, startConnect: armConnect, cancelDesignGesture,
  placeElement, connectElements,
  getDesignGesture: () => ({ placing: design.placing, connecting: design.connecting, from: design.from, to: design.to }),
  updateDesignBar,
  /* 0.8 (ch. 57 §D2/D3/D5): tidy re-layout, the diagnostics list data, and the
   * new-document template sources — programmatic counterparts for hosts/tests. */
  tidy, collectDiagnostics, templates: () => ({ ...TEMPLATES }),
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
