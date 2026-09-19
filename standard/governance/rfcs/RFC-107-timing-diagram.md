# RFC 107 — Timing diagram projection (`kind:timing`, profile `uml.timing@1`)

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive; new projection kind timing; profile uml.timing@1; extension x_states

## Problem and motivating example

DDN 0.5 ships ten projection kinds — graph, chen, matrix, panels, table,
chart, timeline, fishbone, decision, sequence — but has no state-over-time
view. The date-interval timeline (`kind:timeline`, `timeline.basic@1`) shows
spans between UTC dates; it cannot express a digital-signal-style picture in
which a participant occupies one named state at a time and steps between
states at declared time points.

Motivating example: a synthetic traffic-light controller and its pedestrian
signal over 60 seconds. The controller is `red` from 0, `green` from 25,
`amber` from 55; the pedestrian signal is `wait` from 0, `walk` from 25,
`wait` again from 45. Today this can only be drawn as a graph or a timeline
of artificial one-day spans, losing the plateau-step reading that is the
entire point of the diagram.

## Proposed syntax

No grammar change. Projection kinds are atom property values
(`property = identifier ":" value ";"`); `kind:timing;` parses today and is
rejected semantically by `DDN046`/`DDN-PJ001`. This RFC makes it valid:

- New projection kind token `timing` in the semantic kind enum.
- New profile `uml.timing@1` bound to projection `timing`.
- New registered extension property `x_states` (array, object target). Each
  entry is `{ at: <finite number>, state: <nonempty string> }`, interpreted
  as "from `at` onward the participant is in `state` until the next entry".

No new kinds or verbs. No new projection properties: `timing` accepts only
the common block (`kind`, `profile`, `width`, `height`).

```ddn
data traffic {
    object controller "Controller" {
        kind: application;
        x_states: [{ at: 0, state: "red" }, { at: 25, state: "green" }, { at: 55, state: "amber" }];
    }
}

view timing {
    data: [@traffic];
    projection { kind: timing; profile: "uml.timing@1"; }
}
```

## Semantic normalization and identity effects

Normalization is declaration order plus declared time points — never
geometry, never simulation, never invented times:

- **Participants** are the view's selected `object`-type elements in
  `ir.elements` declaration order (the identical rule and helper as
  RFC-101's sequence projection).
- Every participant must carry `x_states` with at least one entry; entries
  must be well-formed (`at` a finite number, `state` a nonempty string) and
  in strictly ascending `at` order.
- Time is an abstract numeric axis in the author's unit; the unit belongs in
  the view label or a footer note. There is no unit conversion.
- A state plateau runs from its `at` to the next entry's `at`; the last
  state runs to the axis maximum (the greatest declared `at`).

Element identities are untouched; every mark carries its source ids, so a
plateau band remains traceable to the declared participant.

## Visual encoding and routing effects

Deterministic native SVG, derived only from the scale `s`, the theme,
measured label widths, and the declared time points:

- One horizontal band per participant, declaration order top to bottom;
  participant names at the left.
- Within a band, states are plateau levels indexed by first-appearance order
  per participant (first state = top plateau); steps are vertical
  transitions at each `at`.
- The time axis runs along the bottom with min/max ticks taken from the
  data.
- Plateau state labels sit on each segment.
- A footer note states that the diagram shows supplied time points, not a
  simulation.

All marks are registered through the shared `group()` helper with
`sourceIds`. There is no routing; there is no clock or randomness anywhere
in the layout or render path.

## Alternatives considered

- **Reuse `kind:timeline` with zero-width intervals** — rejected: plateaus
  are value steps, not date spans; the timeline's UTC-date validation would
  be wrong for an abstract numeric axis.
- **Derive states from relations** (transition edges between state nodes) —
  rejected: states are record data carried by the participant, not a
  relational structure.
- **Full UML 2.5 timing diagram** — rejected: out of scope (duration and
  slew-rate annotations, clock/unit conversion, full UML conformance).

## Compatibility and migration

Purely additive. No existing profile, kind, verb or property is edited.
`timeline.basic@1` is untouched, including the "UML timing" entry in its
`unsupported` list — that entry stays true for `timeline.basic@1` because
this RFC ships a new kind and profile rather than editing the immutable
published profile. Sources that do not use `kind:timing` or `x_states` are
byte-for-byte unaffected.

## Security, privacy and accessibility

No new inputs: participants are already-declared model elements and
`x_states` is author-supplied record data. Rendered text is escaped through
the shared `esc()` helper. Marks carry `data-source-ids` and
`tabindex`/`role="group"` like every other projection mark, so keyboard and
assistive inspection work the same way. The diagram makes no simulation or
conformance claim; the footer says so.

## Machine schema and diagnostic changes

- `standard/registry/capabilities.json`: `timing` added to
  `profiles.projection.kind[]`; `projectionProperties.timing =
  ["kind","profile","width","height"]`; one `implemented[]` line appended;
  `installedProfiles[]` gains the `uml.timing@1` entry (60 after this RFC).
- `standard/registry/profiles/catalogue.json` `profiles[]` gains
  `uml.timing@1`.
- `ddn-profiles.js` `registry()` and `standard/registry/extensions.json`
  gain the `x_states` contract: `{ "type": "array" }` on the `object`
  target (element content is validated by the planner, not the schema
  subset).
- New error `DDN-PJ118` — a participant lacks `x_states`, or an entry is
  malformed (`at` not a finite number / `state` not a nonempty string), or
  entries are not in strictly ascending `at` order. The message names the
  participant and the offending entry/index. (Verified free: PJ110–PJ117
  and PJW03 were taken by RT-101…106.)
- Existing codes unchanged: unknown kind → `DDN-PJ001`; unknown projection
  property → `DDN-PJ005`; width/height guards → `DDN-PJ006`; graph geometry
  in a data-bound view → `DDN-PJ002`; Vega-Lite export of a timing view →
  `DDN-PJ070`.

## Positive and negative fixtures

- Positive example: `examples/basics/47-timing-diagram.ddn` (synthetic
  traffic-light controller and pedestrian signal over 60 seconds).
- Test suite: `notation/tests/timing-diagram.js` — positive render,
  geometry/order invariants (step x positions proportional to `at`),
  `DDN-PJ118` for all three failure modes (descending `at`, non-number
  `at`, missing `x_states`), `DDN-PJ005`/`DDN-PJ002`/`DDN-PJ070`, the
  RT-101 sequence regression (same participant helper), and byte-identical
  determinism.

## Implementation/conformance impact

Touch points: `ddn-core.js` (`CHOICES.projection.kind`),
`ddn-projection-data.js` (`supported` map + planning branch reusing the
RT-101 `participants` helper), `ddn-projections.js` (renderer branch),
`capabilities.json` (kind list + projection properties + installed
profiles), `ddn-profiles.js`/`extensions.json` (`x_states` contract),
profile catalogue (`uml.timing@1` profile). The engine dispatcher needs no
edit: non-graph kinds already route to `ddn-projections.js`.

This is profile-level coverage, not UML conformance.

## Open questions and decision record

- D1 motivation, D2 vocabulary, D3 metamodel, D4 rejection behavior, D5
  visual encoding, D6 alternatives, D7 compatibility: recorded above as
  fixed decisions of this RFC.
- Open: whether a later RFC adds duration/slew-rate annotations behind a
  new profile version; explicitly unsupported in `uml.timing@1`.
