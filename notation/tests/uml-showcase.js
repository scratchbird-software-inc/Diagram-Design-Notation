/* SPDX-License-Identifier: GPL-2.0-or-later. B1-061 (RFC-125): the UML 2.5.1 sweep —
 * one end-to-end check+render per diagram family, fourteen families. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function filesFor(entry){const files={};const visit=name=>{if(Object.hasOwn(files,name))return;files[name]=fs.readFileSync(path.join(root,name),'utf8');for(const imp of A.parse(files[name],name).imports)visit(A.resolvePath(name,imp.path));};visit(entry);return files;}

/* The 14 UML 2.5.1 diagram families → an example entry + view + profile. */
const SWEEP=[
 ['class','website/examples/basics/75-uml-class-complete.ddn','associations','uml.structure@2'],
 ['object','website/examples/basics/81-uml-remainder.ddn','objects','uml.object@2'],
 ['package','website/examples/basics/81-uml-remainder.ddn','packages','uml.structure@2'],
 ['deployment','website/examples/basics/78-uml-deployment.ddn','main','uml.deployment@1'],
 ['composite structure','website/examples/basics/79-uml-composite.ddn','structures','uml.composite@1'],
 ['component','website/examples/basics/79-uml-composite.ddn','components','uml.composite@1'],
 ['use case','website/examples/basics/81-uml-remainder.ddn','usecases','uml.usecase@3'],
 ['activity','website/examples/basics/80-uml-activity.ddn','pins','uml.activity@2'],
 ['state machine','website/examples/basics/77-uml-statemachine-complete.ddn','pseudostates','uml.statemachine@1'],
 ['sequence','website/examples/basics/76-uml-sequence-complete.ddn','fragments','uml.sequence@2'],
 ['communication','website/examples/basics/81-uml-remainder.ddn','comms','uml.communication@2'],
 ['timing','website/examples/basics/81-uml-remainder.ddn','timing','uml.timing@2'],
 ['interaction overview','website/examples/basics/81-uml-remainder.ddn','overview','uml.interaction_overview@2'],
 ['profile','website/examples/basics/81-uml-remainder.ddn','profiles','uml.profile@1'],
];

for(const [family,entry,view,profile] of SWEEP){
 test('UML family '+family+': '+entry+'#view '+view+' checks and renders ('+profile+')',()=>{
  const ws=A.createWorkspace(filesFor(entry));
  const r=ws.renderSync({entry,view});
  assert.match(r.svg,/<svg/,'no SVG for '+family);
  assert.equal(r.profiles.projection.profile,profile,'profile mismatch for '+family);
  ws.destroy();
 });
}
test('Sweep covers all 14 UML 2.5.1 diagram families',()=>{
 assert.equal(SWEEP.length,14);
 assert.equal(new Set(SWEEP.map(x=>x[0])).size,14);});

const failed=results.filter(r=>!r.pass);
console.log('uml-showcase:',results.length-failed.length+'/'+results.length,'passed (14 UML 2.5.1 diagram families verified end-to-end)');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
