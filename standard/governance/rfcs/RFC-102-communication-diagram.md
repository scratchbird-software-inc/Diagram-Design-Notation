# RFC 102 — Communication diagram profile (`uml.communication@1` on `kind:graph`)

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive; profile uml.communication@1; extension x_message

## Problem and motivating example

RFC 101 / RT-101 delivered the sequence view (`kind:sequence`, `uml.sequence@1`):
participants as lifelines, messages ordered top-to-bottom in declaration order.
That view emphasizes *time*. The complementary interaction view — the
communication/collaboration diagram — emphasizes *structure*: which participants
are connected to which, with messages shown as numbered labels on the links
between them. Authors who declare the same participants and `uml.message`
relations today have no way to see that structural view without losing the
message ordering entirely (a plain graph edge label carries only the relation
name).

Motivating example: the RT-101 synthetic three-party order flow (customer app →
checkout → inventory, with a dashed return and a self-message) re-rendered as a
graph layout where every message edge is labelled with its declared sequence
number — `1 · Submit order`, `2 · Reserve stock`, `2.1 · Stock reserved` — so
the reader sees both the connection topology and the interaction order.

## Proposed syntax

No grammar change. Profiles and extension properties are atom/record property
values (`property = identifier ":" value ";"`); everything below parses today.

- New profile `uml.communication@1` bound to the existing projection
  `kind:graph`. No new projection kind: a communication view is a graph-shaped
  view, and the projection SDK already covers it.
- New registered extension property `x_message` on relations:

  ```json
  { "type": "object", "required": ["seq"],
    "properties": { "seq": { "type": "string", "minLength": 1 } },
    "additionalProperties": false }
  ```

- No new verbs: the profile reuses `uml.message` and `x_return` from RFC 101
  unchanged.
- No new projection properties: the graph projection block is untouched.

```ddn
relation reserve_stock "Reserve stock" @checkout -> @inventory
    { kind: "uml.message"; x_message: { seq: "2"; }; }
relation reserve_stock_reply "Stock reserved" @inventory -> @checkout
    { kind: "uml.message"; x_return: true; x_message: { seq: "2.1" }; }

view communication "Synthetic order flow / communication" {
    data: [@flow];
    projection { kind: graph; profile: "uml.communication@1"; }
    layout { algorithm: layered; }
}
```

### Declared numbering rule

The sequence number is **author-declared** as `x_message: { seq: "2.1" }` —
numbers are data, not derived. Convention:

- Top-level messages are numbered `1`, `2`, `3`, … in declaration order by
  convention (the author writes the numbers; the tool checks shape, not
  sequence).
- A reply (`x_return: true`) is dotted under its request: request `2`, reply
  `2.1` (second reply `2.2`, and so on).

Rationale: derived numbering would make the rejection behavior below
unreachable — a tool that computes numbers from declaration order can never
report "message with no sequence number", and would silently renumber when the
author reorders declarations. Declared numbers keep the author in control and
keep the validator honest. This refines the original workplan brief, which
mandated both derived numbering and a missing-number error.

## Semantic normalization and identity effects

None. The communication view is an ordinary graph projection: the same
elements, the same relations, the same visibility rules. Message numbers are
display metadata carried on the relation; element and relation identities are
untouched and every rendered edge remains traceable to the declared relation
(`data-id` / `data-source-ids` as on any graph edge).

## Visual encoding and routing effects

Ordinary graph rendering. Before render, the engine dispatcher relabels each
visible `uml.message` relation from `name` to `"<seq> · <name>"` (mirroring the
existing `state.flat@1` branch in `ddn-engine.js`, which rewrites relation
names from `x_transition` before render). Edge labels already come from
`r.name` in the renderer (`labelMeasure` in `ddn-render.js`), so no renderer
change is needed once names carry the numbers. Layout is the author's choice;
the reference example uses `layout { algorithm: layered; }`. Returns keep their
usual graph styling; the dotted number (not a dashed line) is what marks the
reply in this view.

## Alternatives considered

- **Derive numbers from declaration order** — rejected (see "Declared
  numbering rule"): makes the missing-number error unreachable and silently
  renumbers on reorder.
- **A new projection kind `communication`** — rejected: the view is
  graph-shaped; the graph projection and its layout algorithms already express
  it. A new kind would duplicate the entire graph pipeline for a relabel.
- **Legend-number callouts** (`legend.mode:numbers`) — rejected: that is a
  page-wide legend system with its own `DDN061` completeness rule and numbered
  marker glyphs, unrelated to per-message ordering on the edges themselves.

## Compatibility and migration

Purely additive. No existing profile, kind, verb, or property is edited.
`uml.sequence@1` rendering is unaffected (the sequence renderer draws its own
numbered labels from declaration order and never reads `x_message`). Sources
that do not use `uml.communication@1` or `x_message` are byte-for-byte
unaffected; unregistered `x_*` properties continue to parse freely and warn
`DDN-W103` only when `validation.unknown_extensions` is enabled, and
registration of `x_message` removes that warning for conforming sources.

## Security, privacy and accessibility

No new inputs: messages, participants and numbers are already-declared model
data. Rendered text is escaped through the shared `esc()` helper like every
other graph edge label. Edges keep `data-id`/`data-source-ids` and the existing
keyboard/assistive inspection path. The diagram makes no protocol-correctness
claim: numbers are author-declared and are validated for shape only.

## Machine schema and diagnostic changes

- `standard/registry/profiles/catalogue.json`: new `profiles[]` entry
  `uml.communication@1` (projection `graph`). Additive only; published profiles
  are immutable.
- `notation/runtime/ddn-profiles.js` `registry()` and
  `standard/registry/extensions.json` `contracts{}`: register `x_message` with
  the schema above, target `relation`.
- `standard/registry/capabilities.json`: one `implemented[]` line appended;
  `installedProfiles[]` gains the `uml.communication@1` entry (list mirrors the
  profile catalogue). No `profiles.projection.kind` change — the projection
  stays `graph`.
- New error `DDN-PJ111` — under `uml.communication@1`, a visible `uml.message`
  relation:
  1. lacks `x_message.seq`, or
  2. carries a `seq` that does not match `/^\d+(\.\d+)*$/`, or
  3. breaks the reply convention: a reply (`x_return: true`) carries an
     undotted `seq`, or a non-reply carries a dotted `seq`.

  The message names the relation and the rule broken. The code lives in the
  additive profile-completion validator `ddn-profile-quality.js`; code series
  do not have to match file names (the PJ series already spans several files).
- Existing codes unchanged: `DDN-PJ110` still guards `uml.message` endpoint
  kinds on the sequence projection; `DDN-W103` still warns on unregistered
  extensions.

## Positive and negative fixtures

- Positive example: `examples/basics/42-communication-diagram.ddn` — the RT-101
  three-party order flow as a layered graph with declared numbers `1`, `2`,
  reply `2.1`, self-message `3`, and `4`.
- Test suite: `notation/tests/communication-diagram.js` — positive render with
  numbered edge labels, dotted reply label, all three `DDN-PJ111` failure modes
  (missing, malformed, reply/non-reply mismatch), unrelated relation kinds
  unlabelled, byte-identical determinism, and an `uml.sequence@1` regression
  render of the same model.

## Implementation/conformance impact

Touch points: `standard/governance/rfcs/RFC-102-communication-diagram.md` (this
document), profile catalogue (`uml.communication@1` entry),
`ddn-profiles.js`/`extensions.json` (`x_message` contract), `ddn-engine.js`
(relabel branch beside `state.flat@1`), `ddn-profile-quality.js` (`DDN-PJ111`
block mirroring the `flow.documented@2` style), `capabilities.json`
(`implemented[]` + `installedProfiles[]`), example 42, test suite, spec chapter
`28-communication-diagrams.md`. The renderer (`ddn-render.js`) needs no edit;
the grammar (`standard/grammar/ddn.ebnf`) is untouched.

This is profile-level coverage, not UML conformance.

## Open questions and decision record

- D1 motivation, D2 vocabulary, D3 declared numbering (including the refinement
  of the workplan brief), D4 rejection behavior, D5 visual encoding, D6
  alternatives, D7 compatibility: recorded above as fixed decisions of this
  RFC.
- Open: whether a later RFC validates cross-message consistency (gap-free
  top-level numbering, replies attached to an existing request number);
  `uml.communication@1` deliberately checks shape only, per D3.
