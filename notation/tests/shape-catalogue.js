/* SPDX-License-Identifier: GPL-2.0-or-later. Inventory and renderer coverage guard. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {shapeRecipes,checkShapes,legacyFallbacks}=require('../../tools/build-shape-catalogue.mjs');
const Shapes=require('../runtime/ddn-shapes.js').default,Palette=require('../runtime/ddn-palette.js').default;
const D=require('../runtime/ddn-core.js').default;
const catalogue=require('../../standard/registry/profiles/catalogue.json');
let passed=0;function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e);process.exitCode=1;}}
function paint(kind,profile){
 const p=structuredClone(D.DEFAULTS);p.projection.profile=profile||'ddn@1';
 const k={...kind,colour:'#123456',fill:'#ffffff'},n={id:'test',kind:k.keyword,name:'Shape',fields:[],ports:[],properties:{}};
 const g={x:0,y:0,w:270,h:140,scale:1,n,k,titleLines:['Shape'],fieldRows:[],ports:[],noteLines:[],noteTop:70,headerH:70};
 Shapes.measure(g,p);const svg=Shapes.render(g,p,Palette.themes.default);
 assert.match(svg,/<(?:rect|path|circle|ellipse|polygon|polyline)\b/,'missing visible contour for '+g.silhouette);
 assert.ok(!/NaN|Infinity|undefined/.test(svg),'invalid SVG for '+g.silhouette);
 return svg;
}
test('catalogue exactly matches deterministic effective recipe inventory',()=>{checkShapes(catalogue);assert.equal(new Set(catalogue.shapes).size,catalogue.shapes.length);});
test('original audit omissions and BPMN profile override are covered',()=>{for(const s of ['initial','final','offpage','bracket','cylinder','bpmevent'])assert.ok(catalogue.shapes.includes(s),s);});
test('drift guard rejects missing, duplicate and invented entries',()=>{for(const shapes of [catalogue.shapes.slice(1),[...catalogue.shapes,catalogue.shapes[0]],[...catalogue.shapes,'invented']])assert.throws(()=>checkShapes({...catalogue,shapes}),/stale/);});
test('registration changes are derived without editing the generator',()=>{const c={...catalogue,kinds:[{keyword:'new.kind',silhouette:'rect'}]};assert.deepEqual([...shapeRecipes(c).keys()],['rect']);});
test('unknown registrations cannot silently use the polygon fallback',()=>assert.throws(()=>shapeRecipes({...catalogue,kinds:[{keyword:'new.kind',silhouette:'not-implemented'}]}),/No explicit renderer recipe/));
test('documented legacy fallback preserves the existing rectangle',()=>{for(const [shape,target] of Object.entries(legacyFallbacks)){const g={x:0,y:0,w:270,h:140,scale:1};assert.deepEqual(Shapes.polygon({...g,silhouette:shape}),Shapes.polygon({...g,silhouette:target}));}});
for(const [shape,{kind,profile}] of shapeRecipes(catalogue))test('renderer contour: '+shape,()=>paint(kind,profile));
test('packaged SDK exposes the same complete inventory in an isolated realm',()=>{
 const vm=require('node:vm'),context=vm.createContext({console,performance,TextEncoder,TextDecoder});vm.runInContext(fs.readFileSync(require.resolve('../dist/ddn.global.js'),'utf8'),context);
 assert.deepEqual(Array.from(context.DDNLive.profileCatalogue.shapes),catalogue.shapes);
});
console.log(`Shape catalogue: ${passed}/${shapeRecipes(catalogue).size+7} passed`);
