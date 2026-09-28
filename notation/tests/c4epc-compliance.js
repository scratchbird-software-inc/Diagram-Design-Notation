/* SPDX-License-Identifier: GPL-2.0-or-later. B1-076: C4 deployment/dynamic + EPC completion fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.c4epc";
data depx {
    object lb "Edge" { kind: "uml.node"; x_c4tag: { tags: [ "infra" ]; }; }
    object app "Server" { kind: "uml.device"; }
    object war "shop.war" { kind: "uml.artifact"; }
    relation d1 "" @war -> @app { kind: "uml.deploy"; }
}
data dynx {
    object cli "Customer" { kind: "c4.person"; }
    object web "Web app" { kind: "c4.container"; }
    relation m1 "browse" @cli -> @web { kind: "uml.message"; x_message: { seq: "1" }; }
    relation m2 "render" @web -> @cli { kind: "uml.message"; x_message: { seq: "1.1" }; x_return: true; }
}
data e {
    object ev "Received" { kind: "epk.event"; }
    object fn "Check" { kind: "epk.function"; }
    object c1 "" { kind: "epk.connector"; x_epc: { operator: "and" }; }
    object fn2 "Reserve" { kind: "epk.function"; }
    object fn3 "Pick" { kind: "epk.function"; }
    object c2 "" { kind: "epk.connector"; x_epc: { operator: "and" }; }
    object ev2 "Ready" { kind: "epk.event"; }
    object wh "Warehouse" { kind: "epk.orgunit"; }
    object picker "Picker" { kind: "epk.role"; }
    object doc "Pick list" { kind: "epk.infoobject"; }
    object pl "Billing" { kind: "epk.processlink"; }
    relation n1 "" @ev -> @fn { kind: "epk.next"; }
    relation n2 "" @fn -> @c1 { kind: "epk.next"; }
    relation n3 "" @c1 -> @fn2 { kind: "epk.next"; }
    relation n4 "" @c1 -> @fn3 { kind: "epk.next"; }
    relation n5 "" @fn2 -> @c2 { kind: "epk.next"; }
    relation n6 "" @fn3 -> @c2 { kind: "epk.next"; }
    relation n7 "" @c2 -> @ev2 { kind: "epk.next"; }
    relation a1 "" @wh -> @fn3 { kind: "epk.assigned"; }
    relation a2 "" @picker -> @fn3 { kind: "epk.assigned"; }
    relation i1 "" @doc -> @fn3 { kind: "epk.infoflow"; }
    relation l1 "" @pl -> @ev2 { kind: "epk.links"; }
}
view dep "Deployment" { data: [@depx]; projection { kind: graph; profile: "c4.deployment@1"; } frame f "Server" { scope: @depx.app; members: [@depx.war]; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
view dyn "Dynamic" { data: [@dynx]; projection { kind: graph; profile: "c4.dynamic@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
view epc "EPC" { data: [@e]; projection { kind: graph; profile: "epc.complete@1"; } frame lane "Lane" { scope: @e.wh; members: [@e.fn3, @e.picker]; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view,changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('c4.deployment@1 rebadges uml.deployment@1: 3D nodes, artifacts, nesting frame, rebadge note',()=>{const r=run('dep');
 assert.ok(r.svg.includes('node3d'),'3D node missing');
 assert.ok(r.svg.includes('shop.war'),'artifact missing');
 assert.ok((r.diagnostics||[]).some(d=>d.code==='DDN-PJW06'),'rebadge info diagnostic missing');});
test('c4 tag chips render under nodes',()=>{const r=run('dep');
 assert.ok(r.svg.includes('ddn-c4tag')&&r.svg.includes('[infra]'),'tag chip missing');});
test('c4.dynamic@1 rebadges communication: numbered message labels',()=>{const r=run('dyn');
 assert.ok(r.svg.includes('1 · browse'),'request numbering missing');
 assert.ok(r.svg.includes('1.1 · render'),'reply numbering missing');});
test('dynamic requires sequence numbers (rebadged PJ111)',()=>{
 throws(()=>run('dyn',edit('x_message: { seq: "1" }','x_message: { }')),'DDN-PJ111');});
test('EPC full notation: lanes, roles, info objects, process links render',()=>{const r=run('epc');
 for(const s of ['Warehouse','Picker','Pick list','Billing'])assert.ok(r.svg.includes(s),'missing: '+s);
 assert.ok(r.svg.includes('ddn-frame'),'lane frame missing');});
test('EPC alternation still enforced (PJ105)',()=>{
 throws(()=>run('epc',edit('relation n1 "" @ev -> @fn { kind: "epk.next"; }','relation n1 "" @ev -> @ev2 { kind: "epk.next"; }')),'DDN-PJ105');});
test('split/join fan-balancing (DDN-PJ199): unbalanced xor split without join',()=>{
 const mut={'main.ddn':SRC.replace('x_epc: { operator: "and" }; }\n    object fn2','x_epc: { operator: "xor" }; }\n    object fn2').replace('object c2 "" { kind: "epk.connector"; x_epc: { operator: "and" }; }','object c2 "" { kind: "epk.connector"; x_epc: { operator: "or" }; }')};
 throws(()=>run('epc',mut),'DDN-PJ199');});
test('balanced and-split and and-join pass (positive control)',()=>{run('epc');});
test('epc.basic@1 unchanged and still installed',()=>{
 const basic=`ddn "0.5";
module "test.epcbasic";
data m {
    object ev "E" { kind: "epk.event"; }
    object fn "F" { kind: "epk.function"; }
    object ev2 "E2" { kind: "epk.event"; }
    relation n1 "" @ev -> @fn { kind: "epk.next"; }
    relation n2 "" @fn -> @ev2 { kind: "epk.next"; }
}
view v "V" { data: [@m]; projection { kind: graph; profile: "epc.basic@1"; } publication { size: content; fit: none; overflow: error; } }
`;
 const r=A.createWorkspace({'main.ddn':basic}).renderSync({entry:'main.ddn',view:'v'});
 assert.match(r.svg,/<svg/);});

const failed=results.filter(r=>!r.pass);
console.log('c4epc-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
