import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGraphFixture, graphFixtureProfiles, graphSemanticEndpointSource } from './graph-profiles.fixtures.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = process.env.DDN_BUILD_ROOT ?? resolve(root, '.work/builds/ddn');
const { records } = await import(pathToFileURL(join(output, 'ddn/packages/presentation/src/model.js')));
const { graphProfileIds, projectGraphProfile } = await import(pathToFileURL(join(output, 'ddn/packages/presentation/src/graph-profiles.js')));
const { validateSchema } = await import(pathToFileURL(join(output, 'ddn/packages/profiles/src/schema.js')));
const { decodeSources } = await import(pathToFileURL(join(output, 'ddn/packages/language/src/index.js')));
const { nodeGlyph, arrowMarker } = await import(pathToFileURL(join(output, 'ddn/packages/presentation/src/graph-glyphs.js')));
function render(fixture, options = {}) {
    const all = records(fixture.snapshot), view = all.find(item => item.owner === 'view' && item.ref.id === fixture.view.id);
    const selected = new Set(fixture.view.selection.include.map(ref => ref.id));
    const definitions = all.filter(record => record.owner === 'definition' && (selected.has(record.ref.id) || record.record.category === 'relation' && record.record.endpoints.every(end => selected.has(end.definition.id))));
    const entries = definitions.map((definition, index) => {
        const bounds = { x: 32 + index % 3 * 300, y: 64 + Math.floor(index / 3) * 220, width: 248, height: 60 }, occurrence = 'fixture:' + definition.ref.id;
        const appearance = all.find(record => record.owner === 'appearance' && record.record.target?.id === definition.ref.id && record.record.parent?.id === view.ref.id);
        return { definition, view, ...(appearance ? { appearance } : {}), effective: definition.record, item: { occurrence, target: definition.ref, view: view.ref, layer: definition.record.category === 'relation' ? 'relations' : 'content', bounds, transform: [1,0,0,1,0,0], primitives: [], hitTargets: [{ id: occurrence, target: definition.ref, bounds }], accessible: { role: 'graphics-symbol', label: definition.record.name ?? definition.ref.id }, evidence: 'current' } };
    });
    return projectGraphProfile(fixture.snapshot, view, entries, { bounds: { x: 0, y: 0, width: 960, height: 680 }, ...options });
}

const texts = result => result.entries.flatMap(entry => entry.item.primitives).filter(p => p.kind === 'text').flatMap(p => p.runs).map(run => run.text);
test('every retained graph-family profile produces nonempty identity-bearing display geometry', () => {
    assert.deepEqual([...graphProfileIds].sort(), [...graphFixtureProfiles].sort());
    for (const profile of graphFixtureProfiles) {
        const fixture = createGraphFixture(profile), result = render(fixture);
        assert.deepEqual(validateSchema('bundle', fixture.snapshot.normalized), [], profile + ' structural schema');
        assert.equal(result.unavailable.length, 0, profile + ': ' + result.unavailable.join(','));
        assert.ok(result.entries.length > 0, profile);
        for (const entry of result.entries) { assert.ok(entry.item.primitives.length > 0, profile); for (const value of Object.values(entry.item.bounds)) assert.ok(Number.isFinite(value), profile + ' nonfinite bounds'); assert.ok(fixture.definitions.some(def => def.id === entry.item.target.id) || entry.item.target.id === 'view', profile + ' invented target'); }
    }
});
test('flow, ISO, BPMN, DFD, Petri and ladder glyphs use distinct required shapes and markers', () => {
    const b = { x: 0, y: 0, width: 100, height: 70 }, options = { title: 'test', profile: 'flow.iso5807@1' };
    assert.notDeepEqual(nodeGlyph('flow.io', {}, b, options)[0], nodeGlyph('flow.decision', {}, b, options)[0]);
    assert.ok(nodeGlyph('flow.document', {}, b, options).some(p => p.kind === 'path' && p.d.includes('C')));
    assert.equal(nodeGlyph('dfd.process', {}, b, { ...options, profile: 'dfd.yourdon@1' })[0].kind, 'ellipse');
    assert.equal(nodeGlyph('dfd.process', {}, b, { ...options, profile: 'dfd.gane_sarson@1' }).filter(p => p.kind === 'path').length, 3);
    assert.equal(nodeGlyph('flow.gateway', { metadata: { x_gateway: { type: 'parallel' } } }, b, options).filter(p => p.kind === 'path').length, 3);
    assert.equal(nodeGlyph('flow.gateway', { metadata: { x_gateway: { type: 'inclusive' } } }, b, options).filter(p => p.kind === 'ellipse').length, 1);
    assert.equal(nodeGlyph('petri.place', { metadata: { x_petri: { tokens: 3 } } }, b, options).filter(p => p.kind === 'ellipse').length, 4);
    assert.ok(nodeGlyph('ladder.contact', { metadata: { x_contact: { form: 'nc' } } }, b, options).filter(p => p.kind === 'path').length >= 5);
    assert.equal(arrowMarker([50, 0], [0, 0], 'zeromany').filter(p => p.kind === 'ellipse').length, 1);
});
test('UML class compartments retain member visibility and static/abstract adornments', () => {
    const fixture = createGraphFixture('uml.structure@2');
    fixture.definitions.find(d => d.id === 'member-field').metadata.x_member = { kind: 'operation', visibility: 'public', static: true, abstract: true };
    const result = render(fixture), member = result.entries.flatMap(e => e.item.primitives).filter(p => p.kind === 'text').flatMap(p => p.runs).find(r => r.text.includes('+identifier()'));
    assert.ok(member); assert.equal(member.style['text-decoration'], 'underline'); assert.equal(member.style['font-style'], 'italic');
});
test('Chen ovals and n-ary spokes keep semantic field and relationship identities', () => {
    const fixture = createGraphFixture('chen.nary@3'), entities = fixture.definitions.filter(d => d.role === 'entity');
    const third = { id: 'third', name: 'Third', category: 'element', role: 'entity' }; fixture.definitions.push(third); fixture.view.selection.include.push({ id: third.id });
    const edge = fixture.definitions.find(d => d.category === 'relation'); edge.metadata.x_nary = { ends: [{ element: { id: third.id }, role: 'supplier', multiplicity: '1..*' }] };
    const result = render(fixture), field = result.entries.find(e => e.definition.ref.id === 'field-0'), relation = result.entries.find(e => e.definition.ref.id === edge.id);
    assert.ok(field.item.primitives.some(p => p.kind === 'ellipse')); assert.ok(field.item.primitives.some(p => p.kind === 'text' && p.runs[0].style['text-decoration'] === 'underline')); assert.match(relation.item.accessible.description, /3 participants/); assert.ok(texts(result).includes('supplier 1..*'));
});
test('sequence participants, replies, fragments and authorable activations preserve message ordering', () => {
    const fixture = createGraphFixture('uml.sequence@2'), messages = fixture.definitions.filter(d => d.category === 'relation'), participant = fixture.definitions[0];
    messages[0].metadata.x_fragment = { operator: 'alt', operands: [{ guard: 'success', messages: [{ id: messages[0].id }] }, { guard: 'failure', messages: [{ id: messages[1].id }] }] };
    participant.metadata.x_activation = [{ from: { id: messages[0].id }, to: { id: messages[1].id } }];
    participant.metadata.x_invariant = [{ after: { id: messages[0].id }, label: 'ready', role: 'setting' }];
    const result = render(fixture), reply = result.entries.find(e => e.definition.ref.id === messages[1].id);
    assert.ok(reply.item.primitives.some(p => p.kind === 'path' && p.paint['stroke-dasharray'])); assert.ok(texts(result).includes('[success]')); assert.ok(texts(result).includes('ready'));
    const first = result.entries.find(e => e.definition.ref.id === messages[0].id); assert.ok(first.item.bounds.y < reply.item.bounds.y);
});
test('timing uses declared numeric scale and reports invalid ordering rather than inventing states', () => {
    const fixture = createGraphFixture('uml.timing@2'), good = render(fixture);
    assert.ok(texts(good).includes('active')); assert.ok(good.entries.some(e => e.item.primitives.some(p => p.kind === 'path' && p.d.includes('H') && p.d.includes('V'))));
    fixture.definitions[0].metadata.x_states = [{ at: 2, state: 'a' }, { at: 1, state: 'b' }];
    const invalid = render(fixture); assert.ok(invalid.unavailable.length); assert.ok(invalid.diagnostics.some(d => d.code === 'timing-states-invalid'));
});
test('CPM visibly calculates supplied durations and critical zero-slack path', () => {
    const fixture = createGraphFixture('pert.cpm@1'); fixture.definitions[0].metadata.x_estimate = 3; fixture.definitions[1].metadata.x_estimate = 5;
    const result = render(fixture); assert.ok(texts(result).some(t => t.includes('Slack 0 d'))); assert.ok(texts(result).some(t => t.includes('EF 8')));
});
test('CPM does not invent zero estimates or calculations for cyclic precedence', () => {
    const fixture = createGraphFixture('pert.cpm@1'); delete fixture.definitions[0].metadata.x_estimate;
    const incomplete = render(fixture); assert.ok(incomplete.unavailable.includes('analysis:cpm:durations')); assert.ok(!texts(incomplete).some(text => text.startsWith('ES ')));
    fixture.definitions[0].metadata.x_estimate = 3;
    fixture.definitions.push({ id: 'cycle', category: 'relation', role: 'analysis.precedes', endpoints: [{ definition: { id: fixture.definitions[1].id } }, { definition: { id: fixture.definitions[0].id } }] });
    assert.ok(render(fixture).unavailable.includes('analysis:cpm:cycle'));
});
test('fishbone shared causes have distinct occurrences and common semantic target', () => {
    const fixture = createGraphFixture('fishbone.basic@1'), category = fixture.definitions.find(d => d.role === 'quality.category'), cause = fixture.definitions.find(d => d.role === 'quality.cause' && d.category !== 'relation'), effect = fixture.definitions.find(d => d.role === 'quality.effect');
    const other = { ...structuredClone(category), id: 'other-category', name: 'Other' }; fixture.definitions.push(other, { id: 'other-edge', category: 'relation', role: 'quality.cause', endpoints: [{ definition: { id: other.id } }, { definition: { id: effect.id } }] }, { id: 'shared-edge', category: 'relation', role: 'quality.cause', endpoints: [{ definition: { id: cause.id } }, { definition: { id: other.id } }] }); fixture.view.selection.include.push({ id: other.id });
    const result = render(fixture), repeats = result.entries.filter(e => e.definition.ref.id === cause.id); assert.equal(repeats.length, 2); assert.notEqual(repeats[0].item.occurrence, repeats[1].item.occurrence); assert.deepEqual(repeats[0].item.target, repeats[1].item.target);
});
test('scoped frames and association class retain references and generated layout geometry', () => {
    const fixture = createGraphFixture('uml.structure@2'), nodes = fixture.definitions.filter(d => d.category !== 'relation' && d.role !== 'field'), edge = fixture.definitions.find(d => d.category === 'relation');
    edge.metadata.x_association_class = { class: { id: nodes[2].id } }; fixture.view.regions = [{ id: 'package-frame', name: 'Package', members: [{ id: nodes[0].id }, { id: nodes[1].id }], role: 'package' }];
    const result = render(fixture); assert.ok(result.entries.some(e => e.item.occurrence.includes('association-class'))); const region = result.entries.find(e => e.item.occurrence.includes('region:package-frame')); assert.ok(region.item.bounds.width > nodes.length); assert.equal(region.item.target.id, 'view');
});
test('inline interaction references display the target messages with original identities', () => {
    const fixture = createGraphFixture('uml.interaction_overview@2'), owner = fixture.definitions.find(d => d.role === 'flow.process');
    owner.metadata.x_subdiagram = { view: 'Interaction', display: 'inline' };
    const child = { id: 'child-view', name: 'Interaction', profile: 'uml.sequence@2', selection: { include: [{ id: 'sender' }, { id: 'receiver' }, { id: 'message' }] } };
    fixture.document.views.push(child);
    fixture.definitions.push({ id: 'sender', name: 'Sender', role: 'object', category: 'element' }, { id: 'receiver', name: 'Receiver', role: 'object', category: 'element' }, { id: 'message', name: 'Call', title: 'Call', role: 'uml.message', category: 'relation', endpoints: [{ definition: { id: 'sender' } }, { definition: { id: 'receiver' } }], metadata: { x_message: { sort: 'synch' } } });
    const result = render(fixture), childMessage = result.entries.find(e => e.item.occurrence.includes(':inline:') && e.item.target.id === 'message');
    assert.ok(childMessage); assert.ok(childMessage.item.transform[0] > 0); assert.ok(childMessage.item.clip); assert.equal(childMessage.item.target.file, 'main.ddn'); assert.ok(texts(result).includes('ref Interaction'));
});
test('recursive inline references report incomplete coverage instead of recursing indefinitely', () => {
    const fixture = createGraphFixture('uml.interaction_overview@2'), owner = fixture.definitions.find(d => d.role === 'flow.process'); owner.metadata.x_subdiagram = { view: fixture.view.name, display: 'inline' };
    const result = render(fixture); assert.ok(result.unavailable.some(value => value.startsWith('inline:'))); assert.ok(result.diagnostics.some(d => /Recursive/.test(d.message)));
});
test('inline projection delegates to the installed cross-family projector with recursion context', () => {
    const fixture = createGraphFixture('uml.interaction_overview@2'), owner = fixture.definitions.find(d => d.role === 'flow.process'); owner.metadata.x_subdiagram = { view: 'Records', display: 'inline' }; fixture.document.views.push({ id: 'records-view', name: 'Records', profile: 'table.records@1' });
    let called = false;
    const result = render(fixture, { projectInline(snapshot, targetView, bounds, ancestors) { called = true; assert.equal(snapshot, fixture.snapshot); assert.equal(targetView.record.profile, 'table.records@1'); assert.ok(ancestors.includes(JSON.stringify(['main.ddn', 'view']))); const item = { occurrence: 'inline-table', target: targetView.ref, view: targetView.ref, layer: 'content', bounds: { x: 0, y: 0, width: 300, height: 100 }, transform: [1,0,0,1,0,0], primitives: [{ kind: 'text', runs: [{ text: 'Resolved table data', x: 5, y: 20, fontKey: 'sans', style: { 'font-size': 14 } }] }], hitTargets: [], accessible: { role: 'graphics-object', label: 'Resolved table data' }, evidence: 'current' }; return { entries: [{ item, definition: targetView, view: targetView, effective: {} }], diagnostics: [], unavailable: [] }; } });
    assert.equal(called, true); assert.equal(result.unavailable.length, 0); assert.ok(texts(result).includes('Resolved table data'));
});
test('frozen inline views use only declared image artifacts and never substitute live data', () => {
    const fixture = createGraphFixture('uml.interaction_overview@2'), owner = fixture.definitions.find(d => d.role === 'flow.process'); owner.metadata.x_subdiagram = { view: 'Historical', display: 'thumbnail', frozen: true, snapshot: 'Snapshot', snapshot_at: '2026-10-23T12:00:00Z' };
    const missing = render(fixture); assert.ok(missing.unavailable.some(value => value.startsWith('inline-snapshot:')));
    fixture.document.assets = [{ id: 'snap', name: 'Snapshot', media_type: 'image/svg+xml', path: 'snap.svg' }];
    const result = render(fixture, { projectInline() { throw new Error('Frozen display must not project live data'); } });
    const image = result.entries.flatMap(entry => entry.item.primitives).find(p => p.kind === 'image'); assert.equal(image.assetId, JSON.stringify(['main.ddn', 'snap'])); assert.ok(texts(result).includes('Frozen 2026-10-23T12:00:00Z'));
});
test('self relations retain visible loop geometry and matching bounds', () => {
    const fixture = createGraphFixture('state.flat@1'), node = fixture.definitions.find(d => d.role === 'state.state'), loop = { id: 'loop', name: 'tick', category: 'relation', role: 'state.transition', endpoints: [{ definition: { id: node.id } }, { definition: { id: node.id } }], metadata: { x_transition: { event: 'tick', guard: 'ready', effect: 'run' } } }; fixture.definitions.push(loop); fixture.view.selection.include.push({ id: loop.id });
    const result = render(fixture), rendered = result.entries.find(e => e.definition.ref.id === loop.id); assert.ok(rendered.item.bounds.width >= 50); assert.ok(rendered.item.bounds.height >= 40); assert.ok(texts(result).includes('tick [ready] / run'));
});
test('canonical core ports and ORM role metadata receive required markers', () => {
    const fixture = createGraphFixture('fbd.basic@1'), owner = fixture.definitions.find(d => d.role === 'fbd.block'), port = { id: 'input', role: 'core::Port', category: 'element', name: 'Enable', content: { owner: { id: owner.id }, direction: 'input' }, metadata: { x_fbd: { type: 'BOOL', negated: true } } }; owner.members = [{ id: port.id }]; fixture.definitions.push(port);
    const result = render(fixture), block = result.entries.find(e => e.definition.ref.id === owner.id); assert.ok(texts(result).some(value => value.includes('Enable: BOOL'))); assert.ok(block.item.primitives.some(p => p.kind === 'ellipse' && p.bounds.width === 8));
    const orm = createGraphFixture('orm.basic@1'), fact = orm.definitions.find(d => d.role === 'orm.facttype'); orm.definitions.push({ id: 'role-field', role: 'field', name: 'employer', content: { parent: { id: fact.id }, ordinal: 0 }, metadata: { x_role: { uniqueness: true, mandatory: true } } }); fact.members = [{ id: 'role-field' }]; fact.metadata.x_objectified = { name: 'Employment' };
    const displayed = render(orm); assert.ok(texts(displayed).includes('Employment')); assert.ok(displayed.entries.find(e => e.definition.ref.id === fact.id).item.primitives.some(p => p.kind === 'ellipse' && p.bounds.width === 6));
});
test('ISO flow terminals differ from UML activity finals, and SDL timer markers are visible', () => {
    const bounds = { x: 0, y: 0, width: 100, height: 60 };
    assert.equal(nodeGlyph('flow.end', {}, bounds, { title: 'End', profile: 'flow.basic@1' })[0].kind, 'path');
    assert.equal(nodeGlyph('flow.end', {}, bounds, { title: 'End', profile: 'uml.activity@2' })[0].kind, 'ellipse');
    assert.ok(nodeGlyph('sdl.set', { metadata: { x_sdl: { duration: '10 ms' } } }, bounds, { title: 'Set', profile: 'sdl.process@1' }).some(p => p.kind === 'text' && p.runs.some(run => run.text.includes('10 ms'))));
});
test('new DDN source preserves semantic composition/navigation and explicit crowfoot property marks', () => {
    const decoded = decodeSources({ entry: 'main.ddn', files: [{ id: 'main.ddn', text: graphSemanticEndpointSource, revision: '1', writable: true, encoding: 'utf-8' }] });
    assert.equal(decoded.syntaxValid, true, JSON.stringify(decoded.diagnostics)); assert.deepEqual(validateSchema('bundle', decoded.normalized), []);
    const fixture = createGraphFixture('uml.structure@2'); fixture.snapshot.normalized = decoded.normalized; fixture.document = decoded.normalized.files[0].document; fixture.definitions = fixture.document.definitions; fixture.view = fixture.document.views[0];
    const uml = render(fixture), composition = uml.entries.find(entry => entry.definition.record.name === 'Contains');
    assert.ok(composition.item.primitives.some(p => p.kind === 'path' && p.d.endsWith('Z') && p.paint.fill === composition.item.primitives.find(p=>p.kind==='path').paint.stroke));
    assert.ok(composition.item.primitives.filter(p => p.kind === 'path' && p.paint.fill === 'none').length >= 3);
    fixture.view = fixture.document.views[1]; const crowfoot = render(fixture), orders = crowfoot.entries.find(entry => entry.definition.record.name === 'Orders');
    assert.ok(orders.item.primitives.some(p => p.kind === 'ellipse' && p.bounds.width === 10));
});
test('orthogonal graph routing avoids an intermediate classifier and keeps labels on its route', () => {
    const fixture = createGraphFixture('uml.structure@2'); fixture.definitions.splice(0, fixture.definitions.length, ...['a', 'b', 'c'].map(id => ({ id, name: id, role: 'uml.class', category: 'element' })), { id: 'ac', name: 'ac', category: 'relation', role: 'uml.association', endpoints: [{ definition: { id: 'a' } }, { definition: { id: 'c' } }] }); fixture.view.selection.include = fixture.definitions.map(definition => ({ id: definition.id }));
    fixture.view.layout={algorithm:'grid',columns:3,routing:'orthogonal'};
    const result = render(fixture), edge = result.entries.find(e => e.definition.ref.id === 'ac'), b = result.entries.find(e => e.definition.ref.id === 'b').item.bounds;
    const d = edge.item.primitives.find(p => p.kind === 'path').d; assert.ok(d.split('L').length >= 4); const points = d.slice(1).split('L').map(pair => pair.split(',').map(Number));
    for (let i = 1; i < points.length; i++) { const a = points[i-1], z = points[i]; if (a[1] === z[1]) assert.ok(a[1] <= b.y || a[1] >= b.y + b.height || Math.max(a[0], z[0]) <= b.x || Math.min(a[0], z[0]) >= b.x + b.width); }
    const text = edge.item.primitives.find(p => p.kind === 'text').runs[0]; assert.ok(text.y < b.y || text.y - text.style['font-size'] > b.y + b.height || text.x > b.x + b.width || text.x + 20 < b.x);
    fixture.view.layout = { routing: 'curved' }; assert.ok(render(fixture).entries.find(e => e.definition.ref.id === 'ac').item.primitives.find(p => p.kind === 'path').d.includes('C'));
});
test('DMN boxed expressions display declared text and named cells without evaluation', () => {
    const fixture = createGraphFixture('dmn.drd@1'), decision = fixture.definitions.find(definition => definition.role === 'dmn.decision');
    decision.metadata.x_boxed = { form: 'context', entries: [{ name: 'subtotal', text: 'price * quantity' }, { name: 'tax', text: 'subtotal * rate' }] };
    const result = render(fixture), entry = result.entries.find(entry => entry.definition.ref.id === decision.id);
    assert.ok(texts(result).includes('price * quantity')); assert.ok(texts(result).includes('tax')); assert.ok(entry.item.primitives.filter(primitive => primitive.kind === 'rect').length >= 3);
    decision.metadata.x_boxed = { form: 'literal', text: '1 + 2' }; assert.ok(texts(render(fixture)).includes('1 + 2')); assert.ok(!texts(render(fixture)).includes('3'));
});

test('graph glyphs and labels honor resolved fonts, text, background, border and relation strokes', () => {
    const fixture = createGraphFixture('uml.structure@2'), node = fixture.definitions.find(definition => definition.role === 'uml.class'), edge = fixture.definitions.find(definition => definition.category === 'relation');
    node.style = { font: 'Courier New', font_size: 24 }; node.text = { color: '#123456' }; node.background = { color: '#abcdef' }; node.border = { color: '#456789', width: 3 }; node.symbol = { fill: '#ffffff' };
    edge.style = { font: 'serif', font_size: 20 }; edge.stroke = { color: '#987654', width: 4, dash: [8, 2] };
    const result = render(fixture), rendered = result.entries.find(entry => entry.definition.ref.id === node.id), relation = result.entries.find(entry => entry.definition.ref.id === edge.id);
    assert.equal(rendered.item.primitives[0].paint.fill, '#abcdef'); assert.equal(rendered.item.primitives[0].paint.stroke, '#456789'); assert.equal(rendered.item.primitives[0].paint['stroke-width'], 3);
    const title = rendered.item.primitives.find(primitive => primitive.kind === 'text').runs[0]; assert.equal(title.fontKey, 'Courier New'); assert.equal(title.style.fill, '#123456'); assert.equal(title.style['font-size'], 22.5);
    assert.equal(relation.item.primitives[0].paint['stroke-width'], 4); assert.equal(relation.item.primitives[0].paint['stroke-dasharray'], '8 2'); assert.equal(relation.item.primitives.find(primitive => primitive.kind === 'text').runs[0].fontKey, 'serif');
});
test('inline composition intersects a transformed existing child clip', () => {
    const fixture = createGraphFixture('uml.interaction_overview@2'), owner = fixture.definitions.find(d => d.role === 'flow.process'); owner.metadata.x_subdiagram = { view: 'Child', display: 'inline' }; fixture.document.views.push({ id: 'child', name: 'Child', profile: 'table.records@1' });
    const result = render(fixture, { projectInline(snapshot, view) { const bounds = { x: 0, y: 0, width: 200, height: 100 }; return { entries: [{ definition: view, view, effective: {}, item: { occurrence: 'child', target: view.ref, view: view.ref, layer: 'content', bounds, clip: { x: 20, y: 10, width: 40, height: 30 }, transform: [1,0,0,1,0,0], primitives: [{ kind: 'rect', bounds, paint: { fill: '#fff' } }], hitTargets: [], accessible: { role: 'graphics-object', label: 'Child' }, evidence: 'current' } }], diagnostics: [], unavailable: [] }; } });
    const child = result.entries.find(entry => entry.item.occurrence.endsWith(':inline:child')), [scale,,,,tx,ty] = child.item.transform;
    assert.equal(child.item.clip.x, 20 * scale + tx); assert.equal(child.item.clip.y, 10 * scale + ty); assert.ok(Math.abs(child.item.clip.width - 40 * scale) < 1e-9); assert.ok(Math.abs(child.item.clip.height - 30 * scale) < 1e-9);
});
test('rack devices use their explicit region scope when more than one rack exists', () => {
    const fixture = createGraphFixture('network.rack@1'), rack = fixture.definitions.find(node => node.role === 'network.rack'), server = fixture.definitions.find(node => node.role === 'network.server'), second = { ...structuredClone(rack), id: 'second-rack', name: 'Second rack' };
    fixture.definitions.push(second); fixture.view.selection.include.push({ id: second.id }); fixture.view.regions[0].scope = { id: second.id };
    const result = render(fixture), target = result.entries.find(entry => entry.definition.ref.id === second.id).item.bounds, device = result.entries.find(entry => entry.definition.ref.id === server.id).item.bounds;
    assert.ok(device.x > target.x && device.x + device.width < target.x + target.width); assert.ok(device.y > target.y && device.y + device.height <= target.y + target.height);
});
test('package ownership, SysML units, continuation keys and exception semantics stay visible', () => {
    const fixture = createGraphFixture('uml.structure@2'), classifier = fixture.definitions.find(definition => definition.role === 'uml.class'), member = fixture.definitions.find(definition => definition.role === 'field'), owner = fixture.definitions.find(definition => definition.role === 'uml.package') ?? { id: 'package-owner', name: 'Library', role: 'uml.package', category: 'element' };
    if (!fixture.definitions.includes(owner)) { fixture.definitions.push(owner); fixture.view.selection.include.push({ id: owner.id }); }
    classifier.metadata.x_pack = { package: { id: owner.id }, visibility: 'private' }; member.metadata.x_unit = { unit: 'm', quantity: 'length' };
    const result = render(fixture); assert.ok(result.entries.some(entry => entry.item.occurrence.endsWith(':package-members'))); assert.ok(texts(result).some(text => text.includes('private · package'))); assert.ok(texts(result).some(text => text.includes('[m; length]')));
    const flow = createGraphFixture('flow.documented@2'), offpage = flow.definitions.find(definition => definition.role === 'flow.offpage'); offpage.metadata.x_continuation = { key: 'invoice', side: 'out' }; assert.ok(texts(render(flow)).includes('out invoice'));
    const activity = createGraphFixture('uml.activity@2'), edge = activity.definitions.find(definition => definition.category === 'relation'); edge.metadata.x_exception = true; assert.ok(texts(render(activity)).includes('ϟ'));
});
test('HMSC reference parameters and invariant roles remain distinct from participant lifelines', () => {
    const fixture = createGraphFixture('msc.basic@1'), reference = { id: 'hmsc-ref', name: 'Handshake', category: 'element', role: 'msc.hmscref', metadata: { x_subdiagram: { view: 'Protocol', display: 'badge' }, x_hmscref: { params: ['request', 'response'] } } };
    fixture.definitions.push(reference); fixture.view.selection.include.push({ id: reference.id });
    const participant = fixture.definitions.find(definition => definition.role !== 'msc.hmscref' && definition.category !== 'relation'), message = fixture.definitions.find(definition => definition.category === 'relation'); participant.metadata.x_invariant = [{ after: { id: message.id }, label: 'open', role: 'guarding' }];
    const result = render(fixture), shown = result.entries.find(entry => entry.definition.ref.id === reference.id); assert.ok(texts(result).includes('(request, response)')); assert.ok(texts(result).includes('guarding')); assert.ok(!shown.item.primitives.some(primitive => primitive.kind === 'path' && primitive.paint['stroke-dasharray']));
});
test('crowfoot feet face the entity and optional cardinalities replace the mandatory bar', () => {
    const many = arrowMarker([100, 50], [0, 50], 'many'), optional = arrowMarker([100, 50], [0, 50], 'zeroone');
    assert.equal(many[0].d, 'M85,50L100,58'); assert.equal(many[1].d, 'M85,50L100,42'); assert.equal(many.length, 4);
    assert.equal(optional.filter(primitive => primitive.kind === 'path').length, 1); assert.equal(optional.filter(primitive => primitive.kind === 'ellipse').length, 1);
    assert.equal(arrowMarker([100, 50], [0, 50], 'port')[0].paint.fill, '#fff'); assert.equal(arrowMarker([100, 50], [0, 50], 'junction')[0].kind, 'ellipse');
});

test('actor arms and legs remain proportional in sequence headers and standalone glyphs', () => {
    for (const height of [60, 116]) {
        const bounds = { x: 10, y: 20, width: 100, height }, primitives = nodeGlyph('uml.actor', {}, bounds, { title: 'Actor', profile: 'uml.sequence@2' }), hip = `M60,${20 + height * .65}`;
        const legs = primitives.filter(primitive => primitive.kind === 'path' && primitive.d.startsWith(hip)); assert.equal(legs.length, 2);
        for (const leg of legs) { const [x,y] = leg.d.split('L')[1].split(',').map(Number); assert.ok(y - (20 + height * .65) >= height * .14); assert.ok(Math.abs(x - 60) >= 20); }
        const head = primitives.find(primitive => primitive.kind === 'ellipse').bounds, arms = primitives.find(primitive => primitive.kind === 'path' && primitive.d.startsWith('M36,')); const armY = Number(arms.d.split(',')[1].split('L')[0]); assert.ok(armY > head.y + head.height);
    }
});
test('shared-route edge labels avoid node glyphs and earlier labels without rewriting author routes', () => {
    const fixture = createGraphFixture('uml.structure@2');
    fixture.definitions.splice(0, fixture.definitions.length, { id: 'a', name: 'Source', category: 'element', role: 'uml.class' }, { id: 'b', name: 'Target', category: 'element', role: 'uml.component' }, ...[1,2,3].map(index => ({ id: 'edge-' + index, name: 'Shared route label ' + index, category: 'relation', role: 'uml.association', endpoints: [{ definition: { id: 'a' } }, { definition: { id: 'b' } }] })));
    fixture.view.selection.include = fixture.definitions.map(definition => ({ id: definition.id }));
    fixture.document.appearances = [1,2,3].map(index => ({ id: 'route-' + index, target: { id: 'edge-' + index }, parent: { id: fixture.view.id }, route: { via: [{ x: 306, y: 210 }, { x: 306, y: 240 }] } }));
    const first = render(fixture), second = render(fixture); assert.deepEqual(first, second, 'placement is deterministic');
    const nodes = first.entries.filter(entry => entry.definition.record.category !== 'relation'), edges = first.entries.filter(entry => entry.definition.record.category === 'relation'), labels = [];
    const overlaps = (a,b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    for (const edge of edges) {
        assert.match(edge.item.primitives[0].d, /L306,210L306,240/);
        const run = edge.item.primitives.find(primitive => primitive.kind === 'text').runs[0], size = run.style['font-size'], bounds = { x: run.x, y: run.y - size, width: run.text.length * size * .5, height: size + 3 };
        assert.ok(nodes.every(node => !overlaps(bounds,node.item.bounds)), 'label overlaps node glyph'); assert.ok(labels.every(other => !overlaps(bounds,other)), 'label overlaps earlier label'); labels.push(bounds);
        assert.ok(edge.item.bounds.x <= bounds.x && edge.item.bounds.y <= bounds.y && edge.item.bounds.x + edge.item.bounds.width >= bounds.x + bounds.width && edge.item.bounds.y + edge.item.bounds.height >= bounds.y + bounds.height, 'scene extent contains label');
    }
});
