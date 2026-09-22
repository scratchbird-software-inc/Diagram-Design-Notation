/* SPDX-License-Identifier: GPL-2.0-or-later
 * Explicit cross-bundle module registry (B1-019, D6). One store per realm,
 * shared through globalThis so independently loaded runtime bundles (script
 * tags, CJS require, ESM import, vm contexts) find each other's namespaces.
 * Runtime modules never read host.* globals; bundle entries publish the
 * documented browser globals (DDNLive, DDNRender, …) from these namespaces.
 */
const host=typeof globalThis==='object'&&globalThis?globalThis:{};
const store=host.__DDN_MODULE_REGISTRY__||(host.__DDN_MODULE_REGISTRY__={namespaces:Object.create(null)});
/* Register a module namespace. First publish wins: re-evaluating a bundle
 * (double load) never swaps instances underneath its siblings. Returns the
 * namespace other modules should use. */
export function publishNamespace(name,ns){
 const current=store.namespaces[name];
 if(current)return current;
 store.namespaces[name]=ns;
 return ns;
}
/* Required sibling namespace, resolved at module evaluation time. */
export function namespace(name){
 const ns=store.namespaces[name];
 if(!ns)throw new Error('DDN runtime namespace '+name+' is not loaded; load its bundle first.');
 return ns;
}
/* Optional sibling namespace for lazy cross-bundle composition (e.g. quality
 * renderers used by projections only when ddn-quality.js is present). */
export function optionalNamespace(name){
 return store.namespaces[name]||null;
}
export default {publishNamespace,namespace,optionalNamespace};
