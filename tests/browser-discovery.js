/* SPDX-License-Identifier: GPL-2.0-or-later. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {findBrowser} = require('./browser.js');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ddn-browser-discovery-'));
const keys = ['DDN_BROWSER', 'DDN_CHROMIUM', 'PLAYWRIGHT_BROWSERS_PATH'];
const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
function install(revision, directory) {
  const bin = path.join(root, 'chromium_headless_shell-' + revision, directory, directory === 'chrome-linux' ? 'headless_shell' : 'chrome-headless-shell');
  fs.mkdirSync(path.dirname(bin), {recursive:true}); fs.writeFileSync(bin, ''); return bin;
}
try {
  keys.forEach(k => delete process.env[k]);
  process.env.PLAYWRIGHT_BROWSERS_PATH = root;
  assert.throws(findBrowser, /No chromium_headless_shell/);
  const old = install(999, 'chrome-linux');
  assert.equal(findBrowser(), old, 'pinned Playwright cache layout');
  const current = install(1148, 'chrome-headless-shell-linux64');
  assert.equal(findBrowser(), current, 'numeric revision order and newer cache layout');
  process.env.DDN_CHROMIUM = old;
  assert.equal(findBrowser(), old);
  process.env.DDN_BROWSER = current;
  assert.equal(findBrowser(), current, 'explicit browser takes precedence');
  process.env.DDN_BROWSER = path.join(root, 'missing');
  assert.throws(findBrowser, /missing executable/);
  delete process.env.DDN_BROWSER; delete process.env.DDN_CHROMIUM;
  fs.unlinkSync(current);
  assert.throws(findBrowser, /has no Linux headless shell/, 'incomplete newest install is diagnosed');
  console.log('Browser discovery regression checks passed');
} finally {
  keys.forEach(k => saved[k] === undefined ? delete process.env[k] : process.env[k] = saved[k]);
  fs.rmSync(root, {recursive:true, force:true});
}
