/* SPDX-License-Identifier: GPL-2.0-or-later. npm packaging (B1-005): pack, extract, require the
 * extracted package directly — no network, no registry. Each subpath proof runs in a
 * fresh child node process (the same-version global guard makes in-process reuse a no-op). */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..','..'),results=[];
const basics=f=>fs.readFileSync(path.join(root,'website/examples/basics',f),'utf8');
const ERD={'01-customer.ddn':basics('01-customer.ddn'),'shared.ddn':basics('shared.ddn'),'customer-data.ddn':basics('customer-data.ddn')};
function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.code||'',e.message);}}
/* Pack into a temp dir and extract to a temp consumer dir. */
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ddn-pack-'));
cp.execFileSync('npm',['pack','--pack-destination',tmp],{cwd:path.join(root,'notation'),stdio:'pipe'});
const tgz=fs.readdirSync(tmp).find(f=>f.endsWith('.tgz'));
assert.ok(tgz,'npm pack produced a tarball');
const consumer=fs.mkdtempSync(path.join(os.tmpdir(),'ddn-consumer-'));
cp.execFileSync('tar',['-xzf',path.join(tmp,tgz),'-C',consumer],{stdio:'pipe'});
const pkg=path.join(consumer,'package');
const pj=JSON.parse(fs.readFileSync(path.join(pkg,'package.json'),'utf8'));
const run=(script,esm)=>cp.execFileSync(process.execPath,esm?['--input-type=module','-e',script]:['-e',script],{encoding:'utf8'});
const erd=JSON.stringify(ERD),ref=JSON.stringify(path.join(consumer,'ref.svg'));

test('package.json carries main/module/types/exports/files/sideEffects',()=>{
 assert.equal(pj.name,'@ddn/notation');assert.equal(pj.version,'0.6.0-beta.1');
 assert.equal(pj.main,'dist/ddn.global.js');assert.equal(pj.module,'dist/ddn.mjs');assert.equal(pj.types,'dist/ddn.d.ts');
 assert.deepEqual(Object.keys(pj.exports),['.','./core','./graph','./projections','./quality','./package.json']);
 for(const k of['.','./core','./graph','./projections','./quality']){
  assert.ok(pj.exports[k].import.default.endsWith('.mjs')&&pj.exports[k].require.default.endsWith('.js'),k);
  assert.ok(pj.exports[k].import.types.endsWith('.d.mts')&&pj.exports[k].require.types.endsWith('.d.ts'),k);
 }
 assert.deepEqual(pj.files,['dist','README.md']);assert.equal(pj.sideEffects,true);
});
test('tarball file list matches the files allowlist (dist + README.md + package.json)',()=>{
 const list=cp.execFileSync('tar',['-tzf',path.join(tmp,tgz)],{encoding:'utf8'}).trim().split('\n');
 for(const f of list)assert.match(f,/^package\/(dist\/.+|README\.md|package\.json)$/,'unexpected path '+f);
 assert.ok(list.includes('package/README.md')&&list.includes('package/package.json'));
 assert.ok(list.includes('package/dist/ddn.global.js')&&list.includes('package/dist/ddn.mjs'));
});
test('exports map targets all exist inside the tarball',()=>{
 const list=new Set(cp.execFileSync('tar',['-tzf',path.join(tmp,tgz)],{encoding:'utf8'}).trim().split('\n'));
 for(const k of['.','./core','./graph','./projections','./quality'])
  for(const cond of['import','require'])for(const leaf of['default','types'])
   assert.ok(list.has('package/'+pj.exports[k][cond][leaf].replace('./','')),k+' '+cond+' '+leaf);
});
test('require(full) exposes VERSION 0.6.0-beta.1 and renders',()=>{
 run(`const fs=require('node:fs');
 const api=require(${JSON.stringify(path.join(pkg,'dist/ddn.global.js'))});
 if(api.VERSION!=='0.6.0-beta.1')throw new Error('bad VERSION '+api.VERSION);
 const svg=api.createWorkspace(${erd}).renderSync({entry:'01-customer.ddn',view:'overview'}).svg;
 if(!svg.includes('<svg'))throw new Error('no svg');
 fs.writeFileSync(${ref},svg);`);
 assert.ok(fs.readFileSync(path.join(consumer,'ref.svg'),'utf8').includes('<svg'));
});
test('core subpath lacks render: DDN-E010 naming ddn-graph.js',()=>{
 run(`const api=require(${JSON.stringify(path.join(pkg,'dist/ddn-core.js'))});
 if(api.VERSION!=='0.6.0-beta.1')throw new Error('bad VERSION');
 const ws=api.createWorkspace(${erd});
 try{ws.renderSync({entry:'01-customer.ddn',view:'overview'});throw new Error('rendered without graph');}
 catch(e){if(e.code!=='DDN-E010'||!e.message.includes('ddn-graph.js'))throw e;}`);
});
test('graph subpath (CJS, core required first, same realm) renders byte-identical to full',()=>{
 run(`const fs=require('node:fs');
 const api=require(${JSON.stringify(path.join(pkg,'dist/ddn-core.js'))});
 require(${JSON.stringify(path.join(pkg,'dist/ddn-graph.js'))});
 const svg=api.createWorkspace(${erd}).renderSync({entry:'01-customer.ddn',view:'overview'}).svg;
 if(svg!==fs.readFileSync(${ref},'utf8'))throw new Error('SVG mismatch vs full');`);
});
test('ESM wrappers import prerequisites first; same-version stacking is a no-op',()=>{
 const script=`import fs from 'node:fs';
 const g=await import(${JSON.stringify(path.join(pkg,'dist/ddn-graph.mjs'))});
 const q=await import(${JSON.stringify(path.join(pkg,'dist/ddn-quality.mjs'))});
 const p=await import(${JSON.stringify(path.join(pkg,'dist/ddn-projections.mjs'))});
 const f=await import(${JSON.stringify(path.join(pkg,'dist/ddn.mjs'))});
 if(g.default.VERSION!=='0.6.0-beta.1'||typeof g.parse!=='function')throw new Error('ESM surface missing');
 if(q.default!==g.default||p.default!==g.default)throw new Error('subpath wrappers must share one DDNLive');
 const svg=g.default.createWorkspace(${erd}).renderSync({entry:'01-customer.ddn',view:'overview'}).svg;
 if(svg!==fs.readFileSync(${ref},'utf8'))throw new Error('ESM render mismatch vs full');`;
 run(script,true);
});
test('no dependencies added to the shipped package',()=>{
 assert.ok(!pj.dependencies&&!pj.peerDependencies,'shipped package must stay dependency-free');
});
fs.rmSync(tmp,{recursive:true,force:true});fs.rmSync(consumer,{recursive:true,force:true});
const passed=results.filter(r=>r.pass).length;console.log(`packaging ${passed}/${results.length}`);
if(passed!==results.length)process.exitCode=1;
