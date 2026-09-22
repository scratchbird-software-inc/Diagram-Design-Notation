/* SPDX-License-Identifier: GPL-2.0-or-later. ddn-core bundle entry (B1-019).
 * Version guard, DDNLive workspace API construction, browser-global
 * publication. Module namespaces self-publish into the explicit module
 * registry; this entry mirrors them to the documented globals. */
import pkg from '../../../package.json';
import { optionalNamespace, publishNamespace } from '../../../notation/runtime/ddn-module-registry.js';
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
import { makeLiveAPI } from '../../../notation/studio/src/api.js';
import { installIO } from '../../../notation/studio/src/io.js';
import { installAuthoring } from '../../../notation/studio/src/authoring.js';
import registryCatalogue from '../../../notation/runtime/assets/catalogue.js';
import glyphDefs from '../../../notation/runtime/assets/glyphs.js';
import profilesCatalogue from '../../../notation/runtime/assets/profiles-catalogue.js';

const host = globalThis;
let api = host.DDNLive;
if (api && api.VERSION !== pkg.version) throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');
if (!api) {
  host.DDNProfileCatalogue = profilesCatalogue;
  // Lazy backend: sibling namespaces resolve at call time, so a workspace
  // created from ddn-core alone sees renderers appear as bundles load.
  const backend = {
    get DDN() { return optionalNamespace('DDN'); },
    get Defaults() { return optionalNamespace('DDNDefaults'); },
    get Render() { return optionalNamespace('DDNRender'); },
    get Interaction() { return optionalNamespace('DDNInteraction'); },
    get Placement() { return optionalNamespace('DDNPlacement'); },
    get Text() { return optionalNamespace('DDNText'); },
    get Export() { return optionalNamespace('DDNExport'); },
    get Projections() { return optionalNamespace('DDNProjections'); },
    get Engine() { return optionalNamespace('DDNEngine'); },
    get ProjectionData() { return optionalNamespace('DDNProjectionData'); },
    get QualityData() { return optionalNamespace('DDNQualityData'); },
  };
  const assets = { registry: registryCatalogue, glyphs: glyphDefs };
  api = makeLiveAPI(backend, assets);
  installIO(api);
  installAuthoring(api, backend, assets);
  host.DDNLive = api;
  publishNamespace('DDNLive', api);
  Object.assign(host, { DDNDefaults, DDNQualityData, DDNProjectionData, DDNProfileQuality, DDNProfiles, DDNContracts, DDN, DDNPinPlacement, DDNExport, DDNEngine });
}
if (typeof module === 'object' && module.exports) module.exports = api;
export default api;
export const { VERSION, runtime, createWorkspace, registerWorkspace, mount, fromSnapshot, authoring, io, parse, profileCatalogue } = api;
export { DDN, DDNDefaults, DDNQualityData, DDNProjectionData, DDNProfileQuality, DDNProfiles, DDNContracts, DDNPinPlacement, DDNExport, DDNEngine };
