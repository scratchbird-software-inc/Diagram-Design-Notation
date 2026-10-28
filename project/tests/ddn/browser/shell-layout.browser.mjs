import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const distribution = process.env.DDN_DDN_DISTRIBUTION ?? resolve(root, '.work/builds/ddn-distribution');
const tool = process.env.DDN_PLAYWRIGHT_ROOT ?? resolve(root, '.work/tools/browser/node_modules/playwright');
const { chromium } = await import(pathToFileURL(join(tool, 'index.mjs')));

test('mobile shells keep long source and view selectors inside the viewport', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        for (const mode of ['viewer', 'visual-designer']) {
            const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
            try {
                await page.goto(pathToFileURL(join(distribution, 'ddn-' + mode + '.html')).href);
                await page.locator('.app-status').filter({ hasText: /ready/ }).waitFor();
                await page.getByRole('button', {name: 'Document tools', exact: true}).click();
                const name = 'customer-relations-and-order-fulfilment-review-for-the-quarter.ddn';
                await page.locator('input[type=file]').setInputFiles([
                    { name, mimeType: 'text/plain', buffer: Buffer.from('erd Sales : Customer data and orders shared across the company\n    Customer\n    Order\n    connect Customer to Order\nview Review as ddn@1 : Long review view title that should fit on a phone\n    use Customer\n') },
                    { name: 'supporting-diagram-definitions-for-this-review.ddn', mimeType: 'text/plain', buffer: Buffer.from('element Supplement as note\n') },
                ]);
                await page.waitForFunction(name => document.querySelector('#ddn-source')?.value.includes('Customer data and orders') && document.querySelector('[aria-label="Source file"]')?.value === name && document.querySelector('.app-status')?.textContent.includes('ready'), name);
                assert.equal(await page.getByLabel('Source file', { exact: true }).inputValue(), name);
                for (const width of [390, 320]) {
                    await page.setViewportSize({ width, height: 844 });
                    const result = await page.evaluate(() => ({
                        overflow: document.documentElement.scrollWidth > innerWidth,
                        controls: [...document.querySelectorAll('.app-tools select')].map(select => {
                            const bounds = select.getBoundingClientRect();
                            return { name: select.getAttribute('aria-label'), left: bounds.left, right: bounds.right, width: bounds.width };
                        }),
                    }));
                    assert.equal(result.overflow, false, `${mode} at ${width}px must not scroll horizontally`);
                    for (const control of result.controls) {
                        assert.ok(control.left >= 0 && control.right <= width && control.width > 30,
                            `${mode} ${control.name} remains usable within ${width}px: ${JSON.stringify(control)}`);
                    }
                }
            } finally { await page.close(); }
        }
    } finally { await browser.close(); }
});
