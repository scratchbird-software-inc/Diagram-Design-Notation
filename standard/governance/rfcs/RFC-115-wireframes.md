# RFC 115 — Wireframe stencil profile (`wireframe.ui@1`)

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive; profile wireframe.ui@1; kinds ui.* (7); warning DDN-PJ128

## Problem and motivating example

Early UI sketches should be boxes and labels, not widget frameworks (D1).
The existing `graph` projection draws nodes and links, and view frames
already group members around a scoped element — but nothing expresses a
low-fidelity screen area with contained controls as a fixed, documented
stencil.

Motivating example: a synthetic settings screen with a profile section, a
notifications checkbox and a save button. Users write
`projection { kind:graph; profile:"wireframe.ui@1"; }`. This is
profile-level notation coverage, not a UI-toolkit or UX certification.

## Proposed syntax

No grammar change (D2, verified: profiles and kinds are registry entries;
`standard/grammar/ddn.ebnf` is untouched).

- One new profile `wireframe.ui@1` bound to the existing projection
  `kind:graph`.
- Seven new profile kinds (all family `interface`, fallback `application`,
  glyph `object`):
  - `ui.frame` (silhouette `rect`, code `UI_FRAME`),
  - `ui.label` (`rect`, `UI_LABEL`),
  - `ui.input` (`rect`, `UI_INPUT`),
  - `ui.button` (`round`, `UI_BUTTON`),
  - `ui.image` (`rect`, `UI_IMAGE`),
  - `ui.checkbox` (`rect`, `UI_CHECKBOX`),
  - `ui.list` (`rect`, `UI_LIST`).
- No new verbs: links, if any, use the core `assoc` relation.
- No extension properties.

```ddn
data m {
    object settings "Settings" { kind: "ui.frame"; }
    object profile_label "Profile" { kind: "ui.label"; }
    object display_name "Display name" { kind: "ui.input"; }
    object save_button "Save" { kind: "ui.button"; }
}
view settings "Settings" {
    data: [@m];
    projection { kind: graph; profile: "wireframe.ui@1"; }
    style { look: classic; theme: neutral; }
    frame settings_area "Settings" {
        scope: @m.settings;
        members: [@m.profile_label, @m.display_name, @m.save_button];
    }
}
```

## Semantic normalization and identity effects

A screen area = a `ui.frame` object; nesting = a view `frame` declaration
whose `scope` references the `ui.frame` object and whose `members` are the
contained controls; controls = objects of the other six `ui.*` kinds; a
`ui.frame` may itself be a member of another `ui.frame`'s frame (nested
containers) (D3). Frames are the existing view-level machinery — the same
scope/member matching the `uml.usecase@2` validator already uses
(`DDN-PX006` block) — so no new normalization or identity rule is
introduced.

Rejection behavior (D4):

- `DDN-PJ128` (NEW, **warning**, not thrown) — a selected control (any
  `ui.*` kind except `ui.frame`) that is not a member of any view frame
  whose scope resolves to a `ui.frame` element. Emitted as a
  `severity:'warning'` diagnostic; the view still renders normally. The
  message names the control.

Rationale for warning severity: sketches legitimately start as loose boxes
before being grouped; blocking render would hurt the sketching workflow,
while silence would hide a real organisational smell.

Surfacing (verified): `Profiles.validate()` previously ended in
`return []`; it now returns a collected `diagnostics` array (mirroring
`Contracts.validate`'s `warn()` shape), and `build()` already pushes it
into `ir.diagnostics` (`ddn-core.js`,
`ir.diagnostics.push(...Profiles.validate(...))`). The CLI `check` command
prints those as the JSON `warnings` array
(`{status:'pass-core', …, warnings: ir.diagnostics}`); the SDK `renderSync`
result carries them in `diagnostics[]`. The existing `fail()` thrown paths
in `validate()` are unchanged.

Verified free before allocation:
`grep -rhoE "DDN-PJ128" notation/ standard/ examples/` prints nothing.

## Visual encoding and routing effects

Plain rect/round silhouettes in the CLASSIC look with the NEUTRAL (grey)
theme — the fixed pairing `style { look:classic; theme:neutral; }` used by
the example and documented in the spec chapter (D5; NOT handDrawn: the
stencil is meant to read as clean low-fi boxes). Control kind is shown as
the existing kind token; `ui.image` content = the object's label text (no
image fetching — the runtime never fetches); `ui.list` shows its label
plus field rows when fields are declared. No renderer change; routing is
unchanged (core `assoc` edges only).

## Alternatives considered

- handDrawn low-fi default (D6) — rejected: the pairing is fixed as
  classic+neutral per the brief; handDrawn remains available as an
  ordinary style override.
- New `ui.*` silhouettes in the renderer (D6) — rejected: rect variants
  suffice for low-fi.
- Error severity for orphan controls (D6) — rejected per the D4 rationale.
- A panels-projection variant (D6) — rejected: wireframes need free
  nesting; panels are span grids.

## Compatibility and migration

Additive only (D7): no existing profile, kind, verb, code, glyph or
capability line changes meaning. Published profiles are untouched. The
`validate()` change converts only the previously constant `return []` into
a returned (still usually empty) diagnostics array; no thrown path is
altered, and `build()` already spread-pushes the result, so consumers see
no behavioural difference beyond the new warning.

## Security, privacy and accessibility

The new check is set membership over `ir.view.frames` and the selected
element set — bounded, pure, no I/O, no dynamic code. No artwork is added:
the stencil reuses existing `rect`/`round` silhouettes and the registered
`object` glyph, so no copied icons, fonts or images are introduced.
`ui.image` renders label text only; the runtime never fetches external
images. Control names remain visible text, so meaning survives monochrome
rendering and text extraction.

## Machine schema and diagnostic changes

- `standard/registry/profiles/catalogue.json` — `kinds[]` gains the seven
  kinds; `profiles[]` gains `wireframe.ui@1`.
- `notation/runtime/ddn-profiles.js` `validate()` — introduces a collected
  `diagnostics` array (replacing the final `return []`) and a
  `wireframe.ui@1` block that pushes `DDN-PJ128` warnings.
- `standard/registry/capabilities.json` — `implemented[]` gains the
  wireframe line; `installedProfiles` +1.
- New diagnostic: `DDN-PJ128` (warning — control declared outside any
  `ui.frame`).

## Positive and negative fixtures

- Positive: `examples/basics/55-wireframe.ddn` — the `settings` view
  renders the grey settings mock: frame, label, input, checkbox, list,
  image and button inside the scoped frame; `check` reports no PJ128
  warning.
- Negative (warning, not error): a selected `ui.*` control that is not a
  member of any `ui.frame`-scoped view frame → `DDN-PJ128`
  `severity:'warning'` diagnostic, and the render still succeeds.

## Implementation/conformance impact

- `notation/runtime/ddn-profiles.js` — `validate()` diagnostics collection
  plus the `wireframe.ui@1` orphan-control warning block.
- Suite `notation/tests/wireframes.js` (`test:wireframes`) covers the
  fixtures above plus nesting, nested frames, warning-vs-thrown contrast
  and determinism.
- `npm --prefix notation run build:sdk` rebuilds `notation/dist/`.

## Open questions and decision record

Fixed decisions (recorded, not open): D1 motivation; D2 vocabulary
(profile `wireframe.ui@1` on `graph`; seven `ui.*` kinds, family
`interface`, fallback `application`, glyph `object`; no verbs, no
extensions, no grammar change); D3 scoped-frame nesting semantics
(including nested `ui.frame` containers); D4 rejection behavior
(`DDN-PJ128` as a warning, with severity rationale); D5 visual encoding
(fixed classic+neutral pairing, kind tokens, label-only `ui.image`,
field rows on `ui.list`); D6 alternatives rejected; D7 compatibility
(additive only). Responsive behavior, real widget toolkit export,
pixel-exact mockup fidelity and image fetching remain on the profile's
`unsupported` list.
