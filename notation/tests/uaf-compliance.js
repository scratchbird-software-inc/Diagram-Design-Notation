/* SPDX-License-Identifier: GPL-2.0-or-later. B1-073: UAF 1.2 compliance fixtures . */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.uaf";
data st {
    object cap "Self-service" { kind: "uaf.capability"; }
    object cap2 "Online retail" { kind: "uaf.capability"; }
    object goal "Grow sales" { kind: "uaf.enterprisegoal"; }
    object vision "Vision 2030" { kind: "uaf.enterprisevision"; }
    object phase "Phase 2" { kind: "uaf.strategicphase"; }
    object desk "Order desk" { kind: "uaf.opperformer"; }
    object act "Take order" { kind: "uaf.opactivity"; }
    object alice "Alice" { kind: "uaf.person"; }
    object org "Retail org" { kind: "uaf.organization"; }
    relation d1 "" @cap -> @cap2 { kind: "uaf.capabilitydependency"; }
    relation s1 "" @cap -> @goal { kind: "uaf.supports"; }
    relation e1 "" @desk -> @cap { kind: "uaf.exhibits"; }
    relation p1 "" @desk -> @act { kind: "uaf.performs"; }
    relation m1 "" @vision -> @cap { kind: "uaf.mapsto"; }
    relation a1 "" @alice -> @org { kind: "uaf.assignedto"; }
    relation o1 "" @org -> @alice { kind: "uaf.owns"; }
}
view v "Grid" { data: [@st]; projection { kind: graph; profile: "uaf.strategic@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view='v',changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('capability tag silhouette and domain keywords render',()=>{const r=run();
 assert.ok(r.svg.includes('data-shape="tag"'),'tag silhouette missing');
 for(const s of ['«Capability»','«EnterpriseGoal»','«EnterpriseVision»','«StrategicPhase»','«OperationalPerformer»','«OperationalActivity»','«Person»','«Organization»'])assert.ok(r.svg.includes(s),'missing: '+s);});
test('stereotyped verbs render guillemet labels',()=>{const r=run();
 for(const s of ['«capabilityDependency»','«supports»','«exhibits»','«performs»','«mapsTo»','«assignedTo»','«owns»'])assert.ok(r.svg.includes(s),'missing: '+s);});
test('verb endpoint contracts are registry-enforced (DDN102)',()=>{
 throws(()=>run('v',edit('relation d1 "" @cap -> @cap2 { kind: "uaf.capabilitydependency"','relation d1 "" @cap -> @goal { kind: "uaf.capabilitydependency"')),'DDN102');
 throws(()=>run('v',edit('relation e1 "" @desk -> @cap { kind: "uaf.exhibits"','relation e1 "" @goal -> @cap { kind: "uaf.exhibits"')),'DDN102');});
test('capabilitydependency between non-capabilities rejected',()=>{
 throws(()=>run('v',edit('relation d1 "" @cap -> @cap2','relation d1 "" @desk -> @cap2')),'DDN102');});

const failed=results.filter(r=>!r.pass);
console.log('uaf-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
