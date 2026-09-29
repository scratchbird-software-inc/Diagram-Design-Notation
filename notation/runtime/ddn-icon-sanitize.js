/* SPDX-License-Identifier: GPL-2.0-or-later. B1-082: icon-library SVG
 * sanitization (PJ207) — user-supplied SVG rendered into the page; reject
 * scripts, foreignObject, event handlers, external references and oversized
 * assets. Shared by the registry path (ddn-profiles.js) and the raw-catalogue
 * render path (CLI via ddn-render.js). */
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
export default {sanitizeIcon,sanitizedLibraries,validateIconPack,registerIconPack,unregisterIconPack,hostIconPacks};
