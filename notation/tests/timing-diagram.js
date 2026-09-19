/* SPDX-License-Identifier: GPL-2.0-or-later. Timing projection (kind:timing, uml.timing@1) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const SRC=`ddn "0.5";
module "test.timing";

data signals {
    object controller "Controller" { kind: application;
        x_states: [{at: 0, state: "red"}, {at: 25, state: "green"}, {at: 55, state: "amber"}];
    }
    object pedestrian_signal "Pedestrian signal" { kind: application;
        x_states: [{at: 0, state: "wait"}, {at: 25, state: "walk"}, {at: 45, state: "wait"}];
    }
}

view timing "Synthetic traffic lights / timing" {
    data: [@signals];
    projection { kind: timing; profile: "uml.timing@1"; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({'main.ddn':SRC,...changes});}
function run(changes={},overrides={}){return workspace(changes).renderSync({entry:'main.ddn',view:'timing',overrides});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const id=short=>'test.timing::signals.'+short;
const segments=r=>r.scene.marks.filter(m=>m.property==='x_states');
const bands=r=>r.scene.marks.filter(m=>m.property===undefined&&m.h===96);
// Default style: s=1, W=1050, right=990, top=64, bandH=96, pad=12. lo=0, hi=55.
test('Timing view renders one band per participant in declaration order; segment count matches x_states; state labels appear',()=>{const r=run();
 assert.match(r.svg,/<svg/);
 const bs=bands(r);assert.equal(bs.length,2,'exactly 2 bands');
 assert.equal(bs[0].sourceIds[0],id('controller'));assert.equal(bs[1].sourceIds[0],id('pedestrian_signal'));
 assert.ok(bs[0].y<bs[1].y,'controller band above pedestrian band (declaration order)');
 const segs=segments(r);assert.equal(segs.length,6,'3 plateau segments per band');
 assert.equal(segs.filter(m=>m.sourceIds[0]===id('controller')).length,3);
 assert.equal(segs.filter(m=>m.sourceIds[0]===id('pedestrian_signal')).length,3);
 for(const label of ['red','green','amber','wait','walk'])assert.ok(r.svg.includes('>'+label+'</text>'),'state label '+label+' missing');
 assert.ok(r.svg.includes('Supplied time points, not a simulation'),'footer note missing');});
test('Plateau step x positions are proportional to at values; first state is the top plateau',()=>{const r=run();
 const segs=segments(r),labelW=segs.find(m=>m.at===0).x,fx=v=>labelW+(v-0)/(55-0)*(990-labelW);
 for(const m of segs)assert.ok(Math.abs(m.x-fx(m.at))<0.5,'segment at='+m.at+' x='+m.x+' expected '+fx(m.at));
 const last=segs.find(m=>m.sourceIds[0]===id('pedestrian_signal')&&m.at===45);
 assert.ok(Math.abs(last.x+last.w-fx(55))<0.5,'last plateau extends to the axis maximum');
 // Controller: 3 distinct states, step=(96-24)/3=24; band y=64, plateau y=76+j*24, mark y=plateau-16.
 const ctrl=['red','green','amber'].map((s,j)=>({s,y:64+12+j*24-16}));
 for(const c of ctrl){const m=segs.find(x=>x.sourceIds[0]===id('controller')&&x.state===c.s);assert.ok(Math.abs(m.y-c.y)<0.5,'controller '+c.s+' y='+m.y+' expected '+c.y);}
 // Pedestrian: 2 distinct states {wait,walk}, step=36; band y=160; wait on top plateau again for the third entry.
 const ped=segs.filter(m=>m.sourceIds[0]===id('pedestrian_signal'));
 assert.ok(Math.abs(ped[0].y-ped[2].y)<0.5,'repeated state returns to the same plateau level');
 assert.ok(ped[1].y>ped[0].y,'walk is the second (lower) plateau');});
test('Descending at rejected as DDN-PJ118',()=>{
 throws(()=>run(edit('{at: 55, state: "amber"}','{at: 20, state: "amber"}')),'DDN-PJ118');});
test('Non-number at rejected as DDN-PJ118',()=>{
 throws(()=>run(edit('{at: 0, state: "red"}','{at: "soon", state: "red"}')),'DDN-PJ118');});
test('Participant without x_states rejected as DDN-PJ118',()=>{
 throws(()=>run(edit('\n        x_states: [{at: 0, state: "wait"}, {at: 25, state: "walk"}, {at: 45, state: "wait"}];','')),'DDN-PJ118');});
test('Unknown projection property rejected as DDN-PJ005; graph place rejected as DDN-PJ002; Vega-Lite export rejected as DDN-PJ070',()=>{
 throws(()=>run(edit('kind: timing;','kind: timing; mark: bar;')),'DDN-PJ005');
 throws(()=>run(edit('projection { kind: timing;','place @signals.controller { at: [0px, 0px]; } projection { kind: timing;')),'DDN-PJ002');
 throws(()=>workspace().exportVegaLite({entry:'main.ddn',view:'timing'}),'DDN-PJ070');});
test('Deterministic byte-identical rerender',()=>assert.equal(sha(run().svg),sha(run().svg)));
test('RT-101 regression: sequence projection still renders through the same participant helper',()=>{
 const seq=`ddn "0.5";
module "test.timing.seq";
data flow {
    object a "Alpha" { kind: application; }
    object b "Beta" { kind: service; }
    relation m1 "Ping" @a -> @b { kind: "uml.message"; }
}
view sequence { data: [@flow]; projection { kind: sequence; profile: "uml.sequence@1"; } }
`;
 const r=A.createWorkspace({'main.ddn':seq}).renderSync({entry:'main.ddn',view:'sequence'});
 assert.match(r.svg,/<svg/);assert.ok(r.svg.includes('>1. Ping</text>'));});
const failed=results.filter(r=>!r.pass);
for(const r of results)if(r.pass)console.log('PASS',r.name);
console.log('Timing diagram '+ (results.length-failed.length)+'/'+results.length);
if(failed.length)process.exitCode=1;
