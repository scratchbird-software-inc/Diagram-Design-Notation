// SPDX-License-Identifier: GPL-2.0-or-later.
// B1-012 driver scenario: injected by b1-012-designer-chrome.js into a page
// built from the REAL designer/prototype/standalone.html (so the exercised
// chrome can never drift from the shipped one). Runs the chrome acceptance
// flow against the live DOM and writes JSON results into a pre#b1012Result node.
window.addEventListener('load', () => setTimeout(async () => {
  const out = {};
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const P = window.DesignerPrototype, CMD = window.DesignerCommands, D = window.DDNLive;
  const wsEl = document.getElementById('workspace');
  function ptr(el, type, x, y) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerId: 7, clientX: x, clientY: y }));
  }
  try {
    out.api = !!P && !!D.glyphs;

    // D2 density: Compact default, toggle persists, toggle back.
    out.densityDefaultCompact = document.body.dataset.density === 'compact' && P.getState().density === 'compact';
    const baseBtnH = parseFloat(getComputedStyle(document.getElementById('sourceBtn')).minHeight);
    $('#densityToggle').click();
    out.densityToggleComfortable = document.body.dataset.density === 'comfortable' && localStorage.getItem('ddn-designer-density') === 'comfortable';
    const comfyBtnH = parseFloat(getComputedStyle(document.getElementById('sourceBtn')).minHeight);
    out.densitySizesDiffer = baseBtnH === 28 && comfyBtnH === 34;
    $('#densityToggle').click();
    out.densityToggleBack = document.body.dataset.density === 'compact';

    // D4: every button carries a non-empty, descriptive title.
    const untitled = $$('button').filter(b => !(b.title || '').trim());
    out.everyButtonTitled = untitled.length === 0;
    out.paletteTooltip = ($('[data-add="table"]')?.title || '').includes('Add a Table element to the current view');
    out.exportTooltip = $('#exportBtn').title.includes('SVG, PNG, or WebP');
    out.detachTooltip = $('#detachInspector').title.includes('Float this panel');

    // D3: palette buttons render the notation glyph; absent glyph answers null.
    out.paletteGlyph = !!$('[data-add="table"] .glyph svg') && !!$('[data-add="entity"] .glyph svg');
    out.glyphAbsentNull = D.glyphs.forKind('no.such.kind') === null;

    // D5 splitters: synthetic pointer drag, clamp, persistence, double-click reset.
    const split = $('#splitLeft');
    ptr(split, 'pointerdown', 300, 400);
    ptr(split, 'pointermove', 400, 400);
    ptr(split, 'pointerup', 400, 400);
    out.splitterDragLeft = P.getState().widths.left === 330 && wsEl.style.gridTemplateColumns.startsWith('330px 6px');
    out.splitterPersisted = localStorage.getItem('ddn-designer-split-left') === '330';
    ptr(split, 'pointerdown', 400, 400);
    ptr(split, 'pointermove', 2000, 400);
    ptr(split, 'pointerup', 2000, 400);
    out.splitterClamp = P.getState().widths.left === 420;
    split.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    out.splitterReset = P.getState().widths.left === 230;
    const splitR = $('#splitRight');
    ptr(splitR, 'pointerdown', 1200, 400);
    ptr(splitR, 'pointermove', 1100, 400);
    ptr(splitR, 'pointerup', 1100, 400);
    out.splitterDragInspector = P.getState().widths.inspector === 406;
    splitR.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    // D6 detach → float → drag → re-attach with canvas reflow (both panels).
    const canvasW0 = $('.canvas-wrap').offsetWidth;
    $('#detachInspector').click();
    out.detachFloats = $('#inspectorPanel').classList.contains('floating') && P.getState().floating.inspector === true;
    out.detachCollapsesColumn = wsEl.style.gridTemplateColumns.endsWith('0px 0px') && $('#splitRight').hidden;
    out.canvasGrew = $('.canvas-wrap').offsetWidth > canvasW0;
    const bar = $('#inspectorPanel .panel-chrome');
    const x0 = parseFloat($('#inspectorPanel').style.left);
    ptr(bar, 'pointerdown', 900, 130);
    ptr(bar, 'pointermove', 700, 200);
    ptr(bar, 'pointerup', 700, 200);
    out.floatDraggable = Math.abs(parseFloat($('#inspectorPanel').style.left) - x0) >= 150 && parseFloat($('#inspectorPanel').style.top) > 120;
    out.reattachTitle = $('#detachInspector').title.includes('Re-attach');
    P.select('designer.sample::model.customer');
    out.inspectorLiveWhileFloating = $('#inspectorBody').textContent.length > 40;
    $('#detachInspector').click();
    out.reattachRestores = !$('#inspectorPanel').classList.contains('floating') && wsEl.style.gridTemplateColumns.endsWith('6px 306px') && !$('#splitRight').hidden;
    $('#detachLeft').click();
    out.leftFloats = $('#leftPanel').classList.contains('floating') && wsEl.style.gridTemplateColumns.startsWith('0px 0px');
    $('#detachLeft').click();
    out.leftReattaches = !$('#leftPanel').classList.contains('floating') && wsEl.style.gridTemplateColumns.startsWith('230px 6px');
    out.floatNotPersisted = localStorage.getItem('ddn-designer-float-left') === null && localStorage.getItem('ddn-designer-float-inspector') === null;

    // ED-002 interop: a real matrix edit still commits after the full cycle.
    P.setView('raci');
    const rev0 = P.workspace.revision;
    P.transaction('B1-012 driver matrix edit', t => CMD.setMatrixAssignments(D, t, 'projections/views.ddn', 'raci', { changes: [{ rowId: 'meridian.procurement.review::process.order', columnId: 'meridian.procurement.review::roles.warehouse', value: 'C', id: 'order_warehouse_c' }] }));
    out.matrixEditCommits = P.workspace.revision > rev0 && !P.getState().renderFailure;
    out.matrixCellShows = [...$('#matrixSheet').querySelectorAll('.mcell')].some(b => b.textContent.trim() === 'C');

    // D7: sheet collapse toggle collapses and expands the docked sheet.
    const toggle = $('#matrixSheet .sheet-toggle');
    out.sheetTogglePresent = !!toggle && toggle.title.includes('Collapse');
    toggle.click();
    out.sheetCollapses = $('#matrixSheet').classList.contains('collapsed');
    toggle.click();
    out.sheetExpands = !$('#matrixSheet').classList.contains('collapsed');

    // D1: export modal shows DDN/ZIP + SVG/PNG/WebP; raster prefixes are exact in chromium.
    P.setView('overview');
    $('#exportBtn').click();
    const labels = $$('#dialogActions button').map(b => b.textContent);
    out.exportModalFormats = ['Current file (.ddn)', 'Single file — entire workspace (.ddn)', 'ZIP archive (all sources)', 'Current SVG', 'Current PNG (2×)', 'Current WebP (2×)'].every(l => labels.includes(l));
    const webpBtn = $$('#dialogActions button').find(b => b.textContent === 'Current WebP (2×)');
    out.webpEnabledWhenSupported = P.getState().webpSupported ? !webpBtn.disabled : webpBtn.disabled && webpBtn.title.includes('not supported');
    $('#dialogClose').click();
    const svg = P.getState().result.svg;
    const png = await P.rasterize(svg, 'image/png', 2);
    const webp = await P.rasterize(svg, 'image/webp', 2);
    out.pngPrefix = png.startsWith('data:image/png;base64,');
    out.webpPrefix = webp.startsWith('data:image/webp;base64,');
    out.noMislabeledWebp = !webp.startsWith('data:image/png');
    window.__b1012png = png; window.__b1012webp = webp;
    out.ok = true;
  } catch (e) {
    out.ok = false; out.error = (e && e.message) + ' @ ' + String(e && e.stack).split('\n')[1];
  }
  const pre = document.createElement('pre');
  pre.id = 'b1012Result';
  pre.textContent = JSON.stringify(out, null, 1);
  document.body.appendChild(pre);
}, 0));
