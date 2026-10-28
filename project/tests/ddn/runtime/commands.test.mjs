import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const { createRuntime, createNativeRuntimeOptions, createCommandService } = await import(pathToFileURL(resolve(output, 'ddn/packages/runtime/src/index.js')));
const { listRecords } = await import(pathToFileURL(resolve(output, 'ddn/packages/model/src/index.js')));
const allGrants = ['model.edit', 'lifecycle.review', 'lifecycle.accept', 'lifecycle.reopen'];
const source = text => ({ entry: 'main.ddn', files: [{ id: 'main.ddn', text, revision: 'initial', encoding: 'utf-8', writable: true }] });
async function setup(text = 'erd Sales\n    Customer\n    Order\n    connect Customer to Order\n', authority) {
    const runtime = createRuntime(createNativeRuntimeOptions());
    const opened = await runtime.open(source(text));
    assert.ok(opened.snapshot, JSON.stringify(opened.diagnostics));
    const commands = createCommandService(runtime, authority ?? { authorize: async action => ({ allowed: allGrants.includes(action), principal: 'tester', grants: allGrants }) });
    const named = name => listRecords(runtime.snapshot().normalized).find(entry => entry.record.name === name);
    return { runtime, commands, named };
}
async function apply(commands, intent) {
    const prepared = await commands.prepare(intent);
    assert.equal(prepared.ok, true, JSON.stringify(prepared));
    const committed = await commands.commit(prepared.command.id);
    assert.equal(committed.ok, true, JSON.stringify(committed));
    return committed;
}
const native = (command, target, args) => ({ kind: 'profile-command', command, profile: 'ddn@1', target, arguments: args });

test('native progressive ERD retains draft, exposes details, reuses domains and round trips source history', async () => {
    const { runtime, commands, named } = await setup();
    const target = named('Customer').ref;
    const original = runtime.sources().files[0].text;
    const originalSnapshot = runtime.snapshot();
    const prepared = await commands.prepare(native('ddn.set-draft', target, { text: 'identifier\nfull name\nnotes', format: 'text' }));
    assert.equal(prepared.ok, true, JSON.stringify(prepared));
    assert.equal(runtime.snapshot(), originalSnapshot);
    assert.equal(runtime.sources().files[0].text, original);
    assert.equal((await commands.commit(prepared.command.id)).ok, true);
    await apply(commands, { kind: 'convert-body', target, interpretation: 'field-list' });
    let entity = named('Customer').record;
    assert.equal(entity.draft.text, 'identifier\nfull name\nnotes');
    assert.deepEqual(entity.data.columns.map(column => column.id), ['field', 'type', 'domain', 'constraint', 'key', 'comment']);
    assert.deepEqual(entity.data.rows[0], ['identifier', null, null, null, null, null]);
    const convertedReview=await runtime.verifier.verifyModel(runtime.snapshot(),{scope:{kind:'item',target},purpose:'review',level:'review'});
    assert.equal(convertedReview.reviewEligible,true,JSON.stringify(convertedReview.diagnostics));
    await apply(commands, native('ddn.set-cell', target, { row: 0, column: 'domain', value: 'Identifier' }));
    assert.equal(named('Identifier').record.role, 'domain');
    await apply(commands, native('ddn.set-cell', target, { row: 1, column: 'domain', value: 'Identifier' }));
    assert.equal(listRecords(runtime.snapshot().normalized).filter(entry => entry.record.name === 'Identifier').length, 1);
    const beforeTitle = runtime.sources().files[0].text;
    await apply(commands, { kind: 'set-property', target, path: 'title', value: 'Customer records' });
    assert.equal(named('Customer').record.title, 'Customer records');
    assert.equal((await commands.undo()).ok, true);
    assert.equal(runtime.sources().files[0].text, beforeTitle);
    assert.equal((await commands.redo()).ok, true);
    assert.equal(named('Customer').record.title, 'Customer records');
    runtime.destroy();
});

test('commands preserve BOM, CRLF, comments and untouched files and reject unknown source patches', async () => {
    const text = '\uFEFF// retained comment\r\nerd Sales\r\n    Customer\r\n    // trailing note\r\n';
    const { runtime, commands, named } = await setup(text);
    await apply(commands, { kind: 'set-property', target: named('Customer').ref, path: 'title', value: 'Display title' });
    const edited = runtime.sources().files[0].text;
    assert.ok(edited.startsWith('\uFEFF// retained comment\r\n'));
    assert.ok(edited.includes('// trailing note\r\n'));
    assert.equal(edited.replaceAll('\r\n', '').includes('\n'), false);
    const before = runtime.snapshot();
    const bad = await commands.prepare({ kind: 'edit-source', patches: [{ file: 'missing.ddn', base: 'initial', start: 0, end: 0, text: 'erd Lost' }] });
    assert.equal(bad.ok, false);
    assert.equal(runtime.snapshot(), before);
    runtime.destroy();
});

test('revoked authority and stale prepared revisions cannot commit or change history', async () => {
    let allowed = true;
    const { runtime, commands, named } = await setup(undefined, { authorize: async () => ({ allowed, principal: 'tester', grants: allGrants }) });
    const intent = { kind: 'set-property', target: named('Customer').ref, path: 'title', value: 'Changed' };
    const prepared = await commands.prepare(intent);
    assert.equal(prepared.ok, true);
    const before = runtime.snapshot(); allowed = false;
    assert.equal((await commands.commit(prepared.command.id)).failure.code, 'unauthorized');
    assert.equal(runtime.snapshot(), before);
    allowed = true;
    await apply(commands, { ...intent, value: 'Concurrent change' });
    assert.equal((await commands.commit(prepared.command.id)).failure.code, 'conflict');
    assert.equal(named('Customer').record.title, 'Concurrent change');
    runtime.destroy();
});

test('source and property routes cannot manufacture accepted state or acceptance history', async () => {
    const { runtime, commands, named } = await setup();
    for (const properties of [{ acceptance: { at: '2026-10-23T12:00:00Z', by: 'forged' } }, { design: { state: 'accepted' } }, { id: 'forged' }]) {
        const result = await commands.prepare({ kind: 'create-definition', file: 'main.ddn', role: 'entity', properties });
        assert.equal(result.ok, false, JSON.stringify(result));
    }
    const file = runtime.sources().files[0];
    const tampered = file.text + 'element Forged as entity\n    with\n        design.state "accepted"\n        acceptance\n            at "2026-10-23T12:00:00Z"\n            by "forged"\n';
    const result = await commands.prepare({ kind: 'edit-source', patches: [{ file: file.id, base: file.revision, start: 0, end: file.text.length, text: tampered }] });
    assert.equal(result.ok, false);
    assert.equal(named('Forged'), undefined);
    assert.equal(runtime.sources().files[0].text, file.text);
    runtime.destroy();
});

test('review and acceptance enforce lifecycle, protect transitive definitions and preserve reopening history', async () => {
    const { runtime, commands, named } = await setup();
    const view = named('Sales').ref;
    await apply(commands, { kind: 'status', transition: { target: view, from: 'draft', to: 'in-progress', grants: [] } });
    const review = () => runtime.verifier.verifyModel(runtime.snapshot(), { scope: { kind: 'view', target: view }, purpose: 'review', level: 'review' });
    let report = await review();
    assert.equal(report.reviewEligible, true, JSON.stringify(report.diagnostics));
    await apply(commands, { kind: 'status', transition: { target: view, from: 'in-progress', to: 'in-review', grants: [], report } });
    report = await review();
    await apply(commands, { kind: 'status', transition: { target: view, from: 'in-review', to: 'accepted', grants: [], report, acceptance: { user: 'tester', timestamp: '2026-10-23T12:00:00Z', authorityContext: 'local' } } });
    assert.equal(named('Sales').record.acceptance.by, 'tester');
    const blocked = await commands.prepare({ kind: 'rename', target: named('Customer').ref, name: 'ChangedEntity' });
    assert.equal(blocked.ok, false);
    assert.ok(blocked.failure.diagnostics.some(d => d.code.includes('protected')));
    await apply(commands, { kind: 'status', transition: { target: view, from: 'accepted', to: 'in-progress', grants: [] } });
    assert.equal(named('Sales').record.acceptance, undefined);
    assert.equal(named('Sales').record.acceptance_history.length, 1);
    await apply(commands, { kind: 'rename', target: named('Customer').ref, name: 'ChangedEntity' });
    runtime.destroy();
});

test('native commands require registered descriptors and validate their argument contracts', async () => {
    const { runtime, commands, named } = await setup();
    for (const args of [{ x: 1 }, { x: 1, y: 2, hidden: true }, { x: '1', y: 2 }]) {
        const result = await commands.prepare(native('ddn.set-position', named('Customer').ref, args));
        assert.equal(result.ok, false);
    }
    const file = runtime.sources();
    const plain = createRuntime({ ...createNativeRuntimeOptions(), packs: createNativeRuntimeOptions().packs.slice(0, 1) });
    await plain.open(file);
    const limited = createCommandService(plain, { authorize: async () => ({ allowed: true, principal: 'tester', grants: allGrants }) });
    assert.equal((await limited.prepare(native('ddn.set-draft', named('Customer').ref, { text: 'No registered editor' }))).failure.code, 'unsupported');
    runtime.destroy(); plain.destroy();
});

test('changed registered rules invalidate prepared edits before any source mutation', async () => {
    const { runtime, commands, named } = await setup();
    const prepared = await commands.prepare({ kind: 'set-property', target: named('Customer').ref, path: 'title', value: 'Prepared before new policy' });
    assert.equal(prepared.ok, true);
    const before = runtime.snapshot();
    runtime.registry.install({ manifest: { id: 'review-policy', version: '1', api: '1.0', hash: 'test-policy-v1', languages: ['ddn-next-1'], defaults: ['ddn-next-1'], profiles: ['ddn@1'], dependencies: ['ddn-native'], capabilities: [] }, registrations: { rules: [{ id: 'reject-title', version: '1', profiles: ['ddn@1'], levels: ['semantic'], purposes: ['*'], readPaths: ['title'], globalScope: true, async evaluate(input, options) { return { outcome: 'invalid', diagnostics: [{ code: 'policy.reject', message: 'Rejected by newly installed policy', severity: 'error' }], dependencies: [], coverage: { scope: options.scope, complete: true, checked: [], unavailable: [] } }; } }] } });
    const result = await commands.commit(prepared.command.id);
    assert.equal(result.ok, false);
    assert.equal(result.failure.code, 'conflict');
    assert.equal(runtime.snapshot(), before);
    runtime.destroy();
});

test('deletion follows typed references and never treats arbitrary JSON cells as references', async () => {
    const { runtime, commands, named } = await setup();
    await apply(commands, { kind: 'create-definition', file: 'main.ddn', role: 'object', properties: { name: 'Independent', data: { columns: [{ id: 'payload' }], rows: [[{ name: 'Customer' }]] } } });
    await apply(commands, { kind: 'remove', target: named('Customer').ref, references: 'remove-dependents' });
    assert.equal(named('Customer'), undefined);
    assert.ok(named('Independent'));
    assert.equal(listRecords(runtime.snapshot().normalized).filter(entry => entry.record.category === 'relation').length, 0);
    runtime.destroy();
});

test('unnamed progressive entities can be connected and reused after saving and reopening', async () => {
    const { runtime, commands, named } = await setup();
    await apply(commands, native('ddn.create-element', named('Sales').ref, { view: named('Sales').ref, role: 'entity' }));
    const unnamed = listRecords(runtime.snapshot().normalized).find(entry => entry.kind === 'definition' && entry.record.role === 'entity' && !entry.record.name);
    assert.ok(unnamed);
    await apply(commands, { kind: 'connect', view: named('Sales').ref, from: unnamed.ref, to: named('Order').ref });
    await apply(commands, { kind: 'create-occurrence', view: named('Sales').ref, target: unnamed.ref, properties: { position: { x: 50, y: 300 } } });
    const fresh = createRuntime(createNativeRuntimeOptions());
    const opened = await fresh.open(runtime.sources());
    assert.ok(opened.snapshot, JSON.stringify(opened.diagnostics));
    const verified = await fresh.verifier.verifyModel(fresh.snapshot(), { scope: { kind: 'workarea' }, purpose: 'design', level: 'semantic' });
    assert.equal(verified.diagnostics.some(d => d.severity === 'error'), false, JSON.stringify(verified.diagnostics));
    runtime.destroy(); fresh.destroy();
});

test('editing authority is requested for the actual affected references rather than an empty global scope', async () => {
    const scopes = [];
    const { runtime, commands, named } = await setup(undefined, { authorize: async (_action, scope) => { scopes.push(scope); return { allowed: scope.length > 0, principal: 'scoped-editor', grants: ['model.edit'] }; } });
    await apply(commands, { kind: 'set-property', target: named('Customer').ref, path: 'title', value: 'Scoped title' });
    assert.ok(scopes.length >= 2);
    assert.ok(scopes.every(scope => scope.length > 0));
    runtime.destroy();
});
test('connect can bind a specific named occurrence and source reload preserves that choice', async () => {
    const { runtime, commands, named } = await setup('erd Sales\n    Customer\n    Order\n    use Customer named CustomerAgain\n');
    await apply(commands, { kind: 'connect', view: named('Sales').ref, from: named('CustomerAgain').ref, to: named('Order').ref, relation: 'assoc' });
    const relation = listRecords(runtime.snapshot().normalized).find(entry => entry.record.category === 'relation').record;
    assert.equal(relation.endpoints[0].definition.id, named('Customer').ref.id);
    const route = listRecords(runtime.snapshot().normalized).find(entry => entry.kind === 'appearance' && entry.record.target.id === relation.id).record.route;
    assert.equal(route.from.id, named('CustomerAgain').ref.id);
    const fresh = createRuntime(createNativeRuntimeOptions());
    const reopened = await fresh.open(runtime.sources());
    assert.ok(reopened.snapshot, JSON.stringify(reopened.diagnostics));
    const records = listRecords(reopened.snapshot.normalized);
    const again = records.find(entry => entry.record.name === 'CustomerAgain');
    const reloadedRelation = records.find(entry => entry.record.category === 'relation');
    assert.equal(records.find(entry => entry.kind === 'appearance' && entry.record.target.id === reloadedRelation.ref.id).record.route.from.id, again.ref.id);
    fresh.destroy(); runtime.destroy();
});

test('native note edits preserve individual note identities and sibling raw text', async () => {
    const { runtime, commands, named } = await setup('erd Sales\n    Customer\n        notes First : First heading\n            Original paragraph\n\n        notes Second : Second heading\n            Keep this exact paragraph\n');
    const first = named('First').ref, second = named('Second').ref;
    await apply(commands, native('ddn.set-note', first, { text: '**Edited paragraph**\n\nAnother paragraph' }));
    assert.equal(named('First').ref.id, first.id);
    assert.equal(named('First').record.text, '**Edited paragraph**\n\nAnother paragraph');
    assert.equal(named('Second').ref.id, second.id);
    assert.equal(named('Second').record.text, 'Keep this exact paragraph');
    assert.match(runtime.sources().files[0].text, /notes First : First heading/);
    await apply(commands, native('ddn.add-note', named('Customer').ref, { text: 'New independent note' }));
    assert.equal(named('Customer').record.notes.length, 3);
    runtime.destroy();
});
