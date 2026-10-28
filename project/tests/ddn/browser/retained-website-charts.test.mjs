import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dataProfileFixture } from './data-profile-fixtures.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = process.env.DDN_BUILD_ROOT ?? resolve(root, '.work/builds/typescript');
const { projectDataProfile } = await import(pathToFileURL(join(output, 'ddn/packages/presentation/src/data-profiles.js')));
const { loessTrend } = await import(pathToFileURL(join(output, 'ddn/packages/presentation/src/data-statistics.js')));
const { chartOptionErrors, validateSchema, indexRecords, completeProfileDiagnostics } = await import(pathToFileURL(join(output, 'ddn/packages/profiles/src/index.js')));
const project = f => projectDataProfile(f.snapshot, f.view, f.bounds, f.effective);

test('isometric marks retain top geometry and provenance while adding bounded depth faces', () => {
    for (const mark of ['bar', 'area', 'pie', 'donut', 'treemap']) {
        const fixture = dataProfileFixture(mark === 'treemap' ? 'chart.treemap@1' : 'chart.basic@1');
        fixture.view.record.projection.options.mark = mark;
        const flat = project(fixture);
        Object.assign(fixture.view.record.projection.options, { iso: true, depth: 20 });
        const raised = project(fixture);
        assert.deepEqual(raised.unavailable, [], mark);
        assert.ok(raised.entries.length > flat.entries.length, mark);
        for (const entry of flat.entries) {
            const same = raised.entries.find(candidate => candidate.item.occurrence === entry.item.occurrence);
            assert.deepEqual(same.item.primitives, entry.item.primitives);
            assert.deepEqual(same.item.hitTargets, entry.item.hitTargets);
        }
        assert.ok(raised.entries.filter(entry => entry.item.occurrence.includes(':depth')).every(entry => entry.item.hitTargets.length === 0));
        assert.ok(raised.bounds.width > flat.bounds.width); assert.ok(raised.bounds.height > flat.bounds.height);
    }
});

test('unsupported extrusion marks and invalid depth remain explicit errors', () => {
    assert.ok(chartOptionErrors('chart.basic@1', { mark: 'point', iso: true }).length);
    assert.ok(chartOptionErrors('chart.basic@1', { mark: 'bar', iso: true, depth: 2001 }).length);
    assert.deepEqual(chartOptionErrors('chart.basic@1', { mark: 'bar', iso: true, depth: 0 }), []);
    const fixture = dataProfileFixture('chart.basic@1'), flat = project(fixture);
    Object.assign(fixture.view.record.projection.options, { mark: 'bar', iso: true, depth: 2000 });
    const raised = project(fixture);
    assert.deepEqual(raised.unavailable, []);
    assert.ok(Math.abs(raised.bounds.width - flat.bounds.width - 1000 * Math.sqrt(3)) < 1e-8);
    assert.equal(raised.bounds.height - flat.bounds.height, 1000);
});

test('data-bound depth uses each row without changing its quantitative bar height', () => {
    const fixture = dataProfileFixture('chart.basic@1');
    fixture.document.data[0].columns.push({ id: 'depth' });
    fixture.document.data[0].rows = [['A', 5, 10], ['B', 5, 30]];
    Object.assign(fixture.view.record.projection.options, { mark: 'bar', iso: true, depth: 'depth' });
    const result = project(fixture), tops = result.entries.filter(entry => entry.definition.owner === 'data' && !entry.item.occurrence.includes(':depth'));
    const sides = result.entries.filter(entry => entry.item.occurrence.endsWith(':depth'));
    assert.deepEqual(result.unavailable, []); assert.equal(tops.length, 2); assert.equal(sides.length, 2);
    assert.equal(tops[0].item.bounds.height, tops[1].item.bounds.height);
    assert.ok(Math.abs((sides[1].item.bounds.width - tops[1].item.bounds.width) / (sides[0].item.bounds.width - tops[0].item.bounds.width) - 3) < 1e-10);
    fixture.document.data[0].rows[0][2] = -1;
    assert.ok(project(fixture).diagnostics.some(diagnostic => diagnostic.code === 'DDN-CHART-DEPTH'));
});

test('LOESS reproduces linear measurements and is deterministic under input ordering', () => {
    const points = Array.from({ length: 12 }, (_, x) => [x, 3 * x + 2]);
    const curve = loessTrend(points);
    assert.equal(curve.length, 12);
    for (const [x, y] of curve) assert.ok(Math.abs(y - (3 * x + 2)) < 1e-10);
    assert.deepEqual(loessTrend([...points].reverse()), curve);
    const nonlinear = loessTrend(points.map(([x]) => [x, x * x]));
    assert.ok(nonlinear[6][1] - nonlinear[5][1] > nonlinear[2][1] - nonlinear[1][1]);
    assert.throws(() => loessTrend([[2, 1], [2, 3], [2, 4]]), /distinct x/);
});

test('LOESS overlay is rendered from the measured numeric scatter data', () => {
    const fixture = dataProfileFixture('chart.basic@1');
    fixture.document.data[0].rows = [[0, 1], [1, 3], [2, 5], [3, 8], [4, 10]];
    Object.assign(fixture.view.record.projection.options, { mark: 'point', x_type: 'number', trend: { method: 'loess', show: true } });
    const result = project(fixture);
    assert.deepEqual(result.unavailable, []); assert.deepEqual(result.diagnostics, []);
    assert.ok(result.entries.some(entry => entry.item.accessible.label === 'LOESS trend'));
});

test('composed inclusions place repeated child views independently without duplicating definitions', () => {
    const fixture = dataProfileFixture('panels.composed@1'), target = fixture.view.record.projection.options.panels[0].target;
    fixture.view.record.projection.options.columns = 2;
    fixture.view.record.projection.options.panels = [{ target, kind: 'view', layout: { row: 0, column: 1 } }, { target, kind: 'view', layout: { row: 1, column: 0 } }];
    assert.deepEqual(validateSchema('bundle', fixture.snapshot.normalized), []);
    const entries = indexRecords(fixture.snapshot.normalized), view = entries.find(entry => entry.ref.id === 'view');
    assert.deepEqual(completeProfileDiagnostics(view, entries), []);
    const result = projectDataProfile(fixture.snapshot, fixture.view, fixture.bounds, fixture.effective, { projectChild(view, bounds) { return projectDataProfile(fixture.snapshot, view, bounds, view.record); } });
    assert.deepEqual(result.unavailable, []);
    const frames = result.entries.filter(entry => !entry.item.occurrence.startsWith('panel:'));
    assert.equal(frames.length, 2); assert.ok(frames[0].item.bounds.x > frames[1].item.bounds.x); assert.ok(frames[0].item.bounds.y < frames[1].item.bounds.y);
    assert.equal(new Set(result.entries.map(entry => entry.item.occurrence)).size, result.entries.length);
    assert.equal(fixture.document.views.length, 2);
    fixture.view.record.projection.options.panels[1].layout = { row: 0, column: 1 };
    assert.ok(completeProfileDiagnostics(view, entries).some(diagnostic => diagnostic.code === 'DDN-PANEL-OVERLAP'));
});

test('long canvas headings wrap inside their panel and leave room above its body cards', () => {
    for (const fontSize of [16, 24]) {
        const fixture = dataProfileFixture('canvas.bmc@1'), heading = 'CUSTOMER RELATIONSHIPS';
        fixture.document.definitions.find(record => record.id === 'cr').title = heading;
        fixture.bounds.width = 896;
        fixture.view.record.style = { font_size: fontSize };
        const measure = (text, size) => [...text].length * size * .6;
        const result = projectDataProfile(fixture.snapshot, fixture.view, fixture.bounds, fixture.effective, { measure });
        assert.deepEqual(result.unavailable, []);
        const panel = result.entries.find(entry => entry.definition.ref.id === 'cr').item;
        const frame = panel.primitives.find(primitive => primitive.kind === 'rect').bounds;
        const lines = panel.primitives.filter(primitive => primitive.kind === 'text').flatMap(primitive => primitive.runs);
        assert.equal(panel.accessible.label, heading);
        assert.ok(lines.length >= 1);
        assert.equal(lines.map(line => line.text).join(' '), heading);
        for (const line of lines) {
            assert.ok(line.x >= frame.x + 10);
            assert.ok(line.x + measure(line.text, line.style['font-size']) <= frame.x + frame.width - 10);
        }
        assert.ok(panel.clip.x + panel.clip.width < frame.x + frame.width + 6);
        const body = result.entries.find(entry => entry.definition.ref.id === 'idea' && entry.item.bounds.x > frame.x && entry.item.bounds.x < frame.x + frame.width && entry.item.bounds.y >= frame.y && entry.item.bounds.y < frame.y + frame.height);
        assert.ok(body.item.bounds.y > lines.at(-1).y + lines.at(-1).style['font-size'] / 4);
    }
});

test('unplaced narrow panel hints expand to retain readable accessible headings', () => {
    const fixture = dataProfileFixture('panels.basic@1');
    fixture.bounds.width = 30;
    for (const record of fixture.document.definitions.filter(record => record.metadata?.x_record?.items)) {
        record.title = 'Unabridged heading'; record.metadata.x_record.items = [];
    }
    const result = project(fixture);
    assert.deepEqual(result.unavailable, []);
    for (const entry of result.entries) {
        assert.equal(entry.item.accessible.label, 'Unabridged heading');
        const frame = entry.item.primitives.find(primitive => primitive.kind === 'rect').bounds;
        assert.ok(frame.width >= 230);
        const runs = entry.item.primitives.filter(primitive => primitive.kind === 'text').flatMap(primitive => primitive.runs);
        assert.equal(runs.map(run => run.text).join(' '), 'Unabridged heading');
        assert.ok(runs.every(run => run.x >= frame.x && run.x + run.text.length * run.style['font-size'] * .6 <= frame.x + frame.width));
    }
});

test('date candlesticks show calendar labels while retaining OHLC mark geometry', () => {
    const fixture = dataProfileFixture('chart.candlestick@1');
    fixture.document.data[0].rows[0][0] = '2026-03-02';
    fixture.document.data[0].rows[1][0] = '2026-03-03';
    const categorical = project(fixture);
    fixture.view.record.projection.options.x_type = 'date';
    const dated = project(fixture);
    assert.deepEqual(dated.unavailable, []);
    const axes = dated.entries.find(entry => entry.item.accessible.label === 'Chart axes');
    const labels = axes.item.primitives.filter(primitive => primitive.kind === 'text').flatMap(primitive => primitive.runs.map(run => run.text));
    assert.ok(labels.includes('2026-03-02')); assert.ok(labels.includes('2026-03-03'));
    assert.ok(labels.every(label => !/^\d{13}$/.test(label)));
    const marks = result => result.entries.filter(entry => entry.definition.owner === 'data');
    assert.deepEqual(marks(dated).map(entry => entry.item.primitives), marks(categorical).map(entry => entry.item.primitives));
    assert.deepEqual(marks(dated).map(entry => entry.item.hitTargets), marks(categorical).map(entry => entry.item.hitTargets));
    assert.ok(marks(dated)[0].item.accessible.label.startsWith('2026-03-02:'));
    assert.equal(marks(dated)[0].item.accessible.description, 'Open 4; high 9; low 2; close 7');
});
