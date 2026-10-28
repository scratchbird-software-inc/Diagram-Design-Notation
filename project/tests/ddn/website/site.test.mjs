import {matchesGalleryVerification} from '../../../../tooling/website/verification-expectations.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),site=join(root,'website');
const catalogue=JSON.parse(readFileSync(join(site,'gallery/catalogue.json'))),manifest=JSON.parse(readFileSync(join(site,'gallery/conversion-manifest.json')));
const all=(dir)=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?all(join(dir,e.name)):[join(dir,e.name)]);
test('DDN website preserves original profiles, variation sheets and every inventoried view',()=>{
 assert.equal(catalogue.profiles.length,151);assert.equal(new Set(catalogue.profiles.map(p=>p.id)).size,151);assert.equal(manifest.examples.length,163);assert.equal(catalogue.sheets.length,9);assert.equal(catalogue.corpus.length,166);assert.equal(catalogue.corpus.reduce((n,e)=>n+e.views.length,0),474);assert.deepEqual(manifest.conflicts,[]);
 for(const original of manifest.examples)assert.ok(catalogue.corpus.some(e=>e.entry===original.entry&&e.views.length===original.views.length));
 for(const item of [...catalogue.profiles,...catalogue.sheets.flatMap(s=>s.items),...catalogue.corpus]){assert.ok(existsSync(join(site,item.entry)),item.entry);assert.ok(existsSync(join(site,item.svg)),item.svg);assert.match(readFileSync(join(site,item.svg),'utf8'),/<svg/);}
});
test('all static links and script/style assets are contained and present',()=>{
 const failures=[];for(const file of all(site).filter(f=>f.endsWith('.html'))){const html=readFileSync(file,'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,m=>m.replace(/>[\s\S]*<\/script>/,'></script>'));
 for(const m of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)){const link=m[1].replaceAll('&amp;','&');if(/^(?:https?:|data:|#)/.test(link))continue;const path=decodeURIComponent(link.split(/[?#]/)[0]);if(!path)continue;const target=resolve(dirname(file),path);if(!target.startsWith(site+'/'))failures.push([file,link,'escape']);else if(!existsSync(target))failures.push([file,link,'missing']);}}
 assert.deepEqual(failures,[]);
});
test('all converted examples decode and match exact semantic verification expectations',async()=>{
 const{createRuntime,createCompleteRuntimeOptions}=await import(pathToFileURL(join(root,'.work/builds/ddn/ddn/packages/runtime/src/index.js')));
 const failures=[];
 for(const entry of catalogue.corpus){const text=readFileSync(join(site,entry.entry),'utf8');assert.match(text,/^version ddn-next-1\n/);assert.doesNotMatch(text,/^\s*(?:ddn\s+["']0\.|module\s|data\s+\w+\s*\{)/m);const runtime=createRuntime(createCompleteRuntimeOptions());try{const opened=await runtime.open({entry:entry.entry,files:[{id:entry.entry,text,revision:'1',encoding:'utf-8',writable:true}]});if(!opened.snapshot){failures.push({entry:entry.entry,diagnostics:opened.diagnostics});continue;}const result=await runtime.verifier.verifyModel(opened.snapshot,{scope:{kind:'workarea'},purpose:'design',level:'semantic'});if(!matchesGalleryVerification(entry.entry,result))failures.push({entry:entry.entry,outcome:result.outcome,diagnostics:result.diagnostics});const views=opened.snapshot.normalized.files[0].document.views;for(const view of entry.views)assert.ok(views.some(v=>v.id===view.id&&v.profile===view.profile),entry.entry+' '+view.id);}finally{runtime.destroy();}}
 assert.deepEqual(failures,[]);
});
test('offline payloads exactly match downloadable DDN sources',()=>{
 for(const item of catalogue.corpus){const text=readFileSync(join(site,item.entry),'utf8'),js=readFileSync(join(site,item.entry+'.js'),'utf8'),payload=JSON.parse(js.slice('window.DDN_SITE_INITIAL='.length).trim().replace(/;$/,''));assert.equal(payload.sources.entry,item.entry);assert.equal(payload.sources.files[0].text,text);assert.equal(payload.sources.files.length,1);}
 assert.doesNotMatch(readFileSync(join(site,'assets/ddn-runtime.js'),'utf8'),/ddn-resolved@0\.5|ddn-workspace@1|notation\/runtime|DDN\.VERSION/);
});

test('approved public gallery capture retains its safe relation without private fields or identifiers',()=>{
 const svg=readFileSync(join(site,'gallery/views/examples-basics-14-authorized-export.ddn--public.svg'),'utf8');
 assert.doesNotMatch(svg,/SALARY_SECRET_CANARY|salary|ddn\.examples\.export::model/);assert.match(svg,/approved projection/);assert.match(svg,/staff_id/);assert.match(svg,/display_name/);assert.match(svg,/>ref<|>references<|>refers to</);
});
