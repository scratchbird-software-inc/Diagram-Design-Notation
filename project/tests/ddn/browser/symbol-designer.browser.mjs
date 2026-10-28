import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const distribution=process.env.DDN_DDN_DISTRIBUTION??resolve(root,'.work/builds/ddn-distribution');
const tool=process.env.DDN_PLAYWRIGHT_ROOT??resolve(root,'.work/tools/browser/node_modules/playwright');
const {chromium}=await import(pathToFileURL(join(tool,'index.mjs')));
let browser,page;const errors=[];
const source=`// Keep this user comment.
asset Icon as resource from "icon.svg"
    with
        media_type "image/svg+xml"
        intrinsic_size
            width 100
            height 60
asset Data as resource from "data.csv"
    with
        media_type "text/csv"
element Device as object
    with
        title "Workstation"
        symbol.label bottom
view Board as ddn@1
    use Device named Here
view Other as ddn@1
    use Device named There
`;
before(async()=>{browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1500,height:1000}});page.on('pageerror',error=>errors.push(error.message));await page.goto(pathToFileURL(join(distribution,'ddn-visual-designer.html')).href);await page.waitForFunction(()=>!!window.DDN?.createDesigner);});
after(async()=>{await browser?.close();});
async function setup(editing=true,allowed=true){
 const result=await page.evaluate(async({text,editing,allowed})=>{
  if(window.symbolFixture){const f=window.symbolFixture;f.designer?.destroy();f.viewer.destroy();f.runtime.destroy();f.container.remove();}
  const container=document.createElement('main');container.id='symbol-fixture';container.style.cssText='position:fixed;inset:0;background:white;z-index:1000;padding:10px';document.body.append(container);
  const runtime=DDN.createRuntime(DDN.createNativeRuntimeOptions()),viewer=DDN.createViewer(container,{runtime});
  const opened=await viewer.open({entry:'main.ddn',files:[{id:'main.ddn',text,revision:'one',encoding:'utf-8',writable:true}]});
  const designer=editing?DDN.createDesigner(viewer,{authority:{authorize:async action=>({allowed,principal:'symbol-reviewer',grants:allowed?[action]:[]})}}):undefined;
  const handle=DDN.getViewerHandle(viewer);window.symbolFixture={container,runtime,viewer,designer,handle};
  const entry=handle.scene().entries.find(e=>e.definition.record.name==='Device'&&e.view.record.name==='Board');handle.select(entry.definition.ref,entry.item.occurrence);
  return {loaded:!!opened.snapshot,diagnostics:opened.diagnostics};
 },{text:source,editing,allowed});
 assert.equal(result.loaded,true,JSON.stringify(result.diagnostics));return page.locator('#symbol-fixture');
}
const fileText=()=>page.evaluate(()=>window.symbolFixture.runtime.sources().files[0].text);
const documentValue=()=>page.evaluate(()=>window.symbolFixture.runtime.snapshot().normalized.files[0].document);
async function open(fixture){await fixture.getByRole('button',{name:'Symbol & label',exact:true}).click();const dialog=fixture.getByRole('dialog',{name:'Symbol & label'});await dialog.getByRole('group',{name:'Presentation',exact:true}).waitFor();return dialog;}
async function apply(dialog){await dialog.getByText('Changes update the diagram immediately.',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'detached'});await page.evaluate(()=>window.symbolFixture.handle.whenRendered());}

test('symbol editor floats, filters assets and leaves untouched settings unauthored',async()=>{
 const fixture=await setup(),before=await fileText(),dialog=await open(fixture);
 assert.notEqual(await dialog.getAttribute('aria-modal'),'true');
 assert.equal(await dialog.getByRole('group',{name:'Name position',exact:true}).locator('button[aria-pressed=true]').getAttribute('data-choice-value'),'bottom');
 assert.equal(await dialog.getByRole('group',{name:'Image asset',exact:true}).getByRole('button').count(),3);
 assert.equal(await dialog.getByRole('group',{name:'Name position',exact:true}).getByRole('button').count(),11);
 assert.equal(await dialog.locator('input[type=range]').count(),1);
 await apply(dialog);assert.equal(await fileText(),before);assert.equal(await page.evaluate(()=>window.symbolFixture.designer.isDirty()),false);
 const readonly=await setup(false);assert.equal(await readonly.getByRole('button',{name:'Symbol & label',exact:true}).count(),0);
});
test('symbol controls save one authorized occurrence transaction and support undo/redo',async()=>{
 const fixture=await setup(),before=await fileText(),dialog=await open(fixture);
 await dialog.getByRole('group',{name:'Presentation',exact:true}).getByRole('button',{name:'Image symbol',exact:true}).click();
 await dialog.getByRole('group',{name:'Image asset',exact:true}).getByRole('button',{name:'Icon · main.ddn',exact:true}).click();
 await dialog.getByRole('group',{name:'Name position',exact:true}).getByRole('button',{name:'top right',exact:true}).click();
 await dialog.getByLabel('Label gap',{exact:true}).fill('12.5');
 await apply(dialog);
 const doc=await documentValue(),here=doc.appearances.find(a=>a.name==='Here'),there=doc.appearances.find(a=>a.name==='There');
 assert.equal(here.symbol.mode,'image');assert.equal(here.symbol.image.file,'main.ddn');assert.equal(here.symbol.image.id,doc.assets.find(a=>a.name==='Icon').id);assert.equal(here.symbol.label,'top-right');assert.equal(here.symbol.label_gap,12.5);assert.equal(there.symbol,undefined);
 assert.deepEqual(doc.definitions.find(d=>d.name==='Device').symbol,{label:'bottom'});
 const after=await fileText();assert.match(after,/^\/\/ Keep this user comment\./);
 await fixture.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForFunction(text=>window.symbolFixture.runtime.sources().files[0].text===text,before);
 await fixture.getByRole('button',{name:'Redo',exact:true}).click();await page.waitForFunction(text=>window.symbolFixture.runtime.sources().files[0].text===text,after);
});
test('shared scope, inheritance and invalid values preserve source transactions',async()=>{
 const fixture=await setup();let dialog=await open(fixture);
 await dialog.getByLabel('Apply symbol settings to').selectOption('1');await page.waitForTimeout(20);
 await dialog.getByRole('group',{name:'Presentation',exact:true}).getByRole('button',{name:'Unboxed text',exact:true}).click();await dialog.getByRole('group',{name:'Name position',exact:true}).getByRole('button',{name:'Hidden',exact:true}).click();await apply(dialog);
 let doc=await documentValue();assert.deepEqual(doc.definitions.find(d=>d.name==='Device').symbol,{label:'none',mode:'text'});
 dialog=await open(fixture);await dialog.getByLabel('Apply symbol settings to').selectOption('1');await page.waitForTimeout(20);
 await dialog.getByRole('button',{name:'Inherit name position',exact:true}).click();await apply(dialog);
 doc=await documentValue();assert.equal(doc.definitions.find(d=>d.name==='Device').symbol.label,undefined);assert.equal(doc.definitions.find(d=>d.name==='Device').symbol.mode,'text');
 const before=await fileText();dialog=await open(fixture);await dialog.getByLabel('Label gap',{exact:true}).fill('-1');await dialog.getByRole('alert').waitFor();assert.equal(await fileText(),before);await dialog.getByRole('button',{name:'Close',exact:true}).click();
});
test('automatic imagery and explicit no-image remain distinct editable values',async()=>{
 const fixture=await setup();let dialog=await open(fixture);
 assert.equal(await dialog.getByRole('group',{name:'Image asset',exact:true}).locator('button[aria-pressed=true]').getAttribute('data-choice-value'),'inherit');
 await dialog.getByRole('group',{name:'Image asset',exact:true}).getByRole('button',{name:'None (disable inherited image)',exact:true}).click();await apply(dialog);
 let doc=await documentValue();assert.equal(doc.appearances.find(a=>a.name==='Here').symbol.image,null);
 dialog=await open(fixture);assert.equal(await dialog.getByRole('group',{name:'Image asset',exact:true}).locator('button[aria-pressed=true]').getAttribute('data-choice-value'),'');
 await dialog.getByRole('group',{name:'Image asset',exact:true}).getByRole('button',{name:'Automatic / inherited image',exact:true}).click();await apply(dialog);
 doc=await documentValue();assert.equal(doc.appearances.find(a=>a.name==='Here').symbol?.image,undefined);
});
test('denied editing cannot alter symbol settings',async()=>{
 const fixture=await setup(true,false),before=await fileText(),dialog=await open(fixture);await dialog.getByRole('group',{name:'Name position',exact:true}).getByRole('button',{name:'Hidden',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.equal(await fileText(),before);assert.equal(errors.length,0,errors.join('\n'));
});
