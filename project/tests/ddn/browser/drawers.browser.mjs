import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const distribution=process.env.DDN_DDN_DISTRIBUTION??resolve(root,'.work/builds/ddn-distribution');
const tool=process.env.DDN_PLAYWRIGHT_ROOT??resolve(root,'.work/tools/browser/node_modules/playwright');
const {chromium}=await import(pathToFileURL(join(tool,'index.mjs')));
let browser;
before(async()=>{browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();});
async function session(text='erd Studio\n    Customer\n    Order\n    connect Customer to Order\n'){
    const context=await browser.newContext({viewport:{width:1500,height:1050}}),page=await context.newPage(),errors=[];
    context.on('page',child=>child.on('pageerror',error=>errors.push(error.message)));page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(8000);
    await page.goto(pathToFileURL(join(distribution,'ddn-visual-designer.html')).href);await page.waitForFunction(()=>!!window.DDN?.createDesigner);
    await page.evaluate(async text=>{
        const host=document.createElement('main');host.id='drawer-fixture';host.style.cssText='position:fixed;inset:0;z-index:1000;background:white';document.body.append(host);
        const runtime=DDN.createRuntime(DDN.createNativeRuntimeOptions()),viewer=DDN.createViewer(host,{runtime});
        const result=await viewer.open({entry:'main.ddn',files:[{id:'main.ddn',text,revision:'one',encoding:'utf-8',writable:true}]});if(!result.snapshot)throw Error(JSON.stringify(result.diagnostics));
        const authority={authorize:async action=>({allowed:true,principal:'test',grants:[action]})},designer=DDN.createDesigner(viewer,{authority}),handle=DDN.getViewerHandle(viewer);
        window.fixture={host,runtime,viewer,designer,handle,authority};await viewer.navigate({kind:'fit-workarea'});await handle.whenRendered();
    },text);
    return {page,context,host:page.locator('#drawer-fixture'),async close(){await context.close();assert.deepEqual(errors,[]);}};
}
async function select(page,name){await page.evaluate(name=>{const item=fixture.handle.scene().entries.find(e=>e.definition.record.name===name&&e.definition.owner==='definition');fixture.handle.select(item.definition.ref,item.item.occurrence);},name);}
const text=page=>page.evaluate(()=>fixture.runtime.sources().files[0].text);

test('palette tabs group admitted catalog roles and search works across sections',async()=>{
    const s=await session();const {page,host}=s;
    try{
        await host.getByRole('button',{name:'Add element',exact:true}).click();const palette=host.getByRole('region',{name:'Element palette',exact:true});
        for(const name of ['SQL objects','System infrastructure','File types','Cluster objects'])assert.equal(await palette.getByRole('tab',{name,exact:true}).count(),1);
        await palette.getByRole('tab',{name:'SQL objects',exact:true}).click();assert.ok(await palette.locator('.ddn-palette-id').filter({hasText:/^table$/}).count());assert.equal(await palette.locator('.ddn-palette-id').filter({hasText:/^cluster$/}).count(),0);
        await palette.getByRole('tab',{name:'Cluster objects',exact:true}).click();assert.ok(await palette.locator('.ddn-palette-id').filter({hasText:/^cluster$/}).count());
        await palette.getByRole('searchbox').fill('table');assert.ok(await palette.locator('.ddn-palette-id').filter({hasText:/^table$/}).count());
        await palette.getByRole('button',{name:'Close the palette',exact:true}).click();await host.getByRole('button',{name:'Show Element palette',exact:true}).click();assert.equal(await palette.getByRole('searchbox').inputValue(),'table');
        await palette.getByRole('searchbox').fill('');await palette.getByRole('tab',{name:'SQL objects',exact:true}).focus();await page.keyboard.press('ArrowDown');assert.notEqual(await palette.getByRole('tab',{selected:true}).getAttribute('aria-label'),'SQL objects');
    }finally{await s.close();}
});

test('palette float, pop-out and dock retain state; separate window edits the same document',async()=>{
    const s=await session();const {page,host,context}=s;
    try{
        await host.getByRole('button',{name:'Add element',exact:true}).click();await host.getByRole('button',{name:'Float Element palette',exact:true}).click();
        const floating=page.locator('.ddn-float').filter({has:page.locator('[data-ddn-drawer=palette]')});await floating.waitFor();assert.equal(await host.locator('[data-ddn-dock-left]').count(),0);
        await floating.getByRole('searchbox').fill('note');const next=context.waitForEvent('page');await floating.getByRole('button',{name:'Pop out Element palette',exact:true}).click();const popup=await next;await popup.waitForLoadState();
        const palette=popup.locator('[data-ddn-drawer=palette]');assert.equal(await palette.getByRole('searchbox').inputValue(),'note');
        await palette.locator('button').filter({has:popup.locator('.ddn-palette-id').filter({hasText:/^note$/})}).dblclick();await host.getByRole('textbox',{name:'Element name',exact:true}).waitFor();await host.getByRole('textbox',{name:'Element name',exact:true}).press('Escape');assert.match(await text(page),/as "note"/);
        await palette.getByRole('button',{name:'Dock Element palette',exact:true}).click().catch(error=>{if(!popup.isClosed())throw error;});await page.waitForFunction(()=>document.querySelector('#drawer-fixture [data-ddn-drawer=palette]')?.dataset.ddnDrawerMode==='docked');assert.equal(popup.isClosed(),true);
    }finally{await s.close();}
});

test('closing a pop-out returns its drawer and a blocked pop-out floats locally',async()=>{
    const s=await session();const {page,host,context}=s;
    try{
        await host.getByRole('button',{name:'Add element',exact:true}).click();let next=context.waitForEvent('page');await host.getByRole('button',{name:'Pop out Element palette',exact:true}).click();let popup=await next;await popup.close();await host.locator('[data-ddn-drawer=palette][data-ddn-drawer-mode=docked]').waitFor();
        await page.evaluate(()=>{window.originalOpen=window.open;window.open=()=>null;});await host.getByRole('button',{name:'Pop out Element palette',exact:true}).click();await page.locator('.ddn-float [data-ddn-drawer=palette]').waitFor();assert.match(await host.locator('.ddn-viewer-status').innerText(),/blocked/);
        await page.locator('.ddn-float').getByRole('button',{name:'Close the palette',exact:true}).click();assert.equal(await page.locator('.ddn-float').count(),0);await host.getByRole('button',{name:'Show Element palette',exact:true}).click();
        await page.evaluate(()=>{window.open=window.originalOpen;});next=context.waitForEvent('page');await host.getByRole('button',{name:'Pop out Element palette',exact:true}).click();popup=await next;await page.evaluate(()=>fixture.designer.destroy());await page.waitForFunction(()=>!document.querySelector('#drawer-fixture [data-ddn-drawer=palette]'));assert.equal(popup.isClosed(),true);
    }finally{await s.close();}
});

test('inspector sliders update the diagram while focused, and undo restores the settings session',async()=>{
    const s=await session('element Customer as entity\nerd Studio\n    use Customer named Here\n        with\n            opacity 0.123456\n');const {page,host,context}=s;
    try{
        await select(page,'Customer');const before=await text(page);await host.getByRole('button',{name:'Properties',exact:true}).click();
        const inspector=host.getByRole('region',{name:'Inspector',exact:true});await inspector.getByRole('tab',{name:'Appearance',exact:true}).click();const size=inspector.getByRole('spinbutton',{name:'Font size (pt)',exact:true});
        await size.fill('21');await page.waitForFunction(()=>fixture.runtime.sources().files[0].text.includes('font_size 28'));assert.equal(await size.evaluate(input=>input===input.ownerDocument.activeElement),true);
        const opacity=inspector.getByRole('slider',{name:'Opacity (0–1) slider',exact:true});await opacity.fill('0.4');await page.waitForFunction(()=>fixture.runtime.sources().files[0].text.includes('opacity 0.4'));
        await host.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForFunction(before=>fixture.runtime.sources().files[0].text===before,before);
        const next=context.waitForEvent('page');await inspector.getByRole('button',{name:'Pop out Inspector',exact:true}).click();const popup=await next;const popped=popup.locator('[data-ddn-drawer=inspector]');await popped.getByRole('spinbutton',{name:'Font size (pt)',exact:true}).fill('18');await page.waitForFunction(()=>fixture.runtime.sources().files[0].text.includes('font_size 24'));
        await popped.getByRole('button',{name:'Close the inspector',exact:true}).click().catch(error=>{if(!popup.isClosed())throw error;});await host.getByRole('button',{name:'Show Inspector',exact:true}).waitFor();assert.equal(popup.isClosed(),true);
    }finally{await s.close();}
});

test('navigator tabs filter views and relations, and its drawer can reopen',async()=>{
    const s=await session();const {host}=s;
    try{
        const nav=host.getByRole('navigation',{name:'Semantic outline'});await nav.getByRole('tab',{name:'Connections',exact:true}).click();assert.equal(await nav.getByRole('tabpanel').getByRole('button').count(),1);
        await nav.getByRole('tab',{name:'Views',exact:true}).click();assert.equal(await nav.getByRole('tabpanel').getByRole('button').count(),1);
        await nav.getByRole('button',{name:'Close Navigator',exact:true}).click();await host.getByRole('button',{name:'Show Navigator',exact:true}).click();assert.equal(await nav.getByRole('tab',{name:'Views',selected:true}).count(),1);
    }finally{await s.close();}
});


test('profile-specific palettes do not offer unrelated catalog sections',async()=>{
    const s=await session('mindmap Plan\n    Research\n');
    try{await s.host.getByRole('button',{name:'Add element',exact:true}).click();const palette=s.host.locator('[data-ddn-drawer=palette]');assert.equal(await palette.getByRole('tab',{name:'SQL objects',exact:true}).count(),0);assert.equal(await palette.getByRole('tab',{name:'Cluster objects',exact:true}).count(),0);const roles=await palette.locator('.ddn-palette-id').allTextContents();assert.ok(roles.length>0);assert.ok(roles.every(role=>['entity','object','domain','term'].includes(role)));}
    finally{await s.close();}
});

test('standalone source and navigator expose panel controls and share Window menu state',async()=>{
    const s=await session();const {page,context}=s;
    try{
        await page.evaluate(()=>{fixture.designer.destroy();fixture.viewer.destroy();fixture.runtime.destroy();fixture.host.remove();});
        await page.locator('input[type=file]').setInputFiles({name:'source.ddn',mimeType:'text/plain',buffer:Buffer.from('erd SourceTest\n    Customer\n')});
        await page.waitForFunction(()=>document.querySelector('#ddn-source')?.value.includes('SourceTest'));
        const next=context.waitForEvent('page');await page.getByRole('button',{name:'Pop out source',exact:true}).click();const popup=await next;await popup.waitForLoadState();
        const editor=popup.getByRole('textbox',{name:'DDN source',exact:true});await editor.fill('erd ChangedFromOtherMonitor\n    Customer\n');await editor.press('Control+Enter');
        await page.waitForFunction(()=>document.querySelector('.ddn-viewer-stage')?.textContent.includes('ChangedFromOtherMonitor'));
        await popup.getByRole('button',{name:'Dock source',exact:true}).click().catch(error=>{if(!popup.isClosed())throw error;});
        assert.match(await page.locator('#ddn-source').inputValue(),/ChangedFromOtherMonitor/);
        await page.getByRole('button',{name:'Hide source',exact:true}).click();await page.getByRole('button',{name:'Show source',exact:true}).click();
        await page.getByRole('button',{name:'Float Navigator',exact:true}).click();await page.locator('.ddn-float [data-ddn-drawer=navigator]').waitFor();
        await page.getByRole('menubar').getByRole('menuitem',{name:'Window',exact:true}).click();await page.getByRole('menuitem',{name:'Dock all',exact:true}).click();await page.locator('.app-surface [data-ddn-drawer=navigator][data-ddn-drawer-mode=docked]').waitFor();
    }finally{await s.close();}
});


test('switching shared-element occurrences cancels pending edits to the previous appearance',async()=>{
    const s=await session('element Customer as entity\nerd FirstView\n    use Customer named First\nerd SecondView\n    use Customer named Second\n');const {page,host}=s;
    try{
        await page.evaluate(()=>{const item=fixture.handle.scene().entries.find(e=>e.appearance?.record.name==='First');fixture.handle.select(item.definition.ref,item.item.occurrence);});
        await host.getByRole('button',{name:'Properties',exact:true}).click();const inspector=host.locator('[data-ddn-drawer=inspector]');
        await page.evaluate(()=>{const original=fixture.authority.authorize;let first=true;fixture.authority.authorize=async(...args)=>{if(first){first=false;await new Promise(resolve=>{fixture.releaseEdit=resolve;});}return original(...args);};});
        await inspector.getByRole('spinbutton',{name:'Font size (pt)',exact:true}).fill('21');await page.waitForFunction(()=>!!fixture.releaseEdit);
        await page.evaluate(()=>{const item=fixture.handle.scene().entries.find(e=>e.appearance?.record.name==='Second');fixture.handle.select(item.definition.ref,item.item.occurrence);fixture.releaseEdit();});
        await inspector.getByRole('spinbutton',{name:'Font size (pt)',exact:true}).fill('18');await page.waitForFunction(()=>fixture.runtime.sources().files[0].text.includes('font_size 24'));
        const current=await text(page);assert.doesNotMatch(current,/font_size 28/);assert.match(current,/named Second[\s\S]*font_size 24/);assert.doesNotMatch(current.split('erd SecondView')[0],/font_size/);
    }finally{await s.close();}
});


test('independent embedded designers keep separate pop-out palettes and edit their own documents',async()=>{
    const s=await session('erd FirstBoard\n    Customer\n');const {page,context,host}=s;
    try{
        await host.getByRole('button',{name:'Add element',exact:true}).click();
        const firstOpened=context.waitForEvent('page');await host.getByRole('button',{name:'Pop out Element palette',exact:true}).click();const first=await firstOpened;
        await page.evaluate(async()=>{
            const host=document.createElement('main');host.id='second-drawer-fixture';host.style.cssText='position:fixed;inset:0;z-index:1001;background:white';document.body.append(host);
            const runtime=DDN.createRuntime(DDN.createNativeRuntimeOptions()),viewer=DDN.createViewer(host,{runtime});
            await viewer.open({entry:'second.ddn',files:[{id:'second.ddn',text:'erd SecondBoard\n    Order\n',revision:'one',encoding:'utf-8',writable:true}]});
            const designer=DDN.createDesigner(viewer,{authority:{authorize:async action=>({allowed:true,principal:'test',grants:[action]})}}),handle=DDN.getViewerHandle(viewer);
            window.secondFixture={host,runtime,viewer,designer,handle};await handle.whenRendered();
        });
        const secondHost=page.locator('#second-drawer-fixture');await secondHost.getByRole('button',{name:'Add element',exact:true}).click();
        const secondOpened=context.waitForEvent('page');await secondHost.getByRole('button',{name:'Pop out Element palette',exact:true}).click();const second=await secondOpened;
        assert.notEqual(first,second);assert.equal(first.isClosed(),false);assert.equal(second.isClosed(),false);
        for(const [popup,role] of [[first,'note'],[second,'table']]){
            const palette=popup.locator('[data-ddn-drawer=palette]');await palette.getByRole('searchbox').fill(role);
            await palette.locator('button').filter({has:popup.locator('.ddn-palette-id').filter({hasText:new RegExp('^'+role+'$')})}).dblclick();
        }
        await page.waitForFunction(()=>fixture.runtime.sources().files[0].text.includes('as "note"')&&secondFixture.runtime.sources().files[0].text.includes('as "table"'));
        assert.doesNotMatch(await text(page),/as "table"/);
        assert.doesNotMatch(await page.evaluate(()=>secondFixture.runtime.sources().files[0].text),/as "note"/);
        await first.close();assert.equal(second.isClosed(),false);await second.locator('[data-ddn-drawer=palette]').getByRole('searchbox').fill('entity');
        const secondClosed=second.waitForEvent('close');await page.evaluate(()=>{secondFixture.designer.destroy();secondFixture.viewer.destroy();secondFixture.runtime.destroy();secondFixture.host.remove();});await secondClosed;assert.equal(second.isClosed(),true);
    }finally{await s.close();}
});


test('an open palette window follows active views without opening another window',async()=>{
    const s=await session('erd Database\n    Customer\nmindmap Plan\n    Research\n');const {page,context,host}=s;
    try{
        await page.evaluate(async()=>{const view=fixture.handle.scene().views.find(v=>v.record.name==='Database');await fixture.viewer.navigate({kind:'fit-view',target:view.ref});});
        await host.getByRole('button',{name:'Add element',exact:true}).click();const next=context.waitForEvent('page');await host.getByRole('button',{name:'Pop out Element palette',exact:true}).click();const popup=await next;
        const palette=popup.locator('[data-ddn-drawer=palette]');assert.equal(await palette.getByRole('tab',{name:'SQL objects',exact:true}).count(),1);
        const originalPages=context.pages().length;
        await page.evaluate(async()=>{window.originalOpen=window.open;window.open=()=>{throw Error('View changes must not open windows');};const view=fixture.handle.scene().views.find(v=>v.record.name==='Plan');await fixture.viewer.navigate({kind:'fit-view',target:view.ref});await fixture.handle.whenRendered();});
        assert.equal(popup.isClosed(),false);assert.equal(context.pages().length,originalPages);
        await palette.getByRole('tab',{name:'Concepts & notes',exact:true}).waitFor();assert.equal(await palette.getByRole('tab',{name:'SQL objects',exact:true}).count(),0);
        await palette.getByRole('searchbox').fill('object');await palette.locator('button').filter({has:popup.locator('.ddn-palette-id').filter({hasText:/^object$/})}).dblclick();await page.waitForFunction(()=>fixture.runtime.sources().files[0].text.includes('as "object"'));
        assert.match(await text(page),/mindmap Plan[\s\S]*as "object"/);
        await page.evaluate(()=>{window.open=window.originalOpen;});
    }finally{await s.close();}
});


test('navigator tabs stack icons above intact labels at desktop and mobile widths',async()=>{
    const s=await session();const {page,host}=s;
    try{
        for(const width of [1440,390]){
            await page.setViewportSize({width,height:900});
            const dimensions=await host.getByRole('tab',{name:'Connections',exact:true}).evaluate(button=>{
                const style=getComputedStyle(button),icon=button.querySelector('svg').getBoundingClientRect(),label=button.querySelector('.ddn-side-tab-label'),box=label.getBoundingClientRect();
                return {display:style.display,direction:style.flexDirection,iconBottom:icon.bottom,labelTop:box.top,labelHeight:box.height,lineHeight:parseFloat(getComputedStyle(label).lineHeight),textWidth:label.scrollWidth,space:label.clientWidth};
            });
            assert.equal(dimensions.display,'flex');assert.equal(dimensions.direction,'column');assert.ok(dimensions.iconBottom<=dimensions.labelTop);assert.ok(dimensions.labelHeight<=dimensions.lineHeight+1);assert.ok(dimensions.textWidth<=dimensions.space);
        }
    }finally{await s.close();}
});
