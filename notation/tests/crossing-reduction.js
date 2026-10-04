/* SPDX-License-Identifier: GPL-2.0-or-later.
 * Regression: avoidable connector crossings must be eliminated by the
 * deterministic pipeline (two-sided layered sweeps, best-of routing-order
 * selection, reduced-but-nonzero refinement budgets). The fan-out fixture
 * rendered with 5 residual crossings before this coverage; the bounds below
 * are constructive, not a global optimality proof.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const A=require('../dist/ddn.global');
const root=path.resolve(__dirname,'..'),fixtures=path.join(__dirname,'fixtures/crossing-reduction'),out=path.join(root,'tests/validation/crossing-reduction');fs.mkdirSync(out,{recursive:true});
const checks=[];
function test(name,fn){try{fn();checks.push({name,pass:true});console.log('PASS',name);}catch(e){checks.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);process.exitCode=1;}}
function render(file,view){
 const src=fs.readFileSync(path.join(fixtures,file),'utf8');
 return A.createWorkspace({'figure.ddn':src}).renderSync({entry:'figure.ddn',view});
}
let fan,long;
test('Fan-out from one container to five siblings renders',()=>{fan=render('fanout-container.ddn','fig1');assert.ok(fan.svg.length>1000);});
test('Fan-out fixture holds at most one residual crossing (was five)',()=>assert.ok(fan.scene.crossings.length<=1,'crossings: '+fan.scene.crossings.length));
test('Fan-out drawing passes every checked quality gate',()=>assert.deepEqual(fan.scene.quality.errors,[]));
test('Long-edge-across-fan fixture does not regress past four crossings',()=>{long=render('long-edge-fan.ddn','fig14');assert.ok(long.scene.crossings.length<=4,'crossings: '+long.scene.crossings.length);});
test('Long-edge drawing passes every checked quality gate',()=>assert.deepEqual(long.scene.quality.errors,[]));
test('Both renders are deterministic',()=>{
 assert.equal(render('fanout-container.ddn','fig1').svg,fan.svg);
 assert.equal(render('long-edge-fan.ddn','fig14').svg,long.svg);
});
for(const [name,r]of [['fanout',fan],['long-edge',long]])fs.writeFileSync(path.join(out,name+'.svg'),r.svg);
fs.writeFileSync(path.join(out,'crossing-reduction.json'),JSON.stringify({version:A.VERSION,scope:'Fixture-bounded crossing reduction; no claim of global crossing optimality.',passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,crossings:{fanout:fan.scene.crossings.length,longEdge:long.scene.crossings.length},checks},null,2)+'\n');
console.log('Crossing reduction',checks.filter(x=>x.pass).length+'/'+checks.length);
