/* SPDX-License-Identifier: GPL-2.0-or-later. B1-048 (D6/D7) + B1-051 (D3):
 * permanent example-link crawl gate. Every "Open in" link on the examples
 * index plus any ?src= link on the gallery/use-cases pages is opened over real
 * HTTP in headless chromium, and the target surface must actually RENDER the
 * diagram: the dumped DOM carries data-ddn-rendered and the status line is
 * neither an error nor "no source loaded". Design-mode links additionally
 * must show the design bar (B1-051: the designer is the tool in ?mode=design).
 * The retired /tools/designer/ URL is checked once below: its redirect stub
 * must land on the tool, in design mode, rendering the linked source.
 * Links are resolved exactly as the browser resolves them (page URL + href),
 * so path-depth mistakes, wrong-directory src params and redirect-stub drift
 * all fail here. Tool URLs pin ?worker=off for the same --dump-dom race
 * reason documented in tests/viewer-src-http.js.
 */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'),
  os = require('node:os'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false }); console.error('FAIL', name, e.stack); process.exitCode = 1; } }

const shellDir = path.join(os.homedir(), '.cache', 'ms-playwright');
const shell = fs.readdirSync(shellDir).filter(d => d.startsWith('chromium_headless_shell-')).sort().pop();
const BIN = path.join(shellDir, shell, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
const PORT = 8141;
const BASE = 'http://127.0.0.1:' + PORT;

/* Pages scanned for "Open in" (?src=/entry=) links, repo-relative.
 * B1-053 (D7): the examples index is retired (redirect stub to the gallery —
 * checked in tests/website-links.js); the gallery pages carry every deep link
 * now, including the complete example corpus. */
const PAGES = [
  'website/gallery/index.html',
  'website/examples/gallery/index.html',
];

function linksOf(pageRel) {
  const html = fs.readFileSync(path.join(root, pageRel), 'utf8');
  const out = [];
  for (const m of html.matchAll(/href="([^"]*(?:\?|&amp;|&)(?:src|entry)=[^"]*)"/g)) {
    const href = m[1].replace(/&amp;/g, '&');
    const url = new URL(href, BASE + '/' + pageRel);
    out.push({ page: pageRel, href, url: url.origin + url.pathname + url.search });
  }
  return out;
}

function dumpDom(url) {
  return cp.execFileSync(BIN, ['--headless', '--disable-gpu', '--no-sandbox', '--window-size=1400,900',
    '--virtual-time-budget=15000', '--dump-dom', url], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 }).toString();
}

function toolStatus(dom) {
  const m = dom.match(/<span id="ddn-tool-status"[^>]*>([\s\S]*?)<\/span>/);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '(status not found)';
}

function checkLink({ page, href, url }) {
  const u = new URL(url);
  if (!u.searchParams.has('worker')) u.searchParams.set('worker', 'off');
  const dom = dumpDom(u.origin + u.pathname + u.search);
  const label = page + ' -> ' + href;
  assert.ok(dom.includes('data-ddn-rendered='), 'tool did not render for ' + label + ' — status: ' + toolStatus(dom));
  assert.ok(!toolStatus(dom).startsWith('Error:'), 'tool error for ' + label + ': ' + toolStatus(dom));
  assert.ok(!/^no source loaded/.test(toolStatus(dom)), 'tool loaded the file but rendered nothing for ' + label + ': ' + toolStatus(dom));
  if (u.searchParams.get('mode') === 'design')
    assert.ok(!/id="ddn-design-bar" hidden/.test(dom), 'design-mode link did not show the design bar for ' + label);
}

/* B1-051 (D3): the retired prototype URL must redirect — params preserved,
 * mode=design forced — and render the linked source in the unified tool. */
function checkDesignerRedirect() {
  // worker=off pins the synchronous path for the same --dump-dom race reason
  // as the tool crawl (and doubles as a param-preservation check: the stub
  // must forward it, per the B1-043 mapper rule).
  const u = new URL(BASE + '/website/tools/designer/index.html?src=../../examples/basics/01-customer.ddn&worker=off');
  const dom = dumpDom(u.origin + u.pathname + u.search);
  assert.ok(dom.includes('data-ddn-rendered='), 'designer redirect did not render — status: ' + toolStatus(dom));
  assert.ok(!toolStatus(dom).startsWith('Error:'), 'designer redirect tool error: ' + toolStatus(dom));
  assert.ok(!/id="ddn-design-bar" hidden/.test(dom), 'designer redirect did not land in design mode (design bar hidden)');
}

const server = cp.spawn(process.execPath, [path.join(root, 'tools/serve.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
let ready = false;
server.stdout.on('data', () => { ready = true; });

(async () => {
  try {
    const deadline = Date.now() + 5000;
    while (!ready && Date.now() < deadline) await new Promise(r => setTimeout(r, 100));
    assert.ok(fs.existsSync(BIN), 'missing ' + BIN);

    const links = [];
    for (const p of PAGES) links.push(...linksOf(p));
    const unique = [...new Map(links.map(l => [l.url, l])).values()];
    console.log('example-link crawl:', links.length, 'links on', PAGES.length, 'pages,', unique.length, 'unique targets');
    test('crawl found example links', () => { assert.ok(unique.length > 100, 'suspiciously few links — the crawl must not pass vacuously'); });

    /* Bounded concurrency: chromium dumps are ~1 s each; 8 workers keep the
     * full crawl under a couple of minutes. */
    const failures = [];
    let next = 0;
    const workers = Array.from({ length: 8 }, async () => {
      while (next < unique.length) {
        const link = unique[next++];
        try { checkLink(link); }
        catch (e) { failures.push(link.page + ' -> ' + link.href + '\n  ' + String(e.message).split('\n')[0]); }
      }
    });
    await Promise.all(workers);
    test('every "Open in" link renders in its surface over HTTP (' + unique.length + ' links)', () => {
      assert.deepEqual(failures, [], failures.length + ' broken link(s):\n' + failures.join('\n'));
    });
    console.log('PASS crawl: ' + (unique.length - failures.length) + '/' + unique.length + ' links render');
    if (failures.length) { console.error(failures.join('\n')); }
    test('retired /tools/designer/ URL redirects to ?mode=design and renders', checkDesignerRedirect);
  } finally {
    server.kill();
  }
  const n = results.length, ok = results.filter(r => r.pass).length;
  console.log(`Example-link crawl ${ok}/${n}`);
})().catch(e => { console.error(e); server.kill(); process.exitCode = 1; });
