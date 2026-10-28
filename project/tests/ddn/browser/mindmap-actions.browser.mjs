import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const distribution = process.env.DDN_DDN_DISTRIBUTION ?? resolve(root, '.work/builds/ddn-distribution');
const tool = process.env.DDN_PLAYWRIGHT_ROOT ?? resolve(root, '.work/tools/browser/node_modules/playwright');
const { chromium } = await import(pathToFileURL(join(tool, 'index.mjs')));
const source = '// Preserve this comment.\nmindmap Plan\n    Research\n        Interviews\n    Delivery\n';
let browser, page; const errors = [];
before(async () => {
    browser = await chromium.launch({ headless: true }); page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
    page.on('pageerror', error => errors.push(error.message)); await page.goto(pathToFileURL(join(distribution, 'ddn-visual-designer.html')).href);
    await page.waitForFunction(() => !!window.DDN?.createDesigner);
});
after(async () => { await browser?.close(); });
async function setup({ editing = true, allowed = true } = {}) {
    await page.evaluate(async ({ source, editing, allowed }) => {
        if (window.mindmapFixture) { const f = mindmapFixture; f.designer?.destroy(); f.viewer.destroy(); f.runtime.destroy(); f.container.remove(); }
        const container = document.createElement('main'); container.id = 'mindmap-fixture'; container.style.cssText = 'position:fixed;inset:0;z-index:1000;padding:10px;background:white'; document.body.append(container);
        const runtime = DDN.createRuntime(DDN.createNativeRuntimeOptions()), viewer = DDN.createViewer(container, { runtime });
        const opened = await viewer.open({ entry: 'main.ddn', files: [{ id: 'main.ddn', text: source, revision: 'one', encoding: 'utf-8', writable: true }] });
        if (!opened.snapshot) throw Error(JSON.stringify(opened.diagnostics));
        const designer = editing ? DDN.createDesigner(viewer, { authority: { authorize: async action => ({ allowed, principal: 'mindmap-test', grants: allowed ? [action] : [] }) } }) : undefined;
        window.mindmapFixture = { container, runtime, viewer, designer, handle: DDN.getViewerHandle(viewer) }; await viewer.navigate({ kind: 'fit-workarea' });
    }, { source, editing, allowed });
    return page.locator('#mindmap-fixture');
}
async function select(name = 'Plan') {
    await page.evaluate(name => {
        const f = mindmapFixture, entry = f.handle.scene().entries.find(item => item.definition.owner === 'definition' && item.definition.record.category !== 'relation' && (item.definition.record.name === name || item.definition.record.title === name));
        if (!entry) throw Error('Missing topic: ' + name); f.handle.select(entry.definition.ref, entry.item.occurrence);
    }, name);
}
const text = () => page.evaluate(() => mindmapFixture.runtime.sources().files[0].text);
const actionBar = () => page.getByRole('toolbar', { name: 'Mind map topic actions' });
async function applyDialog(dialog) { const apply = dialog.getByRole('button', {name: 'Apply', exact: true}); await (await apply.count() ? apply : dialog.getByRole('button', {name: 'Close', exact: true})).click(); await dialog.waitFor({ state: 'detached' }); await page.evaluate(() => mindmapFixture.handle.whenRendered()); }
async function cancelDialog() { const dialog = page.locator('#mindmap-fixture').getByRole('dialog'); if (await dialog.count()) { const cancel = dialog.getByRole('button', {name: 'Cancel', exact: true}); await (await cancel.count() ? cancel : dialog.getByRole('button', {name: 'Close', exact: true})).click(); await dialog.waitFor({ state: 'detached' }); } }

test('selection controls show allowed branch sides, stay screen-sized under zoom, and isolate keyboard input', async () => {
    const f = await setup(); await select();
    assert.equal(await actionBar().getByRole('button').count(), 5);
    assert.equal(await actionBar().getByRole('button', { name: 'Add linked topic to the left' }).count(), 1);
    assert.equal(await actionBar().getByRole('button', { name: 'Add linked topic to the right' }).count(), 1);
    const geometry = async () => actionBar().getByRole('button').evaluateAll(buttons => buttons.map(button => { const r = button.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
    const first = await geometry(); for (const b of first) { assert.equal(b.width, 26); assert.equal(b.height, 26); }
    const spacing = first.slice(1).map((b, i) => b.x - first[i].x); assert.ok(Math.max(...spacing) - Math.min(...spacing) < 1);
    await f.getByRole('button', { name: '+', exact: true }).click(); const zoomed = await geometry(); assert.equal(zoomed[0].width, 26); assert.notEqual(zoomed[0].x, first[0].x);
    await actionBar().getByRole('button', { name: 'Edit topic name' }).focus(); const before = await text(); await page.keyboard.press('ArrowLeft'); assert.equal(await text(), before);
    await select('Research'); assert.equal(await actionBar().getByRole('button').count(), 4);
    const right = await page.evaluate(() => { const f = mindmapFixture, a = f.handle.selectedEntry(), root = f.handle.scene().entries.find(e => e.definition.record.title === 'Plan'); return a.item.bounds.x > root.item.bounds.x; });
    assert.equal(await actionBar().getByRole('button', { name: 'Add linked topic to ' + (right ? 'the right' : 'the left') }).count(), 1);
    const capture = await page.evaluate(async () => { const result = await mindmapFixture.viewer.capture({ scope: { kind: 'workarea' }, format: 'svg', extent: 'content', stale: 'reject', partial: 'reject', includePreview: false }); return result.ok ? await result.artifacts[0].blob.text() : ''; });
    assert.match(capture, /<svg/); assert.doesNotMatch(capture, /ddn-mindmap-actions|Add linked topic|⥆|⥅/);
    await setup({ editing: false }); await select(); assert.equal(await actionBar().count(), 0);
});
test('adding a linked topic is one authorized source edit with exact undo and a persisted side', async () => {
    const f = await setup(); await select(); const before = await text();
    await actionBar().getByRole('button', { name: 'Add linked topic to the left' }).click();
    const dialog = f.getByRole('dialog', { name: 'Edit topic name' }); await dialog.waitFor();
    const after = await text(); assert.match(after, /route\.source_side west/); assert.match(after, /connect .* to "New topic" as assoc/);
    assert.match(after, /^\/\/ Preserve this comment\./); await cancelDialog();
    const saved = await page.evaluate(async () => {
        const f = mindmapFixture, artifacts = await f.designer.save(), files = await Promise.all(artifacts.map(async artifact => ({ id: artifact.name, text: await artifact.blob.text(), revision: 'saved', encoding: 'utf-8', writable: true })));
        const reload = DDN.createRuntime(DDN.createNativeRuntimeOptions());
        try { const opened = await reload.open({ entry: 'main.ddn', files }); const report = await reload.verifier.verifyModel(opened.snapshot, { scope: { kind: 'workarea' }, purpose: 'design', level: 'semantic' }); return { outcome: report.outcome, definitions: opened.snapshot.normalized.files[0].document.definitions.map(item => ({ id: item.id, name: item.name })) }; }
        finally { reload.destroy(); }
    });
    assert.equal(saved.outcome, 'valid'); assert.ok(saved.definitions.some(item => item.name === 'New topic'));
    await f.getByRole('button', { name: 'Undo', exact: true }).click(); await page.waitForFunction(before => mindmapFixture.runtime.sources().files[0].text === before, before);
    await page.waitForFunction(() => !mindmapFixture.handle.scene()?.entries.some(item => item.definition.record.name === 'New topic'));
    await f.getByRole('button', { name: 'Redo', exact: true }).click(); await page.waitForFunction(after => mindmapFixture.runtime.sources().files[0].text === after, after);
    await page.waitForFunction(() => mindmapFixture.handle.scene()?.entries.some(item => item.definition.record.name === 'New topic'));
    // Undo removes the selected item. Source history does not restore UI selection.
    await select('New topic');
    assert.equal(await page.evaluate(() => mindmapFixture.handle.selectedEntry()?.definition.record.name), 'New topic');
});
test('a central topic retains both outgoing controls with an external incoming relationship at its top', async () => {
    await setup();
    await page.evaluate(async () => {
        const f = mindmapFixture;
        await f.viewer.open({ entry: 'main.ddn', files: [{ id: 'main.ddn', revision: 'two', encoding: 'utf-8', writable: true, text: 'element Outside as note\nelement Central as object\nelement Child as object\nconnect Outside to Central as assoc named Context\nconnect Central to Child as assoc named Branch\nview Map as mindmap.basic@1\n    use Outside\n    use Central\n    use Child\n    use Context\n        with\n            route.target_side north\n    use Branch\n' }] });
        await f.viewer.navigate({ kind: 'fit-workarea' });
    });
    await select('Central'); assert.equal(await actionBar().getByRole('button').count(), 5);
    await select('Outside'); assert.equal(await actionBar().isVisible(), false);
});
test('compact central topic name and notes can be added, edited and deleted without renaming its view', async () => {
    const f = await setup(); await select(); await actionBar().getByRole('button', { name: 'Edit topic name' }).click();
    let dialog = f.getByRole('dialog', { name: 'Edit topic name' }); await dialog.getByRole('textbox', { name: 'Topic name' }).fill('Launch plan'); await applyDialog(dialog);
    assert.equal(await page.evaluate(() => mindmapFixture.runtime.snapshot().normalized.files[0].document.views[0].name), 'Plan');
    await select('Launch plan'); await actionBar().getByRole('button', { name: 'Add, edit or delete topic notes' }).click();
    dialog = f.getByRole('dialog', { name: 'Topic notes' }); await dialog.getByRole('textbox', { name: 'Markdown note' }).fill('## Agenda\n\nTalk about **launch**.'); await applyDialog(dialog);
    await select('Launch plan'); await actionBar().getByRole('button', { name: 'Add, edit or delete topic notes' }).click();
    dialog = f.getByRole('dialog', { name: 'Topic notes' }); assert.match(await dialog.getByRole('textbox', { name: 'Markdown note' }).inputValue(), /Agenda/); await dialog.getByRole('textbox', { name: 'Markdown note' }).fill('Revised agenda.'); await applyDialog(dialog);
    await actionBar().getByRole('button', { name: 'Add, edit or delete topic notes' }).click(); dialog = f.getByRole('dialog', { name: 'Topic notes' }); await dialog.getByRole('button', {name: 'Delete selected note', exact: true}).click(); await applyDialog(dialog);
    assert.deepEqual(await page.evaluate(() => mindmapFixture.handle.selectedEntry().definition.record.notes), []);
});
test('editing an ordinary child preserves compact notation and editing a shared topic leaves its readonly view untouched', async () => {
    const f = await setup(); await select('Research'); await actionBar().getByRole('button', { name: 'Edit topic name' }).click();
    let dialog = f.getByRole('dialog', { name: 'Edit topic name' }); await dialog.getByRole('textbox', { name: 'Topic name' }).fill('Research options'); await applyDialog(dialog);
    assert.match(await text(), /mindmap Plan\n/); assert.doesNotMatch(await text(), /view Plan as mindmap/);
    await page.evaluate(async () => {
        const f = mindmapFixture;
        await f.viewer.open({ entry: 'sub/map.ddn', files: [
            { id: 'sub/map.ddn', text: 'include "../topics.ddn"\nview Plan as mindmap.basic@1\n    use "../topics.ddn"::Shared\n', revision: 'one', encoding: 'utf-8', writable: false },
            { id: 'topics.ddn', text: 'element Shared as object\n', revision: 'one', encoding: 'utf-8', writable: true },
        ] }); await f.viewer.navigate({ kind: 'fit-workarea' });
    });
    await select('Shared'); const before = await text(); await actionBar().getByRole('button', { name: 'Edit topic name' }).click();
    dialog = f.getByRole('dialog', { name: 'Edit topic name' }); await dialog.getByRole('textbox', { name: 'Topic name' }).fill('Shared topic'); await applyDialog(dialog);
    assert.equal(await text(), before); assert.match(await page.evaluate(() => mindmapFixture.runtime.sources().files.find(file => file.id === 'topics.ddn').text), /title "Shared topic"/);
});
test('deleting a branch requires explicit descendant consent and undo restores the compact source', async () => {
    const f = await setup(); await select('Research'); const before = await text(); await actionBar().getByRole('button', { name: 'Delete topic', exact: true }).click();
    const dialog = f.getByRole('dialog', { name: 'Delete topic' }); await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await dialog.getByText('This topic has children.', { exact: false }).waitFor(); assert.equal(await text(), before);
    await dialog.getByRole('checkbox', { name: 'Also delete its 1 descendant topic(s)' }).check(); await applyDialog(dialog);
    const names = await page.evaluate(() => mindmapFixture.runtime.snapshot().normalized.files[0].document.definitions.map(item => item.name)); assert.ok(!names.includes('Research')); assert.ok(!names.includes('Interviews')); assert.ok(names.includes('Delivery'));
    await f.getByRole('button', { name: 'Undo', exact: true }).click(); await page.waitForFunction(before => mindmapFixture.runtime.sources().files[0].text === before, before);
});
test('denied branch creation never changes sources or opens the name editor', async () => {
    const f = await setup({ allowed: false }); await select(); const before = await text(); await actionBar().getByRole('button', { name: 'Add linked topic to the right' }).click();
    await f.getByText('The affected scope is not authorized', { exact: false }).waitFor(); assert.equal(await text(), before); assert.equal(await f.getByRole('dialog').count(), 0); assert.deepEqual(errors, []);
});

test('adding outward descendants preserves one parent and a clear layout on both sides', async () => {
    for (const name of ['Research', 'Delivery']) {
        await setup(); await select(name);
        const before = await page.evaluate(() => {
            const selected = mindmapFixture.handle.selectedEntry();
            return { id: selected.definition.ref.id, x: selected.item.bounds.x };
        });
        const add = actionBar().getByRole('button', { name: /Add linked topic to/ });
        assert.equal(await add.count(), 1);
        const left = (await add.getAttribute('aria-label')).includes('left');
        await add.click(); await page.getByRole('dialog', { name: 'Edit topic name' }).waitFor(); await cancelDialog();
        const result = await page.evaluate(async parent => {
            const f = mindmapFixture, child = f.handle.selectedEntry();
            const definitions = f.runtime.snapshot().normalized.files[0].document.definitions;
            const incoming = definitions.filter(item => item.category === 'relation' && item.endpoints?.[1]?.definition.id === child.definition.ref.id);
            const parentEntry = f.handle.scene().entries.find(e => e.definition.ref.id === parent.id);
            const report = await f.runtime.verifier.verifyModel(f.runtime.snapshot(), { scope: { kind: 'workarea' }, purpose: 'design', level: 'semantic' });
            return { incoming: incoming.map(link => link.endpoints[0].definition.id), x: child.item.bounds.x, parentX: parentEntry.item.bounds.x, outcome: report.outcome, complete: f.handle.scene().coverage.complete };
        }, before);
        assert.deepEqual(result.incoming, [before.id]); assert.equal(result.outcome, 'valid'); assert.equal(result.complete, true);
        assert.equal(result.x < result.parentX, left);
    }
});
test('deletion through another view cannot silently remove compact descendants outside its selection', async () => {
    const f = await setup();
    await page.evaluate(async source => { const f = mindmapFixture; await f.viewer.open({ entry: 'main.ddn', files: [{ id: 'main.ddn', text: source + '\nview Single as mindmap.basic@1\n    use Research\n', revision: 'two', encoding: 'utf-8', writable: true }] }); await f.viewer.navigate({ kind: 'fit-workarea' }); const entry = f.handle.scene().entries.find(item => item.definition.record.name === 'Research' && item.view.record.name === 'Single'); f.handle.select(entry.definition.ref, entry.item.occurrence); }, source);
    const before = await text(); await actionBar().getByRole('button', { name: 'Delete topic', exact: true }).click();
    const dialog = f.getByRole('dialog', { name: 'Delete topic' }); await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    await dialog.getByText('This source block contains other topics', { exact: false }).waitFor(); assert.equal(await text(), before); await cancelDialog();
});
