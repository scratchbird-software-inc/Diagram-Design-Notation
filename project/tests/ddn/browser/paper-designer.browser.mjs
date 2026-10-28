import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const distribution = process.env.DDN_DDN_DISTRIBUTION ?? resolve(root, '.work/builds/ddn-distribution');
const tool = process.env.DDN_PLAYWRIGHT_ROOT ?? resolve(root, '.work/tools/browser/node_modules/playwright');
const { chromium } = await import(pathToFileURL(join(tool, 'index.mjs')));
let browser, page;
const errors = [];
const source = `// Keep this source comment exactly.
element Idea as note
    with
        title "Keep the original"
        style.font mono
view Board as ddn@1
    use Idea named Here
        with
            background.color "#fff4c4"
view Other as ddn@1
    use Idea named There
`;
before(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(join(distribution, 'ddn-visual-designer.html')).href);
    await page.waitForFunction(() => !!window.DDN?.createDesigner);
});
after(async () => { await browser?.close(); });
async function setup(text = source, editing = true) {
    const result = await page.evaluate(async ({ text, editing }) => {
        if (window.paperFixture) { const f = window.paperFixture; f.designer?.destroy(); f.viewer.destroy(); f.runtime.destroy(); f.container.remove(); }
        const container = document.createElement('main'); container.id = 'paper-fixture'; container.style.cssText = 'position:fixed;inset:0;background:white;z-index:1000;padding:10px'; document.body.append(container);
        const runtime = DDN.createRuntime(DDN.createNativeRuntimeOptions()), viewer = DDN.createViewer(container, { runtime });
        const opened = await viewer.open({ entry: 'main.ddn', files: [{ id: 'main.ddn', text, revision: 'one', encoding: 'utf-8', writable: true }] });
        const designer = editing ? DDN.createDesigner(viewer, { authority: { authorize: async action => ({ allowed: true, principal: 'paper-reviewer', grants: [action] }) } }) : undefined;
        window.paperFixture = { container, runtime, viewer, designer, handle: DDN.getViewerHandle(viewer) };
        return { loaded: !!opened.snapshot, diagnostics: opened.diagnostics };
    }, { text, editing });
    assert.equal(result.loaded, true, JSON.stringify(result.diagnostics));
    return page.locator('#paper-fixture');
}
async function select(name = 'Idea', view = 'Board') {
    await page.evaluate(({ name, view }) => {
        const { handle } = window.paperFixture, entry = handle.scene().entries.find(e => e.definition.record.name === name && e.view.record.name === view);
        if (!entry) throw Error('Missing requested source occurrence');
        handle.select(entry.definition.ref, entry.item.occurrence);
    }, { name, view });
}
async function openDialog(fixture) {
    const button = fixture.getByRole('button', { name: 'Paper & attachments', exact: true });
    if (await button.isVisible()) await button.click();
    else {
        await fixture.getByRole('button', {name: 'Properties', exact: true}).click();
        await fixture.getByRole('region', {name: 'Inspector', exact: true}).getByRole('button', {name: 'Paper & attachments…', exact: true}).click();
    }
    const dialog = fixture.getByRole('dialog', { name: 'Paper & attachments' });
    await dialog.getByRole('group', {name: 'Paper surface', exact: true}).waitFor();
    return dialog;
}
async function applyDialog(dialog) {
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await dialog.waitFor({ state: 'detached', timeout: 5000 });
    await page.evaluate(() => window.paperFixture.handle.whenRendered());
}
const choose = (dialog, label, value) => dialog.getByRole('group', {name: label, exact: true}).locator(`[data-choice-value="${value}"]`).click();
const fileText = () => page.evaluate(() => window.paperFixture.runtime.sources().files[0].text);
const documentValue = () => page.evaluate(() => window.paperFixture.runtime.snapshot().normalized.files[0].document);

test('paper editor preserves untouched defaults, source formatting and read-only viewer separation', async () => {
    const fixture = await setup(); await select();
    const before = await fileText(), dialog = await openDialog(fixture);
    assert.equal(await dialog.getByLabel('Apply appearance settings to').inputValue(), '0');
    assert.equal(await dialog.getByLabel('Inherit paper surface', { exact: true }).isChecked(), true);
    await applyDialog(dialog); assert.equal(await fileText(), before);
    assert.equal(await page.evaluate(() => window.paperFixture.designer.isDirty()), false);
    const readonly = await setup(source, false); assert.equal(await readonly.getByRole('button', { name: 'Paper & attachments', exact: true }).count(), 0);
});

test('paper colours, shadows and attachments save as one undoable occurrence edit', async () => {
    const fixture = await setup(); await select(); const before = await fileText(), dialog = await openDialog(fixture);
    await choose(dialog, 'Paper surface', 'pad');
    await dialog.getByLabel('Paper colour', { exact: true }).fill('#b9e8dc');
    await choose(dialog, 'Shadow shape', 'corners');
    await dialog.getByLabel('Shadow colour', { exact: true }).fill('#315f50');
    await dialog.getByLabel('Shadow opacity', { exact: true }).fill('0.3');
    await dialog.getByRole('button', { name: 'Add attachment', exact: true }).click();
    await choose(dialog, 'Attachment kind', 'paper-clip');
    await dialog.getByLabel('Attachment colour', { exact: true }).fill('#955dcc');
    await choose(dialog, 'Attachment position', 'rt');
    await dialog.getByLabel('Attachment rotation', { exact: true }).fill('23');
    await dialog.getByLabel('Attachment horizontal offset', { exact: true }).fill('-8');
    await applyDialog(dialog);
    const after = await fileText(), doc = await documentValue(), here = doc.appearances.find(a => a.name === 'Here'), there = doc.appearances.find(a => a.name === 'There'), definition = doc.definitions.find(d => d.name === 'Idea');
    assert.equal(here.style.paper, 'pad'); assert.equal(here.background.color, '#b9e8dc');
    assert.equal(here.shadow.kind, 'corners'); assert.equal(here.shadow.color, '#315f50'); assert.equal(here.shadow.opacity, .3);
    assert.deepEqual(here.decorations, [{ kind: 'paper-clip', color: '#955dcc', position: 'rt', rotation: 23, offset: { x: -8 } }]);
    assert.equal(here.style.font, undefined); assert.equal(definition.style.font, 'mono'); assert.equal(definition.style.paper, undefined); assert.equal(there.decorations, undefined);
    assert.match(after, /^\/\/ Keep this source comment exactly\./); assert.match(after, /title "Keep the original"/);
    await fixture.getByRole('button', { name: 'Undo', exact: true }).click(); await page.waitForFunction(text => window.paperFixture.runtime.sources().files[0].text === text, before);
    await fixture.getByRole('button', { name: 'Redo', exact: true }).click(); await page.waitForFunction(text => window.paperFixture.runtime.sources().files[0].text === text, after);
});

test('inherit removes one setting; invalid attachment sizes keep the last valid edit and Revert restores the session', async () => {
    const fixture = await setup(); await select(); let dialog = await openDialog(fixture);
    await dialog.getByLabel('Inherit paper colour', { exact: true }).check(); await applyDialog(dialog);
    const doc = await documentValue(); assert.equal(doc.appearances.find(a => a.name === 'Here').background?.color, undefined); assert.equal(doc.definitions.find(d => d.name === 'Idea').style.font, 'mono');
    const before = await fileText(); dialog = await openDialog(fixture);
    await choose(dialog, 'Paper surface', 'note');
    await dialog.getByRole('button', { name: 'Add attachment', exact: true }).click();
    await dialog.getByLabel('Attachment size', { exact: true }).fill('129');
    await dialog.getByRole('alert').filter({hasText: /Attachment size/}).waitFor();
    const current = (await documentValue()).appearances.find(a => a.name === 'Here');
    assert.equal(current.style.paper, 'note'); assert.notEqual(current.decorations?.[0]?.size, 129);
    await dialog.getByRole('button', {name: 'Revert changes', exact: true}).click();
    await page.waitForFunction(before => window.paperFixture.runtime.sources().files[0].text === before, before);
});

test('shared definition and view scopes accept attachments without changing review state', async () => {
    const fixture = await setup('erd Board\n    Idea\n'); await select(); let dialog = await openDialog(fixture);
    assert.equal(await dialog.getByLabel('Apply appearance settings to').locator('option').count(), 1);
    await choose(dialog, 'Paper surface', 'note'); await applyDialog(dialog);
    assert.equal((await documentValue()).definitions.find(d => d.name === 'Idea').style.paper, 'note');
    await select('Board'); dialog = await openDialog(fixture);
    await dialog.getByLabel('Paper colour', { exact: true }).fill('#f5efd9');
    await dialog.getByRole('button', { name: 'Add attachment', exact: true }).click();
    await choose(dialog, 'Attachment kind', 'tape');
    await applyDialog(dialog);
    const view = (await documentValue()).views.find(v => v.name === 'Board');
    assert.equal(view.background.color, '#f5efd9'); assert.deepEqual(view.decorations, [{ kind: 'tape' }]); assert.notEqual(view.design?.state, 'accepted');
});

test('existing shadow objects display their default shape and attachment removal preserves siblings', async () => {
    const text = source.replace('background.color "#fff4c4"', 'background.color "#fff4c4"\n            shadow\n                color "#314151"\n            decorations\n                item\n                    kind push-pin\n                    color "#bb2244"\n                item\n                    kind tape\n                    opacity 0.5');
    const fixture = await setup(text); await select(); const dialog = await openDialog(fixture);
    assert.equal(await dialog.getByRole('group', {name: 'Shadow shape', exact: true}).getByRole('button', {name: 'Uniform offset', exact: true}).getAttribute('aria-pressed'), 'true');
    assert.equal(await dialog.getByLabel('Shadow colour', { exact: true }).inputValue(), '#314151');
    await dialog.getByRole('button', { name: 'Remove attachment', exact: true }).first().click();
    await applyDialog(dialog);
    const here = (await documentValue()).appearances.find(a => a.name === 'Here');
    assert.deepEqual(here.shadow, { color: '#314151' }); assert.deepEqual(here.decorations, [{ kind: 'tape', opacity: .5 }]);
});

test('native colour pickers synchronize text, preserve alpha and save real appearance values', async () => {
    const fixture = await setup(); await select(); const dialog = await openDialog(fixture);
    const paper = dialog.getByLabel('Paper colour', { exact: true }), paperPicker = dialog.getByLabel('Paper colour picker', { exact: true });
    await paper.fill('#1238bf80'); assert.equal(await paperPicker.inputValue(), '#1238bf');
    await paperPicker.fill('#55aacc'); assert.equal(await paper.inputValue(), '#55aacc80');
    assert.equal(await dialog.getByLabel('Inherit paper colour', { exact: true }).isChecked(), false);
    await dialog.getByLabel('Shadow colour picker', { exact: true }).fill('#425364');
    assert.equal(await dialog.getByLabel('Shadow colour', { exact: true }).inputValue(), '#425364');
    await dialog.getByRole('button', { name: 'Add attachment', exact: true }).click();
    await choose(dialog, 'Attachment kind', 'paper-clip');
    assert.equal(await dialog.getByLabel('Attachment colour picker', { exact: true }).inputValue(), '#5b83b4');
    await dialog.getByLabel('Attachment colour', { exact: true }).fill('#abc');
    assert.equal(await dialog.getByLabel('Attachment colour picker', { exact: true }).inputValue(), '#aabbcc');
    await dialog.getByLabel('Attachment colour picker', { exact: true }).fill('#de3488');
    await applyDialog(dialog);
    const here = (await documentValue()).appearances.find(a => a.name === 'Here');
    assert.equal(here.background.color, '#55aacc80'); assert.equal(here.shadow.color, '#425364'); assert.equal(here.decorations[0].color, '#de3488');
    const reopened = await openDialog(fixture); await reopened.getByLabel('Paper colour', { exact: true }).fill('transparent'); await applyDialog(reopened);
    assert.equal((await documentValue()).appearances.find(a => a.name === 'Here').background.color, 'transparent');
});

test('inherited shadow leaves display offset without writing an explicit shadow on the occurrence', async () => {
    const text = source.replace('style.font mono', 'style.font mono\n        shadow\n            color "#314151"');
    const fixture = await setup(text); await select(); const dialog = await openDialog(fixture);
    assert.equal(await dialog.getByRole('group', {name: 'Shadow shape', exact: true}).getByRole('button', {name: 'Uniform offset', exact: true}).getAttribute('aria-pressed'), 'true');
    assert.equal(await dialog.getByLabel('Shadow colour', { exact: true }).inputValue(), '#314151');
    assert.equal(await dialog.getByLabel('Inherit shadow shape', { exact: true }).isChecked(), true);
    await applyDialog(dialog); assert.equal(await fileText(), text);
});

test('shadow offset controls follow contextual defaults without authoring untouched offsets', async () => {
    const fixture = await setup(); await select(); const dialog = await openDialog(fixture);
    const shape = dialog.getByLabel('Shadow shape', { exact: true }), x = dialog.getByLabel('Shadow horizontal offset', { exact: true }), y = dialog.getByLabel('Shadow vertical offset', { exact: true });
    assert.equal(await x.inputValue(), '0'); assert.equal(await y.inputValue(), '0');
    await choose(dialog, 'Shadow shape', 'offset'); assert.equal(await x.inputValue(), '6'); assert.equal(await y.inputValue(), '8');
    await choose(dialog, 'Shadow shape', 'corners'); assert.equal(await x.inputValue(), '0'); assert.equal(await y.inputValue(), '0');
    await choose(dialog, 'Shadow shape', 'offset'); await x.fill('-21'); await choose(dialog, 'Shadow shape', 'centre');
    assert.equal(await x.inputValue(), '-21'); assert.equal(await y.inputValue(), '0');
    await dialog.getByLabel('Shadow spread', { exact: true }).fill('17'); await applyDialog(dialog);
    const shadow = (await documentValue()).appearances.find(a => a.name === 'Here').shadow;
    assert.deepEqual(shadow, { kind: 'centre', x: -21, spread: 17 });
});

test('authored shadow offsets survive a shape change and remain directly editable', async () => {
    const text = source.replace('background.color "#fff4c4"', 'background.color "#fff4c4"\n            shadow\n                kind offset\n                x 12\n                y -14\n                spread 3');
    const fixture = await setup(text); await select(); const dialog = await openDialog(fixture);
    await choose(dialog, 'Shadow shape', 'corner');
    assert.equal(await dialog.getByLabel('Shadow horizontal offset', { exact: true }).inputValue(), '12');
    assert.equal(await dialog.getByLabel('Shadow vertical offset', { exact: true }).inputValue(), '-14');
    await dialog.getByLabel('Shadow vertical offset', { exact: true }).fill('22'); await applyDialog(dialog);
    assert.deepEqual((await documentValue()).appearances.find(a => a.name === 'Here').shadow, { kind: 'corner', x: 12, y: 22, spread: 3 });
});

test('keyboard movement uses semantic body and frame origins when paint bounds extend beyond them', async () => {
    const fixture = await setup(); await select('Idea', 'Other');
    const before = await page.evaluate(() => {
        const { handle } = window.paperFixture, entry = handle.selectedEntry(), frame = handle.scene().entries.find(e => e.definition.owner === 'view' && e.definition.ref.id === entry.view.ref.id);
        const body = entry.item.hitTargets[0].bounds, parent = frame.item.hitTargets[0].bounds;
        // The presentation contract permits paint bounds to include effects.
        // Inject that condition independently of any one shadow implementation.
        entry.item.bounds = { x: body.x - 30, y: body.y - 40, width: body.width + 60, height: body.height + 80 };
        frame.item.bounds = { x: parent.x - 20, y: parent.y - 10, width: parent.width + 40, height: parent.height + 20 };
        return { x: body.x - parent.x, y: body.y - parent.y };
    });
    await fixture.getByRole('button', { name: 'Paper & attachments', exact: true }).focus(); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => !!window.paperFixture.handle.selectedEntry()?.appearance?.record.position);
    const position = await page.evaluate(() => window.paperFixture.handle.selectedEntry().appearance.record.position);
    assert.equal(position.x, before.x + 16); assert.equal(position.y, before.y); assert.deepEqual(errors, []);
});

test('resizing uses the semantic body size instead of expanded paint bounds', async () => {
    await setup(); await select();
    const drag = await page.evaluate(async () => {
        const { handle, viewer } = window.paperFixture, entry = handle.selectedEntry();
        await viewer.navigate({ kind: 'focus', target: entry.definition.ref });
        const body = entry.item.hitTargets.find(hit => hit.target.id === entry.definition.ref.id).bounds;
        const screen = new DOMPoint(body.x + body.width / 2, body.y + body.height / 2).matrixTransform(handle.surface.getScreenCTM());
        const from = handle.toWorld(screen.x, screen.y), to = handle.toWorld(screen.x + 36, screen.y + 24);
        entry.item.bounds = { x: body.x - 30, y: body.y - 40, width: body.width + 60, height: body.height + 80 };
        return { x: screen.x, y: screen.y, width: body.width + to.x - from.x, height: body.height + to.y - from.y };
    });
    await page.keyboard.down('Alt'); await page.mouse.move(drag.x, drag.y); await page.mouse.down(); await page.mouse.move(drag.x + 36, drag.y + 24, { steps: 4 }); await page.mouse.up(); await page.keyboard.up('Alt');
    await page.waitForFunction(() => !!window.paperFixture.handle.selectedEntry()?.appearance?.record.size);
    const size = await page.evaluate(() => window.paperFixture.handle.selectedEntry().appearance.record.size);
    assert.ok(Math.abs(size.width - drag.width) < 1); assert.ok(Math.abs(size.height - drag.height) < 1); assert.deepEqual(errors, []);
});
