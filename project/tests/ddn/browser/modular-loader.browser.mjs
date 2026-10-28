import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { buildModularDistribution } from '../../../../tooling/workspace/ddn-modular.mjs';
import { modularFixture } from '../distribution/modular-fixture.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url)), work = process.env.DDN_BUILD_WORKAREA ?? resolve(root, '.work');
const ts = createRequire(import.meta.url)(process.env.DDN_TYPESCRIPT_PATH ?? join(work, 'tools/toolchain/typescript/lib/typescript.js'));
const tool = process.env.DDN_PLAYWRIGHT_ROOT ?? join(work, 'tools/browser/node_modules/playwright');
const { chromium } = await import(pathToFileURL(join(tool, 'index.mjs')));
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

test('offline loader coalesces optional packs, retries unavailable files, and prepares workers without executing them', async () => {
    const f = modularFixture(work), manifest = buildModularDistribution({ ...f, ts }), context = await browser.newContext();
    const page = await context.newPage(), errors = [], network = [], requests = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push(request.url()));
    await context.route(/^https?:\/\//, route => { network.push(route.request().url()); return route.abort(); });
    const optional = manifest.chunks.find(chunk => chunk.id === manifest.entries['verify:geography'].chunkId), absent = join(f.destination, optional.file);
    try {
        await page.goto(pathToFileURL(join(f.destination, 'verifier.html')).href);
        await page.waitForFunction(() => globalThis.utility === 'verifier');
        assert.equal(await page.evaluate(() => DDN_LOADER.describe().registry.executed.includes(DDN_LOADER.manifest.entries.worker.moduleId)), false);
        assert.match(await page.evaluate(() => {try{DDN_LOADER.worker('worker');}catch(error){return error.message;}}),/not prepared/);
        await page.evaluate(()=>DDN_LOADER.prepareEntry('worker'));
        assert.equal(await page.evaluate(()=>DDN_LOADER.describe().registry.executed.includes(DDN_LOADER.manifest.entries.worker.moduleId)),false);
        assert.match(await page.evaluate(() => { try { DDN_LOADER.worker('worker', ['verify:charts']); } catch (error) { return error.message; } }), /initializer is not loaded/);
        const result = await page.evaluate(async () => {
            const [a, b] = await Promise.all([DDN_LOADER.loadEntry('verify:charts'), DDN_LOADER.loadEntry('verify:charts')]);
            return { shared: a === b, answer: a.answer, verified: globalThis.verified, state: DDN_LOADER.describe() };
        });
        assert.equal(result.shared, true); assert.equal(result.answer, 7); assert.deepEqual(result.verified, ['charts']);
        assert.ok(!result.state.registry.modules.includes(manifest.entries['render:charts'].moduleId));
        const chartChunk = manifest.chunks.find(chunk => chunk.id === manifest.entries['verify:charts'].chunkId);
        assert.equal(requests.filter(url => url.endsWith(chartChunk.file)).length, 1);
        const workerResult = await page.evaluate(async () => {
            const worker = DDN_LOADER.worker('worker', ['verify:charts']);
            try { return await new Promise((resolve, reject) => { worker.onmessage = event => resolve(event.data); worker.onerror = reject; }); }
            finally { worker.terminate(); }
        });
        assert.deepEqual(workerResult, { value: 7, verified: ['charts'], hasUi: false });
        renameSync(absent, absent + '.hold');
        assert.match(await page.evaluate(() => DDN_LOADER.loadEntry('verify:geography').then(() => 'unexpected success', error => error.message)), /Unable to load DDN chunk/);
        renameSync(absent + '.hold', absent);
        assert.equal(await page.evaluate(() => DDN_LOADER.loadEntry('verify:geography').then(value => value.answer)), 7);
        assert.equal(await page.evaluate(() => DDN_LOADER.describe().pendingChunks.length), 0);
        assert.match(await page.evaluate(() => DDN_LOADER.loadEntry('../../external.js').catch(error => error.message)), /Unknown DDN entry/);
        assert.match(await page.evaluate(() => DDN_LOADER.loadEntry('worker').catch(error => error.message)), /Use prepareEntry/);
        assert.deepEqual(errors, []); assert.deepEqual(network, []);
    } finally {
        try { renameSync(absent + '.hold', absent); } catch {}
        await context.close();
    }
});

test('HTTP loader has a bounded timeout and can retry the same trusted chunk', async () => {
    const f = modularFixture(work), manifest = buildModularDistribution({ ...f, ts, timeoutMs: 300 });
    const target = manifest.chunks.find(chunk => chunk.id === manifest.entries['verify:graphs'].chunkId).file;
    const allowed = new Set(['viewer.html', 'ddn-loader.js', ...manifest.chunks.map(chunk => chunk.file)]), waiting = [], counts = new Map();
    let delay = true;
    const server = createServer((request, response) => {
        const file = new URL(request.url, 'http://127.0.0.1').pathname.slice(1);
        counts.set(file, (counts.get(file) ?? 0) + 1);
        if (!allowed.has(file)) { response.writeHead(404); response.end(); return; }
        if (delay && file === target) { waiting.push(response); return; }
        response.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : 'text/javascript'); response.end(readFileSync(join(f.destination, file)));
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const context = await browser.newContext(), page = await context.newPage();
    try {
        await page.goto('http://127.0.0.1:' + server.address().port + '/viewer.html'); await page.waitForFunction(() => globalThis.utility === 'viewer');
        const result = await page.evaluate(async () => {
            const start = performance.now();
            return Promise.all([DDN_LOADER.loadEntry('verify:graphs'), DDN_LOADER.loadEntry('verify:graphs')]).then(() => ({ message: 'unexpected success' }), error => ({ message: error.message, elapsed: performance.now() - start }));
        });
        assert.match(result.message, /Timed out loading DDN chunk/); assert.ok(result.elapsed >= 250 && result.elapsed < 4000);
        assert.equal(counts.get(target), 1);
        delay = false; waiting.forEach(response => response.destroy());
        assert.equal(await page.evaluate(() => DDN_LOADER.loadEntry('verify:graphs').then(exports => exports.answer)), 7);
        assert.equal(counts.get(target), 2);
        assert.equal(await page.evaluate(() => DDN_LOADER.describe().pendingChunks.length), 0);
    } finally {
        waiting.forEach(response => response.destroy()); await context.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    }
});
