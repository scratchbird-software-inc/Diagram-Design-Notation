/* SPDX-License-Identifier: GPL-2.0-or-later. One public distribution built from the active 0.3 sources. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const version=require('../package.json').version;
const rt=n=>'notation/runtime/'+n+'.js';
/* Data-driven bundle definitions (B1-004). The full bundle concatenates the same
 * map, so the all-in-one cannot drift from the parts. Load order: core → graph →
 * quality → projections (projections read DDNQualityRender lazily, so the two
 * siblings may load in either order; quality plans need both). */
const BUNDLES={
 core:{files:['ddn-defaults','ddn-quality-data','ddn-projection-data','ddn-profile-quality','ddn-profiles','ddn-contracts','ddn-core','ddn-patterns','ddn-export','ddn-engine'],studio:['api','io','authoring'],needs:[],marker:'DDNLive',
  blurb:'Parse/build/validate/export plus the workspace API (no rendering).'},
 graph:{files:['ddn-palette','ddn-text','ddn-sketch','ddn-shapes','ddn-layout','ddn-placement','ddn-render','ddn-interaction'],studio:[],needs:['core'],marker:'DDNRender',
  blurb:'Graph renderer (ERD/flow/native layout, routing, interaction). Registers the "graph" projection kind.',
  register:'host.DDNEngine.registerProjectionRenderer(\'graph\',host.DDNInteraction.render);'},
 quality:{files:['ddn-quality-render'],studio:[],needs:['core','graph'],marker:'DDNQualityRender',
  blurb:'Quality renderers (quality charts, decision tables, fishbone). Registers the "fishbone" and "decision" kinds; they compose through ddn-projections.js.',
  register:`for(const k of['fishbone','decision'])host.DDNEngine.registerProjectionRenderer(k,(kind=>(ir,reg,g,opts)=>{if(!host.DDNProjections)throw new host.DDN.DDNError('DDN-E010','Projection kind "'+kind+'" renders through ddn-projections.js; load it together with ddn-quality.js.');return host.DDNProjections.render(ir,reg,g,opts);})(k));`},
 projections:{files:['ddn-projections'],studio:[],needs:['core','graph'],marker:'DDNProjections',
  blurb:'Data-bound projections: chart/matrix/panels/timeline/table/sequence/timing/chen.',
  register:`for(const k of['chart','matrix','panels','timeline','table','sequence','timing','chen'])host.DDNEngine.registerProjectionRenderer(k,host.DDNProjections.render);`}};
const NEED_GUARD={core:"if(!host.DDNLive)throw new Error('ddn-NAME requires ddn-core.js to be loaded first');",graph:"if(!host.DDNRender)throw new Error('ddn-NAME requires ddn-graph.js to be loaded first');"};
const registry=JSON.parse(read('standard/registry/catalogue.json')),glyphs=read('standard/registry/glyph-library.svg').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const assets=`const assets=`+JSON.stringify({registry,glyphs}).replace(/</g,'\\u003c')+';\n';
const backendKeys=['DDN','Defaults','Render','Interaction','Placement','Text','Export','Projections','Engine','ProjectionData','QualityData'];
const backendGlobals={DDN:'DDN',Defaults:'DDNDefaults',Render:'DDNRender',Interaction:'DDNInteraction',Placement:'DDNPlacement',Text:'DDNText',Export:'DDNExport',Projections:'DDNProjections',Engine:'DDNEngine',ProjectionData:'DDNProjectionData',QualityData:'DDNQualityData'};
const partsOf=names=>names.map(n=>read(rt(n))).join('\n');
const shadow=list=>`(function(){const globalThis=host,module=undefined;\n`+list+`\n})();\n`;
/* Full all-in-one bundle (current behavior, current name): identical structure to
 * before, built from the same BUNDLES map. */
const fullParts=[...BUNDLES.core.files,...BUNDLES.graph.files,...BUNDLES.quality.files,...BUNDLES.projections.files].map(rt);
const header=`/*! DDN ${version} · GPL-2.0-or-later · unified public runtime (no old compatibility renderer) */\n(function(host){'use strict';\nif(host.DDNLive?.VERSION===${JSON.stringify(version)}){if(typeof module==='object'&&module.exports)module.exports=host.DDNLive;return;}\nif(host.DDNLive)throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');\nconst backend=(function(){const globalThis={};const module=undefined;globalThis.DDNProfileCatalogue=${JSON.stringify(JSON.parse(read('standard/registry/profiles/catalogue.json'))).replace(/</g,'\\u003c')};\n`;
const registrations=`\nglobalThis.DDNEngine.registerProjectionRenderer('graph',globalThis.DDNInteraction.render);for(const k of['chart','matrix','panels','timeline','table','sequence','timing','chen','fishbone','decision'])globalThis.DDNEngine.registerProjectionRenderer(k,globalThis.DDNProjections.render);`;
const body=header+fullParts.map(read).join('\n')+registrations+`\nreturn{`+backendKeys.map(k=>k+':globalThis.'+backendGlobals[k]).join(',')+`};})();\n`+assets+['api','io','authoring','component'].map(n=>read('notation/studio/src/'+n+'.js')).join('\n')+`\nconst api=makeLiveAPI(backend,assets);installIO(api);installAuthoring(api,backend,assets);host.DDNLive=api;installComponents(api,host);if(typeof module==='object'&&module.exports)module.exports=api;\n})(typeof globalThis!=='undefined'?globalThis:this);\n`;
/* Modular bundles. */
const profiles=JSON.stringify(JSON.parse(read('standard/registry/profiles/catalogue.json'))).replace(/</g,'\\u003c');
function modular(name,def){
 const guards=[...def.needs.map(n=>NEED_GUARD[n].replaceAll('NAME',name)),`if(host.DDNLive.VERSION!==${JSON.stringify(version)})throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');`,`if(host.${def.marker})return;`].join('\n');
 const banner=`/*! DDN ${version} · GPL-2.0-or-later · modular runtime bundle: ddn-${name} — ${def.blurb} */\n`;
 if(name==='core'){
  const backend=`const backend={`+backendKeys.map(k=>`get ${k}(){return host.${backendGlobals[k]}}`).join(',')+`};\n`;
  return banner+`(function(host){'use strict';\nif(host.DDNLive){if(host.DDNLive.VERSION===${JSON.stringify(version)}){if(typeof module==='object'&&module.exports)module.exports=host.DDNLive;return;}throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');}\nhost.DDNProfileCatalogue=${profiles};\n`+shadow(partsOf(def.files))+backend+assets+def.studio.map(n=>read('notation/studio/src/'+n+'.js')).join('\n')+`\nconst api=makeLiveAPI(backend,assets);installIO(api);installAuthoring(api,backend,assets);host.DDNLive=api;if(typeof module==='object'&&module.exports)module.exports=api;\n})(typeof globalThis!=='undefined'?globalThis:this);\n`;
 }
 return banner+`(function(host){'use strict';\n`+guards+'\n'+shadow(partsOf(def.files))+def.register+`\nif(typeof module==='object'&&module.exports)module.exports=host.DDNLive;\n})(typeof globalThis!=='undefined'?globalThis:this);\n`;
}
const out=path.join(root,'notation/dist');fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(root,'release/validation'),{recursive:true});
const written={};
for(const [name,def]of Object.entries(BUNDLES)){
 const b=modular(name,def);written[name]=b;
 fs.writeFileSync(path.join(out,'ddn-'+name+'.js'),b);
 fs.writeFileSync(path.join(out,'ddn-'+name+'.mjs'),def.needs.map(n=>`import './ddn-${n}.js';\n`).join('')+`import './ddn-${name}.js';\nconst ddn=globalThis.DDNLive;\nexport const {VERSION,runtime,createWorkspace,registerWorkspace,mount,fromSnapshot,authoring,io,parse,profileCatalogue}=ddn;\nexport default ddn;\n`);
 for(const ext of['d.ts','d.mts'])fs.copyFileSync(path.join(root,'notation/studio/src/public.d.ts'),path.join(out,'ddn-'+name+'.'+ext));
}
fs.writeFileSync(path.join(out,'ddn.global.js'),body);fs.copyFileSync(path.join(root,'notation/studio/src/public.d.ts'),path.join(out,'ddn.d.ts'));fs.copyFileSync(path.join(root,'notation/studio/src/public.d.ts'),path.join(out,'ddn.d.mts'));
fs.copyFileSync(path.join(root,'notation/studio/src/ddn.css'),path.join(out,'ddn.css'));
fs.writeFileSync(path.join(out,'ddn.mjs'),`import './ddn.global.js';\nconst ddn=globalThis.DDNLive;\nexport const {VERSION,runtime,createWorkspace,registerWorkspace,mount,fromSnapshot,authoring,io,parse,profileCatalogue}=ddn;\nexport default ddn;\n`);
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const bundles=Object.fromEntries(Object.entries(BUNDLES).map(([name,def])=>[name,{bytes:Buffer.byteLength(written[name]),sha256:sha(written[name]),files:def.files.map(n=>'notation/runtime/'+n+'.js').concat(def.studio.map(n=>'notation/studio/src/'+n+'.js'))}]));
bundles.global={bytes:Buffer.byteLength(body),sha256:sha(body),files:fullParts.concat(['api','io','authoring','component'].map(n=>'notation/studio/src/'+n+'.js'))};
fs.writeFileSync(path.join(root,'release/validation/sdk-build.json'),JSON.stringify({version,sourceFiles:fullParts,sha256:sha(body),bytes:Buffer.byteLength(body),gzipBytes:zlib.gzipSync(body).length,core:require('../notation/runtime/ddn-core.js').VERSION,oldCompatibilityRendererIncluded:false,fontFilesIncluded:false,bundles},null,2)+'\n');
/* dist/README.md is generated (D6) — never hand-edit. */
const rows=[...Object.entries(BUNDLES).map(([name,def])=>`| \`ddn-${name}.js\` | ${def.blurb} | ${def.needs.length?def.needs.map(n=>'ddn-'+n+'.js').join(' + '):'—'} | ${Buffer.byteLength(written[name])} |`),`| \`ddn.global.js\` | All-in-one: every bundle above plus the Studio web component. Unchanged name and behavior; this is what the test suites and standalone pages embed. | — | ${Buffer.byteLength(body)} |`];
const readme=`# DDN runtime bundles (dist/)

Generated by \`tools/build-sdk.js\` at build time — do not hand-edit. Version ${version}.

| Bundle | Contains | Requires loaded first | Bytes |
|---|---|---|---|
${rows.join('\n')}

Every \`ddn-X.js\` has a matching \`ddn-X.mjs\` ES-module wrapper and \`ddn-X.d.ts\` /
\`ddn-X.d.mts\` type copies. \`ddn.css\` carries the default mark styles (page CSS wins
over script-inlined presentation). Non-core \`.mjs\` wrappers import their prerequisite
bundles first, so a single \`import\` of \`./ddn-graph.mjs\` (etc.) is self-sufficient.

## npm subpaths

\`@ddn/notation\` resolves to \`ddn.global.js\`/\`ddn.mjs\`; the subpaths \`./core\`,
\`./graph\`, \`./projections\`, \`./quality\` resolve to the matching modular bundles
(\`require\` → \`.js\`, \`import\` → \`.mjs\`, types → \`.d.ts\`/\`.d.mts\`). In ESM the
wrappers load prerequisites automatically; in CommonJS \`require('@ddn/notation/core')\`
before any non-core subpath (same realm, same-version module stacking is a no-op).

## Load order

\`ddn-core.js\` first, then \`ddn-graph.js\`, then \`ddn-quality.js\` and
\`ddn-projections.js\` in either order. Each non-core bundle throws immediately if its
prerequisite is missing; loading the same bundle twice is a no-op; mixing versions
throws the single-version guard. Do not mix \`ddn.global.js\` with the modular bundles
on one page — load either the all-in-one or the modules.

The engine is a registry: \`DDNEngine.registerProjectionRenderer(name, fn)\`. The graph
renderer registers as \`graph\` inside ddn-graph.js; chart/matrix/panels/timeline/table/
sequence/timing/chen register inside ddn-projections.js; fishbone/decision register
inside ddn-quality.js. Rendering or planning an unregistered kind throws coded error
\`DDN-E010\` naming the kind and the bundle that provides it. The fishbone and decision
renderers compose the page through ddn-projections.js, so those two kinds need both
ddn-quality.js and ddn-projections.js at render time.

## Typical combinations

- Check/validate/export only, or headless tooling: \`ddn-core.js\`.
- Classic diagrams (ERD, flow, C4, state, BPMN…): \`ddn-core.js\` + \`ddn-graph.js\`.
- Charts/matrices/timelines: add \`ddn-projections.js\`.
- Quality charts, decision tables, fishbone: add \`ddn-quality.js\` (and
  \`ddn-projections.js\` for page composition).
- Everything, one script tag: \`ddn.global.js\`.

## Data refresh

Every core build (ddn-core.js, ddn.global.js) exposes \`ws.replaceData(name, records)\` on the
workspace object: it rewrites only the named data block's record lines with the canonical
authoring serializer and returns \`{revision, diagnostics}\` — coded errors \`DDN-E002\`
(unknown/ambiguous block) and \`DDN-E011\` (field-shape mismatch) leave the source untouched.
Hosts then call \`renderSync\`/\`mount\` again; a same-values refresh re-renders every view
byte-identical. See \`examples/embed/data-refresh.html\`.
`;
fs.writeFileSync(path.join(out,'README.md'),readme);
console.log('SDK',version,Buffer.byteLength(body),'bytes;','bundles:',Object.entries(written).map(([n,b])=>'ddn-'+n+'.js='+Buffer.byteLength(b)).join(' '));
