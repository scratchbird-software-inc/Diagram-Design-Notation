import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dataProfileFixture } from './data-profile-fixtures.mjs';
import { documentSource } from '../profiles/fixtures.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = process.env.DDN_BUILD_ROOT ?? resolve(root, '.work/builds/ddn');
const distribution = process.env.DDN_DDN_DISTRIBUTION ?? resolve(root, '.work/builds/ddn-distribution');
const tool = process.env.DDN_PLAYWRIGHT_ROOT ?? resolve(root, '.work/tools/browser/node_modules/playwright');
const { chromium } = await import(pathToFileURL(join(tool, 'index.mjs')));
const language = await import(pathToFileURL(join(output, 'ddn/packages/language/src/index.js')));
let browser, page; const errors = [];
before(async () => {
    browser = await chromium.launch({ headless: true }); page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(join(distribution, 'complete/ddn-viewer.html')).href);
    await page.waitForFunction(() => typeof window.DDN?.createViewer === 'function');
});
after(async () => { await browser?.close(); });
async function capture(source, id) {
    return page.evaluate(async ({ source, id }) => {
        const host = document.createElement('div'); document.body.append(host);
        const runtime = DDN.createRuntime(DDN.createBrowserRuntimeOptions()), viewer = DDN.createViewer(host, { runtime }), handle = DDN.getViewerHandle(viewer);
        try {
            const opened = await viewer.open({ entry: 'main.ddn', files: [{ id: 'main.ddn', text: source, revision: '1', encoding: 'utf-8', writable: true }] });
            await handle.whenRendered();
            if (!opened.snapshot) return { ok: false, diagnostics: opened.diagnostics };
            const owned = handle.scene().items.filter(item => item.view.id === id), minX = Math.min(...owned.map(item => item.bounds.x)), minY = Math.min(...owned.map(item => item.bounds.y));
            const expected = { x: minX, y: minY, width: Math.max(...owned.map(item => item.bounds.x + item.bounds.width)) - minX, height: Math.max(...owned.map(item => item.bounds.y + item.bounds.height)) - minY };
            const result = await viewer.capture({ scope: { kind: 'view', target: { file: 'main.ddn', id } }, format: 'svg', extent: 'content', stale: 'reject', partial: 'reject', includePreview: false });
            if (!result.ok) return result;
            const svg = await result.artifacts[0].blob.text(), dom = new DOMParser().parseFromString(svg, 'image/svg+xml');
            return { ok: true, expected, bounds: dom.documentElement.getAttribute('viewBox').split(/\s+/).map(Number), occurrences: [...dom.querySelectorAll('[data-occurrence]')].map(group => group.getAttribute('data-occurrence')), text: [...dom.querySelectorAll('tspan')].map(span => span.textContent), fills: [...dom.querySelectorAll('rect')].map(rect => rect.getAttribute('fill')) };
        } finally { viewer.destroy(); runtime.destroy(); host.remove(); }
    }, { source, id });
}
test('a view capture excludes its remote occurrences in composed dashboards', async () => {
    const f = dataProfileFixture('panels.composed@1'), options = f.view.record.projection.options, target = options.panels[0].target;
    options.columns = 2; options.panels = [{ target, kind: 'view', layout: { row: 0, column: 0 } }, { target, kind: 'view', layout: { row: 0, column: 1 } }];
    const source = documentSource(f.document, language), child = await capture(source, 'child');
    assert.equal(child.ok, true, JSON.stringify(child));
    assert.deepEqual(child.bounds, [child.expected.x, child.expected.y, child.expected.width, child.expected.height]);
    assert.ok(child.occurrences.length > 1); assert.ok(child.occurrences.every(id => !id.startsWith('panel:')));
    assert.equal(child.text.filter(value => value === 'Child chart').length, 1);
    const parent = await capture(source, 'view'); assert.equal(parent.ok, true, JSON.stringify(parent));
    assert.equal(parent.text.filter(value => value === 'Child chart').length, 4, 'each repeated child keeps its own panel heading and view title');
    assert.ok(parent.occurrences.some(id => id.startsWith('panel:'))); assert.deepEqual(errors, []);
});
test('view capture applies content-page margins and background even without header or footer', async () => {
    const f = dataProfileFixture('chart.basic@1'); f.view.record.publication = { file: 'main.ddn', id: 'page' };
    const publication = { id: 'page', page: { size: 'content', margin: { left: 10, right: 20, top: 30, bottom: 40 } }, background: { color: '#abcdef' } };
    const source = 'publication Printed\n    with\n' + language.serializeProperties(publication, '        ') + '\n' + documentSource(f.document, language);
    const result = await capture(source, 'view'); assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(result.bounds, [0, 0, result.expected.width + 30, result.expected.height + 70]);
    assert.ok(result.fills.includes('#abcdef')); assert.deepEqual(errors, []);
});
test('a sparse publication uses the versioned figure dimensions during capture', async () => {
    const f=dataProfileFixture('chart.basic@1');f.view.record.publication={file:'main.ddn',id:'page'};
    const source='publication Printed\n    with\n        id page\n'+documentSource(f.document,language);
    const result=await capture(source,'view');assert.equal(result.ok,true,JSON.stringify(result));
    assert.deepEqual(result.bounds,[0,0,1280,800]);assert.deepEqual(errors,[]);
});
