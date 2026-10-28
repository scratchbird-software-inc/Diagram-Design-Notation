# Implementation sequence and handoff

Implementation is subsequent work. This specification task does not modify maintained product source. No legacy grammar, compatibility aliases or migration engine are required; old code/examples are reusable evidence, and fixtures may be rewritten to the new dialect.

| Gate | Deliverables | Exit evidence |
|---|---|---|
| G1 Shared language/model | Lossless indentation parser, source map, normalized codex model, default resolver, identities/dependency indexes, transactions and cancellation executor | Sparse-source round trips; file/CSS/standard precedence; include identity; schema agreement; malformed text recovery |
| G2 Verifier | DOM-free staged checks, exact profile registration, source/model APIs, revisioned reports, standalone HTML shell | Draft/completeness distinction; current-scope evidence; lifecycle eligibility; resource/cancellation failure cases |
| G3 Native viewer | Shared scene, SVG/HTML renderer, metrics, culling, navigation/inspection/outline, passive updates, local captures | Native ERD/mind-map/table witnesses, file:// offline operation, read-only imports, font and stale-update cases |
| G4 Visual designer | Viewer attachment, prepared commands, source/property/member editors, progressive ERD, explicit conversion, undo/history/recovery | Complete owner ERD walkthrough; draft/source preservation; one-way lifecycle and accepted reopening; detach/read-only viewer |
| G5 Profile completion | All 151 exact rule/render/editor routes and descriptor generation | Positive/negative/default/edit witnesses for every retained bounded profile; no unsupported placeholder counted as success |
| G6 Multi-view/publication | Placed views/document views, linked navigation, live data consistency, output adapters and capture manifests | Offscreen/global-scope correctness; coherent data revisions; declared fidelity and no silent format substitution |
| G7 Performance/distribution | Measured dependency closure, native and complete offline artifacts, worker fallback, embed examples, disposal/recovery | Browser matrix, network-disabled local operation, measured targets and documented all-profile bundle budget |

G2 and the scene/metric foundations of G3 may proceed independently after G1 interfaces stabilize. Do not defer verifier integration until after the designer: editing and review must share the same rules from the start. Projection packs can be implemented incrementally; complete standard coverage is a release gate, not an assumption based on one native renderer.

Each gate must publish the implementation version, exact language/default/profile versions, requirement IDs, executed checks, remaining limitations and artifact paths. Use `UTIL-VW*`, `UTIL-DS*`, `UTIL-VF*` and `UTIL-SH*` IDs from the requirement register to avoid collisions with older unified-model view IDs. Short forms in these utility documents refer to that namespace only.

## Product boundaries

The open foundation contains local single-user viewing, editing, logical verification, supplied passive updates, multiple local views/documents and declared local output adapters. It does not implement collaboration ownership, concurrent merges, user presence, shared voting, managed workflow execution, voice/video services, credentials, background server computation or deployment automation. Those closed providers may use the same public model/transactions/reports. A file describing a process does not authorize executing it.

AI can provide a proposed transaction or source edit through a host adapter. The designer previews and applies it through the same checks as a human edit. No mandatory AI service, credential or network connection is introduced. Verification is deterministic rule evaluation; it must not rely on an AI opinion for a pass.

## Decisions inferred for implementation

The shared runtime, SVG-first backend, one lazy worker, typed API, source revision/fingerprint distinction, pack organization, specific performance budgets, default undo limits and offline bundle mechanism are engineering choices inferred from the owner's requirements. They are specification proposals, not quotations from the owner. Native DDN primacy, the three utility responsibilities, browser/server independence, small modular/fast operation, workspace artifact routing and earlier language/default/status decisions are owner requirements.

Detailed icon artwork, shell branding and optional backend/format library selection can be decided during implementation under these contracts. They do not block interface or behavior specification. Any implementation that changes language semantics or versioned defaults must amend the language/property contract explicitly; utility internals cannot quietly redefine those defaults.
