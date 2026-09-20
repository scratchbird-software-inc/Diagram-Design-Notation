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
const PROJECTION_PROPERTY_KEYS=['mark','records','dependencies'];
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
  const render=key+': '+D.authoring.value(value)+';';
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
  if(!edit)edit={file:span.file,start:tokens[close].start,end:tokens[close].start,text:render+' '};
  t.applyEdits([edit],{expectedRevision:t.revision,entry,view});
  return{key};
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
return{createInView,editProjectionProperty,applyCreationAction,PROJECTION_PROPERTY_KEYS};
});
