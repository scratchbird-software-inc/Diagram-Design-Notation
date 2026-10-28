import {chooseViewLayout, selectDiagramProfile, paletteElement} from './ux-test-helpers.mjs';
import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {allFixtureProfiles,profileSource,documentSource} from '../profiles/fixtures.mjs';
import {dataProfileFixture,retainedQualityFixture} from './data-profile-fixtures.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const distribution=process.env.DDN_DDN_DISTRIBUTION??resolve(root,'.work/builds/ddn-distribution');
const reports=resolve(root,'.work/reports/ddn-complete-browser');
const tool=process.env.DDN_PLAYWRIGHT_ROOT??resolve(root,'.work/tools/browser/node_modules/playwright');
const {chromium}=await import(pathToFileURL(join(tool,'index.mjs')));
const language=await import(pathToFileURL(join(process.env.DDN_BUILD_ROOT??join(root,'.work/builds/ddn'),'ddn/packages/language/src/index.js')));
let browser,context,page;const errors=[],network=[];
before(async()=>{
 await mkdir(join(reports,'svg'),{recursive:true});browser=await chromium.launch({headless:true});context=await browser.newContext({viewport:{width:1600,height:1000}});
 await context.route(/^https?:\/\//,route=>{network.push(route.request().url());return route.abort();});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(join(distribution,'complete/ddn-visual-designer.html')).href);await page.waitForFunction(()=>typeof window.DDN?.createCompleteRuntimeOptions==='function');
 await page.evaluate(()=>{
  const element=document.createElement('div');element.id='complete-fixture';element.style.cssText='position:fixed;inset:0;background:white;z-index:10000;padding:10px';document.body.append(element);
  const runtime=DDN.createRuntime(DDN.createBrowserRuntimeOptions()),viewer=DDN.createViewer(element,{runtime});
  window.completeFixture={element,runtime,viewer,handle:DDN.getViewerHandle(viewer)};
 });
});
after(async()=>{await context?.close();await browser?.close();});
async function openSource(text){return page.evaluate(async text=>{const f=window.completeFixture;f.designer?.destroy();f.designer=undefined;const opened=await f.viewer.open({entry:'main.ddn',files:[{id:'main.ddn',text,revision:'1',encoding:'utf-8',writable:true}]});await f.handle.whenRendered();const scene=f.handle.scene(),report=opened.snapshot?await f.runtime.verifier.verifyModel(opened.snapshot,{scope:{kind:'workarea'},purpose:'design',level:'semantic'}):undefined;return{loaded:!!opened.snapshot,coverage:scene?.coverage,items:scene?.items.length,diagnostics:f.handle.diagnostics(),semanticOutcome:report?.outcome,semanticDiagnostics:report?.diagnostics};},text);}
test('all151 profiles load from redesigned source through workers, render and export offline SVG',async t=>{
 const evidence=[];
 for(const profile of allFixtureProfiles)await t.test(profile,async()=>{
  const opened=await openSource(profileSource(profile,language));assert.equal(opened.loaded,true,JSON.stringify(opened.diagnostics));assert.equal(opened.coverage.complete,true,JSON.stringify(opened.diagnostics));assert.ok(opened.items>1);assert.equal(opened.semanticOutcome,'valid',JSON.stringify(opened.semanticDiagnostics));
  const exported=await page.evaluate(async()=>{const f=window.completeFixture;const result=await f.viewer.capture({scope:{kind:'workarea'},format:'svg',extent:'content',stale:'reject',partial:'reject',includePreview:false});return result.ok?{ok:true,svg:await result.artifacts[0].blob.text()}:{ok:false,reason:result.reason};});
  assert.equal(exported.ok,true,JSON.stringify(exported));assert.doesNotMatch(exported.svg,/NaN|Infinity|undefined/);
  await writeFile(join(reports,'svg',profile.replace(/[^\w.-]/g,'-')+'.svg'),exported.svg);
  evidence.push({profile,items:opened.items,coverage:opened.coverage,diagnostics:opened.diagnostics});
  if(['uml.structure@2','uml.sequence@2','bpmn.process@1','chart.sankey@1','matrix.raci@1','geo.choropleth@1','canvas.bmc@1'].includes(profile))await page.screenshot({path:join(reports,profile.replace(/[^\w.-]/g,'-')+'.png')});
 });
 await writeFile(join(reports,'profile-results.json'),JSON.stringify(evidence,null,2)+'\n');assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
});
test('complete designer selects method/profile and edits typed projection controls',async()=>{
 await openSource('erd Sales\n    Customer\n');
 await page.evaluate(()=>{const f=window.completeFixture;f.designer=DDN.createDesigner(f.viewer,{authority:{authorize:async()=>({allowed:true,principal:'browser-author',grants:['model.edit']})}});});
 const fixture=page.locator('#complete-fixture');await fixture.getByRole('button',{name:'Add view',exact:true}).click();await chooseViewLayout(fixture);
 const dialog=fixture.getByRole('dialog');await selectDiagramProfile(dialog,'uml.structure@2','MT02');await dialog.getByRole('textbox',{name:'Unique view name'}).fill('ClassDesign');await dialog.getByRole('button',{name:'Apply',exact:true}).click();await dialog.waitFor({state:'detached'});
 assert.match(await page.evaluate(()=>window.completeFixture.runtime.sources().files[0].text),/uml.structure@2/);
 await page.evaluate(()=>{const f=window.completeFixture,entry=f.handle.scene().entries.find(e=>e.definition.record.name==='ClassDesign');f.handle.select(entry.definition.ref,entry.item.occurrence);});
 await paletteElement(page,fixture,'uml.class','CustomerClass');
 assert.match(await page.evaluate(()=>window.completeFixture.runtime.sources().files[0].text),/CustomerClass/);
 await openSource(profileSource('chart.basic@1',language));await page.evaluate(()=>{const f=window.completeFixture;f.designer=DDN.createDesigner(f.viewer,{authority:{authorize:async()=>({allowed:true,principal:'browser-author',grants:['model.edit']})}});const e=f.handle.scene().entries.find(e=>e.definition.owner==='view');f.handle.select(e.definition.ref,e.item.occurrence);});
 await fixture.getByRole('button',{name:'Projection',exact:true}).click();await fixture.getByRole('dialog').getByLabel('Set Projection.mark',{exact:true}).check();await fixture.getByRole('dialog').getByRole('group',{name:'Projection.mark',exact:true}).getByRole('button',{name:'line',exact:true}).click();await fixture.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();await fixture.getByRole('dialog').waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>window.completeFixture.runtime.snapshot().normalized.files[0].document.views[0].projection.options.mark),'line');assert.deepEqual(errors,[]);
});

test('composed views preserve transformed child geometry in display and capture',async()=>{
 await openSource(profileSource('panels.composed@1',language));
 const evidence=await page.evaluate(async()=>{const f=window.completeFixture,children=f.handle.scene().items.filter(i=>i.occurrence.startsWith('panel:'));const capture=await f.viewer.capture({scope:{kind:'workarea'},format:'svg',extent:'content',stale:'reject',partial:'reject',includePreview:false});return {children:children.map(i=>({transform:i.transform,clip:i.clip,bounds:i.bounds})),svg:capture.ok?await capture.artifacts[0].blob.text():''};});
 assert.ok(evidence.children.length>1);assert.ok(evidence.children.every(i=>i.clip&&i.transform[0]>0));assert.match(evidence.svg,/clipPath/);assert.match(evidence.svg,/matrix\(/);
});
test('viewer loads declared geography only through the supplied local asset provider',async()=>{
 const fixture=dataProfileFixture('geo.choropleth@1'),asset=fixture.document.assets[0],geo=asset.bytes;delete asset.bytes;
 const evidence=await page.evaluate(async({text,geo})=>{const element=document.createElement('div');document.body.append(element);let reads=0;const runtime=DDN.createRuntime(DDN.createBrowserRuntimeOptions());const viewer=DDN.createViewer(element,{runtime,assets:{read:async id=>{reads++;return {bytes:new TextEncoder().encode(geo),mime:'application/geo+json',hash:'local-map'};}}});try{await viewer.open({entry:'main.ddn',files:[{id:'main.ddn',text,revision:'1',encoding:'utf-8',writable:true}]});const handle=DDN.getViewerHandle(viewer);await handle.whenRendered();return {reads,coverage:handle.scene().coverage,diagnostics:handle.diagnostics()};}finally{viewer.destroy();runtime.destroy();element.remove();}}, {text:documentSource(fixture.document,language),geo});
 assert.equal(evidence.reads,1);assert.equal(evidence.coverage.complete,true,JSON.stringify(evidence.diagnostics));assert.deepEqual(network,[]);
});
test('decision inspector evaluates supplied inputs without changing source',async()=>{
 await openSource(profileSource('decision.rules@1',language));
 const before=await page.evaluate(()=>{const f=window.completeFixture,e=f.handle.scene().entries.find(e=>e.definition.owner==='view');f.handle.select(e.definition.ref,e.item.occurrence);return f.runtime.sources().files[0].text;});
 await page.locator('#complete-fixture').getByRole('button',{name:'Item details',exact:true}).click();
 const inspector=page.locator('#complete-fixture').getByRole('region',{name:'Profile analysis'});
 await inspector.getByLabel('Decision input age',{exact:true}).fill('25');await inspector.getByRole('button',{name:'Match inputs'}).click();assert.match(await inspector.textContent(),/"result": "yes"/);
 assert.equal(await page.evaluate(()=>window.completeFixture.runtime.sources().files[0].text),before);
});

test('matrix projection controls preserve the reference-array schema variant',async()=>{
 await openSource(profileSource('matrix.raci@1',language));
 const before=await page.evaluate(()=>{const f=window.completeFixture;f.designer=DDN.createDesigner(f.viewer,{authority:{authorize:async()=>({allowed:true,principal:'browser-author',grants:['model.edit']})}});const e=f.handle.scene().entries.find(e=>e.definition.owner==='view');f.handle.select(e.definition.ref,e.item.occurrence);return f.runtime.snapshot().normalized.files[0].document.views[0].projection.options.columns;});
 const fixture=page.locator('#complete-fixture');await fixture.getByRole('button',{name:'Projection',exact:true}).click();
 const dialog=fixture.getByRole('dialog');
 assert.equal(await dialog.getByLabel('Projection.columns item reference',{exact:true}).count(),2);
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'detached'});
 assert.deepEqual(await page.evaluate(()=>window.completeFixture.runtime.snapshot().normalized.files[0].document.views[0].projection.options.columns),before);
});
test('separate viewer instances do not share SVG clipping identifiers',async()=>{
 const text=profileSource('panels.composed@1',language);await openSource(text);
 const result=await page.evaluate(async text=>{const f=window.completeFixture,element=document.createElement('div');document.body.append(element);const runtime=DDN.createRuntime(DDN.createBrowserRuntimeOptions()),viewer=DDN.createViewer(element,{runtime});try{await viewer.open({entry:'main.ddn',files:[{id:'main.ddn',text,revision:'1',encoding:'utf-8',writable:true}]});await DDN.getViewerHandle(viewer).whenRendered();const first=[...f.element.querySelectorAll('clipPath')].map(e=>e.id),second=[...element.querySelectorAll('clipPath')].map(e=>e.id);return {first,second};}finally{viewer.destroy();runtime.destroy();element.remove();}},text);
 assert.ok(result.first.length&&result.second.length);assert.deepEqual(result.first.filter(id=>result.second.includes(id)),[]);
});
test('dataset controls expose scalar types and commit numeric cells as numbers',async()=>{
 await openSource(profileSource('chart.basic@1',language));await page.evaluate(()=>{const f=window.completeFixture;f.designer=DDN.createDesigner(f.viewer,{authority:{authorize:async()=>({allowed:true,principal:'browser-author',grants:['model.edit']})}});});
 const fixture=page.locator('#complete-fixture');await fixture.getByRole('button',{name:'Datasets',exact:true}).click();const dialog=fixture.getByRole('dialog');await dialog.getByLabel('Dataset',{exact:true}).selectOption({index:1});
 const type=dialog.getByLabel('Rows item item scalar type',{exact:true}).nth(1);await type.selectOption('string');await dialog.getByLabel('Rows item item',{exact:true}).nth(1).fill('9');await type.selectOption('number');await dialog.getByLabel('Rows item item',{exact:true}).nth(1).fill('9');
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>window.completeFixture.runtime.snapshot().normalized.files[0].document.data[0].rows[0][1]),9);
});

test('retained quality transformations decode, verify and render through the actual browser worker',async t=>{
 for(const transform of ['histogram','pareto','waterfall','boxplot'])await t.test(transform,async()=>{
  const fixture=retainedQualityFixture(transform),opened=await openSource(documentSource(fixture.document,language));
  assert.equal(opened.loaded,true,JSON.stringify(opened.diagnostics));assert.equal(opened.semanticOutcome,'valid',JSON.stringify(opened.semanticDiagnostics));assert.equal(opened.coverage.complete,true,JSON.stringify(opened.diagnostics));
  const text=await page.evaluate(()=>window.completeFixture.element.textContent);assert.doesNotMatch(text,/Unsupported profile|Projection needs valid data/);
 });
});
