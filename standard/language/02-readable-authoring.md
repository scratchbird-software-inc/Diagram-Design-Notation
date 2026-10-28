# Readable authoring with a few lines of text

Current notation is consolidated in [the language reference](09-language-reference.md) under the owner's delegation. Its concrete syntax/interpretation choices supersede unresolved notation statements below; confirmed owner requirements and remaining semantic/default-codex work still apply.

## Language requirement

A non-technical author must be able to describe a useful diagram or chart with a few readable lines. The ordinary path should require a diagram type, names, explicit relationships where needed, and data where the chart needs it. Layout, symbols, typography, colors and other optional choices come from the selected default profile.

This is a confirmed usability requirement. The short forms below are a concrete grammar proposal for review, not the current parser's syntax or a completed grammar for the whole language. They refine the earlier examples that repeated `view`, `ddn::` and `topic` for every small diagram.

## Proposed short forms

### Mind-map

```text
mindmap Holiday
    Travel
        Flights
        Hotel
    Budget
```

The header selects the native mind-map context and names the root topic Holiday. Each indented item is a topic; indentation defines its parent branch. Travel and Budget are children of Holiday; Flights and Hotel are children of Travel. The view title initially follows the header label. There is no need to repeat `topic`, write coordinates or list the branch relationships separately.

This is registered relationship shorthand: each parent/child pair expands into the selected mind-map profile's ordered branch relationship. It does not mean spatial placement alone creates relationships in other diagram types. An author wanting reuse of an existing topic must use an explicit reference form; matching a displayed label does not silently merge definitions.

### Native conceptual ERD

```text
erd Sales
    Customer
    Order
    connect Customer to Order
```

The header selects native conceptual ERD and supplies the view title Sales. Customer and Order create two entity definitions and their appearances. Sales is not an additional entity. `connect` creates a conceptual `assoc` relationship between the named entities in this view's resolution scope. It does not assert cardinality, keys, field types, a foreign key or an executable database relationship.

Each entity may remain name-only. No columns, domains or types must be supplied to continue drawing. The default relation role is fixed by this specific ERD entry form; other relation meanings require their registered forms. Missing or ambiguous endpoint references are diagnosed, never resolved by creating similarly named entities or guessing which one the author meant.

The owner accepted an optional `as` clause for the connection type:

```text
connect Customer to Order
connect Customer to Order as assoc
```

These are alternative declarations illustrating omission versus an explicit registered relationship type. An omitted type uses the selected subtype's documented default; where there is no default, the author must choose. An explicit type must be permitted by the selected profile and endpoint roles. Relationship type is distinct from endpoint cardinality and visual line style. This acceptance settles the optional clause, not the whole language grammar.

The owner's subsequent table example is developed in [table fields and display columns](03-table-fields-and-columns.md). Its source column order determines the meaning of positional dot-separated cells; missing cells are null/empty, LF ends a row and values may optionally be quoted. Alignment remains presentation, and stored values retain their column/property identities after parsing.

The later [element data and source clarification](04-element-data-and-sources.md) allows each table's first row to supply its own column names and requires separately defined data for dynamic updates. A fixed ERD-wide detail list cannot limit these native whiteboard tables. The chapter proposes named data and `from` references without ratifying those spellings.

### Bar chart

```text
bar Sales
    January 12
    February 18
    March 15
```

The header selects the simple native bar-chart recipe and supplies the chart title. Each row supplies a category label and one numeric value. The final unquoted numeric token is the value; the preceding text is the category label, so `North America 12` needs no quotes or aligned columns. An isolated label with no value is an incomplete row, not an implicit zero.

This simple recipe proposes one series, input row order, vertical bars and a zero-inclusive value axis. Each row has its own record identity. Repeated labels remain separate categories unless aggregation is explicitly selected; the default does not sum them. Values are numbers with no inferred currency, percentage or business unit. Numeric values use a defined locale-independent literal form; no guessing based on machine locale. Multiple series, units, data sources or aggregation use explicit additional declarations when required.

## Add detail without rewriting the diagram

An optional `with` block can supply properties at its owning level:

```text
erd Sales
    Customer
    Order
    connect Customer to Order
    with
        look handdrawn
        font serif
```

This adds explicit view presentation choices. They resolve above CSS and standard values. They do not change the entities, relation meaning or design status. The short keys map to registered properties: `look` to `style.look`, `font` to `style.font`. Their appearance inheritance must follow the same rules as the explicit form. A literal `with` topic can be quoted to distinguish it from the property block.

Properties can also attach to one item, rather than the whole view:

```text
erd Sales
    Customer
        with
            font serif
    Order
```

In this proposed view-local form, the property changes the Customer appearance in this view. Editing the shared definition's presentation preference requires an explicit shared-definition scope; it cannot happen accidentally because the same entity appears elsewhere.

The same language must allow later addition of field details, domain references, richer relationships, data bindings, publication definitions and other views. Simple and advanced declarations share the same model and default rules. The reader must not treat the short form as a separate, lossy document format.

## Syntax and ambiguity rules for the proposal

| Concern | Required behavior |
| --- | --- |
| Type selection | One registered leading word selects a subtype/recipe in the declared method context, defaulting to native DDN in a standalone short file; explicit method qualification such as `chen::erd` is available where needed |
| Ordinary labels | The remainder of a label line is text; spaces, ordinary words and case are preserved |
| Repeated type words | Omit them where the selected recipe supplies one unambiguous default role; use explicit roles for mixed or specialized content |
| Indentation | Express hierarchy or ownership according to the enclosing declaration; recommended four spaces, no closing delimiters; exact indentation/token rules belong to the full grammar |
| Relationships | Use a small registered vocabulary, such as `connect A to B`; indentation implies a relationship only in recipes that explicitly define that shorthand |
| Properties | Put optional property lines in an explicit owning `with` block, so an ordinary topic named Font is not silently parsed as a setting |
| Quoted values | All information values may optionally be quoted; punctuation within quotes belongs to that value. This also provides a literal escape for labels that match reserved declarations or reference delimiters; ordinary labels do not require quotes |
| Chart rows | The selected simple chart recipe defines the columns; the one-series bar example uses label plus final number, with no visual column alignment requirement |
| Scope | Declared names are unique across their source file; external targets must identify their file. `::` supplies qualification; inclusion does not merge file naming scopes |
| Case | Keywords have documented spelling; labels preserve case; do not silently case-fold and merge identities |
| Whitespace | Blank lines are optional; no fixed-width tables or decorative punctuation are required; tabs/mixed-indent handling must be settled uniformly by the full grammar |
| Interpretation | Parsing is deterministic and recipe-based; it does not depend on AI, natural-language inference or whatever a reader believes the author probably intended |

For `connect`, unquoted standalone `to` separates the two references, and an unquoted standalone `as` introduces an optional connection type after the target. A reference label containing a delimiter in its syntactic position must use the quoted reference form. A label that looks exactly like a declaration, such as `connect A to B`, can be quoted as literal content. Final escaping and multiline literal rules remain part of the complete lexical grammar.

Ordinary short files must not require workarea/view wrappers, generated IDs, schema declarations, a property block or a style sheet. A standalone short file implies its one workarea and one placed view. More views and output document views can be named in that workarea; declared names remain unique within the file. When files are included, the first file opened supplies the sole active workarea and all included views/data join it while retaining source-file identity. See [the file/workarea contract](07-files-workarea-and-property-codex.md).

Omitting a version in a short file must bind to a specific frozen base language/default version defined by the specification. It cannot mean the newest version installed by the reader. The final file contract must assign that base version and define the explicit version/dependency form for documents choosing other contracts.

## Exact expansion is still required

Each short form must have a documented expansion into the shared definitions, appearances, view selection and relationships. For the examples above:

| Short form | Information created or selected |
| --- | --- |
| `mindmap Holiday` | Native workarea, mind-map view/placement, root topic Holiday and generated identities |
| Nested Travel/Flights/Hotel/Budget | Four topic definitions/appearances plus four explicit parent-to-child branch relationships |
| `erd Sales` with Customer and Order | Native conceptual ERD view/placement, two entity definitions/appearances; no required fields |
| `connect Customer to Order` | One conceptual association with resolved endpoint identities and no invented cardinalities |
| `bar Sales` with three rows | One local dataset with three records, category/value bindings and a simple bar-chart view/placement |
| `with` properties | Only the explicitly supplied overrides at the identified owner; all other values remain inherited |

Generated identities become stable persisted information under the file contract. The ordinary author need not invent identifiers or understand these internal record names. Persisting and later editing the document must preserve relationships, source text and intentional overrides without forcing all defaults into the visible source.

The full grammar must define the lossless explicit forms before these shorthands can be called complete. This chapter does not declare a new core element/relation inventory or change the existing bounded profile contracts. The bar entry recipe and short subtype spellings require explicit registration in the consolidated contract.

## Acceptance criteria

- A basic mind-map, conceptual ERD and one-series chart each fit in a few ordinary lines without brackets, braces, semicolons, coordinates, manually invented IDs or repeated role words.
- A person can identify the intended items, branches/connections and data by reading the text; syntax examples require no programming prerequisite.
- Every omitted visual property has a documented default; every omitted semantic fact remains appropriately unspecified.
- Adding one local style override does not require expanding the rest of the source or changing shared meanings.
- Simple and explicit forms represent the same information under the same versioned contracts, including identity and reference preservation when saved.
- An ambiguous label/reference or incomplete chart value produces a clear explanation of the missing information rather than a guessed interpretation.
- Usability is checked with representative non-technical authors before claiming the notation is proven easy to learn. No such user study is claimed by these examples.

Complete formal syntax, all catalogue/role defaults and complete file examples remain outstanding parts of the consolidated language specification. These short forms make the intended everyday author experience concrete now.
