/* SPDX-License-Identifier: GPL-2.0-or-later. B1-083: SDL (ITU-T Z.100) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.sdl";
data sys {
    object net "Network block" { kind: "sdl.block"; ports { port g1 { direction: inout; } } }
    object app "Application block" { kind: "sdl.block"; ports { port g2 { direction: inout; } }
    }
    object sig "OrderReq" { kind: "sdl.signal"; }
    object sigs "Order signals" { kind: "sdl.signalset"; }
    relation ch "[OrderReq, OrderAck]" @net.g1 -> @app.g2 { kind: "sdl.channel"; }
    relation l1 "" @sig -> @net { kind: "sdl.links"; }
    relation l2 "" @sigs -> @app { kind: "sdl.links"; }
}
data p {
    object start "" { kind: "state.initial"; }
    object idle "Idle" { kind: "state.state"; }
    object in1 "OrderReq" { kind: "sdl.input"; }
    object work "Process order" { kind: "sdl.task"; }
    object dec "" { kind: "state.junction"; }
    object out1 "OrderAck" { kind: "sdl.output"; }
    object store "Save order" { kind: "sdl.save"; }
    object proc "Billing" { kind: "sdl.procedure"; }
    object newstate "Tracking" { kind: "sdl.create"; }
    object done "" { kind: "state.final"; }
    relation t1 "" @start -> @idle { kind: "state.transition"; }
    relation t2 "OrderReq" @idle -> @in1 { kind: "state.transition"; }
    relation t3 "" @in1 -> @work { kind: "state.transition"; }
    relation t4 "" @work -> @dec { kind: "state.transition"; }
    relation t5 "ok" @dec -> @out1 { kind: "state.transition"; }
    relation t6 "hold" @dec -> @store { kind: "state.transition"; }
    relation t7 "" @out1 -> @proc { kind: "state.transition"; }
    relation t8 "" @store -> @proc { kind: "state.transition"; }
    relation t9 "" @proc -> @newstate { kind: "state.transition"; }
    relation t10 "" @newstate -> @done { kind: "state.transition"; }
}
view system "System" { data: [@sys]; projection { kind: graph; profile: "sdl.basic@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
view process "Process" { data: [@p]; projection { kind: graph; profile: "sdl.process@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view,changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('structural level: block keywords, channel with signal list, signal flag and signal set',()=>{const r=run('system');
 assert.ok(r.svg.includes('«block»'),'block keyword missing');
 assert.ok(r.svg.includes('[OrderReq, OrderAck]'),'channel signal list missing');
 assert.ok(r.svg.includes('OrderReq'),'signal flag missing');
 assert.ok(r.svg.includes('«signalset»'),'signal set keyword missing');});
test('gates are block ports (port squares render)',()=>{const r=run('system');
 assert.ok(r.svg.includes('data-port-square'),'gate square missing');});
test('process level: SDL symbols — input/output flags, task, save, create, procedure',()=>{const r=run('process');
 assert.ok(r.svg.includes('acceptpent'),'input flag missing');
 assert.ok(r.svg.includes('sendpent'),'output flag missing');
 assert.ok(r.svg.includes('data-shape="tag"'),'save symbol missing');
 assert.ok(r.svg.includes('data-shape="subprocess"'),'procedure reference missing');
 assert.ok((r.diagnostics||[]).some(d=>d.code==='DDN-PJW06'),'rebadge note missing');});
test('exactly one start symbol (DDN-PJ208)',()=>{
 throws(()=>run('process',edit('object start "" { kind: "state.initial"; }','object start "" { kind: "state.initial"; } object start2 "" { kind: "state.initial"; }')),'DDN-PJ208');});
test('process symbols need an outgoing transition (DDN-PJ208)',()=>{
 throws(()=>run('process',{'main.ddn':SRC.replace('    relation t3 "" @in1 -> @work { kind: "state.transition"; }\n','')}),'DDN-PJ208');});
test('sdl.task in a structural view is a vocabulary error (endpoint contract DDN102)',()=>{
 throws(()=>run('system',edit('object sigs "Order signals" { kind: "sdl.signalset"; }','object sigs "Order signals" { kind: "sdl.signalset"; }\n    object t "T" { kind: "sdl.task"; }\n    relation x "" @t -> @net { kind: "sdl.channel"; }')),'DDN102');});

/* B1-089: SDL timers, channel signal references, priority/spontaneous/continuous markers. */
const TM=`ddn "0.5";
module "test.sdl.timers";
data sys {
    object net "Network block" { kind: "sdl.block"; ports { port g1 { direction: inout; } } }
    object app "Application block" { kind: "sdl.block"; ports { port g2 { direction: inout; } } }
    object sig "OrderReq" { kind: "sdl.signal"; }
    object ack "OrderAck" { kind: "sdl.signal"; }
    relation l1 "[OrderReq, OrderAck]" @net.g1 -> @app.g2 { kind: "sdl.channel"; x_sdl: { signals: [ @sig, @ack ] }; }
}
data p {
    object start "" { kind: "state.initial"; }
    object idle "Idle" { kind: "state.state"; }
    object t1 "T1" { kind: "sdl.timer"; }
    object in1 "OrderReq" { kind: "sdl.input"; x_sdl: { priority: "high" }; }
    object s1 "set(now+5, T1)" { kind: "sdl.set"; x_sdl: { timer: @t1, duration: "5s" }; }
    object r1 "reset(T1)" { kind: "sdl.reset"; x_sdl: { timer: @t1 }; }
    object w1 "wait" { kind: "sdl.input"; x_sdl: { active: @t1 }; }
    object sp "" { kind: "sdl.input"; x_sdl: { spontaneous: true }; }
    object cs "queue < 10" { kind: "sdl.input"; x_sdl: { continuous: "queue < 10" }; }
    object done "" { kind: "state.final"; }
    relation e1 "" @start -> @idle { kind: "state.transition"; }
    relation e2 "" @idle -> @in1 { kind: "state.transition"; }
    relation e3 "" @in1 -> @s1 { kind: "state.transition"; }
    relation e4 "" @s1 -> @w1 { kind: "state.transition"; }
    relation e5 "" @w1 -> @r1 { kind: "state.transition"; }
    relation e6 "" @r1 -> @sp { kind: "state.transition"; }
    relation e7 "" @sp -> @cs { kind: "state.transition"; }
    relation e8 "" @cs -> @done { kind: "state.transition"; }
}
view system "S" { data: [@sys]; projection { kind: graph; profile: "sdl.basic@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
view process "P" { data: [@p]; projection { kind: graph; profile: "sdl.process@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const runTm=(view,changes={})=>A.createWorkspace({'main.ddn':TM,...changes}).renderSync({entry:'main.ddn',view});
const tmedit=(before,after)=>{assert.ok(TM.includes(before),'Mutation target missing: '+before);return{'main.ddn':TM.replace(before,after)};};
test('timer declaration/set/reset nodes and channel signal references render',()=>{
 const r=runTm('process');
 assert.ok(r.svg.includes('T1')&&r.svg.includes('set(now+5, T1)')&&r.svg.includes('reset(T1)'),'timer nodes missing');
 const s2=runTm('system');
 assert.ok(s2.svg.includes('OrderReq, OrderAck'),'channel label missing');});
test('x_sdl channel signal references must resolve to sdl.signal (DDN-PJ215)',()=>{
 throws(()=>runTm('system',tmedit('signals: [ @sig, @ack ]','signals: [ @sig, @l1 ]')),'DDN-PJ215');});
test('timer set/reset must reference a declared sdl.timer (DDN-PJ215)',()=>{
 throws(()=>runTm('process',tmedit('x_sdl: { timer: @t1, duration: "5s" }; }','x_sdl: { timer: @idle, duration: "5s" }; }')),'DDN-PJ215');});
test('active() query must reference a timer (DDN-PJ215)',()=>{
 throws(()=>runTm('process',tmedit('x_sdl: { active: @t1 }; }','x_sdl: { active: @idle }; }')),'DDN-PJ215');});
test('markers belong to sdl.input (DDN-PJ215)',()=>{
 throws(()=>runTm('process',tmedit('object s1 "set(now+5, T1)" { kind: "sdl.set"; x_sdl: { timer: @t1, duration: "5s" }; }','object s1 "set(now+5, T1)" { kind: "sdl.set"; x_sdl: { timer: @t1, duration: "5s", priority: "low" }; }')),'DDN-PJ215');});
test('a spontaneous transition takes no priority or continuous condition (DDN-PJ215)',()=>{
 throws(()=>runTm('process',tmedit('x_sdl: { spontaneous: true }; }','x_sdl: { spontaneous: true, priority: "high" }; }')),'DDN-PJ215');});
test('signals/nodelay belong to sdl.channel relations (DDN-PJ215)',()=>{
 throws(()=>runTm('system',tmedit('object net "Network block" { kind: "sdl.block";','object net "Network block" { kind: "sdl.block"; x_sdl: { nodelay: true };')),'DDN-PJ215');
 throws(()=>runTm('system',tmedit('relation l1 "[OrderReq, OrderAck]" @net.g1 -> @app.g2 { kind: "sdl.channel"; x_sdl: { signals: [ @sig, @ack ] }; }','relation l1 "[OrderReq, OrderAck]" @net.g1 -> @app.g2 { kind: "sdl.channel"; x_sdl: { signals: [ @sig, @ack ], priority: "high" }; }')),'DDN-PJ215');});
test('set/reset without an outgoing transition fail (DDN-PJ208)',()=>{
 throws(()=>runTm('process',tmedit('    relation e4 "" @s1 -> @w1 { kind: "state.transition"; }\n','')),'DDN-PJ208');});
test('x_sdl applies to SDL kinds only (DDN-PJ215)',()=>{
 throws(()=>runTm('system',tmedit('object sig "OrderReq" { kind: "sdl.signal"; }','object sig "OrderReq" { kind: "sdl.signal"; }\n    object other "O" { kind: "activity"; x_sdl: { nodelay: true }; }')),'DDN-PJ215');});

const failed=results.filter(r=>!r.pass);
console.log('sdl-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
