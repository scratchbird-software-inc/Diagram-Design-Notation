/* SPDX-License-Identifier: GPL-2.0-or-later. B1-070: shared headless-Chromium
 * discovery for the *-http.js browser suites. Resolution order:
 *   1. DDN_BROWSER / DDN_CHROMIUM env var — an explicit executable path;
 *   2. the newest playwright chromium headless shell under the playwright
 *     cache (PLAYWRIGHT_BROWSERS_PATH honoured, default ~/.cache/ms-playwright).
 * Install with: npx playwright@<pinned> install chromium (see README).
 * Absent browser: throw a clear error naming the install command. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');

function findBrowser() {
  const explicit = process.env.DDN_BROWSER || process.env.DDN_CHROMIUM;
  if (explicit) {
    if (!fs.existsSync(explicit)) throw new Error('DDN_BROWSER points at a missing executable: ' + explicit);
    return explicit;
  }
  const shellDir = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(shellDir)) throw new Error(
    'No headless Chromium found: ' + shellDir + ' does not exist.\n' +
    'Install the browser with: npx playwright@1.49.1 install chromium\n' +
    'or set DDN_BROWSER=/path/to/chrome-headless-shell (or any Chromium/Chrome executable).');
  const shell = fs.readdirSync(shellDir).filter(d => d.startsWith('chromium_headless_shell-')).sort().pop();
  if (!shell) throw new Error(
    'No chromium_headless_shell-* under ' + shellDir + '.\n' +
    'Install the browser with: npx playwright@1.49.1 install chromium\n' +
    'or set DDN_BROWSER=/path/to/chrome-headless-shell.');
  const bin = path.join(shellDir, shell, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
  if (!fs.existsSync(bin)) throw new Error(
    'Playwright cache entry ' + shell + ' has no linux64 headless shell at ' + bin + '.\n' +
    'Reinstall with: npx playwright@1.49.1 install chromium, or set DDN_BROWSER=/path/to/a/chromium.');
  return bin;
}

module.exports = { findBrowser };
