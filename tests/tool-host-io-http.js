/* SPDX-License-Identifier: GPL-2.0-or-later. B1-050 (D1/D2/D3/D5): the host I/O
 * contract of the embedded tool in a real browser. chrome-headless-shell runs
 * the committed example page website/examples/embed/tool-host-roundtrip.html
 * (served over HTTP like any static host) with ?selftest=1; the page drives
 * the embedded tool through DDNTool.setSource/getSource/onSourceChange —
 * including the D5 appearance round trip (getSource({includeAppearance:true})
 * → setSource → SVG byte-identical, CSS overlay restored) — and POSTs the
 * result lines back here. Run twice: default (worker) and ?worker=off (D1
 * parity). The hanging /hang request keeps the page alive in real time until
 * the POST lands (virtual time races worker messages otherwise — same idiom
 * as tool-worker-http.js).
 */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'),
  os = require('node:os'), http = require('node:http'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const site = path.join(root, 'website');
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
const PORT = 8144;
const BASE = 'http://127.0.0.1:' + PORT;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ddn': 'text/plain' };
const hanging = [];
let resultWaiter = null;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, BASE);
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
  const p = path.normalize(path.join(site, decodeURIComponent(url.pathname)));
  if (!p.startsWith(site) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { res.statusCode = 404; res.end(); return; }
  let bytes = fs.readFileSync(p);
  if (url.pathname.endsWith('tool-host-roundtrip.html')) {
    /* The hanging <img> delays the load event so headless chrome stays alive
     * until the selftest POSTs its results. */
    bytes = Buffer.from(bytes.toString('utf8').replace('</body>', () =>
      '<img src="' + BASE + '/hang" style="display:none" alt="">\n</body>'));
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
async function runCase(name, pageQuery) {
  const chrome = cp.spawn(BIN, ['--headless', '--disable-gpu', '--no-sandbox', '--window-size=1400,900',
    '--dump-dom', BASE + '/examples/embed/tool-host-roundtrip.html?selftest=1&report=' + encodeURIComponent(BASE + '/result') + pageQuery], { stdio: 'pipe' });
  let body;
  try { body = await nextResult(120000); }
  finally { chrome.kill(); }
  const out = JSON.parse(body);
  for (const l of out.lines) console.log('  ', l);
  assert.ok(out.pass, name + ' selftest failed');
  assert.ok(out.lines.length >= 12, 'selftest ran the full battery');
  assert.ok(out.lines.every(l => l.startsWith('PASS')), 'all lines pass');
}

(async () => {
  assert.ok(fs.existsSync(BIN), 'missing ' + BIN);
  assert.ok(fs.existsSync(path.join(site, 'examples/embed/tool-host-roundtrip.html')), 'example page missing — run build:site? (the page is committed)');
  await new Promise(r => server.listen(PORT, r));
  try {
    await test('host I/O round trip over HTTP, render worker default', () => runCase('worker', ''));
    await test('host I/O round trip over HTTP, ?worker=off parity', () => runCase('sync', '&worker=off'));
  } finally {
    for (const r of hanging) try { r.end(); } catch { /* gone */ }
    server.close();
  }
  const ok = results.filter(r => r.pass).length;
  console.log(`Tool host I/O HTTP ${ok}/${results.length}`);
  if (ok !== results.length) process.exitCode = 1;
  process.exit(process.exitCode || 0);
})();
