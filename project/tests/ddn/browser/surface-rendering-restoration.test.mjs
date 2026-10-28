import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dataProfileFixture } from './data-profile-fixtures.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = process.env.DDN_BUILD_ROOT ?? resolve(root, '.work/builds/typescript');
const { projectDataProfile } = await import(pathToFileURL(join(output, 'ddn/packages/presentation/src/data-profiles.js')));
const textRuns = result => result.entries.flatMap(entry => entry.item.primitives.flatMap(p => p.kind === 'text' ? p.runs : []));
const visible = result => textRuns(result).map(run => run.text).join('\n');
const project = (f, extra = {}) => projectDataProfile(f.snapshot, f.view, f.bounds, f.effective, { projectChild(view, bounds) { return projectDataProfile(f.snapshot, view, bounds, view.record); }, ...extra });
const ref = id => ({ file: 'main.ddn', id });

for (const type of ['raci', 'crud', 'relations', 'heatmap', 'bcg', 'ansoff', 'tows', 'storymap']) {
    test(`${type} matrix keeps readable cell alignment, source links and compact content`, () => {
        const f = dataProfileFixture(`matrix.${type}@1`), r = project(f);
        assert.deepEqual(r.unavailable, []);
        assert.ok(r.bounds.height < 400, 'two matrix rows must not stretch to an empty viewport');
        const cell = r.entries.find(entry => entry.definition.ref.id === 'link00');
        const runs = textRuns({ entries: [cell] });
        assert.ok(runs.length && runs.every(run => run.style['text-anchor'] === 'middle' && run.style['font-weight'] === 600));
        assert.deepEqual(cell.item.hitTargets.map(hit => hit.target.id), ['row1', 'col1', 'link00']);
        assert.ok(r.entries.some(entry => entry.item.accessible.label === 'Matrix interpretation'));
    });
}
test('long relationship descriptions wrap and grow rows without losing the final words', () => {
    const f = dataProfileFixture('matrix.relations@1'); f.bounds.width = 520;
    const phrase = 'A relationship description with enough meaningful words to require several wrapped lines and retain its final conclusion';
    f.document.definitions.find(record => record.id === 'link00').metadata.x_record.value = phrase;
    const r = project(f), a = r.entries.find(entry => entry.definition.ref.id === 'link00'), b = r.entries.find(entry => entry.definition.ref.id === 'link10');
    assert.ok(a.item.bounds.height > b.item.bounds.height);
    assert.equal(textRuns({ entries: [a] }).map(run => run.text).join(' '), phrase);
    assert.ok(a.item.bounds.y + a.item.bounds.height <= b.item.bounds.y + .01);
});
test('heatmaps show quantitative ticks, category and band legends, and distinguish absent cells', () => {
    const f = dataProfileFixture('matrix.heatmap@1'); f.document.definitions = f.document.definitions.filter(record => record.id !== 'link11');
    f.view.record.projection.options.encoding = { mode: 'numeric', domain: { min: 0, max: 10 } };
    let r = project(f), legend = r.entries.find(entry => entry.item.accessible.label === 'Heatmap scale');
    assert.deepEqual(textRuns({ entries: [legend] }).map(run => run.text), ['0', '2.5', '5', '7.5', '10']);
    assert.match(visible(r), /— no record/);
    f.view.record.projection.options.encoding = { mode: 'threshold', boundaries: [0, 2, 10], colors: ['#112233', '#aabbcc'] };
    r = project(f); assert.match(visible(r), /0–2/); assert.match(visible(r), /2–10 inclusive/);
    f.view.record.projection.options.encoding.labels = ['Low', 'Action'];
    r = project(f); assert.match(visible(r), /Low · 1/); assert.match(visible(r), /Low \[0, 2\)/); assert.match(visible(r), /Action \[2, 10\]/);
    for (const record of f.document.definitions.filter(record => record.category === 'relation')) record.metadata.x_record.value = record.id === 'link00' ? 'Small' : 'Large';
    f.view.record.projection.options.encoding = { mode: 'categorical', labels: ['Small', 'Large'], colors: ['#112233', '#aabbcc'] };
    r = project(f); legend = r.entries.find(entry => entry.item.accessible.label === 'Heatmap scale');
    assert.deepEqual(textRuns({ entries: [legend] }).map(run => run.text), ['Small', 'Large']);
});
for (const profile of ['canvas.bmc@1', 'canvas.lean@1', 'canvas.pest@1', 'canvas.pestle@1', 'canvas.porter5@1', 'canvas.empathy@1', 'canvas.scorecard@1', 'panels.basic@1']) {
    test(`${profile} retains named content and panel separators without forced sticky-note styling`, () => {
        const f = dataProfileFixture(profile), note = f.document.definitions.find(record => record.id === 'idea');
        note.title = 'A named contribution'; note.content.text = 'Its explanatory body text';
        const r = project(f), occurrences = r.entries.filter(entry => entry.definition.ref.id === 'idea');
        assert.deepEqual(r.unavailable, []); assert.ok(occurrences.length);
        for (const entry of occurrences) {
            assert.match(visible({ entries: [entry] }), /A named contribution\nIts explanatory body text/);
            assert.ok(!entry.item.primitives.some(p => p.kind === 'rect' && p.paint.fill === '#fef3c7'));
            const frame = r.entries.find(panel => panel.definition.ref.id !== 'idea' && panel.item.bounds.x < entry.item.bounds.x && panel.item.bounds.x + panel.item.bounds.width > entry.item.bounds.x && panel.item.bounds.y < entry.item.bounds.y && panel.item.bounds.y + panel.item.bounds.height > entry.item.bounds.y);
            assert.ok(frame); assert.ok(entry.item.bounds.y + entry.item.bounds.height <= frame.item.bounds.y + frame.item.bounds.height);
            assert.ok(frame.item.primitives.some(p => p.kind === 'path'), 'separate heading from body');
        }
        if (profile === 'canvas.bmc@1' || profile === 'canvas.lean@1') assert.ok(r.bounds.width >= 2400, 'ten unit columns retain readable five-column canvas');
    });
}
test('composed panels allocate natural child extents before clipping', () => {
    const f = dataProfileFixture('panels.composed@1'); let calls = 0;
    const r = project(f, { projectChild(view, bounds) {
        calls++;
        const b = { ...bounds, width: 1600, height: 800 }, item = { occurrence: 'large-child', target: view.ref, view: view.ref, layer: 'content', bounds: b, transform: [1, 0, 0, 1, 0, 0], primitives: [{ kind: 'rect', bounds: b, paint: { fill: '#fff' } }], hitTargets: [], accessible: { role: 'graphics-symbol', label: 'Natural child' }, evidence: 'current' };
        return { bounds: b, entries: [{ item, definition: view, view, effective: view.record }], diagnostics: [], unavailable: [] };
    } });
    assert.equal(calls, 2); assert.ok(r.bounds.width >= 1636); assert.ok(r.bounds.height > 850);
    const child = r.entries.find(entry => entry.item.occurrence.includes('large-child')).item;
    assert.ok(child.clip.x <= child.bounds.x && child.clip.x + child.clip.width >= child.bounds.x + child.bounds.width);
    assert.ok(child.clip.y + child.clip.height >= child.bounds.y + child.bounds.height);
});
test('journey emotions have one 1–5 scale and measurements without duplicate note cards', () => {
    const f = dataProfileFixture('panels.journey@1'), r = project(f), curve = r.entries.find(entry => entry.item.accessible.label === 'Declared journey emotions');
    assert.deepEqual(r.unavailable, []);
    const labels = textRuns({ entries: [curve] }).map(run => run.text);
    assert.deepEqual(labels.slice(0, 5), ['1', '2', '3', '4', '5']); assert.deepEqual(labels.slice(5), ['2', '5']);
    assert.deepEqual(curve.item.hitTargets.map(hit => hit.target.id), ['emotion-discover', 'emotion-use']);
    assert.ok(!r.entries.some(entry => entry.definition.ref.id.startsWith('emotion-')));
    assert.ok(curve.item.primitives.filter(p => p.kind === 'ellipse').every(p => p.bounds.y >= curve.item.bounds.y && p.bounds.y + p.bounds.height <= curve.item.bounds.y + curve.item.bounds.height));
});
test('pyramid top band is flat, labels are centred, and named notes remain in the extent', () => {
    const f = dataProfileFixture('panels.pyramid@1'), r = project(f), band = r.entries.find(entry => entry.definition.ref.id === 'foundation');
    const path = band.item.primitives.find(p => p.kind === 'path'), coordinates = path.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert.ok(coordinates[2] > coordinates[0], 'top band has a nonzero top edge'); assert.equal(path.paint['fill-opacity'], .18); assert.notEqual(path.paint.stroke, '#fff');
    const title = textRuns({ entries: [band] })[0]; assert.equal(title.style['text-anchor'], 'middle');
    assert.ok(title.y > band.item.bounds.y + band.item.bounds.height * .4);
    const note = r.entries.find(entry => entry.definition.ref.id === 'idea'); assert.match(visible({ entries: [note] }), /idea: An authored idea/);
    assert.ok(note.item.bounds.x + note.item.bounds.width <= r.bounds.x + r.bounds.width);
});
test('three-set Venn titles sit outside the overlapping region including the lower set', () => {
    const f = dataProfileFixture('panels.venn@1');
    f.document.definitions.push({ id: 'third', name: 'third', title: 'Third set', category: 'element', role: 'note', metadata: { x_record: { row: 2, column: 0, items: [] } } });
    f.view.record.projection.options.panels.push({ target: ref('third'), kind: 'text' });
    const r = project(f), third = r.entries.find(entry => entry.definition.ref.id === 'third'), circle = third.item.primitives.find(p => p.kind === 'ellipse'), title = textRuns({ entries: [third] })[0];
    assert.deepEqual(r.unavailable, []); assert.ok(title.y > circle.bounds.y + circle.bounds.height); assert.equal(title.style['text-anchor'], 'middle');
    assert.ok(r.entries.some(entry => entry.item.accessible.label === 'Declared membership 3: 1'));
});
test('timeline includes intermediate dates, aligned row guides, and calendar semantics', () => {
    const f = dataProfileFixture('timeline.basic@1'), r = project(f), axis = r.entries.find(entry => entry.item.accessible.label === 'Timeline axis');
    const dates = textRuns({ entries: [axis] }).map(run => run.text);
    assert.ok(dates.length >= 4); assert.equal(dates[0], '2026-10-01'); assert.equal(dates.at(-1), '2026-10-12');
    assert.match(visible(r), /UTC.*end-exclusive/); assert.ok(r.bounds.height < 250);
    for (const entry of r.entries.filter(entry => entry.definition.owner === 'data')) assert.ok(entry.item.primitives.some(p => p.kind === 'path' && p.paint.stroke === '#e2e8f0'));
});
test('decision display uses human names and predicates with independently computed coverage', () => {
    const f = dataProfileFixture('decision.rules@1'), input = f.document.definitions.find(record => record.id === 'age'), rule = f.document.definitions.find(record => record.id === 'adult');
    input.title = 'Customer age'; rule.title = 'Adult customer';
    f.document.definitions.push({ ...structuredClone(rule), id: 'child', name: 'child', title: 'Young customer', metadata: { x_rule: { inputs: { age: { op: 'interval', min: 0, max: 18, include_max: false } }, outputs: { result: 'no' } } } });
    f.view.record.projection.options.records.push(ref('child'));
    let r = project(f), content = visible(r);
    assert.match(content, /If Customer age/); assert.match(content, /Adult customer/); assert.match(content, /\[18, 100\]/); assert.doesNotMatch(content, /"op"/);
    assert.match(content, /Coverage complete/); assert.match(content, /No uncovered atom/); assert.match(content, /Partition analysis tested/);
    f.view.record.projection.options.analysis_budget = 1;
    r = project(f); assert.match(visible(r), /budget exceeded/); assert.doesNotMatch(visible(r), /Coverage complete|No uncovered atom/);
});

test('repeated text panel occurrences retain independent titles and layout', () => {
    const f = dataProfileFixture('panels.basic@1');
    f.view.record.projection.options.panels = [{ target: ref('first'), kind: 'text', title: 'First presentation', layout: { row: 0, column: 0 } }, { target: ref('first'), kind: 'text', title: 'Second presentation', layout: { row: 1, column: 0 } }];
    const r = project(f), frames = r.entries.filter(entry => entry.definition.ref.id === 'first');
    assert.deepEqual(r.unavailable, []);
    assert.deepEqual(frames.map(entry => textRuns({ entries: [entry] }).map(run => run.text).join(' ')), ['First presentation', 'Second presentation']);
    assert.ok(frames[1].item.bounds.y > frames[0].item.bounds.y + frames[0].item.bounds.height);
});

test('decision first-hit footer reports proven shadowing and keeps exhausted analysis unknown', () => {
    const f = dataProfileFixture('decision.rules@1'), options = f.view.record.projection.options;
    options.hit_policy = 'first';
    f.document.definitions.push({ id: 'default', name: 'default', title: 'Default review', category: 'element', role: 'rule.row', metadata: { x_rule: { inputs: {}, outputs: { result: 'no' } } } }, { id: 'young', name: 'young', title: 'Young customer', category: 'element', role: 'rule.row', metadata: { x_rule: { inputs: { age: { op: 'lt', value: 18 } }, outputs: { result: 'yes' } } } });
    options.records.push(ref('default'), ref('young'));
    assert.match(visible(project(f)), /Shadowed first-hit rules: 1\./);
    options.analysis_budget = 1;
    assert.match(visible(project(f)), /Shadowed first-hit rules: unknown/);
    assert.doesNotMatch(visible(project(f)), /Shadowed first-hit rules: [0-9]/);
});
