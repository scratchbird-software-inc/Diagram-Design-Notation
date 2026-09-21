// SPDX-License-Identifier: GPL-2.0-or-later.
// B1-014 driver scenario: injected by b1-014-display-and-popout.js into a page
// built from the REAL designer/prototype/standalone.html. Exercises the Display
// tab, the Text download formats, float resizing and window pop-out against the
// live DOM, and writes JSON results into a pre#b1014Result node.
window.addEventListener('load', () => setTimeout(async () => {
  const out = {};
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const P = window.DesignerPrototype, D = window.DDNLive;
  try {
    out.api = !!P && typeof P.popOutPanel === 'function' && typeof P.panelRoot === 'function';
    const sourceBefore = P.workspace.getFiles()['model.ddn'];

    // D1: Display tab exists and renders all four sections for a multi-kind view.
    out.displayTabButton = !!$('[data-left="display"]') && $('[data-left="display"]').title.includes('never written to source');
    $('[data-left="display"]').click();
    const pane = P.panelRoot('leftBody');
    out.displayTabPopulated = pane.querySelectorAll('details.display-sec').length === 4
      && pane.textContent.includes('Designer display only — never written to source');
    out.perKindRowsLabelled = [...pane.querySelectorAll('[data-typ-family]')].length >= 2
      && [...pane.querySelectorAll('.typ-row .typ-label')].some(l => l.textContent.includes('Table'));
    out.colourSwatches = pane.querySelectorAll('[data-kind-colour]').length >= 2 && pane.querySelectorAll('[data-verb-colour]').length >= 1;
    out.relationControls = !!pane.querySelector('#dispRouting') && !!pane.querySelector('#dispCrossings')
      && !!pane.querySelector('#dispOrdering') && !!pane.querySelector('#dispTension') && !!pane.querySelector('#dispRadius')
      && pane.querySelectorAll('[data-verb-routing]').length >= 1;

    // Global typography through the override channel: SVG reflows, source untouched.
    const svg0 = P.getState().result.svg;
    const fam = pane.querySelector('#dispFont');
    fam.value = 'serif'; fam.dispatchEvent(new Event('change'));
    const siz = P.panelRoot('leftBody').querySelector('#dispFontSize');
    siz.value = '18'; siz.dispatchEvent(new Event('change'));
    out.globalFontOverride = P.getState().overrides.font === 'serif' && P.getState().overrides.fontSize === 18
      && P.getState().result.svg !== svg0;
    out.sourceBytesUnchanged = P.workspace.getFiles()['model.ddn'] === sourceBefore;

    // Per-kind typography + colour rules land in the #displayOverlay stylesheet.
    const pane2 = P.panelRoot('leftBody');
    const typF = pane2.querySelector('[data-typ-family="TBL"]');
    typF.value = 'mono'; typF.dispatchEvent(new Event('change'));
    const overlay = () => document.getElementById('displayOverlay').textContent;
    out.perKindTypographyRule = overlay().includes('#paper .ddn-kind-tbl text') && overlay().includes('DejaVu Sans Mono');
    const kc = P.panelRoot('leftBody').querySelector('[data-kind-colour="TBL"]');
    kc.value = '#ffcc00'; kc.dispatchEvent(new Event('change'));
    out.kindColourRule = overlay().includes('#paper .ddn-kind-tbl > rect') && overlay().includes('#ffcc00');
    const vc = P.panelRoot('leftBody').querySelector('[data-verb-colour]');
    vc.value = '#112233'; vc.dispatchEvent(new Event('change'));
    out.verbColourRule = /\.ddn-verb-[a-z-]+ path \{ stroke: #112233/.test(overlay());
    const pick = P.panelRoot('leftBody').querySelector('#dispObjectPick');
    P.panelRoot('leftBody').querySelector('#dispObjectApply').click();
    out.objectColourRule = overlay().includes('#paper [data-ddn-id="' + pick.value + '"]') && overlay().includes('#fde68a');
    out.overlayPersisted = (localStorage.getItem('ddn-designer-display:model.ddn#overview') || '').includes('TBL');
    out.sourceBytesUnchanged2 = P.workspace.getFiles()['model.ddn'] === sourceBefore;

    // Per-verb relation routing through the override channel; scene still routes.
    const vr = P.panelRoot('leftBody').querySelector('[data-verb-routing="ref"]');
    vr.value = 'curved'; vr.dispatchEvent(new Event('change'));
    out.relationRoutingPerVerb = P.getState().overrides.relationRouting && P.getState().overrides.relationRouting.ref === 'curved'
      && P.getState().result.scene.routes.length >= 3 && P.getState().result.svg !== svg0;

    // Master reset restores a blank overlay and clears the override channel keys.
    P.panelRoot('leftBody').querySelector('#displayResetAll').click();
    out.masterReset = document.getElementById('displayOverlay').textContent.trim() === ''
      && !P.getState().overrides.relationRouting && !P.getState().overrides.font;

    // D2: export modal regrouped; the three Text options download real bytes.
    const downloads = [];
    const origDownload = D.io.download;
    D.io.download = (name, data, type) => downloads.push({ name, data, type });
    $('#exportBtn').click();
    const dlg = $('#dialogBody').innerHTML;
    out.exportGroups = dlg.includes('<h3>Text</h3>') && dlg.includes('<h3>Image</h3>');
    const actions = $$('#dialogActions button');
    const labels = actions.map(b => b.textContent);
    out.threeTextOptions = ['Current file (.ddn)', 'Single file — entire workspace (.ddn)', 'ZIP archive (all sources)'].every(l => labels.includes(l));
    actions.find(b => b.textContent === 'Current file (.ddn)').click();
    out.currentFileDownload = downloads.at(-1).name === 'model.ddn' && downloads.at(-1).data === sourceBefore;
    actions.find(b => b.textContent === 'Single file — entire workspace (.ddn)').click();
    const bundle = downloads.at(-1);
    out.bundleName = bundle.name === 'designer-prototype-workspace.ddn';
    out.bundleSectioned = bundle.data.startsWith('ddn "') && bundle.data.includes('module "designer.sample";') && bundle.data.includes('module "meridian.procurement.review";');
    const ws2 = D.createWorkspace({ 'bundle.ddn': bundle.data });
    out.bundleReopens = ws2.views('bundle.ddn').length === P.workspace.views('model.ddn').length + P.workspace.views('projections/views.ddn').length;
    const ov = { page: 'content', look: 'classic', theme: 'default' };
    out.bundleRendersIdentical = ws2.renderSync({ entry: 'bundle.ddn', view: 'overview', overrides: ov }).svg
      === P.workspace.renderSync({ entry: 'model.ddn', view: 'overview', overrides: ov }).svg;
    out.bundleText = bundle.data;
    actions.find(b => b.textContent === 'ZIP archive (all sources)').click();
    out.zipDownload = downloads.at(-1).name === 'designer-prototype-workspace.zip' && downloads.at(-1).data.length > 100;
    D.io.download = origDownload;
    $('#dialogClose').click();

    // D3: floating panels are resizable (CSS resize + min constraints + grip).
    P.setFloating('inspector', true);
    const ip = document.getElementById('inspectorPanel');
    const cs = getComputedStyle(ip);
    out.floatResizeCSS = cs.resize === 'both' && parseFloat(cs.minWidth) === 220 && parseFloat(cs.minHeight) === 160;
    ip.style.width = '480px'; ip.style.height = '420px';
    out.floatResized = ip.style.width === '480px' && ip.style.height === '420px';
    P.setFloating('inspector', false);

    // D4: pop the inspector into a separate OS window; edit from inside it; re-dock.
    P.select('designer.sample::model.customer');
    P.popOutPanel('inspector');
    const body = P.panelRoot('inspectorBody');
    out.popoutOpens = P.getState().popped.inspector === true && document.getElementById('inspectorPanel') === null
      && body.ownerDocument !== document;
    out.popoutHasPanel = body.ownerDocument.getElementById('inspectorPanel') !== null
      && !!body.ownerDocument.getElementById('redock-inspector');
    const rev0 = P.workspace.revision;
    const nameEdit = body.querySelector('#nameEdit');
    nameEdit.value = 'Customer (windowed edit)';
    body.querySelector('#applyName').click();
    out.editCommitsFromChild = P.workspace.revision > rev0
      && P.workspace.getFiles()['model.ddn'].includes('Customer (windowed edit)')
      && nameEdit.ownerDocument !== document;
    body.ownerDocument.getElementById('redock-inspector').click();
    out.redockRestores = P.getState().popped.inspector === false && document.getElementById('inspectorPanel') !== null
      && P.panelRoot('inspectorBody').ownerDocument === document
      && $('#workspace').style.gridTemplateColumns.endsWith('6px 306px');
    P.workspace.undo(); P.draw();

    // Mutual exclusion: popping a floated panel docks the float first.
    P.setFloating('left', true);
    P.popOutPanel('left');
    out.popoutDocksFloat = P.getState().floating.left === false && P.getState().popped.left === true
      && !document.getElementById('leftPanel');
    // Palette create works from inside the popped shelf window.
    P.panelRoot('leftTabs').querySelector('[data-left="add"]').click();
    const shelf = P.panelRoot('leftBody');
    const addBtn = shelf.querySelector('[data-add="note"]');
    const rev1 = P.workspace.revision;
    addBtn.click();
    out.paletteWorksFromChild = addBtn.ownerDocument !== document && P.workspace.revision > rev1;
    P.redockPanel('left');
    out.leftRedocks = P.getState().popped.left === false && !!document.getElementById('leftPanel');
    P.workspace.undo(); P.draw();

    out.ok = true;
  } catch (e) {
    out.ok = false; out.error = (e && e.message) + ' @ ' + String(e && e.stack).split('\n')[1];
  }
  const pre = document.createElement('pre');
  pre.id = 'b1014Result';
  pre.textContent = JSON.stringify(out, null, 1);
  document.body.appendChild(pre);
}, 0));
