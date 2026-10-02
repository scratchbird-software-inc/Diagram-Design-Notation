/* SPDX-License-Identifier: GPL-2.0-or-later. B1-082: icon-library SVG
 * sanitization (PJ207) — user-supplied SVG rendered into the page; reject
 * scripts, foreignObject, event handlers, external references and oversized
 * assets. Shared by the registry path (ddn-profiles.js) and the raw-catalogue
 * render path (CLI via ddn-render.js). */
import {publishNamespace} from './ddn-module-registry.js';
const FORBIDDEN=/<script|foreignObject|<iframe|<embed|<object|<image|\b(?:xlink:)?href\s*=|\bon[a-z]+\s*=|javascript:|url\s*\(|<\!doctype|<\!entity/i;
export function sanitizeIcon(lib,icon){
 const svg=icon?.svg;
 if(typeof svg!=='string'||!svg.trimStart().startsWith('<svg'))return{error:'Icon '+lib.id+'/'+icon?.id+' is not an SVG document'};
 if(svg.length>20480)return{error:'Icon '+lib.id+'/'+icon?.id+' exceeds the 20 KiB asset budget'};
 if(FORBIDDEN.test(svg))return{error:'Icon '+lib.id+'/'+icon?.id+' contains forbidden content (script, foreignObject, event handler or external reference)'};
 return null;
}
export function sanitizedLibraries(libraries){
 return (libraries||[]).map(lib=>{for(const icon of lib.icons||[]){const bad=sanitizeIcon(lib,icon);if(bad)throw Object.assign(new Error(bad),{code:'DDN-PJ207'});}return lib;});
}
/* B1-088: icon packs (ddn-icon-pack@1) — manifest validation and the
 * host-supplied pack registry. A host (viewer, tool, embedding application)
 * registers an external pack at runtime; it is validated and sanitized
 * exactly like a shipped pack before it can render. */
export function validateIconPack(pack){
 const bad=m=>Object.assign(new Error(m),{code:'DDN-PJ206'});
 if(!pack||typeof pack!=='object'||Array.isArray(pack))throw bad('Icon pack must be a JSON object');
 if(pack.format!=='ddn-icon-pack@1')throw bad('Icon pack format must be ddn-icon-pack@1; found '+JSON.stringify(pack.format));
 for(const f of ['id','name','version','license','attribution','source'])if(typeof pack[f]!=='string'||!pack[f])throw bad('Icon pack manifest needs a non-empty '+f);
 if(!/^[a-z0-9][a-z0-9-]*@[0-9]+$/.test(pack.id))throw bad('Icon pack id '+JSON.stringify(pack.id)+' must be lowercase-name@major');
 if(!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(pack.version))throw bad('Icon pack version must be semantic (x.y.z)');
 if(!pack.grid||!Number.isInteger(pack.grid.size)||!(pack.grid.strokeWidth>0))throw bad('Icon pack grid needs size and strokeWidth');
 if(!Array.isArray(pack.icons)||!pack.icons.length||pack.icons.length>400)throw bad('Icon pack needs 1..400 icons');
 const seen=new Set();
 for(const icon of pack.icons){
  if(!icon||typeof icon!=='object')throw bad('Icon entry in '+pack.id+' must be an object');
  for(const f of ['id','name','svg'])if(typeof icon[f]!=='string'||!icon[f])throw bad('Icon in '+pack.id+' needs a non-empty '+f);
  if(!/^[a-z0-9][a-z0-9-]*$/.test(icon.id))throw bad('Icon id '+JSON.stringify(icon.id)+' in '+pack.id+' must be lowercase-with-hyphens');
  if(seen.has(icon.id))throw bad('Duplicate icon id '+icon.id+' in pack '+pack.id);
  seen.add(icon.id);
 }
 return pack;
}
const hostPacks=[],hostIds=new Set();
export function registerIconPack(pack,builtins=[]){
 validateIconPack(pack);
 if(hostIds.has(pack.id)||builtins.some(l=>l.id===pack.id))throw Object.assign(new Error('Icon pack id '+pack.id+' is already registered'),{code:'DDN-PJ206'});
 sanitizedLibraries([pack]);
 const lib={id:pack.id,name:pack.name,icons:pack.icons};
 if(pack.note)lib.note=pack.note;
 lib.license=pack.license;lib.attribution=pack.attribution;lib.source=pack.source;
 hostPacks.push(lib);hostIds.add(pack.id);
 return lib;
}
export function unregisterIconPack(id){
 const i=hostPacks.findIndex(l=>l.id===id);
 if(i<0)return false;
 hostPacks.splice(i,1);hostIds.delete(id);return true;
}
export function hostIconPacks(){return hostPacks.slice();}
/* B1-101 slice 3: art packs (ddn-art-pack@1) — detailed presentation
 * illustrations, NOT 24x24 stroke icons. Same manifest discipline and the
 * same DDN-PJ206/207 gates as icon packs; differences: a larger per-item byte
 * budget, arbitrary viewBoxes, declared connection anchors, and a reference
 * rule tuned for real artwork: internal fragment references (url(#…),
 * href="#…" — gradients, reused paths) are fine, external references of any
 * kind remain forbidden. */
const ART_BUDGET=65536;
const ART_FORBIDDEN=/<script|foreignObject|<iframe|<embed|<object|<image|\bon[a-z]+\s*=|javascript:|<\!doctype|<\!entity/i;
const ART_EXTERNAL=/\b(?:xlink:)?href\s*=\s*"(?!#)[^"]*"|url\(\s*['"]?(?!#)/i;
export function sanitizeArt(pack,item){
 const svg=item?.svg;
 if(typeof svg!=='string'||!svg.trimStart().startsWith('<svg'))return{error:'Art item '+pack.id+'/'+item?.id+' is not an SVG document'};
 if(svg.length>ART_BUDGET)return{error:'Art item '+pack.id+'/'+item?.id+' exceeds the 64 KiB asset budget'};
 if(ART_FORBIDDEN.test(svg)||ART_EXTERNAL.test(svg))return{error:'Art item '+pack.id+'/'+item?.id+' contains forbidden content (script, foreignObject, event handler or external reference)'};
 return null;
}
export function validateArtPack(pack){
 const bad=m=>Object.assign(new Error(m),{code:'DDN-PJ206'});
 if(!pack||typeof pack!=='object'||Array.isArray(pack))throw bad('Art pack must be a JSON object');
 if(pack.format!=='ddn-art-pack@1')throw bad('Art pack format must be ddn-art-pack@1; found '+JSON.stringify(pack.format));
 for(const f of ['id','name','version','license','attribution','source'])if(typeof pack[f]!=='string'||!pack[f])throw bad('Art pack manifest needs a non-empty '+f);
 if(!/^[a-z0-9][a-z0-9-]*@[0-9]+$/.test(pack.id))throw bad('Art pack id '+JSON.stringify(pack.id)+' must be lowercase-name@major');
 if(!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(pack.version))throw bad('Art pack version must be semantic (x.y.z)');
 if(!Array.isArray(pack.items)||!pack.items.length||pack.items.length>400)throw bad('Art pack needs 1..400 items');
 const seen=new Set();
 for(const item of pack.items){
  if(!item||typeof item!=='object')throw bad('Art item in '+pack.id+' must be an object');
  for(const f of ['id','name','svg'])if(typeof item[f]!=='string'||!item[f])throw bad('Art item in '+pack.id+' needs a non-empty '+f);
  if(!/^[a-z0-9][a-z0-9-]*$/.test(item.id))throw bad('Art item id '+JSON.stringify(item.id)+' in '+pack.id+' must be lowercase-with-hyphens');
  if(seen.has(item.id))throw bad('Duplicate art item id '+item.id+' in pack '+pack.id);
  seen.add(item.id);
  const a=item.anchors;
  if(!a||typeof a!=='object'||Array.isArray(a))throw bad('Art item '+pack.id+'/'+item.id+' needs declared connection anchors');
  for(const side of ['north','east','south','west'])if(!point(a[side]))throw bad('Art item '+pack.id+'/'+item.id+' is missing the '+side+' anchor');
  for(const [name,pt] of Object.entries(a)){
   if(!/^[a-z0-9][a-z0-9-]*$/.test(name))throw bad('Anchor name '+JSON.stringify(name)+' in '+pack.id+'/'+item.id+' must be lowercase-with-hyphens');
   if(!point(pt))throw bad('Anchor '+name+' in '+pack.id+'/'+item.id+' must be [x,y] numbers');
  }
 }
 return pack;
 function point(v){return Array.isArray(v)&&v.length===2&&v.every(x=>Number.isFinite(x));}
}
const hostArt=[],hostArtIds=new Set();
export function registerArtPack(pack){
 validateArtPack(pack);
 if(hostArtIds.has(pack.id))throw Object.assign(new Error('Art pack id '+pack.id+' is already registered'),{code:'DDN-PJ206'});
 for(const item of pack.items){const bad=sanitizeArt(pack,item);if(bad)throw Object.assign(new Error(bad.error),{code:'DDN-PJ207'});}
 const lib={id:pack.id,name:pack.name,items:pack.items};
 if(pack.note)lib.note=pack.note;
 lib.license=pack.license;lib.attribution=pack.attribution;lib.source=pack.source;
 hostArt.push(lib);hostArtIds.add(pack.id);
 return lib;
}
export function unregisterArtPack(id){
 const i=hostArt.findIndex(l=>l.id===id);
 if(i<0)return false;
 hostArt.splice(i,1);hostArtIds.delete(id);return true;
}
export function hostArtPacks(){return hostArt.slice();}
const api={sanitizeIcon,sanitizedLibraries,validateIconPack,registerIconPack,unregisterIconPack,hostIconPacks,sanitizeArt,validateArtPack,registerArtPack,unregisterArtPack,hostArtPacks};
/* The host pack registries are cross-bundle shared state (module-scope lists
 * would split: ddn.global.js and ddn-graph.js each inline their own copy, so
 * a pack registered through one bundle would be invisible to renders running
 * through the other). First publish wins; every consumer must resolve the
 * namespace, not the module-local import. */
publishNamespace('DDNPacks',api);
export default api;
