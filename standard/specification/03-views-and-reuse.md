# DDN 0.3 — Views, reuse and audience projection

A view is the composition point. It references one or more data modules, a notation, reusable style/layout/display/publication/legend/validation/export profiles, or a bundle of those references. It adds selection, title, local hints and linked views without copying the data.

## Resolution order

Language defaults → referenced bundle → directly referenced concern → view-local concern properties. This is explicit component replacement/override, not import-order mutation of semantic facts. References resolve to stable identities. Conflicting IDs or properties fail rather than allowing a last-import-wins design.

> **0.8 draft amendment:** a 0.6 view may also declare a `kind` (view profile) and `strictness` (chapter 52). Kind-derived profile/theme defaults insert between language defaults and the referenced bundle in this order; explicit concerns still win. Kind and strictness are lint/composition axes only — they never change selection, semantics or rendering beyond their documented defaults.

```ddn
format formats {
 layout dataflow {algorithm: layered;direction: right;routing: orthogonal;}
 display compact {fields: none;kind: icon_token;}
}
view overview {
 data:[@business.model,@infrastructure.model,@integration.links];
 format:@shared.styles.technical;
 layout:@formats.dataflow;
 display:@formats.compact;
 publication {size:content;fit:none;}
}
```

`select` limits visible objects; `exclude` removes occurrences from that view. Relations are selected when both endpoints are shown unless relations are disabled. Domain/reference dependencies still have to be supplied as data modules even when not shown. Default selection order is deterministic source order.

## Independently addressed graph occurrences (0.8 amendment)

Implemented 2026-10-09; requires `ddn "0.6";`. This replaces the AUD-004
occurrence RFC. A **model element** owns its meaning and fields; an
**occurrence** owns an appearance in one view. No duplicate model declaration
is created when the same element appears twice.

```ddn-0.8
data model {
  object customer "Customer" { kind: table; }
  object order "Order" { kind: table; }
  relation orders @customer -> @order;
}
view overview {
  data: [@model];
  select: [@model.customer, @model.customer#2, @model.order];
  show: [@model.orders#2];
  place @model.customer { at: [0px, 0px]; }
  place @model.customer#2 {
    at: [400px, 300px];
    fill: "#eef";
    text { italic: true; }
  }
  route @model.orders#2 { from: @model.customer#2; to: @model.order; }
  publication { size: content; }
}
```

### Identity and selection

- `@element#N` selects ordinal N, a positive safe integer. An unqualified
  reference means ordinal 1 in `select`, `place`, `route`, route endpoints and
  frame members. Repeating the same reference is idempotent; it never invents
  another occurrence. Distinct appearances require distinct ordinals.
- Logical identity is `(view uid, model uid, ordinal)`. Resolved IR carries
  `view.occurrences = {version: 1, elements, relations}` when this amendment is
  used. Each record has `id`, `source` (model uid) and `number`; relation records
  additionally have `from` and `to` occurrence ids. These ids are opaque.
- Ordinal 1 retains the historical model-id scene key. Other scene keys encode
  the complete tuple and are checked against model/member identity collisions.
  Consumers key legacy appearances by view plus scene id. Reordering the
  selection, changing layout or moving an appearance does not change its id.
- Existing sources need no migration and retain their old scene identities.
  Existing resolved uids provide model identity; an explicit `uid:` remains
  advisable when identity must survive source-path renaming, but is not required
  merely to add an appearance. Adding an appearance does not rewrite the model
  or change its semantic fingerprint.
- `view.selected` and `view.relations` remain semantic membership lists. The
  occurrence layer describes actual visual instances. Renderers expand it into
  temporary scene records, never into stored semantic model records.
- `exclude: [@element#2]` removes only ordinal 2; bare `@element` excludes every
  appearance of that model element. Selection need not include ordinal 1.
  `select: all` continues to mean one appearance per element. The designer's
  Add another appearance command materializes an explicit select list when
  starting from `all`; later additions to a data block then require selection.

### Relationships and per-occurrence presentation

The ordinary endpoint-visibility rule still creates one run of each relationship,
using the lowest visible ordinal of each endpoint. Copies do **not** cause a
Cartesian product of relationships. `show: [@relation#2]` adds an explicit run;
`hide: [@relation#2]` removes one run and bare `@relation` hides every run. Hide
wins over show. `display {relations: none;}` disallows an explicit show.

`route @relation#N {from: @element#M; to: @other#K;}` binds that visible run to
specific endpoint appearances. Either endpoint override may be omitted, using
the ordinary default. It cannot change the relationship's semantic endpoints;
field/port attachment is inherited from those endpoints. A second route run must
be declared in `show`; a route hint does not silently create it. Numbered legend
keys identify the shared relationship and therefore remain the same across runs.

`place` addresses one appearance's position/size, including pinned-origin
behavior. It also accepts `fill`, `opacity`, `marks`, `text_fit`, `max_width`,
`max_height`, `min_font`, and `text {}` / `stroke {}` groups using the existing
presentation contracts. An occurrence override wins over the shared element;
absent keys inherit it. `route` accepts a `line {}` override. Frame `members`
may address individual appearances. A duplicate place or route for the same
appearance is an error, rather than last-write-wins.

The authoring API exposes `occurrences`, `addOccurrence`,
`addRelationOccurrence` and `setOccurrencePresentation`; pin, unpin, hide,
frame membership, source mapping and shared-definition edits accept occurrence
ids. Hiding an appearance through the API removes its pins, frame membership
and attached visual runs in one undoable transaction. A meaning edit through
any appearance updates the single shared definition. Snapshots and bundled
sources preserve qualifiers. Redacted exports apply the model allowlist first,
then remap only surviving occurrences without exposing private source identities.

### Scope and validation

This version covers flat graph projections with binary connectors. Data-driven
projections, isometric graphs, fixed-lane protocol interactions and n-ary connector
leg addressing keep their existing projection-specific contracts and reject this
new layer with `DDN-OC04`. Diff operands still compare visible **model** records;
occurrence-only layout or copy changes do not become semantic additions/removals.

A shown relationship needs visible endpoint appearances. The earlier RFC's
hidden-endpoint boundary-cross rendering is **not implemented**: it requires a
separate routing/interaction contract and cannot silently fabricate a position.
Occurrence-aware visual diffs and the other projection families are follow-up
work, not claims of this amendment.

Diagnostics: `DDN-OC01` invalid ordinal/context or occurrence property;
`DDN-OC02` identity collision or duplicate hint; `DDN-OC03` invalid/hidden endpoint
or relationship visibility conflict; `DDN-OC04` unsupported projection contract.
`DDN-V04` rejects occurrence syntax below dialect 0.6. Existing `DDN057`,
`DDN062` and `DDN063` still cover out-of-scope selections, absent placements and
invisible route targets. Qualifiers are not legal in semantic references.

A view or a bundle may also declare `spacing: tight|normal|loose|expanded` directly (`view overview { spacing: loose; … }`, `bundle wide { spacing: loose; layout: @x; … }`). The view declaration wins over the bundle's; absent means `normal`. It scales graph-family gaps and route-label reservation only — see [Anchored placement](15-placement-and-low-light.md#spacing-hints).

## Display versus authorization

`fields:none`, limited `depth`, hidden domains, hidden samples and omitted badges change presentation only. Full private resolution still contains the model. Public output MUST use an explicit `export {mode:redacted;...}` profile; it is not inferred from a sparse view.

## Appearance constraints

Automatic layout is the normal path. `place` and `route` are optional view-specific hints. Hard placement conflicts fail. `route_policy:repair` recomputes an unsafe hint with an explicit diagnostic; `strict` rejects it. Neither mode changes relation endpoints or data meaning.

## Diagram references

`subdiagram {view:@detail;mode:reference;}` links a view. `mode:inline` embeds its own selected model and presentation. The child controls internal content; the parent controls its allotted space. Inline rendering namespaces SVG IDs and checks final text size. A link may return to an overview; inline cycles fail.

For node-level drill-down, any element may bind a detail view with
`x_subdiagram` and choose a presentation: `display: "badge"` (reference
badge), `"inline"` (live full-fidelity child), or `"thumbnail"` (live child
in shapes detail — silhouettes and edges only, all text suppressed).
`frozen: true` with a stored `snapshot` SVG embeds a frozen thumbnail that
only changes when the host rewrites the snapshot property. See chapter 34 §34b.

Balanced process ports are separately represented by `x_boundary`. The native collapsed-process drawing mode remains unsupported; do not confuse the new contract validator with a fully implemented collapsed visual editor.

Number assignments belong to the view or a shared keyset. They identify relationships, not time order. Protocol chronology uses explicit predecessor/reply metadata; workflow progression uses explicit transitions and guards.

## Reusable connector geometry

A shared layout concern may define `routing:curved`, `curve:bezier`, `curve_tension:0.5` and `crossings:gap`. Many views can reference it while retaining independent content selection, appearance and publication. A view-specific `route @relation {routing:orthogonal;}` affects only that appearance. Geometry is not part of the data model or the semantic hash. See [Curved relations](13-curved-relations.md).

## Explicit frame containment

A frame may declare `within: @parent` (or `@viewId.parent`) in source
versions 0.6 and 0.7. The reference MUST identify a frame declared in the
same view; forward references are allowed. It does not reference a model
object, another view, an occurrence or an imported frame. `scope` continues
to identify the semantic boundary object; `members` continues to identify
its directly enclosed element appearances. Containment adds no model
relationships and does not execute any source stored in notes.

```ddn
frame outer "Subsystem" {}
frame inner "Component" { within: @outer; members: [@model.item]; }
```

`standard/registry/catalogue.json` publishes `limits.max_frame_depth: 4`.
The outermost frame counts as level one. A host registry may lower the
limit to an integer from one to four; omission uses four. Containment
MUST be acyclic. The resolver walks at most the depth limit plus one
links per frame; a cycle detected within that walk reports `DDN-FR02`,
otherwise an overlong path reports `DDN-FR03`. These are hard errors in
both ordinary validation and design previews.

The graph renderer measures children before their parents and paints
parents before their children, preserving source order among siblings.
Parent bounds include both direct members and child rectangles, with
20 px left/right, 54 px top (including the title), and 22 px bottom padding.
Empty children retain the ordinary 300 × 170 px default rectangle.
Coordinates remain absolute drawing coordinates, not parent-relative.
Under `frame_overflow: expand`, a nested parent grows on every side as
needed, including left/up from its declared origin. Flat frames retain
the existing anchored-origin expansion behavior.

Under `confine`, fixed ancestors (`at` and `size`) constrain descendant
members, reserving padding for each intervening frame. Pinned or retained
members cannot be moved to satisfy these constraints. Child frames with
explicit coordinates are not automatically translated; a child rectangle
that cannot fit its size-constrained parent's padded interior is rejected.
The existing placement algorithms may reject an infeasible slot before
frame geometry is produced. This does not introduce a general container
packing solver. Direct membership remains unchanged for profile-specific
semantic validation. Explicit nesting controls graph boundaries; it does
not turn matrix, chart or other projections into container diagrams.

| Code | Meaning |
|---|---|
| `DDN-FR01` | Invalid `within` value or parent outside the current view |
| `DDN-FR02` | Detected frame containment cycle |
| `DDN-FR03` | Excessive frame depth or invalid registry limit |
| `DDN-FR04` | Child geometry does not fit a confined parent |

Compiled frames carry an optional `within` string containing the parent's
resolved frame id. Existing frames omit it. Inherited placement constraints
and frame measurement are bounded by four levels; validation and geometry
traversal are linear in the number of frames and memberships at that fixed
limit. Diagram rendering still has its existing node and routing costs.

### Appearance-aware comparison

A diff view may declare `diff_scope: appearance;` alongside its two `diff`
operands. The default `model` scope preserves semantic comparison. Appearance
scope matches an operand's element/relation identity plus occurrence ordinal,
and compares each occurrence's presentation, placement, route hints and explicit
endpoint choices. Removing one occurrence does not remove its siblings. Operand
view IDs do not become matching keys. Scope values outside `model` and
`appearance`, or a scope without diff operands, reject with `DDN-DF01`.

The designer Files drawer can create a comparison view in a new workspace file,
with explicit imports of the chosen before/after views. The generated view is
validated and its creation is one undoable edit. Comparison is browser-local.

Isometric graph views also accept explicit element and binary-relation
appearances. The renderer expands occurrence identities once before projecting
the scene; repeated expansion preserves the same mapping. Fixed-lane interaction
views, data-bound projection copies and n-ary occurrence addressing remain
unsupported and reject rather than silently duplicating semantic records.
