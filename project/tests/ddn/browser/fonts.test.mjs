import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { buildFontPack } from '../../../../tooling/workspace/ddn-fonts.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const { fontFamily, installFontResources, listFonts, loadFontFile, getFontResources, fontCSS } = await import(pathToFileURL(join(root, '.work/builds/ddn/ddn/packages/viewer/src/fonts.js')));
const binary = Buffer.from([119,79,70,50,0,0,0,0,0,0,0,0]);
const resource = (overrides = {}) => ({ family: 'Local Test', dataURL: 'data:font/woff2;base64,' + binary.toString('base64'), ...overrides });
function fakeDocument({ reject = false } = {}) {
    const constructed = [], added = [];
    class Face {
        constructor(family, buffer, descriptors) { Object.assign(this, { family, buffer, descriptors }); constructed.push(this); }
        async load() { if (reject) throw Error('Browser rejected font'); await new Promise(resolve => setTimeout(resolve, 0)); return this; }
    }
    return { document: Object.assign(new EventTarget(), {defaultView: {FontFace: Face, Event}, fonts: {add: face => added.push(face)}}), constructed, added };
}

test('loaded resources notify detached font consumers after registration; failures do not', async () => {
    const {document} = fakeDocument();
    let notifications = 0;
    document.addEventListener('ddn:font-resources', () => {notifications++; assert.equal(getFontResources(document).length, 1);});
    await installFontResources(document, [resource()]); assert.equal(notifications, 1);
    await assert.rejects(installFontResources(document, [resource({dataURL: 'https://invalid/font.woff2'})]));
    assert.equal(notifications, 1);
    const failed = fakeDocument({reject: true}).document;
    failed.addEventListener('ddn:font-resources', () => {notifications++;});
    await assert.rejects(installFontResources(failed, [resource()])); assert.equal(notifications, 1);
});

test('generic font keys preserve existing defaults and family strings cannot introduce CSS rules', () => {
    assert.equal(fontFamily('sans'), 'system-ui, sans-serif'); assert.equal(fontFamily('serif'), 'serif');
    assert.equal(fontFamily('mono'), 'monospace'); assert.equal(fontFamily('handwriting'), 'cursive');
    assert.equal(fontFamily('Inter'), '"Inter"'); assert.equal(fontFamily('constructor'), '"constructor"'); assert.equal(fontFamily('"Source Serif 4", serif'), '"Source Serif 4", serif');
    assert.equal(fontFamily('A";x:<style>'), '"A\\22 ;x:\\3c style\\3e "');
    assert.equal(fontFamily(''), 'system-ui, sans-serif');
});

test('missing optional packs are harmless and standard fonts become available only after loading', async () => {
    const { document } = fakeDocument();
    assert.deepEqual(await installFontResources(document), listFonts(document));
    assert.equal(listFonts(document).filter(font => font.source === 'system').length, 4);
    assert.ok(listFonts(document).filter(font => font.source === 'standard').every(font => !font.available));
    const first = listFonts(document); first[0].weights.push('900');
    assert.deepEqual(listFonts(document)[0].weights, ['400', '700']);
    await installFontResources(document, [resource({ family: 'Inter', source: 'standard', category: 'sans', weight: '100 900' })]);
    assert.equal(listFonts(document).find(font => font.key === 'Inter').available, true);
    assert.deepEqual(listFonts(document).find(font => font.key === 'Inter').styles, ['normal']);
    assert.equal(listFonts(fakeDocument().document).find(font => font.key === 'Inter').available, false);
});

test('pack installation validates everything before construction, never passes font URLs to FontFace', async () => {
    const { document, constructed, added } = fakeDocument();
    const invalid = [
        resource({ dataURL: 'https://example.com/a.woff2' }), resource({ dataURL: 'data:font/ttf;base64,' + binary.toString('base64') }),
        resource({ weight: '1001' }), resource({ weight: '900 100' }), resource({ weight: '400; font-size:0' }),
        resource({ style: 'normal; color:red' }), resource({ family: 'sans' }), resource({ family: 'bad\nname' }),
        resource({ license: '\x00' }), resource({ category: 'unknown' }), resource({ source: 'remote' }), resource({ dataURL: 'data:font/woff2;base64,AAAA' }),
    ];
    for (const value of invalid) await assert.rejects(installFontResources(document, [resource(), value]));
    assert.equal(constructed.length, 0); assert.equal(added.length, 0);
    document.defaultView.DDN_FONT_RESOURCES = [resource()]; await installFontResources(document);
    assert.equal(constructed.length, 1); assert.ok(constructed[0].buffer instanceof ArrayBuffer);
    assert.equal(constructed[0].family, 'Local Test'); assert.deepEqual(new Uint8Array(constructed[0].buffer), new Uint8Array(binary));
});

test('concurrent identical registration is idempotent; conflicting resources and browser failures are explicit', async () => {
    const { document, constructed, added } = fakeDocument();
    await Promise.all([installFontResources(document, [resource()]), installFontResources(document, [resource(), resource()])]);
    assert.equal(constructed.length, 1); assert.equal(added.length, 1);
    const changed = Buffer.from(binary); changed[8] = 1;
    await assert.rejects(installFontResources(document, [resource({ dataURL: 'data:font/woff2;base64,' + changed.toString('base64') })]), /different font/);
    const failed = fakeDocument({ reject: true }); await assert.rejects(installFontResources(failed.document, [resource()]), /Browser rejected/);
    assert.deepEqual(getFontResources(failed.document), []);
    await assert.rejects(installFontResources({ defaultView: null }, [resource()]), /does not support/);
});

test('local files validate binary size and format before registration, with an explicit persistence copy', async () => {
    const { document } = fakeDocument();
    const font = await loadFontFile(document, new File([binary], 'My_Font.woff2'), { weight: '100 900' });
    assert.equal(font.family, 'My Font'); assert.equal(font.source, 'custom'); assert.equal(font.available, true);
    assert.deepEqual(font.weights, ['100 900']);
    const resources = getFontResources(document); assert.equal(resources.length, 1); resources[0].family = 'Changed';
    assert.equal(getFontResources(document)[0].family, 'My Font');
    await assert.rejects(loadFontFile(document, new File(['not a font whatsoever'], 'lie.ttf')), /WOFF2/);
    await assert.rejects(loadFontFile(document, { size: 17 * 1024 * 1024, arrayBuffer() { throw Error('Must not read'); } }), /16 MiB/);
    await assert.rejects(loadFontFile(document, new File([binary], 'bad.woff2'), { family: 'monospace' }), /generic/);
});

test('SVG CSS includes only used, successfully registered local faces and escapes family names', async () => {
    const { document } = fakeDocument();
    const exotic = 'Personal "Font" <style>';
    await installFontResources(document, [resource({ license: 'Test font license */ safely retained' }), resource({ family: 'Unused' }), resource({ family: exotic, weight: '700', style: 'italic' })]);
    const css = fontCSS(document, ['Local Test', exotic, 'sans', 'Unknown']);
    assert.equal((css.match(/@font-face/g) ?? []).length, 2); assert.ok(css.includes('data:font/woff2;base64,'));
    assert.ok(css.includes('Personal \\22 Font\\22  \\3c style\\3e ')); assert.ok(!css.includes('<style>')); assert.ok(!css.includes('Unused'));
    assert.ok(css.includes('/* Test font license * / safely retained */')); assert.ok(css.includes('font-weight:700;font-style:italic')); assert.equal(fontCSS(document, ['sans']), '');
    assert.equal(getFontResources(document, ['"Local Test", serif']).length, 1);
});

test('optional pack preserves official font integrity and licenses without executable network loading', () => {
    const output = join(root, '.work/reports/ddn-fonts/unit-pack'); mkdirSync(output, { recursive: true });
    const built = buildFontPack(output), script = readFileSync(built.script, 'utf8'), context = { globalThis: {} };
    vm.runInNewContext(script, context);
    const resources = context.globalThis.DDN_FONT_RESOURCES;
    assert.equal(resources.length, 7); assert.equal(new Set(resources.map(font => font.family)).size, 4);
    assert.ok(resources.every(font => font.dataURL.startsWith('data:font/woff2;base64,')));
    assert.ok(Object.isFrozen(resources)); assert.ok(Object.isFrozen(resources[0]));
    assert.equal((script.match(/SIL OPEN FONT LICENSE Version 1.1/gi) ?? []).length, 11); assert.ok(resources.every(font => font.license.includes('SIL OPEN FONT LICENSE')));
    assert.ok(built.bytes < 3_000_000); assert.ok(!script.includes('fetch('));
    assert.throws(() => buildFontPack(join(root, 'forbidden-font-output')), /beneath .work/);
});
