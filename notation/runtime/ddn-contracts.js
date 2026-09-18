/* SPDX-License-Identifier: GPL-2.0-or-later
 * DDN 0.3 semantic contracts. Pure data validation; no eval, network, or ERP execution.
 * The small schema vocabulary is explicit: never describe it as a complete JSON Schema implementation.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DDNContracts=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='0.3.0-draft.1';
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function schemaErrors(value,schema,path='$'){
 const errors=[];
 if(schema===true||schema===undefined)return errors;
 if(schema===false)return [path+': forbidden value'];
 if(schema.const!==undefined&&JSON.stringify(value)!==JSON.stringify(schema.const))errors.push(path+': unexpected constant');
 if(schema.enum&&!schema.enum.some(v=>JSON.stringify(v)===JSON.stringify(value)))errors.push(path+': value is not in the declared enumeration');
 const type=x=>x===null?'null':Array.isArray(x)?'array':typeof x==='object'?'object':typeof x;
 if(schema.type){const types=Array.isArray(schema.type)?schema.type:[schema.type];if(!types.some(t=>t==='integer'?Number.isSafeInteger(value):type(value)===t))return [...errors,path+': expected '+types.join('|')];}
 if(typeof value==='string'){
  if(schema.minLength!==undefined&&[...value].length<schema.minLength)errors.push(path+': string is too short');
  if(schema.maxLength!==undefined&&[...value].length>schema.maxLength)errors.push(path+': string is too long');
  if(schema.pattern&&!new RegExp(schema.pattern,'u').test(value))errors.push(path+': string does not match declared pattern');
 }
 if(typeof value==='number'){
  if(!Number.isFinite(value))errors.push(path+': number is not finite');
  if(schema.minimum!==undefined&&value<schema.minimum)errors.push(path+': below minimum');
  if(schema.maximum!==undefined&&value>schema.maximum)errors.push(path+': above maximum');
 }
 if(Array.isArray(value)){
  if(schema.minItems!==undefined&&value.length<schema.minItems)errors.push(path+': not enough items');
  if(schema.maxItems!==undefined&&value.length>schema.maxItems)errors.push(path+': too many items');
  if(schema.uniqueItems&&new Set(value.map(v=>JSON.stringify(v))).size!==value.length)errors.push(path+': duplicate items');
  if(schema.items!==undefined)value.forEach((v,i)=>errors.push(...schemaErrors(v,schema.items,path+'['+i+']')));
 }
 if(isObject(value)){
  for(const key of schema.required||[])if(!Object.hasOwn(value,key))errors.push(path+'.'+key+': required');
  for(const [key,v]of Object.entries(value)){
   if(schema.properties&&Object.hasOwn(schema.properties,key))errors.push(...schemaErrors(v,schema.properties[key],path+'.'+key));
   else if(schema.additionalProperties===false)errors.push(path+'.'+key+': undeclared property');
   else if(isObject(schema.additionalProperties))errors.push(...schemaErrors(v,schema.additionalProperties,path+'.'+key));
  }
 }
 for(const s of schema.allOf||[])errors.push(...schemaErrors(value,s,path));
 if(schema.anyOf&&!schema.anyOf.some(s=>!schemaErrors(value,s,path).length))errors.push(path+': no alternative matched');
 if(schema.oneOf&&schema.oneOf.filter(s=>!schemaErrors(value,s,path).length).length!==1)errors.push(path+': must match exactly one alternative');
 return errors;
}
function validate(ir,registry,ErrorClass){
 const diagnostics=[],mode=ir.view.profiles.validation?.mode||'logical';
 const fail=(code,msg,item)=>{throw new ErrorClass(code,msg,item?.source?.file,item?.source?.start);};
 const warn=(code,msg,item)=>diagnostics.push({code,severity:'warning',message:msg,source:item?.source?.file||'',offset:item?.source?.start||0});
 const elements=new Map(ir.elements.map(x=>[x.id,x])),fields=new Map(ir.elements.flatMap(x=>x.fields.map(f=>[f.id,{...f,owner:x}])));
 const allMembers=new Map(ir.elements.flatMap(x=>[...x.fields,...x.ports].map(f=>[f.id,{...f,owner:x}])));
 const kinds=new Map(registry.kinds.map(k=>[k.keyword,k]));
 const state=v=>isObject(v)&&Object.hasOwn(v,'$state');
 const reserved=new Set(['uid','description','aliases','kind','level','representation','platform','maturity','workload','role','temporal','time','distribution','location','meaning','scope','domain','datatype','key','nullable','presence','shape','unit','default','ordinal','classification','policy','owner','columns','rows','mode','capture','delivery','transport','enforcement','source_mark','target_mark','source_cardinality','target_cardinality','ordering','direction','payload','version','allow_extra','discriminator','variants','optional','dimension','target','min','max']);
 function props(item,target){
  for(const [key,value]of Object.entries(item.properties||{})){
   if(key.startsWith('x_')){
    const contract=registry.extension_contracts?.[key];
    if(!contract){if(ir.view.profiles.validation?.unknown_extensions==='error'||mode==='strict')fail('DDN103','Unregistered extension '+key,item);warn('DDN-W103','Preserved unvalidated extension '+key,item);continue;}
    const schema=contract.targets[target+':'+item.kind]||contract.targets[target];
    if(!schema)fail('DDN104',key+' does not apply to '+target,item);
    const errors=schemaErrors(value,schema,item.id+'.'+key);
    if(errors.length)fail('DDN105',errors[0],item);
   }else if(!reserved.has(key)){
    if(mode==='strict')fail('DDN106','Unknown semantic property '+key,item);
    warn('DDN-W106','Unregistered semantic property '+key+' is retained, not validated',item);
   }
  }
  for(const k of ['nullable','optional','allow_extra'])if(item.properties?.[k]!==undefined&&!state(item.properties[k])&&typeof item.properties[k]!=='boolean')fail('DDN107',k+' must be boolean or explicit unknown state',item);
  if(item.properties?.presence!==undefined&&!['required','optional'].includes(item.properties.presence)&&!state(item.properties.presence))fail('DDN107','presence must be required, optional, or an explicit state',item);
  if(item.properties?.domain!==undefined&&!state(item.properties.domain)){
   const d=elements.get(item.properties.domain.$ref);
   if(!d||d.kind!=='domain')fail('DDN108','domain must resolve to a semantic domain',item);
  }
  if(item.properties?.level&&!['concept','definition','instance','fragment','copy'].includes(item.properties.level)&&!state(item.properties.level))fail('DDN109','Unknown modeling level',item);
 }
 for(const n of ir.elements){props(n,n.type==='domain'?'domain':n.type==='sample'?'sample':n.type==='assertion'?'assertion':'object');for(const f of n.fields)props(f,'field');for(const p of n.ports)props(p,'port');
  const erp=n.properties.x_erp;
  if(erp&&n.kind==='table'){
   const locals=new Set(n.fields.map(f=>f.local));
   for(const tuple of [erp.primary_key,...(erp.unique_keys||[])]){
    if(!Array.isArray(tuple)||!tuple.length)fail('DDN110','Key must contain fields',n);
    if(new Set(tuple).size!==tuple.length)fail('DDN110','Duplicate key member',n);
    for(const f of tuple)if(!locals.has(f))fail('DDN110','Key references missing field '+f,n);
   }
   if(erp.scope==='company'&&!locals.has('company_id'))fail('DDN110','Company-scoped entity requires company_id',n);
  }
  for(const f of n.fields){
   if(f.parent&&!fields.has(f.parent))fail('DDN111','Missing parent of nested field',f);
   if(f.properties.shape!==undefined&&!['scalar','object','array','map','variant','record','set'].includes(f.properties.shape))fail('DDN112','Unsupported field shape '+f.properties.shape,f);
   if(f.properties.shape==='variant'){
    const variants=f.properties.variants;
    if(!Array.isArray(variants)||variants.length<2||new Set(variants).size!==variants.length)fail('DDN113','Variant requires at least two distinct named alternatives',f);
    if(!f.properties.discriminator)fail('DDN113','Variant requires explicit discriminator name',f);
   }
  }
 }
 for(const rel of ir.relations){
  props(rel,'relation');const a=elements.get(rel.from.element),b=elements.get(rel.to.element),r=registry.relationships.find(x=>x.keyword===rel.kind),contract=r?.endpoint_contract;
  if(!contract)fail('DDN100','No endpoint contract for '+rel.kind,rel);
  for(const [label,n,ep]of [['source',a,rel.from],['target',b,rel.to]]){
   if(ep.member&&!allMembers.has(ep.member))fail('DDN101','Missing '+label+' member',rel);
   const allowed=contract[label];
   if(n.kind==='object'&&!allowed.includes('object')&&!allowed.includes('*')){
    if(mode==='strict')fail('DDN102','Unspecified '+label+' kind cannot satisfy '+rel.kind,rel);
    warn('DDN-W102','Endpoint-kind check deferred for sketch object '+n.id,rel);
   }else if(!allowed.includes('*')&&!allowed.includes(n.kind))fail('DDN102',rel.kind+' cannot use '+n.kind+' as '+label,rel);
   if(contract.member_endpoints===false&&ep.member)fail('DDN102',rel.kind+' requires object endpoints',rel);
  }
  if(contract.allow_self===false&&a.id===b.id)fail('DDN102',rel.kind+' requires distinct object identities',rel);
  const marks=['none','filled','open','diamond','triangle','one','zeroone','many','zeromany'];
  for(const side of ['source','target']){const mark=rel.properties[side+'_mark'];if(mark!==undefined&&!marks.includes(mark))fail('DDN114','Unknown endpoint mark '+mark,rel);
   if(mark&&['one','zeroone','many','zeromany','diamond','triangle'].includes(mark)&&r.family!=='structural')fail('DDN114','Structural participation markers do not apply to '+r.family+' relations',rel);
  }
  if(rel.kind==='domain'||rel.kind==='candidate'){if(!rel.from.member)warn('DDN-W108','Object-level domain association: no field binding inferred',rel);}
  if(rel.kind==='instance'){
   if(a.properties.level&&a.properties.level!=='instance'&&a.properties.level!=='copy')fail('DDN115','Instance relation source must be an instance/copy when its level is asserted',rel);
   if(b.properties.level&&b.properties.level!=='definition')fail('DDN115','Instance relation target must be a definition when its level is asserted',rel);
  }
  const x=rel.properties.x_erp;
  if(x){if(x.join_fields){for(const name of x.join_fields)if(!b.fields.some(f=>f.local===name))fail('DDN116','Join tuple names missing target field '+name,rel);if(x.same_company&&!a.fields.some(f=>f.local==='company_id'))fail('DDN116','Same-company comparison requires source company_id',rel);if(x.same_company&&!x.join_fields.includes('company_id'))fail('DDN116','Same-company reference must include company_id in target tuple',rel);}
   // Preserve logical versus physical enforcement boundaries.
   if(x.enforcement==='database'&&a.properties.x_erp?.database&&b.properties.x_erp?.database&&a.properties.x_erp.database!==b.properties.x_erp.database)fail('DDN116','A cross-database reference cannot claim a local physical foreign key',rel);
  }
 }
 validateProcessContracts(ir,fail,warn);
 return diagnostics;
}
function refId(v){return typeof v==='string'?v:v?.$ref;}
function validateProcessContracts(ir,fail,warn){
 const byId=new Map(ir.elements.map(n=>[n.id,n]));const members=new Map(ir.elements.flatMap(n=>[...n.fields,...n.ports].map(p=>[p.id,p])));
 const relations=new Map(ir.relations.map(r=>[r.id,r]));
 for(const n of ir.elements){
  const workflow=n.properties.x_workflow;
  if(workflow){
   const errors=workflowErrors(workflow);if(errors.length)fail('DDN130',n.id+': '+errors[0],n);
  }
  const bd=n.properties.x_boundary;
  if(bd){
   const outer=Array.isArray(bd.ports)?bd.ports:[],maps=Array.isArray(bd.bindings)?bd.bindings:[];
   if(!outer.length)fail('DDN131','Boundary must declare ports',n);
   const seen=new Set();
   for(const binding of maps){const ext=refId(binding.external),inside=refId(binding.internal);if(seen.has(ext))fail('DDN132','Boundary port bound more than once: '+ext,n);seen.add(ext);
    if(!outer.some(p=>refId(p)===ext))fail('DDN132','Binding is not a declared boundary port',n);
    const a=members.get(ext),b=members.get(inside);if(!n.ports.some(p=>p.id===ext)||!ir.elements.some(el=>el.id!==n.id&&el.ports.some(p=>p.id===inside)))fail('DDN132','Boundary bindings must map this object port to a different object port',n);if(!a||!b)fail('DDN132','Binding must resolve to ports',n);
    if(!['in','out'].includes(a.properties.direction)||!['in','out'].includes(b.properties.direction))fail('DDN133','Boundary direction must be in or out',n);if(!byId.has(refId(a.properties.payload)))fail('DDN133','Boundary payload must identify an existing contract',n);if(a.properties.direction!==b.properties.direction)fail('DDN133','Boundary direction mismatch',n);
    if(refId(a.properties.payload)!==refId(b.properties.payload))fail('DDN133','Boundary payload mismatch',n);
   }
   if(outer.some(p=>!seen.has(refId(p))))fail('DDN132','Unbound boundary port',n);
  }
  const req=n.properties.x_requirement;
  if(req){
   if(!req.id||!req.owner||!req.acceptance||!['proposed','required','accepted','rejected','waived'].includes(req.state))fail('DDN134','Requirement needs id, owner, acceptance and explicit state',n);
   if(['accepted','waived'].includes(req.state)&&!(req.evidence||[]).length)fail('DDN135','Accepted/waived requirement needs evidence references; prose approval is insufficient',n);
   for(const e of req.evidence||[]){const ev=byId.get(refId(e));if(!ev?.properties.x_evidence)fail('DDN135','Requirement evidence must refer to an evidence contract',n);}
  }
  const ev=n.properties.x_evidence;
  if(ev){if(!ev.method||!ev.scope||!ev.observed_at||!ev.subject_hash||!['pass','fail','not_run'].includes(ev.result))fail('DDN136','Evidence requires method, scope, observation date, subject hash and outcome',n);
   if(ev.result==='pass'&&!ev.artifact_digest)fail('DDN136','Passing evidence requires an artifact digest',n);
  }
  const affinity=n.properties.x_affinity;
  if(affinity){
   if(!Array.isArray(affinity.rules)||!affinity.rules.length)fail('DDN137','Affinity must list explicit field comparisons',n);
   for(const r of affinity.rules)if(!members.has(refId(r.left))||!members.has(refId(r.right))||r.op!=='eq')fail('DDN137','Affinity requires existing fields and eq operator',n);
   if(!['database','command','reconciliation'].includes(affinity.enforcement))fail('DDN137','Affinity must name enforcement responsibility',n);
  }
  const rec=n.properties.x_reconciliation;
  if(rec){if(!rec.owner||!rec.idempotency_key||!Array.isArray(rec.states)||!['pending','accepted','rejected','compensated'].every(s=>rec.states.includes(s)))fail('DDN138','Cross-service contract requires owner, idempotency key and terminal-state vocabulary',n);
   if(!rec.timeout||!rec.compensation||!rec.evidence)fail('DDN138','Reconciliation requires timeout, compensation and evidence requirements',n);
  }
  const constraint=n.properties.x_constraint;
  if(constraint){const ids=new Set(n.fields.map(f=>f.local));const bad=constraintErrors(constraint,ids);if(bad.length)fail('DDN140',n.id+': '+bad[0],n);}
  const ui=n.properties.x_ui;
  if(ui){if(!Array.isArray(ui.bindings)||!ui.bindings.length||!Array.isArray(ui.commands))fail('DDN141','UI needs explicit field bindings and command contracts',n);
   const controls=new Set();for(const b of ui.bindings){if(!b.control||controls.has(b.control)||!members.has(refId(b.field)))fail('DDN141','UI binding requires a unique control and an existing field',n);controls.add(b.control);}
   for(const c of ui.commands)if(!c.id||!c.authorization||!c.validation||!c.concurrency||!c.failure||!c.audit)fail('DDN141','UI command needs authorization, validation, concurrency, failure and audit contracts',n);
  }
  const report=n.properties.x_report;
  if(report){if(!report.grain||!report.cutoff||!report.reconciliation||!Array.isArray(report.columns))fail('DDN142','Report needs grain, cutoff, columns and reconciliation',n);
   for(const c of report.columns){if(!c.name||!Array.isArray(c.sources)||!c.sources.length||c.sources.some(v=>!members.has(refId(v))))fail('DDN142','Report columns must bind existing source fields',n);if(c.aggregation&&!['none','sum','count','min','max','average'].includes(c.aggregation))fail('DDN142','Unknown report aggregation; register an algorithm contract',n);}
  }
  const custody=n.properties.x_custody;
  if(custody){for(const key of ['anchor_authority','key_custodian','retention_policy','hold_policy','independent_evidence'])if(!custody[key])fail('DDN139','Custody declaration lacks '+key,n);}
 }
}
// A small declarative guard language. It evaluates supplied fixtures, not JavaScript/SQL.
function guardErrors(g){
 if(g===true||g===false)return[];
 if(!isObject(g))return['guard must be boolean or a declarative expression'];
 if(g.all||g.any){const a=g.all||g.any;if(!Array.isArray(a)||!a.length)return['empty guard group'];return a.flatMap(guardErrors);}
 if(g.not!==undefined)return guardErrors(g.not);
 if(typeof g.field!=='string'||!g.field||g.field.split('.').some(k=>['__proto__','constructor','prototype'].includes(k)))return['invalid guard field path'];
 if(!['eq','ne','lt','lte','gt','gte','in','exists'].includes(g.op))return['unknown guard operator'];
 if(g.op==='in'&&!Array.isArray(g.value))return['in needs an array'];return[];
}
function evaluateGuard(g,context){
 const errors=guardErrors(g);if(errors.length)throw new Error(errors[0]);if(typeof g==='boolean')return g;
 if(g.all)return g.all.every(x=>evaluateGuard(x,context));if(g.any)return g.any.some(x=>evaluateGuard(x,context));if(g.not!==undefined)return !evaluateGuard(g.not,context);
 let value=context;for(const key of g.field.split('.')){if(!isObject(value)||!Object.hasOwn(value,key)){value=undefined;break;}value=value[key];}
 if(g.op==='exists')return value!==undefined;
 if(value===undefined)throw new Error('Missing guard input '+g.field);
 switch(g.op){case'eq':return value===g.value;case'ne':return value!==g.value;case'in':return g.value.includes(value);case'lt':return value<g.value;case'lte':return value<=g.value;case'gt':return value>g.value;case'gte':return value>=g.value;}
}
function workflowErrors(w){
 const errors=[];if(!Array.isArray(w.states)||!w.states.length)return['states are required'];
 const states=new Set(w.states);if(states.size!==w.states.length)errors.push('duplicate state');if(!states.has(w.initial))errors.push('initial state missing');
 if(!Array.isArray(w.terminal)||!w.terminal.length||w.terminal.some(x=>!states.has(x)))errors.push('explicit terminal states are required');
 if(!Array.isArray(w.transitions))return [...errors,'transitions required'];
 const ids=new Set();for(const t of w.transitions){if(!t.id||ids.has(t.id))errors.push('transition identity missing or repeated');ids.add(t.id);if(!states.has(t.from)||!states.has(t.to))errors.push('unknown transition endpoint');if(!t.event)errors.push('transition requires event');if(t.guard!==undefined)errors.push(...guardErrors(t.guard));if(t.max_visits!==undefined&&(!Number.isSafeInteger(t.max_visits)||t.max_visits<1))errors.push('max_visits must be a positive integer');if(w.terminal.includes(t.from))errors.push('terminal state has outgoing transition');}
 const reachable=new Set([w.initial]);for(let i=0;i<states.size;i++)for(const t of w.transitions)if(reachable.has(t.from))reachable.add(t.to);
 for(const s of states)if(!reachable.has(s))errors.push('unreachable state '+s);
 // Every cycle must be cut by at least one explicitly bounded edge.
 const active=new Set(),done=new Set();function visit(s){if(active.has(s)){errors.push('cycle requires a bounded max_visits transition');return;}if(done.has(s))return;active.add(s);for(const t of w.transitions)if(t.from===s&&t.max_visits===undefined)visit(t.to);active.delete(s);done.add(s);}for(const s of states)visit(s);
 // Structural ambiguities are rejected. Arbitrary logical disjointness is not guessed.
 const groups=new Map();for(const t of w.transitions){const k=t.from+'\0'+t.event;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(t);}
 for(const ts of groups.values())if(ts.length>1){const guards=ts.map(t=>t.guard);if(guards.some(g=>!isObject(g)||g.op!=='eq')||new Set(guards.map(g=>g.field)).size!==1||new Set(guards.map(g=>JSON.stringify(g.value))).size!==guards.length)errors.push('same-event branches must have distinct equality guards on the same field');}
 return [...new Set(errors)];
}
function runTrace(w,events){const errors=workflowErrors(w);if(errors.length)throw new Error(errors.join('; '));let state=w.initial;const visits={},trace=[state];
 for(const e of events){const options=w.transitions.filter(t=>t.from===state&&t.event===e.event&&(t.guard===undefined||evaluateGuard(t.guard,e.context||{})));if(options.length!==1)throw new Error('Trace has '+options.length+' enabled transitions at '+state);const t=options[0];visits[t.id]=(visits[t.id]||0)+1;if(t.max_visits!==undefined&&visits[t.id]>t.max_visits)throw new Error('Transition visit bound exceeded: '+t.id);state=t.to;trace.push(state);}
 return {state,terminal:w.terminal.includes(state),trace,visits};
}
function constraintErrors(c,fields){const err=[];if(!isObject(c))return['constraint must be a record'];
 const tuple=(xs,name)=>{if(!Array.isArray(xs)||!xs.length||new Set(xs).size!==xs.length)err.push(name+' requires distinct fields');else for(const x of xs)if(!fields.has(x))err.push(name+' names missing field '+x);};
 for(const t of c.unique||[])tuple(t,'unique');
 if(c.non_overlap){const n=c.non_overlap;tuple(n.partition_by,'partition_by');for(const k of ['from','to'])if(!fields.has(n[k]))err.push('interval '+k+' names missing field');if(n.bounds!=='half_open')err.push('Only explicit half_open intervals supported');}
 if(c.immutable_when!==undefined)err.push(...guardErrors(c.immutable_when));
 if(c.enforcement&&!['database','command','reconciliation','fixture_only'].includes(c.enforcement))err.push('Unknown enforcement role');return err;}
function checkRecords(contract,rows){const errors=[],fields=new Set(rows.flatMap(r=>Object.keys(r)));if(contractErrorsMissing(contract,fields))throw new Error('Record fixture is missing declared fields');
 for(const tuple of contract.unique||[]){const seen=new Set();for(let i=0;i<rows.length;i++){const vals=tuple.map(f=>rows[i][f]);if(vals.some(x=>x===null||x===undefined))continue;const key=JSON.stringify(vals);if(seen.has(key))errors.push({kind:'duplicate',row:i,fields:tuple});seen.add(key);}}
 const n=contract.non_overlap;if(n){const groups=new Map();rows.forEach((r,i)=>{const k=JSON.stringify(n.partition_by.map(f=>r[f]));if(!groups.has(k))groups.set(k,[]);const start=typeof r[n.from]==='number'?r[n.from]:Date.parse(r[n.from]),end=r[n.to]===null?Infinity:typeof r[n.to]==='number'?r[n.to]:Date.parse(r[n.to]);if(!Number.isFinite(start)||(!Number.isFinite(end)&&end!==Infinity)||start>=end)errors.push({kind:'invalid_interval',row:i});groups.get(k).push({start,end,i});});for(const a of groups.values()){a.sort((a,b)=>a.start-b.start||a.i-b.i);let end=-Infinity;for(const row of a){if(row.start<end)errors.push({kind:'overlap',row:row.i});end=Math.max(end,row.end);}}}
 return {valid:!errors.length,errors,scope:'supplied fixture only; no database constraints were installed'};}
function contractErrorsMissing(c,f){return constraintErrors(c,f).length>0;}
function checkMutation(contract,before,after){if(contract.immutable_when&&evaluateGuard(contract.immutable_when,before)&&JSON.stringify(before)!==JSON.stringify(after))return{valid:false,reason:'immutable pre-state'};return{valid:true};}
function checkAffinity(rules,records){return rules.every(r=>{const left=records[refId(r.left)],right=records[refId(r.right)];if(left===undefined||right===undefined)throw new Error('Missing affinity comparison input');return r.op==='eq'&&left===right;});}
function readiness(ir){const requirements=ir.elements.filter(x=>x.properties.x_requirement),byId=new Map(ir.elements.map(x=>[x.id,x]));return requirements.map(n=>{const r=n.properties.x_requirement,ev=(r.evidence||[]).map(e=>byId.get(refId(e))?.properties.x_evidence),blocked=!['accepted','waived'].includes(r.state)||!ev.length||ev.some(x=>!x||x.result!=='pass');return{id:r.id,owner:r.owner,state:r.state,blocked,reason:blocked?'Requirement lacks accepted, passing, scoped evidence':'Declared evidence present; authenticity and professional authority are not verified by the diagram compiler'};});}
return {VERSION,schemaErrors,validate,workflowErrors,evaluateGuard,runTrace,readiness,constraintErrors,checkRecords,checkMutation,checkAffinity};
});
