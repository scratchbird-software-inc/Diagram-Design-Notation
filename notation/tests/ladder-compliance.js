/* SPDX-License-Identifier: GPL-2.0-or-later. B1-085: IEC 61131-3 ladder fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.ladder";
data rung1 {
    object l1 "L1" { kind: "ladder.label"; }
    object start "START" { kind: "ladder.contact"; x_contact: { form: "no" }; }
    object stop "STOP" { kind: "ladder.contact"; x_contact: { form: "nc" }; }
    object motor "MOTOR" { kind: "ladder.coil"; x_coil: { mode: "normal" }; }
    relation s1 "" @start -> @stop { kind: "ladder.series"; }
    relation s2 "" @stop -> @motor { kind: "ladder.series"; }
}
data rung2 {
    object auto_start "AUTO" { kind: "ladder.contact"; }
    object manual_start "MANUAL" { kind: "ladder.contact"; }
    object latch "LATCH" { kind: "ladder.coil"; x_coil: { mode: "set" }; }
    relation s3 "" @auto_start -> @latch { kind: "ladder.series"; }
    relation s4 "" @manual_start -> @latch { kind: "ladder.series"; }
}
data rung3 {
    object run "RUN" { kind: "ladder.contact"; }
    object t1 "T1" { kind: "fbd.block"; datatype: "TON";
        ports {
            port in1 { direction: in; x_fbd: { type: "BOOL" }; }
            port pt { direction: in; x_fbd: { type: "TIME" }; }
            port q { direction: out; x_fbd: { type: "BOOL" }; }
        }
    }
    object done "DONE" { kind: "ladder.coil"; x_coil: { mode: "reset" }; }
    object j1 "NEXT" { kind: "ladder.jump"; x_jump: { target: @rung1.l1 }; }
    relation s5 "" @run -> @t1.in1 { kind: "ladder.series"; }
    relation s6 "" @t1.q -> @done { kind: "ladder.series"; }
}
view d "LD" { data: [@rung1, @rung2, @rung3]; projection { kind: graph; profile: "ladder.basic@1"; } layout { algorithm: ladder; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view='d',changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const geom=(r,id)=>r.scene.nodes.find(n=>n.id.endsWith('::'+id));

test('power rails render and flank the rung area',()=>{const r=run();
 assert.ok(r.svg.includes('ddn-ladder-rails'),'rails missing');
 const xs=[...r.svg.matchAll(/<path d="M(-?[\d.]+) -?[\d.]+V-?[\d.]+" fill="none" stroke="[^"]+" stroke-width="2.5"/g)].map(m=>+m[1]);
 assert.equal(xs.length,2,'two rails');
 const gx0=Math.min(...r.scene.nodes.map(n=>n.x)),gx1=Math.max(...r.scene.nodes.map(n=>n.x+n.w));
 assert.ok(xs[0]<gx0&&xs[1]>gx1,'rails must flank all rungs');});
test('NO/NC contact glyphs and coil mode variants render',()=>{const r=run();
 assert.ok(r.svg.includes('data-form="no"')&&r.svg.includes('data-form="nc"'),'contact forms missing');
 for(const m of ['normal','set','reset'])assert.ok(r.svg.includes('data-mode="'+m+'"'),'coil mode '+m+' missing');});
test('negated coil renders a slash',()=>{
 const r=run('d',edit('x_coil: { mode: "normal" }; }','x_coil: { mode: "negated" }; }'));
 assert.ok(r.svg.includes('data-mode="negated"'),'negated coil missing');});
test('rung layout: series runs left to right, coil is rightmost, label is leftmost',()=>{const r=run();
 const l1=geom(r,'rung1.l1'),start=geom(r,'rung1.start'),stop=geom(r,'rung1.stop'),motor=geom(r,'rung1.motor');
 assert.ok(l1.x<start.x&&start.x<stop.x&&stop.x<motor.x,'series order wrong');
 assert.ok(Math.abs(l1.y-start.y)<1,'label shares the rung track');});
test('parallel OR branch: shared-junction contacts stack on separate tracks',()=>{const r=run();
 const a=geom(r,'rung2.auto_start'),m=geom(r,'rung2.manual_start'),c=geom(r,'rung2.latch');
 assert.ok(a.x===m.x,'branch contacts share a column');
 assert.ok(a.y!==m.y,'branch contacts occupy parallel tracks');
 assert.ok(c.x>a.x,'coil right of the branch');});
test('rungs stack top to bottom in declaration order',()=>{const r=run();
 assert.ok(geom(r,'rung1.start').y<geom(r,'rung2.latch').y,'rung1 above rung2');
 assert.ok(geom(r,'rung2.latch').y<geom(r,'rung3.done').y,'rung2 above rung3');});
test('fbd.block hosts on a rung with pin-level series wiring',()=>{const r=run();
 assert.ok(r.svg.includes('TON'),'fbd header missing');
 assert.ok(r.svg.includes('data-port-square'),'pin squares missing');
 const t1=geom(r,'rung3.t1'),run2=geom(r,'rung3.run'),done=geom(r,'rung3.done');
 assert.ok(run2.x<t1.x&&t1.x<done.x,'fbd block sits mid-rung');});
test('jump and label render; jump target resolves (DDN-PJ213 ok path)',()=>{const r=run();
 assert.ok(r.svg.includes('NEXT')&&r.svg.includes('L1'),'jump/label names missing');});
test('exactly one coil per rung (DDN-PJ211)',()=>{
 throws(()=>run('d',edit('object motor "MOTOR" { kind: "ladder.coil"; x_coil: { mode: "normal" }; }','object motor "MOTOR" { kind: "ladder.coil"; x_coil: { mode: "normal" }; }\n    object motor2 "M2" { kind: "ladder.coil"; }')),'DDN-PJ211');
 throws(()=>run('d',edit('object motor "MOTOR" { kind: "ladder.coil"; x_coil: { mode: "normal" }; }','object motor "MOTOR" { kind: "ladder.contact"; }')),'DDN-PJ211');});
test('x_contact/x_coil apply to their ladder kinds only (DDN-PJ211)',()=>{
 throws(()=>run('d',edit('object stop "STOP" { kind: "ladder.contact"; x_contact: { form: "nc" }; }','object stop "STOP" { kind: "ladder.coil"; x_contact: { form: "nc" }; }')),'DDN-PJ211');});
test('series wiring cannot cross rungs (DDN-PJ212)',()=>{
 throws(()=>run('d',edit('relation s2 "" @stop -> @motor { kind: "ladder.series"; }','relation s2 "" @stop -> @rung2.latch { kind: "ladder.series"; }')),'DDN-PJ212');});
test('jump must target a selected ladder.label (DDN-PJ213)',()=>{
 throws(()=>run('d',edit('x_jump: { target: @rung1.l1 }; }','x_jump: { target: @rung1.start }; }')),'DDN-PJ213');
 throws(()=>run('d',edit('object start "START" { kind: "ladder.contact"; x_contact: { form: "no" }; }','object start "START" { kind: "ladder.contact"; x_contact: { form: "no" }; x_jump: { target: @rung1.l1 }; }')),'DDN-PJ213');});
test('the profile requires layout algorithm ladder (DDN-PJ214)',()=>{
 throws(()=>run('d',edit('layout { algorithm: ladder; }','layout { algorithm: layered; }')),'DDN-PJ214');});

const failed=results.filter(r=>!r.pass);
console.log('ladder-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
