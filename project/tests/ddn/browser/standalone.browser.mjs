import {openSample, fileAction, inlineName} from './ux-test-helpers.mjs';
import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const distribution=process.env.DDN_DDN_DISTRIBUTION??resolve(root,'.work/builds/ddn-distribution');
const reports=process.env.DDN_BROWSER_REPORTS??resolve(root,'.work/reports/ddn-browser');
const tool=process.env.DDN_PLAYWRIGHT_ROOT??resolve(root,'.work/tools/browser/node_modules/playwright');
const {chromium}=await import(pathToFileURL(join(tool,'index.mjs')));
let browser;
before(async()=>{await mkdir(reports,{recursive:true});browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();});
const examples=['ERD whiteboard','Mind map','Concept map','Table'];
async function open(mode){
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,acceptDownloads:true});
 const network=[],errors=[];await context.route(/^https?:\/\//,route=>{network.push(route.request().url());return route.abort();});
 await context.addInitScript(()=>{
   window.__ddnWorkerEvidence={urls:[],kinds:[]};const NativeWorker=window.Worker;
   window.Worker=class extends NativeWorker{
     constructor(url,options){super(url,options);window.__ddnWorkerEvidence.urls.push(String(url));}
     postMessage(value,...args){if(value?.channel==='ddn.compute.v1'&&value.type==='run')window.__ddnWorkerEvidence.kinds.push(value.request.kind);return super.postMessage(value,...args);}
   };
 });
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(pathToFileURL(join(distribution,'ddn-'+mode+'.html')).href);
 await ready(page,mode);return {context,page,network,errors};
}
async function ready(page,mode){
 if(mode==='verifier'){await page.locator('.app-status').filter({hasText:/^Verification /}).waitFor();await page.locator('.app-report h2').waitFor();}
 else await page.locator('.app-status').filter({hasText:/ready/}).waitFor();
}
async function load(page,mode,name){const previous=await page.evaluate(()=>window.__ddnWorkerEvidence.kinds.length);await openSample(page,name);await page.waitForFunction(previous=>window.__ddnWorkerEvidence.kinds.length>previous&&/ready|^Verification /.test(document.querySelector('.app-status')?.textContent??''),previous);await ready(page,mode);}
async function allExamples(page,mode){
 for(const name of examples){
   await load(page,mode,name);
   if(mode==='verifier'){
     assert.match(await page.locator('.app-report h2').innerText(),/^valid\b/,name);
     assert.match(await page.locator('.app-report p').innerText(),/[1-9]\d* checked records/,name);
   }else {
     await page.waitForFunction(()=>document.querySelector('.ddn-viewer-stage svg [data-occurrence]'));
     assert.doesNotMatch(await page.locator('.app-status').innerText(),/failed|unsupported|unavailable|invalid/i,name);
     if(name==='Table')assert.ok(await page.locator('.ddn-viewer-stage svg text').filter({hasText:'Design'}).count());
   }
 }
}
async function workerEvidence(page){const evidence=await page.evaluate(()=>window.__ddnWorkerEvidence);assert.ok(evidence.urls.some(url=>url.startsWith('blob:')));assert.ok(evidence.kinds.includes('decode'));assert.ok(evidence.kinds.includes('verify'));return evidence;}

test('offline viewer shell opens all native examples with read-only source and real Blob workers',async()=>{
 const {context,page,network,errors}=await open('viewer');
 try{assert.equal(await page.getByRole('textbox',{name:'DDN source',exact:true}).isEditable(),false);assert.equal(await page.locator('[data-ddn-designer]').count(),0);await allExamples(page,'viewer');await workerEvidence(page);assert.deepEqual(network,[]);assert.deepEqual(errors,[]);}finally{await context.close();}
});
test('offline designer shell synchronizes visual edits and source edits in both directions',async()=>{
 const {context,page,network,errors}=await open('visual-designer');
 try{
   const editor=page.getByRole('textbox',{name:'DDN source',exact:true});assert.equal(await editor.isEditable(),true);await allExamples(page,'visual-designer');await load(page,'visual-designer','ERD whiteboard');
   await page.locator('.ddn-viewer-stage [data-ref][aria-label="Customer"]').dblclick();
   await inlineName(page,'Customer records');
   assert.match(await editor.inputValue(),/Customer records/);
   await editor.fill(await editor.inputValue()+'\n    AddedFromSource\n');await page.getByRole('button',{name:'Apply source',exact:true}).click();
   await page.locator('.ddn-viewer-stage [data-ref][aria-label="AddedFromSource"]').waitFor();await workerEvidence(page);
   await page.screenshot({path:join(reports,'standalone-designer.png'),fullPage:true});assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('offline verifier shell produces real checked records and downloadable evidence for every example',async()=>{
 const {context,page,network,errors}=await open('verifier');
 try{
   await allExamples(page,'verifier');await workerEvidence(page);
   const pending=page.waitForEvent('download');await fileAction(page,'Download report');const download=await pending;const path=join(reports,'standalone-verification.json');await download.saveAs(path);
   const report=JSON.parse(await readFile(path,'utf8'));assert.equal(report.outcome,'valid');assert.ok(report.coverage.checked.length>0);assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
