/* SPDX-License-Identifier: GPL-2.0-or-later. B1-019: dist ESM smoke tests and
 * the tree-shaking payoff measurement (D2/D5). Each ESM scenario runs in a
 * fresh child node process (single-version registry per realm). */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..'), dist = path.join(root, 'dist'), results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { results.push({ name, pass: false }); console.error('FAIL', name, e.code || '', e.message); process.exitCode = 1; } }
const basics = f => fs.readFileSync(path.join(root, '../website/examples/basics', f), 'utf8');
const quality = f => fs.readFileSync(path.join(root, '../website/examples/quality', f), 'utf8');
const ERD = { '01-customer.ddn': basics('01-customer.ddn'), 'shared.ddn': basics('shared.ddn'), 'customer-data.ddn': basics('customer-data.ddn') };
const FISHBONE = Object.fromEntries(['model.ddn', 'details.ddn', 'formats.ddn', 'views.ddn'].map(f => [f, quality(f)]));
const esm = script => cp.execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', cwd: root });
const p = f => JSON.stringify(path.join(dist, f));

test('ESM: ddn.mjs default + named exports render in Node', () => {
  const out = esm(`import api,{VERSION,createWorkspace,parse,DDN} from ${p('ddn.mjs')};
   if(VERSION!=='0.7.0'||api.VERSION!==VERSION)throw new Error('version surface');
   if(typeof DDN.parse!=='function'||parse!==DDN.parse)throw new Error('namespace surface');
   const svg=createWorkspace(${JSON.stringify(ERD)}).renderSync({entry:'01-customer.ddn',view:'overview'}).svg;
   if(!svg.includes('<svg'))throw new Error('no svg');console.log(svg.length);`);
  assert.ok(Number(out.trim()) > 10000);
});

test('ESM: core alone checks; render throws DDN-E010 naming ddn-graph.js', () => {
  esm(`import api from ${p('ddn-core.mjs')};
   const ws=api.createWorkspace(${JSON.stringify(ERD)});
   const ir=ws.resolve('01-customer.ddn','overview');
   if(!ir.elements.length)throw new Error('resolve failed');
   try{ws.renderSync({entry:'01-customer.ddn',view:'overview'});throw new Error('rendered without graph');}
   catch(e){if(e.code!=='DDN-E010'||!e.message.includes('ddn-graph.js'))throw e;}
   if(api.runtime.interaction!==null)throw new Error('presence-tolerant construction');`);
});

test('ESM: ddn-graph.mjs self-sufficient (prerequisite imported automatically)', () => {
  const out = esm(`import api from ${p('ddn-graph.mjs')};
   const svg=api.createWorkspace(${JSON.stringify(ERD)}).renderSync({entry:'01-customer.ddn',view:'overview'}).svg;
   if(!svg.includes('<svg'))throw new Error('no svg');console.log(svg.length);`);
  assert.ok(Number(out.trim()) > 10000);
});

test('ESM: full modular stack renders fishbone byte-identical to ddn.mjs', () => {
  esm(`import q from ${p('ddn-quality.mjs')};
   import p from ${p('ddn-projections.mjs')};
   import full from ${p('ddn.mjs')};
   if(q!==p||p!==full)throw new Error('modular ESM bundles must share one DDNLive');
   const a=q.createWorkspace(${JSON.stringify(FISHBONE)}).renderSync({entry:'views.ddn',view:'fishbone'}).svg;
   if(!a.includes('<svg'))throw new Error('no fishbone svg');`);
});

test('ESM: quality kinds without projections throw DDN-E010 naming ddn-projections.js', () => {
  esm(`import api from ${p('ddn-quality.mjs')};
   const ws=api.createWorkspace(${JSON.stringify(FISHBONE)});
   try{ws.renderSync({entry:'views.ddn',view:'fishbone'});throw new Error('rendered without projections');}
   catch(e){if(e.code!=='DDN-E010'||!e.message.includes('ddn-projections.js'))throw e;}`);
});

(async () => {
  try {
    const { rollup } = require('rollup');
    async function measure(entryCode) {
      const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ddn-shake-'));
      const entry = path.join(dir, 'entry.mjs');
      fs.writeFileSync(entry, entryCode);
      const bundle = await rollup({ input: entry });
      const { output } = await bundle.generate({ format: 'es' });
      await bundle.close();
      fs.rmSync(dir, { recursive: true, force: true });
      return Buffer.byteLength(output[0].code);
    }
    const coreOnly = await measure(`import {DDN} from ${p('ddn-core.mjs')};globalThis.__x=DDN.parse;`);
    const coreApi = await measure(`import api from ${p('ddn-core.mjs')};globalThis.__x=api;`);
    const full = await measure(`import api from ${p('ddn.mjs')};globalThis.__x=api;`);
    console.log(`  tree-shake: check-level=${coreOnly} core-api=${coreApi} full=${full} (source bytes: core.mjs=${fs.statSync(path.join(dist, 'ddn-core.mjs')).size} ddn.mjs=${fs.statSync(path.join(dist, 'ddn.mjs')).size})`);
    assert.ok(coreOnly < full, 'check-level consumer bundle must be smaller than the all-in-one');
    assert.ok(coreOnly <= coreApi, 'namespace import should not exceed the whole core api');
    fs.mkdirSync(path.join(root, 'tests/validation'), { recursive: true });
    fs.writeFileSync(path.join(root, 'tests/validation/esm-dist.json'), JSON.stringify({ version: require('../package.json').version, treeShake: { checkLevel: coreOnly, coreApi, full } }, null, 2) + '\n');
    results.push({ name: 'Tree-shaking: bundling check-level API from ddn-core.mjs beats the all-in-one', pass: true });
    console.log('PASS Tree-shaking: bundling check-level API from ddn-core.mjs beats the all-in-one');
  } catch (e) {
    results.push({ name: 'Tree-shaking', pass: false });
    console.error('FAIL Tree-shaking', e);
    process.exitCode = 1;
  }
  const passed = results.filter(r => r.pass).length;
  console.log(`esm-dist ${passed}/${results.length}`);
  if (passed !== results.length) process.exitCode = 1;
})();
