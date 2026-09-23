#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. Build the single-file end-user viewer (B1-007).
 * Inlines notation/dist/ddn.global.min.js + notation/viewer/src/{viewer.css,viewer.js}
 * into notation/viewer/src/template.html and writes notation/viewer/ddn-viewer.html.
 * The minified production runtime is inlined (same globals/guards as ddn.global.js;
 * the readable build stays in dist for debugging).
 * Deterministic: fixed inputs, no timestamps. Run after npm run build:sdk. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const RUNTIME_SRC = 'notation/dist/ddn.global.min.js';
const runtime = read(RUNTIME_SRC)
  // The source map ships in dist; the URL comment is meaningless once inlined.
  .replace(/\n\/\/# sourceMappingURL=\S+\n$/, '\n');
const css = read('notation/viewer/src/viewer.css');
const js = read('notation/viewer/src/viewer.js');
const template = read('notation/viewer/src/template.html');
// ScratchWeaver brand (B1-020): inline logo + data-URI favicon keep the single file self-contained.
const brandSvg = read('assets/brand/scratchweaver.svg').replace(/<\?xml[^?]*\?>\s*/, '').replace(/<!--[\s\S]*?-->\s*/, '').trim();
const brandFavicon = 'data:image/svg+xml;base64,' + Buffer.from(brandSvg).toString('base64');

for (const [name, src] of [['runtime', runtime], ['viewer.js', js]]) {
  if (src.includes('</script')) throw new Error(name + ' contains </script; inlining would break the page');
}
const out = template
  .replace('{{VIEWER_CSS}}', () => css.trimEnd())
  .replace('{{BRAND_FAVICON}}', () => brandFavicon)
  .replace('{{BRAND_LOGO}}', () => brandSvg)
  .replace('{{DDN_RUNTIME}}', () => '/* Inlined from ' + RUNTIME_SRC + ' (minified production build; readable ddn.global.js ships alongside in notation/dist). */\n' + runtime.trimEnd())
  .replace('{{VIEWER_JS}}', () => js.trimEnd());
if (out.includes('{{')) throw new Error('template placeholder left unsubstituted');

const target = path.join(root, 'notation/viewer/ddn-viewer.html');
fs.writeFileSync(target, out);
console.log('notation/viewer/ddn-viewer.html:', out.length, 'bytes');
