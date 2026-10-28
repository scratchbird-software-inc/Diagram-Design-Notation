import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const distribution=process.env.DDN_DDN_DISTRIBUTION??join(root,'.work/builds/ddn-distribution');
const tool=process.env.DDN_PLAYWRIGHT_ROOT??join(root,'.work/tools/browser/node_modules/playwright');
const {chromium}=await import(pathToFileURL(join(tool,'index.mjs')));
const text=await readFile(join(root,'website/examples/appearance/paper.ddn'),'utf8');
const reports=join(root,'.work/reports/ddn-paper');
let browser,context,page;const errors=[],network=[];
before(async()=>{
 await mkdir(reports,{recursive:true});
 browser=await chromium.launch({headless:true});context=await browser.newContext({viewport:{width:1600,height:1000}});
 await context.route(/^https?:\/\//,route=>{network.push(route.request().url());return route.abort();});
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(pathToFileURL(join(distribution,'complete/ddn-viewer.html')).href);
 await page.waitForFunction(()=>!!window.DDN?.createCompleteRuntimeOptions);
 const opened=await page.evaluate(async text=>{
  window.paperViewers=[];
  for(let n=0;n<2;n++){
   const container=document.createElement('main');container.id='paper-export-'+n;container.style.cssText=`position:fixed;top:0;bottom:0;left:${n*50}%;width:50%;background:white;z-index:1000`;document.body.append(container);
   const runtime=DDN.createRuntime(DDN.createCompleteRuntimeOptions()),viewer=DDN.createViewer(container,{runtime}),handle=DDN.getViewerHandle(viewer);
   const result=await viewer.open({entry:'paper.ddn',files:[{id:'paper.ddn',text,revision:'1',encoding:'utf-8',writable:true}]});
   if(!result.snapshot)throw Error(JSON.stringify(result.diagnostics));
   await viewer.navigate({kind:'expand-view',target:{file:'paper.ddn',id:'Shadows'}});await handle.whenRendered();window.paperViewers.push({runtime,viewer,handle});
  }
  return window.paperViewers.length;
 },text);assert.equal(opened,2);
});
after(async()=>{await context?.close();await browser?.close();});

test('paper filters stay local, unique across viewers and outside hit geometry',async()=>{
 const result=await page.evaluate(()=>{
  const elements=[...document.querySelectorAll('[id^="paper-export-"]')],filters=elements.flatMap(e=>[...e.querySelectorAll('filter')]);
  return {ids:filters.map(f=>f.id),units:filters.map(f=>f.getAttribute('filterUnits')),effects:elements.flatMap(e=>[...e.querySelectorAll('[filter]')].map(p=>({url:p.getAttribute('filter'),pointer:p.getAttribute('pointer-events'),hidden:p.getAttribute('aria-hidden')}))),
   sources:window.paperViewers.map(f=>f.runtime.sources().files[0].text),
   bounds:window.paperViewers[0].handle.scene().entries.filter(e=>e.definition.record.name==='ShadowCentre').map(e=>({paint:e.item.bounds,hit:e.item.hitTargets[0].bounds}))};
 });
 assert.ok(result.ids.length>=8);assert.equal(new Set(result.ids).size,result.ids.length);
 assert.ok(result.units.every(unit=>unit==='userSpaceOnUse'));
 for(const effect of result.effects){assert.match(effect.url,/^url\(#[\w-]+\)$/);assert.ok(result.ids.includes(effect.url.slice(5,-1)));assert.equal(effect.pointer,'none');assert.equal(effect.hidden,'true');}
 assert.ok(result.bounds.length);assert.ok(result.bounds.every(b=>b.paint.height>b.hit.height));
 assert.deepEqual(result.sources,[text,text]);assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 await page.locator('#paper-export-0').screenshot({path:join(reports,'paper-shadows-browser.png')});
});

test('SVG and PNG captures retain coloured paper, pins and blur with self-contained references',async()=>{
 const result=await page.evaluate(async()=>{
  const f=window.paperViewers[0],target={file:'paper.ddn',id:'Board'};
  await f.viewer.navigate({kind:'expand-view',target});await f.handle.whenRendered();
  const request={scope:{kind:'view',target},extent:'content',includePreview:false,partial:'reject',stale:'reject'};
  const svg=await f.viewer.capture({...request,format:'svg'}),png=await f.viewer.capture({...request,format:'png'});
  if(!svg.ok||!png.ok)return {svg,png};
  const source=await svg.artifacts[0].blob.text(),document=new DOMParser().parseFromString(source,'image/svg+xml');
  const image=await createImageBitmap(png.artifacts[0].blob),canvas=new OffscreenCanvas(image.width,image.height),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,image.width,image.height).data;let coloured=0;
  for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>100&&Math.max(pixels[i],pixels[i+1],pixels[i+2])-Math.min(pixels[i],pixels[i+1],pixels[i+2])>20)coloured++;
  return {ok:true,filters:[...document.querySelectorAll('filter')].map(f=>f.id),refs:[...document.querySelectorAll('[filter]')].map(p=>p.getAttribute('filter')),external:[...document.querySelectorAll('[href]')].map(p=>p.getAttribute('href')),parserErrors:document.querySelectorAll('parsererror').length,hasColour:source.includes('#d7efc7'),coloured,width:image.width,height:image.height,signature:[...new Uint8Array(await png.artifacts[0].blob.arrayBuffer()).slice(0,8)],source:f.runtime.sources().files[0].text};
 });
 assert.equal(result.ok,true,JSON.stringify(result));assert.ok(result.filters.length>=6);assert.equal(new Set(result.filters).size,result.filters.length);
 for(const ref of result.refs)assert.ok(result.filters.includes(ref.slice(5,-1)));
 assert.deepEqual(result.external,[]);assert.equal(result.parserErrors,0);assert.equal(result.hasColour,true);assert.ok(result.coloured>10000);assert.ok(result.width>500&&result.height>200);
 assert.deepEqual(result.signature,[137,80,78,71,13,10,26,10]);assert.equal(result.source,text);assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 await page.locator('#paper-export-0').screenshot({path:join(reports,'paper-board-browser.png')});
});
