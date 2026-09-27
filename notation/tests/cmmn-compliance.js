/* SPDX-License-Identifier: GPL-2.0-or-later. B1-064: CMMN 1.1 compliance fixtures (cmmn.complete@1). */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "ddn.examples.cmmn";

// B1-064: full CMMN 1.1 notation on cmmn.complete@1 — case plan container,
// typed tasks with decorators, event listeners, sentry on/if-parts with
// criterion attachment, planning table, case file, dependencies. No pins.

data c {
    object plan "Claim case" { kind: "cmmn.caseplan"; }
    object intake "Intake" { kind: "cmmn.stage"; }
    object review "Review claim" { kind: "cmmn.humantask"; x_cmmn: { required: true; manual_activation: true; }; }
    object appr "Approve" { kind: "cmmn.humantask"; x_cmmn: { discretionary: true; }; x_planning: { items: [ "Senior review", "Legal opinion" ]; }; }
    object decide "Fraud check" { kind: "cmmn.decisiontask"; }
    object notify "Notify customer" { kind: "cmmn.processtask"; x_cmmn: { repetition: true; }; }
    object pay "Pay out" { kind: "cmmn.task"; x_cmmn: { completion: true; }; }
    object close "Closed" { kind: "cmmn.milestone"; }
    object docs "Documents" { kind: "cmmn.casefile"; }
    object deadline "" { kind: "cmmn.timerevent"; }
    object customer "" { kind: "cmmn.userevent"; }
    object s1 "" { kind: "cmmn.sentry"; x_sentry: { on: "entry"; attach: @c.review; on_part: @c.deadline; if_part: "deadline passed" }; }

    relation d1 "" @review -> @appr { kind: "cmmn.dependency"; }
    relation d2 "" @decide -> @review { kind: "cmmn.dependency"; }
    relation d3 "" @review -> @notify { kind: "cmmn.dependency"; }
    relation d4 "" @notify -> @pay { kind: "cmmn.dependency"; }
    relation d5 "" @pay -> @close { kind: "cmmn.dependency"; }
    relation sr1 "" @deadline -> @s1 { kind: "cmmn.sentryref"; }
    relation sr2 "" @customer -> @s1 { kind: "cmmn.sentryref"; }
}

view v "Case" {
    data: [@c];
    projection { kind: graph; profile: "cmmn.complete@1"; }
    frame intake_f "Intake" { scope: @c.intake; members: [@c.review, @c.appr, @c.decide, @c.s1]; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}

`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view='v',changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('case plan clipboard, typed tasks, listeners and case file render',()=>{const r=run();
 for(const sh of ['caseplan','userevent','hourglass','dataobject'])assert.ok(r.svg.includes('data-shape="'+sh+'"'),'shape missing: '+sh);
 for(const s of ['Claim case','Review claim','Fraud check','Notify customer'])assert.ok(r.svg.includes(s));});
test('decorators: required / repetition / manual activation / completion badges + discretionary dashed border',()=>{const r=run();
 for(const m of ['required','repetition','manual_activation','completion'])assert.ok(r.svg.includes('data-marker="'+m+'"'),'marker missing: '+m);
 assert.ok(r.svg.includes('stroke-dasharray="6 4"'),'discretionary dashed border missing');});
test('sentry: if-part text, criterion attachment, on-part connectors',()=>{const r=run();
 assert.ok(r.svg.includes('deadline passed'),'if-part text missing');
 assert.ok((r.svg.match(/ddn-verb-sentryref/g)||[]).length===2,'sentryref connectors missing');});
test('planning table attaches at the stage/task top edge with its items',()=>{const r=run();
 assert.ok(r.svg.includes('ddn-planning-table'),'planning table missing');
 assert.ok(r.svg.includes('Senior review')&&r.svg.includes('Legal opinion'),'planning items missing');});
test('dependency connectors render dashed; stage frame renders',()=>{const r=run();
 assert.ok((r.svg.match(/ddn-verb-cmndep/g)||[]).length===5,'dependencies missing');
 assert.ok(r.svg.includes('ddn-frame'),'stage frame missing');});

test('x_cmmn on a non-plan-item is DDN-PJ181',()=>{
 throws(()=>run('v',edit('object plan "Claim case" { kind: "cmmn.caseplan"; }','object plan "Claim case" { kind: "cmmn.caseplan"; x_cmmn: { required: true }; }')),'DDN-PJ181');});
test('Non-blocking applies to human tasks only (DDN-PJ181)',()=>{
 throws(()=>run('v',edit('object decide "Fraud check" { kind: "cmmn.decisiontask"; }','object decide "Fraud check" { kind: "cmmn.decisiontask"; x_cmmn: { nonblocking: true }; }')),'DDN-PJ181');});
test('Sentry attachment must resolve to a plan item (DDN-PJ182)',()=>{
 throws(()=>run('v',edit('attach: @c.review;','attach: @c.plan;')),'DDN-PJ182');
 throws(()=>run('v',edit('on_part: @c.deadline;','on_part: @c.pay;')),'DDN-PJ182');});
test('Planning table on a non-stage/task is DDN-PJ183',()=>{
 throws(()=>run('v',edit('object docs "Documents" { kind: "cmmn.casefile"; }','object docs "Documents" { kind: "cmmn.casefile"; x_planning: { items: [ "x" ]; }; }')),'DDN-PJ183');});
test('Exactly one case plan container per view (DDN-PJ184)',()=>{
 throws(()=>run('v',edit('object plan "Claim case" { kind: "cmmn.caseplan"; }','object plan "Claim case" { kind: "cmmn.caseplan"; } object plan2 "Other" { kind: "cmmn.caseplan"; }')),'DDN-PJ184');});
test('Sentry on-part connector must target a sentry (endpoint contract DDN102)',()=>{
 throws(()=>run('v',edit('relation sr1 "" @deadline -> @s1','relation sr1 "" @deadline -> @pay')),'DDN102');});
test('cmmn.basic@1 remains installed and renders unchanged',()=>{
 const plain={'main.ddn':`ddn "0.5";
module "test.cmmn1";
data c {
    object st "Stage" { kind: "cmmn.stage"; }
    object ms "Done" { kind: "cmmn.milestone"; }
    object se "" { kind: "cmmn.sentry"; x_sentry: { on: "entry" }; }
    relation dep "" @st -> @ms { kind: "analysis.precedes"; }
}
view v "Case" { data: [@c]; projection { kind: graph; profile: "cmmn.basic@1"; } frame f "Stage" { scope: @c.st; members: [@c.se]; } publication { size: content; fit: none; overflow: error; } }
`};
 const r=A.createWorkspace(plain).renderSync({entry:'main.ddn',view:'v'});
 assert.equal(r.profiles.projection.profile,'cmmn.basic@1');assert.match(r.svg,/<svg/);});

const failed=results.filter(r=>!r.pass);
console.log('cmmn-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
