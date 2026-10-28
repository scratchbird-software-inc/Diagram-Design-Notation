import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const output=process.env.DDN_BUILD_ROOT??resolve('.work/builds/ddn');
const {createRuntime,createNativeRuntimeOptions,createCommandService}=await import(pathToFileURL(resolve(output,'ddn/packages/runtime/src/index.js')));
const {runtimeState}=await import(pathToFileURL(resolve(output,'ddn/packages/runtime/src/runtime.js')));
const {listRecords}=await import(pathToFileURL(resolve(output,'ddn/packages/model/src/index.js')));
const {createComputeExecutor}=await import(pathToFileURL(resolve(output,'ddn/packages/execution/src/compute.js')));
const text='source Feed as host\n    with\n        channel feed\n        update keyed\ndata Rows from Feed\n    with\n        key id\nerd Board\n    Customer from Rows\n';
const source=(value=text)=>({entry:'main.ddn',files:[{id:'main.ddn',text:value,revision:'s1',encoding:'utf-8',writable:true}]});
const rows=runtime=>listRecords(runtime.snapshot().normalized).find(entry=>entry.record.name==='Rows').record;
const named=(runtime,name)=>listRecords(runtime.snapshot().normalized).find(entry=>entry.record.name===name);
const replacement=(next='d1',values=[[1,'One'],[2,'Two']])=>({kind:'replace',source:'feed',next,schema:[{id:'id'},{id:'value'}],rows:values});
async function setup(options=createNativeRuntimeOptions()){
 const runtime=createRuntime(options);const opened=await runtime.open(source());assert.ok(opened.snapshot,JSON.stringify(opened.diagnostics));return runtime;
}
async function update(runtime,data,sources){return runtime.ingest({base:runtime.snapshot().revision,origin:'local-test-provider',data,...(sources?{sources}:{})});}
function passed(result){assert.equal(result.diagnostics.some(d=>d.severity==='error'),false,JSON.stringify(result.diagnostics));}

test('provider replacement uses direct data columns/rows; keyed rows preserve order and validate keys',async()=>{
 const runtime=await setup();passed(await update(runtime,[replacement()]));
 assert.deepEqual(rows(runtime).rows,[[1,'One'],[2,'Two']]);assert.equal(rows(runtime).data,undefined);
 passed(await update(runtime,[{kind:'keyed',source:'feed',base:'d1',next:'d2',operations:[{op:'upsert',key:'2',row:{id:2,value:'Updated'}},{op:'upsert',key:'3',row:[3,'Three']},{op:'delete',key:'1'}]}]));
 assert.deepEqual(rows(runtime).rows,[[2,'Updated'],[3,'Three']]);assert.equal(runtime.snapshot().revision.data.feed,'d2');
 const before=runtime.snapshot();const rejected=await update(runtime,[{kind:'keyed',source:'feed',base:'d2',next:'d3',operations:[{op:'upsert',key:'3',row:[4,'Wrong key']}]}]);
 assert.match(rejected.diagnostics[0].message,/key/i);assert.equal(runtime.snapshot(),before);runtime.destroy();
});
test('mixed source/data changes commit once and invalid data leaves both source and model unchanged',async()=>{
 const runtime=await setup();const original=runtime.sources().files[0];const events=[];runtime.subscribe(event=>{if(event.kind==='revision')events.push(event.revision);});
 passed(await update(runtime,[replacement()],[{...original,revision:'s2',text:original.text.replace('Customer from Rows','Customer from Rows : Updated')} ]));
 assert.equal(events.length,1);assert.equal(named(runtime,'Customer').record.title,'Updated');assert.deepEqual(rows(runtime).rows,[[1,'One'],[2,'Two']]);
 const before=runtime.snapshot(),beforeSource=runtime.sources();const rejected=await update(runtime,[{...replacement('d2'),source:'missing'}],[{...beforeSource.files[0],revision:'s3',text:beforeSource.files[0].text.replace('Updated','Discarded')}]);
 assert.ok(rejected.diagnostics.some(d=>d.severity==='error'));assert.equal(runtime.snapshot(),before);assert.deepEqual(runtime.sources(),beforeSource);assert.equal(events.length,1);runtime.destroy();
});
test('provider overlays survive visual source commands and their undo history',async()=>{
 const runtime=await setup();passed(await update(runtime,[replacement()]));const originalText=runtime.sources().files[0].text;
 const commands=createCommandService(runtime,{authorize:async action=>({allowed:true,principal:'tester',grants:[action]})});
 const prepared=await commands.prepare({kind:'set-property',target:named(runtime,'Customer').ref,path:'title',value:'Current data'});assert.equal(prepared.ok,true,JSON.stringify(prepared));
 const committed=await commands.commit(prepared.command.id);assert.equal(committed.ok,true,JSON.stringify(committed));assert.deepEqual(rows(runtime).rows,[[1,'One'],[2,'Two']]);assert.equal(runtime.snapshot().revision.data.feed,'d1');
 const undone=await commands.undo();assert.equal(undone.ok,true,JSON.stringify(undone));assert.equal(runtime.sources().files[0].text,originalText);assert.deepEqual(rows(runtime).rows,[[1,'One'],[2,'Two']]);runtime.destroy();
});
test('failed prepared-model check is atomic and preserves original source bytes',async()=>{
 const runtime=await setup();const before=runtime.snapshot(),input=runtime.sources();
 const changed={...input,files:input.files.map(file=>({...file,text:file.text.replace('Customer from Rows','Customer from Rows : New'),revision:'s2'}))};
 const result=await runtimeState(runtime).commitSources(changed,{},'incorrect-fingerprint');
 assert.ok(result.diagnostics.some(d=>d.code==='runtime.prepared-mismatch'));assert.equal(runtime.snapshot(),before);assert.deepEqual(runtime.sources(),input);runtime.destroy();
});
test('provider routes cannot change lifecycle metadata or edit reviewed dependencies',async()=>{
 const runtime=await setup();const file=runtime.sources().files[0];
 const forged=await update(runtime,[],[{...file,revision:'s2',text:file.text+'        with\n            design.state accepted\n            acceptance.by Forged\n            acceptance.at "2026-10-23T12:00:00Z"\n'}]);
 assert.ok(forged.diagnostics.some(d=>d.code==='runtime.lifecycle'),JSON.stringify(forged.diagnostics));assert.equal(runtime.sources().files[0].text,file.text);
 const opened=await runtime.open(source(text.replace('erd Board\n','erd Board\n    with\n        design.state in-review\n')));assert.ok(opened.snapshot,JSON.stringify(opened.diagnostics));const before=runtime.snapshot();
 const current=runtime.sources().files[0];const rejected=await update(runtime,[],[{...current,revision:'s3',text:current.text.replace('Customer from Rows','Customer from Rows\n        with\n            domain MissingDomain')}]);
 assert.ok(rejected.diagnostics.some(d=>d.code==='runtime.protected'),JSON.stringify(rejected.diagnostics));assert.equal(runtime.snapshot(),before);runtime.destroy();
});
test('cancellation and work budgets leave provider transactions unpublished',async()=>{
 const runtime=await setup();const before=runtime.snapshot();const request={base:before.revision,origin:'test',data:[replacement()]};
 const cancelled=await runtime.ingest(request,{cancel:{aborted:true,onAbort:()=>()=>{}}});assert.ok(cancelled.diagnostics.some(d=>d.code==='runtime.cancelled'));assert.equal(runtime.snapshot(),before);
 const bounded=await runtime.ingest(request,{budget:{elapsedMs:10000,workUnits:0,memoryBytes:1000000}});assert.ok(bounded.diagnostics.some(d=>d.code==='runtime.budget-exceeded'));assert.equal(runtime.snapshot(),before);runtime.destroy();
});
test('a newer open supersedes worker decode without stale diagnostics replacing current state',async()=>{
 const options=createNativeRuntimeOptions(),fallback=createComputeExecutor(options);let release,hold=false;
 const executor={async run(request,task){const result=await fallback.run(request,task);if(hold&&request.kind==='decode'){hold=false;await new Promise(resolve=>{release=resolve;});}return result;},destroy(){fallback.destroy();}};
 const runtime=await setup({...options,executor});hold=true;
 const file=runtime.sources().files[0];const pending=update(runtime,[replacement()],[{...file,text:file.text.replace('Board','OldBoard'),revision:'s2'}]);
 while(!release)await new Promise(resolve=>setTimeout(resolve,1));
 const current=await runtime.open(source('erd NewBoard\n    NewEntity\n'));passed(current);release();const old=await pending;
 assert.ok(old.diagnostics.some(d=>d.code==='runtime.stale'));assert.ok(named(runtime,'NewEntity'));assert.deepEqual(runtime.snapshot().revision.data,{});runtime.destroy();
});

test('accepted views receive live data, keep their stored state, and expose stale evidence',async()=>{
 const runtime=await setup();passed(await update(runtime,[replacement()]));
 const snapshot=structuredClone(runtime.snapshot());const view=listRecords(snapshot.normalized).find(entry=>entry.kind==='view');view.record.design={state:'accepted'};view.record.acceptance={at:'2026-10-23T12:00:00Z',by:'tester',semantic_digest:snapshot.semanticFingerprint};
 const opened=await runtime.open(snapshot);passed(opened);const accepted=structuredClone(named(runtime,'Board').record.acceptance);
 const result=await update(runtime,[replacement('d2',[[3,'Current']])]);passed(result);
 assert.deepEqual(rows(runtime).rows,[[3,'Current']]);assert.equal(named(runtime,'Board').record.design.state,'accepted');assert.deepEqual(named(runtime,'Board').record.acceptance,accepted);assert.ok(result.diagnostics.some(d=>d.code==='runtime.acceptance-stale'));runtime.destroy();
});

test('live data preserves an invalid editing buffer without claiming its source revision is valid',async()=>{
 const runtime=await setup();passed(await update(runtime,[replacement()]));const valid=runtime.snapshot();
 const buffer=structuredClone(runtime.sources());buffer.files[0].text='erd "unfinished\n';buffer.files[0].revision='broken-source';
 const failed=await runtime.open(buffer);assert.ok(failed.diagnostics.some(d=>d.severity==='error'));assert.equal(runtime.snapshot(),valid);
 const result=await update(runtime,[replacement('d2',[[4,'Live while typing']])]);
 assert.deepEqual(rows(runtime).rows,[[4,'Live while typing']]);assert.deepEqual(runtime.snapshot().revision.sources,valid.revision.sources);assert.equal(runtime.snapshot().revision.data.feed,'d2');
 assert.equal(runtime.sources().files[0].revision,'broken-source');assert.equal(runtime.sources().files[0].text,'erd "unfinished\n');assert.ok(result.diagnostics.some(d=>d.severity==='error'));
 runtime.destroy();
});
