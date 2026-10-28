# Existing system evidence and architecture choice

## What to retain

The existing 0.8.0 implementation already uses JavaScript, SVG, reusable profile/shape/layout code, scene geometry, cached rendering and a worker bridge. The previous designer architecture also discusses incremental dependencies and workers. This proposal makes those responsibilities explicit across all three utilities and the new language; it does not claim those ideas are newly invented.

Review sources: `notation/studio/src/api.js`, `notation/tool/src/bridge.js`, `notation/runtime/ddn-module-registry.js`, `notation/runtime/ddn-full.js`, `tools/build-tool.js`, `designer/prototype/commands.js`, `designer/specification/13-architecture.md` and `designer/specification/16-performance.md` in the maintained repository. Static audit (historical specification citation) records the inspected source hashes and concrete matches.

## Measured existing distribution

| Existing file | Raw bytes | gzip-9 bytes |
|---|---:|---:|
| `notation/dist/ddn.global.min.js` | 1,406,802 | 347,979 |
| `notation/tool/ddn-tool.html` | 5,797,899 | 1,132,947 |
| `notation/studio/assets/workspaces.js` | 1,886,911 | 165,907 |
| `designer/contracts/form-descriptors.json` | 87,213 | 8,188 |

These are sizes of files currently on disk. They do not measure browser heap, downloaded payloads or the proposed implementation. The tool builder includes an example corpus and embeds another runtime in its worker source. Splitting the gallery from the application and measuring worker duplication are concrete packaging opportunities; exact savings require an actual build.

## Existing-runtime probe

The [probe](probes/current-runtime.mjs) imports the existing distributable, creates two old-dialect graphs and performs three runs each. It writes only to this workarea. Raw result (historical specification citation): Node v22.22.3, Linux x64, Intel Core Ultra 7 165U; no browser/DOM measurements.

| Graph | Median construction + cold render | Cached render | Render after comment-only update |
|---|---:|---:|---:|
| 4 nodes / 3 links | 32.10 ms | 0.16 ms | 26.67 ms |
| 32 nodes / 31 links | 2,018.30 ms | 0.59 ms | 2,042.77 ms |

Three runs are an exploratory probe, not release-grade statistics. The comment update did not change the represented graph, but `createWorkspace`'s `notify` clears the compiled-view and geometry caches. The result supports semantic dependency caching and operation-count tests. It does not establish a universal graph-size threshold or prove that the new architecture will meet its targets.

The old designer performance document reports a historical medium-fixture worker experiment: request-to-display remained about 1.47 seconds while measured main-thread work fell to about 5 ms. That is historical evidence from its recorded environment, not this probe. Moving computation to a worker improves responsiveness; reducing unnecessary work and improving algorithms are separate requirements.

## Concrete changes

| Current observation | Specification response |
|---|---|
| Workspace notification clears all compiled/geometry caches | Separate source, semantic and presentation dependencies; preserve unchanged work |
| Parse/compile precedes the coarse worker render call | Shared cancellable compute pipeline with explicit model deltas and measurement inputs |
| Full IR sent for renders; stale promises rejected | Revisioned replica/deltas and cooperative cancellation; prevent obsolete CPU work continuing indefinitely |
| Metric mismatch can permanently degrade bridge to synchronous rendering | Font-generation invalidation, remeasurement and controlled worker recovery |
| Global first-published module registry | Explicit runtime registry, compatibility checks and independent instances |
| Scratch workspaces/whole-file snapshots used in command paths | Prepared transactions, shared incremental checks, bounded patch history |
| Full tool combines UI/runtime/examples | Separate public modules, optional packs, dedicated offline shells |
| Old font overlays may change appearance without correct geometry | Resolve codex CSS before measuring; invalidate wrapping/layout for font changes |

The old workspace/tool already has file handling and navigation. The new specification does not erase that existing functionality or incorrectly assume that the old application has no workspace concept. It standardizes ownership, multiple placed views and document views across the shared runtime.

## Alternatives and decision

| Option | Decision | Reason |
|---|---|---|
| Incremental JS model + SVG scene renderer + optional worker | **GO, initial implementation** | Reuses existing strengths, preserves inspectable/vector output and supports local progressive authoring |
| Mandatory Canvas2D rewrite | **NO-GO as default** | Would add custom text/hit/accessibility work before proving a density benefit; an optional compatible backend remains possible |
| Mandatory WebGL/WebGPU | **NO-GO for foundation** | Adds rendering complexity and backend requirements without evidence that it addresses current invalidation/layout costs |
| Mandatory WASM core | **NO-GO for foundation** | Current evidence identifies avoidable recomputation; algorithm-specific acceleration can follow profiling |
| Server-dependent rendering or verification | **NO-GO for open foundation** | Conflicts with standalone browser operation |
| Framework-mandated component tree | **NO-GO as plugin contract** | Plain browser modules allow embedding in any host; shell internals can use a library only within size/accessibility gates |
| Optional dense-data backend/algorithm worker | **Conditional GO** | Must prove a measured improvement while preserving common scene/rule/output behavior |
| Shared server paging/collaboration/AI orchestration | **Closed extension route** | Use declared providers and transactions; not mandatory code or behavior in the open utilities |

SVG is a selected starting backend, not a promise that an unlimited number of SVG elements is fast. Viewport culling, stable scene patches and bounded text measurement are required. Optional OffscreenCanvas can support a future worker rendering adapter, but its availability alone is not a reason to rewrite the renderer. [MDN OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas).

Font readiness is a versioned presentation input. CSS font-loading APIs expose font loading state so geometry can be rebuilt when the metrics change. [MDN CSS Font Loading API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API). This is a browser-platform constraint supporting the proposed metric pipeline, not an external endorsement of the DDN architecture.

## Evidence limits

The three new utilities do not yet exist. No product source was changed, no new dialect parser was built, no browser performance benchmark or complete-profile rendering run was performed in this task. API declarations, pack routes and acceptance requirements are specification artifacts. Their consistency checks cannot prove runtime correctness, bundle targets or complete output fidelity.

Historical evidence/source snapshots cited in this chapter are excluded from the standalone distribution. Current behavior and qualification are documented in [the public project](https://github.com/scratchbird-software-inc/Diagram-Design-Notation).
