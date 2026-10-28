import {allProperties} from './ux-test-helpers.mjs';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const { chromium } = await import(pathToFileURL(join(process.env.DDN_PLAYWRIGHT_ROOT ?? join(root, '.work/tools/browser/node_modules/playwright'), 'index.mjs')));
const reports = join(root, '.work/reports/ddn-floating-settings');
const source = `workarea Studio as ddn
element Idea as note
    with
        title "Design idea"
        background.color "#f5e9d4"
view Board as ddn@1
    use Idea named Here
`;
let browser, page;
const errors = [], network = [];
before(async () => {
    await mkdir(reports, { recursive: true });
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:\/\//, route => { network.push(route.request().url()); return route.abort(); });
    await page.goto(pathToFileURL(join(process.env.DDN_DDN_DISTRIBUTION ?? join(root, '.work/builds/ddn-distribution'), 'complete/ddn-visual-designer.html')).href);
    await page.waitForFunction(() => !!window.DDN);
});
after(async () => { await browser?.close(); });

async function setup(delay = 0) {
    await page.evaluate(async ({text,delay}) => {
        if (window.propertyFixture) {
            const f = window.propertyFixture; f.designer.destroy(); f.viewer.destroy(); f.runtime.destroy(); f.host.remove();
        }
        const host = document.createElement('main'); host.id = 'properties-fixture';
        host.style.cssText = 'position:fixed;inset:0;background:white;z-index:100'; document.body.append(host);
        const runtime = DDN.createRuntime(DDN.createCompleteRuntimeOptions());
        const viewer = DDN.createViewer(host, { runtime });
        await viewer.open({ entry: 'main.ddn', files: [{ id: 'main.ddn', text, revision: '1', encoding: 'utf-8', writable: true }] });
        const designer = DDN.createDesigner(viewer, { authority: { authorize: async action => { window.propertyAuthorizations=(window.propertyAuthorizations??0)+1;if(delay)await new Promise(resolve=>setTimeout(resolve,delay));return { allowed: true, principal: 'test-editor', grants: [action] }; } } });
        const handle = DDN.getViewerHandle(viewer); await handle.whenRendered();
        const entry = handle.scene().entries.find(item => item.definition.record.name === 'Idea');
        handle.select(entry.definition.ref, entry.item.occurrence);
        window.propertyFixture = { host, runtime, viewer, designer, handle };
    }, {text:source,delay});
    return page.locator('#properties-fixture');
}
const sourceText = () => page.evaluate(() => propertyFixture.runtime.sources().files[0].text);
async function open(fixture) {
    await allProperties(fixture);
    const dialog = fixture.getByRole('dialog', { name: 'Properties', exact: true });
    await dialog.getByLabel('Setting', { exact: true }).locator('option').first().waitFor({ state: 'attached' });
    return dialog;
}
async function apply(dialog) {
    await dialog.getByText('Changes update the diagram immediately.',{exact:true}).waitFor();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    await page.evaluate(() => propertyFixture.handle.whenRendered());
}

test('typed properties preserve unchanged defaults and commit live sliders as one undoable edit', async () => {
    const fixture = await setup(), before = await sourceText();
    let dialog = await open(fixture);
    assert.match(await dialog.innerText(), /Editing:/);
    assert.equal(await dialog.getByLabel('Setting', { exact: true }).locator('option[value="design.state"]').count(), 0);
    await apply(dialog); assert.equal(await sourceText(), before);
    dialog = await open(fixture);
    await dialog.getByLabel('Setting', { exact: true }).selectOption('opacity');
    const opacity = dialog.getByRole('slider', { name: 'Opacity slider', exact: true });
    await opacity.fill('0.6');
    assert.equal(await dialog.getByLabel('Opacity', { exact: true }).inputValue(), '0.6');
    await dialog.getByLabel('Setting', { exact: true }).selectOption('style.font_size');
    await dialog.getByRole('slider', { name: 'Font size (pt) slider', exact: true }).fill('18');
    await page.waitForFunction(()=>propertyFixture.handle.scene().entries.some(item=>item.definition.record.name==='Idea'&&item.effective.opacity===.6));
    assert.notEqual(await sourceText(), before);
    await page.screenshot({ path: join(reports, 'floating-properties.png') });
    await apply(dialog);
    const values = await page.evaluate(() => propertyFixture.handle.scene().entries.find(item => item.definition.record.name === 'Idea').effective);
    assert.equal(values.opacity, .6); assert.equal(values.style.font_size, 24);
    await fixture.getByRole('button', { name: 'Undo', exact: true }).click();
    await page.waitForFunction(before => propertyFixture.runtime.sources().files[0].text === before, before);
    assert.equal(await sourceText(), before);
});

test('property reset retains inheritance and advanced edits remain explicit', async () => {
    const fixture = await setup(), before = await sourceText();
    let dialog = await open(fixture);
    await dialog.getByLabel('Apply settings to', { exact: true }).selectOption({ label: 'Shared element' });
    await dialog.getByLabel('Setting', { exact: true }).selectOption('background.color');
    await dialog.getByLabel('Reset to inherited value (omit here)', { exact: true }).check();
    await apply(dialog);
    assert.doesNotMatch(await sourceText(), /background.color/);
    await fixture.getByRole('button', { name: 'Undo', exact: true }).click();
    await page.waitForFunction(before => propertyFixture.runtime.sources().files[0].text === before, before);
    dialog = await open(fixture);
    await dialog.getByText('Advanced property', { exact: true }).click();
    await dialog.getByLabel('Property path', { exact: true }).fill('design.state');
    await dialog.getByLabel('Value (text, number, boolean, or structured JSON)', { exact: true }).fill('accepted');
    await dialog.getByRole('alert').waitFor();
    assert.equal(await sourceText(), before);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
});


test('returning a rejected property to its original value clears the failed edit', async () => {
    const fixture=await setup(),before=await sourceText(),dialog=await open(fixture);
    await dialog.getByLabel('Apply settings to',{exact:true}).selectOption({label:'Shared element'});
    await dialog.getByLabel('Setting',{exact:true}).selectOption('background.color');
    const colour=dialog.getByLabel('Background colour',{exact:true});await colour.fill('bad');await dialog.getByRole('alert').waitFor();
    assert.equal(await sourceText(),before);
    await colour.fill('#f5e9d4');await dialog.getByText('Changes update the diagram immediately.',{exact:true}).waitFor();
    assert.equal(await sourceText(),before);assert.equal(await dialog.getByRole('alert').count(),0);
    await apply(dialog);
});

test('returning a property to its initial value while an edit is in flight preserves the latest input', async () => {
    const fixture=await setup(35),before=await sourceText(),dialog=await open(fixture);
    await dialog.getByLabel('Apply settings to',{exact:true}).selectOption({label:'Shared element'});
    await dialog.getByLabel('Setting',{exact:true}).selectOption('background.color');
    await page.evaluate(()=>{window.propertyAuthorizations=0;});
    const colour=dialog.getByLabel('Background colour',{exact:true});await colour.fill('#112233');
    await page.waitForFunction(()=>window.propertyAuthorizations>0);await colour.fill('#f5e9d4');
    await dialog.getByText('Changes update the diagram immediately.',{exact:true}).waitFor();
    assert.equal(await sourceText(),before);
    const effective=await page.evaluate(()=>propertyFixture.handle.scene().entries.find(item=>item.definition.record.name==='Idea').effective.background.color);
    assert.equal(effective,'#f5e9d4');await apply(dialog);
});
