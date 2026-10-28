/** Mind-map membership is local to a view, not a global property of a definition. */
export interface MindmapRecord {
    readonly file: string;
    readonly ref: { readonly id: string };
    readonly record: Readonly<Record<string, unknown>>;
}
const topicRoles = new Set(['domain', 'entity', 'object', 'term']);
export function isMindmapTopic(record: Readonly<Record<string, unknown>>): boolean {
    return record.category !== 'relation' && topicRoles.has(typeof record.role === 'string' ? record.role : 'object');
}
export function mindmapKey(record: Pick<MindmapRecord, 'file' | 'ref'>): string {
    return record.file + '\0' + record.ref.id;
}
export type MindmapRelationKind = 'internal' | 'external' | 'unrelated' | 'unresolved';
/** topicKeys contains only the selected topic definitions in this view. */
export function mindmapRelationKind(from: MindmapRecord | undefined, to: MindmapRecord | undefined, topicKeys: ReadonlySet<string>): MindmapRelationKind {
    if (!from || !to) return 'unresolved';
    const source = topicKeys.has(mindmapKey(from)), target = topicKeys.has(mindmapKey(to));
    return source && target ? 'internal' : source || target ? 'external' : 'unrelated';
}
