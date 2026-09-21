# 29. Object diagrams (profile `uml.object@1` on projection `graph`)

Status: implemented in runtime 0.6.0-beta.1, governed by RFC-103
(`standard/governance/rfcs/RFC-103-object-diagram.md`). Source grammar remains
DDN 0.5; profiles and extension properties are atom/record property values, so
this chapter is a semantic addition, not a grammar change.

An object (instance-snapshot) view shows concrete example objects — instances
that name their classifier — on the ordinary graph projection. Structure views
such as `uml.structure@1` show *types*; this profile shows *instances*: record
cards whose slots are filled in, linked by plain relations. There is no new
projection kind; the view is an ordinary graph layout.

This is profile-level coverage, not UML conformance.

## Metamodel

- **Classifier** — any referenced element, expected kind `uml.class`, possibly
  declared in an imported module of the same workspace.
- **Instance** — a selected `object` of kind `record` carrying the registered
  extension property `x_instance` (object target):
  `{ "type":"object", "required":["classifier"], "additionalProperties":true }`.
  The classifier is written as a reference, `x_instance: { classifier: @m.Order; };`,
  and arrives at the validator resolved as `{ classifier: { $ref: "<uid>" } }`;
  an unresolvable reference fails at build (`DDN031`-class).
- **Slots** — the instance's declared `fields`, rendered as ordinary field
  rows on the record card (`measureNode`/`renderNode` in `ddn-render.js`); no
  renderer change.
- **Links** — plain core relations between instances (verb `assoc`, whose
  endpoint contract accepts any object endpoints).

## Skip rule for fieldless classifiers

`DDN-PJ112` is checked ONLY when the classifier resolves to an in-workspace
element that declares fields. If the classifier resolves but declares no
fields, the slot check is skipped and the view renders; the instance's slots
are then entirely the author's. A classifier reference always resolves at
build time or the build already failed, so there is no "unresolved" case at
validation time.

## Validation and diagnostics

- `DDN-PJ112` (error) — under `uml.object@1`, an instance declares a slot
  (field) whose name matches no field of its classifier (matching accepts the
  classifier field's display `name` or its `local` id), while the classifier
  declares fields. The message names the instance, the slot and the classifier.
- `DDN105` (error) — `x_instance` without a `classifier` key violates the
  registered extension contract.
- Unregistered extension typos (e.g. `x_instnce`) warn `DDN-W103` in logical
  mode and fail `DDN103` under `validation { mode: strict; }`, as for every
  extension property.

## Visual encoding

None beyond the graph renderer's existing record cards with field rows. The
instance's name may follow UML-ish `name : Classifier` text as plain label
text (author's choice; no parser support). Links render as ordinary graph
edges; layout is the author's choice (`layout { algorithm: layered; }` is a
good default).

## Source example

```ddn
object sample_order "sample_order : Order" {
    kind: record; x_instance: { classifier: @model.order; };
    fields { field order_id "O-4711"; field total "129.50"; }
}

view objects "Synthetic snapshot / objects" {
    data: [@model];
    projection { kind: graph; profile: "uml.object@1"; }
    layout { algorithm: layered; }
}
```

See `website/examples/basics/43-object-diagram.ddn`: synthetic `Customer`/`Order`
classifiers, two record instances with matching slots, and one `assoc` link.

## Unsupported

Object identity semantics beyond labels; slot datatype checking (names only in
v1); full UML conformance.
