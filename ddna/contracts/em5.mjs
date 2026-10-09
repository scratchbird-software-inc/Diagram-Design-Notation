/* SPDX-License-Identifier: GPL-2.0-or-later.
 * EM-5 host-boundary validation; no solver, graph evaluator or host dispatch. */
export const PROFILES=Object.freeze({constraints:'ddna.em5.constraint-host@1',graph:'ddna.em5.graph-query@1'});
export const LIMITS=Object.freeze({bytes:2097152,depth:32,nodes:4096,edges:16384,variables:256,constraints:512,steps:100000,results:4096,deadlineMs:30000});
const own=(o,k)=>Object.hasOwn(o,k),record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'&&v.length>0&&v.length<=1024;
const id=v=>text(v)&&!['__proto__','constructor','prototype'].includes(v);
const integer=(v,max)=>Number.isSafeInteger(v)&&v>0&&v<=max;
const qualified=v=>text(v)&&/^[^\s:]+::[^\s:]+$/.test(v);
const stamp=v=>record(v)&&Object.keys(v).length===2&&text(v.id)&&text(v.version);
function fail(message){throw new Error(message);}
function need(ok,message){if(!ok)fail(message);}
function fields(v,required,optional=[]){need(record(v),'Expected record');need(required.every(k=>own(v,k)),'Missing fields: '+required.filter(k=>!own(v,k)).join(', '));need(Object.keys(v).every(k=>required.includes(k)||optional.includes(k)),'Unknown record property');}
function list(v,max,label){need(Array.isArray(v)&&v.length<=max,label+' exceeds list limit or is not a list');}
function unique(values,label){need(new Set(values).size===values.length,'Duplicate '+label);}
function json(v,depth=0,seen=new Set()){
 need(depth<=LIMITS.depth,'JSON depth limit');
 if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return;
 need(record(v)||Array.isArray(v),'Finite JSON values required');need(!seen.has(v),'Cyclic JSON');seen.add(v);
 need(Object.getPrototypeOf(v)===null||Object.getPrototypeOf(v)===(Array.isArray(v)?Array.prototype:Object.prototype),'Plain JSON records/lists required');
 need(!Object.getOwnPropertySymbols(v).length,'Symbol keys are not JSON');
 const keys=Object.keys(v);
 if(Array.isArray(v))need(keys.length===v.length&&keys.every((k,i)=>k===String(i)),'Dense lists required');
 for(const k of keys){need(!['__proto__','constructor','prototype'].includes(k),'Reserved key');const d=Object.getOwnPropertyDescriptor(v,k);need(own(d,'value'),'Accessors are not JSON');json(d.value,depth+1,seen);}
 seen.delete(v);
}
function envelope(v){json(v);need(new TextEncoder().encode(JSON.stringify(v)).length<=LIMITS.bytes,'Envelope byte limit');}
function check(f){try{f();return {ok:true,diagnostics:[]};}catch(e){return {ok:false,diagnostics:[{code:'DDN-A010',message:e.message}]};}}
function request(r){
 envelope(r);fields(r,['format','profile','requestId','snapshot','budget','model','operation']);
 need(r.format==='ddna-em5-request@1','Unknown request format');need(Object.values(PROFILES).includes(r.profile),'Unknown EM-5 profile');need(id(r.requestId),'Invalid request ID');
 fields(r.snapshot,['revision','digest']);need(text(r.snapshot.revision)&&/^sha256:[0-9a-f]{64}$/.test(r.snapshot.digest),'Snapshot revision and SHA-256 digest required');
 fields(r.budget,['steps','results','deadlineMs']);for(const k of ['steps','results','deadlineMs'])need(integer(r.budget[k],LIMITS[k]),'Invalid '+k+' budget');
 if(r.profile===PROFILES.graph){
  fields(r.model,['nodes','edges']);list(r.model.nodes,LIMITS.nodes,'Nodes');list(r.model.edges,LIMITS.edges,'Edges');
  for(const n of r.model.nodes)need(qualified(n),'Qualified node identity required');unique(r.model.nodes,'node');const nodes=new Set(r.model.nodes);
  for(const e of r.model.edges){fields(e,['id','from','to','kind']);need(qualified(e.id)&&nodes.has(e.from)&&nodes.has(e.to)&&id(e.kind),'Invalid edge identity/endpoints/kind');}unique(r.model.edges.map(e=>e.id),'edge');
  fields(r.operation,['kind','seeds','direction','edgeKinds','includeSeeds']);need(r.operation.kind==='reachability','Unsupported graph operation');need(['outgoing','incoming','both'].includes(r.operation.direction),'Invalid direction');need(typeof r.operation.includeSeeds==='boolean','includeSeeds must be boolean');
  list(r.operation.seeds,LIMITS.nodes,'Seeds');need(r.operation.seeds.length>0&&r.operation.seeds.every(n=>nodes.has(n)),'Seeds must name existing nodes');unique(r.operation.seeds,'seed');
  list(r.operation.edgeKinds,LIMITS.edges,'Edge kinds');need(r.operation.edgeKinds.length>0&&r.operation.edgeKinds.every(id),'Explicit edgeKinds required');unique(r.operation.edgeKinds,'edge kind');
 }else{
  fields(r.model,['variables','constraints','bindings']);list(r.model.variables,LIMITS.variables,'Variables');list(r.model.constraints,LIMITS.constraints,'Constraints');list(r.model.bindings,LIMITS.edges,'Bindings');need(r.model.variables.length>0&&r.model.constraints.length>0,'Variables and constraints must be nonempty');
  for(const v of r.model.variables){fields(v,['id','type','unit'],['value']);need(qualified(v.id)&&['real','integer','boolean'].includes(v.type),'Invalid variable identity/type');need(v.unit===null||text(v.unit),'Unit must be an identity or null');need(v.type!=='boolean'||v.unit===null,'Booleans cannot carry units');if(own(v,'value'))need(valueFits(v.value,v.type),'Variable value does not match type');}
  unique(r.model.variables.map(v=>v.id),'variable');const vars=new Map(r.model.variables.map(v=>[v.id,v]));
  for(const c of r.model.constraints){fields(c,['id','language','body','variables']);need(qualified(c.id)&&id(c.language)&&typeof c.body==='string'&&c.body.length>0&&new TextEncoder().encode(c.body).length<=4096,'Invalid constraint');list(c.variables,LIMITS.variables,'Constraint variables');need(c.variables.every(v=>vars.has(v)),'Unknown constraint variable');unique(c.variables,'constraint variable');}unique(r.model.constraints.map(c=>c.id),'constraint');
  for(const b of r.model.bindings){fields(b,['left','right']);const a=vars.get(b.left),z=vars.get(b.right);need(a&&z&&a.type===z.type&&a.unit===z.unit,'Bindings require existing variables with identical type and unit identity');}
  fields(r.operation,['kind','numeric','tolerance']);need(r.operation.kind==='solve'&&r.operation.numeric==='binary64','Unsupported solver/numeric operation');need(typeof r.operation.tolerance==='number'&&Number.isFinite(r.operation.tolerance)&&r.operation.tolerance>=0,'Finite nonnegative absolute tolerance required');
 }
}
function valueFits(value,type){return type==='boolean'?typeof value==='boolean':typeof value==='number'&&Number.isFinite(value)&&(type!=='integer'||Number.isSafeInteger(value));}
export function validateRequest(value){return check(()=>request(value));}
export function negotiate(value,capability){return check(()=>{
 request(value);envelope(capability);fields(capability,['engine','profiles','languages','numeric','units','cancellation']);need(stamp(capability.engine),'Versioned engine required');
 for(const k of ['profiles','languages','numeric','units']){list(capability[k],512,k);need(capability[k].every(text),'Capability IDs must be text');unique(capability[k],k);}
 need(capability.cancellation==='worker-termination','Host must support worker termination');need(capability.profiles.includes(value.profile),'Profile unavailable');
 if(value.profile===PROFILES.constraints){need(capability.numeric.includes(value.operation.numeric),'Numeric regime unavailable');for(const c of value.model.constraints)need(capability.languages.includes(c.language),'Constraint language unavailable: '+c.language);for(const v of value.model.variables)if(v.unit!==null)need(capability.units.includes(v.unit),'Unit identity unavailable: '+v.unit);}
});}
export function validateResponse(req,res){return check(()=>{
 request(req);envelope(res);fields(res,['format','profile','requestId','snapshot','engine','status','complete','used','result'],['reason','evidence']);
 need(res.format==='ddna-em5-response@1'&&res.profile===req.profile&&res.requestId===req.requestId,'Response/request mismatch');need(record(res.snapshot)&&res.snapshot.revision===req.snapshot.revision&&res.snapshot.digest===req.snapshot.digest&&Object.keys(res.snapshot).length===2,'Stale or mismatched snapshot');need(stamp(res.engine),'Versioned engine required');
 fields(res.used,['steps']);need(Number.isSafeInteger(res.used.steps)&&res.used.steps>=0&&res.used.steps<=req.budget.steps,'Invalid used step count');
 const graph=req.profile===PROFILES.graph,success=graph?['completed']:['satisfied','unsatisfied'];need([...success,'unknown','cancelled','failed'].includes(res.status),'Invalid operation outcome');need(res.complete===success.includes(res.status),'Complete flag contradicts outcome');
 if(!res.complete){need(res.result===null&&text(res.reason),'Incomplete outcome needs reason and no authoritative result');need(!own(res,'evidence'),'Incomplete outcome cannot carry conclusive evidence');return;}
 if(graph){fields(res.result,['nodes']);list(res.result.nodes,Math.min(req.budget.results,LIMITS.nodes),'Result nodes');need(res.result.nodes.every(n=>req.model.nodes.includes(n)),'Unknown result node');unique(res.result.nodes,'result node');need(res.result.nodes.every((n,i,a)=>i===0||a[i-1]<n),'Result nodes must be ASCII sorted');need(!own(res,'evidence'),'Graph results use recomputation, not solver evidence');}
 else{
  fields(res.evidence,['kind','reference']);need(text(res.evidence.reference),'Evidence reference required');
  if(res.status==='unsatisfied'){need(res.result===null&&res.evidence.kind==='certificate','Unsatisfied needs a certificate reference and no assignment');return;}
  need(res.evidence.kind==='checked-assignment','Satisfied needs checked-assignment evidence');fields(res.result,['assignments']);list(res.result.assignments,Math.min(req.budget.results,LIMITS.variables),'Assignments');need(res.result.assignments.length===req.model.variables.length,'Complete assignment required');unique(res.result.assignments.map(a=>a.variable),'assignment');
  const values=new Map();for(const a of res.result.assignments){fields(a,['variable','value']);const v=req.model.variables.find(v=>v.id===a.variable);need(v&&valueFits(a.value,v.type),'Invalid assignment');need(!own(v,'value')||v.value===a.value,'Initial value cannot change');values.set(a.variable,a.value);}
  for(const b of req.model.bindings)need(values.get(b.left)===values.get(b.right),'Binding equality violated');
 }
});}
