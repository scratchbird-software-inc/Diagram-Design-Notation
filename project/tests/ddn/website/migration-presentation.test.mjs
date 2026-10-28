import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { convertAppearancePresentation as appearance } from '../../../../tooling/website/migrate-presentation.mjs';
const output = process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const { validateSchema } = await import(pathToFileURL(resolve(output, 'ddn/packages/profiles/src/index.js')));
const q = (value, unit = 'px') => ({ $quantity: value, unit });
function valid(properties) {
    assert.deepEqual(validateSchema('appearance', { id: 'occurrence', parent: { file: 'main.ddn', id: 'view' }, target: { file: 'main.ddn', id: 'element' }, ...properties }), []);
    return properties;
}

test('portable element paint becomes active appearance channels', () => {
    const result = valid(appearance({ properties: { fill: '#fff7ed', stroke: { color: '#c2410c', weight: 3, dash: 'dashed' } } }));
    assert.deepEqual(result.background, { color: '#fff7ed' });
    assert.deepEqual(result.border, { color: '#c2410c', width: 3, style: 'dashed' });
    assert.deepEqual(result.stroke, { color: '#c2410c', weight: 3, dash: 'dashed' });
    assert.equal(result.notes, undefined);
});
test('relation line paint remains a route pen rather than a node border', () => {
    const result = valid(appearance({ from: { element: 'a' }, to: { element: 'b' }, properties: { line: { color: '#1d4ed8', weight: q(2.5), dash: 'dotted' } } }));
    assert.deepEqual(result, { stroke: { color: '#1d4ed8', weight: 2.5, dash: 'dotted' } });
});
test('per-element sizing composes with view bounds and preserves opacity', () => {
    const view = { profiles: { style: { max_width: q(320), min_font: q(10) } } };
    assert.deepEqual(valid(appearance({ properties: { max_width: q(200) } }, {}, view)), { text: { max_width: 200, min_font: 10, fit: 'wrap' } });
    assert.deepEqual(valid(appearance({ properties: { opacity: .55 } }, {}, view)), { text: { max_width: 320, min_font: 10, fit: 'wrap' }, opacity: .55 });
    assert.deepEqual(valid(appearance({ properties: { text_fit: 'shrink', max_width: q(240), max_height: q(64), min_font: q(11) } }, {}, view)), { text: { max_width: 240, min_font: 11, max_height: 64, fit: 'shrink' } });
});
test('each text-fit mode and clipped bounds survive as registered text properties', () => {
    for (const fit of ['wrap', 'grow', 'shrink']) {
        const result = valid(appearance({ properties: { text_fit: fit, max_width: q(160), max_height: q(64), min_font: q(10) } }));
        assert.deepEqual(result.text, { fit, max_width: 160, max_height: 64, min_font: 10 });
    }
});
test('text styling uses current spelling and merges each explicit value independently', () => {
    const view = { profiles: { style: { text: { weight: 500, italic: true, color: '#123456' } } } };
    const result = valid(appearance({ properties: { text: { weight: 'bold', variant: 'small-caps', italic: false } } }, {}, view));
    assert.deepEqual(result.text, { weight: 700, italic: false, color: '#123456', variant: 'small_caps' });
    assert.deepEqual(valid(appearance({ properties: { text: { decoration: 'strike', align: 'right' } } })).text, { decoration: 'strike', align: 'end' });
});
test('explicit occurrence values beat element values without discarding inherited siblings', () => {
    const source = { properties: { text_fit: 'shrink', min_font: q(11), fill: '#abcdef', opacity: .55, style: { look: 'handDrawn', font_size: q(12, 'pt') } } };
    const placement = { at: [0, 50], size: [q(2, 'in'), q(1, 'in')], properties: { opacity: 1, text: { italic: false }, fill: '#123456' } };
    const result = valid(appearance(source, placement));
    assert.deepEqual(result.size, { width: 192, height: 96 });
    assert.deepEqual(result.style, { look: 'handdrawn', font_size: 16 });
    assert.equal(result.background.color, '#123456'); assert.equal(result.opacity, 1);
    assert.deepEqual(result.text, { fit: 'shrink', min_font: 11, italic: false });
    assert.equal(result.position, undefined); assert.equal(result.body, undefined);
});
test('shadow dimensions convert units and explicit null removes inherited shadow', () => {
    const source = { properties: { shadow: { x: q(3, 'pt'), y: q(6), blur: q(4), spread: 0, opacity: .2, color: '#112233', kind: 'offset' } } };
    const result = valid(appearance(source)); assert.deepEqual(result.shadow, { x: 4, y: 6, blur: 4, spread: 0, opacity: .2, color: '#112233', kind: 'offset' });
    assert.equal(valid(appearance(source, { shadow: null })).shadow, null);
});
test('conversion is sparse and does not mutate source/view/placement records', () => {
    const source = { properties: { text: { weight: 700 }, semantic_fact: 'stays in definition' } }, placement = { size: [q(200), q(80)] }, view = { profiles: { style: { look: 'classic', font: 'sans', font_size: q(16), seed: 42 } } };
    const before = structuredClone({ source, placement, view }); valid(appearance(source, placement, view));
    assert.deepEqual({ source, placement, view }, before); assert.deepEqual(appearance({}, {}, view), {});
});
