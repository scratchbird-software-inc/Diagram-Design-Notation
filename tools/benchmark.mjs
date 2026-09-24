#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. B1-031 (D1): measured performance baseline.
 *
 *   node tools/benchmark.mjs            # full run: median of N iterations per case,
 *                                       # writes standard/registry/performance-baseline.json
 *                                       # and prints the markdown table quoted in the docs
 *   node tools/benchmark.mjs --smoke    # CI gate: one iteration per case, fails only when a
 *                                       # timing exceeds 10x the committed baseline (catches
 *                                       # egregious regressions, immune to machine speed)
 *
 * Corpus (fixed, representative): small graph (repo example), medium graph (48 nodes,
 * generated deterministically), large graph (the 128-element / 384-relation live-view
 * boundary), a 20-record bar chart with a data-only refresh via the B1-029 replaceData
 * API, and a composed dashboard (panels.composed@1, 4 child views) with data refresh.
 *
 * Metrics per case: cold build+render, warm re-render (same workspace, compiled-IR cache
 * warm), data-only refresh (replaceData + renderSync where the case has a data block),
 * serialized-IR bytes, SVG bytes, peak process RSS observed across the case.
 *
 * Zero dependencies; runs against notation/dist/ddn.global.js exactly like a consumer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(REPO, 'standard/registry/performance-baseline.json');
const SMOKE = process.argv.includes('--smoke');
const ITERATIONS = SMOKE ? 1 : 3;
const CEILING_FACTOR = 10;
/* Absolute floor per timing ceiling: on a millisecond-scale case, 10x is still
 * tens of ms and cold-process JIT/module-load noise after a long test suite can
 * exceed it. The gate exists to catch egregious regressions, not machine load. */
const CEILING_FLOOR_MS = 250;

const DDN = (await import(pathToFileURL(path.join(REPO, 'notation/dist/ddn.global.js')))).default;

const read = rel => fs.readFileSync(path.join(REPO, rel), 'utf8');

/* ---------------------------------------------------------------- corpus */

function smallGraph() {
  return {
    files: {
      'shared.ddn': read('website/examples/basics/shared.ddn'),
      'customer-data.ddn': read('website/examples/basics/customer-data.ddn'),
      'main.ddn': read('website/examples/basics/01-customer.ddn'),
    },
    entry: 'main.ddn', view: 'overview',
  };
}

/* Deterministic synthetic balanced tree (org-chart shape): n nodes, n-1
 * relations. Trees route collision-free under algorithm:tree + orthogonal;
 * cyclic/dense synthetic graphs hit the router's bounded-search refusals
 * (DDN215/DDN217) and are not representative of authored diagrams. */
function generatedTree(id, n, fan) {
  const lines = ['ddn "0.5";', 'module "bench.' + id + '";', '', 'data model {'];
  for (let i = 1; i <= n; i++) lines.push('    object n' + i + ' "Node ' + i + '" { kind: application; }');
  let rel = 0;
  for (let i = 2; i <= n; i++) lines.push('    relation r' + (++rel) + ' @n' + (Math.floor((i - 2) / fan) + 1) + ' -> @n' + i + ' { kind: flow; }');
  lines.push('}', '', 'view main "' + id + '" {', '    data: [@model];', '    layout { algorithm: tree; routing: orthogonal; }', '    publication { size: content; fit: none; }', '}', '');
  return { files: { 'main.ddn': lines.join('\n') }, entry: 'main.ddn', view: 'main' };
}

function chartCase() {
  const rec = i => '    object m' + i + ' "Service ' + i + '" { kind: record; x_record: { key: "m' + i + '", label: "Service ' + i + '", value: ' + (i * 7 % 23 + 4) + ', unit: "ms" }; }';
  const records = Array.from({ length: 20 }, (_, i) => rec(i + 1)).join('\n');
  const refs = Array.from({ length: 20 }, (_, i) => '@metrics.m' + (i + 1)).join(', ');
  const source = 'ddn "0.5";\nmodule "bench.chart";\n\ndata metrics {\n' + records + '\n}\n\n' +
    'view latency "Latency by service" {\n    data: [@metrics];\n' +
    '    projection { kind: chart; profile: "chart.basic@1"; records: [' + refs + ']; mark: bar; x: "x_record.label"; y: "x_record.value"; unit: "ms"; width: 900px; height: 560px; }\n' +
    '    publication { size: content; fit: none; }\n}\n';
  return {
    files: { 'main.ddn': source }, entry: 'main.ddn', view: 'latency',
    refresh: { block: 'metrics', records: Array.from({ length: 20 }, (_, i) => ({ key: 'm' + (i + 1), label: 'Service ' + (i + 1), value: (i * 11 % 19 + 6), unit: 'ms' })) },
  };
}

function dashboardCase() {
  const rec = (b, i, v) => '    object m' + i + ' "Row ' + i + '" { kind: record; x_record: { key: "' + b + i + '", label: "Row ' + i + '", value: ' + v + ', unit: "ms" }; }';
  const block = (b, n) => 'data ' + b + ' {\n' + Array.from({ length: n }, (_, i) => rec(b, i + 1, (i * 5 + 3) % 17 + 2)).join('\n') + '\n}\n';
  const refs = (b, n) => Array.from({ length: n }, (_, i) => '@' + b + '.m' + (i + 1)).join(', ');
  const child = (b, v, n) => 'view ' + v + ' "' + b + ' chart" {\n    data: [@' + b + '];\n' +
    '    projection { kind: chart; profile: "chart.basic@1"; records: [' + refs(b, n) + ']; mark: bar; x: "x_record.label"; y: "x_record.value"; unit: "ms"; width: 640px; height: 400px; }\n' +
    '    publication { size: content; fit: none; }\n}\n';
  const source = 'ddn "0.5";\nmodule "bench.dash";\n\n' +
    ['alpha', 'beta', 'gamma', 'delta'].map(b => block(b, 12)).join('\n') + '\n' +
    child('alpha', 'alpha_chart', 12) + '\n' + child('beta', 'beta_chart', 12) + '\n' +
    child('gamma', 'gamma_chart', 12) + '\n' + child('delta', 'delta_chart', 12) + '\n' +
    'view board "Operations board" {\n    data: [@alpha];\n' +
    '    projection { kind: panels; profile: "panels.composed@1"; columns: 2; panels: [\n' +
    '        {id:"a", title:"Alpha", row:0, column:0, view:@alpha_chart},\n' +
    '        {id:"b", title:"Beta", row:0, column:1, view:@beta_chart},\n' +
    '        {id:"c", title:"Gamma", row:1, column:0, view:@gamma_chart},\n' +
    '        {id:"d", title:"Delta", row:1, column:1, view:@delta_chart}]; }\n' +
    '    publication { size: content; fit: none; }\n}\n';
  return {
    files: { 'main.ddn': source }, entry: 'main.ddn', view: 'board',
    refresh: { block: 'alpha', records: Array.from({ length: 12 }, (_, i) => ({ key: 'alpha' + (i + 1), label: 'Row ' + (i + 1), value: (i * 9 % 13 + 5), unit: 'ms' })) },
  };
}

const CASES = [
  { id: 'small-graph', description: 'basics/01-customer.ddn overview (repo example, 3-file workspace)', make: smallGraph },
  { id: 'medium-graph', description: 'generated 32-node / 31-relation balanced tree (org-chart shape)', make: () => generatedTree('medium', 32, 2) },
  { id: 'large-graph', description: 'generated 127-node / 126-relation balanced tree — just under the 128-element live-view boundary', make: () => generatedTree('large', 127, 2) },
  { id: 'chart-refresh', description: '20-record bar chart + replaceData refresh', make: chartCase },
  { id: 'dashboard-refresh', description: 'panels.composed@1 dashboard, 4 child chart views (12 records each) + replaceData refresh', make: dashboardCase },
];

/* ---------------------------------------------------------------- harness */

const now = () => performance.now();
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const round1 = x => Math.round(x * 10) / 10;

function measureCase(c) {
  const def = c.make();
  let peak = 0;
  const sample = () => { peak = Math.max(peak, process.memoryUsage().rss); };
  const cold = [], warm = [], refresh = [];
  let irBytes = 0, svgBytes = 0, selected = 0, relations = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    if (globalThis.gc) globalThis.gc();
    let ws = DDN.createWorkspace(def.files);
    let t = now();
    const r0 = ws.renderSync({ entry: def.entry, view: def.view });
    cold.push(now() - t); sample();
    irBytes = JSON.stringify(ws.resolve(def.entry, def.view)).length;
    svgBytes = r0.svg.length;
    const ir = ws.resolve(def.entry, def.view);
    selected = ir.view.selected.length; relations = ir.view.relations.length;
    t = now();
    ws.renderSync({ entry: def.entry, view: def.view });
    warm.push(now() - t); sample();
    if (def.refresh) {
      t = now();
      ws.replaceData(def.refresh.block, def.refresh.records);
      ws.renderSync({ entry: def.entry, view: def.view });
      refresh.push(now() - t); sample();
    }
    ws.destroy(); ws = null;
  }
  return {
    id: c.id, description: c.description, selected, relations,
    coldMs: round1(median(cold)), warmMs: round1(median(warm)),
    refreshMs: refresh.length ? round1(median(refresh)) : null,
    irBytes, svgBytes, peakRssMB: round1(peak / 1048576),
  };
}

/* ---------------------------------------------------------------- run */

const results = CASES.map(measureCase);

if (SMOKE) {
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const byId = new Map(baseline.cases.map(c => [c.id, c]));
  const failures = [];
  for (const r of results) {
    const b = byId.get(r.id);
    if (!b) { failures.push(r.id + ': missing from baseline'); continue; }
    for (const k of ['coldMs', 'warmMs', 'refreshMs']) {
      if (r[k] == null) continue;
      const ceiling = Math.max(b[k] * CEILING_FACTOR, CEILING_FLOOR_MS);
      if (r[k] > ceiling) failures.push(r.id + ' ' + k + ' ' + r[k] + 'ms > ' + CEILING_FACTOR + 'x baseline ceiling ' + ceiling + 'ms');
    }
  }
  for (const r of results) console.log('smoke', r.id, 'cold ' + r.coldMs + 'ms warm ' + r.warmMs + 'ms' + (r.refreshMs != null ? ' refresh ' + r.refreshMs + 'ms' : ''));
  if (failures.length) { console.error('benchmark smoke FAILED:\n' + failures.join('\n')); process.exit(1); }
  console.log('benchmark smoke: all ' + results.length + ' cases within ceilings (' + CEILING_FACTOR + 'x baseline, ' + CEILING_FLOOR_MS + 'ms floor)');
  process.exit(0);
}

const baseline = {
  $schema: 'https://scratchbird.ca/ddn/performance-baseline.schema.json',
  description: 'B1-031 measured performance baseline for the DDN reference runtime. Median of ' + ITERATIONS + ' iterations per case; regenerate with `npm run benchmark`. Timings are machine-dependent — the committed values are a reference point, and the smoke gate only trips beyond ' + CEILING_FACTOR + 'x (with a ' + CEILING_FLOOR_MS + ' ms absolute floor against cold-process noise).',
  runtime: DDN.VERSION,
  measuredOn: new Date().toISOString().slice(0, 10),
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  metrics: {
    coldMs: 'createWorkspace + first renderSync (parse, build, layout, route, SVG)',
    warmMs: 'renderSync again on the same workspace (compiled-IR cache warm)',
    refreshMs: 'replaceData + renderSync (data-only refresh; null when the case has no data block)',
    irBytes: 'JSON.stringify of the resolved IR (ws.resolve)',
    svgBytes: 'rendered SVG text length',
    peakRssMB: 'peak process RSS sampled during the case (whole benchmark process, not per-case delta)',
  },
  cases: results,
};
fs.writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + '\n');

const rows = [
  '| Case | Elements | Relations | Cold build+render | Warm re-render | Data refresh | IR bytes | SVG bytes | Peak RSS |',
  '| ---- | -------: | --------: | ----------------: | -------------: | -----------: | -------: | --------: | -------: |',
  ...results.map(r => '| ' + r.id + ' | ' + r.selected + ' | ' + r.relations + ' | ' + r.coldMs + ' ms | ' + r.warmMs + ' ms | ' + (r.refreshMs == null ? '—' : r.refreshMs + ' ms') + ' | ' + r.irBytes.toLocaleString('en-US') + ' | ' + r.svgBytes.toLocaleString('en-US') + ' | ' + r.peakRssMB + ' MB |'),
];
console.log(rows.join('\n'));
console.log('\nbaseline written to ' + path.relative(REPO, BASELINE) + ' (runtime ' + DDN.VERSION + ', node ' + process.version + ', ' + process.platform + '/' + process.arch + ')');
