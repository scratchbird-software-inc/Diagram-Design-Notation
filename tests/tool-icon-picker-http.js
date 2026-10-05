/* SPDX-License-Identifier: GPL-2.0-or-later. End-user icon pack: headless
 * proof of the designer's icon picker — browse the shipped packs, bind an
 * icon to a node (x_icon, persisted in source), clear it again. Same selftest
 * harness as tests/tool-mindmap-http.js.
 *
 *   node tests/tool-icon-picker-http.js
 */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'),
  http = require('node:http'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const BIN = require('./browser.js').findBrowser();
const PORT = 8148;
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
    if (host && host.getAttribute('data-ddn-rendered')) return true;
    await sleep(250);
  }
  const errEl = document.getElementById('ddn-source-error');
  const statEl = document.getElementById('ddn-status');
  throw new Error('tool did not render in time (host=' + !!host + ', rendered=' + (host && host.getAttribute('data-ddn-rendered')) + ', err=' + (errEl && errEl.textContent.slice(0, 120)) + ', status=' + (statEl && statEl.textContent.slice(0, 120)) + ')');
}
try {
  await waitRender(90000);
  const st = stage();
  lines.push(st ? 'PASS tool stage reachable' : 'FAIL no stage');

  // select the node so the inspector drawer opens (phase 3: right-side drawer)
  const node = st.querySelector('.ddn-node[data-id]');
  lines.push(node ? 'PASS node present' : 'FAIL no node');
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await sleep(600);
  const meaning = document.getElementById('ddn-inspector-tab-meaning');
  const browse = meaning && [...meaning.querySelectorAll('button')].find(b => b.textContent === 'Browse icons…');
  lines.push(browse ? 'PASS inspector Icon row enabled after selection' : 'FAIL Icon row not enabled');

  // open the picker, search for the robot icon in the new general pack
  browse.click();
  await sleep(300);
  const popup = document.getElementById('ddn-icon-popup');
  lines.push(popup && !popup.hidden ? 'PASS icon picker opens' : 'FAIL picker did not open');
  const search = document.getElementById('ddn-icon-search');
  search.value = 'robot';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(300);
  const picks = [...document.querySelectorAll('.ddn-icon-pick')];
  lines.push(picks.length >= 1 ? 'PASS search finds icons (' + picks.length + ')' : 'FAIL search found nothing');
  const robot = picks.find(b => b.getAttribute('data-icon') === 'ddn-pack-general@1/robot');
  lines.push(robot ? 'PASS ddn-pack-general@1/robot listed in the picker' : 'FAIL general pack icon missing from picker');
  robot.click();
  await sleep(1500);
  const setIcon = st.querySelector('.ddn-icon[data-icon="ddn-pack-general@1/robot"]');
  lines.push(setIcon ? 'PASS node renders the picked icon' : 'FAIL icon did not render after picking');
  const meaning2 = document.getElementById('ddn-inspector-tab-meaning');
  const curShown = meaning2 && [...meaning2.querySelectorAll('span.ddn-dim')].some(s => s.textContent === 'ddn-pack-general@1/robot');
  lines.push(curShown ? 'PASS inspector shows the bound icon' : 'FAIL inspector icon state wrong');
  const srcToggle = document.getElementById('ddn-icon-source');
  if (srcToggle) srcToggle.click();
  await sleep(800);
  const src1 = (document.getElementById('ddn-source') && document.getElementById('ddn-source').value) || '';
  lines.push(src1.includes('ddn-pack-general@1') ? 'PASS x_icon persisted into source (model metadata)' : 'FAIL source lacks x_icon: ' + src1.slice(0, 80));

  // clear it again
  const meaning3 = document.getElementById('ddn-inspector-tab-meaning');
  const clearBtn = meaning3 && [...meaning3.querySelectorAll('button')].find(b => b.textContent === 'Clear icon');
  lines.push(clearBtn ? 'PASS Clear icon button present' : 'FAIL Clear icon button missing');
  clearBtn.click();
  await sleep(1500);
  lines.push(!st.querySelector('.ddn-icon[data-icon="ddn-pack-general@1/robot"]') ? 'PASS clear removes the icon from the node' : 'FAIL icon still rendered after clear');
  const src2 = (document.getElementById('ddn-source') && document.getElementById('ddn-source').value) || '';
  lines.push(!src2.includes('x_icon') ? 'PASS clear removes x_icon from source' : 'FAIL x_icon still in source');
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
    await test('icon picker: browse, bind, render, clear (headless)', async () => {
      const chrome = cp.spawn(BIN, ['--headless', '--disable-gpu', '--no-sandbox', '--window-size=1500,950',
        '--dump-dom', BASE + '/website/tools/index.html?src=../examples/basics/02-elements.ddn&mode=design'], { stdio: 'pipe' });
      let body;
      try { body = await nextResult(150000); }
      finally { chrome.kill(); }
      const out = JSON.parse(body);
      for (const l of out.lines) console.log('  ', l);
      assert.ok(out.pass, 'icon picker selftest failed');
    });
  } finally {
    for (const r of hanging) try { r.end(); } catch { /* gone */ }
    server.close();
  }
  const ok = results.filter(r => r.pass).length;
  console.log(`Tool icon picker ${ok}/${results.length}`);
  if (ok !== results.length) process.exitCode = 1;
  process.exit(process.exitCode || 0);
})();
