/* SPDX-License-Identifier: GPL-2.0-or-later. BPMN collaboration profile (bpmn.basic@1 on kind:graph) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const SRC=`ddn "0.5";
module "test.bpmn";

data quote {
    object start "Start" { kind: "flow.start"; x_event: { "type": "none" }; }
    object request_quote "Request quote" { kind: "flow.process"; }
    object decide "Quote acceptable?" { kind: "flow.gateway"; x_gateway: { "type": "exclusive" }; }
    object failed "Quote rejected" { kind: "flow.end"; x_event: { "type": "error" }; }
    object timeout "Quote expired" { kind: "flow.end"; x_event: { "type": "timer" }; }
    object receive "Request received" { kind: "flow.start"; x_event: { "type": "message" }; }
    object prepare_quote "Prepare quote" { kind: "flow.process"; }
    object sent "Quote sent" { kind: "flow.end"; x_event: { "type": "message" }; }
    relation begin "begin" @start -> @request_quote { kind: "uml.flow"; }
    relation review "review" @request_quote -> @decide { kind: "uml.flow"; }
    relation reject "reject" @decide -> @failed { kind: "uml.flow"; }
    relation lapse "lapse" @decide -> @timeout { kind: "uml.flow"; }
    relation intake "intake" @receive -> @prepare_quote { kind: "uml.flow"; }
    relation deliver "deliver" @prepare_quote -> @sent { kind: "uml.flow"; }
    relation request "quote request" @request_quote -> @prepare_quote { kind: "bpmn.messageflow"; }
}

view collaboration "Buyer / seller collaboration" {
    data: [@quote];
    projection { kind: graph; profile: "bpmn.basic@1"; }
    layout { algorithm: layered; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
    frame buyer "Buyer" { x_pool: true; members: [@quote.start, @quote.request_quote, @quote.decide, @quote.failed, @quote.timeout]; }
    frame seller "Seller" { x_pool: true; members: [@quote.receive, @quote.prepare_quote, @quote.sent]; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({'main.ddn':SRC,...changes});}
function run(changes={},view='collaboration'){return workspace(changes).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code,check)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);if(check)check(e);return code?e.code===code:typeof e.code==='string';});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
test('BPMN view renders: two pool frames, dashed message-flow edge, gateway name prefix; scene frames carry x_pool',()=>{const r=run();
 assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.kind,'graph');assert.equal(r.profiles.projection.profile,'bpmn.basic@1');
 assert.equal((r.svg.match(/data-frame="/g)||[]).length,2,'expected exactly two pool frame boxes');
 for(const s of ['Buyer','Seller','Request quote','Prepare quote','Quote acceptable?'])assert.ok(r.svg.includes(s),'label missing: '+s);
 assert.ok(r.svg.includes('stroke-dasharray="6 4"'),'message flow edge must render dashed with the registry pattern');
 assert.ok(r.svg.includes('X Quote acceptable?'),'exclusive gateway name must carry the X prefix');
 const buyer=r.scene.frames.find(f=>f.id.endsWith('.buyer')),seller=r.scene.frames.find(f=>f.id.endsWith('.seller'));
 assert.equal(buyer.x_pool,true,'buyer frame must keep its x_pool flag');assert.equal(seller.x_pool,true,'seller frame must keep its x_pool flag');
 assert.ok(buyer.members.some(id=>id.endsWith('.request_quote')),'request_quote not in buyer pool members');
 assert.ok(seller.members.some(id=>id.endsWith('.prepare_quote')),'prepare_quote not in seller pool members');});
test('uml.flow sequence edges within a pool render and do not trigger DDN-PJ116',()=>{const r=run();
 const ids=r.scene.routes.map(x=>x.id);
 for(const id of ['begin','review','reject','lapse','intake','deliver'])assert.ok(ids.some(x=>x.endsWith('.'+id)),'sequence edge not routed: '+id);
 const msg=r.scene.routes.find(x=>x.id.endsWith('.request'));
 assert.ok(msg,'message flow route missing');});
test('bpmn.messageflow with both endpoints in the same pool is rejected as DDN-PJ116',()=>{
 const anchor='    relation request "quote request" @request_quote -> @prepare_quote { kind: "bpmn.messageflow"; }';
 throws(()=>run(edit(anchor,anchor+'\n    relation inner "inner" @start -> @decide { kind: "bpmn.messageflow"; }')),'DDN-PJ116',
  e=>{assert.ok(e.message.includes('inner'),'message must name the relation');assert.ok(e.message.includes('Buyer'),'message must name the pool');});});
test('bpmn.messageflow with both endpoints outside every pool is rejected as DDN-PJ116',()=>{
 const anchor='    object sent "Quote sent" { kind: "flow.end"; x_event: { "type": "message" }; }';
 const extra=anchor+'\n    object out_a "Out A" { kind: "flow.process"; }\n    object out_b "Out B" { kind: "flow.process"; }';
 const anchor2='    relation request "quote request" @request_quote -> @prepare_quote { kind: "bpmn.messageflow"; }';
 const files=edit(anchor,extra);files['main.ddn']=files['main.ddn'].replace(anchor2,anchor2+'\n    relation stray "stray" @out_a -> @out_b { kind: "bpmn.messageflow"; }');
 throws(()=>run(files),'DDN-PJ116',
  e=>{assert.ok(e.message.includes('stray'),'message must name the relation');assert.ok(e.message.includes('outside every'),'message must report the outside-every-pool mode');});});
test('flow.gateway without x_gateway is rejected as DDN-PJ117',()=>{
 throws(()=>run(edit(' { kind: "flow.gateway"; x_gateway: { "type": "exclusive" }; }',' { kind: "flow.gateway"; }')),'DDN-PJ117',
  e=>assert.ok(e.message.includes('decide'),'message must name the gateway'));});
test('x_gateway:{type:"complex"} and x_event:{type:"signal"} fail the extension contracts as DDN105',()=>{
 throws(()=>run(edit('x_gateway: { "type": "exclusive" }','x_gateway: { "type": "complex" }')),'DDN105');
 throws(()=>run(edit('x_event: { "type": "timer" }','x_event: { "type": "signal" }')),'DDN105');});
test('Repeated render is deterministic',()=>{assert.equal(sha(run().svg),sha(run().svg));});
test('Multi-view file: the same model renders under bpmn.basic@1 and under the plain graph profile',()=>{
 const plain=`view plain "Plain graph view" {
    data: [@quote];
    projection { kind: graph; profile: "ddn@1"; }
    layout { algorithm: layered; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}`;
 const files={'main.ddn':SRC.replace(/view collaboration[\s\S]*$/,plain+'\n')};
 const b=run({},'collaboration'),p=workspace(files).renderSync({entry:'main.ddn',view:'plain'});
 assert.equal(b.profiles.projection.profile,'bpmn.basic@1');assert.ok(b.svg.includes('stroke-dasharray="6 4"'),'BPMN view keeps the dashed message flow');
 assert.equal(p.profiles.projection.profile,'ddn@1');assert.equal(p.profiles.projection.kind,'graph');assert.match(p.svg,/<svg/);
 assert.ok(p.svg.includes('Quote acceptable?'),'plain view renders the same model without the gateway marker');
 assert.ok(!p.svg.includes('X Quote acceptable?'),'gateway marker must apply only to the bpmn.basic@1 view');});
let pass=0;for(const r of results){if(r.pass){pass++;console.log('PASS',r.name);}else console.log('FAIL',r.name,r.code||'',r.message||'');}
console.log(`BPMN collaboration ${pass}/${results.length}`);if(pass!==results.length)process.exitCode=1;
