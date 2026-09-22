/* SPDX-License-Identifier: GPL-2.0-or-later. ddn-quality bundle entry (B1-019).
 * Guards, fishbone/decision registration composing through ddn-projections.js
 * lazily (DDN-E010 when it is absent), browser globals. */
import pkg from '../../../package.json';
import { optionalNamespace } from '../../../notation/runtime/ddn-module-registry.js';
import './ddn-core.js'; // sibling bundle specifier, resolved relative to dist/ in the emitted .mjs; dropped from the IIFE outputs
import './ddn-graph.js'; // sibling bundle specifier, resolved relative to dist/ in the emitted .mjs; dropped from the IIFE outputs
import DDNQualityRender from '../../../notation/runtime/ddn-quality-render.js';

const host = globalThis;
if (!host.DDNLive) throw new Error('ddn-quality requires ddn-core.js to be loaded first');
if (!host.DDNRender) throw new Error('ddn-quality requires ddn-graph.js to be loaded first');
if (host.DDNLive.VERSION !== pkg.version) throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');
if (!host.DDNQualityRender) {
  host.DDNQualityRender = DDNQualityRender;
  const Engine = optionalNamespace('DDNEngine'), DDN = optionalNamespace('DDN');
  for (const k of ['fishbone', 'decision']) Engine.registerProjectionRenderer(k, (kind => (ir, reg, g, opts) => {
    const P = optionalNamespace('DDNProjections');
    if (!P) throw new DDN.DDNError('DDN-E010', 'Projection kind "' + kind + '" renders through ddn-projections.js; load it together with ddn-quality.js.');
    return P.render(ir, reg, g, opts);
  })(k));
}
const api = host.DDNLive;
if (typeof module === 'object' && module.exports) module.exports = api;
export default api;
export const { VERSION, runtime, createWorkspace, registerWorkspace, mount, fromSnapshot, authoring, io, parse, profileCatalogue } = api;
export { DDNQualityRender };
