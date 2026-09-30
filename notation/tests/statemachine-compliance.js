/* SPDX-License-Identifier: GPL-2.0-or-later. B1-057 : UML 2.5.1 state-machine completeness fixtures (uml.statemachine@1). */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.sm2";

data m {
    object start "" { kind: "state.initial"; }
    object idle "Idle" { kind: "state.state"; }
    object running "Running" { kind: "state.state";
        x_state: { entry: "startWatch()"; exit: "stopWatch()"; do: "tick()"; internal: [ "help [guarded] / showHelp()" ]; };
    }
    object done "Done" { kind: "state.final"; }
    object stop "" { kind: "state.terminate"; }
    object pick "" { kind: "state.choice"; }
    object join1 "" { kind: "state.junction"; }
    object bar "" { kind: "state.forkjoin"; }
    object sub "Sub machine" { kind: "state.state"; x_state: { submachine: @m.inner; }; }
    object inner "Inner top" { kind: "state.state"; }
    object hist "" { kind: "state.history_shallow"; }
    object dh "" { kind: "state.history_deep"; }
    object ep "" { kind: "state.entrypoint"; }
    object xp "" { kind: "state.exitpoint"; }

    relation t1 "" @start -> @idle { kind: "state.transition"; }
    relation t2 "go" @idle -> @running { kind: "state.transition"; x_transition: { event: "start"; guard: "ready"; effect: "reset()" }; }
    relation t3 "" @running -> @pick { kind: "state.transition"; x_transition: { event: "after(30s)" }; }
    relation t4 "" @pick -> @done { kind: "state.transition"; x_transition: { event: "when(idle)" }; }
    relation t5 "" @pick -> @stop { kind: "state.transition"; x_transition: { event: "at(2026-10-01T00:00Z)" }; }
    relation t6 "" @running -> @join1 { kind: "state.transition"; x_transition: { event: "yield" }; }
    relation t7 "" @join1 -> @ep { kind: "state.transition"; }
    relation t8 "" @ep -> @sub { kind: "state.transition"; }
    relation t9 "" @sub -> @xp { kind: "state.transition"; x_transition: { event: "finished" }; }
    relation t10 "" @xp -> @bar { kind: "state.transition"; }
    relation t11 "" @bar -> @hist { kind: "state.transition"; x_transition: { event: "suspend" }; }
    relation t12 "" @hist -> @dh { kind: "state.transition"; x_transition: { event: "resume" }; }
    relation t13 "" @dh -> @idle { kind: "state.transition"; x_transition: { event: "reset" }; }
}

view v "State machine completeness" {
    data: [@m];
    projection { kind: graph; profile: "uml.statemachine@1"; }
    frame box "Running detail" { scope: @m.running; members: [@m.hist, @m.dh, @m.ep, @m.xp]; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(changes={},view='v'){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('uml.statemachine@1 renders activities, internal transitions and the submachine compartment',()=>{const r=run();
 assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.profile,'uml.statemachine@1');
 for(const s of ['entry / startWatch()','exit / stopWatch()','do / tick()','help [guarded] / showHelp()','«submachine»'])assert.ok(r.svg.includes(s),'compartment text missing: '+s);});
test('Full transition syntax renders trigger [guard] / effect; time events render verbatim',()=>{const r=run();
 for(const s of ['start [ready] / reset()','after(30s)','when(idle)','at(2026-10-01T00:00Z)'])assert.ok(r.svg.includes(s),'transition label missing: '+s);});
test('Pseudostate glyphs render: H, H*, junction, choice, entry/exit point, fork bar, terminate',()=>{const r=run();
 for(const sh of ['history','junction','choice','entrypoint','exitpoint','forkbar','terminate'])assert.ok(r.svg.includes('data-shape="'+sh+'"'),'glyph missing: '+sh);
 assert.ok(r.svg.includes('>H<'),'shallow H missing');assert.ok(r.svg.includes('>H*<'),'deep H* missing');});
test('Frame membership keeps history and entry/exit points legal',()=>{const r=run();assert.ok(r.svg.includes('ddn-frame'),'composite frame missing');});

test('x_state on a non-state kind is DDN-PJ160',()=>{
 throws(()=>run(edit('object inner "Inner top" { kind: "state.state"; }','object inner "Inner top" { kind: "state.state"; } object misc "Misc" { kind: object; x_state: { entry: "x()" }; }')),'DDN-PJ160');});
test('Submachine must reference a distinct state.state (DDN-PJ160)',()=>{
 throws(()=>run(edit('x_state: { submachine: @m.inner; };','x_state: { submachine: @m.sub; };')),'DDN-PJ160');
 throws(()=>run(edit('x_state: { submachine: @m.inner; };','x_state: { submachine: @m.hist; };')),'DDN-PJ160');});
test('Terminate as a transition source is rejected (DDN102 endpoint contract)',()=>{
 throws(()=>run(edit('relation t13 "" @dh -> @idle','relation t13 "" @stop -> @idle')),'DDN102');});
test('Choice needs at least two outgoing transitions (DDN-PJ161)',()=>{
 throws(()=>run(edit('relation t5 "" @pick -> @stop','relation t5 "" @running -> @stop')),'DDN-PJ161');});
test('Junction needs incoming and outgoing transitions (DDN-PJ161)',()=>{
 throws(()=>run(edit('relation t7 "" @join1 -> @ep','relation t7 "" @dh -> @ep')),'DDN-PJ161');});
test('History outside a composite frame is DDN-PJ161 on uml.statemachine@1',()=>{
 throws(()=>run(edit('members: [@m.hist, @m.dh, @m.ep, @m.xp];','members: [@m.ep, @m.xp];')),'DDN-PJ161');});
test('Malformed time trigger is DDN-PJ162',()=>{
 throws(()=>run(edit('x_transition: { event: "after(30s)" };','x_transition: { event: "after 30s" };')),'DDN-PJ162');});
test('Unknown x_state/x_transition keys are contract errors (DDN105)',()=>{
 throws(()=>run(edit('x_state: { entry: "startWatch()";','x_state: { enter: "startWatch()"; entry: "startWatch()";')),'DDN105');
 throws(()=>run(edit('x_transition: { event: "start"; guard: "ready"; effect: "reset()" };','x_transition: { event: "start"; guard: "ready"; effect: "reset()"; onentry: "x" };')),'DDN105');});
test('state.transition endpoints admit the pseudostate kinds; ordinary kinds still rejected (DDN102)',()=>{
 throws(()=>run(edit('relation t13 "" @dh -> @idle { kind: "state.transition"; x_transition: { event: "reset" }; }','relation t13 "" @dh -> @idle { kind: "state.transition"; x_transition: { event: "reset" }; } object misc "Misc" { kind: application; } relation t14 "" @dh -> @misc { kind: "state.transition"; }')),'DDN102');});
test('Trace evaluation stays state.flat@1-only (DDN-Q005)',()=>{
 throws(()=>run(edit('projection { kind: graph; profile: "uml.statemachine@1"; }','projection { kind: graph; profile: "uml.statemachine@1"; traces: []; }')),'DDN-Q005');});
test('state.flat@1 renders unchanged',()=>{
 const flat={'main.ddn':`ddn "0.5";
module "test.sm1";
data m {
    object start "" { kind: "state.initial"; }
    object idle "Idle" { kind: "state.state"; }
    object done "Done" { kind: "state.final"; }
    relation t1 "" @start -> @idle { kind: "state.transition"; }
    relation t2 "go" @idle -> @done { kind: "state.transition"; x_transition: { event: "go" }; }
}
view v "Flat" { data: [@m]; projection { kind: graph; profile: "state.flat@1"; } publication { size: content; fit: none; overflow: error; } }
`};
 const r=A.createWorkspace(flat).renderSync({entry:'main.ddn',view:'v'});
 assert.equal(r.profiles.projection.profile,'state.flat@1');assert.match(r.svg,/<svg/);assert.ok(r.svg.includes('>go<'),'flat event label missing');});

const failed=results.filter(r=>!r.pass);
console.log('statemachine-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
