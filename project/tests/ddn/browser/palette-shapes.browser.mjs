import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {resolve, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const {chromium}=await import(pathToFileURL(join(root,'.work/tools/browser/node_modules/playwright/index.mjs')));
let browser;
before(async()=>{browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();});
async function palette(t,profile,role){
 const context=await browser.newContext({viewport:{width:1200,height:900}}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));t.after(async()=>{await context.close();assert.deepEqual(errors,[]);});
 await context.route(/^https?:\/\//,route=>route.abort());
 await page.goto(pathToFileURL(resolve(root,'.work/builds/ddn-distribution/modular/designer.html')).href);
 await page.waitForFunction(()=>!!window.DDN?.createDesigner);
 await page.evaluate(async({profile,role})=>{
  const container=document.createElement('main');container.id='palette-test';container.style.cssText='position:fixed;inset:0;z-index:1000;background:white';document.body.append(container);
  const runtime=DDN.createRuntime(DDN.createBrowserRuntimeOptions()),viewer=DDN.createViewer(container,{runtime});
  const opened=await viewer.open({entry:'main.ddn',files:[{id:'main.ddn',text:`view Symbols as ${profile}\n    element Example as ${role}\n`,revision:'one',encoding:'utf-8',writable:true}]});
  if(!opened.snapshot)throw Error(JSON.stringify(opened.diagnostics));
  const designer=DDN.createDesigner(viewer,{authority:{authorize:async()=>({allowed:true,principal:'preview-test',grants:['model.edit']})}}),handle=DDN.getViewerHandle(viewer);
  window.paletteFixture={viewer,designer,handle,runtime};await handle.whenRendered();
 },{profile,role});
 const fixture=page.locator('#palette-test');await fixture.getByRole('button',{name:'Add element',exact:true}).click();
 return {page,fixture,tile:role=>fixture.locator(`.ddn-palette-grid button`).filter({has:page.locator(`svg[data-role="${role}"]`)}).first()};
}
test('ISO flow selector shows distinct real symbols and its tiles still create those elements',async t=>{
 const {page,fixture,tile}=await palette(t,'flow.iso5807@1','flow.start');
 assert.equal(await fixture.locator('.ddn-palette-grid svg').count(),20);
 const overflow=await fixture.locator('.ddn-palette-grid').evaluateAll(grids=>grids.some(grid=>[...grid.children].some(tile=>tile.getBoundingClientRect().right>grid.getBoundingClientRect().right+1)));
 assert.equal(overflow,false,'Both columns fit inside the drawer');
 const geometry=await fixture.locator('.ddn-palette-grid svg').evaluateAll(svgs=>svgs.map(svg=>[...svg.querySelectorAll('path,rect,ellipse')].map(n=>[n.tagName,n.getAttribute('d'),n.getAttribute('rx'),n.getAttribute('ry')].join(':')).join('|')));
 assert.ok(new Set(geometry).size>=16,'The twenty roles must not collapse into generic cards');
 const path=async role=>tile(role).locator('svg path').first().getAttribute('d');
 assert.match(await path('flow.document'),/C/);
 assert.match(await path('flow.preparation'),/L/);
 assert.notEqual(await path('flow.preparation'),await path('flow.decision'));
 assert.notEqual(await path('flow.manualinput'),await path('flow.io'));
 assert.match(await path('flow.start'),/^M26,0.*Q/,'A flow terminator has capsule corners');
 await tile('flow.preparation').dblclick();
 await page.waitForFunction(()=>paletteFixture.handle.scene().entries.some(e=>e.definition.record.role==='flow.preparation'));
 assert.match(await page.evaluate(()=>paletteFixture.runtime.sources().files[0].text),/flow.preparation/);
});
test('shared roles use the chosen method: flow versus BPMN and both DFD process styles',async t=>{
 const flow=await palette(t,'flow.basic@1','flow.start'),bpmn=await palette(t,'bpmn.process@1','flow.start');
 assert.match(await flow.tile('flow.start').locator('svg path').first().getAttribute('d'),/Q/);
 assert.equal(await bpmn.tile('flow.start').locator('svg ellipse').count(),1);
 const startWeight=Number(await bpmn.tile('flow.start').locator('svg ellipse').getAttribute('stroke-width')),endWeight=Number(await bpmn.tile('flow.end').locator('svg ellipse').getAttribute('stroke-width'));
 assert.ok(endWeight>startWeight,'BPMN end events retain their heavier outline');
 const yourdon=await palette(t,'dfd.yourdon@1','dfd.process'),gane=await palette(t,'dfd.gane_sarson@1','dfd.process');
 assert.equal(await yourdon.tile('dfd.process').locator('svg ellipse').count(),1);
 assert.match(await gane.tile('dfd.process').locator('svg path').first().getAttribute('d'),/Q/);
 const radii=await yourdon.tile('dfd.process').locator('svg ellipse').evaluate(e=>[e.getAttribute('rx'),e.getAttribute('ry')]);assert.equal(radii[0],radii[1]);
});
test('UML markers and native DDN icons remain visible in previews',async t=>{
 const state=await palette(t,'uml.statemachine@1','state.initial');
 assert.equal((await state.tile('state.history_deep').locator('svg').textContent()).trim(),'H*');
 const native=await palette(t,'ddn@1','entity');
 assert.ok(await native.tile('entity').locator('svg path').count()>0,'Native entity keeps its concept icon');
 assert.equal(await native.tile('entity').locator('svg').getAttribute('aria-hidden'),'true');
 assert.match(await native.tile('entity').textContent(),/entity/);
 const wireframe=await palette(t,'wireframe.ui@1','ui.label'),sample=wireframe.tile('ui.label').locator('svg');
 assert.equal((await sample.textContent()).trim(),'Text');
 assert.equal(await sample.locator('path,rect,ellipse').count(),0,'A text label has no invented surrounding box');
 assert.equal(await sample.locator('tspan').getAttribute('fill'),'currentColor');
});
