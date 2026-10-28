import type { Bounds, ModelSnapshot, Json, Ref } from '@ddn/types';
import type { LocatedRecord, DataRecord } from './model.js';
import type { ProjectedRecord } from './project-core.js';
import type { GraphProjectionOptions, GraphProjectionResult } from './graph-common.js';
import type { DataProfileProjection, DataProjectionOptions } from './data-common.js';

export type PresentationFamilyId = 'graphs' | 'charts' | 'geography' | 'surfaces';
export type GraphProjector = (snapshot: ModelSnapshot, view: LocatedRecord, entries: readonly ProjectedRecord[], options?: GraphProjectionOptions) => GraphProjectionResult;
export type DataProjector = (snapshot: ModelSnapshot, view: LocatedRecord, bounds: Bounds, effective: DataRecord, options?: DataProjectionOptions & { geography?: ReadonlyMap<string, unknown> }) => DataProfileProjection | undefined;
export type ProfileAnalyzer = (normalized: Json, target: Ref, values?: Record<string, Json>) => Json;
export interface PresentationFamily {
    readonly id: PresentationFamilyId;
    readonly version: '1.0.0';
    readonly language: 'ddn-next-1';
    readonly profiles: readonly string[];
    readonly kind: 'graph' | 'data';
    readonly graph?: GraphProjector;
    readonly data?: DataProjector;
    readonly analyze?: ProfileAnalyzer;
}
const installed = new Map<PresentationFamilyId, PresentationFamily>();
const owners = new Map<string, PresentationFamily>();
const nativeProfiles = ['ddn@1', 'mindmap.basic@1', 'concept.map@1', 'table.records@1'];
/** A live read-only view of installed implementations, not catalogue promises. */
const available = new Set(nativeProfiles);
export const availableProjectionProfiles: ReadonlySet<string> = available;
/** Trusted local code registration. Assets are authenticated/version-selected by the host loader. */
export function installPresentationFamily(family: PresentationFamily): void {
    if (!['graphs','charts','geography','surfaces'].includes(family.id) || family.version !== '1.0.0' || family.language !== 'ddn-next-1' || !family.profiles.length || new Set(family.profiles).size !== family.profiles.length || (family.kind === 'graph' ? typeof family.graph !== 'function' || !!family.data : family.kind === 'data' ? typeof family.data !== 'function' || !!family.graph : true))
        throw new TypeError('Unsupported presentation family: ' + family.id);
    const previous = installed.get(family.id);
    if (previous) {
        if (previous.version === family.version && previous.language === family.language && previous.graph === family.graph && previous.data === family.data && previous.analyze === family.analyze && previous.profiles.join('\0') === family.profiles.join('\0')) return;
        throw new Error('Conflicting presentation family: ' + family.id);
    }
    for (const profile of family.profiles)
        if (available.has(profile)) throw new Error('Duplicate presentation profile: ' + profile);
    const copy = Object.freeze({ ...family, profiles: Object.freeze([...family.profiles]) });
    installed.set(family.id, copy);
    for (const profile of copy.profiles) { available.add(profile); owners.set(profile, copy); }
}
export function installedPresentationFamilies(): readonly PresentationFamily[] { return Object.freeze([...installed.values()]); }
export const isGraphProfile = (profile: string): boolean => owners.get(profile)?.kind === 'graph';
export const isDataProfile = (profile: string): boolean => owners.get(profile)?.kind === 'data';
export const graphProjector = (profile: string): GraphProjector | undefined => owners.get(profile)?.graph;
export const dataProjector = (profile: string): DataProjector | undefined => owners.get(profile)?.data;
export function analyzePresentedProfile(normalized: Json, target: Ref, values?: Record<string,Json>): Json {
    // Each optional family may share the bounded analyser. No analyser is loaded
    // merely to draw an ordinary native DDN card.
    const analyzer = [...installed.values()].find(family => family.analyze)?.analyze;
    return analyzer ? analyzer(normalized, target, values) : {kind:'none',outcome:'not-applicable'};
}
