import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const site=join(root,'website'),reports=join(root,'.work/reports/ddn-modern-ui/site');
const {chromium}=await import(pathToFileURL(join(root,'.work/tools/browser/node_modules/playwright/index.mjs')));
let browser,context,page;const errors=[],network=[];
before(async()=>{await mkdir(reports,{recursive:true});browser=await chromium.launch({headless:true});context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await context.route(/^https?:\/\//,route=>{network.push(route.request().url());return route.abort();});page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));});
after(async()=>{await context?.close();await browser?.close();});
const url=path=>pathToFileURL(join(site,path)).href;

test('modern website uses local brand variants and four persistent interface themes',async()=>{
 await page.goto(url('index.html'));await page.evaluate(()=>localStorage.removeItem('ddn.interface.v1'));await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 await page.locator('.logo').evaluate(image=>image.decode());assert.match(await page.locator('.logo').getAttribute('src'),/brand\/ddn-dark.svg$/);
 for(const theme of ['dark','light','midnight','warm']){
  await page.getByLabel('Website theme',{exact:true}).selectOption(theme);assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ddn.interface.v1')).name),theme);
  const variant=theme==='dark'||theme==='midnight'?'-dark':'';assert.ok((await page.locator('.logo').getAttribute('src')).endsWith('ddn'+variant+'.svg'));
  const iframe=new URL(await page.locator('iframe.live-embed').getAttribute('src'));assert.equal(iframe.searchParams.get('theme'),theme);
  await page.screenshot({path:join(reports,'home-'+theme+'.png')});
 }
 await page.goto(url('features/index.html'));assert.equal(await page.locator('html').getAttribute('data-theme'),'warm');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
});

test('mobile navigation, theme handoff and explicit tool themes remain usable offline',async()=>{
 await page.setViewportSize({width:390,height:844});await page.goto(url('index.html')+'?theme=midnight');
 assert.equal(await page.locator('html').getAttribute('data-theme'),'midnight');await page.getByRole('button',{name:'Menu',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Menu',exact:true}).getAttribute('aria-expanded'),'true');assert.equal(await page.getByRole('navigation',{name:'Main',exact:true}).isVisible(),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:join(reports,'mobile-navigation.png')});
 await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Menu',exact:true}).getAttribute('aria-expanded'),'false');
 await page.getByRole('link',{name:'Open designer',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');assert.equal(new URL(page.url()).searchParams.get('theme'),'midnight');assert.equal(await page.locator('body').getAttribute('data-ddn-ui-theme'),'midnight');
 await page.goto(url('features/appearance.html')+'?theme=warm');await page.getByRole('link',{name:'Dark designer',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');assert.equal(await page.locator('body').getAttribute('data-ddn-ui-theme'),'dark');
 assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
});
