import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const { decoratePaper } = await import(pathToFileURL(join(root, '.work/builds/ddn/ddn/packages/presentation/src/stationery.js')));
const ref = id => ({ file: 'paper.ddn', id });
function fixture(effective = {}, matrix = [1, 0, 0, 1, 0, 0]) {
    const bounds = { x: matrix[4], y: matrix[5], width: 240 * matrix[0], height: 160 * matrix[3] };
    const definition = { ref: ref('Note'), file: 'paper.ddn', owner: 'definition', record: { id: 'Note', category: 'element', role: 'note', design: { state: 'accepted' } } };
    const text = { kind: 'text', runs: [{ text: 'The content remains editable', x: 12, y: 48, fontKey: 'sans', style: { fill: '#172230', 'font-size': 16 } }] };
    return { definition, view: { ref: ref('Board') }, effective, item: { occurrence: 'note:one', target: definition.ref, view: ref('Board'), layer: 'content', bounds, transform: matrix, primitives: [{ kind: 'rect', bounds: { x: 0, y: 0, width: 240, height: 160 }, paint: { fill: '#fff4a8', stroke: '#34444b', 'stroke-width': 1.5 } }, text], hitTargets: [{ id: 'note:one', target: definition.ref, bounds }], accessible: { role: 'graphics-symbol', label: 'Note', description: 'Accepted note' }, status: 'accepted', evidence: 'current' } };
}
const generated = entry => entry.item.primitives.filter(primitive => primitive.paint?.['ddn-decoration']);
const contains = (outer, inner) => inner.x >= outer.x - 1e-8 && inner.y >= outer.y - 1e-8 && inner.x + inner.width <= outer.x + outer.width + 1e-8 && inner.y + inner.height <= outer.y + outer.height + 1e-8;

test('omitted effects preserve the exact scene and existing status', () => {
    const entry = fixture();
    assert.equal(decoratePaper(entry), entry);
    assert.equal(decoratePaper(fixture({ shadow: null })).item.status, 'accepted');
    const disabled = fixture({ shadow: { kind: 'none', blur: 40 }, style: { paper: 'plain' } });
    assert.equal(decoratePaper(disabled), disabled);
});

test('paper shadows have distinct silhouettes and preserve semantic outlines and hit targets', () => {
    const paths = [];
    for (const kind of ['offset', 'centre', 'corners', 'corner']) {
        const entry = fixture({ shadow: { kind, color: '#572140', opacity: .37, blur: 8, spread: 3, lift: 16 } }), original = structuredClone(entry);
        const result = decoratePaper(entry), shadow = generated(result).find(primitive => primitive.paint['ddn-decoration'] === 'shadow');
        paths.push(shadow.d);
        assert.deepEqual(entry, original);
        assert.equal(result.item.hitTargets, entry.item.hitTargets);
        assert.equal(result.item.target, entry.item.target);
        assert.ok(result.item.primitives.includes(entry.item.primitives[0]));
        assert.equal(shadow.paint.fill, '#572140'); assert.equal(shadow.paint.opacity, .37); assert.equal(shadow.paint.blur, 8);
        assert.ok(contains(result.item.bounds, entry.item.bounds));
        assert.equal(result.item.accessible, entry.item.accessible);
    }
    assert.equal(new Set(paths).size, 4);
});

test('raised centre and corners use bottom silhouettes rather than a uniform halo', () => {
    for (const kind of ['centre', 'corners']) {
        const result = decoratePaper(fixture({ shadow: { kind, lift: 24, blur: 3.5 } }));
        const shapes = generated(result).filter(primitive => primitive.paint['ddn-decoration'] === 'shadow');
        assert.equal(shapes.length, 2, 'each silhouette has separate grounded contact strokes');
        const firstPoint = shapes[0].d.match(/^M([^,]+),([^H]+)/);
        assert.ok(Number(firstPoint[2]) > 120, 'the shadow silhouette begins near the lower edge');
        assert.equal(shapes[1].paint.fill, 'none');
        assert.ok(shapes[1].paint.blur < shapes[0].paint.blur);
    }
    const corner = decoratePaper(fixture({ shadow: { kind: 'corner', lift: 24, blur: 0 } }));
    assert.ok(corner.item.bounds.x + corner.item.bounds.width >= 258, 'one raised corner casts beyond the right edge');
});

test('existing offset shadow records retain displacement, spread and blur bounds', () => {
    const entry = fixture({ shadow: { x: -20, y: 35, blur: 10, spread: 5, color: '#000000' } });
    const result = decoratePaper(entry);
    assert.ok(result.item.bounds.x <= -55);
    assert.ok(result.item.bounds.y <= 0);
    assert.ok(result.item.bounds.y + result.item.bounds.height >= 230);
    assert.equal(result.item.hitTargets[0].bounds.width, 240);
    const distant = decoratePaper(fixture({ shadow: { x: 5000, y: -4000, blur: 0, spread: 0 } }));
    assert.ok(distant.item.bounds.x + distant.item.bounds.width >= 5240, 'existing coordinate bounds must not silently clamp at decoration sizes');
    assert.equal(distant.item.bounds.y, -4000);
});

test('note and pad appearances preserve text, opacity and inherited fill alpha', () => {
    for (const paper of ['note', 'pad']) {
        const entry = fixture({ style: { paper }, background: { color: '#34ab7880' } }), original = structuredClone(entry);
        const result = decoratePaper(entry);
        assert.deepEqual(entry, original);
        assert.equal(result.item.primitives.at(-1), entry.item.primitives.at(-1));
        assert.ok(generated(result).some(primitive => primitive.paint.fill === '#34ab7880'));
        for (const primitive of generated(result)) {
            const fill = primitive.paint.fill;
            if (fill?.startsWith('#')) assert.equal(fill.slice(-2), '80');
        }
        assert.equal(result.item.status, 'accepted');
        assert.equal(decoratePaper(result), result, 'nested projection must not duplicate effects');
    }
    const clear = decoratePaper(fixture({ style: { paper: 'pad' }, background: { color: 'transparent' } }));
    assert.ok(generated(clear).every(primitive => primitive.paint.fill === 'transparent'));
});

test('handdrawn paper keeps its authored sketch outline and editable text', () => {
    const entry = fixture({ style: { paper: 'pad', look: 'handdrawn' }, background: { color: '#e1c5f1' }, shadow: { kind: 'corners' } });
    const outline = { kind: 'path', d: 'M0 0 L240 1 L239 160 L1 159 Z', paint: { fill: '#fff', stroke: '#34444b', 'stroke-width': 1.5 } };
    entry.item.primitives[0] = outline;
    const result = decoratePaper(entry), papers = generated(result).filter(primitive => primitive.paint['ddn-decoration'] === 'paper');
    assert.ok(papers.some(primitive => primitive.d === outline.d && primitive.paint.fill === '#e1c5f1'));
    assert.ok(papers.some(primitive => primitive.d === outline.d && primitive.paint.fill === 'none' && primitive.paint.stroke === '#34444b'));
    assert.ok(result.item.primitives.includes(entry.item.primitives[1]));
    assert.equal(result.item.hitTargets, entry.item.hitTargets);
    assert.ok(result.item.bounds.x + result.item.bounds.width >= 247, 'stacked sheets remain visible');
    assert.equal(entry.item.primitives[0], outline);
});

test('all five attachment kinds use configurable vector colours without external assets', () => {
    const patterns = [];
    for (const kind of ['push-pin', 'round-pin', 'paper-clip', 'binder-clip', 'tape']) {
        const entry = fixture({ decorations: [{ kind, color: '#a844c2', opacity: .7 }] }), result = decoratePaper(entry);
        const parts = generated(result);
        assert.ok(parts.length > 2);
        assert.ok(parts.every(primitive => primitive.kind === 'path' && primitive.paint['ddn-decoration'] === 'attachment'));
        assert.ok(parts.some(primitive => primitive.paint.fill === '#a844c2' || primitive.paint.stroke === '#a844c2'));
        assert.ok(parts.every(primitive => primitive.paint.opacity <= .7));
        assert.doesNotMatch(JSON.stringify(parts), /url\(|data:|https?:|NaN|Infinity/);
        assert.equal(result.item.hitTargets, entry.item.hitTargets);
        patterns.push(parts.map(primitive => primitive.d).join(''));
    }
    assert.equal(new Set(patterns).size, 5);
});

test('position, rotation and existing affine placement affect only decorative paint geometry', () => {
    const plain = fixture({ decorations: [{ kind: 'paper-clip', position: 'rb', size: 64, rotation: 90, offset: { x: 12, y: -6 } }] });
    const placed = fixture(plain.effective, [2, 0, 0, 2, 300, 200]);
    const result = decoratePaper(placed), local = decoratePaper(plain);
    assert.equal(result.item.transform, placed.item.transform);
    assert.equal(result.item.hitTargets, placed.item.hitTargets);
    assert.deepEqual(generated(result), generated(local), 'attachment coordinates remain local to the existing transform');
    assert.ok(result.item.bounds.x + result.item.bounds.width > 780);
    assert.ok(result.item.bounds.y + result.item.bounds.height > 520);
    const unrotated = decoratePaper(fixture({ decorations: [{ kind: 'paper-clip', position: 'rb', size: 64 }] }));
    assert.notDeepEqual(generated(unrotated), generated(local));
    assert.deepEqual(placed.definition.record, plain.definition.record);
});

test('relation and non-frame view content cannot acquire stationery', () => {
    const relation = fixture({ style: { paper: 'pad' }, decorations: [{ kind: 'push-pin' }] });
    relation.definition.record.category = 'relation';
    assert.equal(decoratePaper(relation), relation);
    const tableCell = fixture(relation.effective); tableCell.definition.owner = 'view';
    assert.equal(decoratePaper(tableCell), tableCell);
    tableCell.item.layer = 'views';
    assert.ok(generated(decoratePaper(tableCell)).length > 0);
});

test('decoration work is bounded and malformed direct caller numbers stay finite', () => {
    const invalid = fixture({ shadow: { blur: Infinity, spread: NaN }, decorations: Array.from({ length: 80 }, () => ({ kind: 'tape', size: Infinity, rotation: NaN, offset: { x: Infinity }, opacity: -3 })) });
    const result = decoratePaper(invalid);
    assert.ok(generated(result).length <= 32 * 3 + 1);
    assert.doesNotMatch(JSON.stringify(result.item), /NaN|Infinity/);
    assert.ok(Object.values(result.item.bounds).every(Number.isFinite));
    const singular = fixture(invalid.effective, [0, 0, 0, 0, 0, 0]);
    assert.equal(decoratePaper(singular), singular);
});
