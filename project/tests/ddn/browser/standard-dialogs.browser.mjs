import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const modules = resolve(root, '.work/builds/ddn/ddn/packages');
const tool = process.env.DDN_PLAYWRIGHT_ROOT ?? resolve(root, '.work/tools/browser/node_modules/playwright');
const { chromium } = await import(pathToFileURL(join(tool, 'index.mjs')));
let server, browser, page, origin;
const errors = [];
before(async () => {
    // Serve built ES modules locally, so tests exercise the public helpers even
    // before the standalone bundle exports them. No runtime network dependency.
    server = createServer(async (request, response) => {
        try {
            const pathname = new URL(request.url, 'http://localhost').pathname;
            if (pathname === '/') { response.setHeader('content-type', 'text/html'); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>'); return; }
            const file = resolve(modules, '.' + pathname.replace(/^\/modules/, ''));
            if (!pathname.startsWith('/modules/') || relative(modules, file).startsWith('..') || !file.endsWith('.js')) { response.writeHead(404); response.end(); return; }
            response.setHeader('content-type', 'text/javascript'); response.end(await readFile(file));
        } catch { response.writeHead(404); response.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage(); page.on('pageerror', error => errors.push(error.message));
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });

async function setup({ fields = 1, colour = '#12345680', modal = true } = {}) {
    await page.setViewportSize({ width: 900, height: 650 }); await page.goto(origin);
    await page.evaluate(async ({ fields, colour, modal }) => {
        window.ui = { ...await import('/modules/designer/src/dialogs.js'), ...await import('/modules/viewer/src/ui-theme.js') };
        document.body.innerHTML = '<button id="open">Open editor</button><button id="outside">Outside</button><main id="host"></main><svg><rect id="diagram" fill="#fff59d" width="80" height="40"/></svg>';
        window.host = document.getElementById('host'); window.events = [];
        document.getElementById('open').addEventListener('click', () => {
            window.dialog = ui.createStandardDialog(host, { title: 'Example editor', modal, onApply: () => { if (window.fail) throw Error('Please correct the example.'); } });
            for (let index = 0; index < fields; index++) {
                const label = document.createElement('label'); label.textContent = 'Field ' + index;
                const input = document.createElement('input'); input.value = 'Value ' + index; label.append(input); dialog.body.append(label);
            }
            window.colour = ui.colourField(dialog.body, 'Paper colour', colour);
            window.colour.addEventListener('input', () => events.push(window.colour.value));
        });
    }, { fields, colour, modal });
    await page.getByRole('button', { name: 'Open editor', exact: true }).click();
    return page.getByRole('dialog', { name: 'Example editor', exact: true });
}

test('compact shell scrolls its body while header and actions remain visible on narrow screens', async () => {
    const dialog = await setup({ fields: 35 });
    const dimensions = await dialog.evaluate(element => {
        const bounds = element.getBoundingClientRect(), input = element.querySelector('input');
        return { width: bounds.width, font: getComputedStyle(element).fontSize, height: input.getBoundingClientRect().height, scroll: element.querySelector('.ddn-ui-dialog-body').scrollHeight };
    });
    assert.equal(dimensions.width, 480); assert.equal(dimensions.font, '13px'); assert.equal(dimensions.height, 32); assert.ok(dimensions.scroll > 650);
    const heading = dialog.locator('header'), footer = dialog.locator('footer');
    const headerBefore = await heading.boundingBox(), footerBefore = await footer.boundingBox();
    await dialog.locator('.ddn-ui-dialog-body').evaluate(element => element.scrollTop = 500);
    assert.deepEqual(await heading.boundingBox(), headerBefore); assert.deepEqual(await footer.boundingBox(), footerBefore);
    assert.ok(footerBefore.y + footerBefore.height <= 650);
    await page.setViewportSize({ width: 320, height: 400 });
    const small = await dialog.boundingBox(), actions = await footer.boundingBox();
    assert.ok(small.width <= 308); assert.ok(small.x >= 0); assert.ok(actions.y + actions.height <= 400);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test('focus cycles within the top dialog, Escape closes only the picker, and closing a parent disposes descendants', async () => {
    let dialog = await setup();
    assert.equal(await dialog.getByLabel('Field 0').evaluate(element => element === document.activeElement), true);
    await dialog.getByRole('button', { name: 'Apply', exact: true }).focus(); await page.keyboard.press('Tab');
    assert.equal(await dialog.getByRole('button', { name: 'Move Example editor', exact: true }).evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Shift+Tab'); assert.equal(await dialog.getByRole('button', { name: 'Apply', exact: true }).evaluate(element => element === document.activeElement), true);
    await page.evaluate(() => document.getElementById('outside').focus());
    assert.equal(await dialog.getByLabel('Field 0').evaluate(element => element === document.activeElement), true);
    await dialog.getByRole('button', { name: 'Paper colour palette' }).click();
    const picker = page.getByRole('dialog', { name: 'Paper colour palette', exact: true });
    await picker.getByLabel('Hex colour').waitFor();
    assert.equal(await page.evaluate(() => window.dialog.element.inert), true);
    await page.keyboard.press('Escape'); await picker.waitFor({ state: 'detached' });
    assert.equal(await dialog.getByRole('button', { name: 'Paper colour palette' }).evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    assert.equal(await page.locator('#open').evaluate(element => element === document.activeElement), true);
    await page.locator('#open').click(); dialog = page.getByRole('dialog', { name: 'Example editor', exact: true });
    await dialog.getByRole('button', { name: 'Paper colour palette' }).click(); await page.evaluate(() => window.dialog.close());
    assert.equal(await page.locator('.ddn-ui-layer').count(), 0);
    assert.equal(await page.locator('#open').evaluate(element => element === document.activeElement), true);
});

test('light, dark, midnight and warm themes inherit without changing diagram paint, and reject unsafe overrides atomically', async () => {
    const dialog = await setup();
    await page.evaluate(() => ui.setUITheme(document.body, 'dark', { '--ddn-ui-font-size': 14 }));
    assert.equal(await dialog.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(27, 38, 59)');
    assert.equal(await dialog.evaluate(element => getComputedStyle(element).fontSize), '14px');
    assert.equal(await page.locator('#host').getAttribute('data-ddn-ui-theme'), null);
    await page.evaluate(()=>ui.setUITheme(document.body,'midnight'));
    assert.equal(await dialog.evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(17, 24, 43)');
    const result = await page.evaluate(() => {
        const original = document.getElementById('diagram').outerHTML;
        ui.setUITheme(host, 'warm', { '--ddn-ui-accent': '#123456', '--ddn-ui-control-height': 30 });
        const initial = host.outerHTML;
        const invalid = [{ '--ddn-ui-accent': 'url(https://invalid.example)' }, { '--ddn-ui-control-height': 999 }, { '--bad-token': '#fff' }];
        const rejected = invalid.map(overrides => { try { ui.setUITheme(host, 'light', overrides); return false; } catch { return host.outerHTML === initial; } });
        return { original, after: document.getElementById('diagram').outerHTML, rejected, tokens: ui.UI_THEME_TOKEN_NAMES.length };
    });
    assert.equal(result.original, result.after); assert.deepEqual(result.rejected, [true, true, true]); assert.equal(result.tokens, 14);
    assert.equal(await dialog.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(255, 250, 242)');
    await page.evaluate(() => ui.setUITheme(host, 'light'));
    assert.equal(await dialog.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(255, 255, 255)');
    assert.equal(await dialog.getByLabel('Field 0').evaluate(element => element.getBoundingClientRect().height), 32);
    assert.equal(await page.locator('style[data-ddn-ui-theme-styles]').count(), 1);
});

test('palette sliders update the parent immediately; Reset restores and Done retains', async () => {
    const dialog = await setup();
    await dialog.getByRole('button', {name: 'Paper colour palette'}).click();
    const picker = page.getByRole('dialog', {name: 'Paper colour palette', exact: true});
    assert.equal(await picker.getByRole('button', {name: 'Apply', exact: true}).count(), 0);
    await picker.getByLabel('Red', {exact: true}).fill('250'); await picker.getByLabel('Alpha', {exact: true}).fill('0.25');
    assert.equal(await page.evaluate(() => window.colour.value), '#fa345640');
    assert.equal(await picker.getByRole('slider', {name: 'Red slider', exact: true}).inputValue(), '250');
    await picker.getByRole('slider', {name: 'Red slider', exact: true}).press('ArrowLeft');
    assert.equal(await page.evaluate(() => window.colour.value), '#f9345640');
    await picker.getByRole('button', {name: 'Reset colour', exact: true}).click();
    assert.equal(await page.evaluate(() => window.colour.value), '#12345680');
    await picker.getByLabel('Hex colour').fill('#abc');
    assert.equal(await picker.getByLabel('Green', {exact: true}).inputValue(), '187');
    await picker.getByLabel('Alpha', {exact: true}).fill('0.5');
    assert.equal(await page.evaluate(() => window.colour.value), '#aabbcc80');
    await picker.getByRole('button', {name: 'Done', exact: true}).click(); await picker.waitFor({state: 'detached'});
    assert.equal(await page.evaluate(() => window.colour.value), '#aabbcc80');
});

test('invalid colours and out-of-range channels keep the last valid colour; swatches update live', async () => {
    const dialog = await setup(); await dialog.getByRole('button', {name: 'Paper colour palette'}).click();
    const picker = page.getByRole('dialog', {name: 'Paper colour palette', exact: true});
    await picker.getByLabel('Hex colour').fill('url(bad)');
    await picker.getByRole('alert').filter({hasText: /Use #RGB/}).waitFor(); assert.deepEqual(await page.evaluate(() => events), []);
    await picker.getByLabel('Hex colour').fill('#12345680'); await picker.getByLabel('Red', {exact: true}).fill('256');
    assert.deepEqual(await page.evaluate(() => events), []);
    await picker.getByRole('button', {name: 'Use #fff59d', exact: true}).click();
    assert.equal(await page.evaluate(() => window.colour.value), '#fff59d');
    await picker.getByRole('button', {name: 'Reset colour', exact: true}).click();
    await picker.getByRole('button', {name: 'Done', exact: true}).click();
    await dialog.getByLabel('Paper colour picker', {exact: true}).fill('#aa3300');
    assert.equal(await page.evaluate(() => window.colour.value), '#aa330080');
    await dialog.getByLabel('Paper colour', {exact: true}).fill('#def');
    assert.equal(await dialog.getByLabel('Paper colour picker', {exact: true}).inputValue(), '#ddeeff');
    const before = await page.evaluate(() => events.length);
    await page.evaluate(() => {window.colour.value = '#001122'; ui.syncColourField(window.colour);});
    assert.equal(await dialog.getByLabel('Paper colour picker', {exact: true}).inputValue(), '#001122');
    assert.equal(await page.evaluate(() => events.length), before);
});

test('errors remain visible above actions and host teardown removes modal focus handling', async () => {
    const dialog = await setup({ fields: 30 }); await page.evaluate(() => window.fail = true);
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    await dialog.getByRole('alert').filter({ hasText: 'Please correct the example.' }).waitFor();
    assert.equal(await dialog.getByRole('button', { name: 'Apply', exact: true }).isEnabled(), true);
    const error = await dialog.getByRole('alert').boundingBox(), footer = await dialog.locator('footer').boundingBox();
    assert.ok(error.y + error.height <= footer.y + 1);
    await page.evaluate(() => host.remove()); await dialog.waitFor({ state: 'detached' });
    await page.locator('#outside').focus(); assert.equal(await page.locator('#outside').evaluate(element => element === document.activeElement), true);
    assert.deepEqual(errors, []);
});


test('modeless forms leave the canvas usable and move with pointer or keyboard within viewport bounds', async () => {
    const dialog = await setup({modal:false});
    assert.equal(await dialog.getAttribute('aria-modal'),null);
    assert.equal(await dialog.locator('..').evaluate(element=>getComputedStyle(element).pointerEvents),'none');
    await page.locator('#outside').click();
    assert.equal(await page.locator('#outside').evaluate(element=>element===document.activeElement),true);
    await page.keyboard.press('Escape'); assert.equal(await dialog.isVisible(),true);
    const title=dialog.getByRole('button',{name:'Move Example editor',exact:true}),before=await dialog.boundingBox(),handle=await title.boundingBox();
    await page.mouse.move(handle.x+30,handle.y+12);await page.mouse.down();await page.mouse.move(handle.x-70,handle.y+72);await page.mouse.up();
    const moved=await dialog.boundingBox();assert.equal(moved.x,before.x-100);assert.equal(moved.y,before.y+60);
    await title.focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('Shift+ArrowUp');
    const keyed=await dialog.boundingBox();assert.equal(keyed.x,moved.x-10);assert.equal(keyed.y,moved.y-40);
    const at=await title.boundingBox();await page.mouse.move(at.x+30,at.y+12);await page.mouse.down();await page.mouse.move(2500,2000);await page.mouse.up();
    const clamped=await dialog.boundingBox();assert.ok(clamped.x>=0&&clamped.y>=0&&clamped.x+clamped.width<=900&&clamped.y+clamped.height<=650);
    await page.setViewportSize({width:320,height:400});
    await page.waitForFunction(()=>{const b=window.dialog.element.getBoundingClientRect();return b.x>=0&&b.y>=0&&b.right<=innerWidth&&b.bottom<=innerHeight;});
    assert.equal(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth),true);
    await dialog.getByRole('button',{name:'Close Example editor',exact:true}).click();await dialog.waitFor({state:'detached'});
});

test('a modal palette traps focus above a floating form, and independent forms close independently', async () => {
    const dialog=await setup({modal:false});
    await dialog.getByRole('button',{name:'Paper colour palette',exact:true}).click();
    const palette=page.getByRole('dialog',{name:'Paper colour palette',exact:true});await palette.getByLabel('Hex colour').waitFor();
    assert.equal(await page.evaluate(()=>window.dialog.element.inert),true);
    await page.evaluate(()=>document.querySelector('#outside').focus());assert.equal(await palette.getByLabel('Hex colour').evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Escape');await palette.waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>window.dialog.element.inert),false);
    assert.equal(await dialog.getByRole('button',{name:'Paper colour palette',exact:true}).evaluate(e=>e===document.activeElement),true);
    await page.locator('#outside').click();
    await page.evaluate(()=>{window.second=ui.createStandardDialog(host,{title:'Independent form',modal:false});});
    await page.evaluate(()=>window.dialog.element.focus());
    assert.equal(await page.evaluate(()=>Number(dialog.element.parentElement.style.zIndex)>Number(second.element.parentElement.style.zIndex)),true);
    await page.evaluate(()=>window.dialog.close());await dialog.waitFor({state:'detached'});
    assert.equal(await page.getByRole('dialog',{name:'Independent form',exact:true}).isVisible(),true);
    await page.evaluate(()=>second.close());assert.equal(await page.locator('.ddn-ui-layer').count(),0);
    await page.locator('#open').click();await page.getByRole('dialog',{name:'Example editor',exact:true}).getByRole('button',{name:'Paper colour palette',exact:true}).click();
    await page.evaluate(()=>window.dialog.close());assert.equal(await page.locator('.ddn-ui-layer').count(),0);
    await page.locator('#outside').focus();assert.equal(await page.locator('#outside').evaluate(e=>e===document.activeElement),true);
});

test('bounded slider and exact entry share edits without rounding authored precision or emitting programmatic changes', async () => {
    const dialog=await setup({modal:false});
    await page.evaluate(()=>{window.numeric=ui.numberField(dialog.body,'Opacity',.37,{min:0,max:1,step:.01});numeric.step='any';window.numericEvents=[];numeric.addEventListener('input',()=>numericEvents.push(numeric.value));});
    const range=dialog.getByRole('slider',{name:'Opacity slider',exact:true}),input=dialog.getByRole('spinbutton',{name:'Opacity',exact:true});
    assert.equal(await range.inputValue(),'0.37');assert.deepEqual(await page.evaluate(()=>numericEvents),[]);
    await range.focus();await page.keyboard.press('ArrowRight');assert.equal(await input.inputValue(),'0.38');assert.deepEqual(await page.evaluate(()=>numericEvents),['0.38']);
    await input.fill('0.427');assert.equal(await input.inputValue(),'0.427');assert.equal(await input.evaluate(e=>e.checkValidity()),true);assert.equal(await range.inputValue(),'0.43');
    const count=await page.evaluate(()=>numericEvents.length);await page.evaluate(()=>{numeric.value='.333';ui.syncNumberField(numeric);});assert.equal(await input.inputValue(),'.333');assert.equal(await range.inputValue(),'0.33');assert.equal(await page.evaluate(()=>numericEvents.length),count);
    await input.fill('2');assert.equal(await input.inputValue(),'2');assert.equal(await input.evaluate(e=>e.checkValidity()),false);assert.equal(await input.getAttribute('aria-invalid'),'true');
    await input.fill('');assert.equal(await input.evaluate(e=>e.checkValidity()),false);
    const rejected=await page.evaluate(()=>{try{ui.numberField(dialog.body,'Bad',0,{min:3,max:1});return false;}catch{return true;}});assert.equal(rejected,true);
    assert.deepEqual(errors,[]);
});

test('locked asynchronous Apply blocks dismissal until completion and unlocks after failure', async () => {
    await setup();
    await page.evaluate(() => {
        dialog.close(); window.applies = 0;
        window.dialog = ui.createStandardDialog(host, {title: 'Create document', lockWhileApplying: true, onApply() {
            window.applies++;
            return new Promise((resolve, reject) => {window.finishApply = resolve; window.failApply = reject;});
        }});
    });
    const dialog = page.getByRole('dialog', {name: 'Create document', exact: true});
    await dialog.getByRole('button', {name: 'Apply', exact: true}).click();
    assert.equal(await dialog.getAttribute('aria-busy'), 'true');
    assert.equal(await dialog.getByRole('button', {name: 'Cancel', exact: true}).isDisabled(), true);
    assert.equal(await dialog.getByRole('button', {name: 'Close Create document', exact: true}).isDisabled(), true);
    await page.keyboard.press('Escape');
    await dialog.getByRole('button', {name: 'Cancel', exact: true}).evaluate(button => button.click());
    await dialog.getByRole('button', {name: 'Apply', exact: true}).evaluate(button => button.click());
    assert.equal(await dialog.isVisible(), true); assert.equal(await page.evaluate(() => applies), 1);
    await page.evaluate(() => failApply(Error('Try again.')));
    await dialog.getByRole('alert').filter({hasText: 'Try again.'}).waitFor();
    assert.equal(await dialog.getByRole('button', {name: 'Cancel', exact: true}).isEnabled(), true);
    await dialog.getByRole('button', {name: 'Apply', exact: true}).click();
    await page.evaluate(() => finishApply()); await dialog.waitFor({state: 'detached'});
    assert.equal(await page.evaluate(() => applies), 2);
});

test('locked Apply allows host teardown; ordinary dialogs retain asynchronous cancellation', async () => {
    await setup();
    await page.evaluate(() => {
        dialog.close();
        window.dialog = ui.createStandardDialog(host, {title: 'Locked editor', lockWhileApplying: true, onApply() {
            return new Promise(resolve => window.finishApply = resolve);
        }});
    });
    const locked = page.getByRole('dialog', {name: 'Locked editor', exact: true});
    await locked.getByRole('button', {name: 'Apply', exact: true}).click();
    await page.evaluate(() => host.remove()); await locked.waitFor({state: 'detached'});
    await page.locator('#outside').focus(); assert.equal(await page.locator('#outside').evaluate(element => element === document.activeElement), true);
    await page.evaluate(() => finishApply());
    await setup();
    await page.evaluate(() => {
        dialog.close();
        window.dialog = ui.createStandardDialog(host, {title: 'Ordinary editor', onApply() {
            return new Promise(resolve => window.finishApply = resolve);
        }});
    });
    const ordinary = page.getByRole('dialog', {name: 'Ordinary editor', exact: true});
    await ordinary.getByRole('button', {name: 'Apply', exact: true}).click();
    assert.equal(await ordinary.getByRole('button', {name: 'Cancel', exact: true}).isEnabled(), true);
    await page.keyboard.press('Escape'); await ordinary.waitFor({state: 'detached'});
    await page.evaluate(() => finishApply());
    assert.deepEqual(errors, []);
});
