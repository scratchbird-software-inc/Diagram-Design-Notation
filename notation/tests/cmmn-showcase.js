/* SPDX-License-Identifier: GPL-2.0-or-later. B1-064: the CMMN 1.1 sweep —
 * the case-diagram family end-to-end, mirroring uml-showcase.js / bpmn-showcase.js. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function filesFor(entry){const files={};const visit=name=>{if(Object.hasOwn(files,name))return;files[name]=fs.readFileSync(path.join(root,name),'utf8');for(const imp of A.parse(files[name],name).imports)visit(A.resolvePath(name,imp.path));};visit(entry);return files;}

const SWEEP=[
 ['case','website/examples/basics/83-cmmn-complete.ddn','v','cmmn.complete@1'],
];
for(const [family,entry,view,profile] of SWEEP){
 test('CMMN family '+family+': '+entry+'#view '+view+' checks and renders ('+profile+')',()=>{
  const ws=A.createWorkspace(filesFor(entry));
  const r=ws.renderSync({entry,view});
  assert.match(r.svg,/<svg/,'no SVG for '+family);
  assert.equal(r.profiles.projection.profile,profile,'profile mismatch for '+family);
  for(const s of ['caseplan','ddn-planning-table','ddn-verb-sentryref'])assert.ok(r.svg.includes(s),'missing: '+s);
  ws.destroy();
 });
}
const failed=results.filter(r=>!r.pass);
console.log('cmmn-showcase:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
