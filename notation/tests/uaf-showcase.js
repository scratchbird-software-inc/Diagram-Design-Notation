/* SPDX-License-Identifier: GPL-2.0-or-later. B1-073: the UAF grid sweep —
 * one check+render per domain, mirroring the other showcases. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function filesFor(entry){const files={};const visit=name=>{if(Object.hasOwn(files,name))return;files[name]=fs.readFileSync(path.join(root,name),'utf8');for(const imp of A.parse(files[name],name).imports)visit(A.resolvePath(name,imp.path));};visit(entry);return files;}

const E='website/examples/basics/89-uaf.ddn';
const SWEEP=[
 ['strategic',['«Capability»','«EnterpriseGoal»','data-shape="tag"','«capabilityDependency»','«supports»','«mapsTo»']],
 ['operational',['«OperationalPerformer»','«OperationalNode»','«OperationalActivity»','«OperationalExchange»','«performs»','«mapsTo»']],
 ['services',['«ServiceSpecification»','«ServiceFunction»','«ServicePolicy»','«exhibits»','«compliesWith»']],
 ['systems',['«System»','«SystemFunction»','«Implementer»','«performs»','«mapsTo»']],
 ['personnel',['«Person»','«Organization»','«Post»','«Responsibility»','«assignedTo»','«owns»']],
 ['resources',['«ResourcePerformer»','«Resource»','«ResourceFunction»','«Technology»','«performs»','«forecast»']],
 ['security',['«SecurityElement»','«SecurityControl»','«Threat»','«Asset»','«mitigates»']],
 ['projects',['«Project»','«ProjectMilestone»','«WorkPackage»','«milestoneDependency»']],
 ['standards',['«Standard»','«StandardCollection»','«Protocol»','«compliesWith»','«forecast»']],
 ['actualresources',['«ActualResource»','«ActualOrganization»','«ActualPerson»','«assignedTo»','«owns»']],
 ['dictionary',['«DictionaryEntry»','«mapsTo»']],
 ['summary',['«ArchitectureDescription»','«Viewpoint»','«ModelReference»','«mapsTo»']],
];
for(const [domain,marks] of SWEEP){
 test('UAF domain '+domain+': '+E+'#view '+domain+' checks and renders (uaf.'+domain+'@1)',()=>{
  const ws=A.createWorkspace(filesFor(E));
  const r=ws.renderSync({entry:E,view:domain});
  assert.match(r.svg,/<svg/,'no SVG for '+domain);
  assert.equal(r.profiles.projection.profile,'uaf.'+domain+'@1','profile mismatch for '+domain);
  for(const s of marks)assert.ok(r.svg.includes(s),domain+' missing: '+s);
  ws.destroy();
 });
}
const failed=results.filter(r=>!r.pass);
console.log('uaf-showcase:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
