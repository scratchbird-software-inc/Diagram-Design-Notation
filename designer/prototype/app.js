/* SPDX-License-Identifier: GPL-2.0-or-later. Review prototype: uses unchanged public DDN runtime. */
(() => {
'use strict';
const D=window.DDNLive, $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initial=JSON.parse($('#sourceFiles').textContent), ws=D.createWorkspace(initial);
let entry='model.ddn',view='overview',ir=null,result=null,selected='designer.sample::model.customer',tab='meaning',left='add',mode='select',connectFrom=null,zoom=1,toastTimer,drag=null,counter=1;
let overrides={page:'content',look:'classic',theme:'default'},renderFailure=false;
let mPlan=null,mSel=null,mBatch=[];
let chartSel=null,chartNotice=null,dragGuard=null,lastEditError=null;
let timelineNotice=null,tDrag=null;
let fishboneNotice=null;
let panelsNotice=null,panelsSel=null;
let decisionNotice=null,decisionFixture=null;
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
  $('#viewHeading').textContent={overview:'Customer orders',names:'Customer orders · compact',raci:'Responsibility assignments',chart_bar:'Supplied monthly values',gantt:'Supplied-date procurement schedule',fishbone:'Possible causes of inspection failures',swot:'Reusable SWOT panel template',sipoc:'SIPOC from shared notes',journey:'Service journey with spanning panels',decision:'Disposition policy — decision table'}[view]||view;
  $('#viewHelp').textContent=graph()?'Select a table to edit its shared meaning. Drag to position and pin it. Connect tables or their named fields.':'Values and bindings determine geometry. Graph placement and connector tools are unavailable in this projection.';
  $('#connectTool').disabled=!graph();$('#addAuto').disabled=!graph();$('#arrangeBtn').disabled=!graph();
  if(!graph())mode='select';
  bindCanvas();renderMatrixSheet();renderChartSheet();renderTimelineSheet();renderFishboneSheet();renderPanelsSheet();renderDecisionSheet();updateInspector();updateLeft();highlight();updateSource();
 }catch(e){lastEditError=e;renderFailure=true;$('#paper').style.opacity='.35';announce((e.code||'RENDER')+': '+e.message,true);if(chartProfile())try{renderChartSheet();}catch{}if(decisionProfile())try{renderDecisionSheet();}catch{}}
}
// Staged helper operations provide one history entry for this prototype's limited gestures.
// The production plan/impact/draft service is specified separately, not implemented here.
function transaction(label,fn){
 const before=ws.getFiles(),revision=ws.revision,t=D.createWorkspace(before);try{const value=fn(t);const after=t.getFiles();const edits=Object.keys(after).filter(f=>before[f]!==after[f]).map(f=>({file:f,start:0,end:(before[f]||'').length,text:after[f]}));if(edits.length)ws.applyEdits(edits,{expectedRevision:revision,entry,view});actualCommands.push({label,revision:ws.revision,changedFiles:edits.map(e=>e.file)});if(value?.select)selected=value.select;draw();announce(label+' · source updated · Undo available');return true;}catch(e){lastEditError=e;announce((e.code||'EDIT')+': '+e.message,true);return false;}finally{t.destroy();}}
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
 h+='<div class="batchbar"><button id="addChartRecord">＋ Add record</button><span class="small muted">Adds a record with this chart’s key set and appends its binding — one transaction. Dragging marks is disabled: values set geometry.</span></div>';
 sheet.innerHTML=h;
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
 if(planError){h+='<div class="notice error">'+esc(planError)+' The sheet stays read-only; the source is unchanged.</div>';sheet.innerHTML=h;return;}
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
 h+='<div class="batchbar"><span class="tag">ADD TASK</span><input id="tlNewId" placeholder="task_id" aria-label="New task identifier"><input id="tlNewLabel" placeholder="Label" aria-label="New task label"><input id="tlNewStart" type="date" aria-label="New task start"><input id="tlNewEnd" type="date" aria-label="New task end"><button id="addTimelineRecord">＋ Add record</button><span class="small muted">A zero-length interval (start = end) is a legal milestone. Bars drag whole days with a preview; the SVG stays authoritative until commit.</span></div>';
 sheet.innerHTML=h;
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
 if(planError){h+='<div class="notice error">'+esc(planError)+' Incomplete bones stay saveable; profile checks run at review. Fix the rib set below or in source.</div>';sheet.innerHTML=h;return;}
 const occ=fishboneOccurrences(plan);
 const occNote=id=>{const list=occ.get(id)||[];return list.length>1?'<div class="occ">occurrences ('+list.length+'): '+list.map(o=>'<code>'+esc(o)+'</code>').join(' · ')+'</div>':'';};
 h+='<table aria-label="Fishbone ribs"><tbody>';
 h+='<tr'+(selected===plan.effect.id?' class="sel"':'')+'><th style="width:1%;white-space:nowrap">EFFECT</th><td><input id="fbEffectLabel" value="'+esc(plan.effect.name)+'" aria-label="Effect statement"></td><td class="fb-actions"><button id="fbEffectApply" class="primary">Apply label</button></td></tr>';
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
 h+='<div class="batchbar"><span class="tag">ADD CATEGORY</span><input id="fbCatId" placeholder="category_id" aria-label="New category identifier"><input id="fbCatLabel" placeholder="Label" aria-label="New category label"><button id="fbAddCat">＋ Add category</button><span class="small muted">First-level ribs must be categories (1..12); causes nest at most 4 levels. Illegal ribs reject with the runtime’s own codes before any commit.</span></div>';
 sheet.innerHTML=h;
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
  h+='<button data-pspanapply="'+esc(v.id)+'" '+(fixed?'disabled':'')+'>Apply span</button><button data-pdel="'+esc(v.id)+'" '+(fixed?'disabled title="fixed canvas block"':'')+'>Delete panel</button></div>';
  if(isChild){
   const childId=String(v.view?.$ref??v.view).split('::').pop();
   h+='<div class="panel-items"><span class="small muted">Bound child view <code>'+esc(childId)+'</code> — a named-view reference, never an inline copy of child geometry (spec ch.09 Composition).</span><button data-popen="'+esc(childId)+'">Open child view</button>';
   const others=ws.views(entry).filter(x=>x.id!==view&&x.id!==childId);
   h+='<span class="small muted">Rebind slot ('+childCount+'/12 child slots):</span><select data-pbindpick="'+esc(v.id)+'">'+others.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.id)+'</option>').join('')+'</select><button data-pbind="'+esc(v.id)+'">Bind view</button></div>';
  }else{
   const itemPanels=source.filter(x=>x.view===undefined&&x.id!==v.id);
   h+='<div class="panel-items">'+(planned?planned.items.map(it=>{
    const nid=it.node.id;
    return '<span class="chip'+(panelsSel===nid?' sel':'')+'" data-pitem="'+esc(nid)+'">'+esc(it.node.name)+' <select data-pmove="'+esc(nid)+'" title="Move to another item-panel" aria-label="Move '+esc(it.node.name)+' to another panel"><option value="">move to…</option>'+itemPanels.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.title)+'</option>').join('')+'</select></span>';
   }).join(''):'<span class="small muted">items unavailable while the plan is invalid</span>')+'</div>';
   h+='<div class="panel-form"><input data-paddid="'+esc(v.id)+'" placeholder="note_id" aria-label="New note identifier"><input data-paddlabel="'+esc(v.id)+'" placeholder="Label" aria-label="New note label"><input data-padddesc="'+esc(v.id)+'" placeholder="Description" aria-label="New note description"><button data-padd="'+esc(v.id)+'">＋ Add item</button></div>';
  }
  h+='</div>';
 }
 h+='<div class="batchbar"><span class="tag">ADD PANEL</span><input id="pNewId" placeholder="panel_id" aria-label="New panel identifier"><input id="pNewTitle" placeholder="Title" aria-label="New panel title"><input id="pNewRow" type="number" min="0" placeholder="row" aria-label="New panel row"><input id="pNewCol" type="number" min="0" placeholder="column" aria-label="New panel column"><input id="pNewNote" placeholder="First item label (required — empty panels reject DDN-PJ009)" aria-label="First item label"><button id="pAddPanel">＋ Add panel</button><span class="small muted">One transaction: a shared note definition plus the new panel holding it. Overlaps reject DDN-PJ021; fixed-grid canvas profiles keep their required blocks (DDN-PJ080/081/083).</span></div>';
 sheet.innerHTML=h;
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
  sheet.innerHTML=h;
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
 h+='<button id="decisionEval" class="primary">Evaluate</button></div>';
 if(decisionFixture){
  if(decisionFixture.error)h+='<div class="notice error">'+esc(decisionFixture.error)+'</div>';
  else{const r=decisionFixture.result;h+='<div class="fixture-result">status <strong>'+esc(r.status)+'</strong> · matched ['+r.matched.map(x=>esc(x.split('::').pop())).join(', ')+'] · selected ['+r.selected.map(x=>esc(x.split('::').pop())).join(', ')+']'+(r.outputs.length?' · outputs '+r.outputs.map(o=>'<code class="witness">'+esc(JSON.stringify(o))+'</code>').join(''):'')+'</div>';}
 }
 h+='</div>';
 h+='<div class="batchbar"><span class="tag">ADD RULE</span><input id="decNewId" placeholder="rule_id" aria-label="New rule identifier"><input id="decNewLabel" placeholder="Label" aria-label="New rule label"><button id="decAddRule">＋ Add rule</button><span class="small muted">Creates one shared <code>rule.row</code> definition with a default outcome per declared type, appends its ref to <code>projection.records</code> — one transaction. An overlap under a unique policy commits as a draft with the witness shown above (VE-007).</span></div>';
 sheet.innerHTML=h;
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
function cancelTimelineDrag(silent){
 if(!tDrag)return;
 try{tDrag.el.removeAttribute('transform');}catch{}
 tDrag.tip?.remove();
 tDrag=null;
 if(!silent)announce('Date drag cancelled; source unchanged.');
}
function highlight(){const paper=$('#paper');paper.querySelectorAll('.selected,.member-selected').forEach(e=>e.classList.remove('selected','member-selected'));if(!selected){$('#selectionStatus').textContent='No selection';return;}const match=paper.querySelector('[data-id="'+CSS.escape(selected)+'"]');if(match)match.classList.add('selected');const member=paper.querySelector('[data-member="'+CSS.escape(selected)+'"]');if(member){member.classList.add('member-selected');member.closest('[data-id]')?.classList.add('selected');}$('#selectionStatus').textContent=selected?'Selected: '+sourceLabel(selected):'No selection';}
function choose(id){selected=id;$('#workspace').classList.add('inspecting');highlight();updateInspector();}
function setTab(t){tab=t;$$('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));updateInspector();}
function setView(v){cancelTimelineDrag(true);optionsByView[entry+'#'+view]={...overrides};view=v;entry=['raci','chart_bar','gantt','fishbone','responsibility_graph','crud','matrix_general','swot','sipoc','journey','decision'].includes(v)?'projections/views.ddn':'model.ddn';overrides=optionsByView[entry+'#'+view]||{page:'content',look:'classic',theme:'default'};selected=entry==='model.ddn'?'designer.sample::model.customer':null;zoom=1;updateZoom();mode='select';mSel=null;mBatch=[];chartSel=null;chartNotice=null;timelineNotice=null;fishboneNotice=null;panelsNotice=null;panelsSel=null;decisionNotice=null;decisionFixture=null;$('#connectTool').classList.remove('active');$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));draw();document.body.classList.toggle('night',overrides.theme==='night');}
function updateLeft(){
 $$('[data-left]').forEach(b=>b.classList.toggle('active',b.dataset.left===left));const pane=$('#leftBody');
 if(left==='add'){
 const buttonFor=k=>`<button draggable="true" data-add="${esc(k.kind)}" data-search="${esc((k.name+' '+k.kind+' '+codeOf(k.kind)+' '+(D.kinds.find(x=>x.id===k.kind)?.label||'')).toLowerCase())}" title="${esc(k.kind)} — click to add automatically, or drag onto the canvas"><span class="glyph">${esc(codeOf(k.kind))}</span><span>${esc(k.name)}</span></button>`;
 pane.innerHTML='<input id="paletteSearch" placeholder="Find an object…" aria-label="Find any installed kind"><div class="sectionlabel">Installed kinds <span class="countbadge" id="paletteCount">'+KINDMAP.kinds.length+'/'+KINDMAP.kinds.length+'</span></div>'+kindsByGroup.map((g,i)=>'<details class="palette-group" open><summary>'+esc(g.group)+' <span class="countbadge" data-group-count>'+g.kinds.length+'</span></summary><div class="palette">'+g.kinds.map(buttonFor).join('')+'</div></details>').join('')+'<div class="lefttip">One meaningful object, then options.<br><br>Click = automatic placement.<br>Drag = explicit location and pin.</div><p class="small muted" style="margin-top:15px">The shelf lists all '+KINDMAP.kinds.length+' installed kinds from <code>contracts/kind-ui-map.json</code>, grouped by its palette groups. Profile-filtered specialized shelves remain a specification proposal (<button class="ghost" data-story="library" style="min-height:0;padding:0;font-size:inherit;text-decoration:underline">shelf design</button>).</p>';
 pane.querySelectorAll('[data-add]').forEach(b=>{b.disabled=!(graph()||projectionKind()==='fishbone'||projectionKind()==='decision');b.onclick=()=>addNode(b.dataset.add);b.ondragstart=e=>{e.dataTransfer.setData('application/x-ddn-kind',b.dataset.add);e.dataTransfer.effectAllowed='copy';};});
 $('#paletteSearch').oninput=e=>{const q=e.target.value.toLowerCase();let shown=0;pane.querySelectorAll('[data-add]').forEach(b=>{const hit=!q||b.dataset.search.includes(q);b.hidden=!hit;if(hit)shown++;});pane.querySelectorAll('.palette-group').forEach(d=>{const visible=[...d.querySelectorAll('[data-add]')].filter(b=>!b.hidden);d.open=!!q&&visible.length>0||!q;d.hidden=!!q&&!visible.length;const badge=d.querySelector('[data-group-count]');if(badge)badge.textContent=q?visible.length+'/'+d.querySelectorAll('[data-add]').length:visible.length;});$('#paletteCount').textContent=shown+'/'+KINDMAP.kinds.length;};pane.querySelectorAll('[data-story]').forEach(b=>b.onclick=()=>story(b.dataset.story));
 }else if(left==='model'){
 pane.innerHTML='<div class="row"><span class="tag teal">SHARED DEFINITIONS</span></div><p class="help small muted" style="margin-top:10px">Select a definition. This list is a keyboard alternative to the canvas.</p>'+ir.elements.filter(n=>ir.view.selected.includes(n.id)||!graph()).slice(0,35).map(n=>`<button class="model-item" data-select="${esc(n.id)}">${esc(n.name)} <span class="id">${esc(n.kind)} · ${esc(n.source?.file||'source')}</span></button>`).join('');pane.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>choose(b.dataset.select));
 }else{pane.innerHTML='<div class="tag">ONE WORKSPACE · SHARED SOURCE</div>'+['overview','names','raci','chart_bar','gantt','fishbone','swot','sipoc','journey','decision'].map(v=>`<button class="model-item ${v===view?'active':''}" data-open-view="${v}" style="margin-top:12px">${({overview:'Structure',names:'Compact',raci:'Responsibilities',chart_bar:'Report',gantt:'Schedule',fishbone:'Fishbone',swot:'SWOT panels',sipoc:'SIPOC panels',journey:'Journey panels',decision:'Decision table'})[v]}<span class="id">${v==='overview'||v==='names'?'model.ddn':'projections/views.ddn'}</span></button>`).join('')+'<div class="lefttip">Changing a name edits a definition.<br><br>Changing “show fields” edits the appearance of this view.</div>';pane.querySelectorAll('[data-open-view]').forEach(b=>b.onclick=()=>setView(b.dataset.openView));}
}
function selectControl(id,label,values,current){return `<label for="${id}">${label}</label><select id="${id}">`+values.map(([v,l])=>`<option value="${v}" ${v===current?'selected':''}>${l}</option>`).join('')+'</select>';}
function updateInspector(){const sel=findSelection(),h=$('#selectionHeader'),p=$('#inspectorBody');
 if(sel){h.innerHTML=`<div class="selection-title"><span class="tag">${esc(sel.kind==='field'?'FIELD':sel.kind==='relation'?'RELATIONSHIP':sel.node.kind.toUpperCase())}</span><h2>${esc(sel.name)}</h2><p>${esc(sel.sourceId)}</p></div><div class="scope-banner">Shared definition · ${usage(sel.sourceId)} view(s) in this source entry<br>Edits to meaning affect every occurrence.</div>`;if(sel.kind==='node'){const km=kindEntry(sel.node.kind);if(km)h.innerHTML+='<div class="scope-banner" style="background:#f0f4fa;border-color:#d3deea;color:#33506b">'+esc(km.name)+' · '+esc(km.palette_group)+' · template <code>'+esc(km.inspector_template)+'</code><br>Source: '+esc(km.source)+' registry · profiles hint: '+esc(km.profiles_hint.join(', ')||'—')+'</div>';}}else{h.innerHTML='<div class="selection-title"><span class="tag">VIEW SETTINGS</span><h2>'+esc($('#viewHeading').textContent)+'</h2><p>'+esc(entry+' # '+view)+'</p></div><div class="scope-banner">View configuration · shared data unchanged</div>';}
 if(tab==='view'){
 p.innerHTML='<div class="tag">LOCAL PREVIEW OVERRIDES</div>'+selectControl('lookSetting','Drawing treatment',[['classic','Standard'],['handDrawn','Hand-drawn'],['neo','Neo']],overrides.look||'classic')+selectControl('themeSetting','Palette',[['default','Light'],['night','Night · grey-blue']],overrides.theme||'default');
 if(graph())p.innerHTML+=selectControl('fieldsSetting','Field compartment',[['source','As authored'],['names','Field names'],['none','Name only']],overrides.fields||'source')+selectControl('routeSetting','Connector path',[['source','As authored'],['orthogonal','Right angles'],['curved','Curved'],['straight','Straight'],['rounded','Rounded corners']],overrides.routing||'source')+'<p class="help">A path setting changes geometry, never the meaning or endpoints.</p>';
 else if(!graph()&&!chartProfile())p.innerHTML+='<p class="help">Session preview overrides apply to graph views; data-bound views edit source through their sheet.</p>';
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
 const tp=timelineProfile();
 if(tp){
  let th='<div class="notice">Data-bound projection. A bar is a projection of shared record dates — dragging it is a whole-day date edit with a preview, never a pin. Dates commit through the sheet or the drag gesture; dependencies are view-scope list edits over shared relations.</div><h3>'+esc(tp.profile)+'</h3><label>Bindings</label><div class="subtle">start <code>'+esc(String(tp.start))+'</code> · end <code>'+esc(String(tp.end))+'</code></div>';
  let tplan=null;try{tplan=ws.projectionPlan(entry,view);}catch{}
  if(tplan)th+='<label>Tasks</label><div class="subtle">'+tplan.items.map(i=>esc(i.label)).join(' · ')+'</div><label>Dependencies</label><div class="subtle">'+tplan.dependencies.map(r=>esc(r.name||r.id)).join(' · ')+'</div>';
  th+='<p class="help">Drag a bar horizontally to move both dates in whole days; drag near an edge (or hold Shift for the end edge) to move one date. Escape cancels with no source change. The sheet under the canvas offers the equivalent date controls.</p>';
  p.innerHTML=th+'<button id="projectedSource" class="wide">View source bindings</button>';$('#projectedSource').onclick=openSource;
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
  p.innerHTML=fh+'<button id="projectedSource" class="wide">View source bindings</button>';$('#projectedSource').onclick=openSource;
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
  p.innerHTML=ph+'<button id="projectedSource" class="wide">View source bindings</button>';$('#projectedSource').onclick=openSource;
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
  p.innerHTML=dh+'<button id="projectedSource" class="wide">View source bindings</button>';$('#projectedSource').onclick=openSource;
  return;
 }
 const cp=chartProfile();
 if(cp){  let ch='<div class="notice">Data-bound projection. Moving a mark must not change a number, date, assignment, or scale. Edit the record in the Source sheet; dragging a mark is disabled.</div><h3>'+esc(cp.profile)+' · '+esc(String(cp.mark??'source mark'))+'</h3><label>Bindings</label><div class="subtle">x <code>'+esc(String(cp.x??'—'))+'</code> · y <code>'+esc(String(cp.y??'—'))+'</code> · unit <code>'+esc(String(cp.unit??'—'))+'</code>'+(cp.aggregate?'<br>aggregate <code>'+esc(String(cp.aggregate))+'</code>':'')+'</div>';
  let cplan=null;try{cplan=ws.projectionPlan(entry,view);}catch{}
  const point=cplan&&chartSel?cplan.points.find(pt=>(pt.sourceIds||[]).includes(chartSel)):null;
  if(point){
   const ids=point.sourceIds||[];
   ch+='<label>Selected mark</label><div class="subtle">'+ids.length+' contributing record'+(ids.length>1?'s · aggregate policy '+esc(String(cp.aggregate||'none')):'')+'</div><label>Contributors</label>'+ids.map(id=>'<div class="endpoint-card"><code>'+esc(id)+'</code><br><button data-jump-rec="'+esc(id)+'">Edit row in Source sheet</button></div>').join('')+'<p class="help">An aggregate never becomes an editable synthetic total record; edit the input records.</p>';
  }else ch+='<p class="help">Click a rendered mark to list its contributing records. The Source sheet under the canvas edits record values (shared model), the mark and the x/y/unit bindings (this view).</p>';
  p.innerHTML=ch+'<button id="projectedSource" class="wide">View source bindings</button>';$('#projectedSource').onclick=openSource;
  p.querySelectorAll('[data-jump-rec]').forEach(b=>b.onclick=()=>{chartSel=b.dataset.jumpRec;renderChartSheet();$('#chartSheet')?.scrollIntoView({block:'nearest'});$('#chartSheet [data-recrow="'+CSS.escape(chartSel)+'"]')?.scrollIntoView({block:'nearest'});});
  return;
 }
 p.innerHTML='<div class="notice">Data-bound projection. Moving a mark must not change a number, date, assignment, or scale.</div>'+'<h3>Supplied values</h3><label>Source</label><div class="subtle">m.facts · six synthetic records</div><label>Category</label><div class="subtle">x_record.month</div><label>Value</label><div class="subtle">x_record.value · CAD</div><p class="help">Binding edits for this projection are view-scope source writes in its sheet.</p>'+'<button id="projectedSource" class="wide">View source bindings</button>';$('#projectedSource').onclick=openSource;return;
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
  if(id)choose(id);if(!el||member||mode!=='select')return;const n=result.scene.nodes.find(n=>n.id===el.dataset.id);if(!n)return;const point=worldPoint(e);drag={el,id:n.id,x:n.x,y:n.y,start:point,pointer:e.pointerId,moved:false};el.setPointerCapture(e.pointerId);
 };
 $('#paper').onpointermove=e=>{
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
  if(dragGuard&&e.pointerId===dragGuard.pointer)dragGuard=null;if(!drag)return;const d=drag;drag=null;try{d.el.releasePointerCapture(e.pointerId);}catch{}if(d.moved)transaction('Move and pin '+sourceLabel(d.id),t=>A.pin(t,entry,view,d.id,d.x+d.dx,d.y+d.dy));};
 $('#paper').onpointercancel=()=>{cancelTimelineDrag();dragGuard=null;if(drag){drag.el.removeAttribute('transform');drag=null;announce('Move cancelled; source unchanged.');}};
 $('#paper').onclick=e=>{if(!graph()){const m=e.target.closest('[data-id],[data-source]');if(m){const id=m.getAttribute('data-id')||m.getAttribute('data-source');if(id){selected=id;if(chartProfile()){chartSel=id;renderChartSheet();}if(fishboneProfile())renderFishboneSheet();if(panelsProfile()){panelsSel=id;renderPanelsSheet();}if(decisionProfile())renderDecisionSheet();updateInspector();announce(chartProfile()?'Source-bound mark selected — contributors listed in the Source sheet.':fishboneProfile()?'Rib selected — its row is highlighted in the Fishbone sheet; repeated causes show every occurrence path.':panelsProfile()?'Item selected — its chip is highlighted in the Panels sheet; item notes are shared definitions.':decisionProfile()?'Rule selected — its row is highlighted in the Decision sheet; conditions and outcomes are shared-model edits.':'Source-bound mark selected. Binding editor is specified; source is inspectable.');}}}};
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
window.addEventListener('keydown',e=>{if(e.key==='Escape'){cancelTimelineDrag();connectFrom=null;mode='select';if(drag){drag.el.removeAttribute('transform');drag=null;}$('#connectTool').classList.remove('active');$('#selectTool').classList.add('active');}if(e.target.matches('input,textarea,select'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?ws.redo():ws.undo();draw();}if(e.key==='Delete'&&graph()&&findSelection()?.kind==='node')$('#hideSelected')?.click();});
window.DesignerPrototype={workspace:ws,getState:()=>({entry,view,selected,tab,result,commands:actualCommands,overrides}),select:choose,setView,story,draw,transaction};
draw();
})();
