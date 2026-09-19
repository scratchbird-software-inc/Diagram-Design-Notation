/* SPDX-License-Identifier: GPL-2.0-or-later. Hierarchical state profile (state.composite@1 on kind:graph) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const SRC=`ddn "0.5";
module "test.hierarchicalstate";

data order {
    object start "Start" { kind: "state.initial"; }
    object draft "Draft" { kind: "state.state"; }
    object fulfillment "Fulfillment" { kind: "state.state"; }
    object closed "Closed" { kind: "state.state"; }
    object done "Done" { kind: "state.final"; }
    object payment_initial "Payment start" { kind: "state.initial"; }
    object awaiting "Awaiting payment" { kind: "state.state"; }
    object paid "Paid" { kind: "state.state"; }
    object payment_final "Payment done" { kind: "state.final"; }
    object packing_initial "Packing start" { kind: "state.initial"; }
    object open "Open box" { kind: "state.state"; }
    object packed "Packed" { kind: "state.state"; }
    object packing_final "Packing done" { kind: "state.final"; }
    relation begin "begin" @start -> @draft { kind: "state.transition"; }
    relation submit "submit" @draft -> @fulfillment { kind: "state.transition"; x_transition: { "event": "submit" }; }
    relation pay "pay" @payment_initial -> @awaiting { kind: "state.transition"; }
    relation paid_ev "paid" @awaiting -> @paid { kind: "state.transition"; x_transition: { "event": "payment_received" }; }
    relation pack_start "pack start" @packing_initial -> @open { kind: "state.transition"; }
    relation packed_ev "packed" @open -> @packed { kind: "state.transition"; x_transition: { "event": "box_sealed" }; }
    relation ship "ship" @paid -> @closed { kind: "state.transition"; x_transition: { "event": "shipped" }; }
    relation finish "finish" @closed -> @done { kind: "state.transition"; x_transition: { "event": "archive" }; }
}

view lifecycle "Order lifecycle / composite states" {
    data: [@order];
    projection { kind: graph; profile: "state.composite@1"; }
    layout { algorithm: layered; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
    frame fulfillment "FULFILLMENT" { scope: @order.fulfillment;
        members: [@order.fulfillment, @order.awaiting, @order.paid, @order.open, @order.packed]; }
    frame payment "PAYMENT" { x_region: true;
        members: [@order.payment_initial, @order.awaiting, @order.paid, @order.payment_final]; }
    frame packing "PACKING" { x_region: true;
        members: [@order.packing_initial, @order.open, @order.packed, @order.packing_final]; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({'main.ddn':SRC,...changes});}
function run(changes={},view='lifecycle'){return workspace(changes).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const dashes=svg=>(svg.match(/stroke-dasharray="6 4"/g)||[]).length;
test('Composite view renders: composite frame, two dashed region overlays, event labels on transitions',()=>{const r=run();
 assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.kind,'graph');assert.equal(r.profiles.projection.profile,'state.composite@1');
 for(const s of ['FULFILLMENT','PAYMENT','PACKING'])assert.ok(r.svg.includes(s),'frame label missing: '+s);
 assert.equal(dashes(r.svg),2,'expected exactly two dashed region overlays');
 for(const s of ['submit','payment_received','box_sealed','shipped','archive'])assert.ok(r.svg.includes(s),'event label missing: '+s);
 const frames=r.scene.frames;assert.equal(frames.filter(f=>f.x_region===true).length,2,'scene frames missing x_region flags');});
test('Boundary-crossing transition from a region state to a top-level state renders',()=>{const r=run();
 const route=r.scene.routes.find(x=>/ship$/.test(x.id));assert.ok(route,'ship route missing from scene');
 assert.ok(r.svg.includes('shipped'),'boundary-crossing event label missing');});
test('Two initial states in one region frame are rejected as DDN-PJ113',()=>{
 throws(()=>run(edit('frame packing "PACKING" { x_region: true;\n        members: [@order.packing_initial, @order.open, @order.packed, @order.packing_final]; }',
  'frame packing "PACKING" { x_region: true;\n        members: [@order.payment_initial, @order.packing_initial, @order.open, @order.packed, @order.packing_final]; }')),'DDN-PJ113');});
test('Two initial states as direct members of a region-less composite frame are rejected as DDN-PJ113',()=>{
 const noRegions=SRC.replace('    frame payment "PAYMENT" { x_region: true;\n        members: [@order.payment_initial, @order.awaiting, @order.paid, @order.payment_final]; }\n','')
  .replace('    frame packing "PACKING" { x_region: true;\n        members: [@order.packing_initial, @order.open, @order.packed, @order.packing_final]; }\n','')
  .replace('members: [@order.fulfillment, @order.awaiting, @order.paid, @order.open, @order.packed];',
   'members: [@order.fulfillment, @order.payment_initial, @order.packing_initial, @order.awaiting, @order.paid, @order.open, @order.packed];');
 assert.ok(noRegions!==SRC,'Mutation target missing');
 throws(()=>workspace({'main.ddn':noRegions}).renderSync({entry:'main.ddn',view:'lifecycle'}),'DDN-PJ113');});
test('traces on state.composite@1 are rejected by the flat-only DDN-Q005 guard',()=>{
 throws(()=>run(edit('projection { kind: graph; profile: "state.composite@1"; }',
  'projection { kind: graph; profile: "state.composite@1"; traces: [{ "events": [{ "event": "submit" }], "expected": @order.done }]; }')),'DDN-Q005');});
test('Flat lifecycle rules under state.flat@1 are unchanged (regression)',()=>{
 const FLAT=`ddn "0.5";
module "test.hierarchicalstate.flat";
data lifecycle {
    object initial "Start" { kind: "state.initial"; }
    object open "Open" { kind: "state.state"; }
    object closed "Closed" { kind: "state.final"; }
    relation begin "begin" @initial -> @open { kind: "state.transition"; }
    relation close "close" @open -> @closed { kind: "state.transition"; x_transition: { "event": "close" }; }
}
view flat_lifecycle "Flat" {
    data: [@lifecycle];
    projection { kind: graph; profile: "state.flat@1"; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
 const r=A.createWorkspace({'main.ddn':FLAT}).renderSync({entry:'main.ddn',view:'flat_lifecycle'});
 assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.profile,'state.flat@1');
 assert.ok(r.svg.includes('close'),'event label missing under state.flat@1');
 assert.equal((r.svg.match(/stroke-dasharray="6 4"/g)||[]).length,0,'flat view must not gain region overlays');});
test('Repeated render is deterministic',()=>{assert.equal(sha(run().svg),sha(run().svg));});
let pass=0;for(const r of results){if(r.pass){pass++;console.log('PASS',r.name);}else console.log('FAIL',r.name,r.code||'',r.message||'');}
console.log(`Hierarchical state ${pass}/${results.length}`);if(pass!==results.length)process.exitCode=1;
