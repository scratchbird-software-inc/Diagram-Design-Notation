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

const failed=results.filter(r=>!r.pass);
console.log('sdl-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
