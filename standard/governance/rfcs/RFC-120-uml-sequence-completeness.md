# RFC 0120 — UML 2.5.1 sequence-diagram completeness

Status: implemented  
Authors/reviewers: B1-056 work item  
Language/registry impact: additive registry entries within the 0.7 draft; new profile `uml.sequence@2`; no grammar or language-source-version change; runtime/specification 0.7 line.

## Problem and motivating example

`uml.sequence@1` (RFC-101) draws lifelines, declaration-ordered messages, dashed `x_return` replies and derived activation bars. It cannot express the UML 2.5.1 interaction surface: combined fragments (alt/opt/loop/break/par/neg/critical/seq/strict/ignore/consider/assert, nested, with operands and guards), gates, creation/destruction, the synchronous/asynchronous arrowhead distinction, lost/found messages, authorable execution occurrences, time/duration constraints and state invariants.

Motivating example (excerpt; full fixture in `website/examples/basics/76-uml-sequence-complete.ddn`):

```
relation charge "Charge card" @checkout -> @payments { kind: "uml.message";
    x_message: { sort: synch; duration: "{0..5s}"; };
    x_fragment: { operator: alt; operands: [
        { guard: "card valid"; messages: [@charge, @capture]; };
        { guard: "else"; messages: [@decline]; } ] };
}
```

## Proposed syntax

No new grammar. Everything lands through additive extension properties (RFC-119 pattern: existing binary relations + declared extras):

1. **`x_fragment`** on a `uml.message` relation — the message is the fragment's owner and first covered message. `{ operator, operands: [ { guard?, messages: [@m…], fragments: [ …nested x_fragment records… ] } ] }`. Operand message lists must be contiguous in declaration order; sibling operands partition a contiguous span; nested fragments nest strictly inside their operand's span.
2. **`x_message` extended** (seq stays optional at contract level — `uml.communication@1` keeps enforcing it via DDN-PJ111):
   - `sort: synch|asynch|create|delete|reply|lost|found` — synchronous filled arrowhead (default), asynchronous open arrowhead, «create» to the target's lifeline header drawn at that row, delete (✕ at the target's lifeline end), reply (dashed open, equivalent to `x_return:true`), lost/found (filled-circle free end).
   - `gate: source|target` — the named endpoint is a gate: it attaches to the innermost enclosing fragment's frame edge instead of the lifeline.
   - `time: "{…}"` / `duration: "{…}"` — observation/constraint annotations rendered at the message row.
3. **`x_invariant`** on a participant object — `[ { after: @message, label } ]`: state-invariant symbol on the lifeline just below that message row.
4. **`x_activation`** on a participant object — `[ { from: @message, to: @message } ]`: authorable execution occurrences (explicit bars) in addition to the derived ones.

Lost/found messages are self-anchored (`@a -> @a`) per the binary-relation data model: the free end is notation, and the filled circle replaces the unnamed counterpart lifeline. Destruction ends the lifeline; any message incident to a destroyed participant after its delete row is rejected.

## Semantic normalization and identity effects

None. Fragments, gates, sorts, invariants, activations and time annotations are view notation over the same message relations; a diagram's semantic fingerprint is unchanged by adding or removing them.

### Orthogonal regions: the data-model decision

UML `par` fragments conceptually own orthogonal regions with region-local lifelines. Three designs were considered (Alternatives). The adopted one: a `par` operand is a **message group over the shared lifelines**, rendered as its own region band inside the frame. Region-local *independent lifelines* (participants that exist only inside one region) would require region-scoped participant identity — a data-model change to `orderedParticipants` and every sequence validator. That is deferred and declared unsupported in `uml.sequence@2`; adopting it later would be an additive follow-up RFC (region-scoped participant lists on `x_fragment` operands), not a change to anything shipped here.

## Visual encoding and routing effects

All inside the deterministic sequence projection; every rule is opt-in by property, so `uml.sequence@1` fixtures render byte-identically:

- Fragment: rectangle spanning the covered lifelines and rows; operator pentagon top-left; `[guard]` text at each operand's first row; dashed operand separators; nesting by strict span containment.
- Gate: the message line stops at the enclosing frame's side edge with a small square connection point.
- Create: the target participant's header box is drawn at the create row (not the diagram top) and the arrow carries a «create» label; the lifeline starts there.
- Delete: ✕ marker on the lifeline at the delete row; the dashed lifeline stops there.
- Asynch: open arrowhead; synch: filled (unchanged default); reply: dashed with open head (as `x_return`).
- Lost: arrow ending in a filled circle past the last lifeline side; found: filled circle at the arrow's start.
- Explicit activations: same bar glyph as derived ones, spanning the declared rows.
- State invariant: rounded (stadium) symbol centred on the lifeline with the state label.
- Time/duration: `{…}` constraint text beside the message row.

## Alternatives considered

1. **View-level fragment table** (`projection { fragments: [...] }`): rejected — fragments would lose their owner/anchor identity and ordering ties; a message-owned declaration keeps one undo/identity unit per fragment (the first covered message), matching how frames anchor to views but relations own semantics.
2. **Frame-reuse** (graph `frame` declarations): rejected — data-bound projections reject graph geometry (`DDN-PJ002`) by design; frames are visual grouping, not interaction operators with operands and guards.
3. **Region-scoped lifelines for par**: deferred (see above).
4. **New relation kinds for create/delete/lost/found**: rejected — UML treats these as message sorts of one Message metaclass; one `sort` enum keeps the verb table small and the legend stable.

## Compatibility and migration

Fully additive. `uml.sequence@1` stays installed and immutable; the new scope ships as `uml.sequence@2`. `x_message.seq` remains optional at contract level — `uml.communication@1`'s DDN-PJ111 checks are untouched. Sources without the new properties render byte-identically (existing sequence fixtures verify this).

## Security, privacy and accessibility

No new input channels; values pass the schema contract validator (`DDN105`) and bounded-string rules. All glyphs are deterministic SVG with `data-*` hooks; guards/labels escaped like every other label.

## Machine schema and diagnostic changes

- Registry: +1 profile (`uml.sequence@2`); `x_message` extended (`sort`, `gate`, `time`, `duration`); new contracts `x_fragment` (relation), `x_invariant` (object), `x_activation` (object).
- New error codes (ceilings checked after B1-055: PJ154, PJW05): `DDN-PJ155` (fragment structure), `DDN-PJ156` (message sort/gate semantics), `DDN-PJ157` (state invariant), `DDN-PJ158` (explicit activation), `DDN-PJ159` (time/duration form).

## Positive and negative fixtures

`notation/tests/uml-sequence-compliance.js` covers every feature positively plus each rejection code and the `@1` byte-compatibility guard. Gallery/example fixture: `website/examples/basics/76-uml-sequence-complete.ddn`.

## Implementation/conformance impact

Touch points: `notation/runtime/ddn-profiles.js` (contracts), `ddn-projection-data.js` (fragment span computation + PJ155–PJ159), `ddn-projections.js` (sequence renderer). Spec chapter 27 rewritten for @2; designer spec ch. 09 sequence-editor status updated. Still outside scope, declared in the profile: region-local independent lifelines in `par`, full UML action/behavior semantics, protocol verification, XMI exchange.

## Open questions and decision record

- Par regions: **decided** — operands are message groups over shared lifelines; region-local lifelines deferred to a future additive RFC.
- Reply identity: `sort: reply` and `x_return:true` are equivalent; validators reject conflicting pairs on one relation (a reply sort with `x_return:false`).
