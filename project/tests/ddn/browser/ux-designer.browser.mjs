import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const distribution = process.env.DDN_DDN_DISTRIBUTION ?? resolve(root, '.work/builds/ddn-distribution');
const tool = process.env.DDN_PLAYWRIGHT_ROOT ?? resolve(root, '.work/tools/browser/node_modules/playwright');
const { chromium } = await import(pathToFileURL(join(tool, 'index.mjs')));
let browser, page;
const errors = [];
before(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(join(distribution, 'ddn-visual-designer.html')).href);
    await page.waitForFunction(() => !!window.DDN?.createDesigner);
});
after(async () => { await browser?.close(); assert.deepEqual(errors, []); });

async function setup(text = 'erd Studio\n', { allowed = true, files } = {}) {
    await page.evaluate(async ({ text, allowed, files }) => {
        const old = window.uxFixture;
        if (old) { old.designer.destroy(); old.viewer.destroy(); old.runtime.destroy(); old.host.remove(); }
        const host = document.createElement('main'); host.id = 'ux-fixture';
        host.style.cssText = 'position:fixed;inset:0;z-index:1000;background:white'; document.body.append(host);
        const runtime = DDN.createRuntime(DDN.createNativeRuntimeOptions()), viewer = DDN.createViewer(host, { runtime });
        const sources = files ?? [{ id: 'main.ddn', text, revision: 'one', encoding: 'utf-8', writable: true }];
        const opened = await viewer.open({ entry: sources[0].id, files: sources });
        if (!opened.snapshot) throw Error(JSON.stringify(opened.diagnostics));
        const designer = DDN.createDesigner(viewer, { authority: { authorize: async action => ({ allowed, principal: 'ux-test', grants: allowed ? [action] : [] }) } });
        const handle = DDN.getViewerHandle(viewer); window.uxFixture = { host, runtime, viewer, designer, handle };
        await viewer.navigate({ kind: 'fit-workarea' }); await handle.whenRendered();
    }, { text, allowed, files });
    return page.locator('#ux-fixture');
}
const sources = () => page.evaluate(() => uxFixture.runtime.sources().files.map(file => file.text));
async function select(name) {
    await page.evaluate(name => {
        const entry = uxFixture.handle.scene().entries.find(item => item.definition.owner === 'definition' && (item.definition.record.name === name || item.definition.record.title === name));
        if (!entry) throw Error('Missing element: ' + name);
        uxFixture.handle.select(entry.definition.ref, entry.item.occurrence);
    }, name);
}

test('palette creation pins the element in one undoable command and opens inline naming', async () => {
    const fixture = await setup(), before = await sources();
    assert.equal(await fixture.getByRole('button', { name: 'Rename', exact: true }).isVisible(), false);
    await fixture.getByRole('button', { name: 'Add element', exact: true }).click();
    const palette = fixture.getByRole('region', { name: 'Element palette' });
    await palette.getByRole('searchbox', { name: 'Find an element type' }).fill('entity');
    const tile = palette.locator('button').filter({ has: page.locator('.ddn-palette-id', { hasText: /^entity$/ }) });
    await tile.dblclick();
    const rename = fixture.getByRole('textbox', { name: 'Element name', exact: true });
    await rename.waitFor(); await rename.press('Escape');
    const after = await sources(); assert.notDeepEqual(after, before); assert.match(after[0], /position/);
    await fixture.getByRole('button', { name: 'Undo', exact: true }).click();
    await page.waitForFunction(before => uxFixture.runtime.sources().files[0].text === before, before[0]);
    await fixture.getByRole('button', { name: 'Redo', exact: true }).click();
    await page.waitForFunction(after => uxFixture.runtime.sources().files[0].text === after, after[0]);
    assert.equal(await page.evaluate(() => uxFixture.handle.scene().entries.filter(e => e.definition.owner === 'definition').length), 1);
});

test('inspector edits a shared writable element without offering its readonly occurrence', async () => {
    const fixture = await setup('', { files: [
        { id: 'main.ddn', text: 'include "shared.ddn"\nview Board as ddn@1\n    use "shared.ddn"::Idea named Here\n', revision: 'one', encoding: 'utf-8', writable: false },
        { id: 'shared.ddn', text: 'element Idea as note\n', revision: 'one', encoding: 'utf-8', writable: true },
    ] });
    await select('Idea'); const before = await sources();
    await fixture.getByRole('button', { name: 'Properties', exact: true }).click();
    const inspector = fixture.getByRole('region', { name: 'Inspector', exact: true });
    assert.deepEqual(await inspector.getByLabel('Apply appearance to').locator('option').allTextContents(), ['This element everywhere']);
    await inspector.getByLabel('Font size (pt)', { exact: true }).fill('17.25');
    await inspector.getByLabel('Font size (pt)', { exact: true }).press('Tab');
    await page.waitForFunction(() => uxFixture.runtime.sources().files[1].text.includes('23'));
    const after = await sources(); assert.equal(after[0], before[0]); assert.match(after[1], /font_size 23/);
    await fixture.getByRole('button', { name: 'Undo', exact: true }).click();
    await page.waitForFunction(before => uxFixture.runtime.sources().files[1].text === before, before[1]);
});

test('inline names retain command authority and never alter denied sources', async () => {
    const fixture = await setup('erd Studio\n    Customer\n', { allowed: false }); await select('Customer');
    const before = await sources();
    await fixture.getByRole('button', { name: 'Rename', exact: true }).click();
    const rename = fixture.getByRole('textbox', { name: 'Element name', exact: true });
    await rename.fill('Denied edit'); await rename.press('Enter');
    await fixture.locator('.ddn-viewer-status').filter({ hasText: /not authorized/ }).waitFor();
    assert.deepEqual(await sources(), before);
});

test('inline mindmap root naming materializes the topic without renaming its view or adding generic ports', async () => {
    const fixture = await setup('mindmap Plan\n    Research\n        Interviews\n'); await select('Plan');
    assert.equal(await fixture.locator('.ddn-port').count(), 0);
    assert.equal(await fixture.getByRole('toolbar', { name: 'Mind map topic actions' }).getByRole('button').count(), 5);
    await fixture.getByRole('button', { name: 'Rename', exact: true }).click();
    const rename = fixture.getByRole('textbox', { name: 'Element name', exact: true });
    await rename.fill('Launch plan'); await rename.press('Enter');
    await page.waitForFunction(() => uxFixture.handle.scene().entries.some(e => e.definition.record.title === 'Launch plan'));
    assert.equal(await page.evaluate(() => uxFixture.runtime.snapshot().normalized.files[0].document.views[0].name), 'Plan');
    await select('Research'); assert.equal(await fixture.locator('.ddn-port').count(), 0);
    assert.equal(await fixture.getByRole('toolbar', { name: 'Mind map topic actions' }).getByRole('button', { name: /Add linked topic/ }).count(), 1);
});

test('click-click connections use legal verbs, and pinch cancels a pending port drag', async () => {
    const fixture = await setup('erd Studio\n    Customer\n    Order\n'); await select('Customer');
    assert.equal(await fixture.locator('.ddn-port').count(), 4);
    const before = await sources();
    await fixture.locator('.ddn-port').first().dispatchEvent('pointerdown', { button: 0, pointerId: 7, clientX: 100, clientY: 100 });
    assert.equal(await fixture.locator('.ddn-connect-line').count(), 1);
    await fixture.locator('.ddn-viewer').evaluate(node => node.dispatchEvent(new CustomEvent('ddn:gesture', {bubbles: true, detail: {gesture: 'pinch-start'}})));
    assert.equal(await fixture.locator('.ddn-connect-line').count(), 0);
    await fixture.locator('.ddn-viewer').evaluate(node => node.dispatchEvent(new CustomEvent('ddn:gesture', {bubbles: true, detail: {gesture: 'pinch-end'}})));
    assert.deepEqual(await sources(), before);
    await fixture.getByRole('button', { name: 'Connect', exact: true }).click(); await select('Order');
    const dialog = fixture.getByRole('dialog', { name: 'Connect', exact: true }); await dialog.waitFor();
    assert.ok(await dialog.locator('.ddn-verb-list button').count() > 0);
    await dialog.getByRole('button', { name: 'Connect', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
    const relation = await page.evaluate(() => uxFixture.handle.scene().entries.find(e => e.definition.record.category === 'relation')?.definition.record);
    assert.equal(relation.role, 'assoc'); assert.equal(relation.endpoints.length, 2);
});

test('a second touch starting from a connection port switches to pinch without editing source', async () => {
    const fixture = await setup('erd Studio\n    Customer\n    Order\n'); await select('Customer');
    const before = await sources(), initialZoom = await page.evaluate(() => uxFixture.handle.viewport().zoom);
    await fixture.locator('.ddn-port').first().evaluate(port => {
        const svg = port.ownerSVGElement, bounds = port.getBoundingClientRect(), x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
        port.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, pointerId: 91, pointerType: 'touch', button: 0, clientX: x, clientY: y}));
        svg.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, pointerId: 92, pointerType: 'touch', button: 0, clientX: x + 100, clientY: y}));
        svg.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, pointerId: 92, pointerType: 'touch', clientX: x + 160, clientY: y}));
        for (const pointerId of [91, 92]) svg.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, pointerId, pointerType: 'touch'}));
    });
    assert.equal(await fixture.locator('.ddn-connect-line').count(), 0);
    assert.ok(await page.evaluate(() => uxFixture.handle.viewport().zoom) > initialZoom);
    assert.deepEqual(await sources(), before);
});
