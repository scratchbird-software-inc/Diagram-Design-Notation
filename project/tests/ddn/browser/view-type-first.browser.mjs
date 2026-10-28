import {chooseViewLayout, chooseNewDocument, chooseDiagramMethod, selectDiagramProfile, diagramMethodIds, diagramProfileIds} from './ux-test-helpers.mjs';
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const site = process.env.DDN_DDN_SITE_ROOT ?? join(root, 'website');
const distribution = process.env.DDN_DDN_DISTRIBUTION ?? join(root, '.work/builds/ddn-distribution');
const reports = join(root, '.work/reports/ddn-visual-picker');
const {chromium} = await import(pathToFileURL(join(process.env.DDN_PLAYWRIGHT_ROOT ?? join(root, '.work/tools/browser/node_modules/playwright'), 'index.mjs')));
let browser;
before(async () => {await mkdir(reports, {recursive: true}); browser = await chromium.launch({headless: true});});
after(async () => {await browser?.close();});

async function session(edition = 'website', {width = 1440, height = 1000, theme = 'dark'} = {}) {
    const context = await browser.newContext({viewport: {width, height}});
    const errors = [], network = [];
    await context.route(/^https?:\/\//, route => {network.push(route.request().url()); return route.abort();});
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    const file = edition === 'website' ? join(site, 'tools/index.html') : join(distribution, 'ddn-visual-designer.html');
    await page.goto(pathToFileURL(file).href + (edition === 'website' ? '?mode=design&theme=' + theme : '?theme=' + theme));
    await page.getByRole('button', {name: 'New document…', exact: true}).waitFor();
    return {page, async close() {await context.close(); assert.deepEqual(errors, []); assert.deepEqual(network, []);}};
}
const source = page => page.getByRole('textbox', {name: 'DDN source', exact: true});
const palette = page => page.getByRole('region', {name: 'Element palette', exact: true});
const roles = page => palette(page).locator('.ddn-palette-id').allTextContents();
async function choose(page) {
    if (await page.getByRole('button', {name: 'New document…', exact: true}).isVisible()) {
        await page.getByRole('button', {name: 'New document…', exact: true}).click();
        return chooseNewDocument(page);
    }
    await page.getByRole('button', {name: 'Choose diagram type…', exact: true}).click();
    await page.getByRole('dialog',{name:'Choose view layout',exact:true}).or(page.getByRole('dialog',{name:'Choose diagram type',exact:true})).waitFor();
    if (await page.getByRole('dialog', {name: 'Choose view layout', exact: true}).isVisible()) await chooseViewLayout(page);
    const dialog = page.getByRole('dialog', {name: 'Choose diagram type', exact: true});
    await dialog.waitFor(); return dialog;
}
async function create(page, profile, name, method = 'MT01') {
    const dialog = await choose(page);
    await selectDiagramProfile(dialog, profile, method);
    await dialog.getByLabel('View name', {exact: true}).fill(name);
    await dialog.getByRole('button', {name: 'Create view', exact: true}).click();
    await dialog.waitFor({state: 'detached'}); await palette(page).waitFor();
}
async function load(page, text) {
    await source(page).fill(text);
    await page.getByRole('button', {name: 'Apply source', exact: true}).click();
    await page.waitForFunction(text => DDN.getViewerHandle(DDN_SITE_STATE.viewer).runtime.sources().files[0].text === text, text);
    await page.evaluate(() => DDN.getViewerHandle(DDN_SITE_STATE.viewer).whenRendered());
}
async function view(page, name) {
    return page.evaluate(name => {
        const handle = DDN.getViewerHandle(DDN_SITE_STATE.viewer);
        const record = handle.scene().views.find(view => view.record.name === name);
        return record && {ref: record.ref, record: record.record};
    }, name);
}

test('blank startup asks for diagram type; Cancel leaves source and workarea empty', async () => {
    const s = await session(); const {page} = s;
    try {
        assert.equal(await source(page).inputValue(), '');
        const hint = page.locator('.ddn-viewer-hint');
        assert.match(await hint.textContent(), /Create a workarea or a standalone view\./);
        assert.deepEqual(await hint.getByRole('button').allTextContents(), ['New document…']);
        assert.equal(await palette(page).count(), 0);
        assert.equal(await page.locator('.ddn-viewer-stage [data-ref]').count(), 0);
        const dialog = await choose(page);
        assert.equal(await dialog.locator('select').count(), 0);
        assert.equal(await dialog.getByRole('button', {name: 'Create view', exact: true}).isDisabled(), true);
        assert.equal(await dialog.getByLabel('View name', {exact: true}).isVisible(), false);
        assert.equal(await dialog.getByRole('group', {name: 'Diagram types', exact: true}).isVisible(), false);
        const methods = dialog.getByRole('group', {name: 'Diagram methods', exact: true});
        assert.equal(await methods.locator('button[data-method]').count(), 21);
        assert.equal(await methods.locator('button[data-method] svg[aria-hidden=true]').count(), 21);
        await page.screenshot({path: join(reports, 'method-grid.png')});
        await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
        assert.equal(await source(page).inputValue(), '');
        assert.equal(await page.locator('.ddn-viewer-stage [data-ref]').count(), 0);
        await page.screenshot({path: join(reports, 'blank-type-first.png')});
    } finally {await s.close();}
});

test('native chooser exposes four supported profiles and creates an immediately usable ERD palette', async () => {
    const s = await session('native'); const {page} = s;
    try {
        const dialog = await choose(page);
        assert.deepEqual(await diagramMethodIds(dialog), ['MT01']);
        assert.deepEqual((await diagramProfileIds(dialog)).sort(), ['ddn@1', 'mindmap.basic@1', 'concept.map@1', 'table.records@1'].sort());
        await selectDiagramProfile(dialog);
        await dialog.getByLabel('View name', {exact: true}).fill('Sales');
        await dialog.getByRole('button', {name: 'Create view', exact: true}).click();
        await dialog.waitFor({state: 'detached'}); await palette(page).waitFor();
        assert.ok((await roles(page)).includes('entity'));
        assert.ok(!(await roles(page)).includes('uml.class'));
        assert.doesNotMatch(await source(page).inputValue(), /layout\.|style\.|background\./);
        await page.getByRole('button', {name: 'Undo', exact: true}).click();
        await page.getByRole('button', {name: 'New document…', exact: true}).waitFor();
        assert.equal(await palette(page).count(), 0);
        await page.getByRole('button', {name: 'Redo', exact: true}).click();
        await page.getByRole('button', {name: 'Add element', exact: true}).click();
        await palette(page).waitFor();
        const entity = palette(page).locator('button').filter({has: page.locator('.ddn-palette-id', {hasText: /^entity$/})});
        await entity.dblclick();
        const name = page.getByRole('textbox', {name: 'Element name', exact: true}); await name.fill('Customer'); await name.press('Enter');
        await page.locator('.ddn-viewer-stage [aria-label="Customer"]').waitFor();
        assert.match(await source(page).inputValue(), /Customer/);
    } finally {await s.close();}
});

test('website chooser offers all 151 profiles and switches to UML defaults and elements', async () => {
    const s = await session(); const {page} = s;
    try {
        const dialog = await choose(page), methods = await diagramMethodIds(dialog), profiles = [];
        for (const method of methods) {
            profiles.push(...await diagramProfileIds(dialog, method));
            const grid = dialog.getByRole('group', {name: 'Diagram types', exact: true});
            assert.equal(await grid.locator('button[data-profile] svg[aria-hidden=true]').count(), await grid.locator('button[data-profile]').count());
        }
        assert.equal(new Set(profiles).size, 151);
        await selectDiagramProfile(dialog, 'uml.structure@2', 'MT02');
        await page.screenshot({path: join(reports, 'uml-type-grid.png')});
        await dialog.getByLabel('View name', {exact: true}).fill('Classes');
        await dialog.getByRole('button', {name: 'Create view', exact: true}).click();
        await dialog.waitFor({state: 'detached'}); await palette(page).waitFor();
        assert.equal((await view(page, 'Classes')).record.profile, 'uml.structure@2');
        assert.ok((await roles(page)).includes('uml.class'));
        assert.ok(!(await roles(page)).includes('entity'));
        assert.doesNotMatch(await source(page).inputValue(), /layout\.|style\.|background\./);
        await page.screenshot({path: join(reports, 'uml-type-palette.png')});
        await palette(page).getByRole('button', {name: 'Close the palette', exact: true}).click();
        assert.equal(await page.getByRole('button', {name: 'Choose diagram type…', exact: true}).count(), 0);
        await page.getByRole('button', {name: 'Undo', exact: true}).click();
        await page.getByRole('button', {name: 'New document…', exact: true}).waitFor();
        assert.equal(await source(page).inputValue(), '');
    } finally {await s.close();}
});

test('choosing a mind map creates its root and derives its layout without copying defaults into source', async () => {
    const s = await session(); const {page} = s;
    try {
        await create(page, 'mindmap.basic@1', 'Ideas');
        const selected = await view(page, 'Ideas'); assert.equal(selected.record.profile, 'mindmap.basic@1');
        const nodes = await page.evaluate(() => DDN.getViewerHandle(DDN_SITE_STATE.viewer).scene().entries.filter(entry => entry.definition.owner === 'definition').map(entry => entry.definition.record));
        assert.equal(nodes.length, 1); assert.equal(nodes[0].title, 'Ideas');
        const inspection = await page.evaluate(ref => DDN_SITE_STATE.viewer.inspect(ref), selected.ref);
        const layout = inspection.properties.find(property => property.path === 'layout.algorithm');
        assert.equal(layout.effective, 'mindmap'); assert.equal(layout.explicit, undefined);
        assert.ok(!(await roles(page)).includes('uml.class'));
        assert.doesNotMatch(await source(page).inputValue(), /layout\.|style\.|background\./);
    } finally {await s.close();}
});

test('a chart selection exposes data and projection setup instead of unrelated element tiles', async () => {
    const s = await session(); const {page} = s;
    try {
        await create(page, 'chart.basic@1', 'Revenue');
        assert.equal((await view(page, 'Revenue')).record.profile, 'chart.basic@1');
        assert.equal((await roles(page)).length, 0);
        await palette(page).getByRole('button', {name: 'Data sources and datasets…', exact: true}).waitFor();
        await page.screenshot({path: join(reports, 'chart-data-controls.png')});
        await palette(page).getByRole('button', {name: 'Projection settings…', exact: true}).click();
        await page.getByRole('dialog', {name: 'Projection settings', exact: true}).waitFor();
    } finally {await s.close();}
});

test('changing an empty view type preserves its identity, styling and sibling view and is undoable', async () => {
    const s = await session(); const {page} = s;
    try {
        const text = '// Keep the surrounding document.\nview Empty as ddn@1 : Keep this title\n    with\n        id empty-view\n        background.color "#ead9aa"\nview Other as ddn@1\n    element Customer as entity\n';
        await load(page, text);
        const original = await view(page, 'Empty'), sibling = await view(page, 'Other');
        await page.evaluate(ref => DDN_SITE_STATE.viewer.navigate({kind: 'expand-view', target: ref}), original.ref);
        let dialog = await choose(page);
        assert.equal(await dialog.getByRole('button', {name: 'Apply', exact: true}).isDisabled(), true);
        await selectDiagramProfile(dialog, 'concept.map@1');
        await dialog.getByRole('button', {name: 'Apply', exact: true}).click(); await dialog.waitFor({state: 'detached'}); await palette(page).waitFor();
        const changed = await view(page, 'Empty');
        assert.deepEqual(changed.ref, original.ref); assert.equal(changed.record.profile, 'concept.map@1');
        assert.equal(changed.record.title, 'Keep this title'); assert.equal(changed.record.background.color, '#ead9aa');
        assert.deepEqual(await view(page, 'Other'), sibling);
        assert.match(await source(page).inputValue(), /^\/\/ Keep the surrounding document\./);
        await page.getByRole('button', {name: 'Undo', exact: true}).click();
        await page.waitForFunction(text => document.querySelector('#ddn-source').value === text, text);
        await page.evaluate(() => DDN.getViewerHandle(DDN_SITE_STATE.viewer).whenRendered());
        assert.deepEqual(await view(page, 'Empty'), original);
        assert.ok((await roles(page)).includes('entity'));
    } finally {await s.close();}
});

test('the chooser respects the workarea method and allowed profiles', async () => {
    const s = await session(); const {page} = s;
    try {
        await load(page, 'workarea Restricted as uml\n    with\n        allow_foreign_views false\n        allowed_profiles\n            item uml.structure@2\n');
        const dialog = await choose(page);
        assert.deepEqual(await diagramMethodIds(dialog), ['MT02']);
        assert.deepEqual(await diagramProfileIds(dialog, 'MT02'), ['uml.structure@2']);
        await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
    } finally {await s.close();}
});

test('method and type previews are distinct; searching and going back never creates a diagram', async () => {
    const s = await session(); const {page} = s;
    try {
        const dialog = await choose(page), createButton = dialog.getByRole('button', {name: 'Create view', exact: true});
        const methodPreviews = await dialog.getByRole('group', {name: 'Diagram methods', exact: true}).locator('button[data-method="MT01"] svg, button[data-method="MT02"] svg, button[data-method="MT21"] svg').evaluateAll(nodes => nodes.map(node => node.innerHTML));
        assert.equal(methodPreviews.length, 3); assert.equal(new Set(methodPreviews).size, 3);
        await chooseDiagramMethod(dialog);
        await page.screenshot({path: join(reports, 'ddn-type-grid.png')});
        const types = dialog.getByRole('group', {name: 'Diagram types', exact: true});
        const previews = await types.locator('button[data-profile="ddn@1"] svg, button[data-profile="mindmap.basic@1"] svg, button[data-profile="chart.arc@1"] svg').evaluateAll(nodes => nodes.map(node => node.innerHTML));
        assert.equal(previews.length, 3); assert.equal(new Set(previews).size, 3);
        assert.equal(await createButton.isDisabled(), true);
        const search = dialog.getByRole('searchbox', {name: 'Find a diagram type', exact: true});
        await search.fill('MiNd MaP');
        assert.deepEqual(await types.locator('button[data-profile]:visible').evaluateAll(nodes => nodes.map(node => node.dataset.profile)), ['mindmap.basic@1']);
        await search.fill('not-a-diagram-type');
        await dialog.getByText('No diagram types match your search.', {exact: true}).waitFor();
        assert.equal(await types.locator('button[data-profile]:visible').count(), 0);
        await search.fill('mind map');
        await types.locator('button[data-profile="mindmap.basic@1"]').click();
        assert.equal(await createButton.isEnabled(), true);
        assert.equal(await types.locator('button[data-profile="mindmap.basic@1"]').getAttribute('aria-pressed'), 'true');
        await dialog.getByLabel('View name', {exact: true}).fill('Keep this name');
        assert.equal(await source(page).inputValue(), '');
        await dialog.getByRole('button', {name: 'All diagram methods', exact: true}).click();
        assert.equal(await createButton.isDisabled(), true);
        assert.equal(await dialog.getByLabel('View name', {exact: true}).isVisible(), false);
        await selectDiagramProfile(dialog, 'uml.structure@2', 'MT02');
        assert.equal(await dialog.getByLabel('View name', {exact: true}).inputValue(), 'Keep this name');
        await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
        assert.equal(await source(page).inputValue(), '');
        assert.equal(await page.locator('.ddn-viewer-stage [data-ref]').count(), 0);
    } finally {await s.close();}
});

test('method and type tiles work by keyboard without submitting until Create is chosen', async () => {
    const s = await session(); const {page} = s;
    try {
        const dialog = await choose(page), method = dialog.locator('button[data-method="MT02"]');
        await method.focus(); await method.press('Enter');
        const type = dialog.getByRole('group', {name: 'Diagram types', exact: true}).locator('button[data-profile="uml.structure@2"]');
        await type.focus(); await type.press('Space');
        assert.equal(await type.getAttribute('aria-pressed'), 'true');
        assert.equal(await source(page).inputValue(), '');
        assert.equal(await dialog.getByRole('button', {name: 'Create view', exact: true}).isEnabled(), true);
        await dialog.getByLabel('View name', {exact: true}).fill('Keyboard classes');
        await dialog.getByRole('button', {name: 'Create view', exact: true}).press('Enter');
        await dialog.waitFor({state: 'detached'}); await palette(page).waitFor();
        assert.equal((await view(page, 'Keyboard classes')).record.profile, 'uml.structure@2');
    } finally {await s.close();}
});

test('visual picker stays within narrow light and dark viewports with its footer reachable', async () => {
    for (const theme of ['dark', 'light']) {
        const s = await session('website', {width: 390, height: 844, theme}), {page} = s;
        try {
            const dialog = await choose(page);
            const withinViewport = async () => {
                const box = await dialog.boundingBox(), footer = await dialog.locator('footer').boundingBox();
                assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 391 && box.y + box.height <= 845, JSON.stringify(box));
                assert.ok(footer.y >= box.y && footer.y + footer.height <= 845, JSON.stringify(footer));
                assert.equal(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1), true);
            };
            await withinViewport();
            await page.screenshot({path: join(reports, `methods-mobile-${theme}.png`)});
            await chooseDiagramMethod(dialog);
            await withinViewport();
            const search = dialog.getByRole('searchbox', {name: 'Find a diagram type', exact: true});
            await search.fill('mind map');
            await dialog.getByRole('group', {name: 'Diagram types', exact: true}).locator('button[data-profile="mindmap.basic@1"]').click();
            await dialog.getByLabel('View name', {exact: true}).fill('Mobile ideas');
            await withinViewport();
            await page.screenshot({path: join(reports, `types-mobile-${theme}.png`)});
            await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
            // The source drawer starts collapsed on narrow screens.
            assert.equal(await page.locator('#ddn-source').inputValue(), '');
        } finally {await s.close();}
    }
});
