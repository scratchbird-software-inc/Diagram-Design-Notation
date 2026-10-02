/* SPDX-License-Identifier: GPL-2.0-or-later. B1-098 run 5: browser proof for the
 * live field guide — lesson pages and the portable single-file edition driven
 * in headless Chromium over HTTP. Same selftest pattern as tool-host-io-http:
 * a driver script is injected into the served page, runs the exercise controls
 * (guided edit → render changes; undo → byte-identical; variants; evaluation
 * panel; portable hash routing), and POSTs the results back.
 *
 *   node tests/field-guide-browser.js
 */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'),
  http = require('node:http'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const BIN = require('./browser.js').findBrowser();
const PORT = 8145;
const BASE = 'http://127.0.0.1:' + PORT;
const results = [];
function test(name, fn) { return Promise.resolve().then(fn).then(() => { results.push({ name, pass: true }); console.log('PASS', name); }).catch(e => { results.push({ name, pass: false }); console.error('FAIL', name, e.message); process.exitCode = 1; }); }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.ddn': 'text/plain', '.md': 'text/plain' };
const hanging = [];
let resultWaiter = null;

/* The driver runs inside the page. It exercises the shipped controls through
 * the same code paths a reader uses and reports PASS/FAIL lines back. */
const DRIVER = `<script>(async () => {
const lines = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = async (pass) => {
  try { await fetch('REPORT_URL', { method: 'POST', body: JSON.stringify({ pass, lines }) }); } catch (e) {}
};
try {
  await sleep(400);
  if (location.pathname.endsWith('portable.html')) {
    lines.push(document.querySelectorAll('#sidebar .nav-list a').length >= 140 ? 'PASS portable lists every chapter' : 'FAIL portable chapter list incomplete');
    location.hash = '#/HASH_ID';
    await sleep(700);
    lines.push(document.querySelector('#lesson .lesson-title') ? 'PASS portable hash routing opened the chapter' : 'FAIL portable hash routing');
  }
  const view = () => document.getElementById('main-view').innerHTML;
  if (!view().includes('<svg')) throw new Error('no live SVG rendered');
  lines.push('PASS live render present');
  /* Art-pack chapters must show real artwork, not the unregistered-pack
   * placeholder: the guide page context registers embedded ddn-art-pack@1
   * documents before the first render. */
  if (document.querySelector('[data-art]')) {
    lines.push(!document.querySelector('.ddn-art-missing') ? 'PASS art pack registered in the page context (real artwork, no placeholders)' : 'FAIL art pack not registered — placeholder visible');
  }
  const before = view();
  document.getElementById('guided').click();
  await sleep(300);
  const changed = view();
  lines.push(before !== changed ? 'PASS guided edit changes the render' : 'FAIL guided edit did not change the render');
  document.getElementById('undo').click();
  await sleep(300);
  lines.push(view() === before ? 'PASS undo restores the shipped bytes' : 'FAIL undo did not restore');
  const variant = document.getElementById('variant');
  if (variant && variant.options.length > 1) {
    variant.selectedIndex = 1; variant.onchange();
    await sleep(300);
    lines.push(view().includes('<svg') ? 'PASS variant re-renders' : 'FAIL variant render missing');
  }
  const evalBtn = document.getElementById('evaluation-run');
  if (evalBtn) {
    evalBtn.click();
    await sleep(300);
    const out = document.getElementById('evaluation-result').textContent;
    lines.push(out && !out.startsWith('No evaluation') && !out.startsWith('Evaluation failed') ? 'PASS evaluation panel returns a verdict' : 'FAIL evaluation: ' + out.slice(0, 80));
  }
  const errs = window.__guideErrors || [];
  lines.push(errs.length === 0 ? 'PASS zero console errors' : 'FAIL console errors: ' + errs.join('; ').slice(0, 120));
  await report(lines.every(l => l.startsWith('PASS')));
} catch (e) {
  lines.push('FAIL driver exception: ' + (e && e.message));
  await report(false);
}
})();</script>`;

const ERROR_TRAP = `<script>window.__guideErrors = [];window.addEventListener('error', e => window.__guideErrors.push(String(e.message)));</script>`;

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
  if (url.pathname.includes('/field-guide/lessons/') || url.pathname.includes('/website/guide/lessons/') || url.pathname.endsWith('/field-guide/portable.html')) {
    /* The hanging <img> delays the load event so headless chrome stays alive
     * until the driver POSTs its results. */
    const inject = ERROR_TRAP + DRIVER.replace('REPORT_URL', BASE + '/result').replace('HASH_ID', url.searchParams.get('chapter') || 'raci') +
      '<img src="' + BASE + '/hang" style="display:none" alt="">';
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

async function runCase(name, rel, chapter) {
  const chrome = cp.spawn(BIN, ['--headless', '--disable-gpu', '--no-sandbox', '--window-size=1400,900',
    '--dump-dom', BASE + '/' + rel + (chapter ? '?chapter=' + chapter : '')], { stdio: 'pipe' });
  let body;
  try { body = await nextResult(120000); }
  finally { chrome.kill(); }
  const out = JSON.parse(body);
  for (const l of out.lines) console.log('  ', l);
  assert.ok(out.pass, name + ' browser selftest failed');
}

(async () => {
  assert.ok(fs.existsSync(path.join(root, 'field-guide/portable.html')), 'portable edition missing — run node tools/build-field-guide.mjs');
  await new Promise(r => server.listen(PORT, r));
  try {
    await test('lesson page: matrix experiment (raci)', () => runCase('raci', 'field-guide/lessons/raci.html'));
    await test('lesson page: geo chapter with registered geography', () => runCase('geo', 'field-guide/lessons/geo.html'));
    await test('lesson page: decision table rule experiment + evaluation panel', () => runCase('decision', 'field-guide/lessons/decision-unique.html'));
    await test('lesson page: lifecycle trace replay panel', () => runCase('lifecycle', 'field-guide/lessons/lifecycle-trace.html'));
    await test('lesson page: variants (empathy-scorecard)', () => runCase('variants', 'field-guide/lessons/empathy-scorecard.html'));
    await test('portable edition: hash routing + guided edit (story-map)', () => runCase('portable story-map', 'field-guide/portable.html', 'story-map'));
    await test('portable edition: waterfall value experiment', () => runCase('portable waterfall', 'field-guide/portable.html', 'waterfall'));
    await test('lesson page: art pack registered (presentation-art)', () => runCase('presentation-art', 'field-guide/lessons/presentation-art.html'));
    await test('portable edition: art pack registered (presentation-art)', () => runCase('portable presentation-art', 'field-guide/portable.html', 'presentation-art'));
    await test('site mirror lesson renders (physical-model)', () => runCase('site mirror physical-model', 'website/guide/lessons/physical-model.html'));
    await test('site mirror art lesson renders (presentation-art)', () => runCase('site mirror presentation-art', 'website/guide/lessons/presentation-art.html'));
  } finally {
    for (const r of hanging) try { r.end(); } catch { /* gone */ }
    server.close();
  }
  const ok = results.filter(r => r.pass).length;
  console.log(`Field guide browser ${ok}/${results.length}`);
  if (ok !== results.length) process.exitCode = 1;
  process.exit(process.exitCode || 0);
})();
