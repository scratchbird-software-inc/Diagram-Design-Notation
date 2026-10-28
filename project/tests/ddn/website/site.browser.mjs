import test,{before,after}from'node:test';
import assert from'node:assert/strict';
import{readFileSync,mkdirSync}from'node:fs';
import{join}from'node:path';
import{fileURLToPath,pathToFileURL}from'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),site=join(root,'website'),reports=join(root,'.work/reports/ddn-website/browser');
const{chromium}=await import(pathToFileURL(join(root,'.work/tools/browser/node_modules/playwright/index.mjs')));
let browser,context,page;const network=[],errors=[];
before(async()=>{mkdirSync(reports,{recursive:true});browser=await chromium.launch({headless:true});context=await browser.newContext({viewport:{width:1600,height:1000}});await context.route(/^https?:\/\//,r=>{network.push(r.request().url());return r.abort();});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());});
after(async()=>{await context?.close();await browser?.close();});
const tool=(mode,entry='examples/basics/62-distribution-charts.ddn',view='histogram')=>pathToFileURL(join(site,'tools/index.html')).href+'?'+new URLSearchParams({mode,example:entry,view});
async function open(url){await page.goto(url);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');}
test('home and gallery render locally with working search and source/tool links',async()=>{
 await page.goto(pathToFileURL(join(site,'index.html')).href);await page.locator('iframe').scrollIntoViewIfNeeded();const embedded=page.frameLocator('iframe');await embedded.locator('html[data-ready="true"]').waitFor();assert.ok(await embedded.locator('svg').count());await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(reports,'home.png'),fullPage:true});assert.ok(await page.getByRole('link',{name:/Gallery/i}).count());
 await page.goto(pathToFileURL(join(site,'gallery/index.html')).href);await page.waitForFunction(()=>document.querySelectorAll('figure').length===36);await page.screenshot({path:join(reports,'gallery.png')});const sources=await page.locator('a[href$=".ddn"]').count();assert.equal(sources,36);assert.equal(await page.locator('#profile-total').textContent(),'151');await page.locator('#gallery-search').fill('uml.sequence@2');assert.equal(await page.locator('figure').count(),1);assert.match(await page.locator('figure').textContent(),/uml.sequence@2/);
});
test('viewer is read-only and deep links select the requested actual example view',async()=>{
 await open(tool('view'));assert.equal(await page.getByRole('textbox',{name:'DDN source',exact:true}).getAttribute('readonly'),'');const selected=await page.getByLabel('Current view',{exact:true}).inputValue();assert.equal(JSON.parse(selected).id,'histogram');assert.equal(await page.evaluate(()=>!!DDN_SITE_STATE.designer),false);assert.ok(await page.locator('svg').count());await page.screenshot({path:join(reports,'viewer-histogram.png')});
 await page.getByLabel('Current view',{exact:true}).selectOption({label:'Response times by service / box plot'});assert.equal(JSON.parse(await page.getByLabel('Current view',{exact:true}).inputValue()).id,'boxplot');
});
test('designer applies source changes through the new command service and exports the selected view',async()=>{
 await open(tool('design'));const source=page.getByRole('textbox',{name:'DDN source',exact:true});assert.equal(await source.getAttribute('readonly'),null);assert.equal(await page.evaluate(()=>!!DDN_SITE_STATE.designer),true);await source.fill((await source.inputValue()).replaceAll('Response times / histogram','Reviewed response times'));await page.getByRole('button',{name:'Apply source',exact:true}).click();await page.waitForFunction(()=>DDN.getViewerHandle(DDN_SITE_STATE.viewer).runtime.snapshot().normalized.files[0].document.views.some(v=>v.id==='histogram'&&v.title==='Reviewed response times'));const download=page.waitForEvent('download');await page.getByRole('menubar').getByRole('menuitem',{name:'File',exact:true}).click();await page.getByRole('menuitem',{name:'Export SVG',exact:true}).click();assert.equal((await download).suggestedFilename(),'diagram.svg');await page.screenshot({path:join(reports,'designer.png')});
});
test('verifier checks the converted source and exposes real diagnostics for an invalid edit',async()=>{
 await open(tool('verify'));assert.match(await page.locator('.app-report').innerText(),/^valid/);const source=page.getByRole('textbox',{name:'DDN source',exact:true});await source.fill('view Broken as does.not.exist@1\n');await page.getByRole('button',{name:'Verify',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.app-report')?.textContent.includes('invalid'));await page.screenshot({path:join(reports,'verifier.png')});
});
test('tools require no network and reject unknown example paths',async()=>{
 await page.goto(tool('view','../../outside.ddn'));await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent.includes('Unknown example'));assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
});
test('paper comparison links open live examples and colour controls edit the displayed occurrence',async()=>{
 await page.goto(pathToFileURL(join(site,'features/paper.html')).href);
 assert.equal(await page.locator('img[src^="../gallery/paper/"]').count(),4);
 await page.locator('iframe').scrollIntoViewIfNeeded();const embedded=page.frameLocator('iframe');await embedded.locator('html[data-ready="true"]').waitFor();
 assert.ok(await embedded.locator('svg filter').count()>0);
 await page.screenshot({path:join(reports,'paper-feature.png'),fullPage:true});
 await open(tool('design','examples/appearance/paper.ddn','Board'));
 await page.evaluate(()=>{const handle=DDN.getViewerHandle(DDN_SITE_STATE.viewer),entry=handle.scene().entries.find(e=>e.definition.record.name==='BoardIdea');handle.select(entry.definition.ref,entry.item.occurrence);});
 await page.getByRole('button',{name:'Paper & attachments',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Paper & attachments'});await dialog.getByLabel('Paper colour picker',{exact:true}).fill('#c9e6f8');
 assert.equal(await dialog.getByLabel('Paper colour',{exact:true}).inputValue(),'#c9e6f8');
 await page.screenshot({path:join(reports,'paper-designer-colours.png')});
 await page.waitForFunction(()=>DDN.getViewerHandle(DDN_SITE_STATE.viewer).scene().entries.some(e=>e.definition.record.name==='BoardIdea'&&e.effective.background.color==='#c9e6f8'));
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.waitFor({state:'detached'});
 assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
});
test('appearance review opens themed tools with local font resources and compact dialogs',async()=>{
 await page.goto(pathToFileURL(join(site,'features/appearance.html')).href);await page.getByRole('link',{name:'Dark designer',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 assert.equal(await page.locator('body').getAttribute('data-ddn-ui-theme'),'dark');assert.equal(JSON.parse(await page.getByLabel('Current view',{exact:true}).inputValue()).id,'Textures');
 const fonts=await page.evaluate(()=>[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family));assert.ok(fonts.includes('Inter'));assert.ok(fonts.includes('Caveat'));
 await page.evaluate(()=>{const handle=DDN.getViewerHandle(DDN_SITE_STATE.viewer),entry=handle.scene().entries.find(e=>e.definition.record.name==='PaperCard');handle.select(entry.definition.ref,entry.item.occurrence);});
 await page.getByRole('button',{name:'Appearance & presets',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Appearance & presets'});await dialog.getByRole('group',{name:'Texture',exact:true}).waitFor();assert.equal((await dialog.boundingBox()).width,480);await page.screenshot({path:join(reports,'appearance-dark-dialog.png')});
 await dialog.getByRole('tab',{name:'Font',exact:true}).click();assert.equal(await dialog.getByRole('group',{name:'Font family',exact:true}).locator('[aria-pressed="true"]').getAttribute('data-choice-value'),'Inter');await page.screenshot({path:join(reports,'appearance-font-dialog.png')});await dialog.getByRole('button',{name:'Close',exact:true}).click();assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
});
