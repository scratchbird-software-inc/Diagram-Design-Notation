# Consolidated DDN language and file contract

**Public ddn-next-1 edition.** These adopted contracts accompany the implemented standalone utilities. Earlier planning/baseline descriptions below preserve design provenance; they are not the current implementation status. Use [the maintained documentation](../../docs/README.md) and [qualification limits](../../docs/DDN/IMPLEMENTATION.md). Historical 0.8 source and evidence are not runtime dependencies.


This specification work defines the information a DDN document carries and what that information means, independently of the software reading it. The owner requires compact notation with comprehensive catalogue, subtype, element and relation defaults, so ordinary files contain only their content and intentional differences.

The owner has authorized the remaining notation to be inferred. Start with the [consolidated language draft](09-language-reference.md), [grammar](10-grammar.ebnf), [inferred decisions](11-notation-decisions.md) and [coverage inventory](12-notation-coverage.md). They settle the remaining spellings and routine interpretation choices without reopening confirmed owner requirements. Chapters 01–08 preserve the requirement detail and history; chapter 09 supersedes their unresolved or competing notation proposals.

The [completed property/default codex and reconciled schemas](../codex/README.md) now supply the per-catalogue expansion, typed core/role payloads and file/status/data contracts. Read that pack with chapter 09; the notation audit alone does not prove software implementation. One active workarea, source-file name scope, output document views, built-in versioned defaults and the four user-set statuses remain controlling.

| Chapter | Status and purpose |
| --- | --- |
| [Default profiles](01-default-profiles.md) | Defined requirements and proposed resolution contract for complete per-catalogue/per-role default tables; worked native mind-map and ERD comparison |
| [Exact information schemas](../codex/ddn.schema.json) | Reconciled normalized file schema, core payloads, relation qualifiers and exact retained role/profile dispatch |
| [Readable authoring](02-readable-authoring.md) | Few-line authoring rationale and examples; current declaration/literal/reference choices are consolidated in chapter 09 |
| [Table fields and display columns](03-table-fields-and-columns.md) | Confirmed single-line rows, wrapping/ellipsis, shaded-square failed-fit indicator, progressive tied-largest reduction, equal automatic shares, rightmost expansion for all-percentage totals below 100 and four optional colon settings measured with the default font |
| [Element data and sources](04-element-data-and-sources.md) | Confirmed first-row headings and data-derived column menus; separate data requirement with proposed named datasets and dynamic source references |
| [Quoted and formatted text](05-quoted-and-formatted-text.md) | Accepted single/double quotes, enclosing-quote doubling, Markdown formatting, underline extension and headings; bounded additional Markdown features and detailed text rules in progress |
| [Indented notes and status](06-notes-and-status.md) | Confirmed indented notes body and paragraph flow; a separate icon driven by user-set status, with artwork still to decide |
| [Files, workarea and property codex](07-files-workarea-and-property-codex.md) | One main workarea, included content, file-qualified names, document views, built-in versioned defaults, property-codex requirements and one-way Draft-to-In-progress conversion |
| [User-set status and acceptance](08-status-and-acceptance.md) | Draft, In-progress, In-review and Accepted; completeness/verification for In-review; acceptance date/time/user and authorized returns to review/progress |
| [Language reference](09-language-reference.md) / [grammar](10-grammar.ebnf) | Complete notation draft for declarations, properties, includes, values, data, text, relationships, output, templates, lifecycle and DDN/DDNA/DDNN composition |
| [Inferred decisions](11-notation-decisions.md) | Concrete choices made under the owner's delegation; distinguishes them from explicit owner decisions |
| [Notation coverage](12-notation-coverage.md) | Enumerated routes for all 151 retained profiles, 375 element roles, 185 relation roles, core vocabulary and property trees; bounded audit, not implementation evidence |
| [Semantic persistence contract](../codex/CONTRACT.md) | Typed records, file identity, status/acceptance, document views, dynamic data and versioned defaults reconciled; software implementation remains separate |
| [Information coverage](../codex/CATALOGUE.md) | All 308 catalogue entries mapped to fixed element/relation/property/view/workarea/application contracts; preserves inclusion decisions |

The [default profile examples](examples/default-profiles.json) describe two concrete proposed sets of overrides and their inherited sources. They are early worked examples; the completed codex now supplies the authoritative settings and inherited defaults for every registered catalogue/role.

The [short authoring examples](examples/README.md) demonstrate the non-technical entry point. The [consolidated examples](examples/consolidated/README.md) exercise includes, shared views, documents, source bindings, notes, fields, lifecycle metadata and templates under the current draft. They are specification fixtures, not inputs supported by the old parser.

Source authorities: [unified model](../../website/reference/index.html), [existing profile contracts](../../website/reference/profiles.html), [shared properties](../../website/reference/index.html), [file/CSS precedence](../../website/reference/index.html), and owner decisions (historical specification citation). All artifacts remain in the dedicated DDN workarea; no reading/rendering software is implemented by this pack.

Historical evidence/source snapshots cited in this chapter are excluded from the standalone distribution. Current behavior and qualification are documented in [the public project](https://github.com/scratchbird-software-inc/Diagram-Design-Notation).
