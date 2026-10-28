import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const output = process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const {waitForSettingsSave} = await import(pathToFileURL(resolve(output, 'ddn/packages/designer/src/live-settings.js')));
function cancellation() {
    let aborted = false; const handlers = new Set();
    return {token: {get aborted() {return aborted;}, onAbort(handler) {handlers.add(handler); return () => handlers.delete(handler);}},
        abort() {aborted = true; for (const handler of handlers) handler();}, get listeners() {return handlers.size;}};
}
const budget = elapsedMs => ({elapsedMs, workUnits: 1000, memoryBytes: 1000000});

test('cancelling Save stops waiting promptly without cancelling the independent edit', async () => {
    const cancel = cancellation(); let release, complete = false;
    const edit = new Promise(resolve => release = resolve).then(() => {complete = true;});
    const save = waitForSettingsSave(() => edit, {cancel: cancel.token});
    await Promise.resolve(); cancel.abort();
    await assert.rejects(save, error => error.outcome === 'cancelled');
    assert.equal(complete, false); assert.equal(cancel.listeners, 0);
    release(); await edit; assert.equal(complete, true);
});

test('Save deadline includes pending live edits and releases listeners on expiry', async () => {
    const cancel = cancellation(); let release;
    const edit = new Promise(resolve => release = resolve);
    await assert.rejects(waitForSettingsSave(() => edit, {cancel: cancel.token, budget: budget(15)}), error => error.outcome === 'budget-exceeded');
    assert.equal(cancel.listeners, 0); release(); await edit;
});

test('successful Save forwards only the remaining time budget and preserves other limits', async () => {
    const cancel = cancellation(), task = {cancel: cancel.token, budget: budget(5000)};
    const remaining = await waitForSettingsSave(() => new Promise(resolve => setTimeout(resolve, 15)), task);
    assert.ok(remaining.budget.elapsedMs < 5000 && remaining.budget.elapsedMs > 0);
    assert.equal(remaining.budget.workUnits, task.budget.workUnits); assert.equal(remaining.budget.memoryBytes, task.budget.memoryBytes);
    assert.equal(remaining.cancel, cancel.token); assert.equal(cancel.listeners, 0); assert.equal(task.budget.elapsedMs, 5000);
});

test('already cancelled and invalid-budget saves do not start a flush', async () => {
    const cancel = cancellation(); cancel.abort(); let started = false;
    const flush = async () => {started = true;};
    await assert.rejects(waitForSettingsSave(flush, {cancel: cancel.token}), error => error.outcome === 'cancelled');
    await assert.rejects(waitForSettingsSave(flush, {budget: budget(-1)}), RangeError);
    assert.equal(started, false); assert.equal(cancel.listeners, 0);
});

test('failed flush preserves its rejection and removes the cancellation listener', async () => {
    const cancel = cancellation(); let rejected = false;
    await waitForSettingsSave(() => Promise.reject(undefined), {cancel: cancel.token}).then(() => assert.fail('Must reject'), error => {rejected = true; assert.equal(error, undefined);});
    assert.equal(rejected, true); assert.equal(cancel.listeners, 0);
});
