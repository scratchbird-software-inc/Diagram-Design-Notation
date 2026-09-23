/* SPDX-License-Identifier: GPL-2.0-or-later. B1-019 (D2/D3): Rollup build for
 * the five public DDN runtime bundles. Each bundle ships three formats:
 * browser IIFE (.js, same globals/guards as the historical concatenation),
 * minified IIFE (.min.js + .min.js.map, @rollup/plugin-terser) and a real ES
 * module (.mjs) whose sibling-bundle imports resolve relative to dist/.
 * Consumed by tools/build-sdk.js; `npx rollup -c tools/rollup.config.mjs`
 * works too. Output directory overridable with DDN_SDK_OUT (freshness test). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import terser from '@rollup/plugin-terser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const OUT = process.env.DDN_SDK_OUT || path.join(root, 'notation/dist');

/* Inline the few JSON imports the entries make (package.json) without an
 * extra plugin dependency. `<` is escaped so bundles stay inline-HTML safe. */
const jsonInline = {
  name: 'ddn-json-inline',
  transform(code, id) {
    if (id.endsWith('.json')) return { code: 'export default ' + code.replace(/</g, '\\u003c') + ';', map: { mappings: '' } };
  },
};
/* Dist artifacts must behave exactly like the historical bundles: text
 * metrics come from the estimator/browser path, never from the Node-only
 * pinned cache. The sources gate that cache on import.meta.url; rewriting it
 * to `undefined` here keeps the dist byte-behavior unchanged in every format. */
const importMetaUndefined = {
  name: 'ddn-import-meta-undefined',
  resolveImportMeta(property) {
    if (property === 'url') return 'undefined';
  },
};

/* Bundle membership, from the historical BUNDLES map (load order preserved). */
const RUNTIME = path.join(root, 'notation/runtime');
const MEMBERS = {
  core: ['ddn-defaults', 'ddn-quality-data', 'ddn-projection-data', 'ddn-profile-quality', 'ddn-profiles', 'ddn-contracts', 'ddn-core', 'ddn-patterns', 'ddn-export', 'ddn-engine'],
  graph: ['ddn-palette', 'ddn-text', 'ddn-sketch', 'ddn-shapes', 'ddn-layout', 'ddn-placement', 'ddn-render', 'ddn-interaction'],
  quality: ['ddn-quality-render'],
  projections: ['ddn-projections'],
  geo: ['ddn-geo'],
};
const memberFile = new Map();
for (const [bundle, files] of Object.entries(MEMBERS))
  for (const f of files) memberFile.set(f + '.js', bundle);

const BUNDLES = {
  core: { blurb: 'Parse/build/validate/export plus the workspace API (no rendering).' },
  graph: { blurb: 'Graph renderer (ERD/flow/native layout, routing, interaction). Registers the "graph" projection kind.' },
  quality: { blurb: 'Quality renderers (quality charts, decision tables, fishbone). Registers the "fishbone" and "decision" kinds; they compose through ddn-projections.js.' },
  projections: { blurb: 'Data-bound projections: chart/matrix/panels/timeline/table/sequence/timing/chen.' },
  geo: { blurb: 'Optional geographic module: map projections, GeoJSON ingestion, choropleth/symbol/outline rendering. Registers the "geo" kind (optional: visible placeholder when absent).' },
  global: { blurb: 'unified public runtime (no old compatibility renderer)' },
};

const SIBLING_SPEC = /^\.\/ddn-(core|graph|quality|projections|geo)\.js$/;
/* Entry files address sibling bundles with their final dist-relative
 * specifiers (./ddn-core.js …). Those files do not exist next to the entries,
 * so mark them external in resolveId before the default resolver runs; the
 * emitted .mjs keeps the verbatim specifier and the IIFE outputs drop the
 * side-effect-only import (guards cover script-tag loading). */
const siblingExternal = {
  name: 'ddn-sibling-externals',
  resolveId(source, importer) {
    if (SIBLING_SPEC.test(source) && importer && importer.includes('/tools/rollup/entries/'))
      return { id: source, external: true };
    return null;
  },
};

function externalsFor(name) {
  return (id, parent, isResolved) => {
    if (SIBLING_SPEC.test(id)) return name !== 'global' && !!parent && parent.includes('/tools/rollup/entries/');
    const base = path.basename(id);
    const owner = memberFile.get(base);
    if (!owner) return false;
    if (name === 'global') return false; // the all-in-one owns every module
    return owner !== name && (isResolved || id.includes('/runtime/') || id.startsWith('.'));
  };
}
function pathsFor() {
  return id => {
    if (SIBLING_SPEC.test(id)) return id;
    const base = path.basename(id);
    if (/^ddn-(core|graph|quality|projections|geo)\.js$/.test(base)) return './' + base;
    const owner = memberFile.get(base);
    return owner ? './ddn-' + owner + '.js' : id;
  };
}

function configsFor(name) {
  const def = BUNDLES[name];
  const stem = name === 'global' ? 'ddn.global' : 'ddn-' + name;
  const esStem = name === 'global' ? 'ddn' : stem;
  const banner = name === 'global'
    ? `/*! DDN ${pkg.version} · GPL-2.0-or-later · ${def.blurb} */`
    : `/*! DDN ${pkg.version} · GPL-2.0-or-later · modular runtime bundle: ${stem} — ${def.blurb} */`;
  /* IIFE prologue: identical guard semantics to the historical concatenated
   * bundles — need-guards first (naming the missing bundle), then the
   * single-version guard, then the double-load no-op marker. Runs before any
   * module code, exactly like the old wrapper. */
  const V = JSON.stringify(pkg.version);
  const intros = {
    core: `var h=typeof globalThis!=='undefined'?globalThis:this;if(h.DDNLive){if(h.DDNLive.VERSION===${V}){if(typeof module==='object'&&module.exports)module.exports=h.DDNLive;return;}throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');}`,
    graph: `var h=typeof globalThis!=='undefined'?globalThis:this;if(!h.DDNLive)throw new Error('ddn-graph requires ddn-core.js to be loaded first');if(h.DDNLive.VERSION!==${V})throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');if(h.DDNRender)return;`,
    quality: `var h=typeof globalThis!=='undefined'?globalThis:this;if(!h.DDNLive)throw new Error('ddn-quality requires ddn-core.js to be loaded first');if(!h.DDNRender)throw new Error('ddn-quality requires ddn-graph.js to be loaded first');if(h.DDNLive.VERSION!==${V})throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');if(h.DDNQualityRender)return;`,
    projections: `var h=typeof globalThis!=='undefined'?globalThis:this;if(!h.DDNLive)throw new Error('ddn-projections requires ddn-core.js to be loaded first');if(!h.DDNRender)throw new Error('ddn-projections requires ddn-graph.js to be loaded first');if(h.DDNLive.VERSION!==${V})throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');if(h.DDNProjections)return;`,
    geo: `var h=typeof globalThis!=='undefined'?globalThis:this;if(!h.DDNLive)throw new Error('ddn-geo requires ddn-core.js to be loaded first');if(!h.DDNRender)throw new Error('ddn-geo requires ddn-graph.js to be loaded first');if(h.DDNLive.VERSION!==${V})throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');if(h.DDNGeo)return;`,
    global: `var h=typeof globalThis!=='undefined'?globalThis:this;if(h.DDNLive&&h.DDNLive.VERSION===${V}){if(typeof module==='object'&&module.exports)module.exports=h.DDNLive;return;}if(h.DDNLive)throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');`,
  };
  const intro = intros[name];
  const external = externalsFor(name);
  const paths = pathsFor();
  const inputOpts = { plugins: [jsonInline, importMetaUndefined, siblingExternal], external };
  return [
    {
      ...inputOpts,
      input: path.join(root, 'tools/rollup/entries', name + '.iife.js'),
      output: [
        { file: path.join(OUT, stem + '.js'), format: 'iife', banner, intro },
        { file: path.join(OUT, stem + '.min.js'), format: 'iife', banner, intro, sourcemap: true, plugins: [terser()], sourcemapPathTransform: (relative, mapPath) => path.relative(root, path.resolve(path.dirname(mapPath), relative)) },
      ],
    },
    {
      ...inputOpts,
      input: path.join(root, 'tools/rollup/entries', name + '.js'),
      output: [{ file: path.join(OUT, esStem + '.mjs'), format: 'es', banner, paths }],
    },
  ];
}

export default Object.keys(BUNDLES).flatMap(configsFor);
export { MEMBERS, BUNDLES, OUT };
