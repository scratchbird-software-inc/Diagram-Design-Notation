import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const output = process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const moduleAt = name => import(pathToFileURL(resolve(output, 'ddn/packages/' + name)));
const { createRuntime, createNativeRuntimeOptions } = await moduleAt('runtime/src/index.js');
const { sourcesForSave } = await moduleAt('runtime/src/save.js');
const { decodeSources } = await moduleAt('language/src/index.js');
const { listRecords } = await moduleAt('model/src/index.js');

test('save snapshots materialize only explicitly requested provider data and preserve live source', async () => {
    const text = 'source Live as host\n    with\n        channel updates\ndata Rows from Live\n    with\n        persist snapshot\nview Grid as table.records@1\n    with\n        projection.options\n            records Rows\n            columns 2\n            missing gap\n';
    const runtime = createRuntime(createNativeRuntimeOptions());
    const opened = await runtime.open({ entry: 'data.ddn', files: [{ id: 'data.ddn', text, revision: 'one', encoding: 'utf-8', writable: true }] });
    assert.ok(opened.snapshot, JSON.stringify(opened.diagnostics));
    const updated = await runtime.ingest({ base: runtime.snapshot().revision, origin: 'test', data: [{ kind: 'replace', source: 'Live', next: 'data-2', schema: [{ id: 'id' }, { id: 'label' }], rows: [[1, 'Current value']] }] });
    assert.equal(updated.diagnostics.some(d => d.severity === 'error'), false, JSON.stringify(updated.diagnostics));
    const artifacts = await sourcesForSave(runtime);
    assert.equal(runtime.sources().files[0].text, text);
    const decoded = decodeSources(artifacts);
    assert.equal(decoded.syntaxValid, true, JSON.stringify(decoded.diagnostics));
    const data = listRecords(decoded.normalized).find(entry => entry.kind === 'data').record;
    assert.deepEqual(data.snapshot.rows, [[1, 'Current value']]);
    assert.equal(data.snapshot.revision, 'data-2');
    assert.match(data.snapshot.captured_at, /^\d{4}-\d{2}-\d{2}T/);
    runtime.destroy();
});
