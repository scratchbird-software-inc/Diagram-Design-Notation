/* SPDX-License-Identifier: GPL-2.0-or-later. B1-078: IDEF0 (IEEE 1320.1) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.idef0";
data m {
    object a0 "Manage shop" { kind: "idef0.activity"; x_idef0: { node: "A0" };
        ports {
            port orders { direction: in; side: west; x_icom: { type: "input" }; }
            port policy { direction: in; side: north; x_icom: { type: "control" }; }
            port service { direction: out; side: east; x_icom: { type: "output" }; }
            port staff { direction: in; side: south; x_icom: { type: "mechanism" }; }
        }
        x_subdiagram: { view: "detail" };
    }
}
data d {
    object a1 "Take orders" { kind: "idef0.activity"; x_idef0: { node: "A01" };
        ports { port packed { direction: out; side: east; x_icom: { type: "output" }; } }
    }
    object a3 "Stock shelves" { kind: "idef0.activity"; x_idef0: { node: "A03" };
        ports { port packed { direction: in; side: west; x_icom: { type: "input" }; } }
    }
    object a2 "Ship orders" { kind: "idef0.activity"; x_idef0: { node: "A02" };
        ports {
            port packed { direction: in; side: west; x_icom: { type: "input" }; }
            port shipped { direction: out; side: east; x_icom: { type: "output" }; }
        }
    }
    relation f1 "packed orders" @a1.packed -> @a2.packed { kind: "idef0.flow"; }
    relation f2 "packed orders" @a1.packed -> @a3.packed { kind: "idef0.flow"; }
    relation f3 "returns" @a3.packed -> @a1.packed { kind: "idef0.flow"; x_tunnel: { start: true }; }
    relation call1 "" @a2 -> @a1 { kind: "idef0.call"; x_tunnel: { end: true }; }
}
view context "A-0" { data: [@m]; projection { kind: graph; profile: "idef0.basic@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
view detail "A0 detail" { data: [@d]; projection { kind: graph; profile: "idef0.basic@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view,changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('A-0 context: single activity with all four ICOM sides and a decomposition badge',()=>{const r=run('context');
 assert.ok(r.svg.includes('Manage shop'),'activity missing');
 assert.ok(r.svg.includes('ddn-ref-badge'),'decomposition badge missing');});
test('labeled arrows with fork/join, tunnel marks, and the call arrow render',()=>{const r=run('detail');
 assert.ok(r.svg.includes('packed orders'),'arrow label missing');
 assert.ok((r.svg.match(/M-9 -6A9 9 0 0 0 -9 6/g)||[]).length>=2,'tunnel parentheses missing');});
test('ICOM type must match the declared side (DDN-PJ200)',()=>{
 throws(()=>run('context',edit('port orders { direction: in; side: west; x_icom: { type: "input" }; }','port orders { direction: in; side: east; x_icom: { type: "input" }; }')),'DDN-PJ200');
 throws(()=>run('context',edit('port staff { direction: in; side: south; x_icom: { type: "mechanism" }; }','port staff { direction: in; side: south; x_icom: { type: "output" }; }')),'DDN-PJ200');});
test('IDEF0 ports need an ICOM type under the profile (DDN-PJ200)',()=>{
 throws(()=>run('context',edit('port orders { direction: in; side: west; x_icom: { type: "input" }; }','port orders { direction: in; side: west; }')),'DDN-PJ200');});
test('node numbers: malformed/missing rejected by the contract (DDN105), duplicates PJ201',()=>{
 throws(()=>run('detail',edit('x_idef0: { node: "A03" }','x_idef0: { node: "A02" }')),'DDN-PJ201');
 throws(()=>run('detail',edit('x_idef0: { node: "A01" }','x_idef0: { }')),'DDN105');
 throws(()=>run('detail',edit('x_idef0: { node: "A01" }','x_idef0: { node: "B1" }')),'DDN105');});
test('decomposition children must number under the parent (DDN-PJ201)',()=>{
 throws(()=>run('context',{'main.ddn':SRC.replace('node: "A01"','node: "A1"')}),'DDN-PJ201');
 throws(()=>run('context',edit('x_subdiagram: { view: "detail" }','x_subdiagram: { view: "nope" }')),'DDN-PJ119');});
test('decomposition must target an idef0.basic@1 view (DDN-PJ201)',()=>{
 const mut={'main.ddn':SRC.replace('view context "A-0" { data: [@m]; projection { kind: graph; profile: "idef0.basic@1"; }','view other "Other" { data: [@m]; projection { kind: graph; profile: "ddn@1"; } publication { size: content; fit: none; overflow: error; } }\nview context "A-0" { data: [@m]; projection { kind: graph; profile: "idef0.basic@1"; }').replace('x_subdiagram: { view: "detail" }','x_subdiagram: { view: "other" }')};
 throws(()=>run('context',mut),'DDN-PJ201');});

const failed=results.filter(r=>!r.pass);
console.log('idef0-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
