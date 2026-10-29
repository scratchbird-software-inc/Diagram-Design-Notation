import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGraphFixture } from './graph-profiles.fixtures.mjs';
import { dataProfileFixture } from './data-profile-fixtures.mjs';
const output=process.env.DDN_BUILD_ROOT??resolve('.work/builds/ddn'),base=resolve(output,'ddn/packages');
const load=name=>import(pathToFileURL(resolve(base,name)));
function closure(entry){
 const seen=new Set();
 function visit(file){if(seen.has(file))return;seen.add(file);const source=readFileSync(file,'utf8');for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*)['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))visit(resolve(dirname(file),match[1]));}
 visit(resolve(base,entry));return [...seen].map(file=>relative(base,file).replaceAll('\\','/'));
}
test('native presentation excludes optional drawing implementations and complete assembly',()=>{
 const imports=closure('presentation/src/native.js');
 for(const forbidden of ['data-charts.js','data-geo.js','data-surfaces.js','data-isometric.js','graph-profiles.js','graph-catalogue.js','complete-renderers.js','pack.js'])assert.ok(!imports.some(file=>file===`presentation/src/${forbidden}`),forbidden);
 assert.ok(imports.includes('presentation/src/graph-native.js'));
});
test('data families import only their own drawing engines',()=>{
 for(const [family,required,excluded] of [['charts','data-charts.js',['data-geo.js','data-surfaces.js','graph-profiles.js']],['geography','data-geo.js',['data-charts.js','data-surfaces.js','graph-profiles.js']],['surfaces','data-surfaces.js',['data-charts.js','data-geo.js','graph-profiles.js']]]){
  const imports=closure(`presentation/src/family-${family}.js`);assert.ok(imports.includes(`presentation/src/${required}`));
  for(const file of excluded)assert.ok(!imports.includes(`presentation/src/${file}`),`${family} pulled ${file}`);
 }
});
test('missing presentation families remain unavailable until explicitly installed',async()=>{
 const native=await load('presentation/src/native.js');
 assert.deepEqual([...native.availableProjectionProfiles].sort(),['concept.map@1','ddn@1','mindmap.basic@1','table.records@1']);
 const {resolveProperties}=await load('defaults/src/index.js');
 const fixture=dataProfileFixture('chart.arc@1'),snapshot=fixture.snapshot,options={resolve:(target,context)=>resolveProperties(snapshot,target,context)};
 const missing=native.projectSnapshot(snapshot,options);
 assert.equal(missing.coverage.complete,false);assert.ok(missing.coverage.unavailable.includes('profile:chart.arc@1'));
 assert.ok(missing.diagnostics.some(d=>d.code==='profile-unavailable'));
 const catalogue=await load('profiles/src/generated-family-charts.js');const {installCatalogueFamily}=await load('profiles/src/generated-native.js');installCatalogueFamily(catalogue.catalogueFamily);
 const charts=await load('presentation/src/family-charts.js');
 assert.equal(native.availableProjectionProfiles.has('chart.arc@1'),false,'import alone must not install a family');
 charts.installChartsPresentation();charts.installChartsPresentation();
 const restored=native.projectSnapshot(snapshot,options);
 assert.equal(restored.coverage.complete,true,JSON.stringify(restored.diagnostics));assert.ok(restored.entries.length>1);
 assert.equal(native.availableProjectionProfiles.has('geo.outline@1'),false);
 assert.equal(native.availableProjectionProfiles.has('uml.sequence@2'),false);
 assert.throws(()=>native.installPresentationFamily({...charts.chartsPresentation,version:'99.0.0'}),/Unsupported/);
 assert.throws(()=>native.installPresentationFamily({...charts.chartsPresentation,data:()=>undefined}),/Conflicting/);
 const all=await load('presentation/src/index.js');
 assert.equal(all.availableProjectionProfiles.size,152);
 const graph=createGraphFixture('uml.sequence@2'),result=all.projectSnapshot(graph.snapshot,{resolve:(target,context)=>resolveProperties(graph.snapshot,target,context)});
 assert.equal(result.coverage.complete,true,JSON.stringify(result.diagnostics));assert.ok(result.entries.some(e=>e.definition.record.category==='relation'));
 assert.deepEqual(native.installedPresentationFamilies().map(f=>f.id).sort(),['charts','geography','graphs','surfaces']);
});
