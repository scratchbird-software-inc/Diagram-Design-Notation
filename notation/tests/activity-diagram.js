/* SPDX-License-Identifier: GPL-2.0-or-later. Activity diagram profile (uml.activity@1 on kind:graph) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const SRC=`ddn "0.5";
module "test.activitydiagram";

data order {
    object start "Start" { kind: "flow.start"; x_partition: { "lane": "webshop" }; }
    object fork "Fork" { kind: "flow.forkjoin"; x_partition: { "lane": "warehouse" }; }
    object pick_items "Pick items" { kind: "flow.process"; x_partition: { "lane": "warehouse" }; }
    object take_payment "Take payment" { kind: "flow.process"; x_partition: { "lane": "webshop" }; }
    object order_obj "Order" { kind: "flow.objectnode"; x_partition: { "lane": "warehouse" }; }
    object join "Join" { kind: "flow.forkjoin"; x_partition: { "lane": "warehouse" }; }
    object end "End" { kind: "flow.end"; x_partition: { "lane": "webshop" }; }
    relation begin "begin" @start -> @fork { kind: "uml.flow"; }
    relation to_pick "to pick" @fork -> @pick_items { kind: "uml.flow"; }
    relation to_pay "to pay" @fork -> @take_payment { kind: "uml.flow"; }
    relation to_order "to order" @fork -> @order_obj { kind: "uml.flow"; }
    relation picked "picked" @pick_items -> @join { kind: "uml.flow"; }
    relation paid "paid" @take_payment -> @join { kind: "uml.flow"; }
    relation order_ready "order ready" @order_obj -> @join { kind: "uml.flow"; }
    relation finish "finish" @join -> @end { kind: "uml.flow"; }
}

view fulfilment "Order fulfilment activity" {
    data: [@order];
    projection { kind: graph; profile: "uml.activity@1"; }
    layout { algorithm: layered; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
    frame webshop "Webshop" { members: [@order.start, @order.take_payment, @order.end]; }
    frame warehouse "Warehouse" { members: [@order.fork, @order.pick_items, @order.order_obj, @order.join]; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({'main.ddn':SRC,...changes});}
function run(changes={},view='fulfilment'){return workspace(changes).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code,check)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);if(check)check(e);return code?e.code===code:typeof e.code==='string';});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
test('Activity view renders: two lane frame boxes, fork/join bar nodes, object node; scene nodes carry source ids',()=>{const r=run();
 assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.kind,'graph');assert.equal(r.profiles.projection.profile,'uml.activity@1');
 assert.equal((r.svg.match(/data-frame="/g)||[]).length,2,'expected exactly two lane frame boxes');
 for(const s of ['Webshop','Warehouse','Fork','Join','Order','Pick items','Take payment'])assert.ok(r.svg.includes(s),'label missing: '+s);
 const ids=r.scene.nodes.map(n=>n.id);
 for(const id of ['start','fork','pick_items','take_payment','order_obj','join','end'])assert.ok(ids.some(x=>x.endsWith('.'+id)),'scene node missing: '+id);});
test('A node with x_partition:{lane:"warehouse"} is a member of the warehouse frame',()=>{const r=run();
 const wh=r.scene.frames.find(f=>f.id.endsWith('.warehouse'));
 assert.ok(wh,'warehouse frame missing from scene');
 assert.ok(wh.members.some(id=>id.endsWith('.pick_items')),'pick_items not in warehouse frame members');
 assert.ok(wh.members.some(id=>id.endsWith('.order_obj')),'order object node not in warehouse frame members');});
test('x_partition naming no frame of the view is rejected as DDN-PJ114',()=>{
 throws(()=>run(edit('x_partition: { "lane": "webshop" }; }\n    object fork','x_partition: { "lane": "nowhere" }; }\n    object fork')),'DDN-PJ114',
  e=>{assert.ok(e.message.includes('nowhere'),'message must name the lane');assert.ok(e.message.includes('start'),'message must name the node');});});
test('A fork with no matching join is rejected as DDN-PJ115 with both counts in the message',()=>{
 const extra='    relation finish "finish" @join -> @end { kind: "uml.flow"; }';
 const unbalanced=extra+'\n    object fork2 "Fork 2" { kind: "flow.forkjoin"; x_partition: { "lane": "warehouse" }; }\n    relation reenter "reenter" @join -> @fork2 { kind: "uml.flow"; }\n    relation redo "redo" @fork2 -> @order_obj { kind: "uml.flow"; }\n    relation bail "bail" @fork2 -> @end { kind: "uml.flow"; }';
 throws(()=>run(edit(extra,unbalanced)),'DDN-PJ115',
  e=>{assert.ok(e.message.includes('3 fork'),'message must report the fork count');assert.ok(e.message.includes('1 join'),'message must report the join count');});});
test('A flow.next relation inside uml.activity@1 is rejected by the vocabulary check as DDN-PF007',()=>{
 // Choice: the existing DDN-PF007 guard in ddn-profiles.js was extended to uml.activity@1
 // (participants flow.* only; visible relations uml.flow only), so kind/verb mixing keeps
 // the established flowchart vocabulary code instead of a new one.
 const anchor='    relation finish "finish" @join -> @end { kind: "uml.flow"; }';
 throws(()=>run(edit(anchor,anchor+'\n    relation cross "cross" @take_payment -> @pick_items { kind: "flow.next"; }')),'DDN-PF007',
  e=>assert.ok(e.message.includes('uml.flow'),'message must name the accepted verb'));});
test('Malformed x_partition (missing lane) is rejected as DDN105',()=>{
 throws(()=>run(edit('x_partition: { "lane": "warehouse" }; }\n    object pick_items','x_partition: {}; }\n    object pick_items')),'DDN105');});
test('Repeated render is deterministic',()=>{assert.equal(sha(run().svg),sha(run().svg));});
let pass=0;for(const r of results){if(r.pass){pass++;console.log('PASS',r.name);}else console.log('FAIL',r.name,r.code||'',r.message||'');}
console.log(`Activity diagram ${pass}/${results.length}`);if(pass!==results.length)process.exitCode=1;
