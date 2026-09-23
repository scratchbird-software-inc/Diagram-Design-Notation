/* SPDX-License-Identifier: GPL-2.0-or-later. ddn-geo bundle entry
 * (B1-025). Guards, optional geographic projection kind registration, browser globals. */
import pkg from '../../../package.json';
import { optionalNamespace } from '../../../notation/runtime/ddn-module-registry.js';
import './ddn-core.js'; // sibling bundle specifier, resolved relative to dist/ in the emitted .mjs; dropped from the IIFE outputs
import './ddn-graph.js'; // sibling bundle specifier, resolved relative to dist/ in the emitted .mjs; dropped from the IIFE outputs
import DDNGeo from '../../../notation/runtime/ddn-geo.js';

const host = globalThis;
if (!host.DDNLive) throw new Error('ddn-geo requires ddn-core.js to be loaded first');
if (!host.DDNRender) throw new Error('ddn-geo requires ddn-graph.js to be loaded first');
if (host.DDNLive.VERSION !== pkg.version) throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');
if (!host.DDNGeo) {
  host.DDNGeo = DDNGeo;
  const Engine = optionalNamespace('DDNEngine');
  Engine.registerProjectionRenderer('geo', DDNGeo.render, { optional: true });
}
const api = host.DDNLive;
if (typeof module === 'object' && module.exports) module.exports = api;
export default api;
export const { VERSION, runtime, createWorkspace, registerWorkspace, mount, fromSnapshot, authoring, io, parse, profileCatalogue } = api;
export { DDNGeo };
