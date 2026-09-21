/* SPDX-License-Identifier: GPL-2.0-or-later. Interaction overview profile (uml.interaction_overview@1, x_subdiagram) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const SRC=`ddn "0.5";
module "test.interactionoverview";

data checkout {
    object start "Start" { kind: "flow.start"; }
    object browse "Browse catalogue" { kind: "flow.process"; }
    object pay "Pay" { kind: "flow.process"; x_subdiagram: { view: "payment_flow" }; }
    object ship "Ship order" { kind: "flow.process"; x_subdiagram: { view: "stock_flow" }; }
    object end "End" { kind: "flow.end"; }

    relation to_browse "to browse" @start -> @browse { kind: "flow.next"; }
    relation to_pay "to pay" @browse -> @pay { kind: "flow.next"; }
    relation to_ship "to ship" @pay -> @ship { kind: "flow.next"; }
    relation to_end "to end" @ship -> @end { kind: "flow.next"; }
}

data payment {
    object authorize "Authorize card" { kind: "flow.process"; }
    object capture "Capture funds" { kind: "flow.process"; }
    relation authorized "authorized" @authorize -> @capture { kind: "flow.next"; }
}

data stock {
    object reserve "Reserve stock" { kind: "flow.process"; }
    object dispatch "Dispatch parcel" { kind: "flow.process"; }
    relation reserved "reserved" @reserve -> @dispatch { kind: "flow.next"; }
}

view overview "Checkout interaction overview" {
    data: [@checkout];
    projection { kind: graph; profile: "uml.interaction_overview@1"; }
    layout { algorithm: layered; direction: right; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}

view payment_flow "Payment flow detail" {
    data: [@payment];
    projection { kind: graph; profile: "ddn@1"; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}

view stock_flow "Stock flow detail" {
    data: [@stock];
    projection { kind: graph; profile: "ddn@1"; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({'main.ddn':SRC,...changes});}
function run(changes={},view='overview'){return workspace(changes).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
test('Interaction overview renders: ref nodes carry the ↗ ref badge; edges are flow.next',()=>{const r=run();
 assert.match(r.svg,/<svg/);
 assert.equal((r.svg.match(/ddn-ref-badge/g)||[]).length,2,'two ref badges (pay and ship)');
 assert.ok(r.svg.includes('↗'),'badge glyph missing');
 assert.ok(r.svg.includes('ref'),'badge text missing');
 assert.equal(r.scene.routes.length,4,'four flow.next edges routed');
 for(const label of ['Browse catalogue','Pay','Ship order'])assert.ok(r.svg.includes(label),'node label '+label+' missing');});
test('Multi-view: the detail views render independently with their own profiles',()=>{const pay=run({},'payment_flow'),stock=run({},'stock_flow');
 assert.match(pay.svg,/<svg/);assert.ok(pay.svg.includes('Payment flow detail'));
 assert.ok(pay.svg.includes('Authorize card')&&pay.svg.includes('Capture funds'));
 assert.equal((pay.svg.match(/ddn-ref-badge/g)||[]).length,0,'detail view has no ref badges');
 assert.match(stock.svg,/<svg/);assert.ok(stock.svg.includes('Stock flow detail'));
 assert.ok(stock.svg.includes('Reserve stock')&&stock.svg.includes('Dispatch parcel'));});
test('x_subdiagram naming an unknown view is rejected as DDN-PJ119',()=>{
 throws(()=>run(edit('x_subdiagram: { view: "payment_flow" }','x_subdiagram: { view: "does_not_exist" }')),'DDN-PJ119');});
test('x_subdiagram without view fails the extension contract as DDN105',()=>{
 throws(()=>run(edit('x_subdiagram: { view: "payment_flow" }','x_subdiagram: {}')),'DDN105');});
test('x_subdiagram on a non-flow kind used as a flow.next endpoint is rejected as DDN102',()=>{
 throws(()=>run(edit('object pay "Pay" { kind: "flow.process";','object pay "Pay" { kind: "uml.class";')),'DDN102');});
test('Regression: the view-level subdiagram reference example (08-subdiagrams.ddn) still renders its diagram-reference badge',()=>{
 const file=path.join(__dirname,'..','..','website','examples','basics','08-subdiagrams.ddn');
 const files={'main.ddn':fs.readFileSync(file,'utf8')};
 for(const extra of ['shared.ddn']){const p=path.join(__dirname,'..','..','website','examples','basics',extra);if(fs.existsSync(p))files[extra]=fs.readFileSync(p,'utf8');}
 const r=A.createWorkspace(files).renderSync({entry:'main.ddn',view:'overview'});
 assert.match(r.svg,/<svg/);assert.ok(r.svg.includes('diagram reference'),'view-level reference badge unchanged');});
test('Repeated render is deterministic',()=>{assert.equal(sha(run().svg),sha(run().svg));});
const failed=results.filter(r=>!r.pass);
for(const r of results)if(r.pass)console.log('PASS',r.name);
console.log('Interaction overview '+ (results.length-failed.length)+'/'+results.length);
if(failed.length)process.exitCode=1;
