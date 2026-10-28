import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const output=process.env.DDN_DDN_DISTRIBUTION??resolve(root,'.work/builds/ddn-distribution');
const {chromium}=await import(pathToFileURL(join(process.env.DDN_PLAYWRIGHT_ROOT??join(root,'.work/tools/browser/node_modules/playwright'),'index.mjs')));
let browser;
before(async()=>{browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();});
const text='erd Sales\n    with\n        layout.algorithm manual\n    element Customer as entity\n        with\n            position.x 100\n            position.y 100\n            size.width 240\n            size.height 120\n    element Order as entity\n        with\n            position.x 460\n            position.y 100\n    connect Customer to Order\n';
async function session(t,{source=text,writable=true,allowed=true,editing=true}={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000},hasTouch:true}),page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await context.route(/^https?:\/\//,r=>r.abort());
 t.after(async()=>{await context.close();assert.deepEqual(errors,[]);});
 await page.goto(pathToFileURL(join(output,'modular/designer.html')).href);await page.waitForFunction(()=>!!window.DDN?.createDesigner);
 await page.evaluate(async({source,writable,allowed,editing})=>{
  const host=document.createElement('main');host.id='resize-fixture';host.style.cssText='position:fixed;inset:0;z-index:1000;background:white';document.body.append(host);
  const runtime=DDN.createRuntime(DDN.createBrowserRuntimeOptions()),viewer=DDN.createViewer(host,{runtime});
  const opened=await viewer.open({entry:'main.ddn',files:[{id:'main.ddn',text:source,encoding:'utf-8',revision:'one',writable}]});if(!opened.snapshot)throw Error(JSON.stringify(opened.diagnostics));
  const designer=editing?DDN.createDesigner(viewer,{authority:{authorize:async action=>({allowed,principal:'resize-test',grants:allowed?[action]:[]})}}):undefined;
  const handle=DDN.getViewerHandle(viewer);window.resizeFixture={runtime,viewer,designer,handle};await handle.whenRendered();await viewer.navigate({kind:'fit-workarea'});
 },{source,writable,allowed,editing});
 return {page,fixture:page.locator('#resize-fixture')};
}
const source=page=>page.evaluate(()=>resizeFixture.runtime.sources().files[0].text);
async function select(page,name){
 await page.evaluate(name=>{const h=resizeFixture.handle,e=h.scene().entries.find(e=>(e.definition.record.title??e.definition.record.name)===name);h.select(e.definition.ref,e.item.occurrence);},name);
}
async function info(page,name='Customer'){
 await page.evaluate(()=>resizeFixture.handle.whenRendered());
 return page.evaluate(name=>{const h=resizeFixture.handle,e=h.scene().entries.find(e=>(e.definition.record.title??e.definition.record.name)===name),b=e.item.hitTargets.find(hit=>JSON.stringify(hit.target)===JSON.stringify(e.definition.ref))?.bounds??e.item.hitTargets[0]?.bounds??e.item.bounds,m=h.surface.getScreenCTM();return{bounds:b,size:e.appearance?.record.size,position:e.appearance?.record.position,scale:e.surfaceTransform?.[0]??1,screen:m.a,appearance:e.appearance?.ref,occurrence:e.item.occurrence};},name);
}
async function drag(page,grip,dx,dy,{cancel=false}={}){
 const b=await grip.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+dx,b.y+b.height/2+dy,{steps:6});
 if(cancel){await page.keyboard.press('Escape');await page.locator('#resize-fixture .ddn-designer-preview').waitFor({state:'detached'});}await page.mouse.up();
}
test('only selected elements show a resize grip; dragging persists size with one-step undo',async t=>{
 const {page,fixture}=await session(t);const before=await source(page),start=await info(page),grip=fixture.getByRole('button',{name:'Resize Customer',exact:true});
 assert.equal(await fixture.locator('.ddn-element-resize').count(),0,'No handles appear before selection');
 await select(page,'Customer');assert.equal(await grip.count(),1);
 assert.equal(await fixture.getByRole('button',{name:'Resize Order',exact:true}).count(),0);
 await select(page,'Order');assert.equal(await grip.count(),0);assert.equal(await fixture.getByRole('button',{name:'Resize Order',exact:true}).count(),1);
 await page.evaluate(()=>resizeFixture.handle.clearSelection());assert.equal(await fixture.locator('.ddn-element-resize').count(),0);
 await page.evaluate(()=>resizeFixture.viewer.navigate({kind:'fit-workarea'}));assert.equal(await fixture.locator('.ddn-element-resize').count(),0,'Redraw does not restore unselected handles');
 assert.equal(await source(page),before);await select(page,'Customer');
 const rect=await grip.boundingBox();assert.ok(Math.abs(rect.width-20)<=1.1,JSON.stringify(rect));assert.ok(Math.abs(rect.height-20)<=1.1,JSON.stringify(rect));
 await drag(page,grip,48,32);await page.waitForFunction(()=>!!resizeFixture.runtime.sources().files[0].text.match(/size\s*\n\s*width/));
 const after=await info(page);assert.ok(Math.abs(after.size.width-(start.size.width+48/start.screen))<1);assert.ok(Math.abs(after.size.height-(start.size.height+32/start.screen))<1);assert.deepEqual(after.position,start.position);
 const saved=await source(page);await fixture.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForFunction(before=>resizeFixture.runtime.sources().files[0].text===before,before);
 await fixture.getByRole('button',{name:'Redo',exact:true}).click();await page.waitForFunction(saved=>resizeFixture.runtime.sources().files[0].text===saved,saved);
 const capture=await page.evaluate(async()=>{const r=await resizeFixture.viewer.capture({scope:{kind:'workarea'},format:'svg',extent:'content',stale:'reject',partial:'reject',includePreview:false});if(!r.ok)throw Error(JSON.stringify(r));return r.artifacts[0].blob.text();});assert.doesNotMatch(capture,/ddn-element-resize|Drag to resize|Resize Customer/);
});
test('resize is keyboard accessible and Escape cancels a pointer preview without source edits',async t=>{
 const {page,fixture}=await session(t);const grip=fixture.getByRole('button',{name:'Resize Customer',exact:true}),before=await source(page);
 await select(page,'Customer');
 await drag(page,grip,80,40,{cancel:true});assert.equal(await source(page),before);assert.equal(await fixture.locator('.ddn-designer-preview').count(),0);
 await grip.focus();await page.evaluate(()=>resizeFixture.viewer.navigate({kind:'fit-workarea'}));
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Resize Customer','A redraw preserves the focused resize control');
 await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>resizeFixture.handle.scene().entries.some(e=>e.definition.record.name==='Customer'&&Math.abs(e.appearance?.record.size?.width-256)<.01));
 await grip.focus();await page.keyboard.press('Shift+ArrowDown');await page.waitForFunction(()=>resizeFixture.handle.scene().entries.some(e=>e.definition.record.name==='Customer'&&Math.abs(e.appearance?.record.size?.height-121)<.01));
 assert.deepEqual((await info(page)).position,{x:100,y:100});
});
test('display-setting redraw preserves only the selected resize handle',async t=>{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));t.after(async()=>{await context.close();assert.deepEqual(errors,[]);});
 await context.route(/^https?:\/\//,r=>r.abort());
 await page.addInitScript(source=>{window.DDN_SITE_INITIAL={sources:{entry:'main.ddn',files:[{id:'main.ddn',text:source,encoding:'utf-8',revision:'one',writable:true}]}};},text);
 await page.goto(pathToFileURL(join(output,'modular/designer.html')).href);
 const customer=page.locator('.ddn-viewer-stage svg > [data-occurrence]').filter({has:page.locator(':scope > title').filter({hasText:/^Customer/})});
 await customer.click();const grip=page.getByRole('button',{name:'Resize Customer',exact:true});await grip.waitFor();
 await page.getByRole('menuitem',{name:'View',exact:true}).click();await page.getByRole('menuitemcheckbox',{name:'Show grid',exact:true}).click();
 await page.locator('[data-ddn-grid-lines]').waitFor();assert.equal(await grip.count(),1);assert.equal(await page.locator('.ddn-element-resize').count(),1);
 await page.getByRole('menuitem',{name:'Edit',exact:true}).click();await page.getByRole('menuitem',{name:/^Deselect/}).click();
 assert.equal(await page.locator('.ddn-element-resize').count(),0);
 await page.getByRole('menuitem',{name:'View',exact:true}).click();await page.getByRole('menuitemcheckbox',{name:'Show grid',exact:true}).click();
 assert.equal(await page.locator('.ddn-element-resize').count(),0);
});
test('locked and read-only items and viewer-only sessions expose no editing grip',async t=>{
 for(const options of [{source:'element Customer as entity\nerd Sales\n    use Customer\n        with\n            locked.resize true\n'},{writable:false},{editing:false}]){
  const {page,fixture}=await session(t,options);await select(page,'Customer');assert.equal(await fixture.getByRole('button',{name:'Resize Customer',exact:true}).count(),0);
 }
});
test('a denied resize does not change source',async t=>{
 const {page,fixture}=await session(t,{allowed:false});await select(page,'Customer');await drag(page,fixture.getByRole('button',{name:'Resize Customer',exact:true}),60,30);await fixture.locator('.ddn-viewer-status').filter({hasText:/not authorized|denied/i}).waitFor();assert.equal(await source(page),text);
});

test('size and movement locks are independent and the inspector writes their declared properties',async t=>{
 const locked='element Customer as entity\nerd Sales\n    use Customer named Here\n        with\n            locked.move true\n            position.x 100\n            position.y 100\n            size.width 240\n            size.height 120\n';
 const {page,fixture}=await session(t,{source:locked}),grip=fixture.getByRole('button',{name:'Resize Customer',exact:true});
 await select(page,'Customer');
 assert.equal(await grip.count(),1);await drag(page,grip,30,20);await page.waitForFunction(old=>resizeFixture.runtime.sources().files[0].text!==old,locked);
 assert.deepEqual((await info(page)).position,{x:100,y:100});
 await page.evaluate(()=>{const h=resizeFixture.handle,e=h.scene().entries.find(e=>e.definition.record.name==='Customer');h.select(e.definition.ref,e.item.occurrence);h.surface.focus();});
 const before=await source(page);await page.keyboard.press('ArrowRight');assert.equal(await source(page),before);
 await fixture.getByRole('button',{name:'Properties',exact:true}).click();const size=fixture.getByRole('checkbox',{name:'Lock size (cannot be resized)',exact:true});await size.check();
 await page.waitForFunction(()=>resizeFixture.handle.scene().entries.some(e=>e.definition.record.name==='Customer'&&e.appearance?.record.locked?.resize===true));
 assert.equal(await grip.count(),0);await size.uncheck();await grip.waitFor();
});
test('compact mind-map topics resize through their recipe and survive save/reopen',async t=>{
 const original='// Keep this comment\nmindmap Plan\n    Research\n    Delivery\n';const {page,fixture}=await session(t,{source:original});const before=await info(page,'Research');
 await select(page,'Research');
 await drag(page,fixture.getByRole('button',{name:'Resize Research',exact:true}),50,24);
 await page.waitForFunction(()=>resizeFixture.runtime.sources().files[0].text!== '// Keep this comment\nmindmap Plan\n    Research\n    Delivery\n');
 const changed=await info(page,'Research');assert.ok(changed.size.width>before.bounds.width);assert.match(await source(page),/Keep this comment/);
 await page.evaluate(async()=>{const f=resizeFixture,files=await Promise.all((await f.designer.save()).map(async a=>({id:a.name,text:await a.blob.text(),encoding:'utf-8',revision:'saved',writable:true})));await f.viewer.open({entry:'main.ddn',files});await f.handle.whenRendered();});
 assert.deepEqual((await info(page,'Research')).size,changed.size);
});
test('dashboard scaling keeps resize dimensions in logical units and fixed view has no grip',async t=>{
 const {page,fixture}=await session(t,{source:'workarea Board\n    with\n        mode standalone\n'+text.replace('layout.algorithm manual','surface.preset tv-4k\n        surface.fit none\n        layout.algorithm manual')});const before=await info(page);
 assert.equal(before.scale,2);await select(page,'Sales');assert.equal(await fixture.getByRole('button',{name:'Resize Sales',exact:true}).count(),0);await select(page,'Customer');
 await drag(page,fixture.getByRole('button',{name:'Resize Customer',exact:true}),24*before.scale*before.screen,16*before.scale*before.screen);
 await page.waitForFunction(()=>resizeFixture.handle.scene().entries.some(e=>e.definition.record.name==='Customer'&&Math.abs(e.appearance?.record.size?.width-264)<1));
 const after=await info(page);assert.ok(Math.abs(after.size.height-136)<1);assert.deepEqual(after.position,before.position);
});

test('touch dragging the corner resizes without panning and ordinary clicks still select elements',async t=>{
 const {page,fixture}=await session(t),before=await info(page),grip=fixture.getByRole('button',{name:'Resize Customer',exact:true});
 await select(page,'Customer');
 const b=await grip.boundingBox(),client=await page.context().newCDPSession(page),x=b.x+b.width/2,y=b.y+b.height/2;
 const camera=await page.evaluate(()=>resizeFixture.handle.viewport());
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let i=1;i<=5;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+8*i,y:y+4*i}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>resizeFixture.handle.scene().entries.some(e=>e.definition.record.name==='Customer'&&e.appearance?.record.size?.width>240));
 const resized=await info(page);assert.ok(resized.size.width>before.size.width);assert.deepEqual(await page.evaluate(()=>resizeFixture.handle.viewport()),camera);
 const occurrence=(await info(page,'Order')).occurrence,node=fixture.locator(`.ddn-viewer-stage svg > [data-occurrence="${occurrence}"]`);
 const box=await node.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);assert.equal(await page.evaluate(()=>resizeFixture.handle.selectedEntry()?.definition.record.name),'Order');
 assert.equal(await grip.count(),0);assert.equal(await fixture.getByRole('button',{name:'Resize Order',exact:true}).count(),1);
});
