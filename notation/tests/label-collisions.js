/* SPDX-License-Identifier: GPL-2.0-or-later.
 * DDN-LW09: relationship labels, reference numerals and callout badges must
 * never overlap each other or unrelated object geometry. inspect() detects
 * residual collisions; the label planner prevents them with clearance
 * margins wherever its bounded search admits a position.
 */
'use strict';
const assert=require('node:assert/strict');
const A=require('../dist/ddn.global'),L=require('../runtime/ddn-layout').default;
const results=[];
function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);process.exitCode=1;}}

const nodes=[{id:'a',x:0,y:0,w:100,h:60},{id:'b',x:300,y:0,w:100,h:60},{id:'x',x:150,y:200,w:100,h:60}];
const rel={id:'r1',from:{element:'a'},to:{element:'b'}};
const routes=[{id:'r1',r:rel,points:[[100,30],[300,30]]}];

test('inspect: two overlapping relationship labels are flagged',()=>{
 const labels=[{id:'r1',x:180,y:20,w:40,h:20},{id:'r2',x:200,y:25,w:40,h:20}];
 const q=L.inspect(nodes,routes,labels);
 assert.equal(q.labelPairs.length,1);assert.equal(q.labelIssues.length,1);assert.ok(q.labelIssues[0].includes('colliding relationship label'));
});
test('inspect: labels that merely crowd without touching are not flagged (planner owns clearance)',()=>{
 const labels=[{id:'r1',x:180,y:20,w:40,h:20},{id:'r2',x:230,y:20,w:40,h:20}];
 assert.equal(L.inspect(nodes,routes,labels).labelPairs.length,0);
});
test('inspect: a label over an unrelated object is flagged; over its own endpoint is not',()=>{
 const onX=[{id:'r1',x:160,y:210,w:40,h:20}];
 let q=L.inspect(nodes,routes,onX);
 assert.equal(q.labelNodes.length,1);assert.ok(q.labelIssues[0].includes('unrelated objects'));
 const onOwn=[{id:'r1',x:10,y:10,w:40,h:20}];
 q=L.inspect(nodes,routes,onOwn);
 assert.equal(q.labelNodes.length,0,'own-endpoint proximity is legal (mind-map reading)');
});
test('inspect: label diagnostics stay out of the legacy error list (own code family)',()=>{
 const q=L.inspect(nodes,routes,[{id:'r1',x:160,y:210,w:40,h:20}]);
 assert.deepEqual(q.errors,[]);assert.equal(q.labelIssues.length,1);
});

const SRC=`ddn "0.5";
module "lbl";
data m {
 service hub "Container hub" { }
 host c1 "Child one" { }
 host c2 "Child two" { }
 host c3 "Child three" { }
 host c4 "Child four" { }
 host c5 "Child five" { }
 relation f1 "membership one" @hub -> @c1 { kind: mem; }
 relation f2 "membership two" @hub -> @c2 { kind: mem; }
 relation f3 "membership three" @hub -> @c3 { kind: mem; }
 relation f4 "membership four" @hub -> @c4 { kind: mem; }
 relation f5 "membership five" @hub -> @c5 { kind: mem; }
}
view fan "Labelled fan out" {
 data: [@m];
 projection { kind: graph; profile: "ddn@1"; }
 layout { direction: down; }
 publication { size: content; }
}
`;
for(const labels of ['text','numbers','tokens'])test('prevention: dense labelled fan-out stays collision-free ('+labels+')',()=>{
 const r=A.createWorkspace({'m.ddn':SRC}).renderSync({entry:'m.ddn',view:'fan',overrides:{labels}});
 assert.deepEqual(r.scene.quality.errors,[]);
 assert.deepEqual(r.scene.quality.labelIssues??[],[],'label collisions: '+JSON.stringify(r.scene.quality.labelIssues));
});
test('prevention: mind-map branch labels keep their legal own-entity corridor',()=>{
 const r=A.createWorkspace({'m.ddn':SRC.replace('direction: down;','algorithm: mindmap;')}).renderSync({entry:'m.ddn',view:'fan'});
 assert.deepEqual(r.scene.quality.labelIssues??[],[]);
});
const passed=results.filter(r=>r.pass).length;
console.log('Label collisions',passed+'/'+results.length);
