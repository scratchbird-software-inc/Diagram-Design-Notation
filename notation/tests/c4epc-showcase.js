/* SPDX-License-Identifier: GPL-2.0-or-later. B1-076: C4 deployment/dynamic +
 * EPC complete sweep, mirroring the other showcases. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function filesFor(entry){const files={};const visit=name=>{if(Object.hasOwn(files,name))return;files[name]=fs.readFileSync(path.join(root,name),'utf8');for(const imp of A.parse(files[name],name).imports)visit(A.resolvePath(name,imp.path));};visit(entry);return files;}

const E='website/examples/basics/92-c4-epc.ddn';
const SWEEP=[
 ['c4-deployment','deployment','c4.deployment@1',['node3d','shop.war','ddn-c4tag','[infra, edge]','1..2']],
 ['c4-dynamic','dynamic','c4.dynamic@1',['1 · browse catalog','2 · query products','2.1 · product list','3 · render page']],
 ['epc-complete','epc','epc.complete@1',['Check stock','Pick items','Warehouse','Picker','Pick list','Billing process','Warehouse lane']],
];
for(const [family,view,profile,marks] of SWEEP){
 test('Family '+family+': '+E+'#view '+view+' checks and renders ('+profile+')',()=>{
  const ws=A.createWorkspace(filesFor(E));
  const r=ws.renderSync({entry:E,view});
  assert.match(r.svg,/<svg/,'no SVG for '+family);
  assert.equal(r.profiles.projection.profile,profile,'profile mismatch for '+family);
  for(const s of marks)assert.ok(r.svg.includes(s),family+' missing: '+s);
  ws.destroy();
 });
}
const failed=results.filter(r=>!r.pass);
console.log('c4epc-showcase:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
