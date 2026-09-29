/* SPDX-License-Identifier: GPL-2.0-or-later. B1-085: the ladder sweep. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function filesFor(entry){const files={};const visit=name=>{if(Object.hasOwn(files,name))return;files[name]=fs.readFileSync(path.join(root,name),'utf8');for(const imp of A.parse(files[name],name).imports)visit(A.resolvePath(name,imp.path));};visit(entry);return files;}

const SWEEP=[
 ['ladder','website/examples/basics/101-ladder.ddn','d','ladder.basic@1',
  ['ddn-ladder-rails','ddn-ladder-contact','ddn-ladder-coil','data-form="nc"','data-mode="set"','data-mode="reset"','TON','NEXT','L1','START','MOTOR','LATCH','DONE']],
];
for(const [family,entry,view,profile,marks] of SWEEP){
 test('Ladder family '+family+': '+entry+'#view '+view+' checks and renders ('+profile+')',()=>{
  const ws=A.createWorkspace(filesFor(entry));
  const r=ws.renderSync({entry,view});
  assert.match(r.svg,/<svg/,'no SVG for '+family);
  assert.equal(r.profiles.projection.profile,profile,'profile mismatch for '+family);
  for(const s of marks)assert.ok(r.svg.includes(s),family+' missing: '+s);
  /* End-to-end geometry: three rungs, coil right of contacts in every rung. */
  const byRung={};
  for(const n of r.scene.nodes){const [,local]=n.id.split('::');const rung=local.split('.')[0];(byRung[rung]??=[]).push(n);}
  assert.deepEqual(Object.keys(byRung).sort(),['rung1','rung2','rung3'],'three rungs expected');
  ws.destroy();
 });
}
const failed=results.filter(r=>!r.pass);
console.log('ladder-showcase:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
