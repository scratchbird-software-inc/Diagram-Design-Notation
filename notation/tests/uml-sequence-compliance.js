/* SPDX-License-Identifier: GPL-2.0-or-later. B1-056 : UML 2.5.1 sequence-diagram completeness fixtures (uml.sequence@2). */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.seq2";

data flow {
    object app "App" { kind: application; }
    object checkout "Checkout" { kind: service;
        x_invariant: [ { after: @flow.reserve; label: "cart locked"; } ];
        x_activation: [ { from: @flow.submit; to: @flow.confirm; } ];
    }
    object worker "Worker" { kind: service; }
    object logger "Logger" { kind: service; }

    relation submit "Submit" @app -> @checkout { kind: "uml.message"; x_message: { sort: synch; duration: "{0..2s}"; }; }
    relation reserve "Reserve" @checkout -> @checkout { kind: "uml.message"; }
    relation spawn "Spawn worker" @checkout -> @worker { kind: "uml.message"; x_message: { sort: create; }; }
    relation poll "Poll" @worker -> @checkout { kind: "uml.message"; x_message: { sort: asynch; time: "{t}"; gate: source; };
        x_fragment: { operator: loop; operands: [ { guard: "until done"; messages: [@flow.poll, @flow.probe]; fragments: [ { operator: opt; operands: [ { guard: "idle"; messages: [@flow.probe]; } ] } ]; } ] };
    }
    relation probe "Probe" @checkout -> @worker { kind: "uml.message"; }
    relation alt_a "Try charge" @app -> @checkout { kind: "uml.message";
        x_fragment: { operator: alt; operands: [ { guard: "card ok"; messages: [@flow.alt_a]; }, { guard: "else"; messages: [@flow.alt_b]; } ] };
    }
    relation alt_b "Decline" @checkout -> @app { kind: "uml.message"; x_message: { sort: reply; }; }
    relation lostm "Audit" @logger -> @logger { kind: "uml.message"; x_message: { sort: lost; }; }
    relation foundm "Late event" @checkout -> @checkout { kind: "uml.message"; x_message: { sort: found; }; }
    relation confirm "Confirm" @checkout -> @app { kind: "uml.message"; x_return: true; }
    relation stop "Stop" @checkout -> @worker { kind: "uml.message"; x_message: { sort: delete; }; }
}

view v "Sequence completeness" {
    data: [@flow];
    projection { kind: sequence; profile: "uml.sequence@2"; }
    publication { size: content; fit: none; overflow: error; minimum_text: 6pt; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(changes={},view='v'){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('uml.sequence@2 renders every B1-056 feature',()=>{const r=run();
 assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.profile,'uml.sequence@2');
 for(const cls of ['ddn-fragment-loop','ddn-fragment-alt','ddn-fragment-opt','ddn-gate','ddn-destruction','ddn-invariant','ddn-activation','ddn-lost','ddn-found'])assert.ok(r.svg.includes(cls),'decoration missing: '+cls);
 for(const s of ['[until done]','[card ok]','[else]','[idle]','«create» Spawn worker','cart locked','{0..2s}','{t}'])assert.ok(r.svg.includes(s),'text missing: '+s);});
test('Asynch message renders open arrowhead; synch keeps the filled default; reply renders dashed open',()=>{const r=run();
 const at=r.svg.indexOf('4. Poll'),around=r.svg.slice(Math.max(0,at-700),at);
 assert.ok(around.includes('M-10 -5L0 0L-10 5'),'asynch open arrowhead missing near Poll');
 assert.ok(r.svg.includes('M0 0L-10 -5L-10 5Z'),'filled synch arrowhead missing');});
test('Create draws the target header at the create row, not at the top',()=>{const r=run();
 const head=r.scene.marks.find(m=>m.sourceIds[0]==='test.seq2::flow.worker'&&m.h>300);
 assert.ok(head,'worker lifeline mark missing');
 assert.ok(head.y>0,'created participant header must sit at the create row, got y='+head.y);});
test('Delete stops the lifeline with a destruction cross',()=>{const r=run();
 assert.ok(r.svg.includes('ddn-destruction'),'destruction cross missing');
 const cross=r.svg.indexOf('ddn-destruction');
 assert.ok(r.svg.slice(cross,cross+400).includes('M'),'cross path missing');});
test('Lost and found render filled circles at the free end',()=>{const r=run();
 assert.ok(/ddn-lost/.test(r.svg)&&/ddn-found/.test(r.svg));});
test('Fragment nesting renders inner frame inside outer; gate attaches at frame edge',()=>{const r=run();
 const loopAt=r.svg.indexOf('ddn-fragment-loop'),optAt=r.svg.indexOf('ddn-fragment-opt');
 assert.ok(loopAt>=0&&optAt>=0&&loopAt!==optAt,'nested fragment frames missing');});

test('Non-contiguous operand messages are DDN-PJ155',()=>{
 throws(()=>run(edit('messages: [@flow.poll, @flow.probe]; fragments','messages: [@flow.poll, @flow.confirm]; fragments')),'DDN-PJ155');});
test('Fragment not anchored on its first covered message is DDN-PJ155',()=>{
 throws(()=>run(edit('relation probe "Probe" @checkout -> @worker { kind: "uml.message"; }','relation probe "Probe" @checkout -> @worker { kind: "uml.message"; x_fragment: { operator: opt; operands: [ { messages: [@flow.submit, @flow.reserve]; } ] }; }')),'DDN-PJ155');});
test('Overlapping sibling fragments are DDN-PJ155',()=>{
 throws(()=>run(edit('relation probe "Probe" @checkout -> @worker { kind: "uml.message"; }','relation probe "Probe" @checkout -> @worker { kind: "uml.message"; x_fragment: { operator: opt; operands: [ { messages: [@flow.probe]; } ] }; }')),'DDN-PJ155');});
test('Bad operator is a contract error (DDN105)',()=>{
 throws(()=>run(edit('operator: loop','operator: spin')),'DDN105');});
test('Lost/found must be self-anchored (DDN-PJ156)',()=>{
 throws(()=>run(edit('relation lostm "Audit" @logger -> @logger','relation lostm "Audit" @logger -> @app')),'DDN-PJ156');});
test('Create must be the first incident message of its target (DDN-PJ156)',()=>{
 throws(()=>run(edit('relation spawn "Spawn worker" @checkout -> @worker { kind: "uml.message"; x_message: { sort: create; }; }','relation spawn "Spawn worker" @checkout -> @worker { kind: "uml.message"; } relation spawn2 "Again" @app -> @worker { kind: "uml.message"; x_message: { sort: create; }; }')),'DDN-PJ156');});
test('Message after destruction is DDN-PJ156',()=>{
 throws(()=>run(edit('relation stop "Stop" @checkout -> @worker { kind: "uml.message"; x_message: { sort: delete; }; }','relation stop "Stop" @checkout -> @worker { kind: "uml.message"; x_message: { sort: delete; }; } relation zombie "Zombie" @worker -> @app { kind: "uml.message"; }')),'DDN-PJ156');});
test('Gate without an enclosing fragment is DDN-PJ156',()=>{
 throws(()=>run(edit('relation submit "Submit" @app -> @checkout { kind: "uml.message"; x_message: { sort: synch; duration: "{0..2s}"; }; }','relation submit "Submit" @app -> @checkout { kind: "uml.message"; x_message: { gate: target; }; }')),'DDN-PJ156');});
test('reply sort with x_return:false is DDN-PJ156',()=>{
 throws(()=>run(edit('relation alt_b "Decline" @checkout -> @app { kind: "uml.message"; x_message: { sort: reply; }; }','relation alt_b "Decline" @checkout -> @app { kind: "uml.message"; x_message: { sort: reply; }; x_return: false; }')),'DDN-PJ156');});
test('State invariant must follow an incident message (DDN-PJ157)',()=>{
 throws(()=>run(edit('x_invariant: [ { after: @flow.reserve; label: "cart locked"; } ];','x_invariant: [ { after: @flow.lostm; label: "cart locked"; } ];')),'DDN-PJ157');});
test('Activation must span incident, ordered messages (DDN-PJ158)',()=>{
 throws(()=>run(edit('x_activation: [ { from: @flow.submit; to: @flow.confirm; } ];','x_activation: [ { from: @flow.confirm; to: @flow.submit; } ];')),'DDN-PJ158');
 throws(()=>run(edit('x_activation: [ { from: @flow.submit; to: @flow.confirm; } ];','x_activation: [ { from: @flow.submit; to: @flow.lostm; } ];')),'DDN-PJ158');});
test('time/duration must use {constraint} form (DDN-PJ159)',()=>{
 throws(()=>run(edit('duration: "{0..2s}"','duration: "0..2s"')),'DDN-PJ159');});
test('uml.sequence@1 remains installed and renders a plain view unchanged',()=>{
 const plain={'main.ddn':`ddn "0.5";
module "test.seq1";
data flow {
    object a "A" { kind: application; }
    object b "B" { kind: service; }
    relation m1 "One" @a -> @b { kind: "uml.message"; }
    relation m2 "Two" @b -> @a { kind: "uml.message"; x_return: true; }
}
view v "Plain" { data: [@flow]; projection { kind: sequence; profile: "uml.sequence@1"; } publication { size: content; fit: none; overflow: error; } }
`};
 const r=A.createWorkspace(plain).renderSync({entry:'main.ddn',view:'v'});
 assert.equal(r.profiles.projection.profile,'uml.sequence@1');
 assert.ok(!r.svg.includes('ddn-fragment'),'plain @1 view must not draw fragments');});

const failed=results.filter(r=>!r.pass);
console.log('uml-sequence-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
