import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dataProfileFixture } from './data-profile-fixtures.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = process.env.DDN_BUILD_ROOT ?? resolve(root, '.work/builds/typescript');
const load = path => import(pathToFileURL(join(output, `ddn/packages/${path}.js`)));
const { projectDataProfile } = await load('presentation/src/data-profiles');
const { histogramBins } = await load('presentation/src/data-statistics');
const { completeProfileDiagnostics, indexRecords, validateSchema } = await load('profiles/src/index');
const project = (f, options) => projectDataProfile(f.snapshot, f.view, f.bounds, f.effective, options);
const primitives = r => r.entries.flatMap(entry => entry.item.primitives);
const text = r => primitives(r).filter(p => p.kind === 'text').flatMap(p => p.runs).map(run => run.text).join(' ');
const measured = r => r.entries.filter(entry => entry.definition.owner === 'data');

test('histogram boundaries include exact edges once without moving adjacent representable values', () => {
    const bins = histogramBins([30, 44.99999999999999, 45, 45.00000000000001, 89.99999999999999, 90, 150], 8, [30, 150]);
    assert.deepEqual(bins.map(bin => bin.indices), [[0, 1], [2, 3], [], [4], [5], [], [], [6]]);
    assert.equal(bins.reduce((total, bin) => total + bin.count, 0), 7);
});

test('category point charts retain labels and numeric scatter remains valid throughout the contract', () => {
    for (const numeric of [false, true]) {
        const f = dataProfileFixture('chart.basic@1');
        Object.assign(f.view.record.projection.options, { mark: 'point', x_type: numeric ? 'number' : 'category' });
        f.document.data[0].rows = numeric ? [[1, 3], [2, 7]] : [['Q1', 3], ['Q2', 7]];
        const entries = indexRecords(f.snapshot.normalized), view = entries.find(entry => entry.ref.id === 'view');
        assert.deepEqual(validateSchema('bundle', f.snapshot.normalized), []);
        assert.deepEqual(completeProfileDiagnostics(view, entries), []);
        const r = project(f); assert.deepEqual(r.unavailable, []);
        assert.equal(measured(r).length, 2);
        if (!numeric) { assert.match(text(r), /Q1/); assert.match(text(r), /Q2/); }
    }
});

test('line/area share a zero baseline, retain series legend and mark line observations', () => {
    for (const mark of ['line', 'area']) {
        const f = dataProfileFixture('chart.quality@1');
        Object.assign(f.view.record.projection.options, { mark, unit: 'MWh' });
        const r = project(f), axis = r.entries.find(e => e.item.accessible.label === 'Chart axes');
        assert.match(text(r), /MWh/); assert.ok(r.entries.some(e => e.item.accessible.label === 'Legend'));
        assert.ok(axis.item.primitives.some(p => p.kind === 'text' && p.runs.some(run => run.text === '0')));
        const paths = measured(r).flatMap(e => e.item.primitives).filter(p => p.kind === 'path');
        assert.ok(paths.some(p => p.paint['stroke-dasharray']));
        if (mark === 'line') assert.equal(measured(r).flatMap(e => e.item.primitives).filter(p => p.kind === 'ellipse').length, 6);
    }
});

test('arc direction controls upper/lower semicircles with an axis and per-link colors', () => {
    const f = dataProfileFixture('chart.arc@1');
    f.document.data[0].rows = [['A', 'B', 3], ['B', 'A', 2], ['A', 'C', 1]];
    const r = project(f), edges = measured(r).filter(e => e.item.accessible.label.includes('→'));
    assert.deepEqual(r.unavailable, []); assert.equal(edges.length, 3);
    assert.ok(r.entries.some(e => e.item.accessible.label === 'Arc node axis'));
    const d = edges.map(e => e.item.primitives[0].d);
    assert.ok(d.every(path => / 0 0 1 /.test(path)));
    const endpoint = path => path.match(/^M([^,]+),([^A]+)A.+ 0 0 1 ([^,]+),(.+)$/).slice(1).map(Number);
    const first = endpoint(d[0]), second = endpoint(d[1]);
    assert.ok(first[0] < first[2]); assert.ok(second[0] > second[2]);
    assert.equal(new Set(edges.map(e => e.item.primitives[0].paint.stroke)).size, 3);
    assert.match(text(r), /arc thickness encodes value/);
});

test('edge bundles use smooth ancestor curves and terminal names remain readable', () => {
    const f = dataProfileFixture('chart.edgebundle@1'), r = project(f);
    const edges = measured(r).filter(e => e.item.accessible.label.includes('→'));
    assert.ok(edges.every(e => /Q/.test(e.item.primitives[0].d)));
    assert.equal(new Set(edges.map(e => e.item.primitives[0].paint.stroke)).size, 3);
    const leaf = measured(r).find(e => e.item.accessible.label === 'root.A');
    assert.ok(leaf.item.primitives.some(p => p.kind === 'text' && p.runs[0].text === 'A'));
    assert.equal(leaf.item.primitives.find(p => p.kind === 'ellipse').bounds.width, 7);
});

test('funnel stages join with trapezoids and gauge retains calibrated bands, needle and target', () => {
    const f = dataProfileFixture('chart.funnel@1'); f.document.data[0].rows = [['Visitors', 1000], ['Started', 600], ['Completed', 20]];
    f.view.record.projection.options.unit = 'users';
    const funnel = project(f), shapes = measured(funnel).map(e => e.item.primitives[0]);
    assert.ok(shapes.every(p => p.kind === 'path' && p.d.endsWith('Z')));
    assert.match(text(funnel), /1,000 users/);
    const g = dataProfileFixture('chart.gauge@1'), gauge = project(g), marks = measured(gauge)[0].item.primitives;
    assert.equal(marks.filter(p => p.kind === 'path' && p.d.includes('A')).length, 4);
    assert.ok(['0', '25', '50', '75', '100'].every(value => marks.some(p => p.kind === 'text' && p.runs[0].text === value)));
    assert.equal(marks.filter(p => p.kind === 'path' && !p.d.includes('A')).length, 2);
});

test('hierarchies expose named roots, sector labels, parent headers and circle area semantics', () => {
    for (const mark of ['tidytree', 'radialtree']) {
        const r = project(dataProfileFixture(`chart.${mark}@1`));
        assert.ok(!measured(r).some(e => e.item.accessible.label === 'root' || e.item.accessible.label.startsWith('root →')));
        assert.ok(measured(r).some(e => e.item.accessible.label === 'A'));
    }
    const sun = project(dataProfileFixture('chart.sunburst@1'));
    for (const name of ['A', 'one', 'two', 'B', 'three', 'four']) assert.ok(primitives(sun).some(p => p.kind === 'text' && p.runs[0].text === name));
    const f = dataProfileFixture('chart.treemap@1'); f.view.record.projection.options.unit = 'EUR';
    const treemap = project(f), group = measured(treemap).find(e => e.item.accessible.label === 'A: 10'), leaf = measured(treemap).find(e => e.item.accessible.label === 'A.one: 3');
    assert.ok(leaf.item.bounds.y >= group.item.bounds.y + 24); assert.match(text(treemap), /3 EUR/); assert.match(text(treemap), /A: 10 EUR/);
    for (const mark of ['circlepack', 'packedbubble']) {
        const r = project(dataProfileFixture(`chart.${mark}@1`)), nodes = measured(r).filter(e => e.item.primitives.some(p => p.kind === 'ellipse'));
        const a = nodes.find(e => e.item.accessible.label === 'A.one: 3').item.primitives[0].bounds, b = nodes.find(e => e.item.accessible.label === 'A.two: 7').item.primitives[0].bounds;
        assert.ok(Math.abs(a.width ** 2 / b.width ** 2 - 3 / 7) < 1e-10);
        const aTotal = r.entries.find(e => e.item.accessible.label === 'A total'), bTotal = r.entries.find(e => e.item.accessible.label === 'B total');
        assert.ok(aTotal.item.bounds.x < bTotal.item.bounds.x);
    }
});

test('sample plots include statistical context without a fictitious quantile y-axis', () => {
    for (const [mark, expected] of [['histogram', /count/], ['density', /bandwidth/], ['qq', /Theoretical normal quantiles/], ['quantiledot', /equal-probability quantiles/], ['boxplot', /n=5/], ['violin', /n=5/]]) {
        const f = dataProfileFixture(`chart.${mark}@1`); f.view.record.projection.options.unit = 'ms';
        const r = project(f); assert.match(text(r), expected); assert.match(text(r), /ms/);
        if (mark === 'quantiledot') assert.ok(!r.entries.some(e => e.item.accessible.label === 'Chart axes'));
        if (mark === 'density') assert.ok(measured(r).some(e => e.item.primitives.some(p => p.kind === 'path' && p.paint.fill !== 'none' && p.paint['fill-opacity'] < 1)));
    }
});

test('dotplot only dodges equal measurements while beeswarm avoids nearby dot collisions', () => {
    const rows = [['A', 0], ['A', 0.01], ['A', 0.01], ['A', 100]];
    const centers = mark => { const f = dataProfileFixture(`chart.${mark}@1`); f.document.data[0].rows = rows; return measured(project(f)).map(e => e.item.primitives.find(p => p.kind === 'ellipse')).map(p => p.bounds.x + p.bounds.width / 2); };
    const dot = centers('dotplot'), swarm = centers('beeswarm');
    assert.equal(dot[0], dot[3]); assert.equal((dot[1] + dot[2]) / 2, dot[0]); assert.notEqual(dot[1], dot[2]); assert.notEqual(swarm[0], swarm[1]);
});

test('density, heatmap and calendar expose their coordinate/intensity scales', () => {
    const density = project(dataProfileFixture('chart.densityheatmap@1'));
    assert.ok(density.entries.some(e => e.item.accessible.label === 'Density heatmap axes')); assert.match(text(density), /observations \/ bin/);
    const calendar = project(dataProfileFixture('chart.calendar@1'));
    for (const label of ['Mon', 'Sun', 'Oct 2026', 'Monday-first']) assert.ok(text(calendar).includes(label));
    assert.ok(measured(calendar).every(e => e.item.primitives[0].bounds.width <= 28));
    const heat = project(dataProfileFixture('chart.heatmap@1'));
    assert.ok(heat.entries.some(e => e.item.accessible.label === 'Intensity scale')); assert.match(text(heat), /missing category\/series pairs are blank/);
});

test('word colors survive standard text defaults while authored text overrides remain authoritative', () => {
    const f = dataProfileFixture('chart.wordcloud@1'); f.effective = { ...f.effective, text: { color: '#000000' } };
    const resolve = origin => () => ({ values: f.effective, properties: [{ path: 'text.color', value: '#000000', origin }] });
    const standard = project(f, { resolve: resolve('standard:definition') });
    assert.equal(new Set(measured(standard).map(e => e.item.primitives[0].runs[0].style.fill)).size, 3);
    assert.ok(measured(standard).every(e => e.item.primitives[0].runs[0].style['font-weight'] === 700));
    const authored = project(f, { resolve: resolve('file:view') });
    assert.ok(measured(authored).every(e => e.item.primitives[0].runs[0].style.fill === '#000000'));
});

test('geographic symbols normalize area to a visible maximum and retain value/intensity legends', () => {
    const f = dataProfileFixture('geo.symbols@1'), r = project(f), sizes = measured(r).map(e => e.item.primitives[0].bounds.width);
    assert.deepEqual(sizes, [24, 32]); assert.ok(r.entries.some(e => e.item.accessible.label === 'Symbol area scale'));
    assert.match(text(project(dataProfileFixture('geo.choropleth@1'))), /2 → 6/);
    assert.match(text(project(dataProfileFixture('geo.outline@1'))), /2 geographic features/);
});

test('isometric area uses one upper-edge ribbon so translucent front fill does not accumulate opacity', () => {
    const f = dataProfileFixture('chart.basic@1'); Object.assign(f.view.record.projection.options, { mark: 'area', iso: true, depth: 20 });
    const r = project(f), faces = measured(r), side = faces.filter(e => e.item.occurrence.includes(':depth'));
    assert.equal(side.length, 1); assert.ok(side[0].item.primitives[0].d.endsWith('Z'));
    const top = faces.find(e => !e.item.occurrence.includes(':depth'));
    assert.equal(top.item.primitives[0].paint['fill-opacity'], .2); assert.ok(side[0].item.bounds.y < top.item.bounds.y);
});

test('default matrix ramps honor ordered categorical labels while explicit colors remain exact', async () => {
    const { matrixEncoding } = await load('presentation/src/data-encoding');
    const ramp = matrixEncoding({ mode: 'categorical', labels: ['Good', 'Monitor', 'Action'], scale: 'blue' }, []);
    assert.equal(ramp('Good'), 'rgb(229,240,251)'); assert.equal(ramp('Action'), 'rgb(34,87,132)');
    const custom = matrixEncoding({ mode: 'categorical', labels: ['Good', 'Action'], colors: ['#123456', '#abcdef'] }, []);
    assert.equal(custom('Action'), '#abcdef');
});

test('narrow treemap tiles wrap complete labels and values without bleeding into adjacent tiles', () => {
    const f = dataProfileFixture('chart.treemap@1');
    f.document.data[0].rows = [['billing/invoices', 80], ['operations/turbine-logs', 800]];
    f.view.record.projection.options.unit = 'GB';
    const r = project(f), tile = measured(r).find(e => e.item.accessible.label === 'billing/invoices: 80');
    const runs = tile.item.primitives.filter(p => p.kind === 'text').flatMap(p => p.runs);
    assert.equal(runs.map(run => run.text).join('').replace(/\s/g, ''), 'billing/invoices:80GB');
    assert.ok(runs.every(run => run.x >= tile.item.bounds.x && run.x + run.text.length * 11 * .6 <= tile.item.bounds.x + tile.item.bounds.width));
});

test('isometric walls sit above axes and behind every quantitative front face', () => {
    const f = dataProfileFixture('chart.basic@1'); Object.assign(f.view.record.projection.options, { iso: true, depth: 20 });
    const r = project(f), axis = r.entries.findIndex(e => e.item.accessible.label === 'Chart axes');
    const walls = r.entries.map((e, i) => e.item.occurrence.includes(':depth') ? i : -1).filter(i => i >= 0);
    const fronts = r.entries.map((e, i) => e.definition.owner === 'data' && !e.item.occurrence.includes(':depth') ? i : -1).filter(i => i >= 0);
    assert.ok(axis < Math.min(...walls)); assert.ok(Math.max(...walls) < Math.min(...fronts));
});

test('geographic size scaling supports subunit values and unbound location markers', () => {
    const f = dataProfileFixture('geo.symbols@1'); f.document.data[0].rows[0][2] = .09; f.document.data[0].rows[1][2] = .16;
    assert.deepEqual(measured(project(f)).map(e => e.item.primitives[0].bounds.width), [24, 32]);
    delete f.view.record.projection.options.size;
    const unbound = project(f); assert.deepEqual(measured(unbound).map(e => e.item.primitives[0].bounds.width), [8, 8]);
    assert.ok(!unbound.entries.some(e => e.item.accessible.label === 'Symbol area scale'));
});

test('candlestick exports explain body, wick and direction encodings below the measured candles', () => {
    const f = dataProfileFixture('chart.candlestick@1'), r = project(f);
    const explanation = r.entries.find(e => e.item.primitives.some(p => p.kind === 'text' && p.runs.some(run => run.text.includes('OHLC:'))));
    assert.ok(explanation); assert.notEqual(explanation.definition.owner, 'data');
    const words = explanation.item.primitives.filter(p => p.kind === 'text').flatMap(p => p.runs).map(run => run.text).join(' ');
    for (const meaning of ['open to close', 'low to high', 'green', 'brown']) assert.ok(words.includes(meaning));
    assert.ok(measured(r).every(e => e.item.bounds.y + e.item.bounds.height < explanation.item.bounds.y));
});
