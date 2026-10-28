import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),reports=join(root,'.work/reports/ddn-dialogs');
const {chromium}=await import(pathToFileURL(join(process.env.DDN_PLAYWRIGHT_ROOT??join(root,'.work/tools/browser/node_modules/playwright'),'index.mjs')));
let browser,context,page;const errors=[],network=[];
const source=`workarea Studio as ddn
    with
        background.color "#f2e9dc"
        background.texture
            kind dots
            scale 24
element Idea as note
    with
        content.text "A local design note"
        background.color "#f9e8c4"
        background.texture
            kind paper
            seed 17
        style.font Inter
view Board as ddn@1
    use Idea named Here
`;
before(async()=>{await mkdir(reports,{recursive:true});browser=await chromium.launch({headless:true});context=await browser.newContext({viewport:{width:1280,height:850}});await context.route(/^https?:\/\//,route=>{network.push(route.request().url());return route.abort();});page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(pathToFileURL(join(process.env.DDN_DDN_DISTRIBUTION??join(root,'.work/builds/ddn-distribution'),'complete/ddn-visual-designer.html')).href);await page.waitForFunction(()=>!!window.DDN);});
after(async()=>{await context?.close();await browser?.close();});
async function setup(){
 await page.evaluate(async text=>{if(window.appearanceFixture){const f=window.appearanceFixture;f.designer.destroy();f.viewer.destroy();f.runtime.destroy();f.container.remove();}localStorage.removeItem('ddn.appearance-presets.v1');const container=document.createElement('main');container.id='appearance-fixture';container.style.cssText='position:fixed;inset:0;background:white;z-index:100';document.body.append(container);const runtime=DDN.createRuntime(DDN.createCompleteRuntimeOptions()),viewer=DDN.createViewer(container,{runtime});const result=await viewer.open({entry:'main.ddn',files:[{id:'main.ddn',text,revision:'1',encoding:'utf-8',writable:true}]});if(!result.snapshot)throw Error(JSON.stringify(result.diagnostics));const designer=DDN.createDesigner(viewer,{authority:{authorize:async action=>({allowed:true,principal:'reviewer',grants:[action]})}}),handle=DDN.getViewerHandle(viewer);await handle.whenRendered();const entry=handle.scene().entries.find(e=>e.definition.record.name==='Idea');handle.select(entry.definition.ref,entry.item.occurrence);window.appearanceFixture={container,runtime,viewer,designer,handle};},source);
 return page.locator('#appearance-fixture');
}
async function open(){await page.locator('#appearance-fixture').getByRole('button',{name:'Appearance & presets',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Appearance & presets',exact:true});await dialog.getByRole('group',{name:'Texture',exact:true}).waitFor();return dialog;}
const text=()=>page.evaluate(()=>window.appearanceFixture.runtime.sources().files[0].text);
async function apply(dialog){await dialog.getByText('Changes update the diagram immediately.',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'detached'});await page.evaluate(()=>window.appearanceFixture.handle.whenRendered());}

test('compact live appearance applies null textures and Revert restores the source',async()=>{
 await setup();const dialog=await open(),before=await text();const bounds=await dialog.boundingBox();assert.equal(bounds.width,480);assert.ok(bounds.height<=640);
 await dialog.getByRole('slider',{name:'Texture opacity slider',exact:true}).press('Home');assert.equal(await dialog.getByLabel('Texture opacity',{exact:true}).inputValue(),'0');await page.waitForFunction(()=>appearanceFixture.runtime.sources().files[0].text.includes('opacity 0'));
 await dialog.getByRole('group',{name:'Texture',exact:true}).getByRole('button',{name:'none',exact:true}).click();await dialog.getByRole('tab',{name:'Font',exact:true}).click();await dialog.getByRole('tab',{name:'Background',exact:true}).click();assert.equal(await dialog.getByRole('group',{name:'Texture',exact:true}).locator('button[aria-pressed=true]').getAttribute('data-choice-value'),'none');assert.equal(await dialog.locator('.ddn-appearance-preview').evaluate(e=>getComputedStyle(e).backgroundImage),'none');
 await dialog.getByRole('button',{name:'Revert changes',exact:true}).click();await page.waitForFunction(before=>appearanceFixture.runtime.sources().files[0].text===before,before);assert.equal(await text(),before);
 await page.setViewportSize({width:360,height:640});const narrow=await open(),rect=await narrow.boundingBox(),footer=await narrow.locator('footer').boundingBox();assert.ok(rect.width<=348);assert.ok(footer.y+footer.height<=640);assert.equal(await narrow.evaluate(e=>e.scrollWidth<=e.clientWidth),true);await page.screenshot({path:join(reports,'mobile-appearance.png')});await narrow.getByRole('button',{name:'Close',exact:true}).click();await page.setViewportSize({width:1280,height:850});
});

test('appearance sample buttons and sliders update actual diagram, export offline, and undo once',async()=>{
 const fixture=await setup();const before=await text(),dialog=await open();
 await dialog.getByLabel('Background colour',{exact:true}).fill('#d6e9ef');await dialog.getByRole('group',{name:'Texture',exact:true}).getByRole('button',{name:'linen',exact:true}).click();await dialog.getByLabel('Texture scale',{exact:true}).fill('36');
 const scale=dialog.getByRole('slider',{name:'Texture scale slider',exact:true});assert.equal(await scale.inputValue(),'36');await scale.press('ArrowRight');assert.equal(await dialog.getByLabel('Texture scale',{exact:true}).inputValue(),'37');
 const preview=dialog.locator('.ddn-appearance-preview');assert.equal(await preview.evaluate(e=>getComputedStyle(e).backgroundSize),'37px 37px');const textureBefore=await preview.evaluate(e=>getComputedStyle(e).backgroundImage);
 const opacity=dialog.getByRole('slider',{name:'Texture opacity slider',exact:true});await opacity.press('End');await opacity.press('ArrowLeft');assert.equal(await dialog.getByLabel('Texture opacity',{exact:true}).inputValue(),'0.99');assert.notEqual(await preview.evaluate(e=>getComputedStyle(e).backgroundImage),textureBefore);
 assert.equal(await dialog.getByRole('slider',{name:'Texture seed slider',exact:true}).count(),1);await page.waitForFunction(()=>appearanceFixture.handle.scene().entries.some(e=>e.definition.record.name==='Idea'&&e.effective.background?.texture?.kind==='linen'));assert.notEqual(await text(),before);
 await dialog.getByRole('tab',{name:'Font',exact:true}).click();await dialog.getByRole('group',{name:'Font family',exact:true}).getByRole('button',{name:'Source Serif 4',exact:true}).click();await dialog.getByLabel('Font size (pt)',{exact:true}).fill('16');
 const size=dialog.getByRole('slider',{name:'Font size (pt) slider',exact:true});assert.equal(await size.inputValue(),'16');await size.press('ArrowUp');assert.equal(await dialog.getByLabel('Font size (pt)',{exact:true}).inputValue(),'16.5');assert.equal(await preview.evaluate(e=>getComputedStyle(e).fontSize),'22px');await apply(dialog);
 const result=await page.evaluate(async()=>{const f=window.appearanceFixture,entry=f.handle.scene().entries.find(e=>e.definition.record.name==='Idea'),request={scope:{kind:'workarea'},extent:'content',includePreview:false,partial:'reject',stale:'reject'},svg=await f.viewer.capture({...request,format:'svg'}),png=await f.viewer.capture({...request,format:'png'});return {values:entry.effective,svg:svg.ok?await svg.artifacts[0].blob.text():'',png:png.ok&&png.artifacts[0].blob.size,fonts:[...document.fonts].filter(font=>font.status==='loaded').map(font=>font.family),source:f.runtime.sources().files[0].text};});
 assert.equal(result.values.background.texture.kind,'linen');assert.equal(result.values.background.texture.scale,37);assert.equal(result.values.background.texture.opacity,.99);assert.equal(result.values.style.font,'Source Serif 4');assert.equal(result.values.style.font_size,22);assert.match(result.svg,/<pattern/);assert.match(result.svg,/@font-face/);assert.match(result.svg,/data:font\/woff2;base64,/);assert.ok(result.png>1000);assert.ok(result.fonts.includes('Inter'));assert.match(result.source,/Source Serif 4/);
 await fixture.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForFunction(before=>appearanceFixture.runtime.sources().files[0].text===before,before);
 assert.equal(await text(),before);assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
});

test('company packs remain read-only and a user copy retains complete appearance settings',async()=>{
 await setup();const before=await text(),dialog=await open();await dialog.getByRole('tab',{name:'Presets',exact:true}).click();
 const pack=await readFile(join(root,'website/examples/appearance/company-presets.json'));
 await dialog.getByLabel('Import user/company preset pack',{exact:true}).setInputFiles({name:'company.json',mimeType:'application/json',buffer:pack});
 await dialog.locator('button[data-choice-value=company-warm-note]').click();assert.equal(await dialog.getByRole('button',{name:'Delete user preset',exact:true}).isDisabled(),true);
 await dialog.getByText('Changes update the diagram immediately.',{exact:true}).waitFor();await dialog.getByLabel('New user preset name',{exact:true}).fill('My company variation');await dialog.getByRole('button',{name:'Save user preset',exact:true}).click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ddn.appearance-presets.v1')).presets),copy=saved.find(p=>p.scope==='user');assert.ok(copy,await dialog.innerText());assert.equal(copy.name,'My company variation');assert.equal(copy.properties['style.paper'],'note');assert.equal(copy.properties.shadow.kind,'centre');assert.equal(copy.properties.decorations[0].kind,'paper-clip');
 await apply(dialog);assert.notEqual(await text(),before);
 // Storage denial must retain explicit library actions across dialog openings.
 await page.evaluate(()=>{window.savedStorageMethods={getItem:Storage.prototype.getItem,setItem:Storage.prototype.setItem};Storage.prototype.getItem=Storage.prototype.setItem=function(){throw new DOMException('Storage disabled','SecurityError');};});
 try{
  let reopened=await open();await reopened.getByRole('tab',{name:'Presets',exact:true}).click();assert.ok((await reopened.getByRole('group',{name:'Appearance preset',exact:true}).getByRole('button').allTextContents()).some(text=>text.includes('My company variation')));
  await reopened.getByLabel('New user preset name',{exact:true}).fill('Session-only appearance');await reopened.getByRole('button',{name:'Save user preset',exact:true}).click();assert.match(await reopened.locator('.ddn-appearance-message[role=status]').innerText(),/session only/);await reopened.getByRole('button',{name:'Close',exact:true}).click();
  await page.evaluate(()=>{Storage.prototype.getItem=window.savedStorageMethods.getItem;});
  reopened=await open();await reopened.getByRole('tab',{name:'Presets',exact:true}).click();assert.ok((await reopened.getByRole('group',{name:'Appearance preset',exact:true}).getByRole('button').allTextContents()).some(text=>text.includes('Session-only appearance')));await reopened.getByRole('button',{name:'Close',exact:true}).click();
 }finally{await page.evaluate(()=>{Object.assign(Storage.prototype,window.savedStorageMethods);delete window.savedStorageMethods;});}
});

test('workarea backgrounds and local custom fonts use the same live editors',async()=>{
 await setup();let dialog=await open();await dialog.getByLabel('Apply appearance to',{exact:true}).selectOption({label:'Workarea background'});await dialog.getByRole('group',{name:'Texture',exact:true}).getByRole('button',{name:'grid',exact:true}).click();await apply(dialog);
 assert.equal(await page.evaluate(()=>appearanceFixture.runtime.snapshot().normalized.files[0].document.workarea.background.texture.kind),'grid');
 assert.ok(await page.locator('#appearance-fixture [data-ddn-background] pattern').count());
 dialog=await open();await dialog.getByRole('tab',{name:'Font',exact:true}).click();const bytes=await readFile(join(root,'project/ddn/assets/fonts/caveat/Caveat-Variable.woff2'));
 await dialog.getByLabel('Load local font',{exact:true}).setInputFiles({name:'WorkshopHand.woff2',mimeType:'font/woff2',buffer:bytes});await dialog.getByRole('group',{name:'Font family',exact:true}).getByRole('button',{name:'WorkshopHand',exact:true}).waitFor();await apply(dialog);
 assert.equal(await page.evaluate(()=>appearanceFixture.handle.scene().entries.find(e=>e.definition.record.name==='Idea').effective.style.font),'WorkshopHand');
});

test('detached appearance controls update the main diagram and flush before changing scope',async()=>{
 const fixture=await setup(),before=await text(),dialog=await open();
 const popupPromise=context.waitForEvent('page');await dialog.getByRole('button',{name:'Pop out Appearance & presets',exact:true}).click();const popup=await popupPromise;
 const detached=popup.getByRole('dialog',{name:'Appearance & presets',exact:true});
 assert.equal(await detached.getByRole('button',{name:'Apply',exact:true}).count(),0);
 await detached.getByRole('tab',{name:'Font',exact:true}).click();
 await detached.getByRole('tab',{name:'Font',exact:true}).press('ArrowLeft');await detached.getByRole('group',{name:'Texture',exact:true}).waitFor();await detached.getByRole('tab',{name:'Background',exact:true}).press('ArrowRight');
 const serif=detached.getByRole('group',{name:'Font family',exact:true}).getByRole('button',{name:'serif',exact:true});await serif.click();await serif.press('ArrowRight');
 await detached.getByLabel('Font size (pt)',{exact:true}).fill('18.5');
 await page.waitForFunction(()=>appearanceFixture.handle.scene().entries.some(e=>e.definition.record.name==='Idea'&&e.effective.style?.font==='mono'&&e.effective.style?.font_size===18.5*4/3));
 await detached.getByLabel('Apply appearance to',{exact:true}).selectOption({label:'View background and text'});
 await detached.getByLabel('Font size (pt)',{exact:true}).fill('21');
 await page.waitForFunction(()=>appearanceFixture.handle.scene().entries.some(e=>e.definition.owner==='view'&&e.effective.style?.font_size===28));
 await detached.getByLabel('Apply appearance to',{exact:true}).selectOption({label:'Workarea background'});
 await detached.getByRole('group',{name:'Texture',exact:true}).getByRole('button',{name:'grid',exact:true}).click();
 await page.waitForFunction(()=>appearanceFixture.runtime.snapshot().normalized.files[0].document.workarea.background.texture.kind==='grid');
 await detached.getByText('Changes update the diagram immediately.',{exact:true}).waitFor();
 const closed=popup.waitForEvent('close');
 // A native Close handler may destroy its window before Chromium acknowledges
 // the click. Accept only that expected popup closure; keep all state/undo checks.
 try {await detached.getByRole('button',{name:'Close',exact:true}).click();}
 catch(error){if(!popup.isClosed() || !/has been closed/.test(error.message))throw error;}
 await closed;
 await fixture.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForFunction(before=>appearanceFixture.runtime.sources().files[0].text===before,before);
 assert.deepEqual(errors,[]);
});

test('light, dark and warm interface looks do not alter document source',async()=>{
 await setup();const before=await text();
 for(const theme of ['light','dark','warm']){
  await page.getByLabel('Interface theme',{exact:true}).selectOption(theme);const dialog=await open();assert.equal(await page.locator('body').getAttribute('data-ddn-ui-theme'),theme);await page.screenshot({path:join(reports,theme+'-appearance.png')});await dialog.getByRole('button',{name:'Close',exact:true}).click();assert.equal(await text(),before);
 }
 await page.evaluate(()=>{const f=appearanceFixture;f.designer.destroy();f.viewer.destroy();f.runtime.destroy();f.container.remove();delete window.appearanceFixture;});
 await page.getByRole('button',{name:'UI colours',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Interface colours'});const beforeAccent=await dialog.getByLabel('Accent',{exact:true}).inputValue();await dialog.getByLabel('Accent',{exact:true}).fill('not-a-colour');await dialog.getByRole('alert').waitFor();await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'UI colours',exact:true}).click();dialog=page.getByRole('dialog',{name:'Interface colours'});assert.equal(await dialog.getByLabel('Accent',{exact:true}).inputValue(),beforeAccent);await dialog.getByRole('button',{name:'Close',exact:true}).click();assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
});
