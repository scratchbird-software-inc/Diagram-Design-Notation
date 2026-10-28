import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const modules = join(process.env.DDN_BUILD_ROOT ?? resolve(root, '.work/builds/ddn'), 'ddn/packages');
const tool = process.env.DDN_PLAYWRIGHT_ROOT ?? resolve(root, '.work/tools/browser/node_modules/playwright');
const { chromium } = await import(pathToFileURL(join(tool, 'index.mjs')));
let server, browser, page, origin;
const errors = [];
const source = `workarea Studio as ddn
    with
        background.color "#eee9df"
        background.texture
            kind dots
            color "#ae9d85"
            opacity 0.3
            scale 24
            seed 7
element Customer as object : Customer
element Order as object : Order
element Remote as note : Remote note
view First as ddn@1 : First view
    with
        background.color "#fff1cc"
    use Customer
    use Order
    connect Customer to Order as assoc
view Second as ddn@1 : Second view
    with
        background.color "#e0f2ff"
    use Remote
`;

before(async () => {
    server = createServer(async (request, response) => {
        try {
            const pathname = new URL(request.url, 'http://localhost').pathname;
            if (pathname === '/') { response.setHeader('content-type', 'text/html'); response.end('<!doctype html><html><body style="margin:0"><main style="height:720px" id="host"></main></body></html>'); return; }
            const file = resolve(modules, '.' + pathname.replace(/^\/modules/, ''));
            if (!pathname.startsWith('/modules/') || relative(modules, file).startsWith('..') || !file.endsWith('.js')) { response.writeHead(404); response.end(); return; }
            response.setHeader('content-type', 'text/javascript'); response.end(await readFile(file));
        } catch { response.writeHead(404); response.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', error => errors.push(error.message));
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); assert.deepEqual(errors, []); });

async function setup(text = source) {
    await page.goto(origin);
    const opened = await page.evaluate(async text => {
        const { createRuntime, createNativeRuntimeOptions } = await import('/modules/runtime/src/index.js');
        const { createViewer, getViewerHandle } = await import('/modules/viewer/src/core.js');
        const runtime = createRuntime(createNativeRuntimeOptions());
        const viewer = createViewer(document.getElementById('host'), { runtime });
        const handle = getViewerHandle(viewer);
        window.fixture = { runtime, viewer, handle };
        window.capture = async () => {
            const result = await viewer.capture({ scope: { kind: 'workarea' }, extent: 'content', format: 'svg', stale: 'reject', partial: 'reject', includePreview: false });
            if (!result.ok) throw Error(JSON.stringify(result));
            return result.artifacts[0].blob.text();
        };
        const result = await viewer.open({ entry: 'main.ddn', files: [{ id: 'main.ddn', text, revision: '1', encoding: 'utf-8', writable: true }] });
        await handle.whenRendered();
        return { loaded: !!result.snapshot, diagnostics: handle.diagnostics() };
    }, text);
    assert.equal(opened.loaded, true, JSON.stringify(opened));
    assert.ok(!opened.diagnostics.some(item => item.severity === 'error'), JSON.stringify(opened));
}

test('blank-canvas guidance stays read-only and requests host actions through DOM events', async () => {
    await setup('view Main as ddn@1 : Untitled diagram\n');
    assert.equal(await page.getByRole('group', { name: 'Zoom', exact: true }).count(), 1);
    assert.equal(await page.locator('.ddn-viewer-hint').getByRole('button', { name: 'Add an element', exact: true }).count(), 0);
    assert.equal(await page.locator('.ddn-viewer-hint').getByRole('button', { name: 'Choose diagram type…', exact: true }).count(), 0);
    await page.evaluate(() => {
        window.actions = [];
        fixture.handle.container.addEventListener('ddn:action', event => actions.push(event.detail.action));
        document.addEventListener('ddn:open-sample', () => actions.push('sample-host'));
    });
    await page.getByRole('button', { name: 'Open a sample…', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => [...actions].sort()), ['open-sample', 'sample-host']);
    await page.evaluate(() => fixture.handle.container.setAttribute('data-ddn-editing', ''));
    await page.getByRole('button', { name: 'Choose diagram type…', exact: true }).click();
    assert.equal(await page.evaluate(() => actions.at(-1)), 'choose-view-type');
    assert.equal(await page.locator('.ddn-viewer-hint').getByRole('button', {name: 'Open a sample…', exact: true}).count(), 0);
    assert.equal(await page.evaluate(() => fixture.runtime.sources().files[0].text), 'view Main as ddn@1 : Untitled diagram\n');
});

test('expansion isolates view paper, restores navigation, and never changes semantic scene or exports', async () => {
    await setup();
    const evidence = await page.evaluate(async () => {
        const { viewer, handle, runtime } = fixture;
        const original = await capture(), before = handle.viewport(), scene = JSON.stringify(handle.scene()), text = runtime.sources().files[0].text;
        const [first, second] = handle.scene().views;
        await viewer.navigate({ kind: 'expand-view', target: first.ref });
        const expanded = { ref: handle.expanded().id, paper: getComputedStyle(handle.stage).backgroundColor, texture: !!handle.surface.querySelector('[data-ddn-background]'), groups: [...handle.surface.querySelectorAll('[data-occurrence]')].filter(group => getComputedStyle(group).display !== 'none').map(group => group.getAttribute('data-in-expanded')) };
        const exportExpanded = await capture();
        await viewer.navigate({ kind: 'fit-view', target: second.ref });
        const secondPaper = getComputedStyle(handle.stage).backgroundColor;
        await viewer.navigate({ kind: 'back' });
        const back = handle.expanded().id;
        await viewer.navigate({ kind: 'restore' });
        return { original, exportExpanded, expanded, secondPaper, back, first: first.ref.id, sameScene: scene === JSON.stringify(handle.scene()), sameText: text === runtime.sources().files[0].text, restored: handle.viewport(), before, textureRestored: !!handle.surface.querySelector('[data-ddn-background]') };
    });
    assert.equal(evidence.expanded.ref, evidence.first);
    assert.equal(evidence.expanded.paper, 'rgb(255, 241, 204)');
    assert.equal(evidence.expanded.texture, false);
    assert.ok(evidence.expanded.groups.length > 0 && evidence.expanded.groups.every(value => value === 'true'));
    assert.equal(evidence.secondPaper, 'rgb(224, 242, 255)');
    assert.equal(evidence.back, evidence.first);
    assert.deepEqual(evidence.restored, evidence.before);
    assert.equal(evidence.textureRestored, true);
    assert.equal(evidence.sameScene, true); assert.equal(evidence.sameText, true);
    assert.equal(evidence.exportExpanded, evidence.original);
});

test('mini-cards preserve complete export content and allow keyboard expansion', async () => {
    await setup();
    const before = await page.evaluate(async () => { const text = await capture(); fixture.viewer.setViewport({ ...fixture.handle.viewport(), zoom: .05 }); return text; });
    assert.equal(await page.locator('.ddn-mini-card').count(), 2);
    assert.equal(await page.locator('.ddn-viewer-stage > svg').getAttribute('data-lod'), 'mini');
    assert.equal(await page.evaluate(() => capture()), before);
    assert.doesNotMatch(before, /ddn-mini-card|ddn-hit/);
    await page.locator('.ddn-mini-card').first().focus(); await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Shrink to workarea', exact: true }).waitFor();
    assert.equal(await page.locator('.ddn-mini-card').count(), 0);
    await page.getByRole('button', { name: 'Shrink to workarea', exact: true }).click();
    assert.equal(await page.locator('.ddn-mini-card').count(), 2);
});

test('wheel and pinch anchor correctly in letterboxed SVGs and history restores the pre-gesture camera', async () => {
    await setup();
    const evidence = await page.evaluate(async () => {
        const { viewer, handle } = fixture, svg = handle.surface;
        viewer.setViewport({ bounds: { x: 0, y: 0, width: 1000, height: 100 }, zoom: 1 });
        const rect = svg.getBoundingClientRect(), x = Math.floor(rect.left + rect.width * .2), y = Math.floor(rect.top + rect.height * .7);
        const anchor = handle.toWorld(x, y), before = handle.viewport();
        svg.dispatchEvent(new WheelEvent('wheel', { clientX: x, clientY: y, deltaY: -100, bubbles: true, cancelable: true }));
        const after = handle.toWorld(x, y), percentage = Math.round(Math.min(rect.width / 1000, rect.height / 100) * handle.viewport().zoom * 100) + '%';
        const readout = document.querySelector('.ddn-zoom-readout').textContent;
        await viewer.navigate({ kind: 'back' }); const wheelBack = handle.viewport();
        const gestures = [];
        handle.container.addEventListener('ddn:gesture', event => gestures.push(event.detail.gesture));
        const pointer = (type, id, px, py) => svg.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', button: 0, clientX: px, clientY: py, bubbles: true }));
        const midX = x + 50, midY = y;
        const pinchAnchor = handle.toWorld(midX, midY);
        pointer('pointerdown', 1, x, y); pointer('pointerdown', 2, x + 100, y);
        pointer('pointermove', 1, x - 30, y + 20); pointer('pointermove', 2, x + 130, y + 20);
        const pinchAfter = handle.toWorld(midX, midY + 20), zoom = handle.viewport().zoom;
        pointer('pointerup', 1, x - 30, y + 20); pointer('pointerup', 2, x + 130, y + 20);
        await viewer.navigate({ kind: 'back' });
        return { anchor, after, before, wheelBack, readout, percentage, pinchAnchor, pinchAfter, zoom, gestures, pinchBack: handle.viewport() };
    });
    for (const axis of ['x', 'y']) {
        assert.ok(Math.abs(evidence.anchor[axis] - evidence.after[axis]) < .001, JSON.stringify(evidence));
        assert.ok(Math.abs(evidence.pinchAnchor[axis] - evidence.pinchAfter[axis]) < .001, JSON.stringify(evidence));
    }
    assert.equal(evidence.readout, evidence.percentage);
    assert.deepEqual(evidence.wheelBack, evidence.before); assert.deepEqual(evidence.pinchBack, evidence.before);
    assert.equal(evidence.zoom, 1.6); assert.deepEqual(evidence.gestures, ['pinch-start', 'pinch-end']);
});

test('connections have selectable hit paths and readable endpoint names, with status tooltips on elements', async () => {
    await setup();
    assert.ok(await page.locator('.ddn-hit').count());
    assert.ok(await page.locator('[data-status-dot] > title').count());
    assert.equal(await page.locator('.ddn-viewer-outline').getByRole('button', { name: 'Customer → Order', exact: true }).count(), 1);
    const selected = await page.evaluate(() => {
        const { handle, runtime } = fixture, hit = handle.surface.querySelector('.ddn-hit'), source = runtime.sources().files[0].text;
        hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return { relation: !!handle.selectedEntry().definition.record.endpoints, sameSource: source === runtime.sources().files[0].text, vectorEffect: hit.getAttribute('vector-effect') };
    });
    assert.equal(selected.relation, true); assert.equal(selected.sameSource, true); assert.equal(selected.vectorEffect, 'non-scaling-stroke');
});

test('data views keep their full source values and do not show an empty graph prompt', async () => {
    await setup('data Report\n    id.description\n    1."A long description that remains complete in CSV output"\nview Records as table.records@1\n    with\n        projection.options\n            records Report\n            columns\n                item\n                    id id\n                    label Identifier\n                item\n                    id description\n                    label Description\n            missing gap\n');
    assert.equal(await page.locator('.ddn-viewer-hint').count(), 0);
    const evidence = await page.evaluate(async () => {
        const { viewer, handle } = fixture, view = handle.scene().views[0];
        await viewer.navigate({ kind: 'expand-view', target: view.ref });
        const frame = handle.scene().entries.find(entry => entry.item.occurrence === `view:${JSON.stringify([view.ref.file, view.ref.id])}`);
        const result = await viewer.capture({ scope: { kind: 'view', target: view.ref }, extent: 'content', format: 'csv', stale: 'reject', partial: 'reject', includePreview: false });
        return { bounds: handle.viewport().bounds, frame: frame.item.bounds, csv: result.ok ? await result.artifacts[0].blob.text() : JSON.stringify(result) };
    });
    assert.deepEqual(evidence.bounds, evidence.frame);
    assert.match(evidence.csv, /A long description that remains complete in CSV output/);
    assert.equal(await page.locator('.ddn-viewer-hint').count(), 0);
});
