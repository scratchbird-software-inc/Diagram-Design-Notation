# Layout, pins, groups and appearance

**DDN Designer specification 0.2.0-beta.1 — proposed; baseline audited 0.6.0-beta.1.**

## Defaults
Use content-dependent automatic layout for unpinned graph elements. Expose one Arrange menu with Preset, Scope, Spacing and Preview. Keep advanced optimization parameters out of the basic inspector. Available patterns come from the runtime capability contract: auto/grid/manual/fit-grid/circular/radial/layered/tree/spanning-tree/mindmap/grouped/organic as actually supported.

## Scope
Provide Entire view, Unpinned, and Selected elements. Preview compares changed positions and routes and lists pins/constraints that will remain. Apply is one view transaction and Undo restores exactly the prior source/retained state. Scope-selected incremental layout is a target API addition, not assumed from a current algorithm enum. This uses the explicit partial-layout idea observed in yEd without claiming its implementation. [R20]

## Pins and remembered positions
Source `place { at: [...] }` is a hard pin in world coordinates. A size alone is not. Retained free positions are editor/view session state; they do not silently become `at` properties. Pausing auto-placement retains positions; re-enabling releases free positions. Source pins always override remembered values. A drag commit explicitly pins only the moved occurrence. Undo restores its previous pin/retained state.

Pin centring uses the combined measured bounds of visible pinned elements, not an average of top-left coordinates. The publication transform may translate/scale the whole view but must not rewrite pins. A large pin changes the focus envelope through its measured size. No-pin layouts use a documented deterministic fallback.

## Resize
Resize changes a minimum/explicit size under the recipe's contract, not datatype or content. Warn when a size cannot contain content. Resize handles do not apply to data-derived chart marks. Changing a fixed frame's dimensions must check its constrained children; clipping required content is never the silent fallback.

## Scope versus visual grouping
A selection group is session-only. A layout group is view-only. A namespace/organization/security/deployment scope is semantic and uses typed membership relationships. Dragging into a frame defaults to a view placement unless the user chooses the semantic operation offered by that frame. The preview says exactly which relationships will be added/replaced. No automatic inference of cloud placement from visual containment or ownership from a colored frame.

Implementation status (ED-011): frame lane CRUD and assignment previews are implemented in the prototype. Lanes are the view's `frame` declarations in canonical source — create/rename/resize (X, Y, W, H plus fit-to-members) and member assignment commit through the command layer; every drag- or picker-driven assignment opens a preview naming the exact member additions/removals and stating that no semantic containment, ownership, or placement relationship is created (covers VE-AC-040). The editor enforces a one-lane-per-element policy (assignment removes the element from the view's other frames in the same transaction). For the `uml.activity@1` profile the same commands additionally maintain the registered `x_partition:{lane:"…"}` membership property with DDN-PJ114 as the commit-time authority. Semantic scope membership remains the separate typed-relationship path; lanes are never namespaces, scopes, or security boundaries.

## Look and palette
Standard, Hand-drawn and Neo remain drawing treatments. Theme controls include the registered dark and grey-blue night palettes with their matching relation colours. UI chrome theme is separate from the exported diagram theme. A user may use a dark editor while exporting a light document. The inspector gives approved “Default/inherited” and current-view overrides; it does not expose unrestricted semantic colours as a convenient way to change meaning.

## Persisting display changes
Session preview changes are labeled Preview and resettable. Save to this view writes a local format override, with source diff. Edit shared preset opens a distinct action listing consumers. Apply an entire new diagram profile only with a mapping preview because it can change valid shapes and relations, not merely their paint.

## Geometry feedback
Show a concise warning summary with an optional route overlay for crossings, inefficient detours, tight labels and constrained placement. A fix suggestion may preview automatic anchor changes, remove selected guides, or recommend another view; it must not alter semantic endpoints. Layout success is not proof of globally minimal crossings or business correctness.
