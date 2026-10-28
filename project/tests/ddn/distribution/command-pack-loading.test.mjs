import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const output = process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const load = file => import(pathToFileURL(resolve(output, 'ddn/packages', file)));
const { createRuntime, createNativeRuntimeOptions } = await load('runtime/src/native.js');
const { createModularCommandPack, createCommandService } = await load('runtime/src/commands.js');
const { attachProfileLoadingHost } = await load('runtime/src/profile-loading.js');
const { loadedProfilePacks } = await load('profiles/src/family-packs.js');
const authority = { authorize: async () => ({ allowed: true, principal: 'local-test', grants: ['model.edit'] }) };
async function fixture() {
    const options = createNativeRuntimeOptions();
    const runtime = createRuntime({ ...options, packs: [...options.packs, createModularCommandPack()] });
    const opened = await runtime.open({ entry: 'main.ddn', files: [{ id: 'main.ddn', text: 'erd Sales\n    Customer\n', revision: '1', encoding: 'utf-8', writable: true }] });
    assert.ok(opened.snapshot, JSON.stringify(opened.diagnostics));
    const document = runtime.snapshot().normalized.files[0].document;
    const target = { file: 'main.ddn', id: document.workarea?.id ?? document.views[0].id };
    return { runtime, target, commands: createCommandService(runtime, authority) };
}
test('adding a view loads its argument profile before capturing command dependencies', async () => {
    const f = await fixture(), requested = [];
    try {
        attachProfileLoadingHost(f.runtime, { profiles: [], ensure: async profiles => {
            requested.push(...profiles);
            if (profiles.includes('uml.structure@2')) {
                await load('profiles/src/families/graphs.js');
                f.runtime.registry.install(loadedProfilePacks().find(pack => pack.manifest.id === 'ddn-graphs'));
            }
        } });
        const prepared = await f.commands.prepare({ kind: 'profile-command', profile: 'ddn@1', command: 'ddn.add-view', target: f.target, arguments: { name: 'Structure', profile: 'uml.structure@2', subtype: [] } });
        assert.ok(requested.includes('uml.structure@2'));
        assert.equal(prepared.ok, true, JSON.stringify(prepared));
        const committed = await f.commands.commit(prepared.command.id);
        assert.equal(committed.ok, true, JSON.stringify(committed));
        assert.ok(f.runtime.snapshot().normalized.files[0].document.views.some(view => view.profile === 'uml.structure@2'));
    } finally { f.runtime.destroy(); }
});
test('command budget includes time waiting for an optional profile pack', async () => {
    const f = await fixture(), revision = f.runtime.snapshot().revision;
    try {
        attachProfileLoadingHost(f.runtime, { profiles: [], ensure: () => new Promise(resolve => setTimeout(resolve, 25)) });
        const result = await f.commands.prepare({ kind: 'profile-command', profile: 'ddn@1', command: 'ddn.add-view', target: f.target, arguments: { name: 'Another', profile: 'ddn@1', subtype: [] } }, { budget: { elapsedMs: 5, workUnits: 1000000, memoryBytes: 100000000 } });
        assert.equal(result.ok, false);
        assert.equal(result.failure.code, 'budget-exceeded');
        assert.deepEqual(f.runtime.snapshot().revision, revision);
    } finally { f.runtime.destroy(); }
});
