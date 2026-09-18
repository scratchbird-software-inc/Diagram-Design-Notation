/* SPDX-License-Identifier: GPL-2.0-or-later. Explicit allowlist export, separate from display hiding.
 * The caller is responsible for authorization and classification decisions. This is not a DLP classifier.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DDNExport=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const ref=v=>typeof v==='string'?v:v?.$ref;
const copy=x=>JSON.parse(JSON.stringify(x));
function project(ir){
 const policy=ir.view.profiles.export||{mode:'full'};if(policy.mode!=='redacted')return ir;
 if(!Array.isArray(policy.elements)||!Array.isArray(policy.fields)||!policy.elements.length)throw Object.assign(new Error('Redacted export requires explicit nonempty elements and an explicit field allowlist'),{code:'DDN150'});
 if(policy.include_samples)throw Object.assign(new Error('Public sample export needs a separately approved payload fixture; unsupported in redacted profile'),{code:'DDN154'});
 const allowed=new Set(policy.elements.map(ref)),allowedFields=new Set(policy.fields.map(ref)),all=new Set(ir.elements.map(n=>n.id));
 for(const id of allowed)if(!all.has(id))throw Object.assign(new Error('Export allowlist contains an unresolved object'),{code:'DDN151'});
 const names=new Map(),alias=id=>{if(!names.has(id))names.set(id,policy.identifier_mode==='preserve'?id:'published::n'+String(names.size+1).padStart(4,'0'));return names.get(id);};
 const safeProperties=new Set(['kind','level','shape','presence','nullable','key','datatype','domain','unit','maturity','workload','role','temporal','distribution','location','direction']);
 const keep=new Set(policy.properties||[]);
 for(const key of keep)if(!safeProperties.has(key))throw Object.assign(new Error('Redacted property is not in the safe structural vocabulary: '+key),{code:'DDN152'});
 const approved=[...ir.elements].filter(n=>allowed.has(n.id)&&n.type!=='sample'&&n.kind!=='sample');
 approved.sort((a,b)=>a.id.localeCompare(b.id)).forEach(n=>{alias(n.id);n.fields.filter(f=>allowedFields.has(f.id)).forEach(f=>alias(f.id));});
 function value(v){if(v===null||typeof v!=='object')return v;if(Array.isArray(v))return v.map(value).filter(x=>x!==undefined);if(v.$ref)return names.has(v.$ref)?{$ref:alias(v.$ref)}:undefined;const out={};for(const[k,x]of Object.entries(v)){const p=value(x);if(p!==undefined)out[k]=p;}return out;}
 function props(p){const out={};for(const[k,v]of Object.entries(p||{}))if(keep.has(k)){const x=value(v);if(x!==undefined)out[k]=x;}return out;}
 const elements=approved.map(n=>({id:alias(n.id),ref:alias(n.id),local:alias(n.id).split('::')[1],name:n.name,type:n.type,kind:n.kind,kindCode:n.kindCode,properties:props(n.properties),fields:n.fields.filter(f=>allowedFields.has(f.id)).map(f=>{
  if(f.parent&&!allowedFields.has(f.parent))throw Object.assign(new Error('A nested field export must explicitly include its ancestor fields'),{code:'DDN153'});
  return{id:alias(f.id),local:f.local,name:f.name,path:f.path,depth:f.depth,parent:f.parent?alias(f.parent):null,properties:props(f.properties)};
 }),ports:[]}));
 const selected=ir.view.selected.filter(id=>allowed.has(id)&&approved.some(n=>n.id===id)).map(alias),shown=new Set(selected);
 const rels=ir.relations.filter(r=>allowed.has(r.from.element)&&allowed.has(r.to.element)&&(!r.from.member||allowedFields.has(r.from.member))&&(!r.to.member||allowedFields.has(r.to.member))).map(r=>({id:alias(r.id),ref:alias(r.id),name:r.kind,kind:r.kind,kindCode:r.kindCode,from:{element:alias(r.from.element),...(r.from.member?{member:alias(r.from.member),role:'field'}:{})},to:{element:alias(r.to.element),...(r.to.member?{member:alias(r.to.member),role:'field'}:{})},properties:{}}));
 const profiles=copy(ir.view.profiles);profiles.export={mode:'full'};delete profiles.publication.caption;profiles.publication.title=policy.title||'Published data view';profiles.validation={mode:'logical',unknown_extensions:'warn'};profiles.legend.keys={};delete profiles.legend.keyset;delete profiles.layout.root;for(const group of Object.values(profiles))if(group&&typeof group==='object')for(const key of Object.keys(group))if(key.startsWith('x_'))delete group[key];
 const keys={};for(const r of ir.relations)if(names.has(r.id)&&ir.view.keys[r.id])keys[alias(r.id)]=ir.view.keys[r.id];
 const output={format:'ddn-resolved@0.3',language:'0.3',registry:ir.registry,entry:'published.ddn',view:{id:'published::view',name:policy.title||'Published data view',local:'published',selected,relations:rels.filter(r=>shown.has(r.from.element)&&shown.has(r.to.element)).map(r=>r.id),profiles,keys,placements:{},routes:{},subdiagrams:[],frames:[]},elements,relations:rels,diagnostics:[{code:'DDN-PUBLIC',severity:'info',message:'Allowlist projection. Source locations, free-text metadata, examples, and inline views removed.'}],publication:{audience:'allowlisted',sourceIncluded:false,samplesIncluded:false}};
 // Deliberately no counts or identifiers of excluded records: those can themselves disclose information.
 return output;
}
function serialize(ir){return JSON.stringify(project(ir),null,2)+'\n';}
return {project,serialize};
});
