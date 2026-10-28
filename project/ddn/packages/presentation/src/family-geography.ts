import { installPresentationFamily, type PresentationFamily } from './adapters.js';
import { geographyProfileIds } from './data-catalogue.js';
import { createDataProjector } from './data-adapter.js';
import { drawGeo } from './data-geo.js';
export const projectGeography = createDataProjector(geographyProfileIds,drawGeo);
export const geographyPresentation: PresentationFamily = Object.freeze({id:'geography',version:'1.0.0',language:'ddn-next-1',profiles:geographyProfileIds,kind:'data',data:projectGeography});
export function installGeographyPresentation(): void { installPresentationFamily(geographyPresentation); }
