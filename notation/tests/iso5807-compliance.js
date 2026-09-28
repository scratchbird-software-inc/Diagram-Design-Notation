/* SPDX-License-Identifier: GPL-2.0-or-later. B1-075: ISO 5807 flowchart completion fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.iso5807";
data m {
    object start "" { kind: "flow.start"; }
    object manual "Counts" { kind: "flow.manualinput"; }
    object prep "Rules" { kind: "flow.preparation"; }
    object op "Pick" { kind: "flow.manualop"; }
    object disp "Tote" { kind: "flow.display"; }
    object wait "Cure" { kind: "flow.delay"; }
    object ls "Each tote" { kind: "flow.loopstart"; }
    object card "Card" { kind: "flow.card"; }
    object coll "Collate" { kind: "flow.collate"; }
    object sort "Sort" { kind: "flow.sort"; }
    object mrg "" { kind: "flow.isomerge"; }
    object xtr "" { kind: "flow.isoextract"; }
    object par "Pack" { kind: "flow.parallelmode"; }
    object le "Next" { kind: "flow.loopend"; }
    object fin "" { kind: "flow.end"; }
    relation f1 "" @start -> @manual { kind: "flow.next"; }
    relation f2 "" @manual -> @prep { kind: "flow.next"; }
    relation f3 "" @prep -> @op { kind: "flow.next"; }
    relation f4 "" @op -> @disp { kind: "flow.next"; }
    relation f5 "" @disp -> @wait { kind: "flow.next"; }
    relation f6 "" @wait -> @ls { kind: "flow.next"; }
    relation f7 "" @ls -> @card { kind: "flow.next"; }
    relation f8 "" @card -> @coll { kind: "flow.next"; }
    relation f9 "" @coll -> @sort { kind: "flow.next"; }
    relation f10 "" @sort -> @mrg { kind: "flow.next"; }
    relation f11 "" @mrg -> @xtr { kind: "flow.next"; }
    relation f12 "" @xtr -> @par { kind: "flow.next"; }
    relation f13 "" @par -> @le { kind: "flow.next"; }
    relation f14 "" @le -> @ls { kind: "flow.next"; }
    relation f15 "" @le -> @fin { kind: "flow.next"; }
}
view v "ISO" { data: [@m]; projection { kind: graph; profile: "flow.iso5807@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view='v',changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('every ISO 5807 symbol renders its silhouette',()=>{const r=run();
 for(const s of ['manualinput','manualop','hexagon','display','delay','triangledown','triangleup','card','xellipse','barellipse','parallelmode','terminal'])
  assert.ok(r.svg.includes('data-shape="'+s+'"'),'missing silhouette: '+s);});
test('labels render beside the symbols',()=>{const r=run();
 for(const s of ['Counts','Pick','Cure','Collate','Pack'])assert.ok(r.svg.includes(s),'missing label: '+s);});
test('flowchart structure rules apply (start/end required, flow.next only)',()=>{
 throws(()=>run('v',{'main.ddn':SRC.replace('    object fin "" { kind: "flow.end"; }\n','').replace('    relation f15 "" @le -> @fin { kind: "flow.next"; }\n','')}),'DDN-PF008');
 throws(()=>run('v',edit('relation f15 "" @le -> @fin { kind: "flow.next"; }','relation f15 "" @le -> @fin { kind: "assoc"; }')),'DDN-PF007');});
test('non-flow participants rejected (endpoint contract DDN102)',()=>{
 throws(()=>run('v',edit('object mrg "" { kind: "flow.isomerge"; }','object mrg "" { kind: "activity"; }')),'DDN102');});
test('flow.basic@1 unchanged: ISO kinds are out of its vocabulary',()=>{
 const basic=`ddn "0.5";
module "test.basic";
data m {
    object start "" { kind: "flow.start"; }
    object p "Step" { kind: "flow.process"; }
    object fin "" { kind: "flow.end"; }
    relation f1 "" @start -> @p { kind: "flow.next"; }
    relation f2 "" @p -> @fin { kind: "flow.next"; }
}
view v "B" { data: [@m]; projection { kind: graph; profile: "flow.basic@1"; } publication { size: content; fit: none; overflow: error; } }
`;
 const r=A.createWorkspace({'main.ddn':basic}).renderSync({entry:'main.ddn',view:'v'});
 assert.match(r.svg,/<svg/);});

const failed=results.filter(r=>!r.pass);
console.log('iso5807-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
