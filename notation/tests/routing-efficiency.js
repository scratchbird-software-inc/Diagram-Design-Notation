/* SPDX-License-Identifier: GPL-2.0-or-later.
 * Regression: route labels must not create a global-centre hairpin. These are
 * constructive bounds on selected fixtures, not a global shortest-path proof.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const A=require('../dist/ddn.global'),L=require('../runtime/ddn-layout');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tests/validation/routing-fix');fs.mkdirSync(out,{recursive:true});
const base=Object.fromEntries(['model.ddn','views.ddn','formats.ddn'].map(f=>[f,fs.readFileSync(path.join(root,'../website/examples/projections',f),'utf8')]));
const checks=[],renders=[];
function test(name,fn){try{fn();checks.push({name,pass:true});console.log('PASS',name);}catch(e){checks.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function render(hint='',overrides={},changes={}){
 const files={...base,...changes};files['views.ddn']=files['views.ddn'].replace('view flowchart "01 / Purchasing control flow" {','view flowchart "01 / Purchasing control flow" {\n'+hint);
 return A.createWorkspace(files).renderSync({entry:'views.ddn',view:'flowchart',overrides});
}
const distance=r=>L.segs(r.points).reduce((n,s)=>n+Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]),0);
const complete=r=>r.scene.routes.find(x=>x.id.endsWith('process.p08'));
const positions=r=>r.scene.nodes.map(n=>({id:n.id,x:n.x,y:n.y,w:n.w,h:n.h}));
const before=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/routing-fix/before.scene.json'),'utf8'));
const original=before.routes.find(r=>r.id.endsWith('process.p08'));
let after;
test('The original witness records the reported multi-thousand-unit detour',()=>assert.ok(distance(original)>3000));
test('Public runtime renders the unchanged purchasing source',()=>{after=render();assert.ok(after.svg.includes('Complete'));});
test('Complete is a direct 140-unit connector, not a label excursion',()=>{assert.equal(complete(after).points.length,2);assert.ok(Math.abs(distance(complete(after))-140)<.01);});
test('No leftward backtracking remains in this rightward unobstructed relation',()=>{const p=complete(after).points;for(let i=1;i<p.length;i++)assert.ok(p[i][0]>=p[i-1][0]);});
test('Correction changes no node coordinates or measured dimensions',()=>assert.deepEqual(positions(after),before.nodes.map(n=>({id:n.id,x:n.x,y:n.y,w:n.w,h:n.h}))));
test('All nine relationship identities are preserved',()=>assert.deepEqual(after.scene.routes.map(r=>r.id).sort(),before.routes.map(r=>r.id).sort()));
test('Checked geometry still has no object, route, or label interference',()=>assert.deepEqual(after.scene.quality.errors,[]));
test('Diagram height no longer includes the remote label excursion',()=>assert.ok(after.scene.height<700&&after.scene.height<before.height));
test('Useful endpoint adjustment can run even with zero crossing count',()=>{assert.equal(after.scene.crossings.length,0);assert.equal(after.scene.layout.nodeMoves,0);assert.ok(after.scene.layout.portChanges>0);});
for(const look of ['classic','handDrawn','neo'])for(const routing of ['orthogonal','curved','rounded'])test('Short valid route and same model under '+look+'/'+routing,()=>{
 const r=render('',{look,routing});assert.equal(r.modelFingerprint,after.modelFingerprint);assert.ok(distance(complete(r))<250);assert.deepEqual(r.scene.quality.errors,[]);renders.push({look,routing,length:distance(complete(r)),diagnostics:r.diagnostics});
});
for(const theme of ['night','dark','neutral'])test('Palette does not bring back the route excursion: '+theme,()=>{const r=render('',{theme});assert.deepEqual(complete(r).points,complete(after).points);});
test('Numbered and token labels retain short routes',()=>{for(const labels of ['numbers','tokens']){const r=render('',{labels});assert.ok(distance(complete(r))<300);assert.equal(r.modelFingerprint,after.modelFingerprint);}});
test('Pinning every box preserves its world coordinates and still fixes the connector',()=>{
 const hints=before.nodes.map(n=>`place @m.${n.id.split('::')[1]} {at:[${n.x}px,${n.y}px];}`).join('\n');
 const r=render(hints);assert.deepEqual(positions(r),positions(after));assert.ok(distance(complete(r))<200);
});
const fixed='route @m.process.p08 {source_side:east;target_side:west;source_fraction:0.5;target_fraction:0.33333;}';
test('Explicit endpoint fractions are not overwritten to fake a direct route',()=>{const r=render(fixed),p=complete(r);assert.deepEqual(p.points[0],[2730,50]);assert.deepEqual(p.points.at(-1),[2870,33.333]);assert.ok(distance(p)<500);});
test('With fixed anchors, label detour is local to the related pair',()=>{const p=complete(render(fixed));assert.ok(p.points.every(([x,y])=>x>=2730&&x<=2870&&y>-200));});
test('Long label remains readable through a local detour rather than global centring',()=>{const r=render('',{}, {'model.ddn':base['model.ddn'].replace('"Complete" @post','"Complete after posting authorization and delivery receipt" @post')});assert.ok(distance(complete(r))<550);assert.deepEqual(r.scene.quality.errors,[]);});
const hard=fixed.replace(';}',';policy:strict;via:[[2774px,50px],[2774px,-150px],[2826px,-150px],[2826px,33.333px]];}');
test('Authored strict waypoints remain exact even when a shorter automatic route exists',()=>{assert.deepEqual(complete(render(hard)).points,[[2730,50],[2774,50],[2774,-150],[2826,-150],[2826,33.333],[2870,33.333]]);});
test('Rerender is deterministic and source text is unchanged',()=>{const w=A.createWorkspace(base),s=w.getFiles();assert.equal(render().svg,after.svg);w.renderSync({entry:'views.ddn',view:'flowchart'});assert.deepEqual(w.getFiles(),s);});
// Two alternating barriers admit a compact zigzag; a <=2-bend-only search
// instead escapes beyond the ends of both barriers (2532 units in predecessor).
const mazeNodes=[{id:'a',x:0,y:0,w:50,h:50},{id:'b',x:500,y:0,w:50,h:50},{id:'wall1',x:150,y:-1000,w:40,h:1050},{id:'wall2',x:300,y:0,w:40,h:1050}];
const mazeRels=[{id:'r',from:{element:'a'},to:{element:'b'}}];
const mazeProfiles={layout:{direction:'right',routing:'orthogonal',quality:'error',object_clearance:16,edge_clearance:12,port_clearance:28}};
for(const reflected of [false,true])test('Visibility search beats distant low-bend incumbent'+(reflected?' (reflected)':''),()=>{
 const ns=mazeNodes.map(n=>({...n,...(reflected?{y:-n.y-n.h}:{})}));const result=L.routing(ns,mazeRels,mazeProfiles,{},()=>({w:30,h:30}));
 assert.ok(distance(result.routes[0])<700);assert.deepEqual(result.quality.errors,[]);
 for(const s of L.segs(result.routes[0].points))for(const n of ns.filter(n=>n.id.startsWith('wall')))assert.ok(!L.segmentBox(s,L.box(n,15.9)));
});
test('Impossible label on a strict path is reported rather than changing its waypoints',()=>{
 const ns=[{id:'a',x:0,y:0,w:50,h:50},{id:'b',x:180,y:0,w:50,h:50}];
 assert.throws(()=>L.routing(ns,mazeRels,mazeProfiles,{r:{via:[],policy:'strict'}},()=>({w:500,h:28})),e=>e.code==='DDN217'||e.message==='DDN217');
});
const Shapes=require('../runtime/ddn-shapes');
for(const silhouette of ['diamond','parallelogram','ellipse']){
 const g={x:0,y:0,w:100,h:80,silhouette};
 test('Curved owner contour rejects a line through '+silhouette,()=>assert.equal(Shapes.segmentInterior({a:[-30,40],b:[130,40]},g),true));
 test('Curved owner contour accepts a legal boundary arrival at '+silhouette,()=>{
  const a=Shapes.anchor(g,'west',[0,20]);assert.equal(Shapes.segmentInterior({a:[a[0]-50,a[1]],b:a},g),false);
 });
}
if(after){fs.writeFileSync(path.join(out,'after.svg'),after.svg);fs.writeFileSync(path.join(out,'after.scene.json'),JSON.stringify(after.scene,null,2)+'\n');}
const summary={version:A.VERSION,scope:'Fixture-bounded route efficiency, pin/endpoint constraints, local labels, alternative-path search. No claim of global routing optimality.',passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,comparison:after?{relation:original.id,beforeLength:distance(original),afterLength:distance(complete(after)),reductionPercent:100*(1-distance(complete(after))/distance(original)),beforeBends:original.points.length-2,afterBends:complete(after).points.length-2,nodesUnchanged:JSON.stringify(positions(after))===JSON.stringify(before.nodes.map(n=>({id:n.id,x:n.x,y:n.y,w:n.w,h:n.h}))),beforeHeight:before.height,afterHeight:after.scene.height,sourceFiles:Object.fromEntries(Object.entries(base).map(([f,s])=>[f,crypto.createHash('sha256').update(s).digest('hex')]))}:null,checks,variants:renders};
fs.writeFileSync(path.join(root,'tests/validation/routing-efficiency.json'),JSON.stringify(summary,null,2)+'\n');console.log('Routing efficiency',summary.passed+'/'+checks.length);if(summary.failed)process.exitCode=1;
