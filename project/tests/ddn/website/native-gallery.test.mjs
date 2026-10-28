import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const output=process.env.DDN_BUILD_ROOT??resolve('.work/builds/ddn');
const load=(name,file='index')=>import(pathToFileURL(resolve(output,`ddn/packages/${name}/src/${file}.js`)));
const {graphLayout}=await load('presentation','graph-layouts');
const {projectSnapshot}=await load('presentation');
const {createRuntime,createCompleteRuntimeOptions}=await load('runtime');
const {resolveProperties}=await load('defaults');
async function project(source,run){const runtime=createRuntime(createCompleteRuntimeOptions());try{const opened=await runtime.open({entry:'main.ddn',files:[{id:'main.ddn',text:source,revision:'1',encoding:'utf-8',writable:true}]});assert.ok(opened.snapshot,JSON.stringify(opened.diagnostics));const scene=projectSnapshot(opened.snapshot,{resolve:(target,context)=>resolveProperties(opened.snapshot,target,context)});assert.equal(scene.coverage.complete,true,JSON.stringify(scene.diagnostics));return run(scene);}finally{runtime.destroy();}}
const nodes=Array.from({length:8},(_,i)=>({id:String(i),bounds:{x:0,y:0,width:240,height:80},group:i<4?'one':'two'}));
const links=[{from:'0',to:'1'},{from:'0',to:'2'},{from:'1',to:'3'},{from:'2',to:'4'},{from:'4',to:'5'},{from:'2',to:'6'},{from:'6',to:'7'}];
test('all authored layout algorithms are deterministic and preserve pins and identity',()=>{
 const signatures=new Set();
 for(const algorithm of ['grid','manual','layered','tree','mindmap','grouped','ladder','fit_grid','circular','radial','spanning_tree','organic']){
  const settings={algorithm,gap:90,row_gap:70,columns:3,width:1600,height:600};
  const result=graphLayout(nodes,links,settings);assert.equal(result.size,8);assert.deepEqual(result,graphLayout(nodes,links,settings));assert.ok([...result.values()].every(bounds=>Object.values(bounds).every(Number.isFinite)));
  signatures.add(JSON.stringify([...result]));const pinned=[{...nodes[0],pinned:true,bounds:{x:221,y:179,width:240,height:80}},...nodes.slice(1)];assert.deepEqual(graphLayout(pinned,links,settings).get('0'),pinned[0].bounds);
 }
 assert.ok(signatures.size>=9,'automatic layout families must make materially different placements');
 const tight=graphLayout(nodes,links,{algorithm:'grid',gap:10}),loose=graphLayout(nodes,links,{algorithm:'grid',gap:200});assert.ok(loose.get('1').x>tight.get('1').x);
});
test('native DDN retains its table text while applying authored layout and round routing',async()=>{
 const source=`element Customer as entity
    data
        field.type
        customer_id.integer
        name.text
element Order as entity
view Main as ddn@1
    with
        layout.algorithm layered
        layout.routing curved
        layout.curve rounded
    use Customer
        with
            body columns
    use Order
        with
            position
                x 600
                y 280
    connect Customer to Order as assoc named Places : places
`;
 await project(source,scene=>{const customer=scene.entries.find(e=>e.definition.record.name==='Customer'),order=scene.entries.find(e=>e.definition.record.name==='Order'),edge=scene.entries.find(e=>e.definition.record.name==='Places');assert.ok(order.item.bounds.x>customer.item.bounds.x);const labels=customer.item.primitives.flatMap(p=>p.kind==='text'?p.runs.map(r=>r.text):[]);assert.ok(labels.includes('customer_id'));assert.ok(edge.item.primitives.some(p=>p.kind==='path'&&p.d.includes('Q')));assert.equal(customer.item.hitTargets[0].bounds.x,customer.item.bounds.x);});
});
test('native routing uses explicit occurrence sides and waypoints and excludes hidden relations',async()=>{
 const source=`element A as object
element B as object
relation Flow as assoc
    with
        endpoints
            item
                definition A
            item
                definition B
relation Hidden as assoc
    with
        endpoints
            item
                definition A
            item
                definition B
view Main as ddn@1
    with
        selection.exclude
            item Hidden
    use A named Left
        with
            position
                x 20
                y 60
    use B named Right
        with
            position
                x 600
                y 260
    use Flow named Route
        with
            route.source_side east
            route.target_side west
            route.via
                item
                    x 480
                    y 130
`;
 await project(source,scene=>{const edge=scene.entries.find(e=>e.definition.record.name==='Flow');assert.ok(edge.item.primitives.some(p=>p.kind==='path'&&/480,130/.test(p.d)));assert.ok(!scene.entries.some(e=>e.definition.record.name==='Hidden'));});
});
test('native inline view uses the new projection and retains nested target identity',async()=>{
 const source=`view Child as ddn@1
    element Inner as object
view Main as ddn@1
    element Embedded as object
        with
            metadata.x_subdiagram
                view Child
                display inline
`;
 await project(source,scene=>{const child=scene.entries.find(e=>e.definition.record.name==='Inner'&&e.item.occurrence.includes(':inline:'));assert.ok(child);assert.ok(child.item.clip);assert.ok(child.item.transform[0]>0);});
});
test('native domain columns display reusable domain titles without rewriting raw table values',async()=>{
 const {tableData,records}=await load('presentation','model');
 const source=`element ReusableDomain as domain\n    with\n        title "Customer identifier"\nelement Customer as entity\n    data\n        field.domain\n        customer_id.ReusableDomain\nview Main as ddn@1\n    use Customer\n        with\n            body columns\n            column_visibility.domain shown\n`;
 const runtime=createRuntime(createCompleteRuntimeOptions());try{const opened=await runtime.open({entry:'main.ddn',files:[{id:'main.ddn',text:source,revision:'1',encoding:'utf-8',writable:true}]});assert.ok(opened.snapshot,JSON.stringify(opened.diagnostics));const all=records(opened.snapshot),customer=all.find(r=>r.record.name==='Customer'),domain=all.find(r=>r.record.name==='ReusableDomain');assert.equal(tableData(opened.snapshot,customer).rows[0][1],'Customer identifier');const input=structuredClone(opened.snapshot),copy=records(input).find(r=>r.record.name==='Customer');copy.record.data.rows[0][1]=domain.ref;assert.equal(tableData(input,copy).rows[0][1],'Customer identifier');assert.deepEqual(copy.record.data.rows[0][1],domain.ref,'presentation must not replace the semantic reference');copy.record.data.columns[1].id='details';assert.deepEqual(tableData(input,copy).rows[0][1],domain.ref,'ordinary JSON cells remain data');}finally{runtime.destroy();}
});
test('automatic view frames reserve measured content width and row height while explicit placements stay fixed',async()=>{
 const source=['element A as object','element B as object','element C as object',...['Overview','Compact','Third','Fourth'].map(name=>`view ${name} as ddn@1\n`+['A','B','C'].map(id=>`    use ${id}\n        with\n            size.width 500\n            size.height 800\n`).join(''))].join('\n');
 const runtime=createRuntime(createCompleteRuntimeOptions());try{
  const opened=await runtime.open({entry:'main.ddn',files:[{id:'main.ddn',text:source,revision:'1',encoding:'utf-8',writable:true}]});assert.ok(opened.snapshot,JSON.stringify(opened.diagnostics));
  const render=snapshot=>projectSnapshot(snapshot,{resolve:(target,context)=>resolveProperties(snapshot,target,context)});
  const scene=render(opened.snapshot),frames=Object.fromEntries(scene.entries.filter(entry=>entry.item.layer==='views').map(entry=>[entry.view.record.name,entry.item.bounds]));
  assert.ok(frames.Overview.width>1040);assert.ok(frames.Overview.height>760);
  assert.equal(frames.Compact.x,frames.Overview.x+frames.Overview.width+80);
  assert.equal(frames.Third.y,Math.max(frames.Overview.y+frames.Overview.height,frames.Compact.y+frames.Compact.height)+80);
  assert.equal(frames.Fourth.x,frames.Third.x+frames.Third.width+80);
  const values=Object.values(frames);for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++){const a=values[i],b=values[j];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,'automatic frames must not overlap');}
  const copy=structuredClone(opened.snapshot),doc=copy.normalized.files[0].document,view=doc.views.find(view=>view.name==='Compact'),placement=doc.placements.find(placement=>placement.target.id===view.id);placement.position={x:5500,y:4300};
  const explicit=render(copy).entries.find(entry=>entry.item.layer==='views'&&entry.view.record.name==='Compact');assert.equal(explicit.item.bounds.x,5500);assert.equal(explicit.item.bounds.y,4300);
 }finally{runtime.destroy();}
});
test('automatic workarea spacing also reserves expanded data projection bounds',async()=>{
 const {dataProfileFixture}=await import('../browser/data-profile-fixtures.mjs');const fixture=dataProfileFixture('chart.histogram@1');Object.assign(fixture.view.record.projection.options,{width:1500,height:900});
 fixture.document.views.push({...structuredClone(fixture.view.record),id:'density',name:'Density',profile:'chart.density@1'});
 const scene=projectSnapshot(fixture.snapshot,{resolve:(target,context)=>resolveProperties(fixture.snapshot,target,context)}),histogram=scene.entries.find(entry=>entry.item.layer==='views'&&entry.view.ref.id==='view'),density=scene.entries.find(entry=>entry.item.layer==='views'&&entry.view.ref.id==='density');
 assert.equal(scene.coverage.complete,true,JSON.stringify(scene.diagnostics));assert.ok(histogram.item.bounds.width>1040);assert.equal(density.item.bounds.x,histogram.item.bounds.x+histogram.item.bounds.width+80);
});
