import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const build = process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const load = file => import(pathToFileURL(resolve(build, 'ddn/packages', file)));
const { createRuntime, createNativeRuntimeOptions } = await load('runtime/src/native.js');
const { decodeSources } = await load('language/src/index.js');
const { indexRecords, getProfile, profileDescriptor } = await load('profiles/src/core.js');
const { codex } = await load('profiles/src/schema-core.js');
const { isMindmapTopic, mindmapKey, mindmapRelationKind } = await load('profiles/src/mindmap.js');
const source = text => ({ entry: 'main.ddn', files: [{ id: 'main.ddn', text, revision: '1', encoding: 'utf-8', writable: true }] });
async function verify(text) {
    const runtime = createRuntime(createNativeRuntimeOptions());
    try { return await runtime.verifier.verifySources(source(text), { scope: { kind: 'workarea' }, purpose: 'design', level: 'semantic' }); }
    finally { runtime.destroy(); }
}
const diagram = (body, outside = '') => outside + 'view Ideas as mindmap.basic@1\n' + body.split('\n').filter(Boolean).map(line => '    ' + line + '\n').join('');
const topics = 'element Centre as object\nelement Branch as term\n';
const valid = report => assert.equal(report.outcome, 'valid', JSON.stringify(report.diagnostics));
const invalid = (report, code) => { assert.equal(report.outcome, 'invalid', JSON.stringify(report.diagnostics)); assert.ok(report.diagnostics.some(d => d.code === code), JSON.stringify(report.diagnostics)); };

test('mind-map classification is local to selected topic definitions and preserves unresolved endpoints', () => {
    const record = (id, role, file = 'main.ddn') => ({ file, ref: { id }, record: { role, category: 'element' } });
    const root = record('root', 'object'), child = record('child', 'term'), external = record('child', 'object', 'other.ddn'), context = record('api', 'api');
    const selected = new Set([root, child].map(mindmapKey));
    for (const role of ['domain', 'entity', 'object', 'term']) assert.equal(isMindmapTopic({ role }), true);
    assert.equal(isMindmapTopic({ role: 'object', category: 'relation' }), false);
    assert.equal(isMindmapTopic(context.record), false);
    assert.equal(mindmapRelationKind(root, child, selected), 'internal');
    assert.equal(mindmapRelationKind(root, context, selected), 'external');
    assert.equal(mindmapRelationKind(root, external, selected), 'external');
    assert.equal(mindmapRelationKind(context, external, selected), 'unrelated');
    assert.equal(mindmapRelationKind(root, undefined, selected), 'unresolved');
});

test('mind-map external palette and endpoint contracts are resolved from DDN without duplicated catalogue payloads', () => {
    const raw = codex.profiles['mindmap.basic@1'], profile = getProfile('mindmap.basic@1'), ddn = getProfile('ddn@1');
    assert.equal(raw.external_context_profile, 'ddn@1');
    assert.equal(raw.external_relation_profile, 'ddn@1');
    assert.deepEqual(raw.relation_roles, ['assoc']);
    assert.deepEqual(raw.context_roles, []);
    assert.deepEqual(profile.primary_palette, raw.primary_palette);
    assert.ok(profile.context_roles.includes('service'));
    assert.ok(profile.relation_roles.includes('uses'));
    assert.equal(profile.relation_endpoint_contracts.find(contract => contract.role === 'uses'), ddn.relation_endpoint_contracts.find(contract => contract.role === 'uses'));
    assert.ok(profileDescriptor(profile.id).roles.includes('service'));
    assert.ok(profileDescriptor(profile.id).relations.includes('uses'));
    assert.equal(getProfile(profile.id), profile);
    assert.ok(Object.isFrozen(profile));
    assert.ok(Object.isFrozen(profile.context_roles));
});

test('one root and one incoming internal relationship per child verify successfully', async () => {
    const report = await verify(diagram(topics + 'connect Centre to Branch as assoc\n'));
    valid(report);
    assert.equal(report.ruleVersions['ddn.native.mindmap.basic@1'], '1.0.1');
    const rules = createNativeRuntimeOptions().packs.flatMap(pack => pack.registrations.rules ?? []);
    assert.ok(rules.filter(rule => rule.id !== 'ddn.native.mindmap.basic@1').every(rule => rule.version === '1.0.0'));
});

test('two incoming relationships from the same parent are rejected as distinct relationships', async () => {
    const text = diagram(topics + 'connect Centre to Branch as assoc named First\nconnect Centre to Branch as assoc named Second\n');
    const report = await verify(text);
    invalid(report, 'DDN-MINDMAP-PARENT');
    assert.equal(report.diagnostics.filter(d => d.code === 'DDN-MINDMAP-PARENT').length, 1);
    assert.deepEqual(report.diagnostics.find(d => d.code === 'DDN-MINDMAP-PARENT').target,
        indexRecords(decodeSources(source(text)).normalized).find(r => r.record.name === 'Branch').ref);
});

test('two different parents cannot attach to the same mind-map child', async () => {
    invalid(await verify(diagram(topics + 'element Other as object\nconnect Centre to Branch as assoc\nconnect Centre to Other as assoc\nconnect Other to Branch as assoc\n')), 'DDN-MINDMAP-PARENT');
});

test('repeated appearances of one relation do not create a second parent', async () => {
    valid(await verify(diagram(topics + 'connect Centre to Branch as assoc named Parent\nuse Parent named AlsoVisible\n')));
});

test('cycles and self connections remain invalid mind-map topology', async () => {
    invalid(await verify(diagram(topics + 'connect Centre to Branch as assoc\nconnect Branch to Centre as assoc\n')), 'DDN-MINDMAP-CYCLE');
    invalid(await verify(diagram('element Centre as object\nconnect Centre to Centre as assoc\n')), 'DDN-MINDMAP-CYCLE');
});

test('an internal relation must be assoc even when another DDN relation accepts those roles', async () => {
    invalid(await verify(diagram(topics + 'connect Centre to Branch as uses\n')), 'DDN-PROFILE-RELATION');
});

test('an incoming external link to the centre does not change the internal root or create a tree cycle', async () => {
    valid(await verify(diagram(topics + 'element Service as service\nconnect Centre to Branch as assoc\nconnect Branch to Service as uses\nconnect Service to Centre as depends\n')));
});

test('a concept-family definition outside this view is external context rather than an internal tree parent', async () => {
    valid(await verify(diagram(topics + 'connect Centre to Branch as assoc\nconnect Elsewhere to Centre as depends\n', 'element Elsewhere as object\n')));
});

test('the single incoming relationship limit includes external links', async () => {
    invalid(await verify(diagram(topics + 'element Service as service\nconnect Centre to Branch as assoc\nconnect Service to Branch as depends\n')), 'DDN-MINDMAP-PARENT');
    invalid(await verify(diagram(topics + 'element Service as service\nelement Other as service\nconnect Centre to Branch as assoc\nconnect Service to Centre as depends\nconnect Other to Centre as depends\n')), 'DDN-MINDMAP-PARENT');
});

test('foreign context still requires legal known DDN relation endpoints', async () => {
    invalid(await verify(diagram(topics + 'element Service as service\nconnect Centre to Branch as assoc\nconnect Branch to Service as flow\n')), 'DDN-RELATION-ENDPOINT');
});

test('unlinked foreign elements and links wholly outside the topic tree remain invalid', async () => {
    invalid(await verify(diagram(topics + 'element Service as service\nconnect Centre to Branch as assoc\n')), 'DDN-PROFILE-ROLE');
    invalid(await verify(diagram(topics + 'element Service as service\nelement Other as service\nconnect Centre to Branch as assoc\nconnect Centre to Service as assoc\nconnect Service to Other as assoc\n')), 'DDN-MINDMAP-CONTEXT');
});

test('unknown relation names cannot bypass mind-map context verification', async () => {
    const report = await verify(diagram(topics + 'element Service as service\nconnect Centre to Branch as assoc\nconnect Branch to Service as madeup\n'));
    assert.notEqual(report.outcome, 'valid');
    assert.equal(report.reviewEligible, false);
});

test('mind-map topic endpoints reject authored top and bottom attachment sides', async () => {
    for (const property of ['source_side', 'target_side']) for (const side of ['north', 'south']) {
        invalid(await verify(diagram(topics + 'connect Centre to Branch as assoc named Parent\nuse Parent named Routed\n    with\n        route.' + property + ' ' + side + '\n')), 'DDN-MINDMAP-ATTACHMENT');
    }
    valid(await verify(diagram(topics + 'connect Centre to Branch as assoc named Parent\nuse Parent named Routed\n    with\n        route.source_side east\n        route.target_side west\n        route.routing curved\n')));
});

test('external relation side constraints apply to the topic endpoint and preserve foreign endpoint rules', async () => {
    const body = topics + 'element Service as service\nconnect Centre to Branch as assoc\nconnect Branch to Service as uses named External\nuse External named Routed\n    with\n';
    invalid(await verify(diagram(body + '        route.source_side north\n')), 'DDN-MINDMAP-ATTACHMENT');
    valid(await verify(diagram(body + '        route.source_side east\n        route.target_side north\n')));
});

test('the unique centre may receive one external relationship at its top or bottom', async () => {
    for (const side of ['north', 'south']) {
        valid(await verify(diagram(topics + 'element Service as service\nconnect Centre to Branch as assoc\nconnect Service to Centre as depends named External\nuse External named Routed\n    with\n        route.target_side ' + side + '\n')));
        invalid(await verify(diagram(topics + 'element Service as service\nconnect Centre to Branch as assoc\nconnect Centre to Service as uses named External\nuse External named Routed\n    with\n        route.source_side ' + side + '\n')), 'DDN-MINDMAP-ATTACHMENT');
    }
});

test('the centre attachment exception neither applies to a child nor permits two incoming relationships', async () => {
    const child = await verify(diagram(topics + 'element Service as service\nconnect Centre to Branch as assoc\nconnect Service to Branch as depends named External\nuse External named Routed\n    with\n        route.target_side north\n'));
    invalid(child, 'DDN-MINDMAP-ATTACHMENT');
    invalid(child, 'DDN-MINDMAP-PARENT');
    invalid(await verify(diagram(topics + 'element Service as service\nelement Other as service\nconnect Centre to Branch as assoc\nconnect Service to Centre as depends named First\nconnect Other to Centre as depends named Second\nuse First named Top\n    with\n        route.target_side north\nuse Second named Bottom\n    with\n        route.target_side south\n')), 'DDN-MINDMAP-PARENT');
});

test('internal mind-map relations reject straight routing on the view or occurrence', async () => {
    invalid(await verify(diagram('with\n    layout.routing straight\n' + topics + 'connect Centre to Branch as assoc\n')), 'DDN-MINDMAP-ROUTING');
    invalid(await verify(diagram(topics + 'connect Centre to Branch as assoc named Parent\nuse Parent named Routed\n    with\n        route.routing straight\n')), 'DDN-MINDMAP-ROUTING');
});

test('an excluded relation does not impose attachment rules on the active mind-map view', async () => {
    valid(await verify(diagram('with\n    selection.exclude\n        item External\nelement Centre as object\nconnect Centre to Service as assoc named External\nuse External named Routed\n    with\n        route.source_side north\n', 'element Service as service\n')));
});

test('document-scoped verification applies mind-map rules to included views and nested documents', async () => {
    const runtime = createRuntime(createNativeRuntimeOptions());
    try {
        for (const broken of [
            topics + 'connect Centre to Branch as assoc named First\nconnect Centre to Branch as assoc named Second\n',
            topics + 'connect Centre to Branch as assoc named Parent\nuse Parent named Routed\n    with\n        route.target_side north\n',
        ]) {
            const opened = await runtime.open(source(diagram(broken) + 'document Inner as pdf\n    use Ideas\ndocument Report as pdf\n    use Inner\n'));
            assert.ok(opened.snapshot, JSON.stringify(opened.diagnostics));
            const records = indexRecords(opened.snapshot.normalized), report = records.find(item => item.owner === 'document' && item.record.name === 'Report');
            const result = await runtime.verifier.verifyModel(opened.snapshot, { scope: { kind: 'document', target: report.ref }, purpose: 'design', level: 'semantic' });
            invalid(result, broken.includes('route.') ? 'DDN-MINDMAP-ATTACHMENT' : 'DDN-MINDMAP-PARENT');
            assert.equal(result.ruleVersions['ddn.native.mindmap.basic@1'], '1.0.1');
        }
    } finally { runtime.destroy(); }
});

test('a valid document checks only its included mind map and excludes an unrelated invalid map', async () => {
    const runtime = createRuntime(createNativeRuntimeOptions());
    try {
        const text = diagram(topics + 'connect Centre to Branch as assoc\n') + 'view Broken as mindmap.basic@1\n    element One as object\n    element Two as object\ndocument Report as pdf\n    use Ideas\n';
        const opened = await runtime.open(source(text)); assert.ok(opened.snapshot, JSON.stringify(opened.diagnostics));
        const report = indexRecords(opened.snapshot.normalized).find(item => item.owner === 'document' && item.record.name === 'Report');
        valid(await runtime.verifier.verifyModel(opened.snapshot, { scope: { kind: 'document', target: report.ref }, purpose: 'design', level: 'semantic' }));
        invalid(await runtime.verifier.verifyModel(opened.snapshot, { scope: { kind: 'workarea' }, purpose: 'design', level: 'semantic' }), 'DDN-MINDMAP-ROOT');
    } finally { runtime.destroy(); }
});
