/* SPDX-License-Identifier: GPL-2.0-or-later. Communication profile (uml.communication@1 on kind:graph) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const SRC=`ddn "0.5";
module "test.communication";

data flow {
    object customer_app "Customer app" { kind: application; }
    object checkout "Checkout" { kind: service; }
    object inventory "Inventory" { kind: service; }
    relation submit_order "Submit order" @customer_app -> @checkout { kind: "uml.message"; x_message: { seq: "1"; }; }
    relation reserve_stock "Reserve stock" @checkout -> @inventory { kind: "uml.message"; x_message: { seq: "2"; }; }
    relation reserve_stock_reply "Stock reserved" @inventory -> @checkout { kind: "uml.message"; x_return: true; x_message: { seq: "2.1"; }; }
    relation audit_log "Audit log" @checkout -> @checkout { kind: "uml.message"; x_message: { seq: "3"; }; }
    relation confirm "Confirm order" @checkout -> @customer_app { kind: "uml.message"; x_message: { seq: "4"; }; }
}

view communication "Synthetic order flow / communication" {
    data: [@flow];
    projection { kind: graph; profile: "uml.communication@1"; }
    layout { algorithm: layered; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}

view sequence "Synthetic order flow / sequence" {
    data: [@flow];
    projection { kind: sequence; profile: "uml.sequence@1"; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({'main.ddn':SRC,...changes});}
function run(changes={},view='communication'){return workspace(changes).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
test('Communication view renders as a graph; every uml.message edge label starts with its declared seq',()=>{const r=run();
 assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.kind,'graph');assert.equal(r.profiles.projection.profile,'uml.communication@1');
 for(const [seq,name] of [['1','Submit order'],['2','Reserve stock'],['2.1','Stock reserved'],['3','Audit log'],['4','Confirm order']])
  assert.ok(r.svg.includes(seq+' · '+name),'numbered edge label missing: '+seq+' · '+name);
 assert.ok(!r.svg.includes('stroke-dasharray="5 5"'),'sequence lifelines leaked into graph view');});
test('Reply (x_return) renders its dotted label',()=>{const r=run();
 assert.ok(r.svg.includes('2.1 · Stock reserved'),'reply label missing');});
test('Message without x_message rejected as DDN-PJ111',()=>{
 throws(()=>run(edit(' { kind: "uml.message"; x_message: { seq: "1"; }; }',' { kind: "uml.message"; }')),'DDN-PJ111');});
test('Malformed seq rejected as DDN-PJ111',()=>{
 throws(()=>run(edit('x_message: { seq: "1"; }','x_message: { seq: "two"; }')),'DDN-PJ111');
 throws(()=>run(edit('x_message: { seq: "2"; }','x_message: { seq: "2."; }')),'DDN-PJ111');});
test('Reply with undotted seq and non-reply with dotted seq rejected as DDN-PJ111',()=>{
 throws(()=>run(edit('x_return: true; x_message: { seq: "2.1"; }','x_return: true; x_message: { seq: "5"; }')),'DDN-PJ111');
 throws(()=>run(edit('x_message: { seq: "3"; }','x_message: { seq: "3.1"; }')),'DDN-PJ111');});
test('Place/route-free graph view renders; unrelated relation kinds are not renumbered',()=>{
 const r=run(edit('relation confirm "Confirm order" @checkout -> @customer_app { kind: "uml.message"; x_message: { seq: "4"; }; }',
  'relation confirm "Confirm order" @checkout -> @customer_app { kind: "uml.message"; x_message: { seq: "4"; }; } relation docs "Documents" @customer_app -> @inventory { kind: "assoc"; }'));
 assert.match(r.svg,/<svg/);
 assert.ok(r.svg.includes('>Documents<'),'unrelated relation label missing');
 assert.ok(!r.svg.includes('· Documents'),'unrelated relation was renumbered');});
test('Deterministic byte-identical rerender',()=>assert.equal(sha(run().svg),sha(run().svg)));
test('uml.sequence@1 view of the same model still renders (RT-101 regression)',()=>{const r=run({},'sequence');
 assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.kind,'sequence');
 for(const [i,name] of ['Submit order','Reserve stock','Stock reserved','Audit log','Confirm order'].entries())
  assert.ok(r.svg.includes('>'+(i+1)+'. '+name+'</text>'),'sequence numbered label '+(i+1)+' missing');});
const failed=results.filter(r=>!r.pass);
for(const r of results)if(r.pass)console.log('PASS',r.name);
console.log('Communication diagram '+results.filter(r=>r.pass).length+'/'+results.length);
if(failed.length)process.exitCode=1;
