/* SPDX-License-Identifier: GPL-2.0-or-later. Source-span edits; no global string replacement.
 * Guided actions validate the resulting workspace before atomic application.
 * Raw text editing intentionally permits temporarily invalid source.
 */
export function installAuthoring(api,backend,assets){
'use strict';
const D=backend.DDN,fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
const idOK=id=>{if(!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(id)||['__proto__','constructor','prototype'].includes(id))fail('DDN-E001','Use a valid, nonreserved DDN identifier.');return id;};
function value(v){if(v===null)return'null';if(typeof v==='string')return JSON.stringify(v);if(typeof v==='boolean'||typeof v==='number')return String(v);if(Array.isArray(v))return'['+v.map(value).join(', ')+']';if(v?.$ref)return'@'+v.$ref;if(v?.$quantity!==undefined)return String(v.$quantity)+v.unit;if(v?.$state)return v.$state;if(v?.$missing)return'missing';return'{ '+Object.entries(v||{}).map(([k,x])=>JSON.stringify(k)+': '+value(x)).join(', ')+' }';}
function build(ws,entry,view){return D.build(ws.getFiles(),entry,view,assets.registry);}
function refFor(b,doc,id){const node=[...b.workspace.symbols.values()].find(n=>n.uid===id);if(!node)fail('DDN-E002','Model identity is not in this workspace.');let answer=null;const seen=new Set();function visit(d,prefix){if(seen.has(d)||answer)return;seen.add(d);if(d===node.doc.file){answer=(prefix?prefix+'.':'')+(!prefix&&node.doc.module!==doc.module?node.doc.module+'.':'')+node.path;return;}for(const [alias,child]of d.imported)visit(child,(prefix?prefix+'.':'')+alias);}visit(doc.file,'');if(!answer)fail('DDN-E003','The edited source does not import the target definition. Add the required import explicitly.');return answer;}
function find(b,id){const n=[...b.workspace.symbols.values()].find(n=>n.uid===id);if(!n)fail('DDN-E002','Definition not found.');return n;}
function propSpan(text,n,key){if(n.bodyStart===undefined)return null;const ts=D.lex(text,n.source).filter(t=>t.start>=n.bodyStart&&t.end<=n.bodyEnd);let depth=0;for(let i=0;i<ts.length;i++){const t=ts[i];if(depth===0&&t.type==='id'&&t.value===key&&ts[i+1]?.type===':'){let j=i+2,d=0;while(j<ts.length){if(ts[j].type===';'&&d===0)return{start:t.start,end:ts[j].end};if(['{','['].includes(ts[j].type))d++;if(['}',']'].includes(ts[j].type))d--;j++;}}if(['{','['].includes(t.type))depth++;if(['}',']'].includes(t.type))depth--;}return null;}
function property(text,n,key,newValue){const span=propSpan(text,n,key),render=newValue===undefined?'':key+': '+value(newValue)+';';if(span)return{file:n.source,...span,text:render};if(newValue===undefined)return null;if(n.bodyStart!==undefined)return{file:n.source,start:n.bodyStart,end:n.bodyStart,text:'\n    '+render+'\n'};return{file:n.source,start:n.end-1,end:n.end,text:' { '+render+' }'};}
function labelEdit(text,n,label){const tokens=D.lex(text,n.source).filter(t=>t.start>=n.start&&t.end<=(n.bodyStart??n.end));const token=tokens[2];if(token?.type==='string')return{file:n.source,start:token.start,end:token.end,text:JSON.stringify(label)};const after=tokens[1].end;return{file:n.source,start:after,end:after,text:' '+JSON.stringify(label)};}
function apply(ws,b,edits,entry,view){return ws.applyEdits(edits.filter(Boolean),{expectedRevision:ws.revision,entry,view});}
function addLocal(ws,entry,view,code,newObjectId){const b=build(ws,entry,view),v=b.viewNode,text=ws.getFiles()[v.source],data=v.doc.declarations.find(n=>n.type==='data'&&n.id==='editor_data'),edits=[];if(data)edits.push({file:v.source,start:data.bodyEnd,end:data.bodyEnd,text:'\n    '+code+'\n'});else{edits.push({file:v.source,start:v.start,end:v.start,text:'data editor_data {\n    '+code+'\n}\n\n'});const ds=Array.isArray(v.props.data)?v.props.data:[v.props.data];edits.push(property(text,v,'data',[...ds,{$ref:'editor_data'}]));}if(newObjectId&&v.props.select)edits.push(property(text,v,'select',[...v.props.select,{$ref:'editor_data.'+newObjectId}]));return apply(ws,b,edits,entry,view);}
api.authoring={
 setMatrixCell(ws,entry,view,row,column,newValue,options={}){if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['remove','id'].includes(k))||options.remove!==undefined&&typeof options.remove!=='boolean')fail('DDN-E007','Matrix edit options require a boolean remove flag and optional id');return this.setMatrixCells(ws,entry,view,[{row,column,...(options.remove?{remove:true}:{value:newValue}),...(options.id?{id:options.id}:{})}]);},
 setMatrixCells(ws,entry,view,changes){
  const b=build(ws,entry,view),p=b.ir.view.profiles.projection,v=b.viewNode,files=ws.getFiles();
  if(p.kind!=='matrix'||!Array.isArray(changes)||!changes.length||changes.length>100)fail('DDN-E007','Matrix changes need a matrix view and 1..100 cell operations');
  const binding=p.value.split('.');if(binding.length<2||!binding[0].startsWith('x_'))fail('DDN-E007','Cell editing requires an explicit extension-property value binding');binding.forEach(idOK);
  const rows=new Set(p.rows.map(r=>r.$ref)),cols=new Set(p.columns.map(r=>r.$ref)),seen=new Set(),edits=[],code=[];
  const selectedData=(Array.isArray(v.props.data)?v.props.data:[v.props.data]).map(r=>b.workspace.resolve(r,v));
  let writeData=p.write_data?[...b.workspace.symbols.values()].find(n=>n.uid===p.write_data.$ref):null;
  if(!writeData){const r=find(b,p.rows[0].$ref);writeData=r.doc.declarations.find(n=>n.type==='data'&&r.path.startsWith(n.path+'.'));}
  const editableWriteData=()=>{if(!writeData||writeData.type!=='data'||!selectedData.some(n=>n.uid===writeData.uid))fail('DDN-E007','New assignments require a shared data block selected by this view; supply projection.write_data explicitly');return writeData;};
  for(const change of changes){if(!change||typeof change!=='object'||Array.isArray(change)||Object.keys(change).some(k=>!['row','column','value','remove','id'].includes(k))||change.remove!==undefined&&typeof change.remove!=='boolean')fail('DDN-E007','Invalid matrix operation');const{row,column}=change,key=p.relation+'|'+row+'|'+column;if(!rows.has(row)||!cols.has(column)||seen.has(key))fail('DDN-E007','Cell outside bound matrix or duplicated in edit batch');seen.add(key);
   const rs=b.ir.relations.filter(r=>r.kind===p.relation&&r.from.element===row&&r.to.element===column);if(rs.length>1)fail('DDN-E007','A joined cell is not a single editable assignment');
   if(change.remove){if(rs.length){const n=find(b,rs[0].id);edits.push({file:n.source,start:n.start,end:n.end,text:''});}continue;}
   if(change.value!==null&&!['string','number','boolean'].includes(typeof change.value)||typeof change.value==='number'&&!Number.isFinite(change.value))fail('DDN-E007','Cell value must be a finite scalar');
   const nested=top=>{const out=clone(top||{});let target=out;for(const k of binding.slice(1,-1)){target[k]=target[k]&&typeof target[k]==='object'?{...target[k]}:{};target=target[k];}target[binding.at(-1)]=change.value;return out;};
   if(rs.length){const n=find(b,rs[0].id);edits.push(property(files[n.source],n,binding[0],nested(n.props[binding[0]])));}
   else{const data=editableWriteData();let id=change.id||'cell_'+api.fingerprint(key).slice(0,10);idOK(id);if(b.workspace.symbols.has(data.doc.module+'::'+data.path+'.'+id))fail('DDN-E007','Cell identifier already exists');const from=refFor(b,data.doc,row),to=refFor(b,data.doc,column);code.push('relation '+id+' '+JSON.stringify('Matrix assignment')+' @'+from+' -> @'+to+' { kind: '+JSON.stringify(p.relation)+'; '+binding[0]+': '+value(nested())+'; }');}
  }
  if(code.length){const data=editableWriteData();edits.push({file:data.source,start:data.bodyEnd,end:data.bodyEnd,text:'\n    '+code.join('\n    ')+'\n'});}
  return apply(ws,b,edits,entry,view);
 },
 setRecordValue(ws,entry,view,id,key,val){idOK(key);const b=build(ws,entry,view),n=find(b,id),record=n.props.x_record;if(!record||typeof record!=='object')fail('DDN-E006','Selected object has no x_record value record');return apply(ws,b,[property(ws.getFiles()[n.source],n,'x_record',{...record,[key]:val})],entry,view);},
 replaceData(ws,name,records){
  if(typeof name!=='string'||!name)fail('DDN-E001','Data block name is required.');
  if(!Array.isArray(records)||records.some(r=>!r||typeof r!=='object'||Array.isArray(r)))fail('DDN-E011','replaceData records must be an array of plain objects.');
  const scalarOK=v=>{if(v===null||typeof v==='string'||typeof v==='boolean')return true;if(typeof v==='number')return Number.isFinite(v);if(Array.isArray(v))return v.every(scalarOK);if(typeof v==='object'){const ks=Object.keys(v);return !ks.some(k=>['__proto__','constructor','prototype'].includes(k))&&ks.every(k=>scalarOK(v[k]));}return false;};
  for(const r of records)for(const x of Object.values(r))if(!scalarOK(x))fail('DDN-E011','Record values must be finite scalars, or arrays/plain objects of them.');
  const files=ws.getFiles(),blocks=[];
  for(const f of Object.keys(files).sort()){let doc;try{doc=D.parse(files[f],f);}catch{continue;}for(const n of doc.declarations)if(n.type==='data'&&n.id===name)blocks.push(n);}
  if(!blocks.length)fail('DDN-E002','Data block not found: '+name);
  if(blocks.length>1)fail('DDN-E002','Data block name is ambiguous across the workspace: '+name+' ('+blocks.length+' blocks)');
  const block=blocks[0],text=files[block.source],recs=block.children.filter(n=>n.props.x_record&&typeof n.props.x_record==='object');
  const result=over=>({committed:false,revision:ws.revision,added:[],removed:[],updated:[],diagnostics:[],...over});
  if(!recs.length){
   if(records.length)fail('DDN-E011','Data block '+name+' declares no records; its field shape cannot be inferred.');
   return result({committed:true});
  }
  const shape=Object.keys(recs[0].props.x_record).sort().join(' ');
  // D1 stable record keys: an optional refresh-level `key` names the target declaration id.
  // Positional fallback applies only when no keys are declared and is order-sensitive.
  const keyed=records.length>0&&Object.hasOwn(records[0],'key')&&!shape.split(' ').includes('key');
  if(keyed){
   if(records.some(r=>!Object.hasOwn(r,'key')))fail('DDN-E011','Record keys are all-or-nothing: either every record carries key, or none does (order-sensitive positional refresh).');
   const seen=new Set();for(const r of records){if(typeof r.key!=='string'||!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(r.key)||['__proto__','constructor','prototype'].includes(r.key))fail('DDN-E011','Record key must be a valid, nonreserved DDN identifier.');if(seen.has(r.key))fail('DDN-E011','Duplicate record key: '+r.key);seen.add(r.key);}
  }
  const payload=r=>{if(!keyed)return r;const out={};for(const [k,v]of Object.entries(r))if(k!=='key')out[k]=v;return out;};
  for(const r of records)if(Object.keys(payload(r)).sort().join(' ')!==shape)fail('DDN-E011','Every record must carry the same keys as the first existing record of '+name+': '+shape);
  let pairs=[],added=[],removed=[],keep=0;
  if(keyed){
   const byId=new Map(recs.map(n=>[n.id,n])),seen=new Set();
   for(const r of records){seen.add(r.key);const t=byId.get(r.key);if(t)pairs.push([t,payload(r)]);else added.push(r);}
   for(const r of added)if(block.children.some(n=>n.id===r.key))fail('DDN-E011','Record key '+r.key+' collides with a non-record declaration in '+name+'.');
   removed=recs.filter(n=>!seen.has(n.id));
  }else{
   keep=Math.min(recs.length,records.length);
   for(let i=0;i<keep;i++)pairs.push([recs[i],{...records[i]}]);
   for(let i=keep;i<records.length;i++)added.push(records[i]);
   removed=recs.slice(keep);
  }
  // D3 value-type validation: field tags are inferred from the block's existing records
  // (null means UNKNOWN and accepts any later tag; incoming null is always legal).
  const tag=v=>v===null?'null':Array.isArray(v)?'array':typeof v;
  const types=new Map();for(const n of recs)for(const [k,v]of Object.entries(n.props.x_record)){if(!types.has(k))types.set(k,new Set());types.get(k).add(tag(v));}
  const typeFailure=(rec,field,t,ts)=>({severity:'error',code:'DDN-E012',record:rec,field,failure:'type-mismatch',message:'Record '+rec+' field '+field+' must remain '+[...ts].join('|')+'; got '+t+'. Refresh commits nothing.'});
  let diagnostics=[];
  for(const [n,r]of pairs)for(const [k,v]of Object.entries(r)){const ts=types.get(k),t=tag(v);if(t!=='null'&&ts&&!ts.has('null')&&!ts.has(t))diagnostics.push(typeFailure(n.id,k,t,ts));}
  for(const r of added)for(const [k,v]of Object.entries(payload(r))){const ts=types.get(k),t=tag(v);if(t!=='null'&&ts&&!ts.has('null')&&!ts.has(t))diagnostics.push(typeFailure(keyed?r.key:null,k,t,ts));}
  if(diagnostics.length)return result({diagnostics});
  const entries=ws.entries(),builds=[];
  for(const e of entries)for(const v of e.views){let built=null,error=null;try{built=build(ws,e.file,v.id);}catch(err){error=err;}builds.push({entry:e.file,view:v.id,built,error});}
  const blockPath=builds.find(b=>b.built)?.built && [...builds.find(b=>b.built).built.workspace.symbols.values()].find(n=>n.type==='data'&&n.id===name&&n.source===block.source)?.path;
  const walk=(x,out)=>{if(Array.isArray(x))for(const v of x)walk(v,out);else if(x&&typeof x==='object'){if(typeof x.$ref==='string')out.push(x.$ref);for(const v of Object.values(x))walk(v,out);}return out;};
  const refsOf=(n,out)=>{if(!n||typeof n!=='object')return out;walk(n.props,out);walk(n.target,out);for(const c of n.children||[])refsOf(c,out);return out;};
  // D4 removal semantics: removing a record a view still references is rejected transactionally.
  if(removed.length){
   const gone=n=>removed.some(r=>r.source===n.source&&r.start===n.start);
   for(const b of builds){if(!b.built)continue;
    for(const r of refsOf(b.built.viewNode,[])){let t=null;try{t=b.built.workspace.resolve({$ref:r},b.built.viewNode);}catch{continue;}
     if(t&&gone(t)&&!diagnostics.some(d=>d.failure==='removed-record-referenced'&&d.view===b.view&&d.record===t.id))diagnostics.push({severity:'error',code:'DDN-E012',view:b.view,entry:b.entry,record:t.id,failure:'removed-record-referenced',message:'View '+b.view+' still references record '+t.id+'; its removal is rejected transactionally. Refresh commits nothing.'});}}
   if(diagnostics.length)return result({diagnostics});
  }
  const edits=[],addedIds=[];
  for(const [n,r]of pairs)edits.push(property(text,n,'x_record',r));
  for(const n of removed){let start=n.start;while(start>0&&(text[start-1]===' '||text[start-1]==='\t'))start--;let end=n.end;if(text[end]==='\r'&&text[end+1]==='\n')end+=2;else if(text[end]==='\n')end++;edits.push({file:block.source,start,end,text:''});}
  if(added.length){const taken=new Set(block.children.map(n=>n.id)),code=[];added.forEach((r,j)=>{let id;if(keyed)id=r.key;else{const base=name+'_r'+(keep+j+1);id=base;let n2=2;while(taken.has(id))id=base+'_'+(n2++);}taken.add(id);addedIds.push(id);code.push('    object '+id+' '+JSON.stringify(id)+' { kind: record; x_record: '+value(payload(r))+'; }');});edits.push({file:block.source,start:block.bodyEnd,end:block.bodyEnd,text:'\n'+code.join('\n')+'\n'});}
  // D3 transactional validation: every workspace view that builds today must still build
  // on the candidate source; any new failure aborts the refresh before anything commits.
  const nextFiles={...files},byFile=new Map();
  for(const e of edits){if(!byFile.has(e.file))byFile.set(e.file,[]);byFile.get(e.file).push(e);}
  for(const [f,list]of byFile){let t=nextFiles[f];for(const e of[...list].sort((a,b)=>b.start-a.start))t=t.slice(0,e.start)+e.text+t.slice(e.end);nextFiles[f]=t;}
  for(const f of byFile.keys())try{D.parse(nextFiles[f],f);}catch(err){diagnostics.push({severity:'error',code:err&&err.code||'DDN-E012',entry:f,failure:'source-validation',message:'Refresh would produce unparseable source in '+f+': '+(err&&err.message||err)+' Refresh commits nothing.'});}
  if(!diagnostics.length)for(const b of builds){if(b.error)continue;try{D.build(nextFiles,b.entry,b.view,assets.registry);}catch(err){diagnostics.push({severity:'error',code:err&&err.code||'DDN-E012',view:b.view,entry:b.entry,failure:'view-validation',message:'Refresh would break view '+b.view+': '+(err&&err.message||err)+' Refresh commits nothing.'});}}
  if(diagnostics.length)return result({diagnostics});
  const revision=ws.applyEdits(edits,{expectedRevision:ws.revision});
  // D2 membership reporting: views binding records explicitly keep exactly those;
  // added records invisible in such views are reported, never silently dropped.
  if(addedIds.length&&blockPath!==undefined)for(const b of builds){if(b.error)continue;let built;try{built=build(ws,b.entry,b.view);}catch{continue;}
   const explicit=new Set();for(const r of refsOf(built.viewNode,[])){let t;try{t=built.workspace.resolve({$ref:r},built.viewNode);}catch{continue;}if(t&&t.path&&t.path.startsWith(blockPath+'.')&&t.props&&t.props.x_record)explicit.add(t.id);}
   const invisible=addedIds.filter(id=>!explicit.has(id));
   if(explicit.size&&invisible.length)diagnostics.push({severity:'warning',code:'DDN-W015',view:b.view,entry:b.entry,addedRecordsNotVisible:invisible,message:'View '+b.view+' binds records explicitly; added record(s) '+invisible.join(', ')+' are not displayed until the view binding lists them. Selector-membership views pick them up automatically.'});}
  return result({committed:true,revision,added:addedIds,removed:removed.map(n=>n.id),updated:pairs.map(([n])=>n.id),diagnostics});
 },
 setAssignment(ws,entry,view,id,code){const b=build(ws,entry,view),n=find(b,id);if(n.type!=='relation'||!n.props.x_assignment)fail('DDN-E006','Not an assignment relationship');return apply(ws,b,[property(ws.getFiles()[n.source],n,'x_assignment',{code})],entry,view);},
 value,
 setLabel(ws,entry,view,id,label){if(typeof label!=='string'||label.length>4096)fail('DDN-E001','Label must be text up to 4096 characters.');const b=build(ws,entry,view),n=find(b,id);return apply(ws,b,[labelEdit(ws.getFiles()[n.source],n,label)],entry,view);},
 setProperty(ws,entry,view,id,key,v){idOK(key);const b=build(ws,entry,view),n=find(b,id);return apply(ws,b,[property(ws.getFiles()[n.source],n,key,v)],entry,view);},
 pin(ws,entry,view,id,x,y){if(!['graph'].includes(ws.resolve(entry,view).view.profiles.projection?.kind||'graph'))fail('DDN-E006','This view uses data-bound coordinates; edit the underlying values rather than pinning a mark.');if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1e7||Math.abs(y)>1e7)fail('DDN-E001','Position must be finite, bounded world coordinates.');const b=build(ws,entry,view),v=b.viewNode,ref=refFor(b,v.doc,id),pl=v.children.find(n=>n.type==='place'&&b.workspace.resolve(n.target,n).uid===id),at=[{$quantity:Math.round(x*1000)/1000,unit:'px'},{$quantity:Math.round(y*1000)/1000,unit:'px'}];const edit=pl?property(ws.getFiles()[pl.source],pl,'at',at):{file:v.source,start:v.bodyEnd,end:v.bodyEnd,text:'\n    place @'+ref+' { at: '+value(at)+'; }\n'};return apply(ws,b,[edit],entry,view);},
 unpin(ws,entry,view,id){const b=build(ws,entry,view),v=b.viewNode,pl=v.children.find(n=>n.type==='place'&&b.workspace.resolve(n.target,n).uid===id);if(!pl||pl.props.at===undefined)return false;const e=Object.keys(pl.props).length===1?{file:pl.source,start:pl.start,end:pl.end,text:''}:property(ws.getFiles()[pl.source],pl,'at',undefined);return apply(ws,b,[e],entry,view);},
 hide(ws,entry,view,id){const b=build(ws,entry,view),v=b.viewNode,ref=refFor(b,v.doc,id),list=v.props.exclude||[];if(list.some(r=>b.workspace.resolve(r,v).uid===id))return false;return apply(ws,b,[property(ws.getFiles()[v.source],v,'exclude',[...list,{$ref:ref}])],entry,view);},
 addElement(ws,entry,view,{id,name,kind='object'}){idOK(id);if(!api.kinds.some(k=>k.id===kind))fail('DDN-E001','Unknown object kind.');return addLocal(ws,entry,view,'object '+id+' '+JSON.stringify(name||id)+' { kind: '+JSON.stringify(kind)+'; }',id);},
 addField(ws,entry,view,parentId,{id,name}){idOK(id);const b=build(ws,entry,view),n=find(b,parentId),fields=n.children.find(g=>g.group&&g.type==='fields');const code='field '+id+(name?' '+JSON.stringify(name):'')+';';let edit;if(fields)edit={file:n.source,start:fields.bodyEnd,end:fields.bodyEnd,text:'\n        '+code+'\n    '};else if(n.bodyEnd!==undefined)edit={file:n.source,start:n.bodyEnd,end:n.bodyEnd,text:'\n    fields { '+code+' }\n'};else edit={file:n.source,start:n.end-1,end:n.end,text:' { fields { '+code+' } }'};return apply(ws,b,[edit],entry,view);},
 addRelation(ws,entry,view,{id,name,kind='assoc',from,to}){idOK(id);if(!api.relations.some(k=>k.id===kind))fail('DDN-E001','Unknown relationship kind.');const b=build(ws,entry,view),v=b.viewNode,src=refFor(b,v.doc,from),dst=refFor(b,v.doc,to);return addLocal(ws,entry,view,'relation '+id+' '+JSON.stringify(name||id)+' @'+src+' -> @'+dst+' { kind: '+JSON.stringify(kind)+'; }');},
 deleteDefinition(ws,entry,view,id){const b=build(ws,entry,view),n=find(b,id),files=ws.getFiles();let references=0;for(const d of b.workspace.docs.values())for(const t of D.lex(files[d.source],d.source))if(t.type==='@'&&(d.source!==n.source||t.start<n.start||t.start>=n.end)){
  // Resolve complete reference against its indexed lexical owner.
  const owner=[...b.workspace.symbols.values()].filter(x=>x.source===d.source&&x.start<=t.start&&x.end>=t.end).sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];if(!owner)continue;
  const tail=files[d.source].slice(t.end).match(/^[A-Za-z_][A-Za-z0-9_-]*(?:\.[A-Za-z_][A-Za-z0-9_-]*)*/);if(tail)try{const target=b.workspace.resolve({$ref:tail[0]},owner);if(target.uid===id||target.uid.startsWith(id+'.'))references++;}catch{}
 }if(references)fail('DDN-E004',references+' references depend on this definition. Remove/reassign them in source first, or hide its appearance.');return apply(ws,b,[{file:n.source,start:n.start,end:n.end,text:''}],entry,view);},
 sourceOf(ws,entry,view,id){const b=build(ws,entry,view),n=find(b,id);return{file:n.source,start:n.start,end:n.end,type:n.type,id:n.id,name:n.label||n.id,properties:clone(n.props)};}
};
function clone(v){return JSON.parse(JSON.stringify(v));}
}
