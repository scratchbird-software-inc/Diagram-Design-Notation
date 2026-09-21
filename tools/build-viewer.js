#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. Build the single-file end-user viewer (B1-007).
 * Inlines notation/dist/ddn.global.js + notation/viewer/src/{viewer.css,viewer.js}
 * into notation/viewer/src/template.html and writes notation/viewer/ddn-viewer.html.
 * Deterministic: fixed inputs, no timestamps. Run after npm run build:sdk. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const runtime = read('notation/dist/ddn.global.js');
const css = read('notation/viewer/src/viewer.css');
const js = read('notation/viewer/src/viewer.js');
const template = read('notation/viewer/src/template.html');

for (const [name, src] of [['runtime', runtime], ['viewer.js', js]]) {
  if (src.includes('</script')) throw new Error(name + ' contains </script; inlining would break the page');
}
const out = template
  .replace('{{VIEWER_CSS}}', () => css.trimEnd())
  .replace('{{DDN_RUNTIME}}', () => runtime.trimEnd())
  .replace('{{VIEWER_JS}}', () => js.trimEnd());
if (out.includes('{{')) throw new Error('template placeholder left unsubstituted');

const target = path.join(root, 'notation/viewer/ddn-viewer.html');
fs.writeFileSync(target, out);
console.log('notation/viewer/ddn-viewer.html:', out.length, 'bytes');
