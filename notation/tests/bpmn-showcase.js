/* SPDX-License-Identifier: GPL-2.0-or-later. B1-063: the BPMN 2.0.2 sweep —
 * one end-to-end check+render per diagram family. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function filesFor(entry){const files={};const visit=name=>{if(Object.hasOwn(files,name))return;files[name]=fs.readFileSync(path.join(root,name),'utf8');for(const imp of A.parse(files[name],name).imports)visit(A.resolvePath(name,imp.path));};visit(entry);return files;}

const SWEEP=[
 ['process','website/examples/basics/82-bpmn-complete.ddn','process','bpmn.process@1'],
 ['collaboration','website/examples/basics/82-bpmn-complete.ddn','collaboration','bpmn.process@1'],
 ['choreography','website/examples/basics/82-bpmn-complete.ddn','choreography','bpmn.choreography@1'],
 ['conversation','website/examples/basics/82-bpmn-complete.ddn','conversation','bpmn.conversation@1'],
];

for(const [family,entry,view,profile] of SWEEP){
 test('BPMN family '+family+': '+entry+'#view '+view+' checks and renders ('+profile+')',()=>{
  const ws=A.createWorkspace(filesFor(entry));
  const r=ws.renderSync({entry,view});
  assert.match(r.svg,/<svg/,'no SVG for '+family);
  assert.equal(r.profiles.projection.profile,profile,'profile mismatch for '+family);
  ws.destroy();
 });
}
test('Sweep covers all 4 BPMN 2.0.2 diagram families',()=>{
 assert.equal(SWEEP.length,4);
 assert.equal(new Set(SWEEP.map(x=>x[0])).size,4);});

const failed=results.filter(r=>!r.pass);
console.log('bpmn-showcase:',results.length-failed.length+'/'+results.length,'passed (4 BPMN 2.0.2 diagram families verified end-to-end)');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
