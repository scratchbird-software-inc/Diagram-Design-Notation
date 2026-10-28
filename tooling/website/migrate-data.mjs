/** One-time website example migration. No legacy parser or renderer is shipped. */
import { convertDefinitions, convertValue, convertView, convertPublications } from './migrate-graphs.mjs';

const clone = value => structuredClone(value);
const ref = (file, id) => ({ file, id });
const channels = new Set(['x', 'y', 'size', 'start', 'end', 'label', 'value', 'series', 'open', 'high', 'low', 'close', 'step']);
/** Old flattened extension paths now live in the typed metadata container. */
export function channelPath(value) {
    return typeof value === 'string' ? value === 'name' ? 'title' : /^x_/.test(value) ? 'metadata.' + value : value : value;
}
const at = (record, path) => String(path ?? '').split('.').reduce((value, part) => value?.[part], record);
const unique = values => [...new Set(values)];

export function convertData(input, context = {}) {
    const file = context.file ?? 'main.ddn', resolved = input.resolved;
    const raw = resolved.view.profiles.projection, profile = raw.profile;
    const definitions = convertDefinitions(input, context);
    const view = convertView(input, context);
    const document = { version: 'ddn-next-1', definitions, views: [view], data: [], assets: [], appearances: [], publications: convertPublications(input, context) };
    const options = convertValue(raw, context);
    delete options.profile; delete options.kind;
    for (const key of channels) if (Object.hasOwn(options, key)) options[key] = channelPath(options[key]);
    if (raw.target && typeof raw.target === 'string' && profile !== 'chart.gauge@1') options.target = channelPath(raw.target);
    if (Array.isArray(options.filter)) options.filter.forEach(filter => { filter.key = channelPath(filter.key); });
    if (Array.isArray(options.order)) options.order.forEach(order => { order.key = channelPath(order.key); });
    view.projection = { options };

    // Definitions remain faithful to the original source. Selection is projection
    // input, not an instruction to discard the rest of the shared model.
    view.selection = { include: [] };
    if (raw.kind === 'matrix') {
        const rowIds = new Set((options.rows ?? []).map(value => value.id));
        const columnIds = new Set((options.columns ?? []).map(value => value.id));
        const selected = definitions.filter(value => rowIds.has(value.id) || columnIds.has(value.id) || value.category === 'relation' && value.role === options.relation && rowIds.has(value.endpoints?.[0]?.definition?.id) && columnIds.has(value.endpoints?.[1]?.definition?.id));
        view.selection.include = selected.map(value => ref(file, value.id));
        if (profile === 'matrix.storymap@1') for (const relation of selected) {
            const task = relation.metadata?.x_story?.task;
            if (task && !view.selection.include.some(value => value.id === task.id)) view.selection.include.push(task);
        }
        if (raw.write_data) {
            options.write_data = true;
            context.audit?.({ entry: input.entry, view: input.view, property: 'write_data', action: 'Legacy block target becomes the explicit writable-data capability; original target retained in conversion receipt.', source: raw.write_data });
        }
        if (options.encoding) options.encoding = convertEncoding(options.encoding);
    }
    if (raw.kind === 'table') {
        options.columns = (raw.columns ?? []).map((column, index) => ({
            id: column.key ?? `column${index + 1}`, path: channelPath(column.key),
            ...(column.label === undefined ? {} : { label: column.label }),
            ...(column.type === undefined ? {} : { type: column.type }),
        }));
    }
    if (raw.kind === 'chart') {
        if (typeof options.depth === 'string') options.depth = channelPath(options.depth);
        if (options.aggregate === 'mean') options.aggregate = 'average';
        if (typeof options.error === 'string') options.error = { value: channelPath(options.error) };
        else if (options.error) for (const key of Object.keys(options.error)) options.error[key] = channelPath(options.error[key]);
        if (options.trend === 'loess') options.trend = { method: 'loess', show: true };
        if (options.mark === 'box') options.mark = 'boxplot';
        if (options.quartiles === 'linear_r7') options.quartiles = 'linear';
        if (options.whiskers === 'tukey_1_5') options.whiskers = 'iqr';
        if (raw.mark === 'point' && raw.x_type === undefined) {
            const rows = (raw.records ?? []).map(r => resolved.elements.find(e => e.id === r.$ref)).filter(Boolean);
            const values = unique(rows.map(row => at(row.properties, raw.x)));
            if (values.every(value => typeof value === 'string')) {
                options.x_type = 'category';
            }
        }
        if (Array.isArray(raw.layers)) {
            // The new contract declares layers in first-occurrence series order.
            const rows = (raw.records ?? []).map(r => resolved.elements.find(e => e.id === r.$ref)).filter(Boolean);
            const names = unique(rows.map(row => at(row.properties, raw.series)));
            const layers = raw.layers.every(layer => layer.series !== undefined)
                ? names.map(name => raw.layers.find(layer => layer.series === name)) : raw.layers;
            if (layers.some(layer => !layer)) throw new Error(`A layer does not cover an authored series in ${input.entry} ${input.view}`);
            options.layers = layers.map(layer => Object.fromEntries(Object.entries(layer).filter(([key]) => key !== 'series').map(([key, value]) => [key, channels.has(key) ? channelPath(value) : value])));
        }
    }
    if (raw.kind === 'timeline') options.label ??= 'title';
    if (raw.kind === 'panels') {
        options.panels = (raw.panels ?? []).map((panel, index) => {
            const id = `${view.id}::panel::${panel.id ?? index}`, layout = {};
            for (const key of ['id', 'row', 'column', 'rowspan', 'colspan']) if (panel[key] !== undefined) layout[key] = panel[key];
            if (panel.view) {
                const child = panel.view.$ref.split('::').at(-1);
                const { id: ignored, ...placement } = layout;
                return { target: ref(file, child), kind: 'view', layout: placement, ...(panel.title ? { title: panel.title } : {}) };
            }
            const value = { id, name: id, title: panel.title ?? panel.id ?? `Panel ${index + 1}`, role: 'note', category: 'element', metadata: { x_record: { ...layout, items: convertValue(panel.items ?? [], context) } } };
            definitions.push(value);
            return { target: ref(file, id), kind: 'text', ...(panel.title ? { title: panel.title } : {}) };
        });
    }
    if (raw.kind === 'geo') {
        const geography = raw.geography, assetId = 'geography::' + geography;
        const supplied = context.assets?.[geography];
        document.assets.push({ id: assetId, name: geography, path: geography, media_type: 'application/geo+json', ...(supplied === undefined ? {} : { bytes: typeof supplied === 'string' ? supplied : JSON.stringify(supplied) }) });
    }
    if (raw.kind === 'decision') convertDecision(raw, options, definitions, view, file);
    return document;
}

function convertEncoding(raw) {
    const encoding = { ...raw };
    if (Array.isArray(encoding.domain)) encoding.domain = { min: encoding.domain[0], max: encoding.domain[1] };
    if (Array.isArray(encoding.range)) encoding.range = { min: encoding.range[0], max: encoding.range[1] };
    if (encoding.palette !== undefined) { encoding.scale = encoding.palette; delete encoding.palette; }
    if (encoding.mode === 'bands') encoding.mode = 'threshold';
    if (encoding.mode === 'category') encoding.mode = 'categorical';
    if (encoding.values) { encoding.labels ??= encoding.values; delete encoding.values; }
    return encoding;
}

function convertDecision(raw, options, definitions, view, file) {
    const renames = new Map();
    options.inputs = (raw.inputs ?? []).map(input => {
        if (!input || typeof input !== 'object' || !input.key) throw new Error('Decision input must declare a key and domain');
        const id = `${view.id}::input::${input.key}`;
        const allowed = Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'key'));
        definitions.push({ id, name: id, title: input.key, role: 'domain', category: 'element', content: { allowed_values: allowed } });
        renames.set(input.key, id);
        return ref(file, id);
    });
    if (options.coverage === 'complete') options.coverage = 'error';
    else if (options.coverage === 'partial') options.coverage = 'report';
    const originals = new Map(definitions.map(definition => [definition.id, definition]));
    options.records = (options.records ?? []).map(reference => {
        const original = originals.get(reference.id);
        if (!original) throw new Error('Decision record does not resolve: ' + reference.id);
        const id = `${view.id}::rule::${original.id}`;
        const definition = clone(original), rule = definition.metadata?.x_rule ?? {};
        definition.id = id; definition.name = id;
        definition.metadata ??= {};
        definition.metadata.x_rule = {
            inputs: Object.fromEntries(Object.entries(rule.inputs ?? rule.when ?? {}).map(([key, value]) => [renames.get(key) ?? key, value && typeof value === 'object' && value.op === 'interval' ? Object.fromEntries(Object.entries(value).map(([key,value]) => [key === 'lower_closed' ? 'include_min' : key === 'upper_closed' ? 'include_max' : key, value])) : value])),
            outputs: rule.outputs ?? rule.then ?? {},
        };
        definitions.push(definition);
        return ref(file, id);
    });
}

/** Finish a merged entry. Composed inclusions refer directly to existing views. */
export function finalizeDataDocument(document) {
    delete document._composedSlots;
    return document;
}
