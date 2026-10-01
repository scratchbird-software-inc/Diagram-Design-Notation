/* SPDX-License-Identifier: GPL-2.0-or-later. B1-100: headless-browser proof of
 * the mind-map entity interactions in the unified tool — wheel-scroll pans a
 * note-heavy entity's rows (DOM pan, no re-render), the lower-right handle
 * resizes the line cap through the presentation-only mindNodes channel
 * (re-render, source untouched). Same selftest pattern as
 * tests/field-guide-browser.js: an injected driver posts results back.
 *
 *   node tests/tool-mindmap-http.js
 */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'),
  http = require('node:http'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const BIN = require('./browser.js').findBrowser();
const PORT = 8146;
const BASE = 'http://127.0.0.1:' + PORT;
const results = [];
function test(name, fn) { return Promise.resolve().then(fn).then(() => { results.push({ name, pass: true }); console.log('PASS', name); }).catch(e => { results.push({ name, pass: false }); console.error('FAIL', name, e.message); process.exitCode = 1; }); }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.ddn': 'text/plain', '.md': 'text/plain', '.png': 'image/png' };
const hanging = [];
let resultWaiter = null;

const DRIVER = `<script>(async () => {
const lines = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = async (pass) => { try { await fetch('REPORT_URL', { method: 'POST', body: JSON.stringify({ pass, lines }) }); } catch (e) {} };
function stage() {
  const host = document.getElementById('ddn-diagram');
  const inner = host && host.firstElementChild && host.firstElementChild.shadowRoot ? host.firstElementChild.shadowRoot : (host && host.shadowRoot);
  return inner && inner.querySelector('.stage');
}
async function waitRender(timeout) {
  const host = document.getElementById('ddn-diagram');
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (host && host.getAttribute('data-ddn-rendered')) return host.getAttribute('data-ddn-render-ms');
    await sleep(250);
  }
  throw new Error('tool did not render in time');
}
try {
  await waitRender(90000);
  const st = stage();
  lines.push(st ? 'PASS tool stage reachable in shadow DOM' : 'FAIL no stage');
  const rows = [...st.querySelectorAll('.ddn-mind-rows[data-total]')].sort((a, b) => Number(b.dataset.total) - Number(a.dataset.total))[0];
  lines.push(rows ? 'PASS mind-map rows group present (total ' + rows.dataset.total + ', cap ' + rows.dataset.cap + ')' : 'FAIL no rows group');
  if (!rows) throw new Error('no rows group');
  const total = Number(rows.dataset.total), cap0 = Number(rows.dataset.cap);
  lines.push(total > cap0 ? 'PASS note-heavy entity exceeds the default cap (' + total + ' > ' + cap0 + ')' : 'FAIL fixture did not exceed the cap');
  lines.push(st.querySelector('.ddn-mind-scroll-thumb') ? 'PASS scrollbar thumb rendered' : 'FAIL no scrollbar thumb');
  const id = rows.dataset.node;

  // 1. wheel-scroll pans the rows (DOM pan — no re-render)
  const mark = document.getElementById('ddn-diagram').getAttribute('data-ddn-render-ms');
  rows.dispatchEvent(new WheelEvent('wheel', { deltaY: 240, bubbles: true, cancelable: true }));
  await sleep(400);
  const tf = rows.getAttribute('transform') || '';
  lines.push(/translate\\(0 -\\d/.test(tf) ? 'PASS wheel-scroll pans the rows group (' + tf + ')' : 'FAIL rows did not pan (' + tf + ')');
  const thumb = st.querySelector('.ddn-mind-scroll-thumb');
  const thumbY = Number(thumb.getAttribute('y'));
  lines.push(thumbY > Number(st.querySelector('.ddn-mind-scroll').dataset.trackY) ? 'PASS scrollbar thumb follows the offset (y=' + thumbY + ')' : 'FAIL thumb did not move');
  lines.push(document.getElementById('ddn-diagram').getAttribute('data-ddn-render-ms') === mark ? 'PASS scroll did not re-render' : 'FAIL scroll triggered a re-render');

  // 2. source is untouched by scrolling (presentation-only)
  const srcText0 = (document.querySelector('textarea') && document.querySelector('textarea').value) || '';
  lines.push(!srcText0.includes('x_mindmap') ? 'PASS source untouched after scroll' : 'FAIL source mutated by scroll');

  // 3. drag the lower-right handle down four rows → cap 10 → 14 via mindNodes
  const handle = st.querySelector('.ddn-mind-resize[data-node="' + CSS.escape(id) + '"]');
  lines.push(handle ? 'PASS resize handle present' : 'FAIL no resize handle');
  const r = handle.getBoundingClientRect(), cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  const rowH = Number(rows.dataset.rowH);
  const ms0 = document.getElementById('ddn-diagram').getAttribute('data-ddn-render-ms');
  handle.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, button: 0, bubbles: true }));
  handle.dispatchEvent(new PointerEvent('pointermove', { clientX: cx, clientY: cy + 4 * rowH, bubbles: true }));
  handle.dispatchEvent(new PointerEvent('pointerup', { clientX: cx, clientY: cy + 4 * rowH, bubbles: true }));
  const t0 = Date.now();
  let resized = null;
  while (Date.now() - t0 < 30000) {
    const now = st.querySelector('.ddn-mind-rows[data-node="' + CSS.escape(id) + '"]');
    if (now && Number(now.dataset.cap) === cap0 + 4 && document.getElementById('ddn-diagram').getAttribute('data-ddn-render-ms') !== ms0) { resized = now; break; }
    await sleep(250);
  }
  lines.push(resized ? 'PASS resize raised the cap to ' + (cap0 + 4) + ' and re-rendered' : 'FAIL cap did not change after drag');
  const srcText1 = (document.querySelector('textarea') && document.querySelector('textarea').value) || '';
  lines.push(!srcText1.includes('x_mindmap') ? 'PASS resize stayed presentation-only (no x_mindmap in source)' : 'FAIL resize wrote into source');

  // 4. Relation labels: none (new choice) — no labels, no badges, no legend
  const labelSel = document.querySelector('select[aria-label="Relation labels"]');
  lines.push(labelSel ? 'PASS Relation labels control found' : 'FAIL control missing');
  lines.push(labelSel && [...labelSel.options].some(o => o.value === 'none') ? 'PASS None choice offered' : 'FAIL None choice missing');
  const labelsBefore = st.querySelectorAll('.ddn-label').length;
  const ms1 = document.getElementById('ddn-diagram').getAttribute('data-ddn-render-ms');
  labelSel.value = 'none';
  labelSel.dispatchEvent(new Event('change', { bubbles: true }));
  const t1 = Date.now();
  let settled = false;
  while (Date.now() - t1 < 30000) {
    if (st.querySelectorAll('.ddn-label').length === 0 && document.getElementById('ddn-diagram').getAttribute('data-ddn-render-ms') !== ms1) { settled = true; break; }
    await sleep(250);
  }
  lines.push(settled ? 'PASS labels:none removes every relation label/badge (' + labelsBefore + ' → 0)' : 'FAIL labels still visible after none');
  lines.push(settled && !st.innerHTML.includes('RELATIONSHIP KEY') ? 'PASS labels:none also drops the legend' : 'FAIL legend remains after none');
  const srcText2 = (document.querySelector('textarea') && document.querySelector('textarea').value) || '';
  lines.push(!/legend \{ mode: none|mode: none/.test(srcText2) ? 'PASS labels:none stayed presentation-only' : 'FAIL labels:none wrote into source');
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
  if (url.pathname.endsWith('/website/tools/index.html') || url.pathname.endsWith('/tools/index.html')) {
    const inject = DRIVER.replace('REPORT_URL', BASE + '/result') + '<img src="' + BASE + '/hang" style="display:none" alt="">';
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
  assert.ok(fs.existsSync(path.join(root, 'website/tools/index.html')), 'built tool page missing — run npm run build:tool && npm run build:site');
  await new Promise(r => server.listen(PORT, r));
  try {
    await test('mind-map entity scroll + resize in the unified tool (headless)', async () => {
      const chrome = cp.spawn(BIN, ['--headless', '--disable-gpu', '--no-sandbox', '--window-size=1500,950',
        '--dump-dom', BASE + '/website/tools/index.html?src=../examples/basics/28-mind-map.ddn&mode=explore'], { stdio: 'pipe' });
      let body;
      try { body = await nextResult(150000); }
      finally { chrome.kill(); }
      const out = JSON.parse(body);
      for (const l of out.lines) console.log('  ', l);
      assert.ok(out.pass, 'mind-map interaction selftest failed');
    });
  } finally {
    for (const r of hanging) try { r.end(); } catch { /* gone */ }
    server.close();
  }
  const ok = results.filter(r => r.pass).length;
  console.log(`Tool mind-map interactions ${ok}/${results.length}`);
  if (ok !== results.length) process.exitCode = 1;
  process.exit(process.exitCode || 0);
})();
