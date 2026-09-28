# RFC 0132 — Drill-down display modes and frozen thumbnails (`x_subdiagram` extension v2)

Status: implemented  
Authors/reviewers: B1-074 work item  
Language/registry impact: additive properties on the existing `x_subdiagram` extension contract; no grammar change; runtime/specification 0.7 line.

## Problem and motivating example

`x_subdiagram` binds a node to a detail view, but only two presentations exist: the `↗ ref` badge and the interaction-overview inline expansion (full fidelity, and actively rejected by the DDN076 minimum-text rule when the child shrinks too far). Hosts asked for drill-down nodes that show a *simplified* picture — silhouettes without text — and for *frozen* pictures that must not change until the host deliberately refreshes them (the replaceData precedent: refresh is a host transaction, never implicit).

## Proposed syntax

Additive properties on `x_subdiagram` (still closed, still `object` target):

- `display`: `badge` (default everywhere except `uml.interaction_overview@2`, whose display-absent behavior stays legacy inline — byte-identical), `inline` (live full-fidelity child), `thumbnail` (live child rendered in *shapes detail*: silhouettes, edges, frames and ports; every text run suppressed).
- `frozen: true` with `snapshot` (the stored SVG document, max 512 KiB, must parse as `<svg…`) and optional `snapshot_at` (string timestamp). A frozen node embeds the snapshot verbatim through the same `io-<hash>-` namespacing pass as inline children; the viewer never re-renders it. The host refreshes by rewriting the `snapshot` property through the ordinary source transaction (applyEdits/authoring), exactly like replaceData rewrites records.

Versioning note: this is an additive property extension on a closed contract — the previous shape (`{view}` only) remains valid and behaves byte-identically for existing uses (interaction overview @2, DMN bindings), satisfying the registry versioning rules for minor contract versions.

## Semantics

- **Shapes detail** threads a `detail: 'shapes'` flag through `render()`: the shared text helper in `ddn-shapes.js` returns empty for every run, relation labels are skipped, and child chrome (title/legend/footer) is suppressed. Silhouettes, edges, frames and ports draw as usual. Node `<title>` accessibility elements remain (metadata, not drawn text).
- **One nesting level** for inline/thumbnail children, matching the interaction-overview rule (DDN-PJ174/PJ198).
- Validation: target view existence (DDN-PJ119), frozen shape rules (DDN-PJ198: frozen requires `display: thumbnail`, a snapshot that parses as SVG, snapshot_at string).

## Error codes (ceilings re-grepped: PJ197, PJW06)

- `DDN-PJ198` — drill-down shape rules (frozen payload, nesting level, self-binding).

## Alternatives considered

1. **A new `x_thumbnail` contract**: rejected — one contract with display modes keeps all drill-down data in one place (x_sentry precedent).
2. **Renderer-level text-size threshold instead of a detail mode**: rejected — implicit simplification would change pictures silently; the display mode is an explicit author choice.
3. **Server-side snapshot generation**: rejected — the viewer stays zero-dependency; the host produces snapshots with the same public render API the viewer uses.
