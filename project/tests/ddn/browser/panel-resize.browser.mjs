import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, join, relative} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const modules = resolve(root, '.work/builds/ddn/ddn/packages');
const reports = resolve(root, '.work/reports/panel-resize');
const tool = process.env.DDN_PLAYWRIGHT_ROOT ?? resolve(root, '.work/tools/browser/node_modules/playwright');
const {chromium} = await import(pathToFileURL(join(tool, 'index.mjs')));
let server, browser, origin;
before(async () => {
    await mkdir(reports, {recursive: true});
    server = createServer(async (request, response) => {
        try {
            const path = new URL(request.url, 'http://localhost').pathname;
            if (path === '/') {response.setHeader('content-type', 'text/html'); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="host"></main></body></html>'); return;}
            const file = resolve(modules, '.' + path.replace(/^\/modules/, ''));
            if (!path.startsWith('/modules/') || relative(modules, file).startsWith('..') || !file.endsWith('.js')) throw Error();
            response.setHeader('content-type', 'text/javascript'); response.end(await readFile(file));
        } catch {response.writeHead(404); response.end();}
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({headless: true});
});
after(async () => {await browser?.close(); await new Promise(resolve => server?.close(resolve));});
async function session(t, {modal = true, touch = false, nativeWindow = false} = {}) {
    const context = await browser.newContext({viewport: nativeWindow ? null : {width: 1200, height: 900}, hasTouch: touch});
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    t.after(async () => {await context.close(); assert.deepEqual(errors, []);});
    await page.goto(origin);
    await page.evaluate(async modal => {
        window.ui = {...await import('/modules/viewer/src/dialogs.js'), ...await import('/modules/viewer/src/popout.js')};
        window.form = ui.createStandardDialog(document.querySelector('#host'), {title: 'Resize example', modal});
        window.colour = ui.colourField(form.body, 'Paper colour', '#123456');
        window.paints = []; colour.addEventListener('input', () => paints.push(colour.value));
        const detail = document.createElement('div'); detail.textContent = 'Scrollable contents '.repeat(500); form.body.append(detail);
        const move = form.element.querySelector('.ddn-ui-dialog-move'); move.focus();
    }, modal);
    // Place it near the top left, leaving room to grow from its lower-right corner.
    const move = page.getByRole('button', {name: 'Move Resize example', exact: true});
    for (let i = 0; i < 20; i++) await move.press('Shift+ArrowLeft');
    for (let i = 0; i < 15; i++) await move.press('Shift+ArrowUp');
    return {page, context, dialog: page.getByRole('dialog', {name: 'Resize example', exact: true})};
}
async function drag(page, grip, dx, dy, hold = false) {
    const bounds = await grip.boundingBox(), x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, {steps: 5});
    if (!hold) await page.mouse.up();
}
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 2, `${actual} vs ${expected}`);

test('dialog grip resizes immediately with a fixed top-left and keeps footer, fields and scroll usable', async t => {
    const {page, dialog} = await session(t), grip = dialog.getByRole('button', {name: 'Resize Resize example', exact: true});
    const before = await dialog.boundingBox();
    assert.equal(await grip.evaluate(el => getComputedStyle(el).cursor), 'nwse-resize');
    await drag(page, grip, 180, 80, true);
    const during = await dialog.boundingBox(); closeTo(during.width, before.width + 180); closeTo(during.height, before.height + 80);
    closeTo(during.x, before.x); closeTo(during.y, before.y); await page.mouse.up();
    await dialog.getByLabel('Paper colour', {exact: true}).fill('#aabbcc');
    assert.equal(await page.evaluate(() => paints.at(-1)), '#aabbcc');
    const footer = await dialog.locator('footer').boundingBox();
    await dialog.locator('.ddn-ui-dialog-body').evaluate(el => el.scrollTop = el.scrollHeight);
    assert.deepEqual(await dialog.locator('footer').boundingBox(), footer);
    const button = await dialog.getByRole('button', {name: 'Close', exact: true}).boundingBox(), handle = await grip.boundingBox();
    assert.ok(button.x + button.width <= handle.x, 'Footer action does not overlap the grip');
    await page.screenshot({path: join(reports, 'dialog-resize.png')});
    await dialog.getByRole('button', {name: 'Close', exact: true}).click(); await dialog.waitFor({state: 'detached'});
});

test('dialog resize keyboard and pointer respect minimums and viewport changes', async t => {
    const {page, dialog} = await session(t), grip = dialog.getByRole('button', {name: 'Resize Resize example', exact: true});
    const before = await dialog.boundingBox(); await grip.press('ArrowRight'); await grip.press('Shift+ArrowDown');
    const keyboard = await dialog.boundingBox(); closeTo(keyboard.width, before.width + 10); closeTo(keyboard.height, before.height + 40);
    await drag(page, grip, -1500, -1500); const small = await dialog.boundingBox(); assert.ok(small.width >= 280); assert.ok(small.height >= 180);
    await drag(page, grip, 2000, 2000); const large = await dialog.boundingBox(); assert.ok(large.x + large.width <= 1188); assert.ok(large.y + large.height <= 888);
    await page.setViewportSize({width: 320, height: 420});
    const mobile = await dialog.boundingBox(); assert.ok(mobile.width <= 308); assert.ok(mobile.x >= 0); assert.ok(mobile.y + mobile.height <= 420);
    await grip.waitFor({state: 'visible'}); await dialog.getByRole('button', {name: 'Close', exact: true}).click();
});

test('touch dragging the dialog grip uses the same resize area', async t => {
    const {page, context, dialog} = await session(t, {touch: true}), grip = dialog.getByRole('button', {name: 'Resize Resize example', exact: true});
    const before = await dialog.boundingBox(), bounds = await grip.boundingBox(), cdp = await context.newCDPSession(page);
    const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: x + 70, y: y + 40}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    const after = await dialog.boundingBox(); closeTo(after.width, before.width + 70); closeTo(after.height, before.height + 40);
});

test('an unrelated pointer release does not end the active panel resize', async t => {
    const {page, dialog} = await session(t), grip = dialog.getByRole('button', {name: 'Resize Resize example', exact: true});
    const before = await dialog.boundingBox(), bounds = await grip.boundingBox(), x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 40, y + 20);
    await grip.dispatchEvent('pointerup', {pointerId: 999, button: 0});
    await page.mouse.move(x + 100, y + 50); await page.mouse.up();
    const after = await dialog.boundingBox(); closeTo(after.width, before.width + 100); closeTo(after.height, before.height + 50);
});

test('floating panels keep their controls and remembered size across resize and docking', async t => {
    const {page} = await session(t); await page.evaluate(() => {
        form.close(); const content = document.createElement('div'); content.id = 'float-content';
        content.innerHTML = '<label>Draft<input aria-label="Draft" value="kept"></label><button id="dock">Dock</button>';
        document.querySelector('#host').append(content);
        window.floating = ui.floatPanel(content, {title: 'Palette example', name: 'resize-test', width: 350, height: 300});
        document.querySelector('#dock').onclick = () => floating.dock();
    });
    const panel = page.locator('.ddn-float'), move = panel.getByRole('button', {name: 'Move Palette example', exact: true});
    for (let i = 0; i < 25; i++) await move.press('Shift+ArrowLeft');
    const grip = panel.getByRole('button', {name: 'Resize Palette example', exact: true}), before = await panel.boundingBox();
    await drag(page, grip, 100, 60); const after = await panel.boundingBox(); closeTo(after.width, before.width + 100); closeTo(after.height, before.height + 60);
    await panel.getByLabel('Draft').fill('retained'); await panel.getByRole('button', {name: 'Dock', exact: true}).click();
    assert.equal(await page.locator('#host').getByLabel('Draft').inputValue(), 'retained');
    await page.evaluate(() => {window.floating = ui.floatPanel(document.querySelector('#float-content'), {title: 'Palette example', name: 'resize-test'});});
    const restored = await panel.boundingBox(); closeTo(restored.width, after.width); closeTo(restored.height, after.height);
    await grip.press('ArrowLeft'); closeTo((await panel.boundingBox()).width, after.width - 10);
});

test('detached dialogs expose one window resize grip and restore their panel grip on return', async t => {
    const {page, dialog} = await session(t, {modal: false, nativeWindow: true});
    const popped = page.waitForEvent('popup'); await dialog.getByRole('button', {name: 'Pop out Resize example', exact: true}).click(); const popup = await popped;
    await popup.getByRole('dialog', {name: 'Resize example', exact: true}).waitFor();
    assert.equal(await popup.locator('.ddn-resize-grip:visible').count(), 1);
    const grip = popup.getByRole('button', {name: 'Resize Resize example window', exact: true});
    const width = await popup.evaluate(() => outerWidth);
    await grip.press('Shift+ArrowRight'); await popup.waitForFunction(width => outerWidth > width, width, {timeout: 5000});
    await popup.getByLabel('Paper colour', {exact: true}).fill('#fedcba'); assert.equal(await page.evaluate(() => paints.at(-1)), '#fedcba');
    await popup.getByRole('button', {name: 'Return Resize example to the page', exact: true}).click();
    await dialog.getByRole('button', {name: 'Resize Resize example', exact: true}).waitFor();
    assert.equal(await dialog.getByLabel('Paper colour', {exact: true}).inputValue(), '#fedcba');
});
