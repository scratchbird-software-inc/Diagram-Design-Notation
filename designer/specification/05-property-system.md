# Simple property editors with exact scope and serialization

**DDN Designer specification 0.1 — proposed; baseline audited 0.5.0-draft.2.**

## Three scope layers
Every control has one declared write scope: **model**, **view**, or **session**. Model edits change shared definitions. View edits affect only the chosen representation or its explicit local override. Session preferences include pan/zoom and panel state and are not semantic changes. Shared format edits are a separate explicit action, never the default consequence of clicking a style button.

Display the inherited source of a value: “From format/common.ddn,” “View override,” or “Model property.” A reset icon removes the local assertion/override; it does not write a guessed default. If an inherited value changes later, the reset value follows its new source.

## Value states
Distinguish unset, undecided, not applicable, known value, conflicting evidence, mixed multi-selection and known-but-hidden. Null is a data value, not a generic unset marker. A checkbox may represent only an actual boolean; an optional boolean must offer “Not set.” A number field must retain units. In a sample grid, missing and null have different selectable states. Do not auto-convert an identifier such as “00102” to a number.

## Property descriptor
A descriptor supplies: stable UI id; friendly label; help/meaning; exact target types; scope; typed command adapter; widget; defaults; allowable value states; visibility predicate; priority; group; reference picker constraints; validation code mapping; batch applicability; source provenance; registry/profile version; destructive-change warning. Conditions use a small data AST (all/any/not/equals/hasCapability), not executable JavaScript.

UI descriptors do not replace semantic validators. They may hide inapplicable inputs, but the command bus and core must reject invalid transactions regardless of UI. Every descriptor must say whether the source binding exists in 0.5, requires a wrapper or requires new core support. The generated kind index is a navigation map, not proof that every proposed adapter is implemented.

## Specialized editors
- **Fields:** reorderable tree; name, key/presence/domain summaries; detail drawer for type, nullability, constraints and nested members. Datatypes remain optional.
- **References:** search label, kind and source; distinguish an existing definition from creation of a new definition. Stable references are serialized, not display-name strings.
- **Units:** value plus declared unit; no display-only unit conversion affecting the semantic value.
- **Cardinality:** two endpoint-specific controls with a sentence preview: “For one Customer, 0..many Orders.” Zero/many symbols are not row counts.
- **Conditions:** typed predicate builder with explicit source/parameter domain, not a code textarea mislabeled validated rule input. Implemented for decision rules in the prototype (ED-007): enum inputs select declared values (multi-select for `in`), number inputs use an interval form (min/max with closure flags) or typed `eq`/`in` values, boolean inputs choose true/false, and `null`/`missing` operators appear only when the domain declares `nullable`/`optional`; the scratch re-plan (DDN-QD002) stays the authority.
- **Series/scales:** bound record selectors, unit checks and explicit missing/aggregation policies.
- **Scope:** relation-aware membership picker; namespace, placement, ownership and layout-group membership remain separate.

## Commit behavior
A short label commits on Enter or blur only if valid; Escape restores the previous draft. A complex record/sheet commits on Apply after a full transaction preview. Continuous sliders show previews and make one history entry on release. A blur caused by deleting an object must not unexpectedly commit a different property. Errors are adjacent to the control and appear in Problems with a stable code.

Multi-selection uses the intersection of applicable adapters. Apply a mixed value only after explicit entry; never coerce missing values. Removing a property is distinct from setting it to blank. A property edit affecting many views shows its impacted scope before destructive or meaning-changing changes; ordinary label edits can use a persistent shared-scope banner and an undo affordance.

## Sample journal-line inspector
Meaning: Name, Table kind, Fields list, Description, optional Maturity. This view: detail level, kind indicator, inherited style, size and pin. Field detail: Name, Domain, key role, presence, null policy. Relationship detail: semantic source `journal` or `account`, target field, multiplicity and enforcement. There is no freehand “move this relation to a different field because it looks nicer” action.
