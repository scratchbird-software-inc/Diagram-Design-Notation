import {chooseNewDocument, chooseViewLayout, fileAction, selectDiagramProfile} from './ux-test-helpers.mjs';
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const reports = join(root, '.work/reports/view-layouts');
const {chromium} = await import(pathToFileURL(join(root, '.work/tools/browser/node_modules/playwright/index.mjs')));
let browser;
before(async () => {await mkdir(reports, {recursive:true}); browser = await chromium.launch({headless:true});});
after(async () => {await browser?.close();});
async function session(width=1440, theme='dark') {
    const context=await browser.newContext({viewport:{width,height:1000}}), errors=[],network=[];
    await context.route(/^https?:\/\//, route=>{network.push(route.request().url());return route.abort();});
    const page=await context.newPage();page.setDefaultTimeout(10000);
    page.on('pageerror',error=>errors.push(error.stack));
    await page.goto(pathToFileURL(join(root,'website/tools/index.html')).href+'?mode=design&theme='+theme);
    await page.getByRole('button',{name:'New document…',exact:true}).waitFor();
    return {page,async close(){await context.close();assert.deepEqual(errors,[]);assert.deepEqual(network,[]);}};
}
const source=page=>page.locator('#ddn-source');
async function create(page,preset='dynamic',name='Sales') {
    await fileAction(page,'New diagram…',{replace:true});
    const type=await chooseNewDocument(page,{mode:'standalone',layout:preset});
    await selectDiagramProfile(type);
    await type.getByLabel('View name',{exact:true}).fill(name);
    await type.getByRole('button',{name:'Create view',exact:true}).click();
    await type.waitFor({state:'detached'});
    await page.evaluate(()=>DDN.getViewerHandle(DDN_SITE_STATE.viewer).whenRendered());
}
async function load(page,text) {
    await source(page).fill(text);await page.getByRole('button',{name:'Apply source',exact:true}).click();
    await page.waitForFunction(text=>DDN.getViewerHandle(DDN_SITE_STATE.viewer).runtime.sources().files[0].text===text,text);
    await page.evaluate(()=>DDN.getViewerHandle(DDN_SITE_STATE.viewer).whenRendered());
}
const dimensions=[['tv-hd',1280,720],['tv-fhd',1920,1080],['tv-2k',2048,1080],['tv-qhd',2560,1440],['tv-4k',3840,2160],['tv-8k',7680,4320]];

test('dashboard choices save compact source and reopen/capture at exact target dimensions',async()=>{
    const s=await session();const {page}=s;
    try{
        for(const [preset,width,height] of dimensions){
            await create(page,preset);
            const text=await source(page).inputValue();
            assert.match(text,new RegExp('surface.preset '+preset));
            assert.doesNotMatch(text,/surface.width|surface.height|style.font|background.color/);
            const result=await page.evaluate(async()=>{
                const {viewer}=DDN_SITE_STATE,h=DDN.getViewerHandle(viewer), frame=h.scene().entries.find(e=>e.definition.owner==='view');
                const saved=(await DDN_SITE_STATE.designer.save())[0];
                const capture=await viewer.capture({scope:{kind:'view',target:frame.definition.ref},format:'svg',extent:'content',includePreview:false,partial:'label',stale:'reject'});
                if(!capture.ok)throw Error(JSON.stringify(capture));
                const svg=new DOMParser().parseFromString(await capture.artifacts[0].blob.text(),'image/svg+xml').documentElement;
                return {bounds:frame.item.bounds,surface:frame.effective.surface,font:frame.effective.style.font_size,svg:svg.getAttribute('viewBox'),saved:await saved.blob.text()};
            });
            assert.equal(result.bounds.width,width);assert.equal(result.bounds.height,height);
            assert.equal(result.surface.scale,height/1080);assert.equal(result.font,24);
            const [, , w,h]=result.svg.split(/\s+/).map(Number);assert.equal(w,width);assert.equal(h,height);
            assert.equal(result.saved,text);
            await load(page,text+'    Customer\n');
            const reopened=await page.evaluate(()=>DDN.getViewerHandle(DDN_SITE_STATE.viewer).scene().entries.find(e=>e.definition.owner==='view').item.bounds);
            assert.equal(reopened.width,width);assert.equal(reopened.height,height);
        }
        await page.screenshot({path:join(reports,'8k-dashboard.png')});
    }finally{await s.close();}
});

test('dynamic stays compact, while added dashboard views keep their own surface settings',async()=>{
    const s=await session();const {page}=s;
    try{
        await fileAction(page,'New diagram…');
        const type=await chooseNewDocument(page);await selectDiagramProfile(type);
        await type.getByLabel('View name').fill('Dynamic');await type.getByRole('button',{name:'Create view',exact:true}).click();await type.waitFor({state:'detached'});
        assert.doesNotMatch(await source(page).inputValue(),/surface\./);
        await page.getByRole('button',{name:'Add view',exact:true}).click();await chooseViewLayout(page,'tv-fhd');
        const add=page.getByRole('dialog',{name:'Add view',exact:true});await selectDiagramProfile(add,'mindmap.basic@1');await add.getByLabel('Unique view name').fill('Dashboard');
        await add.getByRole('button',{name:'Apply',exact:true}).click();await add.waitFor({state:'detached'});
        const frames=await page.evaluate(()=>DDN.getViewerHandle(DDN_SITE_STATE.viewer).scene().entries.filter(e=>e.definition.owner==='view').map(e=>({name:e.definition.record.name,bounds:e.item.bounds,preset:e.effective.surface.preset})));
        assert.equal(frames.length,2);assert.equal(frames.find(f=>f.name==='Dynamic').preset,'dynamic');
        assert.equal(frames.find(f=>f.name==='Dashboard').bounds.width,1920);assert.equal(frames.find(f=>f.name==='Dashboard').bounds.height,1080);
    }finally{await s.close();}
});

test('scaled dashboards preserve logical coordinates during keyboard movement, drag and resize',async()=>{
    const s=await session();const {page}=s;
    try{
        await load(page,'workarea Board\n    with\n        mode standalone\nerd Sales\n    with\n        surface.preset tv-4k\n        surface.fit none\n        layout.algorithm manual\n    element Customer as entity\n        with\n            position.x 120\n            position.y 100\n            size.width 240\n            size.height 120\n            pinned true\n');
        const info=()=>page.evaluate(()=>{const h=DDN.getViewerHandle(DDN_SITE_STATE.viewer),e=h.scene().entries.find(e=>e.definition.record.name==='Customer');return {position:e.appearance.record.position,size:e.appearance.record.size,scale:e.surfaceTransform[0]};});
        const pick=()=>page.evaluate(()=>{const h=DDN.getViewerHandle(DDN_SITE_STATE.viewer),e=h.scene().entries.find(e=>e.definition.record.name==='Customer');h.select(e.definition.ref,e.item.occurrence);h.surface.focus();});
        await pick();await page.keyboard.press('ArrowRight');
        await page.waitForFunction(()=>DDN.getViewerHandle(DDN_SITE_STATE.viewer).scene().entries.find(e=>e.definition.record.name==='Customer').appearance.record.position.x===136);
        const before=await info();assert.equal(before.scale,2);
        const drag=async(dx,dy,resize=false)=>{
            const start=await page.evaluate(()=>{const h=DDN.getViewerHandle(DDN_SITE_STATE.viewer),e=h.scene().entries.find(e=>e.definition.record.name==='Customer'),b=e.item.hitTargets[0].bounds,m=h.surface.getScreenCTM();return {x:(b.x+b.width/2)*m.a+m.e,y:(b.y+b.height/2)*m.d+m.f,a:m.a,d:m.d,scale:e.surfaceTransform[0]};});
            if(resize)await page.keyboard.down('Alt');
            await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+dx*start.scale*start.a,start.y+dy*start.scale*start.d,{steps:5});await page.mouse.up();
            if(resize)await page.keyboard.up('Alt');
        };
        await drag(32,20);
        await page.waitForFunction(()=>Math.abs(DDN.getViewerHandle(DDN_SITE_STATE.viewer).scene().entries.find(e=>e.definition.record.name==='Customer').appearance.record.position.x-168)<1);
        const moved=await info();assert.ok(Math.abs(moved.position.y-120)<1);
        await drag(24,16,true);
        await page.waitForFunction(()=>Math.abs(DDN.getViewerHandle(DDN_SITE_STATE.viewer).scene().entries.find(e=>e.definition.record.name==='Customer').appearance.record.size.width-264)<1);
        const resized=await info();assert.ok(Math.abs(resized.size.height-136)<1);
        assert.equal(await page.evaluate(()=>DDN.getViewerHandle(DDN_SITE_STATE.viewer).scene().entries.find(e=>e.definition.owner==='view').item.bounds.width),3840);
    }finally{await s.close();}
});

for(const [width,theme] of [[1440,'dark'],[375,'light']])test(`layout previews and unavailable page/slide hints are accessible at ${width}px in ${theme}`,async()=>{
    const s=await session(width,theme);const {page}=s;
    try{
        await page.getByRole('button',{name:'New document…',exact:true}).click();
        const first=page.getByRole('dialog',{name:'New document',exact:true});await first.getByLabel('Workarea name').fill('Operations');await first.getByRole('button',{name:'Create Standalone View',exact:true}).click();
        const layout=page.getByRole('dialog',{name:'Choose view layout',exact:true});await layout.waitFor();
        assert.equal(await layout.locator('button[data-surface-preset]').count(),7);
        for(const name of ['Letter','Legal','A1','A2','A3','A4','A5','Custom page','Widescreen','Standard','Custom slide']){
            const tile=layout.getByRole('button',{name,exact:true});assert.equal(await tile.getAttribute('aria-disabled'),'true');
            await tile.focus();await layout.getByRole('tooltip').waitFor();
            assert.match(await layout.getByRole('tooltip').innerText(),/Weaver/);
            const hintBounds=await layout.getByRole('tooltip').boundingBox(), formBounds=await layout.boundingBox();
            assert.ok(hintBounds.y>=formBounds.y && hintBounds.y+hintBounds.height<=formBounds.y+formBounds.height);
            await tile.click({force:true});await tile.press('Enter');assert.equal(await layout.isVisible(),true);assert.equal(await source(page).inputValue(),'');
        }
        await layout.locator('button[data-surface-preset="tv-4k"]').click();
        await layout.getByRole('button',{name:'Continue',exact:true}).click();
        const type=page.getByRole('dialog',{name:'Choose diagram type',exact:true});await type.getByRole('button',{name:'Back',exact:true}).click();
        assert.equal(await layout.locator('button[data-surface-preset="tv-4k"]').getAttribute('aria-pressed'),'true');
        const bounds=await layout.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+.5);assert.ok(bounds.y>=0&&bounds.y+bounds.height<=1000+.5);
        await layout.locator('button[data-surface-preset="tv-4k"]').focus();
        await page.screenshot({path:join(reports,`layout-chooser-${width}-${theme}.png`)});
        await layout.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await source(page).inputValue(),'');
    }finally{await s.close();}
});
