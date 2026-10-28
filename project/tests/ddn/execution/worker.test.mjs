import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Worker as Thread} from 'node:worker_threads';
const build=process.env.DDN_BUILD_ROOT||path.resolve('.work/builds/worker-check');
const load=part=>import(pathToFileURL(path.join(build,'ddn/packages/execution/src/'+part+'.js')));
const {createComputeExecutor,decodePayload}=await load('compute');
const {createWorkerExecutor}=await load('worker-host');
const {fingerprint}=await load('index');
const versions={api:'1.0',language:'ddn-next-1',defaults:'ddn-next-1',packs:{}};
const options={versions,packs:[]};
let job=0;
const request=(kind,payload)=>({protocol:1,sessionId:'test',jobId:'job-'+(++job),kind,revision:{model:'1',sources:{'main.ddn':'1'},data:{}},versions,dependencyFingerprint:fingerprint(payload),fontGeneration:'0',styleGeneration:'0',payload});
const sources={entry:'main.ddn',files:[{id:'main.ddn',text:'erd Sales\n    Customer\n',revision:'1',encoding:'utf-8',writable:true,originalBytes:new Uint8Array([1,2,3])}]};
class BrowserWorker {
 constructor(){this.worker=new Thread(new URL('./worker-fixture.mjs',import.meta.url),{workerData:{build,options}});this.listeners=new Map();}
 postMessage(data){this.worker.postMessage(data);}
 addEventListener(type,fn){const listener=type==='message'?data=>fn({data}):error=>fn(error);this.listeners.set(fn,listener);this.worker.on(type,listener);}
 removeEventListener(type,fn){const listener=this.listeners.get(fn);if(listener)this.worker.off(type,listener);this.listeners.delete(fn);}
 terminate(){void this.worker.terminate();}
}
function cancelToken(){let aborted=false;const listeners=new Set();return {token:{get aborted(){return aborted;},onAbort(fn){listeners.add(fn);return()=>listeners.delete(fn);}},abort(){aborted=true;for(const fn of listeners)fn();}};}

test('real worker and cooperative decode return identical normalized data, fingerprints and diagnostics',async()=>{
 const inline=createComputeExecutor(options),worker=createWorkerExecutor({createWorker:()=>new BrowserWorker(),fallback:createComputeExecutor(options)});
 try{const payload=decodePayload(sources);assert.equal(payload.sources.files[0].originalBytes,undefined);assert.equal(sources.files[0].originalBytes.length,3);
  const job=request('decode',payload);const [a,b]=await Promise.all([inline.run(job),worker.run(job)]);assert.equal(a.outcome,'valid');assert.deepEqual(a,b);
 }finally{inline.destroy();worker.destroy();}
});
test('worker runs actual structural verifier and rejects a falsified semantic fingerprint',async()=>{
 const executor=createWorkerExecutor({createWorker:()=>new BrowserWorker(),fallback:createComputeExecutor(options)});
 try{const decoded=await executor.run(request('decode',decodePayload(sources)));const value=decoded.payload;
  const snapshot={contract:'ddn-next-1',rootFile:'main.ddn',normalized:value.decoded.normalized,semanticFingerprint:'false',coverage:value.decoded.coverage,versions,revision:{model:'1',sources:{'main.ddn':'1'},data:{}}};
  const result=await executor.run(request('verify',{snapshot,options:{scope:{kind:'workarea'},purpose:'design',level:'structural'}}));assert.equal(result.outcome,'invalid');assert.ok(result.diagnostics.some(d=>d.code==='DDN-SNAPSHOT-FINGERPRINT'));
 }finally{executor.destroy();}
});
test('worker denial falls back to the same compute implementation without fetching code',async()=>{
 let constructions=0;const fallback=createComputeExecutor(options),executor=createWorkerExecutor({createWorker(){constructions++;throw Error('CSP denies workers');},fallback});
 try{for(let i=0;i<2;i++){const result=await executor.run(request('decode',decodePayload(sources)));assert.equal(result.outcome,'valid');}assert.equal(constructions,1);}finally{executor.destroy();}
});
test('cancellation resolves pending work, terminates idle worker, and ignores late replies',async()=>{
 const messages=[],listeners=new Map();let terminated=0;
 const fake={postMessage(message){messages.push(message);},addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);},terminate(){terminated++;}};
 const executor=createWorkerExecutor({createWorker:()=>fake,fallback:createComputeExecutor(options)}),cancel=cancelToken();
 const pending=executor.run(request('decode',decodePayload(sources)),{cancel:cancel.token});cancel.abort();const result=await pending;assert.equal(result.outcome,'cancelled');assert.ok(messages.some(m=>m.type==='cancel'));assert.equal(terminated,1);assert.equal(listeners.size,0);executor.destroy();
});
test('full echoed metadata fences stale results and disposal settles pending requests',async()=>{
 let listener,posted;const fake={postMessage(message){posted=message;},addEventListener(type,fn){if(type==='message')listener=fn;},removeEventListener(){},terminate(){}};
 const executor=createWorkerExecutor({createWorker:()=>fake,fallback:createComputeExecutor(options)}),job=request('decode',decodePayload(sources));
 const pending=executor.run(job);let done=false;void pending.then(()=>done=true);const {payload:_,...echo}=job;
 listener({data:{channel:'ddn.compute.v1',type:'result',id:posted.id,result:{request:{...echo,fontGeneration:'stale'},outcome:'valid',coverage:{scope:{kind:'workarea'},complete:true,checked:[],unavailable:[]},diagnostics:[],payload:null}}});
 await Promise.resolve();assert.equal(done,false);executor.destroy();assert.equal((await pending).outcome,'cancelled');
});
test('worker elapsed deadline is bounded and decode work/memory budgets are enforced in fallback',async()=>{
 const fake={postMessage(){},addEventListener(){},removeEventListener(){},terminate(){}};
 const executor=createWorkerExecutor({createWorker:()=>fake,fallback:createComputeExecutor(options)});
 const result=await executor.run(request('decode',decodePayload(sources)),{budget:{elapsedMs:5,workUnits:10000,memoryBytes:1000000}});assert.equal(result.outcome,'budget-exceeded');executor.destroy();
 const inline=createComputeExecutor(options);try{const budget=await inline.run(request('decode',decodePayload(sources)),{budget:{elapsedMs:10000,workUnits:0,memoryBytes:1000000}});assert.equal(budget.outcome,'budget-exceeded');}finally{inline.destroy();}
});
test('browser verifier preserves headless source reports for valid and malformed sources',async()=>{
 const {createBrowserVerifier}=await load('browser-verifier');const {createVerifier}=await import(pathToFileURL(path.join(build,'ddn/packages/verifier/src/index.js')));
 const worker=createWorkerExecutor({createWorker:()=>new BrowserWorker(),fallback:createComputeExecutor(options)}),browser=createBrowserVerifier({...options,executor:worker}),headless=createVerifier(options);
 const stable=({requestId,stats,...report})=>({...report,diagnostics:report.diagnostics.map(({source,related,...diagnostic})=>diagnostic)});
 try{for(const text of ['erd Sales\n    Customer\n','erd "broken\n','element Box as object\n    with\n        unknown 1\n']){
   const input={...sources,files:[{...sources.files[0],text,originalBytes:new TextEncoder().encode(text)}]};const opts={scope:{kind:'workarea'},purpose:'design',level:'structural'};
   const [a,b]=await Promise.all([headless.verifySources(input,opts),browser.verifySources(input,opts)]);assert.deepEqual(stable(b),stable(a));
  }}finally{browser.destroy();headless.destroy();}
});

test('worker verifier canonicalizes source aliases and returns detached immutable reports',{timeout:10000},async()=>{
 const {createBrowserVerifier}=await load('browser-verifier');
 const executor=createWorkerExecutor({createWorker:()=>new BrowserWorker(),fallback:createComputeExecutor(options)}),verifier=createBrowserVerifier({...options,executor});
 try{
  const input={entry:'./main.ddn',files:[{id:'./main.ddn',text:'workarea Main\n',revision:'r1',encoding:'utf-8',writable:true}]};
  const report=await verifier.verifySources(input,{scope:{kind:'workarea'},purpose:'design',level:'review'});
  assert.equal(report.outcome,'valid',JSON.stringify(report.diagnostics));assert.deepEqual(report.revision.sources,{'main.ddn':'r1'});assert.equal(input.entry,'./main.ddn');
  assert.equal(Object.isFrozen(report),true);assert.equal(Object.isFrozen(report.coverage.checked),true);assert.throws(()=>report.coverage.complete=false,TypeError);
 }finally{verifier.destroy();}
});
test('verifier facade owns source options and factory versions across delayed decoding',{timeout:10000},async()=>{
 const {createBrowserVerifier}=await load('browser-verifier');const config=structuredClone(options),compute=createComputeExecutor(config);
 let release,notify;const gate=new Promise(r=>release=r),ready=new Promise(r=>notify=r);
 const verifier=createBrowserVerifier({...config,executor:{async run(job,task){if(job.kind==='decode'){notify();await gate;}return compute.run(job,task);},destroy(){compute.destroy();}}});
 const input={entry:'main.ddn',files:[{id:'main.ddn',text:'workarea Main\n',revision:'r1',encoding:'utf-8',writable:true}]},settings={scope:{kind:'workarea'},purpose:'design',level:'review'};
 try{
  const pending=verifier.verifySources(input,settings);await ready;input.entry='late.ddn';input.files[0].text='late source';settings.purpose='late-purpose';settings.scope={kind:'item',target:{file:'late.ddn',id:'late'}};release();
  const report=await pending;assert.equal(report.outcome,'valid',JSON.stringify(report.diagnostics));assert.equal(report.purpose,'design');assert.deepEqual(report.scope,{kind:'workarea'});
 }finally{release();verifier.destroy();}
 const versionsInput=structuredClone(options),captured=createBrowserVerifier(versionsInput);versionsInput.versions.defaults='late';
 try{const report=await captured.verifySources({entry:'main.ddn',files:[{id:'main.ddn',text:'workarea Main\n',revision:'r1',encoding:'utf-8',writable:true}]},{scope:{kind:'workarea'},purpose:'design',level:'review'});assert.equal(report.outcome,'valid');assert.equal(report.versions.defaults,'ddn-next-1');}finally{captured.destroy();}
});
test('interrupted model verification reports the submitted snapshot and scope after caller mutation',{timeout:10000},async()=>{
 const {createBrowserVerifier}=await load('browser-verifier');let release,notify;const gate=new Promise(r=>release=r),ready=new Promise(r=>notify=r);
 const verifier=createBrowserVerifier({...options,executor:{async run(job){notify();await gate;const {payload,...echo}=job;return {request:echo,outcome:'cancelled',payload:null,diagnostics:[],coverage:{scope:{kind:'workarea'},complete:false,checked:[],unavailable:[]}};},destroy(){}}});
 const snapshot={contract:'ddn-next-1',rootFile:'main.ddn',revision:{model:'one',sources:{'main.ddn':'r1'},data:{}},versions:structuredClone(versions),semanticFingerprint:'submitted',normalized:{},coverage:{scope:{kind:'workarea'},complete:true,checked:[],unavailable:[]}},settings={scope:{kind:'workarea'},purpose:'design',level:'review'};
 try{const pending=verifier.verifyModel(snapshot,settings);await ready;snapshot.revision.model='late';snapshot.semanticFingerprint='late';settings.purpose='late';release();const report=await pending;assert.equal(report.outcome,'cancelled');assert.equal(report.revision.model,'one');assert.equal(report.dependencyFingerprint,'submitted');assert.equal(report.purpose,'design');assert.equal(Object.isFrozen(report.revision),true);}finally{release();verifier.destroy();}
});
