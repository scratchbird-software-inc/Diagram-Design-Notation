/* SPDX-License-Identifier: GPL-2.0-or-later. B1-084: IEC 61131-3 FBD fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.fbd";
data m {
    object start_btn "START" { kind: "fbd.variable"; }
    object stop_btn "STOP" { kind: "fbd.variable"; }
    object t1 "T1" { kind: "fbd.block"; datatype: "TON";
        ports {
            port in1 { direction: in; x_fbd: { type: "BOOL" }; }
            port pt { direction: in; x_fbd: { type: "TIME" }; }
            port q { direction: out; x_fbd: { type: "BOOL" }; }
        }
    }
    object a1 "A1" { kind: "fbd.block"; datatype: "AND";
        ports {
            port ina { direction: in; x_fbd: { type: "BOOL" }; }
            port inb { direction: in; x_fbd: { type: "BOOL", negated: true }; }
            port out1 { direction: out; x_fbd: { type: "BOOL" }; }
        }
    }
    object motor "MOTOR" { kind: "fbd.variable"; }
    relation w1 "" @start_btn -> @a1.ina { kind: "fbd.wire"; }
    relation w2 "" @stop_btn -> @a1.inb { kind: "fbd.wire"; }
    relation w3 "" @a1.out1 -> @t1.in1 { kind: "fbd.wire"; }
    relation w4 "" @t1.q -> @motor { kind: "fbd.wire"; }
    relation fb "" @t1.q -> @a1.ina { kind: "fbd.wire"; }
}
view d "FBD" { data: [@m]; projection { kind: graph; profile: "fbd.basic@1"; } layout { algorithm: layered; direction: right; gap: 112px; row_gap: 112px; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view='d',changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('blocks render name/type headers (TON, AND) and pin squares with type labels',()=>{const r=run();
 assert.ok(r.svg.includes('TON')&&r.svg.includes('AND'),'type headers missing');
 assert.ok(r.svg.includes('data-port-square'),'pin squares missing');
 assert.ok(r.svg.includes('ddn-fbd-pin'),'pin type labels missing');});
test('negation bubble renders on the negated BOOL pin',()=>{const r=run();
 assert.ok(r.svg.includes('data-negated'),'negation bubble missing');});
test('feedback wire renders (loops allowed)',()=>{const r=run();
 assert.ok(r.svg.includes('ddn-verb-fbdwire'),'wires missing');
 assert.match(r.svg,/<svg/);});
test('negation only on BOOL pins (DDN-PJ209)',()=>{
 throws(()=>run('d',edit('port pt { direction: in; x_fbd: { type: "TIME" }; }','port pt { direction: in; x_fbd: { type: "TIME", negated: true }; }')),'DDN-PJ209');});
test('wire endpoints must share a type (DDN-PJ210)',()=>{
 throws(()=>run('d',edit('port in1 { direction: in; x_fbd: { type: "BOOL" }; }','port in1 { direction: in; x_fbd: { type: "INT" }; }')),'DDN-PJ210');});
test('x_fbd applies to fbd kinds only (DDN-PJ209)',()=>{
 throws(()=>run('d',edit('object motor "MOTOR" { kind: "fbd.variable"; }','object motor "MOTOR" { kind: "fbd.variable"; }\n    object other "Other" { kind: "activity"; ports { port z { direction: in; x_fbd: { type: "BOOL" }; } } }')),'DDN-PJ209');});
test('unwired blocks render without error (no relations needed)',()=>{
 const bare=`ddn "0.5";
module "test.fbdbare";
data m {
    object t "T" { kind: "fbd.block"; datatype: "TON"; ports { port in1 { direction: in; x_fbd: { type: "BOOL" }; } port q { direction: out; x_fbd: { type: "BOOL" }; } } }
}

view d "D" { data: [@m]; projection { kind: graph; profile: "fbd.basic@1"; } publication { size: content; fit: none; overflow: error; } }
`;
 const r=A.createWorkspace({'main.ddn':bare}).renderSync({entry:'main.ddn',view:'d'});
 assert.match(r.svg,/<svg/);});

const failed=results.filter(r=>!r.pass);
console.log('fbd-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
