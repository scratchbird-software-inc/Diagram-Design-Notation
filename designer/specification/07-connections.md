# Drawing, reconnecting and explaining relationships

**DDN Designer specification 0.2.0-beta.1 — proposed; baseline audited 0.6.0-beta.1.**

## Connection state machine
`idle → source-selected → target-candidate → type-choice → draft-preview → committed` with explicit cancellation at every precommit state. Drag and two-click Connect use the same state machine. A keyboard flow chooses source object/field/port, relation meaning, target and endpoint properties. Touch users are not required to hold and drag a tiny port.

## Before drawing
On hover or focused selection, expose sparse connect affordances. On a data structure, show field-level handles only for visible rows or the selected field. Otherwise show body/declared-port affordances. Do not place permanent handles on every row in every object. The hit region can be larger than the visual port without affecting the exported SVG.

## Semantic versus visual endpoint
A semantic endpoint is `{elementId, memberId?, role}`. A visual attachment is `{occurrenceId, sidePolicy, fractionPolicy, anchorPolicy}`. A field reference may allow east or west contours while keeping the same field identity. Automatic routing may reorder compatible free anchors, but it must not exchange `journal` and `account` or bind to another port.

Always display the semantic path in the relationship inspector. When its row is hidden, use a named proxy port with tooltip/keyboard description identifying the field. The relationship key and source continue to identify the original endpoint.

## Candidate filtering
Start from installed profile rules plus source/target kinds and endpoint roles. Rank compatible meanings and the user's current tool context. Show a short list such as References, Flows to, Depends on, Describes—not 109 verbs. A rejected target includes a plain-language reason. Colour alone is insufficient. Filtering is advisory; the command engine validates the complete candidate source before commit. Do not infer a foreign key from equal field names.

The default generic relation is permitted only in a generic sketch profile and visibly says “Association — meaning not further specified.” A precise profile must request the missing relation meaning rather than invent one. Field references initially leave enforcement undecided unless explicitly selected; they do not assert a database constraint by being drawn.

## Reconnection and inversion
Dragging an endpoint is a `ReconnectRelation` command. If the semantic target changes, show the before/after field or object and affected views. Moving the visual anchor along the same compatible boundary is only a `SetAttachmentPolicy` command. These are different modes and cursors. “Reverse” changes the directed semantic relationship and validates endpoint compatibility; merely flipping an arrowhead is not allowed for fixed notation.

**Implementation status (ED-008):** endpoint reconnection is implemented in the prototype — drag a selected edge's endpoint onto another object or field, or pick the new endpoint in the relation inspector (the keyboard/click equivalent). Both paths show the five-part shared-impact preview (source owner, exact before/after endpoints, affected views, scratch re-render diagnostics, retained identity/route overrides) and commit one atomic, revision-checked source transaction that preserves the relation's id, label and properties; invalid targets reject with a plain-language reason before anything writes. Attachment-policy editing and Reverse remain proposed.

Cardinality is authored by endpoint meaning, not which side looks left. Two directions are two separate relations unless a registered symmetric kind explicitly says otherwise. Parallel relations retain identities and independent labels. Self-references are supported with the same endpoint policies and router constraints.

## Append and insert
Add related may atomically create a definition, occurrence and relation with a type-specific template. Dropping a process onto a control-flow edge can propose an explicit split if the profile allows it. Dropping a table onto a field reference must not split that reference. An insert preview lists the removed/retained relation and generated edges, preserving comments/metadata by an explicit mapping.

## Route editing and optimization
Default to automatic endpoints and routes. Show “Automatic; semantic field fixed” rather than four low-level coordinates. Advanced route editing can add a strict waypoint or side/fraction constraint; show lock icons and a Reset route action. Existing automatic pipeline order is preserved: anchor trials, compatible endpoint ordering/side adjustment, permitted free-node moves, bounded short detours, then gap/jump marks. The earlier Complete and Journal Line regressions are mandatory fixtures.

A geometric crossing never implies connection. A junction appears only from an explicit supported connection structure. Long detours are reported as review candidates even if there are no crossings. Manual guides are not erased to make the warning count smaller.
