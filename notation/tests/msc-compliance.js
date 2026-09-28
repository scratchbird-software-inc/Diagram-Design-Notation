/* SPDX-License-Identifier: GPL-2.0-or-later. B1-077: MSC (ITU-T Z.120) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.msc";
data m {
    object cli "Client" { kind: "uml.class"; }
    object srv "Server" { kind: "uml.class"; x_invariant: [ { label: "authenticated"; after: @m.m4 } ]; }
    object worker "Worker" { kind: "uml.class"; }
    object ref "Billing HMSC" { kind: "msc.hmscref"; x_subdiagram: { view: "billing" }; }
    relation c1 "start" @cli -> @worker { kind: "uml.message"; x_message: { sort: "create" }; }
    relation m1 "request" @cli -> @srv { kind: "uml.message"; x_fragment: { operator: "coreg"; operands: [ { messages: [ @m.m1, @m.m2 ] } ] }; }
    relation m2 "query" @worker -> @srv { kind: "uml.message"; }
    relation m3 "lost packet" @srv -> @srv { kind: "uml.message"; x_message: { sort: "lost" }; }
    relation m4 "reply" @srv -> @cli { kind: "uml.message"; x_message: { sort: "reply" }; }
    relation m5 "stop" @worker -> @worker { kind: "uml.message"; x_message: { sort: "delete" }; }
}
data b {
    object a "A" { kind: "uml.class"; }
    object bb "B" { kind: "uml.class"; }
    relation q1 "charge" @a -> @bb { kind: "uml.message"; }
}
view chart "MSC" { data: [@m]; projection { kind: sequence; profile: "msc.basic@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
view billing "Billing detail" { data: [@b]; projection { kind: sequence; profile: "msc.basic@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view='chart',changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('msc.basic@1 rebadges uml.sequence@2: lifelines, messages, rebadge note',()=>{const r=run();
 assert.match(r.svg,/<svg/);
 assert.ok(r.svg.includes('Client')&&r.svg.includes('Server'),'lifelines missing');
 assert.ok((r.diagnostics||[]).some(d=>d.code==='DDN-PJW06'),'rebadge info diagnostic missing');});
test('HMSC reference renders «ref» in the participant box',()=>{const r=run();
 assert.ok(r.svg.includes('«ref»'),'ref keyword missing');});
test('coregion fragment renders the coreg operator',()=>{const r=run();
 assert.ok(r.svg.includes('coreg'),'coregion missing');});
test('instance creation (start) and stop (delete) symbols render',()=>{const r=run();
 assert.ok(r.svg.includes('start')&&r.svg.includes('stop'),'create/stop missing');
 assert.ok(r.svg.includes('ddn-destruction'),'stop symbol missing');});
test('message loss renders (lost sort)',()=>{const r=run();
 assert.ok(r.svg.includes('lost packet'),'lost message missing');});
test('inline expressions via state invariants render',()=>{
 const mut={'main.ddn':SRC.replace('relation m4 "reply"','relation m4a "auth ok" @srv -> @srv { kind: "uml.message"; }\n    relation m4 "reply"')};
 const r=run('chart',mut);
 assert.ok(r.svg.includes('authenticated')&&r.svg.includes('ddn-invariant'),'inline expression missing');});
test('lost/found must be self-anchored (PJ156)',()=>{
 throws(()=>run('chart',edit('relation m3 "lost packet" @srv -> @srv','relation m3 "lost packet" @srv -> @cli')),'DDN-PJ156');});
test('HMSC reference must bind an existing view (DDN-PJ119)',()=>{
 throws(()=>run('chart',edit('x_subdiagram: { view: "billing" }','x_subdiagram: { view: "nope" }')),'DDN-PJ119');});
test('uml.sequence@2 unchanged (re-badge does not alter it)',()=>{
 const seq=`ddn "0.5";
module "test.seq2";
data m {
    object a "A" { kind: "uml.class"; }
    object b "B" { kind: "uml.class"; }
    relation m1 "hi" @a -> @b { kind: "uml.message"; }
}
view v "V" { data: [@m]; projection { kind: sequence; profile: "uml.sequence@2"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
 const r=A.createWorkspace({'main.ddn':seq}).renderSync({entry:'main.ddn',view:'v'});
 assert.match(r.svg,/<svg/);});

const failed=results.filter(r=>!r.pass);
console.log('msc-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
