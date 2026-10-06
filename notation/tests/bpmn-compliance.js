/* SPDX-License-Identifier: GPL-2.0-or-later. B1-063: BPMN 2.0.2 compliance fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "ddn.examples.bpmn";

// B1-063: full BPMN 2.0.2 notation. process view: events (triggers, boundary,
// non-interrupting), gateways, activity markers, data nodes, flow variants.
// collaboration view: two pools, message flow, collapsed pool. choreography
// and conversation views cover the remaining families. No pinned layout.

data proc {
    object start "Order received" { kind: "flow.start"; x_event: { type: message; }; }
    object review "Review order" { kind: "flow.process"; x_activity: { markers: [loop]; }; }
    object escalate "" { kind: "flow.intermediate"; x_event: { type: escalation; position: boundary; interrupting: false; on: @proc.review; }; }
    object dec "" { kind: "flow.gateway"; x_gateway: { type: exclusive }; }
    object pack "Pack" { kind: "flow.process"; x_activity: { markers: [parallel]; }; }
    object call "Billing" { kind: "flow.process"; x_activity: { call: true; }; }
    object tx "Reserve stock" { kind: "flow.subprocess"; x_activity: { transaction: true; }; }
    object adhoc "Fix up" { kind: "flow.process"; x_activity: { adhoc: true; }; }
    object evsub "Timeout handler" { kind: "flow.subprocess"; x_activity: { event_subprocess: true }; }
    object data "Order data" { kind: "flow.dataobject"; }
    object din "Credit check" { kind: "flow.datainput"; }
    object dout "Invoice" { kind: "flow.dataoutput"; x_io: { set: true; }; }
    object store "Order store" { kind: "flow.datastore"; }
    object grp "Notes" { kind: "flow.group"; }
    object cancel_end "Cancelled" { kind: "flow.end"; x_event: { type: cancel; }; }
    object done "Shipped" { kind: "flow.end"; x_event: { type: terminate; }; }

    relation f1 "" @start -> @review { kind: "uml.flow"; }
    relation f2 "" @review -> @dec { kind: "uml.flow"; }
    relation f3 "ok" @dec -> @pack { kind: "uml.flow"; source_mark: slash; }
    relation f4 "big" @dec -> @tx { kind: "uml.flow"; source_mark: diamond; }
    relation f5 "" @pack -> @call { kind: "uml.flow"; }
    relation f6 "" @tx -> @call { kind: "uml.flow"; }
    relation f7 "" @call -> @done { kind: "uml.flow"; }
    relation f8 "" @review -> @cancel_end { kind: "uml.flow"; }
    relation f9 "" @escalate -> @adhoc { kind: "uml.flow"; }
    relation f10 "" @adhoc -> @done { kind: "uml.flow"; }
    relation f11 "" @evsub -> @adhoc { kind: "uml.flow"; }
    relation a1 "" @data -> @review { kind: "bpmn.association"; }
    relation a2 "" @review -> @dout { kind: "bpmn.association"; }
    relation a3 "" @din -> @call { kind: "bpmn.association"; }
    relation a4 "" @call -> @store { kind: "bpmn.association"; }
    relation msg "billing status" @pack -> @call { kind: "bpmn.messageflow"; }
}

data choreo {
    object ship_order "Ship order" { kind: "flow.choreotask"; x_bands: [ "Shop", "Carrier" ]; }
    object pay "Pay" { kind: "flow.choreotask"; x_bands: [ "Shop", "Bank *" ]; }
    object gw "" { kind: "flow.gateway"; x_gateway: { type: parallel }; }
    relation c1 "" @ship_order -> @gw { kind: "uml.flow"; }
    relation c2 "" @gw -> @pay { kind: "uml.flow"; }
}

data conv {
    object shop "Shop" { kind: "uml.actor"; }
    object sup "Supplier" { kind: "uml.actor"; }
    object talk "Ordering" { kind: "flow.conversation"; }
    object sub "Payment" { kind: "flow.subconversation"; }
    object shared "Shared billing" { kind: "flow.callconversation"; }
    relation l1 "" @shop -> @talk { kind: "bpmn.conversationlink"; }
    relation l2 "" @sup -> @talk { kind: "bpmn.conversationlink"; }
    relation l3 "" @shop -> @sub { kind: "bpmn.conversationlink"; }
    relation l4 "" @sup -> @shared { kind: "bpmn.conversationlink"; }
}

view process "Process" {
    data: [@proc];
    projection { kind: graph; profile: "bpmn.process@1"; }
    frame pool "Webshop" { members: [@proc.start, @proc.review, @proc.escalate, @proc.dec, @proc.pack, @proc.call, @proc.tx, @proc.adhoc, @proc.evsub, @proc.cancel_end, @proc.done]; x_pool: true; }
    publication { size: content; fit: none; overflow: error; minimum_text: 6pt; }
}
view collaboration "Collaboration" {
    data: [@proc];
    projection { kind: graph; profile: "bpmn.process@1"; }
    frame shop "Webshop" { members: [@proc.start, @proc.review, @proc.dec, @proc.pack, @proc.done]; x_pool: true; }
    frame erp "ERP (black box)" { members: [@proc.call, @proc.tx]; x_pool: true; x_collapsed: true; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}

view choreography "Choreography" {
    data: [@choreo];
    projection { kind: graph; profile: "bpmn.choreography@1"; }
    publication { size: content; fit: none; overflow: error; minimum_text: 6pt; }
}
view conversation "Conversation" {
    data: [@conv];
    layout { algorithm: layered; direction: right; routing: straight; gap: 130px; row_gap: 130px; }
    projection { kind: graph; profile: "bpmn.conversation@1"; }
    publication { size: content; fit: none; overflow: error; minimum_text: 6pt; }
}

`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view,changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('events: rings per position, trigger icons, boundary attachment',()=>{const r=run('process');
 for(const tg of ['message','escalation','cancel','terminate'])assert.ok(r.svg.includes('data-trigger="'+tg+'"'),'trigger missing: '+tg);
 assert.ok((r.svg.match(/data-shape="bpmevent"/g)||[]).length>=4,'event rings missing');
 assert.ok(r.svg.includes('stroke-dasharray="4 3"'),'non-interrupting boundary ring missing');});
test('gateways render true inner glyphs',()=>{const r=run('process');
 assert.ok(r.svg.includes('ddn-gateway'),'gateway glyph missing');
 assert.ok(!r.svg.includes('>X Quote'),'text-prefix gateway must be gone under bpmn.process@1');});
test('activities: call thick border, transaction double border, event subprocess dashed, loop/parallel/adhoc badges',()=>{const r=run('process');
 for(const m of ['loop','parallel','adhoc'])assert.ok(r.svg.includes('data-marker="'+m+'"'),'marker missing: '+m);});
test('data nodes: object/input/output/store + associations + io set badge',()=>{const r=run('process');
 for(const sh of ['dataobject','datainput','dataoutput','cylinder'])assert.ok(r.svg.includes('data-shape="'+sh+'"'),'shape missing: '+sh);
 assert.ok((r.svg.match(/stroke-dasharray="4 4"/g)||[]).length>=4,'data associations missing');});
test('flow variants: default slash and conditional diamond source marks',()=>{const r=run('process');
 assert.ok(r.svg.includes('M-9 -6L-3 6'),'default-flow slash missing');});
test('artifacts: group dashed roundrect renders',()=>{const r=run('process');
 assert.ok(r.svg.includes('data-shape="groupbox"'),'group box missing');});
test('collaboration: pools, collapsed pool box, message flow across pools',()=>{const r=run('collaboration');
 assert.ok(r.svg.includes('data-collapsed-pool="true"'),'collapsed pool missing');
 assert.ok((r.svg.match(/ddn-frame/g)||[]).length>=2,'pool frames missing');});
test('choreography: participant bands and multi-instance marker',()=>{const r=run('choreography');
 assert.ok((r.svg.match(/data-shape="choreotask"/g)||[]).length===2,'choreo tasks missing');
 for(const s of ['>Shop<','>Carrier<','>Bank<'])assert.ok(r.svg.includes(s),'band missing: '+s);});
test('conversation: hexagon nodes + conversation links',()=>{const r=run('conversation');
 assert.equal((r.svg.match(/data-shape="hexagon"/g)||[]).length,3,'conversation nodes missing');
 assert.ok((r.svg.match(/ddn-verb-convolink/g)||[]).length===4,'conversation links missing');});

test('x_event on a non-event kind is DDN-PJ175',()=>{
 throws(()=>run('process',edit('object grp "Notes" { kind: "flow.group"; }','object grp "Notes" { kind: "flow.group"; x_event: { type: message; }; }')),'DDN-PJ175');});
test('Terminate trigger belongs on end events (DDN-PJ175)',()=>{
 throws(()=>run('process',edit('object start "Order received" { kind: "flow.start"; x_event: { type: message; }; }','object start "Order received" { kind: "flow.start"; x_event: { type: terminate; }; }')),'DDN-PJ175');});
test('Boundary event needs an x_event.on host task (DDN-PJ175)',()=>{
 throws(()=>run('process',edit('on: @proc.review;','on: @proc.data;')),'DDN-PJ175');});
test('Event-based gateway needs two outgoing flows (DDN-PJ176)',()=>{
 throws(()=>run('choreography',edit('x_gateway: { type: parallel };','x_gateway: { type: event };')),'DDN-PJ176');});
test('Extended gateway types outside BPMN profiles are DDN-PJ176',()=>{
 const e=edit('profile: "bpmn.choreography@1";','profile: "ddn@1";');
 e['main.ddn']=e['main.ddn'].replace('x_gateway: { type: parallel };','x_gateway: { type: complex };');
 throws(()=>run('choreography',e),'DDN-PJ176');});
test('x_activity on a non-task kind is DDN-PJ177',()=>{
 throws(()=>run('process',edit('object dec "" { kind: "flow.gateway"; x_gateway: { type: exclusive }; }','object dec "" { kind: "flow.gateway"; x_gateway: { type: exclusive }; x_activity: { call: true }; }')),'DDN-PJ177');});
test('Choreography task needs at least two bands (DDN-PJ178)',()=>{
 throws(()=>run('choreography',edit('x_bands: [ "Shop", "Carrier" ];','x_bands: [ "Shop" ];')),'DDN-PJ178');});
test('Conversation link must target a conversation node (DDN-PJ179 via endpoint contract)',()=>{
 throws(()=>run('conversation',edit('relation l1 "" @shop -> @talk','relation l1 "" @shop -> @sup')),'DDN102');});
test('Data association needs a data node on one side (DDN-PJ180)',()=>{
 throws(()=>run('process',edit('relation a1 "" @data -> @review','relation a1 "" @store -> @dout')),'DDN-PJ180');
 throws(()=>run('process',edit('relation a1 "" @data -> @review','relation a1 "" @review -> @pack')),'DDN-PJ180');});
test('bpmn.basic@1 renders unchanged (stadium events, text gateway prefixes)',()=>{
 const plain={'main.ddn':`ddn "0.5";
module "test.bpmn1";
data m {
    object start "Start" { kind: "flow.start"; x_event: { "type": "none" }; }
    object a "A" { kind: "flow.process"; }
    object end "End" { kind: "flow.end"; x_event: { "type": "message" }; }
    relation f1 "" @start -> @a { kind: "uml.flow"; }
    relation f2 "" @a -> @end { kind: "uml.flow"; }
}
view v "Plain" { data: [@m]; projection { kind: graph; profile: "bpmn.basic@1"; } publication { size: content; fit: none; overflow: error; } }
`};
 const r=A.createWorkspace(plain).renderSync({entry:'main.ddn',view:'v'});
 assert.equal(r.profiles.projection.profile,'bpmn.basic@1');
 assert.ok(!r.svg.includes('data-shape="bpmevent"'),'bpmn.basic@1 must keep stadium markers');});

const failed=results.filter(r=>!r.pass);
console.log('bpmn-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
