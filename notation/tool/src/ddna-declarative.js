/* SPDX-License-Identifier: GPL-2.0-or-later. Bounded DDNA-defined DAG evaluation.
 * Expression semantics belong to KEEL L0; this is not a FEEL implementation. */
(function(host){
'use strict';
const K=typeof module==='object'&&module.exports?require('./ddna-keel.js'):host.DDNToolKeel;
const PROFILE='ddna.em2.dag-l0@1',ID='ddna-em2-dag-l0',VERSION='1.0.0';
const TABLE_PROFILE='ddna.em2.tables-l0@1',TABLE_ID='ddna-em2-tables-l0';
const supports=name=>name===PROFILE||name===TABLE_PROFILE;
const engineId=name=>name===TABLE_PROFILE?TABLE_ID:ID;
const LIMITS=Object.freeze({nodes:128,inputs:128,rows:128,totalRows:512,expressionBytes:4096,astNodes:512,depth:32,valueBytes:65536,traceBytes:2097152});
const fail=(code,message)=>{const e=new Error(message);e.code=code;throw e;};
const bytes=s=>new TextEncoder().encode(s).length;
const variable=s=>typeof s==='string'&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)&&!['__proto__','prototype','constructor','true','false','null','if','then','else','and','or','not'].includes(s);
function copy(value,depth=0,seen=new Set()){
 if(depth>LIMITS.depth)fail('DDN-A004','Declarative value nesting exceeds '+LIMITS.depth);
 if(value===null||typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number'&&Number.isFinite(value))return Object.is(value,-0)?0:value;
 if(!value||typeof value!=='object'||seen.has(value))fail('DDN-A009','Declarative values must be finite, acyclic JSON data');
 if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==null&&Object.getPrototypeOf(Object.getPrototypeOf(value))!==null)fail('DDN-A009','Declarative values must be plain records or lists');
 if(Object.getOwnPropertySymbols(value).length)fail('DDN-A009','Symbol keys are not declarative data');
 seen.add(value);const out=Array.isArray(value)?[]:Object.create(null);
 if(Array.isArray(value)&&Object.keys(value).some(k=>! /^(0|[1-9][0-9]*)$/.test(k)||Number(k)>=value.length))fail('DDN-A009','Lists may contain only indexed values');
 for(const key of Object.keys(value)){
  if(['__proto__','constructor','prototype'].includes(key))fail('DDN-A009','Reserved data key '+key);
  const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value'))fail('DDN-A009','Accessors are not declarative data');
  out[key]=copy(d.value,depth+1,seen);
 }
 if(Array.isArray(value)&&(out.length!==value.length||Object.keys(value).length!==value.length))fail('DDN-A009','Sparse lists are not declarative data');
 seen.delete(value);return out;
}
function bounded(value){const out=copy(value);if(bytes(JSON.stringify(out))>LIMITS.valueBytes)fail('DDN-A004','Declarative value exceeds '+LIMITS.valueBytes+' bytes');return out;}
function compile(features,data,inputs){
 const p=features.profile;
 const profileName=p&&(p.name||p.id);
 if(!supports(profileName))fail('DDN-A006','Unsupported declarative profile; expected '+PROFILE);
 if(!['verified','faithful'].includes(p.replay))fail('DDN-A009','Declarative profile replay must be verified or faithful');
 if(!Array.isArray(p.inputs)||p.inputs.length>LIMITS.inputs||p.inputs.some(x=>!variable(x))||new Set(p.inputs).size!==p.inputs.length)fail('DDN-A009','profile.inputs must be unique variable names (at most 128)');
 if(!Array.isArray(p.nodes)||!p.nodes.length||p.nodes.length>LIMITS.nodes)fail('DDN-A004','Declarative profile needs 1 to 128 nodes');
 if(!inputs||typeof inputs!=='object'||Array.isArray(inputs))fail('DDN-A009','Execution inputs must be a JSON record');
 const initial=bounded(inputs);
 if(p.inputs.some(k=>!Object.hasOwn(initial,k))||Object.keys(initial).some(k=>!p.inputs.includes(k)))fail('DDN-A009','Execution inputs must match profile.inputs exactly');
 const expressions=new Map();
 for(const k of features.keel||[]){if(expressions.has(k.id))fail('DDN-A009','Duplicate expression id '+k.id);expressions.set(k.id,k);}
 const expressionFor=(ref,deps,nodeId)=>{
  const expression=expressions.get(ref);
  if(!expression)fail('DDN-A009','Missing expression '+ref+' for '+nodeId);
  if(expression.language!=='keel-l0@1')fail('DDN-A005','Profile '+profileName+' requires keel-l0@1; found '+expression.language);
  if(typeof expression.body!=='string')fail('DDN-A009','Expression body must be text');
  if(bytes(expression.body)>LIMITS.expressionBytes)fail('DDN-A004','Expression exceeds 4096 bytes');
  const parsed=K.Wf4(expression.body);if(!parsed.ok)fail('DDN-A009',parsed.error);
  const stack=[[parsed.value,0]];let count=0;
  while(stack.length){const [n,d]=stack.pop();if(++count>LIMITS.astNodes||d>LIMITS.depth)fail('DDN-A004','Expression exceeds the AST budget');for(const k of ['l','r','c','a','b','i'])if(n[k])stack.push([n[k],d+1]);for(const v of n.items||[])stack.push([v,d+1]);for(const [,v]of n.entries||[])stack.push([v,d+1]);}
  for(const name of Object.keys(K.Vars(parsed.value)))if(!p.inputs.includes(name)&&!deps.includes(name))fail('DDN-A009','Undeclared dependency '+name+' in '+nodeId);
  return {expression,ast:parsed.value};
 };
 let totalRows=0;
 const nodes=new Map();
 for(const raw of p.nodes){
  if(!raw||!variable(raw.id)||nodes.has(raw.id)||p.inputs.includes(raw.id))fail('DDN-A009','Node ids must be unique variables distinct from input names');
  if(Object.keys(raw).some(k=>!['id','target','expr','depends_on',...(profileName===TABLE_PROFILE?['table']:[])].includes(k)))fail('DDN-A009','Unknown declarative node property on '+raw.id);
  const deps=raw.depends_on===undefined?[]:raw.depends_on;
  if(!Array.isArray(deps)||deps.some(x=>!variable(x))||new Set(deps).size!==deps.length)fail('DDN-A009','Invalid dependencies for '+raw.id);
  let compiled;
  if(raw.table!==undefined){
   if(profileName!==TABLE_PROFILE||raw.expr!==undefined)fail('DDN-A009','Table nodes require tables-l0 and exactly one of expr or table');
   const t=raw.table;
   if(!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).some(k=>!['hit_policy','rows'].includes(k))||!['unique','first','collect'].includes(t.hit_policy))fail('DDN-A009','Table needs hit_policy unique, first or collect');
   if(!Array.isArray(t.rows)||!t.rows.length||t.rows.length>LIMITS.rows||(totalRows+=t.rows.length)>LIMITS.totalRows)fail('DDN-A004','Table row budget exceeded (128 per table, 512 per graph)');
   const ids=new Set();
   compiled={table:{policy:t.hit_policy,rows:t.rows.map(r=>{
    if(!r||!variable(r.id)||ids.has(r.id)||Object.keys(r).some(k=>!['id','when','then'].includes(k)))fail('DDN-A009','Table rows need unique IDs and only id, when, then');
    ids.add(r.id);return {id:r.id,when:expressionFor(r.when,deps,raw.id),then:expressionFor(r.then,deps,raw.id)};
   })}};
  }else compiled=expressionFor(raw.expr,deps,raw.id);
  if(typeof raw.target!=='string'||!raw.target)fail('DDN-A009','Node '+raw.id+' needs a base element target');
  const matches=(data.objects||[]).filter(o=>o.ddnaKey===raw.target||o.ddnaKey?.split('::').at(-1)===raw.target);
  if(matches.length!==1)fail('DDN-A009','Unknown or ambiguous base target '+raw.target);
  nodes.set(raw.id,{id:raw.id,deps,...compiled,target:matches[0].ddnaKey});
 }
 for(const n of nodes.values())for(const d of n.deps)if(!nodes.has(d))fail('DDN-A009','Unknown dependency '+d+' in '+n.id);
 const order=[],done=new Set();
 while(order.length<nodes.size){const ready=[...nodes.values()].filter(n=>!done.has(n.id)&&n.deps.every(d=>done.has(d))).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);if(!ready.length)fail('DDN-A009','Declarative dependency cycle');for(const n of ready){order.push(n);done.add(n.id);}}
 return{initial,order};
}
/* All predicates are evaluated and must be booleans. Only selected outputs
 * evaluate, but the complete table declaration is recorded for verification. */
function evaluateTable(table,env){
 const describe=c=>({exprId:c.expression.id,language:c.expression.language,body:c.expression.body});
 const rows=table.rows.map(r=>{const match=K.Eval(r.when.ast,env);if(typeof match!=='boolean')fail('DDN-A009','Predicate for row '+r.id+' must return a boolean');return {id:r.id,when:describe(r.when),then:describe(r.then),match};});
 const matched=rows.filter(r=>r.match).map(r=>r.id);
 if(table.policy==='unique'&&matched.length>1)fail('DDN-A009','Unique table has overlapping matches: '+matched.join(', '));
 const selected=table.policy==='collect'?matched:matched.slice(0,1),values=[];
 for(const id of selected){const r=table.rows.find(r=>r.id===id),value=K.Eval(r.then.ast,env);if(value===undefined)fail('DDN-A009','Output for row '+id+' produced no value');const result=bounded(value);values.push(result);rows.find(r=>r.id===id).result=bounded(result);}
 return {result:table.policy==='collect'?values:values.length?values[0]:null,record:{hit_policy:table.policy,rows,matched,selected}};
}
function run(ctx){
 const {initial,order}=compile(ctx.features,ctx.data,ctx.inputs===undefined?{}:ctx.inputs),outputs=Object.create(null);
 let used=bytes(JSON.stringify(initial));
 for(const n of order){
  if(!ctx.budget.tick([n.target,'evaluation-1']))break;
  const env=Object.assign(Object.create(null),initial);for(const d of n.deps)env[d]=outputs[d];
  const snapshot=bounded(env),evaluation=n.table?evaluateTable(n.table,snapshot):null,value=evaluation?evaluation.result:K.Eval(n.ast,snapshot);
  if(value===undefined)fail('DDN-A009','Evaluation produced no value at '+n.id);
  const result=bounded(value),clock=ctx.tracer.events.length+1;
  const event={clock,stepKind:'decision-evaluation',instance:[n.target,'evaluation-1'],
   state:{at:n.target,decision:n.id,outputs:{[n.id]:bounded(result)},values:{[n.target]:JSON.stringify(result)}},
   keel:evaluation?{table:evaluation.record,inputs:snapshot,result:bounded(result),clock,engine:K.id,engineVersion:K.version}:{exprId:n.expression.id,language:n.expression.language,body:n.expression.body,inputs:snapshot,result:bounded(result),clock,engine:K.id,engineVersion:K.version}};
  const size=bytes(JSON.stringify({seq:clock,scope:'main',...event}));if(used+size>LIMITS.traceBytes){ctx.budget.exceeded='DDNA_DECLARATIVE_TRACE_BYTES_MAX';break;}
  used+=size;ctx.tracer.emit(event);outputs[n.id]=result;
 }
 return{outputs:copy(outputs),execution:{engine:engineId(ctx.features.profile.name||ctx.features.profile.id),engineVersion:VERSION,inputs:initial},timeModel:{kind:'data',id:'T5',clock:'evaluation-index'}};
}
const api={PROFILE,TABLE_PROFILE,ID,TABLE_ID,supports,engineId,VERSION,LIMITS,compile,run};
if(typeof module==='object'&&module.exports)module.exports=api;
host.DDNToolDeclarative=api;
})(typeof globalThis!=='undefined'?globalThis:this);
