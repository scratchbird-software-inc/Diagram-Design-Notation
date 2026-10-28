import {matchesGalleryVerification} from './verification-expectations.mjs';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,readdirSync,existsSync}from'node:fs';
import{join,dirname}from'node:path';
import{pathToFileURL}from'node:url';
import{createHash}from'node:crypto';
import{root,environment,outputPath}from'../workspace/context.mjs';
const env=environment(),site=join(root,'website'),catalogue=JSON.parse(readFileSync(join(site,'gallery/catalogue.json')));
const{chromium}=await import(pathToFileURL(join(env.DDN_BUILD_WORKAREA,'tools/browser/node_modules/playwright/index.mjs')));
const reportRoot=outputPath(join(env.DDN_BUILD_WORKAREA,'reports/ddn-website'));mkdirSync(reportRoot,{recursive:true});
const destination=outputPath(join(env.DDN_BUILD_WORKAREA,'builds/ddn-website-gallery'));mkdirSync(destination,{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1600,height:1000}}),page=await context.newPage(),errors=[],network=[];
await context.route(/^https?:\/\//,r=>{network.push(r.request().url());return r.abort();});page.on('pageerror',e=>errors.push(e.message));
const art=JSON.parse(readFileSync(join(site,'assets/icons/map.json'),'utf8'));
const frozen=existsSync(join(site,'assets/snapshots'))?readdirSync(join(site,'assets/snapshots')).filter(p=>p.endsWith('.svg')).map(p=>'assets/snapshots/'+p):[];
const assetSources=Object.fromEntries([...new Set(['assets/geo/world-110m.json',...Object.values(art),...frozen])].map(path=>{const text=readFileSync(join(site,path),'utf8');return[path,{text,mime:path.endsWith('.svg')?'image/svg+xml':'application/geo+json',hash:createHash('sha256').update(text).digest('hex')}];}));
const evidence=[],slug=s=>s.replace(/[^\w.-]+/g,'-');
try{
await page.goto(pathToFileURL(join(site,'tools/index.html')).href);await page.waitForFunction(()=>!!window.DDN);
await page.evaluate(assetSources=>{const target=document.createElement('main');target.style.cssText='position:fixed;inset:0;background:white;z-index:1000';document.body.append(target);const runtime=DDN.createRuntime(DDN.createBrowserRuntimeOptions()),viewer=DDN.createViewer(target,{runtime,assets:{read:async id=>{const[file,key]=JSON.parse(id),asset=runtime.snapshot().normalized.files.find(f=>f.location===file)?.document.assets?.find(a=>a.id===key),source=assetSources[asset?.path];if(!source)throw Error('Unsupplied asset '+id);return{bytes:new TextEncoder().encode(source.text),mime:source.mime,hash:source.hash};}}});window.gallery={runtime,viewer,handle:DDN.getViewerHandle(viewer)};},assetSources);
for(const entry of catalogue.corpus){
 const text=readFileSync(join(site,entry.entry),'utf8');
 const opened=await page.evaluate(async({entry,text})=>{const f=window.gallery;try{const open=await f.viewer.open({entry,files:[{id:entry,text,revision:'1',encoding:'utf-8',writable:true}]});await f.handle.whenRendered();const report=open.snapshot?await f.runtime.verifier.verifyModel(open.snapshot,{scope:{kind:'workarea'},purpose:'design',level:'semantic'}):null;return{loaded:!!open.snapshot,diagnostics:open.diagnostics,semantic:report?.outcome,semanticDiagnostics:report?.diagnostics,renderDiagnostics:f.handle.diagnostics(),coverage:f.handle.scene()?.coverage};}catch(e){return{error:e.message};}},{entry:entry.entry,text});
 const record={entry:entry.entry,...opened,views:[]};
 if(opened.loaded)for(const view of entry.views){
  const result=await page.evaluate(async({file,id})=>{const f=window.gallery;try{await f.viewer.navigate({kind:'expand-view',target:{file,id}});const result=await f.viewer.capture({scope:{kind:'view',target:{file,id}},format:'svg',extent:'content',includePreview:false,partial:'reject',stale:'reject'});if(!result.ok)return result;const svg=await result.artifacts[0].blob.text(),dom=new DOMParser().parseFromString(svg,'image/svg+xml'),numeric=new Set(['d','points','transform','viewBox','x','y','width','height','x1','x2','y1','y2','cx','cy','r','rx','ry','opacity','fill-opacity','stroke-opacity','stroke-width','stroke-dasharray','font-size','stdDeviation']);const finite=!dom.querySelector('parsererror')&&[...dom.querySelectorAll('*')].every(element=>[...element.attributes].every(attribute=>!numeric.has(attribute.name)||!/(?:NaN|Infinity|undefined)/.test(attribute.value)));return {ok:true,svg,finite};}catch(e){return{ok:false,error:e.message};}},{file:entry.entry,id:view.id});
  const name='views/'+slug(entry.entry)+'--'+slug(view.id)+'.svg';
  if(result.ok){mkdirSync(dirname(join(destination,name)),{recursive:true});writeFileSync(join(destination,name),result.svg);record.views.push({id:view.id,profile:view.profile,svg:name,ok:true,finite:result.finite});}else record.views.push({id:view.id,profile:view.profile,...result});
 }
 evidence.push(record);
 if(evidence.length%20===0)console.log('Rendered entries '+evidence.length+'/'+catalogue.corpus.length);
}
}finally{await context.close();await browser.close();}
const failures=evidence.filter(e=>!e.loaded||!matchesGalleryVerification(e.entry,{outcome:e.semantic,diagnostics:e.semanticDiagnostics??[]})||e.views.some(v=>!v.ok||!v.finite)||e.renderDiagnostics?.some(d=>d.severity==='error'));
writeFileSync(join(reportRoot,'gallery-render.json'),JSON.stringify({entries:evidence,failures:failures.map(e=>e.entry),errors,network},null,2)+'\n');
if(failures.length||errors.length||network.length){console.error('Gallery checks failed',JSON.stringify({entries:failures.length,errors,network}));process.exitCode=1;}else{
 const copy=(entry,view,target)=>{const rendered=evidence.find(e=>e.entry===entry)?.views.find(v=>v.id===view);if(!rendered?.ok)throw Error('Missing rendered view '+entry+' '+view);mkdirSync(dirname(join(site,target)),{recursive:true});copyFileSync(join(destination,rendered.svg),join(site,target));};
 for(const item of catalogue.profiles)copy(item.entry,item.view,item.svg);
 for(const sheet of catalogue.sheets)for(const item of sheet.items)copy(item.entry,item.view,item.svg);
 for(const item of catalogue.corpus){copy(item.entry,item.views[0].id,item.svg);for(const view of item.views)copy(item.entry,view.id,'gallery/views/'+slug(item.entry)+'--'+slug(view.id)+'.svg');}
 console.log('Updated DDN website gallery: '+evidence.length+' entries / '+evidence.reduce((s,e)=>s+e.views.length,0)+' views.');
}
