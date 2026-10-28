import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const output=process.env.DDN_BUILD_ROOT??resolve('.work/builds/ddn');
const {decorateEdge,cleanRoute,routeIntersects}=await import(pathToFileURL(resolve(output,'ddn/packages/presentation/src/graph-common.js')));
const {nodeGlyph}=await import(pathToFileURL(resolve(output,'ddn/packages/presentation/src/graph-glyphs.js')));
const ref=id=>({file:'main.ddn',id});
const view={file:'main.ddn',ref:ref('view'),owner:'view',record:{id:'view',profile:'dfd.yourdon@1'}};
function node(id,bounds,ellipse=false){
 const definition={file:'main.ddn',ref:ref(id),owner:'definition',record:{id,name:id,role:ellipse?'dfd.process':'dfd.external',category:'element'}};
 return {definition,view,effective:{},item:{occurrence:id,target:ref(id),bounds,transform:[1,0,0,1,0,0],primitives:[{kind:ellipse?'ellipse':'rect',bounds,paint:{fill:'#fff',stroke:'#000'}}],hitTargets:[{id,target:ref(id),bounds}],accessible:{role:'graphics-symbol',label:id}}};
}
function relation(id,from,to,route={}){
 const definition={file:'main.ddn',ref:ref(id),owner:'definition',record:{id,name:id,role:'dfd.flow',category:'relation',endpoints:[{definition:ref(from)},{definition:ref(to)}]}};
 return {definition,view,appearance:{file:'main.ddn',ref:ref('use-'+id),record:{route}},effective:{},item:{occurrence:id,target:ref(id),bounds:{x:0,y:0,width:1,height:1},transform:[1,0,0,1,0,0],primitives:[],hitTargets:[],accessible:{role:'graphics-symbol',label:id}}};
}
const path=e=>e.item.primitives.find(p=>p.kind==='path').d;
const points=d=>d.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number).reduce((r,n,i,a)=>i%2?r:[...r,[n,a[i+1]]],[]);
function render(edge,nodes,layout={},prior=[]){return decorateEdge(edge,nodes,[...nodes.map(n=>n.definition),edge.definition],'dfd.yourdon@1',{x:0,y:0,width:1000,height:800},[],[],prior,'none',{layout});}
const inner=b=>({x:b.x+.01,y:b.y+.01,width:b.width-.02,height:b.height-.02});

test('automatic orthogonal routes leave and approach both bodies before bending, with configurable clearance',()=>{
 for(const clearance of [undefined,52]) for(const flip of [false,true]){
  const a=node('a',{x:0,y:80,width:100,height:80}),b=node('b',{x:350,y:230,width:120,height:100});
  const route=relation('r',flip?'b':'a',flip?'a':'b'),p=points(path(render(route,[a,b],{routing:'orthogonal',...(clearance===undefined?{}:{port_clearance:clearance})})));
  const source=flip?b:a,target=flip?a:b,first=[p[1][0]-p[0][0],p[1][1]-p[0][1]],last=[p.at(-2)[0]-p.at(-1)[0],p.at(-2)[1]-p.at(-1)[1]];
  assert.equal(first[1],0);assert.equal(last[1],0);assert.ok(first[0]*(flip?-1:1)>0);assert.ok(last[0]*(flip?1:-1)>0);
  assert.ok(Math.abs(first[0])>=(clearance??28));assert.ok(Math.abs(last[0])>=(clearance??28));
  assert.equal(routeIntersects(p,inner(source.item.bounds)),false);assert.equal(routeIntersects(p,inner(target.item.bounds)),false);
 }
});
test('rounded routes retain a visible straight escape of the configured length',()=>{
 const nodes=[node('a',{x:0,y:80,width:100,height:80}),node('b',{x:400,y:280,width:100,height:80})];
 for(const clearance of [28,56]){
  const d=path(render(relation('r','a','b'),nodes,{routing:'curved',curve:'rounded',curve_radius:32,port_clearance:clearance}));
  assert.match(d,/Q/);const p=points(d);assert.ok(Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1])>=clearance,d);
  const tail=d.match(/(?:Q[^QML]+\s|L)([-\d.]+),([-\d.]+)L([-\d.]+),([-\d.]+)$/);assert.ok(tail,d);assert.ok(Math.hypot(+tail[3]-+tail[1],+tail[4]-+tail[2])>=clearance,d);
 }
});
test('Yourdon processes use actual ellipse boundaries and different incoming alignments remain distinct',()=>{
 const top=node('top',{x:0,y:0,width:100,height:60}),bottom=node('bottom',{x:0,y:280,width:100,height:60}),process=node('process',{x:300,y:100,width:160,height:160},true);
 const paths=[top,bottom].map(n=>points(path(render(relation(n.definition.ref.id+'-r',n.definition.ref.id,'process'),[top,bottom,process]))));
 const ends=paths.map(p=>p.at(-1));assert.notDeepEqual(ends[0],ends[1]);
 for(const [x,y] of ends)assert.ok(Math.abs(((x-380)/80)**2+((y-180)/80)**2-1)<1e-8);
 const d=path(render(relation('explicit','top','process',{target_side:'north',target_fraction:.2}),[top,process]));const p=points(d),end=p.at(-1);
 assert.ok(Math.abs(((end[0]-380)/80)**2+((end[1]-180)/80)**2-1)<1e-8);assert.equal(p.at(-2)[0],end[0]);assert.ok(p.at(-2)[1]<end[1]-27.9);
});
test('routing keeps its middle section outside unrelated obstacles and endpoint bodies',()=>{
 const a=node('a',{x:0,y:100,width:100,height:80}),b=node('b',{x:500,y:100,width:100,height:80}),block=node('block',{x:230,y:60,width:140,height:180});
 const p=points(path(render(relation('r','a','b'),[a,b,block])));for(const n of [a,b,block])assert.equal(routeIntersects(p,inner(n.item.bounds)),false);
});
test('explicit sides and waypoints are preserved, and straight routes stay straight',()=>{
 const nodes=[node('a',{x:0,y:80,width:100,height:80}),node('b',{x:400,y:280,width:100,height:80})];
 const p=points(path(render(relation('r','a','b',{source_side:'south',target_side:'north',via:[{x:50,y:230},{x:450,y:230}]}),nodes)));
 assert.deepEqual(p,[[50,160],[50,230],[450,230],[450,280]]);
 assert.equal(points(path(render(relation('s','a','b'),nodes,{routing:'straight'}))).length,2);
});
test('reverse edges and loops use distinct routes without entering their bodies',()=>{
 const a=node('a',{x:0,y:100,width:100,height:100}),b=node('b',{x:400,y:100,width:100,height:100}),prior=[];
 const first=path(render(relation('forward','a','b'),[a,b],{},prior)),second=path(render(relation('reverse','b','a'),[a,b],{},prior));
 assert.ok(points(second).length>=6);assert.notDeepEqual(points(first).reverse(),points(second));
 for(const p of [points(first),points(second)])for(const n of [a,b])assert.equal(routeIntersects(p,inner(n.item.bounds)),false);
 const loop=points(path(render(relation('loop','a','a'),[a])));assert.notDeepEqual(loop[0],loop.at(-1));assert.equal(routeIntersects(loop,inner(a.item.bounds)),false);assert.ok(loop[1][0]-loop[0][0]>=28);
});
test('collinear route cleanup retains reversals rather than deleting a required escape',()=>{
 assert.deepEqual(cleanRoute([[0,0],[28,0],[10,0],[10,30]]),[[0,0],[28,0],[10,0],[10,30]]);
 assert.deepEqual(cleanRoute([[0,0],[28,0],[60,0],[60,30]]),[[0,0],[60,0],[60,30]]);
});
test('three diagonal parallel and reverse edges retain separate middle tracks',()=>{
 const nodes=[node('a',{x:0,y:100,width:100,height:100}),node('b',{x:400,y:300,width:100,height:100})],prior=[];
 const p=[relation('first','a','b'),relation('second','a','b'),relation('third','b','a')].map(e=>points(path(render(e,nodes,{},prior))));
 assert.notDeepEqual(p[0],p[1]);assert.notDeepEqual(p[0],p[2].toReversed());assert.notDeepEqual(p[1],p[2].toReversed());
 for(const route of p)for(const n of nodes)assert.equal(routeIntersects(route,inner(n.item.bounds)),false);
});
test('close and same-facing attachments do not double back over their endpoint stems',()=>{
 for(const target of [{x:140,y:180,width:100,height:80},{x:180,y:80,width:100,height:80}]) for(const sides of [{source_side:'east',target_side:'west'},{source_side:'east',target_side:'east'},{source_side:'south',target_side:'south'}]){
  const nodes=[node('a',{x:0,y:80,width:100,height:80}),node('b',target)],p=points(path(render(relation('r','a','b',sides),nodes)));
  for(let i=1;i<p.length-1;i++){
   const a=p[i-1],b=p[i],c=p[i+1],cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]),dot=(b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]);
   assert.ok(Math.abs(cross)>.001||dot>=0,JSON.stringify({sides,target,p}));
  }
 }
});
test('small or displaced decorative ellipses never change rectangular attachment geometry',()=>{
 const a=node('a',{x:0,y:100,width:100,height:100}),b=node('b',{x:300,y:200,width:100,height:100});
 a.item.primitives.unshift({kind:'ellipse',bounds:{x:10,y:100,width:100,height:100},paint:{fill:'#ccc'}});
 const p=points(path(render(relation('r','a','b'),[a,b])));assert.equal(p[0][0],100);
});
test('close rounded routes reduce corner radius before either escape can enter a neighbour',()=>{
 const nodes=[node('a',{x:0,y:0,width:100,height:80}),node('b',{x:150,y:0,width:100,height:80})];
 const sides=['east','west','north','south'];
 for(const source_side of sides)for(const target_side of sides){
  const e=render(relation('r','a','b',{source_side,target_side}),nodes,{routing:'curved',curve:'rounded',port_clearance:28,object_clearance:16,curve_radius:32}),d=path(e);
  // Sample every quadratic; checking control polygons alone misses a rounded
  // shortcut through an endpoint body.
  const pieces=d.match(/[MLQC][^MLQC]*/g),samples=[];let current;
  for(const piece of pieces){const p=points(piece);if(piece[0]==='M'){current=p[0];samples.push(current);}else if(piece[0]==='L'){current=p[0];samples.push(current);}else{const start=current,control=p[0],end=p.at(-1);for(let i=1;i<=20;i++){const t=i/20,u=1-t;samples.push(piece[0]==='C'?[u*u*u*start[0]+3*u*u*t*control[0]+3*u*t*t*p[1][0]+t*t*t*end[0],u*u*u*start[1]+3*u*u*t*control[1]+3*u*t*t*p[1][1]+t*t*t*end[1]]:[u*u*start[0]+2*u*t*control[0]+t*t*end[0],u*u*start[1]+2*u*t*control[1]+t*t*end[1]]);}current=end;}}
  for(const node of nodes)assert.equal(routeIntersects(samples,inner(node.item.bounds)),false,JSON.stringify({source_side,target_side,d}));
  const p=points(d);assert.ok(Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1])>=28,d);
 }
});
test('relation label backdrops cannot obscure their own bends or arrow approaches',()=>{
 const nodes=[node('process',{x:0,y:100,width:160,height:160},true),node('ledger',{x:320,y:0,width:160,height:80})];
 const e=render(relation('Authorized posting','process','ledger'),nodes),p=points(path(e));
 for(const primitive of e.item.primitives.filter(p=>p.kind==='rect'))assert.equal(routeIntersects(p,primitive.bounds),false,JSON.stringify({path:path(e),box:primitive.bounds}));
});

test('actual diamond glyphs keep centred on-boundary automatic ports and correct endpoint normals',()=>{
 for(const role of ['flow.decision','flow.gateway','flow.merge','state.choice','cmmn.sentry','chen.association','flow.sort']){
  const a=node('diamond',{x:0,y:100,width:100,height:100}),b=node('other',{x:360,y:230,width:120,height:90});
  a.definition.record.role=role;a.item.primitives=nodeGlyph(role,a.definition.record,a.item.bounds,{title:'Choice',profile:'flow.basic@1'});
  for(const reverse of [false,true]){
   const p=points(path(render(relation('r',reverse?'other':'diamond',reverse?'diamond':'other'),[a,b]))),point=reverse?p.at(-1):p[0],near=reverse?p.at(-2):p[1];
   assert.equal(Math.abs((point[0]-50)/50)+Math.abs((point[1]-150)/50),1,role);
   assert.deepEqual(point,[100,150],role);assert.equal(near[1],point[1]);assert.ok(near[0]>=point[0]+28);
  }
 }
});
test('unsupported path contours retain their previous central automatic side anchors',()=>{
 for(const role of ['flow.start','flow.end','flow.preparation','flow.document','flow.storage','dmn.inputdata','flow.sendsignal']){
  const a=node('shape',{x:0,y:100,width:100,height:100}),b=node('other',{x:360,y:230,width:120,height:90});
  a.definition.record.role=role;a.item.primitives=nodeGlyph(role,a.definition.record,a.item.bounds,{title:'Shape',profile:'flow.basic@1'});
  const p=points(path(render(relation('r','shape','other'),[a,b])));assert.deepEqual(p[0],[100,150],role);
 }
});
