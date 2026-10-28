# Complete DDN implementation

The viewer, visual designer and verifier under `project/ddn` implement the redesigned `ddn-next-1` dialect and all **151 adopted bounded profiles**. The incompatible proof of concept is excluded. [Build and embedding instructions](../../project/ddn/README.md) describe the offline HTML and ESM artifacts. The [coverage index](PROFILE-COVERAGE.md) links every implemented profile to its exact scope and exclusions.

The [paper and stationery comparison](../../website/features/paper.html) adds
plain paper, sticky notes, layered pads, four shadow silhouettes, push-pins,
round pins, paper clips, binder clips and tape. Paper, shadow and attachment
colours are independently editable through **Paper & attachments** and the
short source notation. Scope, inheritance, source preservation and undo/redo
use the existing designer command service. SVG and PNG exports retain these
local vector effects. The viewer remains read-only.

The [appearance standards review](../../website/features/appearance.html)
adds compact floating settings forms, Light/Dark/Midnight/Warm interface themes, colour palettes,
procedural paper/linen/grid/dot textures, local font resources and portable
user/company preset packs. Inter, Source Serif 4, JetBrains Mono and Caveat are
provided as an optional local OFL resource pack. The review site and standalone
tools share a modern branded interface, local glyphs, grouped controls and a
source-pane toggle; saved interface preferences remain separate from diagrams. Appearance changes use source
authorization and atomic undoable edits; interface preferences do not change
diagram source. Company packs can be imported and copied into user presets;
central administration and distribution remain Weaver service work. See the
[appearance guide](APPEARANCE.md) and [font resource guide](FONTS.md).

The current gallery contains **166 example files and 474 views**, preserving all 163 converted original files and 466 views. The maintained suites cover all 151 bounded profiles, source decoding, semantic verification, editing, workers, capture and offline browser delivery. Reproduce qualification with the commands below; current public migration evidence is recorded in [the migration notes](../MIGRATION.md).

## Delivered behavior

The complete rule pack registers exact profile palettes, context roles, legal relations, endpoint/member constraints, schemas and versioned defaults. The complete command pack adds creation and editing for those installed capabilities. Presentation uses dedicated graph, Chen, sequence, timing, fishbone, table, chart, matrix, panel/canvas, geography, timeline and decision projections. Unsupported installed-pack combinations and missing supplied data remain explicit; they do not produce false verification or publication success.

The viewer supports multiple placed views, selection, inspection, expansion, pan/zoom, paint preview and SVG/PNG/JSON/Markdown/CSV capture. It renders method-specific symbols, compartments, connector markers, regions and lanes; routes graph connections around obstacles; and preserves explicit routing. Charts include statistical, hierarchy, link, calendar and quality projections. Matrices include RACI, CRUD, relationship, heatmap and strategy layouts. Panels include the retained canvases and composed views. Geography uses explicit local GeoJSON and the selected projection. Child views retain their identities, transforms, clips and provenance. Frozen inline views use declared image artifacts.

Decision input matching, bounded overlap/coverage analysis, declared flat-state traces and CPM calculations are available without model mutation. The floating Item details form exposes applicable analysis, with complete
property values and inheritance available in a collapsed disclosure. Authored actions and expressions are never executed. Full FEEL, Petri/PLC execution, full UML/BPMN/SysML execution and other excluded engines are not implied by their diagram profiles.

The designer selects a method and permitted profile; filters its primary palette; reuses eligible existing context items; and constrains connection choices by endpoint rules. Schema-driven controls edit projection settings, metadata, members, endpoints, qualifiers, typed datasets and workarea properties. Data-derived geometry is controlled by its inputs and projection settings. The shared command service also covers titles, occurrences, geometry, source text, draft bodies, explicit column conversion, selected field details, provisional domains, notes, deletion and lifecycle transitions. Empty drafts work for all 151 profiles.

The parser supports indentation, quoted punctuation, qualified references, cyclic include closure, sparse dotted rows, raw note/draft blocks, property records and typed templates. Targeted edits preserve unrelated comments, quotes, BOM and newline conventions. Invalid source retains a visibly labeled last valid scene. Named datasets support typed numeric, boolean and null rows; source-preserving edits retain their identities. Undo/redo uses bounded source patches.

The verifier checks structure, references, workarea/profile membership, role data, relation contracts, ownership, graph and numerical constraints, completeness and requested purpose. Missing packs and unavailable facts cannot produce complete review eligibility. Transition checks recompute review evidence. Source edits cannot manufacture acceptance metadata; protected semantic edits require reopening affected scopes. Live data can invalidate evidence without changing user-selected status.

Providers apply source/data updates atomically. Invalid keys and stale revisions preserve the prior state. Provider overlays survive visual edits without entering authored source. Explicit `persist snapshot` bindings materialize captured schema, rows, revision and time into save artifacts. Files, assets and live updates enter through explicit local or host interfaces; no server is required and no implicit data service is contacted.

## Contract fidelity

[Implementation decisions](IMPLEMENTATION-DECISIONS.md) record source representations, presentation refinements and reviewed schema additions needed to express the retained examples. The adopted property codex and compiled schemas are reconciled together; there is no second dialect. Public ABI declarations remain unchanged.

File settings override type-scoped CSS, which overrides versioned standards. Status, body editor mode, detail visibility and drawing style remain separate. Name-only entities stay title-only; structured field data infers a columns body, while explicit body presentation wins. Explicit conversion clears the pending draft-conversion marker while retaining draft text. Lifecycle changes use dedicated commands with separate edit/review/accept/reopen authority.

The complete browser editions install rule, command and presentation packs and use local Blob workers with the same handlers as the explicit local fallback. `createCompletePresentationPack()` also exposes the adopted portable measurement/projection ABI with revision, version, fingerprint and font-generation checks. Core language, model and verifier modules require neither DOM nor Node APIs. The build boundary excludes commercial Weaver dependencies.

The native single-file viewer and designer pass their original raw and gzip gates. The verifier still **exceeds its gzip size target**; all three meet their raw limits. The manifest reports the remaining failure explicitly. This migration does not claim the bundle-size release gate is qualified.

## Evidence and qualification

Maintained tests cover every profile through source decoding, semantic verification, defaults and finite scene generation; every profile also has a progressive creation/first-item/undo/redo test. Real-browser tests exercise all 151 profiles through workers and offline SVG capture, alongside editing, local assets, composed views, analysis, source preservation, provider transactions and lifecycle authority. Family tests check concrete algorithms, symbols, invalid inputs and contract bounds. Registration counts alone are not implementation evidence.

Generated test logs, qualification witnesses, screenshots, size manifests and performance observations stay in `.work`. The maintained [DDN website](../../website/index.html) maintains its own browser bundles, converted sources and gallery captures under `website/`. Reproduce the implementation checks with:

```sh
bash tooling/run.sh test:ddn
bash tooling/run.sh test:ddn:browser
bash tooling/run.sh check
```

Release qualification remains separate. Chromium behavior is tested; the full browser/OS and assistive-technology matrix, W3–W8, lower-resource hardware and prolonged leak tests are not qualified. Optional PDF/DOCX/ODT output adapters and commercial collaboration/server/media capabilities remain outside these utilities. Publication requires a declared supported adapter and coherent measurement evidence. The headless ABI cannot independently prove an externally supplied browser output adapter.

The [modular distribution](MODULAR-DISTRIBUTION.md) separates shared code, utility APIs/shells, compute workers and optional catalogue/rule/rendering families. Website tools load required families automatically; the offline folder and ZIP use the same loader. Native and complete single-file editions remain available. The earlier bundle-separation change preserved all gallery SVGs byte for byte.

The production build uses pinned esbuild 0.28.2 and a final Terser 5.51.2 pass for standalone HTML, specializes each utility shell, defers the full native schema behind a lightweight index, loads 19 optional profile packs and opens designer panels through literal dynamic imports. Font binaries load per family/style; explicit installation of the whole suite remains available. The compact catalogue restores the original wire tree before decoding, preserving all schema indexes, values, object sharing and property order. Reused brand SVG source still produces the exact original light/dark data URLs. The normal ESM and native/complete single-file APIs retain their full declared capabilities. Obsolete image and geography results are discarded before updating caches or diagnostics, so late providers cannot contaminate a newer document.

The manifest distinguishes code bootstrap from first-native-document cost (including schema and worker), then accounts for optional fonts independently. New modular size regression ceilings are enforced during distribution generation. They are delivery-layout ceilings, separate from the original native single-file targets. The viewer and designer gates now pass and are enforced. The verifier compressed native gate remains open; no original target was relaxed. Full-profile budgets remain observations. Artifacts remain development builds; bundle reduction does not establish release qualification.

### Bundle delivery measurements — 28 October 2026

Code bytes below exclude optional fonts and user assets. Gzip totals sum independently compressed resources.

| Utility | Previous first document, raw | New bootstrap, raw | New first document, raw | New first document, gzip |
| --- | ---: | ---: | ---: | ---: |
| Viewer | 1,346,617 | 755,971 | 1,095,898 | 324,138 |
| Designer | 1,527,363 | 936,991 | 1,276,918 | 387,331 |
| Verifier | 1,096,989 | 505,614 | 845,541 | 233,299 |

The optional font catalogue is 5,573 raw bytes. A normal viewer/designer start adds only the 474,446-byte Inter normal resource; the previous monolithic font script was 2,619,658 bytes. Other families and italic faces load on use. The verifier loads no fonts. All seven faces remain distributed with their licences.

Native single-file gzip sizes are ddn-viewer.html: 254,811, ddn-visual-designer.html: 337,689, ddn-verifier.html: 175,027 bytes. Viewer and designer pass their original 256,000- and 409,600-byte ceilings. The verifier remains above its original 102,400-byte ceiling. It retains the full schema vocabulary because native workareas can use retained roles; no validation or profile support was removed to lower the size. All raw ceilings pass.

### Public DDN licensing and sponsorship — 24 October 2026

The replacement DDN website, source package metadata and downloads identify
DDN as GPL-2.0-or-later, preserving the public project's existing licence.
All generated content pages identify ScratchBird Software Inc. as sponsor and
link the ScratchBird suite. Weaver retains its separate commercial licence.
Standalone HTML, modular bundles, the offline ZIP and ESM distributions carry
licensing notices; downloaded distributions retain the full GPL text and
third-party resource notices.

Validation passed **54 website checks** and **9 distribution/loader checks**.
Desktop and mobile review found no browser errors, external network requests
or horizontal overflow. Evidence is in `.work/reports/ddn-public-identity/`.
This update does not deploy the site or change repository visibility.

### Standalone symbol presentation — 24 October 2026

Electrical and image-library examples now render their artwork without generic
DDN card outlines or server details. Image captions support hidden, inside and
eight outside positions. Connections use the fitted symbol body or bundled
electrical terminals; transparent text provides unboxed notes. The designer's
floating **Symbol & label** form edits these settings with inheritance and
undo/redo. SVG paint, local gradients and proportions survive capture.

The review website contains **166 examples and 474 views** across the existing
151 profiles. The new [symbol examples](../../website/features/appearance.html)
demonstrate label placement, computer/building imagery and associated notes.
Electrical examples illustrate symbol presentation, not circuit validation.

Validation passed **1,041 unit/integration tests**, **551 browser tests** and
**53 website tests** (overlapping suites, not additive counts). All 474 views
rendered and exported offline without browser errors or HTTP(S) requests.
Specification, catalogue and sealed-bundle checks passed 7,505, 4,089 and 15,817
checks respectively. The commercial contract mirror contains the same reviewed
DDN schema. Visual review covered electrical return paths and annotations,
image labels and gradients, network/icon galleries and the floating form.
Evidence remains in `.work/reports/symbol-presentation/`. Size gates and release
qualification limitations above remain open.

### Baseline results before website integration — 23 October 2026

All **713 unit/integration tests** and **173 browser tests** passed. Every profile passed new-source decoding, semantic verification, rendering and offline SVG capture. Specification validation passed 7,500 checks; catalogue validation passed 4,088 checks; the sealed bundle passed 15,802 checks. Project containment and the DDN/commercial dependency boundary also passed.

The baseline complete edition's observed HTML sizes were:

| Utility | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| Viewer | 1,346,617 | 755,971 | 1,095,898 | 324,138 |
| Visual designer | 1,836,298 | 350,109 |
| Verifier | 1,096,989 | 505,614 | 845,541 | 233,299 |

The complete designer was measured in Chromium 156.0.8078.4 on an Intel Core Ultra 7 165U host (14 logical CPUs, approximately 33 GB RAM). Each workload used three fresh browser contexts, five warmups and ten measured samples per context, with a fixed supplied font and HTTP(S) blocked. All observed W1/W2 thresholds passed:

| Workload | Open p95 | Title edit p95 | Pan main-thread p95 |
| --- | ---: | ---: | ---: |
| W1 | 123.3 ms / 250 ms | 27.1 ms / 150 ms | 0.8 ms / 8 ms |
| W2 | 256.5 ms / 1,000 ms | 120.2 ms / 150 ms | 2.6 ms / 8 ms |

The full samples, hardware details, fixture/font/artifact hashes and limitations are in `.work/reports/ddn-complete-performance/W1-W2-observation.json`. The measured designer SHA-256 is `9efd018ce1bbd18449f418dd75f419639444dbdfaca34539513426a907701962`. These observations apply to that baseline artifact, not the later website integration, and do not establish reference-hardware release qualification.

### Private website integration — 23 October 2026

The [review website](../../website/index.html) recreates the original information
structure with the new viewer, visual designer and verifier. Its 163 converted
example files contain 466 views across all 151 profiles and seven variation
sheets. The guide contains 160 lessons, with current profile/property references
and 560 rendered symbol previews. All required sources, artwork, runtime modules
and standalone HTML downloads are local to the website directory.

Final checks passed **757 unit/integration tests**, **174 browser tests** and
**34 website tests** (the suites overlap; these are not additive counts).
Every converted source passed semantic verification; all 466 views rendered and
exported as SVG with no browser errors or HTTP(S) requests. An independent
preservation audit checked 144 data views, 1,015 record bindings, 3,532 values,
90 panels, 76 matrix relations and 13 decision rows without discrepancies.
The schema, catalogue, bundle and repository containment checks also passed.

Visual review covered the home/gallery, native ERD, charts, matrix, business
canvas, geography, composed views, isometric diagrams, frozen drilldown and a
mobile designer. Findings corrected during integration include overlapping
automatically placed views, narrow-screen selectors, panel heading overflow,
date-axis labels and embedded navigation. This is representative visual review,
not manual approval of every gallery image or a cross-browser release matrix.

Reproduce the review build with `bash tooling/run.sh build:ddn:website` and
`bash tooling/run.sh test:ddn:website`. Logs, per-view results, data audits and
screenshots remain under `.work/reports/ddn-website/` and its sibling log files.
The source conversion manifest is maintained with the site. Native size-budget
failures and the remaining release qualifications described above remain open;
the original website is not replaced or published by this integration.
