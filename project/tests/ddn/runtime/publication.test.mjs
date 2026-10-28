import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const output = process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const moduleAt = name => import(pathToFileURL(resolve(output, 'ddn/packages/' + name)));
const { createRuntime, createNativeRuntimeOptions } = await moduleAt('runtime/src/index.js');
const { listRecords } = await moduleAt('model/src/index.js');
const { resolveProperties } = await moduleAt('defaults/src/index.js');
const text = `erd Sales
    Customer
    with
        publication Print
publication Print
    with
        targets
            item
                target Sales
                kind view
        format svg
        page.size a4
        page.orientation landscape
`;
const sources = text => ({ entry: 'publication.ddn', files: [{ id: 'publication.ddn', text, revision: 'one', encoding: 'utf-8', writable: true }] });

test('named publications open, resolve defaults and participate in semantic verification', async () => {
    const runtime = createRuntime(createNativeRuntimeOptions());
    try {
        const opened = await runtime.open(sources(text));
        assert.ok(opened.snapshot, JSON.stringify(opened.diagnostics));
        assert.equal(opened.diagnostics.some(d => d.severity === 'error'), false, JSON.stringify(opened.diagnostics));
        const records = listRecords(opened.snapshot.normalized), publication = records.find(entry => entry.kind === 'publication');
        assert.equal(publication.record.name, 'Print');
        const resolved = resolveProperties(opened.snapshot, publication.ref);
        assert.deepEqual(resolved.diagnostics, []);
        assert.equal(resolved.values.page.orientation, 'landscape');
        assert.equal(resolved.values.page.fit, 'contain');
        const report = await runtime.verifier.verifyModel(opened.snapshot, { scope: { kind: 'workarea' }, purpose: 'design', level: 'semantic' });
        assert.equal(report.outcome, 'valid', JSON.stringify(report.diagnostics));
        assert.ok(report.coverage.checked.some(ref => ref.id === publication.ref.id));
    } finally { runtime.destroy(); }
});

test('publication target references are verified instead of being ignored collections', async () => {
    const runtime = createRuntime(createNativeRuntimeOptions());
    try {
        const opened = await runtime.open(sources(text.replace('target Sales', 'target Missing')));
        assert.equal(opened.snapshot, undefined);
        assert.ok(opened.diagnostics.some(d => d.code === 'DDN-REFERENCE'), JSON.stringify(opened.diagnostics));
    } finally { runtime.destroy(); }
});
