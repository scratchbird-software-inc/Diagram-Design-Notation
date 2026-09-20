# 41. Wireframe stencil profile (`wireframe.ui@1`)

Status: implemented in runtime 0.6.0-beta.1, governed by RFC-115
(`standard/governance/rfcs/RFC-115-wireframes.md`). Source grammar remains
DDN 0.5; the profile and its kinds are registry entries, so this chapter
is a semantic addition, not a grammar change.

Early UI sketches should be boxes and labels, not widget frameworks. The
profile runs on the existing `graph` projection. Users write
`projection { kind:graph; profile:"wireframe.ui@1"; }`. This is
profile-level notation coverage, not a UI-toolkit or UX certification.

## The stencil

Seven profile kinds, all family `interface`, fallback `application`, glyph
`object`:

- `ui.frame` (silhouette `rect`, code `UI_FRAME`) — a screen area.
- `ui.label` (`rect`, `UI_LABEL`) — a text label.
- `ui.input` (`rect`, `UI_INPUT`) — a text input box.
- `ui.button` (`round`, `UI_BUTTON`) — a button.
- `ui.image` (`rect`, `UI_IMAGE`) — an image placeholder; its content is
  the object's label text (no image fetching — the runtime never
  fetches).
- `ui.checkbox` (`rect`, `UI_CHECKBOX`) — a checkbox.
- `ui.list` (`rect`, `UI_LIST`) — a list; shows its label plus field rows
  when fields are declared.

No new verbs (links, if any, use the core `assoc` relation) and no
extension properties.

## Scoped-frame nesting

A screen area is a `ui.frame` object; nesting is a view `frame`
declaration whose `scope` references the `ui.frame` object and whose
`members` are the contained controls; controls are objects of the other
six `ui.*` kinds. A `ui.frame` may itself be a member of another
`ui.frame`'s frame (nested containers). This reuses the existing
view-frame scope/members machinery — the same matching the
`uml.usecase@2` validator applies — so no new normalization or identity
rule is introduced.

## The orphan-control warning (`DDN-PJ128`)

A selected control (any `ui.*` kind except `ui.frame`) that is not a
member of any view frame whose scope resolves to a `ui.frame` element
produces `DDN-PJ128` — a WARNING, not an error; the message names the
control and the view still renders normally. Sketches legitimately start
as loose boxes before being grouped; blocking render would hurt the
sketching workflow, while silence would hide a real organisational smell.

Warnings are ordinary diagnostics with `severity:'warning'`. They travel
in `ir.diagnostics` (the profile validator collects and returns them;
`build()` pushes them into the IR) and surface in two places: the CLI
`check` command prints them as the JSON `warnings` array
(`{status:'pass-core', …, warnings: ir.diagnostics}`), and the SDK
`renderSync` result carries them in its `diagnostics[]` array. Thrown
validation codes (for example `DDN-PJ003`) are unaffected and still abort
the render.

## Visual encoding: fixed classic + neutral pairing

The stencil is drawn as plain rect/round silhouettes in the CLASSIC look
with the NEUTRAL (grey) theme — the fixed pairing
`style { look:classic; theme:neutral; }` used by the example. NOT
handDrawn: the stencil is meant to read as clean low-fi boxes. The
control kind is the registered kind token (`UI_FRAME` … `UI_LIST`); in
the neutral theme the family fill still applies, and the grey intent is
the documented default, not a renderer-enforced rule (styles remain
view/format properties). No renderer change.

## Example

`examples/basics/55-wireframe.ddn` — a synthetic settings screen: a
`ui.frame` object `settings` framing a `ui.label` (Profile), a `ui.input`
(Display name), a `ui.checkbox` (Email notifications), a `ui.list`
(Timezone, with three field rows), a `ui.image` (Avatar) and a `ui.button`
(Save). `check` reports an empty `warnings` array for `DDN-PJ128`.
