/* SPDX-License-Identifier: GPL-2.0-or-later. B1-090: the cross-file addressing sweep. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function filesFor(entry){const files={};const visit=name=>{if(Object.hasOwn(files,name))return;files[name]=fs.readFileSync(path.join(root,name),'utf8');for(const imp of A.parse(files[name],name).imports)visit(A.resolvePath(name,imp.path));};visit(entry);return files;}

const SWEEP=[
 ['xref','website/examples/basics/108-uaf-traceability.ddn','sv','uaf.strategic@1',
  ['data-external="true"','retail.ops::ops.deliver','retail.ops::ops.ship','ddn-xlink','Order fulfillment']],
];
for(const [family,entry,view,profile,marks] of SWEEP){
 test('Cross-file family '+family+': '+entry+'#view '+view+' checks and renders ('+profile+')',()=>{
  const files=filesFor(entry);
  /* B1-090: the base file is not imported — it joins through the
   * architecture container (or x_link), so add it to the workspace map. */
  for(const extra of ['108-uaf-operations.ddn','108-uaf-governance.ddn']){
   const p='website/examples/basics/'+extra;
   if(!Object.hasOwn(files,p))files[p]=fs.readFileSync(path.join(root,p),'utf8');
  }
  const ws=A.createWorkspace(files);
  const r=ws.renderSync({entry,view});
  assert.match(r.svg,/<svg/,'no SVG for '+family);
  assert.equal(r.profiles.projection.profile,profile,'profile mismatch for '+family);
  for(const s of marks)assert.ok(r.svg.includes(s),family+' missing: '+s);
  /* The base file's own view renders standalone too. */
  const r2=ws.renderSync({entry:'website/examples/basics/108-uaf-operations.ddn',view:'ov'});
  assert.match(r2.svg,/<svg/,'base view did not render');
  ws.destroy();
 });
}
const failed=results.filter(r=>!r.pass);
console.log('xref-showcase:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
