# Element data, first-row headings and separate sources

Current notation is consolidated in [the language reference](09-language-reference.md) under the owner's delegation. Its concrete syntax/interpretation choices supersede unresolved notation statements below; confirmed owner requirements and remaining semantic/default-codex work still apply.

## Confirmed directions

The owner clarified that some elements, including ERD tables, can contain different data. In design/whiteboard use the body is a multiline editor, and the right-click menu for choosing displayed columns is populated from the first row's column names. The owner then required a way to define data separately for dynamic data.

These directions extend the confirmed dot-separated cells, optional quoted values, empty cells and LF row boundary. They supersede any assumption that every ERD table must use one fixed list of field/type/domain/key/comment details. The exact DDN serialization and source declaration spellings below remain proposals. No parser or reader software is implemented here.

## A table defines its own columns

Example contents of one element's multiline editor:

```text
field.description.decision
Customer number.Unique customer reference.To discuss
Name.Customer display name
Email."May contain multiple addresses.".Undecided
```

The first row defines three ordered columns: field, description and decision. It is the header, not a data row. The subsequent rows use those positions, leaving missing cells null/empty. Quoting applies to headings as well as values; a heading containing a dot is one quoted cell.

The owner later clarified that each row occupies one physical source line. Long cell values wrap only for display, with row height growing accordingly. A proposed header suffix such as `field:rt:25` adds alignment/percentage-width metadata without changing the column name or cell positions. See [table wrapping and widths](03-table-fields-and-columns.md#visual-wrapping-and-row-height).

The column-selection menu offers these three headings. It is not hard-coded to the usual ERD details. Another element may use field/type/domain/key or an entirely different set. A subtype may offer a useful initial template, but that template is not a ceiling on native whiteboard content.

Keep three pieces of information distinct:

| Information | Responsibility |
| --- | --- |
| Table data | Ordered column definitions and rows, plus the draft text needed to preserve editing |
| Body representation | Multiline editing, tabular display or title-only presentation |
| Display selection | Which data columns are shown, in what order and with which presentation overrides |

Changing display selection does not delete data or change source positions. Reordering or renaming authored columns must preserve their associated cells; the proposed normalized model uses stable column identities distinct from headings and ordinals. Display selection is tied to those identities. An incomplete header remains editable draft text; the interface must not discard content just because conversion is not yet possible.

The earlier example of entering field names one per line remains valid plain drafting. It must not silently lose its first field by treating every arbitrary draft's first line as a header. The complete editor/file contract must explicitly distinguish plain field drafting from a body with a header row, or seed a one-column field header when converting the former. Exact source spelling and creation behavior are still open. No heuristic based on whether a word looks like a known ERD property is proposed.

Custom headings are data columns, not automatically new core semantic properties. A selected recipe or explicit mapping can associate a column with a field name, datatype, domain or key. Other columns remain valid design information. Verification of a finished design is separate from preserving and displaying tentative table content.

For this header-based form, the data's header determines row meaning. The earlier `erd ... as ...` proposal cannot overwrite a local data header or require every element to share the same data columns. A proposed view-level list can supply initial presentation preferences; its exact relationship to the local header still needs final grammar. CSS can style columns but cannot reinterpret their stored data.

## Separate named data

A proposed compact definition separates the data from the element that presents it:

```text
data CustomerFields
    field.type.domain.key
    Key.int..primary key
    name.varchar(25)
    email..EmailAddress

erd Sales
    Customer from CustomerFields
    Order
    connect Customer to Order
```

Here `data` declares a named dataset and its first row supplies the headings. `from` on the element refers to that dataset. Customer remains the diagram element; CustomerFields supplies its table body. The body and the Columns menu use the same declared column definitions. Order remains a title-only entity.

Names and references may be quoted. Declared names are unique within their source file; external references must identify the source file, with `::` supplying qualification. Included data joins the main workarea while preserving this file identity. See [the file/workarea contract](07-files-workarea-and-property-codex.md). An unquoted `from` in this proposed declaration position is a delimiter; literal names containing it need the quoted form. The grammar must distinguish an inline body from a source-bound body without guessing from ordinary text.

The same dataset may supply several elements/views with independent layout, body mode and displayed columns. Reusing it does not merge those elements' identities or create relationships between them. It also does not imply that edits to a displayed copy should modify the shared or external source.

Separate definition means separate ownership and reference. The data can be declared in the same document or a separately declared file/dependency. Exact package/import and external format syntax remain part of the consolidated file contract; physical separation must not require copying data into every view.

## Dynamic source variant

Instead of literal rows, a dataset can be supplied by a named source. Proposed spelling:

```text
data CustomerFields from CustomerFeed

erd Sales
    Customer from CustomerFields
```

CustomerFeed denotes a separately defined source/binding; its name alone is not a complete feed declaration. The source contract must identify how data is supplied and any mapping needed to produce the dataset's columns and rows. It can represent host-supplied updates, a declared file/resource, a supported adapter or a calculated result. An ordinary display reference neither executes embedded code nor requests write-back to the source.

The diagram binds to CustomerFields, so changing its source or receiving a new revision does not require rewriting the element or its layout. A structured provider can supply column metadata directly; a textual table can supply the equivalent header row. Consumers use one resolved column contract rather than treating the first record of every external format as headings.

Minimum information to specify for the data/source contract:

| Concern | Required file information or declared omission behavior |
| --- | --- |
| Identity and shape | Dataset identity, ordered columns and stable column/row identities where available; partial data remains possible |
| Origin | Literal content, declared file/dependency, named provider or calculation binding |
| Mapping | Explicit source-to-column bindings when the source shape differs; no guessed semantic mappings |
| Update mode | Supplied updates, manual refresh or configured refresh policy; transport-specific details belong to the provider contract |
| Revision and availability | Which coherent revision is displayed; distinguish current, unavailable, stale and partial data |
| Persistence | Whether data is embedded, referenced or captured as a snapshot, including the source revision of a saved capture |
| Editing | Whether the data is locally authored or source-controlled; viewing it does not imply write-back |

Detailed fields and defaults in this table are specification requirements to finish, not already completed schemas.

## Proposed update behavior

Apply a coherent column-and-row revision together. Preserve the element's placement, style and surviving column selections. Derive menu entries from the current dataset's columns, so new columns become available and removed columns do not remain available as if they still existed. Preserve unresolved display preferences for explanation/recovery rather than silently rebinding them to a different ordinal. Exact automatic visibility for new columns belongs to the display default contract.

If an update fails, the existing surface proposal retains the last successful display and identifies it as stale; it must not invent an empty successful result. Incoming data must not silently overwrite a local draft being edited. Shared-dataset editing, source changes, write-back and conflict handling need an explicit contract; source-bound display is sufficient for the basic dynamic case.

A publication or static export captures a consistent data revision along with presentation. It does not keep changing after capture. The live view can continue receiving later revisions independently.

## Model and edition integration

Reuse Dataset (EL12), Record (EL13), Adapter (EL49) and Binding (EL50), with existing Field/ValueSchema and source revision concepts as appropriate. This requirement does not add a second unrelated data model or force a new core type. Headers, custom column identity, row storage, typed mappings and source declarations still require complete schemas.

The open-source viewer can display supplied updates while remaining read-only. The standalone designer can edit local data using the shared viewer/verifier foundation. These capabilities do not require a commercial server. Coordinated multi-user editing, collaboration and server-managed services retain the closed-source boundary. Naming a live source is not participation in that source's activity.

The language records data and binding information; software implements retrieval, updates and editing. This chapter is planning, not implementation or a claim that the full language/file contract is complete.
