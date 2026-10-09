# DDN takeover status and outstanding work

Updated 2026-10-09. This is the consolidated DDN/DDNA work register. It replaces
older workplan status summaries, while their requirements and recorded owner
decisions remain evidence. A shipped implementation, a written proposal, and an
approved scope exclusion are different states; a checkbox alone establishes none
of them. The project is still alpha, package version 0.8.0, with pre-submission
standards drafts.

## Current work

The takeover began at `c1e0cf1d` with six modified runtime/registry files. Their
exact original patch, status and base commit were preserved outside the product
repository in `kimi-specification-workarea/ddn-takeover-2026-10-09/evidence/`.
The first takeover change implemented the notation amendments in chapters 04 §6D
and 54 §6–7. Structured columns are opt-in: `columns {}` selects the kind schema,
while existing sources without the group retain legacy field rows. Qualification
evidence is recorded below.

The next change implements independent graph appearances (DDN-T03): qualified
view references, separate positions and presentation, connector appearances,
and active-tool editing backed by shared model definitions. Qualification is complete;
the projection-specific extensions remain DDN-T20.

The active designer is `notation/tool/src/`, built into
`website/tools/index.html?mode=design`. `designer/prototype/` is retired and its
tests are historical regression evidence, not proof that a feature exists in the
active tool. The separate DDNA scratch PoC likewise is not a product engine.

## Completed implementation inventory

| Work | Current evidence | Status |
| --- | --- | --- |
| DDN 0.8 base language, publication, text fit and tool work | Chapters 51–58; notation test scripts | Implemented; conformance remainder below |
| Seven-phase designer drawer and type-sheet redesign | Active tool; October 5 redesign workplan | Implemented |
| Multi-file workflow WW-001–007 | `designer/specification/20-workspace-workflow.md` implementation notes | Implemented; preserve reproducible tests beyond temporary probes |
| Text/stroke/sizing properties, fragments, diff, Unicode identifiers, read-only assertions, Chen n-ary, calendar rules | `DDN-0.9-ROADMAP.md`, corresponding runtime test scripts | Implemented as 0.8 amendments within the documented limits |
| Mermaid subset importer, canvas multi-select, convertKind, moveField and membership editing | Active tool and studio authoring API | Implemented; flat graph multiple occurrences added 2026-10-09 |
| B1-101 icon viewer, sticky notes/string relations, illustration pack | `CHANGELOG.md`; `sticky-string.js`, `art-pack.js`, icon HTTP tests | Implemented; old tracker was stale |
| DDNA integration A–C | `ddna/13-open-tool-integration.md`; `ddna-{trace,keel,engine}.js` | Companions, replay and PoC-derived EM-1/3/4 generation; bounded EM-2 DAG profile implemented; full EM-2/5/6 outstanding |
| WASM routing experiment B1-044 | Workarea report, September 24 | Experiment complete; recorded decision retained optimized JavaScript in a worker |

## Outstanding work register

Statuses: **COMPLETE** is implemented and qualified takeover work; **OPEN** requires further
implementation or evidence; **DECISION** needs scope/ownership reconciliation;
**HISTORICAL** describes another project's recorded backlog, not a newly verified
DDN defect. Priority establishes suggested execution order, not authorization to
implement unrelated work.

| ID | Priority | Status | Work and completion evidence required |
| --- | --- | --- | --- |
| DDN-T01 | P0 | COMPLETE | Complete inherited notation patch: wrapping, field clipping, columns, description presentation, validation, accessible full values, generated bundles and targeted/source/browser regression evidence. See chapters 04 and 54. |
| DDN-T02 | P0 | COMPLETE | Reconcile old plans, changelog and product boundary against implementation; maintain this register and retain original evidence. |
| DDN-T03 | P1 | COMPLETE | AUD-004 graph occurrence contract and AUD-003 multi-occurrence: implemented qualified references, versioned occurrence IR, independent pins/presentation, explicit connector targeting, source maps, redaction, atomic authoring and active-designer controls. Qualified in the runtime, SDK and active designer; broader RFC follow-ups are DDN-T20. |
| DDN-T04 | P1 | COMPLETE | Public preview/apply adapter, core draft resolver and Source drawer preview/apply/cancel. Chapter 21 defines the supported commands, per-site flow/activity obligations and strict publication boundary. Atomic file edits validate every declared view. Focused 31/31, browser 2/2, notation 148/148, root 8/8 and designer pass. See `../kimi-specification-workarea/ddn-preview-apply-2026-10-09/REPORT.md`. |
| DDN-T05 | P1 | COMPLETE | Explicit same-view frame containment, registry depth limit 4, coded parent/cycle/depth/geometry errors, nested graph bounds and inherited confine constraints. Positive and negative vectors active. Focused 16/16, notation 149/149, root 8/8, designer pass; 277 patent SVGs byte-identical. See `../kimi-specification-workarea/ddn-frame-nesting-2026-10-09/REPORT.md`. |
| DDN-T06 | P1 | COMPLETE | AUD-005: generated 55 silhouette identifiers from kind defaults and profile variants (previously 14); SDK builds reject drift and unknown recipes. Explicit legacy intermediate fallback retained. Focused 62/62, six targeted notation groups, three root groups and browser 11/11 pass. See `../kimi-specification-workarea/ddn-shape-catalogue-2026-10-09/REPORT.md`. |
| DDN-T07 | P1 | IN PROGRESS | Bounded EM-2 KEEL L0 DAG evaluation implemented (chapter 14). Bounded unique/first/collect tables also implemented; broader DMN/FEEL semantics, EM-5 host contracts and boundary validation specified in chapter 15; actual EM-5 engines and EM-6 protocol interpretations remain outstanding; generic unsupported profiles still report DDN-A006. |
| DDN-T08 | P1 | OPEN | Preserve DDNA A–C and WW-001–007 acceptance probes as repeatable tracked suites. Temporary `/tmp` probes and implementation notes are insufficient durable acceptance evidence. |
| DDN-T09 | P1 | OPEN | Deterministic cross-tool display qualification: reconcile DSP-AC-01–07 and OWN-081 ignore behavior, run against the intended downstream revision, preserve canonical scenes and input manifests. Ordinary DDN vector tests do not prove cross-product equivalence. |
| DDN-T10 | P2 | OPEN | AUD-002 explicit create destination: reconcile active WW-002/003 file/view creation with definition-creation destination and atomic create-plus-occurrence acceptance. Do not close from similarly named file controls alone. |
| DDN-T11 | P2 | OPEN | Measure completed-editor responsiveness against chapter 16 budgets, including DOM install, drag, dense views and failures. Existing runtime/worker measurements do not establish editor targets. |
| DDN-T12 | P2 | OPEN | Reference-tool follow-ups: element-targeted sizing controls, diff-view UI, attachment-policy contract/editing, actual timeline drag, and designer controls/spreadsheet editing for the newly implemented column and field-wrap source properties. Also migrate existing visual gestures to the preview/apply adapter and qualify additional draft-validator sites individually. The roadmap's implemented helpers, draft contracts or typed date fields do not alone satisfy these interaction requirements. |
| DDN-T13 | P2 | DECISION | Rebaseline designer specification 00–21 and M1–M3 acceptance against the active tool; settle what declares the reference PoC complete. Retired prototype evidence must remain distinguishable. |
| DDN-T14 | P2 | DECISION | Finalize icon release selection/digests, reproducible-output input manifest, Weaver-target revision, REF-CLI consumption, and formal closure release notes. October 5 checklist is not approval of its recommendations. |
| DDN-T15 | P2 | OPEN | DDNA specification remainder: DATA A-vs-C, final feature core/optional tags, cited-text acquisition, DMN/UAF version reconciliation, converter licensing and 1.0 claims. Reconcile `ddna/12-what-remains.md` with landed companion/integration conventions. |
| DDN-T16 | P2 | DECISION | Resolve remaining October 5 governance/coordination questions against October 8 scope. Especially DDNA governance home, execution ownership, determinism, and withdrawn collaboration requests. Record actual decisions rather than inferred approval. |
| DDN-T17 | P2 | DECISION | T04 now validates all files syntactically and all declared views authoritatively for adapter actions. Reconcile the remaining AUD-008 legacy/raw edit paths and lab-manifest coverage; no automatic closure by referral to Weaver. |
| DDN-T18 | P3 | HISTORICAL | ScratchBird Core audit: October 3 report records 52 owner questions and 389 open markers after repairs. Revalidate against current Core authority in a separate ScratchBird task before treating these counts as current. |
| DDN-T19 | P3 | HISTORICAL | Twenty counsel-review patent packages, 277 DDN figures. Preserve source and confidentiality; draft completion is not filing/counsel approval. Figures are also a DDN regression corpus. |
| DDN-T20 | P2 | OPEN | Occurrence follow-ups outside the implemented flat binary-graph contract: hidden-endpoint boundary-cross routing, occurrence-level visual diffing, and explicit addressing in data-bound/isometric/fixed-lane/n-ary projections. Each needs its own projection and interaction contract; current sources reject unsupported cases rather than silently dropping qualifiers. |
| DDN-T21 | P1 | COMPLETE | Chapter 59/source dialect 0.7: type/element/appearance section defaults, table-note order, text-only Markdown/code, scrollable notes and optional DDNN storage. Full text transfer, atomic undo and DDNA appearance replay are implemented. Focused 35/35, browser 2/2, all 147 notation scripts, root 8/8 and designer pass. See `../kimi-specification-workarea/ddn-composable-elements-implementation-2026-10-09/REPORT.md`. |

## Scope and ownership reconciliation

The October 8 owner direction supersedes the October 5 proposal that DDNA
execution belongs only in the commercial product. Open tools include DDNA
replay, generation and bounded KEEL evaluation. The rendering core remains
notation-only; this architectural boundary does not withhold DDNA capabilities
from the open tool. See the changelog and chapter 57 §57.6. Missing engines
remain implementation gaps, not commercial exclusions.

The old closure proposal contains 17 owner questions. Implementations have since
landed for its assertion, Chen, calendar and much of the command-set questions;
that proves delivery, not that every governance or scope question was formally
answered. PDF/PPTX, hosted storage and collaboration retain their documented
product assignments. This register does not invent new exclusions or approve
older CLOSE/WEAVER recommendations.

## Workplan reconciliation

| Previous record | How to use it now |
| --- | --- |
| `kimi-DDN-workarea/TRACKING.md` | Historical B1 log; B1-101 implementation now recorded complete |
| `kimi-specification-workarea/ddn-0.8-workplan/WORKPLAN.md` | Original agreed scope; 0.7 version and active-status header superseded; use open conformance items above |
| `kimi-specification-workarea/ddn-designer-redesign/WORKPLAN.md` | Seven phases delivered; not a closure claim for all designer requirements |
| `kimi-specification-workarea/ddn-opensource-closure-2026-10-05/` | Historical proposal and useful requirement inventory; commercial-only DDNA scope superseded; unchecked decisions still require reconciliation |
| `DDN-0.9-ROADMAP.md` | Most portable features shipped as 0.8 amendments; draft-only and partial-delivery items remain explicitly open |
| `DDN-GAPS.md` | Historical deferrals; structured read-only assertions now implemented, arbitrary expression evaluation is not implied |

## Qualification evidence

The existing conformance run passed 289/289 checks, including the 500-node
stress vector and all 277 patent figures. Four new field-presentation positive
and negative vectors passed separately. The historical max-nesting skip remains
open (DDN-T05). The new source/IR/SVG suite passed 22/22 and its Chromium SDK
probe passed 8/8. The worker suite passed 10/10, including byte-equivalence for
391 catalogue views. All 145 notation test scripts and the designer regression
suite passed. All eight root qualification groups passed: packaging, website/
browser, brand, AI reference, normalization, submission, field guide and benchmark.
The browser crawl rendered all 617 distinct targets; guide browser checks passed
11/11, and the independently regenerated guide matched all saved files byte for byte.

Baseline comparison against `c1e0cf1d` rendered all 277 patent figures with no
errors and **no per-figure crossing increase**. Total crossings fell from 341 to
339; 75 figures changed geometry. This measures the complete amendment, whereas
the earlier 72-figure estimate counted only wrapped field rows.

Qualification also repaired a stale empty-assertion fixture, made the endpoint
ordering test explicitly retain its reference placement across routing modes,
and added the missing Chen n-ary gallery example. The example-link browser
crawl now actually awaits asynchronous browser calls in its existing eight-worker
pool; previously its synchronous calls serialized all 617 targets. Coverage and
assertions are unchanged, and interrupted pre-fix logs were retained. Existing brand assets were
regenerated from the shared logo source to satisfy the freshness gate. SDKs,
viewer/tool/portable pages, gallery, field guide and website outputs were rebuilt.
These generated files account for most of the changed-file count.

Raw logs, original failure logs, final rechecks and machine-readable results are
retained with the inherited patch in the takeover evidence directory.
`qualification-summary.json` records the final results; `implementation-manifest.json`
fingerprints the qualified runtime, SDK and regression tests.
No commit, push, release or deployment is part of this takeover step.


## Independent graph appearances (DDN-T03)

The chapter 03 occurrence contract is implemented in the runtime, SDK and active
designer. `@element#N` selects separate appearances of one model definition;
each appearance has independent placement and presentation. Explicit connector
appearances choose existing endpoint appearances without changing the semantic
relationship. Source maps resolve edits to the shared definition, including
imports; pin, hide, frame membership and undo address the selected appearance.
The Inspector exposes element and connector appearance creation. Qualified
references round-trip through source, bundles and snapshots. Public redaction
aliases only authorized occurrences. Specialized projection and hidden-endpoint
extensions remain open under DDN-T20.

The occurrence suite passes 34/34, and the final designer browser suite passes
with workers both disabled and enabled (2/2). All 146 notation scripts pass,
including 296/296 conformance checks and worker/synchronous byte equivalence
across 391 catalogue views. The historical designer suite passes. The website
crawl renders all 617 targets. All 277 patent figures are byte-identical to the
previous takeover baseline, with identical geometry and 339 total crossings.

Evidence is preserved in
`kimi-specification-workarea/ddn-occurrences-2026-10-09/evidence/`, alongside
the starting patch/status, build logs, original failure logs and final rechecks.
`implementation-manifest.json` fingerprints the implementation and regression
probes. The initial freshness failure was corrected by rebuilding the final SDK
and its consumers. All eight root qualification groups pass, including packaging,
website/browser, brand, AI reference, normalization, submission, field guide and
benchmark. The guide independently regenerates byte for byte, and its browser
checks pass 11/11. `qualification-summary.json` records the final result.

Next priority: DDN-T07, DDNA declarative-rule, solver and protocol-conformance gaps. T04 extends the content-specific file grouping with the public preview/apply adapter described below.

## Composable element content (DDN-T21)

Chapter 59 and source dialect 0.7 implement independently visible name, type, table and notes sections with type defaults, element defaults and appearance overrides. Text documents can be inline or explicitly referenced from DDNN; plain text, a bounded text-only Markdown subset and exact code text are supported. Notes have horizontal/vertical interactive scrolling and an explicit full-text publication mode. The Meaning and This view tabs expose editing controls. Complete source survives hiding, bundling, file/ZIP transfer, snapshots and atomic undo. DDNA replay targets all visible appearances of a semantic element.

All 147 notation scripts and all eight root qualification groups pass. Focused composition checks are 35/35; real-browser worker off/on checks are 2/2; conformance is 300/300 and worker parity covers 391 views. The website crawl renders 617 targets. All 277 patent figures are byte-identical to the previous baseline, with unchanged geometry and 339 crossings. The field guide independently regenerates byte for byte. The historical designer suite passes.

The implementation report, performance probes, initial failure logs, final results and source fingerprints are in `../kimi-specification-workarea/ddn-composable-elements-implementation-2026-10-09/`. The reviewable procedure example is `standard/examples/composable-procedure.ddn` with its DDNN companion. DDNN is not lazy remote storage; reference workspace/document limits remain explicit in chapter 59 and the report. No database execution or migration engine is supplied. Package/release numbering is separate from source dialect 0.7. No commit, push, release or deployment was performed.


## Preview/apply diagram file edits (DDN-T04)

Implemented `workspace.editor()` with isolated previews, exact before/after text
and hashes, revision/policy checks, conservative all-view validation, cancellation,
and one undoable apply. `buildDraft` collects only explicitly registered
flow/activity obligations and continues validation to find later hard errors.
Ordinary rendering/export stays strict; draft pictures are visibly marked. The
Source drawer exposes preview/apply/cancel, including an isolated candidate
picture. Source 0.7 now supports the occurrence authoring operations.

Owner scope clarification (2026-10-09): this project stores, edits, validates and
displays DDN/DDNA/DDNN. Procedure code remains text. Database connections, SQL
execution, creation and alteration belong to the separate database-reader
project. “Apply” here changes in-memory notation files, not a database or disk.

The implemented contract is `designer/specification/21-preview-apply.md`.
Qualification and local timings are recorded in
`../kimi-specification-workarea/ddn-preview-apply-2026-10-09/REPORT.md`.
Further visual-control migration and additional soft-validator sites remain
T12; typed creation destinations remain T10 and full UI responsiveness remains
T11. No claim is made that the historical proposed command inventory all ships.


## Explicit frame nesting (DDN-T05)

The formerly deferred maximum-nesting vector now passes, with a fifth-level
rejection vector. Source 0.6/0.7 supports same-view `within` references. The
registry fixes the cap at four levels, including the outermost frame.
Expanded nested boundaries enclose child frames; confined ancestors reserve
space for descendant boundaries and titles. Flat-frame output remains
compatible: 277 patent views are byte-identical against the archived baseline.

Chapter 03 defines the contract; chapter 58 lists both conformance vectors.
All 149 notation scripts, eight root groups and the historical designer pass.
Focused checks pass 16/16, including source/SDK rendering and draft validation.
Evidence and diagnostic benchmarks are in
`../kimi-specification-workarea/ddn-frame-nesting-2026-10-09/REPORT.md`.
No database execution or alteration was added. Next priority is DDN-T06.


## Shape catalogue consistency (DDN-T06)

The profile shape inventory is generated from kind defaults and installed
profile variants, with renderer coverage checks. It contains 55 identifiers
(previously 14). SDK asset builds refuse drift. Chapter 17 documents the
maintenance command and the explicit legacy intermediate rectangle fallback.
The submission facts now count registered identifiers rather than implying
that each is a distinct geometric primitive. Generated product and website
files are current; all 43 SDK mirror files match.

All 62 focused checks, six targeted notation groups, three root groups and
11 field-guide browser checks pass. This was targeted metadata/build
qualification, not a repeat of the complete routing corpus. No rendering
algorithm or database behavior changed. Evidence is in
`../kimi-specification-workarea/ddn-shape-catalogue-2026-10-09/REPORT.md`.
Next priority is DDN-T07.

## Bounded declarative evaluation (DDN-T07, in progress)

The exact `ddna.em2.dag-l0@1` profile now evaluates a bounded dependency graph
through KEEL L0, records input/result snapshots and verifies full event content
using recorded inputs. Qualified targets distinguish modules while preserving
multiple visible appearances. Chapter 14 defines the implemented contract;
`standard/examples/declarative-order.ddn` and its DDNA companion demonstrate it.
KEEL L0 1.0.1 also fixes subtraction tokenization.

Thirty evaluator checks, 101 existing tool checks, Chromium generation/replay
and composition checks with workers off/on, and three root qualification groups
pass. A local 128-node numeric chain took median 12.186 ms to generate and
15.090 ms to verify; these are diagnostic Node timings, not browser guarantees.
Evidence and the remaining work plan are in
`../kimi-specification-workarea/ddn-declarative-evaluation-2026-10-09/REPORT.md`.

T07 remains in progress. Next is the decision-table/rule contract; full DMN/FEEL,
EM-5 host/solver contracts and EM-6 protocol interpretations remain outstanding.
The SDK rendering layer is unchanged. Database work remains in the separate
reader project; stored procedure text is never executed here.

## Bounded decision tables (DDN-T07, in progress)

`ddna.em2.tables-l0@1` extends the bounded graph machinery with explicit unique,
first and collect rules. Chapter 14 specifies predicate/result typing,
no-match/null behavior, overlap errors, row limits and complete table evidence
for verified replay. The original DAG profile remains compatible. The example
is `standard/examples/decision-discount.ddn` with its DDNA companion.

All 26 new table tests, 30 DAG regressions and 101 tool checks pass. Expanded
Chromium generation/replay checks pass with workers off/on. A local 512-row
numeric collect case took median 13.140 ms to generate and 15.885 ms to verify;
these are Node diagnostics, not browser guarantees. Generated tool/site files
are current. Evidence and remaining work are in
`../kimi-specification-workarea/ddn-decision-tables-2026-10-09/REPORT.md`.

Next T07 priority is EM-5 host-contract analysis, separating SysML constraints
from UAF queries. Full DMN/FEEL, solver and protocol conformance remain open.
Display tables are not implicitly executable. Rules require an explicit
supported DDNA profile; procedure source remains inert and no database
operations were added.


## Delegated evaluation contracts (DDN-T07, in progress)

Chapter 15 separates constraint-host requests from graph-reachability requests.
The pure `ddna/contracts/em5.mjs` validator checks inputs, capability negotiation
and response structure; 15 repeatable boundary tests pass. It is not loaded by
the live tool and is not a solver, query evaluator or dispatcher. EM-5 is an
execution-model classification, not an installed engine. Run remains unavailable.

Requests/results carry snapshot and engine identity, explicit budgets and
operation-specific outcomes. Unknown, cancelled and failed never become complete
results. Solver evidence references need actual checking; successful boundary
validation does not prove a solution. Procedure text remains inert.

Next implementation is bounded reachability over explicit model snapshots,
including worker cancellation and replay qualification. A concrete constraint
language and qualified solver/checker remain separate work; no database work is
part of these contracts. See chapter 15 for completion gates.
