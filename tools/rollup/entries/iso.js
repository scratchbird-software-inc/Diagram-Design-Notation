/* SPDX-License-Identifier: GPL-2.0-or-later. ddn-iso bundle entry
 * (B1-034). Guards, optional isometric module publication, browser globals. */
import pkg from '../../../package.json';
import '../../../notation/runtime/ddn-module-registry.js';
import './ddn-core.js'; // sibling bundle specifier, resolved relative to dist/ in the emitted .mjs; dropped from the IIFE outputs
import './ddn-graph.js'; // sibling bundle specifier, resolved relative to dist/ in the emitted .mjs; dropped from the IIFE outputs
import DDNIso from '../../../notation/runtime/ddn-iso.js';

const host = globalThis;
if (!host.DDNLive) throw new Error('ddn-iso requires ddn-core.js to be loaded first');
if (!host.DDNRender) throw new Error('ddn-iso requires ddn-graph.js to be loaded first');
if (host.DDNLive.VERSION !== pkg.version) throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');
if (!host.DDNIso) {
  host.DDNIso = DDNIso;
}
const api = host.DDNLive;
if (typeof module === 'object' && module.exports) module.exports = api;
export default api;
export const { VERSION, runtime, createWorkspace, registerWorkspace, mount, fromSnapshot, authoring, io, parse, profileCatalogue } = api;
export { DDNIso };
