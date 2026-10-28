# Performance targets and acceptance gates

## What is measured

These are **proposed implementation release targets**, not benchmark results for software that already exists. The existing-runtime probe in `evidence/` only establishes an optimization opportunity. Failing a target requires an explicit scope/design decision and recorded evidence; it must not be hidden by dropping profile rules, omitting dependencies or reducing the test workload.

Pin a reference desktop at the first implementation gate: 4 or more physical CPU cores, 16 GiB memory, integrated graphics, 60 Hz display, with CPU/OS/browser/thermal/power details recorded. Use fixed viewport 1440×900, device scale 1, bundled fixture font, deterministic algorithm seeds and generated fixture hashes. Run all correctness cases across the browser matrix; measure performance on the pinned reference machine and one lower-resource machine. Do not compare wall-clock results from different hardware as regressions.

## Distribution budgets

| Native distribution | Maximum gzip-9 payload target | What counts |
|---|---:|---|
| Verifier | 100 KiB | Language/model support, generated core checks, native rules and shell |
| Viewer | 250 KiB | Shared verifier/core, native projections/SVG, controls, shell and worker code |
| Visual designer increment | 150 KiB | Commands, source editing, controls and native profile editing above the viewer |
| Combined visual designer | 400 KiB | Full viewer + designer dependency closure, including worker code |

Measure the concatenated logical ESM closure and the actual offline HTML independently. Both native distributions must meet their respective compressed budget. Report raw bytes too; gzip is a comparison metric, not a claim that a file opened from disk is transferred compressed. Native HTML raw limits are 1 MiB verifier, 2 MiB viewer and 3 MiB designer. Libraries are counted once when actually shared and every time they are duplicated in an artifact. Do not use external CDNs to satisfy a small bundle claim.

All-profile size is reported separately and is not subject to the native-only ceiling. At the first complete-profile build, establish and record its measured budget before release; no fixed all-profile size is claimed here because pack costs are not yet measured. The profile inventory and full offline behavior are mandatory regardless of size. PDF/DOCX/ODT and full reference/help packs report their own incremental sizes.

## Interaction and computation budgets

| Operation / workload | Proposed acceptance target |
|---|---|
| Initial visible scene, W1, ready fonts | p95 ≤250 ms from `open` to usable scene |
| Initial visible scene, W2 or W3 | p95 ≤1,000 ms; progress visible by 100 ms |
| W1/W2 title or isolated cell edit, settled scene | p95 ≤150 ms from commit; input feedback next frame |
| W3 shared-domain edit | p95 ≤500 ms; update only dependency closure, report wider fan-out |
| Viewport pan/zoom, W1–W4 | p95 DDN main-thread work ≤8 ms/frame; no synchronous full-model layout |
| Pointer/keyboard response | ≥95% feedback in the next 60 Hz frame; no DDN main-thread task >50 ms during active input |
| Comment-only edit | Zero semantic-rule/layout reruns when structure and resolved values are unchanged; diagnostics locations remapped |
| Cancellation | Acknowledge within 100 ms; terminate/recreate an unresponsive worker after that deadline |
| Cooperative fallback | Scheduled work slices target ≤4 ms; yield to the browser task queue between slices |
| Passive W5 updates | Sustain 10 batches/s for 60 seconds with bounded queue; no loss of keyed delta operations |
| Review verification W1–W3 | p95 ≤500 ms for local structural/semantic closure; expensive global checks have explicit budgets/progress |
| Disposal | 100 open/attach/detach/destroy cycles leave no live workers, subscriptions or growing retained-instance count |

An 8 ms main-thread budget is not a guarantee of every browser's final frame time. Measure actual frame intervals and long tasks as well as DDN marks. Browser scheduling, fonts, OS and display composition contribute separately. Worker mode and cooperative mode must have equivalent semantic results, but different total completion times may be reported.

Use `scheduler.yield()` only when available, otherwise a task-queue fallback; a Promise-only microtask loop does not provide an adequate input/rendering yield. [MDN scheduler.yield](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield). Cancellation tests deliberately use a long-running graph computation and a missing font, not merely an empty worker.

## Reproducible workloads

| ID | Contents | Tests |
|---|---|---|
| W1 | 4 native elements, 3 connectors, one view | Startup, tiny edit, source preservation, detach |
| W2 | 32-node/31-edge native graph, fixed seed and geometry | Direct comparison of operation counts and measured timings with old runtime probe |
| W3 | 50 native ERD entities, 20 fields each, 49 legal links; 10 shared domains | Table measurement, wrap, provisional domains, title/cell/shared-value invalidation |
| W4 | 100 placed views, 50 definitions/view, 4 visible; totals 5,000 definitions, legal per-view profile bounds | Workarea culling, offscreen navigation, cross-view references, accessible outline |
| W5 | 100 table rows × 10 columns, 10 keyed row-update batches/s; two bound visible views | Passive updates, coherent schemas, backpressure, editor draft preservation |
| W6 | Every one of 151 exact retained profiles, positive and negative witnesses rewritten to the new dialect | Profile/role/default/rule/editor/output coverage, not throughput ranking |
| W7 | W3/W4 with worker denied, delayed/cancelled tasks, missing includes/packs/assets, malformed intermediate text | Fallback, recovery, partial coverage, stale rejection and no false acceptance |
| W8 | Same 100-cycle operation on one retained runtime and on separate runtimes | Leases, disposal, memory/worker/listener leaks |

Fixture dimensions are proposals for implementation tests. Every generated fixture must first pass the applicable retained profile limits; if a profile's explicit mathematical/size restriction conflicts, change the fixture/profile selection and report why. W4 scales across views rather than quietly lifting a per-view cap. A separate escalating stress run must report the point of budget exhaustion and preserve sources; it need not claim unlimited diagram size.

For timings: record 5 untimed warmups where relevant, 30 measured operations in at least 3 fresh browser contexts, medians/p95/max, and raw samples. Cold startup uses fresh contexts and no prewarmed model/cache. Report worker boot, decode, verification, metrics, layout, routing, serialization/transfer, DOM patch and usable-frame times separately. Measure both first font load and ready-font cases. All network is disabled for offline gates. Timings are observations, never semantic acceptance predicates.

## Required functional gates

The requirement register defines acceptance scenarios for each utility and shared boundary. All profiles require a positive render witness, negative rule witness, default precedence witness and an edit round trip with qualified identity. A palette entry alone does not count as an implemented element/relationship.

Source round trips preserve comments, quotes, note paragraphs, LF table rows, skipped/null cells and sparse defaults. Layout snapshots assert geometry/labels/roles within declared tolerance with pinned fonts; they do not require byte-identical browser SVG across all environments. Full-text, keyboard and assistive-technology checks accompany visual checks. Canvas, if added, must preserve these contracts; drawn canvas objects are not inherently semantic accessible objects. [MDN canvas](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas).

The release gates are: core model/language contract; standalone verifier; native viewer; native progressive designer; all retained profiles; multi-view/live data/publication; measured size/performance; complete offline distribution and embedding. Each gate publishes exact versions, failures, capability exclusions and evidence. New tests/builds and browser profiles belong in the DDN workarea. This specification task checks contract consistency; it does not claim those product release gates have passed.
