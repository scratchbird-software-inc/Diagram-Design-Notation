import type { ProjectedRecord } from './project-core.js';
import { array, object, pathValue, refKey, resolveRecord, str, type DataRecord, type LocatedRecord } from './model.js';
import { isMindmapTopic, mindmapKey, mindmapRelationKind } from '../../profiles/src/mindmap.js';

export interface RelationPresentation {
    readonly allowed: boolean;
    readonly visible: boolean;
    readonly mode: 'text' | 'numbers' | 'tokens';
    /** Membership, independent from a globally hidden legend. */
    readonly inLegend: boolean;
    readonly number: string;
}
export function relationLegendVisible(view: DataRecord): boolean {
    return pathValue(view, 'legend.placement') !== 'none' && pathValue(view, 'chrome.legend') !== 'off';
}
/** Shared by designer controls and every graph renderer. Absence is inherited,
 * rather than a stored value that overrides a profile's presentation rules. */
export function relationPresentation(entry: ProjectedRecord, view: DataRecord = entry.view.record): RelationPresentation {
    const allowed = entry.definition.record.category === 'relation' && entry.relationLabelAllowed !== false;
    const setting = (path: string) => pathValue(entry.effective, path) ?? pathValue(entry.appearance?.record, path);
    const profile = str(entry.view.record.profile), viewMode = str(pathValue(view, 'legend.mode'), 'text');
    const native = ['ddn@1', 'mindmap.basic@1', 'concept.map@1'].includes(profile);
    const inherited = relationLegendVisible(view) && (viewMode === 'numbers' || native && viewMode === 'tokens') ? viewMode : 'text';
    const requested = setting('label.mode'), mode = requested === 'numbers' || requested === 'text' ? requested : inherited;
    const visibility = setting('label.visible'), included = setting('legend.include');
    return {
        allowed,
        visible: allowed && (typeof visibility === 'boolean' ? visibility : !entry.wireWithoutLabel && profile !== 'fishbone.basic@1'),
        mode: allowed ? mode as RelationPresentation['mode'] : 'text',
        inLegend: allowed && (typeof included === 'boolean' ? included : native && !entry.wireWithoutLabel && ['numbers', 'tokens'].includes(viewMode)),
        number: entry.relationNumber ?? '1',
    };
}
export function relationCaption(entry: ProjectedRecord, semantic: string, view?: DataRecord): string {
    const state = relationPresentation(entry, view);
    if (!state.visible) return '';
    if (state.mode === 'numbers') return state.number;
    if (state.mode === 'tokens') return str(entry.definition.record.role);
    return str(pathValue(entry.effective, 'route.callout'), str(pathValue(entry.appearance?.record, 'route.callout'))) || semantic;
}
/** Assign stable keys before label/legend filtering or specialized projections
 * create repeated occurrences. Different physical files never share identity. */
export function prepareRelationPresentation(entries: readonly ProjectedRecord[], all: readonly LocatedRecord[], view: DataRecord): ProjectedRecord[] {
    const topics = new Set(entries.filter(entry => entry.mindmapTopic !== false && isMindmapTopic(entry.definition.record)).map(entry => mindmapKey(entry.definition)));
    const candidates = entries.filter(entry => entry.definition.record.category === 'relation');
    const allowed = (entry: ProjectedRecord) => {
        if (str(entry.view.record.profile) !== 'mindmap.basic@1') return true;
        const ends = array(entry.definition.record.endpoints);
        return mindmapRelationKind(resolveRecord(all, object(ends[0]).definition, entry.definition.file), resolveRecord(all, object(ends[1]).definition, entry.definition.file), topics) === 'external';
    };
    const identities = new Map<string, ProjectedRecord>();
    for (const entry of candidates) if (allowed(entry)) identities.set(refKey(entry.definition.ref), entry);
    const counts = new Map<string, number>();
    for (const entry of identities.values()) { const id = entry.definition.ref.id; counts.set(id, (counts.get(id) ?? 0) + 1); }
    const keys = object(pathValue(view, 'legend.keys')), numbers = new Map<string, string>();
    let index = 0;
    for (const [identity, entry] of identities) {
        const { file, id } = entry.definition.ref;
        const key = keys[identity] ?? keys[file + '::' + id] ?? (counts.get(id) === 1 ? keys[id] ?? keys[id.split('::').at(-1)!] : undefined);
        index++;
        numbers.set(identity, key === undefined ? String(index) : String(key));
    }
    return entries.map(entry => entry.definition.record.category !== 'relation' ? entry : { ...entry, relationLabelAllowed: allowed(entry), ...(numbers.has(refKey(entry.definition.ref)) ? {relationNumber: numbers.get(refKey(entry.definition.ref))!} : {}) });
}
