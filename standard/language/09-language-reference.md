# Consolidated DDN notation draft

This is the current author-language draft, completed under the owner's instruction to infer the remaining notation. Explicit owner decisions remain controlling. The inferred choices are recorded in [the notation decisions](11-notation-decisions.md); they are concrete drafting decisions, not a request for individual approvals. This chapter supersedes unresolved notation questions and competing spelling proposals in chapters 01–08. It specifies a language, not an implemented parser or a completed property/default codex.

## A few lines are enough

```text
erd Sales
    Customer
    Order
    connect Customer to Order
```

This declares a native DDN ERD view in the file's single workarea, two name-only entities and the subtype's default relationship. It does not invent fields, keys or cardinalities. The selected version supplies display defaults.

```text
mindmap Holiday
    Travel
        Flights
    Budget
```

Only a recipe that defines a hierarchical relationship interprets this nesting as branches. Other views do not acquire relationships merely from indentation or overlapping positions.

```text
bar SalesTotals
    North 120
    South 95
```

The short bar recipe supplies one series, a label column and a numeric value column. These row labels are data, not declarations in the file's name index. More complex charts use explicit datasets and mappings.

## Source and indentation

Source is UTF-8. A leading byte-order mark is tolerated. LF and CRLF are equivalent line endings; a final newline is optional. A lone CR outside literal content is invalid. Canonical saved text uses LF.

Structural indentation uses spaces. Any positive increase can open a permitted child block; sibling lines use the same indentation and a dedent must return to a previously established level. Four spaces are the recommended saved form. Tabs in structural indentation are diagnosed rather than expanded according to a reader's preference. Tabs inside literal note/draft text remain content. Blank lines do not open or close blocks.

There are no required braces, brackets, parentheses or line-ending semicolons. A physical line completes an ordinary declaration, property or table row. Multiline notes, draft content and typed text properties use indented blocks. Parentheses supplied inside a value, such as varchar(25), remain part of that value.

Outside literal text/data blocks, a line whose first non-whitespace characters are `//` is a comment. There are no inline comments: a URL or text containing `//` is not truncated. In notes, draft bodies and table data, `//` is ordinary content. `#` remains available for Markdown headings and colour values.

## Names, titles and quotation

Every declared name is unique across its physical source file, including view, document, dataset, named element, note and named relationship declarations. Names are case-sensitive after Unicode NFC normalization. Two files can declare the same name. Inclusion does not flatten these name scopes.

An unquoted name can contain spaces. Reserved clause words such as `as`, `from`, `to`, `at` and `named` delimit clauses only in the statement positions that define them. Quote a name that contains such a delimiter in that position. A quoted label that resembles a command stays literal.

```text
erd Sales
    "Orders to review"
    "Customer: retail"
    connect "Customer: retail" to "Orders to review"
```

An optional colon introduces a displayed title distinct from the declared name:

```text
erd Sales : Customer relationships
    element BillingCustomer as entity : Customer
```

Without a separate title, the declared name supplies the display label. Repeated displayed text and table-cell values are permitted; duplicate declared names are not. Reusing an item uses a reference rather than redeclaring it. Bare short-form names are declarations, even if the same name was declared earlier.

Either straight quote delimiter can enclose a whole information value. Double the enclosing delimiter to include it literally; the other delimiter is ordinary content. Backslashes are preserved by DDN decoding. Curly quotes are content, not delimiters. Quoted values do not cross physical lines.

```text
"text 'quoted text' more text"
'text "quoted text" more text'
"He said ""it's ready""."
```

An apostrophe inside an unquoted word does not start quotation. The lexer recognizes quotation at a value/component boundary. In table/header scanning it also recognizes a quoted component after a dot or a setting colon. Punctuation inside a quoted component does not delimit DDN structure.

## One workarea and included files

The first file opened is the main file. It alone supplies the active workarea. Each file can contain at most one explicit workarea declaration; an omitted declaration supplies that file's implicit workarea when it is opened as the main file.

```text
version ddn-next-1
include "shared.ddn"
style "theme.css"

workarea Planning as ddn
    with
        background
            color "#f5f5f5"

erd Sales
    use "shared.ddn"::Customer
```

The workarea block contains its properties/defaults. View, document and shared-content declarations remain at file level; all participate in the main workarea. An included file's workarea block is inactive in this opening context. Its views, documents, data and shared definitions join the main workarea while retaining their source-file identity. This is inclusion, not a copy or rename operation.

A standalone design opts into a single accessible view with an explicit workarea setting:

```text
workarea Planning
    with
        mode standalone
mindmap Ideas
    Product
```

Omit `mode` (or set `mode workarea`) for the normal multi-view workarea. In `standalone` mode, the effective workarea grows and shrinks with its sole view/document, and no surrounding workarea is available. The included file closure must contain only one view/document. A temporary empty draft/in-progress workarea is editable but cannot pass review. This mode is an explicit entry-file property, not a CSS or defaults-block setting; it does not change the selected view profile or grant collaboration permissions.

Relative include, reference, asset and stylesheet locations resolve against the containing source file, never the process working directory. Canonical resolved file locations deduplicate repeated includes. Resolve the finite include graph once, then resolve names, so forward references and include cycles are permitted without recursively creating repeated workareas. Loading a reference alone does not include all views from that file: the target file must already be explicitly included or be the current file. Missing dependencies are diagnosed and preserved as unresolved references.

A local reference is a name. An external reference is a file location, `::`, and a name:

```text
Customer
"shared.ddn"::Customer
```

The file qualifier is always required for an external reference, even if the name happens to be unique among loaded files. An unqualified reference inside included content resolves in that content's declaring file. Source references never resolve by the order files happen to finish loading. Method/profile qualification uses `::` in its own typed context and is not interpreted as a file reference.

The draft language/default contract identifier is `ddn-next-1`. This is a planning identifier, not a released version or a claim that all default tables are frozen. `version ddn-next-1` may appear once at file level. Omission binds to that same fixed identifier, never to the newest software version. Included files must resolve to the same language/default contract in this draft. A mismatch is an unresolved dependency diagnostic; it is not silently translated or given the main file's defaults. A future contract changes the identifier when standard defaults change. No compatibility parser is required.

## Views and shared definitions

The explicit view form works for every registered profile:

```text
view Sales as ddn::erd
view Tree as "mindmap.basic@1"
```

`erd Name`, `mindmap Name` and `bar Name` are short recipes for native ERD over ddn@1, mindmap.basic@1 and the single-series bar form of chart.basic@1. The qualified aliases ddn::erd, ddn::mindmap and ddn::bar select these same recipes in explicit view declarations. Additional short words require unique entries in the versioned registry. Every retained profile remains addressable by its exact registered profile ID; there is no requirement to invent 151 new keywords. A profile selects its rules and available roles; an alias never merges native ERD with Chen or crow's-foot semantics.

A generic named element is `element Name as Role`. In a view it creates a definition and an appearance; at file level it creates an unplaced shared definition. A role can be an exact registered role token, or `core::TypeName` for a registered core information type. The selected catalogue must permit it. Structural types such as Workarea and View use their dedicated declarations; a generic element cannot bypass single-workarea or containment rules.

```text
element Customer as entity
    with
        status in-progress

erd Sales
    use Customer
    Order
    connect Customer to Order

erd Support
    use Customer
        with
            font serif
```

`use Reference` creates a local appearance of existing content, not another definition. A nested `with` applies only to that occurrence. `use Reference named OccurrenceName` gives an occurrence a file-unique name when multiple appearances need distinct references. An occurrence can also have a title after a colon. Definition properties are edited at their defining declaration, not through an ambiguous view-local property change.

Bare children of a short diagram declaration create that recipe's default role. A generic explicit view permits bare children only when its registry supplies one default role; otherwise use `element`. Indentation describes declaration containment, with semantic relationships only where the selected recipe explicitly defines them.

Unnamed draft entities remain possible: `element as entity` allocates a stable internal identity and displays the `<table>` placeholder. It does not declare a name literally equal to `<table>`. The designer can preserve generated identity in the registered `id` field without requiring beginners to author it. Persisted identities are scoped with their source file; copying appearances does not duplicate definitions.

## Properties, defaults and styles

Optional properties use an indented `with` block. A property line is its key followed by its value. Nested records use indentation; canonical dotted property paths are an equivalent compact form.

```text
erd Sales
    Customer
    with
        look handdrawn
        font serif
        style.font_size 12pt
```

The short keys `look`, `font`, `font-size` and `status` map to `style.look`, `style.font`, `style.font_size` and `design.state`. Other keys use their codex spelling or canonical path. Names containing dots are single property paths in this context; dots separate cells only in table context. An inapplicable or unknown meaningful property is diagnosed rather than silently installed on every element.

Records and ordered collections have one general form:

```text
with
    position
        x 40
        y 80
    tags
        item important
        item customer-facing
```

`item Value` appends a scalar collection member; `item` with indented properties appends a record. A bare collection property with no children supplies an explicitly empty collection; a bare record property supplies an empty record. A scalar property with no value is incomplete, not implicit null. A registered multiline-text property can take an indented literal body. The property's codex type determines which block is legal. An empty record contributes no replacement leaves; a supplied list replaces its inherited list. Duplicate property leaves in one explicit block are errors; a later separate matching defaults rule may override an earlier rule in the same tier.

The only authored precedence is file > CSS > built-in standard. Explicit file defaults are legal file settings, not edits to the built-in standard. At an occurrence, the file candidates are: occurrence setting, shared definition setting, matching view defaults, matching active-workarea defaults, declaring-file defaults. Inapplicable providers are skipped by the property's codex contract. Semantic facts, names, source references, status and acceptance do not inherit presentation defaults. File-local defaults in an included file apply to content declared there; that file's inactive workarea defaults do not become another active provider. The main workarea's defaults apply to eligible included appearances.

```text
defaults element as entity
    font serif

erd Sales
    defaults element as entity
        style.font_size 12pt
    Customer
```

`defaults Owner [as RoleOrProfile]` is allowed at file, workarea or view scope. Owner is one of `element`, `relation`, `view`, `document` or `workarea`; the optional typed filter limits the rule. Exact role/profile filters outrank unfiltered rules at the same scope; remaining equal-specificity matches use source order, last wins. Filters do not change the selected profile or widen its permitted roles.

Resetting a property removes its authored leaf. No reset keyword is stored: saving a reset restores omission. An explicit value equal to today's default is retained. A nullable property set to null is an explicit value, not a reset.

`style "theme.css"` attaches an external stylesheet at file or view scope. Root-file sheets apply to the active workarea's eligible content; included-file sheets apply to that file's content, and view sheets apply to that view. CSS specificity/importance/source order operate within the CSS tier only. The property codex registers eligible properties and selector hooks; CSS cannot set semantic data, identity, status, acceptance or permissions. Standard defaults are compiled into interpreting software and documented by version, not downloaded as an implicit dependency.

The common virtual selector hooks include method-ddn and subtype-erd classes on an ERD view and role-entity on its entity appearances. They describe the DDN scene rather than requiring a particular DOM tree. Registered CSS custom properties use the --ddn- prefix and a codex mapping, for example --ddn-style-font and --ddn-style-font-size. CSS retains its own standard syntax in an external stylesheet; DDN source does not embed CSS braces. The mapping must be unique for each eligible canonical property, and unsupported hooks/properties are diagnosed.

## Values and absence

Value interpretation follows the property's or column's declared type. No guessing of dates, domains, currency or booleans from arbitrary text. Untyped custom table columns are text. Optional quoting permits punctuation and does not prevent conversion to an explicitly declared number/date type.

| Value | Rule |
| --- | --- |
| Integer/decimal | Optional sign, decimal digits, optional fractional part and optional e/E exponent; no locale thousands separator, NaN or infinity |
| Boolean | true or false |
| Date | YYYY-MM-DD with calendar validation |
| Date/time | YYYY-MM-DDTHH:MM:SS, optional fractional seconds, then Z or an explicit signed HH:MM offset |
| Measure | Number followed by a registered unit, for example 12pt or 5s; a bare number uses the property's codex unit |
| null | Explicit null only where permitted |
| unknown | Explicitly unknown semantic information where supported |
| na | Explicitly not applicable where supported |
| auto | A property's documented deterministic automatic rule, never an arbitrary reader choice |
| `""` or `''` | Deliberately supplied empty text |

Unquoted null/unknown/na/auto are state tokens in typed-value positions. Quote them to supply literal words to a text property. In name/title/text-body positions they are ordinary text. A quoted numeric cell such as `"3.14"` remains numeric when the column is explicitly numeric; quotation protects its dot from table separation. Empty table positions mean no supplied value, distinct from quoted empty text. Omitted properties follow their documented omission rule; missing semantic facts do not become zero or false.

## Tables and free-form bodies

An explicit `data` body always starts with its own column-header row. Unquoted dots separate header entries and cells; LF ends every complete data row. Consecutive dots preserve omitted cells and missing trailing cells remain absent. Extra cells beyond the declared schema are diagnosed, never discarded. Blank physical lines are ignored in structured tables; a fully empty row can be written with enough dots for its columns. Use a quoted empty cell for a deliberate empty string. Outer unquoted cell whitespace is trimmed; quoted whitespace is retained.

```text
erd Sales
    Customer
        data
            field:lt:40.type:ct:30.comment:lt
            Key.int."Primary identifier."
            name.varchar(25)
            email.."Address to use for **contact**."
```

The data header determines the column-display menu. Custom headings are allowed. A registered ERD mapping can interpret field/type/domain/key/comment; unknown headings remain ordinary data. Display selection, ordering and widths never change cell binding or delete hidden data.

The compact column setting is `name:alignment:percentage:minchars:maxlines`. Alignment uses r/l/c/f then t/m/b. Empty positions between colons retain omission/default behavior. A fractional percentage containing a dot is quoted in a header, for example `field:lt:"12.5"`. Percentage correction, equal automatic shares, rightmost expansion, default-font measurements, wrapping/ellipsis and the shaded-square failed-fit fallback are exactly those in [the table contract](03-table-fields-and-columns.md#column-settings-and-width-allocation).

The short view-wide column clause is selected as a dot-separated template, matching table headers:

```text
erd Sales as field:rt.type:ct.domain:lt.key:ct
    Customer
        Key.int..primary key
        name.varchar(25)
```

Here the explicit template supplies the input schema for bare field rows. It is a creation/input shorthand, not authority to reinterpret a locally declared `data` header or a bound dataset. A local header always governs its own rows. Without this clause, bare ERD field rows use the recipe's fixed input order field/type/domain/key/comment; the initial visible detail is field only. The earlier comma-separated header proposal is superseded; no dual syntax is needed.

Use `fields` for a plain list of field names with no header. Every nonblank line is one whole field-name value, so no first row is lost:

```text
erd Sales
    Customer
        fields
            Key
            Name
            Email
```

Use `draft` for literal free-form body text. Its contents are not parsed as fields or headers until an explicit designer conversion. `draft fields` records that the intended conversion is a plain field-name list; `draft table` records that the first row will be headings. Bare `draft` remains free text and requires the designer to select the intended conversion before interpreting rows. These body descriptors do not independently change lifecycle status. Conversion preserves the original draft and reports unresolved content rather than discarding it.

## Named data and live sources

```text
data CustomerFields
    field.type.domain.key
    Key.int..primary key
    name.varchar(25)

erd Sales
    Customer from CustomerFields
```

A named `data` declaration is a reusable dataset; its name is unique within the file. `from` binds an element's body to it. Named and anonymous data bodies have the same header/row rules. Bindings do not merge the consuming elements or permit edits back to an external source.

```text
source CustomerFeed as host
    with
        channel customer-fields
        update replace

data LiveFields from CustomerFeed
    with
        mapping
            field source_name
            type source_type
        key source_id
        persist reference
```

`source Name as Provider` declares a registered provider and typed configuration. Built-in provider families are host, file and calculation; concrete transport/adapter names require their catalogue contracts. Host updates need no network/server requirement. File sources specify a location and format. Calculation sources reference a registered calculation definition; no arbitrary program is executed by parsing a declaration.

Source-owned data defaults to coherent replacement revisions, manual refresh for file sources and supplied updates for host sources, read-only binding and reference-only persistence. `update keyed` additionally requires a declared stable key; ordinal or label guessing is prohibited. A revision carries schema and rows together. Failure retains the last successful revision marked stale; absence of any revision is unavailable, not a fabricated empty success.

Mapping keys name target columns; values identify source fields using the provider's declared selector syntax. Typed column metadata can be supplied by the provider or by a `columns` block containing one header row. Textual provider input uses the same explicit header convention as inline data; structured input does not consume its first record as headings.

`persist snapshot` stores the last coherent schema/rows plus revision and capture timestamp in a typed `snapshot` property record. `persist reference` omits payload data but retains binding information. A referenced snapshot is captured data, not a promise to update itself. An external newline in a cell is mapped to a space for single-line table display while raw provider data remains preserved; an explicit multiline text mapping can instead place it in a text object. Empty/missing cells retain their declared distinctions.

## Notes and formatted text

```text
notes customer_notes : ##Customer design
    The **name** is required,
    and this continues the same paragraph.

    This is another paragraph with an ++underlined++ word.
```

The optional reference name is before the colon. The shorter `notes : ##Title` allocates an unnamed identity. The title is editable text, not the reference key. A top-level notes declaration creates a text view on the main workarea; within a diagram it creates a text element; within an element it adds an owned note; within an output document it adds a content block. These placements do not silently create domain relationships.

Strip the first nonblank body's structural indentation for interpretation, preserving extra indentation and original source. A less-indented nonblank line closes the literal block and must be valid at an existing outer indentation. Blank lines never close it. Consecutive prose lines form one paragraph; blank lines separate paragraphs. DDN commands and comment markers inside the body are text. EOF closes the body.

The selected text profile is CommonMark 0.31.2 block/inline syntax limited to paragraphs, emphasis/strong emphasis, headings, lists, quotations, inline/fenced/indented code, links and thematic breaks, plus the DDN `++underline++` extension. Raw HTML and Markdown tables/images are not interpreted by this profile; use literal text, DDN tables and declared assets. Autolinks and reference links follow the pinned baseline. Body ATX headings require a space; the notes-title position also accepts `##Title`. Explicit Markdown hard breaks are retained; ordinary source line breaks are soft. Inline-only roles render block markers as text.

For underline, an unescaped `++` pair opens only before non-whitespace and closes only after non-whitespace. It cannot cross a paragraph, does not nest inside itself, and is literal in code or link destinations. Unmatched markers are literal. Resolve code first, then pair underline delimiters left-to-right and parse ordinary emphasis/links inside the span. A Markdown backslash can escape a plus. This fixes the extension without changing DDN quote decoding.

Formatting defaults to Markdown for narrative notes, plain text for identifiers and typed data, and inline Markdown only where a text column/role enables it. `text.format plain` disables markup for that text owner. HTML/PDF/office output maps underline to native styling; plain Markdown output retains ++ with the DDN text-profile identifier, and plain-text output removes formatting while retaining content. No table cell acquires physical multiline source through text formatting.

## Relationships and endpoints

```text
connect Customer to Order
connect Customer to Order as assoc
connect Customer to Order as assoc named CustomerOrders : Places
    with
        source.cardinality 1
        target.cardinality many
```

`as` selects a permitted relation type; omission selects only the subtype's documented default. `named` supplies an optional file-unique relationship name; the colon supplies its displayed label. Qualifiers live in its `with` block and must be admitted by that relation's codex entry. Line colour, endpoint symbols and routing remain presentation settings, distinct from semantic cardinality.

Within a view, `with label.visible true|false`, `label.mode text|numbers` and `legend.include true|false` belong to that relation's appearance, not its shared definition. The same properties may be placed under `use` to style a reused relationship. Omission preserves profile/view defaults; inline label visibility, its format and legend membership are independent. Internal mind-map branches remain unlabelled and excluded from the relationship legend. See the [relation presentation contract](../codex/RELATION-PRESENTATION.md).

The Customer/Order example uses `assoc`: the retained `owns` role specifically assigns responsibility to an organization/team/role and is not a generic entity association. Retained relationship roles use their exact registered tokens; native core patterns can be addressed as core::PatternName, using the pattern names in the fixed relation catalogue. A core pattern and a retained role sharing an internal anchor are not automatically semantic aliases. Top-level connect/relation declarations create shared relationship definitions; use inside a view places an existing relationship against that view's explicit endpoint appearances.

`at` selects an endpoint member within its already resolved owning definition:

```text
connect Customer at Key to Order at CustomerKey as assoc
```

A member selector is an existing stable member identity or an unambiguous member label under that owner; it does not declare another global name. Persisted endpoint records retain member identity so a display rename does not retarget the connection. Missing/ambiguous members are diagnostics. `source.cardinality` and `target.cardinality` accept the selected role's vocabulary; common native forms are 0, 1, many and ranges such as 0..1 or 1..many. These dots are property-value content, not table separators. Foreign methods retain their own rules.

For a registered n-ary relationship use `relation Name as Role` with ordered `endpoint Reference [at Member]` child blocks and endpoint properties. This is not permission to make every binary role n-ary; association-type elements and participant roles remain available through their catalogue definitions. In a view, connectors bind existing local appearances; if several occurrences of an endpoint exist, name the intended occurrence. No endpoint is silently created or selected by visual proximity.

## Documents and output

A document is an output-oriented view, with the same file-wide naming and active-workarea membership as other views:

```text
document SalesReport as pdf : Sales design
    notes : ##Overview
        This report describes the current design.
    use Sales
    with
        page.size a4

document SalesData as csv
    use CustomerFields
```

`document Name as Target` selects one output target. Registered targets include pdf, html, dashboard, docx, odt, csv, json and markdown within their bounded contracts. Multiple outputs use separate document views sharing content or a template. `use` chooses an existing diagram, document, notes or dataset as allowed by the output; recursive document inclusion cycles are invalid. Content order is declaration order. A referenced diagram appears as a figure, notes as flow content, and a dataset as a table or typed-data projection.

`use Reference` can carry occurrence-specific properties for caption, visibility, layout and selected columns. CSV accepts one dataset projection; multiple unrelated targets require separate document views. JSON emits the document's declared typed projection with its version, not private reader state. HTML/dashboard use their responsive viewport contracts rather than acquiring paper pagination. Paged targets use their registered page defaults and controls. Output requires the target adapter's actual capabilities; a file declaration does not implement an adapter.

Static output captures one coherent revision of content, resolved styles, assets and data. Screen ellipses/hidden overflow do not silently discard output content: the default document policy is full content, with explicit marked-excerpt settings if requested. A dashboard can remain live under its source bindings. Creating a document or rendering it does not send it to a destination; delivery is a separately declared authorized operation.

## Assets, templates and reusable structures

`asset Name as Kind from "location"` declares a file-relative resource such as image or font, with optional typed metadata including media type, digest and fallback. Properties refer to the asset name. Missing resources are diagnosed according to the target's declared policy. Inline asset bytes, when needed, use a typed `content` record with encoding/media type/value; they are not executable source.

`template Name as RegisteredRole` contains `with` defaults, optional parameters, and permitted child declarations. `element Name as Role using Template` creates new content from that template, distinct from `use` of shared content. Parameter values live under `arguments`; a property can bind a parameter using the typed value `parameter Name`. There is no string interpolation or arbitrary expression evaluation. Template cycles are invalid. Generated child names receive a deterministic instance-name prefix and are checked for file-wide collisions. Saved source retains its template/version and arguments; generated identity maps preserve referenced children across save/reload.

Template parameters are declared in a parameters record keyed by parameter name, each with a type and optional default. Parameters/arguments are template metadata, not properties copied onto the instantiated element. An explicit instance property wins over its template property, then ordinary scope/default resolution applies. A missing required argument leaves the instance incomplete; it is not inferred from surrounding text.

Templates are optional. They do not supply unobserved facts, accepted status or application authority as presentation defaults. Generic property records/lists carry all registered structured qualifiers without a second punctuation-heavy syntax.

## Status, acceptance and authorization

`with status draft`, `in-progress`, `in-review` or `accepted` is the compact persisted setting, written as a property/value line inside the block. All four are user-set; the icon derives from that value. [The owner-defined lifecycle](08-status-and-acceptance.md) remains controlling.

```text
with
    status accepted
    acceptance
        at 2026-10-23T15:30:00Z
        by Reviewer
```

The example timestamp is illustrative. `by` references a declared user/actor or a host identity represented by the registered identity type. Accepting records the actual acting user and time, not the file-open time. Local single-user operation can use a local actor; a commercial identity service is not mandatory. Authoring an identity or permission declaration does not grant runtime authority.

The inferred editing policy is: design status belongs to the shared definition, view or workarea that declares it; occurrences display their target's status and cannot independently accept that shared definition. Status is not inherited from a parent. Editing protected semantic content requires an explicit user return from In-review to In-progress, or an authorized return from Accepted to In-review/In-progress. Presentation-only changes are permitted unless the selected acceptance scope explicitly includes presentation. Shared-content changes require reopening each protected scope whose declared acceptance depends on that content; unaffected scopes are unchanged. Exiting Draft remains one way. No automatic promotion/demotion or return to Draft is added.

A change of live data can invalidate review evidence; readers report that condition without changing the stored user-set status. Entering In-review checks the current applicable revision. Reopening Accepted retains the old acceptance as history and removes it from the current acceptance slot; reacceptance records a new event. Prior entries can be stored in an ordered acceptance history. Normal forward progression is Draft to In-progress to In-review to Accepted; direct shortcut transitions do not bypass review. These editing/history choices are inferred policies, distinct from the owner's confirmed status meanings.

## Automation and the DDN family

DDN, DDNA and DDNN use this same lexical/property/reference notation. DDN describes the active workarea and its views. DDNA supplies registered analysis/automation definitions, bindings, run/result/trace data and schedules. DDNN supplies output document views and narrative content. These are content purposes, not competing brace or serialization grammars. A companion file opened first still supplies at most one implicit/explicit active workarea; when included, its content joins the main workarea under the same rules.

Registered automation/analysis types use the generic element form and typed property blocks. For example, a calculation names its registered algorithm, version, inputs and units; a delivery names its output document and destination binding; a recorded run contains observed facts. The declaration does not execute a job or fabricate a result. Closed collaboration/server functions remain closed capabilities even though their information can be represented. AI output remains a proposal until a user applies the permitted change; it cannot set acceptance automatically.

## Verification, saving and completeness of this draft

Syntax checks identify malformed structure, quotes and declarations. File checks enforce unique names, include/reference resolution, supported version and applicable properties. Profile checks enforce allowed roles/relationships and purpose-specific completeness. Draft/In-progress incompleteness is retained and explained; In-review must pass its required checks. Source parsing cannot treat an invalid higher-priority value as omitted.

Save preserves authored omissions, explicit overrides, quoted empty strings, raw draft/notes text, identifiers and source-file provenance. Default expansion is an inspection/export view, not a rewrite of ordinary source. Cross-file edits save to the owning files; including content does not automatically move it into the main file. Referenced histories/results are stored as typed records, not injected reader-only session state.

The [grammar](10-grammar.ebnf), examples and [coverage index](12-notation-coverage.md) make these notation choices reviewable. Generic forms give each retained profile and role a source route. The [property/default codex](../codex/README.md) now provides the complete per-catalogue property/default expansion and typed schema reconciliation. Icon artwork and reader implementation remain software deliverables. Coverage of notation does not prove every process or output adapter is implemented.

## Paper surfaces and decorative attachments

Paper surfaces use `paper note` or `paper pad` inside a `with` or defaults block.
The short setting `shadow centre` selects a silhouette on the existing shadow
record; its other settings remain optional. Structured shadow blocks and
`shadow null` keep their existing meanings. The [paper and stationery
contract](../codex/PAPER-AND-STATIONERY.md) defines the complete
decoration list notation, configurable colours and bounded values.
