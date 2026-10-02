/* SPDX-License-Identifier: GPL-2.0-or-later. B1-101 slice 2: headless proof of
 * the icon pack viewer page — all 328 icons listed, pack filter chips, search,
 * multi-size previews, and the click-to-copy x_icon reference toast.
 *
 *   node tests/icons-page-http.js
 */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'),
  http = require('node:http'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const BIN = require('./browser.js').findBrowser();
const PORT = 8152;
const BASE = 'http://127.0.0.1:' + PORT;
const results = [];
function test(name, fn) { return Promise.resolve().then(fn).then(() => { results.push({ name, pass: true }); console.log('PASS', name); }).catch(e => { results.push({ name, pass: false }); console.error('FAIL', name, e.message); process.exitCode = 1; }); }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
const hanging = [];
let resultWaiter = null;

const DRIVER = `<script>(async () => {
const lines = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = async (pass) => { try { await fetch('REPORT_URL', { method: 'POST', body: JSON.stringify({ pass, lines }) }); } catch (e) {} };
try {
  await sleep(800);
  const cards = () => [...document.querySelectorAll('.icon-card')];
  lines.push(cards().length === 328 ? 'PASS all 328 icons listed' : 'FAIL card count ' + cards().length);
  const first = cards()[0];
  lines.push(first && first.querySelectorAll('.icon-sizes svg').length === 4 ? 'PASS four preview sizes per card' : 'FAIL preview sizes missing');
  const count = document.getElementById('icon-count');
  lines.push(count && count.textContent.includes('328 of 328') ? 'PASS counter shows full set' : 'FAIL counter: ' + (count && count.textContent));

  // pack filter chip
  const chip = [...document.querySelectorAll('#icon-pack-filters button')].find(b => b.textContent === 'tabler-infra@1');
  lines.push(chip ? 'PASS pack filter chips rendered' : 'FAIL no chips');
  chip.click();
  await sleep(200);
  lines.push(cards().length === 50 ? 'PASS pack filter narrows to tabler (50)' : 'FAIL filtered count ' + cards().length);
  lines.push(document.querySelectorAll('.icon-pack').length === 1 ? 'PASS other packs hidden' : 'FAIL pack sections not filtered');

  // search across the pack filter
  const q = document.getElementById('icon-q');
  q.value = 'server'; q.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(200);
  lines.push(cards().length >= 1 && cards().every(c => (c.textContent).toLowerCase().includes('server') || c.querySelector('.icon-ref').textContent.includes('server')) ? 'PASS search within pack (' + cards().length + ')' : 'FAIL search mismatch');
  q.value = 'zz-no-such-icon'; q.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(200);
  lines.push(cards().length === 0 ? 'PASS empty search result empties the grid' : 'FAIL search did not empty');

  // copy toast carries the exact x_icon reference
  q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(200);
  cards()[0].click();
  await sleep(300);
  const toast = document.getElementById('icon-copied');
  lines.push(toast && toast.textContent.startsWith('Copied: x_icon: { library: "tabler-infra@1", icon: "') ? 'PASS copy toast has exact x_icon reference' : 'FAIL toast: ' + (toast && toast.textContent));
  await report(lines.every(l => l.startsWith('PASS')));
} catch (e) {
  lines.push('FAIL driver exception: ' + (e && e.message));
  await report(false);
}
})();</script>`;

const ART_DRIVER = `<script>(async () => {
const lines = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = async (pass) => { try { await fetch('REPORT_URL', { method: 'POST', body: JSON.stringify({ pass, lines }) }); } catch (e) {} };
try {
  await sleep(1200);
  const cards = () => [...document.querySelectorAll('.art-card')];
  lines.push(cards().length === 44 ? 'PASS all 44 art items listed' : 'FAIL art card count ' + cards().length);
  lines.push(cards().every(c => c.querySelector('.art-preview svg')) ? 'PASS every card renders its illustration' : 'FAIL card without preview svg');
  const count = document.getElementById('art-count');
  lines.push(count && count.textContent.includes('44 of 44') ? 'PASS counter shows full set' : 'FAIL counter: ' + (count && count.textContent));
  lines.push([...document.querySelectorAll('h2')].some(h => h.textContent === 'How to use art in your diagrams') ? 'PASS how-to-use section present' : 'FAIL how-to-use missing');
  lines.push([...document.querySelectorAll('h2')].some(h => h.textContent === 'How to add items') ? 'PASS how-to-add section present' : 'FAIL how-to-add missing');
  lines.push(document.body.textContent.includes('registerArtPack') && document.body.textContent.includes('--pack') ? 'PASS registration + --pack instructions present' : 'FAIL usage instructions incomplete');
  lines.push(document.body.textContent.includes('provenance') && document.body.textContent.includes('CC0') ? 'PASS provenance/license guidance present' : 'FAIL contribution guidance incomplete');
  const q = document.getElementById('art-q');
  q.value = 'server'; q.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(200);
  lines.push(cards().length >= 2 && cards().length < 44 ? 'PASS search narrows the grid (' + cards().length + ')' : 'FAIL search count ' + cards().length);
  q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(200);
  cards()[0].click();
  await sleep(1200);
  const toast = document.getElementById('icon-copied');
  lines.push(toast && toast.textContent.startsWith('Copied: x_art: { library: "presentation-devices@1", item: "') ? 'PASS copy toast has exact x_art reference' : 'FAIL toast: ' + (toast && toast.textContent));
  await report(lines.every(l => l.startsWith('PASS')));
} catch (e) {
  lines.push('FAIL driver exception: ' + (e && e.message));
  await report(false);
}
})();</script>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, BASE);
  if (url.pathname === '/hang') { hanging.push(res); return; }
  if (url.pathname === '/result' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      res.statusCode = 204; res.end();
      for (const h of hanging.splice(0)) { h.setHeader('content-type', 'image/gif'); h.end(Buffer.from('R0lGODlhAQABAAAAACw=', 'base64')); }
      if (resultWaiter) { const w = resultWaiter; resultWaiter = null; w(body); }
    });
    return;
  }
  const p = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
  if (!p.startsWith(root) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { res.statusCode = 404; res.end(); return; }
  let bytes = fs.readFileSync(p);
  if (url.pathname.endsWith('/website/icons/index.html')) {
    const inject = DRIVER.replace('REPORT_URL', BASE + '/result') + '<img src="' + BASE + '/hang" style="display:none" alt="">';
    bytes = Buffer.from(bytes.toString('utf8').replace('</body>', () => inject + '\n</body>'));
  }
  if (url.pathname.endsWith('/website/icons/art.html')) {
    const inject = ART_DRIVER.replace('REPORT_URL', BASE + '/result') + '<img src="' + BASE + '/hang" style="display:none" alt="">';
    bytes = Buffer.from(bytes.toString('utf8').replace('</body>', () => inject + '\n</body>'));
  }
  res.setHeader('content-type', MIME[path.extname(p)] || 'application/octet-stream');
  res.end(bytes);
});

function nextResult(timeoutMs) {
  return new Promise((resolve, reject) => {
    resultWaiter = resolve;
    setTimeout(() => reject(new Error('timed out waiting for the page to post results')), timeoutMs);
  });
}

(async () => {
  assert.ok(fs.existsSync(path.join(root, 'website/icons/index.html')), 'icon viewer page missing — run npm run build:site');
  await new Promise(r => server.listen(PORT, r));
  try {
    await test('icon pack viewer: list, filter, search, copy (headless)', async () => {
      const chrome = cp.spawn(BIN, ['--headless', '--disable-gpu', '--no-sandbox', '--window-size=1300,1000',
        '--dump-dom', BASE + '/website/icons/index.html'], { stdio: 'pipe' });
      let body;
      try { body = await nextResult(60000); }
      finally { chrome.kill(); }
      const out = JSON.parse(body);
      for (const l of out.lines) console.log('  ', l);
      assert.ok(out.pass, 'icon viewer selftest failed');
    });
    await test('tool icon picker links to the viewer', async () => {
      const html = fs.readFileSync(path.join(root, 'website/tools/index.html'), 'utf8');
      assert.ok(html.includes('id="ddn-icon-viewer"'), 'viewer link missing from the built tool');
      assert.ok(html.includes('href="../icons/index.html"'), 'viewer link target wrong');
    });
    await test('viewer link target resolves on the site', async () => {
      assert.ok(fs.existsSync(path.join(root, 'website/icons/index.html')), 'icons/index.html not in the built site');
    });
    await test('art pack viewer: all items, search, copy, how-to sections (headless)', async () => {
      const chrome = cp.spawn(BIN, ['--headless', '--disable-gpu', '--no-sandbox', '--window-size=1300,1000',
        '--dump-dom', BASE + '/website/icons/art.html'], { stdio: 'pipe' });
      let body;
      try { body = await nextResult(60000); }
      finally { chrome.kill(); }
      const out = JSON.parse(body);
      for (const l of out.lines) console.log('  ', l);
      assert.ok(out.pass, 'art viewer selftest failed');
    });
    await test('art viewer is linked from the icon viewer and the reference index', async () => {
      assert.ok(fs.readFileSync(path.join(root, 'website/icons/index.html'), 'utf8').includes('href="art.html"'), 'icon viewer lacks the art link');
      assert.ok(fs.readFileSync(path.join(root, 'website/reference/index.html'), 'utf8').includes('icons/art.html'), 'reference index lacks the art link');
    });
  } finally {
    for (const r of hanging) try { r.end(); } catch { /* gone */ }
    server.close();
  }
  const ok = results.filter(r => r.pass).length;
  console.log(`Icon pack viewer ${ok}/${results.length}`);
  if (ok !== results.length) process.exitCode = 1;
  process.exit(process.exitCode || 0);
})();
