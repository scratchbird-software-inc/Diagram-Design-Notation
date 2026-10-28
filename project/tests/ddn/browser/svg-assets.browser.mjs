import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const distribution=process.env.DDN_DDN_DISTRIBUTION??join(root,'.work/builds/ddn-distribution');
const tool=process.env.DDN_PLAYWRIGHT_ROOT??join(root,'.work/tools/browser/node_modules/playwright');
const {chromium}=await import(pathToFileURL(join(tool,'index.mjs')));
const building=await readFile(join(root,'website/assets/icons/presentation-devices-1/office-building.svg'),'utf8');
let browser,page;const errors=[],network=[];
before(async()=>{
 browser=await chromium.launch({headless:true});page=await browser.newPage();
 page.on('pageerror',error=>errors.push(error.message));await page.route(/^https?:\/\//,route=>{network.push(route.request().url());return route.abort();});
 await page.goto(pathToFileURL(join(distribution,'complete/ddn-viewer.html')).href);await page.waitForFunction(()=>!!window.DDN?.createCompleteRuntimeOptions);
});
after(async()=>{await browser?.close();});
async function capture(svg){return page.evaluate(async svg=>{
 const source='asset Picture as resource from "local.svg"\n    with\n        media_type "image/svg+xml"\nelement Artwork as object\n    with\n        symbol.image Picture\n        symbol.label none\nview Board as ddn@1\n    with\n        id Board\n    use Artwork named Here\n        with\n            size\n                width 320\n                height 580\n';
 const host=document.createElement('main');host.style.cssText='position:fixed;inset:0';document.body.append(host);
 const runtime=DDN.createRuntime(DDN.createCompleteRuntimeOptions()),viewer=DDN.createViewer(host,{runtime,assets:{read:async()=>({bytes:new TextEncoder().encode(svg),mime:'image/svg+xml',hash:'svg-style-test'})}});
 try{
  const opened=await viewer.open({entry:'main.ddn',files:[{id:'main.ddn',text:source,revision:'1',encoding:'utf-8',writable:true}]});if(!opened.snapshot)throw Error(JSON.stringify(opened.diagnostics));
  const handle=DDN.getViewerHandle(viewer);await handle.whenRendered();const request={scope:{kind:'view',target:{file:'main.ddn',id:'Board'}},extent:'content',includePreview:false,partial:'reject',stale:'reject'};
  const captured=await viewer.capture({...request,format:'svg'}),png=await viewer.capture({...request,format:'png'});if(!captured.ok||!png.ok)throw Error(JSON.stringify({captured,png,diagnostics:handle.diagnostics()}));
  const outer=new DOMParser().parseFromString(await captured.artifacts[0].blob.text(),'image/svg+xml');const href=outer.querySelector('image').getAttribute('href');
  const text=new TextDecoder().decode(Uint8Array.from(atob(href.split(',')[1]),character=>character.charCodeAt(0)));
  const inner=new DOMParser().parseFromString(text,'image/svg+xml');
  const bitmap=await createImageBitmap(png.artifacts[0].blob),canvas=new OffscreenCanvas(bitmap.width,bitmap.height),context=canvas.getContext('2d');context.drawImage(bitmap,0,0);
  const pixels=context.getImageData(0,0,bitmap.width,bitmap.height).data,colors=new Set();let colored=0,green=0;
  for(let i=0;i<pixels.length;i+=4){const r=pixels[i],g=pixels[i+1],b=pixels[i+2];if(pixels[i+3]>100&&Math.max(r,g,b)-Math.min(r,g,b)>30){colored++;colors.add((r>>3)*1024+(g>>3)*32+(b>>3));}if(g>r+50&&g>b+50)green++;}
  const attributes=id=>{const node=inner.getElementById(id);return node?Object.fromEntries([...node.attributes].map(a=>[a.name,a.value])):null;};
  return {text,href,colored,green,colors:colors.size,stops:[...inner.querySelectorAll('stop')].map(s=>({color:s.getAttribute('stop-color'),opacity:s.getAttribute('stop-opacity')})),styles:inner.querySelectorAll('[style]').length,scripts:inner.querySelectorAll('script,style,foreignObject,image').length,attributes:{paint:attributes('paint'),unsafe:attributes('unsafe'),escaped:attributes('escaped'),priority:attributes('priority'),hidden:attributes('hidden'),external:attributes('external')},root:Object.fromEntries([...inner.documentElement.attributes].map(a=>[a.name,a.value])),executed:!!window.svgAssetExecuted};
 }finally{viewer.destroy();runtime.destroy();host.remove();}
},svg);}
test('supplied office SVG retains colored gradient artwork in self-contained SVG and PNG captures',async()=>{
 const result=await capture(building);assert.match(result.href,/^data:image\/svg\+xml;base64,/);assert.equal(result.styles,0);assert.equal(result.scripts,0);
 assert.ok(result.stops.some(stop=>stop.color==='rgb(231, 142, 180)'));assert.ok(result.stops.some(stop=>stop.opacity==='0'));
 assert.match(result.text,/fill="url\(#linearGradient/);assert.match(result.text,/stroke="rgb\(146, 73, 135\)"/);assert.match(result.text,/display="inline"/);
 assert.ok(result.colored>10000,'building must contain painted color, not a black silhouette');assert.ok(result.colors>40,'gradient colors survive raster capture');
});
test('safe inline paint survives while executable styles and external references are discarded',async()=>{
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100" viewBox="0 0 100 100" xml:base="https://invalid.example/" onload="window.svgAssetExecuted=true">
 <script>window.svgAssetExecuted=true</script><style>@import url(https://invalid.example/style.css);</style><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">active</div></foreignObject><image href="https://invalid.example/image.png"/>
 <defs><linearGradient id="ink"><stop offset="0" style="stop-color:#ff0000;stop-opacity:1"/><stop offset="1" style="stop-color:#0000ff;stop-opacity:0.8"/></linearGradient></defs>
 <rect id="paint" x="5" y="5" width="90" height="90" fill="#000000" style="fill:url(&quot;#ink&quot;);fill-opacity:0.8;opacity:0.75;stroke:#003399;stroke-width:2;display:inline;visibility:visible;background-image:url(https://invalid.example/bg.png);filter:url(https://invalid.example/filter.svg#bad);--paint:url(https://invalid.example/x);cursor:url(https://invalid.example/cursor),auto;transform:translateX(50px)"/>
 <rect id="hidden" width="100" height="100" style="display:none;fill:#00ff00"/>
 <rect id="unsafe" width="1" height="1" onmouseover="window.svgAssetExecuted=true" href="javascript:alert(1)" style="fill:url(https://invalid.example/fill.svg#x);stroke:var(--paint);filter:url(data:image/svg+xml,bad)"/>
 <rect id="escaped" width="1" height="1" style="fill:u\\72l(https://invalid.example/escaped.svg#x)"/>
 <rect id="priority" width="1" height="1" fill="#ffffff" style="fill:#ff0000!important;fill:#0000ff"/>
 <use id="external" href="https://invalid.example/external.svg#x" xlink:href="data:image/svg+xml,bad"/>
 </svg>`;
 const result=await capture(svg);assert.equal(result.executed,false);assert.equal(result.styles,0);assert.equal(result.scripts,0);assert.equal(result.root['xml:base'],undefined);assert.equal(result.root.onload,undefined);
 assert.equal(result.attributes.paint.fill,'url(#ink)');assert.equal(result.attributes.paint['fill-opacity'],'0.8');assert.equal(result.attributes.paint.opacity,'0.75');assert.equal(result.attributes.paint.stroke,'rgb(0, 51, 153)');assert.equal(result.attributes.paint.display,'inline');assert.equal(result.attributes.paint.transform,undefined);assert.equal(result.attributes.paint.filter,undefined);
 for(const name of ['fill','stroke','filter','onmouseover','href'])assert.equal(result.attributes.unsafe[name],undefined);
 assert.equal(result.attributes.escaped.fill,undefined);assert.equal(result.attributes.priority.fill,'rgb(255, 0, 0)');assert.equal(result.attributes.hidden.display,'none');assert.equal(result.attributes.external.href,undefined);assert.equal(result.attributes.external['xlink:href'],undefined);
 assert.doesNotMatch(result.text,/invalid\.example|javascript:|data:image|var\(|onmouseover|onload/);assert.ok(result.colored>1000);assert.ok(result.colors>20);assert.equal(result.green,0);assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
});

for(const outcome of ['success','failure'])test(`an obsolete ${outcome} image read cannot alter a newer document or block its capture`,async()=>{
 await page.evaluate(async()=>{
  const element=document.createElement('div');document.body.append(element);let enter,release,reject;
  const entered=new Promise(resolve=>enter=resolve),pending=new Promise((resolve,fail)=>{release=resolve;reject=fail;});
  const runtime=DDN.createRuntime(DDN.createCompleteRuntimeOptions()),viewer=DDN.createViewer(element,{runtime,assets:{read:async id=>{if(JSON.parse(id)[0]==='old.ddn'){enter();return pending;}return {bytes:new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="green"/></svg>'),mime:'image/svg+xml',hash:'current'};}}});
  const source='asset Picture as resource from "local.svg"\n    with\n        media_type "image/svg+xml"\nelement Artwork as object\n    with\n        symbol.image Picture\nview Board as ddn@1\n    use Artwork named Here\n';
  const old=viewer.open({entry:'old.ddn',files:[{id:'old.ddn',text:source,revision:'1',encoding:'utf-8',writable:true}]});
  window.assetRace={element,runtime,viewer,old,release,reject,handle:DDN.getViewerHandle(viewer)};await entered;
 });
 try{
  const opened=await page.evaluate(async()=>{const f=assetRace;await f.viewer.open({entry:'latest.ddn',files:[{id:'latest.ddn',text:'asset Fresh as resource from "current.svg"\n    with\n        media_type "image/svg+xml"\nelement Customer as object\n    with\n        symbol.image Fresh\nview Latest as ddn@1\n    use Customer named Here\n',revision:'1',encoding:'utf-8',writable:true}]});await f.handle.whenRendered();const capture=await f.viewer.capture({scope:{kind:'workarea'},format:'svg',extent:'content',stale:'reject',partial:'reject',includePreview:false});return {ok:capture.ok,svg:capture.ok?await capture.artifacts[0].blob.text():''};});
  assert.equal(opened.ok,true,'a newer document must not wait for an obsolete asset provider');
  const final=await page.evaluate(async outcome=>{const f=assetRace;if(outcome==='failure')f.reject(Error('Obsolete image failed'));else f.release({bytes:new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24"/></svg>'),mime:'image/svg+xml',hash:'obsolete'});await f.old;await f.handle.whenRendered();const capture=await f.viewer.capture({scope:{kind:'workarea'},format:'svg',extent:'content',stale:'reject',partial:'reject',includePreview:false});return {ok:capture.ok,diagnostics:f.handle.diagnostics(),root:f.runtime.snapshot().rootFile,svg:capture.ok?await capture.artifacts[0].blob.text():''};},outcome);
  assert.equal(final.ok,true,JSON.stringify(final.diagnostics));assert.equal(final.root,'latest.ddn');assert.ok(!final.diagnostics.some(d=>d.code==='asset-unavailable'));assert.doesNotMatch(final.svg,/Artwork/);assert.equal(final.svg,opened.svg,'obsolete reads must not evict or replace the current image');
 }finally{await page.evaluate(()=>{assetRace.viewer.destroy();assetRace.runtime.destroy();assetRace.element.remove();delete window.assetRace;});}
});
