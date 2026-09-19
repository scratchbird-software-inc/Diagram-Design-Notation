# RFC 103 — Object diagram profile (`uml.object@1` on `kind:graph`)

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive; profile uml.object@1; extension x_instance

## Problem and motivating example

Class-style structure views (`uml.structure@1`, and any graph view of `uml.class`
objects) show *types*: classifiers with their declared fields. Users also need
*instance snapshots*: concrete example objects whose slots are filled in, linked
to each other — "an example customer with its example order". Today a source
can declare `kind:record` objects with fields, but nothing ties such an object
to the classifier it exemplifies, so a renderer cannot present it as an instance
of a type and a validator cannot check its slots against the type.

Motivating example: synthetic `Customer` and `Order` classifiers (ordinary
`uml.class` objects with a few fields) plus two record instances —
`sample_customer` and `sample_order` — each naming its classifier and carrying
matching slot fields, with one `assoc` link between the instances. Rendered on
the existing graph projection, the instance cards show their slot rows and the
link, giving the reader a concrete snapshot beside the type model.

## Proposed syntax

No grammar change. Profiles and extension properties are atom/record property
values (`property = identifier ":" value ";"`); everything below parses today.
Verified: `standard/grammar/ddn.ebnf` untouched; values are records/atoms.

- New profile `uml.object@1` bound to the existing projection `kind:graph`.
  No new projection kind: an object diagram is a graph-shaped view.
- New registered extension property `x_instance` on objects:

  ```json
  { "type": "object", "required": ["classifier"], "additionalProperties": true }
  ```

  The classifier is written as a reference: `x_instance: { classifier: @m.Order; };`.
  Reference values in property records are rewritten by `resolveValue`
  (`ddn-core.js`) to `{ classifier: { $ref: "<uid>" } }` at build time, so the
  validator always receives a resolved reference; an unresolvable reference
  fails at build (`DDN031`-class) before any profile check runs.
- No new kinds, no new verbs, no new projection properties. Links between
  instances reuse the core verb `assoc` (endpoint contract
  `source:['*'], target:['*'], allow_self:true, member_endpoints:true`).

```ddn
object customer "Customer" { kind: uml.class;
    fields { field customer_id { datatype: "string"; } field name { datatype: "string"; } }
}
object sample_customer "sample_customer : Customer" {
    kind: record; x_instance: { classifier: @model.customer; };
    fields { field customer_id; field name; }
}
relation placed "Placed" @sample_customer -> @sample_order { kind: assoc; }

view objects "Synthetic snapshot / objects" {
    data: [@model];
    projection { kind: graph; profile: "uml.object@1"; }
}
```

### Registration correction (verified against the runtime)

The original workplan brief implied `x_*` extension properties were free-form,
documented beside `data-properties.json`. That is wrong:
`data-properties.json` is the contract list for CORE unqualified properties
(`uid`, `description`, `kind`, …). Unregistered `x_*` properties warn
`DDN-W103` in logical mode and fail `DDN103` in strict mode
(`ddn-contracts.js`). Therefore `x_instance` is formally registered — in
`notation/runtime/ddn-profiles.js` `registry()` and mirrored in
`standard/registry/extensions.json` `contracts{}` — exactly as RFC-101/102
registered `x_message`/`x_return`.

## Semantic normalization and identity effects

None beyond resolution. An instance is an ordinary selected `object` element of
kind `record` that carries `x_instance`; its identity, fields and relations are
untouched. The classifier reference resolves at build time to the referenced
element's uid — possibly an element of an imported module of the same
workspace. Slots are the instance's declared `fields`; no field is renamed,
retyped or reordered.

## Visual encoding and routing effects

None beyond the graph renderer's existing record cards: `measureNode`/
`renderNode` in `ddn-render.js` already draw `n.fields` as compartment rows, so
slots render as ordinary field rows with no renderer change. The instance's
name may follow UML-ish `name : Classifier` text as plain label text (author's
choice; no parser support). Links between instances render as ordinary graph
edges. Layout is the author's choice.

## Alternatives considered

- **A dedicated `uml.instance` kind** — rejected: `record` + `x_instance` is
  additive and reuses the existing field-row rendering; a new kind would
  duplicate the record pipeline for a label.
- **Validating slot datatypes against the classifier's field datatypes** —
  rejected for v1: names only. Record slots in examples frequently omit
  datatypes; name checking already catches the common authoring error.
- **A new projection kind `object`** — rejected: the view is graph-shaped; the
  graph projection and its layouts already express it.

## Compatibility and migration

Purely additive. `record` and `uml.class` semantics are unchanged; no existing
profile, kind, verb, or property is edited. Sources that do not use
`uml.object@1` or `x_instance` are byte-for-byte unaffected; unregistered
`x_*` properties continue to warn `DDN-W103` / fail `DDN103` as before, and
registration of `x_instance` removes that warning for conforming sources.

## Security, privacy and accessibility

No new inputs: instances, classifiers, slots and links are already-declared
model data. Rendered text is escaped through the shared `esc()` helper like
every other node label and field row. Nodes keep `data-id`/`data-source-ids`
and the existing keyboard/assistive inspection path. The diagram makes no
type-system claim: slot values and identity semantics are the author's.

## Machine schema and diagnostic changes

- `standard/registry/profiles/catalogue.json`: new `profiles[]` entry
  `uml.object@1` (projection `graph`). Additive only; published profiles are
  immutable.
- `notation/runtime/ddn-profiles.js` `registry()` and
  `standard/registry/extensions.json` `contracts{}`: register `x_instance` with
  the schema above, target `object`.
- `standard/registry/capabilities.json`: one `implemented[]` line appended;
  `installedProfiles[]` gains the `uml.object@1` entry (list mirrors the
  profile catalogue).
- New error `DDN-PJ112` — under `uml.object@1`, an instance (element carrying
  `properties.x_instance`) declares a slot (field) whose name is not among its
  classifier's fields. Checked ONLY when the classifier resolves to an
  in-workspace element that declares fields; if the classifier resolves but
  declares no fields, the check is skipped. Matching accepts the classifier
  field's `name` or `local` id. The message names the instance, the slot and
  the classifier. The check lives in the additive profile-completion validator
  `ddn-profile-quality.js`, beside the `uml.communication@1` block.
- Existing codes unchanged: `DDN103`/`DDN-W103` still guard unregistered
  extensions; `DDN105` still reports contract failures (e.g. `x_instance: {}`
  missing `classifier`).

## Positive and negative fixtures

- Positive example: `examples/basics/43-object-diagram.ddn` — synthetic
  `Customer`/`Order` classifiers, two record instances with matching slots, one
  `assoc` link, one `objects` view on `kind:graph` + `uml.object@1`.
- Test suite: `notation/tests/object-diagram.js` — positive render with slot
  rows and source ids on scene marks, imported-module classifier resolution,
  fieldless-classifier skip, `DDN-PJ112` on an unknown slot, `DDN105` on a
  missing classifier, `DDN103`/`DDN-W103` on an extension typo in
  strict/logical mode, and byte-identical determinism.

## Implementation/conformance impact

Touch points: `standard/governance/rfcs/RFC-103-object-diagram.md` (this
document), profile catalogue (`uml.object@1` entry),
`ddn-profiles.js`/`extensions.json` (`x_instance` contract),
`ddn-profile-quality.js` (`DDN-PJ112` block), `capabilities.json`
(`implemented[]` + `installedProfiles[]`), example 43, test suite, spec chapter
`29-object-diagrams.md`. The renderer (`ddn-render.js`) needs no edit; the
grammar (`standard/grammar/ddn.ebnf`) is untouched.

This is profile-level coverage, not UML conformance.

## Open questions and decision record

- D1 motivation, D2 vocabulary, D3 metamodel (instance/classifier/slots/links),
  D4 rejection behavior (including the fieldless-classifier skip), D5 visual
  encoding, D6 alternatives, D7 compatibility, and the data-properties
  registration correction: recorded above as fixed decisions of this RFC.
- Open: whether a later RFC adds optional slot-datatype checking or underlined
  `name : Classifier` title styling; `uml.object@1` deliberately renders
  ordinary record cards, per D5.
