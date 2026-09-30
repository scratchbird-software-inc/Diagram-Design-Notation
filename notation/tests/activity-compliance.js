/* SPDX-License-Identifier: GPL-2.0-or-later. B1-060 : UML 2.5.1 activity-diagram completeness fixtures (uml.activity@2). */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.act2";

data m {
    object start "" { kind: "flow.start"; }
    object take "Take order" { kind: "flow.process";
        ports {
            port order_in { direction: in; x_pin: { set: "request"; }; }
            port order_out { direction: out; x_pin: { streaming: true; }; }
        }
    }
    object dec "" { kind: "flow.decision"; }
    object mrg "" { kind: "flow.merge"; }
    object pack "Pack" { kind: "flow.process"; }
    object snd "" { kind: "flow.sendsignal"; }
    object acc "" { kind: "flow.acceptsignal"; }
    object wait "after(24h)" { kind: "flow.timeevent"; }
    object ship "Ship" { kind: "flow.process"; }
    object fail "Handle failure" { kind: "flow.process"; }
    object ffin "" { kind: "flow.flowfinal"; }
    object fin "" { kind: "flow.end"; }

    relation e1 "" @start -> @take.order_in { kind: "uml.flow"; }
    relation e2 "" @take.order_out -> @dec { kind: "uml.flow"; }
    relation e3 "ok" @dec -> @pack { kind: "uml.flow"; x_diagram: { branch: "ok"; }; }
    relation e4 "fail" @dec -> @fail { kind: "uml.flow"; x_diagram: { branch: "fail"; }; x_exception: true; }
    relation e5 "" @pack -> @mrg { kind: "uml.flow"; }
    relation e6 "" @fail -> @mrg { kind: "uml.flow"; }
    relation e7 "" @mrg -> @snd { kind: "uml.flow"; }
    relation e8 "" @snd -> @acc { kind: "uml.flow"; }
    relation e9 "" @acc -> @wait { kind: "uml.flow"; }
    relation e10 "" @wait -> @ship { kind: "uml.flow"; }
    relation e11 "" @ship -> @ffin { kind: "uml.flow"; }
    relation e12 "" @ship -> @fin { kind: "uml.flow"; x_interrupt: true; }
}

view v "Activity completeness" {
    data: [@m];
    projection { kind: graph; profile: "uml.activity@2"; }
    frame danger "Interruptible" { members: [@m.ship]; x_interruptible: true; }
    frame struct "Iterative" { members: [@m.take, @m.dec, @m.mrg]; x_structured: { mode: "iterative" }; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(changes={},view='v'){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('uml.activity@2 renders pins (attached and border), streaming fill and set labels',()=>{const r=run();
 assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.profile,'uml.activity@2');
 assert.ok(r.svg.includes('data-port-square'),'pin squares missing');
 assert.ok(r.svg.includes('data-streaming'),'streaming pin missing');
 assert.ok(r.svg.includes('>request<'),'parameter-set label missing');});
test('Signal pentagons, time-event hourglass and flow final render',()=>{const r=run();
 for(const sh of ['sendpent','acceptpent','hourglass','flowfinal'])assert.ok(r.svg.includes('data-shape="'+sh+'"'),'glyph missing: '+sh);});
test('Interruptible region renders dashed roundrect; structured region shows «iterative»',()=>{const r=run();
 assert.ok(r.svg.includes('data-interruptible="true"'),'interruptible frame missing');
 assert.ok(r.svg.includes('«iterative»'),'structured keyword missing');});
test('Interrupt and exception edges render as lightning bolts',()=>{const r=run();
 assert.ok(r.svg.includes('data-lightning="interrupt"'),'interrupt bolt missing');
 assert.ok(r.svg.includes('data-lightning="exception"'),'exception bolt missing');});
test('Decision keeps named-branch rule; merge validates fan-in/fan-out',()=>{const r=run();
 assert.ok(r.svg.includes('data-shape="diamond"'),'decision/merge diamonds missing');});

test('Merge needs ≥2 incoming and exactly 1 outgoing (DDN-PJ167)',()=>{
 throws(()=>run(edit('relation e6 "" @fail -> @mrg { kind: "uml.flow"; }','relation e6 "" @fail -> @snd { kind: "uml.flow"; }')),'DDN-PJ167');
 throws(()=>run(edit('relation e7 "" @mrg -> @snd { kind: "uml.flow"; }','relation e7 "" @mrg -> @snd { kind: "uml.flow"; } relation e7b "" @mrg -> @acc { kind: "uml.flow"; }')),'DDN-PJ167');});
test('Interrupt edge must start inside an interruptible region (DDN-PJ168)',()=>{
 throws(()=>run(edit('frame danger "Interruptible" { members: [@m.ship];','frame danger "Interruptible" { members: [];')),'DDN-PJ168');});
test('Exception edge must target a handler action (DDN-PJ168)',()=>{
 throws(()=>run(edit('relation e12 "" @ship -> @fin { kind: "uml.flow"; x_interrupt: true; }','relation e12 "" @ship -> @fin { kind: "uml.flow"; x_interrupt: true; x_exception: true; }')),'DDN-PJ168');});
test('x_pin on a non-action owner is DDN-PJ169',()=>{
 throws(()=>run(edit('object mrg "" { kind: "flow.merge"; }','object mrg "" { kind: "flow.merge"; ports { port p { direction: in; x_pin: { set: "x"; }; } } }')),'DDN-PJ169');});
test('Flow final counts as an end; start/end presence keeps working (DDN-PF008)',()=>{
 throws(()=>run(edit('relation e12 "" @ship -> @fin { kind: "uml.flow"; x_interrupt: true; }','relation e12 "" @ship -> @fin { kind: "uml.flow"; x_interrupt: true; } relation e13 "" @fin -> @pack { kind: "uml.flow"; }')),'DDN-PF008');});
test('uml.activity@1 remains installed and renders unchanged',()=>{
 const plain={'main.ddn':`ddn "0.5";
module "test.act1";
data m {
    object start "" { kind: "flow.start"; }
    object a "A" { kind: "flow.process"; }
    object fin "" { kind: "flow.end"; }
    relation e1 "" @start -> @a { kind: "uml.flow"; }
    relation e2 "" @a -> @fin { kind: "uml.flow"; }
}
view v "Plain" { data: [@m]; projection { kind: graph; profile: "uml.activity@1"; } publication { size: content; fit: none; overflow: error; } }
`};
 const r=A.createWorkspace(plain).renderSync({entry:'main.ddn',view:'v'});
 assert.equal(r.profiles.projection.profile,'uml.activity@1');assert.match(r.svg,/<svg/);assert.ok(!r.svg.includes('data-lightning'),'plain @1 view must not draw lightning edges');});

const failed=results.filter(r=>!r.pass);
console.log('activity-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
