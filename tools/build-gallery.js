#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later.
 * B1-010 gallery generator (D1/D2/D5), overhauled by B1-053:
 *
 * Builds website/examples/gallery/:
 *   - one rendered SVG per installed profile (coverage map: profile -> nearest
 *     existing basics/projections example; profiles with no example would need a
 *     new minimal source under website/examples/gallery/src/ — the generator FAILS when
 *     an installed profile has no mapped example),
 *   - variation sheets: chart marks, looks x palettes, routing x look,
 *     layout algorithms, spacing levels,
 *   - combined single-file variants (<name>.combined.ddn) of every multi-file
 *     example entry used by the gallery (B1-053): written beside the originals
 *     and verified to render byte-identical SVG for every view the gallery
 *     renders from that entry,
 *   - coverage.json (the machine-readable coverage map consumed by
 *     notation/tests/gallery-coverage.js),
 *   - index.html: a static, file://-safe page wrapped in the same site
 *     navigator as every other website page (B1-053 D1). Every figure carries
 *     a detail view (B1-053 D4): an explanation, deep links that open the
 *     exact view in the unified tool (?entry=&view=&mode=, verified against
 *     notation/tool/src/tool.js — ?src= ignores the view param, ?entry= does
 *     not), a wiki link when a matching wiki page exists, and a browsable DDN
 *     source area (one shared, collapsed source block per unique entry at the
 *     foot of the page, anchored from each figure).
 *
 * Every SVG is produced by the real CLI render path
 * (notation/cli/cli.js render). Generation is deterministic: sorted inputs,
 * fixed templates, no timestamps or random values.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'notation/cli/cli.js');
const OUT = path.join(ROOT, 'website/examples/gallery');
const SRC = path.join(OUT, 'src');
const A = require(path.join(ROOT, 'notation/dist/ddn.global.js'));
/* B1-035 (D1): mirror the CLI's optional-module wiring so the build host matches
 * the render host. The geo plates already render (the CLI registers ddn-geo and
 * every render below goes through the CLI); ddn-iso was never loaded anywhere in
 * the gallery path, which is why no iso plates existed. Loading it publishes the
 * DDNIso namespace the engine consults for iso/depth views. */
require(path.join(ROOT, 'notation/runtime/ddn-iso.js'));

const pkg = require(path.join(ROOT, 'package.json'));
const catalogue = require(path.join(ROOT, 'standard/registry/profiles/catalogue.json'));
const PROJECTION_KINDS = [...new Set(catalogue.profiles.map(p => p.projection))].sort();

/* Variation sheets: gallery src file -> the views that make up the sheet. */
const SHEETS = [
  { id: 'marks', title: 'Chart marks', file: 'marks.ddn', wiki: 'Diagrams-Charts', blurb: 'Every chart mark the runtime renders: bar, line, area, point, pie, donut (chart.basic@1); radar, funnel, gauge, candlestick, treemap, sankey (their own profiles); and the Category-2 pack (B1-024): histogram, density, qq, quantiledot, dotplot, boxplot, violin, beeswarm, topk, tidytree, radialtree, circlepack, sunburst, packedbubble, heatmap, densityheatmap, calendar, parallelcoords, wordcloud, arc, force, edgebundle; and the isometric variants of the extrudable marks (B1-035): iso bar, pie, donut, area, treemap — plus an iso multi-series grouped bar (B1-036).' },
  { id: 'looks', title: 'Looks × palettes', file: 'looks.ddn', blurb: 'Every look (classic, handDrawn, neo) crossed with every palette theme (default, neutral, dark, night, forest, base).' },
  { id: 'routing', title: 'Routing × look', file: 'routing.ddn', blurb: 'Every routing mode (orthogonal, straight, curved bezier, curved rounded) crossed with every look.' },
  { id: 'layouts', title: 'Layout algorithms', file: 'layouts.ddn', blurb: 'Every placement algorithm: native grid, manual (pinned), layered, tree, mindmap, grouped, and the pattern-based fit_grid, circular, radial, spanning_tree, organic.' },
  { id: 'spacing', title: 'Spacing levels', file: 'spacing.ddn', blurb: 'The four spacing hints (tight, normal, loose, expanded) on one graph (B1-008).' },
  /* B1-035: iso sheets source their views straight from the basics examples
   * (entry overrides the default gallery/src/<file>). */
  { id: 'iso', title: 'Isometric charts', entry: 'website/examples/basics/72-iso-charts.ddn', wiki: 'Diagrams-Isometric', blurb: 'Every extrudable chart mark (bar, pie, donut, area, treemap) with iso depth, plus a multi-series grouped bar on the quality-render path (B1-036), from examples/basics/72-iso-charts.ddn (B1-034).' },
  { id: 'isograph', title: 'Isometric graph', entry: 'website/examples/basics/73-iso-architecture.ddn', wiki: 'Diagrams-Architecture-Advanced', blurb: 'Graph nodes as extruded prisms on an isometric ground plane, from examples/basics/73-iso-architecture.ddn (B1-034).' }
];

/* B1-053 (D4): wiki mapping. A figure links a wiki page only when a page that
 * actually covers the diagram type exists in
 * github.com/scratchbird-software-inc/Diagram-Design-Notation/wiki — ordered
 * [prefix-or-exact-id, page] rules; anything unlisted gets no wiki link. */
const WIKI_BASE = 'https://github.com/scratchbird-software-inc/Diagram-Design-Notation/wiki/';
const WIKI_RULES = [
  ['erd.', 'Diagrams-ERD'],
  ['chen.', 'Diagrams-ERD-Notation'],
  ['dfd.', 'Diagrams-Data-flow'],
  ['flow.documented', 'Diagrams-Flowcharts-Decisions'],
  ['flow.', 'Diagrams-Flowcharts'],
  ['ddn@', 'Diagrams-Flowcharts'],
  ['epc.', 'Diagrams-Flowcharts'],
  ['bpmn.', 'Diagrams-Flowcharts'],
  ['uml.activity', 'Diagrams-Flowcharts'],
  ['uml.interaction_overview', 'Diagrams-Flowcharts'],
  ['uml.sequence', 'Diagrams-Sequence'],
  ['uml.timing', 'Diagrams-Sequence'],
  ['c4.', 'Diagrams-Architecture'],
  ['matrix.', 'Diagrams-Matrices'],
  ['panels.basic', 'Diagrams-Dashboards'],
  ['panels.composed', 'Diagrams-Dashboards'],
  ['panels.journey', 'Diagrams-Dashboards'],
  ['timeline.', 'Diagrams-Timelines'],
  ['fishbone.', 'Diagrams-Fishbone'],
  ['state.', 'Diagrams-States'],
  ['decision.', 'Diagrams-Decision-tables'],
  ['org.tree', 'Diagrams-Trees'],
  ['wbs.tree', 'Diagrams-Trees'],
  ['mindmap.', 'Diagrams-Trees'],
  ['family.tree', 'Diagrams-Trees'],
  ['fault.tree', 'Diagrams-Trees'],
  ['event.tree', 'Diagrams-Trees'],
  ['chart.tidytree', 'Diagrams-Trees'],
  ['chart.radialtree', 'Diagrams-Trees'],
  ['chart.treemap', 'Diagrams-Trees-Packed'],
  ['chart.circlepack', 'Diagrams-Trees-Packed'],
  ['chart.sunburst', 'Diagrams-Trees-Packed'],
  ['chart.packedbubble', 'Diagrams-Trees-Packed'],
  ['chart.arc', 'Diagrams-Networks'],
  ['chart.force', 'Diagrams-Networks'],
  ['chart.edgebundle', 'Diagrams-Networks'],
  ['network.', 'Diagrams-Networks'],
  ['chart.histogram', 'Diagrams-Charts-Statistical'],
  ['chart.density', 'Diagrams-Charts-Statistical'],
  ['chart.qq', 'Diagrams-Charts-Statistical'],
  ['chart.quantiledot', 'Diagrams-Charts-Statistical'],
  ['chart.dotplot', 'Diagrams-Charts-Statistical'],
  ['chart.boxplot', 'Diagrams-Charts-Statistical'],
  ['chart.violin', 'Diagrams-Charts-Statistical'],
  ['chart.beeswarm', 'Diagrams-Charts-Statistical'],
  ['chart.topk', 'Diagrams-Charts-Statistical'],
  ['chart.heatmap', 'Diagrams-Charts-Statistical'],
  ['chart.densityheatmap', 'Diagrams-Charts-Statistical'],
  ['chart.calendar', 'Diagrams-Charts-Statistical'],
  ['chart.parallelcoords', 'Diagrams-Charts-Statistical'],
  ['chart.quality', 'Diagrams-Charts-Statistical'],
  ['chart.', 'Diagrams-Charts'],
  ['geo.', 'Diagrams-Maps']
];
function wikiPageFor(profileId) {
  for (const [prefix, page] of WIKI_RULES) if (profileId.startsWith(prefix)) return page;
  return null;
}

/* B1-053 (D4): one-line explanations ("what it shows"), keyed by exact profile
 * id where the family phrase alone is too vague, with family-prefix fallback. */
const EXPLAIN_EXACT = {
  'ddn@1': 'Free-form DDN graph: objects and relations from the semantic model drawn as boxes and links.',
  'uml.usecase@1': 'Use-case view: actors outside the system boundary and the capabilities they interact with.',
  'uml.usecase@2': 'Use-case view with include/extend relationships between use cases.',
  'requirements.basic@1': 'Requirements breakdown: requirement nodes and their satisfaction, derivation and verification links.',
  'canvas.bmc@1': 'Business model canvas: the nine classic blocks of a business model on one page.',
  'canvas.lean@1': 'Lean canvas: the startup-focused variant of the business model canvas.',
  'canvas.pest@1': 'PEST canvas: political, economic, social and technological forces around an endeavour.',
  'canvas.pestle@1': 'PESTLE canvas: PEST plus legal and environmental forces.',
  'canvas.porter5@1': 'Porter five-forces canvas: competitive pressures on an industry.',
  'canvas.empathy@1': 'Empathy map: what a user says, thinks, does and feels.',
  'canvas.scorecard@1': 'Balanced scorecard: objectives across financial, customer, process and learning perspectives.',
  'table.records@1': 'Records table: model records rendered as a literal rows-and-columns table.',
  'panels.pyramid@1': 'Pyramid: stacked layers from a broad base to a peak (hierarchies of need, priority or abstraction).',
  'panels.venn@1': 'Venn diagram: overlapping sets and what falls into each intersection.',
  'panels.journey@1': 'Customer journey map: stages across the top, touchpoints and experiences beneath.',
  'uml.structure@1': 'Structural (class-style) view: types, their features and their relationships.',
  'uml.communication@1': 'Communication view: objects and the numbered messages they exchange, laid out as a graph.',
  'uml.object@1': 'Object view: instances and their links at one moment in time.',
  'uml.interaction_overview@1': 'Interaction overview: a flowchart whose nodes are whole interaction fragments.',
  'cmmn.basic@1': 'CMMN-style case view: a case plan with its stages, tasks and discretionary items.',
  'sysml.bdd@1': 'SysML-style block definition diagram: blocks and their classification/composition.',
  'sysml.ibd@1': 'SysML-style internal block diagram: parts, ports and connectors inside a block.',
  'sysml.parametric@1': 'SysML-style parametric diagram: constraint blocks and the properties they bind.',
  'archimate.basic@1': 'ArchiMate-style layered enterprise architecture view (business, application, technology).',
  'pert.cpm@1': 'PERT/CPM network: tasks with earliest/latest schedules and the critical path.',
  'fault.tree@1': 'Fault tree: a top event decomposed downward through logic gates to basic causes.',
  'event.tree@1': 'Event tree: forward-branching consequences of one initiating event.',
  'network.rack@1': 'Rack diagram: equipment placed into the slots of a rack enclosure.',
  'wireframe.ui@1': 'UI wireframe: a screen skeleton assembled from model elements.',
  'family.tree@1': 'Family tree: people and unions across generations.',
  'concept.map@1': 'Concept map: concepts connected by labelled propositions.',
  'chart.wordcloud@1': 'Word cloud: terms sized by weight.',
  'chart.calendar@1': 'Calendar heatmap: one cell per day, coloured by value, on a calendar grid.',
  'chart.parallelcoords@1': 'Parallel coordinates: each record a polyline across parallel measure axes.',
  'chart.quality@1': 'Quality chart: values with error bars and regression/loess overlays.',
  'matrix.storymap@1': 'Story map: user activities across the top, stories ordered by release beneath.',
  'matrix.bcg@1': 'BCG matrix: offerings plotted by market growth and relative share.',
  'matrix.ansoff@1': 'Ansoff matrix: growth options across new/existing products and markets.',
  'matrix.tows@1': 'TOWS matrix: strategies pairing internal strengths/weaknesses with external opportunities/threats.',
  'matrix.heatmap@1': 'Heatmap matrix: cells coloured by intensity of a value.',
  'matrix.raci@1': 'RACI matrix: process steps against roles; cells hold R/A/C/I responsibility codes.',
  'matrix.crud@1': 'CRUD matrix: which steps create, read, update and delete which data objects.',
  'matrix.relations@1': 'Relations matrix: a general encoded-relationship grid between two sets of elements.',
  'chart.basic@1': 'Chart computed from records: bar, line, area, point, pie and donut marks.',
  'chart.radar@1': 'Radar chart: measures plotted on spokes around a centre for profile comparison.',
  'chart.funnel@1': 'Funnel: stage values narrowing top to bottom.',
  'chart.gauge@1': 'Gauge: a single value against qualitative ranges on a dial.',
  'chart.candlestick@1': 'Candlestick: open/high/low/close per period.',
  'chart.treemap@1': 'Treemap: hierarchy as nested rectangles sized by value.',
  'chart.sankey@1': 'Sankey: flows between stages with widths proportional to quantity.',
  'timeline.basic@1': 'Timeline (gantt): dated task bars positioned by start, lengthened by duration, with dependency links.',
  'flow.basic@1': 'Process flow: steps as boxes, decisions as diamonds, arrows showing order of execution.',
  'flow.documented@2': 'Documented control flow with numbered cross-sheet references and animated flows.',
  'dfd.gane_sarson@1': 'Gane–Sarson DFD: numbered processes, data stores and external entities with labelled data flows.',
  'dfd.yourdon@1': 'Yourdon–DeMarco DFD: circles for processes, parallel lines for stores, data flows between them.',
  'chen.basic@1': 'Chen-notation ERD: rectangle entities, oval attributes, diamond relationships with cardinality.',
  'chen.binary@2': 'Chen-notation ERD restricted to binary relationships.',
  'erd.crowfoot@1': 'Crow’s-foot ERD: entity boxes with field lists and cardinality marks on relationship ends.',
  'panels.basic@1': 'Panels: a simple titled-panel layout of sub-views.',
  'panels.composed@1': 'Composed dashboard: several complete views arranged into a grid of titled panels.',
  'state.flat@1': 'Flat state machine: states and the transitions between them.',
  'state.composite@1': 'Composite state machine: nested and parallel states in one lifecycle.',
  'decision.rules@1': 'Decision table: rules as rows — when these conditions hold, then these actions — with a hit policy.',
  'c4.context@1': 'C4 system context: the system as one box among people and other systems.',
  'c4.container@1': 'C4 container view: the big moving parts inside the system — apps, stores, queues.',
  'c4.component@1': 'C4 component view: components inside one container and their interactions.',
  'org.tree@1': 'Org chart: reporting hierarchy as a top-down tidy tree.',
  'wbs.tree@1': 'Work breakdown structure: project scope decomposed as a tree.',
  'mindmap.basic@1': 'Mind map: a free-flowing radial brainstorm around a central idea.',
  'epc.basic@1': 'Event-driven process chain: events and functions alternating along the process.',
  'bpmn.basic@1': 'BPMN-style process: tasks, gateways and events along a sequence flow.',
  'uml.activity@1': 'Activity view: actions, decisions, forks and joins in an execution flow.',
  'uml.sequence@1': 'Sequence view: participants with lifelines exchanging ordered, numbered messages.',
  'uml.timing@1': 'Timing view: one band per participant showing which state it occupies over time.',
  'network.basic@1': 'Network diagram: nodes and links without hierarchy.',
  'chart.histogram@1': 'Histogram: measurements grouped into bins to show a distribution’s shape.',
  'chart.density@1': 'Density plot: a smoothed estimate of a distribution.',
  'chart.qq@1': 'Q–Q plot: sample quantiles against theoretical quantiles to judge normality.',
  'chart.quantiledot@1': 'Quantile dotplot: a distribution drawn as stacked quantile dots.',
  'chart.dotplot@1': 'Dot plot: individual values stacked along a measure axis.',
  'chart.boxplot@1': 'Box plot: median, quartiles and whiskers per group.',
  'chart.violin@1': 'Violin plot: a mirrored density per group.',
  'chart.beeswarm@1': 'Beeswarm: individual points jittered to avoid overlap along a measure axis.',
  'chart.topk@1': 'Top-K chart: the K largest values, ranked.',
  'chart.tidytree@1': 'Tidy tree: a hierarchy laid out top-down with sized nodes.',
  'chart.radialtree@1': 'Radial tree: a hierarchy fanned out in a circle.',
  'chart.circlepack@1': 'Circle packing: a hierarchy as nested circles sized by value.',
  'chart.sunburst@1': 'Sunburst: a hierarchy as rings sized by value.',
  'chart.packedbubble@1': 'Packed bubbles: groups of sized circles packed together.',
  'chart.heatmap@1': 'Heatmap: a measure across two categorical axes drawn as coloured cells.',
  'chart.densityheatmap@1': 'Density heatmap: a 2-D density estimate drawn as coloured cells.',
  'chart.arc@1': 'Arc diagram: nodes on a line, links drawn as arcs weighted by value.',
  'chart.force@1': 'Force-directed network: nodes clustered by a seeded physics layout, links weighted by value.',
  'chart.edgebundle@1': 'Hierarchical edge bundling: links braided together along a hierarchy.',
  'geo.choropleth@1': 'Choropleth map: regions shaded by value (requires the optional ddn-geo module).',
  'geo.symbols@1': 'Symbol map: sized/coloured marks at geographic locations (requires ddn-geo).',
  'geo.outline@1': 'Outline map: plain region boundaries without data fill (requires ddn-geo).'
};
const EXPLAIN_PREFIX = [
  ['uml.', 'A UML-style view of the semantic model.'],
  ['canvas.', 'A fixed one-page strategy canvas of labelled cells.'],
  ['matrix.', 'A grid where rows meet columns and each filled cell records the relationship.'],
  ['panels.', 'A panel layout composing sub-views on one page.'],
  ['chart.', 'A chart computed from records.'],
  ['geo.', 'A geographic map view (requires the optional ddn-geo module).']
];
function explainProfile(id) {
  if (EXPLAIN_EXACT[id]) return EXPLAIN_EXACT[id];
  for (const [prefix, text] of EXPLAIN_PREFIX) if (id.startsWith(prefix)) return text;
  const entry = catalogue.profiles.find(p => p.id === id);
  const fam = entry && entry.diagramFamilies && entry.diagramFamilies[0];
  return (fam ? fam + ' view' : 'Diagram view') + ' rendered by the ' + id + ' profile.';
}

const slug = id => id.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Example entry files scanned for profile coverage, in priority order. */
function exampleEntries() {
  const basics = fs.readdirSync(path.join(ROOT, 'website/examples/basics'))
    .filter(f => /^\d+-.*\.ddn$/.test(f) && !f.endsWith('.combined.ddn')).sort()
    .map(f => path.join('website/examples/basics', f));
  const projections = fs.readdirSync(path.join(ROOT, 'website/examples/projections'))
    .filter(f => f.endsWith('.ddn') && !f.endsWith('.combined.ddn')).sort()
    .map(f => path.join('website/examples/projections', f));
  const quality = fs.readdirSync(path.join(ROOT, 'website/examples/quality'))
    .filter(f => f.endsWith('.ddn') && !f.endsWith('.combined.ddn')).sort()
    .map(f => path.join('website/examples/quality', f));
  const gallerySrc = fs.existsSync(SRC)
    ? fs.readdirSync(SRC).filter(f => f.endsWith('.ddn')).sort().map(f => path.join('website/examples/gallery/src', f))
    : [];
  return [...basics, ...projections, ...quality, ...gallerySrc];
}

/* Load an entry plus its transitive imports into a workspace file map. */
function filesFor(entry) {
  const files = {};
  const visit = name => {
    if (Object.hasOwn(files, name)) return;
    files[name] = fs.readFileSync(path.join(ROOT, name), 'utf8');
    for (const imp of A.parse(files[name], name).imports) visit(A.resolvePath(name, imp.path));
  };
  visit(entry);
  return files;
}

/* Render one view through the real CLI path. */
function render(entry, view, outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  execFileSync(process.execPath, [CLI, 'render', entry, '--view', view, '--out', outFile, '--workspace', path.dirname(entry)], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
  const svg = fs.readFileSync(outFile, 'utf8');
  if (!svg.includes('<svg')) throw new Error('Render did not produce SVG: ' + outFile);
}

/* B1-053 (D3): combined single-file variants. Every multi-file .ddn entry under
 * website/examples/ (any file with top-level import lines) gets a
 * <name>.combined.ddn written beside it via the CLI bundle path, then every
 * view it declares is rendered from BOTH the original workspace and the
 * combined file and byte-compared — the combined variant provably renders
 * identically. Returns { entry -> combinedEntry }. */
function* walkDdn(absDir, relBase) {
  for (const e of fs.readdirSync(absDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(absDir, e.name);
    if (e.isDirectory()) yield* walkDdn(p, relBase + e.name + '/');
    else if (e.name.endsWith('.ddn') && !e.name.endsWith('.combined.ddn')) yield relBase + e.name;
  }
}
function buildCombinedVariants() {
  const combined = new Map();
  for (const entry of walkDdn(path.join(ROOT, 'website/examples'), 'website/examples/')) {
    const text = fs.readFileSync(path.join(ROOT, entry), 'utf8');
    if (!/^[ \t]*import[ \t]+"/m.test(text)) continue; // single-file already
    const files = filesFor(entry);
    const out = entry.replace(/\.ddn$/, '.combined.ddn');
    execFileSync(process.execPath, [CLI, 'bundle', entry, '--workspace', path.dirname(entry), '--out', out], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
    const bundled = fs.readFileSync(path.join(ROOT, out), 'utf8');
    if (/^[ \t]*import[ \t]+"/m.test(bundled)) throw new Error('combined variant still imports: ' + out);
    const ws = A.createWorkspace(files);
    const views = ws.views(entry).map(v => v.id);
    ws.destroy();
    if (!views.length) {
      /* Library file (imported by other examples, declares no views): there is
       * nothing to render or open, so no combined variant is offered. */
      fs.rmSync(path.join(ROOT, out));
      continue;
    }
    for (const view of views) {
      const a = path.join(OUT, '.verify-original.svg');
      const b = path.join(OUT, '.verify-combined.svg');
      render(entry, view, a);
      render(out, view, b);
      if (!fs.readFileSync(a).equals(fs.readFileSync(b)))
        throw new Error('combined variant renders differently: ' + out + ' view ' + view);
      fs.rmSync(a); fs.rmSync(b);
    }
    combined.set(entry, out);
    process.stdout.write('combined variant: ' + out + ' (' + views.length + ' views render byte-identical)\n');
  }
  return combined;
}

/* Build the profile coverage map: first entry (priority order) whose view
 * resolves to the profile wins. Fails when a profile has no example. */
function buildCoverageMap() {
  const profiles = catalogue.profiles.map(p => p.id).sort();
  const remaining = new Map(profiles.map(id => [id, null]));
  for (const entry of exampleEntries()) {
    if (![...remaining.values()].includes(null)) break;
    let ws;
    try { ws = A.createWorkspace(filesFor(entry)); } catch { continue; }
    for (const v of ws.views(entry)) {
      let profile;
      try { profile = ws.resolve(entry, v.id).view.profiles.projection.profile; } catch { continue; }
      if (remaining.get(profile) === null) remaining.set(profile, { entry, view: v.id, title: v.name });
    }
    ws.destroy();
  }
  const missing = [...remaining.entries()].filter(([, v]) => v === null).map(([id]) => id);
  if (missing.length) {
    console.error('Gallery coverage gap: no example renders these installed profiles:');
    for (const id of missing) console.error('  - ' + id + '  (add a minimal real source under website/examples/gallery/src/)');
    process.exit(1);
  }
  return remaining;
}

function sheetEntry(sheet) {
  return sheet.entry || path.join('website/examples/gallery/src', sheet.file);
}

/* B1-053 addendum (D7): the example corpus. Every view-bearing example file the
 * retired examples index listed — basics NN-*.ddn, the projections and quality
 * entry files, use-cases, live labs — is represented in the gallery with the
 * same detail treatment as profiles/sheets. Combined variants are covered by
 * their original's detail block (not separate figures); gallery/src sheet
 * sources are covered by the sheets above; view-less library files are listed
 * by name only (nothing to render). */
function corpusEntries() {
  const out = [];
  const push = rel => { if (!rel.endsWith('.combined.ddn')) out.push(rel); };
  for (const f of fs.readdirSync(path.join(ROOT, 'website/examples/basics')).sort())
    if (/^\d+-.*\.ddn$/.test(f)) push('website/examples/basics/' + f);
  for (const dir of ['projections', 'quality']) {
    for (const f of fs.readdirSync(path.join(ROOT, 'website/examples', dir)).sort())
      if (f.endsWith('.ddn')) push('website/examples/' + dir + '/' + f);
  }
  for (const f of fs.readdirSync(path.join(ROOT, 'website/examples/use-cases')).sort())
    if (f.endsWith('.ddn')) push('website/examples/use-cases/' + f);
  for (const f of fs.readdirSync(path.join(ROOT, 'website/examples/live')).sort())
    if (f.endsWith('.ddn')) push('website/examples/live/' + f);
  return out;
}

function corpusSlug(entry) {
  return slug(entry.replace(/^website\/examples\//, '').replace(/\.ddn$/, ''));
}

function sheetViews(sheet) {
  const entry = sheetEntry(sheet);
  const ws = A.createWorkspace(filesFor(entry));
  const views = ws.views(entry).map(v => ({ id: v.id, title: v.name }));
  ws.destroy();
  return views;
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const coverage = buildCoverageMap();
  const jobs = []; // {section, entry, view, title, svg, relSvg}

  for (const [profile, c] of [...coverage.entries()].sort()) {
    const relSvg = 'profiles/' + slug(profile) + '.svg';
    jobs.push({ section: 'profiles', profile, entry: c.entry, view: c.view, title: c.title, relSvg });
  }
  for (const sheet of SHEETS) {
    for (const v of sheetViews(sheet)) {
      jobs.push({ section: sheet.id, entry: sheetEntry(sheet), view: v.id, title: v.title, relSvg: sheet.id + '/' + v.id.replace(/^mark_/, '') + '.svg' });
    }
  }

  /* Corpus: one figure per view-bearing example file (its first view). */
  const corpus = []; // {entry, view, title, views:[{id,title}], profile, kind, wiki, relSvg}
  for (const entry of corpusEntries()) {
    let ws;
    try { ws = A.createWorkspace(filesFor(entry)); } catch { continue; }
    const views = ws.views(entry).map(v => ({ id: v.id, title: v.name }));
    if (!views.length) { ws.destroy(); continue; } // library file — listed by name only
    let resolved = null;
    try { resolved = ws.resolve(entry, views[0].id).view.profiles.projection; } catch { /* keep null */ }
    ws.destroy();
    const profile = resolved ? resolved.profile : null;
    corpus.push({
      entry, view: views[0].id, title: views[0].title, views,
      profile, kind: resolved ? resolved.kind : null,
      wiki: profile ? wikiPageFor(profile) : null,
      relSvg: 'corpus/' + corpusSlug(entry) + '.svg'
    });
    jobs.push({ section: 'corpus', entry, view: views[0].id, title: views[0].title, relSvg: 'corpus/' + corpusSlug(entry) + '.svg' });
  }

  /* Combined variants for every multi-file example (built before the render
   * loop; the verification renders double as the identity proof). */
  const combined = buildCombinedVariants();

  for (const job of jobs) {
    render(job.entry, job.view, path.join(OUT, job.relSvg));
    job.iso = fs.readFileSync(path.join(OUT, job.relSvg), 'utf8').includes('ddn-iso');
    process.stdout.write('rendered ' + job.relSvg + '\n');
  }

  const coverageJson = {
    version: pkg.version,
    generatedBy: 'tools/build-gallery.js (every SVG via notation/cli/cli.js render)',
    projectionKinds: PROJECTION_KINDS,
    profiles: Object.fromEntries([...coverage.entries()].sort().map(([id, c]) => {
      const job = jobs.find(j => j.section === 'profiles' && j.profile === id);
      const wiki = wikiPageFor(id);
      return [id, {
        entry: c.entry, view: c.view, title: c.title,
        kind: catalogue.profiles.find(p => p.id === id).projection,
        ...(combined.has(c.entry) ? { combined: combined.get(c.entry) } : {}),
        ...(wiki ? { wiki } : {}),
        svg: 'profiles/' + slug(id) + '.svg', ...(job && job.iso ? { iso: true } : {})
      }];
    })),
    sheets: Object.fromEntries(SHEETS.map(s => [s.id, { title: s.title, source: sheetEntry(s), ...(combined.has(sheetEntry(s)) ? { combined: combined.get(sheetEntry(s)) } : {}), views: sheetViews(s).map(v => {
      const svg = s.id + '/' + v.id.replace(/^mark_/, '') + '.svg';
      const job = jobs.find(j => j.section === s.id && j.relSvg === svg);
      return { view: v.id, title: v.title, svg, ...(job && job.iso ? { iso: true } : {}) };
    }) }])),
    corpus: corpus.map(c => ({
      entry: c.entry, view: c.view, title: c.title, views: c.views,
      ...(c.profile ? { profile: c.profile } : {}), ...(c.kind ? { kind: c.kind } : {}),
      ...(c.wiki ? { wiki: c.wiki } : {}),
      ...(combined.has(c.entry) ? { combined: combined.get(c.entry) } : {}),
      svg: c.relSvg, ...(jobs.find(j => j.section === 'corpus' && j.relSvg === c.relSvg && j.iso) ? { iso: true } : {})
    }))
  };
  fs.writeFileSync(path.join(OUT, 'coverage.json'), JSON.stringify(coverageJson, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'index.html'), page(coverageJson, combined));
  process.stdout.write('gallery: ' + jobs.length + ' SVGs, coverage.json, index.html\n');
}

/* Deep link into the unified tool. Verified against notation/tool/src/tool.js:
 * ?entry=<path relative to the tool page>&view=<id>&mode=<preset> — the entry
 * branch fetches arbitrary .ddn paths with the import closure and applies the
 * view param; ?src= ignores view, so it is not used here. The page lives at
 * website/examples/gallery/ (mirrored to website/gallery/), the tool at
 * website/tools/ — hence '../../tools/' here (retargeted to '../tools/' in the
 * mirror) and '../examples/' inside the query (resolved by the tool itself). */
function toolLink(entry, view, mode) {
  const rel = entry.replace(/^website\//, '../');
  return '../../tools/index.html?entry=' + rel.split('/').map(encodeURIComponent).join('/') +
    '&amp;view=' + encodeURIComponent(view) + '&amp;mode=' + mode;
}
/* Raw source link from the gallery page (site-root-relative at both depths). */
function rawLink(entry) {
  return '../../' + entry.replace(/^website\//, '');
}
function sourceAnchor(entry) { return 'src-' + slug(entry); }

function detailHtml({ explanation, entry, view, wiki, combined, extraNote }) {
  const openEntry = combined || entry;
  const bits = [];
  bits.push('<p class="explain">' + esc(explanation) + '</p>');
  bits.push('<p class="detail-links">' +
    (wiki ? '<a href="' + WIKI_BASE + esc(wiki) + '">Wiki: ' + esc(wiki.replace(/^Diagrams-/, '')) + '</a> · ' : '') +
    '<a href="' + toolLink(openEntry, view, 'view') + '">Open in viewer</a> · ' +
    '<a href="' + toolLink(openEntry, view, 'design') + '">Open in designer</a>' +
    (combined ? ' <small>(single-file variant of the multi-file example)</small>' : '') +
    '</p>');
  bits.push('<p class="detail-src">Source: <a href="#' + sourceAnchor(entry) + '"><code>' + esc(entry) + '</code></a>' +
    ' (<a href="' + rawLink(entry) + '">raw .ddn</a>)' +
    (combined ? ' · combined single-file variant: <a href="' + rawLink(combined) + '"><code>' + esc(combined.split('/').pop()) + '</code></a>' : '') +
    '</p>');
  if (extraNote) bits.push(extraNote);
  return '<details class="ddn-detail"><summary>Explanation, DDN source &amp; links</summary>' + bits.join('\n') + '</details>';
}

function page(cov, combined) {
  const families = new Map();
  for (const [id, c] of Object.entries(cov.profiles)) {
    const fam = id.split('.')[0].split('@')[0];
    if (!families.has(fam)) families.set(fam, []);
    families.get(fam).push([id, c]);
  }
  const isoNote = '<br><small>Live rendering of this view requires the optional <code>ddn-iso.js</code> module; without it the view degrades to a flat placeholder plus DDN-E010.</small>';
  const profileSections = [...families.entries()].sort().map(([fam, rows]) =>
    `<section class="family" id="family-${esc(fam)}">\n<h3>${esc(fam)}</h3>\n<div class="grid">\n` +
    rows.map(([id, c]) => `<figure id="profile-${esc(slug(id))}"><a href="${esc(c.svg)}"><img src="${esc(c.svg)}" alt="${esc(id)} — ${esc(c.title)}" loading="lazy"></a><figcaption><code>${esc(id)}</code><br>${esc(c.title)}<br><small>${esc(c.entry)} · view <code>${esc(c.view)}</code></small>${c.iso ? isoNote : ''}\n` +
      detailHtml({ explanation: explainProfile(id), entry: c.entry, view: c.view, wiki: c.wiki || null, combined: c.combined || null }) +
      `</figcaption></figure>`).join('\n') +
    `\n</div>\n</section>`).join('\n');
  const sheetSections = Object.entries(cov.sheets).map(([id, s]) => {
    const sheet = SHEETS.find(x => x.id === id);
    return `<section class="sheet" id="sheet-${esc(id)}">\n<h3>${esc(s.title)}</h3>\n<p>${esc(sheet.blurb)}</p>\n<div class="grid">\n` +
      s.views.map(v => `<figure><a href="${esc(v.svg)}"><img src="${esc(v.svg)}" alt="${esc(v.title)}" loading="lazy"></a><figcaption>${esc(v.title)}${v.iso ? isoNote : ''}\n` +
        detailHtml({ explanation: sheet.blurb, entry: s.source, view: v.view, wiki: sheet.wiki || null, combined: s.combined || null }) +
        `</figcaption></figure>`).join('\n') +
      `\n</div>\n</section>`;
  }).join('\n');
  const tableRows = Object.entries(cov.profiles).map(([id, c]) =>
    `<tr><td><code>${esc(id)}</code></td><td><a href="#profile-${esc(slug(id))}">${esc(c.title)}</a></td><td><code>${esc(c.kind)}</code></td><td><code>${esc(c.entry)}</code></td><td><a href="${esc(c.svg)}">SVG</a></td>${c.wiki ? `<td><a href="${WIKI_BASE}${esc(c.wiki)}">wiki</a></td>` : '<td></td>'}</tr>`).join('\n');
  const profileCount = Object.keys(cov.profiles).length;
  const sheetCount = Object.values(cov.sheets).reduce((n, s) => n + s.views.length, 0);
  const corpusCount = cov.corpus.length;
  const totalCount = profileCount + sheetCount + corpusCount;

  /* Example corpus section (B1-053 addendum, D7): every view-bearing example
   * file, rendered on its first view, with the full detail treatment. */
  const corpusFigures = cov.corpus.map(c => {
    const explanation = (c.profile ? explainProfile(c.profile) : 'Example view from ' + c.entry + '.') +
      (c.views.length > 1 ? ' This file declares ' + c.views.length + ' views: ' + c.views.map(v => v.title + ' (' + v.id + ')').join(', ') + ' — the deep links open the first; switch views in the tool’s view picker.' : '');
    return `<figure id="corpus-${esc(corpusSlug(c.entry))}"><a href="${esc(c.svg)}"><img src="${esc(c.svg)}" alt="${esc(c.entry)} — ${esc(c.title)}" loading="lazy"></a><figcaption><code>${esc(c.entry)}</code><br>${esc(c.title)}<br><small>view <code>${esc(c.view)}</code>${c.views.length > 1 ? ' of ' + c.views.length : ''}</small>${c.iso ? isoNote : ''}\n` +
      detailHtml({ explanation, entry: c.entry, view: c.view, wiki: c.wiki || null, combined: c.combined || null }) +
      `</figcaption></figure>`;
  }).join('\n');
  const libraryFiles = (() => {
    const libs = [];
    for (const entry of corpusEntries()) {
      try {
        const ws = A.createWorkspace(filesFor(entry));
        const n = ws.views(entry).length;
        ws.destroy();
        if (!n) libs.push(entry);
      } catch { /* unparseable — not a gallery concern */ }
    }
    return libs;
  })();

  /* Projection-kind index (B1-053 D5): every projection kind the runtime
   * supports, with the profiles bound to it. */
  const kindRows = PROJECTION_KINDS.map(kind => {
    const profiles = catalogue.profiles.filter(p => p.projection === kind).map(p => p.id).sort();
    return `<tr><td><code>${esc(kind)}</code></td><td>${profiles.length}</td><td>${profiles.map(id => `<a href="#profile-${esc(slug(id))}"><code>${esc(id)}</code></a>`).join(' ')}</td></tr>`;
  }).join('\n');

  /* Browsable DDN sources (B1-053 D4): one collapsed block per unique entry,
   * anchored from every figure that renders from it. Multi-file entries show
   * the combined single-file text as well. */
  const uniqueEntries = [...new Set([
    ...Object.values(cov.profiles).map(c => c.entry),
    ...Object.values(cov.sheets).map(s => s.source),
    ...cov.corpus.map(c => c.entry)
  ])].sort();
  const sourceBlocks = uniqueEntries.map(entry => {
    const files = filesFor(entry);
    const names = Object.keys(files).sort();
    const parts = names.map(n => '<h4><code>' + esc(n) + '</code></h4>\n<pre class="ddn-src"><code>' + esc(files[n]) + '</code></pre>').join('\n');
    const comb = combined.get(entry);
    const combPart = comb ? '<h4><code>' + esc(comb) + '</code> (combined single-file variant — renders identically)</h4>\n<pre class="ddn-src"><code>' + esc(fs.readFileSync(path.join(ROOT, comb), 'utf8')) + '</code></pre>' : '';
    return '<details class="ddn-source" id="' + sourceAnchor(entry) + '"><summary><code>' + esc(entry) + '</code>' +
      (names.length > 1 ? ' — multi-file workspace (' + names.length + ' files)' : '') + '</summary>\n' + parts + '\n' + combPart + '\n</details>';
  }).join('\n');

  const navLink = (href, label, active) => '<a href="../../' + href + '"' + (active ? ' class="active"' : '') + '>' + label + '</a>';
  const NAV = [
    ['index.html', 'Home', false],
    ['features/index.html', 'Features', false],
    ['gallery/index.html', 'Gallery', true],
    ['docs/index.html', 'Docs', false],
    ['standard/index.html', 'Standard', false],
    ['tools/index.html', 'Tools', false],
    ['download/index.html', 'Download', false]
  ];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DDN example gallery — full notation coverage</title>
<link rel="icon" type="image/svg+xml" href="../../assets/brand/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="../../assets/brand/favicon-32.png">
<link rel="icon" type="image/png" sizes="64x64" href="../../assets/brand/favicon-64.png">
<link rel="stylesheet" href="../../assets/site.css">
<style>
.gallery-intro{padding:1.5rem 2rem 0;max-width:1500px;margin:0 auto}
.gallery-intro h1{margin:0 0 .25rem;font-size:1.4rem;color:#203047}
.gallery-intro p{margin:.3rem 0;font-size:.92rem;color:#455}
nav.sections{padding:.75rem 2rem;background:#fff;border-bottom:1px solid #dde3ea;font-size:.85rem;line-height:1.9}
nav.sections a{margin-right:.9rem;color:#285ea8;text-decoration:none;white-space:nowrap}
nav.sections a:hover{text-decoration:underline}
main.gallery{padding:1.5rem 2rem;max-width:1500px;margin:0 auto}
main.gallery h2{border-bottom:2px solid #285ea8;padding-bottom:.3rem;margin-top:2.5rem}
main.gallery h3{margin:1.6rem 0 .6rem;color:#285ea8}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(420px,100%),1fr));gap:1.1rem}
figure{margin:0;background:#fff;border:1px solid #dde3ea;border-radius:6px;padding:.6rem}
figure img{width:100%;height:auto;display:block}
figcaption{font-size:.8rem;margin-top:.45rem;color:#455}
figcaption code{font-size:.78rem}
table{border-collapse:collapse;width:100%;font-size:.85rem;background:#fff}
th,td{border:1px solid #dde3ea;padding:.35rem .6rem;text-align:left;vertical-align:top}
th{background:#eef2f7}
details.ddn-detail{margin-top:.4rem}
details.ddn-detail summary{cursor:pointer;color:#285ea8;font-size:.78rem}
details.ddn-detail .explain{margin:.4rem 0 .2rem;font-size:.82rem;color:#203047}
details.ddn-detail p.detail-links,details.ddn-detail p.detail-src{margin:.25rem 0;font-size:.8rem}
details.ddn-source{margin:.6rem 0;background:#fff;border:1px solid #dde3ea;border-radius:6px;padding:.5rem .8rem}
details.ddn-source summary{cursor:pointer;color:#285ea8;font-size:.85rem}
pre.ddn-src{overflow:auto;max-height:26rem;background:#f7f8fa;border:1px solid #dde3ea;border-radius:4px;padding:.6rem;font-size:.76rem;line-height:1.45}
pre.ddn-src code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
footer.gen{padding:1.5rem 2rem;font-size:.8rem;color:#667;max-width:1500px;margin:0 auto}
</style>
</head>
<body>
<header class="site-header"><div class="bar">
  <a class="wordmark" href="../../index.html"><img class="logo" src="../../assets/brand/scratchweaver.svg" alt="ScratchWeaver logo"><span class="name">ScratchWeaver<small>Diagram Design Notation</small></span></a>
  <button class="nav-toggle" aria-label="Toggle navigation">☰</button>
  <nav class="site-nav">
      ${NAV.map(([href, label, active]) => navLink(href, label, active)).join('\n      ')}
  </nav>
</div></header>
<div class="gallery-intro">
<h1>DDN example gallery</h1>
<p>Full notation coverage for Diagram Design Notation ${esc(cov.version)}: ${profileCount} installed profiles across ${PROJECTION_KINDS.length} projection kinds, ${sheetCount} variation renders, and the complete example corpus (${corpusCount} example files) — ${totalCount} SVGs, each produced by the reference CLI render path. This page is also the examples index: every runnable <code>.ddn</code> source the project ships is rendered below with its explanation, source and deep links.</p>
<p>Static page: every diagram is a pre-rendered SVG; no runtime is inlined, so this page works from <code>file://</code>. Open <strong>Explanation, DDN source &amp; links</strong> under any figure for what the diagram shows, its browsable DDN source, a wiki page for the diagram type, and deep links that open the exact view in the unified tool (viewer or designer mode — multi-file examples open their verified combined single-file variant there). Flow animation is part of the live renders: open any flow view in the tool and use its animation drawer, for example the <a href="${toolLink('website/examples/live/adaptive-lab.ddn', 'automatic', 'explore')}">adaptive flow lab</a>.</p>
</div>
<nav class="sections">
<strong>Sections:</strong>
<a href="#profiles">Profiles</a>
${Object.keys(cov.sheets).map(id => `<a href="#sheet-${esc(id)}">${esc(cov.sheets[id].title)}</a>`).join('\n')}
<a href="#corpus">Example corpus</a>
<a href="#kinds">Projection kinds</a>
<a href="#sources">DDN sources</a>
<a href="#coverage">Coverage table</a>
</nav>
<main class="gallery">
<h2 id="profiles">Installed profiles (${profileCount})</h2>
<p>One render per installed profile from <code>standard/registry/profiles/catalogue.json</code>. Each entry reuses the nearest existing example under <code>website/examples/basics/</code> or <code>website/examples/projections/</code>; the coverage map is generated, not hand-written, and is enforced by <code>notation/tests/gallery-coverage.js</code>.</p>
${profileSections}
<h2 id="sheets">Variation sheets</h2>
${sheetSections}
<h2 id="corpus">Example corpus (${corpusCount})</h2>
<p>Every view-bearing example file under <code>website/examples/</code> — the ${corpusCount} sources the retired examples index listed — rendered on its first view with the same detail treatment as the profiles above. Files declaring several views note them in their detail block; open the deep link and switch views in the tool. Combined single-file variants (<code>.combined.ddn</code>) of multi-file examples are covered by their original's detail block, and the <code>gallery/src/</code> sheet sources by the variation sheets above. Library files with no views of their own (imported by other examples, nothing to render): ${libraryFiles.map(f => '<code>' + esc(f) + '</code>').join(' ')}.</p>
<div class="grid">
${corpusFigures}
</div>
<h2 id="kinds">Projection kinds (${PROJECTION_KINDS.length})</h2>
<p>Every projection kind the runtime supports, with the profiles bound to each. The optional <code>geo</code> kind requires the <code>ddn-geo.js</code> module; isometric depth is a presentation variant of the <code>graph</code> and <code>chart</code> kinds via the optional <code>ddn-iso.js</code> module (see the iso sheets above).</p>
<table>
<thead><tr><th>Projection kind</th><th>Profiles</th><th>Bound profiles</th></tr></thead>
<tbody>
${kindRows}
</tbody>
</table>
<h2 id="sources">DDN sources</h2>
<p>The browsable sources behind every figure above — one block per unique entry. Multi-file examples (data/format/view split across files) are shown file by file, followed by their combined single-file variant, which the gallery verifies renders byte-identical SVG for every view it renders.</p>
${sourceBlocks}
<h2 id="coverage">Coverage table</h2>
<table>
<thead><tr><th>Profile</th><th>Example</th><th>Projection kind</th><th>Source</th><th>SVG</th><th>Wiki</th></tr></thead>
<tbody>
${tableRows}
</tbody>
</table>
</main>
<footer class="gen">Generated deterministically by <code>tools/build-gallery.js</code> (<code>npm run build:gallery</code>). Regenerate after changing profiles, examples, or the runtime.</footer>
<script src="../../assets/site.js"></script>
</body>
</html>
`;
}

main();
