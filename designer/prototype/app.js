/* SPDX-License-Identifier: GPL-2.0-or-later. Review prototype: uses unchanged public DDN runtime. */
(() => {
'use strict';
const D=window.DDNLive, $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initial=JSON.parse($('#sourceFiles').textContent);
// `let`: B1-023 ?src= replaces the boot workspace with the fetched document.
let ws=D.createWorkspace(initial);
let entry='model.ddn',view='overview',ir=null,result=null,selected='designer.sample::model.customer',tab='meaning',left='add',mode='select',connectFrom=null,zoom=1,toastTimer,drag=null,counter=1;
let overrides={page:'content',look:'classic',theme:'default'},renderFailure=false;
let mPlan=null,mSel=null,mBatch=[];
let chartSel=null,chartNotice=null,dragGuard=null,lastEditError=null;
let timelineNotice=null,tDrag=null;
let fishboneNotice=null;
let panelsNotice=null,panelsSel=null;
let decisionNotice=null,decisionFixture=null;
let laneNotice=null;
let sequenceNotice=null,seqConnectFrom=null;
let rDrag=null;
let pendingViews=new Set(),wsIssues=[],problemsOpen=false,incompleteBadge=false;
const optionsByView={};const actualCommands=[];const A=D.authoring;
const KINDMAP=window.DDNKindUIMap,CMD=window.DesignerCommands,RELMAP=window.DDNRelationUIMap;
const PALETTE_GROUPS=['Meaning','Data','Process','Systems','Scopes','People & control','Notes & evidence','Analysis'];
const kindsByGroup=PALETTE_GROUPS.map(g=>({group:g,kinds:KINDMAP.kinds.filter(k=>k.palette_group===g)}));
const kindEntry=kind=>KINDMAP.kinds.find(k=>k.kind===kind);
const codeOf=kind=>D.kinds.find(k=>k.id===kind)?.code||'';
const projectionKind=()=>ir?.view.profiles.projection?.kind||'graph';
const graph=()=>!ir||ir.view.profiles.projection?.kind==='graph';
// B1-012 chrome (D2/D5/D6): persistence is best-effort — file:// or hardened
// profiles may deny localStorage; the prototype stays fully functional.
const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
// B1-014 D4: panel content roots are captured as LIVE element references, not
// id lookups, so every panel render/update path follows the panel when it is
// adopted into a pop-out window's document (element refs survive adoptNode;
// document.getElementById does not). Populated at boot before the first draw.
const roots={};
function panelRoot(name){return roots[name];}
function captureRoots(){
 roots.leftBody=$('#leftBody');roots.leftTabs=$('#leftPanel .tabs');
 roots.inspectorBody=$('#inspectorBody');roots.selectionHeader=$('#selectionHeader');roots.inspectorTabs=$('#inspectorPanel .tabs');
}
captureRoots();
const density={current:CMD.DENSITY[store.get('ddn-designer-density')]?store.get('ddn-designer-density'):CMD.DENSITY_DEFAULT};
function applyDensity(){document.body.dataset.density=density.current;const label=density.current==='compact'?'Compact':'Comfortable';$('#densityLabel').textContent=label;$('#densityToggle').setAttribute('aria-label','Toggle density, currently '+label);}
const widths={left:CMD.splitters.bootWidth('left',store.get('ddn-designer-split-left')),inspector:CMD.splitters.bootWidth('inspector',store.get('ddn-designer-split-inspector'))};
const floatingPanels={left:false,inspector:false};
// B1-014 D4: popped-out panels (separate OS window). {win,panel,marker} per
// side; a popped panel collapses its grid column exactly like a float.
const popped={left:null,inspector:null};
const panelDetached=which=>floatingPanels[which]||!!popped[which];
function applyColumns(){
 $('#workspace').style.gridTemplateColumns=CMD.splitters.gridColumns(panelDetached('left')?0:widths.left,panelDetached('inspector')?0:widths.inspector);
 $('#splitLeft').hidden=panelDetached('left');$('#splitRight').hidden=panelDetached('inspector');
}
function bindSplitter(id,which){
 const el=$('#'+id);let start=null;
 el.onpointerdown=e=>{if(e.button!==0)return;start={x:e.clientX,w:widths[which]};try{el.setPointerCapture(e.pointerId);}catch{}el.classList.add('active');e.preventDefault();};
 el.onpointermove=e=>{if(!start)return;widths[which]=CMD.splitters.splitterDrag(which,start.w,start.x,e.clientX);applyColumns();};
 const end=()=>{if(!start)return;start=null;el.classList.remove('active');store.set('ddn-designer-split-'+which,String(widths[which]));};
 el.onpointerup=end;el.onpointercancel=end;
 el.ondblclick=()=>{widths[which]=CMD.splitters.SPLITTER_DEFAULTS[which];applyColumns();store.set('ddn-designer-split-'+which,String(widths[which]));};
}
const DETACH_TITLE='Float this panel in its own window; the canvas expands to fill the space';
const REATTACH_TITLE='Re-attach this panel to the workspace grid; the column returns to its splitter position';
function setFloating(which,on){
 floatingPanels[which]=!!on;
 const left=which==='left',panel=$(left?'#leftPanel':'#inspectorPanel'),btn=$(left?'#detachLeft':'#detachInspector'),name=left?'shelf':'inspector';
 panel.classList.toggle('floating',floatingPanels[which]);
 if(floatingPanels[which]){
  panel.style.left=(left?16:Math.max(16,window.innerWidth-360))+'px';panel.style.top='120px';
  btn.title=REATTACH_TITLE;btn.setAttribute('aria-label','Re-attach the '+name+' to the workspace');
 }else{
  panel.style.left='';panel.style.top='';
  btn.title=DETACH_TITLE;btn.setAttribute('aria-label','Detach the '+name+' into a floating window');
 }
 applyColumns();
}
function bindPanelDrag(panel){
 const bar=panel.querySelector('.panel-chrome');let d=null;
 bar.addEventListener('pointerdown',e=>{if(!panel.classList.contains('floating')||e.target.closest('button'))return;const r=panel.getBoundingClientRect();d={dx:e.clientX-r.left,dy:e.clientY-r.top,pointer:e.pointerId};try{bar.setPointerCapture(e.pointerId);}catch{}e.preventDefault();});
 bar.addEventListener('pointermove',e=>{if(!d||e.pointerId!==d.pointer)return;panel.style.left=Math.max(0,Math.min(window.innerWidth-80,e.clientX-d.dx))+'px';panel.style.top=Math.max(0,Math.min(window.innerHeight-60,e.clientY-d.dy))+'px';});
 const up=()=>{d=null;};bar.addEventListener('pointerup',up);bar.addEventListener('pointercancel',up);
}
// B1-014 D4: pop a detachable panel (shelf/inspector) into a separate OS
// window — multi-monitor. The panel element is adoptNode'd into the child
// document together with a copy of every parent stylesheet, so all event
// handlers and panelRoot element references keep working unchanged. Closing
// the child (pagehide/beforeunload) or its Re-dock button re-adopts the panel
// into the marked docked slot; the canvas reflows exactly like B1-012
// re-attach. In-page float and window pop are mutually exclusive per panel:
// popping docks the float state first, and the detach button is disabled
// while the panel is windowed.
const PANEL_LABEL={left:'shelf',inspector:'inspector'};
function popOutPanel(which){
 if(popped[which]){popped[which].win.focus();return;}
 if(floatingPanels[which])setFloating(which,false);
 const panel=$(which==='left'?'#leftPanel':'#inspectorPanel');
 const win=window.open('','_blank','width=440,height=680');
 if(!win){announce('The browser blocked the pop-out window; allow pop-ups for this page and try again.',true);return;}
 win.document.open();
 win.document.write('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>DDN Designer — '+PANEL_LABEL[which]+' panel</title></he'+'ad><body class="popped-panel-host"></bo'+'dy></ht'+'ml>');
 win.document.close();
 for(const sheet of document.styleSheets){
  let text='';try{for(const rule of sheet.cssRules)text+=rule.cssText+'\n';}catch{/* cross-origin sheet skipped */}
  const st=win.document.createElement('style');st.textContent=text;win.document.head.appendChild(st);
 }
 const marker=document.createComment('panel-slot:'+which);
 panel.parentNode.insertBefore(marker,panel);
 const bar=win.document.createElement('div');bar.className='popped-bar';
 const redock=win.document.createElement('button');redock.type='button';redock.id='redock-'+which;
 redock.textContent='⤺ Re-dock';redock.title='Re-dock this panel into the main designer window';
 redock.setAttribute('aria-label','Re-dock this panel into the main designer window');
 redock.onclick=()=>redockPanel(which);
 bar.appendChild(redock);
 const hint=win.document.createElement('span');hint.className='small muted';hint.textContent='Re-docks automatically when this window closes';
 bar.appendChild(hint);
 win.document.body.appendChild(bar);
 win.document.body.appendChild(win.document.adoptNode(panel));
 popped[which]={win,panel,marker};
 panel.classList.remove('floating');panel.style.left='';panel.style.top='';
 win.addEventListener('pagehide',()=>redockPanel(which));
 win.addEventListener('beforeunload',()=>redockPanel(which));
 applyColumns();updatePanelChrome();draw();
 announce('The '+PANEL_LABEL[which]+' panel is open in a separate window — drag it to another monitor; it re-docks when the window closes.');
}
function redockPanel(which){
 const rec=popped[which];if(!rec)return;
 popped[which]=null;
 rec.marker.parentNode.insertBefore(rec.panel,rec.marker);
 rec.marker.remove();
 if(!rec.win.closed)rec.win.close();
 applyColumns();updatePanelChrome();draw();
 announce('The '+PANEL_LABEL[which]+' panel is re-docked.');
}
function updatePanelChrome(){
 for(const which of ['left','inspector']){
  const panel=popped[which]?popped[which].panel:$(which==='left'?'#leftPanel':'#inspectorPanel');
  const detach=panel.querySelector(which==='left'?'#detachLeft':'#detachInspector');
  const popout=panel.querySelector(which==='left'?'#popoutLeft':'#popoutInspector');
  detach.disabled=!!popped[which];
  popout.disabled=!!popped[which];
 }
}
window.addEventListener('pagehide',()=>{for(const which of ['left','inspector'])if(popped[which]&&!popped[which].win.closed)popped[which].win.close();});
// B1-012 D7: every bottom sheet gains a collapse/expand toggle in its head;
// the state is session-only (a fresh page expands every sheet again).
const collapsedSheets=new Set();
function addSheetToggle(sheet){
 const head=sheet.querySelector('.sheet-head');if(!head||head.querySelector('.sheet-toggle'))return;
 const b=document.createElement('button');b.className='sheet-toggle';b.type='button';b.dataset.sheetToggle=sheet.id;
 b.title='Collapse this sheet to a header bar; click again to expand';b.setAttribute('aria-label','Collapse or expand this sheet');
 b.innerHTML='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 head.appendChild(b);sheet.classList.toggle('collapsed',collapsedSheets.has(sheet.id));
}
function setSheet(sheet,h){sheet.innerHTML=h;addSheetToggle(sheet);}
$$('.matrix-sheet').forEach(s=>s.addEventListener('click',e=>{
 const b=e.target.closest('[data-sheet-toggle]');if(!b)return;
 collapsedSheets.has(s.id)?collapsedSheets.delete(s.id):collapsedSheets.add(s.id);
 s.classList.toggle('collapsed',collapsedSheets.has(s.id));
}));
// B1-012 D1: raster export, mirroring the viewer's canvas-2× pattern. SVG is
// serialized into an <img>, drawn to a 2× canvas, read back with toDataURL.
function rasterize(svgText,mime,scale){
 return new Promise((resolve,reject)=>{
  const vb=$('#paper>svg')?.viewBox?.baseVal;
  const w=Math.max(1,Math.round((vb&&vb.width||result?.scene?.width||1600)*scale)),h=Math.max(1,Math.round((vb&&vb.height||result?.scene?.height||1000)*scale));
  const img=new Image();
  img.onload=()=>{try{const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);resolve(c.toDataURL(mime));}catch(e){reject(e);}};
  img.onerror=()=>reject(new Error('Rasterisation failed; the browser could not decode the SVG.'));
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgText);
 });
}
// WebP feature-detect (D1): the button disables with a visible reason rather
// than ever writing a mislabeled file.
const webpSupported=(()=>{try{return document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp');}catch{return false;}})();
function downloadDataURL(name,url){const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();}
function announce(text,error=false){const t=$('#toast');t.textContent=text;t.className='message show'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),6500);$('#status').textContent=text;}
function findSelection(){const n=ir?.elements.find(n=>n.id===selected);if(n)return{kind:'node',node:n,sourceId:n.id,name:n.name};for(const e of ir?.elements||[]){const f=e.fields?.find(f=>f.id===selected);if(f)return{kind:'field',node:e,field:f,sourceId:f.id,name:f.name};}const r=ir?.relations.find(r=>r.id===selected);if(r)return{kind:'relation',relation:r,sourceId:r.id,name:r.name};return null;}
function sourceLabel(id){for(const e of ir?.elements||[]){if(e.id===id)return e.name;const f=e.fields.find(f=>f.id===id);if(f)return e.name+'.'+f.name;}return ir?.relations.find(r=>r.id===id)?.name||id?.split('::').pop()||'';}
function selectionOwner(id){return ir?.elements.find(n=>n.id===id||n.fields.some(f=>f.id===id))?.id||null;}
function usage(id){let count=0;for(const v of ws.views(entry)){try{const p=ws.resolve(entry,v.id);if(p.view.selected.includes(selectionOwner(id)||id)||p.view.relations.includes(id))count++;}catch{}}return count;}
function sourceView(){const data=ws.getFiles();return data[entry];}
function updateSource(){if($('#sourceDrawer').classList.contains('open'))$('#sourceText').textContent=sourceView();}
function safeSVG(text){const doc=new DOMParser().parseFromString(text,'image/svg+xml');if(doc.querySelector('parsererror'))throw Error('Invalid SVG');doc.querySelectorAll('script,foreignObject').forEach(x=>x.remove());doc.querySelectorAll('*').forEach(e=>{for(const a of [...e.attributes]){if(/^on/i.test(a.name)||((a.name==='href'||a.name==='xlink:href')&&!a.value.startsWith('#')))e.removeAttribute(a.name);}});return document.importNode(doc.documentElement,true);}
function draw(){
 try{const next=ws.renderSync({entry,view,overrides});ir=ws.resolve(entry,view);result=next;renderFailure=false;const svg=safeSVG(next.svg);$('#paper').replaceChildren(svg);$('#paper').style.opacity='1';$('#paper').style.width=(zoom*100)+'%';
  $('#viewTag').textContent=(ir.view.profiles.projection?.kind||'graph')+' · '+(graph()?next.scene.nodes.length+' elements':next.scene.marks?.length+' source marks');
  $('#status').textContent='Live render · '+Math.round(next.milliseconds)+' ms · '+next.diagnostics.length+' reported warning(s)';
  $('#saved').textContent='Memory revision '+ws.revision;$('#undo').disabled=!ws.history().canUndo;$('#redo').disabled=!ws.history().canRedo;
  $('#canvasEyebrow').textContent=graph()?'SYNTHETIC COMMERCE MODEL / LIVE GRAPH':'SHARED PROCUREMENT MODEL / DATA-BOUND VIEW';
  $('#viewHeading').textContent={overview:'Customer orders',names:'Customer orders · compact',raci:'Responsibility assignments',chart_bar:'Supplied monthly values',gantt:'Supplied-date procurement schedule',fishbone:'Possible causes of inspection failures',swot:'Reusable SWOT panel template',sipoc:'SIPOC from shared notes',journey:'Service journey with spanning panels',decision:'Disposition policy — decision table',sequence:'Synthetic order flow — sequence'}[view]||view;
  $('#viewHelp').textContent=graph()?'Select a table to edit its shared meaning. Drag to position and pin it. Connect tables or their named fields.':'Values and bindings determine geometry. Graph placement and connector tools are unavailable in this projection.';
  $('#connectTool').disabled=!graph();$('#addAuto').disabled=!graph();$('#arrangeBtn').disabled=!graph();
  if(!graph())mode='select';
  bindCanvas();renderMatrixSheet();renderChartSheet();renderTimelineSheet();renderFishboneSheet();renderPanelsSheet();renderDecisionSheet();renderSequenceSheet();updateInspector();updateLeft();highlight();updateSource();applyDisplay();
  incompleteBadge=false;renderProblems();
 }catch(e){lastEditError=e;renderFailure=true;$('#paper').style.opacity='.35';announce((e.code||'RENDER')+': '+e.message,true);
  // ED-010: a profile-completeness failure is a draft state, not a hard error —
  // the last good render stays dimmed behind and export stays blocked.
  incompleteBadge=CMD.classifyCode(e.code,'design')==='incomplete';renderProblems();
  if(chartProfile())try{renderChartSheet();}catch{}if(decisionProfile())try{renderDecisionSheet();}catch{}}
}
// ED-010 Problems strip + drawer (spec ch.12 "Bottom surfaces", ch.03): the
// collapsed strip reports error / warning / incomplete counts separately;
// expanding opens the navigable list grouped by severity. Dismissing the
// drawer never waives a diagnostic. wsIssues holds the last workspace-review
// scope result; pendingViews is session-only "impacted views pending" state.
function currentIssues(){
 const uid=ir?.view?.id,out=[];
 if(renderFailure&&lastEditError)out.push({code:lastEditError.code||'RENDER',severity:CMD.classifyCode(lastEditError.code,'design'),message:lastEditError.message,viewId:uid||view});
 else if(result)for(const d of result.diagnostics||[])out.push({code:d.code,severity:d.severity||'warning',message:d.message,viewId:uid||view});
 for(const i of wsIssues)if(i.viewId!==uid)out.push(i);
 return out;
}
function navigateIssue(d){
 const target=d.subjectId||(d.occurrenceId?CMD.occurrences.parse(d.occurrenceId).definitionId:null);
 if(!target){announce(d.code+': view-level diagnostic; no subject occurrence to navigate to.',true);return;}
 if(d.occurrenceId){
  const uid=CMD.occurrences.parse(d.occurrenceId).viewId;
  if(uid!==ir?.view?.id)outer:for(const e of ws.entries())for(const v of ws.views(e.file)||[]){try{if(ws.resolve(e.file,v.id).view.id===uid){setView(v.id);break outer;}}catch(_){}}
 }
 choose(target);setTab('meaning');
 const mark=document.querySelector('#paper [data-id="'+CSS.escape(target)+'"]');if(mark&&mark.scrollIntoView)mark.scrollIntoView({block:'center',inline:'center'});
 announce('Navigated to '+target.split('::').pop()+' from '+d.code+'.');
}
function renderProblems(){
 const issues=currentIssues();
 const errs=issues.filter(i=>i.severity==='error'),inc=issues.filter(i=>i.severity==='incomplete'),warn=issues.filter(i=>['warning','info','information'].includes(i.severity));
 const parts=[];if(errs.length)parts.push(errs.length+' error'+(errs.length>1?'s':''));if(inc.length)parts.push(inc.length+' incomplete');if(warn.length)parts.push(warn.length+' warning'+(warn.length>1?'s':''));if(pendingViews.size)parts.push(pendingViews.size+' pending');
 const btn=$('#problemsBtn');btn.textContent=parts.length?parts.join(' · '):'No problems';
 btn.classList.toggle('has-error',errs.length>0);btn.classList.toggle('has-incomplete',!errs.length&&(inc.length>0||pendingViews.size>0));
 $('#incompleteBadge').hidden=!incompleteBadge;
 const drawer=$('#problemsDrawer');drawer.hidden=!problemsOpen;if(!problemsOpen)return;
 $('#problemsSummary').textContent=(wsIssues.length?'workspace review loaded · ':'')+issues.length+' issue(s) · dismissing never waives a diagnostic';
 const order={error:0,incomplete:1,warning:2,info:2,information:2};
 const sorted=[...issues].sort((a,b)=>(order[a.severity]??3)-(order[b.severity]??3)||(a.code<b.code?-1:a.code>b.code?1:0));
 $('#problemsList').innerHTML=sorted.length?sorted.map((d,i)=>'<button class="problem-row sev-'+esc(d.severity)+'" data-issue="'+i+'" title="Navigate to the subject of this diagnostic"><span class="tag '+(d.severity==='error'?'':d.severity==='incomplete'?'amber':'teal')+'">'+esc(String(d.severity).toUpperCase())+'</span><code>'+esc(d.code)+'</code><span class="problem-msg">'+esc(d.message)+'</span><span class="small muted">'+esc(d.viewId||'')+'</span></button>').join(''):'<p class="help small muted">No diagnostics in the current scope.</p>';
 $$('#problemsList [data-issue]').forEach(b=>b.onclick=()=>navigateIssue(sorted[+b.dataset.issue]));
}
function revalidateWorkspace(){
 try{const rep=CMD.validate(D,ws,entry,{scope:'workspace',policy:'design'});wsIssues=rep.issues;pendingViews.clear();renderProblems();announce('Workspace revalidated · '+rep.views.length+' views checked · '+rep.counts.errors+' errors · '+rep.counts.incomplete+' incomplete · '+rep.counts.warnings+' warnings',rep.counts.errors>0);}catch(e){announce((e.code||'VALIDATE')+': '+e.message,true);}
}
// Staged helper operations provide one history entry for this prototype's limited gestures.
// The production plan/impact/draft service is specified separately, not implemented here.
function transaction(label,fn){
 const before=ws.getFiles(),revision=ws.revision,t=D.createWorkspace(before);try{const value=fn(t);const after=t.getFiles();const edits=Object.keys(after).filter(f=>before[f]!==after[f]).map(f=>({file:f,start:0,end:(before[f]||'').length,text:after[f]}));if(edits.length)ws.applyEdits(edits,{expectedRevision:revision,entry,view});actualCommands.push({label,revision:ws.revision,changedFiles:edits.map(e=>e.file)});if(value?.select)selected=value.select;
 // ED-010: after every commit every view except the active one is pending
 // revalidation (ch.12 "impacted views pending", session scope only).
 if(edits.length)try{pendingViews=new Set(CMD.pendingViewsAfterCommit(D,ws,entry,view));}catch{}
 draw();announce(label+' · source updated · Undo available');return true;}catch(e){lastEditError=e;announce((e.code||'EDIT')+': '+e.message,true);return false;}finally{t.destroy();}}
// Matrix sheet (spec ch.09 structured sheets): the editing surface for
// kind:matrix projections. Every commit is one setMatrixAssignments transaction.
const matrixProfile=()=>ir?.view.profiles.projection?.kind==='matrix'?ir.view.profiles.projection:null;
const MATRIX_KEYS=p=>p.profile==='matrix.raci@1'?['R','A','C','I']:p.profile==='matrix.crud@1'?['C','R','U','D']:null;
function matrixWriteTarget(p){
 if(p.write_data)return String(p.write_data.$ref)+' (projection.write_data)';
 const rowId=p.rows?.[0]?.$ref,el=ir?.elements.find(n=>n.id===rowId),block=rowId?String(rowId).split('::')[1].split('.')[0]:'';
 return 'data '+block+(el?.source?.file?' · '+el.source.file:'')+' (owning block of the first matrix row)';
}
function stagedFor(ri,ci){if(!mPlan)return null;const row=mPlan.rows[ri].id,col=mPlan.columns[ci].id;return mBatch.find(b=>b.rowId===row&&b.columnId===col)||null;}
function cellDisplay(ri,ci){const staged=stagedFor(ri,ci);if(staged)return{value:staged.remove?'':String(staged.value??''),staged:true,assignments:[]};const cell=mPlan.cells[ri][ci];return{value:cell.map(a=>a.value).join(' '),staged:false,assignments:cell};}
function renderMatrixSheet(){
 const sheet=$('#matrixSheet'),p=matrixProfile();
 mPlan=null;
 if(!p){sheet.hidden=true;sheet.innerHTML='';return;}
 sheet.hidden=false;
 let plan;try{plan=ws.projectionPlan(entry,view);}catch(e){mSel=null;mBatch=[];sheet.innerHTML='<div class="notice">'+esc((e.code||'PLAN')+': '+e.message)+' The sheet stays read-only; the source is unchanged.</div>';return;}
 mPlan=plan;
 if(mSel&&(mSel.r>=plan.rows.length||mSel.c>=plan.columns.length))mSel=null;
 const keys=MATRIX_KEYS(p),editable=String(p.value||'').split('.')[0].startsWith('x_');
 let h='<div class="sheet-head"><span class="tag teal">MATRIX SHEET · LIVE SOURCE EDITING</span><span class="sheet-target">Writes <code>'+esc(matrixWriteTarget(p))+'</code> · relation <code>'+esc(p.relation)+'</code> · value <code>'+esc(p.value)+'</code></span></div>';
 h+='<table aria-label="Assignment matrix"><thead><tr><th>'+esc(p.profile)+'</th>'+plan.columns.map(c=>'<th>'+esc(c.name)+'</th>').join('')+'</tr></thead><tbody>';
 for(let ri=0;ri<plan.rows.length;ri++){
  h+='<tr><th>'+esc(plan.rows[ri].name)+'</th>';
  for(let ci=0;ci<plan.columns.length;ci++){
   const d=cellDisplay(ri,ci),cls=((mSel&&mSel.r===ri&&mSel.c===ci)?'sel':'')+(d.staged?' staged':'');
   h+='<td class="'+cls+'"><button class="mcell" data-r="'+ri+'" data-c="'+ci+'" aria-label="'+esc(plan.rows[ri].name+' / '+plan.columns[ci].name)+'" title="Stage an assignment for this cell; commit the batch as one transaction">'+esc(d.value||'·')+'</button></td>';
  }
  h+='</tr>';
 }
 h+='</tbody></table>';
 if(editable&&keys)h+='<div class="sheet-head" style="margin-top:10px"><span class="small muted">Selected cell:</span><span class="keypad">'+keys.map(k=>'<button data-key="'+k+'" title="Stage this code letter on the selected cell">'+k+'</button>').join('')+'<button data-key="clear" title="Stage clearing the selected cell">Clear</button></span><span class="small muted">Keys '+(p.profile==='matrix.crud@1'?'toggle letters':'assign')+' · arrows move · Enter commits the batch · Esc discards</span></div>';
 else if(!editable)h+='<p class="help small muted" style="margin-top:10px">Cell editing needs an extension-property (<code>x_*</code>) value binding; this view binds <code>'+esc(p.value)+'</code>. The sheet is read-only.</p>';
 h+='<div class="batchbar"><span class="tag '+(mBatch.length?'amber':'')+'">BATCH · '+mBatch.length+' staged</span>'+mBatch.map((b,i)=>{const r=plan.rows.find(x=>x.id===b.rowId)?.name||b.rowId,c=plan.columns.find(x=>x.id===b.columnId)?.name||b.columnId;return '<span class="chip">'+esc(r+' → '+c+': '+(b.remove?'clear':String(b.value)))+'<button data-unstage="'+i+'" aria-label="Remove staged change" title="Remove this staged change from the batch">×</button></span>';}).join('')+'<button id="commitBatch" class="primary" '+(mBatch.length?'':'disabled')+' title="Commit the staged matrix cells as one transaction">Commit as one transaction</button><button id="discardBatch" '+(mBatch.length?'':'disabled')+' title="Discard every staged matrix change; source unchanged">Discard</button></div>';
 setSheet(sheet,h);
 sheet.querySelectorAll('.mcell').forEach(b=>b.onclick=()=>{mSel={r:+b.dataset.r,c:+b.dataset.c};renderMatrixSheet();updateInspector();});
 sheet.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>{if(!mSel){announce('Select a cell first.',true);return;}stageKey(b.dataset.key);});
 sheet.querySelectorAll('[data-unstage]').forEach(b=>b.onclick=()=>{mBatch.splice(+b.dataset.unstage,1);renderMatrixSheet();updateInspector();});
 $('#commitBatch').onclick=commitMatrixBatch;$('#discardBatch').onclick=()=>{mBatch=[];renderMatrixSheet();updateInspector();announce('Staged matrix changes discarded; source unchanged.');};
 sheet.onkeydown=matrixKey;
}
function stageKey(key){
 const p=matrixProfile();if(!p||!mSel||!mPlan)return;
 const d=cellDisplay(mSel.r,mSel.c),row=mPlan.rows[mSel.r].id,col=mPlan.columns[mSel.c].id;
 const stage=ch=>{mBatch=mBatch.filter(b=>!(b.rowId===row&&b.columnId===col));if(ch)mBatch.push({rowId:row,columnId:col,...ch});renderMatrixSheet();updateInspector();};
 if(key==='clear'){if(!d.assignments.length&&!d.staged)return;stage({remove:true});return;}
 const k=key.toUpperCase();
 if(p.profile==='matrix.crud@1'){const set=new Set((d.value||'').split(''));set.has(k)?set.delete(k):set.add(k);const next=['C','R','U','D'].filter(x=>set.has(x)).join('');stage(next?{value:next}:(d.assignments.length?{remove:true}:null));return;}
 if(!d.staged&&d.value===k)return;
 stage({value:k});
}
function matrixKey(e){
 const p=matrixProfile();if(!p||!mPlan)return;
 const keys=MATRIX_KEYS(p);
 if(e.key.startsWith('Arrow')&&mSel){e.preventDefault();const d={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[e.key];mSel={r:Math.min(mPlan.rows.length-1,Math.max(0,mSel.r+d[0])),c:Math.min(mPlan.columns.length-1,Math.max(0,mSel.c+d[1]))};renderMatrixSheet();updateInspector();return;}
 if(e.key==='Enter'){e.preventDefault();commitMatrixBatch();return;}
 if(e.key==='Escape'){e.preventDefault();mBatch=[];renderMatrixSheet();updateInspector();announce('Staged matrix changes discarded; source unchanged.');return;}
 if(!mSel||!String(p.value||'').split('.')[0].startsWith('x_'))return;
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();stageKey('clear');return;}
 if(e.key.length===1&&/[a-z]/i.test(e.key)){const k=e.key.toUpperCase();if(keys&&!keys.includes(k))return;e.preventDefault();stageKey(k);}
}
function commitMatrixBatch(){
 if(!mBatch.length||!mPlan)return;
 if(mPlan.rows.length*mPlan.columns.length>5000||mPlan.columns.length>40){announce('DDN-PJ013: Matrix limit: 5,000 cells and 40 columns',true);return;}
 const changes=mBatch.map(b=>({...b}));
 const ok=transaction('Set matrix assignments ('+changes.length+' cell'+(changes.length>1?'s':'')+' as one batch)',t=>CMD.setMatrixAssignments(D,t,entry,view,{changes}));
 if(ok){mBatch=[];renderMatrixSheet();}
}
// Chart Source sheet (spec ch.09 structured sheets; ED-003): record rows are
// shared-model edits; mark/binding pickers are view-scope projection edits.
const chartProfile=()=>ir?.view.profiles.projection?.kind==='chart'?ir.view.profiles.projection:null;
function chartRecords(p){
 const byId=new Map((ir?.elements||[]).map(n=>[n.id,n]));
 return (p.records||[]).map(r=>byId.get(r.$ref)).filter(n=>n&&n.properties.x_record&&typeof n.properties.x_record==='object');
}
function chartKeyUnion(records){const keys=[];for(const n of records)for(const k of Object.keys(n.properties.x_record))if(!keys.includes(k))keys.push(k);return keys;}
function chartTxn(label,fn){lastEditError=null;const ok=transaction(label,fn);chartNotice=ok?null:(lastEditError?(lastEditError.code||'EDIT')+': '+lastEditError.message:'Edit rejected; source unchanged.');if(!ok)renderChartSheet();return ok;}
function renderChartSheet(){
 const sheet=$('#chartSheet');
 if(!sheet)return;
 const p=chartProfile();
 if(!p){sheet.hidden=true;sheet.innerHTML='';chartSel=null;return;}
 sheet.hidden=false;
 const records=chartRecords(p),keys=chartKeyUnion(records);
 let plan=null,planError=null;
 try{plan=ws.projectionPlan(entry,view);}catch(e){planError=(e.code||'PLAN')+': '+e.message;}
 const caps=(()=>{try{return ws.inspect(entry,view).capabilities.marks.filter(m=>m!=='source');}catch{return [];}})();
 const numericKeys=keys.filter(k=>records.every(n=>typeof n.properties.x_record[k]==='number'||n.properties.x_record[k]===undefined));
 const units=[...new Set(records.map(n=>n.properties.x_record.unit).filter(u=>typeof u==='string'))];
 let h='<div class="sheet-head"><span class="tag teal">CHART SOURCE SHEET · LIVE SOURCE EDITING</span><span class="sheet-target">Record rows edit the <strong>shared model</strong> (every bound view changes) · mark and bindings edit <strong>this view only</strong> (<code>projection { }</code> group)</span></div>';
 h+='<div class="chart-controls">';
 h+='<label for="chartMark">Mark <span class="muted">view scope</span></label><select id="chartMark">'+caps.map(m=>'<option value="'+esc(m)+'" '+(p.mark===m?'selected':'')+'>'+esc(m)+'</option>').join('')+(p.profile==='chart.quality@1'?'<option value="__source" '+(p.mark===undefined?'selected':'')+'>Source default (remove mark)</option>':'')+'</select>';
 const optKey=k=>'<option value="'+esc(k)+'">'+esc(k)+'</option>';
 const bind=(id,label,options,current)=>{return '<label for="'+id+'">'+label+' <span class="muted">view scope</span></label><select id="'+id+'">'+options.map(o=>'<option value="'+esc(o)+'" '+(current===o?'selected':'')+'>'+esc(o)+'</option>').join('')+'</select>';};
 h+=bind('chartBindX','x binding',keys,String(p.x||''));
 h+=bind('chartBindY','y binding <span class="muted">numeric keys</span>',numericKeys,String(p.y||''));
 h+=bind('chartBindUnit','unit binding',units,String(p.unit||''));
 if(p.aggregate)h+='<span class="tag amber">AGGREGATE · '+esc(p.aggregate)+'</span>';
 h+='</div>';
 if(chartNotice)h+='<div class="notice error">'+esc(chartNotice)+'</div>';
 if(planError)h+='<div class="notice error">'+esc(planError)+' The source stays committed and saveable; fix the binding above.</div>';
 // Contributor list for the clicked mark (VE-AC-052): real input records only.
 if(plan&&chartSel){
  const idx=plan.points.findIndex(pt=>(pt.sourceIds||[]).includes(chartSel));
  if(idx>=0){
   const pt=plan.points[idx],contributors=pt.sourceIds||[];
   h+='<div class="contributors"><span class="tag '+(contributors.length>1?'amber':'teal')+'">CONTRIBUTORS · '+(contributors.length>1?'aggregated ('+esc(String(p.aggregate||'none'))+')':'single record')+'</span> ';
   h+=contributors.map(id=>{const n=records.find(r=>r.id===id)||ir.elements.find(e=>e.id===id);return '<button class="chip" data-contrib="'+esc(id)+'" title="Jump to this record’s row">'+esc(n?n.name:id)+'</button>';}).join(' ');
   h+=' <span class="small muted">Aggregates never create an editable synthetic total record; edit the inputs below.</span></div>';
  }
 }
 h+='<table aria-label="Chart source records"><thead><tr><th>record</th>'+keys.map(k=>'<th>'+esc(k)+'</th>').join('')+'<th></th></tr></thead><tbody>';
 for(const n of records){
  const xr=n.properties.x_record;
  h+='<tr data-recrow="'+esc(n.id)+'"'+(chartSel===n.id?' class="sel"':'')+'><th>'+esc(n.name)+'<br><code class="id">'+esc(n.local||n.id)+'</code></th>';
  for(const k of keys){
   const v=xr[k];
   if(v===undefined)h+='<td class="muted">—</td>';
   else if(typeof v==='number')h+='<td><input type="number" step="any" data-rec="'+esc(n.id)+'" data-key="'+esc(k)+'" value="'+esc(v)+'" aria-label="'+esc(n.name+' '+k)+'"></td>';
   else if(typeof v==='boolean')h+='<td><input type="checkbox" data-rec="'+esc(n.id)+'" data-key="'+esc(k)+'" '+(v?'checked':'')+' aria-label="'+esc(n.name+' '+k)+'"></td>';
   else h+='<td><input type="text" data-rec="'+esc(n.id)+'" data-key="'+esc(k)+'" value="'+esc(String(v))+'" aria-label="'+esc(n.name+' '+k)+'"></td>';
  }
  h+='<td><button data-delrec="'+esc(n.id)+'" title="Delete this record and remove its binding in one transaction">Delete</button></td></tr>';
 }
 h+='</tbody></table>';
 h+='<div class="batchbar"><button id="addChartRecord" title="Add a record with this chart’s key set and bind it">＋ Add record</button><span class="small muted">Adds a record with this chart’s key set and appends its binding — one transaction. Dragging marks is disabled: values set geometry.</span></div>';
 setSheet(sheet,h);
 $('#chartMark').onchange=e=>{
  const v=e.target.value;
  if(v==='__source')chartTxn('Reset chart mark to source default',t=>CMD.editProjectionProperty(D,t,entry,view,{key:'mark',value:undefined}));
  else chartTxn('Set chart mark to '+v,t=>CMD.setChartMark(D,t,entry,view,{mark:v}));
 };
 const binding=(id,key)=>{const el=$('#'+id);if(el)el.onchange=()=>chartTxn('Set '+key+' binding to '+el.value,t=>CMD.setChartBinding(D,t,entry,view,{key,value:el.value}));};
 binding('chartBindX','x');binding('chartBindY','y');binding('chartBindUnit','unit');
 sheet.querySelectorAll('input[data-rec]').forEach(inp=>{
  inp.onchange=()=>{
   const id=inp.dataset.rec,key=inp.dataset.key,n=records.find(r=>r.id===id),old=n.properties.x_record[key];
   let value;
   if(typeof old==='number'){
    if(inp.value.trim()===''||!Number.isFinite(Number(inp.value))){announce('Numeric record keys accept numbers only — numeric strings are not coerced. Nothing was changed.',true);inp.value=old;return;}
    value=Number(inp.value);
   }else if(typeof old==='boolean')value=inp.checked;
   else value=inp.value;
   if(value===old)return;
   chartTxn('Edit record '+n.name+' · '+key+' (shared model)',t=>CMD.editRecordValue(D,t,entry,view,{id,key,value}));
  };
 });
 sheet.querySelectorAll('[data-delrec]').forEach(b=>b.onclick=()=>{const n=records.find(r=>r.id===b.dataset.delrec);chartTxn('Delete record '+n.name+' and its chart binding',t=>CMD.deleteChartRecord(D,t,entry,view,{id:n.id}));});
 sheet.querySelectorAll('[data-contrib]').forEach(b=>b.onclick=()=>{chartSel=b.dataset.contrib;renderChartSheet();updateInspector();sheet.querySelector('[data-recrow="'+CSS.escape(chartSel)+'"]')?.scrollIntoView({block:'nearest'});});
 $('#addChartRecord').onclick=()=>chartTxn('Add chart record',t=>CMD.addChartRecord(D,t,entry,view,{id:'record_'+counter++,name:'New record'}));
}
// Timeline sheet (spec ch.09 structured sheets; ED-004): one row per plan item with
// validated date controls (shared-model edits) plus the dependency list (view-scope
// projection edit). Illegal input is rejected at the control; nothing is staged.
const timelineProfile=()=>ir?.view.profiles.projection?.kind==='timeline'?ir.view.profiles.projection:null;
function timelineTxn(label,fn){lastEditError=null;const ok=transaction(label,fn);timelineNotice=ok?null:(lastEditError?(lastEditError.code||'EDIT')+': '+lastEditError.message:'Edit rejected; source unchanged.');if(!ok)renderTimelineSheet();return ok;}
function renderTimelineSheet(){
 const sheet=$('#timelineSheet');
 if(!sheet)return;
 const p=timelineProfile();
 if(!p){sheet.hidden=true;sheet.innerHTML='';return;}
 sheet.hidden=false;
 let plan=null,planError=null;
 try{plan=ws.projectionPlan(entry,view);}catch(e){planError=(e.code||'PLAN')+': '+e.message;}
 let h='<div class="sheet-head"><span class="tag teal">TIMELINE SHEET · LIVE SOURCE EDITING</span><span class="sheet-target">Dates edit the <strong>shared model</strong> (<code>'+esc(String(p.start))+'</code> / <code>'+esc(String(p.end))+'</code>) · dependencies edit <strong>this view only</strong> (<code>projection.dependencies</code>); relations stay shared</span></div>';
 if(timelineNotice)h+='<div class="notice error">'+esc(timelineNotice)+'</div>';
 if(planError){h+='<div class="notice error">'+esc(planError)+' The sheet stays read-only; the source is unchanged.</div>';setSheet(sheet,h);return;}
 const depsOf=id=>plan.dependencies.filter(r=>r.from.element===id||r.to.element===id);
 h+='<table aria-label="Timeline tasks"><thead><tr><th>task</th><th>start (UTC)</th><th>end (exclusive, UTC)</th><th>dependencies touching this task</th></tr></thead><tbody>';
 for(const it of plan.items){
  const milestone=it.a===it.b;
  h+='<tr><th>'+esc(it.label)+(milestone?' <span class="tag amber" title="Zero-length interval renders as a diamond">MILESTONE</span>':'')+'<br><code class="id">'+esc(it.id.split('::').pop())+'</code></th>';
  h+='<td><input type="date" data-trec="'+esc(it.id)+'" data-tkey="start" value="'+esc(it.start)+'" aria-label="'+esc(it.label+' start')+'"></td>';
  h+='<td><input type="date" data-trec="'+esc(it.id)+'" data-tkey="end" value="'+esc(it.end)+'" aria-label="'+esc(it.label+' end')+'"></td>';
  h+='<td class="deps">'+depsOf(it.id).map(r=>'<span class="chip">'+esc(r.name||r.id.split('::').pop())+' <button data-unlink="'+esc(r.id)+'" title="Remove from this view’s dependency list; the shared relation is kept" aria-label="Unlink '+esc(r.name||r.id)+'">×</button></span>').join('')+'<button data-linkfrom="'+esc(it.id)+'" title="Link a new predecessor dependency starting here">＋ link</button></td></tr>';
 }
 h+='</tbody></table>';
 h+='<div class="batchbar"><span class="tag">ADD TASK</span><input id="tlNewId" placeholder="task_id" aria-label="New task identifier"><input id="tlNewLabel" placeholder="Label" aria-label="New task label"><input id="tlNewStart" type="date" aria-label="New task start"><input id="tlNewEnd" type="date" aria-label="New task end"><button id="addTimelineRecord" title="Add the task record to the shared model and this view’s bindings">＋ Add record</button><span class="small muted">A zero-length interval (start = end) is a legal milestone. Bars drag whole days with a preview; the SVG stays authoritative until commit.</span></div>';
 setSheet(sheet,h);
 sheet.querySelectorAll('input[data-trec]').forEach(inp=>{
  inp.onchange=()=>{
   const id=inp.dataset.trec,key=inp.dataset.tkey,it=plan.items.find(i=>i.id===id);
   if(inp.value===it[key])return;
   timelineTxn('Edit '+it.label+' '+key+' date (shared model)',t=>CMD.setTimelineDates(D,t,entry,view,{recordId:id,[key]:inp.value}));
  };
 });
 sheet.querySelectorAll('[data-unlink]').forEach(b=>b.onclick=()=>{timelineTxn('Unlink dependency from this view (relation kept)',t=>CMD.unlinkTimelineDependency(D,t,entry,view,{relationId:b.dataset.unlink}));});
 sheet.querySelectorAll('[data-linkfrom]').forEach(b=>b.onclick=()=>{
  const fromId=b.dataset.linkfrom,others=plan.items.filter(i=>i.id!==fromId);
  modal('Link a timeline dependency','<p>Creates one shared <code>analysis.precedes</code> relation and appends it to this view’s <code>projection.dependencies</code> — one transaction. Contradictions (DDN-PJ042) and cycles (DDN-PJ043) reject before commit.</p><label for="tlLinkFrom">Predecessor</label><select id="tlLinkFrom">'+plan.items.map(i=>'<option value="'+esc(i.id)+'" '+(i.id===fromId?'selected':'')+'>'+esc(i.label)+'</option>').join('')+'</select><div class="preview-arrow">↓</div><label for="tlLinkTo">Successor</label><select id="tlLinkTo">'+others.map(i=>'<option value="'+esc(i.id)+'">'+esc(i.label)+'</option>').join('')+'</select><label for="tlLinkLabel">Label</label><input id="tlLinkLabel" value="Precedes">',[{label:'Cancel',action:closeModal},{label:'Create dependency',primary:true,action:()=>{
   const from=$('#tlLinkFrom').value,to=$('#tlLinkTo').value,name=$('#tlLinkLabel').value;
   const ok=timelineTxn('Link timeline dependency',t=>CMD.linkTimelineDependency(D,t,entry,view,{id:'precedes_'+counter++,label:name,fromId:from,toId:to}));
   if(ok)closeModal();
  }}]);
 });
 $('#addTimelineRecord').onclick=()=>{
  const id=$('#tlNewId').value.trim(),label=$('#tlNewLabel').value.trim(),start=$('#tlNewStart').value,end=$('#tlNewEnd').value;
  if(!id||!start||!end){timelineNotice='DDN-I033: A new task needs an identifier and both dates. Nothing was changed.';renderTimelineSheet();return;}
  timelineTxn('Add timeline record',t=>CMD.addTimelineRecord(D,t,entry,view,{id,label:label||id,start,end}));
 };
}
// Fishbone sheet (spec ch.09 structured sheets; ED-005): the effect label editor,
// one section per category rib with its cause tree, add-cause / attach-existing
// pickers and remove-rib actions. Every rib is a relation of the view's named
// cause verb; attaching an existing cause creates only a relation, so reuse keeps
// one semantic identity with distinct runtime occurrence paths (VE-AC-057).
const fishboneProfile=()=>ir?.view.profiles.projection?.kind==='fishbone'?ir.view.profiles.projection:null;
function fishboneTxn(label,fn){lastEditError=null;const ok=transaction(label,fn);fishboneNotice=ok?null:(lastEditError?(lastEditError.code||'EDIT')+': '+lastEditError.message:'Edit rejected; source unchanged.');if(!ok)renderFishboneSheet();return ok;}
function fishboneOccurrences(plan){const m=new Map();(function walk(node){const id=node.node?.id;if(id){if(!m.has(id))m.set(id,[]);m.get(id).push(node.occurrence);}for(const c of node.children||[])walk(c);})({node:{id:plan.effect.id},occurrence:plan.effect.id,children:plan.categories});return m;}
function renderFishboneSheet(){
 const sheet=$('#fishboneSheet');
 if(!sheet)return;
 const p=fishboneProfile();
 if(!p){sheet.hidden=true;sheet.innerHTML='';fishboneNotice=null;return;}
 sheet.hidden=false;
 let plan=null,planError=null;
 try{plan=ws.projectionPlan(entry,view);}catch(e){planError=(e.code||'PLAN')+': '+e.message;}
 let h='<div class="sheet-head"><span class="tag teal">FISHBONE SHEET · LIVE SOURCE EDITING</span><span class="sheet-target">Ribs are source relationships of the bound verb <code>relation: '+esc(p.relation)+'</code> — branches are source relationships · repeated appearances retain one identity. Attaching an existing cause creates a relation only; no UI path clones a definition.</span></div>';
 if(fishboneNotice)h+='<div class="notice error">'+esc(fishboneNotice)+'</div>';
 if(planError){h+='<div class="notice error">'+esc(planError)+' Incomplete bones stay saveable; profile checks run at review. Fix the rib set below or in source.</div>';setSheet(sheet,h);return;}
 const occ=fishboneOccurrences(plan);
 const occNote=id=>{const list=occ.get(id)||[];return list.length>1?'<div class="occ">occurrences ('+list.length+'): '+list.map(o=>'<code>'+esc(o)+'</code>').join(' · ')+'</div>':'';};
 h+='<table aria-label="Fishbone ribs"><tbody>';
 h+='<tr'+(selected===plan.effect.id?' class="sel"':'')+'><th style="width:1%;white-space:nowrap">EFFECT</th><td><input id="fbEffectLabel" value="'+esc(plan.effect.name)+'" aria-label="Effect statement"></td><td class="fb-actions"><button id="fbEffectApply" class="primary" title="Rename the fishbone effect (shared definition)">Apply label</button></td></tr>';
 const actionCell=(parentId,relationId,depth)=>'<button data-fb-add="'+esc(parentId)+'" data-depth="'+depth+'" title="Create a new quality.cause under this rib — one transaction">＋ cause</button><button data-fb-attach="'+esc(parentId)+'" title="Attach an existing cause definition here; one identity, a second occurrence">attach…</button>'+(relationId?'<button data-fb-remove="'+esc(relationId)+'" title="Remove this rib only; the definition and its other occurrences survive">remove rib</button>':'');
 const causeRows=(node,depth)=>{
  let rows='<tr'+(selected===node.node.id?' class="sel"':'')+'><th><span class="fb-indent" style="--d:'+depth+'"></span>'+esc(node.node.name)+'</th><td><code class="id">'+esc(node.node.kind)+'</code>'+occNote(node.node.id)+'</td><td class="fb-actions">'+actionCell(node.node.id,node.relationId,depth+1)+'</td></tr>';
  for(const c of node.children||[])rows+=causeRows(c,depth+1);
  return rows;
 };
 for(const cat of plan.categories){
  h+='<tr class="fb-cat'+(selected===cat.node.id?' sel':'')+'"><th>'+esc(cat.node.name)+'</th><td><code class="id">quality.category</code>'+occNote(cat.node.id)+'</td><td class="fb-actions">'+actionCell(cat.node.id,cat.relationId,1)+'</td></tr>';
  for(const c of cat.children||[])h+=causeRows(c,1);
 }
 h+='</tbody></table>';
 h+='<div class="batchbar"><span class="tag">ADD CATEGORY</span><input id="fbCatId" placeholder="category_id" aria-label="New category identifier"><input id="fbCatLabel" placeholder="Label" aria-label="New category label"><button id="fbAddCat" title="Add a category rib in one transaction">＋ Add category</button><span class="small muted">First-level ribs must be categories (1..12); causes nest at most 4 levels. Illegal ribs reject with the runtime’s own codes before any commit.</span></div>';
 setSheet(sheet,h);
 $('#fbEffectApply').onclick=()=>{const label=$('#fbEffectLabel').value;if(label!==plan.effect.name)fishboneTxn('Rename fishbone effect (shared definition)',t=>CMD.setFishboneEffectLabel(D,t,entry,view,{label}));};
 $('#fbEffectLabel').onkeydown=e=>{if(e.key==='Enter')$('#fbEffectApply').click();};
 $('#fbAddCat').onclick=()=>{
  const id=$('#fbCatId').value.trim(),label=$('#fbCatLabel').value.trim();
  if(!id){fishboneNotice='DDN-I033: A new category needs an identifier. Nothing was changed.';renderFishboneSheet();return;}
  fishboneTxn('Add fishbone category',t=>CMD.addFishboneCategory(D,t,entry,view,{id,label:label||id}));
 };
 sheet.querySelectorAll('[data-fb-add]').forEach(b=>b.onclick=()=>{
  const parent=b.dataset.fbAdd,name=sourceLabel(parent);
  modal('Add a cause under '+name,'<p>Creates one <code>quality.cause</code> definition and one <code>'+esc(p.relation)+'</code> rib to the chosen parent — one transaction. Depth and shape rules (DDN-QF001/002/003) reject before commit.</p><label for="fbCauseId">Identifier</label><input id="fbCauseId" value="cause_'+counter+'"><label for="fbCauseLabel">Label</label><input id="fbCauseLabel" value="New contributing cause">',[{label:'Cancel',action:closeModal},{label:'Create cause',primary:true,action:()=>{
   const id=$('#fbCauseId').value.trim(),label=$('#fbCauseLabel').value.trim();
   if(!id){announce('DDN-I033: A cause needs an identifier. Nothing was changed.',true);return;}
   const ok=fishboneTxn('Add fishbone cause under '+name,t=>CMD.addFishboneCause(D,t,entry,view,{id,label:label||id,parentId:parent}));
   if(ok){counter++;closeModal();}
  }}]);
 });
 sheet.querySelectorAll('[data-fb-attach]').forEach(b=>b.onclick=()=>{
  const parent=b.dataset.fbAttach,name=sourceLabel(parent);
  const causes=ir.elements.filter(e=>e.kind==='quality.cause');
  if(!causes.length){announce('No existing quality.cause definitions in this view’s sources to attach.',true);return;}
  modal('Attach an existing cause under '+name,'<p>Creates <strong>only</strong> the <code>'+esc(p.relation)+'</code> relation — the cause definition is shared, so it keeps one semantic identity and gains a second, distinct occurrence path. No second object with the same name is ever created.</p><label for="fbAttachPick">Existing cause</label><select id="fbAttachPick">'+causes.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('')+'</select>',[{label:'Cancel',action:closeModal},{label:'Attach cause',primary:true,action:()=>{
   const ok=fishboneTxn('Attach existing cause under '+name,t=>CMD.attachExistingCause(D,t,entry,view,{causeId:$('#fbAttachPick').value,parentId:parent,relationId:'attach_'+counter++}));
   if(ok)closeModal();
  }}]);
 });
 sheet.querySelectorAll('[data-fb-remove]').forEach(b=>b.onclick=()=>{
  fishboneTxn('Remove one fishbone rib (definition kept)',t=>CMD.removeFishboneCause(D,t,entry,view,{relationId:b.dataset.fbRemove}));
 });
}
// Panels sheet (spec ch.09 structured sheets; ED-006): a grid mirror of the
// view's panels plus one editor card per panel — title, grid span, items with a
// move-to-panel picker, an add-item row, a delete action and, for composed
// profiles, the child-view slot binder. Panels/grid writes are view-scope; item
// definitions are shared (new notes land in the view's editor_data block — the
// AUD-002 M2 destination limitation). Fixed-grid canvas profiles lock the
// required blocks' title/span/delete controls; the scratch re-plan stays the
// authority (DDN-PJ080/081/083).
const panelsProfile=()=>ir?.view.profiles.projection?.kind==='panels'?ir.view.profiles.projection:null;
const CANVAS_REQUIRED={'canvas.bmc@1':['kp','ka','kr','vp','cr','ch','cs','cost','rev'],'canvas.lean@1':['problem','solution','keymetrics','uvp','unfair','channels','segments','cost','revenue'],'canvas.pest@1':['political','economic','social','technological'],'canvas.pestle@1':['political','economic','social','technological','legal','environmental'],'canvas.porter5@1':['entrants','supplier','rivalry','buyer','substitutes'],'canvas.empathy@1':['says','thinks','persona','does','feels'],'canvas.scorecard@1':['financial','customer','internal','learning']};
function panelsTxn(label,fn){lastEditError=null;const ok=transaction(label,fn);panelsNotice=ok?null:(lastEditError?(lastEditError.code||'EDIT')+': '+lastEditError.message:'Edit rejected; source unchanged.');if(!ok)renderPanelsSheet();return ok;}
function openChildView(id){const files=ws.getFiles(),hit=Object.keys(files).find(f=>files[f].includes('view '+id+' '));if(!hit){announce('View '+id+' is not declared in this workspace.',true);return;}entry=hit;view=id;selected=null;zoom=1;updateZoom();mode='select';draw();announce('Opened child view '+id+' — slots stay named-view references; child geometry is never edited through the parent.');}
function renderPanelsSheet(){
 const sheet=$('#panelsSheet');
 if(!sheet)return;
 const p=panelsProfile();
 if(!p){sheet.hidden=true;sheet.innerHTML='';panelsSel=null;return;}
 sheet.hidden=false;
 let plan=null,planError=null;
 try{plan=ws.projectionPlan(entry,view);}catch(e){planError=(e.code||'PLAN')+': '+e.message;}
 const required=CANVAS_REQUIRED[p.profile]||[];
 const childCount=(p.panels||[]).filter(v=>v.view!==undefined).length;
 let h='<div class="sheet-head"><span class="tag teal">PANELS SHEET · LIVE SOURCE EDITING</span><span class="sheet-target">Grid, titles, spans and item lists edit <strong>this view only</strong> (<code>projection.panels</code>) · item notes are <strong>shared definitions</strong> (new notes land in the view’s <code>editor_data</code> block — AUD-002 M2 destination)'+(!plan&&planError?' · plan invalid: '+esc(planError):'')+'</span></div>';
 if(panelsNotice)h+='<div class="notice error">'+esc(panelsNotice)+'</div>';
 if(planError)h+='<div class="notice error">'+esc(planError)+' The source stays committed and saveable; the checks fire again at render/review. Fix the panel set below or in source.</div>';
 const source=p.panels||[];
 if(plan){
  const rows=Math.max(...plan.panels.map(v=>v.row+v.rowspan));
  h+='<div class="panel-grid" style="grid-template-columns:repeat('+p.columns+',1fr)">';
  for(const v of plan.panels){
   const fixed=required.includes(v.id),child=!!v.child;
   h+='<button class="panel-cell'+(panelsSel===v.id?' sel':'')+(fixed?' fixed':'')+'" data-panel="'+esc(v.id)+'" style="grid-row:'+(v.row+1)+' / span '+v.rowspan+';grid-column:'+(v.column+1)+' / span '+v.colspan+'" title="'+esc(v.id)+'"><strong>'+esc(v.title)+'</strong><span class="small muted">'+esc(v.id)+' · '+v.rowspan+'×'+v.colspan+(child?' · child view: '+esc(v.child.view.id):' · '+v.items.length+' item(s)')+(fixed?' · fixed canvas block':'')+'</span></button>';
  }
  h+='</div>';
 }
 for(const v of source){
  const planned=plan?.panels.find(x=>x.id===v.id),fixed=required.includes(v.id),isChild=v.view!==undefined;
  h+='<div class="panel-card'+(panelsSel===v.id?' sel':'')+'" data-card="'+esc(v.id)+'"><div class="sheet-head"><span class="tag'+(fixed?' amber':'')+'">'+esc(v.id)+(fixed?' · FIXED CANVAS BLOCK':'')+(isChild?' · CHILD-VIEW SLOT':'')+'</span>'+(fixed?'<span class="small muted">fixed canvas block — title, span and delete are locked; the runtime’s DDN-PJ080/081/083 re-plan is the backstop</span>':'')+'</div>';
  h+='<div class="panel-form"><label>Title</label><input data-ptitle="'+esc(v.id)+'" value="'+esc(v.title)+'" '+(fixed?'disabled':'')+' aria-label="Panel '+esc(v.id)+' title">';
  for(const k of ['row','column','rowspan','colspan'])h+='<label>'+k+'</label><input type="number" min="0" data-pspan="'+esc(v.id)+':'+k+'" value="'+esc(String(v[k]??(k==='rowspan'||k==='colspan'?1:0)))+'" '+(fixed?'disabled':'')+' aria-label="Panel '+esc(v.id)+' '+k+'">';
  h+='<button data-pspanapply="'+esc(v.id)+'" '+(fixed?'disabled':'')+' title="Apply the grid position for this panel (this view only)">Apply span</button><button data-pdel="'+esc(v.id)+'" '+(fixed?'disabled title="fixed canvas block"':'')+'>Delete panel</button></div>';
  if(isChild){
   const childId=String(v.view?.$ref??v.view).split('::').pop();
   h+='<div class="panel-items"><span class="small muted">Bound child view <code>'+esc(childId)+'</code> — a named-view reference, never an inline copy of child geometry (spec ch.09 Composition).</span><button data-popen="'+esc(childId)+'" title="Open the bound child view in the editor">Open child view</button>';
   const others=ws.views(entry).filter(x=>x.id!==view&&x.id!==childId);
   h+='<span class="small muted">Rebind slot ('+childCount+'/12 child slots):</span><select data-pbindpick="'+esc(v.id)+'">'+others.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.id)+'</option>').join('')+'</select><button data-pbind="'+esc(v.id)+'" title="Bind the selected view into this slot (named reference)">Bind view</button></div>';
  }else{
   const itemPanels=source.filter(x=>x.view===undefined&&x.id!==v.id);
   h+='<div class="panel-items">'+(planned?planned.items.map(it=>{
    const nid=it.node.id;
    return '<span class="chip'+(panelsSel===nid?' sel':'')+'" data-pitem="'+esc(nid)+'">'+esc(it.node.name)+' <select data-pmove="'+esc(nid)+'" title="Move to another item-panel" aria-label="Move '+esc(it.node.name)+' to another panel"><option value="">move to…</option>'+itemPanels.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.title)+'</option>').join('')+'</select></span>';
   }).join(''):'<span class="small muted">items unavailable while the plan is invalid</span>')+'</div>';
   h+='<div class="panel-form"><input data-paddid="'+esc(v.id)+'" placeholder="note_id" aria-label="New note identifier"><input data-paddlabel="'+esc(v.id)+'" placeholder="Label" aria-label="New note label"><input data-padddesc="'+esc(v.id)+'" placeholder="Description" aria-label="New note description"><button data-padd="'+esc(v.id)+'" title="Add the note to this panel in one transaction">＋ Add item</button></div>';
  }
  h+='</div>';
 }
 h+='<div class="batchbar"><span class="tag">ADD PANEL</span><input id="pNewId" placeholder="panel_id" aria-label="New panel identifier"><input id="pNewTitle" placeholder="Title" aria-label="New panel title"><input id="pNewRow" type="number" min="0" placeholder="row" aria-label="New panel row"><input id="pNewCol" type="number" min="0" placeholder="column" aria-label="New panel column"><input id="pNewNote" placeholder="First item label (required — empty panels reject DDN-PJ009)" aria-label="First item label"><button id="pAddPanel" title="Add the panel with its first item in one transaction">＋ Add panel</button><span class="small muted">One transaction: a shared note definition plus the new panel holding it. Overlaps reject DDN-PJ021; fixed-grid canvas profiles keep their required blocks (DDN-PJ080/081/083).</span></div>';
 setSheet(sheet,h);
 sheet.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>{panelsSel=b.dataset.panel;renderPanelsSheet();updateInspector();});
 sheet.querySelectorAll('[data-pitem]').forEach(c=>c.onclick=e=>{if(e.target.tagName==='SELECT')return;panelsSel=c.dataset.pitem;renderPanelsSheet();updateInspector();});
 sheet.querySelectorAll('[data-ptitle]').forEach(inp=>inp.onchange=()=>{const id=inp.dataset.ptitle,cur=source.find(v=>v.id===id);if(inp.value!==cur.title)panelsTxn('Rename panel '+id+' (this view only)',t=>CMD.renamePanel(D,t,entry,view,{panelId:id,title:inp.value}));});
 sheet.querySelectorAll('[data-pspanapply]').forEach(b=>b.onclick=()=>{
  const id=b.dataset.pspanapply,num=k=>{const el=sheet.querySelector('[data-pspan="'+id+':'+k+'"]');return el.value===''?undefined:Number(el.value);};
  const row=num('row'),column=num('column');
  if(!Number.isInteger(row)||!Number.isInteger(column)){panelsNotice='DDN-I033: row and column are required integers. Nothing was changed.';renderPanelsSheet();return;}
  panelsTxn('Move panel '+id+' on the grid (this view only)',t=>CMD.movePanelSpan(D,t,entry,view,{panelId:id,row,column,rowspan:num('rowspan'),colspan:num('colspan')}));
 });
 sheet.querySelectorAll('[data-pdel]').forEach(b=>b.onclick=()=>panelsTxn('Remove panel '+b.dataset.pdel+' (this view only)',t=>CMD.removePanel(D,t,entry,view,{panelId:b.dataset.pdel})));
 sheet.querySelectorAll('[data-pmove]').forEach(sel=>sel.onchange=()=>{
  if(!sel.value)return;
  const from=source.find(v=>v.id===sel.closest('.panel-card').dataset.card);
  panelsTxn('Move item to panel '+from.title+' → '+sel.value+' (this view only; definition shared)',t=>CMD.movePanelItem(D,t,entry,view,{itemId:sel.dataset.pmove,fromPanelId:from.id,toPanelId:sel.value}));
 });
 sheet.querySelectorAll('[data-padd]').forEach(b=>b.onclick=()=>{
  const id=b.dataset.padd,nid=sheet.querySelector('[data-paddid="'+id+'"]').value.trim(),label=sheet.querySelector('[data-paddlabel="'+id+'"]').value.trim(),desc=sheet.querySelector('[data-padddesc="'+id+'"]').value;
  if(!nid){panelsNotice='DDN-I033: A new item needs an identifier. Nothing was changed.';renderPanelsSheet();return;}
  panelsTxn('Add item to panel '+id+' (shared note + view list, one transaction)',t=>CMD.addPanelItem(D,t,entry,view,{panelId:id,id:nid,label:label||nid,description:desc||undefined}));
 });
 sheet.querySelectorAll('[data-pbind]').forEach(b=>b.onclick=()=>{const pick=sheet.querySelector('[data-pbindpick="'+b.dataset.pbind+'"]');panelsTxn('Bind child view into slot '+b.dataset.pbind+' (named reference)',t=>CMD.bindPanelChildView(D,t,entry,view,{panelId:b.dataset.pbind,childViewId:pick.value}));});
 sheet.querySelectorAll('[data-popen]').forEach(b=>b.onclick=()=>openChildView(b.dataset.popen));
 $('#pAddPanel').onclick=()=>{
  const id=$('#pNewId').value.trim(),title=$('#pNewTitle').value.trim(),row=Number($('#pNewRow').value),column=Number($('#pNewCol').value),note=$('#pNewNote').value.trim();
  if(!id||!Number.isInteger(row)||!Number.isInteger(column)||!note){panelsNotice='DDN-I033: A new panel needs an identifier, integer row/column and a first item — an empty panel rejects DDN-PJ009. Nothing was changed.';renderPanelsSheet();return;}
  panelsTxn('Add panel '+id+' with its first item (one transaction)',t=>{
   D.authoring.addElement(t,entry,view,{id:id+'_note',name:note,kind:'note'});
   const n=t.resolve(entry,view).elements.find(e=>e.local===id+'_note');
   if(!n)throw Object.assign(new Error('Created note not found in the resolved view.'),{code:'DDN-I033'});
   CMD.addPanel(D,t,entry,view,{id,title:title||id,row,column,items:[n.id]});
   return{select:n.id};
  });
 };
}
// Decision sheet (spec ch.09 structured sheets; ED-007): one row per rule in
// projection.records order with typed predicate controls driven by the declared
// input domains and typed outcome cells driven by the observed scalar types.
// Rule rows and their x_rule records are shared-model edits; the records order
// and hit_policy/coverage are view-scope writes (both scopes labeled, VE-005).
// The hit policy and coverage show as badges exactly as the renderer prints
// them and change through setDecisionPolicy with an immediate re-render and
// analysis summary. Analysis failures (DDN-QD004/005/008) commit as drafts
// (VE-007): the committed re-render surfaces the witness, the last good SVG
// stays with a stale marker, and export stays blocked by the renderFailure guard.
const decisionProfile=()=>ir?.view.profiles.projection?.kind==='decision'?ir.view.profiles.projection:null;
const DECISION_DRAFT=['DDN-QD004','DDN-QD005','DDN-QD008'];
function decisionTxn(label,fn){
 lastEditError=null;
 const before=ws.getFiles(),revision=ws.revision,t=D.createWorkspace(before);
 try{
  const value=fn(t);
  const after=t.getFiles();
  const edits=Object.keys(after).filter(f=>before[f]!==after[f]).map(f=>({file:f,start:0,end:(before[f]||'').length,text:after[f]}));
  if(edits.length){
   try{ws.applyEdits(edits,{expectedRevision:revision,entry,view});}
   catch(e){if(!DECISION_DRAFT.includes(e.code))throw e;ws.applyEdits(edits,{expectedRevision:revision});}
  }
  actualCommands.push({label,revision:ws.revision,changedFiles:edits.map(e=>e.file)});
  if(value?.select)selected=value.select;
  decisionNotice=null;draw();
  if(renderFailure){announce(label+' · committed as draft — the analysis error below stays visible; publish/export stay blocked',true);}
  else announce(label+' · source updated · Undo available');
  return true;
 }catch(e){lastEditError=e;decisionNotice=(e.code||'EDIT')+': '+e.message;announce(decisionNotice,true);try{renderDecisionSheet();}catch{}return false;}
 finally{t.destroy();}
}
function decisionScalar(raw,d){
 if(d.type==='boolean')return raw===true||raw==='true';
 if(d.type==='number'){const n=Number(raw);if(raw===''||!Number.isFinite(n))throw Object.assign(new Error('A number-domain predicate needs a finite number; numeric strings are not coerced.'),{code:'DDN-I033'});return n;}
 return String(raw);
}
function decisionPredFromCell(cell,d){
 const opEl=cell.querySelector('[data-pred-op]');
 if(!opEl)return undefined;
 const op=opEl.value;
 if(op==='null'||op==='missing')return{op};
 if(op==='eq')return{op,value:decisionScalar(cell.querySelector('[data-pred-val]').value,d)};
 if(op==='in'){
  const el=cell.querySelector('[data-pred-vals]');
  const values=el.tagName==='SELECT'?[...el.selectedOptions].map(o=>o.value):el.value.split(',').filter(s=>s.trim()!=='').map(s=>decisionScalar(s.trim(),d));
  return{op,values};
 }
 const min=decisionScalar(cell.querySelector('[data-pred-min]').value,d),max=decisionScalar(cell.querySelector('[data-pred-max]').value,d);
 return{op:'interval',min,max,lower_closed:cell.querySelector('[data-pred-lc]').checked,upper_closed:cell.querySelector('[data-pred-uc]').checked};
}
function renderDecisionSheet(){
 const sheet=$('#decisionSheet');
 if(!sheet)return;
 const p=decisionProfile();
 if(!p){sheet.hidden=true;sheet.innerHTML='';decisionNotice=null;decisionFixture=null;return;}
 sheet.hidden=false;
 let plan=null,planError=null;
 try{plan=ws.projectionPlan(entry,view);}catch(e){planError={code:e.code||'PLAN',message:e.message};}
 let h='<div class="sheet-head"><span class="tag teal">DECISION SHEET · LIVE SOURCE EDITING</span><span class="sheet-target">Rule rows and conditions/outcomes edit the <strong>shared model</strong> (<code>x_rule</code>) · records order, hit policy and coverage edit <strong>this view only</strong> (<code>projection { }</code> group)</span></div>';
 if(decisionNotice)h+='<div class="notice error">'+esc(decisionNotice)+'</div>';
 // Hit policy / coverage badges exactly as the renderer prints them, VE-005 labeled.
 const policy=plan?plan.policy:String(p.hit_policy||''),coverage=plan?plan.coverage:String(p.coverage||'report');
 h+='<div class="policy-badges"><span class="badge">HIT POLICY: '+esc(policy.toUpperCase())+'</span><span class="badge">coverage: '+esc(coverage)+'</span>'
  +'<label for="decisionPolicy">hit policy <span class="muted">view scope</span></label><select id="decisionPolicy">'+['unique','first','collect'].map(v=>'<option value="'+v+'"'+(policy===v?' selected':'')+'>'+v+'</option>').join('')+'</select>'
  +'<label for="decisionCoverage">coverage <span class="muted">view scope</span></label><select id="decisionCoverage">'+['complete','report','none'].map(v=>'<option value="'+v+'"'+(coverage===v?' selected':'')+'>'+v+'</option>').join('')+'</select>'
  +(policy==='first'?'<span class="tag amber">RULE ORDER IS SEMANTIC FOR FIRST-MATCH POLICIES</span>':'')+'</div>';
 if(planError){
  h+='<div class="notice error"><strong>'+esc(planError.code)+'</strong>: '+esc(planError.message)+'<br>The rule stays committed and saveable as a draft (VE-007); the failing analysis is displayed, never hidden, and publish/export stay blocked. The sheet is read-only until the source passes again — use Undo or edit the source.</div>';
  h+='<table aria-label="Decision rules (stale)" class="stale-wrap"><tbody><tr class="stale"><td class="small muted">Last good table kept stale; the canvas above shows the last valid render dimmed.</td></tr></tbody></table>';
  setSheet(sheet,h);
  $('#decisionPolicy').onchange=e=>{e.target.value=policy;announce(planError.code+': fix the draft before changing policy.',true);};
  $('#decisionCoverage').onchange=e=>{e.target.value=coverage;announce(planError.code+': fix the draft before changing coverage.',true);};
  return;
 }
 const inputs=plan.inputs,outputs=plan.outputs,records=p.records||[];
 const opsFor=d=>{const ops=d.type==='number'?['interval','eq','in']:['eq','in'];if(d.nullable)ops.push('null');if(d.optional)ops.push('missing');return ops;};
 h+='<table aria-label="Decision rules"><thead><tr><th>order</th><th>Rule</th>'+inputs.map(d=>'<th>'+esc(d.key)+' <span class="muted small">'+esc(d.type)+'</span></th>').join('')+outputs.map(k=>'<th>→ '+esc(k)+'</th>').join('')+'<th></th></tr></thead><tbody>';
 for(let ri=0;ri<plan.rules.length;ri++){
  const rule=plan.rules[ri];
  h+='<tr data-rulerow="'+esc(rule.id)+'"'+(selected===rule.id?' class="sel"':'')+'>';
  h+='<td style="white-space:nowrap"><button data-rule-up="'+ri+'" '+(ri===0?'disabled':'')+' title="Move earlier (records order — semantic for first-match policies)">↑</button><button data-rule-down="'+ri+'" '+(ri===plan.rules.length-1?'disabled':'')+' title="Move later">↓</button></td>';
  h+='<th>'+esc(rule.node.name)+'<br><code class="id">'+esc(rule.id.split('::').pop())+'</code></th>';
  for(const d of inputs){
   const c=rule.when[d.key];
   h+='<td class="pred" data-rule="'+esc(rule.id)+'" data-input="'+esc(d.key)+'">';
   if(!c)h+='<span class="muted small">Any</span> <button data-pred-add title="Add a condition on '+esc(d.key)+'">＋</button>';
   else{
    h+='<select data-pred-op aria-label="Predicate operator for '+esc(d.key)+'">'+opsFor(d).map(o=>'<option value="'+o+'"'+(c.op===o?' selected':'')+'>'+o+'</option>').join('')+'</select>';
    if(c.op==='eq'){
     if(d.type==='boolean')h+='<select data-pred-val><option value="true"'+(c.value===true?' selected':'')+'>true</option><option value="false"'+(c.value===false?' selected':'')+'>false</option></select>';
     else if(d.type==='enum')h+='<select data-pred-val>'+d.values.map(v=>'<option value="'+esc(String(v))+'"'+(c.value===v?' selected':'')+'>'+esc(String(v))+'</option>').join('')+'</select>';
     else h+='<input type="number" step="any" data-pred-val value="'+esc(c.value)+'">';
    }else if(c.op==='in'){
     if(d.type==='enum')h+='<select data-pred-vals multiple size="'+Math.min(4,d.values.length)+'">'+d.values.map(v=>'<option value="'+esc(String(v))+'"'+(c.values.includes(v)?' selected':'')+'>'+esc(String(v))+'</option>').join('')+'</select>';
     else h+='<input data-pred-vals value="'+esc(c.values.join(', '))+'" title="Comma-separated values">';
    }else if(c.op==='interval'){
     h+='<input type="number" step="any" data-pred-min value="'+esc(c.min)+'" aria-label="min"><input type="number" step="any" data-pred-max value="'+esc(c.max)+'" aria-label="max">';
     h+='<label class="small"><input type="checkbox" data-pred-lc '+(c.lower_closed!==false?'checked':'')+'>[</label><label class="small"><input type="checkbox" data-pred-uc '+(c.upper_closed!==false?'checked':'')+'>]</label>';
    }
    h+='<button data-pred-del title="Remove this condition (the rule matches Any on '+esc(d.key)+')">×</button>';
   }
   h+='</td>';
  }
  for(const k of outputs){
   const v=rule.then[k];
   h+='<td class="outcome" data-rule="'+esc(rule.id)+'" data-output="'+esc(k)+'">';
   if(typeof v==='boolean')h+='<input type="checkbox" data-out-val '+(v?'checked':'')+' aria-label="'+esc(k)+'">';
   else if(typeof v==='number')h+='<input type="number" step="any" data-out-val value="'+esc(v)+'" aria-label="'+esc(k)+'">';
   else h+='<input type="text" data-out-val value="'+esc(String(v))+'" aria-label="'+esc(k)+'">';
   h+='</td>';
  }
  h+='<td><button data-rule-del="'+esc(rule.id)+'" title="Delete this rule definition and remove it from records in one transaction">Delete</button></td></tr>';
 }
 h+='</tbody></table>';
 // Analysis presentation (VE-AC-059/060): status, atoms, witnesses, overlaps,
 // shadowed/unreachable — budget-exceeded is never presented as success.
 const a=plan.analysis,proved=a.status==='proved-over-declared-domains';
 h+='<div class="decision-analysis"><span class="tag '+(proved?'teal':'amber')+'">ANALYSIS · '+esc(a.status)+'</span> ';
 if(a.status==='budget_exceeded')h+='<span class="tag amber">UNESTABLISHED — disjointness/coverage NOT established</span> '+esc(a.combinations)+' partition atoms exceed the budget of '+esc(a.budget)+'.';
 else h+=esc(String(a.checks||0))+' tested partition atoms of '+esc(String(a.combinations))+'.';
 if(a.uncovered?.length)h+='<div>Uncovered input witnesses ('+a.uncovered.length+' shown, first 20 retained): '+a.uncovered.map(w=>'<code class="witness">'+esc(JSON.stringify(w))+'</code>').join('')+'</div>';
 if(a.overlaps?.length)h+='<div>Overlapping rule pairs with witness inputs: '+a.overlaps.map(o=>'<code class="witness">'+esc(o.rules.map(r=>r.split('::').pop()).join(' + '))+' ← '+esc(JSON.stringify(o.input))+'</code>').join('')+'</div>';
 if(a.shadowed?.length)h+='<div>Shadowed first-hit rules: '+a.shadowed.map(r=>'<code class="witness">'+esc(r.split('::').pop())+'</code>').join('')+'</div>';
 if(a.unreachable?.length)h+='<div>Unreachable rules (no domain atom matches): '+a.unreachable.map(r=>'<code class="witness">'+esc(r.split('::').pop())+'</code>').join('')+'</div>';
 if(proved&&!a.uncovered?.length&&!a.overlaps?.length)h+=' <span class="small muted">No uncovered domain atoms; no overlaps.</span>';
 h+='</div>';
 // Fixture evaluator (read-only): typed controls per declared input domain.
 h+='<div class="decision-analysis"><span class="tag">FIXTURE EVALUATION · READ-ONLY</span><div class="fixture-form">';
 for(const d of inputs){
  h+='<label>'+esc(d.key)+'</label>';
  const extra=(d.nullable?'<option value="__null">null</option>':'')+(d.optional?'<option value="__missing">missing</option>':'');
  if(d.type==='enum')h+='<select data-fix="'+esc(d.key)+'">'+d.values.map(v=>'<option value="'+esc(String(v))+'">'+esc(String(v))+'</option>').join('')+extra+'</select>';
  else if(d.type==='boolean')h+='<select data-fix="'+esc(d.key)+'"><option value="true">true</option><option value="false">false</option>'+extra+'</select>';
  else h+='<input type="number" step="any" data-fix="'+esc(d.key)+'" value="'+esc(String(d.min??0))+'">'+(extra?'<select data-fix-special="'+esc(d.key)+'"><option value="">number</option>'+extra+'</select>':'');
 }
 h+='<button id="decisionEval" class="primary" title="Evaluate the fixture input against the rules (read-only)">Evaluate</button></div>';
 if(decisionFixture){
  if(decisionFixture.error)h+='<div class="notice error">'+esc(decisionFixture.error)+'</div>';
  else{const r=decisionFixture.result;h+='<div class="fixture-result">status <strong>'+esc(r.status)+'</strong> · matched ['+r.matched.map(x=>esc(x.split('::').pop())).join(', ')+'] · selected ['+r.selected.map(x=>esc(x.split('::').pop())).join(', ')+']'+(r.outputs.length?' · outputs '+r.outputs.map(o=>'<code class="witness">'+esc(JSON.stringify(o))+'</code>').join(''):'')+'</div>';}
 }
 h+='</div>';
 h+='<div class="batchbar"><span class="tag">ADD RULE</span><input id="decNewId" placeholder="rule_id" aria-label="New rule identifier"><input id="decNewLabel" placeholder="Label" aria-label="New rule label"><button id="decAddRule" title="Add a rule with a default outcome per declared type">＋ Add rule</button><span class="small muted">Creates one shared <code>rule.row</code> definition with a default outcome per declared type, appends its ref to <code>projection.records</code> — one transaction. An overlap under a unique policy commits as a draft with the witness shown above (VE-007).</span></div>';
 setSheet(sheet,h);
 $('#decisionPolicy').onchange=e=>decisionTxn('Set hit policy to '+e.target.value+' (this view only)',t=>CMD.setDecisionPolicy(D,t,entry,view,{hitPolicy:e.target.value}));
 $('#decisionCoverage').onchange=e=>decisionTxn('Set coverage to '+e.target.value+' (this view only)',t=>CMD.setDecisionPolicy(D,t,entry,view,{coverage:e.target.value}));
 sheet.querySelectorAll('[data-rule-up],[data-rule-down]').forEach(b=>b.onclick=()=>{
  const ids=plan.rules.map(r=>r.id),i=+(b.dataset.ruleUp??b.dataset.ruleDown),j=b.dataset.ruleUp!==undefined?i-1:i+1;
  [ids[i],ids[j]]=[ids[j],ids[i]];
  decisionTxn('Reorder rules (records order — semantic for first-match policies)',t=>CMD.reorderDecisionRules(D,t,entry,view,{orderedIds:ids}));
 });
 const commitWhen=cell=>{
  const ruleId=cell.dataset.rule,rule=plan.rules.find(r=>r.id===ruleId);
  let when;
  try{
   when={};
   for(const d of inputs){const c=sheet.querySelector('.pred[data-rule="'+CSS.escape(ruleId)+'"][data-input="'+d.key+'"]'),pred=decisionPredFromCell(c,d);if(pred)when[d.key]=pred;}
  }catch(e){decisionNotice=e.code+': '+e.message;renderDecisionSheet();return;}
  decisionTxn('Edit conditions of '+rule.node.name+' (shared model)',t=>CMD.editDecisionRule(D,t,entry,view,{ruleId,when}));
 };
 sheet.querySelectorAll('td.pred').forEach(cell=>{
  cell.querySelectorAll('select,input').forEach(el=>el.onchange=()=>commitWhen(cell));
  const add=cell.querySelector('[data-pred-add]');
  if(add)add.onclick=()=>{
   const d=inputs.find(x=>x.key===cell.dataset.input),ruleId=cell.dataset.rule;
   const when={...plan.rules.find(r=>r.id===ruleId).when};
   when[d.key]=d.type==='number'?{op:'interval',min:d.min,max:d.max}:d.type==='boolean'?{op:'eq',value:true}:{op:'eq',value:d.values[0]};
   decisionTxn('Add a condition on '+d.key+' (shared model)',t=>CMD.editDecisionRule(D,t,entry,view,{ruleId,when}));
  };
  const del=cell.querySelector('[data-pred-del]');
  if(del)del.onclick=()=>{
   const ruleId=cell.dataset.rule,when={...plan.rules.find(r=>r.id===ruleId).when};
   delete when[cell.dataset.input];
   decisionTxn('Remove the condition on '+cell.dataset.input+' (shared model)',t=>CMD.editDecisionRule(D,t,entry,view,{ruleId,when}));
  };
 });
 sheet.querySelectorAll('td.outcome').forEach(cell=>{
  const inp=cell.querySelector('[data-out-val]');
  inp.onchange=()=>{
   const ruleId=cell.dataset.rule,k=cell.dataset.output,rule=plan.rules.find(r=>r.id===ruleId),old=rule.then[k];
   let value;
   if(typeof old==='boolean')value=inp.checked;
   else if(typeof old==='number'){if(inp.value.trim()===''||!Number.isFinite(Number(inp.value))){announce('Numeric outcomes accept numbers only — numeric strings are not coerced. Nothing was changed.',true);inp.value=old;return;}value=Number(inp.value);}
   else value=inp.value;
   if(value===old)return;
   decisionTxn('Edit outcome '+k+' of '+rule.node.name+' (shared model)',t=>CMD.editDecisionRule(D,t,entry,view,{ruleId,then:{...rule.then,[k]:value}}));
  };
 });
 sheet.querySelectorAll('[data-rule-del]').forEach(b=>b.onclick=()=>{const rule=plan.rules.find(r=>r.id===b.dataset.ruleDel);decisionTxn('Delete rule '+rule.node.name+' (definition + records ref, one transaction)',t=>CMD.deleteDecisionRule(D,t,entry,view,{ruleId:rule.id}));});
 $('#decisionEval').onclick=()=>{
  const input={};
  try{
   for(const d of inputs){
    const el=sheet.querySelector('[data-fix="'+d.key+'"]'),special=sheet.querySelector('[data-fix-special="'+d.key+'"]');
    if(special&&special.value==='__missing')continue;
    if(special&&special.value==='__null'){input[d.key]=null;continue;}
    const raw=el.value;
    if(raw==='__missing')continue;
    if(raw==='__null'){input[d.key]=null;continue;}
    input[d.key]=decisionScalar(raw,d);
   }
  }catch(e){decisionFixture={error:e.code+': '+e.message};renderDecisionSheet();return;}
  try{decisionFixture={result:CMD.evaluateDecisionFixture(D,ws,entry,view,{input})};}
  catch(e){decisionFixture={error:e.code+': '+e.message};}
  renderDecisionSheet();
 };
 $('#decAddRule').onclick=()=>{
  const id=$('#decNewId').value.trim(),label=$('#decNewLabel').value.trim();
  if(!id){decisionNotice='DDN-I033: A new rule needs an identifier. Nothing was changed.';renderDecisionSheet();return;}
  const first=plan.rules[0],then={};
  for(const k of outputs)then[k]=first?typeof first.then[k]==='boolean'?false:typeof first.then[k]==='number'?0:'undecided':'undecided';
  decisionTxn('Add decision rule (shared definition + records ref)',t=>CMD.addDecisionRule(D,t,entry,view,{id,label:label||id,when:{},then}));
 };
}
// Sequence sheet (spec ch.09 structured sheets; ED-012; RT-101 uml.sequence@1
// gate). Lifelines column mirrors ws.projectionPlan(entry,view).participants
// with up/down/remove/add controls; messages column mirrors .messages with a
// label input, from→to badges, a return checkbox (x_return true-or-absent)
// and up/down/delete. Order is declaration order: every up/down is a
// moveDeclaration span move of the declaration itself, never a pixel drag and
// never a view-list rewrite (VE-AC-062). No placement/Arrange control exists
// here — the runtime rejects layout overrides LIVE021 (VE-AC-063). Silent
// participants show the runtime's own DDN-PJW03 text (VE-007, surfaced).
const sequenceProfile=()=>ir?.view.profiles.projection?.kind==='sequence'?ir.view.profiles.projection:null;
function sequenceTxn(label,fn){lastEditError=null;const ok=transaction(label,fn);sequenceNotice=ok?null:(lastEditError?(lastEditError.code||'EDIT')+': '+lastEditError.message:'Edit rejected; source unchanged.');if(!ok)renderSequenceSheet();return ok;}
function renderSequenceSheet(){
 const sheet=$('#sequenceSheet');
 if(!sheet)return;
 const p=sequenceProfile();
 if(!p){sheet.hidden=true;sheet.innerHTML='';seqConnectFrom=null;return;}
 sheet.hidden=false;
 let plan=null,planError=null;
 try{plan=ws.projectionPlan(entry,view);}catch(e){planError=(e.code||'PLAN')+': '+e.message;}
 let h='<div class="sheet-head"><span class="tag teal">SEQUENCE SHEET · LIVE SOURCE EDITING</span><span class="sheet-target">Order is <strong>declaration order</strong>: ↑/↓ moves the declaration span in source (moveDeclaration), never pixels · messages are shared <code>uml.message</code> relations (<code>x_return</code> true-or-absent) · no placement or Arrange exists in this projection (LIVE021)</span></div>';
 if(sequenceNotice)h+='<div class="notice error">'+esc(sequenceNotice)+'</div>';
 if(planError){h+='<div class="notice error">'+esc(planError)+' The sheet stays read-only; the source is unchanged.</div>';setSheet(sheet,h);return;}
 const pjW03=(result?.diagnostics||[]).filter(d=>d.code==='DDN-PJW03');
 const nameOf=id=>ir.elements.find(n=>n.id===id)?.name||String(id).split('::').pop();
 h+='<div class="seq-cols"><div class="seq-col"><h3>Lifelines · declaration order</h3><table aria-label="Sequence lifelines"><tbody>';
 plan.participants.forEach((n,i)=>{
  const warn=pjW03.find(d=>d.message.includes(n.name));
  h+='<tr'+(selected===n.id?' class="sel"':'')+'><th>'+esc(n.name)+'<br><code class="id">'+esc(n.id.split('::').pop())+'</code>'+(warn?'<div class="seq-warn"><strong>'+esc(warn.code)+'</strong> '+esc(warn.message)+'</div>':'')+'</th>';
  h+='<td class="seq-actions"><button data-seq-life-up="'+i+'" '+(i===0?'disabled':'')+' title="Move one lifeline left (declaration span move)">↑</button><button data-seq-life-down="'+i+'" '+(i===plan.participants.length-1?'disabled':'')+' title="Move one lifeline right">↓</button><button data-seq-life-remove="'+esc(n.id)+'" title="Hide this lifeline from the view; the shared definition is kept">remove</button></td></tr>';
 });
 h+='</tbody></table>';
 const candidates=ir.elements.filter(n=>n.type==='object'&&!plan.participants.some(x=>x.id===n.id));
 h+='<div class="batchbar"><span class="tag">ADD LIFELINE</span><select id="seqLifePick">'+candidates.map(n=>'<option value="'+esc(n.id)+'">'+esc(n.name)+'</option>').join('')+'</select><button id="seqLifeAdd" '+(candidates.length?'':'disabled')+' title="Add the selected existing definition as one lifeline occurrence">＋ Add existing</button><span class="small muted">or create a new participant:</span><input id="seqLifeNewId" placeholder="participant_id" aria-label="New participant identifier"><input id="seqLifeNewLabel" placeholder="Label" aria-label="New participant label"><button id="seqLifeNew" title="Create a new participant in this view">＋ New</button><span class="small muted">Add-existing adds one occurrence (addExistingToView) — never a clone. A participant without messages surfaces the runtime’s DDN-PJW03 above.</span></div></div>';
 h+='<div class="seq-col"><h3>Messages · top-to-bottom declaration order</h3><table aria-label="Sequence messages"><tbody>';
 plan.messages.forEach((r,i)=>{
  h+='<tr'+(selected===r.id?' class="sel"':'')+'><th><input data-seq-msg-label="'+esc(r.id)+'" value="'+esc(r.name)+'" aria-label="Message '+(i+1)+' label"></th>';
  h+='<td><span class="chip">'+esc(nameOf(r.from.element))+' → '+esc(nameOf(r.to.element))+'</span>'+(r.from.element===r.to.element?' <span class="tag amber">SELF</span>':'')+'</td>';
  h+='<td style="white-space:nowrap"><label class="small"><input type="checkbox" data-seq-msg-return="'+esc(r.id)+'" '+(r.properties.x_return===true?'checked':'')+'> dashed return</label></td>';
  h+='<td class="seq-actions"><button data-seq-msg-up="'+i+'" '+(i===0?'disabled':'')+' title="Move one row up (declaration span move)">↑</button><button data-seq-msg-down="'+i+'" '+(i===plan.messages.length-1?'disabled':'')+' title="Move one row down">↓</button><button data-seq-msg-del="'+esc(r.id)+'" title="Delete this message relation">delete</button></td></tr>';
 });
 h+='</tbody></table>';
 h+='<div class="batchbar"><span class="tag">ADD MESSAGE</span><select id="seqMsgFrom">'+plan.participants.map(n=>'<option value="'+esc(n.id)+'">'+esc(n.name)+'</option>').join('')+'</select><span class="preview-arrow">→</span><select id="seqMsgTo">'+plan.participants.map(n=>'<option value="'+esc(n.id)+'">'+esc(n.name)+'</option>').join('')+'</select><input id="seqMsgLabel" placeholder="Label" aria-label="New message label"><label class="small" style="white-space:nowrap"><input id="seqMsgReturn" type="checkbox"> return</label><button id="seqMsgAdd" title="Append the message as the last row (declaration order)">＋ Add</button><span class="small muted">Appends the last row (declaration order); ↑ repositions afterwards. The canvas two-click connect on lifeline headers is the equivalent gesture (VE-006). Self-messages are legal.</span></div></div></div>';
 setSheet(sheet,h);
 sheet.querySelectorAll('[data-seq-life-up]').forEach(b=>b.onclick=()=>{const i=+b.dataset.seqLifeUp;sequenceTxn('Move lifeline '+plan.participants[i].name+' one position left',t=>CMD.reorderLifelines(D,t,entry,view,{participantId:plan.participants[i].id,beforeId:plan.participants[i-1].id}));});
 sheet.querySelectorAll('[data-seq-life-down]').forEach(b=>b.onclick=()=>{const i=+b.dataset.seqLifeDown;sequenceTxn('Move lifeline '+plan.participants[i].name+' one position right',t=>CMD.reorderLifelines(D,t,entry,view,{participantId:plan.participants[i+1].id,beforeId:plan.participants[i].id}));});
 sheet.querySelectorAll('[data-seq-life-remove]').forEach(b=>b.onclick=()=>{const id=b.dataset.seqLifeRemove;sequenceTxn('Hide lifeline '+nameOf(id)+' from this view (definition kept)',t=>{D.authoring.hide(t,entry,view,id);t.projectionPlan(entry,view);});});
 $('#seqLifeAdd').onclick=()=>{const id=$('#seqLifePick').value;if(id)sequenceTxn('Add existing '+nameOf(id)+' as a lifeline (one occurrence)',t=>CMD.occurrences.addExistingToView(D,t,entry,{definitionId:id,viewId:view}));};
 $('#seqLifeNew').onclick=()=>{
  const id=$('#seqLifeNewId').value.trim(),label=$('#seqLifeNewLabel').value.trim();
  if(!id){sequenceNotice='DDN-I033: A new participant needs an identifier. Nothing was changed.';renderSequenceSheet();return;}
  sequenceTxn('Create participant '+id+' in this view (shared definition)',t=>CMD.createInView(D,t,entry,view,{id,name:label||id,kind:'service'}));
 };
 sheet.querySelectorAll('[data-seq-msg-label]').forEach(inp=>inp.onchange=()=>{const id=inp.dataset.seqMsgLabel,r=plan.messages.find(x=>x.id===id);if(inp.value!==r.name)sequenceTxn('Rename message '+r.name+' (shared relation label)',t=>CMD.setMessageLabel(D,t,entry,view,{relationId:id,label:inp.value}));});
 sheet.querySelectorAll('[data-seq-msg-return]').forEach(inp=>inp.onchange=()=>{const id=inp.dataset.seqMsgReturn;sequenceTxn((inp.checked?'Set':'Clear')+' dashed return on '+nameOfMessage(id),t=>CMD.setMessageReturn(D,t,entry,view,{relationId:id,isReturn:inp.checked}));});
 sheet.querySelectorAll('[data-seq-msg-up]').forEach(b=>b.onclick=()=>{const i=+b.dataset.seqMsgUp;sequenceTxn('Move message '+plan.messages[i].name+' one row up',t=>CMD.moveDeclaration(D,t,entry,view,{definitionId:plan.messages[i].id,beforeId:plan.messages[i-1].id}));});
 sheet.querySelectorAll('[data-seq-msg-down]').forEach(b=>b.onclick=()=>{const i=+b.dataset.seqMsgDown;sequenceTxn('Move message '+plan.messages[i].name+' one row down',t=>CMD.moveDeclaration(D,t,entry,view,{definitionId:plan.messages[i+1].id,beforeId:plan.messages[i].id}));});
 sheet.querySelectorAll('[data-seq-msg-del]').forEach(b=>b.onclick=()=>{const id=b.dataset.seqMsgDel;sequenceTxn('Delete message '+nameOfMessage(id)+' (guarded relation delete)',t=>CMD.removeSequenceMessage(D,t,entry,view,{relationId:id}));});
 $('#seqMsgAdd').onclick=()=>{
  const from=$('#seqMsgFrom').value,to=$('#seqMsgTo').value,label=$('#seqMsgLabel').value.trim(),ret=$('#seqMsgReturn').checked;
  sequenceTxn('Add sequence message '+nameOf(from)+' → '+nameOf(to),t=>CMD.addSequenceMessage(D,t,entry,view,{id:'msg_'+counter++,label:label||'New message',fromId:from,toId:to,isReturn:ret}));
 };
 function nameOfMessage(id){return plan.messages.find(x=>x.id===id)?.name||String(id).split('::').pop();}
}
// Two-click connect on lifeline headers (VE-006 — the inspector list above is
// the equivalent path; no drag-only gesture). First click marks the source
// header, second click opens the same label/return modal used by the sheet.
function sequenceConnectModal(fromId,toId){
 const nameOf=id=>ir.elements.find(n=>n.id===id)?.name||id;
 modal('Create a sequence message','<p>Creates one shared <code>uml.message</code> relation from <strong>'+esc(nameOf(fromId))+'</strong> to <strong>'+esc(nameOf(toId))+'</strong> — appended as the last row (declaration order); the sheet’s ↑/↓ repositions it as a span move. Endpoints that are not selected participant objects reject DDN-PJ110 before commit.</p><label for="seqConnLabel">Label</label><input id="seqConnLabel" value="New message"><label class="small"><input id="seqConnReturn" type="checkbox"> dashed return (x_return)</label>',[{label:'Cancel',action:closeModal},{label:'Create message',primary:true,action:()=>{
  const ok=sequenceTxn('Two-click connect '+nameOf(fromId)+' → '+nameOf(toId),t=>CMD.addSequenceMessage(D,t,entry,view,{id:'msg_'+counter++,label:$('#seqConnLabel').value.trim()||'New message',fromId,toId,isReturn:$('#seqConnReturn').checked}));
  if(ok)closeModal();
 }}]);
}
function cancelTimelineDrag(silent){
 if(!tDrag)return;
 try{tDrag.el.removeAttribute('transform');}catch{}
 tDrag.tip?.remove();
 tDrag=null;
 if(!silent)announce('Date drag cancelled; source unchanged.');
}
function highlight(){const paper=$('#paper');paper.querySelectorAll('.selected,.member-selected').forEach(e=>e.classList.remove('selected','member-selected'));if(!selected){$('#selectionStatus').textContent='No selection';return;}const match=paper.querySelector('[data-id="'+CSS.escape(selected)+'"]');if(match)match.classList.add('selected');const member=paper.querySelector('[data-member="'+CSS.escape(selected)+'"]');if(member){member.classList.add('member-selected');member.closest('[data-id]')?.classList.add('selected');}$('#selectionStatus').textContent=selected?'Selected: '+sourceLabel(selected):'No selection';}
function choose(id){selected=id;$('#workspace').classList.add('inspecting');highlight();updateInspector();}
function setTab(t){tab=t;panelRoot('inspectorTabs').querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));updateInspector();}
function setView(v){cancelTimelineDrag(true);optionsByView[entry+'#'+view]={...overrides};const knownProjections=['flowchart','raci','chart_bar','gantt','fishbone','responsibility_graph','crud','matrix_general','swot','sipoc','journey','decision','sequence'];let nextEntry=knownProjections.includes(v)?'projections/views.ddn':'model.ddn';if(!knownProjections.includes(v)&&!['overview','names'].includes(v)){for(const e of ws.entries()){try{if(ws.views(e.file).some(x=>x.id===v)){nextEntry=e.file;break;}}catch{}}}view=v;entry=nextEntry;overrides=optionsByView[entry+'#'+view]||{page:'content',look:'classic',theme:'default'};selected=entry==='model.ddn'?'designer.sample::model.customer':null;zoom=1;updateZoom();mode='select';mSel=null;mBatch=[];chartSel=null;chartNotice=null;timelineNotice=null;fishboneNotice=null;panelsNotice=null;panelsSel=null;decisionNotice=null;decisionFixture=null;laneNotice=null;sequenceNotice=null;seqConnectFrom=null;$('#connectTool').classList.remove('active');$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));draw();document.body.classList.toggle('night',overrides.theme==='night');}
// B1-014 D1: Display tab — designer-only presentation control over the current
// view. Global typography and relation options write through the existing
// optionsByView override channel (reflow-safe re-render, session-scoped);
// per-kind typography and kind/verb/object colours are a CSS overlay on #paper
// persisted in localStorage keyed by entry#view. Nothing here ever writes to
// the .ddn source — the tab is headed accordingly, mirroring viewer semantics.
const displayKey=()=>entry+'#'+view;
function displayGet(){
 let s=null;try{s=JSON.parse(store.get('ddn-designer-display:'+displayKey())||'null');}catch{s=null;}
 if(!s||typeof s!=='object')s={};
 return{typography:s.typography||{},kindColours:s.kindColours||{},verbColours:s.verbColours||{},objectColours:s.objectColours||{}};
}
function displaySet(s){store.set('ddn-designer-display:'+displayKey(),JSON.stringify(s));}
let displayOverlayEl=null;
function applyDisplay(){
 if(!displayOverlayEl){displayOverlayEl=document.createElement('style');displayOverlayEl.id='displayOverlay';document.head.appendChild(displayOverlayEl);}
 displayOverlayEl.textContent=CMD.display.css(displayGet());
}
function displayKindRows(){
 const seen=new Map();
 for(const n of ir?.elements||[])if(!seen.has(n.kind))seen.set(n.kind,{kind:n.kind,code:codeOf(n.kind)||n.kind,name:kindEntry(n.kind)?.name||n.kind});
 return [...seen.values()].sort((a,b)=>a.name.localeCompare(b.name,'en'));
}
function displayVerbRows(){
 const seen=new Map();
 for(const r of ir?.relations||[])if(!seen.has(r.kind)){const reg=D.relations.find(x=>x.id===r.kind);seen.set(r.kind,{verb:r.kind,code:(reg?.code||r.kind),label:reg?.label||r.kind});}
 return [...seen.values()].sort((a,b)=>a.label.localeCompare(b.label,'en'));
}
function renderDisplayTab(pane){
 const s=displayGet(),DISP=CMD.display;
 const famOpts=cur=>'<option value="source">Source default</option>'+Object.keys(DISP.FONT_STACKS).map(f=>'<option value="'+f+'"'+(cur===f?' selected':'')+'>'+f+' — '+esc(DISP.FONT_STACKS[f].split(',')[0])+'</option>').join('');
 const sizeOpts=cur=>'<option value="source">Source default</option>'+DISP.FONT_SIZES.map(n=>'<option value="'+n+'"'+(String(cur??'source')===String(n)?' selected':'')+'>'+n+' px</option>').join('');
 const kinds=displayKindRows(),verbs=displayVerbRows();
 const HEAD='<p class="help small muted">Designer display only — never written to source. Look, palette, field and route preview controls stay on the inspector’s This-view tab; this tab adds viewer-grade typography, colour and relation options.</p>';
 let h='<div class="row"><span class="tag teal">DISPLAY · THIS VIEW</span></div>'+HEAD;
 // Global typography — override channel (reflow-safe).
 h+='<details class="display-sec" open><summary>Global typography <span class="muted">override channel</span></summary>'
  +'<label for="dispFont">Font family</label><select id="dispFont">'+famOpts(overrides.font||'source')+'</select>'
  +'<label for="dispFontSize">Font size</label><select id="dispFontSize">'+sizeOpts(overrides.fontSize??'source')+'</select>'
  +'<div class="row" style="margin-top:8px"><button data-display-reset="global" title="Reset the global typography overrides for this view">Reset section</button></div></details>';
 // Typography per kind — CSS overlay (no reflow).
 h+='<details class="display-sec" open><summary>Typography per kind <span class="muted">CSS overlay · no reflow</span></summary>';
 if(!kinds.length)h+='<p class="help small muted">No kinds in the current render.</p>';
 for(const k of kinds){
  const st=s.typography[k.code]||{};
  h+='<div class="typ-row"><span class="typ-label">'+esc(k.name)+' <code>'+esc(k.code)+'</code></span><div class="typ-controls"><select data-typ-family="'+esc(k.code)+'" aria-label="'+esc(k.name)+' font family">'+famOpts(st.family||'source')+'</select><select class="typ-size" data-typ-size="'+esc(k.code)+'" aria-label="'+esc(k.name)+' font size">'+sizeOpts(st.size??'source')+'</select></div></div>';
 }
 h+='<div class="row" style="margin-top:8px"><button data-display-reset="typography" title="Clear every per-kind typography rule for this view">Reset section</button></div></details>';
 // Colours — CSS overlay.
 h+='<details class="display-sec" open><summary>Colours <span class="muted">CSS overlay</span></summary>';
 h+='<div class="sectionlabel" style="margin-top:6px">Kind fill</div>';
 for(const k of kinds)h+='<div class="swatch-row"><span class="typ-label">'+esc(k.name)+' <code>'+esc(k.code)+'</code></span><input type="color" data-kind-colour="'+esc(k.code)+'" value="'+esc(s.kindColours[k.code]||'#ffffff')+'" aria-label="'+esc(k.name)+' fill colour"><button data-kind-colour-clear="'+esc(k.code)+'" '+(s.kindColours[k.code]?'':'disabled')+' title="Clear this kind’s fill override">×</button></div>';
 h+='<div class="sectionlabel">Verb stroke</div>';
 if(!verbs.length)h+='<p class="help small muted">No relations in the current render.</p>';
 for(const v of verbs)h+='<div class="swatch-row"><span class="typ-label">'+esc(v.label)+' <code>'+esc(v.code)+'</code></span><input type="color" data-verb-colour="'+esc(v.code)+'" value="'+esc(s.verbColours[v.code]||'#17263d')+'" aria-label="'+esc(v.label)+' stroke colour"><button data-verb-colour-clear="'+esc(v.code)+'" '+(s.verbColours[v.code]?'':'disabled')+' title="Clear this verb’s stroke override">×</button></div>';
 h+='<div class="sectionlabel">Object fill</div>';
 const colourEntries=Object.entries(s.objectColours);
 h+=colourEntries.length?colourEntries.map(([id,col])=>'<div class="swatch-row"><span class="typ-label">'+esc(sourceLabel(id))+'</span><input type="color" data-object-colour="'+esc(id)+'" value="'+esc(col)+'" aria-label="'+esc(sourceLabel(id))+' fill colour"><button data-object-colour-clear="'+esc(id)+'" title="Clear this object’s fill override">×</button></div>').join(''):'<p class="help small muted">No object colour overrides yet.</p>';
 h+='<div class="row" style="margin-top:6px"><select id="dispObjectPick" aria-label="Object to colour">'+(ir?.elements||[]).map(n=>'<option value="'+esc(n.id)+'"'+(n.id===selected?' selected':'')+'>'+esc(n.name)+'</option>').join('')+'</select><input type="color" id="dispObjectColour" value="#fde68a" aria-label="New object fill colour"><button id="dispObjectApply" title="Colour the picked object (click a node on the canvas to select it here)">Apply</button></div>';
 h+='<div class="row" style="margin-top:8px"><button data-display-reset="colours" title="Clear every kind, verb and object colour rule for this view">Reset section</button></div></details>';
 // Relations — override channel.
 const rr=overrides.relationRouting||{};
 const opt=(list,cur)=>['<option value="source">Source default</option>'].concat(list.map(v=>'<option value="'+v+'"'+(cur===v?' selected':'')+'>'+v+'</option>')).join('');
 const bound=!graph();
 h+='<details class="display-sec" open><summary>Relations <span class="muted">override channel'+(bound?' · graph views only':'')+'</span></summary>'
  +(bound?'<p class="help small muted">Data-bound projections own their geometry; the runtime rejects relation overrides here (LIVE021).</p>':'')
  +'<label for="dispRouting">Routing</label><select id="dispRouting" '+(bound?'disabled':'')+'>'+opt(DISP.ROUTING,overrides.routing||'source')+'</select>'
  +'<label for="dispCrossings">Crossings</label><select id="dispCrossings" '+(bound?'disabled':'')+'>'+opt(DISP.CROSSINGS,overrides.crossings||'source')+'</select>'
  +'<label for="dispOrdering">Endpoint ordering</label><select id="dispOrdering" '+(bound?'disabled':'')+'>'+opt(DISP.ENDPOINT_ORDERING,overrides.endpointOrdering||'source')+'</select>'
  +'<div class="kv"><div><label for="dispTension">Curve tension · 0–1</label><input id="dispTension" type="number" min="0" max="1" step="0.05" value="'+esc(overrides.curveTension??'')+'" '+(bound?'disabled':'')+'></div><div><label for="dispRadius">Curve radius · px</label><input id="dispRadius" type="number" min="0" max="512" step="1" value="'+esc(overrides.curveRadius??'')+'" '+(bound?'disabled':'')+'></div></div>';
 if(verbs.length){
  h+='<div class="sectionlabel">Routing per relation type</div>';
  for(const v of verbs)h+='<div class="typ-row"><span class="typ-label">'+esc(v.label)+' <code>'+esc(v.verb)+'</code></span><div class="typ-controls"><select data-verb-routing="'+esc(v.verb)+'" '+(bound?'disabled':'')+' aria-label="'+esc(v.label)+' routing">'+opt(DISP.ROUTING,rr[v.verb]||'source')+'</select></div></div>';
 }
 h+='<div class="row" style="margin-top:8px"><button data-display-reset="relations" title="Reset the relation overrides for this view" '+(bound?'disabled':'')+'>Reset section</button></div></details>';
 h+='<div class="row" style="margin-top:12px"><button id="displayResetAll" class="wide" title="Reset every display option for this view — overlay and override channel">Reset all display options</button></div>';
 pane.innerHTML=h;
 // Global typography → override channel.
 const chan=(id,key)=>{const el=pane.querySelector('#'+id);if(el)el.onchange=()=>{if(el.value==='source'||el.value==='')delete overrides[key];else overrides[key]=key==='fontSize'?Number(el.value):el.value;draw();};};
 chan('dispFont','font');chan('dispFontSize','fontSize');chan('dispRouting','routing');chan('dispCrossings','crossings');chan('dispOrdering','endpointOrdering');
 const num=(id,key)=>{const el=pane.querySelector('#'+id);if(el)el.onchange=()=>{if(el.value==='')delete overrides[key];else{const n=Number(el.value);if(!Number.isFinite(n))return;overrides[key]=n;}draw();};};
 num('dispTension','curveTension');num('dispRadius','curveRadius');
 // CSS overlay state.
 const persist=()=>{displaySet(s);applyDisplay();};
 pane.querySelectorAll('[data-typ-family],[data-typ-size]').forEach(el=>el.onchange=()=>{
  const code=el.dataset.typFamily||el.dataset.typSize,key=el.dataset.typFamily?'family':'size';
  const cur={...(s.typography[code]||{})};if(el.value==='source')delete cur[key];else cur[key]=key==='size'?Number(el.value):el.value;
  if(Object.keys(cur).length)s.typography[code]=cur;else delete s.typography[code];
  persist();renderDisplayTab(pane);
 });
 pane.querySelectorAll('[data-kind-colour]').forEach(el=>el.onchange=()=>{s.kindColours[el.dataset.kindColour]=el.value;persist();renderDisplayTab(pane);});
 pane.querySelectorAll('[data-kind-colour-clear]').forEach(el=>el.onclick=()=>{delete s.kindColours[el.dataset.kindColourClear];persist();renderDisplayTab(pane);});
 pane.querySelectorAll('[data-verb-colour]').forEach(el=>el.onchange=()=>{s.verbColours[el.dataset.verbColour]=el.value;persist();renderDisplayTab(pane);});
 pane.querySelectorAll('[data-verb-colour-clear]').forEach(el=>el.onclick=()=>{delete s.verbColours[el.dataset.verbColourClear];persist();renderDisplayTab(pane);});
 pane.querySelectorAll('[data-object-colour]').forEach(el=>el.onchange=()=>{s.objectColours[el.dataset.objectColour]=el.value;persist();renderDisplayTab(pane);});
 pane.querySelectorAll('[data-object-colour-clear]').forEach(el=>el.onclick=()=>{delete s.objectColours[el.dataset.objectColourClear];persist();renderDisplayTab(pane);});
 pane.querySelector('#dispObjectApply').onclick=()=>{const id=pane.querySelector('#dispObjectPick').value,col=pane.querySelector('#dispObjectColour').value;if(!id)return;s.objectColours[id]=col;persist();renderDisplayTab(pane);};
 pane.querySelectorAll('[data-verb-routing]').forEach(el=>el.onchange=()=>{
  const next={...(overrides.relationRouting||{})};
  if(el.value==='source')delete next[el.dataset.verbRouting];else next[el.dataset.verbRouting]=el.value;
  if(Object.keys(next).length)overrides.relationRouting=next;else delete overrides.relationRouting;
  draw();
 });
 pane.querySelectorAll('[data-display-reset]').forEach(b=>b.onclick=()=>{
  const sec=b.dataset.displayReset;
  if(sec==='global'){delete overrides.font;delete overrides.fontSize;draw();}
  else if(sec==='typography'){s.typography={};persist();renderDisplayTab(pane);}
  else if(sec==='colours'){s.kindColours={};s.verbColours={};s.objectColours={};persist();renderDisplayTab(pane);}
  else if(sec==='relations'){for(const k of ['routing','crossings','endpointOrdering','curveTension','curveRadius','relationRouting'])delete overrides[k];draw();}
 });
 pane.querySelector('#displayResetAll').onclick=()=>{
  for(const k of ['font','fontSize','routing','crossings','endpointOrdering','curveTension','curveRadius','relationRouting'])delete overrides[k];
  displaySet({typography:{},kindColours:{},verbColours:{},objectColours:{}});applyDisplay();draw();
 };
}
function updateLeft(){
 panelRoot('leftTabs').querySelectorAll('[data-left]').forEach(b=>b.classList.toggle('active',b.dataset.left===left));const pane=panelRoot('leftBody');
 if(left==='add'){
 const buttonFor=k=>{const g=D.glyphs?D.glyphs.forKind(k.kind):null;const tip='Add a '+k.name+' element to the current view'+(g&&g.meaning&&g.meaning!==k.name?' — '+g.meaning:'')+' — click or drag onto the canvas';return `<button draggable="true" data-add="${esc(k.kind)}" data-search="${esc((k.name+' '+k.kind+' '+codeOf(k.kind)+' '+(D.kinds.find(x=>x.id===k.kind)?.label||'')).toLowerCase())}" title="${esc(tip)}" aria-label="${esc(tip)}"><span class="glyph">${g?'<svg viewBox="'+esc(g.viewBox)+'" aria-hidden="true">'+g.svg+'</svg>':esc(codeOf(k.kind))}</span><span>${esc(k.name)}</span></button>`;};
 pane.innerHTML='<input id="paletteSearch" placeholder="Find an object…" aria-label="Find any installed kind"><div class="sectionlabel">Installed kinds <span class="countbadge" id="paletteCount">'+KINDMAP.kinds.length+'/'+KINDMAP.kinds.length+'</span></div>'+kindsByGroup.map((g,i)=>'<details class="palette-group" open><summary>'+esc(g.group)+' <span class="countbadge" data-group-count>'+g.kinds.length+'</span></summary><div class="palette">'+g.kinds.map(buttonFor).join('')+'</div></details>').join('')+'<div class="sectionlabel">Canvas templates <span class="countbadge">'+CMD.CANVAS_TEMPLATES.length+'</span></div><div class="template-list">'+CMD.CANVAS_TEMPLATES.map(t=>'<button class="template-card" data-template="'+esc(t.id)+'" title="'+esc(t.profile)+' — one command creates the fixed grid with one synthetic starter note per block"><strong>'+esc(t.title)+'</strong><span class="small muted">'+esc(t.profile)+' · '+t.blocks.length+' blocks</span></button>').join('')+'</div><div class="lefttip">One meaningful object, then options.<br><br>Click = automatic placement.<br>Drag = explicit location and pin.</div><p class="small muted" style="margin-top:15px">The shelf lists all '+KINDMAP.kinds.length+' installed kinds from <code>contracts/kind-ui-map.json</code>, grouped by its palette groups. Profile-filtered specialized shelves remain a specification proposal (<button class="ghost" data-story="library" style="min-height:0;padding:0;font-size:inherit;text-decoration:underline" title="Open the shelf-design screen">shelf design</button>).</p>';
 pane.querySelectorAll('[data-add]').forEach(b=>{b.disabled=!(graph()||projectionKind()==='fishbone'||projectionKind()==='decision');b.onclick=()=>addNode(b.dataset.add);b.ondragstart=e=>{e.dataTransfer.setData('application/x-ddn-kind',b.dataset.add);e.dataTransfer.effectAllowed='copy';};});
 pane.querySelector('#paletteSearch').oninput=e=>{const q=e.target.value.toLowerCase();let shown=0;pane.querySelectorAll('[data-add]').forEach(b=>{const hit=!q||b.dataset.search.includes(q);b.hidden=!hit;if(hit)shown++;});pane.querySelectorAll('.palette-group').forEach(d=>{const visible=[...d.querySelectorAll('[data-add]')].filter(b=>!b.hidden);d.open=!!q&&visible.length>0||!q;d.hidden=!!q&&!visible.length;const badge=d.querySelector('[data-group-count]');if(badge)badge.textContent=q?visible.length+'/'+d.querySelectorAll('[data-add]').length:visible.length;});pane.querySelector('#paletteCount').textContent=shown+'/'+KINDMAP.kinds.length;};pane.querySelectorAll('[data-story]').forEach(b=>b.onclick=()=>story(b.dataset.story));pane.querySelectorAll('[data-template]').forEach(b=>b.onclick=()=>templateDialog(b.dataset.template));
 }else if(left==='display'){
 renderDisplayTab(pane);
 }else if(left==='model'){
 pane.innerHTML='<div class="row"><span class="tag teal">SHARED DEFINITIONS</span></div><p class="help small muted" style="margin-top:10px">Select a definition. This list is a keyboard alternative to the canvas. “＋ view” adds the existing definition to another (or this) view as one occurrence — never a clone (ED-009).</p>'+ir.elements.filter(n=>ir.view.selected.includes(n.id)||!graph()).slice(0,35).map(n=>`<span class="model-row"><button class="model-item" data-select="${esc(n.id)}" title="Select this shared definition">${esc(n.name)} <span class="id">${esc(n.kind)} · ${esc(n.source?.file||'source')}</span></button><button class="addview" data-addview="${esc(n.id)}" title="Add this existing definition to a view (addExistingToView)">＋ view</button></span>`).join('');pane.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>choose(b.dataset.select));pane.querySelectorAll('[data-addview]').forEach(b=>b.onclick=()=>addToView(b.dataset.addview));
 }else{pane.innerHTML='<div class="tag">ONE WORKSPACE · SHARED SOURCE</div>'+['overview','names','raci','chart_bar','gantt','fishbone','swot','sipoc','journey','decision','sequence'].map(v=>`<button class="model-item ${v===view?'active':''}" data-open-view="${v}" style="margin-top:12px" title="Open this view">${({overview:'Structure',names:'Compact',raci:'Responsibilities',chart_bar:'Report',gantt:'Schedule',fishbone:'Fishbone',swot:'SWOT panels',sipoc:'SIPOC panels',journey:'Journey panels',decision:'Decision table',sequence:'Sequence'})[v]}<span class="id">${v==='overview'||v==='names'?'model.ddn':'projections/views.ddn'}</span></button>`).join('')+'<div class="lefttip">Changing a name edits a definition.<br><br>Changing “show fields” edits the appearance of this view.</div>';pane.querySelectorAll('[data-open-view]').forEach(b=>b.onclick=()=>setView(b.dataset.openView));}
}
// Canvas template starters (ED-013; spec ch.06 "Blank workspace" / "Creation
// destination"). One click on a template card opens this dialog: a blocks
// preview as a mini grid, the target entry file, editable view id/label and a
// data-block picker from the entry's parsed declarations. Commit runs
// Commands.createCanvasFromTemplate as ONE transaction — the fixed profile
// grid plus one synthetic starter note per block, never an invented business
// model — then opens the generated view in ED-006's panels editor.
function templateDialog(templateId){
 const tpl=CMD.CANVAS_TEMPLATES.find(x=>x.id===templateId);if(!tpl)return;
 const blocks=CMD.dataBlocks(D,ws,entry);
 if(!blocks.length){announce('DDN-I033: The entry file declares no data block to hold the starter notes. Nothing was changed.',true);return;}
 let viewId=tpl.id+'_canvas',n=2;
 const taken=new Set();for(const e of ws.entries())for(const v of ws.views(e.file)||[])taken.add(v.id);
 while(taken.has(viewId))viewId=tpl.id+'_canvas_'+(n++);
 const rows=Math.max(...tpl.blocks.map(b=>b[2]+b[4]));
 let grid='<div class="tpl-grid" style="grid-template-columns:repeat('+tpl.columns+',1fr)">';
 for(const [pid,title,row,column,rowspan,colspan] of tpl.blocks)grid+='<span class="tpl-cell" style="grid-row:'+(row+1)+' / span '+rowspan+';grid-column:'+(column+1)+' / span '+colspan+'"><strong>'+esc(title)+'</strong><code>'+esc(pid)+'</code></span>';
 grid+='</div>';
 const body='<div class="scope-banner" style="margin:0 0 4px">Template <strong>'+esc(tpl.title)+'</strong> · profile <code>'+esc(tpl.profile)+'</code> · target entry file <code>'+esc(entry)+'</code> · commits against revision '+ws.revision+'</div>'
 +'<p>One command creates the fixed '+tpl.blocks.length+'-block grid with one synthetic starter note per block (“'+esc(tpl.notePrompt)+'” — placeholder guidance, never business data) and opens the new view in the panels editor. A template selects profile and defaults explicitly; it does not inject a complete invented business model.</p>'
 +grid
 +'<label for="tplViewId">View id</label><input id="tplViewId" value="'+esc(viewId)+'">'
 +'<label for="tplViewLabel">View label</label><input id="tplViewLabel" value="'+esc(tpl.title)+'">'
 +'<label for="tplData">Destination data block</label><select id="tplData">'+blocks.map(b=>'<option value="'+esc(b.id)+'">'+esc(b.id)+'</option>').join('')+'</select>'
 +'<p class="help">New objects go to that selected data block — the starter notes land in <code>data '+esc(blocks[0].id)+'</code> (or the block you pick) and the view declaration is appended to <code>'+esc(entry)+'</code> atomically; the fixed blocks stay locked by the canvas guard (DDN-PJ080/081/083).</p>';
 modal('Start a '+tpl.title+' canvas',body,[{label:'Cancel',action:closeModal},{label:'Create canvas',primary:true,action:()=>{
  const id=$('#tplViewId').value.trim(),label=$('#tplViewLabel').value.trim(),dataId=$('#tplData').value;
  if(!id){announce('DDN-I033: A canvas view needs an identifier. Nothing was changed.',true);return;}
  const ok=transaction('Create '+tpl.title+' canvas view '+id+' from template',t=>CMD.createCanvasFromTemplate(D,t,entry,{templateId,viewId:id,viewLabel:label||tpl.title,dataId}));
  if(ok){closeModal();setView(id);announce(tpl.title+' created · '+tpl.blocks.length+' blocks with starter notes · panels editor open · Undo available');}
 }}]);
}
// Lane editing (ED-011; spec ch.08 "Scope versus visual grouping"; VE-003/
// VE-005/VE-008). Lanes are this view's `frame` declarations in canonical
// source — view-local visual groups, never namespaces, scopes, or security
// boundaries. Every assignment (drag- or picker-driven) opens the same
// preview modal stating the exact member changes and that no semantic
// containment, ownership, or placement relationship is created; under
// uml.activity@1 the preview also lists the exact x_partition writes
// (DDN-PJ114 re-checked on commit).
function laneTxn(label,fn){lastEditError=null;const ok=transaction(label,fn);laneNotice=ok?null:(lastEditError?(lastEditError.code||'EDIT')+': '+lastEditError.message:'Edit rejected; source unchanged.');if(!ok)updateInspector();return ok;}
function laneFrameOf(frameId){return (ir?.view.frames||[]).find(f=>f.id===frameId||String(f.id).split('.').pop()===frameId||f.name===frameId)||null;}
function lanesSectionHTML(){
 const frames=ir.view.frames||[],activity=ir.view.profiles.projection?.profile==='uml.activity@1';
 const sceneRect=id=>(result.scene.frames||[]).find(f=>f.id===id);
 let h='<hr><h3>Lanes · view frames</h3><p class="help">Lanes are this view’s <code>frame</code> declarations — view-local visual groups, never namespaces, scopes, or security boundaries (spec ch.08 “Scope versus visual grouping”). Semantic scope membership stays the separate typed-relationship path.'+(activity?' This view’s profile is <code>uml.activity@1</code>: assignment also maintains the registered <code>x_partition</code> lane property.':'')+'</p>';
 if(laneNotice)h+='<div class="notice error">'+esc(laneNotice)+'</div>';
 for(const f of frames){
  const r=sceneRect(f.id);
  h+='<div class="lane-card" data-lanecard="'+esc(f.id)+'"><div class="row"><input data-lanelabel value="'+esc(f.name)+'" aria-label="Lane '+esc(f.name)+' label"><button data-lanerename title="Rename this lane (this view only)">Rename</button></div>';
  h+='<div class="kv lane-rect">'+['x','y','w','h'].map(k=>'<div><label>'+k.toUpperCase()+' · px</label><input type="number" data-lanerect="'+k+'" value="'+Math.round(r?r[k]:0)+'"></div>').join('')+'</div>';
  h+='<div class="row"><button data-laneresize title="Apply the lane’s X/Y/W/H (this view only)">Apply X/Y/W/H</button><button data-lanefit title="Remove explicit at/size; the frame auto-fits its members">Fit to members</button></div>';
  h+='<div class="lane-members">'+f.members.map(m=>'<span class="chip">'+esc(sourceLabel(m))+'<button data-laneunassign="'+esc(m)+'" aria-label="Remove '+esc(sourceLabel(m))+' from lane" title="Remove this member from the lane">×</button></span>').join('')+'</div>';
  const candidates=ir.elements.filter(n=>ir.view.selected.includes(n.id)&&!f.members.includes(n.id));
  h+='<div class="row"><select data-lanepick>'+candidates.map(n=>'<option value="'+esc(n.id)+'">'+esc(n.name)+'</option>').join('')+'</select><button data-laneassign '+(candidates.length?'':'disabled')+' title="Preview assigning the selected object to this lane">Assign…</button></div></div>';
 }
 h+='<div class="lane-card"><div class="row"><span class="tag">NEW LANE</span></div><div class="row"><input id="laneNewId" placeholder="lane_id" aria-label="New lane identifier"><input id="laneNewLabel" placeholder="Label" aria-label="New lane label"></div><div class="kv lane-rect">'+[['laneNewX','X'],['laneNewY','Y'],['laneNewW','W'],['laneNewH','H']].map(([id,k])=>'<div><label>'+k+' · px</label><input id="'+id+'" type="number" value="0"></div>').join('')+'</div><div class="row"><button id="laneAdd" title="Create the lane at the given X/Y/W/H">＋ New lane</button></div><p class="help">An empty lane needs explicit X/Y/W/H to render where you place it; assigning members is a separate previewed step.</p></div>';
 return h;
}
function wireLanesSection(){
 const pane=panelRoot('inspectorBody');
 pane.querySelectorAll('[data-lanecard]').forEach(card=>{
  const fid=card.dataset.lanecard,f=laneFrameOf(fid);
  const rect=k=>{const inp=card.querySelector('[data-lanerect="'+k+'"]');return inp.value===''?undefined:Number(inp.value);};
  card.querySelector('[data-lanerename]').onclick=()=>{
   const label=card.querySelector('[data-lanelabel]').value;
   if(label!==f.name)laneTxn('Rename lane '+f.name+' (this view only)',t=>CMD.renameLane(D,t,entry,view,{frameId:f.id,label}));
  };
  card.querySelector('[data-laneresize]').onclick=()=>{
   const x=rect('x'),y=rect('y'),w=rect('w'),h=rect('h');
   if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0){laneNotice='DDN-I033: Lane X/Y/W/H are required finite numbers with positive W/H. Nothing was changed.';updateInspector();return;}
   laneTxn('Resize lane '+f.name+' (this view only)',t=>CMD.resizeLane(D,t,entry,view,{frameId:f.id,at:{x,y},size:{w,h}}));
  };
  card.querySelector('[data-lanefit]').onclick=()=>laneTxn('Fit lane '+f.name+' to its members (this view only)',t=>CMD.resizeLane(D,t,entry,view,{frameId:f.id,fit:true}));
  card.querySelectorAll('[data-laneunassign]').forEach(b=>b.onclick=()=>laneTxn('Remove '+sourceLabel(b.dataset.laneunassign)+' from lane '+f.name,t=>CMD.unassignFromLane(D,t,entry,view,{frameId:f.id,elementIds:[b.dataset.laneunassign]})));
  const assignBtn=card.querySelector('[data-laneassign]');
  if(assignBtn)assignBtn.onclick=()=>{const pick=card.querySelector('[data-lanepick]').value;if(pick)laneAssignPreview(f.id,[pick],null);};
 });
 const add=pane.querySelector('#laneAdd');
 if(add)add.onclick=()=>{
  const q=sel=>pane.querySelector(sel);
  const id=q('#laneNewId').value.trim(),label=q('#laneNewLabel').value.trim();
  const at={x:Number(q('#laneNewX').value),y:Number(q('#laneNewY').value)},size={w:Number(q('#laneNewW').value),h:Number(q('#laneNewH').value)};
  if(!id||!label||![at.x,at.y,size.w,size.h].every(Number.isFinite)||size.w<=0||size.h<=0){laneNotice='DDN-I033: A new lane needs an identifier, a label and finite X/Y/W/H with positive W/H. Nothing was changed.';updateInspector();return;}
  laneTxn('Create lane '+label+' (this view only)',t=>CMD.createLane(D,t,entry,view,{id,label,at,size}));
 };
}
function laneAssignPreview(frameId,elementIds,pinPos){
 const frame=laneFrameOf(frameId);if(!frame)return;
 const activity=ir.view.profiles.projection?.profile==='uml.activity@1';
 const adds=elementIds.filter(id=>!frame.members.includes(id));
 const removals=(ir.view.frames||[]).filter(f=>f.id!==frame.id).flatMap(f=>f.members.filter(m=>elementIds.includes(m)).map(m=>({frame:f,id:m})));
 const laneKey=String(frame.id).split('.').pop();
 const body='<div class="scope-banner" style="margin:0 0 4px">Lane <strong>'+esc(frame.name)+'</strong> · view <code>'+esc(entry+' # '+view)+'</code> · commits against revision '+ws.revision+'</div>'
 +'<h3>Exact member changes</h3>'
 +(adds.length?'<p>Add to <strong>'+esc(frame.name)+'</strong>: '+adds.map(id=>esc(sourceLabel(id))).join(', ')+'</p>':'<p>No additions (already a member).</p>')
 +(removals.length?'<p>Remove from '+removals.map(r=>'<strong>'+esc(r.frame.name)+'</strong> ← '+esc(sourceLabel(r.id))).join(' · ')+' (one-lane-per-element policy)</p>':'<p>No removals from other lanes.</p>')
 +(pinPos?'<p>Pin '+esc(sourceLabel(elementIds[0]))+' at ('+Math.round(pinPos.x)+', '+Math.round(pinPos.y)+') in the same transaction.</p>':'')
 +'<p class="help">Frame membership is view placement; no semantic containment, ownership, or placement relationship is created.</p>'
 +(activity?'<p class="help">uml.activity@1 partition writes in the same transaction: <code>x_partition: { "lane": "'+esc(laneKey)+'" }</code> on '+elementIds.map(id=>esc(sourceLabel(id))).join(', ')+'. DDN-PJ114 is re-checked by the commit-time render.</p>':'');
 modal('Assign to lane '+frame.name+' · preview',body,[{label:'Cancel',action:closeModal},{label:'Commit assignment',primary:true,action:()=>{
  const ok=laneTxn('Assign '+elementIds.map(id=>sourceLabel(id)).join(', ')+' to lane '+frame.name,t=>{
   if(pinPos)A.pin(t,entry,view,elementIds[0],pinPos.x,pinPos.y);
   return CMD.assignToLane(D,t,entry,view,{frameId:frame.id,elementIds});
  });
  if(ok)closeModal();
 }}]);
}
function selectControl(id,label,values,current){return `<label for="${id}">${label}</label><select id="${id}">`+values.map(([v,l])=>`<option value="${v}" ${v===current?'selected':''}>${l}</option>`).join('')+'</select>';}
// Add existing definition to a view (ED-009; spec ch.06 "Reuse, copy and
// duplicates", ch.11 Occurrence layer). Runs addExistingToView and reports the
// command's status/restriction verbatim — a same-view alias request answers
// already-present · one-appearance-per-view and focuses, never clones.
function addToView(defId){
 const targets=[];for(const e of Object.keys(ws.getFiles()))for(const v of ws.views(e))targets.push({entry:e,id:v.id});
 modal('Add '+sourceLabel(defId)+' to a view','<p>Adds one <strong>occurrence</strong> of the existing shared definition to the chosen view — one identity, never a disguised clone. If it is already in that view, the command focuses it and answers <code>already-present · one-appearance-per-view</code>; if it was removed, the appearance is restored.</p><label for="addToViewPick">Target view</label><select id="addToViewPick">'+targets.map((t,i)=>'<option value="'+i+'"'+(t.entry===entry&&t.id===view?' selected':'')+'>'+esc(t.entry+' # '+t.id)+'</option>').join('')+'</select>',[{label:'Cancel',action:closeModal},{label:'Add to view',primary:true,action:()=>{
  const tgt=targets[+$('#addToViewPick').value];let out=null;
  const ok=transaction('Add existing '+sourceLabel(defId)+' to view '+tgt.id,t=>{out=CMD.occurrences.addExistingToView(D,t,tgt.entry,{definitionId:defId,viewId:tgt.id});return out;});
  if(ok&&out){
   announce('addExistingToView · '+out.status+(out.restriction?' · '+out.restriction:'')+(out.occurrenceId?' · '+out.occurrenceId:''),out.status==='unsupported');
   if(out.select){selected=out.select;draw();}
  }
  if(ok)closeModal();
 }}]);
}
function occurrenceIdOf(id){if(!ir||!graph())return null;return ir.view.selected.includes(id)||ir.view.relations.includes(id)?CMD.occurrences.occurrenceIdFor(ir.view.id,id):null;}
function updateInspector(){const sel=findSelection(),h=panelRoot('selectionHeader'),p=panelRoot('inspectorBody');
 if(sel){h.innerHTML=`<div class="selection-title"><span class="tag">${esc(sel.kind==='field'?'FIELD':sel.kind==='relation'?'RELATIONSHIP':sel.node.kind.toUpperCase())}</span><h2>${esc(sel.name)}</h2><p>${esc(sel.sourceId)}</p>${occurrenceIdOf(sel.sourceId)?'<p class="occid">occurrence <code>'+esc(occurrenceIdOf(sel.sourceId))+'</code></p>':''}</div><div class="scope-banner">Shared definition · ${usage(sel.sourceId)} view(s) in this source entry<br>Edits to meaning affect every occurrence.</div>`;if(sel.kind==='node'){const km=kindEntry(sel.node.kind);if(km)h.innerHTML+='<div class="scope-banner" style="background:#f0f4fa;border-color:#d3deea;color:#33506b">'+esc(km.name)+' · '+esc(km.palette_group)+' · template <code>'+esc(km.inspector_template)+'</code><br>Source: '+esc(km.source)+' registry · profiles hint: '+esc(km.profiles_hint.join(', ')||'—')+'</div>';}}else{h.innerHTML='<div class="selection-title"><span class="tag">VIEW SETTINGS</span><h2>'+esc($('#viewHeading').textContent)+'</h2><p>'+esc(entry+' # '+view)+'</p></div><div class="scope-banner">View configuration · shared data unchanged</div>';}
 if(tab==='view'){
 p.innerHTML='<div class="tag">LOCAL PREVIEW OVERRIDES</div>'+selectControl('lookSetting','Drawing treatment',[['classic','Standard'],['handDrawn','Hand-drawn'],['neo','Neo']],overrides.look||'classic')+selectControl('themeSetting','Palette',[['default','Light'],['night','Night · grey-blue']],overrides.theme||'default');
 if(graph())p.innerHTML+=selectControl('fieldsSetting','Field compartment',[['source','As authored'],['names','Field names'],['none','Name only']],overrides.fields||'source')+selectControl('routeSetting','Connector path',[['source','As authored'],['orthogonal','Right angles'],['curved','Curved'],['straight','Straight'],['rounded','Rounded corners']],overrides.routing||'source')+'<p class="help">A path setting changes geometry, never the meaning or endpoints.</p>';
 else if(!graph()&&!chartProfile())p.innerHTML+='<p class="help">Session preview overrides apply to graph views; data-bound views edit source through their sheet.</p>';
 if(sel?.kind==='node'&&graph()){const pinned=!!result.scene.layout?.pinned?.includes(sel.sourceId)||sourceView().includes('place @model.'+sel.node.local);p.innerHTML+='<hr><h3>Position</h3><p class="help">Dragging makes an explicit pin. Size alone is not a pin.</p><div class="kv"><div><label for="pinX">X · world px</label><input id="pinX" type="number" value="'+Math.round(result.scene.nodes.find(n=>n.id===sel.sourceId)?.x||0)+'"></div><div><label for="pinY">Y · world px</label><input id="pinY" type="number" value="'+Math.round(result.scene.nodes.find(n=>n.id===sel.sourceId)?.y||0)+'"></div></div><div class="row" style="margin-top:10px"><button id="pinApply" class="primary" title="Pin the object at these world coordinates in this view">Set pin</button><button id="unpinApply" title="Release the explicit pin; automatic placement applies">Make automatic</button></div>';
 $('#pinApply').onclick=()=>transaction('Set this view position',t=>A.pin(t,entry,view,sel.sourceId,Number(p.querySelector('#pinX').value),Number(p.querySelector('#pinY').value)));$('#unpinApply').onclick=()=>transaction('Release source pin',t=>A.unpin(t,entry,view,sel.sourceId));}
 p.innerHTML+='<hr><p class="help">Look and palette use live renderer overrides in this prototype. Production source-write and inherited/reset rules are specified separately.</p><button id="resetStyle" class="wide" title="Reset the preview overrides for this view">Reset this preview</button>';
 const change=(id,key)=>{const el=p.querySelector('#'+id);if(el)el.onchange=()=>{overrides[key]=el.value;document.body.classList.toggle('night',overrides.theme==='night');draw();};};change('lookSetting','look');change('themeSetting','theme');change('fieldsSetting','fields');change('routeSetting','routing');change('markSetting','mark');p.querySelector('#resetStyle').onclick=()=>{overrides={page:'content',look:'classic',theme:'default'};document.body.classList.remove('night');draw();};
 // Rebind position actions after innerHTML append recreated them.
 if(p.querySelector('#pinApply')){p.querySelector('#pinApply').onclick=()=>transaction('Set this view position',t=>A.pin(t,entry,view,sel.sourceId,Number(p.querySelector('#pinX').value),Number(p.querySelector('#pinY').value)));p.querySelector('#unpinApply').onclick=()=>transaction('Release source pin',t=>A.unpin(t,entry,view,sel.sourceId));}
 if(graph()){p.innerHTML+=lanesSectionHTML();wireLanesSection();}
 return;
 }
 if(tab==='details'){
 p.innerHTML='<div class="sectionlabel" style="margin-top:0">Details on demand</div><p class="help">Required properties appear in Meaning. Specialized implementation, evidence and scope stay discoverable here.</p>'+(sel?'<label>Source identity</label><div class="subtle"><code>'+esc(sel.sourceId)+'</code></div><label>Applicable groups</label><div class="control-stack"><button data-story="properties" title="Open the property-group design screen">Domain & representation</button><button data-story="properties" title="Open the property-group design screen">Scope & ownership</button><button data-story="properties" title="Open the property-group design screen">Constraints & evidence</button></div>':'<div class="notice">The projection determines which operations are meaningful. A record value is not a freehand position.</div>')+'<hr><h3>Current render diagnostics</h3>'+result.diagnostics.slice(0,5).map(d=>'<p class="help"><strong>'+esc(d.code)+'</strong><br>'+esc(d.message)+'</p>').join('')+'<button id="inspectSource" class="wide" title="Open the generated DDN source">Inspect actual source</button><p class="help">Advanced group screens are design proposals, not implemented specialized property editors.</p>';p.querySelectorAll('[data-story]').forEach(b=>b.onclick=()=>story(b.dataset.story));p.querySelector('#inspectSource').onclick=openSource;return;
 }
 if(!graph()){
 const mp=matrixProfile();
 if(mp){
  let mh='<div class="notice">Data-bound projection. A cell is a projection of a shared assignment relation — editing it edits source, never a UI-only fact.</div><h3>'+esc(mp.profile)+'</h3><label>Binding</label><div class="subtle">'+esc(mp.relation)+' · '+esc(mp.value)+'</div><label>Write target</label><div class="subtle">'+esc(matrixWriteTarget(mp))+'</div>';
  const cell=mSel&&mPlan?{row:mPlan.rows[mSel.r],column:mPlan.columns[mSel.c],...cellDisplay(mSel.r,mSel.c)}:null;
  if(cell&&cell.assignments.length)mh+='<label>Selected cell</label><div class="subtle">'+esc(cell.row.name)+' → '+esc(cell.column.name)+'</div><label>Contributors</label>'+cell.assignments.map(a=>'<div class="endpoint-card"><code>'+esc(a.id)+'</code><br>value <code>'+esc(a.value)+'</code></div>').join('')+'<button id="cellInGraph" class="wide primary" title="Select this assignment relation in the responsibility graph">Select assignment in graph</button>';
  else if(cell)mh+='<label>Selected cell</label><div class="subtle">'+esc(cell.row.name)+' → '+esc(cell.column.name)+' · '+(cell.staged?'staged “'+esc(cell.value||'clear')+'”':'empty')+'</div><p class="help">Type a code letter or use the sheet keypad to stage an assignment, then commit the batch as one transaction.</p>';
  else mh+='<label>Rows</label><div class="subtle">'+esc(mPlan?mPlan.rows.map(r=>r.name).join(' · '):'')+'</div><label>Columns</label><div class="subtle">'+esc(mPlan?mPlan.columns.map(c=>c.name).join(' · '):'')+'</div><p class="help">Click a cell in the sheet under the diagram. Keyboard and pointer are equivalent; every commit is one source transaction.</p>';
  p.innerHTML=mh+'<button id="projectedSource" class="wide" title="Open the source drawer at this view’s bindings">View source bindings</button>';p.querySelector('#projectedSource').onclick=openSource;
  if(p.querySelector('#cellInGraph'))p.querySelector('#cellInGraph').onclick=()=>{const id=cell.assignments[0].id;setView('responsibility_graph');choose(id);announce('Assignment selected in the responsibility graph.');};
  return;
 }
 const tp=timelineProfile();
 if(tp){
  let th='<div class="notice">Data-bound projection. A bar is a projection of shared record dates — dragging it is a whole-day date edit with a preview, never a pin. Dates commit through the sheet or the drag gesture; dependencies are view-scope list edits over shared relations.</div><h3>'+esc(tp.profile)+'</h3><label>Bindings</label><div class="subtle">start <code>'+esc(String(tp.start))+'</code> · end <code>'+esc(String(tp.end))+'</code></div>';
  let tplan=null;try{tplan=ws.projectionPlan(entry,view);}catch{}
  if(tplan)th+='<label>Tasks</label><div class="subtle">'+tplan.items.map(i=>esc(i.label)).join(' · ')+'</div><label>Dependencies</label><div class="subtle">'+tplan.dependencies.map(r=>esc(r.name||r.id)).join(' · ')+'</div>';
  th+='<p class="help">Drag a bar horizontally to move both dates in whole days; drag near an edge (or hold Shift for the end edge) to move one date. Escape cancels with no source change. The sheet under the canvas offers the equivalent date controls.</p>';
  p.innerHTML=th+'<button id="projectedSource" class="wide" title="Open the source drawer at this view’s bindings">View source bindings</button>';p.querySelector('#projectedSource').onclick=openSource;
  return;
 }
 const fp=fishboneProfile();
 if(fp){
  let fh='<div class="notice">Data-bound projection. Every rib is a source relationship of the bound verb — adding, attaching and removing ribs are source transactions, never free-floating shapes. Attaching an existing cause shares the definition: one identity, distinct occurrence paths.</div><h3>'+esc(fp.profile)+'</h3><label>Bound verb</label><div class="subtle">relation <code>'+esc(fp.relation)+'</code> · effect <code>'+esc(String(fp.effect?.$ref||fp.effect||''))+'</code></div>';
  let fplan=null;try{fplan=ws.projectionPlan(entry,view);}catch{}
  if(fplan){
   fh+='<label>Effect</label><div class="subtle">'+esc(fplan.effect.name)+'</div><label>Categories</label><div class="subtle">'+fplan.categories.map(c=>esc(c.node.name)).join(' · ')+'</div>';
   const sel=findSelection();
   if(sel?.kind==='node'){
    const occ=fishboneOccurrences(fplan).get(sel.sourceId)||[];
    if(occ.length>1)fh+='<label>Selected rib · '+occ.length+' occurrences, one identity</label>'+occ.map(o=>'<div class="endpoint-card"><code>'+esc(o)+'</code></div>').join('');
    else fh+='<label>Selected rib</label><div class="subtle">'+esc(sel.name)+' · one occurrence</div>';
   }
  }
  fh+='<p class="help">Edit the effect statement and ribs in the Fishbone sheet under the canvas. A reused cause is listed with every occurrence path; the renderer marks carry the same occurrence strings.</p>';
  p.innerHTML=fh+'<button id="projectedSource" class="wide" title="Open the source drawer at this view’s bindings">View source bindings</button>';p.querySelector('#projectedSource').onclick=openSource;
  return;
 }
 const pp=panelsProfile();
 if(pp){
  let ph='<div class="notice">Data-bound projection. Every panel and item maps to this view’s <code>projection.panels</code> array and shared note definitions — grid, title, span and item-list edits are view-scope source writes; item notes are shared. A move that would empty a panel rejects DDN-PJ009; overlaps reject DDN-PJ021; fixed-grid canvas blocks stay locked (DDN-PJ080/081/083).</div><h3>'+esc(pp.profile)+' · '+esc(String(pp.columns))+' columns</h3>';
  let pplan=null;try{pplan=ws.projectionPlan(entry,view);}catch{}
  if(pplan){
   ph+='<label>Panels</label><div class="subtle">'+pplan.panels.map(v=>esc(v.title)).join(' · ')+'</div>';
   const required=CANVAS_REQUIRED[pp.profile]||[];
   if(required.length)ph+='<label>Fixed canvas blocks</label><div class="subtle">'+required.map(esc).join(' · ')+'</div>';
   const hit=pplan.panels.find(v=>v.id===panelsSel)||pplan.panels.find(v=>v.items.some(i=>i.node.id===panelsSel));
   if(hit)ph+='<label>Selected</label><div class="subtle">'+esc(hit.title)+' · row '+hit.row+', column '+hit.column+' · '+hit.rowspan+'×'+hit.colspan+(hit.child?' · child view '+esc(hit.child.view.id):' · '+hit.items.length+' item(s)')+'</div>';
  }
  ph+='<p class="help">Edit panels, items and child-view slots in the Panels sheet under the canvas. Composed slots stay named-view references — “Open child view” switches the editor instead of editing child geometry through the parent (VE-003; spec ch.09 Composition).</p>';
  p.innerHTML=ph+'<button id="projectedSource" class="wide" title="Open the source drawer at this view’s bindings">View source bindings</button>';p.querySelector('#projectedSource').onclick=openSource;
  return;
 }
 const dp=decisionProfile();
 if(dp){
  let dh='<div class="notice">Data-bound projection. Every row maps to a shared <code>rule.row</code> definition carrying <code>x_rule:{when, then}</code> — condition and outcome edits are shared-model writes; the records order, hit policy and coverage are view-scope writes in the <code>projection { }</code> group. Rule order is semantic for first-match policies; an overlapping or budget-breaking table commits as a draft with the failing analysis displayed, never hidden (VE-007).</div><h3>'+esc(dp.profile)+'</h3>';
  let dplan=null,derr=null;try{dplan=ws.projectionPlan(entry,view);}catch(e){derr=(e.code||'PLAN')+': '+e.message;}
  if(dplan){
   dh+='<label>Hit policy · coverage</label><div class="subtle">HIT POLICY: '+esc(dplan.policy.toUpperCase())+' · coverage: '+esc(dplan.coverage)+'</div>';
   dh+='<label>Inputs</label><div class="subtle">'+dplan.inputs.map(d=>esc(d.key+': '+d.type)).join(' · ')+'</div><label>Outputs</label><div class="subtle">'+dplan.outputs.map(esc).join(' · ')+'</div>';
   dh+='<label>Rules</label><div class="subtle">'+dplan.rules.map(r=>esc(r.node.name)).join(' · ')+'</div>';
   dh+='<label>Analysis</label><div class="subtle">'+esc(dplan.analysis.status)+' · '+esc(String(dplan.analysis.checks||0))+' tested atoms of '+esc(String(dplan.analysis.combinations))+'</div>';
   if(selected&&dplan.rules.some(r=>r.id===selected))dh+='<label>Selected rule</label><div class="subtle">'+esc(sourceLabel(selected))+'</div>';
  }else dh+='<label>Analysis</label><div class="subtle">'+esc(derr)+' — the draft stays saveable; export stays blocked.</div>';
  dh+='<p class="help">Edit rules, predicates, outcomes, order, hit policy and fixtures in the Decision sheet under the canvas. Input/output domain editing remains a specification proposal.</p>';
  p.innerHTML=dh+'<button id="projectedSource" class="wide" title="Open the source drawer at this view’s bindings">View source bindings</button>';p.querySelector('#projectedSource').onclick=openSource;
  return;
 }
 const sp=sequenceProfile();
 if(sp){
  // VE-AC-063: no placement or Arrange control exists for a sequence view —
  // the model below exposes lifelines and messages only, and the runtime
  // rejects layout overrides LIVE021 (asserted by the behavior suite).
  let sh='<div class="notice">Data-bound projection. Lifelines map to selected objects and arrows to shared <code>uml.message</code> relations; order is <strong>declaration order</strong>, never pixels. This inspector offers no placement or Arrange controls — the runtime rejects them (LIVE021).</div><h3>'+esc(sp.profile)+'</h3>';
  let splan=null;try{splan=ws.projectionPlan(entry,view);}catch{}
  if(splan){
   sh+='<label>Lifelines · declaration order</label><div class="subtle">'+splan.participants.map(n=>esc(n.name)).join(' · ')+'</div><label>Messages · top to bottom</label><div class="subtle">'+splan.messages.map(r=>esc(r.name)).join(' · ')+'</div>';
   const silent=(result?.diagnostics||[]).filter(d=>d.code==='DDN-PJW03');
   if(silent.length)sh+='<label>Silent participants · surfaced, never hidden</label>'+silent.map(d=>'<div class="subtle"><strong>'+esc(d.code)+'</strong> '+esc(d.message)+'</div>').join('');
   if(selected&&(splan.participants.some(n=>n.id===selected)||splan.messages.some(r=>r.id===selected)))sh+='<label>Selected</label><div class="subtle">'+esc(sourceLabel(selected))+'</div>';
  }
  sh+='<p class="help">Edit lifelines and messages in the Sequence sheet under the canvas, or two-click connect on lifeline headers (VE-006 — the sheet list is the equivalent path). Reorders move declaration spans; endpoints and x_return can never drift (VE-AC-062).</p>';
  p.innerHTML=sh+'<button id="projectedSource" class="wide" title="Open the source drawer at this view’s bindings">View source bindings</button>';p.querySelector('#projectedSource').onclick=openSource;
  return;
 }
 const cp=chartProfile();
 if(cp){  let ch='<div class="notice">Data-bound projection. Moving a mark must not change a number, date, assignment, or scale. Edit the record in the Source sheet; dragging a mark is disabled.</div><h3>'+esc(cp.profile)+' · '+esc(String(cp.mark??'source mark'))+'</h3><label>Bindings</label><div class="subtle">x <code>'+esc(String(cp.x??'—'))+'</code> · y <code>'+esc(String(cp.y??'—'))+'</code> · unit <code>'+esc(String(cp.unit??'—'))+'</code>'+(cp.aggregate?'<br>aggregate <code>'+esc(String(cp.aggregate))+'</code>':'')+'</div>';
  let cplan=null;try{cplan=ws.projectionPlan(entry,view);}catch{}
  const point=cplan&&chartSel?cplan.points.find(pt=>(pt.sourceIds||[]).includes(chartSel)):null;
  if(point){
   const ids=point.sourceIds||[];
   ch+='<label>Selected mark</label><div class="subtle">'+ids.length+' contributing record'+(ids.length>1?'s · aggregate policy '+esc(String(cp.aggregate||'none')):'')+'</div><label>Contributors</label>'+ids.map(id=>'<div class="endpoint-card"><code>'+esc(id)+'</code><br><button data-jump-rec="'+esc(id)+'" title="Jump to this record’s row in the Source sheet">Edit row in Source sheet</button></div>').join('')+'<p class="help">An aggregate never becomes an editable synthetic total record; edit the input records.</p>';
  }else ch+='<p class="help">Click a rendered mark to list its contributing records. The Source sheet under the canvas edits record values (shared model), the mark and the x/y/unit bindings (this view).</p>';
  p.innerHTML=ch+'<button id="projectedSource" class="wide" title="Open the source drawer at this view’s bindings">View source bindings</button>';p.querySelector('#projectedSource').onclick=openSource;
  p.querySelectorAll('[data-jump-rec]').forEach(b=>b.onclick=()=>{chartSel=b.dataset.jumpRec;renderChartSheet();$('#chartSheet')?.scrollIntoView({block:'nearest'});$('#chartSheet [data-recrow="'+CSS.escape(chartSel)+'"]')?.scrollIntoView({block:'nearest'});});
  return;
 }
 p.innerHTML='<div class="notice">Data-bound projection. Moving a mark must not change a number, date, assignment, or scale.</div>'+'<h3>Supplied values</h3><label>Source</label><div class="subtle">m.facts · six synthetic records</div><label>Category</label><div class="subtle">x_record.month</div><label>Value</label><div class="subtle">x_record.value · CAD</div><p class="help">Binding edits for this projection are view-scope source writes in its sheet.</p>'+'<button id="projectedSource" class="wide" title="Open the source drawer at this view’s bindings">View source bindings</button>';p.querySelector('#projectedSource').onclick=openSource;return;
 }
 if(!sel){p.innerHTML='<h3>Select an object or relation</h3><p class="help">Choose a palette starter to insert. Use Model for keyboard selection. All new objects are synthetic local design definitions.</p>';return;}
 p.innerHTML='<label for="nameEdit">'+(sel.kind==='field'?'Field label':'Name')+'</label><input id="nameEdit" value="'+esc(sel.name)+'"><div class="row" style="margin-top:8px"><button id="applyName" class="primary" title="Apply the new shared label">Apply label</button><button id="moreReview" title="Show the views that use this definition">Used in views…</button></div><p class="help">Changes the display label, not the stable identifier.</p>';
 if(sel.kind==='node'){
 const km=kindEntry(sel.node.kind);
 p.innerHTML+='<label>Type</label><div class="row"><input value="'+esc(sel.node.kind)+'" readonly aria-label="Semantic kind"><button id="convertBtn" title="Review changing this object’s kind (design screen)">Change…</button></div><p class="help">A type conversion can change meaning. A visual look does not.</p>';
 p.innerHTML+='<label for="descEdit">Description</label><textarea id="descEdit">'+esc(sel.node.properties?.description||'')+'</textarea><div class="row" style="margin-top:8px"><button id="applyDesc" title="Apply the description to the shared definition">Apply description</button></div>';
 if(km?.inspector_template==='data-structure'){
 p.innerHTML+='<label>Fields <span class="muted">'+sel.node.fields.length+'</span></label><div class="fieldlist">'+sel.node.fields.map(f=>`<div class="fieldrow" data-field="${esc(f.id)}"><code>${esc(f.name)}</code><button data-start="${esc(f.id)}" title="Connect this field">↗</button></div>`).join('')+'</div><div class="row" style="margin-top:8px"><input id="newField" placeholder="new_field" aria-label="New field identifier"><button id="addField" title="Add an untyped field to this object">＋</button></div><p class="help">Start with names. No datatype is required.</p>';
 }
 if(km)p.innerHTML+='<label>Descriptor <span class="muted">kind-ui-map.json · read-only</span></label><div class="subtle">Basic controls: '+esc(km.basic_controls.join(', '))+'<br>Advanced groups: '+esc(km.advanced_groups.join(', '))+'<br>'+esc(km.properties_editing)+'</div><p class="help">'+esc(km.mapping_status)+'. Live controls here are label, description, fields, pin, connect and hide; every other descriptor property is shown read-only and is never rewritten.</p>';
 p.innerHTML+='<hr><div class="row wrap"><button id="connectSelected" title="Start a connection from this object">Connect…</button><button id="hideSelected" title="Remove from this view; the shared definition is kept">Remove from view</button></div><p class="help">Remove from view retains the shared definition.</p>';
 }else if(sel.kind==='field'){
 p.innerHTML+='<label>Owner</label><div class="subtle">'+esc(sel.node.name)+'</div><label>Meaning / domain</label><button class="wide" data-story="properties" title="Open the domain-picker design screen">Choose a domain… <span class="tag amber">DESIGN</span></button><p class="help">Prototype only edits the label and connects this field. Domain/type/key editing is specified in the descriptor contract.</p><button id="connectSelected" class="wide primary" title="Start a connection from this field">Connect this field</button><button id="selectParent" class="wide" title="Select the owning object">Back to '+esc(sel.node.name)+'</button>';
 }else{
 const r=sel.relation;const end=e=>e.field||e.member||e.port||e.element;
 p.innerHTML+='<label>Meaning</label><div class="subtle">'+esc(r.kind)+'</div><label>From</label><div class="endpoint-card">'+esc(sourceLabel(end(r.from)))+'</div><label>To</label><div class="endpoint-card">'+esc(sourceLabel(end(r.to)))+'</div><p class="help">Field identity and visual anchor are separate. Reconnecting an endpoint is one reviewed source transaction that keeps the relation’s identity, label and properties.</p>'
 +'<hr><h3>Reconnect an endpoint</h3><label for="reconnectFrom">From endpoint</label><select id="reconnectFrom">'+endpointOptions(end(r.from))+'</select><label for="reconnectTo">To endpoint</label><select id="reconnectTo">'+endpointOptions(end(r.to))+'</select><div class="row" style="margin-top:8px"><button id="reconnectPreviewFrom" class="primary" title="Preview the impact of moving the from-endpoint">Preview from…</button><button id="reconnectPreviewTo" class="primary" title="Preview the impact of moving the to-endpoint">Preview to…</button></div><p class="help">The same move works by dragging a selected edge’s endpoint onto another object or field. Reversing direction stays a separate proposed operation — it is not two reconnects. <button class="ghost" id="reconnectDesign" style="min-height:0;padding:0;font-size:inherit;text-decoration:underline" title="Open the reconnection design notes">Reconnection design notes</button></p>';
 }
 p.querySelector('#applyName').onclick=()=>transaction('Rename shared label',t=>A.setLabel(t,entry,view,sel.sourceId,p.querySelector('#nameEdit').value));p.querySelector('#nameEdit').onkeydown=e=>{if(e.key==='Enter')p.querySelector('#applyName').click();if(e.key==='Escape')e.target.value=sel.name;};p.querySelector('#moreReview').onclick=()=>story('impact');if(p.querySelector('#convertBtn'))p.querySelector('#convertBtn').onclick=()=>story('conversion');
 if(p.querySelector('#applyDesc'))p.querySelector('#applyDesc').onclick=()=>transaction('Set description',t=>A.setProperty(t,entry,view,sel.sourceId,'description',p.querySelector('#descEdit').value));
 p.querySelectorAll('[data-field]').forEach(x=>x.onclick=e=>{if(!e.target.closest('button'))choose(x.dataset.field);});p.querySelectorAll('[data-start]').forEach(x=>x.onclick=()=>beginConnect(x.dataset.start));p.querySelectorAll('[data-story]').forEach(x=>x.onclick=()=>story(x.dataset.story));
 if(p.querySelector('#addField'))p.querySelector('#addField').onclick=()=>{const id=p.querySelector('#newField').value;transaction('Add untyped field',t=>A.addField(t,entry,view,sel.sourceId,{id}));};
 if(p.querySelector('#connectSelected'))p.querySelector('#connectSelected').onclick=()=>beginConnect(sel.sourceId);if(p.querySelector('#selectParent'))p.querySelector('#selectParent').onclick=()=>choose(sel.node.id);if(p.querySelector('#hideSelected'))p.querySelector('#hideSelected').onclick=()=>{transaction('Remove appearance, retain definition',t=>A.hide(t,entry,view,sel.sourceId));selected=null;updateInspector();};if(p.querySelector('#reconnectPreviewFrom'))p.querySelector('#reconnectPreviewFrom').onclick=()=>inspectorReconnect('from');if(p.querySelector('#reconnectPreviewTo'))p.querySelector('#reconnectPreviewTo').onclick=()=>inspectorReconnect('to');if(p.querySelector('#reconnectDesign'))p.querySelector('#reconnectDesign').onclick=()=>story('connection');
}
// Edge reconnection (ED-008): the inspector pickers are the full keyboard/click
// equivalent of the edge-endpoint drag (VE-006). Both paths run the same
// command-layer validation and open the same five-part impact preview; the
// commit inside the preview is one revision-checked transaction.
function endpointArg(id){const owner=selectionOwner(id);return owner&&owner!==id?{elementId:owner,memberId:id}:{elementId:id};}
function reconnectViews(id){return ws.views(entry).filter(v=>{try{const p=ws.resolve(entry,v.id);return p.view.selected.includes(selectionOwner(id)||id)||p.view.relations.includes(id);}catch{return false;}});}
function inspectorReconnect(endKey){
 const sel=findSelection();if(sel?.kind!=='relation')return;
 const end=e=>e.field||e.member||e.port||e.element;
 const value=panelRoot('inspectorBody').querySelector('#reconnect'+(endKey==='from'?'From':'To')).value;
 if(value===end(sel.relation[endKey])){announce('That is already the '+endKey+' endpoint; nothing to reconnect.');return;}
 reconnectModal({relationId:sel.relation.id,end:endKey,endpoint:endpointArg(value)});
}
function reconnectModal(args){
 let plan;try{plan=CMD.previewReconnect(D,ws,entry,view,args,RELMAP);}catch(e){announce((e.code||'EDIT')+': '+e.message,true);return;}
 const r=ir.relations.find(x=>x.id===args.relationId),end=e=>e.field||e.member||e.port||e.element;
 const prevId=end(r[args.end]),nextId=args.endpoint.memberId||args.endpoint.portId||args.endpoint.elementId;
 const views=reconnectViews(r.id);
 const body='<div class="scope-banner" style="margin:0 0 4px">Source owner: <code>'+esc(plan.file)+'</code> · writable in this workspace · commits against revision '+ws.revision+'</div>'
 +'<h3>Endpoint change</h3><div class="row" style="align-items:stretch"><div class="endpoint-card" style="flex:1">'+esc(sourceLabel(prevId))+'<br><code>@'+esc(plan.previous)+'</code></div><strong style="align-self:center">→</strong><div class="endpoint-card proposed" style="flex:1">'+esc(sourceLabel(nextId))+'<br><code>@'+esc(plan.proposed)+'</code></div></div>'
 +'<h3>Affected views ('+views.length+')</h3><p>'+(views.length?views.map(v=>'<code>'+esc(v.id)+'</code>').join(' '):'None beyond this view.')+'</p>'
 +'<h3>Scratch re-render diagnostics</h3>'+(plan.error?'<div class="notice">'+esc(plan.error.code+': '+plan.error.message)+'</div>':plan.diagnostics.length?plan.diagnostics.map(d=>'<p class="help"><strong>'+esc(d.code)+'</strong> · '+esc(d.message)+'</p>').join(''):'<p class="help">None — the proposed source validates and re-renders cleanly.</p>')
 +'<h3>Retained by this move</h3><p class="help">Relation id <code>'+esc(r.id)+'</code>, label “'+esc(r.name)+'”, properties ('+esc(Object.keys(r.properties).join(', '))+') and the other endpoint stay byte-identical.'+(plan.routes.length?'<br>Routing overrides retained and still resolving: '+plan.routes.map(x=>'<code>route @'+esc(x.target)+'</code> ('+esc(x.file)+')').join(' '):'')+'</p>'
 +(plan.error?'<div class="notice">Commit is blocked: the scratch re-render failed validation. Nothing was changed.</div>':'');
 modal('Reconnect '+args.end+' endpoint · impact preview',body,plan.error?[{label:'Cancel',primary:true,action:closeModal}]:[{label:'Cancel',action:closeModal},{label:'Commit reconnection',primary:true,action:()=>{const ok=transaction('Reconnect '+r.name+' · '+args.end+' → '+sourceLabel(nextId),t=>CMD.reconnectRelation(D,t,entry,view,args,RELMAP));if(ok){selected=r.id;closeModal();}}}]);
}
function cancelReconnectDrag(silent){
 if(!rDrag)return;
 rDrag.ghost?.remove();rDrag.tip?.remove();rDrag=null;
 if(!silent)announce('Reconnect cancelled; source unchanged.');
}
function addNode(kind,at){
 const descriptor=kindEntry(kind);
 if(!descriptor)return;
 const proj=projectionKind();
 if(!graph()&&proj!=='fishbone'&&proj!=='decision')return;
 const id='new_'+kind.replace(/[^A-Za-z0-9_]/g,'_')+'_'+counter++;
 if(descriptor.creation_action==='edit-projection-source-not-free-node'&&kind==='chen.attribute'){
  const sel=findSelection();
  if(sel?.kind!=='node'){announce('A Chen attribute is a field of its entity, never a free-floating node. Select the owning entity first.',true);return;}
  const fieldId=window.prompt('Field identifier for the new attribute of '+sel.name+':','new_attribute');
  if(fieldId===null){announce('Add cancelled; source unchanged.');return;}
  transaction('Add attribute field to '+sel.name,t=>CMD.applyCreationAction(D,t,entry,view,{mapEntry:descriptor,id,projectionKind:proj,selectedId:sel.sourceId,fieldId}));
  return;
 }
 if(descriptor.creation_action==='edit-projection-source-not-free-node'&&kind==='chen.association'){
  const sel=findSelection();
  if(sel?.kind!=='node'){announce('A Chen relationship is created through the Connect flow. Select the entity it starts from first.',true);return;}
  beginConnect(sel.sourceId,'assoc');
  return;
 }
 transaction('Add '+descriptor.name+(at?' at chosen position':' automatically'),t=>{
  const made=CMD.applyCreationAction(D,t,entry,view,{mapEntry:descriptor,id,at,projectionKind:proj,selectedId:selected});
  return{select:made.select};
 });
}
function worldPoint(e){const g=$('#paper svg #drawing')||$('#paper svg');if(!g)return null;const m=g.getScreenCTM();if(!m)return null;return new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());}
function bindCanvas(){
 $('#paper').onpointerdown=e=>{
  if(e.button!==0)return;
  if(!graph()){
   if(chartProfile()){const m=e.target.closest('[data-id],[data-source]');if(m)dragGuard={x:e.clientX,y:e.clientY,id:m.getAttribute('data-id')||m.getAttribute('data-source'),pointer:e.pointerId,fired:false};}
   if(sequenceProfile()){
    // Two-click connect on lifeline header marks only: the header group owns
    // the scene box at y=0; activation bars and message marks never start it.
    const g=e.target.closest('.ddn-mark[data-id]');
    if(!g)return;
    let plan;try{plan=ws.projectionPlan(entry,view);}catch{return;}
    const part=plan.participants.find(n=>n.id===g.dataset.id);
    if(!part)return;
    const header=(result.scene.marks||[]).find(m=>(m.sourceIds||[]).includes(part.id)&&m.y===0);
    if(!header)return;
    e.preventDefault();
    if(!seqConnectFrom){seqConnectFrom=part.id;announce('From '+part.name+'. Click the destination lifeline header (self-message allowed); Escape cancels.');}
    else{const from=seqConnectFrom;seqConnectFrom=null;sequenceConnectModal(from,part.id);}
    return;
   }
   if(timelineProfile()){
    const g=e.target.closest('.ddn-mark[data-id]');
    if(!g)return;
    let plan;try{plan=ws.projectionPlan(entry,view);}catch{return;}
    const item=plan.items.find(i=>i.id===g.dataset.id);
    if(!item)return;
    // Bar drag is a data-edit gesture: px-per-day is derived from the rendered
    // bars' own scene boxes versus their source dates, never from renderer constants.
    const DAY=86400000,bars=(result.scene.marks||[]).filter(m=>m.start&&m.end&&m.w>0);
    const ref=bars.find(m=>m.start===item.start&&m.end===item.end)||bars[0];
    const scale=ref?ref.w/((Date.parse(ref.end+'T00:00:00Z')-Date.parse(ref.start+'T00:00:00Z'))/DAY):NaN;
    if(!Number.isFinite(scale)||scale<=0){announce('No dated bar on this axis to derive the day scale from; use the date controls.',true);return;}
    const pt=worldPoint(e);if(!pt)return;
    const own=bars.find(m=>m.start===item.start&&m.end===item.end);
    let mode='move';
    if(e.shiftKey)mode='end';
    else if(own&&own.w>0){if(pt.x-own.x<10)mode='start';else if(own.x+own.w-pt.x<10)mode='end';}
    const tip=document.createElement('div');tip.className='drag-tip';document.body.appendChild(tip);
    tDrag={el:g,item,scale,mode,pointer:e.pointerId,startX:pt.x,days:0,tip};
    g.setPointerCapture(e.pointerId);
    e.preventDefault();
   }
   return;
  }
  const member=e.target.closest('[data-member]'),el=e.target.closest('.ddn-node[data-id]'),edge=e.target.closest('.ddn-edge[data-id]');const id=member?.dataset.member||el?.dataset.id||edge?.dataset.id;
  if(mode==='connect'&&id){e.preventDefault();if(!connectFrom){connectFrom=id;announce('From '+sourceLabel(id)+'. Select the destination.');}else showConnection(connectFrom,id);return;}
  // Reconnect-drag: after an edge is selected, pointerdown within 14 world-px
  // of either scene-route endpoint starts it — tested against scene geometry
  // (the visual endpoint may sit under the node it attaches to). Escape or a
  // drop off a node/field cancels with no source change.
  if(mode==='select'&&ir.relations.some(r=>r.id===selected)){
   const route=(result.scene.routes||[]).find(x=>x.id===selected),pt=worldPoint(e);
   if(route&&pt&&Array.isArray(route.points)&&route.points.length>1){
    const first=route.points[0],last=route.points[route.points.length-1];
    const near=a=>Math.hypot(a[0]-pt.x,a[1]-pt.y)<=14;
    if(near(first)||near(last)){
     const drawing=$('#paper svg #drawing')||$('#paper svg');
     const ghost=document.createElementNS('http://www.w3.org/2000/svg','line');
     ghost.setAttribute('class','reconnect-ghost');drawing.appendChild(ghost);
     const tip=document.createElement('div');tip.className='drag-tip';document.body.appendChild(tip);
     rDrag={relationId:selected,end:near(first)?'from':'to',fixed:near(first)?last:first,pointer:e.pointerId,ghost,tip,hover:null};
     e.preventDefault();return;
    }
   }
  }
  if(id)choose(id);
  if(!el||member||mode!=='select')return;const n=result.scene.nodes.find(n=>n.id===el.dataset.id);if(!n)return;const point=worldPoint(e);drag={el,id:n.id,x:n.x,y:n.y,start:point,pointer:e.pointerId,moved:false};el.setPointerCapture(e.pointerId);
 };
 $('#paper').onpointermove=e=>{
  if(rDrag&&e.pointerId===rDrag.pointer){
   const pt=worldPoint(e);if(!pt)return;
   rDrag.ghost.setAttribute('x1',rDrag.fixed[0]);rDrag.ghost.setAttribute('y1',rDrag.fixed[1]);
   rDrag.ghost.setAttribute('x2',pt.x);rDrag.ghost.setAttribute('y2',pt.y);
   const m=e.target.closest('[data-member]'),n=e.target.closest('.ddn-node[data-id]');
   const target=m?.dataset.member||n?.dataset.id||null;
   if(target!==rDrag.hover){
    rDrag.hover=target;
    let verdict=null;
    if(target){try{CMD.prepareReconnect(D,ws,entry,view,{relationId:rDrag.relationId,end:rDrag.end,endpoint:endpointArg(target)},RELMAP);verdict={ok:true};}catch(x){verdict={ok:false,reason:x.message};}}
    rDrag.ghost.classList.toggle('invalid',!!(verdict&&!verdict.ok));
    rDrag.tip.textContent=target?sourceLabel(target)+(verdict.ok?' · legal '+(rDrag.end==='from'?'source':'target'):' · '+verdict.reason):'Drop on an object or field · Escape cancels';
   }
   rDrag.tip.style.left=(e.clientX+14)+'px';rDrag.tip.style.top=(e.clientY+14)+'px';
   return;
  }
  if(tDrag&&e.pointerId===tDrag.pointer){
   const pt=worldPoint(e);if(!pt)return;
   const DAY=86400000,shift=(iso,d)=>new Date(Date.parse(iso+'T00:00:00Z')+d*DAY).toISOString().slice(0,10);
   const span=(Date.parse(tDrag.item.end)-Date.parse(tDrag.item.start))/DAY;
   let days=Math.round((pt.x-tDrag.startX)/tDrag.scale);
   if(tDrag.mode==='start')days=Math.min(days,span);
   if(tDrag.mode==='end')days=Math.max(days,-span);
   tDrag.days=days;
   tDrag.el.setAttribute('transform','translate('+(days*tDrag.scale)+' 0)');
   const ns=shift(tDrag.item.start,tDrag.mode==='end'?0:days),ne=shift(tDrag.item.end,tDrag.mode==='start'?0:days);
   tDrag.tip.textContent=tDrag.item.label+' · ['+ns+', '+ne+')'+(ns===ne?' · milestone':'')+(tDrag.mode!=='move'?' · '+tDrag.mode+' only':'');
   tDrag.tip.style.left=(e.clientX+14)+'px';tDrag.tip.style.top=(e.clientY+14)+'px';
   return;
  }
  if(dragGuard&&e.pointerId===dragGuard.pointer){
   if(!dragGuard.fired&&Math.abs(e.clientX-dragGuard.x)+Math.abs(e.clientY-dragGuard.y)>6){
    dragGuard.fired=true;
    if(dragGuard.id){chartSel=dragGuard.id;renderChartSheet();updateInspector();$('#chartSheet')?.scrollIntoView({block:'nearest'});}
    announce('Values set geometry — edit the record',true);
   }
   return;
  }
  if(!drag||e.pointerId!==drag.pointer)return;const p=worldPoint(e);const dx=p.x-drag.start.x,dy=p.y-drag.start.y;if(Math.abs(dx)+Math.abs(dy)<5&&!drag.moved)return;drag.moved=true;drag.dx=dx;drag.dy=dy;drag.el.setAttribute('transform','translate('+dx+' '+dy+')');};
 $('#paper').onpointerup=e=>{
  if(rDrag&&e.pointerId===rDrag.pointer){
   const d=rDrag;rDrag=null;
   d.ghost.remove();d.tip.remove();
   const m=e.target.closest('[data-member]'),n=e.target.closest('.ddn-node[data-id]');
   const target=m?.dataset.member||n?.dataset.id||null;
   if(target)reconnectModal({relationId:d.relationId,end:d.end,endpoint:endpointArg(target)});
   else announce('Reconnect cancelled; source unchanged.');
   return;
  }
  if(tDrag&&e.pointerId===tDrag.pointer){
   const d=tDrag;tDrag=null;
   try{d.el.releasePointerCapture(e.pointerId);}catch{}
   d.tip.remove();d.el.removeAttribute('transform');
   if(d.days){
    const DAY=86400000,shift=(iso,n)=>new Date(Date.parse(iso+'T00:00:00Z')+n*DAY).toISOString().slice(0,10);
    const args={recordId:d.item.id};
    if(d.mode!=='end')args.start=shift(d.item.start,d.days);
    if(d.mode!=='start')args.end=shift(d.item.end,d.days);
    timelineTxn('Drag '+d.item.label+' '+(d.days>0?'+':'')+d.days+' day(s) · date edit (shared model)',t=>CMD.setTimelineDates(D,t,entry,view,args));
   }
   return;
  }
  if(dragGuard&&e.pointerId===dragGuard.pointer)dragGuard=null;if(!drag)return;const d=drag;drag=null;try{d.el.releasePointerCapture(e.pointerId);}catch{}if(d.moved){
   const nx=d.x+d.dx,ny=d.y+d.dy,node=result.scene.nodes.find(n=>n.id===d.id);
   // Lane drop (ED-011): a node dropped fully inside a scene frame rect is
   // offered the assignment preview instead of only pinning; committing
   // composes pin + assign in one transaction. Never an inferred relationship.
   const hit=node?(result.scene.frames||[]).find(f=>nx>=f.x&&ny>=f.y&&nx+node.w<=f.x+f.w&&ny+node.h<=f.y+f.h):null;
   const frame=hit?laneFrameOf(hit.id):null;
   if(frame&&!frame.members.includes(d.id)){laneAssignPreview(frame.id,[d.id],{x:nx,y:ny});}
   else transaction('Move and pin '+sourceLabel(d.id),t=>A.pin(t,entry,view,d.id,nx,ny));
  }};
 $('#paper').onpointercancel=()=>{cancelReconnectDrag();cancelTimelineDrag();dragGuard=null;if(drag){drag.el.removeAttribute('transform');drag=null;announce('Move cancelled; source unchanged.');}};
 $('#paper').onclick=e=>{if(!graph()){const m=e.target.closest('[data-id],[data-source]');if(m){const id=m.getAttribute('data-id')||m.getAttribute('data-source');if(id){selected=id;if(chartProfile()){chartSel=id;renderChartSheet();}if(fishboneProfile())renderFishboneSheet();if(panelsProfile()){panelsSel=id;renderPanelsSheet();}if(decisionProfile())renderDecisionSheet();if(sequenceProfile())renderSequenceSheet();updateInspector();announce(chartProfile()?'Source-bound mark selected — contributors listed in the Source sheet.':fishboneProfile()?'Rib selected — its row is highlighted in the Fishbone sheet; repeated causes show every occurrence path.':panelsProfile()?'Item selected — its chip is highlighted in the Panels sheet; item notes are shared definitions.':decisionProfile()?'Rule selected — its row is highlighted in the Decision sheet; conditions and outcomes are shared-model edits.':sequenceProfile()?'Lifeline/message selected — its row is highlighted in the Sequence sheet; order is declaration order.':'Source-bound mark selected. Binding editor is specified; source is inspectable.');}}}};
}
$('#viewport').ondragover=e=>{if(graph()){e.preventDefault();e.dataTransfer.dropEffect='copy';}};
$('#viewport').ondrop=e=>{const kind=e.dataTransfer.getData('application/x-ddn-kind');if(!kindEntry(kind))return;e.preventDefault();const p=worldPoint(e)||{x:0,y:0};addNode(kind,{x:p.x-80,y:p.y-25});};
function modal(title,body,actions,live=true){$('#dialogTitle').textContent=title;$('#dialogBody').innerHTML=body;$('#dialogTag').textContent=live?'LIVE ACTION · REAL SOURCE':'PROPOSED WORKFLOW · NOT EXECUTED';$('#dialogTag').className='tag '+(live?'teal':'amber');$('#dialogActions').innerHTML='';for(const a of actions){const b=document.createElement('button');b.textContent=a.label;b.className=a.primary?'primary':'';b.disabled=!!a.disabled;b.title=a.title||a.label;b.setAttribute('aria-label',a.title||a.label);b.onclick=a.action;$('#dialogActions').appendChild(b);}$('#dialog').showModal();}
function closeModal(){$('#dialog').close();$('#reviewScreen').value='live';}
function endpointOptions(current){return ir.elements.filter(n=>ir.view.selected.includes(n.id)).map(n=>`<optgroup label="${esc(n.name)}"><option value="${esc(n.id)}" ${current===n.id?'selected':''}>${esc(n.name)} · object</option>`+(n.fields||[]).map(f=>`<option value="${esc(f.id)}" ${current===f.id?'selected':''}>${esc(n.name+'.'+f.name)} · field</option>`).join('')+'</optgroup>').join('');}
function beginConnect(from,preset='ref'){connectFrom=from;mode='connect';$('#selectTool').classList.remove('active');$('#connectTool').classList.add('active');announce('Choose a target in the diagram, or select it in the connection sheet.');showConnection(from,null,preset);}
function showConnection(from,to,preset='ref'){mode='select';connectFrom=null;$('#connectTool').classList.remove('active');$('#selectTool').classList.add('active');const fallback=ir.elements.find(n=>n.id!==selectionOwner(from))?.id;
 modal('Create a relationship','<p>Choose meaning independently of line shape. The current validator checks the resulting endpoints.</p><label for="connectFrom">From</label><select id="connectFrom">'+endpointOptions(from)+'</select><div class="preview-arrow">↓</div><label for="connectTo">To</label><select id="connectTo">'+endpointOptions(to||fallback)+'</select>'+selectControl('relationMeaning','Relationship meaning',[['ref','References'],['assoc','Associated with'],['flow','Data flows to'],['depends','Depends on']],preset)+'<label for="relationLabel">Label</label><input id="relationLabel" value="New reference"><div class="notice">Prototype creation uses the existing helper’s local <code>editor_data</code> block. Production shared destination and impact selection are required in the specification.</div>',[{label:'Cancel',action:closeModal},{label:'Create relationship',primary:true,action:()=>{const from=$('#connectFrom').value,to=$('#connectTo').value,kind=$('#relationMeaning').value,name=$('#relationLabel').value;const ok=transaction('Create semantic relationship',t=>{A.addRelation(t,entry,view,{id:'connection_'+counter++,name,kind,from,to});});if(ok)closeModal();}}]);}
function story(type){const sel=findSelection(),n=sel?.name||'Customer';const sections={
 conversion:['Change the type, not just the shape',`<p>Review design for converting <strong>${esc(n)}</strong>. This screen does not perform a conversion.</p><div class="row"><div class="endpoint-card">Table</div><strong>→</strong><div class="endpoint-card">SQL view</div></div><div class="storyline"><h3>Keep</h3><p>Stable identity, compatible fields, names and descriptions.</p><h3>Review before converting</h3><p>Primary-key enforcement, storage placement, write behavior, implementation dependencies and all affected views.</p><h3>3 affected views</h3><p>Structure · Deployment · SQL dependency. The production impact resolver must calculate this list; these are illustrative labels.</p></div><div class="notice">Conversion cannot silently retain incompatible metadata or discard a property. The command planner returns a source diff and requires confirmation.</div>`],
 draft:['Build incomplete diagrams safely','<p>A user must be able to place Start before End. The current strict flowchart validator rejects that intermediate diagram.</p><div class="fake-sheet"><span class="tag amber">DRAFT OBLIGATIONS</span><p>Start has no outgoing step.</p><p>At least one End is required before review/export.</p><p>Untyped connection requires a meaning.</p></div><p>Proposed behavior: show repairable draft objects, record incomplete obligations separately from unsafe syntax, preserve source, and keep reviewed publication strict.</p><div class="notice">Draft-state validation and rendering are new core requirements. This prototype does not bypass existing validators.</div>'],
 connection:['Relation identity versus visual attachment',`<p>The semantic endpoints remain <strong>Journal Line.journal</strong> and <strong>Journal Header.id</strong>.</p><div class="fake-sheet"><h3>Meaning</h3><p>References · enforcement undecided</p><h3>This view</h3><p>Curved · automatic side/anchor · numbered key</p></div><p>A control point can move along a legal outline. Reconnecting to a different field is a separate meaning-changing command with impact preview.</p><div class="notice">The fixed endpoint-ordering renderer is used by this prototype. This screen specifies a future reconnection/anchor editor.</div>`],
 export:['Publication and source downloads','<p>Source workspaces are internal design material. A hidden salary field may remain in a source archive.</p><div class="control-stack"><button disabled title="Design-proposal placeholder; not executable in this prototype">Download source workspace — authority required</button><button disabled title="Design-proposal placeholder; not executable in this prototype">Export current SVG — display selection only</button><button disabled title="Design-proposal placeholder; not executable in this prototype">Authorized publication — validated allowlist policy</button></div><p>These disabled buttons document production choices. Use Download in the real toolbar for the synthetic prototype files.</p><div class="notice">Unsupported redacted projections must fail closed. No “ignore validation” option should be offered.</div>'],
 impact:['Shared-change review',`<p>Editing <strong>${esc(n)}</strong> changes the definition. Moving it normally changes only an appearance in this view.</p><div class="fake-sheet"><h3>Change preview</h3><p>Old label → proposed label</p><p>Definition, fields, references and all matching source ranges are retained.</p></div><h3>Impact requirements</h3><p>Resolve direct and transitive dependent views, show invalidated rules and publication constraints, and commit one source transaction against the checked revision.</p><div class="notice">A complete cross-view impact planner is a specified addition, not implemented by this screen. The live name editor above updates actual shared source.</div>`],
 properties:['Progressive property system','<p>Keep six or fewer common controls visible; make specialized properties discoverable through typed groups and search.</p><div class="fake-sheet"><h3>Meaning</h3><p>Name · Type · Fields · Description · Status</p><h3>This view</h3><p>Compartments · Icons/text · Pin · Route</p><h3>Details</h3><p>Domains · Constraints · Ownership · Evidence</p></div><p>Each descriptor declares scope, value states, source adapter, applicability, reset behavior and validation. Unset, undecided and false are not the same value.</p>'],
 library:['188 kinds without 188 default buttons','<p>The complete registry is mapped in <code>contracts/kind-ui-map.json</code>. The default shelf uses eight task groups and relevant templates.</p><div class="fake-sheet"><h3>Data</h3><p>Table · View · Record · Collection</p><h3>Process</h3><p>Activity · Decision · Start/End</p><h3>Scopes</h3><p>Namespace · Location · Team boundary</p></div><p>A template combines a registered semantic kind, legal options, content sections, default recipe and a small contextual inspector. It does not replace every kind with a generic rectangle.</p>']};
 const [title,body]=sections[type]||sections.impact;modal(title,body,[{label:'Return to live prototype',primary:true,action:closeModal}],false);
}
function arrange(){modal('Arrange the unpinned elements','<p>Existing source pins remain fixed. This dialog changes the renderer’s live placement overlay, not the business model.</p>'+selectControl('layoutPick','Pattern',[['auto','Adaptive'],['fit_grid','Fit to grid'],['circular','Circular'],['radial','Radial'],['layered','Layered'],['organic','Organic']],overrides.placement||'auto')+'<div class="notice">Production selected-subgraph preview and persistent source overrides are specified separately. This prototype invokes existing whole-view patterns.</div>',[{label:'Cancel',action:closeModal},{label:'Apply to this preview',primary:true,action:()=>{overrides.placement=$('#layoutPick').value;overrides.center='pins';closeModal();draw();}}]);}
function openSource(){$('#sourceDrawer').classList.add('open');updateSource();}
function updateZoom(){$('#paper').style.width=(zoom*100)+'%';$('#zoomLabel').textContent=Math.round(zoom*100)+'%';}
$('#dialogClose').onclick=closeModal;$('#dialog').addEventListener('cancel',()=>$('#reviewScreen').value='live');
$('#sourceBtn').onclick=openSource;$('#closeSource').onclick=()=>$('#sourceDrawer').classList.remove('open');$('#reviewBtn').onclick=()=>story('impact');$('#reviewScreen').onchange=e=>{if(e.target.value!=='live')story(e.target.value);};
panelRoot('inspectorTabs').querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));panelRoot('leftTabs').querySelectorAll('[data-left]').forEach(b=>b.onclick=()=>{left=b.dataset.left;updateLeft();});$$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('#problemsBtn').onclick=()=>{problemsOpen=!problemsOpen;renderProblems();};$('#closeProblems').onclick=()=>{problemsOpen=false;renderProblems();};$('#revalidateBtn').onclick=revalidateWorkspace;
$('#undo').onclick=()=>{ws.undo();draw();announce('Undo · source restored');};$('#redo').onclick=()=>{ws.redo();draw();announce('Redo · source restored');};
$('#selectTool').onclick=()=>{mode='select';connectFrom=null;$('#selectTool').classList.add('active');$('#connectTool').classList.remove('active');announce('Select objects or fields. Drag a selected object to pin it.');};$('#connectTool').onclick=()=>{mode='connect';connectFrom=null;$('#selectTool').classList.remove('active');$('#connectTool').classList.add('active');announce('Click a source, then a destination. Escape cancels.');};
$('#fitBtn').onclick=()=>{const svg=$('#paper>svg'),v=svg?.viewBox.baseVal,port=$('#viewport');if(v?.width&&v?.height){const availableW=port.clientWidth-48,availableH=port.clientHeight-75;zoom=Math.min(1,(availableH/v.height)/(availableW/v.width));}else zoom=1;updateZoom();};$('#zoomIn').onclick=()=>{zoom=Math.min(2,zoom+.2);updateZoom();};$('#zoomOut').onclick=()=>{zoom=Math.max(.4,zoom-.2);updateZoom();};$('#arrangeBtn').onclick=arrange;$('#addAuto').onclick=()=>addNode('table');
$('#exportBtn').onclick=()=>{
 const guard=()=>{if(renderFailure){announce('Current render is invalid; export blocked.',true);return false;}return true;};
 const raster=(fmt)=>()=>{if(!guard())return;rasterize(result.svg,fmt.mime,fmt.scale).then(u=>{if(!u.startsWith('data:'+fmt.mime)){announce(fmt.label+' encoding is unavailable in this browser; download cancelled — no mislabeled file was written.',true);return;}downloadDataURL(fmt.file,u);}).catch(e=>announce(e.message,true));};
 const T=CMD.TEXT_FORMATS,byId=Object.fromEntries(T.map(f=>[f.id,f]));
 // B1-014 D2: the modal regroups into Text (three real options) and Image.
 modal('Download the live design',
  '<p>The files below contain the current synthetic design. They are not a production-authorized export.</p>'
  +'<h3>Text</h3><div class="endpoint-card"><strong>'+esc(entry)+'</strong><p>'+esc(byId.current.tooltip)+'</p></div>'
  +'<p><strong>'+esc(byId.bundle.label)+'</strong> — '+esc(byId.bundle.tooltip)+'</p>'
  +'<p><strong>'+esc(byId.zip.label)+'</strong> — Its file format can be opened in the existing Studio.</p>'
  +'<h3>Image</h3><p>SVG keeps the diagram vector; PNG and WebP rasterize it at 2× resolution. The render guard blocks every diagram format while the current render is invalid.</p>'
  +(webpSupported?'':'<p class="notice">This browser cannot encode WebP — the WebP button is disabled instead of writing a mislabeled file.</p>'),[
  {label:byId.current.label,title:byId.current.tooltip,action:()=>D.io.download(entry.split('/').pop(),ws.getFiles()[entry],'text/plain;charset=utf-8')},
  {label:byId.bundle.label,primary:true,title:byId.bundle.tooltip,action:()=>{try{D.io.download(byId.bundle.file,CMD.bundleWorkspace(D,ws.getFiles(),entry),'text/plain;charset=utf-8');}catch(e){announce((e.code||'BUNDLE')+': '+e.message,true);}}},
  {label:byId.zip.label,title:byId.zip.tooltip,action:()=>D.io.download(byId.zip.file,D.io.toZIP(ws.snapshot(entry,view,overrides)),'application/zip')},
  {label:'Current SVG',title:'Download the rendered diagram as SVG vector',action:()=>{if(guard())D.io.download('designer-prototype.svg',result.svg,'image/svg+xml');}},
  {label:'Current PNG (2×)',title:'Download the rendered diagram rasterized to PNG at 2× resolution',action:raster(CMD.EXPORT_FORMATS.find(f=>f.id==='png'))},
  {label:'Current WebP (2×)',title:webpSupported?'Download the rendered diagram rasterized to WebP at 2× resolution':'WebP encoding is not supported by this browser; disabled instead of writing a mislabeled file',disabled:!webpSupported,action:raster(CMD.EXPORT_FORMATS.find(f=>f.id==='webp'))}
 ]);
};
$('#densityToggle').onclick=()=>{density.current=density.current==='compact'?'comfortable':'compact';store.set('ddn-designer-density',density.current);applyDensity();announce('Density: '+(density.current==='compact'?'Compact':'Comfortable')+' · remembered on this browser');};
$('#detachLeft').onclick=()=>setFloating('left',!floatingPanels.left);
$('#detachInspector').onclick=()=>setFloating('inspector',!floatingPanels.inspector);
$('#popoutLeft').onclick=()=>popOutPanel('left');
$('#popoutInspector').onclick=()=>popOutPanel('inspector');
bindSplitter('splitLeft','left');bindSplitter('splitRight','inspector');
bindPanelDrag($('#leftPanel'));bindPanelDrag($('#inspectorPanel'));
applyDensity();applyColumns();updatePanelChrome();
window.addEventListener('keydown',e=>{if(e.key==='Escape'){cancelReconnectDrag();cancelTimelineDrag();connectFrom=null;seqConnectFrom=null;mode='select';if(drag){drag.el.removeAttribute('transform');drag=null;}$('#connectTool').classList.remove('active');$('#selectTool').classList.add('active');}if(e.target.matches('input,textarea,select'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?ws.redo():ws.undo();draw();}if(e.key==='Delete'&&graph()&&findSelection()?.kind==='node')panelRoot('inspectorBody').querySelector('#hideSelected')?.click();});
window.DesignerPrototype={workspace:ws,getState:()=>({entry,view,selected,tab,result,commands:actualCommands,overrides,renderFailure,incompleteBadge,pendingViews:[...pendingViews],issues:currentIssues(),density:density.current,widths:{...widths},floating:{...floatingPanels},popped:{left:!!popped.left,inspector:!!popped.inspector},display:displayGet(),webpSupported}),select:choose,setView,story,draw,transaction,setProblemsOpen:v=>{problemsOpen=!!v;renderProblems();},revalidateWorkspace,setFloating,popOutPanel,redockPanel,panelRoot,applyDisplay,rasterize};
// B1-023 (D1/D3): ?src=<relative .ddn path> opens that source as a new
// single-file document — the boot fixture workspace is replaced, the file's
// first view is selected. Strictly relative (no scheme/host/absolute path);
// the fetched text is size-capped like the viewer's drop cap and parsed via
// createWorkspace, so syntax errors surface through the normal problem path.
(function(){
 let src=null;
 try{src=new URLSearchParams(location.search).get('src');}catch{return;}
 if(src==null)return;
 const v=String(src).trim();
 const reject=m=>announce('?src= rejected: '+m,true);
 if(!v)return reject('empty — give a relative path to a .ddn file');
 if(/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v))return reject('must be a relative path, not a URL with a scheme: '+v);
 if(v.startsWith('//')||v.startsWith('/'))return reject('must be a relative path (no host, no absolute path): '+v);
 if(!/\.ddn$/i.test(v.split(/[?#]/)[0]))return reject('must point at a .ddn source: '+v);
 if(actualCommands.length&&!confirm('Opening '+v+' replaces the current workspace. Unsaved changes will be lost — continue?'))return;
 fetch(v).then(r=>{if(!r.ok)throw new Error(v+' — HTTP '+r.status);return r.text();}).then(text=>{
  if(text.length>50000000)throw new Error(v+' is '+Math.round(text.length/1e6)+' MB — sources are accepted up to 50 MB');
  const name=v.split('/').pop().split(/[?#]/)[0];
  const fresh=D.createWorkspace({[name]:text});
  const first=fresh.entries().flatMap(e=>((e&&e.views)||[]).map(x=>({file:e.file,view:x.id})))[0];
  if(!first){fresh.destroy();throw new Error('no view declared in '+name);}
  ws.destroy();ws=fresh;window.DesignerPrototype.workspace=ws;
  entry=first.file;view=first.view;ir=null;result=null;selected=null;zoom=1;updateZoom();mode='select';connectFrom=null;
  overrides={page:'content',look:'classic',theme:'default'};
  mPlan=null;mSel=null;mBatch=[];chartSel=null;chartNotice=null;timelineNotice=null;tDrag=null;fishboneNotice=null;panelsNotice=null;panelsSel=null;decisionNotice=null;decisionFixture=null;laneNotice=null;sequenceNotice=null;seqConnectFrom=null;pendingViews.clear();wsIssues=[];
  draw();announce('Opened '+v+' as a single-file document · first view selected');
 }).catch(e=>{
  announce(location.protocol==='file:'?'cannot fetch '+v+' — browsers block file:// page fetches. Serve over HTTP (npm run serve) and retry, or open the file from the source drawer.':(e&&(e.code||'LOAD')+': '+e.message),true);
 });
})();
draw();
})();
