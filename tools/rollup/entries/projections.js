/* SPDX-License-Identifier: GPL-2.0-or-later. ddn-projections bundle entry
 * (B1-019). Guards, data-bound projection kind registration, browser globals. */
import pkg from '../../../package.json';
import { optionalNamespace } from '../../../notation/runtime/ddn-module-registry.js';
import './ddn-core.js'; // sibling bundle specifier, resolved relative to dist/ in the emitted .mjs; dropped from the IIFE outputs
import './ddn-graph.js'; // sibling bundle specifier, resolved relative to dist/ in the emitted .mjs; dropped from the IIFE outputs
import DDNProjections from '../../../notation/runtime/ddn-projections.js';

const host = globalThis;
if (!host.DDNLive) throw new Error('ddn-projections requires ddn-core.js to be loaded first');
if (!host.DDNRender) throw new Error('ddn-projections requires ddn-graph.js to be loaded first');
if (host.DDNLive.VERSION !== pkg.version) throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');
if (!host.DDNProjections) {
  host.DDNProjections = DDNProjections;
  const Engine = optionalNamespace('DDNEngine');
  for (const k of ['chart', 'matrix', 'panels', 'timeline', 'table', 'sequence', 'timing', 'chen']) Engine.registerProjectionRenderer(k, DDNProjections.render);
}
const api = host.DDNLive;
if (typeof module === 'object' && module.exports) module.exports = api;
export default api;
export const { VERSION, runtime, createWorkspace, registerWorkspace, mount, fromSnapshot, authoring, io, parse, profileCatalogue } = api;
export { DDNProjections };
