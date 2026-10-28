# DDN viewer specification

## Responsibility and dependencies

The viewer displays a DDN workarea and its views/documents without editing their source or semantic content. It supports inspection, navigation, received data changes and local snapshots. The visual designer uses this exact viewer and adds a separate editing controller.

The viewer depends on language/model/defaults, the verifier facade, presentation, execution and the selected installed profile packs. It must not import designer commands, edit widgets, collaboration clients or every output adapter just to open a native diagram. A host can supply an existing runtime so several viewers share parsed data and computation caches.

## Lifecycle

`createViewer(element, options)` mounts an empty shell and returns a disposable controller. `open(input)` accepts selected source files or a revisioned snapshot, resolves the entry-file workarea and includes, loads installed required packs, verifies the applicable scope, then progressively displays usable content. `ready` means the visible initial scene and its coverage state have been presented, not that every off-screen view has been laid out.

The viewer exposes `setViewport`, `navigate`, `inspect`, `setPreview`, `capture`, `subscribe` and `destroy`. It exposes no mutation, status-setting, draft-conversion or relationship-editing method. Incoming updates enter the shared runtime's data/source provider API; they are not designer commands and never require the viewer to impersonate an editing user.

Opening another workarea cancels the prior open's jobs, releases its attachments and resets target-specific navigation state. The first-opened file alone owns the active workarea. View and document navigation uses qualified identities; repeatable display labels cannot identify targets ambiguously.

## Workarea and view display

The open viewer supports multiple placed views on one spatial workarea, including areas outside the screen. It can expand one view temporarily to the viewport and restore the previous workarea camera/placement on exit. This expansion is session state. Moving around the workarea must not move authored view placements.

The scene includes local coordinates, placement transforms, clipping and the publication transform where relevant. Pointer inversion follows those matrices exactly. Placement and appearance identity must survive culling, re-entry, zoom, data refresh and links between views. A shared definition can have different view-specific appearance settings while retaining one semantic identity.

Visible views/items and their overscan are prioritized. Far-away views may show cached thumbnails or lightweight frames with a pending indicator. Placeholders must distinguish missing packs, unavailable data, failed layout and ordinary low-detail display. A placeholder is never a successful full rendering or verification result.

The workarea/view backgrounds, images, borders, grids, layers, notes, text, table columns and status icons follow the codex. Each applicable item shows its type and separate design-state indicator; a stale/invalid verification indicator remains distinct from the user-set state. The renderer never substitutes Accepted merely because verification passed.

## Navigation and inspection

Required controls are pan, zoom, fit workarea, fit selected view, expand/restore view, focus an item, follow internal references, previous/next navigation, search and a semantic outline. Keyboard navigation must reach visible and off-screen definitions through the outline without depending on all SVG nodes being mounted. Selecting an off-screen item reveals the corresponding appearance or offers its available appearances.

Inspection shows the title, type/profile, source-file identity, effective properties with their origin, full note/cell value, relations and applicable diagnostics. Fields hidden by a detail setting remain inspectable. Ellipsis never destroys text. A link to an external included file navigates through the loaded source map; it does not fetch an arbitrary URL implicitly.

A pointer gesture updates only session navigation/selection. Pointer capture is released on cancel, blur and destruction. Reduced motion and high-contrast preferences are session lenses that retain necessary symbol distinctions. Screen reader labels and keyboard focus must survive incremental scene patches.

## Verification behavior

Opening and receiving a source revision invokes the verifier for structural/profile checks needed to display that scope. Drafts with incomplete semantic information remain displayable. Syntax failure, unsafe references or missing capabilities yield precise diagnostics while preserving inspectable source and unaffected views.

The viewer can request complete review/publication checks, but cannot change status or record acceptance. Verification reports identify input revision, purpose, scope, coverage and the rules actually checked. Partial/paged/unavailable data never receives a full valid badge. Previously accepted content whose evidence is stale retains its stored Accepted state with the stale evidence indicator.

An explicitly unsupported profile is preserved and named in the view frame. A host can install its matching trusted pack and retry without reopening or rewriting the document. Never render a foreign profile as native DDN merely because their core element anchors overlap.

## Live data

Source adapters deliver coherent schema/row revisions. `replace` replaces a complete declared source revision; `keyed` needs stable keys and ordered applicable deltas. The viewer retains source identities and camera/focus across refresh. A schema change updates the available column menu/inspection metadata with the same revision as its rows.

For a view depending on multiple sources, publication and a completed displayed revision identify an explicit input revision vector. Pending work must not be shown as if all inputs were current. Superseded replacement updates may coalesce; skipped keyed deltas require a fresh authoritative snapshot. Failures retain the last good scene visibly marked stale, or the configured unavailable placeholder when no result exists.

The viewer can consume supplied live interaction for passive display. It must not expose participation actions, edit a session, cast a ballot or send a message merely because such data appears in a diagram.

## Preview and output

Temporary paint previews use the codex's viewer preview allowlist. A preview is separate from file defaults and never modifies source. Any future metrics-changing preview must use the normal measurement/layout pipeline and be explicitly registered; the initial public preview route is the existing paint-only contract.

`capture` produces a coherent read-only capture job. Initial local output includes SVG, PNG, Markdown, CSV and JSON when applicable; complex PDF, DOCX and ODT adapters are separately loadable. Browser Print is a convenience and is not represented as a deterministic PDF adapter. Dashboard is a live output view, not a raster format.

Output semantics follow the [publication contract](../../website/reference/index.html), with properties and defaults reconciled by the current codex. HTML/dashboard, paged document and tabular adapters retain their distinct output/fidelity obligations; registering a format string alone is not support.

Capture scope is explicit: full content, bounds or frozen viewport. Ordinary export does not silently take the current screen. It records source/profile/default/style/font/asset revisions and any preview lens explicitly included. Audience projection, partial/stale policy, font minima, full notes and table values follow the publication contract. Missing adapters return `unsupported`; no format substitution occurs.

## Failure and disposal

A missing image/font shows the configured placeholder and a diagnostic; required final publication metrics/assets can block publication without blocking navigation. Worker failure retries through the bounded fallback or returns a capability/resource result. Closing a view cannot discard source data or active designer text.

`destroy` is idempotent. It removes owned listeners, observers, keyboard handlers, accessible nodes and scene objects; cancels view jobs; and releases its runtime lease. Shared runtime caches may remain while another client holds a lease. No networking or telemetry is required for load, display, inspection or local capture.

## Acceptance scenarios

Required scenarios are registered as VW01–VW12 in `contracts/requirements.json`: offline first open, mixed/large workarea navigation, duplicate labels across files, progressive drafts, repeated occurrences, live coherent updates, stale verification, missing packs, keyboard inspection, full-content export, independent instances and complete disposal.
