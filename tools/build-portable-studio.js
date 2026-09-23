#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. Refresh the inlined DDN runtime in
 * the portable Studio pages (notation/studio/portable-{editor,gallery}.html)
 * with the current minified production build (notation/dist/ddn.global.min.js).
 * Only the first inline script — the one carrying the `/*! DDN …` runtime
 * banner — is replaced; example data, guide index and page scripts are left
 * untouched. Idempotent and deterministic. Run after npm run build:sdk
 * (freshness-gated by notation/tests/dist-freshness.js). */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');

const RUNTIME_SRC = 'notation/dist/ddn.global.min.js';
const runtime = fs.readFileSync(path.join(root, RUNTIME_SRC), 'utf8')
  // The source map ships in dist; the URL comment is meaningless once inlined.
  .replace(/\n\/\/# sourceMappingURL=\S+\n$/, '\n')
  .trim();
if (runtime.includes('</script')) throw new Error('runtime contains </script; inlining would break the page');
const bannerEnd = runtime.indexOf('*/') + 2;
const inlined = runtime.slice(0, bannerEnd)
  + '\n/* Inlined from ' + RUNTIME_SRC + ' by tools/build-portable-studio.js — minified production build; the readable ddn.global.js ships alongside in notation/dist. */'
  + runtime.slice(bannerEnd);

let changed = 0;
for (const name of ['portable-editor.html', 'portable-gallery.html']) {
  const file = path.join(root, 'notation/studio', name);
  const html = fs.readFileSync(file, 'utf8');
  const replaced = html.replace(/<script>\/\*! DDN [^]*?<\/script>/, () => '<script>' + inlined + '\n</script>');
  if (replaced === html) {
    if (!html.includes(inlined)) { console.error(name + ': runtime script block not found'); process.exitCode = 1; }
    continue;
  }
  fs.writeFileSync(file, replaced);
  changed++;
  console.log(name + ': runtime refreshed (' + html.length + ' -> ' + replaced.length + ' bytes)');
}
if (!changed) console.log('portable studio pages already fresh');
