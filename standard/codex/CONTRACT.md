# Reconciled DDN file, property and default contract

This is the complete **specification candidate** for `ddn-next-1`, based on retained runtime **0.8.0**, the fixed unified vocabulary and the owner's later language decisions. It does not claim that a new parser, viewer, designer, verifier, collaboration service or output adapter has been implemented. The version denotes this unreleased contract; it is not a declaration that DDN 1.0 has shipped.

The authoritative bundle is this document, `ddn.schema.json`, `property-codex.json`, `default-resolution.json`, and the core, relation, role, profile and catalogue indexes in this directory. The [language reference](../language/09-language-reference.md) supplies source spelling. Earlier generated surface schemas are a historical baseline. Where this reconciliation changes them, this pack controls. The [reconciliation ledger](RECONCILIATION.md) records the changes and inferred choices.

The owner's [mind-map correction](MINDMAP-RULES.md) specifies horizontal branch
attachments, tree membership, external context links and designer selection
controls. It supersedes conflicting retained mind-map presentation restrictions.

## Reading the codex

A property is identified by **owner plus path**, not by its path alone. Each entry supplies its schema, default or absence rule, CSS eligibility, persistence class, meaning, version and provenance. Limits and enum values are in the referenced JSON Schema definition. Structured members, such as a column's `min_chars`, have their own index. A `literal` value may be omitted from source; an explicit equal value is still retained when saving. `absent` is a deliberate specification choice: no value or semantic assertion is manufactured. `context`, `generated` and `derived` identify the stated calculation instead of pretending there is one universal literal.

The schema is a **normalized data contract**, not a requirement that people author JSON. Source `with` blocks, short diagram forms and dotted table rows decode to these records. References, quantities and generated identities normalize before schema validation. JSON Schema `default` annotations are documentation; readers must implement the codex resolver, rather than assuming a schema validator inserts defaults.

The maps are exhaustive over the fixed inventory:

- `core-contracts.json`: all 55 core types, typed payloads, completion constraints and property IDs.
- `relation-contracts.json`: all 94 patterns, typed qualifiers and endpoint semantics.
- `role-contracts.json`: all 375 retained element roles and 185 retained connector roles, exact metadata targets, payload bindings and registered rendering defaults.
- `profile-contracts.json`: all 151 retained profiles, legal palettes, endpoint contracts, exact projection property lists, standards, rules and bounded output contracts.
- `catalogue-contracts.json`: all 308 catalogue entries, their decisions, selected core types/relations, available profiles, view contracts, workarea routes and application modules. Empty catalogue overrides explicitly mean that the referenced complete defaults apply. They do not mean an omitted design decision or permission to use every role.
- `view-workarea-application.json`: the 22 view contracts, method/workarea alternatives and open/closed application requirements inherited from that inventory.

GO/NO-GO and open/closed scope remain those of the catalogue. Representing a closed-system session or delivery in a file does not grant participation, send anything or create a server dependency for the open viewer.

## Physical files and identity

The file schema has one optional `workarea` object; omission creates an implicit native workarea. It never has a `workareas` array. The first-opened file supplies the only active workarea. Every reachable included file contributes its views, data and definitions; an included workarea's settings/defaults are inactive. WA01 and WA02 are alternative rule contracts, not simultaneous workareas.

The active workarea may explicitly set `mode standalone`; omitted `mode` retains `workarea`. Standalone contains exactly one view or output document across the reachable include closure and exposes only that view. Its effective extent grows and shrinks with that view; authored workarea extent, placements and navigation cannot expose another surface. Extra views/documents are a structural error at every lifecycle state. Zero views are allowed while draft/in-progress creation is unfinished, but block review/acceptance. Included-file workarea modes are inactive. `mode` is file-authored only, not CSS or defaults-block eligible.

`bundle` is an exchange/test envelope with an entry location and physical files, not another source-language workarea syntax. Resolve relative paths against their containing file. Deduplicate canonical locations before traversing the include graph. Include-file cycles are legal; recursive document inclusion, template expansion and semantic ownership cycles are not. External references may target only the entry file or an explicitly included file.

`name` is an optional declared reference name, unique after NFC normalization throughout its physical file. `title` is display text and may repeat. Names remain case-sensitive. `id` is a stable generated identity, optionally stored by the designer, unique within its source-file identity. A reference is `{name}` or `{id}`, optionally with `file` and `revision`; supplying both name and id requires them to resolve to the same target. File qualification remains required outside the declaring file; inclusion does not flatten name scopes.

Column headers, row field names and ordinary cell text are **data**, not additional file-level declarations. Converting an ERD field list creates field identities; duplicate displayed names such as `Key` in different entities do not create colliding file names. An `at Key` endpoint resolves within its already identified entity and normalizes to that field's identity. A globally named field declaration still follows file uniqueness. `<table>` is an unnamed-entity display placeholder, never an automatically declared name.

`core::Workarea`, `core::View`, `core::Appearance` and `core::Document` use their dedicated workarea/view/appearance/document routes. They cannot create a second structural hierarchy inside generic definitions. Other core types and retained roles use the definition route. A declared role must belong to its element/relation category; changing the category cannot bypass its schema.

## Defaults and CSS

The owner priority remains **file > CSS > standard**. Within the file tier, eligible values are considered in this descending order: explicit occurrence, explicit shared definition, matching view defaults, matching active-workarea defaults, declaring-file defaults. Ignore inapplicable providers. Included-file workarea defaults are never another active tier. An explicit leaf wins over defaults; a matching typed filter wins over an unfiltered rule at the same scope; otherwise later source order wins.

The standard tier combines general/owner defaults, selected view/profile conventions and exact role defaults. A profile constraint is not merely a suggested default: for example, setting a mind-map's algorithm to a non-mind-map algorithm produces a profile violation. Style changes cannot weaken that constraint. An existing profile's declared derived value is an algorithm, not a literal string: histogram `bin_count: auto` resolves to `min(40,max(5,ceil(sqrt(n))))` for its validated input count.

Backgrounds, typography, geometry and other visual settings use the baseline values unless a later owner decision changes them. Examples: classic look; sans family; 16 local-pixel font; layout grid 32; general graph layout `auto`; mindmap profile layout `mindmap`; transparent view backgrounds; workarea background `#f2f4f7`; publication page background white. Native ERD starts with a title-only body and a visible `field` column when columns are enabled. The logical ERD data keys are `field`, `type`, `domain`, `key`, `comment`; legacy `name` detail display maps to `field`.

New native core types have an explicit neutral card fallback, with their core type token and label; native core connectors have explicit line/arrow defaults and a visible relation-type label. These defaults are in the core/relation indexes and do not borrow foreign-method glyphs. Role color/fill/line width remain role-specific. Glyph identity, endpoint meaning and method silhouette are registry conventions, not arbitrary CSS substitutions. Per-role `render.*` entries record those exact values. Retained facet metadata can describe domain evidence/operational state, but legacy maturity tokens cannot set the four-state design status or its status badge.

The source selector owners `element` and `relation` normalize to `owner: definition` plus the corresponding category; `view` normalizes to `view_definition`. A selector may additionally restrict source file. These are selector aliases, not new owner types. CSS accepts only registered CSS-eligible property paths for the matched owner/profile/role. A name matching an unrelated property on another owner does not authorize it. Custom-property names replace dots and underscores with hyphens after `--ddn-`, e.g. `style.font_size` → `--ddn-style-font-size`; the generated CSS map checks collisions. `!important` only changes order inside the CSS tier. It never beats file settings. CSS cannot supply names, semantic payloads, sources, permissions, lifecycle state or acceptance.

Record properties merge by eligible leaves; an empty record contributes no overriding leaves. Lists replace the inherited list as a whole, including an explicit empty list. Removing an explicit property resets it to omission. Null is not a reset and is allowed only on nullable properties. Absent semantic facts remain absent even if a presentation default displays a placeholder. Semantic identities, facts, lifecycle state and acceptance do not inherit from a parent, stylesheet or defaults block.

All standard changes require a new language/defaults version. Included files must use the same contract version; there is no silent reinterpretation using the viewer's newest defaults.

## Sparse definitions and completeness

Draft and in-progress content can omit semantic information. Every supplied value must still use its registered type; a draft is not a way to attach arbitrary unqualified executable properties. Source statements with an unfilled scalar are preserved in `incomplete` with their property path/raw text. That record is distinct from an intentionally omitted optional property and blocks review.

Core payloads are under `content`; relation qualifiers under `qualifiers`; retained extension records under `metadata`; retained data-model properties under `properties`. The exact registered role selects each schema. `json_record` is permitted only where keys are actual application data (e.g. `x_record`, values, algorithm parameters or explicit extension data), not as a generic escape from property validation. An extension additionally identifies its namespace, version and registered schema; its data must validate against that schema before it affects a completed view.

An element's generic `with` property goes to the codex's canonical owner/path. Short relation endpoint properties such as `source.cardinality` normalize to `qualifiers.source.cardinality`; they do not conflict with a data source declaration. Numeric cardinality `1` means exactly one; named multiplicities and explicit min/max records are also accepted. Absent cardinality asserts no constraint. Existing structural endpoint rules and profile restrictions still apply.

Completeness is evaluated for the selected view, purpose, roles and data revision. A conceptual native ERD entity may legitimately have only a title. It is not required to invent columns or SQL types to be reviewed. A numerical observation, executed run or accepted event has different mandatory facts. `complete_ELxx` schemas specify minimum payload completeness; profile rules add requirements. An event occurrence requires its observation time/source; a ballot submission requires its instrument and choices; an actual run/result records input revisions and provenance. These do not get semantic zero/false defaults.

All retained profile rules, semantic owner predicates and algorithm limits remain normative. JSON Schema handles shape, types and dispatch; the shared verifier additionally handles allowed owners, references, endpoint combinations, arity, cycles, units, source completeness, mathematical rules and selected-purpose checks. Keeping these responsibilities separate is necessary: a schema-valid set of individual edges does not prove an acyclic mind-map.

## Table data, sizing and fitting

A local data header determines its columns and the designer's detail menu. A view header is a template only. An explicit `fields` list contains no header; its first line is a field. Draft text, structured data, body mode and status are separate properties. Conversion does not discard the original text or silently invent missing cells.

The compact header order is `column:alignment:percentage:min_chars:max_lines`. Empty colon slots use their defaults. Alignment is one of `rt rm rb lt lm lb ct cm cb ft fm fb`. Dot separates data cells outside quotes. Empty cells and missing trailing cells normalize to null; quoted empty text remains an empty string. Extra cells are diagnosed. A literal table row occupies one physical source line; display wrapping does not create source rows.

Text columns may opt into `format: inline-markdown`; their default is plain text. New inferred cell defaults are `lt`, automatic percentage, minimum **1 character**, maximum **6 lines**. The previously suggested 19-character width is an example, not a mandatory global width. Existing mind-map narrative body height retains its separate 10-line cap; it is not a table-cell setting. Optional `max_chars` is an additional wrap-width ceiling and cannot be below `min_chars`.

Character units use the advance of `0` in the default font at its default size; a line uses that font's computed line height. Bold/italic runs affect measured wrapped content, not the unit itself. The fallback metric/provenance rules remain those of text measurement; required publication metrics cannot silently switch to guesses.

Resolve only displayed columns, in their displayed order:

1. Without percentages, share 100 equally.
2. With automatic columns, divide the remainder equally among them.
3. Above 100, progressively cap the largest allocations; tied leaders reduce equally, joining the next-largest group when reached. Stop at 100. Do not proportionally rescale every column or empty one leader while another remains larger.
4. If every displayed column has a percentage and the total is below 100, add the remainder to the rightmost displayed column.
5. Keep full precision for logical allocations. Rendering rounds pixels by largest fractional remainder, ties in displayed order. Stored percentages are unchanged.

Minimum constraints are tested against the resulting shares. If the table cannot fit, replace it with the agreed shaded table-presence square. Do not silently crop cells, resize unrelated columns or invent data. Text exceeding the line cap displays an ellipsis with the complete value retained for inspection/publication. Publication data exports use full values and rows regardless of viewport ellipsis.

## Data sources, notes and templates

Inline datasets and source-bound datasets share column/row types. Supplied structured provider rows are not reparsed as textual headers. Host sources name a channel and receive coherent revisions; file sources require path/format before reading and default to manual refresh. Calculation sources reference a registered calculation definition and never execute a program merely because a file was opened. All source bindings are read-only here; active editing/execution is a separate application capability.

Replacement is the default update mode. Keyed updates require explicit stable key columns. Schema and rows update as one revision. Failure retains stale data visibly; no successful revision means unavailable, not a fabricated empty result. Reference persistence saves the binding only. Snapshot persistence saves a typed `snapshot` containing columns, rows, revision and capture time. Raw external newline data is preserved, with spaces used for single-line table display. Inline textual rows cannot contain literal line breaks.

Notes retain raw text, optional name and display title. The language's bounded CommonMark profile, headings and `++underline++` interpretation apply; formatting never changes a typed field's value. Consecutive prose lines belong to one paragraph; blank lines separate paragraphs. Dedicated `text.format`/content-format settings turn formatting on or off where applicable.

A template stores a role, typed parameter declarations, settings and an optional model fragment. Source `style.font parameter typeface` normalizes to a settings entry with a parameter reference. On expansion, substitute parameters, verify the resulting property's actual type, allocate deterministic instance identities, then apply explicit instance settings. Unknown parameters, type mismatches, missing required arguments and recursive expansion are errors. Template metadata itself is not copied as target element content. Omitted template version uses this file contract version; materialized instances record it for provenance.

## Views, documents, publication and viewer state

A document is a `kind: document` entry in `views`. It inherits view identity/status/default rules and adds targeted output settings, ordered sections and metadata. `use` sections reference views/text/assets/data, preserving source identities. There is no parallel `documents` hierarchy. EL31 is the document-view anchor; EL42 remains a publication/capture job, followed by immutable artifacts and separate delivery records.

The explicit output format chooses its recipe. PDF/DOCX/ODT default to A4 portrait; HTML/Markdown/data/diagram outputs use content extent; ordinary standalone publication jobs retain the existing figure standard. Dashboard defaults to live supplied data; static formats capture a coherent revision. CSV has exactly one ordered data projection. JSON preserves typed values and source identities. Local artifact production never sends or publishes anything remotely.

Page, background image/color, cropping, font minima, embedding scales, asset completeness, partial/stale handling, links, accessibility, headers/footers and capture settings retain their codex types. Existing SQL and Vega-Lite exports remain bounded adapters, not promises of complete foreign-model interchange. Unsupported capabilities or fidelity loss must be reported rather than silently omitted.

The `viewer` schema is session state, validated separately. Its camera, selection, viewport, preview, playback, loaded revisions and host authority do not become file properties. The open viewer remains read-only even when receiving live updates. The designer adds editing; the verifier is shared. Server paging, collaboration and managed delivery are closed capabilities, without changing file identity or granting privileges from source text.

## Status, acceptance and commands

The only design states are `draft`, `in-progress`, `in-review`, `accepted`, all set by a user. The context-menu setting drives the status icon beside the diagram/type icon. No independent authored badge can contradict it. Artwork is an implementation asset choice; the stored icon key is already determined by state.

Normal progression is Draft → In-progress → In-review → Accepted. Exiting Draft is one-way. In-review can return to In-progress. An authorized user can return Accepted to In-review or In-progress. There is no return to Draft. Review entry and acceptance require current complete successful verification. Acceptance additionally has an offset-qualified timestamp `at` and nonempty user identity `by`. The file records attribution, not proof that an identity is authenticated; the application supplies authority.

Reopening moves the current event into ordered `acceptance_history` and removes `acceptance`. A new acceptance creates a new event. A verifier never silently promotes/demotes the stored state. Changed live data can make evidence stale while the stored state remains Accepted; both facts must be visible. Existing accepted history is retained.

The inferred editing policy remains explicit reopening of protected semantic scopes. Pure presentation edits need no reopening unless presentation was included in the acceptance scope. Shared edits cannot silently bypass a dependent protected scope. Current verification and authorization are host/runtime evidence, not writable source properties or CSS settings.

## Validation and implementation boundary

`validate_codex.py` uses the actual JSON Schema Draft 2020-12 implementation plus local specification checks. Its evidence lists every result and limitations. It validates default types, all inventory routes, positive/negative file shapes, includes/names, sampled role/endpoint semantics, lifecycle transitions and the owner's table algorithm, including deterministic stress cases. It does not claim to run all 151 retained mathematical verifiers or renderers. Those exact rule contracts and baseline source references remain required implementation checks.

The next implementation can consume this pack without inventing additional property names or silent default values. Implementing text decoding, complete profile algorithms, UI behavior, adapters, persistence and authority remains separate software work. New capabilities outside the fixed catalogue need their own versioned registration and specification.

## Rendering restoration correction — 2026-10-24

`flow.offpage` admits the existing `x_continuation` and `x_record` metadata groups, alongside `x_pin`. Its previous role-specific admission omitted the continuation identity and page-reference information required by the retained flowchart profile. The full and partial role schemas, role contract, generated DDN registry and portable Weaver schema are reconciled together. This is an additive metadata-admission correction; it changes no versioned default or verification rule.

The owner-corrected [symbol presentation](SYMBOL-PRESENTATION.md) contract adds unboxed artwork/text modes and optional caption positions without changing semantic roles.

View surface layout is independent of diagram profile: [VIEW-SURFACES.md](VIEW-SURFACES.md) defines `surface.preset`, dynamic omission and fixed TV dashboard recipes. Fixed dimensions remain stable as content changes; CSS and file settings override recipe defaults. Physical-page and presentation creation choices are unavailable in the open designer.
