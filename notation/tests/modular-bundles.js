/* SPDX-License-Identifier: GPL-2.0-or-later. Modular runtime bundles (B1-004): fresh VM contexts per scenario. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),results=[];
const A=require('../dist/ddn.global.js'); // reference: the unchanged all-in-one bundle
const read=n=>fs.readFileSync(path.join(dist,n),'utf8');
const basics=f=>fs.readFileSync(path.join(root,'../website/examples/basics',f),'utf8');
const quality=f=>fs.readFileSync(path.join(root,'../website/examples/quality',f),'utf8');
const ERD={'01-customer.ddn':basics('01-customer.ddn'),'shared.ddn':basics('shared.ddn'),'customer-data.ddn':basics('customer-data.ddn')};
const CHART={'20-funnel-chart.ddn':basics('20-funnel-chart.ddn'),'shared.ddn':basics('shared.ddn')};
const FISHBONE=Object.fromEntries(['model.ddn','details.ddn','formats.ddn','views.ddn'].map(f=>[f,quality(f)]));
function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.code||'',e.message);}}
function context(...bundles){const c=vm.createContext({console,performance,TextEncoder,TextDecoder});for(const b of bundles)vm.runInContext(read('ddn-'+b+'.js'),c,{filename:'ddn-'+b+'.js'});return c;}
const full=(files,entry,view)=>A.createWorkspace(files).renderSync({entry,view}).svg;

test('core alone parses and checks (no rendering bundle)',()=>{
 const c=context('core'),ws=c.DDNLive.createWorkspace(ERD);
 const ir=ws.resolve('01-customer.ddn','overview');
 assert.ok(ir.elements.length>0&&ir.view.id.endsWith('::overview'));
 assert.equal(c.DDNLive.runtime.interaction,null); // presence-tolerant construction (A3)
 assert.ok(c.DDNLive.parse(ERD['01-customer.ddn'],'01-customer.ddn').declarations.length>0);
 assert.equal(typeof c.DDNEngine.registerProjectionRenderer,'function');
 assert.deepEqual([...c.DDNEngine.registeredKinds()],[]);
});
test('core alone render(graph) throws DDN-E010 naming ddn-graph.js',()=>{
 const c=context('core'),ws=c.DDNLive.createWorkspace(ERD);
 assert.throws(()=>ws.renderSync({entry:'01-customer.ddn',view:'overview'}),e=>e.code==='DDN-E010'&&e.message.includes('graph')&&e.message.includes('ddn-graph.js'));
 assert.throws(()=>ws.projectionPlan('01-customer.ddn','overview'),e=>e.code==='DDN-E010'&&e.message.includes('ddn-graph.js'));
});
test('core+graph renders ERD byte-identical to the full bundle',()=>{
 const c=context('core','graph'),ws=c.DDNLive.createWorkspace(ERD);
 const svg=ws.renderSync({entry:'01-customer.ddn',view:'overview'}).svg;
 assert.equal(svg,full(ERD,'01-customer.ddn','overview'));
});
test('core+graph render(chart) throws DDN-E010 naming ddn-projections.js',()=>{
 const c=context('core','graph'),ws=c.DDNLive.createWorkspace(CHART);
 assert.throws(()=>ws.renderSync({entry:'20-funnel-chart.ddn',view:'funnel'}),e=>e.code==='DDN-E010'&&e.message.includes('chart')&&e.message.includes('ddn-projections.js'));
 assert.throws(()=>ws.projectionPlan('20-funnel-chart.ddn','funnel'),e=>e.code==='DDN-E010'&&e.message.includes('ddn-projections.js'));
});
test('core+graph+projections renders chart byte-identical to full',()=>{
 const c=context('core','graph','projections'),ws=c.DDNLive.createWorkspace(CHART);
 assert.equal(ws.renderSync({entry:'20-funnel-chart.ddn',view:'funnel'}).svg,full(CHART,'20-funnel-chart.ddn','funnel'));
});
test('quality module loads and registers fishbone/decision',()=>{
 const c=context('core','graph','quality');
 assert.ok(c.DDNEngine.hasRenderer('fishbone')&&c.DDNEngine.hasRenderer('decision'));
 // quality kinds compose the page through ddn-projections.js (A2): without it, coded error
 const ws=c.DDNLive.createWorkspace(FISHBONE);
 assert.throws(()=>ws.renderSync({entry:'views.ddn',view:'fishbone'}),e=>e.code==='DDN-E010'&&e.message.includes('ddn-projections.js'));
});
test('core+graph+quality+projections renders fishbone byte-identical to full',()=>{
 const c=context('core','graph','quality','projections'),ws=c.DDNLive.createWorkspace(FISHBONE);
 assert.equal(ws.renderSync({entry:'views.ddn',view:'fishbone'}).svg,full(FISHBONE,'views.ddn','fishbone'));
});
test('double load of any module is a no-op',()=>{
 const c=vm.createContext({console,performance,TextEncoder,TextDecoder});
 for(const b of ['core','graph','projections','quality'])vm.runInContext(read('ddn-'+b+'.js'),c,{filename:b});
 for(const b of ['core','graph','projections','quality'])vm.runInContext(read('ddn-'+b+'.js'),c,{filename:b+' again'});
 const ws=c.DDNLive.createWorkspace(ERD);
 assert.equal(ws.renderSync({entry:'01-customer.ddn',view:'overview'}).svg,full(ERD,'01-customer.ddn','overview'));
});
test('mixed-version guard intact (core refuses a different DDNLive)',()=>{
 const c=vm.createContext({console,performance});
 c.DDNLive={VERSION:'0.0.0-different'};
 assert.throws(()=>vm.runInContext(read('ddn-core.js'),c),/different DDNLive runtime/);
});
test('load-order guards name the missing bundle',()=>{
 assert.throws(()=>context('graph'),/ddn-graph requires ddn-core\.js/);
 assert.throws(()=>context('core','projections'),/ddn-projections requires ddn-graph\.js/);
 assert.throws(()=>context('core','quality'),/ddn-quality requires ddn-graph\.js/);
});
test('determinism preserved in modular rendering',()=>{
 const c=context('core','graph','projections'),ws=c.DDNLive.createWorkspace(CHART);
 assert.equal(ws.renderSync({entry:'20-funnel-chart.ddn',view:'funnel'}).svg,ws.renderSync({entry:'20-funnel-chart.ddn',view:'funnel'}).svg);
 const g=context('core','graph'),gw=g.DDNLive.createWorkspace(ERD);
 assert.equal(gw.renderSync({entry:'01-customer.ddn',view:'overview'}).svg,gw.renderSync({entry:'01-customer.ddn',view:'overview'}).svg);
});
test('sdk-build.json lists every bundle with bytes/sha256/files and per-format freshness digests',()=>{
 const b=JSON.parse(fs.readFileSync(path.join(root,'../release/validation/sdk-build.json'),'utf8')).bundles;
 for(const n of ['core','graph','projections','quality','global']){assert.ok(b[n],'bundle '+n);assert.ok(b[n].bytes>0&&/^[a-f0-9]{64}$/.test(b[n].sha256)&&b[n].files.length>0);}
 assert.equal(b.core.bytes,fs.statSync(path.join(dist,'ddn-core.js')).size);
 assert.equal(b.global.bytes,fs.statSync(path.join(dist,'ddn.global.js')).size);
 const crypto=require('node:crypto'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
 for(const [n,info] of Object.entries(b)){
  const stem=n==='global'?'ddn.global':'ddn-'+n;
  for(const [fmt,meta] of Object.entries(info.formats)){
   const f=fmt==='mjs'&&n==='global'?'ddn.mjs':stem+'.'+fmt;
   const content=fs.readFileSync(path.join(dist,f));
   assert.equal(meta.bytes,content.length,n+' '+f+' bytes stale — run build:sdk');
   assert.equal(meta.sha256,sha(content),n+' '+f+' sha256 stale — run build:sdk');
   assert.ok(meta.gzipBytes>0);
  }
 }
});
const passed=results.filter(r=>r.pass).length;console.log(`modular-bundles ${passed}/${results.length}`);
if(passed!==results.length)process.exitCode=1;
