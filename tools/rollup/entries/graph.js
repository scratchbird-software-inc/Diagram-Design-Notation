/* SPDX-License-Identifier: GPL-2.0-or-later. ddn-graph bundle entry (B1-019).
 * Load-order guard, graph renderer registration, browser globals. */
import pkg from '../../../package.json';
import { optionalNamespace } from '../../../notation/runtime/ddn-module-registry.js';
import './ddn-core.js'; // sibling bundle specifier, resolved relative to dist/ in the emitted .mjs; dropped from the IIFE outputs (guards below cover script tags)
import DDNPalette from '../../../notation/runtime/ddn-palette.js';
import DDNText from '../../../notation/runtime/ddn-text.js';
import DDNSketch from '../../../notation/runtime/ddn-sketch.js';
import DDNShapes from '../../../notation/runtime/ddn-shapes.js';
import DDNLayout from '../../../notation/runtime/ddn-layout.js';
import DDNPlacement from '../../../notation/runtime/ddn-placement.js';
import DDNRender from '../../../notation/runtime/ddn-render.js';
import DDNInteraction from '../../../notation/runtime/ddn-interaction.js';

const host = globalThis;
if (!host.DDNLive) throw new Error('ddn-graph requires ddn-core.js to be loaded first');
if (host.DDNLive.VERSION !== pkg.version) throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');
if (!host.DDNRender) {
  Object.assign(host, { DDNPalette, DDNText, DDNSketch, DDNShapes, DDNLayout, DDNPlacement, DDNRender, DDNInteraction });
  optionalNamespace('DDNEngine').registerProjectionRenderer('graph', DDNInteraction.render);
}
const api = host.DDNLive;
if (typeof module === 'object' && module.exports) module.exports = api;
export default api;
export const { VERSION, runtime, createWorkspace, registerWorkspace, mount, fromSnapshot, authoring, io, parse, profileCatalogue } = api;
export { DDNPalette, DDNText, DDNSketch, DDNShapes, DDNLayout, DDNPlacement, DDNRender, DDNInteraction };
