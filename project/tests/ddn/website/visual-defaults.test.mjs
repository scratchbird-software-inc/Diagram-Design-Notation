import test from 'node:test';
import assert from 'node:assert/strict';
import{fileURLToPath,pathToFileURL}from'node:url';
import{join}from'node:path';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const{resolve}=await import(pathToFileURL(join(root,'.work/builds/ddn/ddn/packages/defaults/src/index.js')));
const{isometricGraph}=await import(pathToFileURL(join(root,'.work/builds/ddn/ddn/packages/presentation/src/graph-isometric.js')));
test('theme defaults preserve independent CSS and file paint priority',()=>{
 const dark=resolve({id:'v',name:'View',profile:'ddn@1',style:{theme:'dark'},text:{color:'#abcdef'}},'view_definition',{profile:'ddn@1',styles:[{selector:{owner:'view_definition'},declarations:{'background.color':'#123456'}}]});
 assert.equal(dark.values.background.color,'#123456');assert.equal(dark.values.text.color,'#abcdef');assert.equal(dark.values.border.color,'#7389a5');assert.equal(dark.properties.find(p=>p.path==='border.color').origin,'standard:theme dark');
 const forest=resolve({id:'a',target:{id:'n'},parent:{id:'v'}},'appearance',{theme:'forest'});assert.equal(forest.values.background.color,'#fbfdf9');assert.equal(forest.values.text.color,'#20342b');
});
test('isometric graph keeps source identity and distinct authored depths without changing the flat source',()=>{
 const ref=id=>({file:'main.ddn',id});
 const node=(id,x,depth)=>({definition:{ref:ref(id),file:'main.ddn',record:{id,category:'element',properties:{depth}}},view:{ref:ref('v')},effective:{properties:{depth}},item:{occurrence:id,target:ref(id),view:ref('v'),layer:'content',bounds:{x,y:0,width:100,height:80},transform:[1,0,0,1,0,0],primitives:[{kind:'rect',bounds:{x,y:0,width:100,height:80},paint:{fill:'#fff'}}],hitTargets:[{id,target:ref(id),bounds:{x,y:0,width:100,height:80}}],accessible:{role:'graphics-symbol',label:id},evidence:'current'}});
 const inputs=[node('low',0,14),node('high',200,58)],before=JSON.stringify(inputs),result=isometricGraph(inputs,{x:0,y:0,width:800,height:600},18);
 assert.equal(JSON.stringify(inputs),before);assert.deepEqual(result.map(n=>n.definition.ref.id).sort(),['high','low']);assert.ok(result.every(n=>n.item.primitives.length===3&&n.item.bounds.x>=24&&n.item.bounds.y>=60));assert.match(result.find(n=>n.definition.ref.id==='high').item.accessible.description,/depth 58/);assert.ok(result.every(n=>n.item.transform.every(Number.isFinite)));
});
test('isometric placement composes an existing native translation once',()=>{
 const ref={file:'main.ddn',id:'a'},view={ref:{file:'main.ddn',id:'v'}},bounds={x:300,y:200,width:100,height:80};const entry={definition:{ref,file:'main.ddn',record:{id:'a',category:'element'}},view,effective:{},item:{occurrence:'a',target:ref,view:view.ref,layer:'content',bounds,transform:[1,0,0,1,300,200],primitives:[{kind:'rect',bounds:{x:0,y:0,width:100,height:80},paint:{fill:'#fff'}}],hitTargets:[],accessible:{role:'graphics-symbol',label:'a'},evidence:'current'}};
 const result=isometricGraph([entry],{x:0,y:0,width:800,height:600},20)[0];assert.match(result.item.primitives[0].d,/^M100,0L120,20/);const m=result.item.transform;const corners=[[0,0],[100,0],[0,80],[100,80]].map(([x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]);assert.ok(corners.every(([x,y])=>x>=result.item.bounds.x-1e-8&&x<=result.item.bounds.x+result.item.bounds.width+1e-8&&y>=result.item.bounds.y-1e-8&&y<=result.item.bounds.y+result.item.bounds.height));
});
test('structured table data defaults to columns while an explicit title-only occurrence wins',()=>{
 const context={definition:{id:'table',data:{columns:[{id:'field'}],rows:[['identifier']]}}};const first=resolve({id:'occurrence'},'appearance',context);assert.equal(first.values.body,'columns');assert.equal(first.properties.find(p=>p.path==='body').origin,'standard:content');assert.equal(resolve({id:'occurrence',body:'title'},'appearance',context).values.body,'title');
});
