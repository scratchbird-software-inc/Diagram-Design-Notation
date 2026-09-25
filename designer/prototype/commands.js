/* Deprecated (B1-051): retired review prototype. The designer is now the unified
 * diagram tool in design mode (/tools/index.html?mode=design). These sources are
 * kept for history and the regression suite — do not extend. */
/* SPDX-License-Identifier: GPL-2.0-or-later. Designer command layer: staged
 * source transactions shared by the prototype and the Node test suites.
 * Each command runs on a scratch workspace, validates, then commits one
 * applyEdits against the caller's expected revision. No dependencies.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DesignerCommands=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
// ED-010 severity classification (spec ch.12, contracts/change-plan diagnostics;
// ADR-07: draft issues are separately typed, never suppressed). Profile
// completeness codes are draft-scope 'incomplete' under policy 'design'; under
// policy 'review' the same codes report as 'error'. Everything else is always
// 'error'. No code is ever dropped. Verified against the runtime:
// DDN-PF007/008/009/010 (ddn-profiles.js), DDN-PJ016 (ddn-projection-data.js),
// DDN-QD004/005/008 (ddn-quality-data.js), DDN-QL001…007 (lifecycle).
const INCOMPLETE_CODE_PREFIXES=['DDN-PF','DDN-QD0','DDN-QL'];
const INCOMPLETE_CODES=['DDN-PJ016'];
function classifyCode(code,policy){
 const c=String(code||'');
 if(INCOMPLETE_CODES.includes(c)||INCOMPLETE_CODE_PREFIXES.some(p=>c.startsWith(p)))
  return policy==='review'?'error':'incomplete';
 return 'error';
}
// Analysis failures a decision-table draft may carry (VE-007): the commit
// stands, the committed re-render surfaces the runtime's own error. ED-010
// generalizes the same draft-commit rule to every code the classifier types
// 'incomplete' under policy 'design' (DDN-QD004/005/008 are the DDN-QD0 prefix;
// DDN-PF008 start-before-end commits the same way for VE-AC-006).
function stage(D,ws,entry,view,fn,mode){
 const before=ws.getFiles(),revision=ws.revision,t=D.createWorkspace(before);
 try{
  const value=fn(t);
  const after=t.getFiles();
  const edits=Object.keys(after).filter(f=>before[f]!==after[f]).map(f=>({file:f,start:0,end:(before[f]||'').length,text:after[f]}));
  if(edits.length){
   if(mode==='tolerant'){
    try{ws.applyEdits(edits,{expectedRevision:revision,entry,view});}
    catch(e){
     if(classifyCode(e.code,'design')!=='incomplete')throw e;
     // Draft commit (VE-007): parse-only validation; the completeness error
     // stays visible in the committed re-render and publish stays blocked.
     ws.applyEdits(edits,{expectedRevision:revision});
    }
   }else ws.applyEdits(edits,{expectedRevision:revision,entry,view});
  }
  return value;
 }finally{t.destroy();}
}
// Kinds whose validators require properties at creation time (found empirically:
// a bare `kind` declaration does not validate). Defaults are explicit, visible
// source values, never silent rewrites.
const CREATION_DEFAULTS={
 'req.requirement':id=>({x_diagram:{code:String(id).toUpperCase().replace(/[^A-Z0-9]+/g,'_'),text:'Undecided requirement statement'}}),
};
// B1-002 (D3): registry element defaults merge BEFORE the explicit properties
// channel; explicit values win. Defaults are written into the source by the
// setProperty loop below, never applied silently at render time.
function creationProperties(D,kind,id,explicit){
 const base=D.defaults&&typeof D.defaults.forKind==='function'?D.defaults.forKind(kind):{};
 return{...base,...(explicit||CREATION_DEFAULTS[kind]?.(id)||{})};
}
function createInView(D,ws,entry,view,args,mode){
 const {id,name,kind,at,properties}=args||{};
 const initial=creationProperties(D,kind,id,properties);
 return stage(D,ws,entry,view,t=>{
  D.authoring.addElement(t,entry,view,{id,name,kind:Object.keys(initial).length?'object':kind});
  const n=t.resolve(entry,view).elements.find(n=>n.local===id);
  if(!n)fail('DDN-I033','Created element not found in the resolved view.');
  if(Object.keys(initial).length){for(const [k,v]of Object.entries(initial))D.authoring.setProperty(t,entry,view,n.id,k,v);D.authoring.setProperty(t,entry,view,n.id,'kind',kind);}
  if(at)D.authoring.pin(t,entry,view,n.id,at.x,at.y);
  return{select:n.id};
 },mode);
}
const PROJECTION_PROPERTY_KEYS=['mark','records','dependencies','x','y','unit','x_type','aggregate','missing','series','panels','hit_policy','coverage','analysis_budget'];
function editProjectionProperty(D,ws,entry,view,args,mode){
 const {key,value}=args||{};
 if(!PROJECTION_PROPERTY_KEYS.includes(key))fail('DDN-D001','Unknown or unsupported projection property key: '+String(key));
 return stage(D,ws,entry,view,t=>{
  const ir=t.resolve(entry,view),span=ir.view.source;
  if(!span||span.bodyEnd===undefined)fail('DDN-I033','The active view declaration has no editable source span.');
  const text=t.getFiles()[span.file];
  const tokens=D.lex(text,span.file).filter(x=>x.start>=span.start&&x.end<=span.end);
  let open=-1;
  for(let i=0;i<tokens.length;i++)if(tokens[i].type==='id'&&tokens[i].value==='projection'&&tokens[i+1]?.type==='{'){open=i+1;break;}
  if(open<0)fail('DDN-I033','The active view declares no projection { } group.');
  let depth=1,close=-1;
  for(let i=open+1;i<tokens.length;i++){if(tokens[i].type==='{')depth++;if(tokens[i].type==='}'){depth--;if(!depth){close=i;break;}}}
  if(close<0)fail('DDN-I033','The projection group is not closed in source.');
  const removing=value===undefined;
  const render=removing?'':key+': '+D.authoring.value(value)+';';
  let edit=null;
  for(let i=open+1,d=1;i<close;i++){
   const tok=tokens[i];
   if(tok.type==='{'||tok.type==='[')d++;
   if(tok.type==='}'||tok.type===']')d--;
   if(d===1&&tok.type==='id'&&tok.value===key&&tokens[i+1]?.type===':'){
    let j=i+2,d2=1;
    while(j<close){if(tokens[j].type==='{'||tokens[j].type==='[')d2++;if(tokens[j].type==='}'||tokens[j].type===']')d2--;if(tokens[j].type===';'&&d2===1)break;j++;}
    if(j>=close)fail('DDN-I033','The existing projection property is not terminated.');
    edit={file:span.file,start:tok.start,end:tokens[j].end,text:render};break;
   }
  }
  if(!edit){if(removing)return{key,removed:false};edit={file:span.file,start:tokens[close].start,end:tokens[close].start,text:render+' '};}
  if(mode==='tolerant'){
   try{t.applyEdits([edit],{expectedRevision:t.revision,entry,view});}
   catch(e){if(classifyCode(e.code,'design')!=='incomplete')throw e;t.applyEdits([edit],{expectedRevision:t.revision});}
  }else t.applyEdits([edit],{expectedRevision:t.revision,entry,view});
  return{key,...(removing?{removed:true}:{})};
 },mode);
}
function applyCreationAction(D,ws,entry,view,args){
 const {mapEntry,id,name,at,selectedId,projectionKind,fieldId}=args||{};
 if(!mapEntry||!mapEntry.kind)fail('DDN-I033','No UI-map descriptor for this kind.');
 const kind=mapEntry.kind,action=mapEntry.creation_action,label=name||('New '+mapEntry.name);
 if(action==='create-semantic-element')return createInView(D,ws,entry,view,{id,name:label,kind,at});
 if(action==='add-cause-under-parent'){
  if(projectionKind!=='fishbone')return createInView(D,ws,entry,view,{id,name:label,kind,at});
  return stage(D,ws,entry,view,t=>{
   const ir=t.resolve(entry,view),sel=ir.elements.find(e=>e.id===selectedId);
   let parentId=null;
   if(kind==='quality.category')parentId=sel&&['quality.category','quality.cause'].includes(sel.kind)?sel.id:ir.elements.find(e=>e.kind==='quality.effect')?.id||null;
   else if(sel&&['quality.category','quality.cause'].includes(sel.kind))parentId=sel.id;
   if(!parentId)fail('DDN-I033','Select a cause category, a contributing cause, or the effect before adding '+mapEntry.name+'; the fishbone needs a parent. Nothing was changed.');
   const made=createInView(D,t,entry,view,{id,name:label,kind,at});
   D.authoring.addRelation(t,entry,view,{id:id+'_link',name:kind==='quality.category'?'Possible cause category':'Possible contributing cause',kind:'quality.cause',from:made.select,to:parentId});
   return{select:made.select};
  });
 }
 if(action==='add-rule-in-decision-editor'){
  return stage(D,ws,entry,view,t=>{
   const made=createInView(D,t,entry,view,{id,name:label,kind,at});
   if(projectionKind==='decision'){
    const proj=t.resolve(entry,view).view.profiles.projection||{};
    const then={};for(const o of proj.outputs||[])then[o]='undecided';
    D.authoring.setProperty(t,entry,view,made.select,'x_rule',{when:{},then});
    const current=(proj.records||[]).map(r=>r?.$ref?.includes('::')?{$ref:r.$ref.split('::')[1]}:r);
    editProjectionProperty(D,t,entry,view,{key:'records',value:[...current,{$ref:'editor_data.'+id}]});
   }
   return{select:made.select};
  });
 }
 if(action==='edit-projection-source-not-free-node'){
  if(kind==='chen.attribute'){
   if(!selectedId)fail('DDN-I033','A Chen attribute is a field of its entity, never a free-floating node: select the owning entity first. Nothing was changed.');
   const fid=fieldId||id;
   if(!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(fid))fail('DDN-I033','The attribute field identifier is not a valid DDN identifier. Nothing was changed.');
   return stage(D,ws,entry,view,t=>{D.authoring.addField(t,entry,view,selectedId,{id:fid,name:mapEntry.name});return{select:selectedId};});
  }
  if(kind==='chen.association'){
   if(!selectedId)fail('DDN-I033','A Chen relationship is created through the Connect flow: select the entity it starts from first. Nothing was changed.');
   return{connect:{from:selectedId,preset:'assoc'}};
  }
 }
 fail('DDN-I033','Unsupported creation action '+String(action)+' for kind '+kind+'.');
}
// Profile cell alphabets, checked before delegation so the UI can disable
// illegal keys on the click path. Rule violations below this level (duplicate
// cells, joined cells, RACI/CRUD row rules) surface the runtime's own codes.
const MATRIX_ALPHABETS={
 'matrix.raci@1':v=>['R','A','C','I'].includes(v),
 'matrix.crud@1':v=>typeof v==='string'&&/^[CRUD]+$/.test(v)&&new Set(v).size===v.length,
};
function setMatrixAssignments(D,ws,entry,view,args,mode){
 const changes=(args||{}).changes;
 if(!Array.isArray(changes)||!changes.length||changes.length>100)fail('DDN-E007','Matrix changes need a matrix view and 1..100 cell operations');
 const p=ws.resolve(entry,view).view.profiles.projection||{};
 if(p.kind!=='matrix')fail('DDN-E007','Matrix changes need a matrix view and 1..100 cell operations');
 const alphabet=MATRIX_ALPHABETS[p.profile];
 for(const c of changes){
  if(!c||typeof c!=='object'||Array.isArray(c))fail('DDN-E007','Invalid matrix operation');
  if(!c.remove&&alphabet&&!alphabet(c.value))fail('DDN-I033','Value '+JSON.stringify(c.value)+' is outside the '+p.profile+' cell alphabet. Nothing was changed.');
 }
 return stage(D,ws,entry,view,t=>{
  D.authoring.setMatrixCells(t,entry,view,changes.map(c=>({row:c.rowId,column:c.columnId,...(c.remove?{remove:true}:{value:c.value}),...(c.id?{id:c.id}:{})})));
  return{changes:changes.length};
 },mode);
}
// Chart editor commands (ED-003). Record edits are shared-model writes through
// D.authoring; mark/binding edits are view-scope writes into the projection { }
// group through editProjectionProperty. Numbers are never coerced from strings.
function chartProjection(D,ws,entry,view){
 const p=ws.resolve(entry,view).view.profiles.projection||{};
 if(p.kind!=='chart')fail('DDN-E006','Chart editing needs a chart projection');
 return p;
}
// Resolved refs arrive module-qualified ('module::path'); the projection group
// needs the entry file's source form (import-alias path, or bare local path).
function sourceRef(ws,entry,uid){
 if(!String(uid).includes('::'))return uid;
 const [mod,path]=String(uid).split('::');
 const files=ws.getFiles(),entryText=files[entry]||'';
 const entryMod=(entryText.match(/module\s+"([^"]+)"/)||[])[1];
 if(mod===entryMod)return path;
 const dir=entry.includes('/')?entry.slice(0,entry.lastIndexOf('/')+1):'';
 for(const m of entryText.matchAll(/import\s+"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_-]*)/g)){
  const txt=files[dir+m[1].replace(/^\.\//,'')];
  if(txt&&(txt.match(/module\s+"([^"]+)"/)||[])[1]===mod)return m[2]+'.'+path;
 }
 fail('DDN-E003','The edited source does not import the target definition. Add the required import explicitly.');
}
function sourceRecords(ws,entry,records){
 return (records||[]).map(r=>r?.$ref?{$ref:sourceRef(ws,entry,r.$ref)}:r);
}
function editRecordValue(D,ws,entry,view,args){
 const {id,key,value}=args||{};
 if(typeof key!=='string'||!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key))fail('DDN-E001','Use a valid, nonreserved DDN identifier.');
 const el=ws.resolve(entry,view).elements.find(n=>n.id===id);
 if(!el)fail('DDN-E002','Definition not found.');
 const current=el.properties.x_record;
 if(!current||typeof current!=='object')fail('DDN-E006','Selected object has no x_record value record');
 if(current[key]!==undefined&&typeof current[key]!==typeof value)fail('DDN-I033','Record key '+JSON.stringify(key)+' holds '+typeof current[key]+' data; numeric strings are not coerced. Nothing was changed.');
 if(typeof value==='number'&&!Number.isFinite(value))fail('DDN-E007','Cell value must be a finite scalar');
 return stage(D,ws,entry,view,t=>{D.authoring.setRecordValue(t,entry,view,id,key,value);return{id,key};});
}
function addChartRecord(D,ws,entry,view,args){
 const {id,name}=args||{};
 const p=chartProjection(D,ws,entry,view);
 const ir=ws.resolve(entry,view);
 const bound=(p.records||[]).map(r=>ir.elements.find(n=>n.id===r.$ref)).filter(Boolean);
 const first=bound.find(n=>n.properties.x_record&&typeof n.properties.x_record==='object');
 if(!first)fail('DDN-I033','No bound record with an x_record object to clone the key set from. Nothing was changed.');
 const skeleton={};
 for(const [k,v]of Object.entries(first.properties.x_record))skeleton[k]=k==='unit'?v:typeof v==='number'?0:'';
 return stage(D,ws,entry,view,t=>{
  D.authoring.addElement(t,entry,view,{id,name:name||id,kind:'record'});
  const n=t.resolve(entry,view).elements.find(e=>e.local===id);
  if(!n)fail('DDN-I033','Created record not found in the resolved view.');
  D.authoring.setProperty(t,entry,view,n.id,'x_record',skeleton);
  const current=sourceRecords(ws,entry,p.records);
  editProjectionProperty(D,t,entry,view,{key:'records',value:[...current,{$ref:'editor_data.'+id}]});
  return{select:n.id};
 });
}
function deleteChartRecord(D,ws,entry,view,args){
 const {id}=args||{};
 const p=chartProjection(D,ws,entry,view);
 return stage(D,ws,entry,view,t=>{
  const current=sourceRecords(ws,entry,p.records);
  const local=sourceRef(ws,entry,id);
  const kept=current.filter(r=>String(r.$ref)!==local);
  if(kept.length!==current.length)editProjectionProperty(D,t,entry,view,{key:'records',value:kept});
  D.authoring.deleteDefinition(t,entry,view,id);
  return{id};
 });
}
function setChartMark(D,ws,entry,view,args){
 const {mark}=args||{};
 chartProjection(D,ws,entry,view);
 const legal=ws.inspect(entry,view).capabilities.marks.filter(m=>m!=='source');
 if(!legal.includes(mark))fail('DDN-I033','Mark '+JSON.stringify(mark)+' is outside this profile’s legal set ('+legal.join(', ')+'). Nothing was changed.');
 return editProjectionProperty(D,ws,entry,view,{key:'mark',value:mark});
}
const CHART_BINDING_KEYS=['x','y','unit','x_type','aggregate','missing','series'];
function setChartBinding(D,ws,entry,view,args){
 const {key,value,remove}=args||{};
 if(!CHART_BINDING_KEYS.includes(key))fail('DDN-D001','Unknown or unsupported projection property key: '+String(key));
 chartProjection(D,ws,entry,view);
 return editProjectionProperty(D,ws,entry,view,{key,value:remove?undefined:value});
}
// Timeline editor commands (ED-004). Date writes are shared-model edits through
// D.authoring.setRecordValue; the dependency list is a view-scope projection edit.
// Dates mirror the runtime date() helper (ddn-projection-data.js): real ISO
// YYYY-MM-DD, end >= start (equal is a legal milestone). The scratch re-plan lets
// DDN-PJ040/041/042/043 reject before any real commit.
function timelineProjection(D,ws,entry,view){
 const p=ws.resolve(entry,view).view.profiles.projection||{};
 if(p.kind!=='timeline')fail('DDN-E006','Timeline editing needs a timeline projection');
 return p;
}
// Shape + real-calendar check identical to the runtime helper; no Date-object coercion of the value.
const timelineDateOK=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const t=Date.parse(s+'T00:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===s;};
function timelineCheckDates(start,end){
 for(const [k,v]of [['start',start],['end',end]])if(!timelineDateOK(v))fail('DDN-I033','Timeline dates need a real ISO YYYY-MM-DD value; got '+JSON.stringify(v)+' for '+k+'. Nothing was changed.');
 if(end<start)fail('DDN-I033','Timeline end must be on or after start (equal dates are a legal zero-length milestone). Nothing was changed.');
}
function timelineKeys(p){return{start:String(p.start||'x_record.start').split('.').at(-1),end:String(p.end||'x_record.end').split('.').at(-1)};}
function setTimelineDates(D,ws,entry,view,args){
 const {recordId,start,end}=args||{};
 const p=timelineProjection(D,ws,entry,view),keys=timelineKeys(p);
 const el=ws.resolve(entry,view).elements.find(n=>n.id===recordId);
 if(!el)fail('DDN-E002','Definition not found.');
 const current=el.properties.x_record;
 if(!current||typeof current!=='object')fail('DDN-E006','Selected object has no x_record value record');
 const nextStart=start!==undefined?start:current[keys.start],nextEnd=end!==undefined?end:current[keys.end];
 timelineCheckDates(nextStart,nextEnd);
 return stage(D,ws,entry,view,t=>{
  // A two-key change commits as one merged x_record write: sequential single-key
  // writes can pass through an intermediate end < start state that the commit-time
  // re-validation (correctly) refuses.
  if(start!==undefined&&end!==undefined)D.authoring.setProperty(t,entry,view,recordId,'x_record',{...current,[keys.start]:start,[keys.end]:end});
  else if(start!==undefined)D.authoring.setRecordValue(t,entry,view,recordId,keys.start,start);
  else D.authoring.setRecordValue(t,entry,view,recordId,keys.end,end);
  t.projectionPlan(entry,view);
  return{select:recordId};
 });
}
function addTimelineRecord(D,ws,entry,view,args){
 const {id,label,start,end}=args||{};
 const p=timelineProjection(D,ws,entry,view),keys=timelineKeys(p);
 timelineCheckDates(start,end);
 return stage(D,ws,entry,view,t=>{
  D.authoring.addElement(t,entry,view,{id,name:label||id,kind:'record'});
  const n=t.resolve(entry,view).elements.find(e=>e.local===id);
  if(!n)fail('DDN-I033','Created record not found in the resolved view.');
  D.authoring.setProperty(t,entry,view,n.id,'x_record',{[keys.start]:start,[keys.end]:end});
  const current=sourceRecords(ws,entry,p.records);
  editProjectionProperty(D,t,entry,view,{key:'records',value:[...current,{$ref:'editor_data.'+id}]});
  t.projectionPlan(entry,view);
  return{select:n.id};
 });
}
function linkTimelineDependency(D,ws,entry,view,args){
 const {id,label,fromId,toId}=args||{};
 const p=timelineProjection(D,ws,entry,view);
 if(!fromId||!toId||fromId===toId)fail('DDN-I033','A timeline dependency links two different timeline records. Nothing was changed.');
 return stage(D,ws,entry,view,t=>{
  D.authoring.addRelation(t,entry,view,{id,name:label||id,kind:'analysis.precedes',from:fromId,to:toId});
  const current=sourceRecords(ws,entry,p.dependencies);
  editProjectionProperty(D,t,entry,view,{key:'dependencies',value:[...current,{$ref:'editor_data.'+id}]});
  t.projectionPlan(entry,view);
  return{select:id};
 });
}
function unlinkTimelineDependency(D,ws,entry,view,args){
 const {relationId,deleteDefinition}=args||{};
 const p=timelineProjection(D,ws,entry,view);
 return stage(D,ws,entry,view,t=>{
  const current=sourceRecords(ws,entry,p.dependencies),local=sourceRef(ws,entry,relationId);
  const kept=current.filter(r=>String(r.$ref)!==local);
  if(kept.length===current.length)fail('DDN-I033','Relation '+String(relationId)+' is not in this view’s dependency list. Nothing was changed.');
  editProjectionProperty(D,t,entry,view,{key:'dependencies',value:kept.length?kept:undefined});
  if(deleteDefinition)D.authoring.deleteDefinition(t,entry,view,relationId);
  t.projectionPlan(entry,view);
  return{relationId,deleted:!!deleteDefinition};
 });
}
// Fishbone editor commands (ED-005). Every rib is a relation of the view's own
// p.relation verb between real definitions — never a free-floating shape. Attach
// creates only a relation, so a reused cause keeps one semantic identity with
// distinct runtime occurrence paths (VE-AC-057). The scratch re-plan lets the
// runtime's own DDN-QF001/002/003/004 codes reject before any real commit.
function fishboneProjection(D,ws,entry,view){
 const p=ws.resolve(entry,view).view.profiles.projection||{};
 if(p.kind!=='fishbone')fail('DDN-E006','Fishbone editing needs a fishbone projection');
 if(typeof p.relation!=='string'||!p.relation)fail('DDN-QF001','Fishbone requires a named cause-to-parent relation');
 return p;
}
function fishboneParent(D,ws,entry,view,parentId){
 const el=ws.resolve(entry,view).elements.find(n=>n.id===parentId);
 if(!el)fail('DDN-E002','Definition not found.');
 if(!['quality.effect','quality.category','quality.cause'].includes(el.kind))fail('DDN-I033','A fishbone rib attaches under the effect, a cause category, or a contributing cause — never under a '+el.kind+'. Nothing was changed.');
 return el;
}
function setFishboneEffectLabel(D,ws,entry,view,args){
 const {label}=args||{};
 fishboneProjection(D,ws,entry,view);
 const plan=ws.projectionPlan(entry,view);
 return stage(D,ws,entry,view,t=>{
  D.authoring.setLabel(t,entry,view,plan.effect.id,label);
  t.projectionPlan(entry,view);
  return{select:plan.effect.id};
 });
}
function addFishboneCategory(D,ws,entry,view,args){
 const {id,label}=args||{};
 const p=fishboneProjection(D,ws,entry,view);
 const plan=ws.projectionPlan(entry,view);
 if(plan.categories.length>=12)fail('DDN-QF003','Fishbone needs 1..12 root categories');
 return stage(D,ws,entry,view,t=>{
  D.authoring.addElement(t,entry,view,{id,name:label||id,kind:'quality.category'});
  const n=t.resolve(entry,view).elements.find(e=>e.local===id);
  if(!n)fail('DDN-I033','Created category not found in the resolved view.');
  D.authoring.addRelation(t,entry,view,{id:id+'_to_effect',name:'Possible cause category',kind:p.relation,from:n.id,to:plan.effect.id});
  const next=t.projectionPlan(entry,view);
  if(next.categories.length>12)fail('DDN-QF003','Fishbone needs 1..12 root categories');
  return{select:n.id};
 });
}
function addFishboneCause(D,ws,entry,view,args){
 const {id,label,parentId}=args||{};
 const p=fishboneProjection(D,ws,entry,view);
 fishboneParent(D,ws,entry,view,parentId);
 return stage(D,ws,entry,view,t=>{
  D.authoring.addElement(t,entry,view,{id,name:label||id,kind:'quality.cause'});
  const n=t.resolve(entry,view).elements.find(e=>e.local===id);
  if(!n)fail('DDN-I033','Created cause not found in the resolved view.');
  D.authoring.addRelation(t,entry,view,{id:'c_'+id,name:'Possible contributing cause',kind:p.relation,from:n.id,to:parentId});
  t.projectionPlan(entry,view);
  return{select:n.id};
 });
}
function attachExistingCause(D,ws,entry,view,args){
 const {causeId,parentId,relationId}=args||{};
 const p=fishboneProjection(D,ws,entry,view);
 const el=ws.resolve(entry,view).elements.find(n=>n.id===causeId);
 if(!el)fail('DDN-E002','Definition not found.');
 if(!['quality.cause','quality.category'].includes(el.kind))fail('DDN-I033','Only an existing cause or category definition can be attached to a second branch — reuse never clones the definition. Nothing was changed.');
 fishboneParent(D,ws,entry,view,parentId);
 if(causeId===parentId)fail('DDN-I033','A rib cannot attach a definition to itself. Nothing was changed.');
 const rid=relationId||('attach_'+String(causeId).split('::').pop().replace(/[^A-Za-z0-9_]+/g,'_'));
 return stage(D,ws,entry,view,t=>{
  D.authoring.addRelation(t,entry,view,{id:rid,name:'Same cause, second appearance',kind:p.relation,from:causeId,to:parentId});
  t.projectionPlan(entry,view);
  return{select:causeId};
 });
}
function removeFishboneCause(D,ws,entry,view,args){
 const {relationId}=args||{};
 fishboneProjection(D,ws,entry,view);
 const plan=ws.projectionPlan(entry,view);
 const ribs=[];(function walk(n){for(const c of n.children||[]){ribs.push(c.relationId);walk(c);}})({children:plan.categories});
 if(!ribs.includes(relationId))fail('DDN-I033','Relation '+String(relationId)+' is not a rib of this fishbone. Nothing was changed.');
 return stage(D,ws,entry,view,t=>{
  D.authoring.deleteDefinition(t,entry,view,relationId);
  t.projectionPlan(entry,view);
  return{relationId};
 });
}
// Panels editor commands (ED-006). setPanels is the single write path: the
// candidate array is validated (keys, id/title, integer spans inside columns,
// no overlaps), serialized through D.authoring.value, and written as the whole
// projection.panels property; the commit-time workspace validation plus the
// scratch re-plan then let the runtime's own DDN-PJ020/021/PJ009/QP001/002/003
// and canvas DDN-PJ080/081/083 codes reject before any real commit. Empty item
// lists stay strict DDN-PJ009 (landed guards: notation/tests/pyramid.js,
// canvas-pack-a/b, empathy-scorecard), so a move that would empty its source
// panel and a panel added without an initial item are refused, coded, before
// commit. Item definitions are shared-model writes through
// D.authoring.addElement (destination: the view's editor_data block — the
// AUD-002 M2 limitation documented by ED-001).
function panelsProjection(D,ws,entry,view){
 const p=ws.resolve(entry,view).view.profiles.projection||{};
 if(p.kind!=='panels')fail('DDN-E006','Panels editing needs a panels projection');
 return p;
}
const PANEL_KEYS=['id','title','row','column','rowspan','colspan','items','view'];
const refOf=x=>typeof x==='string'?x:x?.$ref;
function checkPanelCandidate(p,candidate){
 if(!Array.isArray(candidate)||!candidate.length||candidate.length>80)fail('DDN-PJ020','Panels need 1..12 columns and 1..80 panels');
 const used=new Set(),ids=new Set();
 for(const v of candidate){
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!PANEL_KEYS.includes(k)))fail('DDN-PJ020','Invalid panel grid span/ID');
  const rs=v.rowspan??1,cs=v.colspan??1;
  if(!v.id||ids.has(v.id)||typeof v.title!=='string'||![v.row,v.column,rs,cs].every(Number.isInteger)||v.row<0||v.row>100||v.column<0||rs<1||cs<1||v.row+rs>101||v.column+cs>p.columns)fail('DDN-PJ020','Invalid panel grid span/ID');
  ids.add(v.id);
  for(let y=v.row;y<v.row+rs;y++)for(let x=v.column;x<v.column+cs;x++){const key=y+':'+x;if(used.has(key))fail('DDN-PJ021','Overlapping panel spans');used.add(key);}
  if(v.view&&v.items)fail('DDN-QP001','A child-view panel requires panels.composed@1 and cannot also contain items');
 }
}
function writePanels(D,t,ws,entry,view,candidate){
 const p=panelsProjection(D,t,entry,view);
 checkPanelCandidate(p,candidate);
 const value=candidate.map(v=>{
  const out={id:String(v.id),title:v.title,row:v.row,column:v.column,rowspan:v.rowspan??1,colspan:v.colspan??1};
  if(v.view!==undefined)out.view={$ref:sourceRef(ws,entry,refOf(v.view))};
  else out.items=(v.items||[]).map(r=>({$ref:sourceRef(ws,entry,refOf(r))}));
  return out;
 });
 editProjectionProperty(D,t,entry,view,{key:'panels',value});
 t.projectionPlan(entry,view);
}
function currentPanels(D,ws,entry,view){return panelsProjection(D,ws,entry,view).panels.map(v=>({...v}));}
function setPanels(D,ws,entry,view,args){
 const candidate=(args||{}).panels;
 panelsProjection(D,ws,entry,view);
 checkPanelCandidate(ws.resolve(entry,view).view.profiles.projection,candidate);
 return stage(D,ws,entry,view,t=>{writePanels(D,t,ws,entry,view,candidate);return{panels:candidate.length};});
}
function renamePanel(D,ws,entry,view,args){
 const {panelId,title}=args||{};
 const panels=currentPanels(D,ws,entry,view);
 if(!panels.some(v=>v.id===panelId))fail('DDN-I033','Panel '+String(panelId)+' is not declared in this view. Nothing was changed.');
 if(typeof title!=='string'||!title)fail('DDN-I033','A panel title is a non-empty string. Nothing was changed.');
 return setPanels(D,ws,entry,view,{panels:panels.map(v=>v.id===panelId?{...v,title}:v)});
}
function movePanelSpan(D,ws,entry,view,args){
 const {panelId,row,column,rowspan,colspan}=args||{};
 const panels=currentPanels(D,ws,entry,view);
 if(!panels.some(v=>v.id===panelId))fail('DDN-I033','Panel '+String(panelId)+' is not declared in this view. Nothing was changed.');
 return setPanels(D,ws,entry,view,{panels:panels.map(v=>v.id===panelId?{...v,row,column,...(rowspan!==undefined?{rowspan}:{}),...(colspan!==undefined?{colspan}:{})}:v)});
}
function addPanel(D,ws,entry,view,args){
 const {id,title,row,column,rowspan,colspan,items}=args||{};
 const panels=currentPanels(D,ws,entry,view);
 if(panels.some(v=>v.id===id))fail('DDN-PJ020','Invalid panel grid span/ID');
 return setPanels(D,ws,entry,view,{panels:[...panels,{id,title:title||String(id),row,column,...(rowspan!==undefined?{rowspan}:{}),...(colspan!==undefined?{colspan}:{}),items:items||[]}]});
}
function removePanel(D,ws,entry,view,args){
 const {panelId}=args||{};
 const panels=currentPanels(D,ws,entry,view);
 if(!panels.some(v=>v.id===panelId))fail('DDN-I033','Panel '+String(panelId)+' is not declared in this view. Nothing was changed.');
 return setPanels(D,ws,entry,view,{panels:panels.filter(v=>v.id!==panelId)});
}
function movePanelItem(D,ws,entry,view,args){
 const {itemId,fromPanelId,toPanelId,beforeId}=args||{};
 const panels=currentPanels(D,ws,entry,view);
 const from=panels.find(v=>v.id===fromPanelId),to=panels.find(v=>v.id===toPanelId);
 if(!from||!to)fail('DDN-I033','Both the source and the target panel must be declared in this view. Nothing was changed.');
 if(to.view!==undefined)fail('DDN-QP001','A child-view panel requires panels.composed@1 and cannot also contain items');
 const fromItems=(from.items||[]).map(refOf);
 if(!fromItems.includes(itemId))fail('DDN-I033','Item '+String(itemId)+' is not in panel '+String(fromPanelId)+'. Nothing was changed.');
 const toItems=(to.items||[]).map(refOf).filter(x=>x!==itemId);
 const at=beforeId!==undefined?toItems.indexOf(beforeId):-1;
 toItems.splice(at<0?toItems.length:at,0,itemId);
 return setPanels(D,ws,entry,view,{panels:panels.map(v=>v.id===fromPanelId?{...v,items:fromItems.filter(x=>x!==itemId)}:v.id===toPanelId?{...v,items:toItems}:v)});
}
function addPanelItem(D,ws,entry,view,args){
 const {panelId,id,label,description}=args||{};
 const panels=currentPanels(D,ws,entry,view);
 const panel=panels.find(v=>v.id===panelId);
 if(!panel)fail('DDN-I033','Panel '+String(panelId)+' is not declared in this view. Nothing was changed.');
 if(panel.view!==undefined)fail('DDN-QP001','A child-view panel requires panels.composed@1 and cannot also contain items');
 return stage(D,ws,entry,view,t=>{
  D.authoring.addElement(t,entry,view,{id,name:label||id,kind:'note'});
  const n=t.resolve(entry,view).elements.find(e=>e.local===id);
  if(!n)fail('DDN-I033','Created note not found in the resolved view.');
  if(description!==undefined)D.authoring.setProperty(t,entry,view,n.id,'description',description);
  writePanels(D,t,ws,entry,view,panels.map(v=>v.id===panelId?{...v,items:[...(v.items||[]).map(refOf),n.id]}:v));
  return{select:n.id};
 });
}
function bindPanelChildView(D,ws,entry,view,args){
 const {panelId,childViewId}=args||{};
 const p=panelsProjection(D,ws,entry,view);
 if(p.profile!=='panels.composed@1')fail('DDN-QP001','A child-view panel requires panels.composed@1 and cannot also contain items');
 const panels=currentPanels(D,ws,entry,view);
 const panel=panels.find(v=>v.id===panelId);
 if(!panel)fail('DDN-I033','Panel '+String(panelId)+' is not declared in this view. Nothing was changed.');
 if(!ws.views(entry).some(v=>v.id===childViewId))fail('DDN-QP001','Panel view must resolve to a named view');
 if(panel.view===undefined&&panels.filter(v=>v.view!==undefined).length>=12)fail('DDN-QP003','At most twelve embedded child views are permitted');
 if(panel.items&&panel.items.length)fail('DDN-QP001','A child-view panel requires panels.composed@1 and cannot also contain items');
 const child=ws.resolve(entry,childViewId);
 if(child.view.profiles.projection?.kind==='panels'&&child.view.children?.length)fail('DDN-QP002','Composed panels support one child-view level; recursive dashboards are not supported');
 return setPanels(D,ws,entry,view,{panels:panels.map(v=>v.id===panelId?(()=>{const{items,...rest}=v;return{...rest,view:childViewId};})():v)});
}
// Decision table editor commands (ED-007). Rule rows are shared-model edits
// (rule.row definitions carrying x_rule:{when,then}); the records order and the
// hit_policy/coverage keys are view-scope writes through editProjectionProperty.
// when/then are pre-validated against the declared input/output domains
// (mirroring the runtime predicates() checks); the scratch re-plan stays the
// authority so DDN-QD001/002/003 reject before commit. Analysis failures
// (DDN-QD004 overlap, DDN-QD005 uncovered witness, DDN-QD008 budget) are
// draft-tolerated (VE-007): the commit stands and the editor surfaces the
// failing analysis from the committed re-render, never hiding it.
function decisionProjection(D,ws,entry,view){
 const p=ws.resolve(entry,view).view.profiles.projection||{};
 if(p.kind!=='decision')fail('DDN-E006','Decision table editing needs a decision projection');
 return p;
}
function decisionReplan(t,entry,view){
 try{return t.projectionPlan(entry,view);}
 catch(e){if(classifyCode(e.code,'design')==='incomplete')return{draft:{code:e.code,message:e.message}};throw e;}
}
// Decision commands stage with stage(…,'tolerant'): clean re-plans commit
// through the full build validation exactly like every other editor; a
// draft-tolerated analysis failure (DDN-QD004/005/008, VE-007) commits
// parse-only so the overlap/uncovered/budget state stays saveable as a draft
// and the committed re-render surfaces the runtime's own error, never hidden.
function decisionInDomain(v,d){
 if(v===undefined)return !!d.optional;
 if(v===null)return !!d.nullable;
 if(d.type==='number')return typeof v==='number'&&Number.isFinite(v)&&v>=d.min&&v<=d.max;
 if(d.type==='boolean')return typeof v==='boolean';
 return Array.isArray(d.values)&&d.values.some(x=>String(x)===String(v));
}
function checkDecisionRule(p,when,then){
 const inputs=p.inputs||[],outputs=p.outputs||[];
 if(!when||typeof when!=='object'||Array.isArray(when))fail('DDN-QD002','when must be a conjunction record');
 for(const [k,c]of Object.entries(when)){
  const d=inputs.find(x=>x.key===k);
  if(!d)fail('DDN-QD002','Predicate references unknown input '+k);
  if(!c||typeof c!=='object'||Array.isArray(c)||!['eq','in','interval','null','missing'].includes(c.op))fail('DDN-QD002','Unsupported predicate operator');
  if(c.op==='eq'&&!decisionInDomain(c.value,d))fail('DDN-QD002','Equality value outside input domain');
  if(c.op==='in'&&(!Array.isArray(c.values)||!c.values.length||c.values.some(v=>!decisionInDomain(v,d))||new Set(c.values.map(String)).size!==c.values.length))fail('DDN-QD002','Membership values outside input domain or duplicate');
  if(c.op==='null'&&!d.nullable||c.op==='missing'&&!d.optional)fail('DDN-QD002','Predicate uses an unavailable null/missing state');
  if(c.op==='interval'&&(d.type!=='number'||typeof c.min!=='number'||typeof c.max!=='number'||!Number.isFinite(c.min)||!Number.isFinite(c.max)||c.min>c.max||c.min<d.min||c.max>d.max))fail('DDN-QD002','Invalid numeric predicate interval');
 }
 if(!then||typeof then!=='object'||Array.isArray(then))fail('DDN-QD003','Every rule must provide every scalar output');
 const keys=Object.keys(then);
 if(keys.length!==outputs.length||outputs.some(k=>!Object.hasOwn(then,k)))fail('DDN-QD003','Every rule must provide every scalar output');
 if(keys.some(k=>!['string','number','boolean'].includes(typeof then[k])||typeof then[k]==='number'&&!Number.isFinite(then[k])))fail('DDN-QD003','Every rule must provide every scalar output');
}
// addLocal scopes the editor_data block into the view only when it creates the
// block; adding a definition to a second decision view in the same file must
// append @editor_data to that view's data list first, or the new rule is out
// of scope (DDN057). No-op when the block does not exist or is already listed.
function ensureEditorDataScope(D,t,entry,view){
 const ir=t.resolve(entry,view),span=ir.view.source,text=t.getFiles()[span.file];
 if(!text.includes('data editor_data'))return;
 const tokens=D.lex(text,span.file).filter(x=>x.start>=span.start&&x.end<=span.end);
 const open=tokens.findIndex(x=>x.type==='{');
 if(open<0)return;
 let depth=1,close=-1;
 for(let i=open+1;i<tokens.length;i++){if(tokens[i].type==='{')depth++;if(tokens[i].type==='}'){depth--;if(!depth){close=i;break;}}}
 if(close<0)return;
 for(let i=open+1,d=1;i<close;i++){
  const tok=tokens[i];
  if(tok.type==='{'||tok.type==='[')d++;
  if(tok.type==='}'||tok.type===']')d--;
  if(d===1&&tok.type==='id'&&tok.value==='data'&&tokens[i+1]?.type===':'){
   if(tokens[i+2]?.type!=='[')fail('DDN-I033','The view’s data list is not an editable array form. Nothing was changed.');
   let end=-1,has=false,d2=0;
   for(let j=i+2;j<close;j++){
    if(tokens[j].type==='[')d2++;
    if(tokens[j].type===']'){d2--;if(!d2){end=j;break;}}
    if(tokens[j].type==='@'){const tail=text.slice(tokens[j].end).match(/^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*/);if(tail&&tail[0]==='editor_data')has=true;}
   }
   if(has||end<0)return;
   t.applyEdits([{file:span.file,start:tokens[i+2].end,end:tokens[i+2].end,text:'@editor_data, '}],{expectedRevision:t.revision,entry,view});
   return;
  }
 }
}
function addDecisionRule(D,ws,entry,view,args){
 const {id,label,when,then}=args||{};
 const p=decisionProjection(D,ws,entry,view);
 checkDecisionRule(p,when,then);
 return stage(D,ws,entry,view,t=>{
  ensureEditorDataScope(D,t,entry,view);
  D.authoring.addElement(t,entry,view,{id,name:label||id,kind:'rule.row'});
  const n=t.resolve(entry,view).elements.find(e=>e.local===id);
  if(!n)fail('DDN-I033','Created rule not found in the resolved view.');
  D.authoring.setProperty(t,entry,view,n.id,'x_rule',{when,then});
  const current=sourceRecords(ws,entry,p.records);
  editProjectionProperty(D,t,entry,view,{key:'records',value:[...current,{$ref:'editor_data.'+id}]},'tolerant');
  decisionReplan(t,entry,view);
  return{select:n.id};
 },'tolerant');
}
// Source-span property rewrite for a rule definition, mirroring the runtime
// authoring property() span logic, but applied parse-only by the caller so an
// overlap-forming rewrite never passes through an intermediate build (VE-007
// draft commits stay atomic: exactly the x_rule span is touched).
function objectPropertyEdit(D,files,el,key,newValue){
 const file=el.source.file,text=files[file];
 const tokens=D.lex(text,file).filter(t=>t.start>=el.source.start&&t.end<=el.source.end);
 const open=tokens.findIndex(t=>t.type==='{');
 if(open<0)fail('DDN-I033','The rule declaration has no editable body span.');
 const bodyStart=tokens[open].end;let depth=1,bodyEnd=-1;
 for(let i=open+1;i<tokens.length;i++){if(tokens[i].type==='{')depth++;if(tokens[i].type==='}'){depth--;if(!depth){bodyEnd=tokens[i].start;break;}}}
 if(bodyEnd<0)fail('DDN-I033','The rule declaration body is not closed in source.');
 const body=tokens.filter(t=>t.start>=bodyStart&&t.end<=bodyEnd),render=key+': '+D.authoring.value(newValue)+';';
 let d=0;
 for(let i=0;i<body.length;i++){
  const tok=body[i];
  if(d===0&&tok.type==='id'&&tok.value===key&&body[i+1]?.type===':'){
   let j=i+2,d2=0;
   while(j<body.length){if(body[j].type===';'&&d2===0)return{file,start:tok.start,end:body[j].end,text:render};if(['{','['].includes(body[j].type))d2++;if(['}',']'].includes(body[j].type))d2--;j++;}
   fail('DDN-I033','The existing rule property is not terminated.');
  }
  if(['{','['].includes(tok.type))d++;if(['}',']'].includes(tok.type))d--;
 }
 return{file,start:bodyStart,end:bodyStart,text:'\n    '+render+'\n'};
}
// View-body top-level list property rewrite (e.g. select), mirroring
// editProjectionProperty but scanning the view block's depth-1 tokens.
function editViewBodyProperty(D,t,entry,view,{key,value}){
 const ir=t.resolve(entry,view),span=ir.view.source;
 const text=t.getFiles()[span.file];
 const tokens=D.lex(text,span.file).filter(x=>x.start>=span.start&&x.end<=span.end);
 const open=tokens.findIndex(x=>x.type==='{');
 if(open<0)fail('DDN-I033','The active view declaration has no editable source span.');
 let depth=1,close=-1;
 for(let i=open+1;i<tokens.length;i++){if(tokens[i].type==='{')depth++;if(tokens[i].type==='}'){depth--;if(!depth){close=i;break;}}}
 if(close<0)fail('DDN-I033','The view block is not closed in source.');
 const removing=value===undefined,render=removing?'':key+': '+D.authoring.value(value)+';';
 let edit=null;
 for(let i=open+1,d=1;i<close;i++){
  const tok=tokens[i];
  if(tok.type==='{'||tok.type==='[')d++;
  if(tok.type==='}'||tok.type===']')d--;
  if(d===1&&tok.type==='id'&&tok.value===key&&tokens[i+1]?.type===':'){
   let j=i+2,d2=1;
   while(j<close){if(tokens[j].type==='{'||tokens[j].type==='[')d2++;if(tokens[j].type==='}'||tokens[j].type===']')d2--;if(tokens[j].type===';'&&d2===1)break;j++;}
   if(j>=close)fail('DDN-I033','The existing view property is not terminated.');
   let start=tok.start,end=tokens[j].end;
   if(removing){
    // Whole-line removal: when the property owns its line(s), take the leading
    // indentation and the newline run after ';' so a remove+restore cycle of
    // the only occurrence restores byte-identical source.
    const ls=text.lastIndexOf('\n',start-1)+1;
    if(/^[ \t]*$/.test(text.slice(ls,start))){const tail=text.slice(end).match(/^([ \t]*\n)+/);if(tail){start=ls;end+=tail[0].length;}}
   }
   edit={file:span.file,start,end,text:render};break;
  }
 }
 if(!edit){if(removing)return{key,removed:false};edit={file:span.file,start:tokens[close].start,end:tokens[close].start,text:render+' '};}
 try{t.applyEdits([edit],{expectedRevision:t.revision,entry,view});}
 catch(e){if(classifyCode(e.code,'design')!=='incomplete')throw e;t.applyEdits([edit],{expectedRevision:t.revision});}
 return{key,...(removing?{removed:true}:{})};
}
function editDecisionRule(D,ws,entry,view,args){
 const {ruleId,when,then}=args||{};
 const p=decisionProjection(D,ws,entry,view);
 const el=ws.resolve(entry,view).elements.find(n=>n.id===ruleId);
 if(!el)fail('DDN-E002','Definition not found.');
 const current=el.properties.x_rule;
 if(!current||typeof current!=='object')fail('DDN-E006','Selected object has no x_rule record');
 const next={when:when!==undefined?when:current.when,then:then!==undefined?then:current.then};
 checkDecisionRule(p,next.when,next.then);
 return stage(D,ws,entry,view,t=>{
  t.applyEdits([objectPropertyEdit(D,t.getFiles(),el,'x_rule',next)],{expectedRevision:t.revision});
  decisionReplan(t,entry,view);
  return{select:ruleId};
 },'tolerant');
}
function reorderDecisionRules(D,ws,entry,view,args){
 const {orderedIds}=args||{};
 const p=decisionProjection(D,ws,entry,view);
 const current=(p.records||[]).map(r=>r?.$ref);
 if(!Array.isArray(orderedIds)||orderedIds.length!==current.length||new Set(orderedIds).size!==current.length||!current.every(id=>orderedIds.includes(id)))fail('DDN-I033','Reordering needs exactly the current rule refs in a new order — a permutation, never an addition or removal. Nothing was changed.');
 return stage(D,ws,entry,view,t=>{
  editProjectionProperty(D,t,entry,view,{key:'records',value:orderedIds.map(id=>({$ref:sourceRef(ws,entry,id)}))},'tolerant');
  decisionReplan(t,entry,view);
  return{records:orderedIds.length};
 },'tolerant');
}
function deleteDecisionRule(D,ws,entry,view,args){
 const {ruleId}=args||{};
 const p=decisionProjection(D,ws,entry,view);
 const selected=ws.resolve(entry,view).view.selected;
 return stage(D,ws,entry,view,t=>{
  const current=sourceRecords(ws,entry,p.records),local=sourceRef(ws,entry,ruleId);
  const kept=current.filter(r=>String(r.$ref)!==local);
  if(kept.length!==current.length)editProjectionProperty(D,t,entry,view,{key:'records',value:kept},'tolerant');
  // The select clause references appearances too; an auto-added rule lands
  // there (addElement appends it), so the delete drops that ref as well —
  // remaining references elsewhere still surface DDN-E004.
  if(selected.includes(ruleId)){
   const keptSel=selected.filter(id=>id!==ruleId).map(id=>({$ref:sourceRef(ws,entry,id)}));
   editViewBodyProperty(D,t,entry,view,{key:'select',value:keptSel});
  }
  D.authoring.deleteDefinition(t,entry,view,ruleId);
  decisionReplan(t,entry,view);
  return{id:ruleId};
 },'tolerant');
}
function setDecisionPolicy(D,ws,entry,view,args){
 const {hitPolicy,coverage}=args||{};
 decisionProjection(D,ws,entry,view);
 if(hitPolicy!==undefined&&!['unique','first','collect'].includes(hitPolicy))fail('DDN-I033','hit_policy must be unique, first or collect. Nothing was changed.');
 if(coverage!==undefined&&!['complete','report','none'].includes(coverage))fail('DDN-I033','coverage is complete, report or none. Nothing was changed.');
 return stage(D,ws,entry,view,t=>{
  if(hitPolicy!==undefined)editProjectionProperty(D,t,entry,view,{key:'hit_policy',value:hitPolicy},'tolerant');
  if(coverage!==undefined)editProjectionProperty(D,t,entry,view,{key:'coverage',value:coverage},'tolerant');
  decisionReplan(t,entry,view);
  return{hitPolicy,coverage};
 },'tolerant');
}
function evaluateDecisionFixture(D,ws,entry,view,args){
 decisionProjection(D,ws,entry,view);
 return ws.evaluateDecision(entry,view,(args||{}).input);
}
// Edge reconnection commands (ED-008; spec ch.07 "Reconnection and inversion",
// ch.12 shared-impact preview; AUD-003 reconnection gap). One reconnection is a
// single atomic, revision-checked source transaction that preserves the
// relation's identity: the id, label token, body properties and the other
// endpoint span stay byte-identical; only the moved endpoint's @-path changes.
// Candidates are validated before staging against the relation kind's
// semantic_contract in designer/contracts/relation-ui-map.json (member XOR port,
// member_endpoints, allow_self, source[]/target[] kind lists); rejections carry
// a plain-language reason and the real workspace never changes (VE-007). The
// runtime's ddn-contracts endpoint checks remain the backstop on commit.
// Shortest-import-chain reference path for uid as seen from file — the
// re-implementation of authoring.js refFor (it is not exported): module-local
// definitions map to their declaration path; cross-file definitions map
// through the workspace's own import declarations; no path → coded error
// telling the user to add the import explicitly (never silently added, ch.11).
function refForFile(files,file,uid){
 if(!String(uid).includes('::'))return uid;
 const [mod,path]=String(uid).split('::');
 const info={};
 for(const [name,text]of Object.entries(files)){
  const dir=name.includes('/')?name.slice(0,name.lastIndexOf('/')+1):'';
  const imports=[];
  for(const x of text.matchAll(/import\s+"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_-]*)/g))imports.push({file:dir+x[1].replace(/^\.\//,''),alias:x[2]});
  info[name]={module:(text.match(/module\s+"([^"]+)"/)||[])[1],imports};
 }
 if(info[file]?.module===mod)return path;
 const seen=new Set([file]),queue=[{f:file,prefix:''}];
 while(queue.length){
  const {f,prefix}=queue.shift();
  for(const imp of info[f]?.imports||[]){
   if(seen.has(imp.file))continue;seen.add(imp.file);
   const next=(prefix?prefix+'.':'')+imp.alias;
   if(info[imp.file]?.module===mod)return next+'.'+path;
   queue.push({f:imp.file,prefix:next});
  }
 }
 fail('DDN-E003','The edited source does not import the target definition. Add the required import explicitly.');
}
// The endpoint spans are lexically locatable: `@` is its own token type and the
// two header endpoints are the first (from) and second (to) @-path token
// sequences before the relation body `{` (or terminating `;`).
function endpointSpan(D,text,relation,end){
 const span=relation.source;
 if(!span||span.start===undefined)fail('DDN-I033','The relation has no editable source span. Nothing was changed.');
 const tokens=D.lex(text,span.file).filter(t=>t.start>=span.start&&t.end<=span.end);
 let limit=span.end;
 for(const t of tokens)if(t.type==='{'||t.type===';'){limit=t.start;break;}
 const ats=tokens.filter(t=>t.type==='@'&&t.start<limit);
 if(ats.length<2)fail('DDN-I033','The relation header does not expose two endpoint references. Nothing was changed.');
 const at=end==='from'?ats[0]:ats[ats.length-1];
 const tail=text.slice(at.end).match(/^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*/);
 if(!tail)fail('DDN-I033','The endpoint reference is not an editable path. Nothing was changed.');
 return {file:span.file,start:at.end,end:at.end+tail[0].length,text:tail[0]};
}
// Pure validation + edit computation: no workspace is mutated. Shared by the
// commit path, the non-committing preview, and the drag hover check.
function prepareReconnect(D,ws,entry,view,args,relationMap){
 const {relationId,end,endpoint}=args||{};
 if(end!=='from'&&end!=='to')fail('DDN-I033','Reconnection names the moved end as "from" or "to". Nothing was changed.');
 if(!endpoint||typeof endpoint!=='object'||Array.isArray(endpoint)||typeof endpoint.elementId!=='string'||!endpoint.elementId)fail('DDN-I033','Reconnection needs an endpoint naming an element, optionally with one member or one port. Nothing was changed.');
 if(endpoint.memberId!==undefined&&endpoint.portId!==undefined)fail('DDN-I033','An endpoint names a member or a port, never both. Nothing was changed.');
 const ir=ws.resolve(entry,view);
 const relation=ir.relations.find(r=>r.id===relationId);
 if(!relation)fail('DDN-E002','Definition not found.');
 const el=ir.elements.find(n=>n.id===endpoint.elementId);
 if(!el)fail('DDN-E002','Definition not found.');
 const contract=(relationMap?.relations||[]).find(x=>x.id===relation.kind)?.semantic_contract||null;
 if(endpoint.memberId!==undefined){
  if(contract&&contract.member_endpoints===false)fail('DDN-I033','A '+relation.kind+' relation attaches to whole objects; it does not accept a field endpoint such as '+el.name+'. Nothing was changed.');
  if(!el.fields.some(f=>f.id===endpoint.memberId))fail('DDN-I033','Field '+String(endpoint.memberId).split('::').pop()+' does not belong to '+el.name+'. Nothing was changed.');
 }
 if(endpoint.portId!==undefined&&!(el.ports||[]).some(p=>p.id===endpoint.portId))fail('DDN-I033','Port '+String(endpoint.portId).split('::').pop()+' does not belong to '+el.name+'. Nothing was changed.');
 const other=end==='from'?relation.to:relation.from;
 if(contract&&contract.allow_self===false&&other.element===endpoint.elementId)fail('DDN-I033','A '+relation.kind+' relation cannot loop back to the object it already touches; the other endpoint is '+el.name+'. Nothing was changed.');
 const list=contract&&(end==='from'?contract.source:contract.target);
 if(list&&!list.includes('*')&&!list.includes(el.kind))fail('DDN-I033','A '+relation.kind+' '+(end==='from'?'source':'target')+' must be one of: '+list.join(', ')+'. '+el.name+' is a '+el.kind+'. Nothing was changed.');
 const files=ws.getFiles(),span=endpointSpan(D,files[relation.source.file]||'',relation,end);
 const refUid=endpoint.memberId||endpoint.portId||endpoint.elementId;
 const newRef=refForFile(files,relation.source.file,refUid);
 return {relation,end,edit:{file:span.file,start:span.start,end:span.end,text:newRef},previousRef:span.text,newRef};
}
// Byte-span of a `route @<relation> { … }` override in source (for the preview's
// retained-items list); the scratch re-render is the authority that it still
// resolves after the move.
function routeBlockSpan(text,target){
 const m=new RegExp('route\\s+@'+target.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*\\{').exec(text);
 if(!m)return null;
 let depth=0;
 for(let i=m.index+m[0].length-1;i<text.length;i++){
  if(text[i]==='{')depth++;
  if(text[i]==='}'){depth--;if(!depth)return {start:m.index,end:i+1};}
 }
 return null;
}
function reconnectRelation(D,ws,entry,view,args,relationMap){
 const plan=prepareReconnect(D,ws,entry,view,args,relationMap);
 return stage(D,ws,entry,view,t=>{
  t.applyEdits([plan.edit],{expectedRevision:t.revision,entry,view});
  const out=t.renderSync({entry,view});
  return {select:plan.relation.id,end:plan.end,previous:plan.previousRef,proposed:plan.newRef,diagnostics:out.diagnostics.map(d=>({code:d.code,message:d.message}))};
 });
}
// Non-committing preview (ch.12): runs the same validation, stages on a scratch
// workspace, re-renders the current view so semantic validators fire, and
// reports the exact previous/proposed references, scratch diagnostics, and any
// route overrides retained. The caller's workspace is never touched.
function previewReconnect(D,ws,entry,view,args,relationMap){
 const plan=prepareReconnect(D,ws,entry,view,args,relationMap);
 const t=D.createWorkspace(ws.getFiles());
 try{
  let diagnostics=[],error=null;
  try{
   t.applyEdits([plan.edit],{expectedRevision:t.revision,entry,view});
   diagnostics=t.renderSync({entry,view}).diagnostics.map(d=>({code:d.code,message:d.message}));
  }catch(e){error={code:e.code||'EDIT',message:e.message};}
  const routes=[];
  for(const [name,text]of Object.entries(t.getFiles())){
   const span=routeBlockSpan(text,plan.relation.ref);
   if(span)routes.push({file:name,target:plan.relation.ref,text:text.slice(span.start,span.end)});
  }
  return {relationId:plan.relation.id,end:plan.end,file:plan.edit.file,previous:plan.previousRef,proposed:plan.newRef,diagnostics,error,routes};
 }finally{t.destroy();}
}
// Occurrence addressing layer (ED-009; spec ch.10–11, AUD-004; charter Terms
// "**Definition**: a model object, field, relation, rule, record, or domain.
// **Occurrence**: one visual appearance of a definition in a named view.
// **Instance**: a distinct modeled/deployed instance; not a synonym for
// occurrence."). occurrenceId = 'occ:' + viewUid + ':' + definitionId —
// deterministic, reversible and unique because the one-appearance-per-view
// restriction holds (the ch.11 scoping sentence this layer implements;
// VE-004: "A repeated appearance is not a replica."). The layer adds no source
// syntax (VE-008) and never creates a duplicate definition: a same-view alias
// request focuses/restores and answers with the fixed restriction response.
// Relation occurrences are derived: in 0.5 a relation appearance exists
// exactly while both endpoints are shown (ddn-core visibleRelations; there is
// no independent relation-hide), so relation-occurrence removal and unrelated
// descriptor overrides answer with an explicit unsupported response instead of
// a fake replica or a silent endpoint edit.
const OCC_RESTRICTION='one-appearance-per-view';
const occurrenceIdFor=(viewUid,definitionId)=>'occ:'+viewUid+':'+definitionId;
function parseOccurrenceId(occurrenceId){
 const m=typeof occurrenceId==='string'?/^occ:([^:]+)::([^:]+):(.+)$/.exec(occurrenceId):null;
 if(!m)fail('DDN-I033','Malformed occurrence id '+JSON.stringify(occurrenceId)+'; the format is occ:<viewId>:<definitionId>. Nothing was changed.');
 return{viewId:m[1]+'::'+m[2],definitionId:m[3]};
}
function listOccurrences(D,ws,entry,viewId){
 const ir=ws.resolve(entry,viewId),viewUid=ir.view.id;
 return[
  ...ir.view.selected.map(definitionId=>({viewId:viewUid,occurrenceId:occurrenceIdFor(viewUid,definitionId),definitionId,role:'element'})),
  ...ir.view.relations.map(definitionId=>({viewId:viewUid,occurrenceId:occurrenceIdFor(viewUid,definitionId),definitionId,role:'relation'})),
 ];
}
function resolveOccurrence(D,ws,entry,viewId,occurrenceId){
 const parsed=parseOccurrenceId(occurrenceId);
 const ir=ws.resolve(entry,viewId);
 if(parsed.viewId!==ir.view.id)fail('DDN-I033','Occurrence '+occurrenceId+' does not belong to view '+viewId+'. Nothing was changed.');
 const el=ir.elements.find(n=>n.id===parsed.definitionId);
 if(el)return{definitionId:parsed.definitionId,role:'element',node:el};
 const rel=ir.relations.find(r=>r.id===parsed.definitionId);
 if(rel)return{definitionId:parsed.definitionId,role:'relation',node:rel};
 fail('DDN-E002','Definition not found.');
}
// Refs of a view-body list property (select/exclude/data) as source strings,
// or null when the property is not declared. Lexed from the view source span.
function viewListRefs(D,ws,entry,viewId,key){
 const ir=ws.resolve(entry,viewId),span=ir.view.source,text=ws.getFiles()[span.file];
 const tokens=D.lex(text,span.file).filter(t=>t.start>=span.start&&t.end<=span.end);
 for(let i=0,d=0;i<tokens.length;i++){
  const tok=tokens[i];
  if(tok.type==='{'||tok.type==='[')d++;
  if(tok.type==='}'||tok.type===']')d--;
  if(d===1&&tok.type==='id'&&tok.value===key&&tokens[i+1]?.type===':'&&tokens[i+2]?.type==='['){
   const refs=[];let d2=1;
   for(let j=i+3;j<tokens.length&&d2>0;j++){
    const t2=tokens[j];
    if(t2.type==='[')d2++;
    if(t2.type===']'){d2--;if(!d2)break;}
    if(t2.type==='@'&&d2===1){const tail=text.slice(t2.end).match(/^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*/);if(tail)refs.push(tail[0]);}
   }
   return refs;
  }
 }
 return null;
}
// View-node select/exclude/data list planner, used by the occurrence commands;
// the span edit itself is editViewBodyProperty (mirrors authoring.js's
// property() rewrite of one view-body property).
function editViewProperty(D,ws,entry,view,args){
 const {key,value}=args||{};
 if(!['select','exclude','data'].includes(key))fail('DDN-D001','Unknown or unsupported view property key: '+String(key));
 return stage(D,ws,entry,view,t=>editViewBodyProperty(D,t,entry,view,{key,value}));
}
// addExistingToView: (a) already shown → the VE-AC-036 explicit response, no
// clone, focus it (ch.06: "If the same definition is already in this view,
// focus it by default"); (b) excluded → remove its ref from exclude (un-hide);
// (c) explicit select list → append its ref, appending the owning data-block
// ref first when the block is outside the view's data list (the addLocal
// pattern). Cross-file without an existing import rejects DDN-E003 (ch.11
// "Imports and write destinations": imports are never added silently).
// Caller-supplied occurrenceId must equal the computed one — never invented.
function addExistingToView(D,ws,entry,args){
 const {definitionId,viewId,occurrenceId}=args||{};
 if(typeof definitionId!=='string'||!definitionId||typeof viewId!=='string'||!viewId)fail('DDN-I033','addExistingToView needs a definition id and a target view id. Nothing was changed.');
 const ir=ws.resolve(entry,viewId),viewUid=ir.view.id;
 const computed=occurrenceIdFor(viewUid,definitionId);
 if(occurrenceId!==undefined&&occurrenceId!==computed)fail('DDN-I033','Caller-supplied occurrenceId '+JSON.stringify(occurrenceId)+' does not equal the computed '+JSON.stringify(computed)+' — the contract never invents ids. Nothing was changed.');
 if(ir.view.selected.includes(definitionId))return{status:'already-present',restriction:OCC_RESTRICTION,occurrenceId:computed,select:definitionId};
 if(ir.relations.some(r=>r.id===definitionId))return{status:'unsupported',reason:'Relation occurrences are derived from endpoint visibility in 0.5; show the endpoint elements instead. The source is unchanged.'};
 const ref=sourceRef(ws,entry,definitionId);
 const selectRefs=viewListRefs(D,ws,entry,viewId,'select');
 const inScope=ir.elements.some(n=>n.id===definitionId);
 if(inScope&&selectRefs===null){
  // (b) excluded: the view selects all in-scope elements, so absence from the
  // selection means an exclude entry — remove exactly that ref.
  const excludeRefs=viewListRefs(D,ws,entry,viewId,'exclude')||[];
  if(!excludeRefs.includes(ref))fail('DDN-I033','Definition '+definitionId+' is in scope but neither selected nor excluded in view '+viewId+'; the view source needs a manual look. Nothing was changed.');
  const kept=excludeRefs.filter(r=>r!==ref);
  return stage(D,ws,entry,viewId,t=>{
   editViewBodyProperty(D,t,entry,viewId,{key:'exclude',value:kept.length?kept.map(r=>({$ref:r})):undefined});
   return{status:'restored',occurrenceId:computed,select:definitionId};
  });
 }
 // (c) explicit select list, or out of scope entirely: append the ref (and the
 // owning block ref to data when it is outside the data list).
 const blockUid=definitionId.split('::')[0]+'::'+definitionId.split('::')[1].split('.')[0];
 const dataRefs=viewListRefs(D,ws,entry,viewId,'data');
 if(dataRefs===null)fail('DDN-I033','The target view’s data list is not an editable array form. Nothing was changed.');
 const blockRef=inScope?null:sourceRef(ws,entry,blockUid);
 if(blockRef&&!dataRefs.includes(blockRef))fail('DDN-I033','The definition’s data block '+blockUid+' is outside the view’s data list; adding it changes the view’s scope and is a separate reviewed command. Nothing was changed.');
 if(selectRefs===null)fail('DDN-I033','Definition '+definitionId+' is outside the view’s resolved elements and there is no explicit select list to extend. Nothing was changed.');
 if(selectRefs.includes(ref))fail('DDN-I033','The select list already references '+definitionId+' but it does not resolve into the view; fix the view source. Nothing was changed.');
 return stage(D,ws,entry,viewId,t=>{
  editViewBodyProperty(D,t,entry,viewId,{key:'select',value:[...selectRefs,ref].map(r=>({$ref:r}))});
  return{status:'added',occurrenceId:computed,select:definitionId};
 });
}
// removeOccurrence: element occurrences hide (exclude append — the shared
// definition survives, VE-004/VE-008); incident relation appearances vanish
// transitively (documented in the ch.11 status note). Relation occurrences
// answer with an explicit unsupported response: no source change, no fake
// replica (VE-AC-036's allowed alternative).
function removeOccurrence(D,ws,entry,args,mode){
 const {viewId,occurrenceId}=args||{};
 const r=resolveOccurrence(D,ws,entry,viewId,occurrenceId);
 if(r.role==='relation')return{status:'unsupported',reason:'The 0.5 runtime has no independent relation-hide: a relation occurrence can only disappear with an endpoint or via display { relations:none; }. The source is unchanged.'};
 return stage(D,ws,entry,viewId,t=>{
  if(mode==='tolerant'){
   // Draft commit (ED-010, VE-AC-006): authoring.hide validates the view and
   // would reject a completeness-breaking draft; append the exclude ref
   // through the span editor, which applies parse-only on incomplete codes.
   const refs=viewListRefs(D,t,entry,viewId,'exclude')||[];
   const ref=sourceRef(t,entry,r.definitionId);
   if(!refs.includes(ref))editViewBodyProperty(D,t,entry,viewId,{key:'exclude',value:[...refs,ref].map(x=>({$ref:x}))});
  }else D.authoring.hide(t,entry,viewId,r.definitionId);
  return{status:'removed',occurrenceId,removed:r.definitionId};
 },mode);
}
// moveOccurrences: one staged transaction for the whole positions array
// (schema caps at 128). pin:false releases the place block. Pin-by-occurrence
// is pin-by-definition under the one-appearance-per-view restriction (the
// mapping is recorded in the ch.11 status note).
function moveOccurrences(D,ws,entry,args){
 const {viewId,positions}=args||{};
 if(!Array.isArray(positions)||positions.length<1||positions.length>128)fail('DDN-E007','moveOccurrences needs 1..128 position records');
 const resolved=positions.map(p=>{
  if(!p||typeof p!=='object'||Array.isArray(p))fail('DDN-E007','Invalid position record');
  const r=resolveOccurrence(D,ws,entry,viewId,p.occurrenceId);
  if(r.role!=='element')fail('DDN-I033','Relation occurrences are derived from endpoint visibility in 0.5; there is no independent geometry to pin. Nothing was changed.');
  if(p.pin===false)return{...r,release:true};
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y))fail('DDN-E001','Position must be finite, bounded world coordinates.');
  return{...r,x:p.x,y:p.y};
 });
 return stage(D,ws,entry,viewId,t=>{
  for(const r of resolved)if(r.release)D.authoring.unpin(t,entry,viewId,r.definitionId);else D.authoring.pin(t,entry,viewId,r.definitionId,r.x,r.y);
  return{moved:resolved.length};
 });
}
// setViewOverride restricted descriptor set: visibility (set = restore, remove
// = hide) and pin (set with value [x,y] = place, remove = unplace). Anything
// else is the ch.11 occurrence-contract RFC's scope → explicit unsupported.
function setViewOverride(D,ws,entry,args){
 const {viewId,occurrenceId,descriptorId,action,value}=args||{};
 if(action!=='set'&&action!=='remove')fail('DDN-I033','setViewOverride action is set or remove. Nothing was changed.');
 const r=resolveOccurrence(D,ws,entry,viewId,occurrenceId);
 if(descriptorId==='visibility'){
  if(r.role==='relation')return{status:'unsupported',reason:'The 0.5 runtime has no independent relation-hide: a relation occurrence can only disappear with an endpoint or via display { relations:none; }. The source is unchanged.'};
  if(action==='remove')return stage(D,ws,entry,viewId,t=>{D.authoring.hide(t,entry,viewId,r.definitionId);return{status:'applied',descriptorId,action,occurrenceId};});
  return addExistingToView(D,ws,entry,{definitionId:r.definitionId,viewId});
 }
 if(descriptorId==='pin'){
  if(r.role!=='element')return{status:'unsupported',reason:'Relation occurrences are derived from endpoint visibility in 0.5; there is no independent geometry to pin. The source is unchanged.'};
  if(action==='remove')return stage(D,ws,entry,viewId,t=>{D.authoring.unpin(t,entry,viewId,r.definitionId);return{status:'applied',descriptorId,action,occurrenceId};});
  if(!Array.isArray(value)||value.length!==2||!value.every(Number.isFinite))fail('DDN-E001','The pin descriptor needs value [x, y] of finite world coordinates.');
  return moveOccurrences(D,ws,entry,{viewId,positions:[{occurrenceId,x:value[0],y:value[1],pin:true}]});
 }
 return{status:'unsupported',reason:'Per-occurrence '+JSON.stringify(descriptorId)+' overrides are the ch.11 occurrence-contract RFC’s scope; the 0.5 runtime has no source form for them. The source is unchanged.'};
}
const occurrences={occurrenceIdFor,parse:parseOccurrenceId,list:listOccurrences,resolve:resolveOccurrence,addExistingToView,removeOccurrence,moveOccurrences,setViewOverride};
// ED-010 draft validation surface (spec ch.12; AUD-001/AUD-008; VE-002/003/007).
// Read-only inspection: every scope runs in a scratch workspace so nothing
// commits, and the strict render/export path is untouched. Diagnostics follow
// the change-plan shape {code,severity,message,subjectId?,viewId,occurrenceId?};
// severity typing is classifyCode (incomplete only under policy 'design').
// Pass-through renderer diagnostics keep their own severity (e.g. DDN-W012,
// DDN-PJW01/02, DDN-LW01). Subject attribution maps a diagnostic's
// (source, offset) back to the definition declared at that span; when the
// subject is a visible occurrence (ED-009) the issue carries its occurrenceId.
function moduleOf(ws,file){
 const m=/module\s+"([^"]+)"/.exec(ws.getFiles()[file]||'');
 return m?m[1]:null;
}
function attributeSubject(D,t,file,offset){
 if(!file||typeof offset!=='number')return null;
 for(const e of t.entries())for(const v of t.views(e.file)||[]){
  let ir;try{ir=t.resolve(e.file,v.id);}catch(_){continue;}
  const el=ir.elements.find(n=>n.source?.file===file&&n.source?.start===offset);
  if(el&&ir.view.selected.includes(el.id))return{entry:e.file,view:v.id,viewId:ir.view.id,definitionId:el.id};
  const rel=ir.relations.find(r=>r.source?.file===file&&r.source?.start===offset);
  if(rel&&ir.view.relations.includes(rel.id))return{entry:e.file,view:v.id,viewId:ir.view.id,definitionId:rel.id};
  if(el)return{entry:e.file,view:v.id,viewId:ir.view.id,definitionId:el.id};
 }
 return null;
}
function makeIssue(D,t,viewUid,code,severity,message,file,offset){
 const issue={code:String(code||'DDN099'),severity,message:String(message||''),viewId:viewUid};
 const sub=attributeSubject(D,t,file,offset);
 if(sub){issue.subjectId=sub.definitionId;issue.occurrenceId=occurrenceIdFor(sub.viewId,sub.definitionId);}
 return issue;
}
function validate(D,ws,entry,opts){
 const o=opts||{},scope=o.scope||'current-view',policy=o.policy||'design';
 if(!['current-view','workspace'].includes(scope))fail('DDN-I033','validate scope is current-view or workspace.');
 if(!['design','review'].includes(policy))fail('DDN-I033','validate policy is design or review.');
 if(scope==='current-view'&&!o.view)fail('DDN-I033','current-view validation needs the active view id.');
 const t=D.createWorkspace(ws.getFiles());
 try{
  const targets=scope==='workspace'
   ?t.entries().flatMap(e=>(t.views(e.file)||[]).map(v=>({entry:e.file,view:v.id})))
   :[{entry,view:o.view}];
  const issues=[],views=[];
  for(const tg of targets){
   const mod=moduleOf(t,tg.entry),viewUid=mod?mod+'::'+tg.view:tg.view;
   try{
    const r=t.renderSync({entry:tg.entry,view:tg.view});
    for(const d of r.diagnostics||[])issues.push(makeIssue(D,t,viewUid,d.code,d.severity||'warning',d.message,d.source||tg.entry,typeof d.offset==='number'?d.offset:undefined));
    views.push({viewId:viewUid,entry:tg.entry,status:'current-view checked'});
   }catch(e){
    const severity=classifyCode(e.code,policy);
    issues.push(makeIssue(D,t,viewUid,e.code,severity,e.message,e.source||tg.entry,typeof e.offset==='number'?e.offset:undefined));
    views.push({viewId:viewUid,entry:tg.entry,status:severity==='incomplete'?'profile-incomplete':'error'});
   }
  }
  issues.sort((a,b)=>a.code<b.code?-1:a.code>b.code?1:a.viewId<b.viewId?-1:a.viewId>b.viewId?1:0);
  return{scope,policy,views,issues,counts:{
   errors:issues.filter(i=>i.severity==='error').length,
   incomplete:issues.filter(i=>i.severity==='incomplete').length,
   warnings:issues.filter(i=>i.severity==='warning'||i.severity==='info'||i.severity==='information').length,
  }};
 }finally{t.destroy();}
}
// Pending-view bookkeeping (ch.12 "impacted views pending", session scope):
// after a commit, every view except the committed one is pending until a
// workspace-scope revalidation clears it. In-memory only; never persisted.
function pendingViewsAfterCommit(D,ws,entry,activeView){
 const out=[];
 for(const e of ws.entries())for(const v of ws.views(e.file)||[])
  if(!(e.file===entry&&v.id===activeView))out.push(e.file+'::'+v.id);
 return out.sort();
}
// Lane editing commands (ED-011; spec ch.08 "Scope versus visual grouping";
// charter VE-003/VE-005/VE-008). A lane is a view `frame` declaration in
// canonical source — no parallel UI grouping model (ADR-03) and no new source
// syntax: frames are existing 0.5 machinery (ddn-core ir.view.frames,
// ddn-render scene frames). Lane membership is the frame's members list; the
// one-lane-per-element policy removes an assigned element from every other
// frame of the view inside the same transaction. Frame edits are view-scope;
// assignment never infers a semantic containment, ownership or placement
// relationship (VE-AC-040: relation spans stay byte-identical). Under the
// RT-105 uml.activity@1 profile the same commands additionally maintain the
// registered x_partition:{lane:"<frame id>"} membership property; the
// commit-time strict build and scratch re-render keep DDN-PJ114 as the
// authority that the lane resolves. UML-activity partitions stay blocked
// until RT-105 lands — the test suite gates on the landed artifacts and
// fails loudly when they are absent.
function laneFrames(D,ws,entry,view){return ws.resolve(entry,view).view.frames||[];}
function findLane(D,ws,entry,view,frameId){
 const f=laneFrames(D,ws,entry,view).find(x=>x.id===frameId||String(x.id).split('.').pop()===frameId||x.name===frameId);
 if(!f)fail('DDN-I033','Lane '+String(frameId)+' is not declared as a frame of this view. Nothing was changed.');
 return f;
}
function laneActivityProfile(D,ws,entry,view){return ws.resolve(entry,view).view.profiles.projection?.profile==='uml.activity@1';}
function laneElements(D,ws,entry,view,elementIds){
 if(!Array.isArray(elementIds)||!elementIds.length||elementIds.length>128||new Set(elementIds).size!==elementIds.length)fail('DDN-E007','Lane assignment needs 1..128 distinct element ids');
 const ir=ws.resolve(entry,view);
 for(const id of elementIds)if(typeof id!=='string'||!ir.elements.some(n=>n.id===id))fail('DDN-E002','Definition not found.');
}
const lanePx=v=>{if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e7)fail('DDN-E001','Position must be finite, bounded world coordinates.');return{$quantity:Math.round(v*1000)/1000,unit:'px'};};
function createLane(D,ws,entry,view,args){
 const {id,label,at,size}=args||{};
 if(typeof id!=='string'||!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(id)||['__proto__','constructor','prototype'].includes(id))fail('DDN-I033','A lane needs a valid, nonreserved identifier. Nothing was changed.');
 if(typeof label!=='string'||!label)fail('DDN-I033','A lane label is a non-empty string. Nothing was changed.');
 if(laneFrames(D,ws,entry,view).some(f=>String(f.id).split('.').pop()===id||f.name===id||f.name===label))fail('DDN-I033','A lane with this id or name already exists in this view. Nothing was changed.');
 let body='members: [];';
 if(at)body+=' at: '+D.authoring.value([lanePx(at.x),lanePx(at.y)])+';';
 if(size)body+=' size: '+D.authoring.value([lanePx(size.w),lanePx(size.h)])+';';
 return stage(D,ws,entry,view,t=>{
  const span=t.resolve(entry,view).view.source;
  if(!span||span.bodyEnd===undefined)fail('DDN-I033','The active view declaration has no editable source span.');
  t.applyEdits([{file:span.file,start:span.bodyEnd,end:span.bodyEnd,text:'\n    frame '+id+' '+JSON.stringify(label)+' { '+body+' }\n'}],{expectedRevision:t.revision,entry,view});
  const made=t.resolve(entry,view).view.frames.find(f=>String(f.id).split('.').pop()===id);
  if(!made)fail('DDN-I033','Created lane not found in the resolved view.');
  return{select:made.id};
 });
}
function renameLane(D,ws,entry,view,args){
 const {frameId,label}=args||{};
 const frame=findLane(D,ws,entry,view,frameId);
 if(typeof label!=='string'||!label)fail('DDN-I033','A lane label is a non-empty string. Nothing was changed.');
 return stage(D,ws,entry,view,t=>{D.authoring.setLabel(t,entry,view,frame.id,label);return{select:frame.id};});
}
// at/size write [{$quantity,unit:'px'}] pairs; fit:true removes both keys so
// the renderer falls back to member bounds (property removal per authoring.js).
function resizeLane(D,ws,entry,view,args){
 const {frameId,at,size,fit}=args||{};
 const frame=findLane(D,ws,entry,view,frameId);
 if(fit!==true&&!at&&!size)fail('DDN-I033','Resizing a lane needs an at/size pair, or fit:true to auto-fit the lane to its members. Nothing was changed.');
 return stage(D,ws,entry,view,t=>{
  if(fit===true){D.authoring.setProperty(t,entry,view,frame.id,'at',undefined);D.authoring.setProperty(t,entry,view,frame.id,'size',undefined);}
  else{
   if(at)D.authoring.setProperty(t,entry,view,frame.id,'at',[lanePx(at.x),lanePx(at.y)]);
   if(size)D.authoring.setProperty(t,entry,view,frame.id,'size',[lanePx(size.w),lanePx(size.h)]);
  }
  return{select:frame.id};
 });
}
function assignToLane(D,ws,entry,view,args){
 const {frameId,elementIds}=args||{};
 const frame=findLane(D,ws,entry,view,frameId);
 laneElements(D,ws,entry,view,elementIds);
 const activity=laneActivityProfile(D,ws,entry,view),laneKey=String(frame.id).split('.').pop();
 return stage(D,ws,entry,view,t=>{
  const tir=t.resolve(entry,view),files=t.getFiles(),file=tir.view.source.file;
  for(const f of tir.view.frames){
   const kept=f.members.filter(m=>!elementIds.includes(m));
   if(f.id===frame.id)for(const id of elementIds)if(!kept.includes(id))kept.push(id);
   const changed=kept.length!==f.members.length||kept.some((m,i)=>m!==f.members[i]);
   if(changed)D.authoring.setProperty(t,entry,view,f.id,'members',kept.map(uid=>({$ref:refForFile(files,file,uid)})));
  }
  if(activity)for(const id of elementIds)D.authoring.setProperty(t,entry,view,id,'x_partition',{lane:laneKey});
  // The strict re-render is the authority: under uml.activity@1 a lane name
  // that does not resolve fails DDN-PJ114 here, before any real commit.
  t.renderSync({entry,view});
  return{select:elementIds[0],frame:frame.id};
 });
}
function unassignFromLane(D,ws,entry,view,args){
 const {frameId,elementIds}=args||{};
 const frame=findLane(D,ws,entry,view,frameId);
 laneElements(D,ws,entry,view,elementIds);
 const present=elementIds.filter(id=>frame.members.includes(id));
 if(!present.length)fail('DDN-I033','None of the given elements is a member of lane '+String(frame.name)+'. Nothing was changed.');
 const activity=laneActivityProfile(D,ws,entry,view);
 return stage(D,ws,entry,view,t=>{
  const tir=t.resolve(entry,view),files=t.getFiles(),file=tir.view.source.file;
  D.authoring.setProperty(t,entry,view,frame.id,'members',frame.members.filter(m=>!elementIds.includes(m)).map(uid=>({$ref:refForFile(files,file,uid)})));
  if(activity)for(const id of present)D.authoring.setProperty(t,entry,view,id,'x_partition',undefined);
  t.renderSync({entry,view});
  return{frame:frame.id,removed:present.length};
 });
}
// Sequence diagram editor commands (ED-012; RT-101 uml.sequence@1 gate; spec
// ch.09 interaction paragraph; charter VE-002/003/005/006/007). Order is
// declaration order: participants and messages render in the order their
// declarations appear in their data blocks (ddn-projection-data.js sequence
// branch), so reordering is a reviewed span move of the declaration itself
// (moveDeclaration) — never a pixel drag and never a view-list rewrite
// (VE-AC-062: only positions change; endpoints and x_return stay
// byte-identical). Every write stages on a scratch workspace and re-plans the
// sequence view, so the runtime's own DDN-PJ110 (endpoint not a selected
// object) rejects before commit and DDN-PJW03 (silent participant) stays
// surfaced, never hidden (VE-007). Layout overrides stay rejected LIVE021 by
// the runtime's api.js apply() for data-bound projections (VE-AC-063); these
// commands never write place/route source.
function sequenceProjection(D,ws,entry,view){
 const p=ws.resolve(entry,view).view.profiles.projection||{};
 if(p.kind!=='sequence')fail('DDN-E006','Sequence editing needs a sequence projection');
 return p;
}
const blockOf=id=>{const i=String(id).indexOf('::');return i<0?null:String(id).slice(0,i+2)+String(id).slice(i+2).split('.')[0];};
// Cut the moved declaration's full span (leading line indentation plus the
// trailing newline) and insert it immediately before beforeId's span.
function spanMoveEdit(D,t,entry,view,definitionId,beforeId){
 const from=D.authoring.sourceOf(t,entry,view,definitionId),to=D.authoring.sourceOf(t,entry,view,beforeId);
 if(from.file!==to.file)return{unsupported:'Declarations '+definitionId+' ('+from.file+') and '+beforeId+' ('+to.file+') are in different files; declaration order is defined per data block. The source is unchanged.'};
 const text=t.getFiles()[from.file];
 let start=from.start,end=from.end;
 const ls=text.lastIndexOf('\n',start-1)+1;
 if(/^[ \t]*$/.test(text.slice(ls,start)))start=ls;
 if(text[end]==='\n')end++;
 const cut=text.slice(start,end),rest=text.slice(0,start)+text.slice(end);
 const at=to.start>start?to.start-(end-start):to.start;
 return{file:from.file,edit:{file:from.file,start:0,end:text.length,text:rest.slice(0,at)+cut+rest.slice(at)}};
}
function moveDeclaration(D,ws,entry,view,args){
 const {definitionId,beforeId}=args||{};
 if(typeof definitionId!=='string'||!definitionId||typeof beforeId!=='string'||!beforeId)fail('DDN-I033','A declaration move needs a definition id and the declaration it moves before. Nothing was changed.');
 if(definitionId===beforeId)fail('DDN-I033','A declaration cannot move before itself. Nothing was changed.');
 const ir=ws.resolve(entry,view),known=id=>ir.elements.some(n=>n.id===id)||ir.relations.some(r=>r.id===id);
 if(!known(definitionId)||!known(beforeId))fail('DDN-E002','Definition not found.');
 if(blockOf(definitionId)!==blockOf(beforeId))return{status:'unsupported',reason:'Cross-block order is view-data order, not declaration order: '+definitionId+' and '+beforeId+' are declared in different data blocks. The source is unchanged.'};
 return stage(D,ws,entry,view,t=>{
  const plan=spanMoveEdit(D,t,entry,view,definitionId,beforeId);
  if(plan.unsupported)return{status:'unsupported',reason:plan.unsupported};
  t.applyEdits([plan.edit],{expectedRevision:t.revision,entry,view});
  t.projectionPlan(entry,view);
  return{moved:definitionId,before:beforeId};
 });
}
function reorderLifelines(D,ws,entry,view,args){
 const {participantId,beforeId}=args||{};
 sequenceProjection(D,ws,entry,view);
 const plan=ws.projectionPlan(entry,view);
 if(!plan.participants.some(n=>n.id===participantId))fail('DDN-I033','Lifeline '+String(participantId)+' is not a participant of this sequence view. Nothing was changed.');
 if(!plan.participants.some(n=>n.id===beforeId))fail('DDN-I033','Lifeline '+String(beforeId)+' is not a participant of this sequence view. Nothing was changed.');
 return moveDeclaration(D,ws,entry,view,{definitionId:participantId,beforeId});
}
// Endpoint pre-check against the uml.message semantic contract
// (standard/registry/profiles/catalogue.json: allow_self:true,
// member_endpoints:false, source/target:['*']). The commit-time build stays
// the backstop (ddn-contracts.js DDN102); the scratch re-plan is the
// authority for DDN-PJ110 (endpoint not a selected participant object).
function sequenceEndpoints(D,ws,entry,view,fromId,toId){
 const ir=ws.resolve(entry,view);
 const contract=(D.profileCatalogue?.relationships||[]).find(r=>(r.keyword||r.id)==='uml.message')||{};
 for(const id of [fromId,toId]){
  if(typeof id!=='string'||!id)fail('DDN-I033','A sequence message names both endpoint lifelines. Nothing was changed.');
  if(ir.elements.some(n=>n.id===id))continue;
  const owner=ir.elements.find(n=>(n.fields||[]).some(f=>f.id===id));
  if(owner&&contract.member_endpoints===false)fail('DDN-I033','A uml.message attaches to whole participant objects; it does not accept a member endpoint such as '+owner.name+'.'+String(id).split('.').pop()+' (member_endpoints:false). Nothing was changed.');
  fail('DDN-E002','Definition not found.');
 }
 if(fromId===toId&&contract.allow_self===false)fail('DDN-I033','uml.message does not allow a self-message. Nothing was changed.');
}
function addSequenceMessage(D,ws,entry,view,args){
 const {id,label,fromId,toId,isReturn,beforeId}=args||{};
 sequenceProjection(D,ws,entry,view);
 sequenceEndpoints(D,ws,entry,view,fromId,toId);
 if(beforeId!==undefined){
  const plan=ws.projectionPlan(entry,view);
  if(!plan.messages.some(r=>r.id===beforeId))fail('DDN-I033','Row '+String(beforeId)+' is not a message of this sequence view. Nothing was changed.');
 }
 return stage(D,ws,entry,view,t=>{
  D.authoring.addRelation(t,entry,view,{id,name:label||id,kind:'uml.message',from:fromId,to:toId});
  let rel=t.resolve(entry,view).relations.find(r=>String(r.id).endsWith('editor_data.'+id));
  if(!rel)fail('DDN-I033','Created message not found in the resolved view.');
  if(isReturn===true)D.authoring.setProperty(t,entry,view,rel.id,'x_return',true);
  if(beforeId!==undefined){
   // One atomic create+position transaction: authoring.addRelation's fixed
   // destination is the view's editor_data block; positioning relocates the
   // fresh declaration immediately before beforeId's span — the destination
   // block is exactly beforeId's own, so the resulting declaration order is
   // unambiguous. The user-facing moveDeclaration keeps its same-block
   // restriction.
   const plan=spanMoveEdit(D,t,entry,view,rel.id,beforeId);
   if(plan.unsupported)fail('DDN-I033',plan.unsupported);
   t.applyEdits([plan.edit],{expectedRevision:t.revision,entry,view});
   rel=t.resolve(entry,view).relations.find(r=>String(r.id).endsWith('.'+id));
  }
  t.projectionPlan(entry,view);
  return{select:rel.id};
 });
}
function sequenceMessage(D,ws,entry,view,relationId){
 sequenceProjection(D,ws,entry,view);
 const rel=ws.resolve(entry,view).relations.find(r=>r.id===relationId);
 if(!rel)fail('DDN-E002','Definition not found.');
 if(rel.kind!=='uml.message')fail('DDN-I033','Relation '+String(relationId)+' is not a uml.message of this sequence view. Nothing was changed.');
 return rel;
}
// x_return is true or absent, never a literal false: the renderer tests
// x_return===true (ddn-projections.js sequence branch); a written false would
// be dead data (VE-008 hygiene).
function setMessageReturn(D,ws,entry,view,args){
 const {relationId,isReturn}=args||{};
 sequenceMessage(D,ws,entry,view,relationId);
 if(isReturn!==true&&isReturn!==false&&isReturn!==undefined)fail('DDN-I033','isReturn is true (write x_return:true) or false (remove the property). Nothing was changed.');
 return stage(D,ws,entry,view,t=>{
  D.authoring.setProperty(t,entry,view,relationId,'x_return',isReturn===true?true:undefined);
  t.projectionPlan(entry,view);
  return{relationId,isReturn:isReturn===true};
 });
}
function setMessageLabel(D,ws,entry,view,args){
 const {relationId,label}=args||{};
 sequenceMessage(D,ws,entry,view,relationId);
 return stage(D,ws,entry,view,t=>{
  D.authoring.setLabel(t,entry,view,relationId,label);
  t.projectionPlan(entry,view);
  return{select:relationId};
 });
}
function removeSequenceMessage(D,ws,entry,view,args){
 const {relationId}=args||{};
 sequenceMessage(D,ws,entry,view,relationId);
 return stage(D,ws,entry,view,t=>{
  D.authoring.deleteDefinition(t,entry,view,relationId);
  t.projectionPlan(entry,view);
  return{relationId};
 });
}
// Canvas template starters (ED-013; spec ch.06 "A template selects profile and
// defaults explicitly; it does not inject a complete invented business model";
// charter VE-003/VE-004/VE-007). CANVAS_TEMPLATES is the fixed registry: one
// entry per canvas template — {id, title, profile, columns, blocks, notePrompt}
// — with grids copied verbatim from the landed RT items (RT-013 bmc/lean
// 10-column grids, RT-014 pest/pestle/porter5, RT-016 empathy/scorecard; SWOT
// uses the shipped panels.basic@1 swot grid from examples/projections/
// views.ddn). createCanvasFromTemplate runs ONE staged transaction that creates
// exactly one synthetic starter note per block in the chosen data block
// (A.addElement validation-path semantics: idOK + registered kind check; ids
// <viewId>_<panelId>; description is the template's synthetic guidance
// sentence — clearly placeholder text, never business data), appends the view
// block at the entry file's end, then renders the new view in the scratch
// workspace so the runtime's own DDN-PJ020/021/PJ009 and canvas
// DDN-PJ080/081/083 checks are the pre-commit authority. No KPIs, no
// strategies, no extra relations are ever generated.
const CANVAS_TEMPLATES=[
 {id:'bmc',title:'Business Model Canvas',profile:'canvas.bmc@1',columns:10,notePrompt:'List the partners this model depends on.',blocks:[['kp','KEY PARTNERS',0,0,2,2],['ka','KEY ACTIVITIES',0,2,1,2],['kr','KEY RESOURCES',1,2,1,2],['vp','VALUE PROPOSITIONS',0,4,2,2],['cr','CUSTOMER RELATIONSHIPS',0,6,1,2],['ch','CHANNELS',1,6,1,2],['cs','CUSTOMER SEGMENTS',0,8,2,2],['cost','COST STRUCTURE',2,0,1,5],['rev','REVENUE STREAMS',2,5,1,5]]},
 {id:'lean',title:'Lean Canvas',profile:'canvas.lean@1',columns:10,notePrompt:'State the top problem this model addresses.',blocks:[['problem','PROBLEM',0,0,2,2],['solution','SOLUTION',0,2,1,2],['keymetrics','KEY METRICS',1,2,1,2],['uvp','UNIQUE VALUE PROPOSITION',0,4,2,2],['unfair','UNFAIR ADVANTAGE',0,6,1,2],['channels','CHANNELS',1,6,1,2],['segments','CUSTOMER SEGMENTS',0,8,2,2],['cost','COST STRUCTURE',2,0,1,5],['revenue','REVENUE STREAMS',2,5,1,5]]},
 {id:'swot',title:'SWOT analysis',profile:'panels.basic@1',columns:2,notePrompt:'Name one strength of the current situation.',blocks:[['s','STRENGTHS',0,0,1,1],['w','WEAKNESSES',0,1,1,1],['o','OPPORTUNITIES',1,0,1,1],['t','THREATS',1,1,1,1]]},
 {id:'pest',title:'PEST analysis',profile:'canvas.pest@1',columns:4,notePrompt:'Note one political factor affecting the subject.',blocks:[['political','POLITICAL',0,0,1,1],['economic','ECONOMIC',0,1,1,1],['social','SOCIAL',0,2,1,1],['technological','TECHNOLOGICAL',0,3,1,1]]},
 {id:'pestle',title:'PESTLE analysis',profile:'canvas.pestle@1',columns:3,notePrompt:'Note one political factor affecting the subject.',blocks:[['political','POLITICAL',0,0,1,1],['economic','ECONOMIC',0,1,1,1],['social','SOCIAL',0,2,1,1],['technological','TECHNOLOGICAL',1,0,1,1],['legal','LEGAL',1,1,1,1],['environmental','ENVIRONMENTAL',1,2,1,1]]},
 {id:'porter5',title:'Porter five forces',profile:'canvas.porter5@1',columns:3,notePrompt:'Describe the intensity of competitive rivalry.',blocks:[['entrants','THREAT OF NEW ENTRANTS',0,1,1,1],['supplier','SUPPLIER POWER',1,0,1,1],['rivalry','COMPETITIVE RIVALRY',1,1,1,1],['buyer','BUYER POWER',1,2,1,1],['substitutes','THREAT OF SUBSTITUTES',2,1,1,1]]},
 {id:'empathy',title:'Empathy map',profile:'canvas.empathy@1',columns:2,notePrompt:'Record what the persona says aloud.',blocks:[['says','SAYS',0,0,1,1],['thinks','THINKS',0,1,1,1],['persona','PERSONA',1,0,1,2],['does','DOES',2,0,1,1],['feels','FEELS',2,1,1,1]]},
 {id:'scorecard',title:'Balanced scorecard',profile:'canvas.scorecard@1',columns:2,notePrompt:'State one financial perspective objective.',blocks:[['financial','FINANCIAL',0,0,1,1],['customer','CUSTOMER',0,1,1,1],['internal','INTERNAL PROCESS',1,0,1,1],['learning','LEARNING & GROWTH',1,1,1,1]]},
];
// Mirror of authoring.js idOK: a fresh DDN identifier, never a reserved name.
const templateIdOK=id=>{if(typeof id!=='string'||!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(id)||['__proto__','constructor','prototype'].includes(id))fail('DDN-E001','Use a valid, nonreserved DDN identifier.');return id;};
// Data blocks declared in the entry file (lexed declaration spans), for the
// dialog's destination picker and the command's default (first data block).
function dataBlocks(D,ws,entry){
 const text=ws.getFiles()[entry]||'';
 const tokens=D.lex(text,entry),out=[];
 for(let i=0;i<tokens.length;i++){
  if(tokens[i].type==='id'&&tokens[i].value==='data'&&tokens[i+1]?.type==='id'&&tokens[i+2]?.type==='{'){
   let depth=1,end=-1;
   for(let j=i+3;j<tokens.length;j++){if(tokens[j].type==='{')depth++;if(tokens[j].type==='}'){depth--;if(!depth){end=tokens[j].start;break;}}}
   if(end>0)out.push({id:tokens[i+1].value,bodyEnd:end});
  }
 }
 return out;
}
// Default formatRef: the first format @-path declared by any view of the entry
// (resolved from the view node's source props). A file whose views carry no
// format reference is a coded rejection with guidance, never a silent guess.
function defaultFormatRef(D,ws,entry){
 for(const v of ws.views(entry)||[]){
  const span=ws.resolve(entry,v.id).view.source,text=ws.getFiles()[span.file];
  const tokens=D.lex(text,span.file).filter(x=>x.start>=span.start&&x.end<=span.end);
  for(let i=0,d=0;i<tokens.length;i++){
   const tok=tokens[i];
   if(tok.type==='{'||tok.type==='[')d++;
   if(tok.type==='}'||tok.type===']')d--;
   if(d===1&&tok.type==='id'&&tok.value==='format'&&tokens[i+1]?.type===':'&&tokens[i+2]?.type==='@'){
    const tail=text.slice(tokens[i+2].end).match(/^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*/);
    if(tail)return tail[0];
   }
  }
 }
 fail('DDN-I033','No format bundle reference could be resolved from this entry’s views; pass formatRef explicitly (an @-path to a format bundle). Nothing was changed.');
}
function createCanvasFromTemplate(D,ws,entry,args){
 const {templateId,viewId,viewLabel}=args||{};
 let {dataId,formatRef}=args||{};
 const tpl=CANVAS_TEMPLATES.find(x=>x.id===templateId);
 if(!tpl)fail('DDN-I033','Unknown canvas template '+JSON.stringify(templateId)+'; known templates: '+CANVAS_TEMPLATES.map(x=>x.id).join(', ')+'. Nothing was changed.');
 templateIdOK(viewId);
 if(typeof viewLabel!=='string'||!viewLabel||viewLabel.length>4096)fail('DDN-I033','A view label is a non-empty string. Nothing was changed.');
 const files=ws.getFiles();
 if(typeof files[entry]!=='string')fail('DDN-I033','Entry '+JSON.stringify(entry)+' is not in this workspace. Nothing was changed.');
 for(const e of ws.entries())for(const v of ws.views(e.file)||[])if(v.id===viewId)fail('DDN-I033','A view named '+viewId+' already exists ('+e.file+'). Choose a fresh view id. Nothing was changed.');
 const blocks=dataBlocks(D,ws,entry);
 if(!blocks.length)fail('DDN-I033','The entry file declares no data block to hold the starter notes. Nothing was changed.');
 if(dataId===undefined)dataId=blocks[0].id;
 const target=blocks.find(b=>b.id===dataId);
 if(!target)fail('DDN-I033','Data block '+JSON.stringify(dataId)+' is not declared in '+entry+'; choices: '+blocks.map(b=>b.id).join(', ')+'. Nothing was changed.');
 if(formatRef===undefined)formatRef=defaultFormatRef(D,ws,entry);
 if(!D.kinds.some(k=>k.id==='note'))fail('DDN-E001','Unknown object kind.');
 for(const [pid] of tpl.blocks)templateIdOK(viewId+'_'+pid);
 const text=files[entry];
 const notes=tpl.blocks.map(([pid,title])=>'    object '+viewId+'_'+pid+' '+JSON.stringify(title)+' { kind: "note"; description: '+JSON.stringify(tpl.notePrompt)+'; }').join('\n');
 const panels=tpl.blocks.map(([pid,title,row,column,rowspan,colspan])=>'{id:'+JSON.stringify(pid)+',title:'+JSON.stringify(title)+',row:'+row+',column:'+column+',rowspan:'+rowspan+',colspan:'+colspan+',items:[@'+dataId+'.'+viewId+'_'+pid+']}').join(', ');
 const viewText='\nview '+viewId+' '+JSON.stringify(viewLabel)+' {\n    data: [@'+dataId+'];\n    format: @'+formatRef+';\n    projection { kind:panels; profile:'+JSON.stringify(tpl.profile)+'; columns:'+tpl.columns+'; panels:['+panels+']; }\n\n}\n';
 return stage(D,ws,entry,viewId,t=>{
  t.applyEdits([
   {file:entry,start:target.bodyEnd,end:target.bodyEnd,text:'\n'+notes+'\n'},
   {file:entry,start:text.length,end:text.length,text:viewText},
  ],{expectedRevision:t.revision});
  // The scratch render is the pre-commit proof: grid legality (DDN-PJ020/021),
  // non-empty item lists (DDN-PJ009) and the canvas profile's required blocks
  // (DDN-PJ080/081/083) all pass before anything commits.
  t.renderSync({entry,view:viewId});
  return{select:null,viewId,profile:tpl.profile,blocks:tpl.blocks.length};
 });
}
// B1-012 designer chrome: pure, node-testable tables and math behind the
// prototype's splitters, density toggle and export modal (D1/D2/D5).
const SPLITTER_LIMITS={left:[160,420],inspector:[220,520]};
const SPLITTER_DEFAULTS={left:230,inspector:306};
function clampWidth(which,width){
 const limits=SPLITTER_LIMITS[which];
 if(!limits||!Number.isFinite(width))fail('DDN-I033','Unknown splitter or non-finite width. Nothing was changed.');
 return Math.min(limits[1],Math.max(limits[0],Math.round(width)));
}
function splitterDrag(which,startWidth,startClientX,clientX){
 // The left shelf grows rightward with the pointer; the inspector grows leftward.
 const delta=clientX-startClientX;
 return clampWidth(which,which==='left'?startWidth+delta:startWidth-delta);
}
// Boot-time read of a persisted splitter width: localStorage is user-writable,
// so anything that is not a finite positive number falls back to the default
// rather than throwing in gridColumns or collapsing the panel to 0px.
function bootWidth(which,raw){
 const v=+raw;
 return Number.isFinite(v)&&v>0?clampWidth(which,v):SPLITTER_DEFAULTS[which];
}
function gridColumns(leftWidth,inspectorWidth){
 // 0 marks a detached (floating) panel: its column and splitter collapse so the
 // canvas grows to fill. Re-attach restores the persisted splitter width.
 const l=leftWidth<=0?'0px':clampWidth('left',leftWidth)+'px',ls=leftWidth<=0?'0px':'6px';
 const i=inspectorWidth<=0?'0px':clampWidth('inspector',inspectorWidth)+'px',is=inspectorWidth<=0?'0px':'6px';
 return l+' '+ls+' minmax(360px,1fr) '+is+' '+i;
}
const DENSITY={
 compact:{'--ui-font':'12px','--ui-pad':'8px','--ui-btn-h':'28px','--ui-gap':'6px','--ui-palette-h':'56px','--ui-pane-pad':'10px','--ui-projectbar-h':'48px','--ui-toolbar-h':'40px','--ui-tab-font':'12px'},
 comfortable:{'--ui-font':'14px','--ui-pad':'10px','--ui-btn-h':'34px','--ui-gap':'8px','--ui-palette-h':'74px','--ui-pane-pad':'16px','--ui-projectbar-h':'62px','--ui-toolbar-h':'48px','--ui-tab-font':'13px'}
};
const DENSITY_DEFAULT='compact';
// B1-014 D1/D2: designer display options (presentation-only CSS overlay,
// never written to source) and the Text download format table. The CSS
// builders mirror the viewer's B1-011 helpers (viewer.js overrideRuleFor /
// typographyRuleFor) scoped to the designer's #paper — mirrored, not imported:
// the designer is separate code.
const DISPLAY_FONT_STACKS={sans:'DejaVu Sans, Arial, sans-serif',serif:'DejaVu Serif, Georgia, serif',mono:'DejaVu Sans Mono, monospace',handwriting:'Comic Neue, Segoe Print, Bradley Hand, Comic Sans MS, cursive'};
const DISPLAY_FONT_SIZES=[8,9,10,11,12,14,16,18,20,24];
const DISPLAY_ROUTING=['orthogonal','straight','curved','rounded'];
const DISPLAY_CROSSINGS=['gap','bridge','square_bridge'];
const DISPLAY_ENDPOINT_ORDERING=['optimize','preserve'];
const cssSlug=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const cssString=s=>String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\a ');
const DISPLAY_COLOUR=/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
function displayTypographyRule(code,style){
 const decls=[];
 if(style&&style.family!=null&&style.family!=='source'){const stack=DISPLAY_FONT_STACKS[style.family];if(!stack)fail('DDN-I033','Unknown font family '+style.family+'. Nothing was changed.');decls.push('font-family: '+stack);}
 if(style&&style.size!=null&&style.size!=='source'){const n=Number(style.size);if(!Number.isFinite(n)||n<8||n>24)fail('DDN-I033','Font size must be between 8 and 24px. Nothing was changed.');decls.push('font-size: '+n+'px');}
 if(!decls.length)fail('DDN-I033','A typography rule needs a family or a size. Nothing was changed.');
 return '#paper .ddn-kind-'+cssSlug(code)+' text { '+decls.join('; ')+'; }';
}
function displayColourRule(target,value){
 if(!target||typeof target!=='object')fail('DDN-I033','Colour override target required. Nothing was changed.');
 if(!DISPLAY_COLOUR.test(String(value)))fail('DDN-I033','Colour must be #rgb or #rrggbb. Nothing was changed.');
 if(target.type==='kind'){const c=cssSlug(target.code);return '#paper .ddn-kind-'+c+' > path, #paper .ddn-kind-'+c+' > rect, #paper .ddn-kind-'+c+' > circle, #paper .ddn-kind-'+c+' > ellipse, #paper .ddn-kind-'+c+' > polygon { fill: '+value+'; }';}
 if(target.type==='verb'){const c=cssSlug(target.code);return '#paper .ddn-verb-'+c+' path { stroke: '+value+'; }';}
 if(target.type==='object'){const sel='#paper [data-ddn-id="'+cssString(target.id)+'"]';return sel+' > path, '+sel+' > rect, '+sel+' > circle, '+sel+' > ellipse, '+sel+' > polygon { fill: '+value+'; }';}
 fail('DDN-I033','Unknown colour override type '+target.type+'. Nothing was changed.');
}
function displayCss(state){
 const s=state||{},rules=[];
 for(const [code,style]of Object.entries(s.typography||{}))rules.push(displayTypographyRule(code,style));
 for(const [code,col]of Object.entries(s.kindColours||{}))rules.push(displayColourRule({type:'kind',code},col));
 for(const [code,col]of Object.entries(s.verbColours||{}))rules.push(displayColourRule({type:'verb',code},col));
 for(const [id,col]of Object.entries(s.objectColours||{}))rules.push(displayColourRule({type:'object',id},col));
 return rules.join('\n');
}
// Text download formats (D2). Image formats stay in EXPORT_FORMATS above.
const TEXT_FORMATS=[
 {id:'current',label:'Current file (.ddn)',tooltip:'Download the current entry source file as DDN text; its imports still require their files.'},
 {id:'bundle',label:'Single file — entire workspace (.ddn)',file:'designer-prototype-workspace.ddn',tooltip:'One self-contained sectioned .ddn holding every model/data/view section of the workspace; re-opens anywhere DDN loads.'},
 {id:'zip',label:'ZIP archive (all sources)',file:'designer-prototype-workspace.zip',tooltip:'Download every workspace source as a Studio-openable ZIP.'}
];
// One self-contained sectioned .ddn for the WHOLE workspace via api.io.bundle
// (B1-015). bundle() is entry-reachability-scoped, so each import root is
// bundled and the sections concatenated; a module-id collision between roots
// is a coded rejection, never a silent fallback format (D2).
function bundleWorkspace(D,files,entry){
 const names=Object.keys(files);
 const imported=new Set();
 for(const [name,text]of names.map(n=>[n,files[n]]))for(const imp of D.parse(text,name).imports)imported.add(D.resolvePath(name,imp.path));
 const covered=new Set();
 (function walk(path){if(covered.has(path)||!Object.hasOwn(files,path))return;covered.add(path);for(const imp of D.parse(files[path],path).imports)walk(D.resolvePath(path,imp.path));})(entry);
 const roots=[entry,...names.filter(n=>n!==entry&&!imported.has(n)).sort((a,b)=>a.localeCompare(b,'en'))];
 const seen=new Set(),parts=[];
 for(const root of roots){
  if(root!==entry&&covered.has(root))continue;
  const out=D.io.bundle(files,root).text;
  const lines=out.split('\n');
  if(parts.length===0)parts.push(out.replace(/\n$/,''));
  else{
   const rest=lines.slice(1).join('\n').replace(/^\n+/,'');
   const head=rest.slice(0,rest.search(/^module "/m));
   if(head.trim())fail('DDN-I033','Workspace root '+root+' keeps external imports; the single-file download cannot merge them. Use the ZIP archive.');
   parts.push(rest);
  }
  for(const m of out.matchAll(/^module "([^"]+)";$/gm)){
   if(seen.has(m[1]))fail('DDN-I033','Workspace roots share module '+m[1]+'; the single-file download would be ambiguous. Use the ZIP archive.');
   seen.add(m[1]);
  }
 }
 return parts.join('\n')+'\n';
}
const EXPORT_FORMATS=[
 {id:'ddn',label:'Current DDN',mime:'text/plain;charset=utf-8',guarded:false},
 {id:'zip',label:'Workspace ZIP',file:'designer-prototype-workspace.zip',mime:'application/zip',guarded:false},
 {id:'svg',label:'Current SVG',file:'designer-prototype.svg',mime:'image/svg+xml',guarded:true},
 {id:'png',label:'Current PNG (2×)',file:'designer-prototype.png',mime:'image/png',guarded:true,scale:2},
 {id:'webp',label:'Current WebP (2×)',file:'designer-prototype.webp',mime:'image/webp',guarded:true,scale:2}
];
return{createInView,editProjectionProperty,editViewProperty,occurrences,moveDeclaration,reorderLifelines,addSequenceMessage,setMessageReturn,setMessageLabel,removeSequenceMessage,createLane,renameLane,resizeLane,assignToLane,unassignFromLane,addExistingToView,removeOccurrence,moveOccurrences,setViewOverride,applyCreationAction,prepareReconnect,reconnectRelation,previewReconnect,setMatrixAssignments,editRecordValue,addChartRecord,deleteChartRecord,setChartMark,setChartBinding,setTimelineDates,addTimelineRecord,linkTimelineDependency,unlinkTimelineDependency,setFishboneEffectLabel,addFishboneCategory,addFishboneCause,attachExistingCause,removeFishboneCause,setPanels,renamePanel,movePanelSpan,addPanel,removePanel,movePanelItem,addPanelItem,bindPanelChildView,addDecisionRule,editDecisionRule,reorderDecisionRules,deleteDecisionRule,setDecisionPolicy,evaluateDecisionFixture,createCanvasFromTemplate,CANVAS_TEMPLATES,dataBlocks,defaultFormatRef,validate,classifyCode,pendingViewsAfterCommit,INCOMPLETE_CODE_PREFIXES,INCOMPLETE_CODES,PROJECTION_PROPERTY_KEYS,CHART_BINDING_KEYS,splitters:{SPLITTER_LIMITS,SPLITTER_DEFAULTS,clampWidth,splitterDrag,bootWidth,gridColumns},DENSITY,DENSITY_DEFAULT,EXPORT_FORMATS,TEXT_FORMATS,bundleWorkspace,display:{FONT_STACKS:DISPLAY_FONT_STACKS,FONT_SIZES:DISPLAY_FONT_SIZES,ROUTING:DISPLAY_ROUTING,CROSSINGS:DISPLAY_CROSSINGS,ENDPOINT_ORDERING:DISPLAY_ENDPOINT_ORDERING,typographyRule:displayTypographyRule,colourRule:displayColourRule,css:displayCss,slug:cssSlug}};
});
