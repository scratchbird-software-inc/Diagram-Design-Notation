import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { allFixtureProfiles, profileSource, sourceSet } from './fixtures.mjs';
const output = process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const load = name => import(pathToFileURL(resolve(output, `ddn/packages/${name}/src/index.js`)));
const language = await load('language');
const { createRuntime, createCompleteRuntimeOptions } = await load('runtime');
const { completeProfileIds } = await load('profiles');
const { projectSnapshot, availableProjectionProfiles } = await load('presentation');
const { resolveProperties } = await load('defaults');
test('complete profile fixtures and presentation routing exactly cover the adopted151 identities', () => {
    assert.equal(completeProfileIds.length, 151);
    assert.equal(new Set(allFixtureProfiles).size, 151);
    assert.deepEqual([...allFixtureProfiles].sort(), [...completeProfileIds].sort());
    assert.deepEqual([...availableProjectionProfiles].sort(), [...completeProfileIds].sort());
});
for (const profile of allFixtureProfiles) test(`new-dialect source to verified scene: ${profile}`, async () => {
    const source = sourceSet(profileSource(profile, language));
    const decoded = language.decodeSources(source);
    assert.equal(decoded.syntaxValid, true, JSON.stringify(decoded.diagnostics));
    assert.deepEqual(decoded.diagnostics.filter(d => d.severity === 'error'), [], JSON.stringify(decoded.diagnostics));
    const runtime = createRuntime(createCompleteRuntimeOptions());
    try {
        const opened = await runtime.open(source);
        assert.ok(opened.snapshot, JSON.stringify(opened.diagnostics));
        const report = await runtime.verifier.verifyModel(opened.snapshot, { scope: { kind: 'workarea' }, purpose: 'inspect', level: 'semantic' });
        assert.equal(report.outcome, 'valid', JSON.stringify(report.diagnostics));
        const scene = projectSnapshot(opened.snapshot, { resolve: (target, context) => resolveProperties(opened.snapshot, target, context) });
        assert.equal(scene.coverage.complete, true, JSON.stringify(scene.diagnostics));
        assert.ok(scene.entries.some(entry => entry.item.layer !== 'views'), 'nonempty content');
        for (const item of scene.items) {
            assert.ok(Object.values(item.bounds).every(Number.isFinite), 'finite bounds');
            for (const primitive of item.primitives) if (primitive.kind === 'path') assert.doesNotMatch(primitive.d, /NaN|Infinity|undefined/);
        }
    } finally { runtime.destroy(); }
});
