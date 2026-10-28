import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const reports = join(root, '.work/reports/ddn-designer-menus');
const site = process.env.DDN_DDN_SITE_ROOT ?? join(root, 'website');
const {chromium} = await import(pathToFileURL(join(process.env.DDN_PLAYWRIGHT_ROOT ?? join(root, '.work/tools/browser/node_modules/playwright'), 'index.mjs')));
const erd = 'erd Sales : Sales design\n    Customer\n    Order\n    connect Customer to Order\n';
let browser;
before(async () => {await mkdir(reports, {recursive: true}); browser = await chromium.launch({headless: true});});
after(async () => {await browser?.close();});

async function session({mode = 'design', width = 1440, height = 900, storage} = {}) {
    const context = await browser.newContext({viewport: {width, height}, acceptDownloads: true});
    const errors = [], network = [];
    await context.route(/^https?:\/\//, route => {network.push(route.request().url()); return route.abort();});
    if (storage) await context.addInitScript(values => { for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value); }, storage);
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(join(site, 'tools/index.html')).href + '?mode=' + mode);
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    return {page, context, errors, async close() {await context.close(); assert.deepEqual(errors, []); assert.deepEqual(network, []);}};
}
const source = page => page.getByRole('textbox', {name: 'DDN source', exact: true});
const menu = page => page.getByRole('menubar');
async function choose(page, top, ...path) {
    await menu(page).getByRole('menuitem', {name: top, exact: true}).click();
    for (const [index, name] of path.entries()) {
        const item = page.getByRole('menu', {name: index ? path[index - 1] : top, exact: true}).locator(`:scope > [role^=menuitem][aria-label="${name}"], :scope > .app-submenu-host > [role^=menuitem][aria-label="${name}"]`);
        await item.click();
    }
}
async function load(page, text = erd) {
    await source(page).fill(text);
    await page.getByRole('button', {name: 'Apply source', exact: true}).click();
    await page.locator('.ddn-viewer-stage [data-ref][aria-label="Customer"]').waitFor();
}
async function select(page, name) {
    await page.locator('.ddn-viewer-outline').getByRole('button', {name, exact: true}).click();
    await page.locator('.ddn-viewer-stage svg').focus();
}

test('the menu bar has the same seven menus in every mode and is keyboard operable', async () => {
    for (const mode of ['design', 'view', 'verify']) {
        const s = await session({mode});
        try {
            const names = await menu(s.page).locator(':scope > .app-menu-host > [role=menuitem]').allTextContents();
            assert.deepEqual(names, ['File', 'Edit', 'WorkArea', 'View', 'Document', 'Window', 'Help']);
        } finally {await s.close();}
    }
    const s = await session(); const {page} = s;
    try {
        const file = menu(page).getByRole('menuitem', {name: 'File', exact: true});
        await file.focus(); await page.keyboard.press('ArrowDown');
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'New diagram…');
        await page.keyboard.press('ArrowRight');
        assert.equal(await menu(page).getByRole('menuitem', {name: 'Edit', exact: true}).getAttribute('aria-expanded'), 'true');
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Undo');
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('menu', {name: 'Edit', exact: true}).isVisible(), false);
        // Commercial-only entries keep their place, disabled and labelled.
        await choose(page, 'File');
        const template = page.getByRole('menu', {name: 'File', exact: true}).locator('[aria-label="New from template…"]');
        assert.equal(await template.getAttribute('aria-disabled'), 'true');
        assert.match(await template.textContent(), /ScratchWeaver/);
        await page.screenshot({path: join(reports, 'file-menu.png')});
        await page.keyboard.press('Escape');
    } finally {await s.close();}
});

test('the source drawer collapses to a rail, resizes by keyboard and remembers its width', async () => {
    const s = await session(); const {page} = s;
    try {
        const splitter = page.getByRole('separator', {name: 'Source drawer width'});
        const before = Number(await splitter.getAttribute('aria-valuenow'));
        await splitter.focus(); await page.keyboard.press('Shift+ArrowRight');
        assert.equal(Number(await splitter.getAttribute('aria-valuenow')), before + 64);
        const surfaceWidth = (await page.locator('.app-surface').boundingBox()).width;
        await page.getByRole('button', {name: 'Hide source', exact: true}).click();
        assert.equal(await source(page).isVisible(), false);
        assert.ok((await page.locator('.app-surface').boundingBox()).width > surfaceWidth + 200);
        await page.screenshot({path: join(reports, 'collapsed-rail.png')});
        await page.keyboard.press('Control+\\');
        assert.equal(await source(page).isVisible(), true);
        await page.reload(); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
        assert.equal(Number(await page.getByRole('separator', {name: 'Source drawer width'}).getAttribute('aria-valuenow')), before + 64);
    } finally {await s.close();}
});

test('cut, copy, paste, paste in place and duplicate edit the source as single undoable steps', async () => {
    const s = await session(); const {page} = s;
    try {
        await load(page);
        await select(page, 'Order');
        await page.keyboard.press('Control+c');
        await page.keyboard.press('Control+v');
        await page.locator('.ddn-viewer-stage [data-ref][aria-label="Order 2"]').waitFor();
        assert.match(await source(page).inputValue(), /element "Order 2" as "entity"/);
        await page.locator('.ddn-viewer-stage svg').focus();
        await page.keyboard.press('Control+z');
        await page.locator('.ddn-viewer-stage [data-ref][aria-label="Order 2"]').waitFor({state: 'detached'});
        assert.doesNotMatch(await source(page).inputValue(), /Order 2/);
        await select(page, 'Customer');
        await choose(page, 'Edit', 'Duplicate');
        await page.locator('.ddn-viewer-stage [data-ref][aria-label="Customer 2"]').waitFor();
        await choose(page, 'Edit', 'Paste as reference');
        await page.waitForFunction(() => /use "Order"/.test(document.querySelector('#ddn-source').value));
        // With nothing selected, Copy stays visible but disabled instead of failing.
        await choose(page, 'Edit', 'Deselect');
        await menu(page).getByRole('menuitem', {name: 'Edit', exact: true}).click();
        assert.equal(await page.getByRole('menu', {name: 'Edit', exact: true}).locator('[aria-label="Copy"]').getAttribute('aria-disabled'), 'true');
        await page.keyboard.press('Escape');
    } finally {await s.close();}
});

test('zoom presets, actual size and fit commands drive the status-bar control; the grid stays out of exports', async () => {
    const s = await session(); const {page} = s;
    try {
        await load(page);
        const level = page.getByRole('button', {name: 'Zoom level', exact: true});
        await level.click();
        await page.getByRole('menuitemradio', {name: '50 %', exact: true}).click();
        assert.equal(await level.textContent(), '50%');
        await page.locator('.ddn-viewer-stage svg').focus();
        await page.keyboard.press('Control+0');
        assert.equal(await level.textContent(), '100%');
        await choose(page, 'View', 'Show grid');
        await page.locator('[data-ddn-grid-lines]').waitFor();
        const download = page.waitForEvent('download');
        await choose(page, 'File', 'Export SVG');
        const svg = await (await download).createReadStream().then(stream => new Promise(resolve => { let text = ''; stream.on('data', chunk => { text += chunk; }); stream.on('end', () => resolve(text)); }));
        assert.doesNotMatch(svg, /data-ddn-grid-lines/);
        await page.screenshot({path: join(reports, 'grid.png')});
    } finally {await s.close();}
});

test('panels float, pop out to their own window from a local file, and come back', async () => {
    const s = await session(); const {page} = s;
    try {
        await load(page);
        await select(page, 'Customer');
        await choose(page, 'Window', 'Inspector', 'Floating');
        await page.locator('.ddn-float .ddn-designer-dock-right').waitFor();
        assert.equal(await page.locator('.ddn-viewer[data-ddn-dock-right]').count(), 0);
        await page.screenshot({path: join(reports, 'floating-inspector.png')});
        await page.locator('.ddn-float').getByRole('button', {name: 'Dock Inspector', exact: true}).click();
        await page.locator('.ddn-viewer[data-ddn-dock-right] .ddn-designer-dock-right').waitFor();
        assert.equal(await page.locator('.ddn-float').count(), 0);
        const popup = page.waitForEvent('popup');
        await choose(page, 'Window', 'DDN source', 'Pop out to a window');
        const window = await popup;
        const editor = window.locator('#ddn-source');
        await editor.waitFor();
        assert.equal(await page.locator('#ddn-source').count(), 0);
        await editor.fill(erd + '    Invoice\n');
        await editor.press('Control+Enter');
        await page.locator('.ddn-viewer-stage [data-ref][aria-label="Invoice"]').waitFor();
        await window.close();
        await page.locator('.app-main #ddn-source').waitFor();
        assert.equal(await page.locator('.app-main').getAttribute('data-source-detached'), null);
    } finally {await s.close();}
});

test('document views, page setup and capture scope work from the Document menu', async () => {
    const s = await session(); const {page} = s;
    try {
        await load(page);
        await menu(page).getByRole('menuitem', {name: 'Document', exact: true}).click();
        assert.equal(await page.getByRole('menu', {name: 'Document', exact: true}).locator('[aria-label="Page setup…"]').getAttribute('aria-disabled'), 'true');
        await page.getByRole('menu', {name: 'Document', exact: true}).locator('[aria-label="New document view…"]').click();
        const dialog = page.getByRole('dialog', {name: 'New document view', exact: true});
        await dialog.getByLabel('Document name').fill('Quarterly');
        await dialog.getByRole('button', {name: 'Apply', exact: true}).click();
        await page.waitForFunction(() => /document "Quarterly" as pdf\n\s+use "Sales"/.test(document.querySelector('#ddn-source').value));
        await menu(page).getByRole('menuitem', {name: 'Document', exact: true}).click();
        assert.equal(await page.getByRole('menu', {name: 'Document', exact: true}).locator('[aria-label="Page setup…"]').getAttribute('aria-disabled'), null);
        await page.keyboard.press('Escape');
        await choose(page, 'Document', 'Capture scope…');
        await page.getByRole('dialog', {name: 'Capture scope', exact: true}).getByRole('group', {name: 'Capture scope'}).getByRole('button', {name: 'Whole workarea', exact: true}).click();
        await page.getByRole('dialog', {name: 'Capture scope', exact: true}).getByRole('button', {name: 'Close', exact: true}).click();
    } finally {await s.close();}
});

test('command search finds and runs menu commands; the viewer keeps editing entries visible but disabled', async () => {
    let s = await session(); let {page} = s;
    try {
        await load(page);
        await page.locator('.ddn-viewer-stage svg').focus();
        await page.keyboard.press('Control+k');
        const dialog = page.getByRole('dialog', {name: 'Command search', exact: true});
        await dialog.getByRole('searchbox', {name: 'Search commands'}).fill('actual size');
        await dialog.getByRole('searchbox', {name: 'Search commands'}).press('Enter');
        await dialog.waitFor({state: 'detached'});
        assert.equal(await page.getByRole('button', {name: 'Zoom level', exact: true}).textContent(), '100%');
    } finally {await s.close();}
    s = await session({mode: 'view'}); page = s.page;
    try {
        await menu(page).getByRole('menuitem', {name: 'Edit', exact: true}).click();
        assert.equal(await page.getByRole('menu', {name: 'Edit', exact: true}).locator('[aria-label="Paste"]').getAttribute('aria-disabled'), 'true');
        await page.keyboard.press('Escape');
    } finally {await s.close();}
});

test('the narrow shell keeps the menu bar inside the viewport', async () => {
    const s = await session({width: 390, height: 844}); const {page} = s;
    try {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await menu(page).getByRole('menuitem', {name: 'Help', exact: true}).click();
        const box = await page.getByRole('menu', {name: 'Help', exact: true}).boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= 390, JSON.stringify(box));
        await page.screenshot({path: join(reports, 'narrow-help.png')});
    } finally {await s.close();}
});
