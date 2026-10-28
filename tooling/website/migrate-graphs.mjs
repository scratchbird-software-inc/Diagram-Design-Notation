/** Offline website migration from an inspected resolved-model snapshot.
 * This module is never imported by the DDN browser utilities. No legacy parser
 * or renderer is bundled with the recreated website. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { convertAppearancePresentation } from './migrate-presentation.mjs';
const schema = JSON.parse(readFileSync(new URL('../../standard/codex/ddn.schema.json', import.meta.url), 'utf8')).$defs;
const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export const stableId = value => String(value);
export const migratedRef = (id, context = {}) => ({ file: context.file ?? 'main.ddn', id: stableId(id) });
/** Old wrappers are decoded as values; these are not accepted by the new parser. */
export function convertValue(value, context = {}) {
    if (Array.isArray(value)) return value.map(v => convertValue(v, context));
    if (value && typeof value === 'object') {
        if (own(value, '$ref')) return migratedRef(context.resolveId?.(value.$ref) ?? value.$ref, context);
        if (own(value, '$quantity')) return value.$quantity;
        if (own(value, '$state')) return null;
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, convertValue(v, context)]));
    }
    return value;
}
function structure(value, shape, context, omitDefaults = true) {
    if (shape?.$ref) return structure(value, schema[shape.$ref.split('/').at(-1)], context, omitDefaults);
    if (!shape?.properties) return convertValue(value, context);
    const out = {};
    for (const [key, item] of Object.entries(object(value))) {
        if (!own(shape.properties, key)) continue;
        const child = shape.properties[key];
        const converted = structure(item, child, context, omitDefaults);
        if (omitDefaults && own(child, 'default') && JSON.stringify(converted) === JSON.stringify(child.default)) continue;
        if (converted && typeof converted === 'object' && !Array.isArray(converted) && !Object.keys(converted).length) continue;
        out[key] = converted;
    }
    return out;
}
function metadata(properties, context) {
    const result = Object.fromEntries(Object.entries(properties ?? {}).filter(([k]) => k.startsWith('x_')).map(([k,v]) => [k,convertValue(v, context)]));
    if(result.x_continuation?.page !== undefined){result.x_record={...result.x_record,continuation_page:result.x_continuation.page};delete result.x_continuation.page;}
    if(result.x_external){result.x_record={...result.x_record,reference:result.x_external.target+' ('+String(result.x_external.file??'').replace(/^website\//,'')+')'};delete result.x_external;}
    if (result.x_message?.sort === 'lost') result.x_message.gate ??= 'target';
    if (result.x_message?.sort === 'found') result.x_message.gate ??= 'source';
    if (result.x_reconciliation?.timeout && typeof result.x_reconciliation.timeout === 'string') {
        const match = /^PT([0-9.]+)(S|M|H)$/.exec(result.x_reconciliation.timeout);
        if (match) result.x_reconciliation.timeout = { value: Number(match[1]), unit: ({ S:'s',M:'min',H:'h' })[match[2]] };
    }
    if (result.x_rule) { const rule = result.x_rule; if (rule.when !== undefined) { rule.inputs = rule.when; delete rule.when; } if (rule.then !== undefined) { rule.outputs = rule.then; delete rule.then; } }
    return result;
}
function properties(record, context) { return Object.fromEntries(Object.entries(record.properties ?? {}).filter(([k,v]) => !k.startsWith('x_') && !['kind','description','maturity','uid'].includes(k) && !v?.$state).map(([k,v]) => [k,convertValue(v, context)])); }
function deref(shape) { while (shape?.$ref) shape = schema[shape.$ref.split('/').at(-1)]; return shape; }
function adapted(value, shape, context) {
    shape = deref(shape);
    if (shape?.enum) {
        if (typeof value === 'boolean' && shape.enum.includes('primary')) value = value ? 'primary' : undefined;
        if (!shape.enum.includes(value)) return undefined;
    }
    if (shape?.type === 'array') return Array.isArray(value) ? value.map(v => adapted(v,shape.items,context)).filter(v => v !== undefined) : [adapted(value,shape.items,context)].filter(v => v !== undefined);
    if (shape?.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
        if (!shape.properties) return convertValue(value,context);
        const result = {};
        for (const [key,item] of Object.entries(value)) {
            if (!own(shape.properties,key) && !shape.additionalProperties) continue;
            const child = adapted(item,shape.properties[key] ?? shape.additionalProperties,context);
            if (child !== undefined) result[key] = child;
        }
        return result;
    }
    if (shape?.anyOf && value === null) return undefined;
    return value;
}
function finishDefinition(definition, original, context) {
    const suffix = definition.category === 'relation' ? 'relation_' : 'kind_';
    const propertySchema = schema['data_properties_' + suffix + definition.role];
    if (propertySchema && definition.properties) {
        const before = definition.properties;
        definition.properties = adapted(before,propertySchema,context);
        const unrepresented = Object.fromEntries(Object.entries(before).filter(([k,v]) => JSON.stringify(v) !== JSON.stringify(definition.properties[k])));
        if (Object.keys(unrepresented).length) definition.notes = [{ title: 'Additional source details', text: JSON.stringify(unrepresented,null,2), format: 'plain' }];
        if (!Object.keys(definition.properties).length) delete definition.properties;
    }
    const metadataSchema = schema['metadata_partial_' + suffix + definition.role];
    if (metadataSchema && definition.metadata) {
        const before = definition.metadata;
        definition.metadata = adapted(before,metadataSchema,context);
        const unrepresented = Object.fromEntries(Object.entries(before).filter(([k,v]) => JSON.stringify(v) !== JSON.stringify(definition.metadata[k])));
        if (Object.keys(unrepresented).length) (definition.notes ??= []).push({ title: 'Additional source metadata', text: JSON.stringify(unrepresented,null,2), format: 'plain' });
        if (!Object.keys(definition.metadata).length) delete definition.metadata;
    }
    return definition;
}
function identity(record, role, category, context) {
    const out = { id: stableId(record.id), name: stableId(record.id), title: record.name ?? record.local ?? record.id, role, category };
    const description = record.properties?.description;
    if (typeof description === 'string' && description) out.description = description;
    const p = record.properties ?? {}, facets = {};
    const mappings = {
        maturity: { draft:'DRF', review:'REV', approved:'APR', deprecated:'DEP', retired:'RET', rejected:'REJ' },
        workload: { oltp:'OLTP', olap:'OLAP', mixed:'MIX', streaming:'STR', batch:'BATCH', interactive:'INT', ml:'ML' },
        role: { authoritative:'AUTH', derived:'DER', replica:'RPL', cache:'CACHE', archive:'ARC', external:'EXT', primary:'PRIMARY' },
        temporal: { current:'CUR', valid_time:'VT', recorded_time:'RT', bitemporal:'BT', event_history:'EVH', point_in_time_recovery:'PITR', immutable:'IMM' },
    };
    for (const [key,map] of Object.entries(mappings)) {
        const values = (Array.isArray(p[key]) ? p[key] : [p[key]]).map(v=>map[v]).filter(Boolean);
        if (values.length) facets[key === 'role' ? (values.includes('PRIMARY') ? 'distribution' : 'authority') : key] = values;
    }
    if (Object.keys(facets).length) out.facets = facets;
    const props = properties(record, context), meta = metadata(record.properties, context);
    if(typeof p.role==='string')meta.x_record={...meta.x_record,layout_group:p.role};
    if (Object.keys(props).length) out.properties = props;
    if (Object.keys(meta).length) out.metadata = meta;
    return out;
}
const displayValue = value => value == null || value?.$state ? null : value?.$ref ? value.$ref.split('::').at(-1).split('.').at(-1) : typeof value === 'object' ? JSON.stringify(value) : value;
/** Shared by all graph and data-profile conversion paths. */
export function convertDefinitions(input, context = {}) {
    const resolved = input.resolved ?? input, definitions = [];
    // The retired ref: spelling is resolved during conversion, not admitted as
    // another runtime grammar. Preserve the displayed numeral in the new text.
    const referenceText=value=>typeof value!=='string'?value:value.replace(/\bref:([\w:-]+(?:\.[\w:-]+)*)/g,(token,id)=>{
        const target=resolved.elements?.find(e=>e.id===id || e.local===id || e.id.endsWith('.'+id) || e.id.endsWith('::'+id));
        return target?String(target.properties?.numeral??target.name??id):token;
    });
    for (const element of resolved.elements ?? []) {
        const definition = identity(element, element.kind ?? 'object', 'element', context);
        definition.title=referenceText(definition.title);
        if(definition.description)definition.description=referenceText(definition.description);
        const members = [];
        for (const [ordinal, field] of (element.fields ?? []).entries()) {
            const child = identity(field, 'field', 'element', context), p = field.properties ?? {};
            child.content = { parent: migratedRef(field.parent ?? element.id, context), ordinal };
            for (const key of ['datatype', 'domain', 'key', 'comment', 'nullable']) if (p[key] !== undefined && !p[key]?.$state) child.content[key] = key === 'key' && p[key] === true ? 'primary' : convertValue(p[key], context);
            if (p.type !== undefined && child.content.datatype === undefined && typeof p.type === 'string') child.content.datatype = p.type;
            // The stable definition name is file-unique; the visible member name
            // remains the original field label through title.
            definitions.push(finishDefinition(child, field, context)); members.push(migratedRef(field.id, context));
        }
        for (const port of element.ports ?? []) {
            const child = identity(port, 'core::Port', 'element', context), p = port.properties ?? {};
            child.content = { owner: migratedRef(element.id, context) };
            const direction = ({ in:'input',out:'output',both:'inout' })[p.direction] ?? p.direction;
            if (['input','output','inout'].includes(direction)) child.content.direction = direction;
            if (['input','output','inout'].includes(p.direction)) child.content.direction = p.direction;
            if (p.domain && !p.domain.$state) child.content.domain = convertValue(p.domain, context);
            if (p.payload?.$ref) child.content.schema = convertValue(p.payload,context);
            child.properties = Object.fromEntries(Object.entries(child.properties ?? {}).filter(([key]) => ['side','fraction','datatype'].includes(key)));
            if (!Object.keys(child.properties).length) delete child.properties;
            definitions.push(child); members.push(migratedRef(port.id, context));
        }
        if (members.length) definition.members = members;
        if (element.fields?.length) {
            const columns = ['field','type','domain','constraint','key','comment'].map(id => ({ id, label: id }));
            const rows = element.fields.map(field => [field.name, displayValue(field.properties?.datatype ?? field.properties?.type), field.properties?.domain?.$state ? null : convertValue(field.properties?.domain ?? null,context), displayValue(field.properties?.constraint), displayValue(field.properties?.key), displayValue(field.properties?.comment)]);
            definition.data = { columns, rows };
        }
        if (['fbd.block','ladder.timer','ladder.counter'].includes(element.kind) && typeof element.properties?.datatype === 'string') definition.metadata = {...definition.metadata,x_record:{...definition.metadata?.x_record,block_type:element.properties.datatype}};
        if (element.kind === 'domain' && typeof element.properties?.meaning === 'string') definition.content = { meaning: element.properties.meaning };
        if (['note','note.sticky'].includes(element.kind)) {
            const text = element.properties?.text ?? element.properties?.note ?? element.properties?.x_sticky?.text;
            if (typeof text === 'string') { definition.draft = { text }; definition.content = { text }; }
            else if (typeof element.properties?.description === 'string') { definition.content = { text: element.properties.description }; definition.draft = { text: element.properties.description }; }
        }
        if (element.kind === 'sample' && Array.isArray(element.properties?.rows)) definition.data = {
            columns: (element.properties.columns ?? []).map((c,i) => ({ id: 'column-' + i, label: String(displayValue(c) ?? 'Column ' + (i + 1)) })), rows: element.properties.rows.map(row=>row.map(value=>value?.$state ? value.$state : convertValue(value,context))),
        };
        definitions.push(finishDefinition(definition, element, context));
    }
    for (const relation of resolved.relations ?? []) {
        const definition = identity(relation, relation.kind ?? 'assoc', 'relation', context);
        definition.endpoints = [relation.from, relation.to].map(endpoint => ({ definition: migratedRef(endpoint.element, context), ...(endpoint.member ? { member: migratedRef(endpoint.member, context) } : {}) }));
        // Semantically meaningful endpoint labels remain authored metadata. Native
        // marks retain their normal properties; UML endpoint marks are qualifiers.
        if (relation.kind?.startsWith('uml.')) {
            const qualifiers = {};
            for (const side of ['source','target']) {
                const mark = relation.properties?.[side + '_mark'];
                if (mark) qualifiers[side] = { mark: String(mark).replaceAll('_','-') };
            }
            if (Object.keys(qualifiers).length) definition.qualifiers = qualifiers;
        }
        definitions.push(finishDefinition(definition, relation, context));
    }
    for (const sub of resolved.view.subdiagrams ?? []) definitions.push({id:sub.id,name:sub.id,title:sub.name ?? sub.targetName,category:'element',role:'object',metadata:{x_subdiagram:{view:sub.targetLocal ?? sub.target.split('::').at(-1),display:sub.mode === 'inline' ? 'inline' : 'badge'}}});
    const known = new Map((resolved.elements ?? []).flatMap(element => [[element.local,element.id],[element.name,element.id],[element.id,element.id]]));
    for (const definition of definitions) {
        const part = definition.metadata?.x_part;
        if (part?.classifier && typeof part.classifier === 'string') {
            if (known.has(part.classifier)) part.classifier = known.get(part.classifier);
            else {
                const title = part.classifier, id = 'declared-classifier:' + title;
                if (!definitions.some(record => record.id === id)) definitions.push({id,name:id,title,category:'element',role:'uml.class'});
                part.classifier = id;
            }
        }
        const partition = definition.metadata?.x_partition;
        if (partition?.lane) { const frame = resolved.view.frames?.find(frame => frame.id.endsWith('.' + partition.lane) || frame.name === partition.lane); if (frame) partition.lane = frame.id; }
        const sub = definition.metadata?.x_subdiagram;
        if (sub?.view && typeof sub.view === 'string' && sub.view.includes('::')) sub.view = sub.view.split('::').at(-1);
        const contract = definition.metadata?.x_contract;
        if (contract?.choreography && typeof contract.choreography === 'string' && contract.choreography.includes('::')) contract.choreography = contract.choreography.split('::').at(-1);
    }
    return definitions;
}
/** Common view surface properties. Projection-specific options are added by the
 * data converter, whose schema chooses the available encoding fields. */
export function convertView(input, context = {}) {
    const resolved = input.resolved ?? input, original = resolved.view, profiles = original.profiles ?? {}, id = original.local ?? input.view?.id ?? input.view ?? original.id;
    const view = { id, name: id, title: original.name ?? id, profile: profiles.projection?.profile ?? 'ddn@1' };
    const authored=input.ast?.sections?.flatMap(s=>s.declarations??[]).find(d=>d.type==='view'&&d.id===id);
    const include = [...(original.selected ?? []), ...(original.relations ?? []), ...(original.subdiagrams ?? []).map(sub=>sub.id)];
    view.selection = { include: [...new Set(include)].map(id => migratedRef(id, context)) };
    for (const group of ['style','layout','display','legend','background','border','padding','text','grid','snap']) {
        if (!profiles[group]) continue;
        const value = convertValue(profiles[group], context);
        if (group === 'style' && value.look === 'handDrawn') value.look = 'handdrawn';
        if (group === 'layout' && value.root && typeof value.root === 'string') value.root = migratedRef(value.root, context);
        if (group === 'layout' && value.root === null) delete value.root;
        if (group === 'layout' && Array.isArray(value.hierarchy)) value.hierarchy = value.hierarchy.join(',');
        if (group === 'layout' && typeof value.hierarchy === 'boolean') value.hierarchy = value.hierarchy ? 'tree' : 'none';
        if (group === 'legend' && value.keys) value.keys = Object.fromEntries(Object.entries(value.keys).map(([k,v]) => [k,String(v)]));
        if (group === 'display' && value.depth === 0) { value.depth = 1; value.fields = 'none'; }
        const retained = structure(value, schema.view_definition.properties[group], context);
        if (retained && typeof retained === 'object' && Object.keys(retained).length) view[group] = retained;
    }
    if ((!profiles.style?.theme || profiles.style.theme==='default') && !view.background?.color) view.background={...view.background,color:'#f6f8fc'};
    if(profiles.layout?.algorithm)view.layout={...view.layout,algorithm:profiles.layout.algorithm};
    if(authored?.props?.theme==='mono_print'||authored?.props?.kind==='patent-figure'&&!authored.props.theme){view.style={...view.style,theme:'neutral'};view.background={...view.background,color:'#ffffff'};}
    if (profiles.chrome) {
        const chrome = { ...profiles.chrome };
        for (const key of ['title','footer','banner']) if (typeof chrome[key] === 'string') chrome[key] = chrome[key] !== 'off';
        if(chrome.title===false)chrome.banner=false;
        const retained = structure(chrome, schema.view_definition.properties.chrome, context);
        if (Object.keys(retained).length) view.chrome = retained;
    }
    if (original.frames?.length) view.regions = original.frames.map(frame => ({ id: frame.id, name: frame.name ?? frame.id,
        ...(frame.scope ? { scope: migratedRef(frame.scope, context) } : {}), members: (frame.members ?? []).map(id => migratedRef(id, context)),
        ...(frame.at && frame.size ? { bounds: { x: convertValue(frame.at[0]), y: convertValue(frame.at[1]), width: convertValue(frame.size[0]), height: convertValue(frame.size[1]) } } : {}) }));
    if (original.flows?.length) {
        const flow = original.flows[0], value = { ...flow.properties, label: flow.name, uid: flow.id };
        view.animation = structure(value, schema.view_definition.properties.animation, context);
    }
    return view;
}
export function convertAppearances(input, context = {}) {
    const resolved = input.resolved ?? input, original = resolved.view, viewId = original.local ?? original.id, appearances = [];
    const selected = new Set([...(original.selected ?? []), ...(original.relations ?? [])]);
    const authored=input.ast?.sections?.flatMap(s=>s.declarations??[]).find(d=>d.type==='view'&&d.id===viewId);
    const ids = new Set([...selected].filter(id => resolved.elements?.some(e=>e.id===id) || resolved.relations?.some(e=>e.id===id)));
    for (const id of ids) {
        const placement = original.placements?.[id] ?? {}, route = original.routes?.[id], source = [...(resolved.elements??[]),...(resolved.relations??[])].find(e => e.id === id);
        const appearance = { id: 'appearance:' + viewId + ':' + id, target: migratedRef(id, context), parent: migratedRef(viewId, context) };
        if (placement.at) { appearance.position = { x: convertValue(placement.at[0]), y: convertValue(placement.at[1]) }; appearance.pinned = true; }
        if (placement.size) appearance.size = { width: convertValue(placement.size[0]), height: convertValue(placement.size[1]) };
        if (source?.fields?.length) {
            appearance.body = original.profiles?.display?.fields === 'none' || original.profiles?.display?.depth === 0 ? 'title' : 'columns';
            appearance.column_visibility = { field: 'shown', type: original.profiles?.display?.datatypes === 'show' ? 'shown' : 'hidden', domain: original.profiles?.display?.domains === 'show' ? 'shown' : 'hidden', constraint: 'hidden', key: 'hidden', comment: 'hidden' };
            appearance.table = { header: false };
        }
        else if (source?.properties?.description || source?.properties?.meaning) appearance.body = 'notes';
        if (source && ['note','note.sticky'].includes(source.kind)) appearance.body = 'draft';
        if (source?.kind === 'sample') appearance.body = 'columns';
        if (source?.properties?.numeral !== undefined || source?.properties?.marks) appearance.marks = [...(source.properties.marks ?? []), ...(source.properties.numeral !== undefined ? [String(source.properties.numeral)] : [])];
        if(original.profiles?.display?.badges!=='none' && typeof source?.properties?.role==='string' && !['authoritative','derived','replica','cache','archive','external','primary'].includes(source.properties.role)) (appearance.marks??=[]).push(source.properties.role);
        if(source?.diffState && source.diffState!=='unchanged'){
            const color={added:'#168044',removed:'#bf3434',changed:'#a76812'}[source.diffState];
            if(color){appearance.border={color,width:2,style:source.diffState==='removed'?'dashed':'solid'};appearance.stroke={color,weight:2,dash:source.diffState==='removed'?'dashed':'solid'};if(resolved.elements?.includes(source))(appearance.marks??=[]).push(source.diffState.toUpperCase());}
        }
        if(authored?.props?.theme==='colorblind_safe'){
            const decision=/decision|gateway/.test(source?.kind??''),color=decision?'#997300':'#0072b2';
            appearance.background={color:decision?'#fff4d2':'#eaf4fb'};appearance.border={color,width:1.5};appearance.symbol={color};appearance.stroke={color};appearance.text={color:'#17263d'};
        }
        if (source?.kind === 'note.sticky') {
            const sticky = source.properties?.x_sticky ?? {};
            const colour = ({ yellow:'#fff59d',pink:'#fce4ec',green:'#dcfce7',blue:'#dbeafe',orange:'#ffedd5',purple:'#ede9fe' })[sticky.colour] ?? sticky.colour;
            if (colour) appearance.background = {color:colour};
            if (sticky.pin) appearance.decorations = [{kind:'push-pin',color:typeof sticky.pin==='string' && sticky.pin.startsWith('#')?sticky.pin:'#b91c1c',position:'ct'}];
            if (sticky.tape) (appearance.decorations??=[]).push({kind:'tape',position:'ct',size:48,color:'#e4c788',opacity:.65});
        }
        if (route) {
            const value = convertValue(route, context);
            const point = v => Array.isArray(v) ? { x: v[0], y: v[1] } : v;
            if (value.via) value.via = value.via.map(point);
            if (value.callout && typeof value.callout !== 'string') delete value.callout;
            appearance.route = structure(value, schema.appearance.properties.route, context);
        }
        const presentation=convertAppearancePresentation(source,placement,original);
        for(const [key,value]of Object.entries(presentation))appearance[key]=value&&typeof value==='object'&&!Array.isArray(value)?{...appearance[key],...value}:value;
        appearances.push(appearance);
    }
    for (const sub of original.subdiagrams ?? []) {
        const appearance={id:'appearance:'+viewId+':'+sub.id,target:migratedRef(sub.id,context),parent:migratedRef(viewId,context)};
        if (sub.at) {appearance.position={x:convertValue(sub.at[0]),y:convertValue(sub.at[1])};appearance.pinned=true;}
        if (sub.size) appearance.size={width:convertValue(sub.size[0]),height:convertValue(sub.size[1])};
        appearances.push(appearance);
    }
    return appearances;
}
export function convertGraph(input, context = {}) {
    const raw=input.resolved??input,policy=raw.view.profiles?.export;
    if(policy?.mode==='redacted'){
        // A publication allowlist becomes a separate, materialized safe graph.
        // The private view keeps its source; hiding private fields is not used
        // as redaction and the approved SVG has no references to private IDs.
        const allowed=new Set((policy.elements??[]).map(v=>v?.$ref??v)),fields=policy.fields===null?null:new Set((policy.fields??[]).map(v=>v?.$ref??v)),props=new Set(policy.properties??[]),ids=new Map();
        const opaque=id=>{if(!ids.has(id))ids.set(id,'public-'+createHash('sha256').update(raw.view.id+'::'+id).digest('hex').slice(0,20));return ids.get(id);};
        const clean=p=>Object.fromEntries(Object.entries(p??{}).filter(([key])=>props.has(key)));
        const elements=(raw.elements??[]).filter(e=>allowed.has(e.id)).map(e=>({...e,id:opaque(e.id),properties:clean(e.properties),ports:[],fields:(e.fields??[]).filter(f=>!fields||fields.has(f.id)).map(f=>({...f,id:opaque(f.id),parent:opaque(f.parent??e.id),properties:clean(f.properties)}))}));
        const keep=new Set(elements.map(e=>e.id)),relations=(raw.relations??[]).filter(e=>keep.has(opaque(e.from.element))&&keep.has(opaque(e.to.element))).map(e=>({...e,id:opaque(e.id),name:e.kind,properties:clean(e.properties),from:{element:opaque(e.from.element)},to:{element:opaque(e.to.element)}}));
        const view={...raw.view,name:policy.title||raw.view.name,selected:elements.map(e=>e.id),relations:relations.map(e=>e.id),placements:{},routes:{},frames:[],subdiagrams:[]};
        input={...input,resolved:{...raw,view,elements,relations}};
    }
    const resolved = input.resolved ?? input, view = convertView(input, context), options = convertValue(resolved.view.profiles?.projection ?? {}, context);
    if(resolved.view.diff){const counts=resolved.view.diff.counts??{};view.chrome={...view.chrome,footer_text:'Added '+(counts.added??0)+' · Removed '+(counts.removed??0)+' · Changed '+(counts.changed??0)+' · Unchanged '+(counts.unchanged??0)};}
    delete options.kind; delete options.profile;
    const definitions = convertDefinitions(input,context);
    if (options.effect?.id) options.effect = options.effect.id;
    if (Array.isArray(options.inputs)) options.inputs = options.inputs.map(input => {
        if (!input || typeof input !== 'object' || !input.key) return input;
        const { key, ...allowed_values } = input, id = 'state-input:' + key;
        definitions.push({ id, name: key, title: key, category:'element',role:'domain',content:{allowed_values} });
        return migratedRef(id,context);
    });
    if (Array.isArray(options.traces)) options.traces = options.traces.map((trace,index) => {
        if (!trace.events) return trace;
        const id = 'state-trace:' + view.id + ':' + index;
        definitions.push({ id, name:id, title:'Trace ' + (index+1), category:'element',role:'record',metadata:{x_record:{...trace,events:trace.events.map(({data,...event}) => ({...event,...(data?{values:data}:{})}))}} });
        return migratedRef(id,context);
    });
    if (Object.keys(options).length) view.projection = { options };
    const publications = convertPublications(input,context);
    if (publications.length) view.publication = migratedRef(publications[0].id,context);
    return { version: 'ddn-next-1', definitions, views: [view], publications, appearances: convertAppearances(input, context) };
}

/** Old output profiles become explicitly named reusable publication definitions. */
export function convertPublications(input, context = {}) {
    const resolved = input.resolved ?? input, original = resolved.view, settings = original.profiles?.publication;
    if (!settings) return [];
    const id = 'publication:' + original.local, page = {};
    for (const key of ['size','fit','orientation']) if (settings[key] !== undefined) page[key] = settings[key];
    for (const key of ['width','height']) if (settings[key]?.$quantity !== undefined) page[key] = { value:settings[key].$quantity,unit:settings[key].unit };
    if (settings.margin !== undefined) { const value = settings.margin?.$quantity !== undefined ? settings.margin.$quantity * ({mm:96/25.4,cm:96/2.54,in:96,pt:96/72}[settings.margin.unit] ?? 1) : convertValue(settings.margin, context); page.margin = typeof value === 'number' ? {top:value,right:value,bottom:value,left:value} : value; }
    if (settings.minimum_text?.$quantity !== undefined) page.minimum_text = settings.minimum_text.$quantity * (settings.minimum_text.unit === 'pt' ? 4 / 3 : 1);
    if (settings.overflow) page.overflow = settings.overflow === 'warn' ? 'report' : settings.overflow;
    const publication = { id,name:id,title:original.name,targets:[{target:migratedRef(original.local,context),kind:'view'}],format:'svg',page:structure(page,schema.publication.properties.page,context) };
    for (const key of ['header','footer']) if (settings[key]) publication[key] = {runs:structure(settings[key],schema.chrome_band,context),visible:true};
    const declarations=input.ast?.sections?.flatMap(s=>s.declarations??[])??[],viewNode=declarations.find(d=>d.type==='view'&&d.id===original.local),reference=viewNode?.props?.publication?.$ref;
    const authoredPage=viewNode?.children?.find(d=>d.type==='publication')??declarations.flatMap(d=>d.type==='format'?(d.children??[]).filter(p=>p.type==='publication').map(p=>({path:d.id+'.'+p.id,node:p})):[]).find(p=>p.path===reference)?.node;
    for(const band of authoredPage?.children??[])if(['header','footer'].includes(band.type)){
        const runs=publication[band.type]?.runs??{};
        for(const run of band.children??[]){const props={...run.props};if(props.size?.$quantity!==undefined)props.size=props.size.$quantity*({pt:96/72,mm:96/25.4,cm:96/2.54,in:96}[props.size.unit]??1);if(props.variant==='small-caps')props.variant='small_caps';runs[run.type]={...runs[run.type],...structure(props,schema.chrome_run,context)};}
        publication[band.type]={runs,visible:true};
    }
    if(settings.background) publication.background=structure(settings.background,schema.publication.properties.background,context);
    if(settings.border) publication.border={width:settings.border.weight??1,style:'solid',color:'#475569'};
    return [publication];
}
