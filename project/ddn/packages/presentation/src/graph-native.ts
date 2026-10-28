import type { Bounds, Diagnostic, ModelSnapshot } from '@ddn/types';
import type { ProjectedRecord } from './project-core.js';
import { str, pathValue, records, type LocatedRecord } from './model.js';
import { layoutNative, decorateEdge, graphAdornments, inlineInteractions, resolvedText, provisionalNodes, type GraphProjectionResult, type GraphProjectionOptions } from './graph-common.js';
import type { Point } from './graph-glyphs.js';
import { mindmapEdges } from './mindmap.js';
import { prepareRelationPresentation } from './relation-presentation.js';
/** Native DDN uses the common geometry engine without importing foreign methods. */
export function projectNativeGraph(snapshot: ModelSnapshot, view: LocatedRecord, entries: readonly ProjectedRecord[], options: GraphProjectionOptions = {}, fallback?: (snapshot: ModelSnapshot, view: LocatedRecord, entries: readonly ProjectedRecord[], options: GraphProjectionOptions) => GraphProjectionResult, supportsFallback?: (profile: string) => boolean): GraphProjectionResult {
    const profile = str(view.record.profile), diagnostics: Diagnostic[] = [], unavailable: string[] = [], frame = options.bounds ?? { x: 0, y: 0, width: 960, height: 680 }, all = records(snapshot);
    entries = prepareRelationPresentation(entries, all, options.viewProperties ?? view.record);
    const pending = provisionalNodes(entries, all);
    if (pending.length) {
        const waiting = new Set(pending);
        const result = projectNativeGraph(snapshot, view, entries.filter(entry => !waiting.has(entry)), options, fallback, supportsFallback);
        return {...result, entries: [...result.entries, ...resolvedText(pending, profile)]};
    }
    const originalNodes = entries.filter(e => e.definition.record.category !== 'relation'), originalEdges = entries.filter(e => e.definition.record.category === 'relation');
    const nodes = layoutNative(originalNodes,originalEdges,all,view,frame,options.viewProperties);
    const reservedLabels: Bounds[] = [], labelObstacles: Bounds[] = [{ x: frame.x, y: frame.y, width: frame.width, height: 45 }, ...nodes.flatMap(node => node.definition.record.role==='uml.subject'?[]:[node.item.bounds])];
    const priorRoutes: Point[][] = [];
    const projectedEdges = profile === 'mindmap.basic@1' ? mindmapEdges(originalEdges, nodes, all, frame, options.viewProperties ?? view.record, diagnostics, unavailable) : originalEdges.map(edge => decorateEdge(edge, nodes, all, profile, frame, labelObstacles, reservedLabels,priorRoutes,str(pathValue(options.viewProperties??view.record,'layout.crossings'),'gap'),options.viewProperties));
    const output = [...projectedEdges, ...nodes];

    return { entries: inlineInteractions(snapshot, view, resolvedText(graphAdornments(output, view, all, profile), profile), all, options, diagnostics, unavailable, fallback, supportsFallback), diagnostics, unavailable };
}
