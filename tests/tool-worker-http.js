/* SPDX-License-Identifier: GPL-2.0-or-later. B1-043 (D1/D5/D6/D8): the unified
 * tool's render worker in a real browser. chrome-headless-shell runs the
 * committed single-file tool (via the website mirror) and a driver script
 * injected by the test server; results come back over HTTP POST, so the run
 * does not depend on --dump-dom timing (virtual time does not wait for worker
 * messages; a pending /hang fetch keeps the page alive until the POST lands).
 *
 *   1. default: Blob-URL worker drives rendering (data-ddn-render-mode=worker)
 *      and nine corpus views produce SVG byte-identical to an in-page
 *      renderSync of the same inputs (D5) — with canvas-measured fonts, the
 *      worker's OffscreenCanvas measurements must match or the bridge degrades
 *      and the mode check fails.
 *   2. ?worker=off: sync fallback path renders the same bytes (D1).
 *   3. file://: the self-contained file renders through the worker from a
 *      file:// page (D6; Blob workers verified on file:// in Chromium).
 */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'),
  os = require('node:os'), http = require('node:http'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const results = [];
function test(name, fn) {
  const out = fn();
  const done = r => { results.push(r); if (r.pass) console.log('PASS', name); else { console.error('FAIL', name, r.err && r.err.stack || r.err); process.exitCode = 1; } };
  Promise.resolve(out).then(() => done({ name, pass: true }), err => done({ name, pass: false, err }));
  return out;
}

const shellDir = path.join(os.homedir(), '.cache', 'ms-playwright');
const shell = fs.readdirSync(shellDir).filter(d => d.startsWith('chromium_headless_shell-')).sort().pop();
const BIN = path.join(shellDir, shell, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
const PORT = 8143;
const BASE = 'http://127.0.0.1:' + PORT;

const DRIVER = `
(async () => {
  const out = { checks: [] };
  const check = (name, ok, extra) => out.checks.push({ name, ok: !!ok, extra: extra == null ? '' : String(extra).slice(0, 300) });
  const params = new URLSearchParams(location.search);
  const expect = params.get('expect') || 'worker';
  try {
    const host = document.getElementById('ddn-diagram');
    const deadline = Date.now() + 45000;
    while (!host.hasAttribute('data-ddn-rendered')) {
      if (Date.now() > deadline) throw new Error('initial render timed out: ' + document.getElementById('ddn-tool-status').textContent);
      await new Promise(r => setTimeout(r, 60));
    }
    check('initial render', true);
    check('render mode is ' + expect, host.getAttribute('data-ddn-render-mode') === expect, host.getAttribute('data-ddn-render-mode'));
    const wst = DDNTool.getRenderWorkerState();
    if (expect === 'worker') check('bridge live', !wst.degraded && !wst.disabledReason, JSON.stringify(wst));
    else check('bridge off with reason', wst.disabledReason === '?worker=off', JSON.stringify(wst));
    const status = () => document.getElementById('ddn-tool-status').textContent;
    check('no error status', !status().startsWith('Error:'), status());
    const entries = DDNLiveData.catalogue.entries;
    const picks = [0, 40, 90, 150, 210, 260, 310, 360].filter(i => i < entries.length);
    for (const i of picks) {
      const e = entries[i];
      DDNTool.loadExample(i);
      const d = DDNTool.diagram;
      if (!d) { check('mounted ' + i, false, JSON.stringify({ entry: DDNTool.state.entry, view: DDNTool.state.view, status: document.getElementById('ddn-tool-status').textContent })); continue; }
      const rt0 = performance.now();
      await d.ready;
      check('render latency ' + i, true, expect + ' ' + Math.round(performance.now() - rt0) + ' ms request-to-display');
      const got = d.result && d.result.svg;
      const want = DDNTool.workspace.renderSync({ entry: DDNTool.state.entry, view: DDNTool.state.view }).svg;
      check('svg byte-equal ' + e.entry + '#' + e.view, got === want, (got || '').length + ' vs ' + (want || '').length);
      check('mode stays ' + expect, host.getAttribute('data-ddn-render-mode') === expect);
      check('no error status after ' + i, !status().startsWith('Error:'), status());
    }
    // D8 smoke: two back-to-back view loads leave the page on the last one, no error.
    DDNTool.loadExample(picks[0]);
    DDNTool.loadExample(picks[1]);
    await DDNTool.diagram.ready;
    await new Promise(r => setTimeout(r, 300));
    check('superseded renders settle clean', host.hasAttribute('data-ddn-rendered') && !status().startsWith('Error:'), status());
  } catch (e) { out.fatal = String(e && e.stack || e); }
  try { await fetch(RESULT_URL, { method: 'POST', body: JSON.stringify(out) }); } catch (e) { /* server gone */ }
})();
`;

const toolHtml = fs.readFileSync(path.join(root, 'website/tools/index.html'), 'utf8');
function driverPage() {
  /* The hanging <img> delays the load event so headless chrome keeps the page
   * alive in real time (virtual-time budgets race worker messages); the server
   * releases it once the driver has posted its results. */
  return toolHtml.replace('</body>', () =>
    '<img src="' + BASE + '/hang" style="display:none" alt="">\n' +
    '<script>globalThis.RESULT_URL=' + JSON.stringify(BASE + '/result') + ';</script>\n<script src="' + BASE + '/__driver.js"></script>\n</body>');
}

const hanging = [];
let resultWaiter = null;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, BASE);
  if (url.pathname === '/__tool') { res.setHeader('content-type', 'text/html'); res.end(driverPage()); return; }
  if (url.pathname === '/__driver.js') { res.setHeader('content-type', 'text/javascript'); res.end(DRIVER); return; }
  if (url.pathname === '/hang') { hanging.push(res); return; }
  if (url.pathname === '/result' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      res.setHeader('access-control-allow-origin', '*');
      res.statusCode = 204; res.end();
      for (const h of hanging.splice(0)) { h.setHeader('content-type', 'image/gif'); h.end(Buffer.from('R0lGODlhAQABAAAAACw=', 'base64')); }
      if (resultWaiter) { const w = resultWaiter; resultWaiter = null; w(body); }
    });
    return;
  }
  if (req.method === 'OPTIONS') { res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-methods', 'POST'); res.statusCode = 204; res.end(); return; }
  res.statusCode = 404; res.end();
});

function nextResult(timeoutMs) {
  return new Promise((resolve, reject) => {
    resultWaiter = resolve;
    setTimeout(() => reject(new Error('timed out waiting for the page to post results')), timeoutMs);
  });
}
function runChrome(url) {
  return cp.spawn(BIN, ['--headless', '--disable-gpu', '--no-sandbox', '--window-size=1400,900',
    '--dump-dom', url], { stdio: 'pipe' });
}
async function runCase(name, url) {
  const chrome = runChrome(url);
  let body;
  try { body = await nextResult(90000); }
  finally { chrome.kill(); }
  const out = JSON.parse(body);
  const bad = out.checks.filter(c => !c.ok);
  for (const c of out.checks) console.log('  ', c.ok ? 'ok  ' : 'BAD ', c.name, c.ok ? (c.name.startsWith('render latency') ? '— ' + c.extra : '') : '— ' + c.extra);
  assert.ok(!out.fatal, 'driver fatal: ' + out.fatal);
  assert.deepEqual(bad, [], bad.length + ' failed checks');
  assert.ok(out.checks.length >= 10, 'driver ran the full battery');
}

(async () => {
  assert.ok(fs.existsSync(BIN), 'missing ' + BIN);
  await new Promise(r => server.listen(PORT, r));
  try {
    await test('worker default over HTTP: worker mode + byte-identical SVG on corpus sample', () =>
      runCase('http-worker', BASE + '/__tool?expect=worker'));
    await test('?worker=off over HTTP: sync fallback renders the same bytes', () =>
      runCase('http-off', BASE + '/__tool?worker=off&expect=sync'));
    await test('file:// single file: worker renders (D6 verified, CSP-free)', async () => {
      const tmp = path.join(os.tmpdir(), 'ddn-tool-file-test-' + process.pid + '.html');
      fs.writeFileSync(tmp, driverPage());
      try { await runCase('file-worker', 'file://' + tmp + '?expect=worker'); }
      finally { fs.unlinkSync(tmp); }
    });
  } finally {
    for (const r of hanging) try { r.end(); } catch { /* gone */ }
    server.close();
  }
  const ok = results.filter(r => r.pass).length;
  console.log(`Tool worker HTTP ${ok}/${results.length}`);
  if (ok !== results.length) process.exitCode = 1;
  process.exit(process.exitCode || 0);
})();
