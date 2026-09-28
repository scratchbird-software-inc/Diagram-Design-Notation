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
export default {sanitizeIcon,sanitizedLibraries};
