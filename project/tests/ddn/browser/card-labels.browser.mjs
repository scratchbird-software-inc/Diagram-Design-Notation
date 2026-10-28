import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const output=process.env.DDN_BUILD_ROOT??resolve(root,'.work/builds/ddn');
const load=name=>import(pathToFileURL(join(output,`ddn/packages/${name}/src/index.js`)));
const {createRuntime,createCompleteRuntimeOptions}=await load('runtime');
const {resolveProperties}=await load('defaults');
const {projectSnapshot}=await load('presentation');
const {chromium}=await import(pathToFileURL(join(process.env.DDN_PLAYWRIGHT_ROOT??join(root,'.work/tools/browser/node_modules/playwright'),'index.mjs')));
let browser;
before(async()=>{browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();});
async function node(source){
    const runtime=createRuntime(createCompleteRuntimeOptions());
    try{
        const opened=await runtime.open({entry:'main.ddn',files:[{id:'main.ddn',text:source,revision:'1',encoding:'utf-8',writable:true}]});
        assert.ok(opened.snapshot,JSON.stringify(opened.diagnostics));
        const scene=projectSnapshot(opened.snapshot,{resolve:(target,context)=>resolveProperties(opened.snapshot,target,context)});
        return scene.entries.find(entry=>entry.definition.record.name==='Company');
    }finally{runtime.destroy();}
}
async function measuredText(entry){
    const page=await browser.newPage();
    try{return await page.evaluate(entry=>{
        const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
        svg.setAttribute('width','2000');svg.setAttribute('height','2000');document.body.append(svg);
        return entry.item.primitives.flatMap(p=>p.kind==='text'?p.runs:[]).filter(run=>run.text).map(run=>{
            const text=document.createElementNS(ns,'text');text.textContent=run.text;text.setAttribute('x',run.x);text.setAttribute('y',run.y);text.setAttribute('font-family',run.fontKey==='monospace'?'monospace':'sans-serif');
            for(const [key,value]of Object.entries(run.style))text.setAttribute(key,value);svg.append(text);
            const b=text.getBBox();return{...run,box:{x:b.x,y:b.y,width:b.width,height:b.height}};
        });
    },entry);}finally{await page.close();}
}
const runsOfSize=(runs,size)=>runs.filter(run=>Math.abs(run.style['font-size']-size)<.01);
function separate(a,b){
    assert.ok(a.length&&b.length);
    for(const left of a)for(const right of b){const x=left.box,y=right.box;assert.ok(x.x+x.width<=y.x||y.x+y.width<=x.x||x.y+x.height<=y.y||y.y+y.height<=x.y,`Text overlaps: ${left.text} / ${right.text}`);}
}
for(const [width,height,size]of [[280,null,16],[180,160,16],[280,null,24],[180,64,16]]){
    test(`org card type and name occupy separate wrapped areas at ${width}×${height??'auto'}, font ${size}`,async()=>{
        const entry=await node(`element Company as organization\n    with\n        title "ScratchBird Convergent Data Engine"\nview Main as org.tree@1\n    use Company\n        with\n            ${height?'size.width':'text.max_width'} ${width}\n${height?`            size.height ${height}\n`:''}            style.font_size ${size}\n`);
        const runs=await measuredText(entry),type=runsOfSize(runs,9*size/16),title=runsOfSize(runs,15*size/16);
        assert.ok(type.length>1);assert.equal(type.map(r=>r.text).join('').replaceAll(' ',''),'ORGANIZATION/PARTY');
        assert.equal(title.map(r=>r.text).join('').replaceAll(' ',''),'ScratchBirdConvergentDataEngine');separate(type,title);
        if(!height)for(const run of runs)assert.ok(run.box.y+run.box.height<=entry.item.bounds.y+entry.item.bounds.height+1,'auto height includes all header text');
    });
}
test('native long type wraps beside its name and stays above the note body',async()=>{
    const entry=await node(`element Company as organization\n    with\n        title "ScratchBird Software Inc"\n        description "Body notes remain below both header columns."\nview Main as ddn@1\n    use Company\n        with\n            text.max_width 180\n`);
    const runs=await measuredText(entry),type=runsOfSize(runs,10.5),title=runsOfSize(runs,16),body=runs.filter(run=>Math.abs(run.style['font-size']-13.12)<.01);
    assert.ok(type.length>1);separate(type,title);separate(type,body);separate(title,body);
    assert.ok(Math.max(...type.concat(title).map(run=>run.box.y+run.box.height))<Math.min(...body.map(run=>run.box.y)));
});
test('typed UML name stays below the wrapped type and above its compartments',async()=>{
    const entry=await node(`element Attribute as field\n    with\n        title "public identifier"\nelement Company as uml.class\n    with\n        title "Corporate Accounting Service"\n        members\n            item Attribute\nview Main as uml.structure@2\n    use Company\n        with\n            size.width 150\n            size.height 260\n            style.font_size 24\n`);
    const runs=await measuredText(entry),type=runsOfSize(runs,16.5),title=runsOfSize(runs,22.5),body=runs.filter(run=>run.text.includes('identifier'));
    separate(type,title);separate(type,body);separate(title,body);
});
test('a fixed short typed card keeps its name below the type even when text must clip',async()=>{
    const entry=await node(`element Company as uml.class\n    with\n        title "Corporate Accounting Service"\nview Main as uml.structure@2\n    use Company\n        with\n            size.width 150\n            size.height 64\n            style.font_size 24\n`);
    const runs=await measuredText(entry);separate(runsOfSize(runs,16.5),runsOfSize(runs,22.5));
    assert.deepEqual(entry.item.clip,entry.item.bounds);
});
test('bare text retains its standalone presentation without a card type label',async()=>{
    const entry=await node(`element Company as organization\n    with\n        title "ScratchBird Software Inc"\n        symbol.mode text\nview Main as org.tree@1\n    use Company\n`);
    assert.equal(entry.standalone.mode,'text');
    const text=entry.item.primitives.flatMap(p=>p.kind==='text'?p.runs:[]).map(r=>r.text).join(' ');
    assert.doesNotMatch(text,/ORGANIZATION|PARTY/);assert.match(text,/ScratchBird Software Inc/);
});
