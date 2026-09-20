/* SPDX-License-Identifier: GPL-2.0-or-later. Additive profile-completion contracts. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DDNProfileQuality=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function validate(ir,E){
 const ns=new Map(ir.elements.map(n=>[n.id,n])),shown=new Set(ir.view.selected),profile=ir.view.profiles.projection.profile;
 const fail=(c,m,n)=>{const e=new E(c,m,n?.source?.file||ir.view.source.file,n?.source?.start||ir.view.source.start);if(E===Error){e.code=c;e.message=m;}throw e;};
 const keys=(o,a,label,n)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!a.includes(k)))fail('DDN-PX001','Unknown or malformed '+label,n);};
 for(const n of ir.elements){
  if(n.properties.x_state){keys(n.properties.x_state,['terminal'],'state metadata',n);if(n.properties.x_state.terminal!==undefined&&typeof n.properties.x_state.terminal!=='boolean')fail('DDN-PX001','terminal is boolean',n);if(!n.kind.startsWith('state.'))fail('DDN-PX001','x_state applies only to state kinds',n);}
  if(n.properties.x_usecase){const x=n.properties.x_usecase;keys(x,['subjects','extension_points'],'use-case metadata',n);if(!['uml.usecase','uml.actor'].includes(n.kind))fail('DDN-PX002','Use-case metadata has an incompatible owner',n);if(x.subjects!==undefined&&(!Array.isArray(x.subjects)||x.subjects.some(r=>ns.get(r?.$ref)?.kind!=='uml.subject')||new Set(x.subjects.map(r=>r.$ref)).size!==x.subjects.length))fail('DDN-PX002','subjects must reference distinct uml.subject definitions',n);if(x.extension_points!==undefined&&(n.kind!=='uml.usecase'||!Array.isArray(x.extension_points)||x.extension_points.some(k=>typeof k!=='string'||!k.trim())||new Set(x.extension_points).size!==x.extension_points.length))fail('DDN-PX002','Extension points must be unique names on a use case',n);}
  if(n.properties.x_chen){const x=n.properties.x_chen;keys(x,['weak','owner'],'Chen entity metadata',n);if(n.kind!=='entity'||x.weak!==undefined&&typeof x.weak!=='boolean')fail('DDN-PX003','Invalid Chen entity metadata',n);if(x.weak){const owner=ns.get(x.owner?.$ref);if(!owner||owner.kind!=='entity'||owner.id===n.id)fail('DDN-PX003','Weak entity requires a distinct entity owner',n);if(!n.fields.some(f=>f.properties.x_chen?.partial_key))fail('DDN-PX003','Weak entity requires a declared partial key',n);}else if(x.owner)fail('DDN-PX003','Only weak entities declare identifying owner',n);}
  for(const f of n.fields){if(!f.properties.x_chen)continue;const x=f.properties.x_chen;keys(x,['key','partial_key','multivalued','derived','composite'],'Chen field metadata',f);if(n.kind!=='entity'||Object.values(x).some(v=>typeof v!=='boolean'))fail('DDN-PX003','Chen field flags are booleans on entity fields',f);if(x.partial_key&&!n.properties.x_chen?.weak||x.partial_key&&x.key)fail('DDN-PX003','A partial key belongs to a weak entity and is not a full key',f);if((x.key||x.partial_key)&&(x.derived||x.multivalued))fail('DDN-PX003','Key fields cannot be derived or multivalued',f);const child=n.fields.some(g=>g.parent===f.id);if(child&&!x.composite||x.composite&&!child)fail('DDN-PX003','Composite declaration must match actual child fields',f);}
 }
 for(const r of ir.relations){
  if(r.properties.x_usecase){const x=r.properties.x_usecase;keys(x,['extension_point','condition','condition_ref'],'extend metadata',r);const t=ns.get(r.to.element),a=ns.get(r.from.element);if(r.kind!=='uml.extend'||typeof x.extension_point!=='string'||!t?.properties.x_usecase?.extension_points?.includes(x.extension_point))fail('DDN-PX004','Extend must name an extension point on its target use case',r);if((typeof x.condition!=='string'||!x.condition.trim())&&!ns.has(x.condition_ref?.$ref))fail('DDN-PX004','Extend requires a stated condition or condition definition',r);if(x.condition&&x.condition_ref)fail('DDN-PX004','Use one condition form',r);}
  if(r.properties.x_chen){const x=r.properties.x_chen;keys(x,['identifying','owner','weak','from','to'],'Chen association metadata',r);if(!['assoc','ref'].includes(r.kind)||r.from.member||r.to.member)fail('DDN-PX005','Chen associations are binary object-level assoc/ref',r);for(const side of ['from','to']){const m=x[side];if(m){keys(m,['min','max'],'participation bound',r);if(!Number.isSafeInteger(m.min)||m.min<0||!(m.max==='many'||Number.isSafeInteger(m.max)&&m.max>=m.min))fail('DDN-PX005','Participation is nonnegative min/max or max:many',r);}}
   if(x.identifying!==undefined&&typeof x.identifying!=='boolean')fail('DDN-PX005','identifying is boolean',r);if(x.identifying){const weak=ns.get(x.weak?.$ref),owner=ns.get(x.owner?.$ref);if(!weak?.properties.x_chen?.weak||weak.properties.x_chen.owner?.$ref!==owner?.id||!new Set([r.from.element,r.to.element]).has(weak?.id)||!new Set([r.from.element,r.to.element]).has(owner?.id))fail('DDN-PX005','Identifying association must connect the declared weak entity to its owner',r);const end=r.from.element===owner.id?x.from:x.to;if(!end||end.min!==1||end.max!==1)fail('DDN-PX005','Each weak instance has exactly one owner',r);}else if(x.owner||x.weak)fail('DDN-PX005','Nonidentifying relationship cannot declare owner/weak roles',r);}
 }
 if(profile==='uml.usecase@2'){
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
 if(profile==='uml.communication@1'){
  for(const r of ir.relations.filter(r=>ir.view.relations.includes(r.id)&&r.kind==='uml.message')){
   const seq=r.properties.x_message?.seq,ret=r.properties.x_return===true,dotted=/^\d+(\.\d+)+$/.test(seq||'');
   if(typeof seq!=='string'||!seq)fail('DDN-PJ111','Message '+r.id+' lacks a declared sequence number (x_message.seq)',r);
   if(!/^\d+(\.\d+)*$/.test(seq))fail('DDN-PJ111','Message '+r.id+' has malformed sequence number '+JSON.stringify(seq)+' (expected digits with optional dot segments)',r);
   if(ret&&!dotted)fail('DDN-PJ111','Reply message '+r.id+' must be numbered dotted under its request (e.g. 2.1), got '+seq,r);
   if(!ret&&dotted)fail('DDN-PJ111','Non-reply message '+r.id+' must carry a top-level number, got dotted '+seq,r);
  }
 }
 if(profile==='state.composite@1'){
  const frames=ir.view.frames||[],regions=frames.filter(f=>f.x_region===true);
  const collide=f=>{const initials=f.members.map(id=>ns.get(id)).filter(n=>n?.kind==='state.initial');if(initials.length>1)fail('DDN-PJ113','Frame '+(f.name||f.id)+' declares '+initials.length+' initial states ('+initials.map(n=>n.id).join(', ')+'); at most one initial state per region');};
  for(const f of regions)collide(f);
  for(const f of frames){if(f.x_region===true)continue;if(ns.get(f.scope)?.kind!=='state.state')continue;if(regions.some(r=>r.members.length&&r.members.every(id=>f.members.includes(id))))continue;collide(f);}
 }
 if(profile==='uml.activity@1'){
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
 if(profile.startsWith('sysml.')){
  for(const n of ir.elements.filter(n=>shown.has(n.id)&&n.ports.length&&n.kind!=='sysml.block'))
   fail('DDN-PJ121','Element '+(n.name||n.id)+' (kind '+n.kind+') declares a ports group; under sysml.* profiles only sysml.block elements declare ports',n);
 }
 if(profile==='sysml.parametric@1'){
  const es=ir.relations.filter(r=>ir.view.relations.includes(r.id));
  for(const n of ir.elements.filter(n=>shown.has(n.id)&&n.kind==='sysml.constraint')){
   const count=es.filter(r=>r.from.element===n.id||r.to.element===n.id).length;
   if(count!==2)fail('DDN-PJ122','Constraint '+(n.name||n.id)+' is touched by '+count+' visible relation(s); a parametric constraint binds exactly two endpoints',n);
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
}
return{VERSION:'0.5.0-draft.2',validate};
});
