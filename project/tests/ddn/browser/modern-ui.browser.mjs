import {openSample} from './ux-test-helpers.mjs';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const distribution = process.env.DDN_DDN_DISTRIBUTION ?? join(root, '.work/builds/ddn-distribution');
const playwright = process.env.DDN_PLAYWRIGHT_ROOT ?? join(root, '.work/tools/browser/node_modules/playwright');
const reports = resolve(root, '.work/reports/ddn-modern-ui');
const { chromium } = await import(pathToFileURL(join(playwright, 'index.mjs')));
let browser;
const names = { viewer: 'ddn-viewer', designer: 'ddn-visual-designer', verifier: 'ddn-verifier' };
const themes = ['light', 'dark', 'midnight', 'warm'];
before(async () => { await mkdir(reports, { recursive: true }); browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function open(t, mode = 'designer', viewport = { width: 1440, height: 1000 }, preference) {
    const context = await browser.newContext({ viewport }), network = [], errors = [];
    t.after(() => context.close());
    await context.route(/^https?:\/\//, route => { network.push(route.request().url()); return route.abort(); });
    if (preference) await context.addInitScript(saved => localStorage.setItem('ddn.interface.v1', JSON.stringify(saved)), preference);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(join(distribution, 'complete', names[mode] + '.html')).href);
    await page.waitForFunction(() => !!window.DDN && !!document.querySelector('#ddn-source'));
    if (mode === 'designer') await openSample(page);
    if (mode !== 'verifier') await page.locator('.ddn-viewer-stage svg [data-ref]').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    return { page, network, errors };
}
const paint = page => page.locator('.ddn-viewer-stage > svg').evaluate(svg => [...svg.querySelectorAll('[fill],[stroke]')].map(element => [element.tagName, element.getAttribute('fill'), element.getAttribute('stroke')]));

// Exercise each actual downloaded utility, rather than a stand-in component.
test('all standalone utilities carry the maintained local DDN marks across four interface themes', async t => {
    const expected = {};
    for (const [kind, filename] of [['light', 'ddn.svg'], ['dark', 'ddn-dark.svg']])
        expected[kind] = 'data:image/svg+xml;base64,' + (await readFile(join(root, 'project/ddn/assets/brand', filename))).toString('base64');
    for (const mode of Object.keys(names)) await t.test(mode, async t => {
        const { page, network, errors } = await open(t, mode);
        assert.equal(await page.locator('body').getAttribute('data-ddn-ui-theme'), 'dark');
        const choice = page.getByLabel('Interface theme', { exact: true });
        assert.deepEqual(await choice.locator('option').evaluateAll(options => options.map(option => option.value)), themes);
        const light = page.locator('.app-logo-light'), dark = page.locator('.app-logo-dark');
        assert.equal(await light.getAttribute('src'), expected.light); assert.equal(await dark.getAttribute('src'), expected.dark);
        await page.waitForFunction(() => [...document.querySelectorAll('.app-logo-light,.app-logo-dark')].every(image => image.complete && image.naturalWidth > 0));
        for (const theme of themes) {
            await choice.selectOption(theme);
            assert.equal(await page.locator('body').getAttribute('data-ddn-ui-theme'), theme);
            assert.equal(await light.isVisible(), theme === 'light' || theme === 'warm');
            assert.equal(await dark.isVisible(), theme === 'dark' || theme === 'midnight');
        }
        assert.deepEqual(errors, []); assert.deepEqual(network, []);
    });
});

test('interface changes and source visibility retain document paint, source drafts and saved preference', async t => {
    const { page, network, errors } = await open(t);
    const source = page.getByRole('textbox', { name: 'DDN source', exact: true });
    const original = await source.inputValue(), beforePaint = await paint(page), beforeStage = await page.locator('.ddn-viewer-stage').evaluate(element => getComputedStyle(element).backgroundColor);
    for (const theme of themes) {
        await page.getByLabel('Interface theme', { exact: true }).selectOption(theme);
        assert.equal(await source.inputValue(), original); assert.deepEqual(await paint(page), beforePaint);
        assert.equal(await page.locator('.ddn-viewer-stage').evaluate(element=>getComputedStyle(element).backgroundColor),beforeStage);
    }
    await page.getByLabel('Interface theme', { exact: true }).selectOption('midnight');
    await page.reload(); await page.waitForFunction(() => !!window.DDN && !!document.querySelector('#ddn-source')); await openSample(page);
    assert.equal(await page.getByLabel('Interface theme', { exact: true }).inputValue(), 'midnight');
    const draft = original + '\n# Unsaved local drafting comment\n'; await source.fill(draft);
    const oldWidth = (await page.locator('.app-surface').boundingBox()).width;
    const hide = page.getByRole('button', { name: 'Hide source', exact: true });
    assert.equal(await hide.getAttribute('aria-expanded'), 'true'); await hide.click();
    const show = page.getByRole('button', { name: 'Show source', exact: true });
    assert.equal(await show.getAttribute('aria-expanded'), 'false'); assert.equal(await source.isVisible(), false);
    assert.ok((await page.locator('.app-surface').boundingBox()).width > oldWidth);
    await show.click(); assert.equal(await source.isVisible(), true); assert.equal(await source.inputValue(), draft);
    await page.screenshot({ path: join(reports, 'modern-designer-midnight.png') });
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
});

test('modern shell and floating controls fit narrow viewports while saved light preferences remain respected', async t => {
    const { page, network, errors } = await open(t, 'designer', { width: 390, height: 844 }, { name: 'light', overrides: {} });
    assert.equal(await page.getByLabel('Interface theme', { exact: true }).inputValue(), 'light');
    const source = page.locator('#ddn-source'), before = await source.inputValue();
    assert.equal(await source.isVisible(),false);
    assert.equal(await page.getByRole('button',{name:'Document tools',exact:true}).getAttribute('aria-expanded'),'false');
    assert.ok((await page.locator('.app-surface').boundingBox()).y<300);
    await page.getByRole('button',{name:'Show source',exact:true}).click();assert.equal(await source.isVisible(),true);
    await page.getByRole('button',{name:'Hide source',exact:true}).click();assert.equal(await source.inputValue(),before);
    for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.locator('.ddn-viewer-outline').getByRole('button', { name: 'Customer', exact: true }).click();
        await page.getByRole('button', { name: 'Appearance & presets', exact: true }).click();
        const form = page.getByRole('dialog', { name: 'Appearance & presets', exact: true });
        await form.getByRole('tab', { name: 'Font', exact: true }).click();
        const slider = form.getByRole('slider', { name: 'Font size (pt) slider', exact: true });
        const apply=form.getByRole('button',{name:'Close',exact:true});
        assert.equal(await apply.evaluate(element=>getComputedStyle(element).fontSize),'13px');
        const primary=await apply.evaluate(element=>({color:getComputedStyle(element).color,background:getComputedStyle(element).backgroundColor}));
        await apply.hover();await page.waitForTimeout(180);
        assert.equal(await apply.evaluate(element=>getComputedStyle(element).color),primary.color);
        await slider.fill('19'); assert.equal(await form.getByLabel('Font size (pt)', { exact: true }).inputValue(), '19');
        await page.waitForFunction(before => document.querySelector('#ddn-source').value !== before, before);
        const bounds = await form.boundingBox(), footer = await form.locator('footer').boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && footer.y + footer.height <= 844);
        assert.equal(await form.evaluate(element => element.scrollWidth <= element.clientWidth), true);
        await page.screenshot({ path: join(reports, `modern-mobile-${width}.png`) });
        await form.getByRole('button', {name: 'Revert changes', exact: true}).click(); await form.waitFor({state: 'detached'}); assert.equal(await source.inputValue(), before);
        assert.equal(await source.inputValue(), before);
    }
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
});
