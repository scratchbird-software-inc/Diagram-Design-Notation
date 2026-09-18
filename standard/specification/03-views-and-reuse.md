# DDN 0.3 — Views, reuse and audience projection

A view is the composition point. It references one or more data modules, a notation, reusable style/layout/display/publication/legend/validation/export profiles, or a bundle of those references. It adds selection, title, local hints and linked views without copying the data.

## Resolution order

Language defaults → referenced bundle → directly referenced concern → view-local concern properties. This is explicit component replacement/override, not import-order mutation of semantic facts. References resolve to stable identities. Conflicting IDs or properties fail rather than allowing a last-import-wins design.

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

## Display versus authorization

`fields:none`, limited `depth`, hidden domains, hidden samples and omitted badges change presentation only. Full private resolution still contains the model. Public output MUST use an explicit `export {mode:redacted; ...}` profile; it is not inferred from a sparse view.

## Appearance constraints

Automatic layout is the normal path. `place` and `route` are optional view-specific hints. Hard placement conflicts fail. `route_policy:repair` recomputes an unsafe hint with an explicit diagnostic; `strict` rejects it. Neither mode changes relation endpoints or data meaning.

## Diagram references

`subdiagram {view:@detail;mode:reference;}` links a view. `mode:inline` embeds its own selected model and presentation. The child controls internal content; the parent controls its allotted space. Inline rendering namespaces SVG IDs and checks final text size. A link may return to an overview; inline cycles fail.

Balanced process ports are separately represented by `x_boundary`. The native collapsed-process drawing mode remains unsupported; do not confuse the new contract validator with a fully implemented collapsed visual editor.

Number assignments belong to the view or a shared keyset. They identify relationships, not time order. Protocol chronology uses explicit predecessor/reply metadata; workflow progression uses explicit transitions and guards.

## Reusable connector geometry

A shared layout concern may define `routing:curved`, `curve:bezier`, `curve_tension:0.5` and `crossings:gap`. Many views can reference it while retaining independent content selection, appearance and publication. A view-specific `route @relation {routing:orthogonal;}` affects only that appearance. Geometry is not part of the data model or the semantic hash. See [Curved relations](13-curved-relations.md).
