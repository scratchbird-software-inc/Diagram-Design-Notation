import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const module = file => import(pathToFileURL(resolve(output, 'ddn/packages', file)));
const { createRuntime, createNativeRuntimeOptions } = await module('runtime/src/index.js');
const { createCommandService, createCommandHistoryGroup, currentCommandHistoryGroup } = await module('runtime/src/commands.js');
const { listRecords } = await module('model/src/index.js');
const source = text => ({entry: 'main.ddn', files: [{id: 'main.ddn', text, revision: 'initial', encoding: 'utf-8', writable: true}]});
const original = 'erd Sales\n    Customer\n    Order\n';
async function setup(t, authorize = async action => ({allowed: true, principal: 'tester', grants: [action]})) {
    const runtime = createRuntime(createNativeRuntimeOptions()); t.after(() => runtime.destroy());
    assert.ok((await runtime.open(source(original))).snapshot);
    const commands = createCommandService(runtime, {authorize});
    const named = name => listRecords(runtime.snapshot().normalized).find(entry => entry.record.name === name);
    return {runtime, commands, named, text: () => runtime.sources().files[0].text};
}
async function edit(commands, target, path, value) {
    const group = currentCommandHistoryGroup(commands);
    const prepared = await commands.prepare({kind: 'set-property', target, path, value}, group ? {cancel: group.signal} : {});
    if (!prepared.ok) return prepared;
    return group ? group.commit(prepared.command.id) : commands.commit(prepared.command.id);
}
const okay = result => assert.equal(result.ok, true, JSON.stringify(result));

test('slider revisions and multiple settings scopes become one undo entry while prior history stays separate', async t => {
    const {runtime, commands, named, text} = await setup(t), target = named('Customer').ref;
    okay(await edit(commands, target, 'title', 'Earlier edit')); const before = text();
    const group = createCommandHistoryGroup(commands);
    for (const size of [17, 18, 20, 22, 27]) okay(await group.run(() => edit(commands, target, 'style.font_size', size)));
    okay(await group.run(() => edit(commands, named('Order').ref, 'background.color', '#ccbbaa')));
    const final = text(); assert.equal(group.current, true); assert.equal(group.changed, true); group.close();
    okay(await commands.undo()); assert.equal(text(), before);
    okay(await commands.redo()); assert.equal(text(), final);
    okay(await commands.undo()); okay(await commands.undo()); assert.equal(text(), original);
    assert.ok(runtime.snapshot());
});

test('revert restores all live edits and leaves ordinary redo available', async t => {
    const {commands, named, text} = await setup(t), group = createCommandHistoryGroup(commands), target = named('Customer').ref;
    okay(await group.run(() => edit(commands, target, 'title', 'Live name')));
    okay(await group.run(() => edit(commands, target, 'style.font_size', 25)));
    const final = text(); okay(await group.revert()); assert.equal(text(), original); assert.equal(group.changed, false);
    group.close(); okay(await commands.redo()); assert.equal(text(), final);
});

test('external command prevents further edits and cannot be erased by reverting a settings form', async t => {
    const {commands, named, text} = await setup(t), group = createCommandHistoryGroup(commands), target = named('Customer').ref;
    okay(await group.run(() => edit(commands, target, 'style.font_size', 25)));
    okay(await edit(commands, target, 'title', 'Outside change')); const external = text();
    assert.equal(group.current, false); assert.throws(() => group.run(() => edit(commands, target, 'style.font_size', 27)), /outside/);
    assert.equal((await group.revert()).ok, false); assert.equal(text(), external); group.close();
    okay(await commands.undo()); assert.equal(named('Customer').record.style.font_size, 25);
    okay(await commands.undo()); assert.equal(text(), original);
});

test('external reopen of identical source invalidates the settings session', async t => {
    const {runtime, commands, named, text} = await setup(t), group = createCommandHistoryGroup(commands), target = named('Customer').ref;
    await runtime.open(runtime.sources());
    assert.equal(group.current, false); assert.throws(() => group.run(() => edit(commands, target, 'style.font_size', 25)), /outside/);
    assert.equal(text(), original); group.close();
});

test('an async settings callback never lends its history group to unrelated commands', async t => {
    const {commands, named, text} = await setup(t), target = named('Customer').ref, group = createCommandHistoryGroup(commands);
    let release; const wait = new Promise(resolve => release = resolve);
    const suspended = group.run(async () => { await wait; return currentCommandHistoryGroup(commands); });
    assert.equal(currentCommandHistoryGroup(commands), undefined);
    okay(await edit(commands, target, 'title', 'Independent'));
    release(); assert.equal(await suspended, undefined); assert.equal(group.current, false); group.close();
    okay(await commands.undo()); assert.equal(text(), original);
});

test('destroying a settings session cancels an authorized command waiting to commit', async t => {
    let calls = 0, release;
    const {commands, named, text} = await setup(t, async action => {
        calls++; if (calls === 2) await new Promise(resolve => release = resolve);
        return {allowed: true, principal: 'tester', grants: [action]};
    });
    const group = createCommandHistoryGroup(commands);
    const pending = group.run(() => edit(commands, named('Customer').ref, 'title', 'Discard me'));
    while (!release) await new Promise(resolve => setTimeout(resolve, 1));
    group.close(); release(); assert.equal((await pending).ok, false); assert.equal(text(), original);
    assert.equal((await commands.undo()).ok, false);
});

test('returning source to its baseline does not leave a no-op undo command', async t => {
    const {commands, named, text} = await setup(t), target = named('Customer').ref;
    okay(await edit(commands, target, 'title', 'Before')); const group = createCommandHistoryGroup(commands);
    okay(await group.run(() => edit(commands, target, 'title', 'Temporary')));
    okay(await group.run(() => edit(commands, target, 'title', 'Before')));
    assert.equal(group.changed, false); group.close(); okay(await commands.undo()); assert.equal(text(), original);
});

test('a session outside the configured history budget does not claim it can revert', async t => {
    const {runtime, named, text} = await setup(t);
    const commands = createCommandService(runtime, {authorize: async action => ({allowed: true, principal: 'tester', grants: [action]})}, {maxCommands: 1, maxBytes: 1});
    const group = createCommandHistoryGroup(commands);
    okay(await group.run(() => edit(commands, named('Customer').ref, 'title', 'Not retained in tiny history')));
    const changed = text(); assert.equal(group.current, true); assert.equal(group.changed, false);
    assert.equal((await group.revert()).ok, false); assert.equal(text(), changed); group.close();
    assert.equal((await commands.undo()).ok, false);
});
