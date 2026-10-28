import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const output=process.env.DDN_BUILD_ROOT??resolve('.work/builds/ddn');
const load=name=>import(pathToFileURL(resolve(output,'ddn/packages/profiles/src',name+'.js')));
const native=await load('generated-native');
const {catalogueFamilies,profileCatalogueFamily}=await load('generated-families');
const {codex,validateSchema}=await load('schema-core');
const contracts=JSON.parse(readFileSync('standard/codex/profile-contracts.json','utf8'));

test('native catalogue has four descriptors and a complete recognition/schema vocabulary',()=>{
 assert.deepEqual(Object.keys(codex.profiles).sort(),['ddn@1','mindmap.basic@1','concept.map@1','table.records@1'].sort());
 assert.equal(Object.keys(codex.knownProfiles).length,151);
 assert.deepEqual(native.installedCatalogueFamilies(),['native']);
 assert.equal(profileCatalogueFamily('uml.sequence@1'),'graphs');
 assert.equal(profileCatalogueFamily('chart.arc@1'),'charts');
 assert.equal(profileCatalogueFamily('geo.outline@1'),'geography');
 assert.equal(profileCatalogueFamily('canvas.bmc@1'),'surfaces');
 assert.equal(profileCatalogueFamily('invented@1'),undefined);
 const source=readFileSync(resolve(output,'ddn/packages/profiles/src/generated-native.js'));
 assert.ok(gzipSync(source).length<100_000,'shared vocabulary and native descriptors remain below100KB gzip');
 assert.ok(Object.isFrozen(codex));
 assert.ok(Object.isFrozen(codex.profiles));
});

test('family installation rejects wrong versions, hashes and profile identities atomically',async()=>{
 const {catalogueFamily}=await load('generated-family-charts');
 const before=codex.profiles;
 for(const field of ['id','version','contract','codexHash','hash'])
  assert.throws(()=>native.installCatalogueFamily({...catalogueFamily,[field]:'wrong'}),/Unsupported catalogue family/);
 assert.throws(()=>native.installCatalogueFamily({...catalogueFamily,profiles:{}}),/identities/);
 assert.throws(()=>native.installCatalogueFamily({...catalogueFamily,profiles:{...catalogueFamily.profiles,'invented@1':{id:'invented@1'}}}),/identities/);
 assert.strictEqual(codex.profiles,before);
 assert.deepEqual(native.installedCatalogueFamilies(),['native']);
});

test('late family data preserves exact descriptor defaults and stable schema indexes',async()=>{
 const nodes=codex.nodes,roots=codex.roots,roles=codex.roles,properties=codex.properties;
 const {catalogueFamily}=await load('generated-family-charts');
 native.installCatalogueFamily(catalogueFamily);
 assert.equal(Object.keys(codex.profiles).length,34);
 assert.deepEqual(codex.profiles['chart.arc@1'].defaults,contracts['chart.arc@1'].defaults);
 assert.deepEqual(codex.profiles['chart.arc@1'].standard_overrides,contracts['chart.arc@1'].standard_overrides);
 assert.ok(Object.isFrozen(codex.profiles['chart.arc@1'].defaults));
 const installed=codex.profiles;native.installCatalogueFamily(catalogueFamily);
 assert.strictEqual(codex.profiles,installed,'same release installs once');
 assert.strictEqual(codex.nodes,nodes);assert.strictEqual(codex.roots,roots);assert.strictEqual(codex.roles,roles);assert.strictEqual(codex.properties,properties);
 assert.deepEqual(validateSchema('reference',{id:'chart'}),[]);
 assert.notDeepEqual(validateSchema('reference',{id:24}),[]);
});

test('complete assembly reproduces all151 profile contracts without changing native identity',async()=>{
 const full=await load('generated');
 assert.strictEqual(full.compiledCodex,native.compiledCodex);
 assert.deepEqual(Object.keys(codex.profiles),Object.keys(contracts));
 assert.equal(Object.values(catalogueFamilies).reduce((sum,f)=>sum+f.profiles.length,0),151);
 for(const [id,actual]of Object.entries(codex.profiles)){
  const expected=contracts[id];
  for(const key of ['id','method','projection','primary_palette','context_roles','relation_roles','defaults','standard_overrides','inherits','projection_schema','bounded_analysis','metadata_editor_fields','designer_commands','scope'])
   assert.deepEqual(actual[key],expected[key],id+': '+key);
  assert.deepEqual(actual.exclusions,expected.baseline_declared_exclusions??[],id+': exclusions');
  assert.deepEqual(actual.rules,expected.profile_rules,id+': rules');
  assert.deepEqual(actual.relation_endpoint_contracts,expected.relation_endpoint_contracts.map(e=>Object.fromEntries(['role','source_roles','target_roles','member_endpoints','self_allowed','canonical_pattern','canonical_direction'].map(key=>[key,e[key]]))),id+': endpoints');
 }
});

test('deferred native schema keeps a stable frozen facade and rejects incompatible data before installation',async()=>{
 const {createCatalogue}=await load('catalogue-store'),{nativeIndex,nativeSchemaHash}=await load('generated-native-index'),{nativeCatalogue}=await load('generated-native-data');
 const store=createCatalogue(nativeIndex,catalogueFamilies,nativeSchemaHash),facade=store.compiledCodex;
 assert.equal(Object.keys(facade.knownProfiles).length,151);assert.ok(Object.isFrozen(facade));
 assert.throws(()=>facade.nodes,/not loaded/);assert.throws(()=>facade.properties,/not loaded/);
 assert.throws(()=>store.installCore(nativeCatalogue,'wrong'),/Incompatible/);assert.throws(()=>facade.roots,/not loaded/);
 store.installCore(nativeCatalogue,nativeSchemaHash);assert.strictEqual(store.compiledCodex,facade);
 for(const key of ['nodes','roots','properties','roles','core','profiles'])assert.deepEqual(facade[key],nativeCatalogue[key],key);
 store.installCore(nativeCatalogue,nativeSchemaHash);assert.ok(Object.isFrozen(facade.nodes));
});
