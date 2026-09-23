#!/usr/bin/env node
/* B1-021 D5: regenerate website/examples/use-cases/manifest.json hashes and
 * (gitignored) rendered/ outputs after corpus normalization. Preserves the
 * manifest's structure and titles; recomputes source/semantic/svg hashes,
 * diagnostics, and rewrites rendered SVG/resolved/scene via the runtime. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import DDN from '../notation/runtime/ddn-core.js';
import Render from '../notation/runtime/ddn-full.js';
import Export from '../notation/runtime/ddn-export.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uc = path.join(ROOT, 'website/examples/use-cases');
const man = JSON.parse(fs.readFileSync(path.join(uc, 'manifest.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'standard/registry/catalogue.json'), 'utf8'));
const defs = fs.readFileSync(path.join(ROOT, 'standard/registry/glyph-library.svg'), 'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

for (const r of man.results) {
  const files = {};
  for (const f of Object.keys(r.sourceHashes)) files[f] = fs.readFileSync(path.join(uc, f.replace(/^use-cases\//, '')), 'utf8');
  const { ir } = DDN.build(files, r.entry, r.view, registry);
  const out = Render.render(ir, registry, defs);
  for (const f of Object.keys(r.sourceHashes)) r.sourceHashes[f] = sha(files[f]);
  r.semanticHash = sha(JSON.stringify(DDN.semanticJSON(ir)));
  r.svgHash = sha(out.svg);
  r.diagnostics = ir.diagnostics;
  const base = p => path.join(uc, p.replace(/^use-cases\//, ''));
  fs.mkdirSync(path.dirname(base(r.svg)), { recursive: true });
  fs.writeFileSync(base(r.svg), out.svg, 'utf8');
  fs.writeFileSync(base(r.scene), JSON.stringify(out.scene, null, 2) + '\n', 'utf8');
  fs.writeFileSync(base(r.resolved), Export.serialize(ir), 'utf8');
  console.log('regen', r.slug);
}
man.engine = DDN.VERSION;
fs.writeFileSync(path.join(uc, 'manifest.json'), JSON.stringify(man, null, 2) + '\n', 'utf8');
console.log('manifest.json updated:', man.results.length, 'results');
