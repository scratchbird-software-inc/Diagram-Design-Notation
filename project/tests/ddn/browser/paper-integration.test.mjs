import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {dataProfileFixture} from './data-profile-fixtures.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),built=join(root,'.work/builds/ddn/ddn/packages');
const {resolve,resolveProperties}=await import(pathToFileURL(join(built,'defaults/src/index.js')));
const {createRuntime,createCompleteRuntimeOptions}=await import(pathToFileURL(join(built,'runtime/src/index.js')));
const {projectSnapshot}=await import(pathToFileURL(join(built,'presentation/src/index.js')));

test('paper colour is a contextual standard and explicit CSS/file colours retain priority',()=>{
 const context={profile:'ddn@1',role:'note'};
 assert.equal(resolve({role:'note',style:{paper:'note'}},'definition',context).values.background.color,'#fff59d');
 const styles=[{selector:{owner:'definition',profile:'ddn@1'},declarations:{'background.color':'#ffffff'}}];
 assert.equal(resolve({role:'note',style:{paper:'pad'}},'definition',{...context,styles}).values.background.color,'#ffffff');
 assert.equal(resolve({role:'note',style:{paper:'note'},background:{color:'transparent'}},'definition',{...context,styles}).values.background.color,'transparent');
 assert.equal(resolve({role:'note',style:{paper:'plain'}},'definition',context).values.background?.color,undefined);
 const appearance=resolve({id:'a'},'appearance',{...context,definition:{role:'note',style:{paper:'note'}}});
 assert.equal(appearance.values.background.color,'#fff59d');
});

test('expanded paper paint does not change routes, hit targets or isometric extrusion faces',async()=>{
 const source=`element Idea as note
    with
        paper pad
        shadow corners
        shadow.blur 10
        shadow.lift 25
        decorations
            item
                kind paper-clip
                position rt
                size 60
view Board as ddn@1
    with
        projection.options.iso true
    use Idea named Here
        with
            position.x 100
            position.y 100
            size.width 240
            size.height 150
`;
 const runtime=createRuntime(createCompleteRuntimeOptions());
 try{
  const opened=await runtime.open({entry:'main.ddn',files:[{id:'main.ddn',text:source,revision:'1',encoding:'utf-8',writable:true}]});assert.ok(opened.snapshot,JSON.stringify(opened.diagnostics));
  const render=snapshot=>projectSnapshot(snapshot,{resolve:(ref,context)=>resolveProperties(snapshot,ref,context)});
  const sourceBefore=runtime.sources().files[0].text,decorated=render(opened.snapshot),flat=structuredClone(opened.snapshot);
  const definition=flat.normalized.files[0].document.definitions.find(d=>d.name==='Idea');delete definition.style;delete definition.shadow;delete definition.decorations;
  const original=render(flat),node=decorated.entries.find(e=>e.definition.record.name==='Idea'),base=original.entries.find(e=>e.definition.record.name==='Idea');
  assert.deepEqual(node.item.primitives.slice(0,2),base.item.primitives.slice(0,2),'extrusion faces follow semantic dimensions');
  assert.equal(node.item.hitTargets[0].bounds.width,base.item.hitTargets[0].bounds.width);
  assert.ok(node.item.bounds.width>node.item.hitTargets[0].bounds.width);
  assert.equal(runtime.sources().files[0].text,sourceBefore);
 }finally{runtime.destroy();}
});

test('view paper decorates a chart frame without decorating individual quantitative marks',()=>{
 const fixture=dataProfileFixture('chart.basic@1');fixture.view.record.style={paper:'pad'};fixture.view.record.shadow={kind:'centre'};fixture.view.record.decorations=[{kind:'push-pin'}];
 const projected=projectSnapshot(fixture.snapshot,{resolve:(ref,context)=>resolveProperties(fixture.snapshot,ref,context)});
 const decorated=projected.entries.filter(e=>e.item.primitives.some(p=>p.paint?.['ddn-decoration']));
 assert.equal(projected.coverage.complete,true,JSON.stringify(projected.diagnostics));
 assert.equal(decorated.length,1);assert.equal(decorated[0].item.layer,'views');
});

test('canvas note appearances resolve their own paper colour and attachments',()=>{
 const fixture=dataProfileFixture('canvas.bmc@1'),note=fixture.document.definitions.find(d=>d.id==='idea');
 note.style={paper:'pad'};note.background={color:'#b7e8cf'};note.shadow={kind:'offset'};note.decorations=[{kind:'paper-clip',color:'#354b91',position:'rt'}];
 const projected=projectSnapshot(fixture.snapshot,{resolve:(ref,context)=>resolveProperties(fixture.snapshot,ref,context)}),notes=projected.entries.filter(e=>e.definition.ref.id==='idea');
 assert.ok(notes.length>1);
 for(const entry of notes){
  assert.ok(entry.item.primitives.some(p=>p.paint?.fill==='#b7e8cf'));
  assert.ok(entry.item.primitives.some(p=>p.paint?.['ddn-decoration']==='attachment'));
  assert.ok(entry.item.bounds.width>entry.item.hitTargets[0].bounds.width);
 }
 assert.equal(projected.entries.filter(e=>e.item.layer==='views').some(e=>e.item.primitives.some(p=>p.paint?.['ddn-decoration'])),false);
});

test('automatic view placement reserves incoming shadow overhang on both axes',async()=>{
 const source=`view First as ddn@1
view Second as ddn@1
    with
        shadow offset
        shadow.x -160
        shadow.blur 24
view Third as ddn@1
    with
        shadow offset
        shadow.y -160
        shadow.blur 24
`;
 const runtime=createRuntime(createCompleteRuntimeOptions());
 try{
  const opened=await runtime.open({entry:'main.ddn',files:[{id:'main.ddn',text:source,revision:'1',encoding:'utf-8',writable:true}]});assert.ok(opened.snapshot);
  const projected=projectSnapshot(opened.snapshot,{resolve:(ref,context)=>resolveProperties(opened.snapshot,ref,context)});
  const frame=name=>projected.entries.find(e=>e.definition.record.name===name).item.bounds;
  const first=frame('First'),second=frame('Second'),third=frame('Third');
  assert.equal(second.x-first.x-first.width,80);
  assert.equal(third.y-Math.max(first.y+first.height,second.y+second.height),80);
  const fixed=structuredClone(opened.snapshot),secondId=projected.entries.find(e=>e.definition.record.name==='Second').definition.ref.id;
  fixed.normalized.files[0].document.placements.find(p=>p.target.id===secondId).position={x:-400,y:-600};
  const fixedProjection=projectSnapshot(fixed,{resolve:(ref,context)=>resolveProperties(fixed,ref,context)}),body=fixedProjection.entries.find(e=>e.definition.ref.id===secondId).item.hitTargets[0].bounds;
  assert.equal(body.x,-400);assert.equal(body.y,-600);
  assert.equal(runtime.sources().files[0].text,source);
 }finally{runtime.destroy();}
});

test('paper does not enlarge panel header clips or allow headings into neighbouring panels',()=>{
 const fixture=dataProfileFixture('canvas.bmc@1');
 const render=()=>projectSnapshot(fixture.snapshot,{resolve:(ref,context)=>resolveProperties(fixture.snapshot,ref,context)});
 const original=render(),headers=original.entries.filter(e=>e.item.clip);
 assert.ok(headers.length>1);
 for(const entry of headers){entry.definition.record.style={paper:'note'};entry.definition.record.shadow={kind:'offset',x:6,y:8,blur:24};}
 const decorated=render();
 for(const header of headers){
  const next=decorated.entries.find(e=>e.item.occurrence===header.item.occurrence);
  assert.ok(next.item.primitives.some(p=>p.paint?.['ddn-decoration']==='shadow'));
  const body=next.item.hitTargets[0].bounds,prior=header.item.hitTargets[0].bounds;
  assert.deepEqual({...next.item.clip,x:next.item.clip.x-body.x,y:next.item.clip.y-body.y},{...header.item.clip,x:header.item.clip.x-prior.x,y:header.item.clip.y-prior.y});
 }
});

test('placed-view paper overrides inherit view styling and preserve CSS/file colour priority',async()=>{
 const runtime=createRuntime(createCompleteRuntimeOptions());
 try{
  const opened=await runtime.open({entry:'main.ddn',files:[{id:'main.ddn',text:'view Board as ddn@1\n    with\n        shadow centre\n        shadow.color "#314151"\n',revision:'1',encoding:'utf-8',writable:true}]});assert.ok(opened.snapshot);
  const snapshot=structuredClone(opened.snapshot),document=snapshot.normalized.files[0].document,placement=document.placements[0];
  const styles=[{selector:{owner:'view_definition',profile:'ddn@1'},declarations:{'style.paper':'note','background.color':'#ffffff'}}];
  const render=()=>projectSnapshot(snapshot,{resolve:(ref,context)=>resolveProperties(snapshot,ref,{...context,styles})}).entries.find(e=>e.item.layer==='views');
  assert.equal(render().effective.style.paper,'note');assert.equal(render().effective.background.color,'#ffffff');
  placement.style={paper:'pad'};placement.shadow={color:'#613f92'};placement.decorations=[{kind:'binder-clip',color:'#d22e5e'}];
  const placed=render();
  assert.equal(placed.effective.style.paper,'pad');assert.equal(placed.effective.shadow.kind,'centre');assert.equal(placed.effective.shadow.color,'#613f92');
  assert.equal(placed.effective.background.color,'#ffffff');
  assert.ok(placed.item.primitives.some(p=>p.paint?.fill==='#d22e5e'));
  placement.background={color:'transparent'};assert.equal(render().effective.background.color,'transparent');
  assert.equal(document.views[0].style,undefined);assert.equal(document.views[0].shadow.color,'#314151');
 }finally{runtime.destroy();}
});
