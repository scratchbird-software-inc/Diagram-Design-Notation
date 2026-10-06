// Audit: render every view of every example entry at the current defaults;
// list (file, view, code) for all failures. Covers basics, use-cases,
// projections, quality and gallery/src.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const DDN = require(path.join(root, 'notation/runtime/ddn-core.js')).default;
const Render = require(path.join(root, 'notation/runtime/ddn-render.js')).default;
const SDK = require(path.join(root, 'notation/dist/ddn.global.js'));
const reg = JSON.parse(fs.readFileSync(path.join(root, 'standard/registry/catalogue.json'), 'utf8'));
const defs = fs.readFileSync(path.join(root, 'standard/registry/glyph-library.svg'), 'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];

function filesFor(entry) {
  const files = {};
  const visit = name => {
    if (Object.hasOwn(files, name)) return;
    files[name] = fs.readFileSync(path.join(root, name), 'utf8');
    for (const imp of SDK.parse(files[name], name).imports) visit(SDK.resolvePath(name, imp.path));
  };
  visit(entry);
  return files;
}
const dirs = ['website/examples/basics', 'website/examples/use-cases', 'website/examples/projections', 'website/examples/quality', 'website/examples/gallery/src'];
const entries = [];
for (const d of dirs) {
  const abs = path.join(root, d);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs).sort()) {
    if (f.endsWith('.ddn') && !f.endsWith('.combined.ddn')) entries.push(d + '/' + f);
  }
}
let fails = 0, views = 0;
for (const entry of entries) {
  let ws;
  try { ws = filesFor(entry); } catch (e) { console.log('SKIP(read)', entry, e.message); continue; }
  const text = ws[entry];
  const viewIds = [...new Set([...text.matchAll(/^\s*view\s+([A-Za-z_][\w.-]*)\s/gm)].map(m => m[1]))];
  for (const v of viewIds) {
    views++;
    try {
      const ir = DDN.build(ws, entry, v, reg).ir;
      Render.render(ir, reg, defs, {});
    } catch (e) {
      fails++;
      console.log('FAIL', entry, v, e.code || '', JSON.stringify(e.message || '').slice(0, 110));
    }
  }
}
console.log('views:', views, 'failures:', fails);
