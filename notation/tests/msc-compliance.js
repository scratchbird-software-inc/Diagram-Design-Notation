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

/* B1-089: invariant setting/guarding split + HMSC reference parameter lists. */
test('x_invariant entries may declare the setting/guarding role split',()=>{
 const r=run('chart',edit('x_invariant: [ { label: "authenticated"; after: @m.m4 } ]; }','x_invariant: [ { label: "authenticated"; after: @m.m4, role: "guarding" } ]; }'));
 assert.ok(r.svg.includes('authenticated'),'invariant missing');
 const r2=run('chart',edit('x_invariant: [ { label: "authenticated"; after: @m.m4 } ]; }','x_invariant: [ { label: "authenticated"; after: @m.m4, role: "setting" } ]; }'));
 assert.ok(r2.svg.includes('authenticated'),'invariant missing');});
test('HMSC reference carries actual parameter lists (x_hmscref)',()=>{
 const r=run('chart',edit('object ref "Billing HMSC" { kind: "msc.hmscref"; x_subdiagram: { view: "billing" }; }','object ref "Billing HMSC" { kind: "msc.hmscref"; x_subdiagram: { view: "billing" }; x_hmscref: { params: [ "shop", "amount" ] }; }'));
 assert.ok(r.svg.includes('Billing HMSC'),'hmsc ref missing');});
test('x_hmscref applies to msc.hmscref only (DDN-PJ215)',()=>{
 throws(()=>run('chart',edit('object srv "Server" { kind: "uml.class"; x_invariant: [ { label: "authenticated"; after: @m.m4 } ]; }','object srv "Server" { kind: "uml.class"; x_invariant: [ { label: "authenticated"; after: @m.m4 } ]; x_hmscref: { params: [ "x" ] }; }')),'DDN-PJ215');});

/* Geometry regressions (owner-reported collisions on the live gallery plate).
 * All coordinates are drawing units; s=1 at the default 16px base font, so
 * headH=52, pitch=64, firstRow=118, rows at 118/182/246/310/374/438, and
 * participants at x=110/340/570/800. */
test('«create» arrow terminates at the head-box edge, not through it',()=>{
 const r=run();
 const c1=r.scene.marks.find(m=>m.sourceIds?.some(id=>id.endsWith('.c1')));
 assert.ok(c1,'create message mark missing');
 assert.equal(c1.x,110);assert.equal(c1.w,395,'create arrow must end at the Worker head edge (570-65), not the lifeline centre');});
test('created participant activation starts below the head box',()=>{
 const r=run();
 const bar=r.scene.marks.find(m=>m.sourceIds?.some(id=>id.endsWith('.worker'))&&m.w===10);
 assert.ok(bar,'worker activation mark missing');
 assert.equal(bar.y,144,'activation must start at the head-box bottom (92+52), not inside the box');});
test('fragment frame clears created head boxes above it',()=>{
 const r=run();
 const m=r.svg.match(/class="ddn-fragment ddn-fragment-coreg"[^>]*><rect x="([\d.-]+)" y="([\d.-]+)"/);
 assert.ok(m,'coreg frame missing');
 assert.ok(+m[2]>=150,'frame top must clear the Worker head bottom plus margin, got y='+m[2]);});
test('state invariant is on its lifeline clear of the next message label zone',()=>{
 const r=run();
 const inv=r.scene.marks.find(m=>m.property==='x_invariant');
 assert.ok(inv,'invariant mark missing');
 assert.ok(inv.y+inv.h<=416,'invariant bottom must clear the next label zone (top 416), got bottom '+(inv.y+inv.h));});
test('lost-message label is anchored clear of the activation bar',()=>{
 const r=run();
 const t=r.svg.match(/<text x="([\d.-]+)" y="([\d.-]+)"[^>]*text-anchor="(\w+)"[^>]*>4\. lost packet<\/text>/);
 assert.ok(t,'lost label missing');
 assert.equal(t[3],'start','lost label must be start-anchored right of the lifeline, not centred over the bar');});
test('last-message activation is clamped to the message row and the lifeline end',()=>{
 const r=run();
 const bar=r.scene.marks.find(m=>m.sourceIds?.some(id=>id.endsWith('.cli'))&&m.w===10);
 assert.ok(bar,'reply activation mark missing');
 assert.ok(bar.h<=40,'reply activation must span only its own row (was a floating segment to the chart bottom), got h='+bar.h);});
test('stop renders the Z.120 square-with-cross at the lifeline end, no self-loop',()=>{
 const r=run();
 const g=r.svg.match(/<g class="ddn-destruction"[\s\S]*?<\/g>/);
 assert.ok(g&&g[0].includes('<rect'),'stop must be a square with a diagonal cross');
 const sq=g[0].match(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/);
 assert.deepEqual([+sq[3],+sq[4]],[16,16]);
 assert.ok(!r.svg.includes('M570 438H618'),'delete self-message must not draw a loop');});
test('«ref» participant draws no lifeline and earns no PJW03',()=>{
 const r=run();
 assert.ok(!r.diagnostics.some(d=>d.code==='DDN-PJW03'),'ref box must not warn as an empty participant');
 const lifelines=(r.svg.match(/stroke-dasharray="5 5"/g)||[]).length;
 assert.equal(lifelines,3,'exactly the three real participants have lifelines');});

const failed=results.filter(r=>!r.pass);
console.log('msc-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
