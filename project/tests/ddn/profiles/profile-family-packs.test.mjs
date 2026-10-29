import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { Worker } from 'node:worker_threads';

const build=process.env.DDN_BUILD_ROOT??resolve('.work/builds/ddn');
const packages=resolve(build,'ddn/packages');
/** Each host starts without side effects from another test's complete imports. */
function fresh(body){
 return new Promise((done,fail)=>{
  const code=`const {parentPort}=require('node:worker_threads');const assert=require('node:assert/strict');const {resolve}=require('node:path');const {pathToFileURL}=require('node:url');const root=${JSON.stringify(packages)};const load=name=>import(pathToFileURL(resolve(root,name)).href);(async()=>{${body}})().then(()=>parentPort.postMessage({ok:true}),error=>parentPort.postMessage({error:error.stack}));`;
  const worker=new Worker(code,{eval:true});let received=false;
  worker.once('error',fail);
  worker.once('message',result=>{received=true;worker.terminate();result.ok?done():fail(Error(result.error));});
  worker.once('exit',code=>{if(!received)fail(Error('Catalogue test worker exited before reporting: '+code));});
 });
}
const bpmnSource=`
 const language=await load('language/src/index.js');
 const ref=id=>({id});
 const emit=(head,record)=>head+'\\n    with\\n'+language.serializeProperties(record,'        ');
 const text=[
  emit('workarea Work',{id:'work',allow_foreign_views:true}),
  emit('element A as flow.process',{id:'a'}),
  emit('element B as flow.process',{id:'b'}),
  emit('relation Message as bpmn.messageflow',{id:'message',endpoints:[{definition:ref('a')},{definition:ref('b')}]}),
  emit('view Process as bpmn.basic@1',{id:'diagram',selection:{include:[ref('a'),ref('b'),ref('message')]},regions:[{id:'pool',role:'bpmn.pool',members:[ref('a'),ref('b')]}]})
 ].join('\\n');
 const sources={entry:'main.ddn',files:[{id:'main.ddn',text,revision:'1',encoding:'utf-8',writable:true}]};
 const settings={scope:{kind:'workarea'},level:'semantic',purpose:'inspect'};
`;

test('lean runtime dependency graph excludes complete data, optional analysis and editing',()=>{
 const seen=new Set();
 function visit(file){
  if(seen.has(file))return;seen.add(file);
  const source=readFileSync(file,'utf8');
  for(const match of source.matchAll(/(?:from\s*|import\s*\(?\s*)['"]([^'"]+)['"]/g))
   if(match[1].startsWith('.'))visit(resolve(dirname(file),match[1]));
 }
 visit(resolve(packages,'runtime/src/native.js'));visit(resolve(packages,'profiles/src/native.js'));
 const paths=[...seen].map(p=>p.slice(packages.length+1));
 for(const unwanted of ['profiles/src/generated.js','profiles/src/complete.js','profiles/src/index.js','profiles/src/semantic.js','profiles/src/analysis.js','profiles/src/analysis-profile.js','runtime/src/commands.js'])
  assert.ok(!paths.includes(unwanted),unwanted+' must remain optional');
 assert.ok(!paths.some(p=>p.startsWith('presentation/')||p.startsWith('designer/')||p.startsWith('viewer/')));
});

test('native imports in a fresh host register exactly native rules and immutable manifests',()=>fresh(`
 const {createNativeRuntimeOptions}=await load('runtime/src/native.js');
 const {codex}=await load('profiles/src/schema-core.js');
 const {installedCatalogueFamilies}=await load('profiles/src/generated-native.js');
 const {nativeProfileIds}=await load('profiles/src/core.js');
 const options=createNativeRuntimeOptions(),pack=options.packs[0];
 assert.equal(options.packs.length,1);assert.equal(pack.manifest.id,'ddn-native');
 assert.deepEqual(pack.manifest.profiles,nativeProfileIds);
 assert.deepEqual(pack.registrations.rules.map(rule=>rule.profiles[0]),nativeProfileIds);
 assert.equal(Object.keys(codex.profiles).length,4);
 assert.deepEqual(installedCatalogueFamilies(),['native']);
 assert.ok(Object.isFrozen(pack.manifest.profiles));assert.ok(Object.isFrozen(pack.manifest.languages));
 assert.ok(Object.isFrozen(pack.manifest.dependencies));
 assert.throws(()=>pack.manifest.profiles.push('uml.structure@2'),TypeError);
`));

test('catalogue data alone never authorizes verification; late family rules expose real BPMN errors',()=>fresh(`
 const {createRuntime,createNativeRuntimeOptions}=await load('runtime/src/native.js');
 const {installCatalogueFamily}=await load('profiles/src/generated-native.js');
 const {catalogueFamily}=await load('profiles/src/generated-family-graphs.js');
 const {catalogueFamilies}=await load('profiles/src/generated-families.js');
 const {loadedProfilePacks}=await load('profiles/src/family-packs.js');
 ${bpmnSource}
 installCatalogueFamily(catalogueFamily);
 const runtime=createRuntime(createNativeRuntimeOptions());
 try {
  const opened=await runtime.open(sources);assert.ok(opened.snapshot,JSON.stringify(opened.diagnostics));
  const before=await runtime.verifier.verifyModel(opened.snapshot,settings);
  assert.equal(before.outcome,'unsupported',JSON.stringify(before.diagnostics));
  assert.ok(before.missing.includes('profile:bpmn.basic@1'));
  assert.ok(!before.diagnostics.some(d=>d.code==='DDN-BPMN-MESSAGE-POOL'));
  await load('profiles/src/families/graphs.js');
  const graph=loadedProfilePacks().find(pack=>pack.manifest.id==='ddn-graphs');
  assert.ok(graph);assert.deepEqual(graph.manifest.profiles,catalogueFamilies.graphs.profiles);
  assert.deepEqual(graph.registrations.profiles.map(p=>p.id),catalogueFamilies.graphs.profiles);
  assert.deepEqual(graph.registrations.rules.map(rule=>rule.profiles[0]),catalogueFamilies.graphs.profiles);
  runtime.registry.install(graph);
  const after=await runtime.verifier.verifyModel(opened.snapshot,settings);
  assert.equal(after.outcome,'invalid',JSON.stringify(after.diagnostics));
  const problem=after.diagnostics.find(d=>d.code==='DDN-BPMN-MESSAGE-POOL');
  assert.ok(problem);assert.equal(problem.target.id,'message');assert.equal(problem.rule,'ddn.profile.bpmn.basic@1');
  assert.equal(after.missing.includes('profile:bpmn.basic@1'),false);
  assert.equal(after.ruleVersions['ddn.profile.bpmn.basic@1'],'1.0.0');
 } finally { runtime.destroy(); }
`));

test('optional defaults remain identical after loading the complete convenience API',()=>fresh(`
 await load('profiles/src/families/graphs.js');
 const {resolve}=await load('defaults/src/index.js');
 const {getProfile}=await load('profiles/src/core.js');
 const before=resolve({role:'petri.place'},'definition',{profile:'petri.basic@1'});
 assert.equal(before.values.metadata.x_petri.tokens,0);
 const declaration=getProfile('petri.basic@1');
 await load('profiles/src/index.js');
 const after=resolve({role:'petri.place'},'definition',{profile:'petri.basic@1'});
 assert.deepEqual(after,before);assert.deepEqual(getProfile('petri.basic@1'),declaration);
 const explicit=resolve({role:'petri.place',metadata:{x_petri:{tokens:7}}},'definition',{profile:'petri.basic@1'});
 assert.equal(explicit.values.metadata.x_petri.tokens,7);
`));

test('family manifests enforce dependencies and selected versions without mutating registries',()=>fresh(`
 await load('profiles/src/families/graphs.js');
 const {loadedProfilePacks}=await load('profiles/src/family-packs.js');
 const {createRegistry}=await load('runtime/src/registry.js');
 const {createNativePack}=await load('profiles/src/native.js');
 const {STANDARD_VERSIONS}=await load('runtime/src/native.js');
 const graph=loadedProfilePacks().find(p=>p.manifest.id==='ddn-graphs');
 const registry=createRegistry(STANDARD_VERSIONS);
 assert.throws(()=>registry.install(graph),/Missing or cyclic pack dependency/);
 assert.deepEqual(registry.describe(),[]);
 registry.install(createNativePack());registry.install(graph);registry.install(graph);
 assert.deepEqual(registry.describe().map(m=>m.id),['ddn-native','ddn-graphs']);
 assert.throws(()=>registry.install({...graph,manifest:{...graph.manifest,hash:'different'}}),/Incompatible duplicate pack/);
 const selected=createRegistry({...STANDARD_VERSIONS,packs:{'ddn-graphs':'9.0.0'}});
 selected.install(createNativePack());
 assert.throws(()=>selected.install(graph),/Pack version differs/);
 assert.deepEqual(selected.describe().map(m=>m.id),['ddn-native']);
 assert.ok(Object.isFrozen(graph.registrations.rules));
 assert.ok(Object.isFrozen(graph.registrations.rules[0].profiles));
 assert.throws(()=>graph.registrations.rules.pop(),TypeError);
`));

test('family registration rejects unknown, partial and conflicting declarations',()=>fresh(`
 const {installCatalogueFamily}=await load('profiles/src/generated-native.js');
 const {catalogueFamily}=await load('profiles/src/generated-family-graphs.js');
 const {catalogueFamilies}=await load('profiles/src/generated-families.js');
 const {registerProfileFamily,loadedProfilePacks}=await load('profiles/src/family-packs.js');
 const {completeProfileDiagnostics}=await load('profiles/src/semantic.js');
 installCatalogueFamily(catalogueFamily);
 assert.throws(()=>registerProfileFamily('invented',catalogueFamilies.graphs.profiles,completeProfileDiagnostics));
 assert.throws(()=>registerProfileFamily('graphs',['bpmn.basic@1'],completeProfileDiagnostics));
 assert.deepEqual(loadedProfilePacks().map(p=>p.manifest.id),['ddn-native']);
 await load('profiles/src/families/graphs.js');
 registerProfileFamily('graphs',catalogueFamilies.graphs.profiles,completeProfileDiagnostics);
 assert.throws(()=>registerProfileFamily('graphs',['bpmn.basic@1'],completeProfileDiagnostics));
 assert.throws(()=>registerProfileFamily('graphs',catalogueFamilies.graphs.profiles,()=>[]));
 assert.deepEqual(loadedProfilePacks().map(p=>p.manifest.id),['ddn-native','ddn-graphs']);
`));

test('fine packs preserve every broad-family descriptor and register each optional profile once',()=>fresh(`
 const {catalogueShards,profileCatalogueShard}=await load('profiles/src/generated-shards.js');
 const {loadedProfilePacks}=await load('profiles/src/family-packs.js');
 const {codex}=await load('profiles/src/schema-core.js');
 const parents=new Map();
 assert.equal(Object.keys(catalogueShards).length,19);
 for(const [id,manifest]of Object.entries(catalogueShards)){
  if(!parents.has(manifest.parent))parents.set(manifest.parent,(await load('profiles/src/generated-family-'+manifest.parent+'.js')).catalogueFamily);
  await load('profiles/src/shards/'+id+'.js');
  const pack=loadedProfilePacks().find(pack=>pack.manifest.id==='ddn-'+id);assert.ok(pack);
  assert.deepEqual(pack.manifest.profiles,manifest.profiles);assert.equal(pack.manifest.hash,manifest.hash);
  for(const profile of manifest.profiles){assert.equal(profileCatalogueShard(profile),id);assert.deepEqual(codex.profiles[profile],parents.get(manifest.parent).profiles[profile]);}
 }
 const packs=loadedProfilePacks();assert.equal(packs.length,20);assert.equal(new Set(packs.flatMap(pack=>pack.manifest.profiles)).size,152);
 const {createRuntime}=await load('runtime/src/runtime.js'),{STANDARD_VERSIONS}=await load('runtime/src/versions.js');
 const runtime=createRuntime({versions:STANDARD_VERSIONS,packs});assert.equal(runtime.registry.describe().length,20);runtime.destroy();
`));
