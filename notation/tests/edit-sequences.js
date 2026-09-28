/* SPDX-License-Identifier: GPL-2.0-or-later. B1-069 Finding 3: sequence/lifecycle
 * tests on the public workspace API — multi-step state transitions that
 * single-operation tests miss: populated→empty→populated refresh, failed
 * replacement leaves state intact, component removal/reinsertion, edits
 * across imported definitions and multiple views, and multi-step undo/redo. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);process.exitCode=1;}}
const fail=(fn,code)=>assert.throws(fn,e=>e.code===code);
const editOne=(ws,file,from,to)=>{const t=ws.getFiles()[file];const i=t.indexOf(from);assert.ok(i>=0,'edit target missing: '+from);ws.applyEdits([{file,start:i,end:i+from.length,text:to}]);};

const SHARED=`ddn "0.5";
module "tests.seq.shared";

data core {
    object alpha "Alpha" { kind: application; }
    object beta "Beta" { kind: application; }
    relation uses "uses" @alpha -> @beta { kind: flow; }
}
`;
const MAIN=`ddn "0.5";
module "tests.seq.main";

import "shared.ddn" as shared;

data local {
    object gamma "Gamma" { kind: application; }
}

data link {
    relation g_uses "uses" @local.gamma -> @shared.core.alpha { kind: flow; }
}

data metrics {
    object m1 "Alpha" { kind: record; x_record: { label: "Alpha", value: 10, unit: "ms" }; }
    object m2 "Beta" { kind: record; x_record: { label: "Beta", value: 20, unit: "ms" }; }
}

view a "Graph A" { data: [@shared.core, @local, @link]; publication { size: content; fit: none; } }
view b "Graph B" { data: [@local]; publication { size: content; fit: none; } }
`;
const FILES={'main.ddn':MAIN,'shared.ddn':SHARED};
const fresh=()=>A.createWorkspace({...FILES});

test('populated → empty → populated refresh, then empty again — every transition commits and renders',()=>{
 const ws=fresh();
 assert.equal(ws.replaceData('metrics',[]).committed,true,'empty commits');
 assert.equal(ws.replaceData('metrics',[{label:'Delta',value:30,unit:'ms'}]).committed,true,'refill commits');
 assert.equal(ws.replaceData('metrics',[]).committed,true,'second empty commits');
 const r=ws.replaceData('metrics',[{label:'Echo',value:40,unit:'ms'},{label:'Fox',value:50,unit:'ms'}]);
 assert.equal(r.committed,true,'second refill commits');
 assert.match(ws.renderSync({entry:'main.ddn',view:'a'}).svg,/<svg/);
 ws.destroy();
});

test('failed workspace replacement leaves state fully intact',()=>{
 const ws=fresh(),before=ws.getFiles(),rev=ws.revision,beforeSvg=ws.renderSync({entry:'main.ddn',view:'a'}).svg;
 fail(()=>ws.replaceFiles({'main.ddn':42}),'LIVE010','non-text source rejected');
 fail(()=>ws.replaceFiles(null),'LIVE010');
 fail(()=>ws.updateFiles({'main.ddn':'x'.repeat(2000001)}),'LIVE010','oversize source rejected');
 assert.deepEqual(ws.getFiles(),before,'files unchanged');
 assert.equal(ws.revision,rev,'revision unchanged');
 assert.equal(ws.renderSync({entry:'main.ddn',view:'a'}).svg,beforeSvg,'render unchanged');
 // replaceFiles is the raw channel: invalid DDN commits but fails loudly at build, and restoring the files restores the render
 ws.replaceFiles({'main.ddn':'ddn "0.5";\nmodule "broken";\n\ndata x {\n object a "A" { kind: application; }\n relation r "" @a -> @nope { kind: flow; }\n}\nview v "V" { data: [@x]; }\n'});
 assert.throws(()=>ws.renderSync({entry:'main.ddn',view:'a'}),/view|entry|missing/i,'old entry is gone from the replaced workspace');
 ws.replaceFiles(before);
 assert.equal(ws.renderSync({entry:'main.ddn',view:'a'}).svg,beforeSvg,'restoring files restores the render byte-identically');
 ws.destroy();
});

test('failed structured edit (bad expectedRevision, overlapping spans) leaves state intact',()=>{
 const ws=fresh(),before=ws.getFiles();
 editOne(ws,'main.ddn','Gamma','GammaRenamed');
 assert.equal(ws.revision,1);
 fail(()=>ws.applyEdits([{file:'main.ddn',start:0,end:1,text:'x'}],{expectedRevision:0}),'LIVE030');
 fail(()=>ws.applyEdits([{file:'main.ddn',start:5,end:10,text:'x'},{file:'main.ddn',start:8,end:12,text:'y'}]),'LIVE031');
 assert.equal(ws.revision,1,'no half-applied edits');
 assert.deepEqual(ws.getFiles(),before.constructor===Object?{...before,'main.ddn':ws.getFiles()['main.ddn']}:before);
 assert.ok(ws.getFiles()['main.ddn'].includes('GammaRenamed'));
 ws.destroy();
});

test('component add/remove/reinsert via source edits keeps the render deterministic',()=>{
 const ws=fresh();
 const base=ws.renderSync({entry:'main.ddn',view:'b'}).svg;
 editOne(ws,'main.ddn','object gamma "Gamma" { kind: application; }','object gamma "Gamma" { kind: application; }\n    object extra "Extra" { kind: application; }');
 assert.ok(ws.renderSync({entry:'main.ddn',view:'b'}).svg.includes('Extra'),'added element renders');
 editOne(ws,'main.ddn','\n    object extra "Extra" { kind: application; }','');
 assert.equal(ws.renderSync({entry:'main.ddn',view:'b'}).svg,base,'removal restores the base render byte-identically');
 editOne(ws,'main.ddn','object gamma "Gamma" { kind: application; }','object gamma "Gamma" { kind: application; }\n    object extra2 "Extra2" { kind: application; }');
 assert.ok(ws.renderSync({entry:'main.ddn',view:'b'}).svg.includes('Extra2'),'reinsertion renders');
 ws.destroy();
});

test('edits across an imported definition and multiple views stay coherent',()=>{
 const ws=fresh();
 editOne(ws,'shared.ddn','"Alpha"','"AlphaPrime"');
 const a=ws.renderSync({entry:'main.ddn',view:'a'}).svg;
 assert.ok(a.includes('AlphaPrime'),'view a shows the renamed import');
 const b=ws.renderSync({entry:'main.ddn',view:'b'}).svg;
 assert.ok(!b.includes('AlphaPrime'),'view b does not select the import');
 editOne(ws,'main.ddn','"Gamma"','"GammaPrime"');
 assert.ok(ws.renderSync({entry:'main.ddn',view:'a'}).svg.includes('GammaPrime'),'cross-view coherence');
 assert.ok(ws.renderSync({entry:'main.ddn',view:'b'}).svg.includes('GammaPrime'),'view b sees its own edit');
 ws.destroy();
});

test('multi-step undo/redo walks the whole edit sequence',()=>{
 const ws=fresh();
 const base=ws.renderSync({entry:'main.ddn',view:'b'}).svg;
 editOne(ws,'main.ddn','"Gamma"','"Step1"');
 editOne(ws,'main.ddn','object gamma "Step1" { kind: application; }','object gamma "Step1" { kind: application; }\n    object extra "Step2" { kind: application; }');
 editOne(ws,'main.ddn','"Step2"','"Step2b"');
 assert.deepEqual(ws.history(),{canUndo:true,canRedo:false,undoLabel:'Structured edit',redoLabel:''});
 assert.ok(ws.undo()&&ws.undo()&&ws.undo(),'three undos');
 assert.equal(ws.renderSync({entry:'main.ddn',view:'b'}).svg,base,'fully undone state equals the base render');
 assert.equal(ws.history().canUndo,false);
 assert.ok(ws.redo()&&ws.redo()&&ws.redo(),'three redos');
 const svg=ws.renderSync({entry:'main.ddn',view:'b'}).svg;
 assert.ok(svg.includes('Step1')&&svg.includes('Step2b'),'fully redone state has every edit');
 ws.undo();editOne(ws,'main.ddn','"Step1"','"Fork"');
 assert.equal(ws.history().canRedo,false,'new edit clears redo');
 ws.destroy();
});

test('undo across a replaceData refresh restores the previous records',()=>{
 const ws=fresh();
 ws.replaceData('metrics',[{label:'Delta',value:30,unit:'ms'}]);
 assert.ok(ws.getFiles()['main.ddn'].includes('Delta'));
 assert.ok(ws.undo());
 assert.ok(ws.getFiles()['main.ddn'].includes('Alpha'),'undo restores the original record');
 assert.ok(ws.redo());
 assert.ok(ws.getFiles()['main.ddn'].includes('Delta'),'redo re-applies the refresh');
 ws.destroy();
});

test('removeFile refuses while imported; with force the importing view fails loudly, never silently',()=>{
 const ws=fresh();
 fail(()=>ws.removeFile('shared.ddn'),'LIVE033');
 ws.removeFile('shared.ddn',{force:true});
 assert.throws(()=>ws.renderSync({entry:'main.ddn',view:'a'}));
 ws.destroy();
});

const ok=results.filter(r=>r.pass).length;
console.log('edit-sequences:',ok+'/'+results.length,'passed');
if(ok!==results.length)process.exit(1);
