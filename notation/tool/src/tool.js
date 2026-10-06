/* SPDX-License-Identifier: GPL-2.0-or-later. B1-027 unified DDN diagram tool.
 * One page replacing the end-user viewer (B1-007), the studio gallery and the
 * studio editor: a diagram stage with pan/zoom, an icon toolbar, and pop-in
 * drawers (style & layout right, document right, inspector right, source
 * bottom, type sheet bottom, files left, export right, animation right) whose
 * open/closed/none/api
 * state is configurable per drawer via ?drawers=, a settings popup persisted to
 * localStorage, and ?mode= presets (D2-D4). The three right-side working
 * drawers (document, style, inspector) are exclusive — opening one closes the
 * others — and follow the selection: selecting an element or relation opens
 * the Inspector drawer, deselecting (empty-canvas click / Escape) opens the
 * Document drawer. Phase 4: the Inspector Details tab and the source-backed
 * Style & Layout groups render through the descriptor-driven form generator
 * (forms.js + DDN_FORM_DESCRIPTORS).
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
const INSP = __req('DDNToolInspector', './inspector.js');
const FRM = __req('DDNToolForms', './forms.js');
const SHT = __req('DDNToolSheets', './sheets.js');

const { DRAWERS, DRAWER_STATES, GEAR_STATES, STORAGE_KEY, MODES, DEFAULT_MODE, parseMode, parseDrawersParam, cleanDrawerConfig, parseToolbarParam, resolveDrawerConfig } = PAR;
const { computeFitScale, quantityPx, smallestRolePx, baseFontFloor, baseFontProblem, pageDims, pageScaleFloor, artboardProblem } = PGF;
const { slug, cssString, overrideRuleFor, typographyRuleFor, overrideCss, toolOverrides, overrideProfileWrites, cssOverlayRecord } = PRE;
const { pickEntryView, viewListFrom, isPlausibleSourceFile, freshLocalId, srcFromQuery, srcFetchErrorMessage, srcImportClosure, templateList, suggestFileName, aliasForFile, importLineFor, stableDiagnostic } = FIL;
const { rasterCanvasSize, exportSvgWithOverrides, hopWindowsFromMarkers, nextHopTime, scaledDuration } = EXP;
const { parseWorkerParam, workerDisabledReason, packMetrics, unpackMetrics, workerBridgeError, createRenderBridge } = BRG;
const { FONT_STACKS, ROUTING_VALUES, MIN_TEXT_PX, MAX_FILE_BYTES, MAX_RASTER_PX } = OPT;
const { cardinalitySentence, cardinalityText, markCardinality, umlMultiplicityOk, groupDetails, mixedValue, multiSelection, usedInViews, ENDPOINT_MARKS, UML_MULTIPLICITY } = INSP;
const { valueState, evalWhen, widgetForShape, choicesForShape, parseDraft, formatDraft, commitOutcome, commitRecord, descriptorsForTarget, groupDescriptors } = FRM;
const { sheetForProjection, typeSheetAutoState, cmmnOutline, sentryCommit, decoratorCommit, planningCommit,
  memberCommit, templateCommit, assocClassCommit, naryCommit, gensetCommit, laneRectCommit, laneMembersPlan,
  messageCommit, fragmentCommit, eventCommit, gatewayCommit, boolPropCommit,
  numeralCommit, numeralConflicts, renumberPlan, refAnchorScan } = SHT;

/* Designer phase 4: the generated property descriptor registry (designer
 * spec 05). Inlined into the single-file build as DDN_FORM_DESCRIPTORS from
 * designer/contracts/form-descriptors.json; in node the JSON is required. */
const FORM_DESCRIPTORS = ((host.DDN_FORM_DESCRIPTORS) ||
  (typeof module === 'object' && module.exports ? require('../../../designer/contracts/form-descriptors.json') : null) ||
  { descriptors: [] }).descriptors;

/* Designer phase 2: which kinds the Add palette offers for a view. `kinds` are
 * DDNLive.kinds entries ({id, label, code, allowed_in}); `projection` is the
 * view's resolved profiles.projection ({kind, profile}); showAll is the
 * "all installed" escape hatch. Unprofiled graph views (ddn@1) offer the
 * generic (unprofiled, no-dot) kinds only; profiled views offer the kinds
 * whose allowed_in tags include the profile id. Data-bound projections are
 * decided by the caller (no palette at all there). */
function paletteFilter(kinds, projection, showAll) {
  if (showAll) return kinds.slice();
  const profile = (projection && projection.profile) || 'ddn@1';
  if (profile === 'ddn@1') return kinds.filter(k => !k.id.includes('.'));
  return kinds.filter(k => (k.allowed_in && k.allowed_in.length ? k.allowed_in : ['graph']).includes(profile));
}

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
  parseWorkerParam, workerDisabledReason, packMetrics, unpackMetrics, createRenderBridge,
  paletteFilter,
  cardinalitySentence, cardinalityText, markCardinality, umlMultiplicityOk, groupDetails,
  mixedValue, multiSelection, usedInViews, ENDPOINT_MARKS, UML_MULTIPLICITY,
  valueState, evalWhen, widgetForShape, choicesForShape, parseDraft, formatDraft,
  commitOutcome, commitRecord, descriptorsForTarget, groupDescriptors,
  sheetForProjection, typeSheetAutoState, cmmnOutline, sentryCommit, decoratorCommit, planningCommit,
  memberCommit, templateCommit, assocClassCommit, naryCommit, gensetCommit, laneRectCommit, laneMembersPlan,
  messageCommit, fragmentCommit, eventCommit, gatewayCommit, boolPropCommit,
  numeralCommit, numeralConflicts, renumberPlan, refAnchorScan,
  /* Phase 6b data-projection sheet models. */
  MATRIX_KEYS: SHT.MATRIX_KEYS, matrixStageChange: SHT.matrixStageChange,
  chartRecordKeys: SHT.chartRecordKeys, chartNumericKeys: SHT.chartNumericKeys, chartUnitChoices: SHT.chartUnitChoices,
  chartRecordValueCommit: SHT.chartRecordValueCommit,
  timelineDateOK: SHT.timelineDateOK, timelineDatesCommit: SHT.timelineDatesCommit,
  decisionOpsFor: SHT.decisionOpsFor, decisionScalar: SHT.decisionScalar, decisionPredicateFromDraft: SHT.decisionPredicateFromDraft,
  decisionInDomain: SHT.decisionInDomain, checkDecisionRule: SHT.checkDecisionRule,
  CANVAS_REQUIRED: SHT.CANVAS_REQUIRED, panelGridCheck: SHT.panelGridCheck, fishboneOccurrences: SHT.fishboneOccurrences,
  SHEET_REGISTRY: SHT.SHEETS, CMMN_DECORATOR_FLAGS: SHT.CMMN_DECORATOR_FLAGS
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
  styleBody: $('ddn-style-body'), documentBody: $('ddn-document-body'),
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
  inspectorControls: $('ddn-inspector-controls'), selectionSummary: $('ddn-selection-summary'),
  inspectorTabs: $('ddn-inspector-tabs'),
  inspectorMeaning: $('ddn-inspector-tab-meaning'), inspectorView: $('ddn-inspector-tab-view'),
  inspectorDetails: $('ddn-inspector-tab-details'), inspectorError: $('ddn-inspector-error'),
  iconPopup: $('ddn-icon-popup'), iconSearch: $('ddn-icon-search'), iconList: $('ddn-icon-list'),
  addElement: $('ddn-add-element'), addRelation: $('ddn-add-relation'),
  aeModal: $('ddn-add-element-modal'), aeName: $('ddn-ae-name'), aeId: $('ddn-ae-id'), aeKind: $('ddn-ae-kind'),
  aeNote: $('ddn-ae-note'), aeCreate: $('ddn-ae-create'), aeCancel: $('ddn-ae-cancel'),
  arModal: $('ddn-add-relation-modal'), arName: $('ddn-ar-name'), arId: $('ddn-ar-id'), arFrom: $('ddn-ar-from'),
  arTo: $('ddn-ar-to'), arKind: $('ddn-ar-kind'), arNote: $('ddn-ar-note'), arCreate: $('ddn-ar-create'), arCancel: $('ddn-ar-cancel'),
  designBar: $('ddn-design-bar'), designHint: $('ddn-design-hint'), tidy: $('ddn-tidy'),
  sheetTitle: $('ddn-sheet-title'), sheetEmpty: $('ddn-sheet-empty'),
  sheetOutline: $('ddn-sheet-outline'), sheetEditor: $('ddn-sheet-editor'),
  paletteToggle: $('ddn-palette-toggle'), palettePopup: $('ddn-palette-popup'),
  paletteSearch: $('ddn-palette-search'), paletteList: $('ddn-palette-list'),
  paletteHint: $('ddn-palette-hint'), paletteAll: $('ddn-palette-all'), paletteAllWrap: $('ddn-palette-all-wrap'),
  connect: $('ddn-connect'), connectPopup: $('ddn-connect-popup'),
  connectSummary: $('ddn-connect-summary'), connectVerb: $('ddn-connect-verb'), connectNote: $('ddn-connect-note'),
  connectName: $('ddn-connect-name'), connectCreate: $('ddn-connect-create'), connectCancel: $('ddn-connect-cancel'),
  exportSvg: $('ddn-export-svg'), exportPng: $('ddn-export-png'), exportWebp: $('ddn-export-webp'), saveExample: $('ddn-save-example'),
  exportMotion: $('ddn-export-motion'),
  animEmpty: $('ddn-anim-empty'), animControls: $('ddn-anim-controls'), animToggle: $('ddn-anim-toggle'),
  animStep: $('ddn-anim-step'), animSpeed: $('ddn-anim-speed'), animFlow: $('ddn-anim-flow'),
  animFlowField: $('ddn-anim-flow-field'), animStatus: $('ddn-anim-status')
};
const drawerEls = { files: $('ddn-drawer-files'), style: $('ddn-drawer-style'), document: $('ddn-drawer-document'), inspector: $('ddn-drawer-inspector'), source: $('ddn-drawer-source'), typesheet: $('ddn-drawer-typesheet'), export: $('ddn-drawer-export'), animation: $('ddn-drawer-animation') };
const iconEls = { files: $('ddn-icon-files'), style: $('ddn-icon-style'), document: $('ddn-icon-document'), inspector: $('ddn-icon-inspector'), source: $('ddn-icon-source'), typesheet: $('ddn-icon-typesheet'), export: $('ddn-icon-export'), animation: $('ddn-icon-animation') };
const DRAWER_LABELS = { files: 'Files', style: 'Style & Layout', document: 'Document', inspector: 'Inspector', source: 'Source', typesheet: 'Type sheet', export: 'Export', animation: 'Animation' };
/* Right-side working drawers are exclusive (Document / Style & Layout /
 * Inspector): opening one closes the others. Selection opens the Inspector;
 * deselection returns to Document (phase 3 — the inspector moved out of the
 * Source drawer, which now carries text editing + diagnostics only).
 * Phase 5: the bottom shelf is exclusive too (Source / Type sheet). */
const RIGHT_EXCLUSIVE = ['document', 'style', 'inspector'];
const BOTTOM_EXCLUSIVE = ['source', 'typesheet'];

function emptyPresentation() {
  return { options: {}, typography: {}, kindColours: {}, verbColours: {}, objectColours: {}, verbRouting: {}, relationRouting: {}, mindNodes: {} };
}
const state = {
  ws: null, diagram: null, entry: '', view: '', viewList: [],
  currentFile: '', bufferDirty: false, saved: {}, mergeNext: false, search: '',
  presentation: emptyPresentation(), selected: null, selectedRelation: null, selectedIds: [],
  fit: 'page', config: resolveDrawerConfig(DEFAULT_MODE, null, null),
  catalogueIndex: -1, overrideStyle: null, panning: false,
  sheet: null, sheetManual: null
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
  // Right-side exclusivity: Document and Style & Layout never share the shelf.
  if (st === 'open' && RIGHT_EXCLUSIVE.includes(name))
    for (const other of RIGHT_EXCLUSIVE) if (other !== name && state.config.drawers[other] === 'open') state.config.drawers[other] = 'closed';
  // Phase 5: the bottom shelf is exclusive too (Source / Type sheet).
  if (st === 'open' && BOTTOM_EXCLUSIVE.includes(name))
    for (const other of BOTTOM_EXCLUSIVE) if (other !== name && state.config.drawers[other] === 'open') state.config.drawers[other] = 'closed';
  /* Phase 5: an explicit user open/close of the Type sheet overrides the
   * view-driven auto-open/auto-close until the view changes. */
  if (name === 'typesheet') state.sheetManual = { key: state.entry + '#' + state.view, state: st };
  applyDrawerConfig();
  if (persist) saveStoredDrawers();
}
/* Selection-driven drawer switching (phase 3): selecting an element or
 * relation opens the Inspector drawer and closes the other right-side working
 * drawers; deselecting (empty-canvas click / Escape) opens the Document drawer.
 * Only acts when drawer icons are on and the target drawer is available. */
function autoDrawerForSelection(hasSelection) {
  if (!state.config.icons) return;
  const avail = n => state.config.drawers[n] !== 'none';
  if (hasSelection) {
    if (avail('inspector')) state.config.drawers.inspector = 'open';
    for (const n of RIGHT_EXCLUSIVE) if (n !== 'inspector' && state.config.drawers[n] === 'open') state.config.drawers[n] = 'closed';
  } else {
    if (avail('document')) state.config.drawers.document = 'open';
    for (const n of ['style', 'inspector']) if (state.config.drawers[n] === 'open') state.config.drawers[n] = 'closed';
  }
  applyDrawerConfig();
  saveStoredDrawers();
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
    label.textContent = (DRAWER_LABELS[name] || name) + ' drawer ';
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
    refreshInspector();
    refreshTypeSheet();
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
  attachDeselect();
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

/* ------------------------------------------------ style & layout drawer (right)
 * Two write scopes, labeled on every group header:
 *  · "View override (saved to source)" — the session render-override channel
 *    (diagram.setOptions; serialized into the source view block by
 *    overrideProfileWrites on getSource({includeAppearance:true})) PLUS the
 *    source-backed controls for the style/layout/display keys the override
 *    channel cannot express (SOURCE_FIELDS), which write straight into the
 *    source via authoring.setViewProfile, one undoable transaction per change.
 *  · "Session preview (not saved)" — the CSS-overlay cosmetics (per-kind and
 *    per-relation-class colours, per-kind typography, per-selection routing)
 *    under their own header at the bottom. */

function appGroup(parent, title, scope) {
  const g = document.createElement('div');
  g.className = 'ddn-app-group';
  const h = document.createElement('h3'); h.textContent = title;
  if (scope) {
    const s = document.createElement('span');
    s.className = 'ddn-scope ' + (scope === 'session' ? 'ddn-scope-session' : 'ddn-scope-source');
    s.textContent = scope === 'session' ? 'Session preview (not saved)' : 'View override (saved to source)';
    h.append(s);
  }
  g.append(h);
  parent.append(g);
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
/* Option-field descriptors driven through diagram.setOptions (component
 * render override channel — these reflow correctly). Publication, chrome and
 * legend settings moved to the source-backed Document drawer. */
const SELECT_FIELDS = [
  ['Style', [
    ['Drawing style', 'look', [['classic', 'Standard'], ['handDrawn', 'Hand-drawn'], ['neo', 'Neo']]],
    ['Palette', 'theme', () => A.choices.theme.map(titled)],
    ['Font role', 'font', () => A.choices.font.map(titled)],
    ['Base font (px)', 'fontSize', 'number', baseFontFloor(), 64, 1],
    ['Pen roughness', 'roughness', 'number', 0, 3, 0.2],
    ['Hatch shading', 'hachure', 'checkbox']
  ]],
  ['Layout', [
    ['Placement', 'placement', () => A.choices.placement.map(titled)],
    ['Auto-place', 'autoPlace', 'checkbox'],
    ['Layout centre', 'center', () => A.choices.center.map(titled)],
    ['Grid step (px)', 'gridStep', 'number', 8, 512, 8],
    ['Routing', 'routing', () => A.choices.routing.map(titled)],
    ['Curve tension', 'curveTension', 'number', 0, 1, 0.05],
    ['Curve radius (px)', 'curveRadius', 'number', 0, 512, 1],
    ['Crossings', 'crossings', () => A.choices.crossings.map(titled)],
    ['Endpoint ordering', 'endpointOrdering', () => A.choices.endpointOrdering.map(titled)]
  ]],
  ['Display', [
    ['Detail', 'fields', () => A.choices.fields.map(titled)],
    ['Field depth (levels)', 'depth', 'number', 0, 64, 1],
    ['Relation labels', 'labels', () => A.choices.labels.map(titled)],
    ['Domain bindings', 'domains', () => A.choices.domains.map(titled)],
    ['Datatypes', 'datatypes', () => A.choices.datatypes.map(titled)],
    ['Kind indicator', 'kind', () => A.choices.kind.map(titled)],
    ['Chart mark', 'mark', () => A.choices.mark.map(titled)]
  ]]
];
const optionInputs = {};
for (const [group, fields] of SELECT_FIELDS) {
  const g = appGroup(els.styleBody, group, 'source');
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
  if (group === 'Layout') g.append(dim('Grid step sets fit_grid lattice granularity and the radial/organic/retained-position spiral search pitch only; it does not move grid, layered, tree or auto placements.'));
}

/* Source-backed controls for the spec-authorable style/layout/display keys
 * the component override channel cannot express (its session options cover
 * only the SELECT_FIELDS keys). Each change is one undoable setViewProfile
 * source write; the blank / "default" choice removes the key from the source. */
const SOURCE_FIELDS = [
  ['Style — source-only keys', 'style', [
    ['Seed', 'seed', 'number', 0, 4294967295, 1],
    ['Text fit', 'text_fit', ['wrap', 'grow', 'shrink']],
    ['Max text width (px)', 'max_width', 'quantity', 16, 32000],
    ['Max text height (px)', 'max_height', 'quantity', 8, 32000],
    ['Minimum font (px)', 'min_font', 'quantity', 4, 512]
  ]],
  ['Layout — source-only keys', 'layout', [
    ['Direction', 'direction', ['right', 'down', 'left', 'up']],
    ['Column gap (px)', 'gap', 'quantity', 20, 2000],
    ['Row gap (px)', 'row_gap', 'quantity', 20, 2000],
    ['Grid columns', 'columns', 'number', 1, 64, 1],
    ['Object clearance (px)', 'object_clearance', 'quantity', 0, 2000],
    ['Edge clearance (px)', 'edge_clearance', 'quantity', 0, 2000],
    ['Port clearance (px)', 'port_clearance', 'quantity', 0, 2000],
    ['Junctions', 'junctions', ['explicit']],
    ['Route policy', 'route_policy', ['repair', 'strict']],
    ['Hierarchy relation kinds', 'hierarchy', 'kindlist'],
    ['Group by', 'group_by', 'text']
  ]],
  ['Display — source-only keys', 'display', [
    ['Maturity', 'maturity', ['token', 'none']],
    ['Badges', 'badges', ['tokens', 'none']],
    ['Relations', 'relations', ['between_selected', 'none']],
    ['Samples', 'samples', ['show', 'hide']]
  ]]
];
const pxOf = v => v == null ? null : (typeof v === 'number' ? v : (v.$quantity !== undefined ? quantityPx(v, null) : null));
const ptOf = v => v == null ? null : (typeof v === 'number' ? v : (v.$quantity !== undefined ? (v.unit === 'pt' ? v.$quantity : quantityPx(v, null) * 0.75) : null));
function sourceProfileWrite(group, key, val) {
  guided(() => A.authoring.setViewProfile(state.ws, state.entry, state.view, { [group]: { [key]: val } }));
}
/* Phase 4: SOURCE_FIELDS renders through the descriptor form generator
 * (DDNToolForms.renderForm) — each entry becomes a property descriptor
 * (scope "view", widget per the table's kind column), proving the generator
 * generalizes beyond the Inspector. Blank/“default” removes the key from the
 * source (removal is distinct from blanking; parseDraft maps blank → unset). */
const sourceForms = [];
for (const [group, profile, fields] of SOURCE_FIELDS) {
  const g = appGroup(els.styleBody, group, 'source');
  const descriptors = fields.map(([label, key, kind, min, max, step]) => {
    const d = { id: 'ddn.view.' + profile + '.' + key, key, label, targets: ['view'], scope: 'view', removable: true, states: ['unset', 'value'] };
    if (Array.isArray(kind)) { d.widget = 'select'; d.choices = kind.slice(); }
    else if (kind === 'number') { d.widget = 'number'; d.min = min; d.max = max; d.step = step; if (key === 'columns') d.integer = true; }
    else if (kind === 'quantity') { d.widget = 'quantity'; d.units = ['px']; d.min = min; d.max = max; }
    else if (kind === 'kindlist') { d.widget = 'string-list'; d.help = 'Comma-separated kind keywords.'; }
    else { d.widget = 'text'; }
    return d;
  });
  const form = FRM.renderForm(g, descriptors, {
    flat: true,
    getValue(d) {
      const node = viewSourceNode();
      const c = node && (node.children || []).find(x => x.group && x.type === profile);
      return ((c && c.props) || {})[d.key];
    },
    commit(d, v) {
      flush();
      A.authoring.setViewProfile(state.ws, state.entry, state.view, { [profile]: { [d.key]: v } });
      showSource(state.currentFile);
      updateHistory();
      refreshAfterSourceWrite();
      status('source edit applied — undo restores the previous source');
    },
    note: status
  });
  sourceForms.push(form);
  if (profile === 'layout') g.append(dim('Gaps floor at 20px (DDN200); the authored value is the exact inter-element gap — object/edge/port clearances only affect edge routing and fan-out corridors, never node spacing. Tighter gaps keep the fit: contain scale nearer 1, so text renders larger on a fixed page.'));
}
function syncSourceInputs() { for (const f of sourceForms) f.sync(); }
/* Viewport actions + reset live in the style drawer too (the toolbar keeps
 * the quick fit/zoom subset). Session state only — nothing here writes source. */
{
  const g = appGroup(els.styleBody, 'Viewport', 'session');
  const row = document.createElement('div'); row.className = 'ddn-row';
  const mk = (label, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ddn-mini'; b.textContent = label; b.title = title; b.addEventListener('click', () => guard(fn)); row.append(b); return b; };
  mk('Auto-layout now', 'Reflow unpinned elements', () => state.diagram && state.diagram.action('relayout'));
  mk('Centre pins', 'Scroll the pinned group into view', () => state.diagram && state.diagram.action('focus-pins'));
  mk('Reset appearance', 'Clear every presentation override', resetAppearance);
  g.append(row);
}
{
  const head = document.createElement('div');
  head.className = 'ddn-session-head';
  head.textContent = 'Session preview (not saved to source)';
  els.styleBody.append(head);
}
const coloursGroup = appGroup(els.styleBody, 'Colours — kinds', 'session');
const verbsGroup = appGroup(els.styleBody, 'Colours — relation classes', 'session');
const typoGroup = appGroup(els.styleBody, 'Typography per kind', 'session');
const relationsGroup = appGroup(els.styleBody, 'Routing per relation class', 'session');
const selectedGroup = appGroup(els.styleBody, 'Clicked object / relation', 'session');

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
  const contentScale = quantityPx(pub.content_scale, 1);
  return {
    /* content_scale scales the drawing before fit (chapter 06 amendment): the
     * pre-check folds it into the content bounds and the embedding multiplier
     * so pageScaleFloor/artboardProblem see the same final text sizes the
     * renderer enforces. */
    contentW: scene.drawingBounds.w * contentScale, contentH: scene.drawingBounds.h * contentScale, chromeW, chromeH,
    minTextPx: quantityPx(pub.minimum_text, MIN_TEXT_PX),
    baseFontPx: opts.fontSize != null ? opts.fontSize : quantityPx(style.font_size, 16),
    hasRelations: !!(scene.routes && scene.routes.length),
    embeddingScale: quantityPx(pub.embedding_scale, 1) * contentScale
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
          if (!input) continue; // page/width/height moved to the Document drawer (source-backed)
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

/* ------------------------------------------------ document drawer (right)
 * The view's publication/chrome/legend profiles, the 0.8 publication chrome
 * child groups (header/footer run bands, page border, page background —
 * chapter 53) and the view's own metadata (title, description, provenance
 * source/generator). Every field writes straight into the source view block
 * through the authoring channel — setViewProfile for flat profile properties,
 * setViewChrome for the chrome child groups (nested run bands are not
 * expressible as flat properties), setViewProperties for view-level metadata —
 * one undoable, validated transaction per change. Everything here is a "View
 * override (saved to source)"; the session-preview cosmetics live in the
 * Style & Layout drawer. */

function viewSourceNode() {
  try {
    const files = state.ws && state.ws.getFiles();
    if (!files || !state.entry || !Object.prototype.hasOwnProperty.call(files, state.entry)) return null;
    const ast = A.parse(files[state.entry], state.entry);
    return (ast.declarations || []).find(n => n.type === 'view' && n.id === state.view) || null;
  } catch { return null; }
}

const DOCUMENT_FIELDS = [
  ['Publication', 'publication', [
    ['Size preset', 'size', ['figure', 'content', 'a4', 'letter']],
    ['Width (px)', 'width', 'quantity', 100, 32000],
    ['Height (px)', 'height', 'quantity', 100, 32000],
    ['Margin (px)', 'margin', 'quantity', 0, 2000],
    ['Orientation', 'orientation', ['portrait', 'landscape']],
    ['Fit', 'fit', ['contain', 'none', 'reflow']],
    ['Minimum text (pt)', 'minimum_text', 'quantity-pt', 1, 72],
    ['Overflow', 'overflow', ['error', 'warn']],
    ['Embedding scale', 'embedding_scale', 'number', 0.01, 4, 0.01],
    ['Content scale', 'content_scale', 'number', 0.25, 4, 0.05],
    ['Title', 'title', 'text'],
    ['Caption', 'caption', 'text']
  ]],
  ['Chrome', 'chrome', [
    ['Legend', 'legend', ['auto', 'on', 'off']],
    ['Title block', 'title', ['on', 'off']],
    ['Footer line', 'footer', ['on', 'off']],
    ['Banner', 'banner', ['on', 'off']],
    ['Banner replacement text', 'banner_text', 'text']
  ]],
  ['Legend', 'legend', [
    ['Mode', 'mode', ['numbers', 'text', 'tokens', 'none']],
    ['Placement', 'placement', ['right', 'bottom', 'none']],
    ['Width (px)', 'width', 'quantity', 100, 2000]
  ]],
  ['View', 'view', [
    ['View title', 'title', 'text'],
    ['Description', 'description', 'text'],
    ['Provenance source', 'source', 'text'],
    ['Provenance generator', 'generator', 'text']
  ]]
];
const docInputs = {};
let legendHintEl = null;
/* Legend callout keys (0.8 chapter 53): legend mode "numbers" renders
 * RELATIONSHIP KEY callouts and the builder rejects the mode when any visible
 * relation lacks an explicit key (DDN061) — so choosing numbers without keys
 * must assign them in the SAME transaction, or the write is refused. Keys are
 * keyed by the relation's reference path; already-keyed relations keep their
 * numbers, unkeyed ones take the smallest free positive integers in view
 * order. */
function legendKeyPlan() {
  let ir = null;
  try { ir = state.ws.resolve(state.entry, state.view); } catch { return null; }
  const authored = (ir.view.profiles.legend && ir.view.profiles.legend.keys) || {};
  const resolved = ir.view.keys || {};
  const used = new Set(Object.values(resolved));
  const missing = [];
  for (const rid of ir.view.relations) {
    if (resolved[rid] !== undefined) continue;
    const rel = (ir.relations || []).find(r => r.id === rid);
    if (rel) missing.push(rel);
  }
  return { authored, missing, used };
}
function autoNumberedKeys(plan) {
  const keys = { ...plan.authored };
  let next = 1;
  for (const rel of plan.missing) {
    while (plan.used.has(next)) next++;
    keys[rel.ref || rel.id] = next;
    plan.used.add(next);
    next++;
  }
  return keys;
}
for (const [group, profile, fields] of DOCUMENT_FIELDS) {
  const g = appGroup(els.documentBody, group, 'source');
  for (const [label, key, kind, min, max, step] of fields) {
    let input;
    const writeKey = key === 'banner_text' ? 'banner' : key;
    const commit = () => guard(() => {
      let val;
      if (kind === 'number') val = input.value === '' ? undefined : Number(input.value);
      else if (kind === 'quantity') val = input.value === '' ? undefined : { $quantity: Number(input.value), unit: 'px' };
      else if (kind === 'quantity-pt') val = input.value === '' ? undefined : { $quantity: Number(input.value), unit: 'pt' };
      else if (kind === 'text') val = input.value.trim() ? input.value.trim() : undefined;
      else val = input.value === '' ? undefined : input.value;
      if (profile === 'view') guided(() => A.authoring.setViewProperties(state.ws, state.entry, state.view, { [writeKey]: val }));
      else if (profile === 'legend' && writeKey === 'mode' && val === 'numbers') {
        const plan = legendKeyPlan();
        if (plan && plan.missing.length) {
          const keys = autoNumberedKeys(plan);
          guided(() => A.authoring.setViewProfile(state.ws, state.entry, state.view, { legend: { mode: 'numbers', keys } }));
          status('numbered legend needed callout keys — auto-numbered ' + plan.missing.length + ' relation(s); edit legend { keys: { … } } in source to renumber');
        } else sourceProfileWrite(profile, writeKey, val);
      }
      else sourceProfileWrite(profile, writeKey, val);
    });
    if (Array.isArray(kind)) {
      input = selectInput([['', 'As authored / default'], ...kind.map(v => [v, v])], label);
      input.addEventListener('change', commit);
    } else if (kind === 'text') {
      input = document.createElement('input'); input.type = 'text'; input.placeholder = 'blank = removed';
      input.addEventListener('change', commit);
    } else {
      input = document.createElement('input'); input.type = 'number';
      input.min = min; input.max = max; input.step = step || 1; input.placeholder = 'source';
      input.addEventListener('change', commit);
    }
    docInputs[profile + '.' + key] = { input, kind };
    /* Labels repeat across groups (Width, Title) — qualify so assistive tech
     * and probes can tell Publication Width from Legend Width. */
    input.setAttribute('aria-label', group + ' ' + label);
    field(g, label, input);
  }
  if (profile === 'publication') g.append(dim('Content scale grows or shrinks the drawing itself — geometry and all text together (0.25–4, default 1) — before Fit is applied, so Fit "contain" and the minimum-text check (DDN071) judge the scaled result, and Fit "none" renders at exactly that scale with DDN074 overflow rules on the scaled size. Embedding scale is different: it declares how much the embedding context enlarges the rendered SVG (1 = as-rendered). It never changes geometry or fonts in the file itself — it only scales the effective sizes the minimum-text and print lint checks enforce (DDN071/DDN-PS01/PS02), so a value above 1 asserts "this will be displayed larger". All renderers cap embedding scale at 4 (DDN070/DDN-PJ062).'));
  if (profile === 'legend') {
    legendHintEl = dim('');
    legendHintEl.hidden = true;
    const autoB = document.createElement('button');
    autoB.type = 'button'; autoB.className = 'ddn-mini'; autoB.id = 'ddn-legend-autonumber';
    autoB.textContent = 'Auto-number relations';
    autoB.title = 'Assign legend callout keys (1…n in view order, skipping already-keyed relations) as legend { keys: { … } } — one undoable source write';
    autoB.addEventListener('click', () => guard(() => {
      const plan = legendKeyPlan();
      if (!plan) { status('no resolvable view'); return; }
      if (!plan.missing.length) { status('every visible relation already has a callout key'); return; }
      const keys = autoNumberedKeys(plan);
      guided(() => A.authoring.setViewProfile(state.ws, state.entry, state.view, { legend: { keys } }));
      status('auto-numbered ' + plan.missing.length + ' relation(s) — edit legend { keys: { … } } in source to renumber');
    }));
    const row = document.createElement('div'); row.className = 'ddn-row';
    row.append(autoB);
    g.append(legendHintEl, row);
  }
}
/* DDN061 surfacing: numbered legend mode needs one callout key per visible
 * relation; say so next to the controls whenever that gap exists (the builder
 * refuses mode: numbers without keys, so an unsatisfied requirement can only
 * come from source edits or a keyset that lost entries). */
function updateLegendHint() {
  if (!legendHintEl) return;
  const mode = docInputs['legend.mode'] && docInputs['legend.mode'].input.value;
  const plan = mode === 'numbers' ? legendKeyPlan() : null;
  if (plan && plan.missing.length) {
    legendHintEl.hidden = false;
    legendHintEl.textContent = 'Numbered mode requires callout keys — ' + plan.missing.length + ' visible relation(s) have none. Use Auto-number relations (or author legend { keys: { … } }) or the builder rejects the mode (DDN061).';
  } else legendHintEl.hidden = true;
}

/* Chapter 53 publication chrome: header/footer run bands (left/center/right
 * runs of text/align/font/size/lines, with the $title/$page/$date/$view_id/
 * $figure variables), page border and page background. One setViewChrome
 * transaction per band change; an empty band removes the group. */
const bandInputs = {};
for (const band of ['header', 'footer']) {
  const g = appGroup(els.documentBody, band[0].toUpperCase() + band.slice(1) + ' runs', 'source');
  const note = dim('Variables: $title $page $date $view_id $figure ($$ escapes a literal $). Empty text removes the run; all runs empty removes the band.');
  g.append(note);
  bandInputs[band] = {};
  for (const slot of ['left', 'center', 'right']) {
    const row = document.createElement('div'); row.className = 'ddn-chrome-run';
    const lab = document.createElement('span'); lab.textContent = slot;
    const text = document.createElement('input'); text.type = 'text'; text.placeholder = 'text'; text.setAttribute('aria-label', band + ' ' + slot + ' text');
    const align = selectInput([['', 'align'], ['left', 'left'], ['center', 'center'], ['right', 'right']], band + ' ' + slot + ' align');
    const font = selectInput([['', 'font'], ['sans', 'sans'], ['serif', 'serif'], ['mono', 'mono'], ['handwriting', 'handwriting']], band + ' ' + slot + ' font');
    const size = document.createElement('input'); size.type = 'number'; size.min = 4; size.max = 24; size.step = 0.5; size.placeholder = 'pt'; size.title = band + ' ' + slot + ' size (4–24pt)';
    const lines = document.createElement('input'); lines.type = 'number'; lines.min = 1; lines.max = 4; lines.step = 1; lines.placeholder = '1'; lines.title = band + ' ' + slot + ' lines (1–4)';
    const ins = { text, align, font, size, lines };
    bandInputs[band][slot] = ins;
    for (const el of [text, align, font, size, lines]) el.addEventListener('change', () => commitBand(band));
    row.append(lab, text, align, font, size, lines);
    g.append(row);
  }
}
function commitBand(band) {
  const spec = {};
  for (const [slot, ins] of Object.entries(bandInputs[band])) {
    const t = ins.text.value.trim();
    if (!t) continue;
    const run = { text: t };
    if (ins.align.value) run.align = ins.align.value;
    if (ins.font.value) run.font = ins.font.value;
    if (ins.size.value !== '') run.size = Number(ins.size.value);
    if (ins.lines.value !== '') run.lines = Number(ins.lines.value);
    spec[slot] = run;
  }
  guard(() => guided(() => A.authoring.setViewChrome(state.ws, state.entry, state.view, { [band]: Object.keys(spec).length ? spec : null })));
}
const borderInputs = {};
{
  const g = appGroup(els.documentBody, 'Page border', 'source');
  borderInputs.style = field(g, 'Style', selectInput([['', 'none'], ['single', 'single'], ['double', 'double'], ['dashed', 'dashed']], 'border style'));
  borderInputs.weight = document.createElement('input'); borderInputs.weight.type = 'number'; borderInputs.weight.min = 0.25; borderInputs.weight.max = 8; borderInputs.weight.step = 0.25; borderInputs.weight.placeholder = 'pt'; borderInputs.weight.setAttribute('aria-label', 'Border weight (pt)');
  field(g, 'Weight (pt)', borderInputs.weight);
  borderInputs.inset = document.createElement('input'); borderInputs.inset.type = 'number'; borderInputs.inset.min = 0; borderInputs.inset.max = 2000; borderInputs.inset.step = 1; borderInputs.inset.placeholder = 'px'; borderInputs.inset.setAttribute('aria-label', 'Border inset (px)');
  field(g, 'Inset (px)', borderInputs.inset);
  borderInputs.corner_marks = field(g, 'Corner marks', selectInput([['', 'As authored / default'], ['on', 'on'], ['off', 'off']], 'corner marks'));
  const commit = () => {
    if (!borderInputs.style.value) { guard(() => guided(() => A.authoring.setViewChrome(state.ws, state.entry, state.view, { border: null }))); return; }
    const spec = { style: borderInputs.style.value };
    if (borderInputs.weight.value !== '') spec.weight = Number(borderInputs.weight.value);
    if (borderInputs.inset.value !== '') spec.inset = Number(borderInputs.inset.value);
    if (borderInputs.corner_marks.value) spec.corner_marks = borderInputs.corner_marks.value === 'on';
    guard(() => guided(() => A.authoring.setViewChrome(state.ws, state.entry, state.view, { border: spec })));
  };
  for (const el of Object.values(borderInputs)) el.addEventListener('change', commit);
}
const backgroundInputs = {};
{
  const g = appGroup(els.documentBody, 'Page background', 'source');
  backgroundInputs.kind = field(g, 'Fill', selectInput([['', 'none'], ['color', 'color'], ['image', 'image (png/webp file)'], ['pattern', 'pattern (svg file)']], 'background fill'));
  backgroundInputs.color = document.createElement('input'); backgroundInputs.color.type = 'text'; backgroundInputs.color.placeholder = '#rrggbb'; backgroundInputs.color.setAttribute('aria-label', 'Background colour');
  field(g, 'Colour', backgroundInputs.color);
  backgroundInputs.image = document.createElement('input'); backgroundInputs.image.type = 'text'; backgroundInputs.image.placeholder = 'workspace path (.png/.webp)';
  field(g, 'Image file', backgroundInputs.image);
  backgroundInputs.pattern = document.createElement('input'); backgroundInputs.pattern.type = 'text'; backgroundInputs.pattern.placeholder = 'workspace path (.svg)';
  field(g, 'Pattern file', backgroundInputs.pattern);
  backgroundInputs.opacity = document.createElement('input'); backgroundInputs.opacity.type = 'number'; backgroundInputs.opacity.min = 0; backgroundInputs.opacity.max = 1; backgroundInputs.opacity.step = 0.05; backgroundInputs.opacity.placeholder = '1';
  field(g, 'Opacity', backgroundInputs.opacity);
  const commit = () => {
    const kind = backgroundInputs.kind.value;
    if (!kind) { guard(() => guided(() => A.authoring.setViewChrome(state.ws, state.entry, state.view, { background: null }))); return; }
    const v = backgroundInputs[kind].value.trim();
    if (!v) { status('background ' + kind + ' needs a value before it can be written'); return; }
    const spec = { [kind]: v };
    if (backgroundInputs.opacity.value !== '') spec.opacity = Number(backgroundInputs.opacity.value);
    guard(() => guided(() => A.authoring.setViewChrome(state.ws, state.entry, state.view, { background: spec })));
  };
  for (const el of Object.values(backgroundInputs)) el.addEventListener('change', commit);
}

function syncDocumentForm() {
  const node = viewSourceNode();
  const groupNode = g => node && (node.children || []).find(x => x.group && x.type === g);
  const propsOf = g => { const c = groupNode(g); return (c && c.props) || {}; };
  for (const [, profile, fields] of DOCUMENT_FIELDS) {
    const p = profile === 'view' ? ((node && node.props) || {}) : propsOf(profile);
    for (const [, key, kind] of fields) {
      const rec = docInputs[profile + '.' + key];
      if (!rec) continue;
      let v = p[key];
      if (key === 'banner_text') v = (typeof p.banner === 'string' && !['on', 'off'].includes(p.banner)) ? p.banner : undefined;
      if (kind === 'quantity') { const n = pxOf(v); rec.input.value = n == null ? '' : String(Math.round(n * 100) / 100); }
      else if (kind === 'quantity-pt') { const n = ptOf(v); rec.input.value = n == null ? '' : String(Math.round(n * 100) / 100); }
      else if (kind === 'number') rec.input.value = v == null ? '' : String(v);
      else if (kind === 'text') rec.input.value = typeof v === 'string' ? v : '';
      else rec.input.value = typeof v === 'string' && rec.input.querySelector('option[value="' + v + '"]') ? v : '';
    }
  }
  const pub = groupNode('publication');
  const concernNode = k => pub && (pub.children || []).find(x => x.group && x.type === k);
  for (const band of ['header', 'footer']) {
    const n = concernNode(band);
    for (const slot of ['left', 'center', 'right']) {
      const ins = bandInputs[band][slot];
      const run = n && (n.children || []).find(x => x.group && x.type === slot);
      const p = (run && run.props) || {};
      ins.text.value = typeof p.text === 'string' ? p.text : '';
      ins.align.value = typeof p.align === 'string' && p.align !== slot ? p.align : '';
      ins.font.value = typeof p.font === 'string' ? p.font : '';
      const sz = ptOf(p.size); ins.size.value = sz == null ? '' : String(Math.round(sz * 100) / 100);
      ins.lines.value = p.lines == null ? '' : String(p.lines);
    }
  }
  const border = concernNode('border');
  borderInputs.style.value = border && typeof border.props.style === 'string' ? border.props.style : '';
  { const w = border && ptOf(border.props.weight); borderInputs.weight.value = w == null ? '' : String(Math.round(w * 100) / 100); }
  { const i = border && pxOf(border.props.inset); borderInputs.inset.value = i == null ? '' : String(Math.round(i * 100) / 100); }
  borderInputs.corner_marks.value = border && border.props.corner_marks !== undefined ? (border.props.corner_marks ? 'on' : 'off') : '';
  const bg = concernNode('background');
  const bgKind = bg ? ['color', 'image', 'pattern'].find(k => bg.props[k] !== undefined) : '';
  backgroundInputs.kind.value = bgKind || '';
  backgroundInputs.color.value = bg && typeof bg.props.color === 'string' ? bg.props.color : '';
  backgroundInputs.image.value = bg && typeof bg.props.image === 'string' ? bg.props.image : '';
  backgroundInputs.pattern.value = bg && typeof bg.props.pattern === 'string' ? bg.props.pattern : '';
  backgroundInputs.opacity.value = bg && bg.props.opacity !== undefined ? String(bg.props.opacity) : '';
  updateLegendHint();
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

/* Repopulate a session-preview group's rows without wiping its header (the
 * appGroup h3 carries the title and the "Session preview" scope pill). */
function setGroupRows(group, rows) {
  group.replaceChildren(group.querySelector('h3'), ...rows);
}

function repopulateOverridePanels() {
  syncOptionInputs();
  syncSourceInputs();
  syncDocumentForm();
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
  setGroupRows(coloursGroup, [...kinds].sort().map(([code, label]) =>
    colourRow(label + ' (' + code + ')', code, state.presentation.kindColours[code],
      (c, col) => { state.presentation.kindColours[c] = col; applyOverrideCss(); },
      c => { delete state.presentation.kindColours[c]; repopulateOverridePanels(); applyOverrideCss(); })));
  if (!kinds.size) coloursGroup.append(dim('none in this view'));
  setGroupRows(verbsGroup, [...verbs].sort((a, b) => a[1].code < b[1].code ? -1 : 1).map(([keyword, v]) =>
    colourRow(v.label + ' (' + v.code + ')', v.code, state.presentation.verbColours[v.code],
      (c, col) => { state.presentation.verbColours[c] = col; applyOverrideCss(); },
      c => { delete state.presentation.verbColours[c]; repopulateOverridePanels(); applyOverrideCss(); })));
  if (!verbs.size) verbsGroup.append(dim('none in this view'));
  setGroupRows(typoGroup, [...kinds].sort().map(([code, label]) => typographyRow(label + ' (' + code + ')', code)));
  if (!kinds.size) typoGroup.append(dim('none in this view'));
  setGroupRows(relationsGroup, [...verbs].sort((a, b) => a[1].code < b[1].code ? -1 : 1).map(([keyword, v]) => verbRoutingRow(v.label + ' (' + keyword + ')', keyword)));
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
  setGroupRows(selectedGroup, rows);
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

/* ------------------------------------------------ selection + inspector
 * Phase 3 (2026-10 redesign): the inspector is its own right-side drawer in
 * the exclusive set {Document, Style & Layout, Inspector}, structured as the
 * spec-03 three tabs — Meaning (shared model definition), This view
 * (occurrence: pin/hide/session overrides), Details (phase 4: descriptor-
 * driven editable property form generated from the registry). Relation
 * selections add verb/cardinality/enforcement/scope/
 * end-label controls writing through authoring.setRelationProps /
 * setRelationExtension — one validated, undoable transaction per commit, with
 * coded errors surfaced adjacent to the controls. */

function onSelect(detail) {
  if (state.panning) return;
  const ids = detail.sourceIds && detail.sourceIds.length ? detail.sourceIds : [detail.sourceId || detail.id];
  state.selectedIds = ids.filter(Boolean);
  const id = state.selectedIds.length === 1 ? state.selectedIds[0] : (detail.sourceId || detail.id);
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
  autoDrawerForSelection(true);
}

/* Deselection (empty-canvas click / Escape): clears the selection and opens
 * the Document drawer — with nothing selected, the right shelf shows the
 * view's document settings instead of the inspector. */
function deselect() {
  const had = state.selected || state.selectedRelation;
  state.selected = null; state.selectedRelation = null; state.selectedIds = [];
  applyOverrideCss();
  updateSelectedPanel();
  els.inspectorControls.hidden = true;
  inspectorNote('');
  els.selectionSummary.textContent = 'Click an object or relation in the diagram.';
  if (had) status('selection cleared');
  autoDrawerForSelection(false);
}
function attachDeselect() {
  const stage = stageEl();
  if (!stage || stage.dataset.toolDeselect) return;
  stage.dataset.toolDeselect = 'true';
  stage.addEventListener('click', e => {
    if (state.panning || design.placing || design.connecting) return;
    const path = e.composedPath ? e.composedPath() : [];
    const hit = path.length && path[0] && path[0].closest ? path[0].closest('[data-id],[data-member],[data-property]') : null;
    if (hit) return; // a diagram element was clicked — ddn-select owns this click
    deselect();
  });
}
/* Escape deselects (and opens Document) when no popup or armed gesture owns
 * the key. Capture phase so the check runs before the popup-closing handlers
 * mutate their hidden state. */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (design.placing || design.connecting) return;
  if (!els.iconPopup.hidden || !els.palettePopup.hidden || !els.connectPopup.hidden || !els.settingsPopup.hidden || !els.templatePopup.hidden || !els.aeModal.hidden || !els.arModal.hidden) return;
  if (state.selected || state.selectedRelation) deselect();
}, true);

/* Inspector tab bar. */
els.inspectorTabs.addEventListener('click', e => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  for (const t of els.inspectorTabs.querySelectorAll('[data-tab]')) t.setAttribute('aria-selected', String(t === b));
  for (const [name, panel] of [['meaning', els.inspectorMeaning], ['view', els.inspectorView], ['details', els.inspectorDetails]])
    panel.hidden = name !== b.dataset.tab;
});

function inspectorNote(msg) { els.inspectorError.textContent = msg || ''; }
/* Inspector commits surface coded errors ADJACENT to the controls (the
 * inspector error slot) rather than only in the status bar / source drawer —
 * the commit-time authority is core validation (DDN-PJ149 & friends), and its
 * coded failure lands here. */
function guidedInspector(action) {
  try {
    flush();
    action();
    showSource(state.currentFile);
    updateHistory();
    inspectorNote('');
    refreshAfterSourceWrite();
    status('source edit applied — undo restores the previous source');
    refreshInspector();
  } catch (e) {
    inspectorNote((e && e.code ? e.code + ': ' : '') + (e && e.message || e));
  }
}
function refreshInspector() {
  if (!state.selected && !state.selectedRelation) return;
  let ir = null;
  try { ir = state.ws.resolve(state.entry, state.view); } catch { return; }
  const id = state.selected || state.selectedRelation;
  inspector(id, ir, state.selectedRelation ? ir.relations.find(r => r.id === id) : null);
}

/* ------------------------------------------------ Type sheet (phase 5)
 * The bottom Type sheet drawer dispatches its body by view capability
 * (projection kind + profile) through the sheets.js registry: a view whose
 * profile has a registered body auto-opens the drawer (and a plain view
 * auto-closes it) unless the user explicitly opened/closed it for this view.
 * Every sheet write goes through authoring.js inside one guided, undoable,
 * core-validated transaction; the sheet re-renders from the fresh IR after
 * each commit (the ddn-render event drives refreshTypeSheet). */
function sheetGuided(action, onError) {
  try {
    flush();
    action();
    showSource(state.currentFile);
    updateHistory();
    status('source edit applied — undo restores the previous source');
    if (onError) onError('');
    refreshTypeSheet();
  } catch (e) {
    const msg = (e && e.code ? e.code + ': ' : '') + (e && e.message || e);
    if (onError) onError(msg);
    else fail(msg);
  }
}
function selectFromSheet(uid) {
  state.selected = uid; state.selectedRelation = null; state.selectedIds = [uid];
  applyOverrideCss();
  updateSelectedPanel();
  let ir = null;
  try { ir = state.ws.resolve(state.entry, state.view); } catch { ir = null; }
  if (ir) inspector(uid, ir, null);
  autoDrawerForSelection(true);
}
function refreshTypeSheet() {
  /* Phase 6b: auto-added definitions land in an explicit select list
   * (addLocal); the chart/decision delete flows drop that ref first so
   * deleteDefinition does not trip DDN-E004 on the auto-added occurrence. */
  const dropSelectRef = uid => {
    const cur = state.ws.resolve(state.entry, state.view);
    if (!cur.view.selected.includes(uid)) return;
    A.authoring.setViewList(state.ws, state.entry, state.view, 'select', cur.view.selected.filter(u => u !== uid));
  };
  if (!els.sheetOutline) return;
  const sheet = sheetForProjection(viewProjection());
  const has = !!(sheet && SHT.RENDERERS && SHT.RENDERERS[sheet.id]);
  const key = state.entry + '#' + state.view;
  if (state.sheetManual && state.sheetManual.key !== key) state.sheetManual = null;
  if (!state.sheetManual && state.config.icons) {
    const next = typeSheetAutoState(has, state.config.drawers.typesheet);
    if (next) { state.config.drawers.typesheet = next; applyDrawerConfig(); }
  }
  els.sheetTitle.textContent = has ? sheet.label + ' — view "' + state.view + '"' : '';
  els.sheetEmpty.hidden = has;
  els.sheetOutline.hidden = !has;
  els.sheetEditor.hidden = !has;
  if (!has) { state.sheet = null; return; }
  let ir = null;
  try { ir = state.ws.resolve(state.entry, state.view); } catch { ir = null; }
  if (!ir) { els.sheetEmpty.hidden = false; els.sheetEmpty.textContent = 'The view does not resolve — fix the source diagnostics first.'; return; }
  /* Stage-frame helpers shared by the add/reparent hooks. */
  const frameOfStage = stageUid => ((ir.view && ir.view.frames) || []).find(f => f.scope === stageUid);
  const frameLocalId = f => f.id.split('.').pop();
  state.sheet = SHT.RENDERERS[sheet.id]({ outline: els.sheetOutline, editor: els.sheetEditor }, {
    ir: () => { try { return state.ws.resolve(state.entry, state.view); } catch { return ir; } },
    guided: sheetGuided,
    descriptors: () => FORM_DESCRIPTORS,
    selectedUid: () => state.selected,
    select: selectFromSheet,
    candidates: () => ir.elements.map(n => ({ ref: n.ref || n.local, label: n.name, kind: n.kind })),
    addElement(kind, intoStage, opts) {
      const cur = state.ws.resolve(state.entry, state.view);
      const id = (opts && opts.id) || freshLocalId(cur.elements.map(n => n.id), kind);
      const label = (A.kinds.find(k => k.id === kind) || {}).label || kind;
      A.authoring.addElement(state.ws, state.entry, state.view, { id, name: (opts && opts.name) || 'New ' + label.toLowerCase(), kind });
      const after = state.ws.resolve(state.entry, state.view);
      const uid = after.elements.map(n => n.id).find(u => u === id || u.endsWith('.' + id)) || id;
      if (kind === 'cmmn.stage') {
        A.authoring.addFrame(state.ws, state.entry, state.view, { id: id + '_f', name: 'New ' + label.toLowerCase(), scopeUid: uid });
      } else if (intoStage) {
        const f = frameOfStage(intoStage);
        if (f) A.authoring.setFrameMembers(state.ws, state.entry, state.view, frameLocalId(f), [...f.members, uid]);
      }
      if (kind === 'cmmn.sentry') A.authoring.setElementExtension(state.ws, state.entry, state.view, uid, 'x_sentry', { on: 'entry' });
      selectFromSheet(uid);
    },
    reparent(uid, stageUid) {
      const cur = state.ws.resolve(state.entry, state.view);
      for (const f of (cur.view.frames || [])) {
        if (f.members.includes(uid)) A.authoring.setFrameMembers(state.ws, state.entry, state.view, frameLocalId(f), f.members.filter(m => m !== uid));
      }
      if (stageUid) {
        const f = frameOfStage(stageUid);
        if (!f) throw Object.assign(new Error('That stage has no frame in this view.'), { code: 'DDN-E002' });
        const fresh = state.ws.resolve(state.entry, state.view);
        const ff = (fresh.view.frames || []).find(x => x.scope === stageUid);
        A.authoring.setFrameMembers(state.ws, state.entry, state.view, frameLocalId(ff), [...ff.members, uid]);
      }
    },
    removeFromStage(uid) {
      const cur = state.ws.resolve(state.entry, state.view);
      for (const f of (cur.view.frames || [])) {
        if (f.members.includes(uid)) A.authoring.setFrameMembers(state.ws, state.entry, state.view, frameLocalId(f), f.members.filter(m => m !== uid));
      }
    },
    deleteItem(uid) { A.authoring.deleteDefinition(state.ws, state.entry, state.view, uid); },
    setExtension(uid, key, rec) { A.authoring.setElementExtension(state.ws, state.entry, state.view, uid, key, rec); },
    /* Phase 6a hooks (UML structure/activity/sequence, BPMN, patent bodies). */
    setRelationExtension(uid, key, rec) { A.authoring.setRelationExtension(state.ws, state.entry, state.view, uid, key, rec); },
    setProperty(uid, key, v) { A.authoring.setProperty(state.ws, state.entry, state.view, uid, key, v); },
    setLabel(uid, label) { A.authoring.setLabel(state.ws, state.entry, state.view, uid, label); },
    addMember(uid, member) { A.authoring.addField(state.ws, state.entry, state.view, uid, member); },
    refFor(uid, siteUid) { return A.authoring.referenceFor(state.ws, state.entry, state.view, uid, siteUid); },
    plan() { return state.ws.projectionPlan(state.entry, state.view); },
    moveDeclaration(uid, beforeUid) { A.authoring.moveDeclaration(state.ws, state.entry, state.view, uid, beforeUid); },
    addSequenceMessage(args) {
      const cur = state.ws.resolve(state.entry, state.view);
      const id = args.id || freshLocalId(cur.relations.map(r => r.id), 'msg');
      A.authoring.addSequenceMessage(state.ws, state.entry, state.view, { ...args, id });
    },
    hide(uid) { A.authoring.hide(state.ws, state.entry, state.view, uid); },
    selectInView(uid) { A.authoring.selectInView(state.ws, state.entry, state.view, uid); },
    setNumerals(assignments) { A.authoring.setNumerals(state.ws, state.entry, state.view, assignments); },
    setFrameProperties(frameId, props) { A.authoring.setFrameProperties(state.ws, state.entry, state.view, frameId, props); },
    addLane(args) { A.authoring.addFrame(state.ws, state.entry, state.view, args); },
    /* Lane assignment with the one-lane policy + x_partition maintenance
     * (uml.activity@1; DDN-PJ114 is re-checked by the commit-time build). */
    assignToLane(frameLocalId, uid) {
      const cur = state.ws.resolve(state.entry, state.view);
      const frames = (cur.view.frames || []);
      const local = f => String(f.id).split('::').pop().split('.').pop();
      const plan = SHT.laneMembersPlan(frames, frameLocalId, uid, true);
      for (const w of plan.writes) A.authoring.setFrameMembers(state.ws, state.entry, state.view, w.frameId, w.members);
      A.authoring.setElementExtension(state.ws, state.entry, state.view, uid, 'x_partition', { lane: frameLocalId });
    },
    unassignFromLane(frameLocalId, uid) {
      const cur = state.ws.resolve(state.entry, state.view);
      const plan = SHT.laneMembersPlan((cur.view.frames || []), frameLocalId, uid, false);
      for (const w of plan.writes) A.authoring.setFrameMembers(state.ws, state.entry, state.view, w.frameId, w.members);
      A.authoring.setElementExtension(state.ws, state.entry, state.view, uid, 'x_partition', undefined);
    },
    /* Phase 6b hooks (matrix/chart/timeline/decision/fishbone/panels bodies). */
    setProjection(key, value) { A.authoring.setProjectionProperty(state.ws, state.entry, state.view, key, value); },
    setMatrixCells(changes) { A.authoring.setMatrixCells(state.ws, state.entry, state.view, changes); },
    setRecordValue(uid, key, value) { A.authoring.setRecordValue(state.ws, state.entry, state.view, uid, key, value); },
    capabilities() { return A.inspect(state.entry, state.view).capabilities; },
    views() { return state.ws.views(state.entry); },
    openView(viewId) {
      const idx = (state.viewList || []).findIndex(v => v.entry === state.entry && v.view === viewId);
      if (idx < 0) throw Object.assign(new Error('View ' + viewId + ' is not declared in this workspace.'), { code: 'DDN-E002' });
      state.view = viewId;
      mount();
      syncUrl();
    },
    evaluateDecision(input) { return state.ws.evaluateDecision(state.entry, state.view, input); },
    /* Resolved-IR refs are module-qualified uids; the projection group needs
     * the view file's source form (alias-aware path). */
    sourceRefs(uids) { return uids.map(uid => ({ $ref: A.authoring.referenceFor(state.ws, state.entry, state.view, uid) })); },
    addChartRecord() {
      const cur = state.ws.resolve(state.entry, state.view);
      const p = cur.view.profiles.projection;
      const byId = new Map(cur.elements.map(n => [n.id, n]));
      const first = (p.records || []).map(r => byId.get(r.$ref)).find(n => n && n.properties.x_record && typeof n.properties.x_record === 'object');
      if (!first) throw Object.assign(new Error('No bound record with an x_record object to clone the key set from. Nothing was changed.'), { code: 'DDN-E006' });
      const skeleton = {};
      for (const [k, v] of Object.entries(first.properties.x_record)) skeleton[k] = k === 'unit' ? v : typeof v === 'number' ? 0 : '';
      const id = freshLocalId(cur.elements.map(n => n.id), 'record');
      A.authoring.addElement(state.ws, state.entry, state.view, { id, name: 'New record', kind: 'record' });
      const after = state.ws.resolve(state.entry, state.view);
      const uid = after.elements.map(n => n.id).find(u => u === id || u.endsWith('.' + id));
      A.authoring.setProperty(state.ws, state.entry, state.view, uid, 'x_record', skeleton);
      A.authoring.setProjectionProperty(state.ws, state.entry, state.view, 'records',
        [...(p.records || []).map(r => r.$ref), uid].map(u => ({ $ref: A.authoring.referenceFor(state.ws, state.entry, state.view, u) })));
      selectFromSheet(uid);
    },
    deleteChartRecord(uid) {
      const cur = state.ws.resolve(state.entry, state.view);
      const p = cur.view.profiles.projection;
      const kept = (p.records || []).map(r => r.$ref).filter(u => u !== uid);
      A.authoring.setProjectionProperty(state.ws, state.entry, state.view, 'records',
        kept.map(u => ({ $ref: A.authoring.referenceFor(state.ws, state.entry, state.view, u) })));
      dropSelectRef(uid);
      A.authoring.deleteDefinition(state.ws, state.entry, state.view, uid);
    },
    addTimelineRecord({ id, label, start, end, keys }) {
      A.authoring.addElement(state.ws, state.entry, state.view, { id, name: label, kind: 'record' });
      const after = state.ws.resolve(state.entry, state.view);
      const uid = after.elements.map(n => n.id).find(u => u === id || u.endsWith('.' + id));
      A.authoring.setProperty(state.ws, state.entry, state.view, uid, 'x_record', { [keys.start]: start, [keys.end]: end });
      const p = state.ws.resolve(state.entry, state.view).view.profiles.projection;
      A.authoring.setProjectionProperty(state.ws, state.entry, state.view, 'records',
        [...(p.records || []).map(r => r.$ref), uid].map(u => ({ $ref: A.authoring.referenceFor(state.ws, state.entry, state.view, u) })));
      selectFromSheet(uid);
    },
    linkTimelineDependency({ name, from, to }) {
      const cur = state.ws.resolve(state.entry, state.view);
      const id = freshLocalId(cur.relations.map(r => r.id), 'precedes');
      A.authoring.addRelation(state.ws, state.entry, state.view, { id, name, kind: 'analysis.precedes', from, to });
      const after = state.ws.resolve(state.entry, state.view);
      const rid = after.relations.map(r => r.id).find(u => u === id || u.endsWith('.' + id));
      const p = after.view.profiles.projection;
      A.authoring.setProjectionProperty(state.ws, state.entry, state.view, 'dependencies',
        [...(p.dependencies || []).map(r => r.$ref), rid].map(u => ({ $ref: A.authoring.referenceFor(state.ws, state.entry, state.view, u) })));
    },
    unlinkTimelineDependency(relationId) {
      const cur = state.ws.resolve(state.entry, state.view);
      const p = cur.view.profiles.projection;
      const kept = (p.dependencies || []).map(r => r.$ref).filter(u => u !== relationId);
      A.authoring.setProjectionProperty(state.ws, state.entry, state.view, 'dependencies',
        kept.length ? kept.map(u => ({ $ref: A.authoring.referenceFor(state.ws, state.entry, state.view, u) })) : undefined);
    },
    reorderDecisionRules(orderedIds) {
      A.authoring.setProjectionProperty(state.ws, state.entry, state.view, 'records',
        orderedIds.map(u => ({ $ref: A.authoring.referenceFor(state.ws, state.entry, state.view, u) })));
    },
    addDecisionRule({ id, label, then }) {
      A.authoring.addElement(state.ws, state.entry, state.view, { id, name: label, kind: 'rule.row' });
      const after = state.ws.resolve(state.entry, state.view);
      const uid = after.elements.map(n => n.id).find(u => u === id || u.endsWith('.' + id));
      A.authoring.setProperty(state.ws, state.entry, state.view, uid, 'x_rule', { when: {}, then });
      const p = state.ws.resolve(state.entry, state.view).view.profiles.projection;
      A.authoring.setProjectionProperty(state.ws, state.entry, state.view, 'records',
        [...(p.records || []).map(r => r.$ref), uid].map(u => ({ $ref: A.authoring.referenceFor(state.ws, state.entry, state.view, u) })));
      selectFromSheet(uid);
    },
    deleteDecisionRule(ruleId) {
      const cur = state.ws.resolve(state.entry, state.view);
      const p = cur.view.profiles.projection;
      const kept = (p.records || []).map(r => r.$ref).filter(u => u !== ruleId);
      A.authoring.setProjectionProperty(state.ws, state.entry, state.view, 'records',
        kept.map(u => ({ $ref: A.authoring.referenceFor(state.ws, state.entry, state.view, u) })));
      dropSelectRef(ruleId);
      A.authoring.deleteDefinition(state.ws, state.entry, state.view, ruleId);
    },
    addFishboneCategory({ id, label }) {
      const cur = state.ws.resolve(state.entry, state.view);
      const p = cur.view.profiles.projection;
      const plan = state.ws.projectionPlan(state.entry, state.view);
      if (plan.categories.length >= 12) throw Object.assign(new Error('Fishbone needs 1..12 root categories'), { code: 'DDN-QF003' });
      A.authoring.addElement(state.ws, state.entry, state.view, { id, name: label, kind: 'quality.category' });
      const after = state.ws.resolve(state.entry, state.view);
      const uid = after.elements.map(n => n.id).find(u => u === id || u.endsWith('.' + id));
      A.authoring.addRelation(state.ws, state.entry, state.view, { id: id + '_to_effect', name: 'Possible cause category', kind: p.relation, from: uid, to: plan.effect.id });
      selectFromSheet(uid);
    },
    addFishboneCause({ id, label, parentId }) {
      const cur = state.ws.resolve(state.entry, state.view);
      const p = cur.view.profiles.projection;
      A.authoring.addElement(state.ws, state.entry, state.view, { id, name: label, kind: 'quality.cause' });
      const after = state.ws.resolve(state.entry, state.view);
      const uid = after.elements.map(n => n.id).find(u => u === id || u.endsWith('.' + id));
      A.authoring.addRelation(state.ws, state.entry, state.view, { id: 'c_' + id, name: 'Possible contributing cause', kind: p.relation, from: uid, to: parentId });
      selectFromSheet(uid);
    },
    attachExistingCause({ causeId, parentId }) {
      const cur = state.ws.resolve(state.entry, state.view);
      const p = cur.view.profiles.projection;
      const el2 = cur.elements.find(n => n.id === causeId);
      if (!el2 || !['quality.cause', 'quality.category'].includes(el2.kind)) throw Object.assign(new Error('Only an existing cause or category definition can be attached to a second branch — reuse never clones the definition.'), { code: 'DDN-E006' });
      if (causeId === parentId) throw Object.assign(new Error('A rib cannot attach a definition to itself.'), { code: 'DDN-UI20' });
      const id = freshLocalId(cur.relations.map(r => r.id), 'attach');
      A.authoring.addRelation(state.ws, state.entry, state.view, { id, name: 'Same cause, second appearance', kind: p.relation, from: causeId, to: parentId });
    },
    removeFishboneCause(relationId) { A.authoring.deleteDefinition(state.ws, state.entry, state.view, relationId); },
    /* Panels: the whole replacement set as one projection.panels write; items
     * are uids or {$ref:uid} records, view is a view id or {$ref}. */
    setPanels(candidate) {
      const norm = v => {
        const out = { id: String(v.id), title: v.title, row: v.row, column: v.column, rowspan: v.rowspan ?? 1, colspan: v.colspan ?? 1 };
        if (v.view !== undefined) out.view = { $ref: String(v.view && v.view.$ref !== undefined ? v.view.$ref : v.view).split('::').pop() };
        else out.items = (v.items || []).map(r => ({ $ref: A.authoring.referenceFor(state.ws, state.entry, state.view, String(r && r.$ref !== undefined ? r.$ref : r)) }));
        return out;
      };
      A.authoring.setProjectionProperty(state.ws, state.entry, state.view, 'panels', candidate.map(norm));
    },
    addPanelItem({ panelId, id, label, description }) {
      A.authoring.addElement(state.ws, state.entry, state.view, { id, name: label, kind: 'note' });
      const after = state.ws.resolve(state.entry, state.view);
      const uid = after.elements.map(n => n.id).find(u => u === id || u.endsWith('.' + id));
      if (description !== undefined) A.authoring.setProperty(state.ws, state.entry, state.view, uid, 'description', description);
      const p = state.ws.resolve(state.entry, state.view).view.profiles.projection;
      const panels = (p.panels || []).map(v => v.id === panelId ? { ...v, items: [...(v.items || []).map(r => r.$ref), uid] } : v);
      this.setPanels(panels);
      selectFromSheet(uid);
    },
    addPanel({ id, title, row, column, firstItem }) {
      const noteId = id + '_note';
      A.authoring.addElement(state.ws, state.entry, state.view, { id: noteId, name: firstItem, kind: 'note' });
      const after = state.ws.resolve(state.entry, state.view);
      const uid = after.elements.map(n => n.id).find(u => u === noteId || u.endsWith('.' + noteId));
      const p = state.ws.resolve(state.entry, state.view).view.profiles.projection;
      this.setPanels([...(p.panels || []), { id, title, row, column, items: [uid] }]);
      selectFromSheet(uid);
    }
  });
}

/* "Used in n views" (spec 03 selection header): every workspace view whose
 * resolved model contains the definition uid. Resolving every view can fail
 * per view (broken sibling view) — those views are skipped, never fatal. */
function viewUsageList(uid) {
  const views = [];
  for (const e of state.ws.entries()) for (const v of e.views) {
    let ir = null;
    try { ir = state.ws.resolve(e.file, v.id); } catch { continue; }
    views.push({ entry: e.file, view: v.id, ids: [...(ir.elements || []).map(n => n.id), ...(ir.relations || []).map(r => r.id)] });
  }
  return usedInViews(views, uid);
}

function inspector(id, ir, relation) {
  if (!ir) return;
  const node = ir.elements.find(n => n.id === id);
  const fieldItem = ir.elements.flatMap(n => n.fields || []).find(f => f.id === id);
  const item = node || relation || fieldItem;
  if (!item) { els.inspectorControls.hidden = true; els.selectionSummary.textContent = 'Click an object or relation in the diagram.'; return; }
  els.inspectorControls.hidden = true;
  inspectorNote('');
  const multi = multiSelection((state.selectedIds || []).map(u => ({ id: u, kind: null, isRelation: !!ir.relations.find(r => r.id === u) })));
  els.selectionSummary.textContent = multi.count > 1
    ? multi.count + ' items selected — ' + (multi.allElements ? 'elements' : multi.allRelations ? 'relations' : 'mixed elements and relations')
    : item.name + ' · ' + (relation ? 'relationship' : fieldItem ? 'field' : node.kind) + ' — ' + id;
  els.inspectorControls.hidden = false;
  buildMeaningTab(els.inspectorMeaning, id, ir, { node, relation, fieldItem, multi });
  buildViewTab(els.inspectorView, id, ir, { node, relation, fieldItem, multi });
  buildDetailsTab(els.inspectorDetails, id, ir, { node, relation, fieldItem });
}

/* --- shared small builders (local to the inspector; the style/document
 * drawers use their own static descriptor loops) --- */
function inField(parent, label, input) {
  const f = document.createElement('label');
  f.className = 'ddn-field';
  const s = document.createElement('span'); s.textContent = label;
  f.append(s, input);
  parent.append(f);
  return input;
}
function inButton(parent, label, title, fn) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'ddn-mini'; b.textContent = label;
  if (title) b.title = title;
  b.addEventListener('click', () => guard(fn));
  parent.append(b);
  return b;
}
function inNote(parent, text) { const p = dim(text); parent.append(p); return p; }
function goToSource(id) {
  const s = A.authoring.sourceOf(state.ws, state.entry, state.view, id);
  setDrawer('source', 'open', true);
  showSource(s.file, s);
}

/* --- Meaning tab: the shared model definition (spec 03). Edits write the
 * definition in source; the shared-scope impact note appears when the
 * definition is used in more than one view. --- */
function buildMeaningTab(panel, id, ir, ctx) {
  const { node, relation, fieldItem, multi } = ctx;
  panel.replaceChildren();
  const uid = id;
  const usage = viewUsageList(uid);
  const head = document.createElement('p');
  head.className = 'ddn-dim';
  head.textContent = 'Used in ' + usage.length + ' view' + (usage.length === 1 ? '' : 's') +
    (usage.length > 1 ? ' — ' + usage.map(u => u.view).join(', ') : '');
  panel.append(head);
  if (usage.length > 1)
    inNote(panel, 'Shared-scope note: edits on this tab rewrite the shared model definition and affect every view that uses it (' + usage.length + ' views). Undo restores the previous source.');
  if (multi.count > 1) {
    inNote(panel, 'Multi-selection (' + multi.count + '): single-identity edits (label, description) are not offered; the inspector never coerces distinct meanings to one value.');
    return;
  }
  const label = document.createElement('input');
  label.type = 'text'; label.value = (node || relation || fieldItem).name || '';
  label.addEventListener('change', () => guidedInspector(() => A.authoring.setLabel(state.ws, state.entry, state.view, uid, label.value)));
  inField(panel, 'Label', label);

  /* Kind / verb. Relations: the verb list is filtered by endpoint-pair
   * legality (phase 2 legalVerbs over the same endpoint contracts the core
   * validator enforces); when no registered verb admits the pair the full
   * list stays with a note — filtering is advisory, source stays permissive.
   * Elements: the full registered kind list (capability-agnostic here — this
   * tab edits the shared definition, not the palette offer). */
  if (!fieldItem) {
    const choices = relation ? A.relations : A.kinds;
    let options = choices, note = '';
    if (relation) {
      const fromKind = (ir.elements.find(n => n.id === relation.from.element) || {}).kind;
      const toKind = (ir.elements.find(n => n.id === relation.to.element) || {}).kind;
      const legal = fromKind && toKind ? A.legalVerbs(fromKind, toKind) : [];
      if (legal.length) options = choices.filter(r => legal.includes(r.id));
      else note = 'No registered verb admits ' + (fromKind || '?') + ' → ' + (toKind || '?') + ' — showing all installed verbs; the source validator will judge.';
      if (!options.some(r => r.id === relation.kind)) options = choices; // current verb must stay selectable
    }
    const kind = selectInput(options.map(k => [k.id, k.label + ' (' + k.id + ')']), 'Kind');
    kind.value = (node || relation).kind || '';
    kind.addEventListener('change', () => guidedInspector(() => A.authoring.setProperty(state.ws, state.entry, state.view, uid, 'kind', kind.value)));
    inField(panel, relation ? 'Verb' : 'Kind', kind);
    if (note) inNote(panel, note);
  }

  const desc = document.createElement('input');
  desc.type = 'text'; desc.placeholder = 'blank = removed';
  desc.value = typeof ((node || relation || fieldItem).properties || {}).description === 'string' ? (node || relation || fieldItem).properties.description : '';
  desc.addEventListener('change', () => guidedInspector(() => A.authoring.setProperty(state.ws, state.entry, state.view, uid, 'description', desc.value.trim() || undefined)));
  inField(panel, 'Description', desc);

  if (node) {
    /* Icon (x_icon) — a real model property persisted in source. */
    const xi = node.properties && node.properties.x_icon;
    const row = document.createElement('div'); row.className = 'ddn-row';
    const cur = document.createElement('span'); cur.className = 'ddn-dim';
    cur.textContent = xi ? xi.library + '/' + xi.icon : 'none';
    inButton(row, 'Browse icons…', 'Bind an icon to this element (x_icon)', () => { buildIconPicker(); els.iconPopup.hidden = !els.iconPopup.hidden; if (!els.iconPopup.hidden) els.iconSearch.focus(); });
    inButton(row, 'Clear icon', 'Remove x_icon', () => guidedInspector(() => A.authoring.setProperty(state.ws, state.entry, state.view, uid, 'x_icon', undefined)));
    const f = document.createElement('div');
    const lab = document.createElement('span'); lab.textContent = 'Icon: ';
    f.append(lab, cur, row);
    panel.append(f);

    /* Fields list (shared definition members). */
    const fields = node.fields || [];
    if (fields.length) {
      const h = document.createElement('h4'); h.textContent = 'Fields';
      panel.append(h);
      const ul = document.createElement('ul'); ul.className = 'ddn-fields-list';
      for (const fld of fields) {
        const li = document.createElement('li');
        li.textContent = (fld.name || fld.local) + (fld.properties && fld.properties.datatype ? ' : ' + fld.properties.datatype : '');
        ul.append(li);
      }
      panel.append(ul);
    }
    const af = document.createElement('div'); af.className = 'ddn-row';
    const afId = document.createElement('input'); afId.type = 'text'; afId.placeholder = 'field_id'; afId.setAttribute('aria-label', 'New field identifier');
    const afName = document.createElement('input'); afName.type = 'text'; afName.placeholder = 'display name (optional)'; afName.setAttribute('aria-label', 'New field name');
    inButton(af, 'Add field', 'Add a field member to this definition', () => {
      if (!afId.value.trim()) { inspectorNote('A field needs a stable identifier.'); return; }
      guidedInspector(() => A.authoring.addField(state.ws, state.entry, state.view, uid, { id: afId.value.trim(), name: afName.value.trim() }));
    });
    af.append(afId, afName);
    panel.append(af);
  }

  if (relation) buildRelationMeaning(panel, relation, ir);

  /* Source location + definition actions. */
  let src = null;
  try { src = A.authoring.sourceOf(state.ws, state.entry, state.view, uid); } catch { /* preset-expanded */ }
  if (src) inNote(panel, 'Source: ' + src.file + ':' + src.start + ' (' + src.type + ' ' + src.id + ')');
  const actions = document.createElement('div'); actions.className = 'ddn-row';
  if (node) inButton(actions, 'Duplicate', 'Duplicate — a new element with a fresh uid (unconnected, no numeral); the original is untouched', () => {
    guidedInspector(() => {
      A.authoring.duplicate(state.ws, state.entry, state.view, uid);
      const after = state.ws.resolve(state.entry, state.view);
      const copy = after.elements.map(n => n.id).filter(u => /_copy\d*$/.test(u)).sort().at(-1);
      if (copy) { state.selected = copy; state.selectedRelation = null; state.selectedIds = [copy]; }
      status('duplicated as ' + (copy || 'a new uid') + ' — new identity, unconnected; ref: anchors still point at the original');
    });
  });
  inButton(actions, 'Go to source', 'Open the Source drawer at this definition', () => goToSource(uid));
  inButton(actions, 'Delete', 'Delete this semantic definition (referenced definitions are blocked; use Hide for appearance-only removal)', () => {
    if (confirm('Delete this semantic definition? Referenced definitions are blocked; use Hide for appearance-only removal.'))
      guidedInspector(() => A.authoring.deleteDefinition(state.ws, state.entry, state.view, uid));
  });
  panel.append(actions);
}

/* Relation meaning controls (spec 05 cardinality / spec 07): verb above, plus
 * cardinality min/max per endpoint with a live sentence preview, enforcement,
 * scope, and the visual endpoint marks. UML association ends (uml.structure@2
 * or an existing x_endlabels) get role/multiplicity/qualifier per end writing
 * x_endlabels.source/target — DDN-PJ149 is the commit-time authority and its
 * coded errors surface in the inspector error slot. */
function buildRelationMeaning(panel, relation, ir) {
  const uid = relation.id;
  const props = relation.properties || {};
  const fromEl = ir.elements.find(n => n.id === relation.from.element);
  const toEl = ir.elements.find(n => n.id === relation.to.element);
  const fromName = (fromEl && fromEl.name) || relation.from.element;
  const toName = (toEl && toEl.name) || relation.to.element;

  const h = document.createElement('h4'); h.textContent = 'Cardinality';
  panel.append(h);
  const sentence = inNote(panel, '');
  sentence.className = 'ddn-cardinality-preview';
  const nums = {};
  const preview = () => {
    const card = {
      source_min: nums.source_min.value === '' ? undefined : Number(nums.source_min.value),
      source_max: nums.source_max.value === '' ? undefined : Number(nums.source_max.value),
      target_min: nums.target_min.value === '' ? undefined : Number(nums.target_min.value),
      target_max: nums.target_max.value === '' ? undefined : Number(nums.target_max.value)
    };
    /* Seed from the visual marks when no numeric bounds are asserted, so a
     * crow's-foot diagram still explains itself. */
    if (card.source_min === undefined && card.source_max === undefined) Object.assign(card, markCardinality(props.source_mark) ? { source_min: markCardinality(props.source_mark).min, source_max: markCardinality(props.source_mark).max } : {});
    if (card.target_min === undefined && card.target_max === undefined) Object.assign(card, markCardinality(props.target_mark) ? { target_min: markCardinality(props.target_mark).min, target_max: markCardinality(props.target_mark).max } : {});
    sentence.textContent = cardinalitySentence(fromName, toName, card) || 'No cardinality asserted — endpoint marks below are the visual shorthand; min/max bounds are optional refinements.';
  };
  const commitCard = () => guidedInspector(() => A.authoring.setRelationProps(state.ws, state.entry, state.view, uid, {
    source_min: nums.source_min.value === '' ? undefined : Number(nums.source_min.value),
    source_max: nums.source_max.value === '' ? undefined : Number(nums.source_max.value),
    target_min: nums.target_min.value === '' ? undefined : Number(nums.target_min.value),
    target_max: nums.target_max.value === '' ? undefined : Number(nums.target_max.value)
  }));
  for (const [end, label] of [['source', fromName], ['target', toName]]) {
    const row = document.createElement('div'); row.className = 'ddn-card-row';
    const tag = document.createElement('span'); tag.className = 'ddn-dim'; tag.textContent = end;
    row.append(tag);
    for (const bound of ['min', 'max']) {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = 0; inp.max = 1000000; inp.step = 1;
      inp.placeholder = bound + ' (blank = unset)';
      inp.setAttribute('aria-label', end + ' ' + bound + ' for ' + label);
      const v = props[end + '_' + bound];
      inp.value = typeof v === 'number' ? String(v) : '';
      inp.addEventListener('input', preview);
      inp.addEventListener('change', commitCard);
      nums[end + '_' + bound] = inp;
      row.append(inp);
    }
    panel.append(row);
  }
  preview();

  const enf = selectInput([['', 'Not asserted'], ['database', 'database'], ['application', 'application'], ['expected', 'expected'], ['none', 'none']], 'Enforcement');
  enf.value = typeof props.enforcement === 'string' ? props.enforcement : '';
  enf.addEventListener('change', () => guidedInspector(() => A.authoring.setRelationProps(state.ws, state.entry, state.view, uid, { enforcement: enf.value || undefined })));
  inField(panel, 'Enforcement', enf);

  const scope = document.createElement('input');
  scope.type = 'text'; scope.placeholder = 'blank = not asserted';
  scope.value = typeof props.scope === 'string' ? props.scope : '';
  scope.addEventListener('change', () => guidedInspector(() => A.authoring.setRelationProps(state.ws, state.entry, state.view, uid, { scope: scope.value.trim() || undefined })));
  inField(panel, 'Scope', scope);

  const mh = document.createElement('h4'); mh.textContent = 'Endpoint marks (visual shorthand)';
  panel.append(mh);
  for (const end of ['source', 'target']) {
    const sel = selectInput([['', 'Not asserted'], ...ENDPOINT_MARKS.map(m => [m, m])], end + ' mark');
    sel.value = typeof props[end + '_mark'] === 'string' ? props[end + '_mark'] : '';
    sel.addEventListener('change', () => guidedInspector(() => A.authoring.setRelationProps(state.ws, state.entry, state.view, uid, { [end + '_mark']: sel.value || undefined })));
    inField(panel, (end === 'source' ? fromName : toName) + ' end mark', sel);
  }

  /* UML association ends (spec 05): uml.structure@2 views, or any relation
   * already carrying x_endlabels. role/multiplicity/qualifier per end, merged
   * into x_endlabels.source/target; DDN-PJ149 judges the result at commit. */
  const proj = viewProjection();
  const isUmlEnds = !!props.x_endlabels || (proj.profile === 'uml.structure@2' && ['uml.association', 'uml.commpath', 'uml.connector', 'uml.link'].includes(relation.kind));
  if (isUmlEnds) {
    const uh = document.createElement('h4'); uh.textContent = 'UML association ends (x_endlabels)';
    panel.append(uh);
    inNote(panel, 'Multiplicity grammar: 1, 0..1, 0..*, 1..*, * (DDN-PJ149 judges at commit). Role and qualifier are free text.');
    const ends = props.x_endlabels || {};
    const inputs = {};
    const commitEnds = () => {
      const rec = {};
      for (const end of ['source', 'target']) {
        const role = inputs[end].role.value.trim(), mult = inputs[end].multiplicity.value.trim(), qual = inputs[end].qualifier.value.trim();
        if (mult && !umlMultiplicityOk(mult)) { inspectorNote('DDN-PJ149 grammar: multiplicity must be 1, 0..1, 0..*, 1..* or * (got "' + mult + '").'); return; }
        const cur = ends[end] || {};
        const merged = {};
        if (role) merged.role = role;
        if (mult) merged.multiplicity = mult;
        if (qual) merged.qualifier = qual;
        rec[end] = (role || mult || qual) ? merged : (cur.role || cur.multiplicity || cur.qualifier ? null : undefined);
      }
      const write = {};
      for (const end of ['source', 'target']) if (rec[end] !== undefined) write[end] = rec[end];
      if (!Object.keys(write).length) return;
      guidedInspector(() => A.authoring.setRelationExtension(state.ws, state.entry, state.view, uid, 'x_endlabels', write));
    };
    for (const end of ['source', 'target']) {
      const cur = ends[end] || {};
      const box = document.createElement('div'); box.className = 'ddn-end-box';
      const eh = document.createElement('h5'); eh.textContent = end + ' — ' + (end === 'source' ? fromName : toName);
      box.append(eh);
      inputs[end] = {};
      const mk = (label, key, placeholder) => {
        const inp = document.createElement('input');
        inp.type = 'text'; inp.placeholder = placeholder; inp.value = typeof cur[key] === 'string' ? cur[key] : '';
        inp.addEventListener('change', commitEnds);
        inputs[end][key] = inp;
        inField(box, label, inp);
      };
      mk('Role', 'role', 'role name (blank = unset)');
      mk('Multiplicity', 'multiplicity', '1, 0..1, 0..*, 1..*, *');
      mk('Qualifier', 'qualifier', 'qualifier (blank = unset)');
      panel.append(box);
    }
  }
}

/* --- This view tab: occurrence-level state (spec 03). Pin/unpin and hide
 * write per-view place/exclude records; the relation routing override is the
 * session-preview channel (never written to source from here). --- */
function buildViewTab(panel, id, ir, ctx) {
  const { node, relation, multi } = ctx;
  panel.replaceChildren();
  inNote(panel, 'Occurrence state in view "' + state.view + '" — never touches the shared definition.');
  if (multi.count > 1) {
    inNote(panel, 'Multi-selection (' + multi.count + '): pin/hide apply per occurrence and are shown for single selections only; nothing is coerced across the selection.');
    return;
  }
  const noGraph = state.diagram && state.diagram.capabilities && state.diagram.capabilities.graphControls === false;
  if (node) {
    const g = state.diagram && state.diagram.result && state.diagram.result.scene.nodes && state.diagram.result.scene.nodes.find(n => n.id === id);
    const row = document.createElement('div'); row.className = 'ddn-row';
    const px = document.createElement('input'); px.type = 'number'; px.step = 1; px.value = g ? Math.round(g.x) : 0; px.setAttribute('aria-label', 'Pin x (px)');
    const py = document.createElement('input'); py.type = 'number'; py.step = 1; py.value = g ? Math.round(g.y) : 0; py.setAttribute('aria-label', 'Pin y (px)');
    row.append(px, py);
    panel.append(row);
    const brow = document.createElement('div'); brow.className = 'ddn-row';
    const pinB = inButton(brow, 'Pin', 'Pin this occurrence at x,y in the source view', () => guidedInspector(() => A.authoring.pin(state.ws, state.entry, state.view, id, Number(px.value), Number(py.value))));
    const unpinB = inButton(brow, 'Unpin', 'Remove the place pin for this occurrence', () => guidedInspector(() => A.authoring.unpin(state.ws, state.entry, state.view, id)));
    const hideB = inButton(brow, 'Hide', 'Exclude this occurrence from this view (appearance-only; the definition stays)', () => guidedInspector(() => A.authoring.hide(state.ws, state.entry, state.view, id)));
    for (const b of [pinB, unpinB, hideB]) b.disabled = !!noGraph;
    if (noGraph) inNote(panel, 'This projection fixes coordinates and content — occurrence pin/hide is unavailable here.');
    panel.append(brow);
  } else if (relation) {
    const sel = selectInput(routingOptions(), 'routing for relation ' + id);
    sel.value = state.presentation.relationRouting[id] || 'source';
    sel.addEventListener('change', () => {
      if (sel.value === 'source') delete state.presentation.relationRouting[id];
      else state.presentation.relationRouting[id] = sel.value;
      rerender();
    });
    inField(panel, 'Routing (session preview)', sel);
    inNote(panel, 'Session preview only — saved appearance writes go through Style & Layout → Get source, or a route record in source.');
    const brow = document.createElement('div'); brow.className = 'ddn-row';
    inButton(brow, 'Hide', 'Exclude this relation from this view (appearance-only; the definition stays)', () => guidedInspector(() => A.authoring.hide(state.ws, state.entry, state.view, id)));
    panel.append(brow);
  } else {
    inNote(panel, 'Fields have no per-view occurrence state of their own; pin/hide the owning element.');
  }
}

/* --- Details tab (phase 4): the read-only grouped display is replaced by a
 * descriptor-driven EDITABLE form generated from FORM_DESCRIPTORS (the
 * generated registry: standard/registry/data-properties.json property
 * contracts + ddn-profiles.js closed x_* extension contracts, stamped by
 * designer/contracts/build-form-descriptors.mjs). Grouping follows the
 * registry's groups; kind/description stay on the Meaning tab; asserted
 * properties with no descriptor (free-form extensions) render read-only with
 * an explicit Remove. Every commit is one guided, undoable
 * authoring.setElementProperties transaction; coded errors land adjacent to
 * the control (and in the inspector error slot). Removing a property is
 * distinct from blanking it: a blank draft commits `undefined` (removal),
 * never an empty value. --- */
function buildDetailsTab(panel, id, ir, ctx) {
  const { relation, fieldItem } = ctx;
  panel.replaceChildren();
  let src = null;
  try { src = A.authoring.sourceOf(state.ws, state.entry, state.view, id); } catch { /* preset-expanded */ }
  if (!src) { inNote(panel, 'This declaration has no editable source of its own (expanded from a shared definition); edit the definition in source.'); return; }
  const target = relation ? 'relation' : fieldItem ? 'field' : 'element';
  const proj = (ir.view && ir.view.profiles && ir.view.profiles.projection) || {};
  const capabilities = [proj.profile, proj.kind].filter(Boolean);
  const ownedByMeaning = ['kind', 'description'];
  const visible = descriptorsForTarget(FORM_DESCRIPTORS, target, { props: src.properties, capabilities })
    .filter(d => !ownedByMeaning.includes(d.key));
  if (visible.length) {
    inNote(panel, 'Generated from the property registry (data-properties.json ' + '0.3 + extension contracts) — label, kind and description edit on the Meaning tab. Blank a control or use Remove to delete a property from the source.');
    const form = FRM.renderForm(panel, visible, {
      scopeLabel: 'Model property (saved to source)',
      getValue: d => src.properties[d.key],
      candidates: () => ir.elements.map(n => ({ ref: n.id, label: n.name, kind: n.kind })),
      note: inspectorNote,
      commit(d, v) {
        flush();
        A.authoring.setElementProperties(state.ws, state.entry, state.view, id, { [d.key]: v });
        showSource(state.currentFile);
        updateHistory();
        inspectorNote('');
        status('source edit applied — undo restores the previous source');
        refreshInspector();
      }
    });
    form.sync();
  }
  const known = new Set(visible.map(d => d.key));
  const extras = Object.entries(src.properties).filter(([k]) => !known.has(k) && !ownedByMeaning.includes(k));
  if (extras.length) {
    const h = document.createElement('h4'); h.textContent = 'Extension and other asserted properties (read-only)';
    panel.append(h);
    const dl = document.createElement('dl'); dl.className = 'ddn-details';
    for (const [k, v] of extras) {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = typeof v === 'string' ? v : JSON.stringify(v);
      const rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'ddn-mini ddn-remove-prop'; rm.textContent = 'Remove';
      rm.title = 'Remove ' + k + ' from the source (distinct from blanking it)';
      rm.addEventListener('click', () => guidedInspector(() => A.authoring.setElementProperties(state.ws, state.entry, state.view, id, { [k]: undefined })));
      dd.append(' ', rm);
      dl.append(dt, dd);
    }
    panel.append(dl);
  }
  if (!visible.length && !extras.length) inNote(panel, 'No properties asserted on this definition.');
  const row = document.createElement('div'); row.className = 'ddn-row';
  inButton(row, 'Edit in source', 'Open the Source drawer at this definition', () => goToSource(id));
  panel.append(row);
}

function guided(action) {
  flush();
  action();
  showSource(state.currentFile);
  updateHistory();
  refreshAfterSourceWrite();
  status('source edit applied — undo restores the previous source');
}
/* Every source-writing drawer control re-renders after its transaction — the
 * write is invisible on the canvas otherwise (the "legend numbers / border
 * does nothing" report: the write landed but the picture only refreshed on
 * the next manual Apply). Mirrors the Apply button idiom; a failed render
 * surfaces through the component's ddn-error event. */
function refreshAfterSourceWrite() {
  if (state.diagram) {
    state.diagram.ready = state.diagram.redraw();
    state.diagram.ready.catch(() => {});
  }
  diagnosticsUI();
}

/* ------------------------------------------------ add element / relation modals
 * Phase 3: the prompt() dialogs are replaced by small modal forms. The element
 * kind list is capability-filtered like the Add palette (an "all installed"
 * note appears when the filter would hide the list); the relation form has
 * source/target pickers and a verb list filtered by endpoint legality. */
function openAddElementModal() {
  if (!graphEditable()) { status('this view is data-bound — add records in the Source drawer instead'); return; }
  const proj = viewProjection();
  let kinds = paletteFilter(A.kinds, proj, false);
  let note = 'Kind list filtered by this view’s capabilities (' + (proj.profile || 'graph') + ').';
  if (!kinds.length) { kinds = A.kinds; note = 'No kind is registered for this view’s capability — showing all installed kinds; the source validator will judge.'; }
  els.aeKind.replaceChildren(...kinds.map(k => new Option(k.label + ' (' + k.id + ')', k.id)));
  els.aeNote.textContent = note;
  let ir = null;
  try { ir = state.ws.resolve(state.entry, state.view); } catch { ir = null; }
  els.aeId.value = freshLocalId(ir ? ir.elements.map(n => n.id) : [], kinds[0] ? kinds[0].id : 'object');
  els.aeName.value = '';
  els.aeModal.hidden = false;
  els.aeName.focus();
}
function openAddRelationModal() {
  if (!graphEditable()) { status('connecting needs a graph projection — this view is data-bound'); return; }
  let ir = null;
  try { ir = state.ws.resolve(state.entry, state.view); } catch { ir = null; }
  const els2 = ir ? ir.elements : [];
  if (els2.length < 1) { status('no elements to connect yet'); return; }
  const opt = n => new Option((n.name || n.id) + ' — ' + n.id, n.id);
  els.arFrom.replaceChildren(...els2.map(opt));
  els.arTo.replaceChildren(...els2.map(opt));
  if (els2.length > 1) els.arTo.value = els2[1].id;
  els.arId.value = freshLocalId(ir.relations.map(r => r.id), 'relation');
  els.arName.value = '';
  populateAddRelationVerbs();
  els.arModal.hidden = false;
  els.arName.focus();
}
function populateAddRelationVerbs() {
  const fromKind = elementKindOf(els.arFrom.value), toKind = elementKindOf(els.arTo.value);
  let ids = fromKind && toKind ? A.legalVerbs(fromKind, toKind) : [];
  let note = '';
  if (!ids.length) {
    ids = A.relations.map(r => r.id);
    note = 'No registered verb admits ' + (fromKind || '?') + ' → ' + (toKind || '?') + ' — showing all installed verbs; the source validator will judge.';
  }
  els.arKind.replaceChildren(...ids.map(id => {
    const r = A.relations.find(x => x.id === id) || { label: id };
    return new Option(r.label + ' (' + id + ')', id);
  }));
  els.arKind.value = ids.includes('assoc') ? 'assoc' : ids[0];
  els.arNote.textContent = note;
  els.arNote.hidden = !note;
}
els.addElement.addEventListener('click', () => guard(openAddElementModal));
els.addRelation.addEventListener('click', () => guard(openAddRelationModal));
els.aeKind.addEventListener('change', () => {
  let ir = null;
  try { ir = state.ws.resolve(state.entry, state.view); } catch { ir = null; }
  els.aeId.value = freshLocalId(ir ? ir.elements.map(n => n.id) : [], els.aeKind.value);
});
els.aeCancel.addEventListener('click', () => { els.aeModal.hidden = true; });
els.arCancel.addEventListener('click', () => { els.arModal.hidden = true; });
els.arFrom.addEventListener('change', populateAddRelationVerbs);
els.arTo.addEventListener('change', populateAddRelationVerbs);
els.aeCreate.addEventListener('click', () => guard(() => {
  const id = els.aeId.value.trim(), name = els.aeName.value.trim() || id, kind = els.aeKind.value;
  if (!id) { status('the element needs a stable identifier'); return; }
  els.aeModal.hidden = true;
  guided(() => {
    A.authoring.addElement(state.ws, state.entry, state.view, { id, name, kind });
    const after = state.ws.resolve(state.entry, state.view);
    const uid = after.elements.map(n => n.id).find(u => u === id || u.endsWith('.' + id)) || id;
    state.selected = uid; state.selectedRelation = null; state.selectedIds = [uid];
    status('added ' + uid + ' — it is selected for further edits');
  });
}));
els.arCreate.addEventListener('click', () => guard(() => {
  const id = els.arId.value.trim(), name = els.arName.value.trim() || id;
  const from = els.arFrom.value, to = els.arTo.value, kind = els.arKind.value;
  if (!id || !from || !to) { status('relation needs an identifier and both endpoints'); return; }
  if (from === to) { status('target must differ from the source'); return; }
  els.arModal.hidden = true;
  guided(() => {
    A.authoring.addRelation(state.ws, state.entry, state.view, { id, name, kind, from, to });
    const after = state.ws.resolve(state.entry, state.view);
    state.selectedRelation = after.relations.map(r => r.id).find(u => u === id || u.endsWith('.' + id)) || id;
    state.selected = null; state.selectedIds = [state.selectedRelation];
    status('connected ' + from + ' → ' + to + ' (' + kind + ') — relation ' + state.selectedRelation);
  });
}));
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!els.aeModal.hidden) els.aeModal.hidden = true;
  if (!els.arModal.hidden) els.arModal.hidden = true;
});

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

/* Palette: capability-filtered (designer phase 2). The active view's resolved
 * projection decides: data-bound projections show no element palette (a hint
 * points to the Source drawer), unprofiled graph views offer the generic kinds
 * grouped by the eight palette groups, and profiled graph views offer the
 * kinds whose allowed_in tags include the profile id. The "all installed"
 * toggle and a non-empty search are the escape hatches; the DDN source itself
 * stays permissive — the palette only filters what it offers. */
function viewProjection() {
  try {
    const ir = state.ws.resolve(state.entry, state.view);
    /* Phase 6a: viewKind joins the dispatch input — patent.legal@1 attaches
     * through the view kind, never the projection profile. */
    return { ...((ir && ir.view.profiles.projection) || { kind: 'graph', profile: 'ddn@1' }), viewKind: ir && ir.view.kind };
  } catch { return { kind: 'graph', profile: 'ddn@1' }; }
}
function paletteItem(k) {
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
}
function buildPalette() {
  const q = els.paletteSearch.value.trim().toLowerCase();
  const dataBound = !graphEditable();
  els.paletteHint.hidden = !dataBound;
  els.paletteSearch.hidden = dataBound;
  els.paletteAllWrap.hidden = dataBound;
  if (dataBound) {
    /* Phase 5: when a Type sheet body is registered for this view's type, the
     * hint names it — the sheet is the structured editing surface for the
     * records and bindings the palette cannot offer. */
    const sheet = sheetForProjection(viewProjection());
    els.paletteHint.textContent = 'This view is generated from data — there is no element palette here. Edit the records and bindings in the Source drawer' +
      (sheet ? ', or in the ' + sheet.label + ' type sheet (bottom drawer).' : '.');
    els.paletteList.replaceChildren();
    return;
  }
  /* A non-empty search is an escape hatch: it scans every installed kind,
   * beyond the capability filter. */
  const kinds = q
    ? A.kinds.filter(k => (k.id + ' ' + k.label + ' ' + k.code).toLowerCase().includes(q))
    : paletteFilter(A.kinds, viewProjection(), els.paletteAll.checked);
  const groups = new Map();
  for (const k of kinds) {
    const name = k.group || (k.id.includes('.') ? k.id.split('.')[0] : 'Other');
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(k);
  }
  const order = (A.capabilities && A.capabilities.paletteGroups) || [];
  const names = [...groups.keys()].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if (ia < 0 && ib < 0) return a.localeCompare(b);
    if (ia < 0) return 1; if (ib < 0) return -1; return ia - ib;
  });
  const out = [];
  for (const name of names) {
    const h = document.createElement('div'); h.className = 'ddn-palette-group'; h.textContent = name;
    out.push(h, ...groups.get(name).map(paletteItem));
  }
  els.paletteList.replaceChildren(...out);
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
els.iconSearch.addEventListener('input', buildIconPicker);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !els.iconPopup.hidden) els.iconPopup.hidden = true; });
els.paletteSearch.addEventListener('input', buildPalette);
els.paletteAll.addEventListener('change', buildPalette);

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
/* Connect verb list: filtered to the verbs whose endpoint contracts admit the
 * picked source/target kinds (designer phase 2 — the same endpoint_contract
 * data as the CLI `verbs --from --to` query, via DDNLive.legalVerbs). When no
 * registered verb admits the pair the full list stays available with a note —
 * the designer filters offers, it never blocks; source text stays permissive. */
function elementKindOf(id) {
  try {
    const ir = state.ws.resolve(state.entry, state.view);
    const el = ir.elements.find(n => n.id === id) || ir.elements.find(n => n.id.endsWith('.' + id));
    return el ? el.kind : null;
  } catch { return null; }
}
function populateConnectVerbs() {
  const fromKind = elementKindOf(design.from), toKind = elementKindOf(design.to);
  let ids = fromKind && toKind ? A.legalVerbs(fromKind, toKind) : A.relations.map(r => r.id);
  let note = '';
  if (!ids.length) {
    ids = A.relations.map(r => r.id);
    note = 'No registered verb admits ' + (fromKind || '?') + ' → ' + (toKind || '?') + ' — showing all installed verbs; the source validator will judge.';
  }
  els.connectVerb.replaceChildren(...ids.map(id => {
    const r = A.relations.find(x => x.id === id) || { label: id };
    return new Option(r.label + ' (' + id + ')', id);
  }));
  els.connectVerb.value = ids.includes('assoc') ? 'assoc' : ids[0];
  els.connectNote.textContent = note;
  els.connectNote.hidden = !note;
}
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
    populateConnectVerbs();
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
  /* The palette button stays live on data-bound projections: the popup shows
   * the "generated from data" hint instead of kinds (designer phase 2). */
  els.paletteToggle.disabled = false;
  els.connect.disabled = !ok;
  els.tidy.disabled = !ok;
  els.paletteToggle.title = ok ? 'Add element — pick a kind, then click on the diagram to place it' : 'Add element — this view is generated from data; the palette explains where to edit instead';
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
  state.selected = null; state.selectedRelation = null; state.selectedIds = [];
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
