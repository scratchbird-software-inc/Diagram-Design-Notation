/* SPDX-License-Identifier: GPL-2.0-or-later. B1-065: the SysML 1.6 sweep —
 * every SysML diagram family end-to-end, mirroring uml/bpmn/cmmn-showcase. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function filesFor(entry){const files={};const visit=name=>{if(Object.hasOwn(files,name))return;files[name]=fs.readFileSync(path.join(root,name),'utf8');for(const imp of A.parse(files[name],name).imports)visit(A.resolvePath(name,imp.path));};visit(entry);return files;}

const SWEEP=[
 ['requirements','website/examples/basics/84-sysml-requirements.ddn','requirements','sysml.requirements@1',['«requirement»','«deriveReqt»','«verify»','«satisfy»','«allocate»','«testCase»']],
 ['package','website/examples/basics/84-sysml-requirements.ddn','packages','sysml.package@1',['«import»','«merge»','«access»']],
 ['bdd','website/examples/basics/85-sysml-blocks.ddn','bdd','sysml.bdd@2',['«block»','«valueType»','«interfaceBlock»','«flowSpecification»','values','L/min']],
 ['ibd','website/examples/basics/85-sysml-blocks.ddn','ibd','sysml.ibd@2',['data-port-type="proxy"','data-port-type="full"','data-conjugated','data-nested-port','ddn-verb-itemflow']],
 ['parametric','website/examples/basics/85-sysml-blocks.ddn','parametric','sysml.parametric@2',['«constraint»','constraints']],
 ['usecase','website/examples/basics/86-sysml-behavioral.ddn','usecase','sysml.usecase@1',['«include»']],
 ['activity','website/examples/basics/86-sysml-behavioral.ddn','activity','sysml.activity@1',['rate = 10 L/min','continuous','probability = 0.9','data-streaming']],
 ['statemachine','website/examples/basics/86-sysml-behavioral.ddn','states','sysml.statemachine@1',['start','dry run [level == 0]']],
 ['sequence','website/examples/basics/86-sysml-behavioral.ddn','sequence','sysml.sequence@1',['startPump()','ack']],
];
for(const [family,entry,view,profile,marks] of SWEEP){
 test('SysML family '+family+': '+entry+'#view '+view+' checks and renders ('+profile+')',()=>{
  const ws=A.createWorkspace(filesFor(entry));
  const r=ws.renderSync({entry,view});
  assert.match(r.svg,/<svg/,'no SVG for '+family);
  assert.equal(r.profiles.projection.profile,profile,'profile mismatch for '+family);
  for(const s of marks)assert.ok(r.svg.includes(s),family+' missing: '+s);
  ws.destroy();
 });
}
const failed=results.filter(r=>!r.pass);
console.log('sysml-showcase:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
