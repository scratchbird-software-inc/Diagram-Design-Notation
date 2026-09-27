# RFC 0123 — UML 2.5.1 component + composite-structure diagrams (profile `uml.composite@1`)

Status: implemented  
Authors/reviewers: B1-059 work item  
Language/registry impact: additive registry entries within the 0.7 draft; new profile `uml.composite@1`; no grammar change; runtime/specification 0.7 line.

## Problem and motivating example

UML 2.5.1 component diagrams need assembly (ball-and-socket) and delegation connectors, ports on components, and internal parts; composite structure diagrams need parts inside classifiers, ports on class boundaries, connectors with role names and multiplicity, and collaboration occurrences. B1-055 (RFC-119) already landed the provided/required *decorations* (`uml.provided` lollipop / `uml.required` socket); this RFC lands the connection machinery they decorate.

Motivating example (excerpt; full fixture in `website/examples/basics/79-uml-composite.ddn`):

```
object shop "Shop" { kind: "uml.component";
    ports { port web { direction: in; } port db { direction: out; } }
    fields { field cart { x_part: { classifier: "Cart"; multiplicity: "1" }; } }
}
relation asm "" @shop.db -> @store.cart { kind: "uml.assembly"; }
relation del "" @shop.web -> @shop.cart { kind: "uml.delegation"; }
```

## Proposed syntax

No new grammar. Additive kinds/relations, one new profile, extension machinery from RFC-119 and the SysML port precedent:

1. **Ports on classifiers** — the existing `ports { port x { direction: in|out|inout; } }` machinery (SysML `sysml.ibd@1`) applies unchanged to `uml.component`/`uml.class`. The renderer's port-square attachment (previously sysml-only) now also draws under `uml.composite@1`.
2. **New relations**:
   - `uml.assembly` — assembly connector between components or their ports; renders socket at the requiring end, lollipop at the provided end (RFC-119 marks).
   - `uml.delegation` — dashed open-arrow delegation connector from a boundary port inward to a part/port (`member_endpoints: true`).
   - `uml.connector` — plain composite-structure connector between parts/ports/classes/components (`member_endpoints: true`), carrying RFC-119 `x_endlabels` role names and multiplicity (PJ149 rule now names association, communication path, or connector).
3. **Internal parts** — fields carrying `x_part: { classifier?, multiplicity? }` render as `role: Classifier [mult]` rows inside the owning classifier (new closed extension contract, field target).
4. **Collaboration occurrences** — new kind `uml.collaboration`: dashed-ellipse collaboration symbol with «collaboration» keyword; its role bindings are `x_part` fields rendered inside.
5. **New profile `uml.composite@1`** (graph projection) covering both diagram families — one profile, same decision as RFC-121 (the UML structure family shares a classifier vocabulary; splitting component vs composite-structure would duplicate every validator).

## Semantic normalization and identity effects

None. Parts are field-identity members of their classifier (slot rows in object diagrams and matrices keep working); connectors/ports are existing relation/member machinery.

## Visual encoding and routing effects

- Port squares at member endpoints now render whenever the profile is `sysml.*` **or** `uml.composite@1`; SysML fixtures are byte-identical.
- Assembly: `socket` start mark + `lollipop` end mark (RFC-119 `endMark` types).
- Part rows: `role: Classifier [mult]` in the owner box (class compartments and the generic field-row branch both compose the label).
- Collaboration: dashed ellipse (dash `6 4`), «collaboration» header, role rows inside.

## Alternatives considered

1. **`uml.component@1` + `uml.composite@1` as two profiles**: rejected — shared vocabulary and validators (RFC-121 precedent).
2. **Parts as nested elements in frames**: rejected — frames are visual grouping; parts are typed feature members of the classifier, which is exactly the field/member channel (slot rendering, matrices and member endpoints all reuse it).
3. **Assembly as a mark pair on `uml.provided`**: rejected — provided/required are interface-classifier relations; assembly connects two classifiers (or ports) with both decorations in one connector.

## Compatibility and migration

Fully additive. `uml.structure@2`'s provided/required relations are unchanged and remain the interface-notation choice; `uml.assembly` is the port-to-port connector choice. SysML profiles untouched. `x_endlabels` gains `uml.connector` as a legal owner (PJ149 rule text).

## Security, privacy and accessibility

No new input channels; standard contracts, escaped labels, source-bound marks.

## Machine schema and diagnostic changes

- Registry: +1 kind (`uml.collaboration`), +3 relations (`uml.assembly`, `uml.delegation`, `uml.connector`), +1 profile; regenerated assets.
- Contracts: new closed `x_part` (field).
- New error codes (ceilings re-grepped: PJ164, PJW05): `DDN-PJ165` (assembly/delegation endpoint semantics: assembly endpoints are components or ports of components; delegation starts at a port member), `DDN-PJ166` (x_part misuse: multiplicity form, part fields only on class/component/collaboration owners).

## Positive and negative fixtures

`notation/tests/composite-compliance.js`; gallery fixture `website/examples/basics/79-uml-composite.ddn`.

## Implementation/conformance impact

Touch points: registry, `ddn-profiles.js` (x_part contract, PJ149 rule), `ddn-profile-quality.js` (PJ165/PJ166), `ddn-render.js` (port-square gate, part label composition), `ddn-shapes.js` (collaboration ellipse, part rows). Spec chapter 17 gains §17.9. Still outside scope: UML port *protocol* state machines, interface *realization* typing checks, structured-classifier behavior, formal OMG conformance.

## Open questions and decision record

- Profile shape: **decided** — one `uml.composite@1` for both diagram families.
- Ball-and-socket *pairing* validation (socket type must match lollipop type) is declared out of scope: DDN does not type interfaces, so an assembly connector is structural notation, not a type-checked junction.
