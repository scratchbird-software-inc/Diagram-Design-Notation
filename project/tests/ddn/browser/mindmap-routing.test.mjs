import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const output=process.env.DDN_BUILD_ROOT??resolve('.work/builds/ddn');
const load=file=>import(pathToFileURL(resolve(output,'ddn/packages',file)));
const {createRuntime,createNativeRuntimeOptions}=await load('runtime/src/native.js');
const {resolveProperties}=await load('defaults/src/index.js');
const {projectSnapshot}=await load('presentation/src/native.js');
const topic=(name,role='object',description='')=>`element ${name} as ${role}\n    with\n        title ${name}\n${description?`        description ${JSON.stringify(description)}\n`:''}`;
const edge=(name,from,to)=>`relation ${name} as assoc\n    with\n        title ${JSON.stringify('Label '+name)}\n        endpoints\n            item\n                definition ${from}\n            item\n                definition ${to}\n`;
function source(names,links,{legend='numbers',hints={},pins={},roles={},extra='',selected=names}={}) {
 return names.map((name,i)=>topic(name,roles[name],i%3===0?'A detailed topic with useful context. '.repeat(i%4+1):'')).join('\n')+extra+'\n'+links.map(([name,from,to])=>edge(name,from,to)).join('\n')+'\nview Map as mindmap.basic@1\n    with\n        legend.mode '+legend+'\n'+selected.map(name=>'    use '+name+(pins[name]?'\n        with\n            position.x '+pins[name][0]+'\n            position.y '+pins[name][1]:'')).join('\n')+'\n'+links.map(([name])=>'    use '+name+(hints[name]?'\n        with\n            route.source_side '+hints[name]:'' )).join('\n')+'\n';
}
async function scene(text,complete=false) {
 const runtime=complete?await load('runtime/src/index.js').then(api=>api.createRuntime(api.createCompleteRuntimeOptions())):createRuntime(createNativeRuntimeOptions());
 try {const opened=await runtime.open({entry:'main.ddn',files:[{id:'main.ddn',text,revision:'1',encoding:'utf-8',writable:true}]});assert.ok(opened.snapshot,JSON.stringify(opened.diagnostics));
  const presentation=complete?await load('presentation/src/index.js'):{projectSnapshot};
  return presentation.projectSnapshot(opened.snapshot,{resolve:(target,context)=>resolveProperties(opened.snapshot,target,context)});
 } finally {runtime.destroy();}
}
const labels=item=>item.primitives.flatMap(p=>p.kind==='text'?p.runs.map(r=>r.text):[]);
const edges=scene=>scene.entries.filter(e=>e.definition.record.category==='relation');
const node=(scene,name)=>scene.entries.find(e=>e.definition.record.category!=='relation'&&e.definition.record.name===name&&e.definition.owner==='definition');
const body=entry=>entry.item.hitTargets.find(hit=>hit.target.id===entry.definition.ref.id).bounds;
const world=(entry,[x,y])=>{const m=entry.item.transform;return[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];};
function curve(entry) {const p=entry.item.primitives.find(p=>p.kind==='path');assert.match(p.d,/^M[-\d.,]+C[-\d., ]+$/);const n=p.d.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);assert.equal(n.length,8);return {a:n.slice(0,2),c:n.slice(2,4),d:n.slice(4,6),b:n.slice(6,8)};}
function points({a,c,d,b}) {return Array.from({length:81},(_,i)=>{const t=i/80,u=1-t;return [u**3*a[0]+3*u*u*t*c[0]+3*u*t*t*d[0]+t**3*b[0],u**3*a[1]+3*u*u*t*c[1]+3*u*t*t*d[1]+t**3*b[1]];});}
function intersects(a,b) {
 for(let i=1;i<a.length;i++)for(let j=1;j<b.length;j++){
  const p=a[i-1],q=a[i],r=b[j-1],s=b[j],cross=(x,y)=>x[0]*y[1]-x[1]*y[0],v=[q[0]-p[0],q[1]-p[1]],w=[s[0]-r[0],s[1]-r[1]],delta=[r[0]-p[0],r[1]-p[1]],den=cross(v,w);if(Math.abs(den)<1e-8)continue;
  const t=cross(delta,w)/den,u=cross(delta,v)/den;if(t>=0&&t<=1&&u>=0&&u<=1)return true;
 }return false;
}

test('mind-map internal curves have horizontal endpoints, distinct even ports and no labels or legend',async()=>{
 const names=['Centre','A','B','C','D','E','F','A1','A2','A3','B1','B2','C1','C2','D1','E1','F1'];
 const links=names.slice(1).map(name=>['R'+name,name.length===1?'Centre':name[0],name]);
 const s=await scene(source(names,links));assert.equal(s.coverage.complete,true,JSON.stringify(s.diagnostics));
 assert.ok(!s.items.flatMap(labels).includes('RELATIONSHIP KEY'));
 const grouped=new Map(),directions=new Map();
 for(const relation of edges(s)){
  assert.deepEqual(labels(relation.item),[]);assert.equal(relation.item.primitives.length,1);
  const c=curve(relation),[,from,to]=links.find(([name])=>name===relation.definition.record.name);
  for(const [name,p,tangent,kind]of [[from,c.a,c.c,'out'],[to,c.b,c.d,'in']]){
   const b=body(node(s,name));assert.ok(Math.abs(p[0]-b.x)<1e-6||Math.abs(p[0]-b.x-b.width)<1e-6);assert.ok(p[1]>b.y&&p[1]<b.y+b.height);assert.equal(p[1],tangent[1]);
   const side=p[0]===b.x?'left':'right',key=name+':'+side,ports=grouped.get(key)??[];ports.push(p[1]);grouped.set(key,ports);directions.set(name+':'+kind,side);
  }
 }
 for(const [key,ports]of grouped){const name=key.split(':')[0],b=body(node(s,name));ports.sort((a,b)=>a-b);assert.equal(new Set(ports).size,ports.length);ports.forEach((y,i)=>assert.ok(Math.abs(y-b.y-b.height*(i+1)/(ports.length+1))<1e-6));}
 for(const name of names.slice(1))if(directions.has(name+':out'))assert.notEqual(directions.get(name+':in'),directions.get(name+':out'));
 const paths=edges(s).map(e=>points(curve(e)));for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++)assert.equal(intersects(paths[i],paths[j]),false,`Branches ${i} and ${j} cross`);
});

test('root branch source-side hints reflow siblings and keep descendants on the same side',async()=>{
 const names=['Centre','A','B','C','A1','B1'],links=[['RA','Centre','A'],['RB','Centre','B'],['RC','Centre','C'],['RA1','A','A1'],['RB1','B','B1']];
 const s=await scene(source(names,links,{hints:{RA:'west',RB:'west',RC:'east'}}));
 const centre=body(node(s,'Centre'));
 for(const name of ['A','A1','B','B1'])assert.ok(body(node(s,name)).x+body(node(s,name)).width<centre.x);
 assert.ok(body(node(s,'C')).x>centre.x+centre.width);
 assert.equal(s.coverage.complete,true,JSON.stringify(s.diagnostics));
});

test('mind-map branch hints retain their physical side under generic direction overrides',async()=>{
 for(const direction of ['left','up','down']){
  const text=source(['Centre','A','B'],[['RA','Centre','A'],['RB','Centre','B']],{hints:{RA:'west',RB:'east'}}).replace('legend.mode numbers','legend.mode numbers\n        layout.direction '+direction);
  const s=await scene(text),centre=body(node(s,'Centre'));assert.ok(body(node(s,'A')).x<centre.x);assert.ok(body(node(s,'B')).x>centre.x);assert.equal(s.coverage.complete,true,JSON.stringify(s.diagnostics));
 }
 const left=await scene(source(['Centre','A','B'],[['RA','Centre','A'],['RB','Centre','B']]).replace('legend.mode numbers','legend.mode numbers\n        layout.direction left'));
 assert.ok(body(node(left,'A')).x<body(node(left,'Centre')).x);assert.ok(body(node(left,'B')).x>body(node(left,'Centre')).x);
});

test('only external relations retain labels and numbered legend entries',async()=>{
 const names=['Centre','Child','Service'],links=[['Internal','Centre','Child'],['External','Centre','Service']];
 const s=await scene(source(names,links,{roles:{Service:'flow.process'}}),true);
 assert.equal(s.coverage.complete,true,JSON.stringify(s.diagnostics));
 assert.deepEqual(labels(edges(s).find(e=>e.definition.record.name==='Internal').item),[]);
 assert.ok(labels(edges(s).find(e=>e.definition.record.name==='External').item).includes('1'));
 const text=s.items.flatMap(labels).join(' ');assert.match(text,/RELATIONSHIP KEY/);assert.match(text,/Label External/);assert.doesNotMatch(text,/Label Internal/);
 const centre=body(node(s,'Centre')),ports=edges(s).map(e=>e.item.primitives.find(p=>p.kind==='path').d.match(/^M([^,]+),([^CQLM]+)/)).filter(Boolean).map(match=>[Number(match[1]),Number(match[2])]);
 assert.ok(ports.every(p=>p[0]===centre.x||p[0]===centre.x+centre.width));assert.equal(new Set(ports.map(p=>p.join(','))).size,ports.length);
});

test('an unselected concept-family external endpoint stays context and retains its relation label',async()=>{
 const names=['Centre','Child','Elsewhere'],links=[['Internal','Centre','Child'],['External','Elsewhere','Centre']];
 const s=await scene(source(names,links,{selected:['Centre','Child']}));
 assert.equal(s.coverage.complete,true,JSON.stringify(s.diagnostics));
 assert.equal(node(s,'Elsewhere').mindmapTopic,false);assert.equal(node(s,'Centre').mindmapTopic,true);
 assert.ok(labels(edges(s).find(e=>e.definition.record.name==='External').item).includes('1'));
 assert.equal(edges(s).filter(e=>!labels(e.item).length).length,1);
});

test('displaying an external context endpoint does not implicitly select its other relationships',async()=>{
 const names=['Centre','Child','Elsewhere'],links=[['Internal','Centre','Child'],['External','Centre','Elsewhere']];
 const s=await scene(source(names,links,{selected:['Centre','Child'],extra:edge('Unselected','Elsewhere','Child')}));
 assert.deepEqual(edges(s).map(e=>e.definition.record.name).sort(),['External','Internal']);
});

test('authored top/bottom anchors render horizontally and report the correction',async()=>{
 const s=await scene(source(['Centre','Child'],[['Branch','Centre','Child']],{hints:{Branch:'north'}}));
 const c=curve(edges(s)[0]),b=body(node(s,'Centre'));assert.ok(c.a[0]===b.x||c.a[0]===b.x+b.width);
 assert.ok(s.diagnostics.some(d=>d.code==='mindmap-horizontal-attachment'));
});

test('the unique centre accepts an incoming external relation on its top or bottom',async()=>{
 for(const side of ['north','south']){
  const text=source(['Centre','Child','Elsewhere'],[['Branch','Centre','Child'],['External','Elsewhere','Centre']],{selected:['Centre','Child']}).replace('    use External\n','    use External\n        with\n            route.target_side '+side+'\n');
  const s=await scene(text),root=body(node(s,'Centre')),relation=edges(s).find(e=>e.definition.record.name==='External'),path=relation.item.primitives.find(p=>p.kind==='path'),values=path.d.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number),end=world(relation,values.slice(-2)),before=world(relation,values.slice(-4,-2));
  assert.equal(end[0],root.x+root.width/2);assert.equal(end[1],side==='north'?root.y:root.y+root.height);assert.equal(before[0],end[0]);assert.ok(side==='north'?before[1]<end[1]:before[1]>end[1],JSON.stringify({side,path:path.d,before,end,diagnostics:s.diagnostics}));
  assert.equal(s.coverage.complete,true,JSON.stringify(s.diagnostics));assert.ok(!s.diagnostics.some(d=>d.code==='mindmap-horizontal-attachment'));assert.equal((path.d.match(/M/g)??[]).length,1);
 }
});

test('top/bottom exception does not apply to a branch topic or an invalid forest',async()=>{
 for(const selected of [['Centre','Child'],['Centre','Child','OtherRoot']]){
  const names=['Centre','Child','OtherRoot','Elsewhere'],target=selected.includes('OtherRoot')?'Centre':'Child';
  const text=source(names,[['Branch','Centre','Child'],['External','Elsewhere',target]],{selected}).replace('    use External\n','    use External\n        with\n            route.target_side north\n');
  const s=await scene(text),b=body(node(s,target)),relation=edges(s).find(e=>e.definition.record.name==='External'),path=relation.item.primitives.find(p=>p.kind==='path'),n=path.d.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number),end=world(relation,n.slice(-2));
  assert.ok(end[0]===b.x||end[0]===b.x+b.width);assert.ok(s.diagnostics.some(d=>d.code==='mindmap-horizontal-attachment'));
 }
});

test('the centre never sends an outgoing external relation through its top or bottom',async()=>{
 for(const side of ['north','south']){
  const text=source(['Centre','Child','Elsewhere'],[['Branch','Centre','Child'],['External','Centre','Elsewhere']],{selected:['Centre','Child'],hints:{External:side}});
  const s=await scene(text),root=body(node(s,'Centre')),relation=edges(s).find(e=>e.definition.record.name==='External'),path=relation.item.primitives.find(p=>p.kind==='path'),values=path.d.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number),start=world(relation,values.slice(0,2));
  assert.ok(start[0]===root.x||start[0]===root.x+root.width);assert.ok(s.diagnostics.some(d=>d.code==='mindmap-horizontal-attachment'));
 }
});

test('conflicting authored pins make route coverage incomplete instead of claiming a clear map',async()=>{
 const s=await scene(source(['Centre','Child','Leaf'],[['A','Centre','Child'],['B','Child','Leaf']],{hints:{A:'east'},pins:{Centre:[500,150],Child:[50,150],Leaf:[0,150]}}));
 assert.equal(s.coverage.complete,false);assert.ok(s.diagnostics.some(d=>d.code==='mindmap-route-conflict'));
});

test('a contradictory descendant-side hint is diagnosed without reversing its branch',async()=>{
 const s=await scene(source(['Centre','Child','Leaf'],[['A','Centre','Child'],['B','Child','Leaf']],{hints:{A:'east',B:'west'}}));
 const relation=edges(s).find(e=>e.definition.record.name==='B'),c=curve(relation),b=body(node(s,'Child'));assert.equal(c.a[0],b.x+b.width);
 assert.equal(s.coverage.complete,false);assert.ok(s.diagnostics.some(d=>d.code==='mindmap-attachment-conflict'));
});

test('native and complete projection entry points produce identical mind-map paths and labels',async()=>{
 const text=source(['Centre','A','B','A1'],[['Arel','Centre','A'],['Brel','Centre','B'],['Leafrel','A','A1']]);
 const native=await scene(text),complete=await scene(text,true),geometry=s=>edges(s).map(e=>({name:e.definition.record.name,primitives:e.item.primitives}));assert.deepEqual(geometry(native),geometry(complete));
});

test('internal branch paint overrides remain effective without restoring relation labels',async()=>{
 const text=source(['Centre','Child'],[['Branch','Centre','Child']]).replace('title "Label Branch"','title "Label Branch"\n        stroke.color "#c05060"\n        stroke.weight 3\n        stroke.dash dashed');
 const s=await scene(text),relation=edges(s)[0],paint=relation.item.primitives[0].paint;
 assert.equal(paint.stroke,'#c05060');assert.equal(paint['stroke-width'],3);assert.equal(paint['stroke-dasharray'],'6 4');assert.deepEqual(labels(relation.item),[]);
});

test('generic DDN can use mindmap layout without adopting mind-map membership or side rules',async()=>{
 const names=['Root','A','B','C','Leaf'],links=[['RA','Root','A'],['RB','Root','B'],['RC','Root','C'],['RLeaf','A','Leaf']],roles=Object.fromEntries(names.map(name=>[name,'flow.process']));
 const text=source(names,links,{roles,hints:{RA:'west'},legend:'text'}).replace('as mindmap.basic@1','as ddn@1').replace('legend.mode text','legend.mode text\n        layout.algorithm mindmap');
 for(const direction of ['right','left','up']){
  const s=await scene(text.replace('layout.algorithm mindmap','layout.algorithm mindmap\n        layout.direction '+direction),true),r=body(node(s,'Root')),a=body(node(s,'A')),b=body(node(s,'B')),c=body(node(s,'C')),leaf=body(node(s,'Leaf'));
  if(direction==='left'){assert.ok(a.x<r.x);assert.ok(leaf.x<a.x);assert.ok(b.x>r.x);}else{assert.ok(a.x>r.x);assert.ok(leaf.x>a.x);assert.ok(b.x<r.x);}
  assert.ok(direction==='up'?a.y+a.height/2>c.y+c.height/2:a.y+a.height/2<c.y+c.height/2);
  assert.ok(edges(s).every(edge=>labels(edge.item).length>0));assert.ok(s.entries.filter(entry=>entry.definition.owner==='definition').every(entry=>entry.mindmapTopic===undefined));
 }
});
