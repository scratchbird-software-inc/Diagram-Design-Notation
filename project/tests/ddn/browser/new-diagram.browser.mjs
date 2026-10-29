import {chooseViewLayout, chooseNewDocument, fileAction, paletteElement, inlineName, selectDiagramProfile, diagramMethodIds, diagramProfileIds} from './ux-test-helpers.mjs';
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const distribution = process.env.DDN_DDN_DISTRIBUTION ?? join(root, '.work/builds/ddn-distribution');
const reports = join(root, '.work/reports/ddn-new-diagram');
const {chromium} = await import(pathToFileURL(join(process.env.DDN_PLAYWRIGHT_ROOT ?? join(root, '.work/tools/browser/node_modules/playwright'), 'index.mjs')));
let browser;
before(async () => {await mkdir(reports, {recursive: true}); browser = await chromium.launch({headless: true});});
after(async () => {await browser?.close();});

async function session(edition = 'native', mode = 'designer') {
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}, acceptDownloads: true});
    const network = [], errors = [];
    await context.route(/^https?:\/\//, route => {network.push(route.request().url()); return route.abort();});
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.stack));
    const file = edition === 'website' ? join(process.env.DDN_DDN_SITE_ROOT ?? join(root, 'website'), 'tools/index.html')
        : edition === 'modular' ? join(distribution, 'modular', mode + '.html')
        : join(distribution, edition === 'complete' ? 'complete' : '', 'ddn-' + (mode === 'designer' ? 'visual-designer' : mode) + '.html');
    await page.goto(pathToFileURL(file).href + (edition === 'website' ? '?mode=design' : ''));
    await page.locator('.app-status').filter({hasText: mode === 'verifier' ? /^Verification / : /ready/}).waitFor();
    return {page, async close() {await context.close(); assert.deepEqual(errors, []); assert.deepEqual(network, []);}};
}
const source = page => page.getByRole('textbox', {name: 'DDN source', exact: true});
async function start(page) {
    await fileAction(page, 'New diagram…', {replace: true});
    const dialog = await chooseNewDocument(page);
    await dialog.waitFor();
    assert.equal(await source(page).inputValue(), '');
    assert.equal(await page.getByLabel('Current view', {exact: true}).locator('option').count(), 0);
    assert.equal(await page.locator('.ddn-viewer-stage [data-ref]').count(), 0);
    return dialog;
}
async function create(dialog, name, profile = 'ddn@1', method = 'MT01') {
    await selectDiagramProfile(dialog, profile, method);
    await dialog.getByLabel('View name', {exact: true}).fill(name);
    await dialog.getByRole('button', {name: 'Create view', exact: true}).click();
    await dialog.waitFor({state: 'detached'});
}
async function addFromPalette(page, role, name) {
    await paletteElement(page, page, role, name);
    assert.ok((await source(page).inputValue()).includes(name));
}

test('native New clears edits and history; Cancel stays empty; a new ERD is immediately editable', async () => {
    const s = await session(); const {page} = s;
    try {
        await create(await start(page), 'Old design');
        await addFromPalette(page, 'entity', 'OldCustomer');
        await source(page).fill('unapplied invalid source');
        let dialog = await start(page);
        assert.deepEqual((await diagramProfileIds(dialog)).sort(), ['ddn@1', 'mindmap.basic@1', 'concept.map@1', 'table.records@1'].sort());
        await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
        await page.getByRole('button', {name: 'Undo', exact: true}).click();
        await page.getByRole('button', {name: 'Reload source', exact: true}).click();
        assert.equal(await source(page).inputValue(), '');
        dialog = await start(page);
        await selectDiagramProfile(dialog);
        await dialog.getByLabel('View name').fill('');
        await dialog.getByRole('button', {name: 'Create view', exact: true}).click();
        await dialog.getByText('Enter a view name.', {exact: true}).waitFor();
        await create(dialog, 'Fresh sales');
        assert.equal(await source(page).inputValue(), 'workarea "Untitled"\nerd "Fresh sales"\n');
        await addFromPalette(page, 'entity', 'NewCustomer');
        assert.doesNotMatch(await source(page).inputValue(), /OldCustomer|unapplied|Order/);
        await page.locator('.ddn-viewer-stage [data-ref][aria-label="NewCustomer"]').waitFor();
        await page.getByRole('button', {name: 'Undo', exact: true}).click();
        await page.waitForFunction(() => !document.querySelector('#ddn-source').value.includes('NewCustomer'));
        assert.match(await source(page).inputValue(), /position/);
        await page.getByRole('button', {name: 'Undo', exact: true}).click();
        await page.waitForFunction(() => document.querySelector('#ddn-source').value === 'workarea "Untitled"\nerd "Fresh sales"\n');
        await page.getByRole('button', {name: 'Redo', exact: true}).click();
        await page.waitForFunction(() => document.querySelector('#ddn-source').value.includes('position'));
        await page.getByRole('button', {name: 'Redo', exact: true}).click();
        await page.waitForFunction(() => document.querySelector('#ddn-source').value.includes('NewCustomer'));
    } finally {await s.close();}
});

for (const edition of ['complete', 'modular']) test(`${edition} New offers all 153 profiles, creates UML and a fresh mind map`, async () => {
    const s = await session(edition); const {page} = s;
    try {
        let dialog = await start(page);
        const methods = await diagramMethodIds(dialog);
        const profiles = [];
        for (const method of methods) {
            profiles.push(...await diagramProfileIds(dialog, method));
        }
        assert.equal(profiles.length, 153); assert.equal(new Set(profiles).size, 153);
        if (edition === 'modular') assert.equal(await page.evaluate(() => DDN_LOADER.describe().loadedEntries.includes('verify:graphs-uml')), false);
        await create(dialog, 'ClassDesign', 'uml.structure@2', 'MT02');
        assert.equal(await source(page).inputValue(), 'workarea "Untitled"\nview "ClassDesign" as "uml.structure@2"\n');
        await addFromPalette(page, 'uml.class', 'CustomerClass');
        if (edition === 'modular') assert.equal(await page.evaluate(() => DDN_LOADER.describe().loadedEntries.includes('verify:graphs-uml')), true);
        dialog = await start(page);
        await create(dialog, 'Ideas', 'mindmap.basic@1');
        assert.equal(await source(page).inputValue(), 'workarea "Untitled"\nmindmap "Ideas"\n');
        await page.locator('.ddn-viewer-stage [data-ref][aria-label="Ideas"]').dblclick();
        await inlineName(page, 'Next release');
        assert.match(await source(page).inputValue(), /Next release/);
        assert.doesNotMatch(await source(page).inputValue(), /CustomerClass|ClassDesign/);
        assert.equal(await page.locator('.ddn-viewer').count(), 1);
    } finally {await s.close();}
});

test('website New discards supplied files/assets and updates the live designer session', async () => {
    const s = await session('website'); const {page} = s;
    try {
        await page.locator('input[type=file]').setInputFiles([
            {name: 'old.ddn', mimeType: 'text/plain', buffer: Buffer.from('erd OldSales\n    Customer\n')},
            {name: 'extra.ddn', mimeType: 'text/plain', buffer: Buffer.from('erd Extra\n    Other\n')},
            {name: 'old.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')},
        ]);
        await page.waitForFunction(() => document.querySelector('#ddn-source')?.value.includes('OldSales') && document.querySelector('.app-status')?.textContent.includes('ready'));
        await page.evaluate(() => {window.previousDesigner = DDN_SITE_STATE.designer;});
        await source(page).fill('unsaved old data');
        const dialog = await start(page);
        const state = await page.evaluate(() => ({changed: DDN_SITE_STATE.designer !== previousDesigner, sources: DDN.getViewerHandle(DDN_SITE_STATE.viewer).runtime.sources()}));
        assert.equal(state.changed, true);
        assert.equal(state.sources.entry, 'main.ddn');
        assert.deepEqual(state.sources.files.map(f => [f.id, f.text]), [['main.ddn', '']]);
        await page.screenshot({path: join(reports, 'new-diagram-picker.png')});
        await create(dialog, 'Workspace');
        await fileAction(page, 'Download assets');
        await page.locator('.app-toast').filter({hasText: 'no separately supplied assets'}).waitFor();
        await addFromPalette(page, 'entity', 'FirstEntity');
        await page.screenshot({path: join(reports, 'new-diagram-created.png')});
        const saved = await page.evaluate(async () => Promise.all((await DDN_SITE_STATE.designer.save()).map(async artifact => [artifact.name, await artifact.blob.text()])));
        assert.equal(saved.length, 1); assert.equal(saved[0][0], 'main.ddn'); assert.match(saved[0][1], /FirstEntity/);
        assert.doesNotMatch(saved[0][1], /OldSales|Customer|Extra|unsaved/);
    } finally {await s.close();}
});

test('New invalidates pending source application and delayed file success or failure', async () => {
    const s = await session(); const {page} = s;
    try {
        await source(page).fill('erd Obsolete\n    WrongEntity\n');
        await page.evaluate(() => {
            [...document.querySelectorAll('.app-source-toolbar button')].find(button => button.textContent === 'Apply source').click();
            document.dispatchEvent(new CustomEvent('ddn:new-document'));
        });
        const confirmation = page.getByRole('dialog', {name: 'Replace your unsaved changes?', exact: true});
        await confirmation.getByRole('button', {name: 'Replace', exact: true}).click();
        await confirmation.waitFor({state: 'detached'});
        let dialog = await chooseNewDocument(page);
        assert.equal(await source(page).inputValue(), '');
        await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
        for (const fail of [false, true]) {
            const dirty = await page.locator('html').getAttribute('data-ddn-dirty') === 'true';
            await page.evaluate(() => {
                window.finishOldRead = undefined;
                const file = new File(['erd Late\n    OldEntity\n'], 'late.ddn');
                file.arrayBuffer = () => new Promise((resolve, reject) => {window.finishOldRead = fail => fail ? reject(Error('obsolete read failed')) : resolve(new TextEncoder().encode('erd Late\n    OldEntity\n').buffer);});
                const transfer = new DataTransfer(); transfer.items.add(file);
                document.querySelector('.app-surface').dispatchEvent(new DragEvent('drop', {dataTransfer: transfer, bubbles: true, cancelable: true}));
            });
            if (dirty) {
                const confirmation = page.getByRole('dialog', {name: 'Replace your unsaved changes?', exact: true});
                await confirmation.getByRole('button', {name: 'Replace', exact: true}).click();
                await confirmation.waitFor({state: 'detached'});
            }
            await page.waitForFunction(() => typeof window.finishOldRead === 'function');
            dialog = await start(page);
            await page.evaluate(async fail => {finishOldRead(fail); await new Promise(resolve => setTimeout(resolve, 30));}, fail);
            assert.equal(await source(page).inputValue(), '');
            assert.doesNotMatch(await page.locator('.app-status').innerText(), /Files loaded|failed|obsolete/);
            await create(dialog, fail ? 'AfterFailure' : 'AfterRead');
        }
        assert.equal(await source(page).inputValue(), 'workarea "Untitled"\nerd "AfterFailure"\n');
    } finally {await s.close();}
});

test('empty data-dependent diagrams can be created and their setup controls opened', async () => {
    const s = await session('modular'); const {page} = s;
    try {
        for (const profile of ['chart.basic@1', 'fishbone.basic@1']) {
            const dialog = await start(page); await create(dialog, 'Draft', profile);
            assert.equal(await source(page).inputValue(), 'workarea "Untitled"\nview "Draft" as "' + profile + '"\n');
            await page.getByRole('button', {name: 'Projection', exact: true}).click();
            const settings = page.getByRole('dialog'); await settings.waitFor();
            await settings.getByRole('button', {name: 'Close', exact: true}).click();
        }
    } finally {await s.close();}
});

test('viewer and verifier do not expose New or diagram creation forms', async () => {
    for (const mode of ['viewer', 'verifier']) {
        const s = await session('modular', mode);
        try {await s.page.getByRole('menubar').getByRole('menuitem', {name: 'File', exact: true}).click(); assert.equal(await s.page.getByRole('menuitem', {name: 'New diagram…', exact: true}).count(), 0);}
        finally {await s.close();}
    }
});

test('workarea wizard keeps its name, explains disabled options and retains multi-view editing', async () => {
    const s = await session('website'); const {page} = s;
    try {
        await page.getByRole('button', {name: 'New document…', exact: true}).click();
        const initial = page.getByRole('dialog', {name: 'New document', exact: true});
        await initial.getByLabel('Workarea name').fill('Product planning');
        await initial.getByRole('button', {name: 'Create WorkArea', exact: true}).click();
        const setup = page.getByRole('dialog', {name: 'Create WorkArea', exact: true});
        assert.equal(await setup.getByLabel('Workarea name').inputValue(), 'Product planning');
        for (const [label, hint] of [['Settings', 'change defaults for the workarea or load a saved template'], ['Permissions', 'setup user permissions for sharing and concurrent editing']]) {
            assert.equal(await setup.getByRole('button', {name: label, exact: true}).isDisabled(), true);
            const option = setup.getByRole('group', {name: label + ' — unavailable in the open-source designer', exact: true});
            await option.hover(); await setup.getByRole('tooltip').filter({hasText: hint}).waitFor();
            await option.focus(); assert.equal(await setup.getByRole('tooltip').filter({hasText: hint}).isVisible(), true);
        }
        await page.screenshot({path: join(reports, 'create-workarea.png')});
        await setup.getByRole('button', {name: 'Apply', exact: true}).click();
        await chooseViewLayout(page);
        const chooser = page.getByRole('dialog', {name: 'Choose diagram type', exact: true});
        await selectDiagramProfile(chooser);
        await chooser.getByLabel('View name').fill('Product planning');
        await chooser.getByRole('button', {name: 'Create view', exact: true}).click();
        await chooser.getByText('The view and workarea must have different names.', {exact: true}).waitFor();
        await create(chooser, 'Sales');
        assert.equal(await source(page).inputValue(), 'workarea "Product planning"\nerd "Sales"\n');
        assert.equal(await page.locator('.ddn-viewer').getAttribute('data-ddn-document-mode'), 'workarea');
        await page.getByRole('button', {name: 'Add view', exact: true}).click();
        await chooseViewLayout(page);
        const add = page.getByRole('dialog', {name: 'Add view', exact: true});
        await selectDiagramProfile(add, 'mindmap.basic@1');
        await add.getByLabel('Unique view name').fill('Ideas');
        await add.getByRole('button', {name: 'Apply', exact: true}).click();
        await add.waitFor({state: 'detached'});
        assert.equal(await page.getByLabel('Current view', {exact: true}).locator('option').count(), 2);
    } finally {await s.close();}
});

test('standalone view persists, hides meta-workarea controls and constrains all navigation', async () => {
    const s = await session('website'); const {page} = s;
    try {
        await fileAction(page, 'New diagram…');
        const chooser = await chooseNewDocument(page, {mode: 'standalone', name: 'One diagram'});
        assert.equal(await page.getByRole('dialog', {name: 'Create WorkArea', exact: true}).count(), 0);
        await create(chooser, 'Sales');
        assert.equal(await source(page).inputValue(), 'workarea "One diagram"\n    with\n        mode standalone\nerd "Sales"\n');
        await addFromPalette(page, 'entity', 'Customer');
        assert.equal(await page.locator('.ddn-viewer').getAttribute('data-ddn-document-mode'), 'standalone');
        for (const name of ['Fit workarea', 'Expand view', 'Workarea', 'Add view']) assert.equal(await page.getByRole('button', {name, exact: true}).isVisible(), false);
        assert.equal(await page.getByLabel('Current view', {exact: true}).isVisible(), false);
        for (const [top, absent] of [['WorkArea', ['Workarea settings…', 'Add view…', 'Add document view…']], ['View', ['Fit workarea', 'Expand view', 'Mini-views when small']], ['Document', ['New document view…']]]) {
            await page.getByRole('menubar').getByRole('menuitem', {name: top, exact: true}).click();
            for (const name of absent) assert.equal(await page.getByRole('menuitem', {name, exact: true}).count(), 0);
            await page.keyboard.press('Escape');
        }
        const evidence = await page.evaluate(async () => {
            const {viewer} = DDN_SITE_STATE, h = DDN.getViewerHandle(viewer);
            const states = [];
            for (const request of [{kind:'fit-workarea'}, {kind:'restore'}, {kind:'back'}, {kind:'forward'}]) {
                await viewer.navigate(request);
                states.push({camera:h.viewport(), bounds:h.scene().bounds, expanded:h.expanded(), view:h.scene().views[0].ref});
            }
            for (const zoom of [4, .001]) {
                viewer.setViewport({bounds:{x:999999,y:-999999,width:50000,height:50000},zoom});
                states.push({camera:h.viewport(), bounds:h.scene().bounds, expanded:h.expanded(), view:h.scene().views[0].ref});
            }
            return states;
        });
        for (const {camera, bounds, expanded, view} of evidence) {
            assert.deepEqual(camera.activeView, view); assert.deepEqual(expanded, view);
            assert.ok(camera.bounds.x >= bounds.x - .01 && camera.bounds.y >= bounds.y - .01);
            assert.ok(camera.bounds.x + camera.bounds.width / camera.zoom <= bounds.x + bounds.width + .01);
            assert.ok(camera.bounds.y + camera.bounds.height / camera.zoom <= bounds.y + bounds.height + .01);
        }
        const saved = await page.evaluate(async () => {window.beforeReopen = DDN_SITE_STATE.viewer; return (await DDN_SITE_STATE.designer.save())[0].blob.text();});
        await page.locator('input[type=file]').setInputFiles({name:'solo.ddn', mimeType:'text/plain', buffer:Buffer.from(saved)});
        await page.waitForFunction(() => DDN_SITE_STATE.viewer !== beforeReopen);
        assert.equal(await page.evaluate(() => DDN.getViewerHandle(DDN_SITE_STATE.viewer).runtime.sources().entry), 'solo.ddn');
        assert.equal(await page.locator('.ddn-viewer').getAttribute('data-ddn-document-mode'), 'standalone');
        await page.locator('.ddn-viewer-stage [data-ref][aria-label="Customer"]').waitFor();
        await page.screenshot({path: join(reports, 'standalone-view.png')});
    } finally {await s.close();}
});

test('standalone extent grows and shrinks with the view and rejects a second view', async () => {
    const s = await session('website'); const {page} = s;
    try {
        const load = async text => {
            await source(page).fill(text); await page.getByRole('button', {name:'Apply source',exact:true}).click();
            await page.waitForFunction(text => DDN.getViewerHandle(DDN_SITE_STATE.viewer).runtime.sources().files[0].text === text, text);
            await page.evaluate(() => DDN.getViewerHandle(DDN_SITE_STATE.viewer).whenRendered());
        };
        const basic = 'workarea Solo\n    with\n        mode standalone\nelement Customer as entity\nerd Sales\n    use Customer\n';
        await load(basic);
        const size = () => page.evaluate(() => ({bounds:DDN.getViewerHandle(DDN_SITE_STATE.viewer).scene().bounds, camera:DDN.getViewerHandle(DDN_SITE_STATE.viewer).viewport()}));
        const small = await size();
        await load(basic + '    use Order\n        with\n            position.x 2200\n            position.y 1200\n            pinned true\nelement Order as entity\n');
        const large = await size();
        assert.ok(large.bounds.width > small.bounds.width && large.bounds.height > small.bounds.height);
        await load(basic); const shrunk = await size();
        assert.deepEqual(shrunk.bounds, small.bounds);
        assert.ok(shrunk.camera.bounds.width / shrunk.camera.zoom <= shrunk.bounds.width + .01);
        await source(page).fill(basic + 'erd Forbidden\n    Hidden\n');
        await page.getByRole('button', {name:'Apply source',exact:true}).click();
        await page.locator('.app-status.app-error').waitFor();
        assert.equal(await page.locator('.ddn-viewer-stage [aria-label="Hidden"]').count(), 0);
        assert.equal(await page.getByLabel('Current view', {exact:true}).locator('option').count(), 1);
        assert.match(await page.locator('.app-status').innerText(), /standalone workarea can contain only one view or document/);
    } finally {await s.close();}
});

test('blank canvas creation entry points all begin with the workarea choice', async () => {
    const s = await session('website'); const {page} = s;
    try {
        for (const label of ['Add view', 'Add element', 'New document…']) {
            await page.getByRole('button', {name:label, exact:true}).click();
            const first = page.getByRole('dialog', {name:'New document', exact:true});
            await first.waitFor();
            assert.equal(await first.getByRole('button', {name:'Create WorkArea', exact:true}).count(), 1);
            assert.equal(await first.getByRole('button', {name:'Create Standalone View', exact:true}).count(), 1);
            await first.getByRole('button', {name:'Cancel', exact:true}).click();
            assert.equal(await source(page).inputValue(), '');
        }
    } finally {await s.close();}
});
