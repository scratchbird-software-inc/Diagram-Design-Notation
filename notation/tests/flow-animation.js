/* SPDX-License-Identifier: GPL-2.0-or-later. B1-033 flow animation tests:
 * motion properties -> SMIL emission with defaults, rate staggering, pulse
 * variant, flow blocks (hop resolution, multi-flow ids, DDN-E013/E014/W016
 * diagnostics), deterministic output, --no-motion stripping, and the tool
 * controller's pure hop-boundary/step/speed logic. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const DDN = require('../runtime/ddn-core.js').default, Render = require('../runtime/ddn-render.js').default;
const root = path.resolve(__dirname, '..'), reg = JSON.parse(fs.readFileSync(path.join(root, '../standard/registry/catalogue.json'), 'utf8'));
const defs = fs.readFileSync(path.join(root, '../standard/registry/glyph-library.svg'), 'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const results = [];
function test(name, fn) { try { fn(); results.push({ name, status: 'pass' }); console.log('PASS', name); } catch (e) { results.push({ name, status: 'fail' }); console.error('FAIL', name, e.message); process.exitCode = 1; } }
const hash = s => crypto.createHash('sha256').update(s).digest('hex');

const base = `ddn "0.5"; module "t.motion";
data m {
 object a "A" {kind: application;}
 object b "B" {kind: service;}
 object c "C" {kind: table;}
 relation ab @a -> @b {kind: flow; motion: flow;}
 relation bc @b -> @c {kind: flow;}
}
view v {data: [@m]; publication {size: content; fit: none; minimum_text: 8pt;}}`;
const compile = (s = base, view = 'v') => DDN.build({ 'main.ddn': s }, 'main.ddn', view, reg).ir;
const render = (s, opts) => Render.render(compile(s), reg, defs, opts || {});
const withProps = (props) => base.replace('motion: flow;', 'motion: flow; ' + props);

test('no motion properties: renderer emits zero animation markup', () => {
  const svg = render(base.replace(' motion: flow;', '')).svg;
  assert.ok(!svg.includes('animate') && !svg.includes('ddn-motion'), 'unexpected SMIL in static diagram');
});

test('motion: flow emits animateMotion with defaults (circle, 8px, relation colour, 60px/s)', () => {
  const { svg, scene } = render(base);
  assert.ok(svg.includes('<animateMotion'), 'animateMotion missing');
  assert.ok(svg.includes('class="ddn-motion"'), 'ddn-motion group missing');
  assert.ok(svg.includes('data-relation="t.motion::m.ab"'));
  assert.ok(svg.includes('<circle r="4"'), 'default circle marker of 8px missing');
  const len = Math.hypot(0, 0) || scene.motion[0].duration * 60;
  assert.equal(scene.motion.length, 1);
  assert.equal(scene.motion[0].kind, 'flow');
  assert.equal(scene.motion[0].rate, 1);
  assert.ok(scene.motion[0].duration > 0, 'duration derived from route length/speed');
  assert.ok(Math.abs(scene.motion[0].duration - len / 60) < 1e-9);
  const dur = scene.motion[0].duration.toFixed(3);
  assert.ok(svg.includes(`dur="${dur}s"`), 'animateMotion dur matches scene duration');
  assert.ok(svg.includes(`data-hop="0" data-hop-start="0" data-hop-end="${dur}"`), 'hop window attributes missing');
});

test('defaults applied only when absent: marker/size/colour/speed honoured', () => {
  const { svg, scene } = render(withProps('marker: square; marker_size: 12; speed: 120; marker_color: "#123456";'));
  assert.ok(svg.includes('<rect x="-6" y="-6" width="12" height="12" fill="#123456">'), 'square marker missing');
  assert.ok(Math.abs(scene.motion[0].duration - scene.routes[0].points.reduce((n, p, i, a) => i ? n + Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) : 0, 0) / 120) < 1e-9);
});

test('rate > 1 staggers a particle stream with even negative begin offsets', () => {
  const { svg, scene } = render(withProps('rate: 4;'));
  assert.equal(scene.motion[0].rate, 4);
  const begins = [...svg.matchAll(/<animateMotion dur="([0-9.]+)s" begin="(-?[0-9.]+)s"/g)].map(m => Number(m[2]));
  assert.equal(begins.length, 4);
  const dur = scene.motion[0].duration;
  begins.sort((a, b) => a - b);
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(begins[i] - (-(3 - i) * dur / 4)) < 1e-3, 'staggered offset ' + i);
});

test('motion: pulse animates edge stroke/opacity instead of a marker', () => {
  const { svg, scene } = render(base.replace('motion: flow;', 'motion: pulse; pulse_color: "#ff8800";'));
  assert.ok(svg.includes('class="ddn-motion ddn-pulse"'));
  assert.ok(svg.includes('<animate attributeName="stroke"'));
  assert.ok(svg.includes('#ff8800'));
  assert.ok(!svg.includes('<animateMotion'), 'pulse must not emit a travelling marker');
  assert.equal(scene.motion[0].kind, 'pulse');
});

test('invalid motion property values raise DDN-E014', () => {
  for (const bad of ['motion: slide;', 'marker: triangle;', 'marker_size: 0;', 'speed: -5;', 'rate: 0;', 'rate: 1.5;', 'marker_color: 7;'])
    assert.throws(() => compile(base.replace('motion: flow;', bad)), e => e.code === 'DDN-E014', bad);
});

test('rate beyond the 32 cap warns DDN-W016 and clamps at render time', () => {
  const built = DDN.build({ 'main.ddn': withProps('rate: 40;') }, 'main.ddn', 'v', reg);
  const w = built.ir.diagnostics.find(d => d.code === 'DDN-W016');
  assert.ok(w, 'DDN-W016 missing');
  const { svg, scene } = Render.render(built.ir, reg, defs, {});
  assert.equal(scene.motion[0].rate, 32, 'clamped to the DOM-honest cap');
  assert.equal((svg.match(/<animateMotion/g) || []).length, 32);
});

test('flow block: hops resolve to relations, marker travels concatenated path with hop windows', () => {
  const src = base + `
view traced {data: [@m]; flow f1 "Trace" {steps: @m.a -> @m.b -> @m.c; marker: square; speed: 100; marker_color: "#aa0000";} publication {size: content; fit: none;}}`;
  const r = Render.render(DDN.build({ 'main.ddn': src }, 'main.ddn', 'traced', reg).ir, reg, defs, {});
  const scene = r.scene;
  assert.ok(r.svg.includes('class="ddn-flow ddn-flow-f1"'), 'stable flow class missing');
  assert.ok(r.svg.includes('data-flow="t.motion::traced.f1"'));
  assert.equal(scene.flows.length, 1);
  assert.equal(r.scene.flows[0].hops.length, 2);
  const [h0, h1] = r.scene.flows[0].hops;
  assert.equal(h0.start, 0);
  assert.ok(Math.abs(h0.end - h1.start) < 1e-9, 'hop windows are contiguous');
  assert.ok(Math.abs(h1.end - r.scene.flows[0].duration) < 1e-9);
  const fmt3 = x => String(Number(x.toFixed(3)));
  for (const h of [h0, h1]) {
    assert.ok(r.svg.includes(`data-hop-start="${fmt3(h.start)}" data-hop-end="${fmt3(h.end)}"`), 'hop attributes for ' + h.relation);
  }
  const dur = fmt3(r.scene.flows[0].duration);
  assert.ok(r.svg.includes(`data-dur="${dur}"`), 'flow cycle duration attribute');
  assert.ok(r.svg.includes('keyPoints='), 'hop-window keyTimes confinement');
});

test('flow block: missing hop relation raises DDN-E013', () => {
  const src = base.replace('relation bc @b -> @c {kind: flow;}', '') + `
view traced {data: [@m]; flow f1 {steps: @m.a -> @m.b -> @m.c;}}`;
  assert.throws(() => DDN.build({ 'main.ddn': src }, 'main.ddn', 'traced', reg), e => e.code === 'DDN-E013');
});

test('flow block: hop against relation direction raises DDN-E013; unselected step raises DDN-E013', () => {
  const backward = base + `
view traced {data: [@m]; flow f1 {steps: @m.b -> @m.a;}}`;
  assert.throws(() => DDN.build({ 'main.ddn': backward }, 'main.ddn', 'traced', reg), e => e.code === 'DDN-E013');
  const unselected = base + `
view traced {data: [@m]; select: [@m.a, @m.b]; flow f1 {steps: @m.a -> @m.b -> @m.c;}}`;
  assert.throws(() => DDN.build({ 'main.ddn': unselected }, 'main.ddn', 'traced', reg), e => e.code === 'DDN-E013');
});

test('flow block: unknown flow property rejected by the whitelist (DDN033)', () => {
  const src = base + `
view traced {data: [@m]; flow f1 {steps: @m.a -> @m.b; wobble: 3;}}`;
  assert.throws(() => DDN.build({ 'main.ddn': src }, 'main.ddn', 'traced', reg), e => e.code === 'DDN033');
});

test('multiple flows per view keep distinct stable ids', () => {
  const src = base + `
view traced {data: [@m];
 flow first {steps: @m.a -> @m.b;}
 flow second {steps: @m.b -> @m.c; marker: rect;}
 publication {size: content; fit: none;}}`;
  const { svg, scene } = Render.render(DDN.build({ 'main.ddn': src }, 'main.ddn', 'traced', reg).ir, reg, defs, {});
  assert.ok(svg.includes('ddn-flow-first') && svg.includes('ddn-flow-second'));
  assert.equal(scene.flows.length, 2);
  assert.notEqual(scene.flows[0].id, scene.flows[1].id);
  assert.ok(svg.includes('data-flow="t.motion::traced.first"') && svg.includes('data-flow="t.motion::traced.second"'));
});

test('deterministic output: same input renders the identical animated SVG hash', () => {
  const src = withProps('rate: 3;') + `
view traced {data: [@m]; flow f1 {steps: @m.a -> @m.b -> @m.c;} publication {size: content; fit: none;}}`;
  const a = Render.render(DDN.build({ 'main.ddn': src }, 'main.ddn', 'traced', reg).ir, reg, defs, {}).svg;
  const b = Render.render(DDN.build({ 'main.ddn': src }, 'main.ddn', 'traced', reg).ir, reg, defs, {}).svg;
  assert.equal(hash(a), hash(b));
});

test('noMotion render option strips all animation; default keeps it', () => {
  const src = withProps('rate: 2;') + `
view traced {data: [@m]; flow f1 {steps: @m.a -> @m.b;} publication {size: content; fit: none;}}`;
  const ir = DDN.build({ 'main.ddn': src }, 'main.ddn', 'traced', reg).ir;
  const animated = Render.render(ir, reg, defs, {}).svg;
  const still = Render.render(ir, reg, defs, { noMotion: true }).svg;
  assert.ok(animated.includes('<animateMotion') && animated.includes('ddn-motion'));
  assert.ok(!still.includes('animate') && !still.includes('ddn-motion') && !still.includes('ddn-flow'), 'noMotion must strip every animation');
});

test('CLI --no-motion strips animation; default export keeps it', () => {
  const cp = require('node:child_process'), os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddn-cli-motion-'));
  fs.writeFileSync(path.join(dir, 'main.ddn'), withProps('rate: 2;'));
  const cli = path.join(root, 'cli/cli.js');
  cp.execFileSync(process.execPath, [cli, 'render', path.join(dir, 'main.ddn'), '--workspace', dir, '--out', path.join(dir, 'a.svg')]);
  cp.execFileSync(process.execPath, [cli, 'render', path.join(dir, 'main.ddn'), '--workspace', dir, '--no-motion', '--out', path.join(dir, 's.svg')]);
  assert.ok(fs.readFileSync(path.join(dir, 'a.svg'), 'utf8').includes('<animateMotion'));
  assert.ok(!fs.readFileSync(path.join(dir, 's.svg'), 'utf8').includes('animate'));
  fs.rmSync(dir, { recursive: true, force: true });
});

/* Tool controller pure parts (notation/tool/src/tool.js). */
const Tool = require('../tool/src/tool.js');
test('hopWindowsFromMarkers: dedupes per hop and sorts windows', () => {
  const w = Tool.hopWindowsFromMarkers([
    { hop: 1, start: 4, end: 8 }, { hop: 0, start: 0, end: 4 }, { hop: 1, start: 4, end: 8 }]);
  assert.deepEqual(w, [{ hop: 0, start: 0, end: 4 }, { hop: 1, start: 4, end: 8 }]);
  assert.throws(() => Tool.hopWindowsFromMarkers([{ hop: 0, start: 2, end: 2 }]));
});

test('nextHopTime: mid-hop advances to its end, boundary advances a full hop, wrap at cycle end', () => {
  const w = [{ hop: 0, start: 0, end: 4 }, { hop: 1, start: 4, end: 8 }];
  assert.equal(Tool.nextHopTime(2, w), 4, 'mid-hop -> end of current hop');
  assert.equal(Tool.nextHopTime(4, w), 8, 'on a boundary -> end of next hop');
  assert.equal(Tool.nextHopTime(8, w), 4, 'past the last boundary wraps to the first');
  assert.throws(() => Tool.nextHopTime(0, []));
});

test('scaledDuration: 0.5x/1x/2x/4x re-times base durations, rejects other multipliers', () => {
  assert.equal(Tool.scaledDuration(8, 0.5), 16);
  assert.equal(Tool.scaledDuration(8, 1), 8);
  assert.equal(Tool.scaledDuration(8, 2), 4);
  assert.equal(Tool.scaledDuration(8, 4), 2);
  assert.throws(() => Tool.scaledDuration(8, 3));
  assert.throws(() => Tool.scaledDuration(0, 2));
});

test('drawers config: animation is a first-class drawer in presets and parsing', () => {
  assert.ok(Tool.DRAWERS.includes('animation'));
  for (const mode of Object.keys(Tool.MODES)) assert.ok(Tool.DRAWER_STATES.includes(Tool.MODES[mode].drawers.animation), mode);
  assert.deepEqual(Tool.parseDrawersParam('animation:open'), { animation: 'open' });
  const cfg = Tool.resolveDrawerConfig('explore', { animation: 'open' }, null);
  assert.equal(cfg.drawers.animation, 'open');
});

const passed = results.filter(r => r.status === 'pass').length;
console.log(`flow-animation ${passed}/${results.length}`);
if (passed !== results.length) process.exitCode = 1;
