import {chooseNewDocument, selectDiagramProfile} from './ux-test-helpers.mjs';
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const reports = join(root, '.work/reports/ddn-ux-patches');
const {chromium} = await import(pathToFileURL(join(root, '.work/tools/browser/node_modules/playwright/index.mjs')));
const url = pathToFileURL(join(root, 'website/tools/index.html')).href + '?mode=design';
const key = 'ddn.designer.draft.v1';
let browser;
before(async () => {await mkdir(reports, {recursive: true}); browser = await chromium.launch({headless: true});});
after(async () => {await browser?.close();});
async function session() {
    const context = await browser.newContext({viewport: {width: 1440, height: 900}, acceptDownloads: true});
    const errors = [], network = [];
    await context.route(/^https?:\/\//, route => {network.push(route.request().url()); return route.abort();});
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(url); await ready(page);
    return {page, async close() {await context.close(); assert.deepEqual(errors, []); assert.deepEqual(network, []);}};
}
async function ready(page) {await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');}
const source = page => page.getByRole('textbox', {name: 'DDN source', exact: true});
async function menu(page, label, top = 'File') {
    await page.getByRole('menubar').getByRole('menuitem', {name: top, exact: true}).click();
    await page.getByRole('menuitem', {name: label, exact: true}).click();
}
async function downloadSource(page) {
    const download = page.waitForEvent('download');
    await source(page).press('Control+s');
    const file = await download;
    return readFile(await file.path(), 'utf8');
}
async function replace(page) {
    await page.getByRole('dialog', {name: 'Replace your unsaved changes?', exact: true}).getByRole('button', {name: 'Replace', exact: true}).click();
}

test('blank designer, compact File menu and preserved New diagram picker work offline', async () => {
    const s = await session(); const {page} = s;
    try {
        assert.equal(await source(page).inputValue(), '');
        await page.getByRole('button', {name: 'New document…', exact: true}).waitFor();
        assert.equal(await page.locator('.app-bar .app-site-nav').count(), 1);
        await menu(page, 'New diagram…');
        const dialog = await chooseNewDocument(page);
        assert.equal(await source(page).inputValue(), '');
        await selectDiagramProfile(dialog);
        await dialog.getByLabel('View name', {exact: true}).fill('Fresh');
        await dialog.getByRole('button', {name: 'Create view', exact: true}).click(); await dialog.waitFor({state: 'detached'});
        assert.match(await source(page).inputValue(), /erd "Fresh"/);
        await page.screenshot({path: join(reports, 'integrated-blank-designer.png')});
        await menu(page, 'Keyboard shortcuts', 'Help');
        await page.getByRole('dialog', {name: 'Keyboard shortcuts', exact: true}).waitFor();
    } finally {await s.close();}
});

test('Download includes unapplied source and keeps a recoverable copy', async () => {
    const s = await session(); const {page} = s;
    try {
        const text = 'erd ValuableWork\n    Customer\n'; await source(page).fill(text);
        assert.equal(await downloadSource(page), text);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.ddnDirty), 'false');
        const draft = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
        assert.equal(draft.files[0].text, text);
        assert.match(await page.locator('.app-status').innerText(), /Download requested/);
    } finally {await s.close();}
});

test('pending recovery survives repeated reloads and restores supplied assets', async () => {
    const s = await session(); const {page} = s;
    try {
        await page.locator('input[type=file]').setInputFiles([
            {name: 'work.ddn', mimeType: 'text/plain', buffer: Buffer.from('erd Work\n    Customer\n')},
            {name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')},
        ]);
        await page.locator('.app-toasts').getByText('Opened work.ddn', {exact: true}).waitFor();
        await source(page).fill('erd Recovered\n    Important\n');
        await page.waitForFunction(key => localStorage.getItem(key)?.includes('Important'), key);
        for (let visit = 0; visit < 2; visit++) {
            await page.reload(); await ready(page);
            await page.getByRole('region', {name: 'Unsaved work found'}).waitFor();
            await page.waitForTimeout(1000);
            assert.match(await page.evaluate(key => localStorage.getItem(key), key), /Important/);
        }
        await page.getByRole('region', {name: 'Unsaved work found'}).getByRole('button', {name: 'Restore', exact: true}).click();
        // The editor is populated before the replacement viewer finishes opening.
        await page.locator('.app-toasts').getByText('Restored your unsaved work', {exact: true}).waitFor();
        assert.match(await source(page).inputValue(), /Important/);
        const download = page.waitForEvent('download'); await menu(page, 'Download assets');
        const file = await download; assert.equal(file.suggestedFilename(), 'logo.svg');
        assert.equal(await readFile(await file.path(), 'utf8'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
        assert.equal(await page.evaluate(() => DDN.getViewerHandle(DDN_SITE_STATE.viewer).runtime.sources().entry), 'work.ddn');
    } finally {await s.close();}
});

test('file drops and New confirm dirty replacement; keeping edits preserves the document', async () => {
    const s = await session(); const {page} = s;
    try {
        const text = 'erd KeepMe\n    Valuable\n'; await source(page).fill(text);
        await page.evaluate(() => {
            const transfer = new DataTransfer(); transfer.items.add(new File(['erd Dropped\n'], 'dropped.ddn'));
            document.querySelector('.app-surface').dispatchEvent(new DragEvent('drop', {dataTransfer: transfer, bubbles: true, cancelable: true}));
        });
        let dialog = page.getByRole('dialog', {name: 'Replace your unsaved changes?', exact: true});
        await dialog.getByRole('button', {name: 'Keep editing', exact: true}).click();
        assert.equal(await source(page).inputValue(), text);
        await menu(page, 'New diagram…'); await replace(page);
        dialog = await chooseNewDocument(page);
        await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
        assert.equal(await source(page).inputValue(), '');
        assert.equal(await page.evaluate(key => localStorage.getItem(key), key), null);
        assert.equal(await page.evaluate(() => DDN.getViewerHandle(DDN_SITE_STATE.viewer).runtime.sources().files.length), 1);
        await page.getByRole('button', {name: 'Undo', exact: true}).click();
        assert.equal(await source(page).inputValue(), '');
    } finally {await s.close();}
});

test('slow file reads cannot repopulate a newer document or surface obsolete errors', async () => {
    const s = await session(); const {page} = s;
    try {
        for (const failed of [false, true]) {
            await page.evaluate(() => {
                const file = new File(['erd Late\n'], 'late.ddn');
                file.arrayBuffer = () => new Promise((resolve, reject) => {window.finishRead = failed => failed ? reject(Error('obsolete read failure')) : resolve(new TextEncoder().encode('erd Late\n').buffer);});
                const transfer = new DataTransfer(); transfer.items.add(file);
                document.querySelector('.app-surface').dispatchEvent(new DragEvent('drop', {dataTransfer: transfer, bubbles: true, cancelable: true}));
            });
            await page.waitForFunction(() => typeof window.finishRead === 'function');
            await menu(page, 'New diagram…');
            const dialog = await chooseNewDocument(page);
            await page.evaluate(async failed => {finishRead(failed); delete window.finishRead; await new Promise(resolve => setTimeout(resolve, 30));}, failed);
            assert.equal(await source(page).inputValue(), '');
            assert.doesNotMatch(await page.locator('.app-status').innerText(), /obsolete|Late/);
            await dialog.getByRole('button', {name: 'Cancel', exact: true}).click();
        }
    } finally {await s.close();}
});

test('inline diagnostics include missing includes and Esc then Tab exits source input', async () => {
    const s = await session(); const {page} = s;
    try {
        await source(page).fill('include "missing.ddn"\nerd Example\n');
        await page.locator('.app-diagnostics').getByRole('listitem').first().waitFor();
        assert.match(await page.locator('.app-diagnostics').innerText(), /missing|supplied|found/i);
        await source(page).press('Escape'); await source(page).press('Tab');
        assert.equal(await source(page).evaluate(element => element === document.activeElement), false);
        await page.screenshot({path: join(reports, 'integrated-source-diagnostics.png')});
    } finally {await s.close();}
});

test('Restore and a slow file load protect source typed while they wait', async () => {
    const s = await session(); const {page} = s;
    try {
        await source(page).fill('erd Recovery\n    Older\n'); await downloadSource(page);
        await page.reload(); await ready(page);
        await source(page).fill('erd NewlyTyped\n    Valuable\n');
        await page.getByRole('region', {name: 'Unsaved work found'}).getByRole('button', {name: 'Restore', exact: true}).click();
        await page.getByRole('dialog', {name: 'Replace your unsaved changes?'}).getByRole('button', {name: 'Keep editing', exact: true}).click();
        assert.match(await source(page).inputValue(), /NewlyTyped/);
        await page.getByRole('region', {name: 'Unsaved work found'}).getByRole('button', {name: 'Discard', exact: true}).click();
        await downloadSource(page);
        await page.evaluate(() => {
            const file = new File(['erd Incoming\n'], 'incoming.ddn');
            file.arrayBuffer = () => new Promise(resolve => {window.finishRead = () => resolve(new TextEncoder().encode('erd Incoming\n').buffer);});
            const transfer = new DataTransfer(); transfer.items.add(file);
            document.querySelector('.app-surface').dispatchEvent(new DragEvent('drop', {dataTransfer: transfer, bubbles: true, cancelable: true}));
        });
        await page.waitForFunction(() => typeof window.finishRead === 'function');
        await source(page).fill('erd LaterEdit\n    MustKeep\n');
        await page.evaluate(() => finishRead());
        await page.getByRole('dialog', {name: 'Replace your unsaved changes?'}).getByRole('button', {name: 'Keep editing', exact: true}).click();
        assert.match(await source(page).inputValue(), /MustKeep/);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.ddnDirty), 'true');
    } finally {await s.close();}
});

test('source file switching retains the document root and treats CSS as CSS', async () => {
    const s = await session(); const {page} = s;
    try {
        await page.locator('input[type=file]').setInputFiles([
            {name: 'main.ddn', mimeType: 'text/plain', buffer: Buffer.from('erd Main\n    Customer\n')},
            {name: 'theme.CSS', mimeType: 'text/css', buffer: Buffer.from('* {color: red;}')},
        ]);
        await page.locator('.app-toasts').getByText('Opened main.ddn', {exact: true}).waitFor();
        await page.getByLabel('Source file', {exact: true}).selectOption('theme.CSS');
        await source(page).fill('* {color: blue;}'); await page.waitForTimeout(700);
        assert.equal(await page.locator('.app-diagnostics').textContent(), '');
        assert.equal(await page.evaluate(() => DDN.getViewerHandle(DDN_SITE_STATE.viewer).runtime.sources().entry), 'main.ddn');
    } finally {await s.close();}
});

test('Download still materializes explicitly requested live-data snapshots', async () => {
    const s = await session(); const {page} = s;
    try {
        await source(page).fill('source Live as host\n    with\n        channel updates\ndata Rows from Live\n    with\n        persist snapshot\nview Grid as table.records@1\n    with\n        projection.options\n            records Rows\n            columns 2\n            missing gap\n');
        await page.getByRole('button', {name: 'Apply source', exact: true}).click();
        await page.waitForFunction(() => DDN.getViewerHandle(DDN_SITE_STATE.viewer).runtime.sources().files[0].text.includes('source Live'));
        await page.evaluate(async () => {
            const runtime = DDN.getViewerHandle(DDN_SITE_STATE.viewer).runtime;
            await runtime.ingest({base: runtime.snapshot().revision, origin: 'test', data: [{kind: 'replace', source: 'Live', next: 'data-2', schema: [{id: 'id'}, {id: 'label'}], rows: [[1, 'Current value']]}]});
        });
        const text = await downloadSource(page);
        assert.match(text, /snapshot\n/); assert.match(text, /Current value/); assert.match(text, /data-2/);
    } finally {await s.close();}
});

test('mobile palette and inspector remain usable together without clipping the canvas', async () => {
    const s = await session(); const {page} = s;
    try {
        await source(page).fill('erd Main\n    Customer\n'); await page.getByRole('button', {name: 'Apply source', exact: true}).click();
        await page.waitForFunction(() => DDN.getViewerHandle(DDN_SITE_STATE.viewer).scene()?.entries.some(entry => entry.definition.record.name === 'Customer'));
        await page.getByRole('button', {name: 'Add element', exact: true}).click();
        await page.evaluate(() => {
            const handle = DDN.getViewerHandle(DDN_SITE_STATE.viewer), entry = handle.scene().entries.find(entry => entry.definition.record.name === 'Customer');
            handle.select(entry.definition.ref, entry.item.occurrence);
        });
        await page.getByRole('button', {name: 'Properties', exact: true}).click();
        await page.setViewportSize({width: 390, height: 844});
        await page.getByRole('region', {name: 'Inspector', exact: true}).scrollIntoViewIfNeeded();
        const bounds = await page.evaluate(() => {
            const viewer = document.querySelector('.ddn-viewer'), stage = document.querySelector('.ddn-viewer-stage');
            return {client: viewer.clientWidth, scroll: viewer.scrollWidth, stage: stage.getBoundingClientRect().width, panels: [...document.querySelectorAll('.ddn-designer-dock')].map(node => node.getBoundingClientRect().height)};
        });
        assert.ok(bounds.scroll <= bounds.client + 1, JSON.stringify(bounds)); assert.ok(bounds.stage > 300, JSON.stringify(bounds));
        assert.ok(bounds.panels.every(height => height >= 180), JSON.stringify(bounds));
        await page.screenshot({path: join(reports, 'integrated-mobile-inspector.png'), fullPage: true});
    } finally {await s.close();}
});
