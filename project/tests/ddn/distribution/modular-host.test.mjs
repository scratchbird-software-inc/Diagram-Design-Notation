import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { Worker } from 'node:worker_threads';

const packages=resolve(process.env.DDN_BUILD_ROOT??'.work/builds/ddn','ddn/packages');
function fresh(body){return new Promise((done,fail)=>{
 const setup=`const {parentPort}=require('node:worker_threads');const assert=require('node:assert/strict');const {resolve}=require('node:path');const {pathToFileURL}=require('node:url');const root=${JSON.stringify(packages)};const load=name=>import(pathToFileURL(resolve(root,name)).href);`;
 const helpers=`
 const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const source=(text,id='main.ddn',revision='1')=>({id,text,revision,encoding:'utf-8',writable:true});
 const sources=text=>({entry:'main.ddn',files:[source(text)]});
 const nativeSource=sources('erd Latest\\n    Customer\\n');
 const chartSource=sources('view Earlier as chart.basic@1\\n');
 const graphSource=sources('view Graph as uml.structure@2\\n    element Thing as uml.class\\n');
 const settings={scope:{kind:'workarea'},level:'semantic',purpose:'inspect'};
 const calls=[];let intercept=async()=>{};
 globalThis.DDN_LOADER={async loadEntry(alias){calls.push(alias);await intercept(alias);const [kind,family]=alias.split(':');if(kind==='verify')await load('profiles/src/families/'+family+'.js');else if(kind==='render')await load('presentation/src/family-'+family+'.js');},worker(){throw Error('Worker unavailable in this host test');}};
 const host=await load('standalone/src/modular-host.js');
 const cancel=()=>{const handlers=new Set();let aborted=false;return{token:{get aborted(){return aborted;},onAbort(fn){handlers.add(fn);return()=>handlers.delete(fn);}},abort(){aborted=true;for(const fn of handlers)fn();}};};
 `;
 const worker=new Worker(setup+'(async()=>{'+helpers+body+'})().then(()=>parentPort.postMessage({ok:true}),error=>parentPort.postMessage({error:error.stack}));',{eval:true});let received=false;
 worker.once('error',fail);worker.once('message',message=>{received=true;worker.terminate();message.ok?done():fail(Error(message.error));});worker.once('exit',code=>{if(!received)fail(Error('Host test exited without result: '+code));});
});}

test('headless modular verifier leaf excludes runtime state, editing and rendering implementations',()=>{
 const seen=new Set();
 function visit(file){if(seen.has(file))return;seen.add(file);for(const match of readFileSync(file,'utf8').matchAll(/(?:from\s*|import\s*\(?\s*)['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))visit(resolve(dirname(file),match[1]));}
 visit(resolve(packages,'standalone/src/modular-verifier.js'));
 const paths=[...seen].map(file=>file.slice(packages.length+1));
 for(const forbidden of ['runtime/src/runtime.js','runtime/src/guards.js','runtime/src/providers.js','runtime/src/commands.js'])assert.ok(!paths.includes(forbidden),forbidden+' must not enter headless verification');
 assert.ok(!paths.some(file=>/^(presentation|viewer|designer)\//.test(file)));
});

test('a slow earlier profile load cannot replace a newer opened document',()=>fresh(`
 const gate=deferred(),entered=deferred();intercept=async alias=>{if(alias==='verify:charts'){entered.resolve();await gate.promise;}};
 const runtime=host.createModularRuntime(host.createModularRuntimeOptions(),false);
 const earlier=runtime.open(chartSource);await entered.promise;
 const latest=await runtime.open(nativeSource);assert.ok(latest.snapshot);
 gate.resolve();const stale=await earlier;
 assert.ok(stale.diagnostics.some(d=>d.code==='runtime.stale'));
 assert.equal(runtime.sources().files[0].text,nativeSource.files[0].text);
 assert.deepEqual(runtime.registry.describe().map(p=>p.id),['ddn-native']);runtime.destroy();
`));

test('partial source ingestion discovers profiles with the complete merged include tree',()=>fresh(`
 const runtime=host.createModularRuntime(host.createModularRuntimeOptions(),false);
 const initial={entry:'main.ddn',files:[source('include "views.ddn"\\nerd Main\\n    Customer\\n'),source('view Auxiliary as ddn@1\\n','views.ddn')]};
 const opened=await runtime.open(initial);assert.ok(opened.snapshot,JSON.stringify(opened.diagnostics));
 const updated=await runtime.ingest({base:opened.revision,origin:'local-provider',sources:[source('view Auxiliary as chart.basic@1\\n','./views.ddn','2')]});
 assert.ok(updated.snapshot,JSON.stringify(updated.diagnostics));
 assert.ok(calls.includes('verify:charts'));
 assert.equal(runtime.sources().files.length,2);
 assert.ok(runtime.registry.describe().some(p=>p.id==='ddn-charts'));runtime.destroy();
`));

test('a newer preload immediately supersedes older work already inside the core runtime',()=>fresh(`
 const options=host.createModularRuntimeOptions(),{createComputeExecutor}=await load('execution/src/compute.js');
 const local=createComputeExecutor(options),decoding=deferred(),decodeGate=deferred(),loading=deferred(),loadGate=deferred();let first=true;
 const executor={async run(request,task){if(first){first=false;decoding.resolve();await decodeGate.promise;}return local.run(request,task);},destroy(){local.destroy();}};
 const runtime=host.createModularRuntime({...options,executor},false);
 const earlier=runtime.open(nativeSource);await decoding.promise;
 intercept=async alias=>{if(alias==='verify:charts'){loading.resolve();await loadGate.promise;}};
 const latest=runtime.open(chartSource);await loading.promise;decodeGate.resolve();
 const stale=await earlier;assert.ok(stale.diagnostics.some(d=>d.code==='runtime.stale'));assert.equal(runtime.snapshot(),undefined);
 loadGate.resolve();const opened=await latest;assert.ok(opened.snapshot);assert.equal(runtime.sources().files[0].text,chartSource.files[0].text);runtime.destroy();
`));

test('aborted preload returns promptly with ordinary cancelled results and no runtime install',()=>fresh(`
 const gate=deferred(),entered=deferred();intercept=async alias=>{if(alias==='verify:charts'){entered.resolve();await gate.promise;}};
 const runtime=host.createModularRuntime(host.createModularRuntimeOptions(),false),signal=cancel();
 const pending=runtime.open(chartSource,{cancel:signal.token});await entered.promise;signal.abort();
 const result=await Promise.race([pending,delay(300).then(()=>{throw Error('Cancellation waited for the pending script');})]);
 assert.ok(result.diagnostics.some(d=>d.code==='runtime.cancelled'));
 assert.equal(runtime.snapshot(),undefined);assert.deepEqual(runtime.registry.describe().map(p=>p.id),['ddn-native']);
 const verifier=host.createModularVerifier(host.createModularRuntimeOptions());
 const report=await verifier.verifySources(chartSource,{...settings,cancel:signal.token});assert.equal(report.outcome,'cancelled');
 gate.resolve();verifier.destroy();runtime.destroy();
`));

test('destroying a runtime during preload prevents late registry installation',()=>fresh(`
 const gate=deferred(),entered=deferred();intercept=async alias=>{if(alias==='verify:charts'){entered.resolve();await gate.promise;}};
 const runtime=host.createModularRuntime(host.createModularRuntimeOptions(),false);
 const pending=runtime.open(chartSource);await entered.promise;runtime.destroy();gate.resolve();const result=await pending;
 assert.ok(result.diagnostics.some(d=>d.code==='runtime.disposed'));
 assert.equal(runtime.snapshot(),undefined);assert.deepEqual(runtime.registry.describe().map(p=>p.id),['ddn-native']);
`));

test('attaching a viewer upgrades an existing verification runtime to load rendering',()=>fresh(`
 const gate=deferred(),entered=deferred();intercept=async alias=>{if(alias==='verify:graphs'){entered.resolve();await gate.promise;}};
 const runtime=host.createModularRuntime(host.createModularRuntimeOptions(),false);
 const pending=runtime.open(graphSource);await entered.promise;
 assert.strictEqual(host.attachModularRuntime(runtime,true),runtime);gate.resolve();const result=await pending;
 assert.ok(result.snapshot,JSON.stringify(result.diagnostics));assert.ok(calls.includes('render:graphs'));runtime.destroy();
`));

test('missing or incompatible packs preserve the prior model and return explicit failure',()=>fresh(`
 const options=host.createModularRuntimeOptions(),runtime=host.createModularRuntime({...options,versions:{...options.versions,packs:{'ddn-charts':'9.0.0'}}},false);
 const result=await runtime.open(chartSource);
 assert.ok(result.diagnostics.some(d=>/Pack version differs/.test(d.message)));assert.equal(result.coverage.complete,false);
 assert.equal(runtime.snapshot(),undefined);runtime.destroy();
 intercept=async()=>{throw Error('Missing local pack file');};
 const display=host.createModularRuntime(host.createModularRuntimeOptions(),false);const good=await display.open(nativeSource);assert.ok(good.snapshot);
 const failed=await display.open(graphSource);assert.equal(failed.coverage.complete,false);assert.equal(display.snapshot().semanticFingerprint,good.snapshot.semanticFingerprint);display.destroy();
 const verifier=host.createModularVerifier(host.createModularRuntimeOptions());
 const report=await verifier.verifySources(graphSource,settings);
 assert.equal(report.outcome,'unsupported');assert.equal(report.reviewEligible,false);assert.match(report.diagnostics[0].message,/Missing local pack/);verifier.destroy();
`));

test('profile waiting consumes the operation elapsed budget',()=>fresh(`
 // Advance the clock at the loading boundary. Under concurrent test load a
 // real 30ms budget can expire during decoding, before the loader is entered.
 const wallClock=Date.now;let now=wallClock();Date.now=()=>now;
 const gate=deferred(),entered=deferred();intercept=async alias=>{if(alias==='verify:charts'){now+=31;entered.resolve();await gate.promise;}};
 const runtime=host.createModularRuntime(host.createModularRuntimeOptions(),false);
 try {
  const pending=runtime.open(chartSource,{budget:{elapsedMs:30,workUnits:100000,memoryBytes:1000000}});await entered.promise;
  const result=await Promise.race([pending,delay(300).then(()=>{throw Error('Profile loading ignored elapsed budget');})]);
  assert.ok(result.diagnostics.some(d=>d.code==='runtime.budget-exceeded'));assert.equal(runtime.snapshot(),undefined);
 } finally {gate.resolve();runtime.destroy();Date.now=wallClock;}
`));

test('provided executors remain active while newer verifier pack signatures are created',()=>fresh(`
 const options=host.createModularRuntimeOptions(),{createComputeExecutor}=await load('execution/src/compute.js');
 const local=createComputeExecutor(options),gate=deferred(),entered=deferred();let first=true,destroyed=0,runs=0;
 const executor={async run(request,task){runs++;if(first){first=false;entered.resolve();await gate.promise;}return local.run(request,task);},destroy(){destroyed++;local.destroy();}};
 const verifier=host.createModularVerifier({...options,executor});
 const pending=verifier.verifySources(nativeSource,settings);await entered.promise;
 const second=await verifier.verifySources(chartSource,settings);assert.notEqual(second.outcome,'unsupported',JSON.stringify(second.diagnostics));
 assert.equal(destroyed,0,'another family must not destroy an outstanding verification');
 gate.resolve();const firstReport=await pending;assert.equal(firstReport.outcome,'valid',JSON.stringify(firstReport.diagnostics));assert.ok(runs>=2);
 verifier.destroy();assert.equal(destroyed,1);
`));

test('headless verification loads rules without pulling rendering families',()=>fresh(`
 const verifier=host.createModularVerifier(host.createModularRuntimeOptions());
 await verifier.verifySources(graphSource,settings);
 assert.ok(calls.includes('verify:graphs'));assert.ok(!calls.some(alias=>alias.startsWith('render:')));verifier.destroy();
`));

test('an unused supplied executor is disposed after changed packs require local fallback',()=>fresh(`
 const options=host.createModularRuntimeOptions();let destroyed=0;
 const executor={async run(){throw Error('An opaque native executor cannot verify an added graph pack');},destroy(){destroyed++;}};
 const verifier=host.createModularVerifier({...options,executor});
 const result=await verifier.verifySources(graphSource,settings);assert.notEqual(result.outcome,'unsupported',JSON.stringify(result.diagnostics));
 verifier.destroy();verifier.destroy();assert.equal(destroyed,1);
`));
