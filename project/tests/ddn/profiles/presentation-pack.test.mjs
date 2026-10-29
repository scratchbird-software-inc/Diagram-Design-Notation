import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sourceSet,profileSource} from './fixtures.mjs';
const output=process.env.DDN_BUILD_ROOT??resolve('.work/builds/ddn');
const load=name=>import(pathToFileURL(resolve(output,`ddn/packages/${name}/src/index.js`)));
const {createRuntime,createCompleteRuntimeOptions}=await load('runtime');
const {createCompletePresentationPack}=await load('presentation');
const {getProfile,completeProfileIds}=await load('profiles');
const language=await load('language');
const context={checkpoint:async()=>{}};
async function setup(profile='uml.structure@2'){
 const runtime=createRuntime(createCompleteRuntimeOptions());await runtime.open(sourceSet(profileSource(profile,language)));
 const snapshot=runtime.snapshot(),pack=createCompletePresentationPack();
 const definition=pack.registrations.projections.find(p=>p.id===getProfile(profile).projection);
 const input={snapshot,scope:{kind:'workarea'},resolvedProperties:{},fontGeneration:'font1',styleGeneration:'style1'};
 const requests=await definition.measure(input,context);
 const metrics={revision:snapshot.revision,versions:snapshot.versions,fingerprint:snapshot.semanticFingerprint,fontGeneration:'font1',coverage:snapshot.coverage,measurements:Object.fromEntries(requests.map(r=>[r.id,{width:r.text.length*9}]))};
 return {runtime,definition,input,metrics,pack};
}
test('portable presentation pack registers every adopted profile exactly once',()=>{
 const p=createCompletePresentationPack(),profiles=p.registrations.projections.flatMap(p=>p.profiles);
 assert.equal(profiles.length,152);assert.deepEqual([...profiles].sort(),[...completeProfileIds].sort());assert.equal(new Set(profiles).size,152);
});
test('portable projection produces scoped patches and removes retired occurrences',async()=>{
 const f=await setup();try{
  const scene=await f.definition.project(f.input,f.metrics,context);assert.equal(scene.coverage.complete,true);assert.ok(scene.upsert.length>2);
  const retired={...scene.upsert[0],occurrence:'retired'};
  const next=await f.definition.project({...f.input,previous:[...scene.upsert,retired]},f.metrics,context);
  assert.deepEqual(next.remove,['retired']);assert.deepEqual(next.upsert,scene.upsert);
  const selected=scene.upsert.find(item=>item.layer==='content');
  const scoped=await f.definition.project({...f.input,scope:{kind:'item',target:selected.target}},f.metrics,context);
  assert.ok(scoped.upsert.length);assert.ok(scoped.upsert.every(item=>JSON.stringify(item.target)===JSON.stringify(selected.target)));
 }finally{f.runtime.destroy();}
});
test('portable projection rejects measurements from another revision, defaults, model or font generation',async()=>{
 const f=await setup();try{
  for(const patch of [{revision:{...f.metrics.revision,model:'other'}},{versions:{...f.metrics.versions,defaults:'other'}},{fingerprint:'other'},{fontGeneration:'other'}])await assert.rejects(f.definition.project(f.input,{...f.metrics,...patch},context),/stale|another/);
 }finally{f.runtime.destroy();}
});
