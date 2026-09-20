/* SPDX-License-Identifier: GPL-2.0-or-later. Designer command layer: staged
 * source transactions shared by the prototype and the Node test suites.
 * Each command runs on a scratch workspace, validates, then commits one
 * applyEdits against the caller's expected revision. No dependencies.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DesignerCommands=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
function stage(D,ws,entry,view,fn){
 const before=ws.getFiles(),revision=ws.revision,t=D.createWorkspace(before);
 try{
  const value=fn(t);
  const after=t.getFiles();
  const edits=Object.keys(after).filter(f=>before[f]!==after[f]).map(f=>({file:f,start:0,end:(before[f]||'').length,text:after[f]}));
  if(edits.length)ws.applyEdits(edits,{expectedRevision:revision,entry,view});
  return value;
 }finally{t.destroy();}
}
// Kinds whose validators require properties at creation time (found empirically:
// a bare `kind` declaration does not validate). Defaults are explicit, visible
// source values, never silent rewrites.
const CREATION_DEFAULTS={
 'req.requirement':id=>({x_diagram:{code:String(id).toUpperCase().replace(/[^A-Z0-9]+/g,'_'),text:'Undecided requirement statement'}}),
};
function createInView(D,ws,entry,view,args){
 const {id,name,kind,at,properties}=args||{};
 const initial=properties||CREATION_DEFAULTS[kind]?.(id);
 return stage(D,ws,entry,view,t=>{
  D.authoring.addElement(t,entry,view,{id,name,kind:initial?'object':kind});
  const n=t.resolve(entry,view).elements.find(n=>n.local===id);
  if(!n)fail('DDN-I033','Created element not found in the resolved view.');
  if(initial){for(const [k,v]of Object.entries(initial))D.authoring.setProperty(t,entry,view,n.id,k,v);D.authoring.setProperty(t,entry,view,n.id,'kind',kind);}
  if(at)D.authoring.pin(t,entry,view,n.id,at.x,at.y);
  return{select:n.id};
 });
}
const PROJECTION_PROPERTY_KEYS=['mark','records','dependencies','x','y','unit','x_type','aggregate','missing','series'];
function editProjectionProperty(D,ws,entry,view,args){
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
  t.applyEdits([edit],{expectedRevision:t.revision,entry,view});
  return{key,...(removing?{removed:true}:{})};
 });
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
function setMatrixAssignments(D,ws,entry,view,args){
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
 });
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
return{createInView,editProjectionProperty,applyCreationAction,setMatrixAssignments,editRecordValue,addChartRecord,deleteChartRecord,setChartMark,setChartBinding,setTimelineDates,addTimelineRecord,linkTimelineDependency,unlinkTimelineDependency,setFishboneEffectLabel,addFishboneCategory,addFishboneCause,attachExistingCause,removeFishboneCause,PROJECTION_PROPERTY_KEYS,CHART_BINDING_KEYS};
});
