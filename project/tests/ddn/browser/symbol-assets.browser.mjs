import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const distribution=process.env.DDN_DDN_DISTRIBUTION??join(root,'.work/builds/ddn-distribution');
const tool=process.env.DDN_PLAYWRIGHT_ROOT??join(root,'.work/tools/browser/node_modules/playwright');
const {chromium}=await import(pathToFileURL(join(tool,'index.mjs')));
let browser,page;
const errors=[],network=[];
before(async()=>{
    browser=await chromium.launch({headless:true});page=await browser.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await page.route(/^https?:\/\//,route=>{network.push(route.request().url());return route.abort();});
    await page.goto(pathToFileURL(join(distribution,'complete/ddn-viewer.html')).href);
    await page.waitForFunction(()=>!!window.DDN?.createCompleteRuntimeOptions);
});
after(async()=>{await browser?.close();});

async function inspect({raster=false,declared=false,missing=false}={}) {
    return page.evaluate(async({raster,declared,missing})=>{
        const source=`asset Picture as resource from "local.${raster?'png':'svg'}"
    with
        media_type "image/${raster?'png':'svg+xml'}"
${declared?'        intrinsic_size\n            width 300\n            height 100\n':''}element Device as object
    with
        title "A deliberately long image caption"
        symbol.image Picture
        symbol.label bottom
view Board as ddn@1
    with
        id Board
    use Device named Here
        with
            size
                width 240
                height 240
`;
        let bytes,mime,reads=0;
        if(raster){const canvas=new OffscreenCanvas(240,120);const c=canvas.getContext('2d');c.fillStyle='#1d6f91';c.fillRect(0,0,240,120);const blob=await canvas.convertToBlob({type:'image/png'});bytes=new Uint8Array(await blob.arrayBuffer());mime='image/png';}
        else {bytes=new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120"><rect width="240" height="120" fill="#1d6f91"/></svg>');mime='image/svg+xml';}
        const host=document.createElement('main');host.style.cssText='position:fixed;inset:0';document.body.append(host);
        const runtime=DDN.createRuntime(DDN.createCompleteRuntimeOptions());
        const viewer=DDN.createViewer(host,{runtime,assets:{read:async()=>{reads++;if(missing)throw Error('Asset unavailable');return {bytes,mime,hash:'test-artwork'};}}});
        try{
            const open=await viewer.open({entry:'main.ddn',files:[{id:'main.ddn',text:source,revision:'1',encoding:'utf-8',writable:true}]});
            if(!open.snapshot)throw Error(JSON.stringify(open.diagnostics));
            const handle=DDN.getViewerHandle(viewer);await handle.whenRendered();
            const item=handle.scene().entries.find(e=>e.definition.record.name==='Device').item;
            const artwork=item.primitives.find(p=>p.kind==='image');
            const result=await viewer.capture({scope:{kind:'view',target:{file:'main.ddn',id:'Board'}},format:'svg',extent:'content',includePreview:false,partial:'reject',stale:'reject'});
            let capture;
            if(result.ok){const doc=new DOMParser().parseFromString(await result.artifacts[0].blob.text(),'image/svg+xml'),image=doc.querySelector('image');capture={width:Number(image.getAttribute('width')),height:Number(image.getAttribute('height')),href:image.getAttribute('href')};}
            const image=artwork?{...artwork.bounds,x:artwork.bounds.x+item.transform[4],y:artwork.bounds.y+item.transform[5]}:undefined;
            return {reads,body:item.hitTargets[0].bounds,paint:item.bounds,image,paths:item.primitives.filter(p=>p.kind==='path').length,text:item.primitives.filter(p=>p.kind==='text').flatMap(p=>p.runs.map(r=>r.text)),capture,ok:result.ok,reason:result.reason,diagnostics:handle.diagnostics()};
        }finally{viewer.destroy();runtime.destroy();host.remove();}
    },{raster,declared,missing});
}

test('SVG natural proportions govern symbol body and capture while caption remains outside',async()=>{
    const r=await inspect();assert.equal(r.ok,true,JSON.stringify(r.diagnostics));
    assert.equal(r.reads,1);assert.equal(r.image.width/r.image.height,2);assert.deepEqual(r.body,r.image);
    assert.ok(r.paint.height>r.body.height);assert.equal(r.paths,0);assert.deepEqual(r.text,['A deliberately long image caption']);
    assert.equal(r.capture.width/r.capture.height,2);assert.match(r.capture.href,/^data:image\/svg\+xml;base64,/);
});
test('raster natural proportions use the same symbol and export bounds',async()=>{
    const r=await inspect({raster:true});assert.equal(r.ok,true);assert.equal(r.reads,1);
    assert.equal(r.image.width/r.image.height,2);assert.deepEqual(r.body,r.image);assert.equal(r.capture.width/r.capture.height,2);
    assert.match(r.capture.href,/^data:image\/png;base64,/);
});
test('declared intrinsic size controls deterministic layout and missing image blocks complete export',async()=>{
    const declared=await inspect({declared:true});assert.equal(declared.ok,true);assert.equal(declared.image.width/declared.image.height,3);assert.equal(declared.capture.width/declared.capture.height,3);
    const missing=await inspect({missing:true});assert.equal(missing.ok,false);assert.equal(missing.reason,'incomplete');assert.ok(missing.diagnostics.some(d=>d.code==='asset-unavailable'));
    assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
});
