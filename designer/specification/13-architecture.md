# Runtime architecture and extension contracts

**DDN Designer specification 0.1 — proposed; baseline audited 0.5.0-draft.2.**

## Modules
The proposed architecture has a visual application shell, descriptor service, command service, source workspace adapter, selection/occurrence index, interaction state machine, layout worker bridge, projection-specific editors, persistence adapter and export/review service. These are not a second parser or semantic registry.

**DDN core** remains responsible for parsing, reference resolution, semantic validation, projection, layout, routing and final export. **Designer** is responsible for user intent, drafts, selection, applicability, safe source commands, visual interaction and exposing diagnostics. **Studio** remains a separate source-first shell over the same core.

## Rendering path
The native host displays renderer SVG as the visual truth and uses scene geometry for overlays. During a drag it uses an inexpensive overlay/ghost and incident-edge preview; on release it prepares one command and invokes canonical rendering. Geometry transforms are explicitly world → drawing → publication → viewport → screen. Pointer positions are inverted through the current matrices, not guessed from CSS scaling.

A public scene adapter should expose bounds, contour anchors, field/port hit targets, occurrence/source mappings, label bounds, publication transform, and editability. Current scene data supplies part of this but not a complete stable contract. Do not tie editor code to CSS selectors such as nth-child rows in generated SVG.

## Worker seam
Keep layout/project compilation off the main interaction loop in the production design. Requests carry revision, view ID, descriptor/profile version, request generation and resource limits. Results older than current revision/generation are discarded. Cancellation must stop or terminate the worker, not merely reject a Promise while CPU work continues. If the current synchronous engine is used initially, show explicit busy states and a bounded view limit; do not claim worker isolation.

## Incremental computation
Track definition dependencies and cache by source/model/profile/font-metrics identity. Changing a local label can invalidate measurement and its incident routes; changing a shared domain can affect many field displays. Reuse caches only when dependency identities and revisions match. Deterministic seeds derive from stable IDs, not array iteration order. A request to optimize selected shapes leaves all other pins/constraints untouched.

## Application package
Ship `designer/` as a separate route and optional embeddable package. The renderer distribution remains small enough to serve without the editor. Supply ESM and standalone application builds as appropriate, declarations, documented host events, and an optional all-in-one offline page. No third-party module is required just to display an existing DDN SVG.

## Descriptor registration
Editor metadata is trusted installed configuration, versioned independently of DDN grammar. It references existing kind/profile/property IDs and command adapters. Registration validates uniqueness, allowed widgets, legal source scopes and no executable expressions. Every descriptor has a fallback editor: read-only structured properties plus Studio source navigation when not safely writable. Unsupported widgets fail visibly instead of interpreting arbitrary HTML.

## Integration API
The proposed `DesignerController` accepts a DDN workspace, active view, command service, descriptor registry, persistence callbacks and optional permissions. It emits selection, prepared change, committed revision, validation result, export and navigation events. Destroy releases listeners, workers and caches. Host permissions are checked at command boundaries; hiding a button is not authorization.

## Existing versus proposed
`DDNLive.createWorkspace`, `renderSync`, source spans, history, field additions, matrix edits and pin helpers exist. Descriptor-driven inspectors, general create destination, occurrence editing, reconnection, draft validation, safe conversion and worker cancellation are specification work. The supplied TypeScript contracts describe that new boundary and must not be imported as though these methods already exist in DDN 0.5.
