import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const output = process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const load = file => import(pathToFileURL(resolve(output, 'ddn/packages', file)));
const {createRuntime, createCompleteRuntimeOptions, createCommandService} = await load('runtime/src/index.js');
const {reflowViewPatches} = await load('runtime/src/layout-edit.js');
const {sourcesForSave} = await load('runtime/src/save.js');
const {listRecords, resolveReference} = await load('model/src/index.js');
const grants = {authorize: async () => ({allowed: true, principal: 'tester', grants: ['model.edit']})};
const source = text => ({entry: 'main.ddn', files: [{id: 'main.ddn', text, revision: 'initial', encoding: 'utf-8', writable: true}]});
const org = 'view Org as org.tree@1\n    element Parent as organization\n';
async function setup(input = source(org), authority = grants) {
    const runtime = createRuntime(createCompleteRuntimeOptions());
    const opened = await runtime.open(input);
    assert.ok(opened.snapshot, JSON.stringify(opened.diagnostics));
    const entries = () => listRecords(runtime.snapshot().normalized);
    const named = name => entries().find(entry => entry.record.name === name);
    const occurrence = (name, view = 'Org') => entries().find(entry => entry.kind === 'appearance' &&
        resolveReference(runtime.snapshot().normalized, entry.file, entry.record.target)?.record.name === name &&
        resolveReference(runtime.snapshot().normalized, entry.file, entry.record.parent)?.record.name === view);
    const commands = createCommandService(runtime, authority);
    return {runtime, entries, named, occurrence, commands};
}
async function apply(commands, intent) {
    const prepared = await commands.prepare(intent); assert.equal(prepared.ok, true, JSON.stringify(prepared));
    const result = await commands.commit(prepared.command.id); assert.equal(result.ok, true, JSON.stringify(result));
    return result;
}
async function drop(fixture, name = 'Dropped') {
    const view = fixture.named('Org').ref;
    await apply(fixture.commands, {kind: 'profile-command', profile: 'org.tree@1', command: 'ddn.create-element', target: view, arguments: {view, role: 'organization', name, position: {x: 781, y: 402}}});
}
const connect = fixture => ({kind: 'connect', view: fixture.named('Org').ref, from: fixture.named('Parent').ref, to: fixture.named('Dropped').ref, relation: 'reports_to'});

test('dropped position survives save/reopen and first connection releases it in one undoable edit', async () => {
    const original = await setup(); let fixture = original;
    try {
        await drop(original);
        assert.deepEqual(original.occurrence('Dropped').record.position, {x: 781, y: 402});
        assert.equal(original.occurrence('Dropped').record.pinned, false);
        fixture = await setup(await sourcesForSave(original.runtime));
        const before = fixture.runtime.sources().files[0].text;
        await apply(fixture.commands, connect(fixture));
        assert.equal(fixture.occurrence('Dropped').record.position, undefined);
        assert.equal(fixture.occurrence('Dropped').record.pinned, undefined);
        assert.equal(fixture.entries().filter(entry => entry.record.category === 'relation').length, 1);
        const after = fixture.runtime.sources().files[0].text;
        assert.equal((await fixture.commands.undo()).ok, true);
        assert.equal(fixture.runtime.sources().files[0].text, before);
        assert.deepEqual(fixture.occurrence('Dropped').record.position, {x: 781, y: 402});
        assert.equal((await fixture.commands.redo()).ok, true);
        assert.equal(fixture.runtime.sources().files[0].text, after);
    } finally {original.runtime.destroy(); if (fixture !== original) fixture.runtime.destroy();}
});

test('moving a provisional drop keeps it provisional while manually moved existing items stay pinned', async () => {
    const f = await setup();
    try {
        await drop(f);
        for (const name of ['Parent', 'Dropped']) await apply(f.commands, {kind: 'profile-command', profile: 'org.tree@1', command: 'ddn.set-position', target: f.occurrence(name).ref, arguments: {x: 122, y: 237}});
        assert.equal(f.occurrence('Parent').record.pinned, true);
        assert.equal(f.occurrence('Dropped').record.pinned, false);
        await apply(f.commands, connect(f));
        assert.equal(f.occurrence('Dropped').record.position, undefined);
        assert.deepEqual(f.occurrence('Parent').record.position, {x: 122, y: 237});
        assert.equal(f.occurrence('Parent').record.pinned, true);
    } finally {f.runtime.destroy();}
});

test('a rejected or unauthorized connection never releases the drop position', async () => {
    const f = await setup();
    try {
        await drop(f);
        const before = f.runtime.sources().files[0].text;
        const invalid = await f.commands.prepare({...connect(f), relation: 'flow.next'});
        assert.equal(invalid.ok, false);
        assert.equal(f.runtime.sources().files[0].text, before);
        const denied = createCommandService(f.runtime, {authorize: async () => ({allowed: false, principal: 'reader', grants: []})});
        assert.equal((await denied.prepare(connect(f))).ok, false);
        assert.equal(f.runtime.sources().files[0].text, before);
    } finally {f.runtime.destroy();}
});

test('connecting a provisional drop in a manual view enables the profile layout without unpinning existing items', async () => {
    const f = await setup(source(org.replace('    element', '    with\n        layout.algorithm manual\n    element')));
    try {
        await apply(f.commands, {kind: 'profile-command', profile: 'org.tree@1', command: 'ddn.set-position', target: f.occurrence('Parent').ref, arguments: {x: 35, y: 99}});
        await drop(f);
        await apply(f.commands, connect(f));
        assert.equal(f.named('Org').record.layout.algorithm, 'tree');
        assert.equal(f.occurrence('Dropped').record.position, undefined);
        assert.deepEqual(f.occurrence('Parent').record.position, {x: 35, y: 99});
        assert.equal(f.occurrence('Parent').record.pinned, true);
    } finally {f.runtime.destroy();}
});

test('connecting a named occurrence releases only that occurrence and leaves reused views alone', async () => {
    const f = await setup(source(org + '    use Parent named ParentAgain\n        with\n            position\n                x 45\n                y 88\n            pinned false\nview Other as org.tree@1\n    use Parent named ParentOther\n        with\n            position\n                x 900\n                y 500\n            pinned false\n'));
    try {
        await drop(f);
        await apply(f.commands, {...connect(f), from: f.named('ParentAgain').ref});
        assert.equal(f.named('ParentAgain').record.position, undefined);
        assert.equal(f.occurrence('Dropped').record.position, undefined);
        assert.deepEqual(f.named('ParentOther').record.position, {x: 900, y: 500});
        assert.equal(f.named('ParentOther').record.pinned, false);
    } finally {f.runtime.destroy();}
});

test('reflow removes view-local pins and bend coordinates, restores profile layout and undoes exactly', async () => {
    const text = `// Keep source comments and sibling placements.
view Org as org.tree@1
    with
        layout.algorithm manual
    element Parent as organization
        with
            position
                x 700
                y 400
            pinned true
    element Child as organization
        with
            position
                x 10
                y 800
    connect Parent to Child as reports_to named Reports
    use Reports named Routed
        with
            route
                via
                    item
                        x 300
                        y 400
                source_side south
                target_side north
view Other as org.tree@1
    use Parent named Elsewhere
        with
            position
                x 900
                y 500
            pinned true
`;
    const f = await setup(source(text));
    try {
        const view = f.named('Org').ref, patches = reflowViewPatches(f.runtime, view);
        assert.equal(f.runtime.sources().files[0].text, text, 'planning must not mutate the model');
        await apply(f.commands, {kind: 'edit-source', patches});
        assert.equal(f.occurrence('Parent').record.position, undefined);
        assert.equal(f.occurrence('Parent').record.pinned, undefined);
        assert.equal(f.occurrence('Child').record.position, undefined);
        assert.equal(f.named('Routed').record.route.via, undefined);
        assert.equal(f.named('Routed').record.route.source_side, 'south');
        assert.equal(f.named('Routed').record.route.target_side, 'north');
        assert.equal(f.named('Org').record.layout.algorithm, 'tree');
        assert.deepEqual(f.named('Elsewhere').record.position, {x: 900, y: 500});
        assert.equal(f.named('Elsewhere').record.pinned, true);
        assert.match(f.runtime.sources().files[0].text, /^\/\/ Keep source comments/);
        assert.equal((await f.commands.undo()).ok, true);
        assert.equal(f.runtime.sources().files[0].text, text);
        assert.equal((await f.commands.redo()).ok, true);
        assert.equal(f.named('Org').record.layout.algorithm, 'tree');
    } finally {f.runtime.destroy();}
});

test('reflow preserves automatic layout choices, handles inherited manual mode, and is a no-op when already free', async () => {
    const f = await setup(source(org.replace('    element', '    with\n        layout.algorithm circular\n    element')));
    try {
        assert.deepEqual(reflowViewPatches(f.runtime, f.named('Org').ref), []);
        await drop(f);
        await apply(f.commands, {kind: 'edit-source', patches: reflowViewPatches(f.runtime, f.named('Org').ref)});
        assert.equal(f.named('Org').record.layout.algorithm, 'circular');
        await apply(f.commands, {kind: 'edit-source', patches: reflowViewPatches(f.runtime, f.named('Org').ref, 'manual')});
        assert.equal(f.named('Org').record.layout.algorithm, 'tree');
    } finally {f.runtime.destroy();}
});

test('reflow rejects read-only views and cannot bypass edit authority', async () => {
    const readonly = source(org); readonly.files[0].writable = false;
    const f = await setup(readonly);
    try {assert.throws(() => reflowViewPatches(f.runtime, f.named('Org').ref), /read-only/);}
    finally {f.runtime.destroy();}
    const editable = await setup();
    try {
        await drop(editable);
        const before = editable.runtime.sources().files[0].text;
        const denied = createCommandService(editable.runtime, {authorize: async () => ({allowed: false, principal: 'reader', grants: []})});
        const result = await denied.prepare({kind: 'edit-source', patches: reflowViewPatches(editable.runtime, editable.named('Org').ref)});
        assert.equal(result.ok, false); assert.equal(result.failure.code, 'unauthorized');
        assert.equal(editable.runtime.sources().files[0].text, before);
    } finally {editable.runtime.destroy();}
});

test('reflow of a writable occurrence never changes its shared read-only definition', async () => {
    const input = source('include "shared.ddn"\nview Org as org.tree@1\n    use "shared.ddn"::Shared named Local\n        with\n            position\n                x 77\n                y 88\n            pinned true\n');
    input.files.push({id: 'shared.ddn', text: 'element Shared as organization\n', revision: 'shared', encoding: 'utf-8', writable: false});
    const f = await setup(input);
    try {
        const patches = reflowViewPatches(f.runtime, f.named('Org').ref);
        assert.ok(patches.every(patch => patch.file === 'main.ddn'));
        await apply(f.commands, {kind: 'edit-source', patches});
        assert.equal(f.named('Local').record.position, undefined);
        assert.equal(f.runtime.sources().files.find(file => file.id === 'shared.ddn').text, input.files[1].text);
    } finally {f.runtime.destroy();}
});

for (const dotted of [true, false]) for (const explicit of [true, false]) {
    const position = dotted ? '            position.x 700\n            position.y 300\n' : '            position\n                x 700\n                y 300\n';
    const declaration = explicit ? '    element Dropped as organization\n    use Dropped named Local\n' : '    element Dropped as organization\n';
    const input = pin => source(org + declaration + '        with\n' + position + `            pinned ${pin}\n`);
    const description = `${dotted ? 'dotted' : 'nested'} position on ${explicit ? 'explicit' : 'inline'} occurrence`;
    test(`reflow clears ${description} from source and exact undo restores it`, async () => {
        const f = await setup(input(true));
        try {
            const before = f.runtime.sources().files[0].text;
            await apply(f.commands, {kind: 'edit-source', patches: reflowViewPatches(f.runtime, f.named('Org').ref)});
            assert.doesNotMatch(f.runtime.sources().files[0].text, /position|pinned/);
            assert.ok(f.entries().filter(e => e.kind === 'appearance').every(e => e.record.position === undefined && e.record.pinned === undefined));
            assert.equal((await f.commands.undo()).ok, true);
            assert.equal(f.runtime.sources().files[0].text, before);
        } finally {f.runtime.destroy();}
    });
    test(`connection releases ${description} from source and exact undo restores it`, async () => {
        const f = await setup(input(false));
        try {
            const before = f.runtime.sources().files[0].text;
            await apply(f.commands, {...connect(f), to: f.named(explicit ? 'Local' : 'Dropped').ref});
            assert.doesNotMatch(f.runtime.sources().files[0].text, /position|pinned/);
            assert.ok(f.entries().filter(e => e.kind === 'appearance').every(e => e.record.position === undefined && e.record.pinned === undefined));
            assert.equal((await f.commands.undo()).ok, true);
            assert.equal(f.runtime.sources().files[0].text, before);
        } finally {f.runtime.destroy();}
    });
}
