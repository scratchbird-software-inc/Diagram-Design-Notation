/* SPDX-License-Identifier: GPL-2.0-or-later. Review prototype: uses unchanged public DDN runtime. */
(() => {
'use strict';
const D=window.DDNLive, $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initial=JSON.parse($('#sourceFiles').textContent), ws=D.createWorkspace(initial);
let entry='model.ddn',view='overview',ir=null,result=null,selected='designer.sample::model.customer',tab='meaning',left='add',mode='select',connectFrom=null,zoom=1,toastTimer,drag=null,counter=1;
let overrides={page:'content',look:'classic',theme:'default'},renderFailure=false;
let mPlan=null,mSel=null,mBatch=[];
const optionsByView={};const actualCommands=[];const A=D.authoring;
const KINDMAP=window.DDNKindUIMap,CMD=window.DesignerCommands;
const PALETTE_GROUPS=['Meaning','Data','Process','Systems','Scopes','People & control','Notes & evidence','Analysis'];
const kindsByGroup=PALETTE_GROUPS.map(g=>({group:g,kinds:KINDMAP.kinds.filter(k=>k.palette_group===g)}));
const kindEntry=kind=>KINDMAP.kinds.find(k=>k.kind===kind);
const codeOf=kind=>D.kinds.find(k=>k.id===kind)?.code||'';
const projectionKind=()=>ir?.view.profiles.projection?.kind||'graph';
const graph=()=>!ir||ir.view.profiles.projection?.kind==='graph';
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
  $('#viewHeading').textContent={overview:'Customer orders',names:'Customer orders · compact',raci:'Responsibility assignments',chart_bar:'Supplied monthly values'}[view]||view;
  $('#viewHelp').textContent=graph()?'Select a table to edit its shared meaning. Drag to position and pin it. Connect tables or their named fields.':'Values and bindings determine geometry. Graph placement and connector tools are unavailable in this projection.';
  $('#connectTool').disabled=!graph();$('#addAuto').disabled=!graph();$('#arrangeBtn').disabled=!graph();
  if(!graph())mode='select';
  bindCanvas();renderMatrixSheet();updateInspector();updateLeft();highlight();updateSource();
 }catch(e){renderFailure=true;$('#paper').style.opacity='.35';announce((e.code||'RENDER')+': '+e.message,true);}
}
// Staged helper operations provide one history entry for this prototype's limited gestures.
// The production plan/impact/draft service is specified separately, not implemented here.
function transaction(label,fn){
 const before=ws.getFiles(),revision=ws.revision,t=D.createWorkspace(before);try{const value=fn(t);const after=t.getFiles();const edits=Object.keys(after).filter(f=>before[f]!==after[f]).map(f=>({file:f,start:0,end:(before[f]||'').length,text:after[f]}));if(edits.length)ws.applyEdits(edits,{expectedRevision:revision,entry,view});actualCommands.push({label,revision:ws.revision,changedFiles:edits.map(e=>e.file)});if(value?.select)selected=value.select;draw();announce(label+' · source updated · Undo available');return true;}catch(e){announce((e.code||'EDIT')+': '+e.message,true);return false;}finally{t.destroy();}}
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
   h+='<td class="'+cls+'"><button class="mcell" data-r="'+ri+'" data-c="'+ci+'" aria-label="'+esc(plan.rows[ri].name+' / '+plan.columns[ci].name)+'">'+esc(d.value||'·')+'</button></td>';
  }
  h+='</tr>';
 }
 h+='</tbody></table>';
 if(editable&&keys)h+='<div class="sheet-head" style="margin-top:10px"><span class="small muted">Selected cell:</span><span class="keypad">'+keys.map(k=>'<button data-key="'+k+'">'+k+'</button>').join('')+'<button data-key="clear">Clear</button></span><span class="small muted">Keys '+(p.profile==='matrix.crud@1'?'toggle letters':'assign')+' · arrows move · Enter commits the batch · Esc discards</span></div>';
 else if(!editable)h+='<p class="help small muted" style="margin-top:10px">Cell editing needs an extension-property (<code>x_*</code>) value binding; this view binds <code>'+esc(p.value)+'</code>. The sheet is read-only.</p>';
 h+='<div class="batchbar"><span class="tag '+(mBatch.length?'amber':'')+'">BATCH · '+mBatch.length+' staged</span>'+mBatch.map((b,i)=>{const r=plan.rows.find(x=>x.id===b.rowId)?.name||b.rowId,c=plan.columns.find(x=>x.id===b.columnId)?.name||b.columnId;return '<span class="chip">'+esc(r+' → '+c+': '+(b.remove?'clear':String(b.value)))+'<button data-unstage="'+i+'" aria-label="Remove staged change">×</button></span>';}).join('')+'<button id="commitBatch" class="primary" '+(mBatch.length?'':'disabled')+'>Commit as one transaction</button><button id="discardBatch" '+(mBatch.length?'':'disabled')+'>Discard</button></div>';
 sheet.innerHTML=h;
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
function highlight(){const paper=$('#paper');paper.querySelectorAll('.selected,.member-selected').forEach(e=>e.classList.remove('selected','member-selected'));if(!selected){$('#selectionStatus').textContent='No selection';return;}const match=paper.querySelector('[data-id="'+CSS.escape(selected)+'"]');if(match)match.classList.add('selected');const member=paper.querySelector('[data-member="'+CSS.escape(selected)+'"]');if(member){member.classList.add('member-selected');member.closest('[data-id]')?.classList.add('selected');}$('#selectionStatus').textContent=selected?'Selected: '+sourceLabel(selected):'No selection';}
function choose(id){selected=id;$('#workspace').classList.add('inspecting');highlight();updateInspector();}
function setTab(t){tab=t;$$('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));updateInspector();}
function setView(v){optionsByView[entry+'#'+view]={...overrides};view=v;entry=['raci','chart_bar','responsibility_graph','crud','matrix_general'].includes(v)?'projections/views.ddn':'model.ddn';overrides=optionsByView[entry+'#'+view]||{page:'content',look:'classic',theme:'default'};selected=entry==='model.ddn'?'designer.sample::model.customer':null;zoom=1;updateZoom();mode='select';mSel=null;mBatch=[];$('#connectTool').classList.remove('active');$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));draw();document.body.classList.toggle('night',overrides.theme==='night');}
function updateLeft(){
 $$('[data-left]').forEach(b=>b.classList.toggle('active',b.dataset.left===left));const pane=$('#leftBody');
 if(left==='add'){
 const buttonFor=k=>`<button draggable="true" data-add="${esc(k.kind)}" data-search="${esc((k.name+' '+k.kind+' '+codeOf(k.kind)+' '+(D.kinds.find(x=>x.id===k.kind)?.label||'')).toLowerCase())}" title="${esc(k.kind)} — click to add automatically, or drag onto the canvas"><span class="glyph">${esc(codeOf(k.kind))}</span><span>${esc(k.name)}</span></button>`;
 pane.innerHTML='<input id="paletteSearch" placeholder="Find an object…" aria-label="Find any installed kind"><div class="sectionlabel">Installed kinds <span class="countbadge" id="paletteCount">'+KINDMAP.kinds.length+'/'+KINDMAP.kinds.length+'</span></div>'+kindsByGroup.map((g,i)=>'<details class="palette-group" open><summary>'+esc(g.group)+' <span class="countbadge" data-group-count>'+g.kinds.length+'</span></summary><div class="palette">'+g.kinds.map(buttonFor).join('')+'</div></details>').join('')+'<div class="lefttip">One meaningful object, then options.<br><br>Click = automatic placement.<br>Drag = explicit location and pin.</div><p class="small muted" style="margin-top:15px">The shelf lists all '+KINDMAP.kinds.length+' installed kinds from <code>contracts/kind-ui-map.json</code>, grouped by its palette groups. Profile-filtered specialized shelves remain a specification proposal (<button class="ghost" data-story="library" style="min-height:0;padding:0;font-size:inherit;text-decoration:underline">shelf design</button>).</p>';
 pane.querySelectorAll('[data-add]').forEach(b=>{b.disabled=!(graph()||projectionKind()==='fishbone');b.onclick=()=>addNode(b.dataset.add);b.ondragstart=e=>{e.dataTransfer.setData('application/x-ddn-kind',b.dataset.add);e.dataTransfer.effectAllowed='copy';};});
 $('#paletteSearch').oninput=e=>{const q=e.target.value.toLowerCase();let shown=0;pane.querySelectorAll('[data-add]').forEach(b=>{const hit=!q||b.dataset.search.includes(q);b.hidden=!hit;if(hit)shown++;});pane.querySelectorAll('.palette-group').forEach(d=>{const visible=[...d.querySelectorAll('[data-add]')].filter(b=>!b.hidden);d.open=!!q&&visible.length>0||!q;d.hidden=!!q&&!visible.length;const badge=d.querySelector('[data-group-count]');if(badge)badge.textContent=q?visible.length+'/'+d.querySelectorAll('[data-add]').length:visible.length;});$('#paletteCount').textContent=shown+'/'+KINDMAP.kinds.length;};pane.querySelectorAll('[data-story]').forEach(b=>b.onclick=()=>story(b.dataset.story));
 }else if(left==='model'){
 pane.innerHTML='<div class="row"><span class="tag teal">SHARED DEFINITIONS</span></div><p class="help small muted" style="margin-top:10px">Select a definition. This list is a keyboard alternative to the canvas.</p>'+ir.elements.filter(n=>ir.view.selected.includes(n.id)||!graph()).slice(0,35).map(n=>`<button class="model-item" data-select="${esc(n.id)}">${esc(n.name)} <span class="id">${esc(n.kind)} · ${esc(n.source?.file||'source')}</span></button>`).join('');pane.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>choose(b.dataset.select));
 }else{pane.innerHTML='<div class="tag">ONE WORKSPACE · SHARED SOURCE</div>'+['overview','names','raci','chart_bar'].map(v=>`<button class="model-item ${v===view?'active':''}" data-open-view="${v}" style="margin-top:12px">${({overview:'Structure',names:'Compact',raci:'Responsibilities',chart_bar:'Report'})[v]}<span class="id">${v==='overview'||v==='names'?'model.ddn':'projections/views.ddn'}</span></button>`).join('')+'<div class="lefttip">Changing a name edits a definition.<br><br>Changing “show fields” edits the appearance of this view.</div>';pane.querySelectorAll('[data-open-view]').forEach(b=>b.onclick=()=>setView(b.dataset.openView));}
}
function selectControl(id,label,values,current){return `<label for="${id}">${label}</label><select id="${id}">`+values.map(([v,l])=>`<option value="${v}" ${v===current?'selected':''}>${l}</option>`).join('')+'</select>';}
function updateInspector(){const sel=findSelection(),h=$('#selectionHeader'),p=$('#inspectorBody');
 if(sel){h.innerHTML=`<div class="selection-title"><span class="tag">${esc(sel.kind==='field'?'FIELD':sel.kind==='relation'?'RELATIONSHIP':sel.node.kind.toUpperCase())}</span><h2>${esc(sel.name)}</h2><p>${esc(sel.sourceId)}</p></div><div class="scope-banner">Shared definition · ${usage(sel.sourceId)} view(s) in this source entry<br>Edits to meaning affect every occurrence.</div>`;if(sel.kind==='node'){const km=kindEntry(sel.node.kind);if(km)h.innerHTML+='<div class="scope-banner" style="background:#f0f4fa;border-color:#d3deea;color:#33506b">'+esc(km.name)+' · '+esc(km.palette_group)+' · template <code>'+esc(km.inspector_template)+'</code><br>Source: '+esc(km.source)+' registry · profiles hint: '+esc(km.profiles_hint.join(', ')||'—')+'</div>';}}else{h.innerHTML='<div class="selection-title"><span class="tag">VIEW SETTINGS</span><h2>'+esc($('#viewHeading').textContent)+'</h2><p>'+esc(entry+' # '+view)+'</p></div><div class="scope-banner">View configuration · shared data unchanged</div>';}
 if(tab==='view'){
 p.innerHTML='<div class="tag">LOCAL PREVIEW OVERRIDES</div>'+selectControl('lookSetting','Drawing treatment',[['classic','Standard'],['handDrawn','Hand-drawn'],['neo','Neo']],overrides.look||'classic')+selectControl('themeSetting','Palette',[['default','Light'],['night','Night · grey-blue']],overrides.theme||'default');
 if(graph())p.innerHTML+=selectControl('fieldsSetting','Field compartment',[['source','As authored'],['names','Field names'],['none','Name only']],overrides.fields||'source')+selectControl('routeSetting','Connector path',[['source','As authored'],['orthogonal','Right angles'],['curved','Curved'],['straight','Straight'],['rounded','Rounded corners']],overrides.routing||'source')+'<p class="help">A path setting changes geometry, never the meaning or endpoints.</p>';
 else if(view==='chart_bar')p.innerHTML+=selectControl('markSetting','Chart mark',[['bar','Bars'],['line','Line'],['pie','Pie'],['donut','Doughnut']],overrides.mark||'bar');
 if(sel?.kind==='node'&&graph()){const pinned=!!result.scene.layout?.pinned?.includes(sel.sourceId)||sourceView().includes('place @model.'+sel.node.local);p.innerHTML+='<hr><h3>Position</h3><p class="help">Dragging makes an explicit pin. Size alone is not a pin.</p><div class="kv"><div><label for="pinX">X · world px</label><input id="pinX" type="number" value="'+Math.round(result.scene.nodes.find(n=>n.id===sel.sourceId)?.x||0)+'"></div><div><label for="pinY">Y · world px</label><input id="pinY" type="number" value="'+Math.round(result.scene.nodes.find(n=>n.id===sel.sourceId)?.y||0)+'"></div></div><div class="row" style="margin-top:10px"><button id="pinApply" class="primary">Set pin</button><button id="unpinApply">Make automatic</button></div>';
 $('#pinApply').onclick=()=>transaction('Set this view position',t=>A.pin(t,entry,view,sel.sourceId,Number($('#pinX').value),Number($('#pinY').value)));$('#unpinApply').onclick=()=>transaction('Release source pin',t=>A.unpin(t,entry,view,sel.sourceId));}
 p.innerHTML+='<hr><p class="help">Look and palette use live renderer overrides in this prototype. Production source-write and inherited/reset rules are specified separately.</p><button id="resetStyle" class="wide">Reset this preview</button>';
 const change=(id,key)=>{const el=$('#'+id);if(el)el.onchange=()=>{overrides[key]=el.value;document.body.classList.toggle('night',overrides.theme==='night');draw();};};change('lookSetting','look');change('themeSetting','theme');change('fieldsSetting','fields');change('routeSetting','routing');change('markSetting','mark');$('#resetStyle').onclick=()=>{overrides={page:'content',look:'classic',theme:'default'};document.body.classList.remove('night');draw();};
 // Rebind position actions after innerHTML append recreated them.
 if($('#pinApply')){$('#pinApply').onclick=()=>transaction('Set this view position',t=>A.pin(t,entry,view,sel.sourceId,Number($('#pinX').value),Number($('#pinY').value)));$('#unpinApply').onclick=()=>transaction('Release source pin',t=>A.unpin(t,entry,view,sel.sourceId));}return;
 }
 if(tab==='details'){
 p.innerHTML='<div class="sectionlabel" style="margin-top:0">Details on demand</div><p class="help">Required properties appear in Meaning. Specialized implementation, evidence and scope stay discoverable here.</p>'+(sel?'<label>Source identity</label><div class="subtle"><code>'+esc(sel.sourceId)+'</code></div><label>Applicable groups</label><div class="control-stack"><button data-story="properties">Domain & representation</button><button data-story="properties">Scope & ownership</button><button data-story="properties">Constraints & evidence</button></div>':'<div class="notice">The projection determines which operations are meaningful. A record value is not a freehand position.</div>')+'<hr><h3>Current render diagnostics</h3>'+result.diagnostics.slice(0,5).map(d=>'<p class="help"><strong>'+esc(d.code)+'</strong><br>'+esc(d.message)+'</p>').join('')+'<button id="inspectSource" class="wide">Inspect actual source</button><p class="help">Advanced group screens are design proposals, not implemented specialized property editors.</p>';p.querySelectorAll('[data-story]').forEach(b=>b.onclick=()=>story(b.dataset.story));$('#inspectSource').onclick=openSource;return;
 }
 if(!graph()){
 const mp=matrixProfile();
 if(mp){
  let mh='<div class="notice">Data-bound projection. A cell is a projection of a shared assignment relation — editing it edits source, never a UI-only fact.</div><h3>'+esc(mp.profile)+'</h3><label>Binding</label><div class="subtle">'+esc(mp.relation)+' · '+esc(mp.value)+'</div><label>Write target</label><div class="subtle">'+esc(matrixWriteTarget(mp))+'</div>';
  const cell=mSel&&mPlan?{row:mPlan.rows[mSel.r],column:mPlan.columns[mSel.c],...cellDisplay(mSel.r,mSel.c)}:null;
  if(cell&&cell.assignments.length)mh+='<label>Selected cell</label><div class="subtle">'+esc(cell.row.name)+' → '+esc(cell.column.name)+'</div><label>Contributors</label>'+cell.assignments.map(a=>'<div class="endpoint-card"><code>'+esc(a.id)+'</code><br>value <code>'+esc(a.value)+'</code></div>').join('')+'<button id="cellInGraph" class="wide primary">Select assignment in graph</button>';
  else if(cell)mh+='<label>Selected cell</label><div class="subtle">'+esc(cell.row.name)+' → '+esc(cell.column.name)+' · '+(cell.staged?'staged “'+esc(cell.value||'clear')+'”':'empty')+'</div><p class="help">Type a code letter or use the sheet keypad to stage an assignment, then commit the batch as one transaction.</p>';
  else mh+='<label>Rows</label><div class="subtle">'+esc(mPlan?mPlan.rows.map(r=>r.name).join(' · '):'')+'</div><label>Columns</label><div class="subtle">'+esc(mPlan?mPlan.columns.map(c=>c.name).join(' · '):'')+'</div><p class="help">Click a cell in the sheet under the diagram. Keyboard and pointer are equivalent; every commit is one source transaction.</p>';
  p.innerHTML=mh+'<button id="projectedSource" class="wide">View source bindings</button>';$('#projectedSource').onclick=openSource;
  if($('#cellInGraph'))$('#cellInGraph').onclick=()=>{const id=cell.assignments[0].id;setView('responsibility_graph');choose(id);announce('Assignment selected in the responsibility graph.');};
  return;
 }
 p.innerHTML='<div class="notice">Data-bound projection. Moving a mark must not change a number, date, assignment, or scale.</div>'+'<h3>Supplied values</h3><label>Source</label><div class="subtle">m.facts · six synthetic records</div><label>Category</label><div class="subtle">x_record.month</div><label>Value</label><div class="subtle">x_record.value · CAD</div><p class="help">Changing the chart mark is live under This view. Binding wizards are specified, not implemented in this prototype.</p>'+'<button id="projectedSource" class="wide">View source bindings</button>';$('#projectedSource').onclick=openSource;return;
 }
 if(!sel){p.innerHTML='<h3>Select an object or relation</h3><p class="help">Choose a palette starter to insert. Use Model for keyboard selection. All new objects are synthetic local design definitions.</p>';return;}
 p.innerHTML='<label for="nameEdit">'+(sel.kind==='field'?'Field label':'Name')+'</label><input id="nameEdit" value="'+esc(sel.name)+'"><div class="row" style="margin-top:8px"><button id="applyName" class="primary">Apply label</button><button id="moreReview">Used in views…</button></div><p class="help">Changes the display label, not the stable identifier.</p>';
 if(sel.kind==='node'){
 const km=kindEntry(sel.node.kind);
 p.innerHTML+='<label>Type</label><div class="row"><input value="'+esc(sel.node.kind)+'" readonly aria-label="Semantic kind"><button id="convertBtn">Change…</button></div><p class="help">A type conversion can change meaning. A visual look does not.</p>';
 p.innerHTML+='<label for="descEdit">Description</label><textarea id="descEdit">'+esc(sel.node.properties?.description||'')+'</textarea><div class="row" style="margin-top:8px"><button id="applyDesc">Apply description</button></div>';
 if(km?.inspector_template==='data-structure'){
 p.innerHTML+='<label>Fields <span class="muted">'+sel.node.fields.length+'</span></label><div class="fieldlist">'+sel.node.fields.map(f=>`<div class="fieldrow" data-field="${esc(f.id)}"><code>${esc(f.name)}</code><button data-start="${esc(f.id)}" title="Connect this field">↗</button></div>`).join('')+'</div><div class="row" style="margin-top:8px"><input id="newField" placeholder="new_field" aria-label="New field identifier"><button id="addField">＋</button></div><p class="help">Start with names. No datatype is required.</p>';
 }
 if(km)p.innerHTML+='<label>Descriptor <span class="muted">kind-ui-map.json · read-only</span></label><div class="subtle">Basic controls: '+esc(km.basic_controls.join(', '))+'<br>Advanced groups: '+esc(km.advanced_groups.join(', '))+'<br>'+esc(km.properties_editing)+'</div><p class="help">'+esc(km.mapping_status)+'. Live controls here are label, description, fields, pin, connect and hide; every other descriptor property is shown read-only and is never rewritten.</p>';
 p.innerHTML+='<hr><div class="row wrap"><button id="connectSelected">Connect…</button><button id="hideSelected">Remove from view</button></div><p class="help">Remove from view retains the shared definition.</p>';
 }else if(sel.kind==='field'){
 p.innerHTML+='<label>Owner</label><div class="subtle">'+esc(sel.node.name)+'</div><label>Meaning / domain</label><button class="wide" data-story="properties">Choose a domain… <span class="tag amber">DESIGN</span></button><p class="help">Prototype only edits the label and connects this field. Domain/type/key editing is specified in the descriptor contract.</p><button id="connectSelected" class="wide primary">Connect this field</button><button id="selectParent" class="wide">Back to '+esc(sel.node.name)+'</button>';
 }else{
 const r=sel.relation;const end=e=>e.field||e.member||e.port||e.element;
 p.innerHTML+='<label>Meaning</label><div class="subtle">'+esc(r.kind)+'</div><label>From</label><div class="endpoint-card">'+esc(sourceLabel(end(r.from)))+'</div><label>To</label><div class="endpoint-card">'+esc(sourceLabel(end(r.to)))+'</div><p class="help">Field identity and visual anchor are separate. Reconnection needs its own reviewed source transaction.</p><button id="reconnectReview" class="wide">Review reconnection design…</button>';
 }
 $('#applyName').onclick=()=>transaction('Rename shared label',t=>A.setLabel(t,entry,view,sel.sourceId,$('#nameEdit').value));$('#nameEdit').onkeydown=e=>{if(e.key==='Enter')$('#applyName').click();if(e.key==='Escape')e.target.value=sel.name;};$('#moreReview').onclick=()=>story('impact');if($('#convertBtn'))$('#convertBtn').onclick=()=>story('conversion');
 if($('#applyDesc'))$('#applyDesc').onclick=()=>transaction('Set description',t=>A.setProperty(t,entry,view,sel.sourceId,'description',$('#descEdit').value));
 p.querySelectorAll('[data-field]').forEach(x=>x.onclick=e=>{if(!e.target.closest('button'))choose(x.dataset.field);});p.querySelectorAll('[data-start]').forEach(x=>x.onclick=()=>beginConnect(x.dataset.start));p.querySelectorAll('[data-story]').forEach(x=>x.onclick=()=>story(x.dataset.story));
 if($('#addField'))$('#addField').onclick=()=>{const id=$('#newField').value;transaction('Add untyped field',t=>A.addField(t,entry,view,sel.sourceId,{id}));};
 if($('#connectSelected'))$('#connectSelected').onclick=()=>beginConnect(sel.sourceId);if($('#selectParent'))$('#selectParent').onclick=()=>choose(sel.node.id);if($('#hideSelected'))$('#hideSelected').onclick=()=>{transaction('Remove appearance, retain definition',t=>A.hide(t,entry,view,sel.sourceId));selected=null;updateInspector();};if($('#reconnectReview'))$('#reconnectReview').onclick=()=>story('connection');
}
function addNode(kind,at){
 const descriptor=kindEntry(kind);
 if(!descriptor)return;
 const proj=projectionKind();
 if(!graph()&&proj!=='fishbone')return;
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
  if(e.button!==0||!graph())return;const member=e.target.closest('[data-member]'),el=e.target.closest('.ddn-node[data-id]'),edge=e.target.closest('.ddn-edge[data-id]');const id=member?.dataset.member||el?.dataset.id||edge?.dataset.id;
  if(mode==='connect'&&id){e.preventDefault();if(!connectFrom){connectFrom=id;announce('From '+sourceLabel(id)+'. Select the destination.');}else showConnection(connectFrom,id);return;}
  if(id)choose(id);if(!el||member||mode!=='select')return;const n=result.scene.nodes.find(n=>n.id===el.dataset.id);if(!n)return;const point=worldPoint(e);drag={el,id:n.id,x:n.x,y:n.y,start:point,pointer:e.pointerId,moved:false};el.setPointerCapture(e.pointerId);
 };
 $('#paper').onpointermove=e=>{if(!drag||e.pointerId!==drag.pointer)return;const p=worldPoint(e);const dx=p.x-drag.start.x,dy=p.y-drag.start.y;if(Math.abs(dx)+Math.abs(dy)<5&&!drag.moved)return;drag.moved=true;drag.dx=dx;drag.dy=dy;drag.el.setAttribute('transform','translate('+dx+' '+dy+')');};
 $('#paper').onpointerup=e=>{if(!drag)return;const d=drag;drag=null;try{d.el.releasePointerCapture(e.pointerId);}catch{}if(d.moved)transaction('Move and pin '+sourceLabel(d.id),t=>A.pin(t,entry,view,d.id,d.x+d.dx,d.y+d.dy));};
 $('#paper').onpointercancel=()=>{if(drag){drag.el.removeAttribute('transform');drag=null;announce('Move cancelled; source unchanged.');}};
 $('#paper').onclick=e=>{if(!graph()){const m=e.target.closest('[data-id],[data-source]');if(m){const id=m.getAttribute('data-id')||m.getAttribute('data-source');if(id){selected=id;updateInspector();announce('Source-bound mark selected. Binding editor is specified; source is inspectable.');}}}};
}
$('#viewport').ondragover=e=>{if(graph()){e.preventDefault();e.dataTransfer.dropEffect='copy';}};
$('#viewport').ondrop=e=>{const kind=e.dataTransfer.getData('application/x-ddn-kind');if(!kindEntry(kind))return;e.preventDefault();const p=worldPoint(e)||{x:0,y:0};addNode(kind,{x:p.x-80,y:p.y-25});};
function modal(title,body,actions,live=true){$('#dialogTitle').textContent=title;$('#dialogBody').innerHTML=body;$('#dialogTag').textContent=live?'LIVE ACTION · REAL SOURCE':'PROPOSED WORKFLOW · NOT EXECUTED';$('#dialogTag').className='tag '+(live?'teal':'amber');$('#dialogActions').innerHTML='';for(const a of actions){const b=document.createElement('button');b.textContent=a.label;b.className=a.primary?'primary':'';b.onclick=a.action;$('#dialogActions').appendChild(b);}$('#dialog').showModal();}
function closeModal(){$('#dialog').close();$('#reviewScreen').value='live';}
function endpointOptions(current){return ir.elements.filter(n=>ir.view.selected.includes(n.id)).map(n=>`<optgroup label="${esc(n.name)}"><option value="${esc(n.id)}" ${current===n.id?'selected':''}>${esc(n.name)} · object</option>`+(n.fields||[]).map(f=>`<option value="${esc(f.id)}" ${current===f.id?'selected':''}>${esc(n.name+'.'+f.name)} · field</option>`).join('')+'</optgroup>').join('');}
function beginConnect(from,preset='ref'){connectFrom=from;mode='connect';$('#selectTool').classList.remove('active');$('#connectTool').classList.add('active');announce('Choose a target in the diagram, or select it in the connection sheet.');showConnection(from,null,preset);}
function showConnection(from,to,preset='ref'){mode='select';connectFrom=null;$('#connectTool').classList.remove('active');$('#selectTool').classList.add('active');const fallback=ir.elements.find(n=>n.id!==selectionOwner(from))?.id;
 modal('Create a relationship','<p>Choose meaning independently of line shape. The current validator checks the resulting endpoints.</p><label for="connectFrom">From</label><select id="connectFrom">'+endpointOptions(from)+'</select><div class="preview-arrow">↓</div><label for="connectTo">To</label><select id="connectTo">'+endpointOptions(to||fallback)+'</select>'+selectControl('relationMeaning','Relationship meaning',[['ref','References'],['assoc','Associated with'],['flow','Data flows to'],['depends','Depends on']],preset)+'<label for="relationLabel">Label</label><input id="relationLabel" value="New reference"><div class="notice">Prototype creation uses the existing helper’s local <code>editor_data</code> block. Production shared destination and impact selection are required in the specification.</div>',[{label:'Cancel',action:closeModal},{label:'Create relationship',primary:true,action:()=>{const from=$('#connectFrom').value,to=$('#connectTo').value,kind=$('#relationMeaning').value,name=$('#relationLabel').value;const ok=transaction('Create semantic relationship',t=>{A.addRelation(t,entry,view,{id:'connection_'+counter++,name,kind,from,to});});if(ok)closeModal();}}]);}
function story(type){const sel=findSelection(),n=sel?.name||'Customer';const sections={
 conversion:['Change the type, not just the shape',`<p>Review design for converting <strong>${esc(n)}</strong>. This screen does not perform a conversion.</p><div class="row"><div class="endpoint-card">Table</div><strong>→</strong><div class="endpoint-card">SQL view</div></div><div class="storyline"><h3>Keep</h3><p>Stable identity, compatible fields, names and descriptions.</p><h3>Review before converting</h3><p>Primary-key enforcement, storage placement, write behavior, implementation dependencies and all affected views.</p><h3>3 affected views</h3><p>Structure · Deployment · SQL dependency. The production impact resolver must calculate this list; these are illustrative labels.</p></div><div class="notice">Conversion cannot silently retain incompatible metadata or discard a property. The command planner returns a source diff and requires confirmation.</div>`],
 draft:['Build incomplete diagrams safely','<p>A user must be able to place Start before End. The current strict flowchart validator rejects that intermediate diagram.</p><div class="fake-sheet"><span class="tag amber">DRAFT OBLIGATIONS</span><p>Start has no outgoing step.</p><p>At least one End is required before review/export.</p><p>Untyped connection requires a meaning.</p></div><p>Proposed behavior: show repairable draft objects, record incomplete obligations separately from unsafe syntax, preserve source, and keep reviewed publication strict.</p><div class="notice">Draft-state validation and rendering are new core requirements. This prototype does not bypass existing validators.</div>'],
 connection:['Relation identity versus visual attachment',`<p>The semantic endpoints remain <strong>Journal Line.journal</strong> and <strong>Journal Header.id</strong>.</p><div class="fake-sheet"><h3>Meaning</h3><p>References · enforcement undecided</p><h3>This view</h3><p>Curved · automatic side/anchor · numbered key</p></div><p>A control point can move along a legal outline. Reconnecting to a different field is a separate meaning-changing command with impact preview.</p><div class="notice">The fixed endpoint-ordering renderer is used by this prototype. This screen specifies a future reconnection/anchor editor.</div>`],
 export:['Publication and source downloads','<p>Source workspaces are internal design material. A hidden salary field may remain in a source archive.</p><div class="control-stack"><button disabled>Download source workspace — authority required</button><button disabled>Export current SVG — display selection only</button><button disabled>Authorized publication — validated allowlist policy</button></div><p>These disabled buttons document production choices. Use Download in the real toolbar for the synthetic prototype files.</p><div class="notice">Unsupported redacted projections must fail closed. No “ignore validation” option should be offered.</div>'],
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
$$('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));$$('[data-left]').forEach(b=>b.onclick=()=>{left=b.dataset.left;updateLeft();});$$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('#undo').onclick=()=>{ws.undo();draw();announce('Undo · source restored');};$('#redo').onclick=()=>{ws.redo();draw();announce('Redo · source restored');};
$('#selectTool').onclick=()=>{mode='select';connectFrom=null;$('#selectTool').classList.add('active');$('#connectTool').classList.remove('active');announce('Select objects or fields. Drag a selected object to pin it.');};$('#connectTool').onclick=()=>{mode='connect';connectFrom=null;$('#selectTool').classList.remove('active');$('#connectTool').classList.add('active');announce('Click a source, then a destination. Escape cancels.');};
$('#fitBtn').onclick=()=>{const svg=$('#paper>svg'),v=svg?.viewBox.baseVal,port=$('#viewport');if(v?.width&&v?.height){const availableW=port.clientWidth-48,availableH=port.clientHeight-75;zoom=Math.min(1,(availableH/v.height)/(availableW/v.width));}else zoom=1;updateZoom();};$('#zoomIn').onclick=()=>{zoom=Math.min(2,zoom+.2);updateZoom();};$('#zoomOut').onclick=()=>{zoom=Math.max(.4,zoom-.2);updateZoom();};$('#arrangeBtn').onclick=arrange;$('#addAuto').onclick=()=>addNode('table');
$('#exportBtn').onclick=()=>{modal('Download the live design','<p>The files below contain the current synthetic design. They are not a production-authorized export.</p><div class="endpoint-card"><strong>'+esc(entry)+'</strong><p>Current source file. Its imports still require their files.</p></div><p>The workspace ZIP includes all supporting DDN sources. Its file format can be opened in the existing Studio.</p>',[{label:'Current DDN',action:()=>D.io.download(entry.split('/').pop(),ws.getFiles()[entry],'text/plain;charset=utf-8')},{label:'Workspace ZIP',primary:true,action:()=>D.io.download('designer-prototype-workspace.zip',D.io.toZIP(ws.snapshot(entry,view,overrides)),'application/zip')},{label:'Current SVG',action:()=>{if(renderFailure)return announce('Current render is invalid; export blocked.',true);D.io.download('designer-prototype.svg',result.svg,'image/svg+xml');}}]);};
window.addEventListener('keydown',e=>{if(e.key==='Escape'){connectFrom=null;mode='select';if(drag){drag.el.removeAttribute('transform');drag=null;}$('#connectTool').classList.remove('active');$('#selectTool').classList.add('active');}if(e.target.matches('input,textarea,select'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?ws.redo():ws.undo();draw();}if(e.key==='Delete'&&graph()&&findSelection()?.kind==='node')$('#hideSelected')?.click();});
window.DesignerPrototype={workspace:ws,getState:()=>({entry,view,selected,tab,result,commands:actualCommands,overrides}),select:choose,setView,story,draw,transaction};
draw();
})();
