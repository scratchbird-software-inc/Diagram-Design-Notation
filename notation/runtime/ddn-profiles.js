/* SPDX-License-Identifier: GPL-2.0-or-later. DDN profile packs: data-only definitions and bounded validators. */
import {publishNamespace} from './ddn-module-registry.js';
import catalogue from './assets/profiles-catalogue.js';
import Bindings from './ddn-projection-data.js';
import Extra from './ddn-profile-quality.js';
'use strict';
const VERSION='0.7.0';
const cache=new WeakMap();
function registry(base){
 if(cache.has(base))return cache.get(base);
 const out={...base,kinds:base.kinds.slice(),relationships:base.relationships.slice(),extension_contracts:{...base.extension_contracts}};
 for(const k of catalogue.kinds){const b=base.kinds.find(x=>x.keyword===k.fallback)||base.kinds[0],f=base.families[k.family]||base.families.concept;out.kinds.push({...b,...k,id:'profile-kind.'+k.keyword,aliases:k.alias?[k.alias]:(k.aliases||[]),colour:f.colour,fill:f.fill,text_label:k.name,slot:'NW',profileKind:true});}
 for(const r of catalogue.relationships){const family=r.family==='data_flow'?'flow':r.family,b=base.relationships.find(x=>x.family===family)||base.relationships[0];out.relationships.push({...b,...r,family,id:'profile-relation.'+r.keyword,pattern:r.pattern||(r.keyword==='uml.realization'?'7 5':r.keyword.startsWith('flow.')?'':b.pattern),aliases:r.alias?[r.alias]:(r.aliases||[]),endpoint_contract:{source:r.source,target:r.target,allow_self:r.allow_self,member_endpoints:r.member_endpoints}});}
 const def=(schema,targets=['object'])=>({targets:Object.fromEntries(targets.map(t=>[t,schema]))});
 out.extension_contracts.x_record=def({type:'object',additionalProperties:true},['object','relation']);
 out.extension_contracts.x_story=def({type:'object',required:['task'],additionalProperties:true},['relation']);
 for(const key of ['x_rule','x_usecase','x_chen','x_continuation'])out.extension_contracts[key]=def({type:'object',additionalProperties:true},key==='x_chen'?['object','field','relation']:['object','relation']);
 /* B1-057 (RFC-121): closed x_state/x_transition contracts for UML 2.5.1 state
  * machines. Keys used by shipped lifecycle fixtures (terminal, event, guard,
  * actions) stay legal; string guards render verbatim; internal transitions
  * and activities are compartment text; submachine references a state.state. */
 out.extension_contracts.x_state=def({type:'object',properties:{terminal:{type:'boolean'},entry:{type:'string',minLength:1},exit:{type:'string',minLength:1},do:{type:'string',minLength:1},internal:{type:'array',minItems:1,maxItems:12,items:{type:'string',minLength:1}},submachine:{type:'object'}},additionalProperties:false},['object']);
 out.extension_contracts.x_transition=def({type:'object',properties:{event:{type:'string',minLength:1},guard:{anyOf:[{type:'object'},{type:'string',minLength:1}]},effect:{type:'string',minLength:1},actions:{type:'array',maxItems:12}},additionalProperties:false},['relation']);
 out.extension_contracts.x_assignment=def({type:'object',required:['code'],properties:{code:{type:'string',minLength:1,maxLength:12}},additionalProperties:false},['relation']);
 out.extension_contracts.x_category=def({type:'object',required:['axis','level'],properties:{axis:{type:'string',minLength:1},level:{type:'string',minLength:1}},additionalProperties:false},['object']);
 out.extension_contracts.x_member=def({type:'object',properties:{kind:{enum:['attribute','operation','literal']},visibility:{enum:['public','private','protected','package']},static:{type:'boolean'},abstract:{type:'boolean'},derived:{type:'boolean'},multiplicity:{type:'string',minLength:1},modifiers:{type:'array',items:{enum:['ordered','unique','readOnly']},uniqueItems:true,maxItems:3}},additionalProperties:false},['field']);
 /* B1-055 (RFC-119): UML 2.5.1 class-diagram completeness. Endpoint labels
  * (role/multiplicity/qualifier) on association ends; association-class
  * attachment; n-ary ends beyond the binary anchors; generalization sets;
  * template parameter boxes. */
 const endLabel={type:'object',properties:{role:{type:'string',minLength:1},multiplicity:{type:'string',minLength:1},qualifier:{type:'string',minLength:1}},additionalProperties:false};
 out.extension_contracts.x_endlabels=def({type:'object',properties:{source:endLabel,target:endLabel},additionalProperties:false},['relation']);
 out.extension_contracts.x_association_class=def({type:'object',required:['class'],properties:{class:{type:'object'}},additionalProperties:false},['relation']);
 out.extension_contracts.x_nary=def({type:'object',required:['ends'],properties:{ends:{type:'array',minItems:1,maxItems:6,items:{type:'object',required:['element'],properties:{element:{type:'object'},role:{type:'string',minLength:1},multiplicity:{type:'string',minLength:1}},additionalProperties:false}}},additionalProperties:false},['relation']);
 out.extension_contracts.x_genset=def({type:'object',required:['name'],properties:{name:{type:'string',minLength:1},disjoint:{type:'boolean'},complete:{type:'boolean'}},additionalProperties:false},['relation']);
 out.extension_contracts.x_template=def({type:'object',required:['parameters'],properties:{parameters:{type:'array',minItems:1,maxItems:8,items:{type:'string',minLength:1}}},additionalProperties:false},['object']);
 /* B1-059 (RFC-123): internal parts — field-level typed members of a
  * classifier, rendered "role: Classifier [mult]". */
 out.extension_contracts.x_part=def({type:'object',properties:{classifier:{type:'string',minLength:1},multiplicity:{type:'string',minLength:1}},additionalProperties:false},['field']);
 out.extension_contracts.x_diagram=def({type:'object',properties:{number:{type:'string',minLength:1},owner:{type:'string'},code:{type:'string'},text:{type:'string'},branch:{type:'string'},stereotype:{type:'string'}},additionalProperties:false},['object','relation']);
 out.extension_contracts.x_epc=def({type:'object',properties:{operator:{type:'string'}},additionalProperties:false},['object']);
 out.extension_contracts.x_sets=def({type:'array',items:{type:'string',minLength:1},minItems:1,maxItems:3,uniqueItems:true},['object']);
 out.extension_contracts.x_return=def({type:'boolean'},['relation']);
 /* B1-056 (RFC-120): UML 2.5.1 sequence diagrams. x_message grows the UML
  * message sort, gate and time/duration annotations (seq stays optional at
  * contract level; uml.communication@1 enforces it via DDN-PJ111). x_fragment
  * anchors a combined fragment to its first covered message; operands carry
  * guards and message refs and nest recursively. */
 out.extension_contracts.x_message=def({type:'object',properties:{seq:{type:'string',minLength:1},sort:{enum:['synch','asynch','create','delete','reply','lost','found']},gate:{enum:['source','target']},time:{type:'string',minLength:1},duration:{type:'string',minLength:1},at:{type:'number'}},additionalProperties:false},['relation']);
 const ref={type:'object'},msgList={type:'array',minItems:1,items:ref};
 const fragment={type:'object',required:['operator','operands'],properties:{operator:{enum:['alt','opt','loop','break','par','neg','critical','seq','strict','ignore','consider','assert','coreg']},operands:{type:'array',minItems:1,maxItems:12}},additionalProperties:false};
 fragment.properties.operands.items={type:'object',required:['messages'],properties:{guard:{type:'string',minLength:1},messages:msgList,fragments:{type:'array',minItems:1,items:fragment}},additionalProperties:false};
 out.extension_contracts.x_fragment=def(fragment,['relation']);
 out.extension_contracts.x_invariant=def({type:'array',minItems:1,maxItems:8,items:{type:'object',required:['after','label'],properties:{after:ref,label:{type:'string',minLength:1}},additionalProperties:false}},['object']);
 out.extension_contracts.x_activation=def({type:'array',minItems:1,maxItems:8,items:{type:'object',required:['from','to'],properties:{from:ref,to:ref},additionalProperties:false}},['object']);
 out.extension_contracts.x_instance=def({type:'object',required:['classifier'],additionalProperties:true},['object']);
 out.extension_contracts.x_partition=def({type:'object',required:['lane'],properties:{lane:{type:'string',minLength:1}},additionalProperties:false},['object']);
 out.extension_contracts.x_event=def({type:'object',required:['type'],properties:{type:{enum:['none','message','timer','signal','error','escalation','compensation','conditional','link','terminate','cancel','multiple','parallel_multiple']},position:{enum:['start','intermediate','end','boundary']},interrupting:{type:'boolean'},on:{type:'object'}},additionalProperties:false},['object']);
 out.extension_contracts.x_gateway=def({type:'object',required:['type'],properties:{type:{enum:['exclusive','parallel','inclusive','complex','event','event_exclusive']}},additionalProperties:false},['object']);
 out.extension_contracts.x_states=def({type:'array'},['object']);
 /* B1-081: VSM timeline ladder values (VA/NVA). */
 out.extension_contracts.x_vsm=def({type:'object',properties:{va:{type:'number',minimum:0},nva:{type:'number',minimum:0},unit:{type:'string',minLength:1}},additionalProperties:false},['object']);
 /* B1-080: ORM 2 — role decorations, value constraints, objectification,
  * derivation text. */
 out.extension_contracts.x_role=def({type:'object',properties:{uniqueness:{type:'boolean'},mandatory:{type:'boolean'}},additionalProperties:false},['field']);
 /* B1-080: the accounting workspaces already tag objects with a bare string
  * x_role ("ui_form_contract"); the contract serves both forms. */
 out.extension_contracts.x_role.targets.object={type:'string',minLength:1};
 out.extension_contracts.x_values=def({type:'object',required:['values'],properties:{values:{type:'array',minItems:1,maxItems:12,items:{type:'string',minLength:1}}},additionalProperties:false},['object']);
 out.extension_contracts.x_objectified=def({type:'object',required:['name'],properties:{name:{type:'string',minLength:1}},additionalProperties:false},['object']);
 out.extension_contracts.x_derive=def({type:'object',required:['text'],properties:{text:{type:'string',minLength:1}},additionalProperties:false},['object']);
 /* B1-079: Petri nets — arc weights and place token counts. */
 out.extension_contracts.x_petri=def({type:'object',properties:{weight:{type:'integer',minimum:1},tokens:{type:'integer',minimum:0}},additionalProperties:false},['object','relation']);
 /* B1-078: IDEF0 — ICOM port typing, node numbers, tunneled arrows. */
 out.extension_contracts.x_icom=def({type:'object',required:['type'],properties:{type:{enum:['input','control','output','mechanism']}},additionalProperties:false},['port']);
 out.extension_contracts.x_idef0=def({type:'object',required:['node'],properties:{node:{type:'string',minLength:2,pattern:'^A\\d+$'}},additionalProperties:false},['object']);
 out.extension_contracts.x_tunnel=def({type:'object',properties:{start:{type:'boolean'},end:{type:'boolean'}},additionalProperties:false},['relation']);
 /* B1-076: C4 element tags — rendered as a tag chip under the node. */
 out.extension_contracts.x_c4tag=def({type:'object',required:['tags'],properties:{tags:{type:'array',minItems:1,maxItems:8,items:{type:'string',minLength:1}}},additionalProperties:false},['object']);
 /* B1-074 (RFC-132): drill-down display modes + frozen snapshots. display
  * defaults to badge everywhere (interaction_overview@2 keeps its legacy
  * inline behavior when display is absent); frozen requires snapshot. */
 out.extension_contracts.x_subdiagram=def({type:'object',required:['view'],properties:{view:{type:'string',minLength:1},display:{enum:['badge','inline','thumbnail']},frozen:{type:'boolean'},snapshot:{type:'string',minLength:1},snapshot_at:{type:'string',minLength:1}},additionalProperties:false},['object']);
 out.extension_contracts.x_sentry=def({type:'object',required:['on'],properties:{on:{enum:['entry','exit']},attach:{type:'object'},on_part:{type:'object'},if_part:{type:'string',minLength:1}},additionalProperties:false},['object']);
 /* B1-064: CMMN 1.1 — plan-item decorators and planning tables. */
 out.extension_contracts.x_cmmn=def({type:'object',properties:{discretionary:{type:'boolean'},nonblocking:{type:'boolean'},required:{type:'boolean'},repetition:{type:'boolean'},manual_activation:{type:'boolean'},completion:{type:'boolean'},collapsed:{type:'boolean'}},additionalProperties:false},['object']);
 out.extension_contracts.x_planning=def({type:'object',required:['items'],properties:{items:{type:'array',minItems:1,maxItems:10,items:{type:'string',minLength:1}}},additionalProperties:false},['object']);
 out.extension_contracts.x_estimate=def({type:'number'},['object']);
 out.extension_contracts.x_gate=def({type:'object',required:['type'],properties:{type:{enum:['and','or']}},additionalProperties:false},['object']);
 out.extension_contracts.x_rack=def({type:'object',properties:{units:{type:'integer',minimum:1},unit:{type:'integer',minimum:1}},additionalProperties:false},['object']);
 out.extension_contracts.x_birth=def({type:'integer'},['object']);
 out.extension_contracts.x_death=def({type:'integer'},['object']);
 /* B1-060 (RFC-124): activity pins, interrupt/exception edges. */
 out.extension_contracts.x_pin=def({type:'object',properties:{set:{type:'string',minLength:1},streaming:{type:'boolean'}},additionalProperties:false},['port']);
 out.extension_contracts.x_interrupt=def({type:'boolean'},['relation']);
 out.extension_contracts.x_exception=def({type:'boolean'},['relation']);
 /* B1-061 (RFC-125): packaged-element visibility, interaction-use gates and
  * arguments, timing constraints. */
 out.extension_contracts.x_pack=def({type:'object',properties:{visibility:{enum:['public','private']}},additionalProperties:false},['object']);
 out.extension_contracts.x_use=def({type:'object',properties:{arguments:{type:'array',maxItems:8,items:{type:'string',minLength:1}},gates:{type:'array',maxItems:8,items:{type:'string',minLength:1}}},additionalProperties:false},['object']);
 out.extension_contracts.x_timeconstraint=def({type:'array',minItems:1,maxItems:6,items:{type:'string',minLength:1}},['object']);
 /* B1-065 (RFC-128): SysML 1.6 — block compartments, port typing, value
  * units and activity-edge rate/probability annotations. */
 out.extension_contracts.x_block=def({type:'object',required:['compartment'],properties:{compartment:{enum:['values','parts','references','operations','constraints']}},additionalProperties:false},['field']);
 out.extension_contracts.x_port=def({type:'object',properties:{type:{enum:['proxy','full']},conjugated:{type:'boolean'},multiplicity:{type:'string',minLength:1},nested:{type:'array',minItems:1,maxItems:4,items:{type:'object',required:['name'],properties:{name:{type:'string',minLength:1},direction:{enum:['in','out','inout']},type:{enum:['proxy','full']}},additionalProperties:false}}},additionalProperties:false},['port']);
 out.extension_contracts.x_unit=def({type:'object',required:['unit'],properties:{unit:{type:'string',minLength:1},quantity:{type:'string',minLength:1}},additionalProperties:false},['field']);
 /* B1-066 (RFC-129): DMN boxed-expression presentation (text display only,
  * never evaluated) on DRD nodes. */
 /* B1-072 (RFC-130): SoaML port decorations and service-contract binding. */
 out.extension_contracts.x_service=def({type:'object',required:['kind'],properties:{kind:{enum:['service','request']}},additionalProperties:false},['port']);
 out.extension_contracts.x_contract=def({type:'object',properties:{choreography:{type:'object'}},additionalProperties:false},['object']);
 out.extension_contracts.x_boxed=def({type:'object',required:['form'],properties:{form:{enum:['literal','context','invocation','relation']},text:{type:'string',minLength:1},entries:{type:'array',minItems:1,maxItems:10,items:{type:'object',required:['text'],properties:{name:{type:'string',minLength:1},text:{type:'string',minLength:1}},additionalProperties:false}}},additionalProperties:false},['object']);
 out.extension_contracts.x_flow=def({type:'object',properties:{rate:{type:'string',minLength:1},probability:{type:'number',minimum:0,maximum:1},continuous:{type:'boolean'}},additionalProperties:false},['relation']);
 /* B1-063: BPMN activity markers, input/output sets, choreography bands. */ out.extension_contracts.x_activity=def({type:'object',properties:{call:{type:'boolean'},transaction:{type:'boolean'},adhoc:{type:'boolean'},event_subprocess:{type:'boolean'},collapsed:{type:'boolean'},markers:{type:'array',maxItems:4,uniqueItems:true,items:{enum:['loop','parallel','sequential','compensation']}}},additionalProperties:false},['object']);
 out.extension_contracts.x_io=def({type:'object',properties:{set:{type:'boolean'}},additionalProperties:false},['object']);
 out.extension_contracts.x_bands=def({type:'array',minItems:1,maxItems:6,uniqueItems:true,items:{type:'string',minLength:1}},['object']);
 cache.set(base,out);cache.set(out,out);return out;
}
const get=id=>catalogue.profiles.find(x=>x.id===id);
function validate(ir,reg,ErrorClass){
 const p=ir.view.profiles.projection||{kind:'graph',profile:'ddn@1'},profile=get(p.profile),nodes=new Map(ir.elements.map(n=>[n.id,n])),rels=ir.relations;
 const diagnostics=[];
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
 /* B1-055 (RFC-119): UML class-diagram completeness validators. */
 const MULT=/^(\d+|\*)(\.\.(\d+|\*))?$/;
 for(const r of rels){
  const el=r.properties.x_endlabels;
  if(el!==undefined){
   /* RFC-122: communication paths carry multiplicity end labels too; the
    * qualifier stays association-only (DDN-PJ164 covers the misuse). */
   if(!['uml.association','uml.commpath','uml.connector','uml.link'].includes(r.kind))fail('DDN-PJ149','x_endlabels (role/multiplicity/qualifier) apply to uml.association, uml.commpath, uml.connector and uml.link only, not '+r.kind,r);
   for(const side of ['source','target']){const e=el[side];if(!e)continue;
    if(e.multiplicity!==undefined&&!MULT.test(e.multiplicity))fail('DDN-PJ149','Association-end multiplicity must be a UML multiplicity (1, 0..1, 0..*, 1..*, *); found "'+e.multiplicity+'"',r);}
  }
  const ac=r.properties.x_association_class;
  if(ac!==undefined){
   if(r.kind!=='uml.association')fail('DDN-PJ150','x_association_class applies to uml.association only, not '+r.kind,r);
   const c=nodes.get(ac.class?.$ref);
   if(!c)fail('DDN-PJ150','Association class reference does not resolve to a declared element',r);
   else if(c.kind!=='uml.class')fail('DDN-PJ150','Association class must name a uml.class, not '+c.kind,r);
   else if(c.id===r.from.element||c.id===r.to.element)fail('DDN-PJ150','Association class cannot be an endpoint of its own association',r);
  }
  const nary=r.properties.x_nary;
  if(nary!==undefined){
   if(r.kind!=='uml.association')fail('DDN-PJ151','x_nary applies to uml.association only, not '+r.kind,r);
   else{
    const seen=new Set([r.from.element,r.to.element]);
    for(const end of nary.ends){const el2=nodes.get(end.element?.$ref);
     if(!el2)fail('DDN-PJ151','N-ary association end does not resolve to a declared element',r);
     else if(!['uml.class','uml.interface','uml.enumeration'].includes(el2.kind))fail('DDN-PJ151','N-ary association ends must be classifiers (uml.class/uml.interface/uml.enumeration), not '+el2.kind,r);
     else if(seen.has(el2.id))fail('DDN-PJ151','N-ary association ends must be distinct; '+el2.id+' appears twice',r);
     else seen.add(el2.id);
     if(end.multiplicity!==undefined&&!MULT.test(end.multiplicity))fail('DDN-PJ151','N-ary end multiplicity must be a UML multiplicity; found "'+end.multiplicity+'"',r);}
   }
  }
  const gs=r.properties.x_genset;
  if(gs!==undefined){
   if(r.kind!=='uml.generalization')fail('DDN-PJ152','x_genset applies to uml.generalization only, not '+r.kind,r);
   else for(const other of rels)if(other!==r&&other.properties.x_genset?.name===gs.name&&other.to.element!==r.to.element)fail('DDN-PJ152','Generalization set "'+gs.name+'" must share one target; '+r.id+' and '+other.id+' disagree',r);
  }
 }
 for(const n of ir.elements){
  if(n.properties.x_template!==undefined&&!['uml.class','uml.interface'].includes(n.kind))fail('DDN-PJ153','x_template applies to uml.class/uml.interface only, not '+n.kind,n);
  for(const f of n.fields){const kind=f.properties.x_member?.kind;
   if(kind==='literal'&&n.kind!=='uml.enumeration')fail('DDN-PJ154','x_member kind literal applies to uml.enumeration members only; '+n.id+' is '+n.kind,f);
   if(n.kind==='uml.enumeration'&&f.properties.x_member!==undefined&&kind!=='literal')fail('DDN-PJ154','uml.enumeration members must be x_member kind literal; '+f.id+' declares '+kind,f);}
 }
 if(ir.view.profiles.export.mode==='redacted'&&ir.elements.some(n=>n.kind.includes('.')))fail('DDN-PJ003','Profile-specific redacted projection is not qualified; provide a separately authorized workspace');
 const shown=new Set(ir.view.selected),ns=ir.elements.filter(n=>shown.has(n.id)),es=rels.filter(r=>shown.has(r.from.element)&&shown.has(r.to.element));
 if(p.profile==='flow.basic@1'||p.profile==='flow.documented@2'||p.profile==='flow.iso5807@1'||p.profile==='uml.activity@1'||p.profile==='uml.activity@2'||p.profile==='sysml.activity@1'){
  if(ns.some(n=>!n.kind.startsWith('flow.')))fail('DDN-PF007','Flowchart projection accepts flow.* participants only');
  if((p.profile==='flow.basic@1'||p.profile==='flow.iso5807@1')&&es.some(r=>r.kind!=='flow.next'))fail('DDN-PF007','Flowchart projection accepts flow.next links only');
  if(['uml.activity@1','uml.activity@2','sysml.activity@1'].includes(p.profile)&&es.some(r=>r.kind!=='uml.flow'))fail('DDN-PF007','Activity projection accepts uml.flow links only');
  const control=es.filter(r=>(['uml.activity@1','uml.activity@2','sysml.activity@1'].includes(p.profile)?['uml.flow']:['flow.next','flow.continues']).includes(r.kind)),activeNodes=ns.filter(n=>n.kind!=='flow.annotation');
  const incoming=id=>control.filter(r=>r.to.element===id),outgoing=id=>control.filter(r=>r.from.element===id),starts=ns.filter(n=>n.kind==='flow.start'),ends=ns.filter(n=>n.kind==='flow.end'||(['uml.activity@2','sysml.activity@1'].includes(p.profile)&&n.kind==='flow.flowfinal'));
  if(!starts.length||!ends.length)fail('DDN-PF008','Closed flowchart needs a start and an end');
  for(const n of ns){if(n.kind==='flow.start'&&incoming(n.id).length)fail('DDN-PF008','Start cannot have incoming control',n);if((n.kind==='flow.end'||(['uml.activity@2','sysml.activity@1'].includes(p.profile)&&n.kind==='flow.flowfinal'))&&outgoing(n.id).length)fail('DDN-PF008','End cannot have outgoing control',n);
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
 if(['c4.context@1','c4.container@1','c4.component@1'].includes(p.profile)){
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
 if(p.profile==='epc.complete@1'){
  const EPCV=['epk.event','epk.function','epk.connector','epk.orgunit','epk.role','epk.infoobject','epk.processlink'];
  if(ns.some(n=>!EPCV.includes(n.kind)))fail('DDN-PF007','epc.complete@1 accepts the epk.* vocabulary only');
  if(es.some(r=>!['epk.next','epk.infoflow','epk.assigned','epk.links'].includes(r.kind)))fail('DDN-PF007','epc.complete@1 accepts epk.next/infoflow/assigned/links links only');
  for(const r of es.filter(r=>r.kind==='epk.next')){const a=nodes.get(r.from.element).kind,b=nodes.get(r.to.element).kind;
   if((a==='epk.event'&&b==='epk.event')||(a==='epk.function'&&b==='epk.function'))fail('DDN-PJ105','EPC events and functions must alternate; connect '+a+' to '+b+' through a connector or the other symbol type',r);}
  for(const n of ns){const op=n.properties.x_epc?.operator;
   if(n.kind==='epk.connector'){if(!['and','or','xor'].includes(op))fail('DDN-PJ106','EPC connector must carry x_epc.operator of and, or or xor',n);}
   else if(op!==undefined)fail('DDN-PJ106','x_epc.operator belongs on epk.connector nodes only',n);}
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
 if(p.profile==='wireframe.ui@1'){
  const covered=new Set();
  for(const frame of ir.view.frames){if(nodes.get(frame.scope)?.kind==='ui.frame')for(const id of frame.members)covered.add(id);}
  for(const n of ns)if(n.kind.startsWith('ui.')&&n.kind!=='ui.frame'&&!covered.has(n.id))diagnostics.push({code:'DDN-PJ128',severity:'warning',message:'Control '+n.id+' is declared outside any ui.frame',source:n.source?.file||'',offset:n.source?.start||0});
 }
 Extra.validate(ir,ErrorClass);
 Bindings.plan(ir,ErrorClass);
 return diagnostics;
}
const api={VERSION,registry,validate,catalogue,get};
publishNamespace('DDNProfiles',api);
export default api;
