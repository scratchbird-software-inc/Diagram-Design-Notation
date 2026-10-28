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
const source = `workarea Studio
element Idea as note
    with
        content.text "A local design note"
        background.color "#f9e8c4"
view Board as ddn@1
    use Idea named Here
`;
async function session(t, {text = source, selected = 'Idea', appearance = true} = {}) {
    const context = await browser.newContext({viewport: {width: 1400, height: 900}});
    t.after(() => context.close());
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    t.after(() => assert.deepEqual(errors, []));
    await page.goto(pathToFileURL(join(distribution, 'complete/ddn-visual-designer.html')).href);
    await page.waitForFunction(() => !!window.DDN?.createDesigner);
    await page.evaluate(async ({text, selected}) => {
        const container = document.createElement('main'); container.id = 'live-settings-fixture';
        container.style.cssText = 'position:fixed;inset:0;z-index:10000;background:white'; document.body.append(container);
        const runtime = DDN.createRuntime(DDN.createCompleteRuntimeOptions()), viewer = DDN.createViewer(container, {runtime});
        const opened = await viewer.open({entry: 'main.ddn', files: [{id: 'main.ddn', text, revision: 'initial', encoding: 'utf-8', writable: true}]});
        if (!opened.snapshot) throw Error(JSON.stringify(opened.diagnostics));
        const authority = {authorize: async action => {
            if (window.liveHold) { window.liveHold = false; await new Promise(resolve => window.releaseLive = resolve); }
            return {allowed: window.liveAllowed !== false, principal: 'tester', grants: [action]};
        }};
        const handle = DDN.getViewerHandle(viewer), designer = DDN.createDesigner(viewer, {authority});
        await handle.whenRendered();
        const entry = handle.scene().entries.find(item => item.definition.record.name === selected);
        handle.select(entry.definition.ref, entry.item.occurrence);
        window.liveFixture = {container, runtime, viewer, handle, designer, target: entry.definition.ref, authority};
    }, {text, selected});
    const fixture = page.locator('#live-settings-fixture');
    if (!appearance) return {page, fixture};
    await fixture.getByRole('button', {name: 'Appearance & presets', exact: true}).click();
    const dialog = page.getByRole('dialog', {name: 'Appearance & presets', exact: true});
    await dialog.getByLabel('Background colour', {exact: true}).waitFor();
    return {page, fixture, dialog, color: dialog.getByLabel('Background colour', {exact: true})};
}
const currentSource = page => page.evaluate(() => liveFixture.runtime.sources().files[0].text);
async function painted(page, color) {
    await page.waitForFunction(color => liveFixture.handle.scene().entries.find(item => item.definition.record.name === 'Idea')?.effective.background.color === color, color);
    assert.ok(await page.locator(`#live-settings-fixture svg [fill="${color}"]`).count(), 'Canvas SVG uses the new colour');
}

test('a cancelled Save rejects before authorization resumes and leaves the live edit running', async t => {
    const {page, color} = await session(t);
    await page.evaluate(() => {window.liveHold = true;}); await color.fill('#224466');
    await page.waitForFunction(() => !!window.releaseLive);
    await page.evaluate(() => {
        let aborted = false; const handlers = new Set();
        const cancel = {get aborted() {return aborted;}, onAbort(handler) {handlers.add(handler); return () => handlers.delete(handler);}};
        window.savedResult = null;
        window.pendingSave = liveFixture.designer.save({cancel}).then(() => {window.savedResult = {saved: true};}, error => {window.savedResult = {error: error.message};});
        aborted = true; for (const handler of handlers) handler();
    });
    await page.waitForFunction(() => !!window.savedResult);
    assert.match(await page.evaluate(() => savedResult.error), /cancelled/i); assert.equal(await currentSource(page), source);
    await page.evaluate(() => window.releaseLive()); await painted(page, '#224466');
});

test('Save time budget can expire while a live edit waits for authorization', async t => {
    const {page, color} = await session(t);
    await page.evaluate(() => {window.liveHold = true;}); await color.fill('#335577');
    await page.waitForFunction(() => !!window.releaseLive);
    await page.evaluate(() => {
        window.savedResult = null;
        window.pendingSave = liveFixture.designer.save({budget: {elapsedMs: 20, workUnits: 1000000, memoryBytes: 100000000}}).then(() => {window.savedResult = {saved: true};}, error => {window.savedResult = {error: error.message};});
    });
    await page.waitForFunction(() => !!window.savedResult);
    assert.match(await page.evaluate(() => savedResult.error), /budget/i); assert.equal(await currentSource(page), source);
    await page.evaluate(() => window.releaseLive()); await painted(page, '#335577');
});

test('closing the editor and opening a new document during Save never exports that replacement', async t => {
    const {page, dialog, color} = await session(t);
    await page.evaluate(() => {window.liveHold = true;}); await color.fill('#446688');
    await page.waitForFunction(() => !!window.releaseLive);
    await page.evaluate(() => {
        window.savedResult = null;
        window.pendingSave = liveFixture.designer.save().then(async files => {window.savedResult = {text: await files[0].blob.text()};}, error => {window.savedResult = {error: error.message};});
    });
    await dialog.getByRole('button', {name: 'Close', exact: true}).click();
    const replacement = 'erd Replacement\n    NewCustomer\n';
    await page.evaluate(async text => {
        await liveFixture.viewer.open({entry: 'main.ddn', files: [{id: 'main.ddn', text, revision: 'new-document', encoding: 'utf-8', writable: true}]});
        window.releaseLive(); await window.pendingSave;
    }, replacement);
    const result = await page.evaluate(() => savedResult);
    assert.match(result.error, /document changed/i); assert.equal(result.text, undefined); assert.equal(await currentSource(page), replacement);
});

test('appearance updates the actual diagram while its form remains open and a whole session undoes once', async t => {
    const {page, fixture, dialog, color} = await session(t);
    assert.equal(await dialog.getByRole('button', {name: 'Apply', exact: true}).count(), 0);
    await color.fill('#e0aabb'); await painted(page, '#e0aabb');
    await color.fill('#b0ccee'); await painted(page, '#b0ccee');
    assert.equal(await dialog.isVisible(), true); assert.notEqual(await currentSource(page), source);
    await dialog.getByRole('button', {name: 'Close', exact: true}).click();
    await fixture.getByRole('button', {name: 'Undo', exact: true}).click();
    await page.waitForFunction(text => liveFixture.runtime.sources().files[0].text === text, source);
    await painted(page, '#f9e8c4');
    await fixture.getByRole('button', {name: 'Redo', exact: true}).click(); await painted(page, '#b0ccee');
});

test('Revert restores the opening source without requiring Apply', async t => {
    const {page, dialog, color} = await session(t);
    await color.fill('#778899'); await painted(page, '#778899');
    await dialog.getByRole('button', {name: 'Revert changes', exact: true}).click();
    await dialog.waitFor({state: 'detached'}); assert.equal(await currentSource(page), source); await painted(page, '#f9e8c4');
});

test('rapid controls and immediate Close retain the final valid value', async t => {
    const {page, dialog} = await session(t);
    await dialog.evaluate(element => {
        const input = [...element.querySelectorAll('label')].find(label => label.firstChild?.textContent === 'Background colour').querySelector('input');
        for (const value of ['#abcdee', '#ccbbaa', '#112233']) { input.value = value; input.dispatchEvent(new Event('input', {bubbles: true})); }
        [...element.querySelectorAll('footer button')].find(button => button.textContent === 'Close').click();
    });
    await dialog.waitFor({state: 'detached'}); await painted(page, '#112233'); assert.match(await currentSource(page), /#112233/);
});

test('Close remains visible until the pending live commit finishes', async t => {
    const {page, dialog, color} = await session(t);
    await page.evaluate(() => {window.liveHold = true;}); await color.fill('#112233');
    await page.waitForFunction(() => !!window.releaseLive);
    await dialog.getByRole('button', {name: 'Close', exact: true}).click();
    assert.equal(await dialog.isVisible(), true);
    assert.equal(await dialog.getByRole('button', {name: 'Close', exact: true}).isDisabled(), true);
    await page.evaluate(() => window.releaseLive()); await dialog.waitFor({state: 'detached'});
    assert.match(await currentSource(page), /#112233/); await painted(page, '#112233');
});

test('invalid intermediate settings preserve the last valid source and can be corrected', async t => {
    const {page, dialog, color} = await session(t);
    await color.fill('#aabbcc'); await painted(page, '#aabbcc'); const valid = await currentSource(page);
    await color.fill('not a colour'); await dialog.getByRole('alert').waitFor();
    assert.equal(await currentSource(page), valid); await painted(page, '#aabbcc');
    await color.fill('#ddeeff'); await painted(page, '#ddeeff');
    assert.equal(await dialog.getByRole('alert').isVisible(), false);
});

test('unrelated source changes are never overwritten by a stale live editor or Revert', async t => {
    const {page, dialog, color} = await session(t);
    await color.fill('#aabbcc'); await painted(page, '#aabbcc');
    await page.evaluate(async () => {
        const f = liveFixture, service = DDN.createCommandService(f.runtime, f.authority);
        const prepared = await service.prepare({kind: 'set-property', target: f.target, path: 'title', value: 'External title'});
        if (!prepared.ok) throw Error(JSON.stringify(prepared));
        const result = await service.commit(prepared.command.id); if (!result.ok) throw Error(JSON.stringify(result)); await f.handle.refresh();
    });
    const external = await currentSource(page); await color.fill('#223344'); await dialog.getByRole('alert').waitFor();
    assert.equal(await currentSource(page), external); assert.equal(await dialog.getByRole('button', {name: 'Revert changes', exact: true}).isDisabled(), true);
});

test('destroying the designer while authorization waits aborts the old edit', async t => {
    const {page, color} = await session(t);
    await page.evaluate(() => {window.liveHold = true;}); await color.fill('#112233');
    await page.waitForFunction(() => !!window.releaseLive);
    await page.evaluate(() => {liveFixture.designer.destroy(); window.releaseLive();});
    await page.waitForTimeout(100); assert.equal(await currentSource(page), source);
});

test('opening another document while authorization waits cannot receive the old settings', async t => {
    const {page, color} = await session(t);
    await page.evaluate(() => {window.liveHold = true;}); await color.fill('#112233');
    await page.waitForFunction(() => !!window.releaseLive);
    const replacement = 'erd Replacement\n    NewCustomer\n';
    await page.evaluate(async text => {
        await liveFixture.viewer.open({entry: 'main.ddn', files: [{id: 'main.ddn', text, revision: 'new-document', encoding: 'utf-8', writable: true}]});
        window.releaseLive();
    }, replacement);
    await page.waitForTimeout(100); assert.equal(await currentSource(page), replacement);
});

test('typing multiple live comment updates keeps a single note identity and Revert removes the new note', async t => {
    const {page, fixture} = await session(t, {appearance: false});
    await page.evaluate(() => {
        const f = liveFixture, entry = f.handle.scene().entries.find(item => item.definition.record.name === 'Idea');
        const element = f.handle.surface.querySelector('[data-occurrence="' + CSS.escape(entry.item.occurrence) + '"]');
        element.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, clientX: 300, clientY: 250}));
    });
    await fixture.getByRole('menuitem', {name: 'Comments', exact: true}).click();
    const dialog = page.getByRole('dialog', {name: 'Comments', exact: true}), field = dialog.getByLabel('Markdown notes', {exact: true});
    await field.fill('First note');
    await page.waitForFunction(() => liveFixture.handle.scene().entries.find(item => item.definition.record.name === 'Idea')?.definition.record.notes?.[0]?.text === 'First note');
    const before = await page.evaluate(() => liveFixture.handle.scene().entries.find(item => item.definition.record.name === 'Idea').definition.record.notes[0].id);
    await field.fill('Updated note'); await field.fill('Final note **with formatting**');
    await page.waitForFunction(() => liveFixture.handle.scene().entries.find(item => item.definition.record.name === 'Idea')?.definition.record.notes?.[0]?.text === 'Final note **with formatting**');
    const notes = await page.evaluate(() => liveFixture.handle.scene().entries.find(item => item.definition.record.name === 'Idea').definition.record.notes);
    assert.equal(notes.length, 1); assert.equal(notes[0].id, before);
    await dialog.getByRole('button', {name: 'Revert changes', exact: true}).click();
    await dialog.waitFor({state: 'detached'}).catch(async error => {throw Error(error.message + '\n' + await dialog.innerText());});
    assert.equal(await currentSource(page), source);
});

const tableSource = `data Report
    label.value
    Before.2
view Grid as table.records@1
    with
        projection.options
            records Report
            columns
                item
                    id label
                item
                    id value
            missing gap
`;
test('existing dataset cells redraw their view immediately and dataset creation remains explicit', async t => {
    const {page, fixture} = await session(t, {text: tableSource, selected: 'Grid', appearance: false});
    await fixture.getByRole('button', {name: 'Datasets', exact: true}).click();
    const dialog = page.getByRole('dialog', {name: 'Datasets', exact: true});
    await dialog.getByLabel('Dataset name', {exact: true}).fill('LiveData');
    assert.equal(await currentSource(page), tableSource, 'Typing a proposed name does not create data');
    await dialog.getByRole('button', {name: 'Create dataset', exact: true}).click();
    await page.waitForFunction(() => /data LiveData|data "LiveData"/.test(liveFixture.runtime.sources().files[0].text));
    await dialog.getByRole('button', {name: 'Create dataset', exact: true}).waitFor({state: 'hidden'});
    await dialog.getByLabel('Dataset', {exact: true}).selectOption({label: 'Report'});
    const cell = dialog.getByRole('textbox', {name: 'Rows item item', exact: true}).first();
    await cell.fill('After');
    await page.waitForFunction(() => liveFixture.handle.surface.textContent.includes('After'));
    assert.match(await currentSource(page), /After/);
    await dialog.getByRole('button', {name: 'Close', exact: true}).click(); await dialog.waitFor({state: 'detached'});
    await fixture.getByRole('button', {name: 'Undo', exact: true}).click();
    await page.waitForFunction(text => liveFixture.runtime.sources().files[0].text === text, tableSource);
});


test('saving waits for pending live settings without closing their editor', async t => {
    const {page, dialog, color} = await session(t);
    await page.evaluate(() => {window.liveHold = true;}); await color.fill('#567abc');
    await page.waitForFunction(() => !!window.releaseLive);
    await page.evaluate(() => {window.savedText = null; window.liveSave = liveFixture.designer.save().then(async files => {window.savedText = await files[0].blob.text();});});
    assert.equal(await page.evaluate(() => window.savedText), null);
    await page.evaluate(async () => {window.releaseLive(); await window.liveSave;});
    assert.match(await page.evaluate(() => window.savedText), /#567abc/);
    assert.equal(await dialog.isVisible(), true); await painted(page, '#567abc');
});
