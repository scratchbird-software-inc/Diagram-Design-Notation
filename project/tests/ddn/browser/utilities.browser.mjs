import {moreAction, allProperties, inlineName} from './ux-test-helpers.mjs';
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const distribution=process.env.DDN_DDN_DISTRIBUTION??resolve(root,'.work/builds/ddn-distribution');
const tool=process.env.DDN_PLAYWRIGHT_ROOT??resolve(root,'.work/tools/browser/node_modules/playwright');
const artifacts=process.env.DDN_BROWSER_REPORTS??resolve(root,'.work/reports/ddn-browser');
const {chromium}=await import(pathToFileURL(join(tool,'index.mjs')));
let browser,page;
const pageErrors=[];
before(async()=>{
  await mkdir(artifacts,{recursive:true});
  browser=await chromium.launch({headless:true});
  page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto(pathToFileURL(join(distribution,'ddn-visual-designer.html')).href);
  await page.waitForFunction(()=>typeof window.DDN?.createViewer==='function');
});
after(async()=>{await browser?.close();});

async function setup(text='erd Sales\n    Customer\n    Order\n    connect Customer to Order\n',edit=true){
  const result=await page.evaluate(async({text,edit})=>{
    if(window.fixture){window.fixture.designer?.destroy();window.fixture.viewer.destroy();window.fixture.runtime.destroy();window.fixture.element.remove();}
    const element=document.createElement('div');element.id='ddn-browser-fixture';element.style.cssText='position:fixed;inset:0;background:white;z-index:10000;overflow:auto;padding:12px';document.body.append(element);
    const runtime=DDN.createRuntime(DDN.createNativeRuntimeOptions());
    const viewer=DDN.createViewer(element,{runtime});
    const opened=await viewer.open({entry:'main.ddn',files:[{id:'main.ddn',text,revision:'r1',encoding:'utf-8',writable:true}]});
    const authority={authorize:async action=>({allowed:true,principal:'browser-tester',grants:[action,'model.edit','lifecycle.review','lifecycle.accept','lifecycle.reopen']})};
    const designer=edit?DDN.createDesigner(viewer,{authority}):undefined;
    window.fixture={element,runtime,viewer,designer,handle:DDN.getViewerHandle(viewer),authority};
    return {loaded:!!opened.snapshot,diagnostics:opened.diagnostics};
  },{text,edit});
  assert.equal(result.loaded,true,JSON.stringify(result.diagnostics));
  return page.locator('#ddn-browser-fixture');
}
async function select(name){
  await page.evaluate(name=>{
    const {handle}=window.fixture;
    const entry=handle.scene().entries.find(e=>e.definition.record.name===name);
    if(!entry)throw new Error('Missing item '+name);
    handle.select(entry.definition.ref,entry.item.occurrence);
  },name);
}
async function applyDialog(fixture){
  const dialog=fixture.getByRole('dialog');
  const action=dialog.getByRole('button',{name:'Apply',exact:true}); await (await action.count()?action:dialog.getByRole('button',{name:'Close',exact:true})).click();
  await dialog.waitFor({state:'detached',timeout:5000});
  await page.evaluate(()=>window.fixture.handle.whenRendered());
}

test('viewer displays connections, has no editor, and navigation/preview leave source unchanged',async()=>{
  const fixture=await setup(undefined,false);
  assert.equal(await fixture.locator('[data-ddn-designer]').count(),0);
  const initial=await page.evaluate(()=>window.fixture.runtime.sources().files[0].text);
  const counts=await page.evaluate(()=>{
    const scene=window.fixture.handle.scene();
    return {views:scene.views.length,relations:scene.entries.filter(e=>e.definition.record.category==='relation').length};
  });
  assert.equal(counts.views,1);assert.equal(counts.relations,1);
  await fixture.getByRole('button',{name:'Expand view',exact:true}).click();
  await fixture.getByRole('button',{name:'Shrink to workarea',exact:true}).click();
  await fixture.getByRole('button',{name:'+',exact:true}).click();
  const result=await page.evaluate(async()=>{
    const {viewer,handle,runtime}=window.fixture;
    viewer.setPreview({'text.color':'#aa1100'});await handle.whenRendered();
    const capture=await viewer.capture({scope:{kind:'workarea'},format:'svg',extent:'content',includePreview:true,partial:'label',stale:'reject'});
    let blocked=false;try{viewer.setPreview({'design.state':'accepted'});}catch{blocked=true;}
    return {source:runtime.sources().files[0].text,blocked,ok:capture.ok,svg:capture.ok?await capture.artifacts[0].blob.text():''};
  });
  assert.equal(result.source,initial);assert.equal(result.blocked,true);assert.equal(result.ok,true);assert.match(result.svg,/<svg/);assert.match(result.svg,/#aa1100/);
});

test('designer supports free draft, explicit columns conversion, details, title, undo, and save',async()=>{
  const fixture=await setup();await select('Customer');
  await moreAction(fixture,'Draft text');
  await fixture.getByRole('textbox',{name:'Free-form text'}).fill('identifier\nfull name\nnotes');await applyDialog(fixture);
  assert.equal(await page.evaluate(()=>window.fixture.designer.isDirty()),true);
  await moreAction(fixture,'Columns');await applyDialog(fixture);
  const converted=await page.evaluate(()=>window.fixture.handle.selectedEntry().definition.record);
  assert.equal(converted.draft.text,'identifier\nfull name\nnotes');
  assert.deepEqual(converted.data.rows.map(row=>row[0]),['identifier','full name','notes']);
  await moreAction(fixture,'Details shown');
  await fixture.getByRole('dialog').locator('input[data-column="domain"]').check();
  await fixture.getByRole('dialog').locator('input[data-column="key"]').check();await applyDialog(fixture);
  await fixture.getByRole('button',{name:'Rename',exact:true}).click();
  await inlineName(fixture,'Customer records');
  assert.equal(await page.evaluate(()=>window.fixture.handle.selectedEntry().definition.record.title),'Customer records');
  await fixture.getByRole('button',{name:'Undo',exact:true}).click();
  await page.waitForFunction(()=>window.fixture.handle.selectedEntry()?.definition.record.title!=='Customer records');
  await fixture.getByRole('button',{name:'Redo',exact:true}).click();
  await page.waitForFunction(()=>window.fixture.handle.selectedEntry()?.definition.record.title==='Customer records');
  const saved=await page.evaluate(async()=>{const files=await window.fixture.designer.save();return {count:files.length,text:await files[0].blob.text(),dirty:window.fixture.designer.isDirty()};});
  assert.equal(saved.count,1);assert.match(saved.text,/Customer records/);assert.equal(saved.dirty,true);
  await page.screenshot({path:join(artifacts,'progressive-erd.png'),fullPage:true});
});

test('supplied live updates display passively and malformed updates retain a labeled last valid scene',async()=>{
  const fixture=await setup(undefined,false);
  const result=await page.evaluate(async()=>{
    const {runtime,handle}=window.fixture;
    const file=runtime.sources().files[0];
    await runtime.ingest({base:runtime.snapshot().revision,origin:'test-local-provider',sources:[{...file,text:'erd Sales\n    Updated\n',revision:'external2'}]});
    await handle.whenRendered();
    const updated=handle.scene().entries.some(e=>e.definition.record.name==='Updated');
    const next=runtime.sources().files[0];
    await runtime.ingest({base:runtime.snapshot().revision,origin:'test-local-provider',sources:[{...next,text:'erd "unterminated\n',revision:'external3'}]});
    await handle.whenRendered();
    const captured=await window.fixture.viewer.capture({scope:{kind:'workarea'},format:'svg',extent:'content',includePreview:false,partial:'label',stale:'reject'});
    return {updated,lastValid:handle.scene().entries.some(e=>e.definition.record.name==='Updated'),capture:captured};
  });
  assert.equal(result.updated,true);assert.equal(result.lastValid,true);assert.equal(result.capture.ok,false);assert.equal(result.capture.reason,'stale');
  assert.match(await fixture.locator('.ddn-viewer-status').innerText(),/last valid|invalid/i);
});

test('untrusted content stays text and separate instances survive another instance disposal',async()=>{
  const fixture=await setup('erd Safe\n    Customer\n        draft fields\n            <img src=x onerror="window.DDN_XSS=1">\n            <script>window.DDN_XSS=2</script>\n',false);
  assert.equal(await fixture.locator('img,script').count(),0);
  const result=await page.evaluate(async()=>{
    const element=document.createElement('div');document.body.append(element);
    const runtime=DDN.createRuntime(DDN.createNativeRuntimeOptions());const viewer=DDN.createViewer(element,{runtime});
    await viewer.open({entry:'second.ddn',files:[{id:'second.ddn',text:'erd Second\n    Different\n',revision:'s1',encoding:'utf-8',writable:true}]});
    window.fixture.viewer.destroy();
    const handle=DDN.getViewerHandle(viewer);await viewer.navigate({kind:'fit-workarea'});
    const alive=handle.scene().entries.some(e=>e.definition.record.name==='Different');
    const source=runtime.sources().files[0].text;viewer.destroy();runtime.destroy();element.remove();
    return {alive,source,xss:window.DDN_XSS??null};
  });
  assert.equal(result.alive,true);assert.match(result.source,/Different/);assert.equal(result.xss,null);assert.deepEqual(pageErrors,[]);
});

test('native record table renders its dataset, editable headings, and complete CSV values',async()=>{
  const text='data Report\n    id.description\n    1."A long description that remains complete in CSV output"\n    2.Short\nview Records as table.records@1\n    with\n        projection.options\n            records Report\n            columns\n                item\n                    id id\n                    label Identifier\n                item\n                    id description\n                    label Description\n            missing gap\n';
  const fixture=await setup(text);await select('Records');
  assert.ok(await fixture.locator('svg text').filter({hasText:'Identifier'}).count());
  assert.ok(await fixture.locator('svg text').filter({hasText:'Short'}).count());
  await allProperties(fixture);
  await fixture.getByText('Advanced property',{exact:true}).click();
  await fixture.getByRole('textbox',{name:'Property path'}).fill('projection.options.columns');
  await fixture.getByRole('textbox',{name:'Value (text, number, boolean, or structured JSON)'}).fill(JSON.stringify([{id:'id',label:'Record'},{id:'description',label:'Narrative',max_lines:1,min_chars:1}]));
  await applyDialog(fixture);
  assert.ok(await fixture.locator('svg text').filter({hasText:'Narrative'}).count());
  const output=await page.evaluate(async()=>{
    const {viewer,handle}=window.fixture;const target=handle.scene().views[0].ref;
    const capture=await viewer.capture({scope:{kind:'view',target},format:'csv',extent:'content',includePreview:false,partial:'label',stale:'reject'});
    return {ok:capture.ok,text:capture.ok?await capture.artifacts[0].blob.text():JSON.stringify(capture)};
  });
  assert.equal(output.ok,true,output.text);assert.match(output.text,/A long description that remains complete in CSV output/);assert.match(output.text,/Narrative/);
  await page.screenshot({path:join(artifacts,'record-table.png'),fullPage:true});
});

test('drag cancellation is clean, movement commits once, and connections have an explicit meaning',async()=>{
  const fixture=await setup('erd Sales\n    Customer\n    Order\n');
  const entity=fixture.locator('.ddn-viewer-stage [data-ref][aria-label="Customer"]');
  let bounds=await entity.boundingBox();assert.ok(bounds);
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2+40,bounds.y+bounds.height/2+30,{steps:4});await page.keyboard.press('Escape');await page.mouse.up();
  assert.equal(await page.evaluate(()=>window.fixture.designer.isDirty()),false);
  bounds=await entity.boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2+40,bounds.y+bounds.height/2+30,{steps:4});await page.mouse.up();
  await page.waitForFunction(()=>window.fixture.runtime.sources().files[0].text.includes('position'));
  assert.equal(await page.evaluate(()=>window.fixture.designer.isDirty()),true);
  await select('Customer');await fixture.getByRole('button',{name:'Connect',exact:true}).click();await fixture.locator('.ddn-viewer-stage [data-ref][aria-label="Order"]').click();
  await fixture.getByRole('textbox',{name:'Label on the line (optional)'}).fill('places');const dialog=fixture.getByRole('dialog',{name:'Connect',exact:true});await dialog.getByRole('button',{name:'Connect',exact:true}).click();await dialog.waitFor({state:'detached'});await page.evaluate(()=>window.fixture.handle.whenRendered());
  assert.equal(await page.evaluate(()=>window.fixture.handle.scene().entries.find(entry=>entry.definition.record.category==='relation').definition.record.title),'places');
});

test('dragging a manual pin preserves model coordinates below reserved view chrome',async()=>{
 const fixture=await setup(`element A as object
element B as object
view Board as ddn@1
    with
        layout.algorithm manual
    use A named First
        with
            position.x 0
            position.y 0
    use B named Second
        with
            position.x 500
            position.y 0`);
 const bounds=await fixture.locator('.ddn-viewer-stage [data-ref][aria-label="A"]').boundingBox();assert.ok(bounds);
 const point={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2},delta=await page.evaluate(({x,y})=>{const h=window.fixture.handle,a=h.toWorld(x,y),b=h.toWorld(x+40,y+30);return{x:b.x-a.x,y:b.y-a.y};},point);
 await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+40,point.y+30,{steps:4});await page.mouse.up();await page.waitForFunction(()=>window.fixture.designer.isDirty());await page.evaluate(()=>window.fixture.handle.whenRendered());
 const position=await page.evaluate(()=>window.fixture.handle.scene().entries.find(e=>e.appearance?.record.name==='First').appearance.record.position);
 assert.ok(Math.abs(position.x-delta.x)<.1);assert.ok(Math.abs(position.y-delta.y)<.1,JSON.stringify({position,delta}));
});
