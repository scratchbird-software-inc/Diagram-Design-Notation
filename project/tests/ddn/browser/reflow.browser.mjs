import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const distribution = process.env.DDN_DDN_DISTRIBUTION ?? resolve(root, '.work/builds/ddn-distribution');
const tool = process.env.DDN_PLAYWRIGHT_ROOT ?? resolve(root, '.work/tools/browser/node_modules/playwright');
const {chromium} = await import(pathToFileURL(join(tool, 'index.mjs')));
let browser;
before(async () => {browser = await chromium.launch({headless: true});});
after(async () => {await browser?.close();});

async function session(text, {writable = true, allowed = true} = {}) {
    const context = await browser.newContext({viewport: {width: 1600, height: 1000}});
    const errors = [], network = [];
    await context.route(/^https?:\/\//, route => {network.push(route.request().url()); return route.abort();});
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(join(distribution, 'modular/designer.html')).href);
    await page.waitForFunction(() => !!window.DDN?.createDesigner);
    await page.evaluate(async ({text, writable, allowed}) => {
        const host = document.createElement('main'); host.id = 'reflow-fixture';
        host.style.cssText = 'position:fixed;inset:0;z-index:10000;background:white'; document.body.append(host);
        const runtime = DDN.createRuntime(DDN.createBrowserRuntimeOptions());
        const viewer = DDN.createViewer(host, {runtime});
        const opened = await viewer.open({entry: 'main.ddn', files: [{id: 'main.ddn', text, revision: 'one', encoding: 'utf-8', writable}]});
        if (!opened.snapshot) throw Error(JSON.stringify(opened.diagnostics));
        const handle = DDN.getViewerHandle(viewer);
        await handle.whenRendered();
        const designer = DDN.createDesigner(viewer, {authority: {authorize: async action => ({allowed, principal: 'reflow-test', grants: allowed ? [action] : []})}});
        window.reflowFixture = {host, runtime, viewer, handle, designer};
        const view = handle.scene().entries.find(entry => entry.definition.owner === 'view' && entry.definition.record.name === 'Org');
        if (!view) throw Error('Missing view');
        handle.select(view.definition.ref, view.item.occurrence);
        await viewer.navigate({kind: 'focus', target: view.definition.ref});
        await handle.whenRendered();
    }, {text, writable, allowed});
    return {page, fixture: page.locator('#reflow-fixture'), async close() {
        await context.close(); assert.deepEqual(errors, []); assert.deepEqual(network, []);
    }};
}

const source = page => page.evaluate(() => reflowFixture.runtime.sources().files[0].text);
async function select(page, name, view = 'Org') {
    await page.evaluate(({name, view}) => {
        const entry = reflowFixture.handle.scene().entries.find(entry => entry.view.record.name === view && (entry.definition.record.title ?? entry.definition.record.name) === name);
        if (!entry) throw Error('Missing selection ' + name);
        reflowFixture.handle.select(entry.definition.ref, entry.item.occurrence);
    }, {name, view});
}
async function state(page, view = 'Org') {
    await page.evaluate(() => reflowFixture.handle.whenRendered());
    return page.evaluate(view => {
        const handle = reflowFixture.handle;
        const semantic = entry => entry.item.hitTargets.find(hit => JSON.stringify(hit.target) === JSON.stringify(entry.definition.ref))?.bounds ?? entry.item.hitTargets[0]?.bounds ?? entry.item.bounds;
        const entries = handle.scene().entries.filter(entry => entry.view.record.name === view);
        const frame = entries.find(entry => entry.definition.owner === 'view');
        const origin = frame ? semantic(frame) : {x: 0, y: 0};
        return {
            origin: {x: origin.x, y: origin.y},
            view: frame?.definition.record,
            elements: entries.filter(entry => entry.definition.owner === 'definition' && entry.definition.record.category !== 'relation').map(entry => ({name: entry.definition.record.title ?? entry.definition.record.name, bounds: semantic(entry), appearance: entry.appearance?.record})),
            relations: entries.filter(entry => entry.definition.record.category === 'relation').map(entry => entry.definition.record),
        };
    }, view);
}

const orgSource = `view Org as org.tree@1
    with
        layout.direction down
    element Parent as organization
    element Existing as organization
    connect Parent to Existing as reports_to
`;

async function dropOrganization(page, fixture, name) {
    await fixture.getByRole('button', {name: 'Add element', exact: true}).click();
    const palette = fixture.getByRole('region', {name: 'Element palette', exact: true});
    await palette.getByRole('searchbox', {name: 'Find an element type'}).fill('organization');
    const tile = palette.locator('button').filter({has: page.locator('.ddn-palette-id', {hasText: /^organization$/})});
    assert.equal(await tile.getAttribute('draggable'), 'true');
    const stage = fixture.locator('.ddn-viewer-stage > svg');
    const rect = await stage.boundingBox();
    const point = await page.evaluate(() => {
        const handle = reflowFixture.handle;
        const frame = handle.scene().entries.find(entry => entry.definition.owner === 'view' && entry.definition.record.name === 'Org');
        const bounds = frame.item.hitTargets[0]?.bounds ?? frame.item.bounds;
        const world = {x: bounds.x + bounds.width * .66, y: bounds.y + bounds.height * .72};
        const screen = new DOMPoint(world.x, world.y).matrixTransform(handle.surface.getScreenCTM());
        return {world, screen: {x: screen.x, y: screen.y}};
    });
    const offset = {x: Math.round(point.screen.x - rect.x), y: Math.round(point.screen.y - rect.y)};
    const expected = await page.evaluate(({x, y}) => reflowFixture.handle.toWorld(x, y), {x: rect.x + offset.x, y: rect.y + offset.y});
    await tile.dragTo(stage, {targetPosition: offset});
    const input = fixture.getByRole('textbox', {name: 'Element name', exact: true});
    await input.fill(name); await input.press('Enter'); await input.waitFor({state: 'detached'});
    await page.waitForFunction(name => reflowFixture.handle.scene().entries.some(entry => (entry.definition.record.title ?? entry.definition.record.name) === name), name);
    await palette.getByRole('button', {name: 'Close the palette', exact: true}).click();
    return expected;
}
async function connect(page, fixture, from, to) {
    await select(page, from);
    await fixture.getByRole('button', {name: 'Connect', exact: true}).click();
    await select(page, to);
    const dialog = fixture.getByRole('dialog', {name: 'Connect', exact: true});
    await dialog.locator('select').selectOption('reports_to');
    await dialog.getByRole('button', {name: 'Connect', exact: true}).click();
    await dialog.waitFor({state: 'detached'});
    await page.evaluate(() => reflowFixture.handle.whenRendered());
}

test('palette drop stays at the pointer until its first relation joins the org hierarchy', async () => {
    const s = await session(orgSource); const {page, fixture} = s;
    try {
        const expected = await dropOrganization(page, fixture, 'NewDivision');
        const dropped = (await state(page)).elements.find(element => element.name === 'NewDivision');
        assert.ok(dropped.appearance.position, 'the unconnected drop has a persisted position');
        assert.equal(dropped.appearance.pinned, false);
        assert.ok(Math.abs(dropped.bounds.x - expected.x) <= 2, JSON.stringify({expected, actual: dropped.bounds}));
        assert.ok(Math.abs(dropped.bounds.y - expected.y) <= 2, JSON.stringify({expected, actual: dropped.bounds}));
        const before = await source(page);
        await connect(page, fixture, 'Parent', 'NewDivision');
        const connected = await state(page), node = connected.elements.find(element => element.name === 'NewDivision');
        const parent = connected.elements.find(element => element.name === 'Parent'), sibling = connected.elements.find(element => element.name === 'Existing');
        assert.equal(node.appearance.position, undefined, 'connecting releases provisional placement');
        assert.notEqual(node.appearance.pinned, true);
        assert.ok(node.bounds.y >= parent.bounds.y + parent.bounds.height, 'the new child follows org top-down layout');
        assert.ok(node.bounds.x + node.bounds.width <= sibling.bounds.x || sibling.bounds.x + sibling.bounds.width <= node.bounds.x, 'siblings do not overlap');
        assert.notDeepEqual(node.bounds, dropped.bounds);
        const after = await source(page);
        await fixture.getByRole('button', {name: 'Undo', exact: true}).click();
        await page.waitForFunction(before => reflowFixture.runtime.sources().files[0].text === before, before);
        await page.evaluate(() => reflowFixture.handle.whenRendered());
        assert.deepEqual((await state(page)).elements.find(element => element.name === 'NewDivision').bounds, dropped.bounds);
        await fixture.getByRole('button', {name: 'Redo', exact: true}).click();
        await page.waitForFunction(after => reflowFixture.runtime.sources().files[0].text === after, after);
        await page.evaluate(() => reflowFixture.handle.whenRendered());
        assert.equal((await state(page)).relations.length, 2);
    } finally {await s.close();}
});

test('moving an existing element pins it while connecting a fresh drop only releases the drop', async () => {
    const s = await session(orgSource); const {page, fixture} = s;
    try {
        await select(page, 'Existing');
        const before = await source(page);
        await fixture.locator('.ddn-viewer-stage > svg').press('ArrowRight');
        await page.waitForFunction(before => reflowFixture.runtime.sources().files[0].text !== before, before);
        const moved = (await state(page)).elements.find(element => element.name === 'Existing');
        assert.equal(moved.appearance.pinned, true);
        await dropOrganization(page, fixture, 'AnotherDivision');
        await connect(page, fixture, 'Parent', 'AnotherDivision');
        const after = await state(page);
        assert.deepEqual(after.elements.find(element => element.name === 'Existing').appearance.position, moved.appearance.position);
        assert.deepEqual(after.elements.find(element => element.name === 'Existing').bounds, moved.bounds);
        assert.equal(after.elements.find(element => element.name === 'AnotherDivision').appearance.position, undefined);
    } finally {await s.close();}
});

const pinnedViews = `element Parent as organization
element Child as organization
connect Parent to Child as reports_to named Control
view Org as org.tree@1
    with
        layout.algorithm manual
        layout.direction down
    use Parent named ParentHere
        with
            position.x 700
            position.y 300
            pinned true
    use Child named ChildHere
        with
            position.x 120
            position.y 120
            pinned true
    use Control
view Other as org.tree@1
    use Parent named ParentThere
        with
            position.x 90
            position.y 180
            pinned true
    use Child named ChildThere
        with
            position.x 490
            position.y 180
            pinned true
    use Control
`;

test('Reflow resets the active view in one undoable change and preserves another view of the same elements', async () => {
    const s = await session(pinnedViews); const {page, fixture} = s;
    try {
        const before = await source(page), other = await state(page, 'Other');
        const reflow = fixture.getByRole('button', {name: 'Reflow', exact: true});
        assert.equal(await reflow.isEnabled(), true);
        assert.equal(await reflow.locator('svg[aria-hidden=true]').count(), 1);
        await reflow.click();
        await page.waitForFunction(before => reflowFixture.runtime.sources().files[0].text !== before, before);
        await fixture.locator('.ddn-viewer-status').filter({hasText: /Reflowed Org/}).waitFor();
        const result = await state(page), after = await source(page);
        assert.notEqual(result.view.layout?.algorithm, 'manual');
        for (const element of result.elements) {
            assert.equal(element.appearance.position, undefined);
            assert.notEqual(element.appearance.pinned, true);
        }
        const parent = result.elements.find(element => element.name === 'Parent'), child = result.elements.find(element => element.name === 'Child');
        assert.ok(parent.bounds.y + parent.bounds.height <= child.bounds.y);
        const unchanged = await state(page, 'Other');
        const local = state => ({view: state.view, relations: state.relations, elements: state.elements.map(element => ({...element, bounds: {...element.bounds, x: element.bounds.x - state.origin.x, y: element.bounds.y - state.origin.y}}))});
        assert.deepEqual(local(unchanged), local(other));
        assert.equal(after.slice(after.indexOf('view Other')), before.slice(before.indexOf('view Other')));
        await fixture.getByRole('button', {name: 'Undo', exact: true}).click();
        await page.waitForFunction(before => reflowFixture.runtime.sources().files[0].text === before, before);
        assert.equal((await state(page)).view.layout.algorithm, 'manual');
        await fixture.getByRole('button', {name: 'Redo', exact: true}).click();
        await page.waitForFunction(after => reflowFixture.runtime.sources().files[0].text === after, after);
        assert.deepEqual((await state(page)).elements, result.elements);
    } finally {await s.close();}
});

test('Reflow respects read-only files and command authorization', async () => {
    for (const options of [{writable: false}, {allowed: false}]) {
        const s = await session(pinnedViews, options); const {page, fixture} = s;
        try {
            const before = await source(page), reflow = fixture.getByRole('button', {name: 'Reflow', exact: true});
            if (options.writable === false) assert.equal(await reflow.isDisabled(), true);
            else {
                await reflow.click();
                await fixture.locator('.ddn-viewer-status').filter({hasText: /not authorized|denied/i}).waitFor();
            }
            assert.equal(await source(page), before);
        } finally {await s.close();}
    }
});
