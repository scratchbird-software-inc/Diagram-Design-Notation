import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = process.env.DDN_BUILD_ROOT ?? resolve(root, '.work/builds/typescript');
const { analyzeDecision } = await import(pathToFileURL(join(output, 'ddn/packages/profiles/src/index.js')));
const domains = [{ name: 'score', type: 'number', min: 0, max: 10 }];
const row = (id, inputs = {}, guard) => ({ id, inputs, outputs: { result: id }, ...(guard === undefined ? {} : { guard }) });
const first = (rules, options = {}) => analyzeDecision(domains, rules, { hitPolicy: 'first', ...options });

test('first-hit analysis proves shadowing by earlier matching rules, not mere overlap', () => {
    const rules = [row('high', { score: { op: 'gte', value: 5 } }), row('default'), row('low', { score: { op: 'lt', value: 5 } })];
    const result = first(rules);
    assert.equal(result.outcome, 'valid'); assert.deepEqual(result.firstHit, { outcome: 'complete', shadowed: ['low'] });
    assert.ok(result.overlaps.length);
    assert.deepEqual(first(rules.slice(0, 2)).firstHit, { outcome: 'complete', shadowed: [] }, 'default still wins below five');
});
test('unreachable guards are not mislabeled as shadowed matching rules', () => {
    const result = first([row('default'), row('impossible', {}, false)]);
    assert.deepEqual(result.firstHit, { outcome: 'complete', shadowed: [] });
});
for (const guarded of [
    { field: 'score', op: 'interval', min: 2, max: 3 },
    { score: { op: 'interval', min: 2, max: 3 } },
    { field: 'score', op: 'in', values: [2, 3] },
    { score: { op: 'in', value: [2, 3] } },
]) {
    test(`numeric guards add required partition boundaries: ${JSON.stringify(guarded)}`, () => {
        const result = first([row('outside', {}, { not: guarded }), row('interior')]);
        assert.equal(result.outcome, 'valid'); assert.ok(result.tested > 3);
        assert.deepEqual(result.firstHit, { outcome: 'complete', shadowed: [] }, 'interior wins in the interval/membership set even when coarse endpoint samples would miss it');
    });
}
test('numeric membership columns retain all accepted value-list boundaries', () => {
    for (const predicate of [{ op: 'in', values: [2, 3] }, { op: 'in', value: [2, 3] }]) {
        const result = first([row('default'), row('member', { score: predicate })]);
        assert.equal(result.outcome, 'valid'); assert.ok(result.tested > 3);
        assert.deepEqual(result.firstHit, { outcome: 'complete', shadowed: ['member'] });
    }
});
test('first-hit evidence is explicitly unknown when the bounded walk is exhausted or skipped', () => {
    const rules = [row('default'), row('later')];
    for (const budget of [1, 3]) {
        const result = first(rules, { budget });
        assert.equal(result.outcome, 'budget_exceeded'); assert.deepEqual(result.firstHit, { outcome: 'unknown', shadowed: null });
    }
    assert.deepEqual(first(rules, { coverage: 'none' }).firstHit, { outcome: 'unknown', shadowed: null });
    assert.deepEqual(first([row('invalid', { score: { op: 'eq', value: 20 } })]).firstHit, { outcome: 'unknown', shadowed: null });
});
test('first-hit proof uses all tested partitions even when overlap reporting is capped', () => {
    const enumDomains = ['a', 'b'].map(name => ({ name, type: 'enum', values: Array.from({ length: 15 }, (_, index) => index) }));
    const result = analyzeDecision(enumDomains, [row('default'), row('later')], { hitPolicy: 'first' });
    assert.equal(result.tested, 225); assert.equal(result.overlaps.length, 100);
    assert.deepEqual(result.firstHit, { outcome: 'complete', shadowed: ['later'] });
});
test('non-first hit policies do not claim first-hit evidence', () => {
    assert.deepEqual(analyzeDecision(domains, [row('a'), row('b')], { hitPolicy: 'collect' }).firstHit, { outcome: 'not-applicable', shadowed: null });
});
