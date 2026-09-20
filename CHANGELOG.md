# Changelog

All notable changes to the Data Design Notation project are documented here.
Component-level history predating the monorepo import lives in
`notation/CHANGELOG.md` and `examples/use-cases/CHANGELOG.md`.

## [Unreleased]

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
