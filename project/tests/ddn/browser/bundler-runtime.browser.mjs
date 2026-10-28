import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { collectModules, runtimeScript, chunkScript, entryScript } from '../../../../tooling/workspace/ddn-bundle.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const work = process.env.DDN_BUILD_WORKAREA ?? resolve(root, '.work');
const require = createRequire(import.meta.url);
const ts = require(process.env.DDN_TYPESCRIPT_PATH ?? join(work, 'tools/toolchain/typescript/lib/typescript.js'));
const tool = process.env.DDN_PLAYWRIGHT_ROOT ?? join(work, 'tools/browser/node_modules/playwright');
const { chromium } = await import(pathToFileURL(join(tool, 'index.mjs')));
let browser;
before(async () => { await mkdir(join(work, 'tmp'), { recursive: true }); browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

test('classic file bundles load optional modules locally and initialize a compute-only Blob worker', async () => {
    const built = await mkdtemp(join(work, 'tmp/ddn-modular-browser-'));
    const sources = {
        'core.js': 'export const value=13;',
        'app.js': 'import{value}from"./core.js";globalThis.mainValue=value;globalThis.UI_ONLY_SENTINEL=true;',
        'initializer.js': 'globalThis.multiplier=3;',
        'worker.js': 'import{value}from"./core.js";postMessage({value:value*globalThis.multiplier,hasDocument:typeof document!=="undefined"});',
    };
    for (const [name, source] of Object.entries(sources)) await writeFile(join(built, name), source);
    const graph = collectModules(Object.fromEntries(Object.keys(sources).map(name => [name, join(built, name)])), { built, ts });
    const options = { releaseHash: 'browser-test-release' };
    await writeFile(join(built, 'runtime.bundle.js'), runtimeScript({ hash: options.releaseHash }));
    await writeFile(join(built, 'core.bundle.js'), chunkScript(graph, ['core.js'], { ...options, id: 'core' }));
    await writeFile(join(built, 'app.bundle.js'), chunkScript(graph, ['app.js'], { ...options, id: 'app', dependencies: ['core'] }));
    await writeFile(join(built, 'family.bundle.js'), chunkScript(graph, ['initializer.js', 'worker.js'], { ...options, id: 'family', dependencies: ['core'] }));
    await writeFile(join(built, 'entry.bundle.js'), entryScript('app.js'));
    await writeFile(join(built, 'index.html'), '<!doctype html><title>DDN module test</title><script src="runtime.bundle.js"></script><script src="core.bundle.js"></script><script src="app.bundle.js"></script><script src="entry.bundle.js"></script>');
    const context = await browser.newContext(), errors = [], network = [];
    await context.route(/^https?:\/\//, route => { network.push(route.request().url()); return route.abort(); });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(pathToFileURL(join(built, 'index.html')).href);
        assert.equal(await page.evaluate(() => globalThis.mainValue), 13);
        assert.equal(await page.evaluate(() => { try { DDN_MODULES.worker('worker.js'); } catch (e) { return e.message; } }), 'Missing bundled module worker.js');
        const result = await page.evaluate(async () => {
            await new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = './family.bundle.js'; s.onload = resolve; s.onerror = reject; document.head.append(s); });
            const OriginalBlob = Blob;
            let workerSource = '';
            globalThis.Blob = class extends OriginalBlob { constructor(parts, options) { super(parts, options); workerSource = parts.join(''); } };
            try {
                const worker = DDN_MODULES.worker('worker.js', ['initializer.js']);
                const value = await new Promise((resolve, reject) => { worker.onmessage = e => resolve(e.data); worker.onerror = reject; });
                worker.terminate();
                return { ...value, hasUiCode: workerSource.includes('UI_ONLY_SENTINEL'), modules: DDN_MODULES.describe().modules };
            } finally { globalThis.Blob = OriginalBlob; }
        });
        assert.equal(result.value, 39); assert.equal(result.hasDocument, false); assert.equal(result.hasUiCode, false);
        assert.ok(result.modules.includes('worker.js')); assert.ok(result.modules.includes('app.js'));
        assert.deepEqual(errors, []); assert.deepEqual(network, []);
    } finally { await context.close(); }
});
