/* SPDX-License-Identifier: GPL-2.0-or-later. DDN profile packs: data-only definitions and bounded validators. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../../standard/registry/profiles/catalogue.json'),require('./ddn-projection-data'),require('./ddn-profile-quality'));else root.DDNProfiles=factory(root.DDNProfileCatalogue,root.DDNProjectionData,root.DDNProfileQuality);})(typeof globalThis!=='undefined'?globalThis:this,function(catalogue,Bindings,Extra){
'use strict';
const VERSION='0.5.0-draft.2';
const cache=new WeakMap();
function registry(base){
 if(cache.has(base))return cache.get(base);
 const out={...base,kinds:base.kinds.slice(),relationships:base.relationships.slice(),extension_contracts:{...base.extension_contracts}};
 for(const k of catalogue.kinds){const b=base.kinds.find(x=>x.keyword===k.fallback)||base.kinds[0],f=base.families[k.family]||base.families.concept;out.kinds.push({...b,...k,id:'profile-kind.'+k.keyword,aliases:[],colour:f.colour,fill:f.fill,text_label:k.name,slot:'NW',profileKind:true});}
 for(const r of catalogue.relationships){const family=r.family==='data_flow'?'flow':r.family,b=base.relationships.find(x=>x.family===family)||base.relationships[0];out.relationships.push({...b,...r,family,id:'profile-relation.'+r.keyword,pattern:r.keyword==='uml.realization'?'7 5':r.keyword.startsWith('flow.')?'':b.pattern,aliases:[],endpoint_contract:{source:r.source,target:r.target,allow_self:r.allow_self,member_endpoints:r.member_endpoints}});}
 const def=(schema,targets=['object'])=>({targets:Object.fromEntries(targets.map(t=>[t,schema]))});
 out.extension_contracts.x_record=def({type:'object',additionalProperties:true},['object','relation']);
 out.extension_contracts.x_story=def({type:'object',required:['task'],additionalProperties:true},['relation']);
 for(const key of ['x_rule','x_state','x_transition','x_usecase','x_chen','x_continuation'])out.extension_contracts[key]=def({type:'object',additionalProperties:true},key==='x_chen'?['object','field','relation']:['object','relation']);
 out.extension_contracts.x_assignment=def({type:'object',required:['code'],properties:{code:{type:'string',minLength:1,maxLength:12}},additionalProperties:false},['relation']);
 out.extension_contracts.x_category=def({type:'object',required:['axis','level'],properties:{axis:{type:'string',minLength:1},level:{type:'string',minLength:1}},additionalProperties:false},['object']);
 out.extension_contracts.x_member=def({type:'object',properties:{kind:{enum:['attribute','operation']},visibility:{enum:['public','private','protected','package']},static:{type:'boolean'},abstract:{type:'boolean'}},additionalProperties:false},['field']);
 out.extension_contracts.x_diagram=def({type:'object',properties:{number:{type:'string',minLength:1},owner:{type:'string'},code:{type:'string'},text:{type:'string'},branch:{type:'string'},stereotype:{type:'string'}},additionalProperties:false},['object','relation']);
 out.extension_contracts.x_epc=def({type:'object',properties:{operator:{type:'string'}},additionalProperties:false},['object']);
 out.extension_contracts.x_sets=def({type:'array',items:{type:'string',minLength:1},minItems:1,maxItems:3,uniqueItems:true},['object']);
 out.extension_contracts.x_return=def({type:'boolean'},['relation']);
 cache.set(base,out);cache.set(out,out);return out;
}
const get=id=>catalogue.profiles.find(x=>x.id===id);
function validate(ir,reg,ErrorClass){
 const p=ir.view.profiles.projection||{kind:'graph',profile:'ddn@1'},profile=get(p.profile),nodes=new Map(ir.elements.map(n=>[n.id,n])),rels=ir.relations;
 const fail=(code,message,n)=>{throw new ErrorClass(code,message,n?.source?.file||ir.view.source?.file,n?.source?.start||ir.view.source?.start);};
 if(!profile)fail('DDN-PF001','Unknown or uninstalled diagram profile '+p.profile);
 if(profile.projection!==p.kind)fail('DDN-PF002',p.profile+' requires projection '+profile.projection+', not '+p.kind);
 for(const n of ir.elements){
  if(n.kind.startsWith('flow.')&&n.fields.length)fail('DDN-PF003','Flowchart symbols have labels, not attribute compartments',n);
  if(['uml.actor','uml.usecase'].includes(n.kind)&&n.fields.length)fail('DDN-PF003','Actor/use-case symbol does not support attribute fields',n);
  if(n.kind.startsWith('c4.')&&n.fields.length)fail('DDN-PF003','C4 symbols have labels, not attribute compartments',n);
  if(n.kind.startsWith('epk.')&&n.fields.length)fail('DDN-PF003','EPC symbols have labels, not attribute compartments',n);
 }
 function acyclic(kinds,label){const es=rels.filter(r=>kinds.includes(r.kind)),kids=new Map();for(const r of es){if(!kids.has(r.from.element))kids.set(r.from.element,[]);kids.get(r.from.element).push(r.to.element);}const active=new Set(),seen=new Set();function visit(id){if(active.has(id))fail('DDN-PF004',label+' contains a cycle');if(seen.has(id))return;active.add(id);for(const c of kids.get(id)||[])visit(c);active.delete(id);seen.add(id);}for(const id of kids.keys())visit(id);}
 acyclic(['uml.generalization'],'Generalization');acyclic(['uml.include'],'Use-case include');acyclic(['req.derives'],'Requirement derivation');
 for(const r of rels){const a=nodes.get(r.from.element),b=nodes.get(r.to.element);
  if(r.kind==='uml.generalization'&&a.kind!==b.kind)fail('DDN-PF005','Generalization endpoints must have the same declared classifier kind',r);
  if(r.kind==='dfd.data'&&a.kind!=='dfd.process'&&b.kind!=='dfd.process')fail('DDN-PF006','A DFD transfer must involve a process; store/external shortcuts are invalid',r);
 }
 if(ir.view.profiles.export.mode==='redacted'&&ir.elements.some(n=>n.kind.includes('.')))fail('DDN-PJ003','Profile-specific redacted projection is not qualified; provide a separately authorized workspace');
 const shown=new Set(ir.view.selected),ns=ir.elements.filter(n=>shown.has(n.id)),es=rels.filter(r=>shown.has(r.from.element)&&shown.has(r.to.element));
 if(p.profile==='flow.basic@1'||p.profile==='flow.documented@2'){
  if(ns.some(n=>!n.kind.startsWith('flow.')))fail('DDN-PF007','Flowchart projection accepts flow.* participants only');
  if(p.profile==='flow.basic@1'&&es.some(r=>r.kind!=='flow.next'))fail('DDN-PF007','Flowchart projection accepts flow.next links only');
  const control=es.filter(r=>['flow.next','flow.continues'].includes(r.kind)),activeNodes=ns.filter(n=>n.kind!=='flow.annotation');
  const incoming=id=>control.filter(r=>r.to.element===id),outgoing=id=>control.filter(r=>r.from.element===id),starts=ns.filter(n=>n.kind==='flow.start'),ends=ns.filter(n=>n.kind==='flow.end');
  if(!starts.length||!ends.length)fail('DDN-PF008','Closed flowchart needs a start and an end');
  for(const n of ns){if(n.kind==='flow.start'&&incoming(n.id).length)fail('DDN-PF008','Start cannot have incoming control',n);if(n.kind==='flow.end'&&outgoing(n.id).length)fail('DDN-PF008','End cannot have outgoing control',n);
   if(n.kind==='flow.decision'){const branches=outgoing(n.id).map(r=>r.properties.x_diagram?.branch);if(branches.length<2||branches.some(x=>typeof x!=='string'||!x.trim())||new Set(branches).size!==branches.length)fail('DDN-PF009','Decision requires at least two explicitly named, distinct branches',n);}}
  const reach=(roots,reverse)=>{const seen=new Set(roots.map(n=>n.id)),q=[...seen];while(q.length){const id=q.shift();for(const r of control){if((reverse?r.to.element:r.from.element)===id){const t=reverse?r.from.element:r.to.element;if(!seen.has(t)){seen.add(t);q.push(t);}}}}return seen;};
  const a=reach(starts,false),b=reach(ends,true);if(activeNodes.some(n=>!a.has(n.id)||!b.has(n.id)))fail('DDN-PF010','Every flowchart symbol must be reachable from a start and able to reach an end');
 }
 if(p.profile.startsWith('dfd.')){
  if(ns.some(n=>!n.kind.startsWith('dfd.'))||es.some(r=>r.kind!=='dfd.data'))fail('DDN-PF011','DFD profile requires dfd participants and dfd.data links');
  const nums=new Set();for(const n of ns.filter(n=>n.kind==='dfd.process')){const num=n.properties.x_diagram?.number;if(!num||nums.has(num))fail('DDN-PF012','DFD process number must be nonempty and unique',n);nums.add(num);if(!es.some(r=>r.to.element===n.id)||!es.some(r=>r.from.element===n.id))fail('DDN-PF013','DFD process needs input and output',n);}
 }
 function singleRoot(kinds,message){const incoming=new Set(es.filter(r=>kinds.includes(r.kind)).map(r=>r.to.element));if(ns.filter(n=>!incoming.has(n.id)).length!==1)fail('DDN-PJ102',message);}
 if(p.profile==='org.tree@1'){
  if(ns.some(n=>!['organization','team','role','analysis.role'].includes(n.kind)))fail('DDN-PF007','org.tree@1 accepts organization, team, role, analysis.role participants only');
  if(es.some(r=>r.kind!=='reports_to'))fail('DDN-PF007','org.tree@1 accepts reports_to links only');
  acyclic(['reports_to'],'Org chart');
  singleRoot(['reports_to'],'org.tree@1 requires exactly one root — one person reports to nobody');
 }
 if(p.profile==='wbs.tree@1'){
  if(ns.some(n=>n.kind!=='analysis.task'))fail('DDN-PF007','wbs.tree@1 accepts analysis.task participants only');
  if(es.some(r=>r.kind!=='analysis.decomposes'))fail('DDN-PF007','wbs.tree@1 accepts analysis.decomposes links only');
  acyclic(['analysis.decomposes'],'WBS');
  singleRoot(['analysis.decomposes'],'wbs.tree@1 requires exactly one root — one deliverable decomposes from nothing');
 }
 if(p.profile==='mindmap.basic@1'){
  if(ns.some(n=>!['object','entity','term','domain'].includes(n.kind)))fail('DDN-PF007','mindmap.basic@1 accepts object, entity, term, domain participants only');
  if(es.some(r=>r.kind!=='assoc'))fail('DDN-PF007','mindmap.basic@1 accepts assoc links only');
  if(ir.view.profiles.layout.algorithm!=='mindmap')fail('DDN-PF007','mindmap.basic@1 requires layout algorithm mindmap');
  acyclic(['assoc'],'Mind map');
  singleRoot(['assoc'],'mindmap.basic@1 requires exactly one root — one topic branches from nothing');
 }
 if(p.profile==='concept.map@1'){
  if(ns.some(n=>!['object','entity','term','domain'].includes(n.kind)))fail('DDN-PF007','concept.map@1 accepts object, entity, term, domain participants only');
  if(es.some(r=>!['assoc','ref'].includes(r.kind)))fail('DDN-PF007','concept.map@1 accepts assoc and ref links only');
  for(const r of es){const def=reg.relationships.find(k=>k.keyword===r.kind)?.name;if(!r.name||r.name===def)fail('DDN-PJ104','concept.map@1 relations need an explicit domain label; "'+def+'" is only the verb default',r);}
 }
 if(p.profile.startsWith('c4.')){
  const ok={'c4.context@1':['c4.person','c4.system'],'c4.container@1':['c4.person','c4.system','c4.container','c4.store','c4.queue'],'c4.component@1':['c4.person','c4.system','c4.container','c4.store','c4.component']}[p.profile];
  const ext={'c4.container@1':['c4.person'],'c4.component@1':['c4.person','c4.system','c4.store']}[p.profile]||[];
  if(p.profile==='c4.context@1'&&es.some(r=>r.from.member||r.to.member))fail('DDN-PJ100','Context views show systems and people, not fields; remove member endpoints');
  if(ns.some(n=>!ok.includes(n.kind)))fail('DDN-PF007',p.profile+' accepts '+ok.join(', ')+' participants only');
  if(es.some(r=>r.kind!=='c4.rel'))fail('DDN-PF007',p.profile+' accepts c4.rel links only');
  if(p.profile==='c4.container@1'||p.profile==='c4.component@1'){
   const bkind=p.profile==='c4.container@1'?'c4.system':'c4.container',frames=ir.view.frames,f=frames.length===1?frames[0]:null,bn=f?ns.find(n=>n.id===f.scope&&n.kind===bkind):null,inner=bn?ns.filter(n=>n!==bn&&!ext.includes(n.kind)):[];
   if(!bn||inner.some(n=>!f.members.includes(n.id)))fail('DDN-PJ101',p.profile+' requires exactly one frame scoped to a selected '+bkind+' boundary object whose members cover every selected interior node');
  }
 }
 if(p.profile==='epc.basic@1'){
  if(ns.some(n=>!['epk.event','epk.function','epk.connector'].includes(n.kind)))fail('DDN-PF007','epc.basic@1 accepts epk.event, epk.function, epk.connector participants only');
  if(es.some(r=>r.kind!=='epk.next'))fail('DDN-PF007','epc.basic@1 accepts epk.next links only');
  for(const r of es){const a=nodes.get(r.from.element).kind,b=nodes.get(r.to.element).kind;
   if((a==='epk.event'&&b==='epk.event')||(a==='epk.function'&&b==='epk.function'))fail('DDN-PJ105','EPC events and functions must alternate; connect '+a+' to '+b+' through a connector or the other symbol type',r);}
  for(const n of ns){const op=n.properties.x_epc?.operator;
   if(n.kind==='epk.connector'){if(!['and','or','xor'].includes(op))fail('DDN-PJ106','EPC connector must carry x_epc.operator of and, or or xor',n);}
   else if(op!==undefined)fail('DDN-PJ106','x_epc.operator belongs on epk.connector nodes only',n);}
 }
 if(p.profile==='erd.crowfoot@1'){
  const CARD=['one','zeroone','many','zeromany'];
  for(const r of es){
   if(!['ref','assoc'].includes(r.kind))fail('DDN-PJ087','erd.crowfoot@1 relations must be ref or assoc to carry crow\'s-foot cardinality; '+r.kind+' is not structural',r);
   for(const side of ['source','target']){const m=r.properties[side+'_mark'];
    if(!CARD.includes(m))fail('DDN-PJ087','Relation '+(r.name||r.id)+' needs '+side+'_mark from one|zeroone|many|zeromany (crow\'s-foot cardinality); found '+(m===undefined?'no mark':m),r);}
  }
 }
 const codes=new Set();for(const n of ir.elements.filter(n=>n.kind==='req.requirement')){const c=n.properties.x_diagram?.code,t=n.properties.x_diagram?.text;if(!c||!t||codes.has(c))fail('DDN-PF014','Requirement needs unique code and nonempty text',n);codes.add(c);}
 if(p.kind!=='graph'){
  if(Object.keys(ir.view.placements).length||Object.keys(ir.view.routes).length||ir.view.frames.length||ir.view.subdiagrams.length)fail('DDN-PJ002','Data-bound projections do not accept graph place/route/frame/subdiagram geometry; select a graph view');
  if(ir.view.profiles.layout.x_interaction)fail('DDN-PJ002','Cannot combine interaction and data-bound projections');
  if(ir.view.profiles.export.mode==='redacted')fail('DDN-PJ003','Redacted non-graph projections require a separately authorized input workspace; unsupported export fails closed');
 }
 if(p.kind==='matrix'&&!reg.relationships.some(r=>r.keyword===p.relation))fail('DDN-PJ014','Matrix relation must name an installed relationship kind');
 Extra.validate(ir,ErrorClass);
 Bindings.plan(ir,ErrorClass);
 return [];
}
return{VERSION,registry,validate,catalogue,get};
});
