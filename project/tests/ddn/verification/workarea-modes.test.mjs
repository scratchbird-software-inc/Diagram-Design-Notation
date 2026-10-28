import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const build = process.env.DDN_BUILD_ROOT || path.resolve('.work/builds/ddn');
const mod = name => import(pathToFileURL(path.join(build, 'ddn/packages', name, 'src/index.js')));
const {decodeSources, patchProperty, applySourcePatches} = await mod('language');
const {createNativePack, indexRecords} = await mod('profiles');
const {resolve, validateProperty} = await mod('defaults');
const {createVerifier} = await mod('verifier');
const versions = {api: '1.0', language: 'ddn-next-1', defaults: 'ddn-next-1', packs: {'ddn-native': '1.0.0'}};
const source = (text, id = 'main.ddn') => ({id, text, revision: 'r1', encoding: 'utf-8', writable: true});
const sources = (text, files = []) => ({entry: 'main.ddn', files: [source(text), ...files]});
const options = {scope: {kind: 'workarea'}, level: 'review', purpose: 'design'};
const verify = (input, extra = {}) => createVerifier({versions, packs: [createNativePack()]}).verifySources(input, {...options, ...extra});
const standalone = 'workarea Board\n    with\n        mode standalone\n';
const errors = report => JSON.stringify(report.diagnostics);

test('workarea mode is a closed explicit setting with the previous surface as its omission default', () => {
    assert.equal(resolve({}, 'workarea').values.mode, 'workarea');
    for (const mode of ['workarea', 'standalone']) assert.deepEqual(validateProperty('workarea', 'mode', mode), []);
    for (const mode of ['single', '', null, true]) assert.ok(validateProperty('workarea', 'mode', mode).length);
    const inherited = resolve({}, 'workarea', {fileDefaults: [{selector: {owner: 'workarea'}, declarations: {mode: 'standalone'}}]});
    assert.equal(inherited.values.mode, 'workarea');
    assert.ok(inherited.diagnostics.some(item => item.code === 'DDN-DEFAULT-INELIGIBLE'));
    const styled = resolve({}, 'workarea', {styles: [{selector: {owner: 'workarea'}, declarations: {mode: 'standalone'}}]});
    assert.equal(styled.values.mode, 'workarea');
    assert.ok(styled.diagnostics.some(item => item.code === 'DDN-DEFAULT-INELIGIBLE'));
});

test('standalone mode decodes, persists through source edits and resets to omission', () => {
    const input = sources(standalone + 'erd Sales\n    Customer\n');
    const decoded = decodeSources(input);
    assert.deepEqual(decoded.diagnostics, []);
    const wa = indexRecords(decoded.normalized).find(record => record.owner === 'workarea');
    assert.equal(wa.record.mode, 'standalone');
    const changed = applySourcePatches(input, patchProperty(decoded, wa.ref, 'title', 'Board title'));
    const reopened = decodeSources(changed);
    assert.deepEqual(reopened.diagnostics, []);
    assert.equal(indexRecords(reopened.normalized).find(record => record.owner === 'workarea').record.mode, 'standalone');
    const reset = decodeSources(applySourcePatches(input, patchProperty(decoded, wa.ref, 'mode', undefined)));
    assert.deepEqual(reset.diagnostics, []);
    assert.equal(indexRecords(reset.normalized).find(record => record.owner === 'workarea').record.mode, undefined);
});

test('one standalone view is reviewable and ordinary documents remain multi-view', async () => {
    const single = await verify(sources(standalone + 'erd Sales\n    Customer\n'));
    assert.equal(single.outcome, 'valid', errors(single));
    assert.equal(single.reviewEligible, true);
    for (const header of ['', 'workarea Board\n', 'workarea Board\n    with\n        mode workarea\n']) {
        const multiple = await verify(sources(header + 'erd Sales\n    Customer\nerd Orders\n    Order\n'));
        assert.equal(multiple.outcome, 'valid', errors(multiple));
    }
});

test('standalone extra views are structural errors even when checking only one view', async () => {
    const input = sources(standalone + 'erd Sales\n    Customer\nerd Orders\n    Order\n');
    const view = indexRecords(decodeSources(input).normalized).find(record => record.record.name === 'Sales');
    for (const scope of [{kind: 'workarea'}, {kind: 'view', target: view.ref}]) {
        const report = await verify(input, {scope, level: 'structural'});
        assert.equal(report.outcome, 'invalid', errors(report));
        assert.ok(report.diagnostics.some(item => item.code === 'DDN-STANDALONE-VIEWS'));
    }
});

test('standalone count includes reachable output documents and included views, not unused supplied files', async () => {
    for (const additional of ['erd Other\n', 'document Report as pdf\n']) {
        const report = await verify(sources('include "other.ddn"\n' + standalone + 'erd Sales\n', [source(additional, 'other.ddn')]), {level: 'structural'});
        assert.equal(report.outcome, 'invalid', errors(report));
        assert.ok(report.diagnostics.some(item => item.code === 'DDN-STANDALONE-VIEWS'));
    }
    const unused = await verify(sources(standalone + 'erd Sales\n', [source('erd Unused\n', 'unused.ddn')]));
    assert.equal(unused.outcome, 'valid', errors(unused));
    const includedOnly = await verify(sources('include "other.ddn"\n' + standalone, [source('erd OnlyView\n', 'other.ddn')]));
    assert.equal(includedOnly.outcome, 'valid', errors(includedOnly));
});

test('included workarea mode cannot override the active entry-file mode', async () => {
    const normal = await verify(sources('include "other.ddn"\nerd Sales\n', [source(standalone + 'erd Orders\n', 'other.ddn')]));
    assert.equal(normal.outcome, 'valid', errors(normal));
    const single = await verify(sources('include "other.ddn"\n' + standalone + 'erd Sales\n', [source('workarea Imported\n    with\n        mode workarea\nerd Orders\n', 'other.ddn')]), {level: 'structural'});
    assert.equal(single.outcome, 'invalid', errors(single));
    assert.ok(single.diagnostics.some(item => item.code === 'DDN-STANDALONE-VIEWS'));
});

test('empty standalone workareas remain editable but cannot pass review', async () => {
    for (const state of ['draft', 'in-progress']) {
        const input = sources(standalone + '        design.state ' + state + '\n');
        const editable = await verify(input, {level: 'structural'});
        assert.equal(editable.outcome, 'valid', errors(editable));
        const review = await verify(input);
        assert.equal(review.outcome, 'incomplete', errors(review));
        assert.equal(review.reviewEligible, false);
        assert.ok(review.missing.includes('standalone-view'));
    }
    const alreadyReview = await verify(sources(standalone + '        design.state in-review\n'), {level: 'structural'});
    assert.equal(alreadyReview.outcome, 'incomplete', errors(alreadyReview));
});
