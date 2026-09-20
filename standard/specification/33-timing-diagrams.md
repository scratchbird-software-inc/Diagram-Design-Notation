# 33. Timing diagrams (projection `timing`, profile `uml.timing@1`)

Status: implemented in runtime 0.6.0-beta.1, governed by RFC-107
(`standard/governance/rfcs/RFC-107-timing-diagram.md`). Source grammar remains
DDN 0.5; projection kinds are atom property values, so `kind:timing;` is a
semantic addition, not a grammar change.

A timing view projects the selected part of one semantic model into a
state-over-time diagram: one horizontal band per participant, with state
changes drawn as plateau steps along a numeric time axis. Records carry their
own time points (`x_states`); the renderer never invents times.

This is profile-level coverage, not UML conformance.

## Metamodel

- **Participants** are the view's selected `object`-type elements, drawn
  top-to-bottom in `ir.elements` declaration order — the identical rule and
  shared helper (`participants(ir, shown)` in `ddn-projection-data.js`) as the
  sequence projection (chapter 27).
- Every participant must carry the registered extension property `x_states`
  (array, object target) with at least one entry. Each entry is
  `{ at: <finite number>, state: <nonempty string> }`, interpreted as "from
  `at` onward the participant is in `state` until the next entry". The last
  state runs to the axis maximum (the greatest declared `at`).
- **Chronology rule:** within one participant, entries must be in strictly
  ascending `at` order.
- Time is an abstract numeric axis in the author's unit; the unit belongs in
  the view label or a footer note. There is no unit conversion.

## Source example

```ddn
data signals {
    object controller "Controller" { kind: application;
        x_states: [{at: 0, state: "red"}, {at: 25, state: "green"}, {at: 55, state: "amber"}];
    }
}

view timing "Synthetic traffic lights / timing (seconds)" {
    data: [@signals];
    projection { kind: timing; profile: "uml.timing@1"; }
}
```

See `examples/basics/47-timing-diagram.ddn` for the full runnable example.

## Visual encoding

Deterministic native SVG, derived only from the scale, the theme, measured
label widths, and the declared time points:

- One band per participant, declaration order top to bottom; participant
  names at the left.
- Within a band, states are plateau levels indexed by first-appearance order
  per participant (first state = top plateau); steps are vertical transitions
  at each `at`. A repeated state returns to its original plateau level.
- The time axis runs along the bottom with min/max ticks taken from the data.
- Plateau state labels sit on each segment; every segment mark carries
  `data-source-ids` and `data-property="x_states"`.
- A footer note states that the diagram shows supplied time points, not a
  simulation.

## Validation

- `DDN-PJ118` (error) — a participant lacks `x_states`, or an entry is
  malformed (`at` not a finite number / `state` not a nonempty string), or
  entries are not in strictly ascending `at` order. The message names the
  participant and the offending entry/index.
- Existing guards apply unchanged: unknown projection property →
  `DDN-PJ005`; width/height guards → `DDN-PJ006`; graph geometry (`place`,
  `route`) in a timing view → `DDN-PJ002`; Vega-Lite export → `DDN-PJ070`.

## Relationship to `timeline.basic@1`

`timeline.basic@1` is an immutable published profile and is unchanged by this
chapter — including the "UML timing" entry in its `unsupported` list, which
remains true for the date-interval timeline. Timing coverage arrives as a new
projection kind and profile, not as an edit to the old profile. The timeline
shows UTC date spans; the timing projection shows value steps on an abstract
numeric axis. Neither claims duration/slew-rate annotations, clock/unit
conversion, or full UML conformance.
