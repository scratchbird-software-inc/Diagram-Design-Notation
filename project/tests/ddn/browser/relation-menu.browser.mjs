import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const output=process.env.DDN_DDN_DISTRIBUTION??resolve(root,'.work/builds/ddn-distribution');
const {chromium}=await import(pathToFileURL(join(process.env.DDN_PLAYWRIGHT_ROOT??join(root,'.work/tools/browser/node_modules/playwright'),'index.mjs')));
let browser;
before(async()=>{browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();});
const initial='// Preserve the original description.\nerd Sales\n    Customer\n    Order\n    Invoice\n    connect Customer to Order named Purchases : Places order\n    connect Order to Invoice named Billing : Creates invoice\n';
async function session(t,{text=initial,writable=true,allowed=true,files=[]}={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await context.route(/^https?:\/\//,r=>r.abort());
 t.after(async()=>{await context.close();assert.deepEqual(errors,[]);});
 await page.goto(pathToFileURL(join(output,'modular/designer.html')).href);await page.waitForFunction(()=>!!window.DDN?.createDesigner);
 await page.evaluate(async({text,writable,allowed,files})=>{
  const container=document.createElement('main');container.id='relation-fixture';container.style.cssText='position:fixed;inset:0;z-index:1000;background:white';document.body.append(container);
  const runtime=DDN.createRuntime(DDN.createBrowserRuntimeOptions()),viewer=DDN.createViewer(container,{runtime});
  const opened=await viewer.open({entry:'main.ddn',files:[{id:'main.ddn',text,encoding:'utf-8',revision:'one',writable},...files]});if(!opened.snapshot)throw Error(JSON.stringify(opened.diagnostics));
  const designer=DDN.createDesigner(viewer,{authority:{authorize:async action=>({allowed,principal:'relation-test',grants:allowed?[action]:[]})}}),handle=DDN.getViewerHandle(viewer);
  window.relationFixture={runtime,viewer,designer,handle};await handle.whenRendered();await viewer.navigate({kind:'fit-workarea'});
 },{text,writable,allowed,files});
 return {page,fixture:page.locator('#relation-fixture')};
}
const source=page=>page.evaluate(()=>relationFixture.runtime.sources().files[0].text);
async function state(page,name='Purchases',view='Sales'){
 await page.evaluate(()=>relationFixture.handle.whenRendered());
 return page.evaluate(({name,view})=>{
  const entries=relationFixture.handle.scene().entries,edge=entries.find(e=>e.definition.record.category==='relation'&&e.definition.record.name===name&&e.view.record.name===view),frame=entries.find(e=>e.definition.owner==='view'&&e.definition.record.name===view);
  if(!edge)throw Error('Missing relation '+name+' in '+view);
  const text=entry=>entry?.item.primitives.flatMap(p=>p.kind==='text'?p.runs.map(r=>r.text):[]).join(' ')??'';
  return {caption:text(edge),legend:text(frame),appearance:edge.appearance?.record,definition:edge.definition.record};
 },{name,view});
}
async function openMenu(page,name='Purchases',view='Sales'){
 // Target the source-bound relation group, including when its inline label is hidden.
 await page.evaluate(({name,view})=>{
  const h=relationFixture.handle,e=h.scene().entries.find(e=>e.definition.record.category==='relation'&&(!name||e.definition.record.name===name)&&(!view||e.view.record.name===view));
  if(!e)throw Error('Missing context-menu relation');
  const element=[...h.surface.querySelectorAll('[data-occurrence]')].find(n=>n.getAttribute('data-occurrence')===e.item.occurrence);
  if(!element)throw Error('Missing rendered relation');
  const b=h.surface.getBoundingClientRect();element.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:b.x+b.width/2,clientY:b.y+b.height/2}));
 },{name,view});
 const menu=page.locator('#relation-fixture .ddn-designer-menu');await menu.waitFor();return menu;
}
async function toggle(page,label,{name='Purchases',view='Sales'}={}){
 const before=await source(page),menu=await openMenu(page,name,view);await menu.getByRole('menuitemcheckbox',{name:label,exact:true}).click();
 await page.waitForFunction(before=>relationFixture.runtime.sources().files[0].text!==before,before);await page.evaluate(()=>relationFixture.handle.whenRendered());
}
async function checked(menu,label,expected){assert.equal(await menu.getByRole('menuitemcheckbox',{name:label,exact:true}).getAttribute('aria-checked'),String(expected));}

test('relation label visibility, number/text and legend membership update independently',async t=>{
 const {page}=await session(t);let menu=await openMenu(page);
 await checked(menu,'Label visible',true);await checked(menu,'Number instead of text',false);await checked(menu,'Include in legend',false);
 assert.match((await state(page)).caption,/Places order/);assert.doesNotMatch((await state(page)).legend,/RELATIONSHIP KEY/);
 await page.keyboard.press('Escape');await toggle(page,'Include in legend');
 assert.match((await state(page)).legend,/RELATIONSHIP KEY/);assert.match((await state(page)).legend,/Places order/);
 await toggle(page,'Label visible');assert.equal((await state(page)).caption,'');assert.match((await state(page)).legend,/Places order/);
 await toggle(page,'Number instead of text');assert.equal((await state(page)).caption,'');assert.equal((await state(page)).appearance.label.mode,'numbers');
 await toggle(page,'Label visible');assert.equal((await state(page)).caption,'1');assert.match((await state(page)).legend,/1\s+Customer.*Order.*Places order/);
 assert.match((await state(page,'Billing')).caption,/Creates invoice/,'Other relations keep text captions');
 await toggle(page,'Include in legend');assert.equal((await state(page)).caption,'1');assert.doesNotMatch((await state(page)).legend,/RELATIONSHIP KEY/);
 menu=await openMenu(page);await checked(menu,'Label visible',true);await checked(menu,'Number instead of text',true);await checked(menu,'Include in legend',false);
 await page.keyboard.press('Escape');await toggle(page,'Number instead of text');assert.match((await state(page)).caption,/Places order/);
 assert.match(await source(page),/^\/\/ Preserve the original description\./);
});

test('each context toggle is one undoable source edit and the result survives save/reopen and SVG capture',async t=>{
 const {page,fixture}=await session(t),before=await source(page);
 await toggle(page,'Label visible');const hidden=await source(page);assert.equal((await state(page)).caption,'');
 await fixture.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForFunction(before=>relationFixture.runtime.sources().files[0].text===before,before);assert.match((await state(page)).caption,/Places order/);
 await fixture.getByRole('button',{name:'Redo',exact:true}).click();await page.waitForFunction(hidden=>relationFixture.runtime.sources().files[0].text===hidden,hidden);assert.equal((await state(page)).caption,'');
 await toggle(page,'Include in legend');await toggle(page,'Number instead of text');
 const expected=(await state(page)).appearance;
 await page.evaluate(async()=>{
  const f=relationFixture,files=await Promise.all((await f.designer.save()).map(async a=>({id:a.name,text:await a.blob.text(),encoding:'utf-8',revision:'saved',writable:true})));
  const opened=await f.viewer.open({entry:'main.ddn',files});if(!opened.snapshot)throw Error(JSON.stringify(opened.diagnostics));await f.handle.whenRendered();
 });
 const after=await state(page);assert.equal(after.caption,'');assert.deepEqual(after.appearance.label,expected.label);assert.deepEqual(after.appearance.legend,expected.legend);assert.match(after.legend,/Places order/);
 const svg=await page.evaluate(async()=>{const r=await relationFixture.viewer.capture({scope:{kind:'workarea'},format:'svg',extent:'content',stale:'reject',partial:'reject',includePreview:false});if(!r.ok)throw Error(JSON.stringify(r));return r.artifacts[0].blob.text();});
 assert.match(svg,/RELATIONSHIP KEY/);assert.match(svg,/Places order/);assert.doesNotMatch(svg,/ddn-designer-menu/);
});

test('toggles change only the selected appearance of a relation reused in another view',async t=>{
 const text='element Customer as entity\nelement Order as entity\nconnect Customer to Order as assoc named Purchases : Places order\nerd Sales\n    use Customer\n    use Order\n    use Purchases named Here\nerd Summary\n    use Customer\n    use Order\n    use Purchases named There\n';
 const {page}=await session(t,{text}),semantic=(await state(page)).definition;
 await toggle(page,'Label visible');await toggle(page,'Number instead of text');await toggle(page,'Include in legend');
 const here=await state(page),there=await state(page,'Purchases','Summary');
 assert.equal(here.caption,'');assert.match(here.legend,/Places order/);assert.match(there.caption,/Places order/);assert.doesNotMatch(there.legend,/RELATIONSHIP KEY/);
 assert.deepEqual(here.definition,semantic);assert.equal(there.appearance.label,undefined);assert.equal(there.appearance.legend,undefined);
 const menu=await openMenu(page,'Purchases','Summary');await checked(menu,'Label visible',true);await checked(menu,'Number instead of text',false);await checked(menu,'Include in legend',false);
});

test('numbered views retain stable numbers when a relation is excluded from the legend',async t=>{
 const text=initial.replace('erd Sales\n','erd Sales\n    with\n        legend.mode numbers\n');const {page}=await session(t,{text});
 assert.equal((await state(page)).caption,'1');assert.equal((await state(page,'Billing')).caption,'2');
 await toggle(page,'Include in legend');assert.equal((await state(page,'Billing')).caption,'2');assert.doesNotMatch((await state(page)).legend,/Places order/);assert.match((await state(page)).legend,/2\s+Order.*Invoice.*Creates invoice/);
 await toggle(page,'Number instead of text',{name:'Billing'});assert.match((await state(page,'Billing')).caption,/Creates invoice/);assert.match((await state(page)).legend,/Creates invoice/);
});

test('internal mind-map relations keep the profile rules and show disabled presentation toggles',async t=>{
 const text='mindmap Plan\n    Research\n    Delivery\n';const {page}=await session(t,{text}),menu=await openMenu(page,null,null);
 for(const label of ['Label visible','Number instead of text','Include in legend']){
  const control=menu.getByRole('menuitemcheckbox',{name:label,exact:true});assert.equal(await control.isDisabled(),true);assert.match(await control.getAttribute('title'),/mind.?map/i);
 }
 await page.keyboard.press('Escape');assert.equal(await source(page),text);
 const caption=await page.evaluate(()=>relationFixture.handle.scene().entries.filter(e=>e.definition.record.category==='relation').flatMap(e=>e.item.primitives.filter(p=>p.kind==='text')));assert.deepEqual(caption,[]);
});

test('read-only occurrences disable the toggles and denied edits leave source unchanged',async t=>{
 const readonly=await session(t,{writable:false}),menu=await openMenu(readonly.page);
 for(const label of ['Label visible','Number instead of text','Include in legend'])assert.equal(await menu.getByRole('menuitemcheckbox',{name:label,exact:true}).isDisabled(),true);
 assert.equal(await source(readonly.page),initial);
 const denied=await session(t,{allowed:false}),deniedMenu=await openMenu(denied.page);
 await deniedMenu.getByRole('menuitemcheckbox',{name:'Label visible',exact:true}).click();
 await denied.fixture.locator('.ddn-viewer-status').filter({hasText:/not authorized|denied/i}).waitFor();
 assert.equal(await source(denied.page),initial);assert.match((await state(denied.page)).caption,/Places order/);
});

test('a relation selected without an authored occurrence gains local settings in one undoable edit',async t=>{
 const text='element Customer as entity\nelement Order as entity\nconnect Customer to Order as assoc named Purchases : Places order\nerd Sales\n    with\n        selection.include\n            item Customer\n            item Order\n            item Purchases\n';
 const {page,fixture}=await session(t,{text});assert.equal((await state(page)).appearance,undefined);
 await toggle(page,'Label visible');const changed=await source(page),current=await state(page);
 assert.equal(current.caption,'');assert.equal(current.appearance.label.visible,false);assert.equal(current.definition.label,undefined);
 assert.match(changed,/use "?Purchases"?/);
 assert.equal(await page.evaluate(()=>relationFixture.handle.scene().entries.filter(e=>e.definition.record.name==='Purchases').length),1,'Adding settings does not duplicate the relation');
 await fixture.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForFunction(text=>relationFixture.runtime.sources().files[0].text===text,text);
 assert.equal((await state(page)).appearance,undefined);assert.match((await state(page)).caption,/Places order/);
 await fixture.getByRole('button',{name:'Redo',exact:true}).click();await page.waitForFunction(changed=>relationFixture.runtime.sources().files[0].text===changed,changed);
 assert.equal((await state(page)).caption,'');assert.equal((await state(page)).appearance.label.visible,false);
});

test('relation context menu supports arrow, Home/End and keyboard toggle activation',async t=>{
 const {page}=await session(t);await openMenu(page);const active=()=>page.evaluate(()=>document.activeElement?.getAttribute('aria-label')??document.activeElement?.textContent?.trim());
 assert.equal(await active(),'Label visible');
 await page.keyboard.press('ArrowDown');assert.equal(await active(),'Number instead of text');
 await page.keyboard.press('ArrowDown');assert.equal(await active(),'Include in legend');
 await page.keyboard.press('ArrowUp');assert.equal(await active(),'Number instead of text');
 await page.keyboard.press('End');assert.equal(await active(),'Delete');
 await page.keyboard.press('Home');assert.equal(await active(),'Label visible');assert.equal(await source(page),initial);
 await page.keyboard.press('Space');await page.waitForFunction(before=>relationFixture.runtime.sources().files[0].text!==before,initial);
 assert.equal((await state(page)).caption,'');assert.equal(await page.locator('#relation-fixture .ddn-designer-menu').count(),0);
 const before=await source(page);await openMenu(page);await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await page.waitForFunction(before=>relationFixture.runtime.sources().files[0].text!==before,before);assert.equal((await state(page)).appearance.label.mode,'numbers');
 await openMenu(page);await page.keyboard.press('Escape');assert.equal(await page.locator('#relation-fixture .ddn-designer-menu').count(),0);
 assert.equal(await page.evaluate(()=>document.activeElement===relationFixture.handle.surface),true);
});

test('a selection-only relation in a nested view writes a relative reference and leaves the shared file untouched',async t=>{
 const shared='element Customer as entity\nelement Order as entity\nconnect Customer to Order as assoc named Purchases : Places order\n';
 const board='erd Sales\n    with\n        selection.include\n            item "../models/data.ddn"::Customer\n            item "../models/data.ddn"::Order\n            item "../models/data.ddn"::Purchases\n';
 const {page,fixture}=await session(t,{text:'include "models/data.ddn"\ninclude "views/board.ddn"\n',files:[{id:'models/data.ddn',text:shared,encoding:'utf-8',revision:'model',writable:false},{id:'views/board.ddn',text:board,encoding:'utf-8',revision:'view',writable:true}]});
 assert.equal((await state(page)).appearance,undefined);
 const menu=await openMenu(page);await menu.getByRole('menuitemcheckbox',{name:'Label visible',exact:true}).click();
 await page.waitForFunction(()=>relationFixture.runtime.sources().files.find(f=>f.id==='views/board.ddn').text.includes('label.visible'));
 assert.equal((await state(page)).caption,'');
 const files=await page.evaluate(()=>relationFixture.runtime.sources().files);
 assert.equal(files.find(f=>f.id==='models/data.ddn').text,shared);
 assert.match(files.find(f=>f.id==='views/board.ddn').text,/use "\.\.\/models\/data.ddn"::"Purchases"/);
 await fixture.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForFunction(board=>relationFixture.runtime.sources().files.find(f=>f.id==='views/board.ddn').text===board,board);
 assert.equal((await state(page)).appearance,undefined);
});
