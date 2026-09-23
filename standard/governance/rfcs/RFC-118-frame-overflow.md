# RFC 118 — `frame_overflow: expand | confine` for scoped frames

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive layout property; no registry or
grammar changes (layout properties are not enumerated by the EBNF); no new
diagnostic codes (invalid values are rejected by the existing DDN046
unsupported-choice check).

## Problem and motivating example

A view `frame` scopes members inside a boundary (wireframe `ui.frame` screens,
C4 container boundaries, group frames). Today the rendered frame rect and the
member placement disagree in two corners:

- A frame declared with `size` (with or without `at`) keeps its declared rect
  even when auto-placed members measure larger, so members render outside the
  boundary that claims to contain them.
- The only author workaround is manual `place` pins on every member — exactly
  what a scoped frame should make unnecessary. This was observed during corpus
  normalization on `website/examples/basics/55-wireframe.ddn` (logged in the
  runtime gap notes), where the pin set is only there to keep members inside
  their screen frame.

Motivating example: a settings-screen mock whose controls should simply stay
inside the screen frame, with no pins:

```ddn
view settings "Settings screen" {
    data: [@m];
    select: [@m.profile_label, @m.display_name, @m.save_button];
    projection { profile: "wireframe.ui@1"; }
    layout { algorithm: layered; direction: down; }
    frame settings_area "Settings" { scope: @m.settings; members: [@m.profile_label, @m.display_name, @m.save_button]; }
}
```

## Proposed syntax

One new view layout property (D1):

```ddn
layout { frame_overflow: expand; }   // or: confine
```

`frame_overflow` lives in the `layout` group alongside `endpoint_ordering`
and friends, is settable in profile declarations and view override groups, and
accepts exactly `expand` (default) or `confine`. Any other value fails with
DDN046 like every other enumerated layout choice.

## Semantic normalization and identity effects

None. The property is presentation-only; it changes frame geometry and, under
`confine`, auto-placement of unpinned members. It never mutates source pins,
element identity, or resolved references. Explicit `frame_overflow: expand`
is the default and normalizes away (the corpus normalizer strips it).

## Visual encoding and routing effects

- `expand` (default, D2): the rendered frame rect grows to enclose the union
  of its declared/computed rect and the member bounding box plus the standard
  frame padding (20 CSS px left/right, 54 top, 22 bottom — the same constants
  the renderer already uses for member-derived frames). When members already
  fit, the union is exactly the declared/computed rect, so existing renders
  are byte-identical (D4). Members never escape; nothing is hidden.
- `confine`: the frame keeps its declared (`at`/`size`) or member-computed
  rect. Members of a frame with a declared `at`+`size` rect are clamped into
  the frame's interior during placement — automatically achieving what manual
  pins did — instead of being allowed to drift outside. A member too large for
  the interior still fails (LIVE-P004), as today; confinement never resizes or
  hides content.

Routing is unaffected; routes already avoid frame rects as obstacles.

## Alternatives considered

- **Forced pins**: rejected — pins are view-state noise for a containment
  contract the frame already declares.
- **`clip` mode** (hide escaping members): out of scope by owner decision;
  hiding content conflicts with the no-silent-overflow principle.
- **Frame property instead of layout property**: rejected (D1) — overflow
  policy is a view layout concern, consistent with `endpoint_ordering`, and a
  per-frame property would splinter one policy across every frame block.

## Compatibility and migration

Fully backward compatible. `expand` is the default and reproduces current
geometry wherever members already fit: member-derived frames use identical
padding math, and declared rects that already enclose their members are the
union of themselves. The compatibility proof is byte-identical golden renders
across the shipped corpus, plus the previously pinned wireframe example now
rendering correctly with its pins removed.

## Security, privacy and accessibility

No new input channels. The clamp is a bounded arithmetic operation on measured
rectangles; placement search budgets (LIVE-P002) are unchanged. No content is
hidden in either mode, so accessibility is unaffected.

## Machine schema and diagnostic changes

`capabilities.json`: `layout.frame_overflow` added to the layout choices,
layout defaults (`"expand"`), the property contract list, and the
`implemented[]` summary. No new diagnostic codes; invalid values fail DDN046.

## Positive and negative fixtures

Positive: unpinned members of a scoped frame render inside it under the
default; `confine` with a declared rect clamps an unpinned member inside;
member-derived frames render byte-identical before/after.
Negative: `layout { frame_overflow: grow; }` fails DDN046.

## Implementation/conformance impact

Runtime only: `ddn-core.js` (CHOICES, DEFAULTS, layout property whitelist),
`ddn-render.js` (frame rect union under `expand`), `ddn-placement.js` /
`ddn-patterns.js` (member clamping under `confine`). Viewer, designer and
projections are otherwise unaffected.

## Open questions and decision record

- D1 property name/group: `layout.frame_overflow` — fixed.
- D2 semantics: `expand` grows, `confine` clamps; no `clip` — fixed.
- D3 governance surface: this RFC, spec chapter 15, capabilities.json,
  AI-REFERENCE — fixed.
- D4 compatibility: default `expand`, byte-identical goldens proof — fixed.
- D5 full surface: renderer + layout + normalizer default-strip — fixed.
