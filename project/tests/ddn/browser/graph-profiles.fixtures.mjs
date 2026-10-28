import { readFileSync } from 'node:fs';
const contracts = JSON.parse(readFileSync(new URL('../../../../standard/codex/profile-contracts.json', import.meta.url), 'utf8'));
export const graphFixtureProfiles = Object.keys(contracts).filter(id => ['graph', 'chen', 'sequence', 'timing', 'fishbone'].includes(contracts[id].projection) && !['ddn@1', 'mindmap.basic@1', 'concept.map@1'].includes(id));
const ref = id => ({ file: 'main.ddn', id });
export const graphSemanticEndpointSource = `view Structure as uml.structure@2
    element House as uml.class
    element Room as uml.class
    connect House to Room as uml.association named Contains
        with
            qualifiers.source.mark filled-diamond
            qualifiers.target.navigable true

view Crowfoot as erd.crowfoot@1
    element Customer as entity
    element Order as entity
    connect Customer to Order as assoc named Orders
        with
            properties.source_mark one
            properties.target_mark zeromany
`;
export function createGraphFixture(profile) {
    const contract = contracts[profile];
    if (!contract || !graphFixtureProfiles.includes(profile)) throw new Error(`Not a retained graph profile: ${profile}`);
    let definitions = contract.primary_palette.map((role, i) => ({ id: 'node-' + i, name: role.split('.').at(-1) + ' ' + (i + 1), role, category: 'element', design: { state: 'draft' }, metadata: {} }));
    let nodes = definitions;
    const addEdge = (from, to, role, metadata = {}) => { const edge = { id: 'edge-' + definitions.length, name: 'Relation ' + definitions.length, title: 'supplied meaning', category: 'relation', role, endpoints: [{ definition: ref(from.id) }, { definition: ref(to.id) }], metadata }; definitions.push(edge); return edge; };
    nodes.forEach(node => {
        if (node.role === 'flow.gateway') node.metadata.x_gateway = { type: 'exclusive' };
        if (node.role === 'flow.start') node.metadata.x_event = { type: 'none', position: 'start' };
        if (node.role === 'flow.end') node.metadata.x_event = { type: 'none', position: 'end' };
        if (node.role === 'flow.intermediate') node.metadata.x_event = { type: 'timer', position: 'intermediate' };
        if (node.role === 'flow.choreotask') node.metadata.x_bands = ['Requester', 'Supplier'];
        if (node.role === 'epk.connector') node.metadata.x_epc = { operator: 'xor' };
        if (node.role === 'analysis.task') node.metadata.x_estimate = 3;
        if (node.role === 'req.requirement') node.metadata.x_requirement = { id: 'R-1', owner: 'Design', acceptance: 'Preserve source identity', state: 'required' };
        if (node.role === 'petri.place') node.metadata.x_petri = { tokens: 3 };
        if (node.role === 'vsm.process') node.metadata.x_vsm = { va: 2, nva: 5, unit: 'min' };
        if (node.role === 'network.rack') node.metadata.x_rack = { units: 12 };
        if (node.role === 'network.server' && profile === 'network.rack@1') node.metadata.x_rack = { unit: 3 };
        if (node.role === 'ladder.contact') node.metadata.x_contact = { form: 'nc' };
        if (node.role === 'ladder.coil') node.metadata.x_coil = { mode: 'set' };
        if (node.role === 'tree.gate') node.metadata.x_gate = { type: 'and' };
        if (node.role === 'family.person') { node.metadata.x_birth = 1980; node.metadata.x_death = 2020; }
    });
    if (nodes.length === 1) { definitions.push({ ...nodes[0], id: 'node-1', name: nodes[0].name + ' child', metadata: structuredClone(nodes[0].metadata) }); }
    nodes = [...definitions];
    if (contract.projection === 'sequence') { definitions = nodes = nodes.slice(0, 3); const participants = nodes.filter(node => node.role !== 'msc.hmscref'); addEdge(participants[0], participants[1], 'uml.message', { x_message: { sort: 'synch', seq: '1' } }); addEdge(participants[1], participants[0], 'uml.message', { x_message: { sort: 'reply', seq: '2' } }); }
    else if (contract.projection === 'timing') { definitions = nodes = nodes.slice(0, 2); nodes.forEach(node => { node.metadata.x_states = [{ at: 0, state: 'idle' }, { at: 2, state: 'active' }, { at: 7, state: 'idle' }]; }); addEdge(nodes[0], nodes[1], 'uml.message', { x_message: { at: 2 } }); }
    else if (profile === 'fishbone.basic@1') { const effect = nodes.find(n => n.role === 'quality.effect'), category = nodes.find(n => n.role === 'quality.category'), cause = nodes.find(n => n.role === 'quality.cause'); addEdge(category, effect, 'quality.cause'); addEdge(cause, category, 'quality.cause'); }
    else for (const relation of contract.relation_endpoint_contracts.slice(0, 3)) {
        const source = nodes.find(n => relation.source_roles.includes(n.role)), target = nodes.find(n => relation.target_roles.includes(n.role) && n !== source) ?? nodes.find(n => relation.target_roles.includes(n.role));
        if (source && target && (source !== target || relation.self_allowed)) { const edge = addEdge(source, target, relation.role); if (profile === 'erd.crowfoot@1') edge.properties = { source_mark: 'one', target_mark: 'zeromany' }; }
    }
    if (contract.projection === 'chen') {
        nodes.forEach((node, i) => { const field = { id: 'field-' + i, name: 'identifier ' + i, category: 'element', role: 'field', content: { parent: ref(node.id), ordinal: 0 }, metadata: { x_chen: { key: true } } }; node.members = [ref(field.id)]; definitions.push(field); });
    }
    if (profile.startsWith('uml.structure') || profile.startsWith('sysml.') || profile.startsWith('soaml.')) {
        const classifier = nodes.find(n => !/actor|usecase|state|flow/.test(n.role));
        if (classifier) { const field = { id: 'member-field', name: 'identifier', category: 'element', role: 'field', content: { parent: ref(classifier.id), ordinal: 0, datatype: 'string' }, metadata: { x_member: { kind: 'attribute', visibility: 'private' } } }; classifier.members = [ref(field.id)]; definitions.push(field); }
    }
    // Supply semantic witnesses, not merely palette endpoints: delegation starts
    // at an owned port; generalizations retain classifier kind; v1 constraints
    // have exactly two incident bindings.
    for (const edge of definitions.filter(definition => definition.category === 'relation')) {
        if (edge.role === 'uml.delegation') {
            const owner = definitions.find(definition => definition.id === edge.endpoints[0].definition.id), port = { id: 'delegation-port-' + edge.id, name: 'Delegating port', role: 'core::Port', category: 'element', content: { owner: ref(owner.id), direction: 'output' } };
            owner.members = [...(owner.members ?? []), ref(port.id)]; definitions.push(port); edge.endpoints[0].member = ref(port.id);
        }
        if (edge.role === 'uml.generalization') {
            const source = definitions.find(definition => definition.id === edge.endpoints[0].definition.id), target = definitions.find(definition => definition.id === edge.endpoints[1].definition.id);
            if (source.role !== target.role) { const sameKind = { ...structuredClone(source), id: 'general-' + edge.id, name: 'General ' + source.name }; delete sameKind.members; definitions.push(sameKind); edge.endpoints[1].definition = ref(sameKind.id); }
        }
    }
    if (profile === 'sysml.parametric@1') {
        const constraint = definitions.find(definition => definition.role === 'sysml.constraint'), incident = definitions.filter(definition => definition.category === 'relation' && definition.endpoints.some(endpoint => endpoint.definition.id === constraint.id));
        for (const extra of incident.slice(2)) definitions.splice(definitions.indexOf(extra), 1);
    }
    const selected = definitions.filter(n => n.role !== 'field' && n.role !== 'core::Port').map(n => ref(n.id));
    const view = { id: 'view', name: 'Example ' + profile, profile, design: { state: 'draft' }, selection: { include: selected } };
    if (profile === 'network.rack@1') { const rack = nodes.find(node => node.role === 'network.rack'), devices = nodes.filter(node => node.metadata.x_rack?.unit); view.regions = [{ id: 'rack-region', scope: ref(rack.id), members: devices.map(node => ref(node.id)) }]; }
    const document = { version: 'ddn-next-1', definitions, views: [view], appearances: [] };
    const snapshot = { contract: 'ddn-next-1', rootFile: 'main.ddn', revision: { model: '1', sources: { 'main.ddn': '1' }, data: {} }, versions: { api: '1.0', language: 'ddn-next-1', defaults: 'ddn-next-1', packs: {} }, semanticFingerprint: 'graph-fixture-' + profile, coverage: { scope: { kind: 'workarea' }, complete: true, checked: [], unavailable: [] }, normalized: { version: 'ddn-next-1', entry: 'main.ddn', files: [{ location: 'main.ddn', document }] } };
    return { snapshot, document, view, definitions };
}
