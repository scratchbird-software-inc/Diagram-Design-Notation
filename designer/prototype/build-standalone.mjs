// SPDX-License-Identifier: GPL-2.0-or-later.
// Regenerates designer/prototype/index.html and standalone.html deterministically
// from style.css, body.html, workspace.json and the local scripts. Node, no
// dependencies. Running it twice produces byte-identical output.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

const STANDALONE_LINK = '<a href="../../README.md" style="color:inherit;text-decoration:none;border-bottom:1px dotted">Diagram-Design-Notation ↗</a>';
const LOCAL_SCRIPTS = ['kind-ui-map.js', 'relation-ui-map.js', 'commands.js', 'app.js'];
const LOGO_SRC = '../../assets/brand/scratchweaver.svg';
const LOGO_SRC_PLACEHOLDER = '{{SCRATCHWEAVER_LOGO}}';

function read(p) { return readFileSync(p, 'utf8'); }

// ScratchWeaver brand (B1-020): the standalone file inlines the logo as a data
// URI; index.html references the repo copy. Favicon is the data-URI logo.
const brandSvg = read(join(repoRoot, 'assets', 'brand', 'scratchweaver.svg'))
  .replace(/<\?xml[^?]*\?>\s*/, '').replace(/<!--[\s\S]*?-->\s*/, '').trim();
const brandDataUri = 'data:image/svg+xml;base64,' + Buffer.from(brandSvg).toString('base64');
const FAVICON = '<link rel="icon" type="image/svg+xml" href="' + brandDataUri + '">';

function escapedJson(files) {
  const json = JSON.stringify(files);
  if (json.includes('</script>')) throw new Error('workspace fixture must not contain a script-closing tag');
  return json.replace(/[^\x00-\x7F]/g, c => '\\u' + c.codePointAt(0).toString(16).padStart(4, '0'));
}

function inlineScript(name, content) {
  if (content.includes('</script>')) throw new Error(name + ' must not contain a script-closing tag');
  return '<!-- INLINE:BEGIN ' + name + ' -->\n<script>' + content + '\n</script>\n<!-- INLINE:END ' + name + ' -->\n';
}

export function buildPages() {
  const style = read(join(here, 'style.css'));
  const body = read(join(here, 'body.html')).replace(/\n$/, '');
  const files = JSON.parse(read(join(here, 'workspace.json')));
  const json = escapedJson(files);
  if (!body.includes(LOGO_SRC_PLACEHOLDER)) throw new Error('body.html lost its ' + LOGO_SRC_PLACEHOLDER + ' logo placeholder');
  const head = title => '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title>' + FAVICON + '<style>';
  const sourceScript = '<script type="application/json" id="sourceFiles">' + json + '</script>';

  const indexBody = body.split(LOGO_SRC_PLACEHOLDER).join(LOGO_SRC);
  const index = head('ScratchWeaver Designer — interactive review prototype · DDN') + style + '</style></head><body>' + indexBody + '\n'
    + sourceScript
    + '<script src="kind-ui-map.js"></script><script src="relation-ui-map.js"></script><script src="../../notation/dist/ddn.global.min.js"></script><script src="commands.js"></script><script src="app.js"></script></body></html>';

  const standaloneBody = body.split(LOGO_SRC_PLACEHOLDER).join(brandDataUri)
    .replace('<header class="projectbar">', '<header class="projectbar">' + STANDALONE_LINK);
  if (standaloneBody === body) throw new Error('body.html lost its <header class="projectbar">; standalone link not applied');
  // Minified production runtime (B1-019 follow-up): same globals and guards
  // as ddn.global.js, which stays in dist as the readable/debug build. The
  // sourceMappingURL comment is meaningless once inlined and is stripped.
  const runtime = read(join(repoRoot, 'notation', 'dist', 'ddn.global.min.js'))
    .replace(/\n\/\/# sourceMappingURL=\S+\n$/, '\n')
    .replace(/\n$/, '');
  let inlines = inlineScript('../../notation/dist/ddn.global.min.js', runtime);
  for (const name of LOCAL_SCRIPTS) inlines += inlineScript(name, read(join(here, name)).replace(/\n$/, ''));
  const standalone = head('ScratchWeaver Designer — standalone prototype · DDN') + style + '</style></head><body>' + standaloneBody + '\n'
    + sourceScript + '\n' + inlines + '</body></html>';

  return { 'index.html': index, 'standalone.html': standalone };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const outIdx = process.argv.indexOf('--out');
  const outDir = outIdx > -1 ? process.argv[outIdx + 1] : here;
  mkdirSync(outDir, { recursive: true });
  const pages = buildPages();
  for (const [name, content] of Object.entries(pages)) writeFileSync(join(outDir, name), content);
  console.log('build-standalone: wrote ' + Object.keys(pages).join(', ') + ' to ' + outDir);
}
