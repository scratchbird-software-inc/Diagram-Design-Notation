/* SPDX-License-Identifier: GPL-2.0-or-later
 * DDN element defaults (B1-002). Read-only accessor over the optional per-kind
 * `defaults` object in the registry catalogues. Defaults are documentation for
 * authoring flows: the renderer never applies them implicitly, so a source
 * without properties renders exactly as before. Authoring tools merge them
 * before explicit properties (explicit wins) and write them into source.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DDNDefaults=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='0.1.0';
let registry=null;
// Pin the registry forKind reads from. Returns the api for chaining.
function use(reg){registry=reg||null;return api;}
// Deep copy of the registered defaults for a kind keyword (or kind id);
// `{}` when the kind or its defaults are absent. Mutating the result never
// pollutes the registry. An explicit registry argument overrides use().
function forKind(id,reg){
 const kinds=(reg||registry||{}).kinds||[];
 const kind=kinds.find(k=>k.keyword===id||k.id===id);
 if(!kind||!kind.defaults)return{};
 return JSON.parse(JSON.stringify(kind.defaults));
}
const api={VERSION,use,forKind};
return api;
});
