import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const output = process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const load = file => import(pathToFileURL(resolve(output, 'ddn/packages/presentation/src', file)));
const { projectSnapshot } = await load('project.js');
const { records, refKey } = await load('model.js');
const { standaloneNode, symbolTerminals } = await load('symbol-presentation.js');
const { endpoint } = await load('graph-common.js');
const ref = id => ({ file: 'main.ddn', id });
const measure = (value, size) => value.length * size * .6;
const merge = (a, b) => {
 const out = { ...a };
 for (const [key, value] of Object.entries(b ?? {})) out[key] = value && typeof value === 'object' && !Array.isArray(value) ? merge(out[key], value) : value;
 return out;
};
function fixture(profile = 'network.basic@1', properties = {}, { electrical = true, intrinsic, style = {}, caption = 'Customer computer' } = {}) {
 const definition = { id: 'node', name: caption, category: 'element', role: profile === 'ddn@1' ? 'object' : 'network.server', ...(electrical ? { metadata: { x_icon: { library: 'electrical-common@1', icon: 'resistor' } } } : {}) };
 const view = { id: 'view', name: 'Symbols', profile, selection: { include: [ref('node')] }, layout: { algorithm: 'manual' }, ...style };
 const appearance = { id: 'appearance', target: ref('node'), parent: ref('view'), position: { x: 300, y: 250 }, ...properties };
 const asset = { id: 'image', name: 'image', media_type: 'image/svg+xml', path: 'image.svg', ...(intrinsic ? { intrinsic_size: intrinsic } : {}) };
 const document = { definitions: [definition], views: [view], appearances: [appearance], assets: [asset] };
 const snapshot = { contract: 'ddn-next-1', rootFile: 'main.ddn', revision: { model: '1', sources: { 'main.ddn': '1' }, data: {} }, versions: { api: '1.0', language: 'ddn-next-1', defaults: 'ddn-next-1', packs: {} }, semanticFingerprint: 'symbols', coverage: { scope: { kind: 'workarea' }, complete: true, checked: [], unavailable: [] }, normalized: { version: 'ddn-next-1', entry: 'main.ddn', files: [{ location: 'main.ddn', document }] } };
 return { snapshot, document, definition, appearance, asset, view };
}
function render(f, options = {}) {
 const all = records(f.snapshot);
 const resolve = (target, context = {}) => {
  const definition = all.find(r => refKey(r.ref) === refKey(target));
  const appearance = context.appearance && all.find(r => refKey(r.ref) === refKey(context.appearance));
  const values = merge(definition?.record, appearance?.record), properties = [];
  const walk = (value, path = '') => { for (const [key, item] of Object.entries(value ?? {})) { const next = path ? `${path}.${key}` : key; if (item && typeof item === 'object' && !Array.isArray(item)) walk(item, next); else properties.push({ path: next, value: item, origin: 'file:appearance' }); } };
  walk(values); return { values, properties, diagnostics: [] };
 };
 return projectSnapshot(f.snapshot, { resolve, measure, ...options });
}
const node = (result, id = 'node') => result.entries.find(e => e.definition.ref.id === id);
const texts = entry => entry.item.primitives.filter(p => p.kind === 'text').flatMap(p => p.runs);
const body = entry => entry.item.hitTargets.find(h => h.target.id === entry.definition.ref.id).bounds;
const worldImage = entry => { const b = entry.item.primitives.find(p => p.kind === 'image').bounds; return { ...b, x: b.x + entry.item.transform[4], y: b.y + entry.item.transform[5] }; };
function second(f, title = 'associated with') {
 f.document.definitions.push({ ...structuredClone(f.definition), id: 'other', name: 'Other' }, { id: 'wire', category: 'relation', role: 'assoc', title, endpoints: [{ definition: ref('node') }, { definition: ref('other') }] });
 f.document.appearances.push({ ...structuredClone(f.appearance), id: 'other-appearance', target: ref('other'), position: { x: 600, y: 250 } });
 f.view.selection.include.push(ref('other'), ref('wire'));
}

test('electrical artwork is full standalone image with no server/card/status/name decoration', () => {
 const f = fixture('network.basic@1', { background: { image: ref('image') } });
 const result = render(f), entry = node(result);
 assert.equal(result.coverage.complete, true);
 assert.deepEqual(entry.item.primitives.map(p => p.kind), ['image']);
 assert.deepEqual(worldImage(entry), body(entry));
 assert.equal(body(entry).width, 96);
 assert.equal(body(entry).height, 96);
 assert.equal(entry.item.accessible.label, 'Customer computer');
 assert.equal(entry.item.status, 'draft');
});
test('standalone images use the same presentation in native and supported method graphs', () => {
 for (const profile of ['ddn@1', 'network.basic@1', 'uml.structure@2', 'chen.binary@2']) {
  const f = fixture(profile, { symbol: { image: ref('image'), label: 'none' } }, { electrical: false });
  if (profile.startsWith('uml')) f.definition.role = 'uml.class';
  if (profile.startsWith('chen')) f.definition.role = 'entity';
  const entry = node(render(f));
  assert.deepEqual(entry.item.primitives.map(p => p.kind), ['image'], profile);
  assert.deepEqual(worldImage(entry), body(entry), profile);
 }
});
test('decorative backgrounds and explicit card mode retain ordinary diagrams', () => {
 const decorated = fixture('ddn@1', { background: { image: ref('image') } }, { electrical: false });
 const entry = node(render(decorated));
 assert.equal(entry.standalone, undefined);
 assert.ok(entry.item.primitives.some(p => p.kind === 'rect'));
 assert.ok(entry.item.primitives.some(p => p.kind === 'image'));
 const card = fixture('network.basic@1', { symbol: { mode: 'card' }, background: { image: ref('image') } });
 assert.equal(node(render(card)).standalone, undefined);
 assert.ok(node(render(card)).item.primitives.some(p => p.kind === 'rect'));
 const plain = fixture('uml.structure@2', {}, { electrical: false }); plain.definition.role = 'uml.class';
 assert.ok(node(render(plain)).item.primitives.some(p => p.kind === 'rect'));
});
test('all eight external caption placements and hidden/inside labels leave routing body unchanged', () => {
 for (const label of ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'inside', 'none']) {
  const f = fixture('network.basic@1', { symbol: { image: ref('image'), label, label_gap: 10 }, size: { width: 120, height: 80 } }, { electrical: false, intrinsic: { width: 3, height: 2 } });
  const entry = node(render(f)), b = body(entry), p = entry.item.bounds;
  assert.equal(b.width, 120, label); assert.equal(b.height, 80, label);
  assert.deepEqual(worldImage(entry), b, label);
  const lines = texts(entry);
  if (label === 'none') { assert.equal(lines.length, 0); assert.deepEqual(p, b); continue; }
  assert.ok(lines.some(r => r.text === 'Customer computer'), label);
  const x = lines[0].x + entry.item.transform[4], y = lines[0].y + entry.item.transform[5];
  if (label.includes('left')) assert.ok(x < b.x, label);
  if (label.includes('right')) assert.ok(x >= b.x + b.width + 10, label);
  if (label.includes('top')) assert.ok(y < b.y, label);
  if (label.includes('bottom')) assert.ok(y > b.y + b.height, label);
  assert.ok(p.x <= b.x && p.y <= b.y && p.x + p.width >= b.x + b.width && p.y + p.height >= b.y + b.height, label);
 }
});
test('intrinsic aspect and browser-discovered size contain the image within explicit envelope', () => {
 const f = fixture('network.basic@1', { symbol: { image: ref('image'), label: 'none' }, size: { width: 200, height: 200 } }, { electrical: false, intrinsic: { width: 400, height: 100 } });
 const entry = node(render(f, { assetSizes: new Map([[refKey(ref('image')), { width: 100, height: 400 }]]) }));
 assert.equal(body(entry).width, 200); assert.equal(body(entry).height, 50);
 assert.equal(body(entry).y, 325);
 delete f.asset.intrinsic_size;
 const measured = node(render(f, { assetSizes: new Map([[refKey(ref('image')), { width: 100, height: 400 }]]) }));
 assert.equal(body(measured).width, 50); assert.equal(body(measured).height, 200);
 assert.equal(body(measured).x, 375);
});
test('standalone image anchors ignore external captions and honor explicit side', () => {
 const f = fixture('ddn@1', { symbol: { image: ref('image'), label: 'right' }, size: { width: 100, height: 100 } }, { electrical: false }); second(f);
 const result = render(f), from = node(result), to = node(result, 'other'), edge = node(result, 'wire');
 assert.ok(from.item.bounds.width > body(from).width);
 assert.deepEqual(endpoint(edge, 0, from, to, records(f.snapshot), true), [body(from).x + body(from).width, body(from).y + body(from).height / 2]);
 const explicit = { ...edge, appearance: { record: { route: { source_side: 'north', source_fraction: .25 } } } };
 assert.deepEqual(endpoint(explicit, 0, from, to, records(f.snapshot), true), [body(from).x + body(from).width * .25, body(from).y]);
});
test('electrical wires meet bundled SVG leads, suppress generic labels and preserve signal captions', () => {
 const f = fixture('network.basic@1', { symbol: { image: ref('image') }, size: { width: 96, height: 96 } }); second(f);
 const result = render(f), from = node(result), to = node(result, 'other'), edge = node(result, 'wire'), b = body(from);
 assert.deepEqual(endpoint(edge, 0, from, to, records(f.snapshot), true), [b.x + b.width * 23 / 24, b.y + b.height / 2]);
 assert.equal(texts(edge).length, 0); assert.equal(edge.wireWithoutLabel, true);
 assert.ok(edge.item.primitives.some(p => p.kind === 'path' && p.d.startsWith(`M${b.x + b.width * 23 / 24},${b.y + b.height / 2}`)));
 f.document.definitions.find(d => d.id === 'wire').title = 'Supply 6 V';
 assert.ok(texts(node(render(f), 'wire')).some(r => r.text === 'Supply 6 V'));
 for (const [icon, count] of [['ground', 1], ['switch-no', 2], ['gate-and', 3], ['op-amp', 3], ['transistor-npn', 3]]) {
  f.definition.metadata.x_icon.icon = icon;
  const current = node(render(f)); assert.equal(symbolTerminals(current).length, count, icon);
 }
});
test('native relationship legends omit generic electrical wires', () => {
 const f = fixture('ddn@1', { symbol: { image: ref('image') } }, { style: { legend: { mode: 'numbers', placement: 'right' } } }); second(f);
 const result = render(f);
 assert.equal(texts(node(result, 'wire')).length, 0);
 assert.ok(!result.items.flatMap(item => item.primitives).filter(p => p.kind === 'text').flatMap(p => p.runs).some(r => r.text === 'RELATIONSHIP KEY'));
});
test('text notes remain transparent Markdown and can be related to image elements', () => {
 const f = fixture('ddn@1', { symbol: { mode: 'text', label: 'none' }, size: { width: 260 } }, { electrical: false });
 f.definition.content = { text: '# Supply\n\nUse **isolated** power and ++ground++.' };
 second(f); f.document.appearances[1].symbol = { mode: 'image', image: ref('image'), label: 'bottom' };
 const result = render(f), note = node(result);
 assert.ok(note.item.primitives.every(p => p.kind === 'text'));
 assert.ok(texts(note).some(r => r.text === 'Supply' && r.style['font-weight'] === 700));
 assert.ok(texts(note).some(r => r.text === 'isolated' && r.style['font-weight'] === 700));
 assert.ok(texts(note).some(r => r.text === 'ground' && r.style['text-decoration'] === 'underline'));
 assert.ok(node(result, 'wire').item.primitives.some(p => p.kind === 'path'));
});
test('missing image asset produces visible diagnostic and incomplete projection coverage', () => {
 const f = fixture('ddn@1', { symbol: { mode: 'image', image: ref('missing'), label: 'none' } });
 const result = render(f), entry = node(result);
 assert.equal(result.coverage.complete, false);
 assert.ok(result.diagnostics.some(d => d.code === 'symbol-image-unavailable'));
 assert.ok(result.coverage.unavailable.some(s => s.startsWith('symbol-image:')));
 assert.ok(!entry.item.primitives.some(p => p.kind === 'image'));
 assert.ok(texts(entry).some(r => r.text === 'Image unavailable'));
});
test('authored null suppresses artwork inference while standard null leaves it available', () => {
 const f = fixture('ddn@1', { symbol: { image: null }, background: { image: ref('image') } });
 assert.equal(node(render(f)).standalone, undefined);
 const all = records(f.snapshot), definition = all.find(r => r.owner === 'definition');
 const input = { definition, effective: f.appearance, all, x: 0, y: 0, measure };
 assert.equal(standaloneNode({ ...input, origins: { 'symbol.image': 'standard:definition' } }).presentation.mode, 'image');
 assert.equal(standaloneNode({ ...input, origins: { 'symbol.image': 'css' } }), undefined);
});
test('text notes can position a separate title outside their transparent body', () => {
 const f = fixture('ddn@1', { symbol: { mode: 'text', label: 'right' }, size: { width: 140 } }, { electrical: false, caption: 'Supply note' });
 f.definition.content = { text: 'Keep the return wire isolated.' };
 const entry = node(render(f)), b = body(entry), title = texts(entry).find(r => r.text === 'Supply note');
 assert.ok(entry.item.primitives.every(p => p.kind === 'text'));
 assert.ok(title.x + entry.item.transform[4] > b.x + b.width);
 assert.ok(entry.item.bounds.width > b.width);
});
test('included-file occurrences resolve unqualified image references in their own file', () => {
 const f = fixture('ddn@1', {}, { electrical: false });
 const all = records(f.snapshot), definition = all.find(r => r.owner === 'definition');
 const appearance = { file: 'included.ddn', owner: 'appearance', ref: { file: 'included.ddn', id: 'occurrence' }, record: { symbol: { image: { id: 'local-image' }, label: 'none' } } };
 const asset = { file: 'included.ddn', owner: 'asset', ref: { file: 'included.ddn', id: 'local-image' }, record: { id: 'local-image', intrinsic_size: { width: 200, height: 100 } } };
 const projected = standaloneNode({ definition, appearance, effective: appearance.record, origins: { 'symbol.image': 'file:appearance' }, all: [...all, appearance, asset], x: 0, y: 0, measure });
 assert.equal(projected.unavailable.length, 0);
 assert.equal(projected.primitives[0].assetId, refKey(asset.ref));
 assert.equal(projected.body.width / projected.body.height, 2);
});
const transformedImage = entry => {
 const b = entry.item.primitives.find(p => p.kind === 'image').bounds, m = entry.item.transform;
 return { x: b.x * m[0] + b.y * m[2] + m[4], y: b.x * m[1] + b.y * m[3] + m[5], width: b.width * m[0], height: b.height * m[3] };
};
test('ladder specialization translates standalone paint, caption and routing body together', () => {
 const f = fixture('ladder.basic@1', { symbol: { image: ref('image'), label: 'bottom' } }, { electrical: false, intrinsic: { width: 2, height: 1 } });
 f.definition.role = 'ladder.contact'; second(f, 'Supply'); f.document.definitions[1].role = 'ladder.coil'; f.document.definitions[2].role = 'ladder.series';
 const result = render(f), from = node(result), to = node(result, 'other');
 assert.deepEqual(transformedImage(from), body(from)); assert.deepEqual(transformedImage(to), body(to));
 assert.equal(from.item.bounds.x, 70); assert.ok(to.item.bounds.x >= 760);
 assert.equal(body(from).width / body(from).height, 2); assert.equal(body(to).width / body(to).height, 2);
 const edge = node(result, 'wire');
 assert.deepEqual(endpoint(edge, 0, from, to, records(f.snapshot), true), [body(from).x + body(from).width, body(from).y + body(from).height / 2]);
});
test('rack unit specialization contains standalone artwork uniformly and retains accurate body bounds', () => {
 const f = fixture('network.rack@1', { symbol: { image: ref('image'), label: 'bottom' } }, { electrical: false, intrinsic: { width: 2, height: 1 } });
 f.definition.metadata = { x_rack: { unit: 3 } };
 f.document.definitions.push({ id: 'rack', name: 'Rack', role: 'network.rack', category: 'element', metadata: { x_rack: { units: 12 } } });
 f.view.selection.include.push(ref('rack'));
 f.view.regions = [{ id: 'rack-region', scope: ref('rack'), members: [ref('node')] }];
 const result = render(f), entry = node(result), rack = result.entries.find(e => e.definition.ref.id === 'rack' && !e.item.occurrence.includes(':region:')), r = rack.item.bounds, unit = (r.height - 30) / 12;
 const slot = { x: r.x + 32, y: r.y + r.height - unit * 3, width: r.width - 45, height: Math.max(8, unit) };
 const image = transformedImage(entry), hit = body(entry), p = entry.item.bounds;
 for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(image[key] - hit[key]) < .00001, key);
 assert.equal(image.width / image.height, 2);
 assert.ok(p.x >= slot.x && p.y >= slot.y && p.x + p.width <= slot.x + slot.width + .00001 && p.y + p.height <= slot.y + slot.height + .00001, JSON.stringify({ p, slot, r }));
 assert.ok(entry.item.transform[0] < 1);
});

test('Chen automatic layout preserves standalone image transforms through the final diagram shift', () => {
 const f = fixture('chen.binary@2', { symbol: { image: ref('image'), label: 'bottom' } }, { electrical: false });
 f.definition.role = 'entity'; f.definition.metadata = { x_chen: { weak: true } };
 delete f.appearance.position; f.view.layout = { algorithm: 'grid', columns: 2 };
 const entry = node(render(f));
 assert.deepEqual(transformedImage(entry), body(entry));
 assert.ok(entry.item.primitives.every(p => p.kind === 'image' || p.kind === 'text'));
});
