/* SPDX-License-Identifier: GPL-2.0-or-later. B1-023 (D5) + B1-027 (D5/D6):
 * ?src= deep link over real HTTP. Starts tools/serve.js on a local port, then
 * drives the committed unified-tool mirror (website/tools/index.html) in
 * headless chromium:
 *   1. ?src=../examples/basics/61-self-contained.ddn renders an SVG diagram.
 *   2. ?src= to a multi-file example renders through the import closure.
 *   3. ?src=javascript:… is rejected inline (no fetch, no render).
 *   4. ?src= to a missing file surfaces the HTTP status, not a silent failure.
 *   5. The retired viewer URL redirects to the tool, params preserved.
 */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'),
  os = require('node:os'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { results.push({ name, pass: false }); console.error('FAIL', name, e.stack); process.exitCode = 1; } }

const shellDir = path.join(os.homedir(), '.cache', 'ms-playwright');
const shell = fs.readdirSync(shellDir).filter(d => d.startsWith('chromium_headless_shell-')).sort().pop();
const BIN = path.join(shellDir, shell, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
const PORT = 8137;
const PAGE = 'http://127.0.0.1:' + PORT + '/website/tools/index.html';

function dumpDom(url) {
  return cp.execFileSync(BIN, ['--headless', '--disable-gpu', '--no-sandbox', '--window-size=1400,900',
    '--virtual-time-budget=15000', '--dump-dom', url], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 }).toString();
}
function statusLine(dom) {
  const m = dom.match(/<span id="ddn-tool-status"[^>]*>([\s\S]*?)<\/span>/);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '(status not found)';
}
const rendered = dom => dom.includes('data-ddn-rendered=');

const server = cp.spawn(process.execPath, [path.join(root, 'tools/serve.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
let ready = false;
server.stdout.on('data', () => { ready = true; });
try {
  const deadline = Date.now() + 5000;
  while (!ready && Date.now() < deadline) cp.execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},100)']);

  test('tool ?src= renders an example over HTTP', () => {
    assert.ok(fs.existsSync(BIN), 'missing ' + BIN);
    const dom = dumpDom(PAGE + '?src=../examples/basics/61-self-contained.ddn');
    assert.ok(rendered(dom), 'no rendered SVG in the DOM:\n' + statusLine(dom));
    assert.ok(!statusLine(dom).startsWith('Error:'), 'unexpected error: ' + statusLine(dom));
    assert.ok(dom.includes('61-self-contained.ddn'), 'loaded entry not reflected in the page');
  });

  test('tool ?src= renders a multi-file example through the import closure', () => {
    const dom = dumpDom(PAGE + '?src=../examples/basics/01-customer.ddn');
    assert.ok(rendered(dom), 'multi-file example did not render:\n' + statusLine(dom));
    assert.ok(!statusLine(dom).startsWith('Error:'), 'unexpected error: ' + statusLine(dom));
  });

  test('tool ?src=javascript:… is rejected before any fetch', () => {
    const dom = dumpDom(PAGE + '?src=javascript:alert(1)');
    assert.ok(!rendered(dom), 'a diagram rendered from a javascript: src');
    assert.match(statusLine(dom), /^Error: .*scheme/);
  });

  test('tool ?src= to a missing file reports the HTTP status', () => {
    const dom = dumpDom(PAGE + '?src=../examples/no-such-file.ddn');
    assert.ok(!rendered(dom), 'a diagram rendered for a missing file');
    assert.match(statusLine(dom), /^Error: .*HTTP 404/);
  });

  test('retired viewer URL redirects to the tool preserving ?src=', () => {
    // Legacy-depth src (old page sat one level deeper): the stub re-relativizes.
    const dom = dumpDom('http://127.0.0.1:' + PORT + '/website/tools/viewer/index.html?src=../../examples/basics/61-self-contained.ddn');
    assert.ok(rendered(dom), 'redirect did not land on a rendered diagram:\n' + statusLine(dom));
    assert.ok(!statusLine(dom).startsWith('Error:'), 'unexpected error after redirect: ' + statusLine(dom));
    assert.ok(dom.includes('61-self-contained.ddn'), '?src= was not preserved across the redirect');
  });

  test('retired studio editor URL redirects to the tool preserving entry/view', () => {
    const dom = dumpDom('http://127.0.0.1:' + PORT + '/website/tools/studio/editor.html?entry=examples%2Flive%2Fadaptive-lab.ddn&view=automatic');
    assert.ok(rendered(dom), 'editor redirect did not land on a rendered diagram:\n' + statusLine(dom));
    assert.ok(!statusLine(dom).startsWith('Error:'), 'unexpected error after redirect: ' + statusLine(dom));
    assert.ok(dom.includes('adaptive-lab.ddn'), '?entry= was not preserved across the redirect');
  });
} finally {
  server.kill();
}

const n = results.length, ok = results.filter(r => r.pass).length;
console.log(`Tool ?src= HTTP ${ok}/${n}`);
