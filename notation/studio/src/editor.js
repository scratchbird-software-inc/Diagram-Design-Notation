/* SPDX-License-Identifier: GPL-2.0-or-later. Preview/apply edits to notation files. */
import {draftWorkspaces} from './draft-context.js';
const METHODS=new Set(['addElement','addField','addRelation','setLabel','setProperty','setElementProperties','setComposition','setDocument','pin','unpin','hide','addOccurrence','addRelationOccurrence','setOccurrencePresentation','setViewProperties','setViewProfile','setMatrixCells','setColumnLayout','renameDefinition']);
function copy(x){
 if(x===null||x===undefined||['string','number','boolean'].includes(typeof x))return x;
 if(Array.isArray(x))return x.map(copy);
 if(typeof x==='object'){
  // Plain data objects may originate in an embedding host's other realm.
  const proto=Object.getPrototypeOf(x);
  if(proto===null||Object.getPrototypeOf(proto)===null)return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,copy(v)]));
 }
 throw new TypeError('Edit commands contain only data values.');
}
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
export function createEditor(api,ws,applyFiles,alive,options={}){
 const plans=new WeakMap(),canWrite=options.canWrite??(()=>true);
 if(typeof canWrite!=='function')throw new TypeError('canWrite must be a function');
 const fail=(code,message,detail={})=>{const e=new Error(message);Object.assign(e,detail,{code});throw e;};
 const current=revision=>{alive();if(ws.revision!==revision)fail('LIVE030','Source changed since this edit was prepared.');};
 const policy=changes=>{for(const change of changes)if(canWrite(change.file)!==true)fail('LIVE051','Writing this file is not authorized: '+change.file);};
 function inspect(scratch,request){
  const diagnostics=[],views=[];
  // Deliberately conservative: validate every file and every declared view.
  // No claim of all-view validity based on only the currently displayed view.
  for(const file of Object.keys(scratch.getFiles()))scratch.analyze(file);
  const target=scratch.validateDraft(request.entry,request.view);
  diagnostics.push(...target.diagnostics);
  for(const item of scratch.entries())for(const view of item.views){
   const result=scratch.validateDraft(item.file,view.id);
   views.push({file:item.file,view:view.id,status:result.status});
   if(item.file!==request.entry||view.id!==request.view)diagnostics.push(...result.diagnostics);
  }
  const blocked=diagnostics.find(d=>d.severity==='error'||request.mode==='review'&&d.severity==='incomplete');
  if(blocked)fail(blocked.code,blocked.message,{source:blocked.source,offset:blocked.offset,diagnostics});
  return {status:diagnostics.some(d=>d.severity==='incomplete')?'incomplete':'valid',diagnostics,views};
 }
 return Object.freeze({
  methods:Object.freeze([...METHODS]),
  capture(input,edit){if(typeof edit!=='function')fail('LIVE050','Capture requires a synchronous edit callback.');return this.preview(input,edit);},
  preview(input,prepare){
   alive();const baseRevision=ws.revision,request=copy(input);
   if(!request||typeof request.entry!=='string'||typeof request.view!=='string'||(!prepare&&(!Array.isArray(request.operations)||!request.operations.length||request.operations.length>256)))fail('LIVE050','Preview requires entry, view and a nonempty operations array.');
   request.mode??='design';if(!['design','review'].includes(request.mode))fail('LIVE050','Unknown edit mode.');
   if(request.expectedRevision!==undefined&&request.expectedRevision!==baseRevision)fail('LIVE030','Source changed since this edit was prepared.');
   const before=ws.getFiles(),scratch=api.createWorkspace(before);draftWorkspaces.add(scratch);
   try{
    const results=[];
    if(prepare){const result=prepare(scratch);if(result&&typeof result.then==='function'){result.catch(()=>{});fail('LIVE050','Capture callbacks must be synchronous.');}results.push(copy(result));}
    for(const op of prepare?[]:request.operations){
     if(op.type==='files')results.push(scratch.updateFiles(op.changes));
     else if(op.type==='edits')results.push(scratch.applyEdits(op.edits));
     else if(op.type==='authoring'&&METHODS.has(op.method)&&Array.isArray(op.args))results.push(api.authoring[op.method](scratch,request.entry,request.view,...op.args));
     else fail('LIVE050','Unsupported preview operation.');
    }
    const next=scratch.getFiles(),changes=[...new Set([...Object.keys(next),...Object.keys(before)])].filter(file=>next[file]!==before[file]).sort().map(file=>({file,before:before[file]??null,after:next[file]??null,beforeHash:before[file]===undefined?null:api.documentFormats.digest(before[file]),afterHash:next[file]===undefined?null:api.documentFormats.digest(next[file])}));
    policy(changes);current(baseRevision);
    const validation=inspect(scratch,request);
    const plan=freeze({format:'ddn-edit-plan@1',baseRevision,label:typeof request.label==='string'?request.label:'Edit diagram',entry:request.entry,view:request.view,mode:request.mode,changes,results,...validation});
    plans.set(plan,{next,request});return plan;
   }finally{draftWorkspaces.delete(scratch);scratch.destroy();}
  },
  apply(plan){
   const saved=plans.get(plan);if(!saved)fail('LIVE052','Unknown, cancelled or already applied plan. Preview again.');
   current(plan.baseRevision);policy(plan.changes);current(plan.baseRevision);
   const scratch=api.createWorkspace(saved.next);
   try{inspect(scratch,saved.request);}finally{scratch.destroy();}
   current(plan.baseRevision);plans.delete(plan);
   return applyFiles(saved.next,plan.label);
  },
  cancel(plan){return plans.delete(plan);},
  validate(entry,view){alive();return ws.validateDraft(entry,view);},
  previewLayout(entry,view){
   alive();if(typeof entry==='string')return ws.previewDraft(entry,view);
   const saved=plans.get(entry);if(!saved)fail('LIVE052','Unknown, cancelled or already applied plan. Preview again.');
   current(entry.baseRevision);const scratch=api.createWorkspace(saved.next);
   try{return scratch.previewDraft(saved.request.entry,saved.request.view);}finally{scratch.destroy();}
  }
 });
}
