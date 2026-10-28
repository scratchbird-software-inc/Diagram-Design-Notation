import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {documentSource,sourceSet} from './fixtures.mjs';
import {createGraphFixture} from '../browser/graph-profiles.fixtures.mjs';
import {dataProfileFixture} from '../browser/data-profile-fixtures.mjs';
const output=process.env.DDN_BUILD_ROOT??resolve('.work/builds/ddn');
const load=name=>import(pathToFileURL(resolve(output,`ddn/packages/${name}/src/index.js`)));
const {createRuntime,createCompleteRuntimeOptions}=await load('runtime');
const {projectSnapshot}=await load('presentation');
const {resolveProperties}=await load('defaults');
const language=await load('language');
test('panel containing an inline chart retains the inner clip and applies opacity once',async()=>{
 const graph=createGraphFixture('uml.interaction_overview@2'),chart=dataProfileFixture('chart.basic@1');
 graph.view.id='interaction';graph.view.name='Interaction';
 graph.definitions.find(d=>d.role==='flow.process').metadata.x_subdiagram={view:'Statistics',display:'inline'};
 chart.view.record.id='statistics';chart.view.record.name='Statistics';chart.view.record.opacity=.5;
 const panel={id:'panel',name:'Dashboard',profile:'panels.composed@1',projection:{options:{panels:[{target:{file:'main.ddn',id:'interaction'},kind:'view'}]}}};
 const document={definitions:[...graph.definitions,...chart.document.definitions],data:chart.document.data,views:[panel,graph.view,chart.view.record]};
 const runtime=createRuntime(createCompleteRuntimeOptions());
 try{
  const opened=await runtime.open(sourceSet(documentSource(document,language)));assert.ok(opened.snapshot,JSON.stringify(opened.diagnostics));
  const projection=projectSnapshot(opened.snapshot,{onlyView:{file:'main.ddn',id:'panel'},resolve:(target,context)=>resolveProperties(opened.snapshot,target,context)});
  assert.equal(projection.coverage.complete,true,JSON.stringify(projection.diagnostics));
  const child=projection.items.find(item=>item.occurrence.startsWith('panel:')&&item.occurrence.includes(':inline:')&&item.layer==='views'&&item.target.id==='statistics');
  assert.ok(child,'the cross-family projection contains the actual chart frame');
  const outer=projection.items.find(item=>item.occurrence.startsWith('panel:')&&item.layer==='views'&&item.target.id==='interaction');
  assert.ok(child.clip.width<outer.clip.width,'inline clip must remain narrower than its containing panel');
  const unpainted=projectSnapshot(opened.snapshot,{onlyView:{file:'main.ddn',id:'panel'},deferOpacity:true,resolve:(target,context)=>resolveProperties(opened.snapshot,target,context)}).items.find(item=>item.occurrence===child.occurrence);
  for(const [index,primitive] of child.primitives.entries()){if('paint'in primitive)assert.equal(primitive.paint.opacity,(unpainted.primitives[index].paint.opacity??1)*.5);if(primitive.kind==='text')for(const run of primitive.runs)assert.equal(run.style.opacity,.5);}
  assert.ok(projection.items.some(item=>item.occurrence.includes(':inline:')&&item.layer==='content'&&item.primitives.some(p=>p.kind==='rect')),'actual chart marks are projected inside the interaction');
 }finally{runtime.destroy();}
});
