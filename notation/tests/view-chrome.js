/* SPDX-License-Identifier: GPL-2.0-or-later. B1-045 view-level chrome options
 * (legend/title/footer). Defaults (legend:auto, title:on, footer:on) reproduce
 * the pre-option emission rules byte-for-byte; off suppresses; invalid values
 * are coded errors (DDN-E018 flat keyword, DDN046 profile value, LIVE002
 * override); the tool override channel (D4) flows through toolOverrides. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const DDN = require('../runtime/ddn-core.js').default;
const Render = require('../runtime/ddn-render.js').default;
const A = require('../dist/ddn.global.js');
const T = require('../tool/src/tool.js');
const reg = JSON.parse(fs.readFileSync(path.join(root, '../standard/registry/catalogue.json'), 'utf8'));
const defs = fs.readFileSync(path.join(root, '../standard/registry/glyph-library.svg'), 'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const basics = f => fs.readFileSync(path.join(root, '../website/examples/basics', f), 'utf8');
const read = n => fs.readFileSync(path.join(root, 'dist', n), 'utf8');
const results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { results.push({ name, pass: false }); console.error('FAIL', name, e.code || '', e.message); process.exitCode = 1; } }
const throws = (fn, code) => assert.throws(fn, e => { if (e.code !== code) console.error('Expected', code, 'got', e.code, e.message); return e.code === code; });
function context(...bundles) { const c = vm.createContext({ console, performance, TextEncoder, TextDecoder }); for (const b of bundles) vm.runInContext(read('ddn-' + b + '.js'), c, { filename: 'ddn-' + b + '.js' }); return c; }

const GRAPH = chrome => `ddn "0.5";
module "m";
data d {
    object alpha "Alpha" { kind: table; }
    object beta "Beta" { kind: table; }
    relation ab "writes" @d.alpha -> @d.beta { kind: ref; }
    relation ba "reads" @d.beta -> @d.alpha { kind: ref; }
}
view v "Chrome view" { data: [@d]; publication { size: content; fit: none; } ${chrome} }
`;
const build = (src, view = 'v') => DDN.build({ 'm.ddn': src }, 'm.ddn', view, reg).ir;
const render = ir => Render.render(ir, reg, defs).svg;

/* ---- graph view: defaults are byte-identical; auto ≡ on ≡ omitted ---- */
test('graph: legend:auto and legend:on are byte-identical to the omitted default', () => {
  const base = render(build(GRAPH('')));
  assert.equal(render(build(GRAPH('legend: auto;'))), base);
  assert.equal(render(build(GRAPH('legend: on;'))), base);
  assert.equal(render(build(GRAPH('chrome { legend: auto; title: on; footer: on; }'))), base);
});

test('graph: legend:off suppresses the RELATIONSHIP KEY but keeps self-labelling route labels', () => {
  const svg = render(build(GRAPH('legend: off;')));
  assert.ok(!svg.includes('RELATIONSHIP KEY'), 'legend emitted despite off');
  assert.ok(svg.includes('ddn-label'), 'route labels must stay');
  assert.ok(!svg.includes('Relationship details are in the adjacent legend.'), 'desc sentence dropped with the legend');
});

test('graph: legend:off reclaims the right-hand legend band', () => {
  const base = Render.render(build(GRAPH('')), reg, defs), off = Render.render(build(GRAPH('legend: off;')), reg, defs);
  assert.ok(off.scene.width < base.scene.width, 'legend band not reclaimed: ' + off.scene.width + ' vs ' + base.scene.width);
});

test('graph: title:off drops the header block; footer:off drops the footer line', () => {
  const svg = render(build(GRAPH('title: off; footer: off;')));
  assert.ok(!svg.includes('DDN / PROPOSED STANDARD'), 'header brand line emitted despite title:off');
  assert.ok(!svg.includes('>Chrome view</text>'), 'title text emitted despite title:off');
  assert.ok(!svg.includes('Same data · independent view'), 'footer emitted despite footer:off');
  const titled = render(build(GRAPH('title: off;')));
  assert.ok(titled.includes('Same data · independent view'), 'footer toggle must be independent');
});

test('graph: numbered relations reject legend:off with the coded DDN047', () => {
  const src = GRAPH('legend { mode: numbers; keys: { "ab": 1, "ba": 2 }; } legend: off;');
  throws(() => build(src), 'DDN047');
});

test('graph: invalid chrome values are coded errors', () => {
  throws(() => build(GRAPH('legend: sometimes;')), 'DDN-E018');
  throws(() => build(GRAPH('title: maybe;')), 'DDN-E018');
  throws(() => build(GRAPH('footer: "0";')), 'DDN-E018');
  throws(() => build(GRAPH('chrome { legend: sometimes; }')), 'DDN046');
});

test('graph: legend profile reference still resolves alongside chrome keywords', () => {
  const src = `ddn "0.5";
module "m";
data d { object a "A" { kind: table; } object b "B" { kind: table; } relation r "writes" @d.a -> @d.b { kind: ref; } }
format f { legend nums { mode: numbers; keys: { "r": 3 }; } bundle b { legend: @nums; } }
view v "V" { data: [@d]; format: @f.b; title: off; }
`;
  const svg = render(build(src));
  assert.ok(svg.includes('RELATIONSHIP KEY'), 'legend profile lost');
  assert.ok(svg.includes('>3<'), 'callout number lost');
  assert.ok(!svg.includes('DDN / PROPOSED STANDARD'), 'title:off not applied');
});

test('graph: chrome profile declaration + bundle reference works', () => {
  const src = `ddn "0.5";
module "m";
data d { object a "A" { kind: table; } object b "B" { kind: table; } relation r "writes" @d.a -> @d.b { kind: ref; } }
format f { chrome minimal { legend: off; title: off; footer: off; } bundle b { chrome: @minimal; } }
view v "V" { data: [@d]; format: @f.b; }
`;
  const svg = render(build(src));
  assert.ok(!svg.includes('RELATIONSHIP KEY') && !svg.includes('DDN / PROPOSED STANDARD') && !svg.includes('Same data'), 'chrome profile not applied');
});

/* ---- chart view (quality series colour key) through the dist pipeline ---- */
const QDIR = path.resolve(__dirname, '../../website/examples/quality');
const QBASE = Object.fromEntries(['model.ddn', 'details.ddn', 'formats.ddn', 'views.ddn'].map(f => [f, fs.readFileSync(path.join(QDIR, f), 'utf8')]));
const qrun = (view, overrides = {}) => A.createWorkspace({ ...QBASE }).renderSync({ entry: 'views.ddn', view, overrides });

test('chart: series colour key follows legend; title/footer toggles hit the projection page chrome', () => {
  const base = qrun('grouped_bars');
  assert.ok(base.svg.includes('>Plant A<'), 'series key expected by default');
  assert.ok(base.svg.includes('DDN / 0.5 PROJECTION PREVIEW'), 'projection header expected');
  assert.ok(base.svg.includes('One model · source-bound occurrences'), 'projection footer expected');
  const off = qrun('grouped_bars', { legend: 'off' });
  assert.ok(!off.svg.includes('>Plant A<'), 'series key emitted despite legend:off');
  const noChrome = qrun('grouped_bars', { title: 'off', footer: 'off' });
  assert.ok(!noChrome.svg.includes('DDN / 0.5 PROJECTION PREVIEW'), 'title:off failed');
  assert.ok(!noChrome.svg.includes('One model · source-bound occurrences'), 'footer:off failed');
  assert.equal(qrun('grouped_bars', { legend: 'on' }).svg, base.svg, 'legend:on must equal the default');
});

test('chart: matrix encoding key follows legend:off', () => {
  const base = qrun('heat_numeric');
  assert.ok(base.svg.includes('Missing is not zero'), 'encoding key note expected by default');
  const off = qrun('heat_numeric', { legend: 'off' });
  assert.ok(!off.svg.includes('Missing is not zero'), 'encoding key note emitted despite legend:off');
});

/* ---- geo choropleth key ---- */
test('geo: choropleth ramp key follows legend; title/footer toggles work', () => {
  const CHORO = { '67-geo-choropleth.ddn': basics('67-geo-choropleth.ddn'), 'shared.ddn': basics('shared.ddn') };
  const c = context('core', 'graph', 'projections', 'geo');
  c.DDNGeo.registerGeography('assets/geo/world-110m.json', fs.readFileSync(path.join(root, '../assets/geo/world-110m.json'), 'utf8'));
  const run = overrides => c.DDNLive.createWorkspace(CHORO).renderSync({ entry: '67-geo-choropleth.ddn', view: 'choropleth', overrides });
  const base = run({});
  assert.ok(base.svg.includes('ddn-mark-geo-choropleth'));
  const off = run({ legend: 'off' });
  assert.notEqual(off.svg, base.svg);
  assert.ok(off.svg.includes('ddn-mark-geo-choropleth'), 'map body must stay');
  const bare = run({ title: 'off', footer: 'off' });
  assert.ok(!bare.svg.includes('DDN / 0.5 PROJECTION PREVIEW') && !bare.svg.includes('One model · source-bound occurrences'), 'geo page chrome toggles failed');
});

/* ---- iso graph page chrome ---- */
test('iso: title/footer toggles hit the isometric page chrome', () => {
  const ISO_GRAPH = { '73-iso-architecture.ddn': basics('73-iso-architecture.ddn'), 'shared.ddn': basics('shared.ddn') };
  const c = context('core', 'graph', 'iso');
  const run = overrides => c.DDNLive.createWorkspace(ISO_GRAPH).renderSync({ entry: '73-iso-architecture.ddn', view: 'iso_map', overrides });
  const base = run({});
  assert.ok(base.svg.includes('/ ISO') && base.svg.includes('· iso'), 'iso page chrome expected');
  const bare = run({ title: 'off', footer: 'off' });
  assert.ok(!bare.svg.includes('/ ISO'), 'iso header emitted despite title:off');
  assert.ok(!bare.svg.includes('· iso'), 'iso footer emitted despite footer:off');
});

/* ---- override channel validation + tool pure parts (D4) ---- */
test('override channel: invalid chrome values are coded LIVE002 errors', () => {
  throws(() => qrun('grouped_bars', { legend: 'sometimes' }), 'LIVE002');
  throws(() => qrun('grouped_bars', { title: 'auto' }), 'LIVE002');
  throws(() => qrun('grouped_bars', { unknown_chrome: 'off' }), 'LIVE001');
});

test('override channel: legend:off with numbered relations is LIVE021 (mirrors DDN047)', () => {
  const files = { 'm.ddn': GRAPH('legend { mode: numbers; keys: { "ab": 1, "ba": 2 }; }') };
  throws(() => A.createWorkspace(files).renderSync({ entry: 'm.ddn', view: 'v', overrides: { legend: 'off' } }), 'LIVE021');
});

test('override channel: chrome overrides compose with authored source and stay deterministic', () => {
  const files = { 'm.ddn': GRAPH('') };
  const run = () => A.createWorkspace(files).renderSync({ entry: 'm.ddn', view: 'v', overrides: { legend: 'off', title: 'off', footer: 'off' } });
  const a = run(), b = run();
  assert.equal(a.svg, b.svg, 'nondeterministic chrome override render');
  assert.ok(!a.svg.includes('RELATIONSHIP KEY') && !a.svg.includes('DDN / PROPOSED STANDARD') && !a.svg.includes('Same data'));
  const authored = A.createWorkspace(files).renderSync({ entry: 'm.ddn', view: 'v', overrides: { legend: 'source', title: 'source', footer: 'source' } });
  assert.ok(authored.svg.includes('RELATIONSHIP KEY'), 'source must restore authored chrome');
});

test('tool: toolOverrides passes chrome options through; choices expose As authored/on/off', () => {
  const o = T.toolOverrides({ options: { legend: 'off', title: 'off', footer: 'on' } });
  assert.deepEqual({ legend: o.legend, title: o.title, footer: o.footer }, { legend: 'off', title: 'off', footer: 'on' });
  for (const k of ['legend', 'title', 'footer']) assert.deepEqual(A.choices[k], ['source', 'on', 'off'], k + ' choices');
});

test('tool: appearance drawer declares a Chrome section wired to the override keys', () => {
  const src = fs.readFileSync(path.join(root, 'tool/src/tool.js'), 'utf8');
  const i = src.indexOf("['Chrome', [");
  assert.ok(i > 0, 'Chrome section missing from SELECT_FIELDS');
  const section = src.slice(i, src.indexOf(']]', i));
  for (const key of ["'legend'", "'title'", "'footer'"]) assert.ok(section.includes(key), 'Chrome section missing ' + key);
});

console.log(JSON.stringify({ tests: results.length, failures: results.filter(r => !r.pass).length }));
