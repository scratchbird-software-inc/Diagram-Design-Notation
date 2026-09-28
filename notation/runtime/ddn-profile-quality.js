/* SPDX-License-Identifier: GPL-2.0-or-later. Additive profile-completion contracts. */
import {publishNamespace} from './ddn-module-registry.js';
import UNITS from './assets/units.js';
'use strict';
function validate(ir,E){
 const ns=new Map(ir.elements.map(n=>[n.id,n])),shown=new Set(ir.view.selected),profile=ir.view.profiles.projection.profile;
 /* B1-065 (RFC-128): SysML behavioral rebadges alias the completed UML
  * machinery — the gates below fire for the SysML profile ids too. */
 const REBADGE={'sysml.usecase@1':['uml.usecase@2','uml.usecase@3'],'sysml.activity@1':['uml.activity@1','uml.activity@2'],'sysml.statemachine@1':['uml.statemachine@1'],'sysml.sequence@1':['uml.sequence@2'],'c4.deployment@1':['uml.deployment@1'],'c4.dynamic@1':['uml.communication@1','uml.communication@2'],'msc.basic@1':['uml.sequence@2']};
 const eff=new Set([profile,...(REBADGE[profile]||[])]);
 const fail=(c,m,n)=>{const e=new E(c,m,n?.source?.file||ir.view.source.file,n?.source?.start||ir.view.source.start);if(E===Error){e.code=c;e.message=m;}throw e;};
 const keys=(o,a,label,n)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!a.includes(k)))fail('DDN-PX001','Unknown or malformed '+label,n);};
 for(const n of ir.elements){
  if(n.properties.x_state){
   /* B1-057 (RFC-121): closed x_state contract; DDN105 covers shape, these
    * are the semantic owner/submachine rules. */
   const x=n.properties.x_state;
   if(!n.kind.startsWith('state.'))fail('DDN-PJ160','x_state applies only to state kinds; '+n.id+' is '+n.kind,n);
   if(x.submachine!==undefined){const m=ns.get(x.submachine?.$ref);
    if(!m||m.kind!=='state.state')fail('DDN-PJ160','Submachine reference on '+n.id+' must resolve to a declared state.state',n);
    else if(m.id===n.id)fail('DDN-PJ160','Submachine state '+n.id+' cannot invoke itself',n);}
  }
  if(n.properties.x_usecase){const x=n.properties.x_usecase;keys(x,['subjects','extension_points'],'use-case metadata',n);if(!['uml.usecase','uml.actor'].includes(n.kind))fail('DDN-PX002','Use-case metadata has an incompatible owner',n);if(x.subjects!==undefined&&(!Array.isArray(x.subjects)||x.subjects.some(r=>ns.get(r?.$ref)?.kind!=='uml.subject')||new Set(x.subjects.map(r=>r.$ref)).size!==x.subjects.length))fail('DDN-PX002','subjects must reference distinct uml.subject definitions',n);if(x.extension_points!==undefined&&(n.kind!=='uml.usecase'||!Array.isArray(x.extension_points)||x.extension_points.some(k=>typeof k!=='string'||!k.trim())||new Set(x.extension_points).size!==x.extension_points.length))fail('DDN-PX002','Extension points must be unique names on a use case',n);}
  if(n.properties.x_chen){const x=n.properties.x_chen;keys(x,['weak','owner'],'Chen entity metadata',n);if(n.kind!=='entity'||x.weak!==undefined&&typeof x.weak!=='boolean')fail('DDN-PX003','Invalid Chen entity metadata',n);if(x.weak){const owner=ns.get(x.owner?.$ref);if(!owner||owner.kind!=='entity'||owner.id===n.id)fail('DDN-PX003','Weak entity requires a distinct entity owner',n);if(!n.fields.some(f=>f.properties.x_chen?.partial_key))fail('DDN-PX003','Weak entity requires a declared partial key',n);}else if(x.owner)fail('DDN-PX003','Only weak entities declare identifying owner',n);}
  for(const f of n.fields){if(!f.properties.x_chen)continue;const x=f.properties.x_chen;keys(x,['key','partial_key','multivalued','derived','composite'],'Chen field metadata',f);if(n.kind!=='entity'||Object.values(x).some(v=>typeof v!=='boolean'))fail('DDN-PX003','Chen field flags are booleans on entity fields',f);if(x.partial_key&&!n.properties.x_chen?.weak||x.partial_key&&x.key)fail('DDN-PX003','A partial key belongs to a weak entity and is not a full key',f);if((x.key||x.partial_key)&&(x.derived||x.multivalued))fail('DDN-PX003','Key fields cannot be derived or multivalued',f);const child=n.fields.some(g=>g.parent===f.id);if(child&&!x.composite||x.composite&&!child)fail('DDN-PX003','Composite declaration must match actual child fields',f);}
 }
 for(const r of ir.relations){
  if(r.properties.x_usecase){const x=r.properties.x_usecase;keys(x,['extension_point','condition','condition_ref'],'extend metadata',r);const t=ns.get(r.to.element),a=ns.get(r.from.element);if(r.kind!=='uml.extend'||typeof x.extension_point!=='string'||!t?.properties.x_usecase?.extension_points?.includes(x.extension_point))fail('DDN-PX004','Extend must name an extension point on its target use case',r);if((typeof x.condition!=='string'||!x.condition.trim())&&!ns.has(x.condition_ref?.$ref))fail('DDN-PX004','Extend requires a stated condition or condition definition',r);if(x.condition&&x.condition_ref)fail('DDN-PX004','Use one condition form',r);}
  if(r.properties.x_chen){const x=r.properties.x_chen;keys(x,['identifying','owner','weak','from','to'],'Chen association metadata',r);if(!['assoc','ref'].includes(r.kind)||r.from.member||r.to.member)fail('DDN-PX005','Chen associations are binary object-level assoc/ref',r);for(const side of ['from','to']){const m=x[side];if(m){keys(m,['min','max'],'participation bound',r);if(!Number.isSafeInteger(m.min)||m.min<0||!(m.max==='many'||Number.isSafeInteger(m.max)&&m.max>=m.min))fail('DDN-PX005','Participation is nonnegative min/max or max:many',r);}}
   if(x.identifying!==undefined&&typeof x.identifying!=='boolean')fail('DDN-PX005','identifying is boolean',r);if(x.identifying){const weak=ns.get(x.weak?.$ref),owner=ns.get(x.owner?.$ref);if(!weak?.properties.x_chen?.weak||weak.properties.x_chen.owner?.$ref!==owner?.id||!new Set([r.from.element,r.to.element]).has(weak?.id)||!new Set([r.from.element,r.to.element]).has(owner?.id))fail('DDN-PX005','Identifying association must connect the declared weak entity to its owner',r);const end=r.from.element===owner.id?x.from:x.to;if(!end||end.min!==1||end.max!==1)fail('DDN-PX005','Each weak instance has exactly one owner',r);}else if(x.owner||x.weak)fail('DDN-PX005','Nonidentifying relationship cannot declare owner/weak roles',r);}
 }
 if(eff.has('uml.usecase@2')){
  for(const n of ir.elements.filter(n=>shown.has(n.id)&&n.kind==='uml.usecase'))if(!n.properties.x_usecase?.subjects?.length)fail('DDN-PX006','Use case must name its subject boundary',n);
  for(const r of ir.relations.filter(r=>shown.has(r.from.element)&&shown.has(r.to.element)&&['uml.include','uml.extend'].includes(r.kind))){if(r.kind==='uml.extend'&&!r.properties.x_usecase)fail('DDN-PX006','Extend needs an extension point and condition',r);const a=ns.get(r.from.element).properties.x_usecase?.subjects||[],b=ns.get(r.to.element).properties.x_usecase?.subjects||[];if(!a.some(x=>b.some(y=>x.$ref===y.$ref)))fail('DDN-PX006','Include/extend endpoints must share a declared subject',r);}
  for(const frame of ir.view.frames)if(ns.get(frame.scope)?.kind==='uml.subject')for(const id of frame.members){const n=ns.get(id);if(n?.kind==='uml.usecase'&&!n.properties.x_usecase?.subjects?.some(r=>r.$ref===frame.scope))fail('DDN-PX006','View subject frame contradicts model membership',n);}
 }
 if(profile==='chen.binary@2'){
  const included=ir.elements.filter(n=>shown.has(n.id));for(const n of included){if(n.kind!=='entity')fail('DDN-PX007','Chen binary profile selects entities only',n);for(const f of n.fields)if(n.fields.some(g=>g.parent===f.id)&&!f.properties.x_chen?.composite)fail('DDN-PX007','Nested Chen attribute requires composite metadata',f);if(n.properties.x_chen?.weak){if(!shown.has(n.properties.x_chen.owner.$ref))fail('DDN-PX007','Weak entity owner is absent from this view',n);const rs=ir.relations.filter(r=>ir.view.relations.includes(r.id)&&r.properties.x_chen?.identifying&&r.properties.x_chen.weak?.$ref===n.id);if(rs.length!==1)fail('DDN-PX007','Weak entity requires exactly one visible identifying relationship',n);}}
  for(const r of ir.relations.filter(r=>ir.view.relations.includes(r.id)))if(!r.properties.x_chen?.from||!r.properties.x_chen?.to)fail('DDN-PX007','Binary Chen relationship needs both min/max participation annotations',r);
  const active=new Set(),seen=new Set();function visit(n){if(active.has(n.id))fail('DDN-PX007','Cyclic identifying ownership',n);if(seen.has(n.id))return;active.add(n.id);const own=n.properties.x_chen?.owner?.$ref;if(own)visit(ns.get(own));active.delete(n.id);seen.add(n.id);}included.forEach(visit);
 }
 if(profile==='flow.documented@2'){
  const fs=ir.elements.filter(n=>shown.has(n.id)),es=ir.relations.filter(r=>ir.view.relations.includes(r.id)),pairs=new Map();
  for(const n of fs.filter(n=>n.kind==='flow.offpage')){const x=n.properties.x_continuation;keys(x,['key','side','page'],'off-page continuation',n);if(typeof x.key!=='string'||!x.key.trim()||!['in','out'].includes(x.side)||x.page!==undefined&&typeof x.page!=='string')fail('DDN-PX008','Continuation needs key and in/out side',n);if(!pairs.has(x.key))pairs.set(x.key,[]);pairs.get(x.key).push(n);}
  for(const[key,ns2]of pairs){const a=ns2.find(n=>n.properties.x_continuation.side==='out'),b=ns2.find(n=>n.properties.x_continuation.side==='in');if(ns2.length!==2||!a||!b||es.filter(r=>r.kind==='flow.continues'&&r.from.element===a.id&&r.to.element===b.id).length!==1)fail('DDN-PX008','Continuation '+key+' needs a matched out/in pair and explicit continues link');if(es.filter(r=>r.from.element===a.id).some(r=>r.kind!=='flow.continues')||es.filter(r=>r.to.element===b.id).some(r=>r.kind!=='flow.continues'))fail('DDN-PX008','Continuation ports contradict direction');}
  if(es.some(r=>!['flow.next','flow.annotation','flow.continues'].includes(r.kind)))fail('DDN-PX008','Unsupported relationship in documented flowchart');
  for(const n of fs.filter(n=>n.kind==='flow.annotation'))if(!es.some(r=>r.kind==='flow.annotation'&&r.from.element===n.id))fail('DDN-PX008','Annotation needs an explicit attachment',n);
 }
 if(profile==='uml.object@1'){
  for(const n of ir.elements.filter(n=>n.properties.x_instance)){
   const c=ns.get(n.properties.x_instance.classifier?.$ref);
   if(!c||!c.fields||!c.fields.length)continue;
   const names=new Set(c.fields.flatMap(f=>[f.name,f.local]));
   for(const f of n.fields)if(!names.has(f.name)&&!names.has(f.local))fail('DDN-PJ112','Instance '+n.id+' declares slot '+(f.name||f.local)+' not present on classifier '+c.id,n);
  }
 }
 if(eff.has('uml.communication@1')){
  for(const r of ir.relations.filter(r=>ir.view.relations.includes(r.id)&&r.kind==='uml.message')){
   const seq=r.properties.x_message?.seq,ret=r.properties.x_return===true,dotted=/^\d+(\.\d+)+$/.test(seq||'');
   if(typeof seq!=='string'||!seq)fail('DDN-PJ111','Message '+r.id+' lacks a declared sequence number (x_message.seq)',r);
   if(!/^\d+(\.\d+)*$/.test(seq))fail('DDN-PJ111','Message '+r.id+' has malformed sequence number '+JSON.stringify(seq)+' (expected digits with optional dot segments)',r);
   if(ret&&!dotted)fail('DDN-PJ111','Reply message '+r.id+' must be numbered dotted under its request (e.g. 2.1), got '+seq,r);
   if(!ret&&dotted)fail('DDN-PJ111','Non-reply message '+r.id+' must carry a top-level number, got dotted '+seq,r);
  }
 }
 if(eff.has('state.composite@1')||eff.has('uml.statemachine@1')){
  const frames=ir.view.frames||[],regions=frames.filter(f=>f.x_region===true);
  const collide=f=>{const initials=f.members.map(id=>ns.get(id)).filter(n=>n?.kind==='state.initial');if(initials.length>1)fail('DDN-PJ113','Frame '+(f.name||f.id)+' declares '+initials.length+' initial states ('+initials.map(n=>n.id).join(', ')+'); at most one initial state per region');};
  for(const f of regions)collide(f);
  for(const f of frames){if(f.x_region===true)continue;if(ns.get(f.scope)?.kind!=='state.state')continue;if(regions.some(r=>r.members.length&&r.members.every(id=>f.members.includes(id))))continue;collide(f);}
 }
 /* B1-057 (RFC-121): pseudostate endpoint/membership rules and transition
  * label form. Endpoint rules are state-profile business; a pseudostate kind
  * dropped into a plain graph view is just a marker there. */
 if(eff.has('uml.statemachine@1')||profile.startsWith('state.')){
  const es=ir.relations.filter(r=>ir.view.relations.includes(r.id)&&r.kind==='state.transition');
  const PSEUDO=['state.history_shallow','state.history_deep','state.junction','state.choice','state.entrypoint','state.exitpoint','state.forkjoin','state.terminate'];
  for(const n of ir.elements.filter(n=>shown.has(n.id)&&PSEUDO.includes(n.kind))){
   const out=es.filter(r=>r.from.element===n.id),inc=es.filter(r=>r.to.element===n.id);
   if(n.kind==='state.terminate'&&out.length)fail('DDN-PJ161','Terminate pseudostate '+n.id+' cannot have outgoing transitions',n);
   if(n.kind==='state.choice'&&out.length<2)fail('DDN-PJ161','Choice pseudostate '+n.id+' needs at least two outgoing transitions',n);
   if(n.kind==='state.junction'&&(!inc.length||!out.length))fail('DDN-PJ161','Junction pseudostate '+n.id+' is a pass-through and needs incoming and outgoing transitions',n);
   if(['state.entrypoint','state.exitpoint'].includes(n.kind)&&eff.has('uml.statemachine@1')){
    const frames=ir.view.frames||[];
    if(!frames.some(f=>f.members.includes(n.id)))fail('DDN-PJ161','Entry/exit point '+n.id+' must be a member of a composite-state frame',n);}
   if(['state.history_shallow','state.history_deep'].includes(n.kind)&&eff.has('uml.statemachine@1')){
    const frames=ir.view.frames||[];
    if(!frames.some(f=>f.members.includes(n.id)))fail('DDN-PJ161','History pseudostate '+n.id+' must be a member of a composite-state frame',n);}
  }
  for(const r of es){const ev=r.properties.x_transition?.event;
   if(typeof ev==='string'&&/^(after|at|when)\b/.test(ev)&&!/^(after|at|when)\s*\(.+\)$/.test(ev))fail('DDN-PJ162','Time/change trigger '+JSON.stringify(ev)+' on '+r.id+' is malformed; use after(…), at(…) or when(…)',r);}
 }
 /* B1-058 (RFC-122): UML deployment semantics beyond the endpoint contracts. */
 {
  const NODE=new Set(['uml.node','uml.device','uml.executionenv']);
  for(const r of ir.relations){
   if(r.kind==='uml.commpath'&&(r.properties.x_endlabels?.source?.qualifier||r.properties.x_endlabels?.target?.qualifier))fail('DDN-PJ164','Qualifiers are association-end notation; communication paths carry role/multiplicity only',r);
  }
  if(profile==='uml.deployment@1')for(const f of ir.view.frames||[]){
   const sc=ns.get(f.scope);
   if(f.scope&&sc&&!NODE.has(sc.kind))fail('DDN-PJ164','Deployment nesting frames must scope to a node kind (uml.node/device/executionenv); '+f.id+' scopes to '+sc.kind,f);
  }
 }
 /* B1-064: CMMN 1.1 semantics. */
 {
  const CMMN_TASK=['cmmn.task','cmmn.humantask','cmmn.processtask','cmmn.decisiontask','analysis.task'];
  const PLAN=['cmmn.stage','cmmn.milestone','cmmn.sentry','cmmn.casefile','cmmn.timerevent','cmmn.userevent',...CMMN_TASK];
  for(const n of ir.elements.filter(n=>shown.has(n.id))){
   const xc=n.properties.x_cmmn;
   if(xc!==undefined){
    if(!PLAN.includes(n.kind))fail('DDN-PJ181','x_cmmn decorators apply to plan items (tasks/stages/milestones/sentries/listeners/case files); '+n.id+' is '+n.kind,n);
    if(xc.nonblocking&&!['cmmn.humantask','cmmn.task'].includes(n.kind))fail('DDN-PJ181','Non-blocking applies to (human) tasks; '+n.id+' is '+n.kind,n);
    if(xc.collapsed&&n.kind!=='cmmn.stage')fail('DDN-PJ181','Collapsed applies to stages; '+n.id+' is '+n.kind,n);
   }
   if(n.properties.x_planning!==undefined&&!['cmmn.stage',...CMMN_TASK].includes(n.kind))fail('DDN-PJ183','Planning tables attach to stages or tasks; '+n.id+' is '+n.kind,n);
   const xs=n.properties.x_sentry;
   if(xs?.attach!==undefined){
    const host=ns.get(xs.attach?.$ref);
    if(!host||!PLAN.includes(host.kind))fail('DDN-PJ182','Sentry '+n.id+' attachment must resolve to a plan item',n);
    if(host&&host.id===n.id)fail('DDN-PJ182','Sentry '+n.id+' cannot attach to itself',n);
   }
   if(xs?.on_part!==undefined){
    const src=ns.get(xs.on_part?.$ref);
    if(!src||!['cmmn.timerevent','cmmn.userevent','cmmn.casefile'].includes(src.kind))fail('DDN-PJ182','Sentry on-part '+n.id+' must reference an event listener or case file item',n);
   }
  }
  if(profile==='cmmn.complete@1'){
   const plans=ir.elements.filter(n=>shown.has(n.id)&&n.kind==='cmmn.caseplan');
   if(plans.length!==1)fail('DDN-PJ184','A case view needs exactly one cmmn.caseplan container; found '+plans.length);
   for(const r of ir.relations.filter(r=>ir.view.relations.includes(r.id)&&r.kind==='cmmn.sentryref')){
    const b=ns.get(r.to.element);
    if(!b||b.kind!=='cmmn.sentry')fail('DDN-PJ182','Sentry on-part connector '+r.id+' must target a sentry',r);
   }
  }
 }
 /* B1-063: BPMN 2.0.2 semantics — decorator contracts are profile-neutral,
  * so the checks fire wherever the properties appear. */
 {
  const BPMN=/^bpmn\./.test(profile);
  for(const n of ir.elements.filter(n=>shown.has(n.id))){
   const xe=n.properties.x_event;
   if(xe){
    if(!['flow.start','flow.intermediate','flow.end'].includes(n.kind))fail('DDN-PJ175','x_event applies to event kinds (flow.start/intermediate/end); '+n.id+' is '+n.kind,n);
    const pos=xe.position||(n.kind==='flow.start'?'start':n.kind==='flow.end'?'end':'intermediate');
    if(xe.type==='terminate'&&pos!=='end')fail('DDN-PJ175','Terminate trigger belongs on end events; '+n.id+' is '+pos,n);
    if(xe.interrupting===false&&!['boundary','intermediate'].includes(pos))fail('DDN-PJ175','Non-interrupting applies to boundary or intermediate events; '+n.id,n);
    if(['cancel','compensation'].includes(xe.type)&&!['boundary','end'].includes(pos))fail('DDN-PJ175',xe.type+' trigger belongs on boundary or end events; '+n.id+' is '+pos,n);
    if(xe.position==='boundary'){
     const host=ns.get(xe.on?.$ref);
     if(!host||!['flow.process','flow.subprocess'].includes(host.kind))fail('DDN-PJ175','Boundary event '+n.id+' must name x_event.on resolving to a task/subprocess',n);
    }
   }
   const xg=n.properties.x_gateway;
   if(xg&&['complex','event','event_exclusive'].includes(xg.type)&&!BPMN)fail('DDN-PJ176','Gateway type '+xg.type+' requires a BPMN process/choreography/conversation profile',n);
   if(xg&&xg.type==='event'&&BPMN){
    const out=ir.relations.filter(r=>ir.view.relations.includes(r.id)&&r.from.element===n.id);
    if(out.length<2)fail('DDN-PJ176','Event-based gateway '+n.id+' needs at least two outgoing sequence flows',n);
   }
   const xa=n.properties.x_activity;
   if(xa!==undefined&&!['flow.process','flow.subprocess','flow.choreotask'].includes(n.kind))fail('DDN-PJ177','x_activity markers apply to task/subprocess kinds; '+n.id+' is '+n.kind,n);
   if(xa&&(xa.call||xa.transaction)&&n.kind==='flow.choreotask')fail('DDN-PJ177','Call/transaction are process-diagram activities, not choreography bands',n);
   if(n.properties.x_bands!==undefined&&n.kind!=='flow.choreotask')fail('DDN-PJ178','x_bands applies to flow.choreotask only; '+n.id+' is '+n.kind,n);
   if(n.kind==='flow.choreotask'&&profile==='bpmn.choreography@1'&&(n.properties.x_bands||[]).length<2)fail('DDN-PJ178','Choreography task '+n.id+' needs at least two participant bands (x_bands)',n);
  }
  for(const r of ir.relations.filter(r=>ir.view.relations.includes(r.id))){
   if(r.kind==='bpmn.conversationlink'){
    const t=ns.get(r.to.element);
    if(!t||!t.kind.startsWith('flow.conversation')&&!['flow.subconversation','flow.callconversation'].includes(t.kind))fail('DDN-PJ179','Conversation link '+r.id+' must target a conversation node',r);
   }
   if(r.kind==='bpmn.association'){
    const DATA=['flow.dataobject','flow.datainput','flow.dataoutput','flow.datastore'];
    const a=ns.get(r.from.element),b=ns.get(r.to.element);
    if(!(DATA.includes(a?.kind)||DATA.includes(b?.kind)))fail('DDN-PJ180','Data association '+r.id+' needs a data node on one side and an activity on the other',r);
    if(DATA.includes(a?.kind)&&DATA.includes(b?.kind))fail('DDN-PJ180','Data association '+r.id+' connects two data nodes; one side must be an activity',r);
   }
  }
 }
 /* B1-061 (RFC-125): UML remainder semantics. */
 if(profile==='uml.object@2'){
  for(const n of ir.elements.filter(n=>shown.has(n.id)&&n.properties.x_instance)){
   const c=ns.get(n.properties.x_instance.classifier?.$ref);if(!c)continue;
   for(const f of n.fields){
    const cf=c.fields.find(g=>g.name===f.name||g.local===f.local||g.name===f.local||g.local===f.name);
    const dt=cf?.properties?.datatype;
    const val=f.name??f.label;if(typeof dt!=='string'||val===undefined)continue;
    const v=String(val);
    if(['number','integer','decimal','float'].includes(dt)&&!/^-?\d+(\.\d+)?$/.test(v))fail('DDN-PJ170','Slot '+f.id+' value '+JSON.stringify(v)+' is not numeric as classifier field datatype '+dt+' requires',f);
    if(dt==='boolean'&&!['true','false'].includes(v))fail('DDN-PJ170','Slot '+f.id+' value '+JSON.stringify(v)+' is not boolean as classifier field datatype requires',f);
   }
  }
 }
 if(profile==='uml.communication@2'){
  const visible=new Set(ir.view.relations);
  for(const r of ir.relations.filter(r=>visible.has(r.id)&&r.properties.x_fragment!==undefined)){
   const check=(fx,owner)=>{for(const op of fx.operands){for(const mref of op.messages){const id=mref?.$ref,m=ir.relations.find(x=>x.id===id);
     if(!m||!visible.has(id)||m.kind!=='uml.message')fail('DDN-PJ172','Communication fragment on '+owner+' references a non-message or invisible relation: '+id,r);}
    for(const nf of op.fragments||[])check(nf,owner);}};
   check(r.properties.x_fragment,r.id);
  }
 }
 if(profile==='uml.communication@2'){/* timing constraints reuse RFC-120 form */
  for(const r of ir.relations.filter(r=>ir.view.relations.includes(r.id)))for(const key of ['time','duration']){const v=r.properties.x_message?.[key];
   if(v!==undefined&&!/^\{[^{}]+\}$/.test(v))fail('DDN-PJ172','Message '+r.id+' '+key+' must use constraint form {…}; found '+JSON.stringify(v),r);}
 }
 for(const n of ir.elements){
  if(n.properties.x_pack?.visibility!==undefined){
   const inPkg=(ir.view.frames||[]).some(f=>f.members.includes(n.id)&&ns.get(f.scope)?.kind==='uml.package');
   if(!inPkg)fail('DDN-PJ171','x_pack.visibility on '+n.id+' is meaningless: the element is not a member of any uml.package frame in this view',n);
  }
 }
 if(profile==='uml.interaction_overview@2'){
  for(const n of ir.elements.filter(n=>shown.has(n.id)&&n.properties.x_use)){
   const gates=n.properties.x_use.gates||[];
   if(new Set(gates).size!==gates.length)fail('DDN-PJ174','Interaction-use '+n.id+' declares duplicate gate names',n);
  }
 }
 /* B1-060 (RFC-124): activity-diagram completeness semantics. */
 if(eff.has('uml.activity@2')){
  const es2=ir.relations.filter(r=>ir.view.relations.includes(r.id)&&r.kind==='uml.flow');
  for(const n of ir.elements.filter(n=>shown.has(n.id)&&n.kind==='flow.merge')){
   const inc=es2.filter(r=>r.to.element===n.id).length,out=es2.filter(r=>r.from.element===n.id).length;
   if(inc<2||out!==1)fail('DDN-PJ167','Merge '+n.id+' needs at least two incoming edges and exactly one outgoing; found '+inc+' in / '+out+' out',n);
  }
  const iFrames=(ir.view.frames||[]).filter(f=>f.x_interruptible===true);
  const inInterruptible=id=>iFrames.some(f=>f.members.includes(id));
  for(const r of es2){
   if(r.properties.x_interrupt===true&&!inInterruptible(r.from.element))fail('DDN-PJ168','Interrupting edge '+r.id+' must start inside an interruptible activity region (a frame with x_interruptible: true)',r);
   if(r.properties.x_exception===true&&ns.get(r.to.element)?.kind!=='flow.process')fail('DDN-PJ168','Exception edge '+r.id+' must target a handler action (flow.process); found '+(ns.get(r.to.element)?.kind||'unresolved'),r);
  }
  for(const n of ir.elements.filter(n=>shown.has(n.id)))for(const pt of n.ports){
   if(pt.properties.x_pin!==undefined&&!['flow.process','flow.subprocess','flow.objectnode'].includes(n.kind))fail('DDN-PJ169','x_pin (parameter set/streaming) applies to pins on action kinds (flow.process/subprocess/objectnode); '+n.id+' is '+n.kind,pt);
  }
 }
 /* B1-059 (RFC-123): component/composite-structure semantics. */
 {
  const members=new Map(ir.elements.flatMap(n=>[...n.fields,...n.ports].map(m=>[m.id,{m,owner:n}])));
  for(const r of ir.relations){
   const end=e=>members.get(e.member)||null;
   if(r.kind==='uml.assembly')for(const side of ['from','to']){
    const ep=r[side],mem=end(ep),kind=mem?mem.owner.kind:ns.get(ep.element)?.kind;
    /* B1-072 (RFC-130): SoaML participants/service interfaces assemble the same way. */
    if(kind!=='uml.component'&&!['soaml.participant','soaml.serviceinterface','soaml.agent'].includes(kind))fail('DDN-PJ165','uml.assembly '+side+' endpoint must be a uml.component or a port of one; found '+(mem?'port on '+kind:kind),r);
    if(ep.member&&mem&&![...mem.owner.ports].some(pt=>pt.id===ep.member))fail('DDN-PJ165','uml.assembly '+side+' member must be a port, not a field/part',r);
   }
   if(r.kind==='uml.delegation'){
    const mem=end(r.from);
    if(!r.from.member||!mem||![...mem.owner.ports].some(pt=>pt.id===r.from.member))fail('DDN-PJ165','uml.delegation must start at a declared port member of the boundary classifier',r);
   }
  }
  for(const n of ir.elements)for(const f of n.fields){
   const xp=f.properties.x_part;
   if(xp!==undefined){
    if(!['uml.class','uml.component','uml.collaboration','soaml.servicecontract'].includes(n.kind))fail('DDN-PJ166','x_part fields belong to uml.class/uml.component/uml.collaboration owners; '+n.id+' is '+n.kind,f);
    if(xp.multiplicity!==undefined&&!/^(\d+|\*)(\.\.(\d+|\*))?$/.test(xp.multiplicity))fail('DDN-PJ166','Part multiplicity must be a UML multiplicity; found "'+xp.multiplicity+'"',f);
   }
  }
 }
 if(eff.has('uml.activity@1')){
  const frames=ir.view.frames||[],lanes=new Set(frames.flatMap(f=>[f.id,f.name,String(f.id).split('::').pop().split('.').pop()]));
  const shown2=new Set(ir.view.selected),es2=ir.relations.filter(r=>shown2.has(r.from.element)&&shown2.has(r.to.element)&&r.kind==='uml.flow');
  for(const n of ir.elements.filter(n=>shown2.has(n.id)&&n.properties.x_partition)){const lane=n.properties.x_partition.lane;if(!lanes.has(lane))fail('DDN-PJ114','Node '+n.id+' declares partition lane '+JSON.stringify(lane)+' but no frame of this view has that id or name',n);}
  const bars=ir.elements.filter(n=>shown2.has(n.id)&&n.kind==='flow.forkjoin');
  const forks=bars.filter(n=>es2.filter(r=>r.from.element===n.id).length>=2).length,joins=bars.filter(n=>es2.filter(r=>r.to.element===n.id).length>=2).length;
  if(forks!==joins)fail('DDN-PJ115','Fork/join imbalance: '+forks+' fork(s) (>=2 outgoing uml.flow edges) versus '+joins+' join(s) (>=2 incoming uml.flow edges); counts must match');
 }
 if(profile==='bpmn.basic@1'){
  const pools=(ir.view.frames||[]).filter(f=>f.x_pool===true);
  const poolOf=id=>pools.filter(p=>p.members.includes(id));
  for(const r of ir.relations.filter(r=>ir.view.relations.includes(r.id)&&r.kind==='bpmn.messageflow')){
   const a=poolOf(r.from.element),b=poolOf(r.to.element),same=a.find(p=>b.includes(p));
   if(same)fail('DDN-PJ116','Message flow '+r.id+' has both endpoints inside pool '+(same.name||same.id)+'; message flow is allowed only across pools',r);
   if(!a.length&&!b.length)fail('DDN-PJ116','Message flow '+r.id+' has both endpoints outside every x_pool frame; message flow is allowed only across pools',r);
  }
  for(const n of ir.elements.filter(n=>shown.has(n.id)&&n.kind==='flow.gateway'))
   if(!['exclusive','parallel','inclusive'].includes(n.properties.x_gateway?.type))fail('DDN-PJ117','Gateway '+n.id+' lacks a valid x_gateway.type (exclusive, parallel or inclusive)',n);
 }
 if(profile.startsWith('sysml.')&&profile!=='sysml.activity@1'){ /* activity pins are x_pin ports on action kinds */
  /* B1-065 (RFC-128): @2 profiles widen the port-owner set to the block
   * family (interface blocks, flow specifications); @1 keeps sysml.block. */
  const portOwners=['sysml.block',...(/^sysml\.(bdd|ibd|parametric)@2$/.test(profile)?['sysml.interfaceblock','sysml.flowspec']:[])];
  for(const n of ir.elements.filter(n=>shown.has(n.id)&&n.ports.length&&!portOwners.includes(n.kind)))
   fail('DDN-PJ121','Element '+(n.name||n.id)+' (kind '+n.kind+') declares a ports group; under '+profile+' only '+portOwners.join('/')+' elements declare ports',n);
 }
 if(profile==='sysml.parametric@1'){
  const es=ir.relations.filter(r=>ir.view.relations.includes(r.id));
  for(const n of ir.elements.filter(n=>shown.has(n.id)&&n.kind==='sysml.constraint')){
   const count=es.filter(r=>r.from.element===n.id||r.to.element===n.id).length;
   if(count!==2)fail('DDN-PJ122','Constraint '+(n.name||n.id)+' is touched by '+count+' visible relation(s); a parametric constraint binds exactly two endpoints',n);
  }
 }
 /* B1-080: ORM 2 semantics — role ownership and fact-type shape. */
 {
  for(const n of ir.elements.filter(n=>shown.has(n.id))){
   for(const f of n.fields){
    const xr=f.properties.x_role;
    if(xr!==undefined&&n.kind!=='orm.facttype')fail('DDN-PJ204','x_role (uniqueness/mandatory) lives on orm.facttype role boxes; '+n.id+' is '+n.kind,f);
   }
   if(n.properties.x_values!==undefined&&n.kind!=='orm.valuetype')fail('DDN-PJ204','x_values value constraints belong to orm.valuetype; '+n.id+' is '+n.kind,n);
   if(n.properties.x_objectified!==undefined&&n.kind!=='orm.facttype')fail('DDN-PJ204','x_objectified applies to orm.facttype; '+n.id+' is '+n.kind,n);
   if(n.properties.x_derive!==undefined&&n.kind!=='orm.facttype')fail('DDN-PJ204','x_derive derivation text applies to orm.facttype; '+n.id+' is '+n.kind,n);
  }
  if(profile==='orm.basic@1')for(const n of ir.elements.filter(n=>shown.has(n.id)&&n.kind==='orm.facttype'))
   if(!n.fields.length)fail('DDN-PJ204','ORM fact type '+n.id+' needs at least one role box (a fields group)',n);
 }
 /* B1-079: Petri net semantics — bipartite graph + weight/token shapes. */
 {
  for(const n of ir.elements.filter(n=>shown.has(n.id))){
   const xp=n.properties.x_petri;
   if(xp?.tokens!==undefined&&n.kind!=='petri.place')fail('DDN-PJ203','x_petri.tokens belongs on petri.place; '+n.id+' is '+n.kind,n);
  }
  for(const r of ir.relations){
   const xp=r.properties.x_petri;
   if(xp?.weight!==undefined&&!['petri.arc','petri.testarc'].includes(r.kind))fail('DDN-PJ203','x_petri.weight applies to petri arcs; '+r.id+' is '+r.kind,r);
  }
  if(profile==='petri.basic@1'){
   const es=ir.relations.filter(r=>ir.view.relations.includes(r.id));
   for(const r of es.filter(r=>r.kind.startsWith('petri.'))){
    const a=ns.get(r.from.element),b=ns.get(r.to.element);
    if(!a||!b)continue;
    if(a.kind===b.kind)fail('DDN-PJ202','Petri net is bipartite: '+r.kind+' '+r.id+' connects '+a.kind+' to '+b.kind+'; arcs run only between a place and a transition',r);
    if(r.kind==='petri.inhibitor'&&a.kind!=='petri.place')fail('DDN-PJ202','Inhibitor arc '+r.id+' must start at a place and end at a transition',r);
   }
  }
 }
 /* B1-078: IDEF0 semantics — ICOM side contract and node numbering. */
 {
  const SIDES={'input':'west','control':'north','output':'east','mechanism':'south'};
  for(const n of ir.elements.filter(n=>shown.has(n.id))){
   for(const pt of n.ports||[]){
    const xi=pt.properties.x_icom;
    if(xi===undefined)continue;
    if(n.kind!=='idef0.activity')fail('DDN-PJ200','x_icom port typing applies to idef0.activity ports; '+n.id+' is '+n.kind,pt);
    const side=pt.properties.side;
    if(SIDES[xi.type]!==side)fail('DDN-PJ200','ICOM '+xi.type+' port '+(pt.name||pt.id)+' must sit on the '+SIDES[xi.type]+' side of '+n.id+'; declared side is '+(side||'unset'),pt);
   }
   if(profile==='idef0.basic@1')for(const pt of n.ports||[])if(n.kind==='idef0.activity'&&!pt.properties.x_icom)fail('DDN-PJ200','IDEF0 port '+(pt.name||pt.id)+' on '+n.id+' lacks an ICOM type (input/control/output/mechanism)',pt);
  }
  if(profile==='idef0.basic@1'){
   const nums=new Map();
   for(const n of ir.elements.filter(n=>shown.has(n.id)&&n.kind==='idef0.activity')){
    const num=n.properties.x_idef0?.node;
    if(!num||!/^A\d+$/.test(num))fail('DDN-PJ201','IDEF0 activity '+n.id+' needs an x_idef0.node number like A1 or A21',n);
    if(nums.has(num))fail('DDN-PJ201','IDEF0 node number '+num+' is used by both '+nums.get(num)+' and '+n.id,n);
    nums.set(num,n.id);
   }
  }
 }
 /* B1-072 (RFC-130): SoaML 1.0.1 semantics. */
 {
  const OWNERS=['soaml.participant','soaml.serviceinterface','soaml.agent','uml.component','sysml.block'];
  for(const n of ir.elements.filter(n=>shown.has(n.id))){
   for(const pt of n.ports||[]){
    const xs=pt.properties.x_service;
    if(xs!==undefined&&!OWNERS.includes(n.kind))fail('DDN-PJ195','x_service port decorations apply to participant/service-interface kinds; '+n.id+' is '+n.kind,pt);
   }
   const xc=n.properties.x_contract;
   if(xc!==undefined&&n.kind!=='soaml.servicecontract')fail('DDN-PJ195','x_contract (choreography binding) applies to soaml.servicecontract; '+n.id+' is '+n.kind,n);
  }
  if(profile==='soaml.services@1'){
   for(const r of ir.relations.filter(r=>ir.view.relations.includes(r.id)&&['uml.assembly','uml.delegation','uml.connector'].includes(r.kind))){
    const typed=ep=>{if(!ep.member)return null;const owner=ns.get(ep.element);const pt=(owner?.ports||[]).find(x=>x.id===ep.member);return pt?.properties?.x_service?.kind||null;};
    const a=typed(r.from),b=typed(r.to);
    if(a&&b){
     if(a===b)fail('DDN-PJ196','Connector '+r.id+' joins two «'+(a==='service'?'Service':'Request')+'» ports; a «Service» port connects to a «Request» port',r);
     const ta=ns.get(r.from.element),tb=ns.get(r.to.element),pa=(ta?.ports||[]).find(x=>x.id===r.from.member),pb=(tb?.ports||[]).find(x=>x.id===r.to.member);
     const typeOf=p=>p?.properties?.datatype||p?.properties?.type;
     if(typeOf(pa)&&typeOf(pb)&&typeOf(pa)!==typeOf(pb))fail('DDN-PJ196','Connector '+r.id+' joins «Service»/'+'«Request» ports of different interface types ('+typeOf(pa)+' vs '+typeOf(pb)+'); both sides type the same service interface',r);
    }
   }
  }
 }
 /* B1-076: full EPC — split/join fan-balancing per connector operator. */
 if(profile==='epc.complete@1'){
  const es2=ir.relations.filter(r=>ir.view.relations.includes(r.id)&&r.kind==='epk.next');
  const conns=ir.elements.filter(n=>shown.has(n.id)&&n.kind==='epk.connector');
  for(const op of ['and','or','xor']){
   const splits=conns.filter(n=>n.properties.x_epc?.operator===op&&es2.filter(r=>r.from.element===n.id).length>1).length;
   const joins=conns.filter(n=>n.properties.x_epc?.operator===op&&es2.filter(r=>r.to.element===n.id).length>1).length;
   if(splits!==joins)fail('DDN-PJ199','EPC fan-balancing: '+splits+' '+op.toUpperCase()+' split(s) (connector with >1 outgoing) versus '+joins+' '+op.toUpperCase()+' join(s) (>1 incoming); every split needs a matching join of the same operator');
  }
 }
 /* B1-066 (RFC-129): DMN 1.4 DRD semantics. */
 {
  for(const n of ir.elements.filter(n=>shown.has(n.id))){
   const xb=n.properties.x_boxed;
   if(xb!==undefined&&!['dmn.decision','dmn.bkm','dmn.decisionservice'].includes(n.kind))fail('DDN-PJ193','x_boxed boxed-expression presentation applies to dmn.decision/dmn.bkm/dmn.decisionservice; '+n.id+' is '+n.kind,n);
  }
  for(const r of ir.relations.filter(r=>ir.view.relations.includes(r.id)&&r.kind.startsWith('dmn.'))){
   const a=ns.get(r.from.element),b=ns.get(r.to.element),ka=a?.kind,kb=b?.kind;
   if(r.kind==='dmn.inforeq'&&!(['dmn.inputdata','dmn.decision','dmn.decisionservice'].includes(ka)&&['dmn.decision','dmn.decisionservice'].includes(kb)))
    fail('DDN-PJ194','Information requirement '+r.id+' flows from input data/decision into a decision or decision service; found '+(ka||'?')+' -> '+(kb||'?'),r);
   if(r.kind==='dmn.knowledgereq'&&!(ka==='dmn.bkm'&&['dmn.decision','dmn.bkm','dmn.decisionservice'].includes(kb)))
    fail('DDN-PJ194','Knowledge requirement '+r.id+' flows from a BKM into a decision/BKM/service; found '+(ka||'?')+' -> '+(kb||'?'),r);
   if(r.kind==='dmn.authorityreq'&&!(['dmn.knowledgesource','dmn.decision'].includes(ka)&&['dmn.knowledgesource','dmn.decision','dmn.bkm','dmn.decisionservice'].includes(kb)))
    fail('DDN-PJ194','Authority requirement '+r.id+' flows from a knowledge source or decision; found '+(ka||'?')+' -> '+(kb||'?'),r);
  }
 }
 /* B1-065 (RFC-128): SysML 1.6 semantics. */
 {
  const BLOCKY=['sysml.block','sysml.interfaceblock','sysml.valuetype','sysml.flowspec','sysml.constraint'];
  for(const n of ir.elements){
   for(const f of n.fields){
    const xb=f.properties.x_block;
    if(xb!==undefined&&!['sysml.block','sysml.interfaceblock'].includes(n.kind))fail('DDN-PJ186','x_block compartments belong to sysml.block/sysml.interfaceblock fields; '+n.id+' is '+n.kind,f);
    const xu=f.properties.x_unit;
    if(xu!==undefined){const entry=UNITS.units.find(u=>u.symbol===xu.unit);
     if(!entry)fail('DDN-PJ188','Field '+f.id+' declares unit '+JSON.stringify(xu.unit)+' which is not in the units registry (standard/registry/units.json)',f);
     else if(xu.quantity!==undefined&&entry.quantity!==xu.quantity)fail('DDN-PJ188','Field '+f.id+' declares quantity '+JSON.stringify(xu.quantity)+' but unit '+xu.unit+' is a '+entry.quantity+' unit',f);}
   }
   for(const pt of n.ports||[]){
    const xp=pt.properties.x_port;
    if(xp===undefined)continue;
    if(!BLOCKY.includes(n.kind))fail('DDN-PJ187','x_port typing applies to ports of block-family kinds; '+n.id+' is '+n.kind,pt);
    if(xp.nested){const names=xp.nested.map(x=>x.name);if(new Set(names).size!==names.length)fail('DDN-PJ187','Port '+pt.id+' declares duplicate nested port names',pt);}
    if(xp.multiplicity!==undefined&&!/^(\d+|\*)(\.\.(\d+|\*))?$/.test(xp.multiplicity))fail('DDN-PJ187','Port '+pt.id+' multiplicity must be a UML multiplicity; found '+JSON.stringify(xp.multiplicity),pt);
   }
  }
  for(const r of ir.relations){
   const a=ns.get(r.from.element),b=ns.get(r.to.element),ka=a?.kind,kb=b?.kind;
   const reqDep={'sysml.derive':[['req.requirement'],['req.requirement']],'sysml.copy':[['req.requirement'],['req.requirement']],'sysml.master':[['req.requirement'],['req.requirement']],'sysml.verify':[['sysml.testcase','req.test'],['req.requirement']],'sysml.satisfy':[BLOCKY.concat(['uml.class','activity','flow.process']),['req.requirement']]}[r.kind];
   if(reqDep){const [src,tgt]=reqDep;
    if(!src.includes(ka))fail('DDN-PJ185',r.kind+' '+r.id+' must start at '+src.join('/')+'; found '+(ka||'unresolved'),r);
    if(!tgt.includes(kb))fail('DDN-PJ185',r.kind+' '+r.id+' must target '+tgt.join('/')+'; found '+(kb||'unresolved'),r);}
   if(r.kind==='sysml.composition'&&!(BLOCKY.includes(ka)||ka==='req.requirement')||r.kind==='sysml.composition'&&!(BLOCKY.includes(kb)||kb==='req.requirement'))
    fail('DDN-PJ190','sysml.composition '+r.id+' connects block-family kinds or requirements; found '+(ka||'?')+' -> '+(kb||'?'),r);
   if(r.kind==='uml.generalization'&&profile.startsWith('sysml.')&&!(BLOCKY.includes(ka)&&BLOCKY.includes(kb)))
    fail('DDN-PJ190','Generalization '+r.id+' under '+profile+' connects block-family kinds; found '+(ka||'?')+' -> '+(kb||'?'),r);
   const xf=r.properties.x_flow;
   if(xf!==undefined&&(r.kind!=='uml.flow'||profile!=='sysml.activity@1'))fail('DDN-PJ191','x_flow (rate/probability/continuous) annotates uml.flow edges under sysml.activity@1; '+r.id+' is '+r.kind+' under '+profile,r);
  }
  if(profile==='sysml.parametric@2'){
   const es=ir.relations.filter(r=>ir.view.relations.includes(r.id));
   for(const n of ir.elements.filter(n=>shown.has(n.id)&&n.kind==='sysml.constraint')){
    const count=es.filter(r=>r.from.element===n.id||r.to.element===n.id).length;
    if(count<1)fail('DDN-PJ189','Constraint '+(n.name||n.id)+' binds no endpoint; a parametric constraint binds at least one',n);
   }
  }
  if(profile==='sysml.ibd@2'){
   for(const r of ir.relations.filter(r=>ir.view.relations.includes(r.id)&&r.kind==='sysml.flow'))
    for(const [label,ep]of [['source',r.from],['target',r.to]]){
     const host=ns.get(ep.element);
     if(!host||!BLOCKY.includes(host.kind))fail('DDN-PJ191','Item flow '+r.id+' '+label+' must be a block-family element or one of its ports; found '+(host?host.kind:'unresolved'),r);
    }
  }
 }
 if(profile==='archimate.basic@1'){
  const LAYERS=['business','application','technology'],layer=k=>{const m=/^archi\.(business|application|technology)_/.exec(k||'');return m?m[1]:null;};
  for(const r of ir.relations.filter(r=>ir.view.relations.includes(r.id)&&r.kind==='archi.rel')){
   const a=ns.get(r.from.element),b=ns.get(r.to.element),la=layer(a?.kind),lb=layer(b?.kind);
   if(!la||!lb)fail('DDN-PJ123','Relation '+r.id+' (archi.rel) endpoint kind '+(la?b?.kind:a?.kind)+' is outside the nine registered archi.* kinds (endpoint layers '+(la||'none')+' -> '+(lb||'none')+')',r);
   if(LAYERS.indexOf(la)<LAYERS.indexOf(lb))fail('DDN-PJ123','Relation '+r.id+' (archi.rel) links '+la+' -> '+lb+'; the fixed layer-pair table allows same-layer and upward (serving) links only',r);
  }
 }
 if(profile==='cmmn.basic@1'){
  const stages=(ir.view.frames||[]).filter(f=>ns.get(f.scope)?.kind==='cmmn.stage');
  for(const n of ir.elements.filter(n=>shown.has(n.id)&&n.kind==='cmmn.sentry')){
   if(!stages.some(f=>f.members.includes(n.id)))fail('DDN-PJ120','Sentry '+(n.name||n.id)+' is not a member of any frame whose scope is a cmmn.stage; sentries belong on a stage border declared by frame membership',n);
   if(!['entry','exit'].includes(n.properties.x_sentry?.on))fail('DDN-PJ120','Sentry '+(n.name||n.id)+' lacks a valid x_sentry.on (entry or exit)',n);
  }
 }
 if(['network.basic@1','network.rack@1'].includes(profile)){
  for(const r of ir.relations.filter(r=>ir.view.relations.includes(r.id)&&r.kind==='network.attaches')){
   const t=ns.get(r.to.element);
   if(t?.kind!=='network.bus'&&!r.to.member)fail('DDN-PJ127','Attachment '+(r.name||r.id)+' targets '+(t?.name||r.to.element)+' ('+(t?.kind||'unknown')+'); a network.attaches relation must target a network.bus element or a port member',r);
  }
  if(profile==='network.rack@1'){
   for(const f of (ir.view.frames||[]).filter(f=>ns.get(f.scope)?.kind==='network.rack')){
    const rack=ns.get(f.scope),units=rack.properties.x_rack?.units,seen=new Map();
    for(const id of f.members){const n=ns.get(id),unit=n?.properties.x_rack?.unit;
     if(unit===undefined)continue;
     if(!Number.isSafeInteger(units)||unit<1||unit>units)fail('DDN-PJ127','Device '+(n.name||n.id)+' declares rack slot unit '+unit+' but rack '+(rack.name||rack.id)+' has '+(units===undefined?'no declared x_rack.units':'x_rack.units '+units)+'; slot numbers must be >= 1 and within the rack height',n);
     if(seen.has(unit))fail('DDN-PJ127','Devices '+(seen.get(unit).name||seen.get(unit).id)+' and '+(n.name||n.id)+' both declare rack slot unit '+unit+' in rack '+(rack.name||rack.id)+'; slot numbers must be unique per rack frame',n);
     seen.set(unit,n);
    }
   }
  }
 }
 if(['fault.tree@1','event.tree@1'].includes(profile)){
  const es=ir.relations.filter(r=>ir.view.relations.includes(r.id)&&r.kind==='tree.input');
  for(const n of ir.elements.filter(n=>shown.has(n.id)&&n.kind==='tree.gate')){
   const count=es.filter(r=>r.from.element===n.id).length,type=n.properties.x_gate?.type;
   if(!['and','or'].includes(type)||count<2)fail('DDN-PJ126','Gate '+(n.name||n.id)+' has '+count+' visible tree.input edge(s) and declared type '+(type||'none')+'; every gate must declare x_gate.type (and/or) and have at least two inputs',n);
  }
 }
 if(profile==='family.tree@1'){
  const included=ir.elements.filter(n=>shown.has(n.id)),pes=ir.relations.filter(r=>shown.has(r.from.element)&&shown.has(r.to.element)&&r.kind==='family.parent_of');
  const kids=new Map();for(const r of pes){if(!kids.has(r.from.element))kids.set(r.from.element,[]);kids.get(r.from.element).push(r.to.element);}
  const active=new Set(),seen=new Set();function visit(id){if(active.has(id)){const n=ns.get(id);fail('DDN-PJ129','Lineage cycle: '+(n?.name||id)+' cannot be its own ancestor; family.parent_of edges must be acyclic',n);}if(seen.has(id))return;active.add(id);for(const c of kids.get(id)||[])visit(c);active.delete(id);seen.add(id);}
  for(const n of included)visit(n.id);
  for(const n of included.filter(n=>n.kind==='family.person')){
   const parents=new Set(pes.filter(r=>r.to.element===n.id).map(r=>r.from.element));
   if(parents.size>2)fail('DDN-PJ130','Person '+(n.name||n.id)+' has '+parents.size+' distinct family.parent_of sources; at most two parents can be drawn faithfully — split extra parentage into separate unions/partners',n);
  }
 }
}
const api={VERSION:'0.7.0',validate};
publishNamespace('DDNProfileQuality',api);
export default api;
