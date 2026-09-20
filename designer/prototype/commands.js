/* SPDX-License-Identifier: GPL-2.0-or-later. Designer command layer: staged
 * source transactions shared by the prototype and the Node test suites.
 * Each command runs on a scratch workspace, validates, then commits one
 * applyEdits against the caller's expected revision. No dependencies.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DesignerCommands=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
// Analysis failures a decision-table draft may carry (VE-007): the commit
// stands, the committed re-render surfaces the runtime's own error.
const DECISION_DRAFT_CODES=['DDN-QD004','DDN-QD005','DDN-QD008'];
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
     if(!DECISION_DRAFT_CODES.includes(e.code))throw e;
     // Draft commit (VE-007): parse-only validation; the analysis error stays
     // visible in the committed re-render and publish stays blocked.
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
   catch(e){if(!DECISION_DRAFT_CODES.includes(e.code))throw e;t.applyEdits([edit],{expectedRevision:t.revision});}
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
 catch(e){if(DECISION_DRAFT_CODES.includes(e.code))return{draft:{code:e.code,message:e.message}};throw e;}
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
 catch(e){if(!DECISION_DRAFT_CODES.includes(e.code))throw e;t.applyEdits([edit],{expectedRevision:t.revision});}
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
function removeOccurrence(D,ws,entry,args){
 const {viewId,occurrenceId}=args||{};
 const r=resolveOccurrence(D,ws,entry,viewId,occurrenceId);
 if(r.role==='relation')return{status:'unsupported',reason:'The 0.5 runtime has no independent relation-hide: a relation occurrence can only disappear with an endpoint or via display { relations:none; }. The source is unchanged.'};
 return stage(D,ws,entry,viewId,t=>{
  D.authoring.hide(t,entry,viewId,r.definitionId);
  return{status:'removed',occurrenceId,removed:r.definitionId};
 });
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
return{createInView,editProjectionProperty,editViewProperty,occurrences,addExistingToView,removeOccurrence,moveOccurrences,setViewOverride,applyCreationAction,prepareReconnect,reconnectRelation,previewReconnect,setMatrixAssignments,editRecordValue,addChartRecord,deleteChartRecord,setChartMark,setChartBinding,setTimelineDates,addTimelineRecord,linkTimelineDependency,unlinkTimelineDependency,setFishboneEffectLabel,addFishboneCategory,addFishboneCause,attachExistingCause,removeFishboneCause,setPanels,renamePanel,movePanelSpan,addPanel,removePanel,movePanelItem,addPanelItem,bindPanelChildView,addDecisionRule,editDecisionRule,reorderDecisionRules,deleteDecisionRule,setDecisionPolicy,evaluateDecisionFixture,PROJECTION_PROPERTY_KEYS,CHART_BINDING_KEYS};
});
