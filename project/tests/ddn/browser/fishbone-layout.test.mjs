import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGraphFixture } from './graph-profiles.fixtures.mjs';
const output=process.env.DDN_BUILD_ROOT??resolve('.work/builds/ddn');
const load=file=>import(pathToFileURL(resolve(output,'ddn/packages',file)));
const {records}=await load('presentation/src/model.js');
const {projectGraphProfile}=await load('presentation/src/graph-profiles.js');
function fixture(count=6) {
 const f=createGraphFixture('fishbone.basic@1'); f.definitions.splice(0);
 f.add=(id,role,title=id)=>{const node={id,name:id,title,category:'element',role};f.definitions.push(node);return node;};
 f.link=(id,from,to)=>{const edge={id,name:id,category:'relation',role:'quality.cause',endpoints:[{definition:{id:from}},{definition:{id:to}}]};f.definitions.push(edge);return edge;};
 f.add('effect','quality.effect','Inspection failures');
 for(let i=0;i<count;i++){f.add('category'+i,'quality.category','Category '+i);f.link('rib'+i,'category'+i,'effect');}
 return f;
}
function render(f,override={}) {
 f.view.selection.include=f.definitions.map(d=>({id:d.id}));
 const all=records(f.snapshot),view=all.find(r=>r.owner==='view'&&r.ref.id===f.view.id),entries=all.filter(r=>r.owner==='definition').map(definition=>{
  const bounds={x:32,y:64,width:248,height:72},occurrence='fishbone:'+definition.ref.id;
  return {definition,view,effective:{...definition.record,...override},item:{occurrence,target:definition.ref,view:view.ref,layer:definition.record.category==='relation'?'relations':'content',bounds,transform:[1,0,0,1,0,0],primitives:[],hitTargets:[{id:occurrence,target:definition.ref,bounds}],accessible:{role:'graphics-symbol',label:definition.record.name},evidence:'current'}};
 });
 return projectGraphProfile(f.snapshot,view,entries,{bounds:{x:0,y:0,width:960,height:680}});
}
const bone=(r,id)=>r.entries.find(e=>e.definition.ref.id===id&&e.item.occurrence.includes(':cause-edge:'));
const points=entry=>entry.item.primitives.find(p=>p.kind==='path').d.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number).reduce((a,n,i)=>{if(i%2)a.at(-1).push(n);else a.push([n]);return a;},[]);
const onSegment=(p,a,b)=>Math.abs((p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]))<.001&&p[0]>=Math.min(a[0],b[0])-.001&&p[0]<=Math.max(a[0],b[0])+.001&&p[1]>=Math.min(a[1],b[1])-.001&&p[1]<=Math.max(a[1],b[1])+.001;
const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function crosses(a,b) {
 for(let i=1;i<a.length;i++)for(let j=1;j<b.length;j++){
  const p=a[i-1],q=a[i],r=b[j-1],s=b[j],cross=(x,y)=>x[0]*y[1]-x[1]*y[0],v=[q[0]-p[0],q[1]-p[1]],w=[s[0]-r[0],s[1]-r[1]],delta=[r[0]-p[0],r[1]-p[1]],den=cross(v,w);if(Math.abs(den)<1e-8)continue;
  const t=cross(delta,w)/den,u=cross(delta,v)/den;if(t>1e-8&&t<1-1e-8&&u>1e-8&&u<1-1e-8)return true;
 }return false;
}
test('fishbone causes use distinct horizontal bones along category ribs and nested causes join their parent bone',()=>{
 const f=fixture();
 for(let i=0;i<6;i++)for(let j=0;j<3;j++){f.add(`cause${i}-${j}`,'quality.cause','Possible cause '+j);f.link(`bone${i}-${j}`,`cause${i}-${j}`,'category'+i);}
 f.add('nested','quality.cause','A more specific cause');f.link('nested-top','nested','cause0-0');f.link('nested-bottom','nested','cause1-1');
 const before=JSON.stringify(f.definitions),r=render(f);assert.deepEqual(r.unavailable,[]);assert.equal(JSON.stringify(f.definitions),before);
 for(let i=0;i<6;i++){
  const rib=points(bone(r,'rib'+i)),ys=[];assert.notEqual(rib[0][0],rib[1][0]);assert.notEqual(rib[0][1],rib[1][1]);
  for(let j=0;j<3;j++){const p=points(bone(r,`bone${i}-${j}`));assert.equal(p.length,2);assert.equal(p[0][1],p[1][1]);assert.ok(onSegment(p[1],...rib));ys.push(p[0][1]);}
  assert.equal(new Set(ys).size,3);
  assert.ok(i%2===0 ? ys[0]<ys[1]&&ys[1]<ys[2] : ys[0]>ys[1]&&ys[1]>ys[2], 'Source order proceeds from the category tip towards the spine');
 }
 for(const [id,parent]of [['nested-top','bone0-0'],['nested-bottom','bone1-1']]){const p=points(bone(r,id));assert.equal(p.length,3);assert.equal(p[0][1],p[1][1]);assert.notEqual(p[1][1],p[2][1]);assert.ok(onSegment(p[2],...points(bone(r,parent))));}
 const repeats=r.entries.filter(e=>e.definition.ref.id==='nested');assert.equal(repeats.length,2);assert.notEqual(repeats[0].item.occurrence,repeats[1].item.occurrence);assert.deepEqual(repeats[0].item.target,repeats[1].item.target);
});
test('unequal nested sibling envelopes stay clear on both sides of the spine through four cause levels',()=>{
 const f=fixture(2);
 for(let i=0;i<2;i++){
  f.add('parent'+i,'quality.cause','Parent');f.link('parentBone'+i,'parent'+i,'category'+i);
  for(let j=0;j<3;j++){f.add(`child${i}-${j}`,'quality.cause',j===0?'A very long nested sibling description that needs much more horizontal space':'Short');f.link(`childBone${i}-${j}`,`child${i}-${j}`,'parent'+i);}
  f.add('grandchild'+i,'quality.cause','Third level');f.link('grandBone'+i,'grandchild'+i,`child${i}-0`);
  f.add('greatgrandchild'+i,'quality.cause','Fourth level');f.link('greatBone'+i,'greatgrandchild'+i,'grandchild'+i);
 }
 const r=render(f),bones=r.entries.filter(e=>e.item.occurrence.includes(':cause-edge:')),paths=bones.map(points),spineY=points(r.entries.find(e=>e.item.occurrence.endsWith(':spine')))[0][1];
 assert.deepEqual(r.unavailable,[]);
 for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++)assert.equal(crosses(paths[i],paths[j]),false,`${bones[i].definition.ref.id} crosses ${bones[j].definition.ref.id}`);
 for(let i=0;i<2;i++)for(const prefix of ['childBone','grandBone','greatBone'])for(const e of bones.filter(e=>e.definition.ref.id.startsWith(prefix+i))){assert.ok(points(e).every(p=>i===0?p[1]<spineY:p[1]>spineY));}
 const labels=r.entries.filter(e=>e.item.occurrence.includes(':cause:'));for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++)assert.equal(overlaps(labels[i].item.bounds,labels[j].item.bounds),false);
});
test('one to twelve categories, long headings and dense branches expand before the effect with complete bounds',()=>{
 for(const count of [1,12]){
  const f=fixture(count);f.definitions.find(d=>d.id==='category0').title='A category heading that is deliberately much longer than the ordinary category names in a fishbone';
  for(let i=0;i<count;i++)for(let j=0;j<(i===0?9:2);j++){f.add(`cause${i}-${j}`,'quality.cause','Cause '+j);f.link(`bone${i}-${j}`,`cause${i}-${j}`,'category'+i);}
  const r=render(f),effect=r.entries.find(e=>e.definition.ref.id==='effect'&&!e.item.occurrence.endsWith(':spine')),caption=r.entries.find(e=>e.item.occurrence.endsWith(':method-caption'));
  assert.deepEqual(r.unavailable,[]);
  for(const entry of r.entries.filter(e=>e.item.occurrence.includes(':cause-edge:')))for(const [x,y]of points(entry)){
   assert.ok(x<effect.item.bounds.x);assert.ok(x>=entry.item.bounds.x&&x<=entry.item.bounds.x+entry.item.bounds.width);assert.ok(y>=entry.item.bounds.y&&y<=entry.item.bounds.y+entry.item.bounds.height);
  }
  const headings=r.entries.filter(e=>e.definition.record.role==='quality.category');for(let i=0;i<headings.length;i++)for(let j=i+1;j<headings.length;j++)assert.equal(overlaps(headings[i].item.bounds,headings[j].item.bounds),false);
  assert.ok(caption.item.bounds.y>Math.max(...r.entries.filter(e=>e!==caption).map(e=>e.item.bounds.y+e.item.bounds.height)));
  const spine=r.entries.find(e=>e.item.occurrence.endsWith(':spine'));for(const [x,y]of points(spine))assert.ok(x>=spine.item.bounds.x&&x<=spine.item.bounds.x+spine.item.bounds.width&&y>=spine.item.bounds.y&&y<=spine.item.bounds.y+spine.item.bounds.height);
  assert.ok(r.entries.every(e=>e.item.bounds.x>=32));
 }
});
test('fishbone strokes, headings and sketch rendering retain effective styling',()=>{
 const f=fixture(2);f.add('cause','quality.cause','A supplied cause');f.link('bone','cause','category0');
 const style={stroke:{color:'#d946ef',weight:3,dash:'dashed'},text:{color:'#123456'},style:{font_size:24}};
 const classic=render(f,style),sketch=render(f,{...style,style:{...style.style,look:'handdrawn'}});
 for(const entry of classic.entries.filter(e=>e.item.occurrence.includes(':cause-edge:'))){const p=entry.item.primitives[0];assert.equal(p.paint.stroke,'#d946ef');assert.equal(p.paint['stroke-width'],3);assert.equal(p.paint['stroke-dasharray'],'6 4');}
 const heading=classic.entries.find(e=>e.definition.record.role==='quality.category').item.primitives[0].runs[0];assert.equal(heading.style['font-weight'],700);assert.equal(heading.style['font-size'],25.5);assert.equal(heading.style.fill,'#123456');
 assert.notDeepEqual(bone(classic,'bone').item.primitives,bone(sketch,'bone').item.primitives);
 assert.equal(bone(render(f,{stroke:{dash:[8,2]}}),'bone').item.primitives[0].paint['stroke-dasharray'],'8 2');
});
test('invalid cyclic or over-depth source stays bounded and reports incomplete projection',()=>{
 const f=fixture(1);let parent='category0';for(let i=1;i<=5;i++){f.add('cause'+i,'quality.cause');f.link('bone'+i,'cause'+i,parent);parent='cause'+i;}
 const r=render(f);assert.ok(r.unavailable.includes('fishbone:bounded-traversal'));assert.ok(r.diagnostics.some(d=>d.code==='fishbone-bounded-traversal'));
 f.link('cycle','category0','cause2');assert.ok(render(f).unavailable.includes('fishbone:bounded-traversal'));
});
