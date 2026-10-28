# Catalogue and role defaults

Current notation is consolidated in [the language reference](09-language-reference.md) under the owner's delegation. Its concrete syntax/interpretation choices supersede unresolved notation statements below; confirmed owner requirements and remaining semantic/default-codex work still apply.

## Required outcome

Selecting a DDN subtype must select a **complete, versioned default contract**, not merely a renderer and a few preferred settings. The contract must answer what every applicable omitted property means for its workarea, view, placed view, element role, relation role, field/port/detail role and publication context. This is a language/file requirement; a reader must not invent its own undocumented defaults.

The owner has confirmed that these defaults belong in the consolidated contract. General standard defaults are hardcoded into the interpreting software by version; changing them requires a new version. The required property reference codex states the settable properties and omission results per catalogue/element. Files need not embed or remotely retrieve the general default tables. See [files and the property codex](07-files-workarea-and-property-codex.md). The resolution details and example values below remain proposed choices under file > CSS > standard.

## What a default profile identifies

A registered default profile identifies its version, method, ordered subtype lineage, selected bounded profile, applicable catalogue recipe or declared recipe combination, owner kinds and role/variant selectors. It lists its inherited default profiles, its overrides, property applicability and rule references. One declaration can select these dependencies without spelling out their values.

The lookup context is `(catalogue use, method, subtype, profile version, owner, role, role variant)`. For example, an ERD catalogue entry can select native conceptual DDN, crow's-foot or Chen routes. Those routes do not share one indiscriminate ERD default table. A mind-map root and ordinary topic can have distinct text defaults even when both use the existing `object` role.

Catalogue membership alone does not activate a preset. A view can be useful to several catalogue processes without its appearance changing when a documentation tag is added. The selected subtype supplies its normal default context. A process-specific variant is selected deliberately through its registered context; a multi-recipe context must declare how its defaults compose. Never choose the first catalogue tag, merge every referenced process, or infer a profile from the visible objects.

The final grammar must provide a short way to select that context. It must not require a full default block in each document. Naming a context selects standard-layer values; it does not promote the entire standard profile into explicit file overrides.

## Required default table

Each applicable property has a row containing:

| Field | Required meaning |
| --- | --- |
| Property and owner | Canonical property path and where the value belongs |
| Context | Catalogue/method/subtype/profile and role/variant to which the row applies |
| Type and applicability | Allowed value shape, conditions and profile restrictions |
| Omission result | Literal value, named deterministic rule, or an explicit absence/required/non-file state |
| Origin | Versioned standard/profile/role record that supplies the result |
| Override policy | Legal file override, CSS eligibility and any fixed semantic constraint |
| Evaluation time | On reading, on creation, on projection, or only in a session |
| Persistence | Authored difference, generated stored value, derived result or transient state |

There must be no unexplained blank default cell. The allowed omission results are:

- **Literal:** a specific typed value, including false, zero, an empty list or permitted null.
- **Unset:** no declaration; the property's contract specifies what absence means.
- **Unknown:** a semantic fact is undecided or unobserved. It is not zero, false or an invented value.
- **Not applicable:** the property does not belong to this owner/role/selected mode.
- **Required when:** omission is permitted until a named declaration/purpose/stage requires a value; then the file is explicitly incomplete.
- **Derived:** a named deterministic rule, with inputs and treatment of missing/ambiguous inputs.
- **Generated on creation:** a rule allocates a value, such as identity, that is subsequently saved; it is not regenerated on each read.
- **Session or host supplied:** not ordinary authored DDN file information. Its absence cannot be filled by a semantic preset.

For a conditional row, enumerate its permitted branches and an explicit fallback. Examples include body mode, chart mark, selected relation role, publication mode and optional feature activation. No arbitrary program is required to resolve a default. `Auto` must name a documented algorithm/policy rather than mean “whatever this viewer chooses.”

## Resolution order

The outer order is unchanged:

```text
explicit file declarations and eligible file defaults
    override applicable CSS
        which overrides the selected standard default contract
```

The property-specific file inheritance chains remain those in [the shared defaults contract](../../website/reference/index.html). A file setting that happens to equal today's default remains explicit. CSS importance never defeats a file setting. Invalid higher-priority declarations produce an error rather than falling through silently.

Build the standard contract in this order, from general to specific:

1. Common owner defaults and common core-type/role defaults.
2. Method defaults, including its owner/role specializations.
3. Ancestor subtype defaults, then each deeper subtype and selected profile variant in declared lineage order.
4. The selected catalogue-context specialization, if any, including its owner/role/variant specializations.

At each context level, an exact role/variant rule specializes a general rule for the same target. A more specific context replaces an earlier applicable standard value. Context records must explicitly resolve competing equally specific declarations; a conflict is a defective default profile, not permission for readers to choose different answers. Inheritance is acyclic and versioned. The expanded effective table records the winner and its origin for every property.

Method/profile validity constraints remain separate from preferred values. A preferred routing style may be overridden where the selected profile admits alternatives; an endpoint constraint cannot be waived by changing a color or declaring a different default. A retained profile that permits only one layout marks that setting as constrained, rather than pretending it is freely overridable. Selecting another compatible profile is an explicit change of contract.

CSS eligibility remains property-specific. Styles can change permitted presentation; they cannot select semantic domains, invent cardinalities, turn unknown measurements into facts, change relation meanings, assert acceptance or grant authority.

## Semantic ownership across views

One shared definition may appear in several views with different default presentations. Its font, visible details or local routing may differ by occurrence. Its identity, field type, domain assignment and relationship facts must not depend on which view is reading it.

Semantic omission rules therefore belong to the definition's own declared type/role contract. View/catalogue defaults may choose an initial role or offer a creation preset, but an actual selected semantic value must become part of the definition's declared contract or explicit stored content. A second view cannot reinterpret an unstated domain as a different domain.

Creation, persistent omission and derived presentation are distinct. The designer's first-entity placement in the current viewport is a creation rule; when it creates an explicit position, that position is saved. An authored `position: auto` uses its selected documented layout rule and cannot depend on whichever reader's viewport happens to open the file. Likewise, generated identities are saved, while a displayed `<table>` placeholder does not become the entity's name.

## Worked mind-map and ERD comparison

The table below specifies concrete proposed defaults for comparison. `ddn::mindmap` is an illustrative subtype spelling bound here to the existing bounded `mindmap.basic@1` contract. `ddn::erd` is an illustrative native conceptual context over `ddn@1`, not an alias for Chen or crow's-foot. Final grammar and registrations remain part of the consolidated language work.

| Concern | Native mind-map example | Native conceptual ERD example |
| --- | --- | --- |
| Catalogue use | C093/C131; retained mind-map capability BF056 | C088; native progressive ERD |
| Selected profile | `mindmap.basic@1` | `ddn@1` with the native ERD context |
| View layout | `mindmap` | `grid` for unplaced objects; explicit placements remain respected |
| Automatic placement | Enabled | Enabled for objects without explicit placement |
| Connector routing | Curved, Bézier | Orthogonal |
| Layout gaps | 64 local units between levels/rows | 64 local units between grid positions/rows |
| Normal new subject role | `object` used as topic | `table` used as entity |
| Initial body | Title only | Title only; fields are not required |
| Visible composition sections | Name | Name/type/table/notes are available; the title-only body initially suppresses detail rows |
| Ordinary topic/entity text | Sans, 16 local units, weight 400 | Sans, 16 local units, weight 400 |
| Root title specialization | Size 20, weight 600 when the selected branch graph has one identifiable root | Not applicable; an ERD does not acquire a root because it occupies the center |
| Unnamed title | Proposed display placeholder `<topic>` | Required native display placeholder `<table>` |
| Optional field display | Hidden until explicitly selected and permitted by its role | Columns initially show field name; name/type/domain/constraint/key/comment can be selected independently |
| Domain, type and key facts | Unassigned unless the selected role/source declares them | Unassigned; no datatype, primary key or domain is fabricated |
| Relationship details | Selected `assoc` role and its ordered endpoints define the branch structure | Selected relationship role; cardinality remains unspecified when not declared |
| Initial design state | Draft | Draft |
| Drawing look | Classic | Classic; choosing draft does not automatically choose handdrawn |
| View background | Transparent | Transparent |
| Workarea background | `#f2f4f7` | `#f2f4f7` |
| Grid and snapping hints | Hidden grid, spacing 32; grid snap off | Hidden grid, spacing 32; grid snap off |
| Publication defaults | Selected content, full notes, no guides, coherent snapshot | Same; a valid conceptual diagram need not become a deployment-ready schema |

Both inherit the remaining applicable shared surface values from the versioned common contract. That includes opacity, borders, padding, minimum sizes, publication margins, text fitting and explicit asset/error policies. A final expanded profile must list those inherited values with provenance; “same as common” is a compact authored profile definition, not an excuse to omit them from the reference tables.

The retained `mindmap.basic@1` profile has a one-root, at-most-one-parent, acyclic completion rule and requires mind-map layout. Those are explicit restrictions of that bounded profile, not rules imposed on every future DDN brainstorming subtype. In draft, unresolved/incomplete structure remains diagnosed. The native conceptual ERD does not acquire crow's-foot cardinality requirements; explicitly selecting `erd.crowfoot@1` activates that separate contract.

The ERD grid preference, root-title size and topic placeholder above are new proposed presentation choices. They do not change source labels or add a new core element type. Other existing diagram profiles retain their distinct symbols, role contracts and completion purposes.

## Minimal notation and full control

These are explicit author-intent sketches, not a finalized parser grammar. The subsequent [readable authoring proposal](02-readable-authoring.md) removes repeated type words and wrappers from the ordinary short form:

```text
view Planning ddn::mindmap
    topic Product
        topic Customers
        topic Delivery

view Data ddn::erd
    entity Customer
    entity Order
```

In the mind-map sketch, indentation would be an explicit branch-relationship shorthand, not merely a placement hint. The grammar must specify its exact expansion into typed relationships. The ERD sketch makes no relationship claim between the two entities just because they share a view.

Only intentional changes need additional properties, for example choosing serif entity-name text, a background image, handdrawn appearance or domain/key detail columns. Shared preferences can be stated once at file/workarea/type scope; one occurrence can override eligible properties locally. A reused style sheet supplies the CSS layer. These choices must preserve the document's semantic information and declared method limits.

“Full flexibility” here means complete control over every declared overridable property, with its exact scope and type documented. It does not mean every property belongs to every element or that a presentation override changes what a relationship means. Unsupported settings and missing required facts must be visible rather than silently ignored.

## Versioning and omission preservation

The file contract must identify the version whose built-in defaults interpret omitted values. The exact version declaration and omitted-version rule remain to be finalized; each element need not repeat the version. A short subtype name cannot silently mean “the newest installed defaults.” A standard-default change requires a new version, while an ordinary file or CSS override does not change the standard. Stylesheet dependencies similarly have an identified source/revision when capturing a reproducible publication.

Saving normally preserves omissions and explicit overrides. An expanded defaults report or frozen snapshot is a separate representation. Never write all resolved values into ordinary source simply because they were displayed; doing so would prevent a later deliberate stylesheet/profile change from taking effect. Never remove an explicit value merely because it currently equals the standard.

Changing a default-profile version is an explicit document/dependency change with an effect report. Unknown required profiles or versions are reported as unresolved; readers cannot substitute another profile and claim equivalent meaning. No legacy grammar or backwards-compatibility layer is required by this policy.

## Completion gate for the consolidated contract

For every included catalogue route, and every permitted owner/element/relation/member role in that route, provide both a compact inherited definition and a fully expanded default/applicability table. A catalogue route with no distinct defaults can explicitly reuse another contract by exact version. An excluded process is recorded as excluded rather than assigned fictional defaults.

Completion requires:

1. Every legal property has exactly one omission result for each applicable condition; unsupported/inapplicable properties are identified.
2. Every inherited result traces to a versioned standard source; conflicting defaults are resolved explicitly.
3. Semantic facts cannot change when the same definition is placed in another view.
4. Minimal and explicitly expanded examples mean the same thing under the same dependency versions.
5. File, CSS, catalogue-context, subtype and role overrides have examples, including false, zero, null, empty lists and resetting to inheritance.
6. Required facts, incomplete drafts, fixed profile constraints and transient viewer state cannot be disguised as harmless defaults.
7. Every included requirement has a file representation without an undocumented reader convention.

The existing shared catalogue contains 262 properties and 550 owner bindings, and the profile pack supplies partial standard overrides for all 151 profiles. Those are inputs to this expansion. This chapter and its two worked override sets establish the required structure; they do not claim that the full per-catalogue/per-role expansion or the entire file contract is already complete.
