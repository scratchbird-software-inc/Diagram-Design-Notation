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

> **DRAFT RFC (0.9, not implemented — no runtime change): AUD-004 versioned occurrence contract.** Today's rule is one appearance per view: an element occurs at most once per view (its uid *is* its occurrence), and a relation is visible exactly when both endpoints are — there is no way to show a relation while hiding an endpoint, or to show one element twice in one view. This draft records the proposed contract for review; **0.8 processors treat it as commentary**, and sources do not change.
>
> *Proposed model.* An **occurrence** is the pair `(view, element)` plus an optional **version qualifier** `occ`: `object x { … }` in a view is the default occurrence; a second appearance would declare `occ: 2` (integer ≥ 2, default 1) at the view-reference site. Occurrence identity = `element uid + view + occ`. Layout, `place` pins, marks and per-occurrence presentation (ch. 04 §6A–§6C properties) attach to the occurrence, never to the element; the model fingerprint stays occurrence-free.
>
> *Relation visibility.* Today relation visibility is derived from endpoint visibility. The RFC proposes an optional explicit override at the occurrence site — `show: [@rel]` / `hide: [@rel]` on the view — evaluated AFTER the endpoint rule: a hidden endpoint still suppresses its relations by default, but an author may show a relation to a hidden endpoint (drawn to the endpoint's would-be position, marked as a boundary cross) or hide a relation whose endpoints are both shown. Relation occurrence identity likewise gains an optional `occ` qualifier for duplicate visual runs.
>
> *Migration path.* Existing sources are occurrence-1 everywhere, so nothing migrates syntactically; the identity surface changes: tools keyed on `element uid` per view must rekey to `(uid, view, occ)`. uid introduction at migration: an element appearing twice gains explicit `uid:` assignments before the first two-occurrence view, so the transition is a checkable edit, never a silent split. Open questions recorded for the grammar RFC discussion: whether `occ` participates in `select`/`exclude` reference syntax (`@el#2`?), how diff views (ch. 55 §55.6) key occurrences, and whether occurrence-level `place` interacts with the pinned-origin contract.
>
> This RFC is deliberately not implemented in the 0.8 runtime; when ratified it lands as a grammar amendment with conformance vectors.

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
