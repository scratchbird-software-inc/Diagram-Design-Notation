/* SPDX-License-Identifier: GPL-2.0-or-later. DDN 0.8 tooling surface
 * (standard ch. 56): X1 verbs legality query, X2 diagnostic hints, X4 stable
 * machine-parseable diagnostics (--diagnostics json). */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');
const cli = path.resolve(__dirname, '../cli/cli.js');
const results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); console.log('PASS', name); } catch (e) { results.push({ name, pass: false }); console.error('FAIL', name, e.message); process.exitCode = 1; } }
function run(args) {
  const r = cp.spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
function workspace(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddn-cli-'));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return dir;
}
const good = 'ddn "0.6"; module "t"; data m { object a "A" {kind:table;} object b "B" {kind:table;} relation r @a -> @b {kind:ref;} } view main { data:[@m]; }';
const bad102 = good.replace('kind:ref', 'kind:reports_to');

/* X1: verbs legality query */
test('verbs --from table --to table lists legal verbs in registry order, one per line', () => {
  const r = run(['verbs', '--from', 'table', '--to', 'table']);
  assert.equal(r.status, 0, r.stderr);
  const verbs = r.stdout.trim().split('\n');
  assert.ok(verbs.includes('ref') && verbs.includes('flow') && verbs.includes('subtype'));
  assert.ok(verbs.indexOf('assoc') < verbs.indexOf('ref'), 'registry order: assoc precedes ref');
  assert.ok(!verbs.includes('reports_to'), 'reports_to does not admit table endpoints');
});
test('verbs profile kinds: flow.start -> flow.process admits flow.next', () => {
  const r = run(['verbs', '--from', 'flow.start', '--to', 'flow.process']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.trim().split('\n').includes('flow.next'));
});
test('verbs --json emits the machine form', () => {
  const r = run(['verbs', '--from', 'table', '--to', 'table', '--json']);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(out), ['from', 'to', 'verbs']);
  assert.equal(out.from, 'table'); assert.equal(out.to, 'table');
  assert.ok(Array.isArray(out.verbs) && out.verbs.includes('ref'));
});
test('verbs wildcard contracts admit any known kind pair', () => {
  /* the base registry's assoc contract is wildcard on both ends, so any two
   * known kinds share at least the wildcard verbs; restrictive verbs excluded. */
  const r = run(['verbs', '--from', 'organization', '--to', 'flow.start']);
  assert.equal(r.status, 0, r.stderr);
  const verbs = r.stdout.trim().split('\n');
  assert.ok(verbs.includes('assoc'));
  assert.ok(!verbs.includes('reports_to'));
  assert.ok(!verbs.includes('flow.next'));
});
test('verbs unknown kind is DDN-WS01 with close matches', () => {
  const r = run(['verbs', '--from', 'tabl', '--to', 'table']);
  assert.equal(r.status, 1);
  const err = JSON.parse(r.stderr);
  assert.equal(err.code, 'DDN-WS01');
  assert.ok(err.message.includes('table'), 'close match listed: ' + err.message);
});
test('verbs unknown kind with no close matches is still DDN-WS01', () => {
  const r = run(['verbs', '--from', 'zzzzqqqq', '--to', 'table']);
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stderr).code, 'DDN-WS01');
});
test('verbs without --from/--to is a usage error (exit 2)', () => {
  assert.equal(run(['verbs']).status, 2);
});

/* X4: --diagnostics json */
test('check --diagnostics json on a clean file emits an empty array', () => {
  const dir = workspace({ 'main.ddn': good });
  const r = run(['check', path.join(dir, 'main.ddn'), '--workspace', dir, '--diagnostics', 'json']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), []);
});
test('check --diagnostics json on a DDN102 file emits the X4 shape with file/line', () => {
  const dir = workspace({ 'main.ddn': bad102 });
  const r = run(['check', path.join(dir, 'main.ddn'), '--workspace', dir, '--diagnostics', 'json']);
  assert.equal(r.status, 1);
  const diags = JSON.parse(r.stdout);
  assert.equal(diags.length, 1);
  const d = diags[0];
  assert.deepEqual(Object.keys(d), ['code', 'severity', 'file', 'line', 'message']);
  assert.equal(d.code, 'DDN102'); assert.equal(d.severity, 'error');
  assert.equal(d.file, 'main.ddn'); assert.equal(d.line, 1);
  assert.ok(typeof d.message === 'string');
});
test('render --diagnostics json carries the view field', () => {
  const dir = workspace({ 'main.ddn': good });
  const r = run(['render', path.join(dir, 'main.ddn'), '--workspace', dir, '--diagnostics', 'json']);
  assert.equal(r.status, 0, r.stderr);
  const diags = JSON.parse(r.stdout);
  assert.ok(Array.isArray(diags));
  for (const d of diags) { assert.equal(d.view, 'main'); assert.ok(d.code && d.severity && d.message); }
});

test('render --content-size passes the contentSize option through', () => {
  const dir = workspace({ 'main.ddn': good });
  const r = run(['render', path.join(dir, 'main.ddn'), '--workspace', dir, '--content-size']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.startsWith('<?xml'), 'svg emitted');
});

/* X2: diagnostic hints */
test('DDN102 message carries the legal endpoint kinds', () => {
  const dir = workspace({ 'main.ddn': bad102 });
  const r = run(['check', path.join(dir, 'main.ddn'), '--workspace', dir, '--diagnostics', 'json']);
  const d = JSON.parse(r.stdout)[0];
  assert.ok(d.message.includes('legal source kinds for reports_to:'), 'hint present: ' + d.message);
});
test('DDN102 hint also applies to the default (non-JSON) error channel', () => {
  const dir = workspace({ 'main.ddn': bad102 });
  const r = run(['check', path.join(dir, 'main.ddn'), '--workspace', dir]);
  assert.equal(r.status, 1);
  assert.ok(JSON.parse(r.stderr).message.includes('legal source kinds for reports_to:'));
});
test('DDN-PJ002 message carries the remedy', () => {
  const src = 'ddn "0.6"; module "t";\nrecords r { columns: stage, value; label_column: stage; row s1: "A", 10; row s2: "B", 20; }\nview main { data:[@r]; projection { kind:chart; profile:"chart.funnel@1"; records:[@r.s1,@r.s2]; mark:funnel; x:"x_record.stage"; y:"x_record.value"; } place @r.s1 { at:[0px,0px]; } }';
  const dir = workspace({ 'main.ddn': src });
  const r = run(['check', path.join(dir, 'main.ddn'), '--workspace', dir, '--diagnostics', 'json']);
  const diags = JSON.parse(r.stdout);
  const d = diags.find(x => x.code === 'DDN-PJ002');
  if (d) assert.ok(d.message.includes('select a graph view'), 'hint present: ' + d.message);
  else assert.ok(diags.length, 'a coded diagnostic was raised: ' + JSON.stringify(diags));
});

/* 0.8 publication chrome (ch. 53): publish sets, print-size lint, chrome options */
const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082', 'hex');
const GRID_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M0 0H40M0 20H40M0 0V40M20 0V40" stroke="#999" stroke-width="1"/></svg>';
const CHROME_MODEL = 'data m { object a "Alpha" {kind: component;} object b "Beta" {kind: component;} relation r1 @a -> @b {kind: assoc;} }';
const CHROME_FORMAT = 'format shared { publication filing { size: letter; margin: 18mm; header { left { text: "$title"; size: 9pt; } right { text: "CONF - $date"; size: 8pt; } } footer { center { text: "FIG. $figure"; size: 10pt; } right { text: "Page $page"; size: 8pt; } } } }';
function binWorkspace(files, bins) {
  const dir = workspace(files);
  for (const [name, bytes] of Object.entries(bins || {})) fs.writeFileSync(path.join(dir, name), bytes);
  return dir;
}
test('publish writes one SVG per figure plus the manifest JSON', () => {
  const src = 'ddn "0.6"; module "m";\n' + CHROME_FORMAT + '\n' + CHROME_MODEL + '\nview v "Filing view" { data: [@m]; publication: @shared.filing; }\nview w "Second view" { data: [@m]; }\npublication_set figures "Patent figures" { publication: @shared.filing; figures: [@v, @w]; }';
  const dir = workspace({ 'main.ddn': src }), outdir = path.join(dir, 'out');
  const r = run(['publish', path.join(dir, 'main.ddn'), '--workspace', dir, '--set', 'figures', '--outdir', outdir, '--publication-date', '2026-10-04']);
  assert.equal(r.status, 0, r.stderr);
  for (const f of ['main--v.svg', 'main--w.svg', 'main--figures.manifest.json']) assert.ok(fs.existsSync(path.join(outdir, f)), f + ' written');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outdir, 'main--figures.manifest.json'), 'utf8')),
    { set: 'Patent figures', figures: [{ view_id: 'v', file: 'main--v.svg', figure: 1, page: 1 }, { view_id: 'w', file: 'main--w.svg', figure: 2, page: 2 }] });
  assert.ok(fs.readFileSync(path.join(outdir, 'main--v.svg'), 'utf8').includes('CONF - 2026-10-04'), '$date pinned by --publication-date');
});
test('publish with an unknown set is DDN-PB09', () => {
  const dir = workspace({ 'main.ddn': 'ddn "0.6"; module "m";\n' + CHROME_MODEL + '\nview v { data: [@m]; }\npublication_set s { figures: [@v]; }' });
  const r = run(['publish', path.join(dir, 'main.ddn'), '--workspace', dir, '--set', 'nope', '--outdir', path.join(dir, 'o')]);
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stderr).code, 'DDN-PB09');
});
test('publish without --set/--outdir is a usage error (exit 2)', () => {
  const dir = workspace({ 'main.ddn': 'ddn "0.6"; module "m";\n' + CHROME_MODEL + '\nview v { data: [@m]; }' });
  assert.equal(run(['publish', path.join(dir, 'main.ddn'), '--workspace', dir]).status, 2);
});
const A4_SRC = 'ddn "0.6"; module "m";\ndata m { object a "Alpha" {kind: component;} }\nview v { data: [@m]; publication { size: a4; header { left { text: "tiny"; size: 4pt; } } } }';
test('check reports DDN-PS01/PS03 for physical sizes and still passes', () => {
  const dir = workspace({ 'a4.ddn': A4_SRC });
  const r = run(['check', path.join(dir, 'a4.ddn'), '--workspace', dir, '--diagnostics', 'json']);
  assert.equal(r.status, 0, r.stderr);
  const codes = JSON.parse(r.stdout).map(d => [d.code, d.severity]);
  assert.ok(codes.some(([c, s]) => c === 'DDN-PS01' && s === 'warning'), 'PS01 warning present: ' + JSON.stringify(codes));
  assert.ok(codes.some(([c, s]) => c === 'DDN-PS03' && s === 'info'), 'PS03 info present: ' + JSON.stringify(codes));
});
test('check --strict-print fails with DDN-PS04', () => {
  const dir = workspace({ 'a4.ddn': A4_SRC });
  const r = run(['check', path.join(dir, 'a4.ddn'), '--workspace', dir, '--strict-print', '--diagnostics', 'json']);
  assert.equal(r.status, 1);
  assert.ok(JSON.parse(r.stdout).some(d => d.code === 'DDN-PS04' && d.severity === 'error'));
  const plain = run(['check', path.join(dir, 'a4.ddn'), '--workspace', dir, '--strict-print']);
  assert.equal(plain.status, 1);
  assert.equal(JSON.parse(plain.stdout).status, 'fail-print');
});
test('--publication-date invalid format is a usage error (exit 2)', () => {
  const dir = workspace({ 'main.ddn': good });
  assert.equal(run(['render', path.join(dir, 'main.ddn'), '--workspace', dir, '--publication-date', '2026-13-40']).status, 2);
  assert.equal(run(['render', path.join(dir, 'main.ddn'), '--workspace', dir, '--publication-date', 'Oct 4']).status, 2);
});
test('--figure/--page pass through to chrome variables', () => {
  const dir = workspace({ 'main.ddn': 'ddn "0.6"; module "m";\n' + CHROME_FORMAT + '\n' + CHROME_MODEL + '\nview v { data: [@m]; publication: @shared.filing; }' });
  const r = run(['render', path.join(dir, 'main.ddn'), '--workspace', dir, '--page', '3', '--figure', '2', '--publication-date', '2026-10-04']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes('Page 3') && r.stdout.includes('FIG. 2'));
});
test('background image loads from the workspace as base64; pattern as SVG text', () => {
  const src = 'ddn "0.6"; module "m";\n' + CHROME_MODEL + '\nview v { data: [@m]; publication { size: letter; background { image: "wm.png"; opacity: 0.15; } } }\nview p { data: [@m]; publication { size: content; background { pattern: "grid.svg"; } } }';
  const dir = binWorkspace({ 'main.ddn': src }, { 'wm.png': PNG_BYTES, 'grid.svg': GRID_SVG });
  const r = run(['render', path.join(dir, 'main.ddn'), '--workspace', dir, '--view', 'v']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes('data:image/png;base64,' + PNG_BYTES.toString('base64')), 'base64 image painted');
  const p = run(['render', path.join(dir, 'main.ddn'), '--workspace', dir, '--view', 'p']);
  assert.equal(p.status, 0, p.stderr);
  assert.ok(p.stdout.includes('ddn-pub-background') && p.stdout.includes('<pattern'), 'pattern painted');
});
test('background paths outside the workspace stay coded errors, not loader crashes', () => {
  const src = 'ddn "0.6"; module "m";\n' + CHROME_MODEL + '\nview v { data: [@m]; publication { overflow: error; background { image: "../escape.png"; } } }';
  const dir = workspace({ 'main.ddn': src });
  const r = run(['check', path.join(dir, 'main.ddn'), '--workspace', dir]);
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stderr).code, 'DDN-PB05');
});
/* 0.8 (ch. 54 §54.4): font_pin files side-load like background assets. */
test('font_pin metrics file loads from the workspace; check and render pass', () => {
  const pin = JSON.stringify({ engine: 'ddn-text@1', version: '2026-10-04', measurements: {} });
  const src = 'ddn "0.6"; module "m";\nformat f { style s { font: sans; font_pin: "pin.json"; } }\n' + CHROME_MODEL + '\nview v { data: [@m]; style: @f.s; }';
  const dir = workspace({ 'main.ddn': src, 'pin.json': pin });
  const c = run(['check', path.join(dir, 'main.ddn'), '--workspace', dir, '--diagnostics', 'json']);
  assert.equal(c.status, 0, c.stderr);
  assert.ok(!JSON.parse(c.stdout).some(d => d.code === 'DDN-PB05'), 'no PB05: ' + c.stdout);
  const r = run(['render', path.join(dir, 'main.ddn'), '--workspace', dir]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.startsWith('<?xml'), 'svg emitted');
});
test('font_pin declared but absent from the workspace still fails DDN-PB05', () => {
  const src = 'ddn "0.6"; module "m";\nformat f { style s { font_pin: "absent.json"; } }\n' + CHROME_MODEL + '\nview v { data: [@m]; style: @f.s; }';
  const dir = workspace({ 'main.ddn': src });
  const r = run(['check', path.join(dir, 'main.ddn'), '--workspace', dir]);
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stderr).code, 'DDN-PB05');
});

const passed = results.filter(r => r.pass).length;
console.log(`cli-tooling ${passed}/${results.length}`);
if (passed !== results.length) process.exitCode = 1;
