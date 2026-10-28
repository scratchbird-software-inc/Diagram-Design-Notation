import { installPresentationFamily, type PresentationFamily } from './adapters.js';
import { projectGraphProfile, graphProfileIds } from './graph-profiles.js';
import { analyzeProfile } from '../../profiles/src/analysis-profile.js';
export const graphsPresentation: PresentationFamily = Object.freeze({id:'graphs',version:'1.0.0',language:'ddn-next-1',profiles:graphProfileIds,kind:'graph',graph:projectGraphProfile,analyze:analyzeProfile});
export function installGraphsPresentation(): void { installPresentationFamily(graphsPresentation); }
