import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const build=process.env.DDN_BUILD_ROOT??join(root,'.work/builds/ddn');
const tool=process.env.DDN_PLAYWRIGHT_ROOT??join(root,'.work/tools/browser/node_modules/playwright');
const {chromium}=await import(pathToFileURL(join(tool,'index.mjs')));
const module='data:text/javascript;base64,'+Buffer.from(await readFile(join(build,'ddn/packages/viewer/src/texture.js'))).toString('base64');
const reports=join(root,'.work/reports/ddn-textures');
let browser,context,page;const network=[],errors=[];
before(async()=>{
 await mkdir(reports,{recursive:true});browser=await chromium.launch({headless:true});context=await browser.newContext({viewport:{width:1150,height:620}});
 await context.route(/^https?:\/\//,route=>{network.push(route.request().url());return route.abort();});
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto('about:blank');
 await page.evaluate(async module=>{window.texture=await import(module);},module);
});
after(async()=>{await context?.close();await browser?.close();});

test('real SVG patterns match CSS tiles and stay self-contained when rasterized',async()=>{
 const result=await page.evaluate(async()=>{
  const {createTexturePattern,textureBackground}=window.texture,ns='http://www.w3.org/2000/svg',results=[];
  document.body.style.cssText='margin:20px;font:16px system-ui;background:#e5e9ec';
  const heading=document.createElement('h2');heading.textContent='Deterministic local vector textures';document.body.append(heading);
  const row=document.createElement('div');row.style.cssText='display:flex;gap:20px';document.body.append(row);
  for(const kind of ['paper','linen','grid','dots']){
   const value={kind,color:'#806844',opacity:.3,scale:32,seed:42},base='#fff5d6',pattern=createTexturePattern(document,'texture-'+kind,value,base);
   const svg=document.createElementNS(ns,'svg');svg.setAttribute('width','256');svg.setAttribute('height','192');
   const defs=document.createElementNS(ns,'defs');defs.append(pattern);svg.append(defs);
   const rect=document.createElementNS(ns,'rect');rect.setAttribute('width','256');rect.setAttribute('height','192');rect.setAttribute('fill','url(#texture-'+kind+')');svg.append(rect);
   const section=document.createElement('section'),title=document.createElement('h3');title.textContent=kind;section.append(title,svg);row.append(section);
   const css=textureBackground(value,base),tile=decodeURIComponent(css.image.slice('url("data:image/svg+xml,'.length,-2));
   const cssBlock=document.createElement('div');cssBlock.style.cssText='margin-top:16px;width:256px;height:192px';cssBlock.style.backgroundImage=css.image;cssBlock.style.backgroundSize=css.size;section.append(cssBlock);
   const load=source=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('SVG tile did not decode'));image.src='data:image/svg+xml,'+encodeURIComponent(source);});
   const svgImage=await load(new XMLSerializer().serializeToString(svg)),tileImage=await load(tile);
   const a=new OffscreenCanvas(256,192),b=new OffscreenCanvas(256,192),ac=a.getContext('2d'),bc=b.getContext('2d');ac.drawImage(svgImage,0,0);bc.fillStyle=bc.createPattern(tileImage,'repeat');bc.fillRect(0,0,256,192);
   const av=ac.getImageData(0,0,256,192).data,bv=bc.getImageData(0,0,256,192).data;let difference=0;
   for(let i=0;i<av.length;i++)difference+=Math.abs(av[i]-bv[i]);
   results.push({kind,difference:difference/av.length,children:pattern.children.length,units:pattern.getAttribute('patternUnits'),width:pattern.getAttribute('width'),urls:pattern.querySelectorAll('[href],script,image,foreignObject,filter').length});
  }
  return {results,unsafe:createTexturePattern(document,'bad\" onload=evil',{},'#fff')===undefined,invalid:createTexturePattern(document,'valid',null)===undefined};
 });
 for(const r of result.results){assert.ok(r.difference<2,JSON.stringify(r));assert.ok(r.children<=7);assert.equal(r.units,'userSpaceOnUse');assert.equal(r.width,'32');assert.equal(r.urls,0);}
 assert.equal(result.unsafe,true);assert.equal(result.invalid,true);assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
 await page.screenshot({path:join(reports,'textures-svg-and-css.png')});
});
