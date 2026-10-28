import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const output = process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const moduleAt = name => import(pathToFileURL(resolve(output, 'ddn/packages/' + name)));
const {createRuntime, createNativeRuntimeOptions, createCommandService} = await moduleAt('runtime/src/index.js');
const {sourcesForSave} = await moduleAt('runtime/src/save.js');
const {listRecords} = await moduleAt('model/src/index.js');

for (const [text, role] of [
    ['erd Sales\n    Customer\n    Order\n    connect Customer to Order\n', 'entity'],
    ['view Services as "ddn@1"\n', 'service'],
]) test(`named ${role} creation with a position commits atomically and survives save/reopen`, async () => {
    const runtime = createRuntime(createNativeRuntimeOptions());
    const reopened = createRuntime(createNativeRuntimeOptions());
    try {
        const opened = await runtime.open({entry: 'main.ddn', files: [{id: 'main.ddn', text, revision: 'initial', encoding: 'utf-8', writable: true}]});
        assert.ok(opened.snapshot, JSON.stringify(opened.diagnostics));
        const commands = createCommandService(runtime, {authorize: async () => ({allowed: true, principal: 'tester', grants: ['model.edit']})});
        const view = listRecords(runtime.snapshot().normalized).find(entry => entry.kind === 'view').ref;
        const position = {x: 149, y: 190};
        const prepared = await commands.prepare({kind: 'profile-command', profile: 'ddn@1', command: 'ddn.create-element', target: view, arguments: {view, role, name: 'PlacedItem', position}});
        assert.equal(prepared.ok, true, JSON.stringify(prepared));
        assert.equal(runtime.sources().files[0].text, text, 'preparation must not change the source');
        const committed = await commands.commit(prepared.command.id);
        assert.equal(committed.ok, true, JSON.stringify(committed));

        const placed = model => {
            const entries = listRecords(model);
            const definition = entries.find(entry => entry.kind === 'definition' && entry.record.name === 'PlacedItem');
            assert.ok(definition);
            const occurrences = entries.filter(entry => entry.kind === 'appearance' && entry.record.target?.id === definition.ref.id);
            assert.equal(occurrences.length, 1);
            assert.deepEqual(occurrences[0].record.position, position);
            assert.equal(definition.record.position, undefined, 'position belongs to the occurrence');
            return definition.ref.id;
        };
        const id = placed(runtime.snapshot().normalized);
        const createdSource = runtime.sources().files[0].text;
        assert.equal((await commands.undo()).ok, true);
        assert.equal(runtime.sources().files[0].text, text, 'one undo removes the element and its position');
        assert.equal(listRecords(runtime.snapshot().normalized).some(entry => entry.record.name === 'PlacedItem'), false);
        assert.equal((await commands.redo()).ok, true);
        assert.equal(runtime.sources().files[0].text, createdSource);
        assert.equal(placed(runtime.snapshot().normalized), id);

        const saved = await sourcesForSave(runtime);
        const result = await reopened.open(saved);
        assert.ok(result.snapshot, JSON.stringify(result.diagnostics));
        assert.equal(placed(result.snapshot.normalized), id);
    } finally {
        runtime.destroy();
        reopened.destroy();
    }
});
