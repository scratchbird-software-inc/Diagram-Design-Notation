#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. Derive the profile silhouette inventory. */
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import Shapes from '../notation/runtime/ddn-shapes.js';
const target=fileURLToPath(new URL('../standard/registry/profiles/catalogue.json',import.meta.url));
// The renderer uses literal equality/includes dispatch in render and polygon.
// Keep this extractor narrow: a new dispatch form must extend this build guard.
export function rendererShapes(){
 const out=new Set(),source=Shapes.render.toString()+'\n'+Shapes.polygon.toString();
 for(const m of source.matchAll(/\b(?:shape|t)\s*===\s*['"]([^'"]+)['"]/g))out.add(m[1]);
 for(const m of source.matchAll(/\[([^\]]+)\]\.includes\((?:shape|t)\)/g))for(const v of m[1].matchAll(/['"]([^'"]+)['"]/g))out.add(v[1]);
 return out;
}
// Legacy unprofiled flow.intermediate uses the rectangular polygon fallback.
// BPMN process/choreography/conversation profiles select bpmevent instead.
export const legacyFallbacks=Object.freeze({intermediate:'rect'});
// Keep one representative of each effective recipe, including profile overrides.
export function shapeRecipes(catalogue){
 const recipes=new Map(),supported=rendererShapes();
 for(const kind of catalogue.kinds){
  if(typeof kind.silhouette!=='string'||!kind.silhouette)throw new Error('Missing silhouette for '+kind.keyword);
  for(const profile of [undefined,...catalogue.profiles.map(p=>p.id)]){
   const shape=Shapes.shapeOf(kind,{projection:{profile}});
   if(!supported.has(shape)&&!Object.hasOwn(legacyFallbacks,shape))throw new Error('No explicit renderer recipe for '+shape+' ('+kind.keyword+')');
   if(!recipes.has(shape))recipes.set(shape,{kind,profile});
  }
 }
 return new Map([...recipes].sort(([a],[b])=>a<b?-1:a>b?1:0));
}
export function checkShapes(catalogue){
 const expected=[...shapeRecipes(catalogue).keys()];
 if(JSON.stringify(catalogue.shapes)!==JSON.stringify(expected))throw new Error('Profile shape inventory is stale; run node tools/build-shape-catalogue.mjs');
 return expected;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const catalogue=JSON.parse(fs.readFileSync(target,'utf8'));
 if(process.argv.includes('--check'))checkShapes(catalogue);
 else {catalogue.shapes=[...shapeRecipes(catalogue).keys()];fs.writeFileSync(target,JSON.stringify(catalogue,null,1)+'\n');}
 console.log(`Shape catalogue: ${catalogue.shapes.length} effective silhouettes${process.argv.includes('--check')?' verified':' generated'}`);
}
