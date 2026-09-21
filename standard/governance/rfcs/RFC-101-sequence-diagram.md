# RFC 101 — Sequence diagram projection (`kind:sequence`, profile `uml.sequence@1`)

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive; new projection kind sequence; profile uml.sequence@1; verb uml.message; extension x_return

## Problem and motivating example

DDN 0.5 ships nine projection kinds — graph, chen, matrix, panels, table, chart,
timeline, fishbone, decision — but has no ordered-interaction view. A
sequence-style view is the most requested diagram family in the gap analysis:
authors who can already declare participants and the messages between them have
no way to see those interactions ordered in time without falling back to a free
graph layout, which has no notion of "earlier/later" between messages.

Motivating example: a three-party synthetic order flow. A customer app submits
an order to checkout; checkout reserves stock against inventory and receives a
dashed return; checkout logs an audit record to itself (a self-message);
checkout confirms to the customer app. Today this can only be drawn as a graph,
losing the top-to-bottom ordering that is the entire point of the diagram.

## Proposed syntax

No grammar change. Projection kinds are atom property values
(`property = identifier ":" value ";"`); `kind:sequence;` parses today and is
rejected semantically by `DDN046`/`DDN-PJ001`. This RFC makes it valid:

- New projection kind token `sequence` in the semantic kind enum.
- New profile `uml.sequence@1` bound to projection `sequence`.
- New profile relationship verb `uml.message`:
  `{keyword:'uml.message', name:'Message', verb:'Message', family:'control',
    code:'MESSAGE', glyph:'link', start:'none', end:'open',
    source:['*'], target:['*'], allow_self:true, member_endpoints:false}`.
- New registered extension property `x_return` (boolean, relation target):
  marks a message as a dashed return.

No new projection properties: `sequence` accepts only the common block
(`kind`, `profile`, `width`, `height`).

```ddn
view sequence {
  data:[@m.flow];
  projection { kind:sequence; profile:"uml.sequence@1"; }
}
```

## Semantic normalization and identity effects

Normalization is declaration order — never geometry, never inference:

- **Participants** are the view's selected `object`-type elements,
  left-to-right in `ir.elements` declaration order.
- **Messages** are the view's visible relations of kind `uml.message`,
  top-to-bottom in `ir.relations` declaration order.
- A **self-message** is a `uml.message` from a participant to itself
  (`allow_self:true` on the verb).
- A **dashed return** is a `uml.message` carrying `x_return:true`.
- The **activation bar** on the receiver of message *i* spans from message
  *i*'s row to the row of the next message whose source is that participant,
  or the last row if none.

Element and relation identities are untouched; every mark carries its source
ids, so a message arrow remains traceable to the declared relation.

## Visual encoding and routing effects

Deterministic native SVG, derived only from the scale `s`, the theme, and
measured label widths:

- Equal participant spacing; a header box per participant at the top.
- A dashed vertical lifeline from each header to the bottom of the message
  area.
- Messages are horizontal arrows at descending y by declaration index, at a
  fixed row pitch, numbered, with the label above the arrow.
- Self-messages render as a small rectangular loop to the right of the
  lifeline.
- Returns render dashed with an open arrowhead.
- Activation bars are thin filled rectangles straddling the receiver's
  lifeline.
- A footer note states that ordering is declaration order, not a verified
  protocol.

All marks are registered through the shared `group()` helper with contributor
`sourceIds`. There is no routing: message arrows are straight horizontal lines
between lifelines.

## Alternatives considered

- **Reuse `kind:graph` with a layout algorithm** — rejected: lifeline
  semantics are order-bound, not free layout; a graph layout cannot express
  "messages descend in declaration order".
- **Extend the experimental `session-bootstrap@0.1` interaction lanes** —
  rejected: that profile is a fixed-lane protocol illustration with
  `DDN-I0xx` semantics, not a general sequence view.
- **Full UML 2.5 interaction metamodel** — rejected: out of scope (combined
  fragments, gates, creation/destruction, execution specifications).

## Compatibility and migration

Purely additive. No existing profile, kind, verb or property is edited.
`x_sequence` (interaction@0.1) is untouched. Sources that do not use
`kind:sequence`, `uml.message` or `x_return` are byte-for-byte unaffected;
the `tests/run.js` enrollment switch to the engine dispatcher routes graph
views through the identical code path (`ddn-engine.js` → `ddn-interaction.js`
→ `Base.render`) for views without `layout.x_interaction`.

## Security, privacy and accessibility

No new inputs: messages and participants are already-declared model elements.
Rendered text is escaped through the shared `esc()` helper. Marks carry
`data-source-ids` and `tabindex`/`role="group"` like every other projection
mark, so keyboard and assistive inspection work the same way. The diagram
makes no protocol-correctness claim; the footer says so.

## Machine schema and diagnostic changes

- `standard/registry/capabilities.json`: `sequence` added to
  `profiles.projection.kind[]`; `projectionProperties.sequence =
  ["kind","profile","width","height"]`; one `implemented[]` line appended;
  `installedProfiles[]` gains the `uml.sequence@1` entry.
- New error `DDN-PJ110` — a `uml.message` endpoint is not a selected
  `object` declaration. (Member endpoints already fail earlier with `DDN102`
  because `member_endpoints:false`; this code covers non-object element types
  such as samples/domains/flows used as endpoints.) The message names the
  relation and the offending endpoint.
- New warning diagnostic `DDN-PJW03` (severity `warning`, not thrown) — a
  selected participant has no incident messages; the diagram still renders.
- Existing codes unchanged: unknown kind → `DDN-PJ001`; unknown property →
  `DDN-PJ005`; page/extent guards `DDN-PJ060/061`; Vega-Lite export of a
  sequence view → `DDN-PJ070`; graph geometry in a sequence view → `DDN-PJ002`.

## Positive and negative fixtures

- Positive example: `website/examples/basics/41-sequence-diagram.ddn` (three-party
  order flow: reservation, dashed return, self-message).
- Test suite: `notation/tests/sequence-diagram.js` — positive render,
  geometry/order invariants, dashed return, self-message loop, `DDN-PJ110`,
  `DDN-PJ005`/`DDN-PJ001`/`DDN-PJ002`, `DDN-PJ070`, `DDN-PJW03`, and
  byte-identical determinism.

## Implementation/conformance impact

Touch points: `ddn-core.js` (`CHOICES.projection.kind`),
`ddn-projection-data.js` (`supported` map + planning branch),
`ddn-projections.js` (renderer branch), `capabilities.json` (kind list +
projection properties), `ddn-profiles.js`/`extensions.json` (`x_return`
contract), profile catalogue (`uml.message` verb + `uml.sequence@1` profile).
The engine dispatcher needs no edit: non-graph kinds already route to
`ddn-projections.js`. `tests/run.js` switches its numbered-example render call
to the dispatcher so non-graph examples are exercised.

This is profile-level coverage, not UML conformance.

## Open questions and decision record

- D1 motivation, D2 vocabulary, D3 metamodel, D4 rejection behavior, D5
  layout/geometry, D6 alternatives, D7 compatibility: recorded above as fixed
  decisions of this RFC.
- Open: whether a later RFC adds combined fragments (alt/loop/opt) behind a
  new profile version; explicitly unsupported in `uml.sequence@1`.
