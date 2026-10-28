import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {convertGraph} from '../../../../tooling/website/migrate-graphs.mjs';
const output=process.env.DDN_BUILD_ROOT??resolve('.work/builds/ddn');
const load=name=>import(pathToFileURL(resolve(output,`ddn/packages/${name}/src/index.js`)));
const {createRuntime,createCompleteRuntimeOptions}=await load('runtime');
const {resolveProperties}=await load('defaults');
const {projectSnapshot,publicationScene}=await load('presentation');
const labels=item=>item.primitives.flatMap(p=>p.kind==='text'?p.runs.map(r=>r.text):[]);
async function scene(source){const runtime=createRuntime(createCompleteRuntimeOptions());try{const opened=await runtime.open({entry:'main.ddn',files:[{id:'main.ddn',text:source,revision:'1',encoding:'utf-8',writable:true}]});assert.ok(opened.snapshot,JSON.stringify(opened.diagnostics));return projectSnapshot(opened.snapshot,{resolve:(target,context)=>resolveProperties(opened.snapshot,target,context)});}finally{runtime.destroy();}}

test('native descriptions are visible by default and explicit title-only occurrences remain compact',async()=>{
 const s=await scene(`element Topic as object
    with
        description "A proposal that still needs a decision."
view Main as mindmap.basic@1
    use Topic named Detail
    use Topic named Compact
        with
            body title
`);
 const detail=s.entries.find(e=>e.appearance?.record.name==='Detail'),compact=s.entries.find(e=>e.appearance?.record.name==='Compact');
 assert.match(labels(detail.item).join(' '),/proposal that still needs/);assert.doesNotMatch(labels(compact.item).join(' '),/proposal/);assert.ok(detail.item.bounds.height>compact.item.bounds.height);
});

test('description remains visible beneath native fields, with keys and nested presence markers',async()=>{
 const s=await scene(`element Address as field
    with
        title address
        content.parent Record
element Street as field
    with
        title street
        content.parent Address
        content.nullable true
element Id as field
    with
        title id
        content.key primary
element Record as document
    with
        description "Postal destination supplied by the customer."
        members
            item Id
            item Address
            item Street
view Main as ddn@1
    use Record
`);
 const item=s.entries.find(e=>e.definition.record.name==='Record').item,text=labels(item).join(' ');
 assert.match(text,/Postal destination/);assert.match(text,/⚿ id/);assert.match(text,/↳ street \?/);
});

test('native handdrawn and actor presentation survive view defaults without erasing file overrides',async()=>{
 const s=await scene(`element Person as uml.actor
element Process as flow.process
element Topic as object
    with
        background.color "#123456"
view Main as ddn@1
    with
        style.look handdrawn
    use Person
    use Topic
    use Process
`);
 const actor=s.entries.find(e=>e.definition.record.name==='Person').item,topic=s.entries.find(e=>e.definition.record.name==='Topic').item;
 assert.ok(actor.primitives.some(p=>p.kind==='ellipse'&&p.bounds.width===24));assert.ok(topic.primitives.some(p=>p.kind==='path'&&p.paint.fill==='#123456'));assert.ok(topic.primitives.filter(p=>'paint'in p&&p.paint.opacity===.1).length>5);
 const process=s.entries.find(e=>e.definition.record.name==='Process').item;
 assert.ok(process.primitives.filter(p=>'paint'in p&&p.paint.opacity===.1).length>5);
});

test('manual native positions retain relative geometry below visible view chrome',async()=>{
 const s=await scene(`element A as object
element B as object
view Main as ddn@1
    with
        layout.algorithm manual
    use A
        with
            position.x 0
            position.y 0
    use B
        with
            position.x 350
            position.y 180
`);
 const a=s.entries.find(e=>e.definition.record.name==='A').item,b=s.entries.find(e=>e.definition.record.name==='B').item;
 assert.ok(a.bounds.y>=64);assert.equal(b.bounds.x-a.bounds.x,350);assert.equal(b.bounds.y-a.bounds.y,180);
 assert.ok(a.transform[5]>0);assert.equal(a.hitTargets[0].bounds.y,a.bounds.y);
});

test('migration only creates occurrences for selected items, keeps order, and retains sticky bodies',()=>{
 const converted=convertGraph({resolved:{view:{id:'v',local:'v',name:'v',selected:['B','A'],relations:[],profiles:{projection:{kind:'graph',profile:'ddn@1'}}},elements:[{id:'A',name:'A',kind:'table',fields:[{id:'f',name:'f',properties:{}}],properties:{}},{id:'B',name:'B',kind:'note.sticky',properties:{description:'Discuss this proposal.',x_sticky:{colour:'pink',pin:true}}},{id:'Hidden',name:'Hidden',kind:'table',fields:[{id:'h',name:'h',properties:{}}],properties:{}}],relations:[]}});
 assert.deepEqual(converted.appearances.map(a=>a.target.id),['B','A']);assert.equal(converted.definitions.find(d=>d.id==='B').draft.text,'Discuss this proposal.');assert.equal(converted.appearances[0].decorations[0].kind,'push-pin');
});

test('publication composition fits A4 with physical margins and substitutes header/footer tokens',()=>{
 const item={occurrence:'a',target:{file:'a',id:'x'},view:{file:'a',id:'v'},layer:'content',bounds:{x:20,y:30,width:1000,height:500},transform:[1,0,0,1,0,0],primitives:[{kind:'text',runs:[{text:'Content',x:30,y:50,fontKey:'sans',style:{'font-size':16}}]}],hitTargets:[],accessible:{role:'graphics-object',label:'Content'},evidence:'current'};
 const publication={file:'a',ref:{file:'a',id:'p'},owner:'publication',record:{page:{size:'a4',margin:{left:40,right:40,top:40,bottom:40}},header:{runs:{left:{text:'$title'},right:{text:'$date'}}},footer:{runs:{right:{text:'Page $page of $pages'}}}}};
 const result=publicationScene([item],item.bounds,publication,'Design','2026-10-23');
 assert.ok(Math.abs(result.bounds.width-793.7)<.01);assert.ok(result.items[1].transform[0]<1);assert.ok(result.items[1].clip);assert.match(labels(result.items[0]).join(' '),/Design 2026-10-23 Page 1 of 1/);
});

test('bounded text fitting marks residual overflow and retains clipping after layout',async()=>{
 const s=await scene(`element Note as note
    with
        title "This deliberately long note cannot fit in its small declared box without an overflow indication."
view Main as ddn@1
    use Note
        with
            text.fit wrap
            text.max_width 160
            text.max_height 64
            text.weight 800
            text.italic true
`);
 const e=s.entries.find(e=>e.definition.record.name==='Note');assert.equal(e.item.bounds.width,160);assert.equal(e.item.bounds.height,64);assert.deepEqual(e.item.clip,e.item.bounds);assert.match(labels(e.item).join(' '),/…/);assert.ok(s.diagnostics.some(d=>d.code==='text-overflow'));assert.ok(e.item.primitives.some(p=>p.kind==='text'&&p.runs.some(r=>r.style['font-style']==='italic'&&r.style['font-weight']===800)));
});
