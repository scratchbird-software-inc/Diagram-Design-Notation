import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sourceSet,profileSource} from '../profiles/fixtures.mjs';
const output=process.env.DDN_BUILD_ROOT??resolve('.work/builds/ddn');
const load=(name,file='index.js')=>import(pathToFileURL(resolve(output,`ddn/packages/${name}/src/${file}`)));
const {createRuntime,createCompleteRuntimeOptions}=await load('runtime');
const {resolveProperties}=await load('defaults');
const {projectSnapshot,records,refKey}=await load('presentation');
const language=await load('language');
const measure=(value,size)=>value.length*size*.58;
const presets=[[1280,720],[1920,1080],[2048,1080],[2560,1440],[3840,2160],[7680,4320]];
async function fixture(profile='ddn@1',text) {
 const runtime=createRuntime(createCompleteRuntimeOptions()); const opened=await runtime.open(sourceSet(text??profileSource(profile,language)));
 const snapshot=runtime.snapshot(); runtime.destroy(); assert.ok(snapshot,JSON.stringify(opened.diagnostics)); return snapshot;
}
function render(snapshot,surface,options={}) {
 const views=records(snapshot).filter(record=>record.owner==='view');
 const resolve=(target,context)=>{
  const result=resolveProperties(snapshot,target,context);
  return views.some(view=>refKey(view.ref)===refKey(target))&&surface
   ? {...result,values:{...result.values,surface,...(surface.width?{chrome:{banner:false,footer:false,title:true},style:{...result.values.style,font_size:24},background:{color:'#ffffff'}}:{})}}
   : result;
 };
 return projectSnapshot(snapshot,{resolve,measure,...options});
}
const frame=result=>result.entries.find(entry=>entry.definition.owner==='view');
const inside=(a,b)=>a.x>=b.x-.001&&a.y>=b.y-.001&&a.x+a.width<=b.x+b.width+.001&&a.y+a.height<=b.y+b.height+.001;

test('every TV size has exact fixed bounds for graph, table, chart and fishbone profiles',async()=>{
 for(const profile of ['ddn@1','mindmap.basic@1','table.records@1','org.tree@1','chart.basic@1','fishbone.basic@1']){
  const snapshot=await fixture(profile);
  for(const [width,height] of presets){
   const result=render(snapshot,{width,height,scale:height/1080,padding:32,fit:'contain'}), outer=frame(result).item.bounds;
   assert.equal(outer.width,width,profile);assert.equal(outer.height,height,profile);assert.deepEqual(result.bounds,outer,profile);
   for(const entry of result.entries){assert.ok(inside(entry.item.bounds,outer),profile+':'+entry.item.accessible.label);for(const hit of entry.item.hitTargets)assert.ok(inside(hit.bounds,outer));}
   assert.ok(!result.diagnostics.some(item=>item.code==='surface-overflow'),profile);
  }
 }
});

test('TV content uses consistent relative sizes across HD, Full HD, 4K and 8K',async()=>{
 const snapshot=await fixture('ddn@1');
 const results=presets.filter(([width])=>[1280,1920,3840,7680].includes(width)).map(([width,height])=>render(snapshot,{width,height,scale:height/1080,padding:32,fit:'contain'}));
 const normalized=result=>result.entries.filter(entry=>entry.definition.owner!=='view').map(entry=>({id:entry.item.occurrence,bounds:Object.fromEntries(Object.entries(entry.item.bounds).map(([key,value])=>[key,Math.round(value/(result.bounds.height/1080)*1000)/1000]))}));
 for(const result of results.slice(1)) assert.deepEqual(normalized(result),normalized(results[0]));
});

test('contain fits remote pinned geometry and relations; none clips without expanding the surface',async()=>{
 const text='element First as entity\nelement Second as entity\nconnect First to Second as assoc named Link\nerd Sales\n    with\n        layout.algorithm manual\n    use First\n        with\n            position.x -400\n            position.y -200\n            pinned true\n    use Second\n        with\n            position.x 4000\n            position.y 2400\n            pinned true\n    use Link\n';
 const snapshot=await fixture('ddn@1',text), base={width:1920,height:1080,scale:1,padding:32};
 const contain=render(snapshot,{...base,fit:'contain'});
 assert.equal(contain.bounds.width,1920);assert.equal(contain.bounds.height,1080);
 for(const entry of contain.entries) assert.ok(inside(entry.item.bounds,contain.bounds));
 assert.ok(frame(contain).surfaceTransform[0]<1);
 assert.ok(contain.entries.some(entry=>entry.definition.record.name==='Second'&&entry.item.hitTargets.length));
 const clipped=render(snapshot,{...base,fit:'none'});
 assert.equal(clipped.bounds.width,1920);assert.equal(clipped.bounds.height,1080);
 assert.ok(clipped.diagnostics.some(item=>item.code==='surface-overflow'));
 const second=clipped.entries.find(entry=>entry.definition.record.name==='Second');
 assert.equal(second.item.hitTargets.length,0);assert.equal(second.item.bounds.width,0);
 assert.equal(second.item.clip.width,1856);
});

test('fixed-view transform is composable and invertible for source coordinates, images and hit bounds',async()=>{
 const snapshot=await fixture('ddn@1','element Customer as entity\nerd Sales\n    with\n        layout.algorithm manual\n    use Customer\n        with\n            position.x 300\n            position.y 180\n            pinned true\n');
 const dynamic=render(snapshot), fixed=render(snapshot,{width:3840,height:2160,scale:2,padding:32,fit:'contain'});
 const a=dynamic.entries.find(entry=>entry.definition.record.name==='Customer'),b=fixed.entries.find(entry=>entry.definition.record.name==='Customer'),m=b.surfaceTransform;
 assert.equal(m[0],2);assert.equal(m[3],2);
 const ah=a.item.hitTargets[0].bounds,bh=b.item.hitTargets[0].bounds;
 assert.ok(Math.abs((bh.x-m[4])/m[0]-ah.x)<.001);assert.ok(Math.abs((bh.y-m[5])/m[3]-ah.y)<.001);
 assert.equal(b.item.transform[0],a.item.transform[0]*2);assert.equal(b.item.transform[4],a.item.transform[4]*2+m[4]);
 assert.deepEqual(frame(fixed).surfaceTransform,m);
});

test('dynamic layouts are unchanged and multiple fixed views reserve their physical extents',async()=>{
 const snapshot=await fixture('ddn@1','erd First\n    Customer\nerd Second\n    Order\n');
 const normal=render(snapshot),dynamic=render(snapshot,{preset:'dynamic',width:null,height:null,scale:1});
 assert.deepEqual(normal.items,dynamic.items);
 const nullSurface=render(snapshot,{width:null,height:null,scale:1,padding:32,fit:'contain'});
 assert.deepEqual(dynamic.items,nullSurface.items);
 assert.ok(normal.items.length>2);
 const fixed=render(snapshot,{width:3840,height:2160,scale:2,padding:32,fit:'contain'});
 const frames=fixed.entries.filter(entry=>entry.definition.owner==='view').sort((a,b)=>a.item.bounds.x-b.item.bounds.x);
 assert.deepEqual(frames.map(entry=>entry.item.bounds.width),[3840,3840]);
 assert.equal(frames[1].item.bounds.x,frames[0].item.bounds.x+3840+80);
 for(const entry of fixed.entries) assert.ok(inside(entry.item.bounds,frames.find(f=>refKey(f.view.ref)===refKey(entry.view.ref)).item.bounds));
});

test('fixed surfaces contain frame decoration, legend text and standalone image transforms',async()=>{
 const text='asset Image as resource from computer.svg\n    with\n        media_type "image/svg+xml"\nelement Computer as object\n    with\n        symbol.mode image\n        symbol.image Image\n        symbol.label none\nelement Note as note\n    with\n        style.paper note\nconnect Computer to Note as assoc named Connection\nerd Dashboard\n    with\n        legend.mode numbers\n        shadow.kind offset\n        shadow.lift 50\n        style.paper pad\n    use Computer\n    use Note\n    use Connection\n';
 const snapshot=await fixture('ddn@1',text), surface={width:3840,height:2160,scale:2,padding:32,fit:'contain'};
 const result=render(snapshot,surface),outer=frame(result);
 assert.deepEqual(result.bounds,{x:0,y:0,width:3840,height:2160});
 assert.deepEqual(outer.item.clip,outer.item.bounds);
 assert.ok(outer.item.primitives.some(p=>p.kind==='text'&&p.runs.some(run=>run.text==='RELATIONSHIP KEY')));
 const image=result.entries.find(entry=>entry.definition.record.name==='Computer'),primitive=image.item.primitives.find(p=>p.kind==='image'),m=image.item.transform;
 assert.ok(primitive);assert.ok(image.surfaceTransform[0]>0);
 const painted={x:primitive.bounds.x*m[0]+m[4],y:primitive.bounds.y*m[3]+m[5],width:primitive.bounds.width*m[0],height:primitive.bounds.height*m[3]};
 assert.ok(inside(painted,image.item.bounds));
 for(const entry of result.entries)assert.ok(inside(entry.item.bounds,outer.item.bounds));
});
