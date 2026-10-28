import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildFontPack } from '../../../../tooling/workspace/ddn-fonts.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const tool = process.env.DDN_PLAYWRIGHT_ROOT ?? join(root, '.work/tools/browser/node_modules/playwright');
const { chromium } = await import(pathToFileURL(join(tool, 'index.mjs')));
const report = join(root, '.work/reports/ddn-fonts/browser');
let browser, context, page; const errors = [], network = [];
before(async () => {
    await mkdir(report, { recursive: true });
    const pack = buildFontPack(report), module = await readFile(join(root, '.work/builds/ddn/ddn/packages/viewer/src/fonts.js'), 'utf8');
    // The production bundler wraps these same exports; this standalone fixture isolates the font API.
    await writeFile(join(report, 'font-api.js'), module.replace(/^export /gm, '') + '\nwindow.Fonts={fontFamily,installFontResources,listFonts,loadFontFile,getFontResources,fontCSS};');
    await writeFile(join(report, 'fonts.html'), '<!doctype html><html><head><meta charset="utf-8"><title>DDN offline font test</title><script src="' + relative(report, pack.script) + '"></script><script src="font-api.js"></script></head><body><main id="samples"></main></body></html>');
    browser = await chromium.launch({ headless: true }); context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    await context.route(/^https?:\/\//, route => { network.push(route.request().url()); return route.abort(); });
    page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(join(report, 'fonts.html')).href);
});
after(async () => { await context?.close(); await browser?.close(); });

test('all seven bundled faces load from file:// without requests and change canvas text metrics', async () => {
    const result = await page.evaluate(async () => {
        const before = Fonts.listFonts(document), installed = await Fonts.installFontResources(document), canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
        const families = installed.filter(font => font.source === 'standard');
        const measurements = families.map(font => {
            ctx.font = '32px ' + Fonts.fontFamily(font.key); const width = ctx.measureText('Design a better system 012345').width;
            const p = document.createElement('p'); p.style.fontFamily = Fonts.fontFamily(font.key); p.style.fontSize = '32px'; p.textContent = font.family + ': Design a better system 012345'; document.querySelector('#samples').append(p);
            return { family: font.family, available: font.available, width, loaded: document.fonts.check('32px ' + Fonts.fontFamily(font.key)) };
        });
        return { unavailableBefore: before.filter(font => font.source === 'standard').every(font => !font.available), measurements, faces: [...document.fonts].length };
    });
    assert.equal(result.unavailableBefore, true); assert.equal(result.faces, 7);
    assert.ok(result.measurements.every(font => font.available && font.loaded && font.width > 100));
    assert.equal(new Set(result.measurements.map(font => font.width)).size, 4);
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
    await page.screenshot({ path: join(report, 'standard-font-suite.png') });
});

test('a custom local font registers, malformed fonts fail, and the same binary exports under its chosen family', async () => {
    const binary = await readFile(join(root, 'project/tests/ddn/fixtures/fonts/DejaVuSans.ttf'));
    const result = await page.evaluate(async bytes => {
        const file = new File([new Uint8Array(bytes)], 'My-Local-Font.ttf', { type: 'font/ttf' });
        const loaded = await Fonts.loadFontFile(document, file);
        let error = '';
        try { await Fonts.loadFontFile(document, new File([new Uint8Array([119,79,70,50,0,0,0,0,0,0,0,0])], 'broken.woff2')); } catch (failure) { error = String(failure); }
        return { family: loaded.family, available: loaded.available, loaded: document.fonts.check('20px "My Local Font"'), error, failedRegistered: Fonts.listFonts(document).some(font => font.family === 'broken'), css: Fonts.fontCSS(document, ['My Local Font']).slice(0, 100) };
    }, [...binary]);
    assert.equal(result.family, 'My Local Font'); assert.equal(result.available, true); assert.equal(result.loaded, true);
    assert.ok(result.error); assert.equal(result.failedRegistered, false); assert.ok(result.css.includes('data:font/ttf;base64,'));
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
});

test('self-contained SVG embeds used fonts and preserves glyphs when the source document font set is removed', async () => {
    const result = await page.evaluate(async () => {
        const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); svg.setAttribute('width', '900'); svg.setAttribute('height', '150');
        const style = document.createElementNS(ns, 'style'); style.textContent = Fonts.fontCSS(document, ['Caveat']); svg.append(style);
        const text = document.createElementNS(ns, 'text'); text.setAttribute('x', '12'); text.setAttribute('y', '95'); text.setAttribute('font-size', '64'); text.setAttribute('font-family', Fonts.fontFamily('Caveat')); text.textContent = 'Design a better system 012345'; svg.append(text);
        const source = new XMLSerializer().serializeToString(svg);
        async function raster(source) {
            const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
            try { const image = new Image(); image.src = url; await image.decode(); const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 150; const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); return { data: [...ctx.getImageData(0, 0, 900, 150).data], png: canvas.toDataURL() }; } finally { URL.revokeObjectURL(url); }
        }
        const before = await raster(source); document.fonts.clear(); const after = await raster(source);
        style.remove(); const fallback = await raster(new XMLSerializer().serializeToString(svg));
        return { embeddedFaces: (source.match(/@font-face/g) ?? []).length, hasData: source.includes('data:font/woff2;base64,'), same: before.data.every((v, i) => v === after.data[i]), different: after.data.some((v, i) => v !== fallback.data[i]), coloured: after.data.filter((v, i) => i % 4 === 3 && v > 0).length, source, png: after.png };
    });
    assert.equal(result.embeddedFaces, 1); assert.equal(result.hasData, true); assert.equal(result.same, true); assert.equal(result.different, true); assert.ok(result.coloured > 1000);
    await writeFile(join(report, 'embedded-caveat.svg'), result.source); await writeFile(join(report, 'embedded-caveat.png'), Buffer.from(result.png.split(',')[1], 'base64'));
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
});
