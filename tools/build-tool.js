#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. Build the single-file unified DDN
 * tool (B1-027), mirroring tools/build-viewer.js. Inlines
 * notation/dist/ddn.global.min.js + the example corpus data
 * (notation/studio/assets/workspaces.js, same payload the studio pages carry)
 * + notation/tool/src/{tool.css,tool.js} into notation/tool/src/template.html
 * and writes notation/tool/ddn-tool.html.
 * Deterministic: fixed inputs, no timestamps. Run after npm run build:sdk. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const RUNTIME_SRC = 'notation/dist/ddn.global.min.js';
const runtime = read(RUNTIME_SRC)
  // The source map ships in dist; the URL comment is meaningless once inlined.
  .replace(/\n\/\/# sourceMappingURL=\S+\n$/, '\n');
const data = read('notation/studio/assets/workspaces.js');
const css = read('notation/tool/src/tool.css');
const js = read('notation/tool/src/tool.js');
const template = read('notation/tool/src/template.html');
/* B1-043 (D6): the render worker is a Blob-URL worker built from a source
 * string the page already carries — the minified runtime plus the worker
 * bootstrap — so the tool stays one self-contained file and never fetches a
 * worker script (which file:// pages and strict CSP contexts could not). */
const WORKER_BOOT_SRC = 'notation/tool/src/worker.js';
const workerSource = runtime.trimEnd() + '\n;\n' + read(WORKER_BOOT_SRC).trimEnd() + '\n';
// ScratchWeaver brand (B1-020): inline logo + data-URI favicon keep the single file self-contained.
const brandSvg = read('assets/brand/scratchweaver.svg').replace(/<\?xml[^?]*\?>\s*/, '').replace(/<!--[\s\S]*?-->\s*/, '').trim();
const brandFavicon = 'data:image/svg+xml;base64,' + Buffer.from(brandSvg).toString('base64');

for (const [name, src] of [['runtime', runtime], ['workspaces data', data], ['tool.js', js], ['worker source', workerSource]]) {
  if (src.includes('</script')) throw new Error(name + ' contains </script; inlining would break the page');
}
const out = template
  .replace('{{TOOL_CSS}}', () => css.trimEnd())
  .replace('{{BRAND_FAVICON}}', () => brandFavicon)
  .replace('{{BRAND_LOGO}}', () => brandSvg)
  .replace('{{DDN_RUNTIME}}', () => '/* Inlined from ' + RUNTIME_SRC + ' (minified production build; readable ddn.global.js ships alongside in notation/dist). */\n' + runtime.trimEnd())
  .replace('{{DDN_WORKER_SOURCE}}', () => '/* B1-043: Blob-URL render worker source — ' + RUNTIME_SRC + ' + ' + WORKER_BOOT_SRC + ', as one string literal. */\nglobalThis.DDN_WORKER_SOURCE=' + JSON.stringify(workerSource) + ';')
  .replace('{{DDN_DATA}}', () => '/* Inlined from notation/studio/assets/workspaces.js — the example corpus the studio pages carry. */\n' + data.trimEnd())
  .replace('{{TOOL_JS}}', () => js.trimEnd());
if (out.includes('{{')) throw new Error('template placeholder left unsubstituted');

const target = path.join(root, 'notation/tool/ddn-tool.html');
fs.writeFileSync(target, out);
console.log('notation/tool/ddn-tool.html:', out.length, 'bytes');
