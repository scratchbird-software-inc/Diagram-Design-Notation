# RFC 0126 — BPMN 2.0.2 notation compliance

Status: implemented  
Authors/reviewers: B1-063 work item  
Language/registry impact: additive registry entries within the 0.7 draft; new profiles `bpmn.process@1`, `bpmn.choreography@1`, `bpmn.conversation@1`; `bpmn.basic@1` immutable; no grammar change; runtime/specification 0.7 line.

## Problem and motivating example

`bpmn.basic@1` covers pools/lanes, three event triggers as text, three gateway types as text prefixes, plain sequence/message flow. BPMN 2.0.2 additionally specifies: the full event system (start/intermediate/end × 14 triggers, boundary interrupting/non-interrupting), six gateway types with true glyphs, the full activity set (call, ad-hoc, transaction, event subprocess, loop/multi-instance/compensation markers), data objects/inputs/outputs/stores with associations, sequence-flow variants (default/conditional), collapsed pools, choreography (participant bands) and conversation diagrams, and group/text-annotation artifacts.

## Proposed syntax

No grammar change. Additive kinds, relations, and closed extension contracts; a shared renderer **decorator layer** (ring styles, trigger icons, boundary attachment, task badges) that is profile-neutral — CMMN or other notations can drive it later:

1. **`x_event` extended**: `type` grows to `none, message, timer, signal, error, escalation, compensation, conditional, link, terminate, cancel, multiple, parallel_multiple`; new `position: start|intermediate|end|boundary`, `interrupting: boolean`, `on: @ref` (boundary host). New kind `flow.intermediate`. Under the new profiles, `flow.start`/`flow.intermediate`/`flow.end` render as BPMN event circles (single/double/thick rings) with trigger icons; boundary events attach to their host's border. `bpmn.basic@1` rendering is unchanged.
2. **`x_gateway` extended**: `exclusive, parallel, inclusive, complex, event, event_exclusive`, rendered as true inner glyphs (X, +, O, star, pentagon) instead of text prefixes under the new profiles.
3. **`x_activity` (new, object target)**: `{ call?, transaction?, adhoc?, event_subprocess?, collapsed?, markers?: [loop, parallel, sequential, compensation] }` — badges row at the task's bottom-left, thick/double/dashed borders.
4. **Data**: new kinds `flow.dataobject`, `flow.datainput`, `flow.dataoutput`, `flow.datastore`; new relation `bpmn.association` (dashed open arrow between data nodes and activities); `x_io: { set: true }` marks an input/output set (collection badge).
5. **Flows**: sequence flow variants via new endpoint marks `slash` (default flow tick at source) and `diamond` (conditional flow marker at source) on `uml.flow`; message flow unchanged (`bpmn.messageflow`).
6. **Pools/lanes**: collapsed pool via frame flag `x_collapsed: true` (black-box band); lanes nest via nested frames (existing).
7. **Choreography (`bpmn.choreography@1`)**: new kind `flow.choreotask` with `x_bands: [participant names]` rendered as participant bands; multi-instance band marker via `~` suffix; choreography subprocess via `x_activity.collapsed` and markers; gateways and sequence flows shared.
8. **Conversation (`bpmn.conversation@1`)**: new kinds `flow.conversation` (hexagon), `flow.subconversation` (hexagon with +), `flow.callconversation` (thick-border hexagon); new relation `bpmn.conversationlink` (participant → conversation node); participant bands reuse the pool frame machinery.
9. **Artifacts**: `flow.group` (dashed rounded rectangle element) and the existing `flow.annotation` bracket.

## Decorator layer design

`ddn-shapes.js` gains a generic decoration pass applied by kind profile hooks: event ring + trigger icon (`x_event`), gateway inner glyph (`x_gateway`), activity border modes and marker badges (`x_activity`), boundary attachment (`x_event.position: boundary` relocates the event onto its host border, port-square precedent). Each decorator is driven by the extension contract, not by profile id, so a future CMMN profile reuses it unchanged.

## Semantic normalization and identity effects

None — notation over the existing element/relation identities.

## Alternatives considered

1. **One `bpmn.complete@2` bump**: rejected — choreography and conversation are distinct diagram families with distinct participant rules; three named profiles follow the registry's per-family convention (uml.* precedent).
2. **Event kinds per trigger**: rejected — trigger is a decoration of the event vertex, exactly what `x_event` models; 14 kinds would flood the palette.
3. **Boundary events as ports**: rejected — boundary events have their own identity and outgoing flows; they are nodes visually attached to a host border, not member endpoints.

## Compatibility and migration

Fully additive. `bpmn.basic@1` fixtures render byte-identically (new rendering paths are profile-gated). `x_event`/`x_gateway` contract growth is additive for new values; previously-invalid trigger/gateway names were rejected, so no valid source changes meaning.

## Machine schema and diagnostic changes

- Registry: +9 kinds, +2 relations, +3 profiles; regenerated assets.
- Contracts: `x_event`/`x_gateway` extended; new `x_activity`, `x_io`, `x_bands`.
- New endpoint marks: `slash` (control family), `diamond` admitted on control-family BPMN flows.
- New error codes (ceilings re-grepped: PJ174, PJW05): `DDN-PJ175` (event trigger/position semantics), `DDN-PJ176` (gateway rules), `DDN-PJ177` (x_activity misuse), `DDN-PJ178` (choreography bands), `DDN-PJ179` (conversation links), `DDN-PJ180` (data associations).

## Non-goals (declared unsupported)

BPMN XML/DI interchange, execution semantics, formal OMG certification.

## Positive and negative fixtures

`notation/tests/bpmn-compliance.js` + the BPMN family sweep `notation/tests/bpmn-showcase.js` (process, collaboration, choreography, conversation). Gallery fixture `website/examples/basics/82-bpmn-complete.ddn`.

## Open questions and decision record

- Profile split: **decided** — process/collaboration, choreography, conversation.
- Default/conditional sequence markers ride `source_mark` (the existing endpoint-mark channel) rather than a new property.
