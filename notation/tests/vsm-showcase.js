/* SPDX-License-Identifier: GPL-2.0-or-later. B1-081: the VSM sweep. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function filesFor(entry){const files={};const visit=name=>{if(Object.hasOwn(files,name))return;files[name]=fs.readFileSync(path.join(root,name),'utf8');for(const imp of A.parse(files[name],name).imports)visit(A.resolvePath(name,imp.path));};visit(entry);return files;}

const SWEEP=[
 ['vsm','website/examples/basics/97-vsm.ddn','map','vsm.basic@1',
  ['ddn-vsm-ladder','ddn-vsm-einfo','Σ 6.5','>I<','data-shape="burst"','data-shape="triangledown"','C/O 30 min','VA / NVA timeline']],
];
for(const [family,entry,view,profile,marks] of SWEEP){
 test('VSM family '+family+': '+entry+'#view '+view+' checks and renders ('+profile+')',()=>{
  const ws=A.createWorkspace(filesFor(entry));
  const r=ws.renderSync({entry,view});
  assert.match(r.svg,/<svg/,'no SVG for '+family);
  assert.equal(r.profiles.projection.profile,profile,'profile mismatch for '+family);
  for(const s of marks)assert.ok(r.svg.includes(s),family+' missing: '+s);
  ws.destroy();
 });
}
const failed=results.filter(r=>!r.pass);
console.log('vsm-showcase:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
