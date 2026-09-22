/* SPDX-License-Identifier: GPL-2.0-or-later. ddn.global bundle entry (B1-019).
 * All-in-one: every runtime module plus the Studio web component, one engine
 * registration set — same behavior as the historical concatenated bundle.
 * Only DDNLive is published as a global (namespaces stay off the window). */
import pkg from '../../../package.json';
import { publishNamespace } from '../../../notation/runtime/ddn-module-registry.js';
import DDNDefaults from '../../../notation/runtime/ddn-defaults.js';
import DDNQualityData from '../../../notation/runtime/ddn-quality-data.js';
import DDNProjectionData from '../../../notation/runtime/ddn-projection-data.js';
import DDNProfileQuality from '../../../notation/runtime/ddn-profile-quality.js';
import DDNProfiles from '../../../notation/runtime/ddn-profiles.js';
import DDNContracts from '../../../notation/runtime/ddn-contracts.js';
import DDN from '../../../notation/runtime/ddn-core.js';
import DDNPinPlacement from '../../../notation/runtime/ddn-patterns.js';
import DDNExport from '../../../notation/runtime/ddn-export.js';
import DDNEngine from '../../../notation/runtime/ddn-engine.js';
import DDNPalette from '../../../notation/runtime/ddn-palette.js';
import DDNText from '../../../notation/runtime/ddn-text.js';
import DDNSketch from '../../../notation/runtime/ddn-sketch.js';
import DDNShapes from '../../../notation/runtime/ddn-shapes.js';
import DDNLayout from '../../../notation/runtime/ddn-layout.js';
import DDNPlacement from '../../../notation/runtime/ddn-placement.js';
import DDNRender from '../../../notation/runtime/ddn-render.js';
import DDNInteraction from '../../../notation/runtime/ddn-interaction.js';
import DDNQualityRender from '../../../notation/runtime/ddn-quality-render.js';
import DDNProjections from '../../../notation/runtime/ddn-projections.js';
import { makeLiveAPI } from '../../../notation/studio/src/api.js';
import { installIO } from '../../../notation/studio/src/io.js';
import { installAuthoring } from '../../../notation/studio/src/authoring.js';
import { installComponents } from '../../../notation/studio/src/component.js';
import registryCatalogue from '../../../notation/runtime/assets/catalogue.js';
import glyphDefs from '../../../notation/runtime/assets/glyphs.js';

const host = globalThis;
let api = host.DDNLive;
if (api && api.VERSION !== pkg.version) throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');
if (!api) {
  const backend = { DDN, Defaults: DDNDefaults, Render: DDNRender, Interaction: DDNInteraction, Placement: DDNPlacement, Text: DDNText, Export: DDNExport, Projections: DDNProjections, Engine: DDNEngine, ProjectionData: DDNProjectionData, QualityData: DDNQualityData };
  const assets = { registry: registryCatalogue, glyphs: glyphDefs };
  api = makeLiveAPI(backend, assets);
  installIO(api);
  installAuthoring(api, backend, assets);
  host.DDNLive = api;
  publishNamespace('DDNLive', api);
  installComponents(api, host);
  DDNEngine.registerProjectionRenderer('graph', DDNInteraction.render);
  for (const k of ['chart', 'matrix', 'panels', 'timeline', 'table', 'sequence', 'timing', 'chen', 'fishbone', 'decision']) DDNEngine.registerProjectionRenderer(k, DDNProjections.render);
}
if (typeof module === 'object' && module.exports) module.exports = api;
export default api;
export const { VERSION, runtime, createWorkspace, registerWorkspace, mount, fromSnapshot, authoring, io, parse, profileCatalogue } = api;
export { DDN, DDNDefaults, DDNQualityData, DDNProjectionData, DDNProfileQuality, DDNProfiles, DDNContracts, DDNPinPlacement, DDNExport, DDNEngine, DDNPalette, DDNText, DDNSketch, DDNShapes, DDNLayout, DDNPlacement, DDNRender, DDNInteraction, DDNQualityRender, DDNProjections };
