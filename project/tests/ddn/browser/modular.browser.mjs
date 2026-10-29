import {chooseViewLayout, selectDiagramProfile, paletteElement} from './ux-test-helpers.mjs';
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,cp,rename} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,join,relative,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {allFixtureProfiles,profileSource} from '../profiles/fixtures.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const distribution=process.env.DDN_DDN_DISTRIBUTION??resolve(root,'.work/builds/ddn-distribution');
const build=process.env.DDN_BUILD_ROOT??resolve(root,'.work/builds/ddn');
const reports=resolve(root,'.work/reports/ddn-modular-browser');
const manifest=JSON.parse(await readFile(join(distribution,'modular/manifest.json'),'utf8'));
const originalModules=ids=>[...new Set(ids.flatMap(id=>(manifest.sourceModules[id]??[]).map(input=>input.id)))];
const tool=process.env.DDN_PLAYWRIGHT_ROOT??resolve(root,'.work/tools/browser/node_modules/playwright');
const {chromium}=await import(pathToFileURL(join(tool,'index.mjs')));
// Source generation is test-side only. It must not preload browser capabilities.
await import(pathToFileURL(join(build,'ddn/packages/profiles/src/generated.js')));
const language=await import(pathToFileURL(join(build,'ddn/packages/language/src/index.js')));
const sourceSet=text=>({entry:'main.ddn',files:[{id:'main.ddn',text,revision:'1',encoding:'utf-8',writable:true}]});
let browser;
before(async()=>{await mkdir(reports,{recursive:true});browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();});
async function open(mode,{base=distribution,http,trackNetwork=true}={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const network=[],errors=[],requests=[];
 await context.route(/^https?:\/\//,route=>{const url=new URL(route.request().url());if(http&&url.origin===http)return route.continue();if(trackNetwork)network.push(url.href);return route.abort();});
 await context.addInitScript(()=>{
  const urls=new Map(),create=URL.createObjectURL.bind(URL),NativeWorker=Worker;
  window.__modularWorkerSources=[];
  URL.createObjectURL=blob=>{const url=create(blob);urls.set(url,blob);return url;};
  window.Worker=class extends NativeWorker{constructor(url,options){super(url,options);const blob=urls.get(String(url));if(blob)window.__modularWorkerSources.push(blob.text());}};
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
 await page.goto(http?`${http}/modular/${mode}.html`:pathToFileURL(join(base,'modular',`${mode}.html`)).href);
 await page.waitForFunction(()=>!!window.DDN&&!!window.DDN_MODULES&&!!window.DDN_LOADER);
 await page.locator('.app-status').filter({hasText:mode==='verifier'?/^Verification /:/ready/}).waitFor();
 return {context,page,network,errors,requests};
}
async function moduleEvidence(page){const state=await page.evaluate(()=>({registry:DDN_MODULES.describe(),loader:DDN_LOADER.describe()}));state.registry.modules=originalModules(state.registry.modules);return state;}
async function workerEvidence(page){
 const workers=await page.evaluate(async()=>Promise.all(window.__modularWorkerSources).then(sources=>sources.map(source=>({bytes:source.length,modules:[...source.matchAll(/"([^"\n]+\.js)"\s*:/g)].map(match=>match[1])}))));
 for(const worker of workers)worker.modules=originalModules(worker.modules);
 assert.ok(workers.length,'a real compute worker was created');
 for(const worker of workers){
  assert.ok(worker.modules.includes('language/src/index.js'),'worker contains the decoder');
  assert.ok(worker.modules.includes('verifier/src/index.js'),'worker contains the verifier');
  assert.ok(!worker.modules.some(id=>/^(viewer|designer|presentation)\//.test(id)||id==='standalone/src/shell.js'),JSON.stringify(worker.modules));
 }
 return workers;
}
async function createFixture(page,edit=false){
 await page.evaluate(edit=>{
  const element=document.createElement('div');element.id='modular-fixture';element.style.cssText='position:fixed;inset:0;background:white;z-index:10000;overflow:auto;padding:12px';document.body.append(element);
  const runtime=DDN.createRuntime(DDN.createBrowserRuntimeOptions()),viewer=DDN.createViewer(element,{runtime});
  const authority={authorize:async action=>({allowed:true,principal:'modular-test',grants:[action,'model.edit','lifecycle.review','lifecycle.accept','lifecycle.reopen']})};
  window.modularFixture={element,runtime,viewer,handle:DDN.getViewerHandle(viewer),authority,edit};
 },edit);
}
async function openSource(page,text){return page.evaluate(async sources=>{
 const f=window.modularFixture;f.designer?.destroy();f.designer=undefined;
 const opened=await f.viewer.open(sources);await f.handle.whenRendered();if(f.edit)f.designer=DDN.createDesigner(f.viewer,{authority:f.authority});
 const scene=f.handle.scene(),report=opened.snapshot?await f.runtime.verifier.verifyModel(opened.snapshot,{scope:{kind:'workarea'},purpose:'design',level:'semantic'}):undefined;
 return {loaded:!!opened.snapshot,coverage:scene?.coverage,items:scene?.items.length,diagnostics:f.handle.diagnostics(),outcome:report?.outcome,verification:report?.diagnostics};
 },sourceSet(text));}

test('modular native startup loads only the selected utility and no optional profile families',async()=>{
 const evidence={};
 for(const mode of ['viewer','designer','verifier']){
  const session=await open(mode);const {context,page,network,errors,requests}=session;
  try{
   const state=await moduleEvidence(page),ids=state.registry.modules;
   assert.ok(!ids.some(id=>/(?:generated-family-(graphs|charts|geography|surfaces)|shards\/data-[^/]+)\.js$/.test(id)),JSON.stringify(ids));
   assert.ok(!ids.some(id=>/presentation\/src\/(data-charts|data-geo|data-surfaces|graph-profiles|complete-renderers)\.js$/.test(id)),JSON.stringify(ids));
   if(mode!=='designer')assert.ok(!ids.some(id=>id.startsWith('designer/')),'viewer/verifier must not carry editing code');
   if(mode==='verifier')assert.ok(!ids.some(id=>id.startsWith('presentation/')),'verifier must not carry drawing code');
   const fonts=await page.evaluate(()=>window.DDN_FONT_RESOURCES?.map(face=>({family:face.family,style:face.style}))??[]);
   assert.deepEqual(fonts,mode==='verifier'?[]:[{family:'Inter',style:'normal'}]);
   const scripts=[...new Set(requests.filter(url=>url.startsWith('file:')&&new URL(url).pathname.endsWith('.js')))];
   const scriptBytes=(await Promise.all(scripts.map(url=>readFile(fileURLToPath(url))))).reduce((sum,bytes)=>sum+bytes.length,0);
   const workers=await workerEvidence(page);evidence[mode]={...state,workers,fonts,scriptFiles:scripts.map(url=>relative(distribution,fileURLToPath(url))),scriptBytes};
   assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
 await writeFile(join(reports,'native-startup.json'),JSON.stringify(evidence,null,2)+'\n');
});

test('modular viewer automatically loads, verifies, renders and exports all152 profiles offline',async t=>{
 const {context,page,network,errors}=await open('viewer');const results=[];
 try{
  await createFixture(page);
  for(const profile of allFixtureProfiles)await t.test(profile,async()=>{
   const opened=await openSource(page,profileSource(profile,language));
   assert.equal(opened.loaded,true,JSON.stringify(opened.diagnostics));assert.equal(opened.coverage?.complete,true,JSON.stringify(opened.diagnostics));assert.ok(opened.items>1);
   assert.equal(opened.outcome,'valid',JSON.stringify(opened.verification));
   const capture=await page.evaluate(async()=>{const result=await modularFixture.viewer.capture({scope:{kind:'workarea'},format:'svg',extent:'content',stale:'reject',partial:'reject',includePreview:false});return result.ok?{ok:true,svg:await result.artifacts[0].blob.text()}:{ok:false,reason:result.reason};});
   assert.equal(capture.ok,true,JSON.stringify(capture));assert.match(capture.svg,/<svg/);assert.doesNotMatch(capture.svg,/NaN|Infinity|undefined/);
   results.push({profile,items:opened.items,outcome:opened.outcome,coverage:opened.coverage,svgBytes:capture.svg.length});
  });
  const state=await moduleEvidence(page);assert.ok(!state.registry.modules.some(id=>id.startsWith('designer/')));
  assert.equal(new Set(state.registry.chunks.map(chunk=>chunk.id)).size,state.registry.chunks.length);
  await workerEvidence(page);assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
  await writeFile(join(reports,'all-profiles.json'),JSON.stringify({results,state},null,2)+'\n');
 }finally{await context.close();}
});

test('modular verifier loads all152 rule families without loading any renderer',async t=>{
 const {context,page,network,errors}=await open('verifier');const results=[];
 try{
  await page.evaluate(()=>{window.modularVerifier=DDN.createVerifier(DDN.createBrowserRuntimeOptions());});
  for(const profile of allFixtureProfiles)await t.test(profile,async()=>{
   const report=await page.evaluate(sources=>modularVerifier.verifySources(sources,{scope:{kind:'workarea'},purpose:'design',level:'semantic'}),sourceSet(profileSource(profile,language)));
   assert.equal(report.outcome,'valid',JSON.stringify(report.diagnostics));assert.equal(report.coverage.complete,true);results.push({profile,outcome:report.outcome,checked:report.coverage.checked.length});
  });
  const state=await moduleEvidence(page);assert.ok(!state.registry.modules.some(id=>/^(presentation|designer)\//.test(id)),JSON.stringify(state.registry.modules));
  await workerEvidence(page);assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
  await writeFile(join(reports,'verifier-profiles.json'),JSON.stringify({results,state},null,2)+'\n');
 }finally{await context.close();}
});

test('modular designer loads a newly selected family and retains undo, redo and save',async()=>{
 const {context,page,network,errors}=await open('designer');
 try{
  await createFixture(page,true);await openSource(page,'erd Sales\n    Customer\n');
  assert.ok(!(await moduleEvidence(page)).registry.modules.some(id=>/shards\/data-graphs-uml\.js$/.test(id)));
  const fixture=page.locator('#modular-fixture');await fixture.getByRole('button',{name:'Add view',exact:true}).click();await chooseViewLayout(fixture);
  const dialog=fixture.getByRole('dialog');await selectDiagramProfile(dialog,'uml.structure@2','MT02');await dialog.getByRole('textbox',{name:'Unique view name'}).fill('ClassDesign');await dialog.getByRole('button',{name:'Apply',exact:true}).click();await dialog.waitFor({state:'detached'});
  await page.waitForFunction(()=>modularFixture.runtime.sources().files[0].text.includes('uml.structure@2'));
  assert.ok((await moduleEvidence(page)).registry.modules.some(id=>/shards\/data-graphs-uml\.js$/.test(id)));
  await page.evaluate(async()=>{await modularFixture.handle.whenRendered();const entry=modularFixture.handle.scene().entries.find(e=>e.definition.record.name==='ClassDesign');modularFixture.handle.select(entry.definition.ref,entry.item.occurrence);});
  await paletteElement(page,fixture,'uml.class','CustomerClass');
  await page.waitForFunction(()=>modularFixture.runtime.sources().files[0].text.includes('CustomerClass'));
  await fixture.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForFunction(()=>!modularFixture.runtime.sources().files[0].text.includes('CustomerClass'));
  await fixture.getByRole('button',{name:'Redo',exact:true}).click();await page.waitForFunction(()=>modularFixture.runtime.sources().files[0].text.includes('CustomerClass'));
  const saved=await page.evaluate(async()=>{const files=await modularFixture.designer.save();return Promise.all(files.map(async file=>await file.blob.text()));});
  assert.ok(saved.some(text=>text.includes('ClassDesign')&&text.includes('CustomerClass')));
  assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('a missing optional family reports a visible failure and cannot produce a successful new view',async()=>{
 const base=await mkdtemp(join(reports,'missing-family-'));await cp(join(distribution,'modular'),join(base,'modular'),{recursive:true});
 const manifest=JSON.parse(await readFile(join(base,'modular/manifest.json'),'utf8')),candidates=manifest.chunks.filter(chunk=>originalModules(chunk.moduleIds).includes('profiles/src/shards/data-charts-relationships.js'));
 assert.equal(candidates.length,1,'the chart catalogue belongs to exactly one active local chunk');const missing=join(base,'modular',candidates[0].file);await rename(missing,missing+'.unavailable');
 const {context,page,network}=await open('designer',{base});
 try{
  const editor=page.getByRole('textbox',{name:'DDN source',exact:true});await editor.fill(profileSource('chart.arc@1',language));await page.getByRole('button',{name:'Apply source',exact:true}).click();
  await page.waitForFunction(()=>/failed|unable|missing|error|could not/i.test([...document.querySelectorAll('.app-status,[role="alert"]')].map(e=>e.textContent).join(' ')));
  assert.ok(!(await moduleEvidence(page)).registry.modules.some(id=>id==='profiles/src/shards/data-charts-relationships.js'));
  assert.equal(await page.locator('.ddn-viewer-stage svg').getByText('Example chart.arc@1',{exact:true}).count(),0);
  assert.deepEqual(network,[]);
 }finally{await context.close();}
});

test('the same modular distribution loads over HTTP and reuses each loaded chunk',async()=>{
 const server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),path=resolve(distribution,'.'+name);if(relative(distribution,path).startsWith('..')){res.writeHead(403);res.end();return;}const data=await readFile(path);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.json':'application/json','.woff2':'font/woff2'})[extname(path)]??'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const http=`http://127.0.0.1:${server.address().port}`;
 let session;
 try{
  session=await open('viewer',{http});const {page,requests,network,errors}=session;await createFixture(page);const text=profileSource('chart.arc@1',language);
  assert.equal((await openSource(page,text)).coverage.complete,true);const first=requests.filter(url=>new URL(url).pathname.endsWith('.js'));
  assert.equal((await openSource(page,text)).coverage.complete,true);const second=requests.filter(url=>new URL(url).pathname.endsWith('.js'));
  assert.deepEqual(second,first);assert.equal(new Set(first).size,first.length,'scripts load only once');assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
 }finally{await session?.context.close();await new Promise(resolve=>server.close(resolve));}
});

test('shell-free viewer API embeds into an existing page and loads a foreign profile automatically',async()=>{
 const html=join(reports,'embedded-viewer.html'),loader=pathToFileURL(join(distribution,'modular/ddn-loader.js')).href;
 await writeFile(html,`<!doctype html><html lang="en"><meta charset="utf-8"><title>Host application</title><h1>Host application</h1><div id="host-canvas" style="width:1200px;height:800px"></div><script src="${loader}"></script></html>`);
 const context=await browser.newContext({viewport:{width:1400,height:1000}}),network=[],errors=[];
 await context.route(/^https?:\/\//,route=>{network.push(route.request().url());return route.abort();});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(pathToFileURL(html).href);await page.waitForFunction(()=>!!window.DDN_LOADER);
  const result=await page.evaluate(async sources=>{
   await DDN_LOADER.ready;await DDN_LOADER.prepareEntry('worker');
   const api=await DDN_LOADER.loadEntry('api:viewer'),element=document.querySelector('#host-canvas'),runtime=api.createRuntime(api.createBrowserRuntimeOptions()),viewer=api.createViewer(element,{runtime});
   try{
    const opened=await viewer.open(sources),handle=api.getViewerHandle(viewer);await handle.whenRendered();
    const report=await runtime.verifier.verifyModel(opened.snapshot,{scope:{kind:'workarea'},purpose:'design',level:'semantic'}),capture=await viewer.capture({scope:{kind:'workarea'},format:'svg',extent:'content',stale:'reject',partial:'reject',includePreview:false});
    return {loaded:!!opened.snapshot,coverage:handle.scene()?.coverage,outcome:report.outcome,diagnostics:report.diagnostics,svg:capture.ok?await capture.artifacts[0].blob.text():'',hostTitle:document.querySelector('h1')?.textContent,shellElements:document.querySelectorAll('.app-bar,.app-tools,.app-source').length,state:DDN_MODULES.describe()};
   }finally{viewer.destroy();runtime.destroy();}
  },sourceSet(profileSource('uml.sequence@2',language)));
  assert.equal(result.loaded,true);assert.equal(result.coverage.complete,true);assert.equal(result.outcome,'valid',JSON.stringify(result.diagnostics));assert.match(result.svg,/<svg/);assert.doesNotMatch(result.svg,/NaN|Infinity|undefined/);
  assert.equal(result.hostTitle,'Host application');assert.equal(result.shellElements,0);
  result.state.modules=originalModules(result.state.modules);
  assert.ok(result.state.modules.includes('presentation/src/graph-profiles.js'),'the foreign method was loaded on demand');
  assert.ok(!result.state.modules.some(id=>id.startsWith('designer/')||/standalone\/src\/(shell|modular-shell|website-navigation)\.js$/.test(id)),JSON.stringify(result.state.modules));
  assert.deepEqual(network,[]);assert.deepEqual(errors,[]);await writeFile(join(reports,'embedded-viewer.json'),JSON.stringify({...result,svg:undefined},null,2)+'\n');
 }finally{await context.close();}
});

test('shell-free verifier API checks a foreign profile without loading viewer or drawing modules',async()=>{
 const html=join(reports,'embedded-verifier.html'),loader=pathToFileURL(join(distribution,'modular/ddn-loader.js')).href;
 await writeFile(html,`<!doctype html><html lang="en"><meta charset="utf-8"><title>Host validation</title><h1>Host validation</h1><script src="${loader}"></script></html>`);
 const context=await browser.newContext(),network=[],errors=[];await context.route(/^https?:\/\//,route=>{network.push(route.request().url());return route.abort();});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(pathToFileURL(html).href);await page.waitForFunction(()=>!!window.DDN_LOADER);
  const result=await page.evaluate(async sources=>{
   await DDN_LOADER.ready;await DDN_LOADER.prepareEntry('worker');const api=await DDN_LOADER.loadEntry('api:verifier'),verifier=api.createVerifier();
   try{const report=await verifier.verifySources(sources,{scope:{kind:'workarea'},purpose:'design',level:'semantic'});return {report,state:DDN_MODULES.describe(),shellElements:document.querySelectorAll('.app-bar,.app-tools,.app-source,.ddn-viewer-stage').length,hostTitle:document.querySelector('h1')?.textContent};}
   finally{verifier.destroy();}
  },sourceSet(profileSource('chart.arc@1',language)));
  assert.equal(result.report.outcome,'valid',JSON.stringify(result.report.diagnostics));assert.equal(result.report.coverage.complete,true);assert.ok(result.report.coverage.checked.length>0);
  assert.equal(result.hostTitle,'Host validation');assert.equal(result.shellElements,0);
  result.state.modules=originalModules(result.state.modules);
  assert.ok(result.state.modules.includes('profiles/src/shards/data-charts-relationships.js'));
  assert.ok(!result.state.modules.some(id=>/^(viewer|designer|presentation)\//.test(id)||/standalone\/src\/(shell|modular-shell|website-navigation)\.js$/.test(id)),JSON.stringify(result.state.modules));
  assert.deepEqual(network,[]);assert.deepEqual(errors,[]);await writeFile(join(reports,'embedded-verifier.json'),JSON.stringify(result,null,2)+'\n');
 }finally{await context.close();}
});

test('the API bootstrap defers native schema until use, reports a missing schema and permits retry',async()=>{
 const html=join(reports,'schema-deferred.html'),loader=pathToFileURL(join(distribution,'modular/ddn-loader.js')).href;
 await writeFile(html,`<!doctype html><meta charset="utf-8"><div id="host-canvas"></div><script src="${loader}"></script>`);
 const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await context.route(/^https?:\/\//,route=>route.abort());
 const schemaChunk=manifest.chunks.find(chunk=>chunk.moduleIds.some(id=>(manifest.sourceModules[id]??[]).some(input=>input.id==='profiles/src/generated-native-data.js')));
 assert.ok(schemaChunk);let blocked=true;
 await context.route('**/'+schemaChunk.file,route=>{if(blocked){blocked=false;return route.abort();}return route.continue();});
 try{
  await page.goto(pathToFileURL(html).href);await page.waitForFunction(()=>!!window.DDN_LOADER);
  const before=await page.evaluate(async()=>{window.api=await DDN_LOADER.loadEntry('api:viewer');window.rt=api.createRuntime(api.createBrowserRuntimeOptions());return DDN_MODULES.describe().modules;});
  assert.ok(!originalModules(before).includes('profiles/src/generated-native-data.js'));
  const failed=await page.evaluate(input=>rt.open(input),sourceSet('erd Sales\n    Customer\n'));
  assert.equal(failed.snapshot,undefined);assert.equal(failed.coverage.complete,false);assert.match(failed.diagnostics[0].message,/Unable to load/);
  const success=await page.evaluate(async input=>{const opened=await rt.open(input);rt.destroy();return opened;},sourceSet('erd Sales\n    Customer\n'));
  assert.ok(success.snapshot,JSON.stringify(success.diagnostics));assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('designer panels and font styles load on demand, retry after failure and reuse their chunks',async()=>{
 const {context,page,requests,network,errors}=await open('designer');
 try{
  await createFixture(page,true);await openSource(page,'erd Sales\n    Customer\n');
  await page.evaluate(()=>{const f=modularFixture,entry=f.handle.scene().entries.find(e=>e.definition.record.name==='Customer');f.handle.select(entry.definition.ref,entry.item.occurrence);});
  const initial=await moduleEvidence(page);assert.ok(!initial.registry.modules.includes('designer/src/appearance.js'));
  assert.deepEqual(await page.evaluate(()=>DDN_FONT_RESOURCES.map(face=>[face.family,face.style])),[['Inter','normal']]);
  const appearance=manifest.chunks.find(chunk=>chunk.moduleIds.some(id=>(manifest.sourceModules[id]??[]).some(input=>input.id==='designer/src/appearance.js')));assert.ok(appearance);let blocked=true;
  await context.route('**/'+appearance.file,route=>{if(blocked){blocked=false;return route.abort();}return route.continue();});
  const fixture=page.locator('#modular-fixture');await fixture.getByRole('button',{name:'Appearance & presets',exact:true}).click();
  await page.waitForFunction(()=>document.body.innerText.includes('Unable to open the controls:'));
  assert.equal(await fixture.getByRole('dialog').count(),0);
  await fixture.getByRole('button',{name:'Appearance & presets',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Appearance & presets',exact:true});await dialog.waitFor();
  await dialog.getByRole('tab',{name:'Font',exact:true}).click();await dialog.getByRole('group',{name:'Font family',exact:true}).getByRole('button',{name:'Source Serif 4',exact:true}).click();
  await page.waitForFunction(()=>DDN_FONT_RESOURCES.some(face=>face.family==='Source Serif 4'));
  assert.equal(await page.evaluate(()=>DDN_FONT_RESOURCES.filter(face=>face.family==='Source Serif 4').length),1);
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
  const first=requests.length;await fixture.getByRole('button',{name:'Appearance & presets',exact:true}).click();await dialog.waitFor();assert.equal(requests.length,first);
  await dialog.getByRole('button',{name:'Close',exact:true}).click();assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
