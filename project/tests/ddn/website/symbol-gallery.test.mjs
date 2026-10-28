import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const output = process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const load = name => import(pathToFileURL(resolve(output, `ddn/packages/${name}/src/index.js`)));
const { createRuntime, createCompleteRuntimeOptions } = await load('runtime');
const { projectSnapshot } = await load('presentation');
const { resolveProperties } = await load('defaults');
async function review(file, inspect) {
    const runtime = createRuntime(createCompleteRuntimeOptions());
    try {
        const opened = await runtime.open({ entry: file, files: [{ id: file, text: await readFile(resolve('website', file), 'utf8'), revision: '1', encoding: 'utf-8', writable: true }] });
        assert.ok(opened.snapshot, JSON.stringify(opened.diagnostics));
        assert.deepEqual(opened.diagnostics.filter(d => d.severity === 'error'), []);
        const scene = projectSnapshot(opened.snapshot, { resolve: (target, context) => resolveProperties(opened.snapshot, target, context) });
        assert.equal(scene.coverage.complete, true, JSON.stringify(scene.diagnostics));
        inspect(scene);
    } finally { runtime.destroy(); }
}
const image = entry => entry.item.primitives.find(p => p.kind === 'image');
const words = entry => entry.item.primitives.flatMap(p => p.kind === 'text' ? p.runs.map(run => run.text) : []);

test('electrical gallery renders thirteen symbols at real size without card decoration or generic wire labels', async () => {
    await review('examples/basics/105-electrical-symbols.ddn', scene => {
        const symbols = scene.entries.filter(entry => entry.definition.record.metadata?.x_icon?.library === 'electrical-common@1');
        assert.equal(symbols.length, 13);
        for (const symbol of symbols) {
            assert.ok(symbol.item.primitives.every(p => p.kind === 'image' || p.kind === 'text'));
            assert.equal(words(symbol).join(' '), symbol.definition.ref.id.endsWith('.r1') ? 'R1 · 1 kΩ / 0.25 W' : '');
            assert.equal(image(symbol).bounds.width, 72);
            assert.equal(image(symbol).bounds.height, 72);
        }
        const relations = scene.entries.filter(entry => entry.definition.record.category === 'relation');
        assert.equal(relations.length, 11);
        assert.ok(relations.every(relation => words(relation).length === 0));
        for (const relation of relations) {
            const wire = relation.item.primitives.find(p => p.kind === 'path');
            assert.equal((wire.d.match(/M/g) ?? []).length, 1, 'shared ground terminal paths must stay visibly continuous');
        }
        const bat = symbols.find(entry => entry.definition.ref.id.endsWith('.bat'));
        const sw = symbols.find(entry => entry.definition.ref.id.endsWith('.sw'));
        assert.equal(image(bat).bounds.y + 36, image(sw).bounds.y + 54, 'different SVG lead heights align on the same wire');
    });
});

test('all icon-library examples use their selected artwork as the element', async () => {
    for (const name of ['98-icons', '102-vsm-symbols', '103-network-symbols', '104-pid-symbols', '106-tabler-icons', '107-iconoir-icons']) {
        await review(`examples/basics/${name}.ddn`, scene => {
            const selected = scene.entries.filter(entry => entry.definition.owner === 'definition' && entry.appearance?.record.symbol?.image);
            assert.ok(selected.length > 0, name);
            if (['98-icons', '103-network-symbols', '106-tabler-icons', '107-iconoir-icons'].includes(name)) {
                const boxes = selected.map(entry => entry.item.bounds);
                const width = Math.max(...boxes.map(b => b.x + b.width)) - Math.min(...boxes.map(b => b.x));
                const height = Math.max(...boxes.map(b => b.y + b.height)) - Math.min(...boxes.map(b => b.y));
                assert.ok(width > height, name + ': review topology must not collapse into one tall column');
            }
            for (const entry of selected) {
                assert.ok(image(entry), `${name}: ${entry.definition.ref.id}`);
                assert.ok(entry.item.primitives.every(p => p.kind === 'image' || p.kind === 'text'), `${name}: artwork must not acquire a card or status-dot`);
                assert.ok(image(entry).bounds.width >= 72, `${name}: the image must not remain a tiny badge`);
            }
        });
    }
});

test('human-review image example preserves all label placements, image aspect and unboxed linked notes', async () => {
    await review('examples/appearance/symbols.ddn', scene => {
        const labels = scene.entries.filter(entry => entry.view?.ref.id === 'LabelPositions' && image(entry));
        assert.equal(labels.length, 9);
        assert.deepEqual(new Set(labels.map(entry => entry.definition.record.symbol.label)), new Set(['top-left', 'top', 'top-right', 'left', 'none', 'right', 'bottom-left', 'bottom', 'bottom-right']));
        assert.deepEqual(words(labels.find(entry => entry.definition.record.symbol.label === 'none')), []);
        const sample = scene.entries.filter(entry => entry.view?.ref.id === 'ImageSymbols');
        const office = sample.find(entry => entry.definition.record.name === 'Office');
        assert.ok(Math.abs(image(office).bounds.width / image(office).bounds.height - 163 / 293.7) < 1e-9);
        const notes = sample.filter(entry => entry.definition.record.role === 'note' && entry.definition.record.category !== 'relation');
        assert.equal(notes.length, 2);
        for (const note of notes) {
            assert.ok(note.item.primitives.length > 0);
            assert.ok(note.item.primitives.every(p => p.kind === 'text'));
        }
        assert.equal(sample.filter(entry => entry.definition.record.category === 'relation' && entry.definition.record.role === 'note').length, 2);
    });
});
