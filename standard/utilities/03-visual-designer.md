# DDN visual designer specification

## Responsibility and composition

The visual designer adds editing to the standard viewer. It reuses its runtime, scene, coordinates, hit targets, navigation and inspection. The same verifier checks commands and review eligibility. The designer must not fork the viewer's render pipeline or implement a second interpretation of properties/defaults.

`createDesigner(viewer, options)` attaches a command controller, palette, context menus, property editor and editing overlays. The host chooses the UI shell or supplies its own. Detaching the designer returns the viewer to read-only operation without replacing the runtime or losing the workarea camera.

The native experience supports design before all information is known. Other methods retain their own admitted roles, symbols, connection rules and completion criteria. A method/subtype selection configures palette and commands; merely changing a shape's look cannot change its semantic type.

## Required editing surfaces

| Surface | Required behavior |
|---|---|
| Workarea navigator | Add/place views and output document views; move/resize placements; expand a view to the viewport; show off-screen areas |
| Palette | Method/profile-filtered creation, search and explicitly available context roles; load only needed editor descriptors |
| Object editor | Edit title, notes, freeform draft body, structured fields/data, selected details and role-specific properties |
| Connection tool | Choose a permitted relation or subtype default; resolve endpoints/members, qualifiers and occurrence routing separately |
| Property inspector | Show inherited effective values and their origin; distinguish “set here” from “reset to omission”; use typed controls |
| Data editor | Local header-driven columns, one physical source row per record, empty slots, typed values and explicit source binding |
| Source pane | Lossless current source, linked selection/diagnostics and safe edits through the same transaction service |
| Review controls | Explicit user-set status, complete verification, acceptance attribution and authorized reopening |

An unset property is displayed as inherited/undecided rather than serialized as an invented value. Choosing a font for entity names creates the selected scoped typography setting, with its actual scope shown. It must not silently change every unrelated method or copy inherited settings onto all entities.

## Native ERD design workflow

1. Create a DDN workarea and an ERD view; expand that view without changing its stored placement size.
2. Set the view to Draft and choose handdrawn independently. A first entity placed without an explicit location is centered in the current view viewport. Subsequent placement follows the selected layout/gesture.
3. An unnamed entity displays `<table>` and has a generated identity. Double-click edits its title. The name/reference policy stays file-unique; repeated display labels do not collide.
4. The context menu provides Draft, Columns, Column Detail, Comments, Constraints and Delete where the selected entity contract permits them. Draft here selects the body editor; design status has its own state action.
5. Draft body input is a native multiline text control. Columns conversion is explicit and shows the resulting interpretation. A field-list has no header; an explicit table draft uses its first row as column names. Preserve original draft text in the conversion record and never drop a first field by guessing that it is a header.
6. Column Detail is built from the current local data header/schema. Native ERD fields may use field/type/domain/constraint/key/comment; custom data headers replace that list. Displayed field/domain/key columns can contain empty values.
7. Entering a provisional domain name creates or selects the proper reusable domain identity under file naming rules. The designer must not invent a physical datatype for it.
8. Wrapping, alignment, percentages, character minima, line caps, ellipsis and the unfit-table indicator follow the language codex. Turning details off changes appearance, not the data.

Changing body mode or converting rows does not silently promote design status. The one-way exit from Draft occurs only through the explicit lifecycle command. Accepted/reviewed shared scopes enforce their reopening policy before protected changes.

## Commands and atomicity

Every model edit is an intent prepared against a base revision. Commands include create/remove definition, create/remove occurrence, rename reference name, change display title, set/reset property, edit/reorder data rows or columns, convert draft body, connect/reconnect, assign a member, move/resize placements, change selected layout, add document content, bind data, and request status transition.

Preparation resolves IDs and target files, computes source edits and affected semantic records, verifies supplied values/role legality, identifies dependent protected scopes and returns a preview/change summary. The UI can use immediate simple-command commits, but they still cross the same atomic boundary. More consequential conversions/deletions expose the actual affected references in the preview. A deletion that leaves unresolved references must explicitly retain them as draft diagnostics or update/remove them in the same command; it cannot silently retarget them.

Commit checks the base revision and authority again, applies one atomic transaction and returns one receipt. Conflicts require re-preparation; there is no last-write-wins fallback. Commands cannot mutate active-workarea identity by editing an included file's workarea. A cross-file command commits its in-memory file set atomically. Browser downloads are not an atomic filesystem transaction: a multi-file save returns an explicit bundle/download set and reports individual failures.

Visual commands preserve stable definition/appearance identities. Moving an appearance does not move every occurrence. Changing shared content updates its dependent appearances. Changing an occurrence title/style does not rename its target. Source serialization preserves untouched text, omitted defaults, raw notes, empty versus absent cells and declaring-file ownership.

## Interaction and previews

During drag/resize, draw a lightweight scene overlay and incident connector preview. Do not run full parsing, validation or graph routing on every pointermove. Coalesce gesture updates to animation frames and commit one command on release. Cancel/Escape restores the prior committed scene and adds no undo entry. Keyboard movement uses the same final command.

A placement preview can be geometrically provisional. Committing runs the required constraint checks; infeasible routing or fixed bounds are shown explicitly. Unrelated pinned items cannot move to make a local command appear to succeed. Reconnection offers only permitted endpoints or explains why an endpoint is unavailable.

Native text editors support IME composition, caret movement, selection and clipboard operations. A model refresh must not replace an active editor or lose composing text. If its target changed remotely through an optional provider, preserve the local draft and require reconciliation before commit. Pointer hit testing and text editing do not depend on SVG element indexes.

## Undo, saving and recovery

Undo/redo records atomic command inverses or source patches and the minimum required prior values, not a screenshot or a full workspace clone for each keystroke. Default coalescing groups one text-edit session or gesture. History has a configurable 32 MiB/200-command budget; trimming creates a visible checkpoint and never removes unsaved current source. This is a tool resource default, not a change to language defaults.

Undo and redo use current authority, base revisions and verification gates. Lifecycle commands are audit events outside ordinary inverse-edit history: undo must not return In-progress to Draft or undo acceptance without the authorized reopening path. An explicit source edit of lifecycle properties is subject to those same live transition rules. A standalone imported file cannot prove an unrecorded historical transition; the verifier reports its current information and provenance.

Dirty state tracks source changes separately from session cameras/previews. Save downloads exact changed sources or a portable package with the entry file and included files/assets. File input and Blob downloads are the baseline; direct filesystem access and IndexedDB recovery are optional adapters. Storage failure leaves the document dirty with recovery/export available. Browser cache storage is never the only copy promised to the user.

## Review and acceptance

Draft allows freeform content. In-progress allows incomplete information. Entering In-review requires a complete current successful report for the selected purpose/scope. Accepted additionally records the time/user through the configured local or host principal. Standalone local attribution is explicitly local, not a claim of external authentication. No account or server is required to use the open designer.

Protected semantic changes require reopening affected scopes. Accepted can return to In-review or In-progress only through the authorized command. Pure presentation changes follow the codex acceptance-scope policy. A passing check does not automatically set status; an AI suggestion is a proposed command, never an accepted change. Stale data invalidates evidence separately from the stored status.

## Descriptor and extension contract

Editors are data-driven by compiled codex descriptors plus a small set of widgets and profile-specific command adapters. Descriptor IDs reference real owner/property/role IDs; defaults are read from the resolver. An unsupported specialized editor exposes typed properties and source navigation, preserving all data. It must not force a foreign type into an ERD editor.

For every retained profile, the routing manifest identifies its rule, renderer and editor family, inherited geometry editor, allowed palette, metadata contract and catalogue references. Shared families reduce duplication; they do not merge semantic rules. Every profile's existing bounded functionality remains an acceptance obligation.

## Acceptance scenarios

DS01–DS15 cover the native ERD story, method limits, occurrence versus definition edits, conversion/undo, dynamic data bindings, atomic multi-file changes, source preservation, stale preparations, IME input, gestures, lifecycle, history limits, recovery, descriptor coverage and attaching/detaching the editor.
