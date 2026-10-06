// Measurement: contain scale of representative example views on letter-landscape
// under candidate default gap/row_gap values. Not part of the test suite.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const DDN = require(path.join(root, 'notation/runtime/ddn-core.js')).default;
const Render = require(path.join(root, 'notation/runtime/ddn-render.js')).default;
const reg = JSON.parse(fs.readFileSync(path.join(root, 'standard/registry/catalogue.json'), 'utf8'));
const defs = fs.readFileSync(path.join(root, 'standard/registry/glyph-library.svg'), 'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];

const files = process.argv[2]
  ? [process.argv[2]]
  : fs.readdirSync(path.join(root, 'website/examples/basics')).filter(f => f.endsWith('.combined.ddn')).slice(0, 60);
const gaps = [100, 72, 64, 56, 48, 40, 32, 24, 20];

for (const f of files) {
  const text = fs.readFileSync(path.join(root, 'website/examples/basics', f), 'utf8');
  const ws = { [f]: text };
  // enumerate views: parse module, try view ids from source
  const viewIds = [...text.matchAll(/^\s*view\s+([A-Za-z_][\w.-]*)\s/gm)].map(m => m[1]);
  const uniq = [...new Set(viewIds)];
  for (const v of uniq) {
    let ir;
    try { ir = DDN.build(ws, f, v, reg).ir; } catch (e) { console.log(f, v, 'build-fail', e.code || e.message); continue; }
    const n = ir.view.selected?.length ?? 0;
    if (n < 2 || n > 40) { console.log(`${f} ${v}: ${n} elements — skipped (elements)`); continue; }
    const row = [`${f} ${v} (${n} el)`];
    for (const g of gaps) {
      const ir2 = JSON.parse(JSON.stringify(ir));
      ir2.view.profiles.layout = { ...ir2.view.profiles.layout, gap: { $quantity: g, unit: 'px' }, row_gap: { $quantity: g, unit: 'px' } };
      ir2.view.profiles.publication = { ...ir2.view.profiles.publication, size: 'letter', orientation: 'landscape', fit: 'contain', overflow: 'warn' };
      try {
        const out = Render.render(ir2, reg, defs, {});
        row.push(`${g}:${out.scene.scale.toFixed(2)}`);
      } catch (e) { row.push(`${g}:ERR(${e.code || 'x'})`); }
    }
    console.log(row.join('  '));
  }
}
