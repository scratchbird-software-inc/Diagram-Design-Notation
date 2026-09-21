# Changelog

All notable changes to the Data Design Notation project are documented here.
Component-level history predating the monorepo import lives in
`notation/CHANGELOG.md` and `examples/use-cases/CHANGELOG.md`.

## [Unreleased]

- B1-004: modular runtime bundles — the SDK now ships as optional libraries in
  `notation/dist/`: `ddn-core.js` (parse/build/validate/export, projection and
  quality planning data, workspace API; no rendering), `ddn-graph.js` (graph
  renderer), `ddn-projections.js` (chart/matrix/panels/timeline/table/sequence/
  timing/chen) and `ddn-quality.js` (quality charts/decision/fishbone), each
  with `.mjs` and type copies, plus the unchanged all-in-one `ddn.global.js`.
  Load-order guards (core → graph → quality/projections, double-load no-op,
  single-version guard kept); the engine is now a renderer registry
  (`DDNEngine.registerProjectionRenderer`) and rendering or planning an
  unregistered kind throws new coded error `DDN-E010` naming the bundle that
  provides it. `tools/build-sdk.js` is data-driven (one `BUNDLES` map builds
  both the modules and the all-in-one), emits a generated
  `notation/dist/README.md`, and `release/validation/sdk-build.json` gains a
  per-bundle `bundles` object (bytes/sha256/files). Browser proofs:
  `examples/embed/core-graph.html` and `examples/embed/core-only-check.html`.
  Full-bundle behavior is byte-identical (whole existing golden set unchanged).

- B1-003: deterministic CSS class hooks on every rendered SVG mark — root
  `ddn-svg ddn-view-<kind> ddn-profile-<slug>`, nodes `ddn-node ddn-kind-<code>`,
  relations `ddn-rel ddn-verb-<verb>`, plus `ddn-field`, `ddn-label`,
  `ddn-panel`, `ddn-frame` and `ddn-mark ddn-mark-<type>` in projections.
  Pure addition of `class` attributes: no visual change without page CSS,
  renderer stays deterministic (registry-derived classes only), script-level
  presentation stays inline and wins for the elements it names; no `<style>`
  block and no `!important` in renderer output. Optional ready-made stylesheet
  `notation/dist/ddn.css` (source `notation/studio/src/ddn.css`, real rules
  mapping the hook classes to `--ddn-*` custom properties) and an optional
  `theme` attribute on `<ddn-example>` injecting those properties as a
  constructed stylesheet. Cascade documented in spec 04 §11 and spec 14.
  Use-case goldens (27) regenerated through the documented manifest path.
  New example `examples/basics/58-css-hooks.ddn` (+ companion `.html`) and
  headless fixture `notation/tests/fixtures/css-override.html`.
- B1-002: registry-driven element defaults — every kind in both registry
  catalogues carries a `defaults` object (additive growth; `{}` where a kind
  has no meaningful defaults, meaningful sets for `cache`, `archive`, `cloud`,
  `snapshot`, `history`). New public API `DDNLive.defaults.forKind(kind)`
  (runtime `notation/runtime/ddn-defaults.js`, d.ts updated). The designer
  creation commands merge registry defaults before explicit properties
  (explicit wins) and write them into the source; the renderer never applies
  them, so all pre-existing sources render byte-identical. Schema build
  type-checks defaults against the property contracts. New example
  `examples/basics/57-element-defaults.ddn`.

## [0.6.0-beta.1] - 2026-09-20

Beta 1: 38 runtime items, 13 designer items — see item history. Runtime and
standard packaging release: every version stamp moves from `0.5.0-draft.2`
(designer `0.1.0`) to `0.6.0-beta.1` (designer `0.2.0-beta.1`). Not a language
change — `ddn "0.5"` sources and `ddn-core@0.3` are untouched.

- Designer prototype: canvas template starters (BMC, Lean, SWOT, PEST, PESTLE,
  Porter 5, empathy, scorecard) generating pre-populated panels views in one
  command (ED-013).
- Designer prototype: sequence diagram editor for `uml.sequence@1` (lifelines,
  messages, returns, declaration-order moves) (ED-012; covers VE-AC-062/063).
- Designer prototype: lane editing on view frames (create/rename/resize/assign
  with previews; `x_partition` for `uml.activity@1`) (ED-011; covers
  VE-AC-040).
- Designer prototype: draft validation UX (Problems strip, incomplete typing,
  workspace review scope, occurrence-addressed navigation) (ED-010; covers
  VE-AC-006/007).
- Designer prototype: occurrence addressing layer (`occ:` ids,
  add-existing/remove/move/override commands with explicit restriction
  responses) (ED-009; covers VE-AC-036).
- Designer prototype: relation reconnection command with impact preview (drag
  + inspector paths), closing the AUD-003 reconnection gap (ED-008; covers
  VE-AC-023).
- Designer prototype: decision table editor (`rule.row` rows, typed
  predicates, hit-policy command, analysis and fixture evaluation) (ED-007;
  covers VE-AC-059/060).
- Designer prototype: panels editor (grid, item moves, child-view slots,
  canvas fixed-grid guards) (ED-006; covers VE-AC-055/056).
- Designer prototype: fishbone editor (effect/category/cause commands,
  attach-existing-cause with distinct occurrence paths) (ED-005; covers
  VE-AC-057).
- Designer prototype: timeline editor (date controls, drag-as-date-edit with
  preview, `analysis.precedes` dependency linking) (ED-004; covers VE-AC-054).
- Designer prototype: chart editor (record sheet, profile-legal mark
  switching, binding pickers, contributor inspection) and a
  `setProjectionBinding` command contract (ED-003; covers VE-AC-051/052/053).
- Designer prototype: matrix (RACI/CRUD/relations) cell editor with atomic
  batch commits (ED-002; covers VE-AC-049/050).
- Designer prototype: full 188-kind palette driven by `kind-ui-map.json`,
  descriptor-driven inspector header, separable `commands.js` command layer,
  and a Node-based designer test suite (ED-001).
- Family tree / genealogy views via profile `family.tree@1`
  (`family.person`/`family.union`, `family.partner_of`/`family.parent_of`,
  `x_birth`/`x_death`, `DDN-PJ129`/`DDN-PJ130`). RFC-116.
- Low-fidelity UI wireframes via profile `wireframe.ui@1` (seven-control
  stencil, scoped-frame nesting, warning `DDN-PJ128`). RFC-115.
- Network/bus and rack views via profiles `network.basic@1`/`network.rack@1`
  (four original glyphs, `network.attaches`, `x_rack`, `DDN-PJ127`);
  removes 'native bus/junction-network drawing' from capabilities
  `unsupported[]`. RFC-114.
- Fault tree and event tree views via profiles `fault.tree@1`/`event.tree@1`
  (`tree.gate`/`tree.event`, `x_gate`, `DDN-PJ126`). RFC-113.
- PERT/CPM critical-path views via profile `pert.cpm@1` (`x_estimate`,
  computed passes, `DDN-PJ124`/`DDN-PJ125`); removes 'critical-path
  scheduling' from capabilities `unsupported[]`. RFC-112.
- ArchiMate-style layered views via profile `archimate.basic@1` (nine-kind
  vocabulary, `DDN-PJ123` layer-pair legality). Profile-level coverage, not
  ArchiMate conformance. RFC-111.
- SysML-style profiles `sysml.bdd@1`/`sysml.ibd@1`/`sysml.parametric@1`
  (blocks, ports, flows, constraints; `DDN-PJ121`/`DDN-PJ122`).
  Profile-level coverage, not SysML conformance. RFC-110.
- CMMN-style case views via profile `cmmn.basic@1` (stages/milestones/
  sentries, `DDN-PJ120`). Profile-level coverage, not CMMN conformance.
  RFC-109.

- Interaction overview views via profile `uml.interaction_overview@1`
  (`x_subdiagram` view references, `DDN-PJ119`). RFC-108.

- Timing/state-over-time projection (`kind:timing`, profile `uml.timing@1`,
  `x_states`), with `DDN-PJ118` validation. RFC-107.

- BPMN-style process collaboration via profile `bpmn.basic@1` (pools/lanes,
  typed events/gateways, cross-pool message flow; `DDN-PJ116`/`DDN-PJ117`).
  Profile-level coverage, not BPMN conformance. RFC-106.

- Activity-style views with partitions, fork/join and object nodes via profile
  `uml.activity@1` (`DDN-PJ114`/`DDN-PJ115`). RFC-105.

- Hierarchical state views via profile `state.composite@1` (composite frames,
  dashed regions, `DDN-PJ113`). RFC-104.

- Object/instance snapshots via profile `uml.object@1` (`x_instance` classifier
  binding), `DDN-PJ112` slot validation. RFC-103.

- Communication/collaboration views via profile `uml.communication@1` with
  declared message numbers (`x_message.seq`), `DDN-PJ111` validation. RFC-102.

- Sequence-style interaction projection (`kind:sequence`, profile
  `uml.sequence@1`, verb `uml.message`, `x_return`), with
  `DDN-PJ110`/`DDN-PJW03` validation. RFC-101.

- Venn diagrams (2 or 3 sets) via new profile `panels.venn@1` with registered
  `x_sets` membership, fixed region-count geometry, and `DDN-PJ090`/`DDN-PJ091`
  validation.

- Pyramid diagrams via new profile `panels.pyramid@1` (3..5 trapezoid bands
  with optional side annotations), validated by `DDN-PJ089`.

- SQL DDL export: `export { format: sql; … }` on the redacted allowlist profile
  emits CREATE TABLE/PRIMARY KEY/FOREIGN KEY DDL with `-- skipped:` audit
  comments (`DDN-PJ088`, `DDN-PJ092`; allowlist enforcement remains `DDN150`).

- Crow's-foot ERD profile `erd.crowfoot@1`: obligatory `source_mark`/`target_mark`
  cardinality (`one`/`zeroone`/`many`/`zeromany`) on ref/assoc relations, validated
  with `DDN-PJ087` (unknown marks remain `DDN114`).

- User story maps via new profile
  `matrix.storymap@1` (assoc cells carrying `x_story.task` references to
  `analysis.task` stories), with `DDN-PJ086`/`DDN-PJ093` validation.

- Journey maps via new profile
  `panels.journey@1` (phase/lane grid + straight-segment 1..5 emotion polyline), with
  `DDN-PJ084`/`DDN-PJ085` validation.
- Empathy map and balanced scorecard via new profiles
  `canvas.empathy@1`/`canvas.scorecard@1`, with `DDN-PJ083` required-panel
  validation.
- Matrix pack: BCG, Ansoff and TOWS profiles
  (`matrix.bcg@1`/`matrix.ansoff@1`/`matrix.tows@1`) with the registered `x_category`
  axis record and `DDN-PJ082` quadrant validation.
- Canvas pack B: PEST, PESTLE and Porter five-forces via new profiles
  `canvas.pest@1`/`canvas.pestle@1`/`canvas.porter5@1`, with `DDN-PJ081`
  required-panel validation.
- Canvas pack A: Business Model Canvas and Lean Canvas via new profiles
  `canvas.bmc@1`/`canvas.lean@1` (panels projection), with `DDN-PJ080`
  required-block validation.
- EPC diagrams via new profile `epc.basic@1` with `epk.event`/`epk.function`/`epk.connector`
  kinds, new `epk.next` verb, new `hexagon` silhouette, and `DDN-PJ105`/`DDN-PJ106`
  validation.
- Concept maps via new profile `concept.map@1` with mandatory explicit relation
  labels (`DDN-PJ104`).

- Mind maps via new profile `mindmap.basic@1` over the native mindmap layout
  (shared `DDN-PJ102` single-root validation).

- Work breakdown structures via new profile `wbs.tree@1` and new profile verb
  `analysis.decomposes` (reuses RT-008's top-down tree layout and `DDN-PJ102`
  single-root validation).

- Org charts via new profile `org.tree@1` and new core verb `reports_to`;
  native tree layout now honours `direction: down`; `DDN-PJ102` single-root
  validation.

- C4-style profile set (`c4.context@1`, `c4.container@1`, `c4.component@1`) with
  six profile kinds, the `c4.rel` verb, boundary frames, and
  `DDN-PJ100`/`DDN-PJ101` validation.

- Sankey diagrams via new profile `chart.sankey@1` (mark `sankey`, reusing the
  chart `target` property as a binding), with `DDN-PJ079`/`DDN-PJ108`
  validation.

- Treemaps via new profile `chart.treemap@1` (mark `treemap`), with
  `DDN-PJ078` validation.

- Candlestick/OHLC charts via new profile `chart.candlestick@1` (mark
  `candlestick`, new chart properties `open`/`high`/`low`/`close`), with
  `DDN-PJ076`/`DDN-PJ077` validation.

- Gauge/KPI dials via new profile `chart.gauge@1` (mark `gauge`), with
  `DDN-PJ074`/`DDN-PJ075` validation.

- Funnel charts via new profile `chart.funnel@1` (mark `funnel`), with
  `DDN-PJ073`/`DDN-PJ107` validation.

- Radar/spider charts via new profile `chart.radar@1` (mark `radar`), with
  `DDN-PJ071`/`DDN-PJ072` validation.

- Chrome/file:// fix: `index.html` and `standard/plates/index.html` are now
  single-file pages (runtime and plates inlined via
  `tools/build-standalone-pages.js`). Flatpak Chrome exposes only the opened
  file to the sandbox, which blocked the external `ddn.global.js` subresource
  ("DDNLive is not defined"); the inlined pages are immune. All linked
  standalone pages (gallery, Studio, designer prototype) were already
  self-contained. Verified in Chrome 151 and Chromium over `file://`.
- Standalone readiness: root `index.html` landing page with live in-browser
  render, `standard/plates/index.html` notation-plate browser, and
  `designer/prototype/standalone.html` single-file designer prototype
  (imported from the designer package, license header updated). Studio and
  gallery nav links retargeted to in-repo destinations; all entry pages
  verified over `file://` (headless Chromium: no console errors, all render).
- Repository created as the DDN open-source monorepo:
  - Imported DDN 0.5.0-draft.2 sources (notation runtime, CLI, Studio,
    specification, grammar, schemas, registry, examples) from the previous
    single-tree package.
  - Imported DDN Designer specification 0.1 (specification, contracts,
    prototype, research, design records, decisions) from its standalone
    package.
  - Relicensed MIT → GPL-2.0-or-later across imported sources.
  - Excluded generated corpora and prebuilt sites (field guide, enterprise
    review, rendered outputs, release evidence); available in the archived
    packages.
