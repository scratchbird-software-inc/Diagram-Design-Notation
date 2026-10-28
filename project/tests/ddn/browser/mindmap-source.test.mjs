import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const output = process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const load = file => import(pathToFileURL(resolve(output, 'ddn/packages', file)));
const { createRuntime, createNativeRuntimeOptions } = await load('runtime/src/native.js');
const { createNativeCommandPack, createCommandService } = await load('runtime/src/commands.js');
const { mindmapSource } = await load('designer/src/mindmap-source.js');
const { decodeSources } = await load('language/src/index.js');
const { listRecords } = await load('model/src/index.js');
const source = `// Before map stays exact.
mindmap Plan
    // Keep branch description.
    Research
        notes Memo : Interview notes
            First line **important**.

            New paragraph.
        Interviews
            with
                description "Ask useful questions."
    Delivery

// Following view stays exact.
erd Sales
    Customer
`;
async function fixture(text = source) {
    const options = createNativeRuntimeOptions(), runtime = createRuntime({ ...options, packs: [...options.packs, createNativeCommandPack()] });
    const opened = await runtime.open({ entry: 'main.ddn', files: [{ id: 'main.ddn', text, revision: 'one', encoding: 'utf-8', writable: true }] });
    assert.ok(opened.snapshot, JSON.stringify(opened.diagnostics));
    const all = listRecords(opened.snapshot.normalized), view = all.find(item => item.kind === 'view' && item.record.name === 'Plan');
    const root = all.find(item => item.kind === 'definition' && item.record.title === 'Plan');
    return { runtime, all, view, root };
}
test('compact mindmap materialization preserves identities, note bodies, other views and exact undo', async () => {
    const f = await fixture();
    try {
        const draft = mindmapSource(f.runtime, f.view.ref); draft.materialize();
        const all = listRecords(draft.decoded.normalized);
        for (const old of f.all) assert.ok(all.some(item => item.ref.file === old.ref.file && item.ref.id === old.ref.id), old.ref.id);
        assert.equal(draft.source.files[0].text.split('// Following view stays exact.')[1], source.split('// Following view stays exact.')[1]);
        assert.ok(draft.source.files[0].text.startsWith('// Before map stays exact.\n'));
        assert.match(draft.source.files[0].text, /Keep branch description/);
        const research = all.find(item => item.record.name === 'Research');
        assert.equal(research.record.notes[0].text, 'First line **important**.\n\nNew paragraph.');
        draft.set(f.root.ref, 'title', 'Revised central topic');
        const commands = createCommandService(f.runtime, { authorize: async () => ({ allowed: true, principal: 'test', grants: ['model.edit'] }) });
        const prepared = await commands.prepare({ kind: 'edit-source', patches: draft.patches() });
        assert.equal(prepared.ok, true, JSON.stringify(prepared));
        assert.equal((await commands.commit(prepared.command.id)).ok, true);
        assert.equal(f.runtime.snapshot().normalized.files[0].document.views.find(view => view.name === 'Plan').title, undefined);
        const reloaded = decodeSources(f.runtime.sources());
        const owned = f.all.filter(item => ['definition', 'appearance', 'note'].includes(item.kind) && item.record.name !== 'Customer' && item.record.target?.id !== f.all.find(item => item.record.name === 'Customer').ref.id);
        for (const old of owned) assert.ok(listRecords(reloaded.normalized).some(item => item.ref.id === old.ref.id), 'reloaded ' + old.ref.id);
        assert.equal((await commands.undo()).ok, true); assert.equal(f.runtime.sources().files[0].text, source);
    } finally { f.runtime.destroy(); }
});
test('an external view keeps its reference to the generated central topic after a fresh reload', async () => {
    const initial = await fixture(), id = initial.root.ref.id; initial.runtime.destroy();
    const appended = source + '\nview Related as ddn@1\n    use ' + id + '\n';
    const f = await fixture(appended);
    try {
        const draft = mindmapSource(f.runtime, f.view.ref); draft.materialize();
        const fresh = decodeSources(draft.source), all = listRecords(fresh.normalized), view = all.find(item => item.kind === 'view' && item.record.name === 'Related');
        assert.ok(all.some(item => item.ref.id === id && item.record.title === 'Plan'));
        assert.equal(view.record.selection.include[0].id, id);
        assert.equal(draft.source.files[0].text.split('// Following view stays exact.')[1], appended.split('// Following view stays exact.')[1]);
    } finally { f.runtime.destroy(); }
});
test('materialization is staged and denied edits leave compact source untouched', async () => {
    const f = await fixture();
    try {
        const draft = mindmapSource(f.runtime, f.view.ref); draft.materialize(); draft.set(f.root.ref, 'title', 'Denied');
        assert.equal(f.runtime.sources().files[0].text, source);
        const commands = createCommandService(f.runtime, { authorize: async () => ({ allowed: false, principal: 'readonly', grants: [] }) });
        const result = await commands.prepare({ kind: 'edit-source', patches: draft.patches() }); assert.equal(result.ok, false); assert.equal(result.failure.code, 'unauthorized');
        assert.equal(f.runtime.sources().files[0].text, source);
    } finally { f.runtime.destroy(); }
});
test('qualified references and new note names use the actual destination file', async () => {
    const options = createNativeRuntimeOptions(), runtime = createRuntime(options);
    try {
        const opened = await runtime.open({ entry: 'sub/map.ddn', files: [
            { id: 'sub/map.ddn', text: 'include "../topics.ddn"\nmindmap Plan\n    Local\n    use "../topics.ddn"::Shared\n    connect Local to "../topics.ddn"::Shared as assoc\n', revision: 'one', encoding: 'utf-8', writable: true },
            { id: 'topics.ddn', text: 'element Shared as object\nelement Note as object\nelement "mindmap-note" as object\n', revision: 'one', encoding: 'utf-8', writable: true },
        ] });
        assert.ok(opened.snapshot, JSON.stringify(opened.diagnostics));
        const all = listRecords(opened.snapshot.normalized), view = all.find(item => item.kind === 'view'), shared = all.find(item => item.record.name === 'Shared');
        const draft = mindmapSource(runtime, view.ref); assert.equal(draft.reference(shared.ref), '"../topics.ddn"::"Shared"');
        assert.equal(draft.unique('Note', shared.file), 'Note 2'); assert.equal(draft.unique('mindmap-note', shared.file), 'mindmap-note 2');
        draft.materialize(); assert.match(draft.source.files[0].text, /use "\.\.\/topics\.ddn"::"Shared"/);
        const fresh = decodeSources(draft.source); assert.ok(!fresh.diagnostics.some(item => item.code === 'reference.unresolved'), JSON.stringify(fresh.diagnostics));
    } finally { runtime.destroy(); }
});
