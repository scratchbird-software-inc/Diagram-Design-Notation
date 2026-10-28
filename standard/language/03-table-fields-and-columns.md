# Table fields, display columns and alignment

Current notation is consolidated in [the language reference](09-language-reference.md) under the owner's delegation. Its concrete syntax/interpretation choices supersede unresolved notation statements below; confirmed owner requirements and remaining semantic/default-codex work still apply.

The owner confirmed positional table rows: a dot separates cells, an empty position skips a column, and LF ends a row with all remaining cells null/empty. The owner also confirmed that all information values may optionally be quoted to contain punctuation. These rules supersede the earlier assistant proposal that treated later dotted values as independently recognized semantic qualifiers. The horizontal/vertical alignment meanings are also confirmed. Exact surrounding declaration forms and the remaining lexical details are still being specified; no new parser is implemented.

**Latest clarification:** an element's multiline table can define its own columns in its first row, and those headings populate its column-selection menu. Data must also be independently definable for dynamic sources. See [element data and sources](04-element-data-and-sources.md). The view-header form below remains an earlier explicit-header proposal; it must not impose a common schema on all elements or override a local data header. Positional cells, quoted values, alignment and empty-cell rules still apply.

The owner has now settled table line handling: each complete data row occupies one physical source line, including long cell values. Cells wrap visually and row height grows to accommodate them; this is not multiline cell data. Minimum character width and maximum displayed-line properties are required. The owner's `fieldname:rt:25` percentage-width shorthand is developed below as a proposal.

## Confirmed alignment code

| Position | Codes and meanings |
| --- | --- |
| First letter: horizontal | `r` right, `l` left, `c` centre, `f` full |
| Second letter: vertical | `t` top, `m` middle, `b` bottom |

The twelve combinations are:

| Vertical | Left | Centre | Right | Full |
| --- | --- | --- | --- | --- |
| Top | `lt` | `ct` | `rt` | `ft` |
| Middle | `lm` | `cm` | `rm` | `fm` |
| Bottom | `lb` | `cb` | `rb` | `fb` |

Full is interpreted as justified text across the available width. Exact justification behavior, including the last line of a paragraph, remains a typography detail to specify. The second letter does not mean text or a datatype. Right and left are physical alignment choices; they must not silently become direction-dependent start/end choices.

## Proposed combined example

```text
erd Sales as field:rt.type:ct.domain:lt.key:ct.comment:lt
    Customer
        Key.int..primary key
        name.varchar(25)
        email..EmailAddress
        notes...."Includes punctuation: . , : ( )"
    Order
    connect Customer to Order
```

Sales names the ERD view. Customer and Order are its entities. The four further-indented lines define fields owned by Customer; Order remains name-only. Field lines directly beneath the ERD header must not silently create shared fields for all entities or turn the view title into a table. A shared field template would require an explicit construct.

The consolidated notation selects dots between column declarations in both the view-wide template and local data header, with colons for the optional settings. The earlier comma-separated view-header proposal is superseded. Unquoted dots likewise separate positional data cells; dots inside quoted components remain content. See [the current notation](09-language-reference.md#tables-and-free-form-bodies).

## Column declarations and stored meanings

In the current ERD header proposal, `as field:rt.type:ct.domain:lt.key:ct.comment:lt` declares the ordered columns used by the following positional rows and selects those details for display. Each entry has a registered detail name and optional colon plus two-letter alignment code. The column identity determines the meaning of that position; alignment controls its presentation. Merely including a type, domain or key column does not assign a value to it.

For this short form, the clause explicitly requests a Columns presentation for structured fields. Entities without fields can remain title-only without fabricated rows. Other appearances may still explicitly select a title-only or draft body. Storing field definitions and choosing a body presentation remain separate information, as in the shared surface contract.

The proposed alignment applies to the detail's cell content. Whether headings inherit it or have a separate default must be made explicit in the later typography contract; heading behavior is not an additional confirmed owner decision.

Omit individual alignments to use their resolved defaults:

```text
erd Sales as field.type.domain
```

Omit the entire clause to use the normal view/body/detail defaults. Do not materialize omitted settings as explicit source values. Resolution remains file > CSS > standard, including applicable local/view scopes. This clarification does not choose one universal alignment default for every kind of column or diagram.

For omission of the source column declaration, the proposed requirement is a documented, versioned input column order supplied by the selected authoring recipe. CSS and transient viewer column arrangements must not redefine how source cells bind to semantic properties. This input-order default still needs to be assigned in each applicable recipe; it is distinct from presentation defaults.

The source column order determines how each row is read. In the five-column example, `Key.int..primary key` leaves domain empty and places primary key in the fourth, key column. With a header containing only field/type/domain, `Key.int.primary key` would put primary key in the domain position; the parser must not move it to an undeclared key column by recognizing its words. A profile can validate a supplied value against its declared column, but cannot silently change its position.

After parsing, each value is bound to its column/property identity. Reordering columns in the designer must preserve those meanings, rewriting the corresponding row positions if the source header is changed. Editing a source header alone while leaving the rows untouched changes their positional interpretation. Hiding a display detail must retain its stored facts; the eventual complete source form must support storing details that are not displayed. Do not confuse display visibility with removing a column from the source row schema.

The `as` clause is interpreted under its owning declaration: on `erd` it declares the table columns in this proposal; on `connect` it selects a relationship type under the accepted connection rule. It is not a global context-free alias operation.

## Confirmed positional row rules

Within a table row, each unquoted dot advances to the next column. Keep every empty position; never collapse repeated separators. LF ends the row. Cells after the last supplied value remain null/empty through the table's declared width; authors need not write trailing dots.

For a table with five columns:

| Row text | Column 1 | Column 2 | Column 3 | Column 4 | Column 5 |
| --- | --- | --- | --- | --- | --- |
| `col1.col2..col4.col5` | col1 | col2 | empty | col4 | col5 |
| `col1.col2` | col1 | col2 | empty | empty | empty |
| `col1..col3` | col1 | empty | col3 | empty | empty |
| `.col2` | empty | col2 | empty | empty | empty |
| `col1.col2...` | col1 | col2 | empty | empty | empty |

For the ERD example:

| Field | Type | Domain | Key | Comment |
| --- | --- | --- | --- | --- |
| Key | int | | primary key | |
| name | varchar(25) | | | |
| email | | EmailAddress | | |
| notes | | | | Includes punctuation: . , : ( ) |

An omitted cell and an explicitly skipped position both represent no supplied value under this rule. They do not fabricate zero, false, a datatype, a domain or a key, and they are not an assertion of a database field's SQL nullability. Presentation defaults still follow file > CSS > standard; those defaults do not fill empty semantic data cells with invented facts. The precise normalized absence representation and distinction from a deliberately supplied empty string belong to the remaining value contract.

The proposal for rows with more cells than the declared column list is a diagnostic, not truncation, overflow into another row or creation of extra columns. Final-row EOF handling, blank physical lines, CRLF normalization and whitespace trimming still need the complete lexical contract. Multiline cell syntax is no longer an open requirement: each table row, including quoted cells, stays on one physical source line. Long lines wrap only for display.

## Visual wrapping and row height

The table editor or viewer may wrap a long cell over several displayed lines. This does not insert LF into the stored cell, split the data row, or create another record. Saving and resizing preserve the original row and values. A quoted table cell cannot consume the next physical source line as a continuation. Truly multiline note/document bodies retain their separate text contract.

The required row behavior is to grow as cells wrap. The proposed measurement rule is that the common row height fits the tallest visible cell after its wrapping/line limit and padding are applied. Other cells use their horizontal/vertical alignment within that shared row height. Hidden columns do not contribute display height, but their values remain stored.

The owner accepted the minimum character width and maximum displayed-line properties, including these author names:

| Property | Accepted meaning |
| --- | --- |
| `minchars` | Minimum cell content width measured using the applicable default font; padding is additional. This is a width constraint, not a limit on stored string length |
| `maxlines` | Maximum visible wrapped lines in a cell. This does not limit the number of data rows or the stored content |

These can have table defaults and per-column overrides under file > CSS > standard. The owner now specifies character/line units using the default font and the compact colon encoding below. Numeric default values and the precise font character/line metric still need specification; example values do not establish global defaults. The default font resolves through the normal presentation cascade; inline emphasis does not redefine the measurement unit. The existing normalized `min_chars` property is a reuse candidate; a normalized `max_lines` member still needs schema integration.

For a capped cell, the owner accepted an ellipsis with the complete value available on inspection/expansion. The ellipsis indicates undisplayed content within the visible line limit; reaching maxlines never deletes or truncates stored data. Exact inspection interaction remains an implementation detail to specify. Publications still need an explicit full-content or marked-overflow treatment; a screen cap must not silently discard report content.

If supplied external data contains real embedded newlines, the binding needs an explicit representation/mapping policy for a single-line table value or a separate multiline text object. It must not accidentally turn those characters into extra table records. That source mapping is not settled by visual wrapping.

## Column settings and width allocation

The owner specifies four optional positional settings after the column name:

```text
column:alignment:percentage:minchars:maxlines
```

Thus `field:ct:25:19:6` means centre/top alignment, 25% width, minimum width of 19 default-font characters and maximum six displayed lines. A bare number in the percentage position means percent; no percent symbol is required. Empty positions between colons leave the corresponding setting omitted/defaulted, and unused trailing settings may be left off.

Example table content:

```text
field:rt:25:19:6.type:ct:25.comment:lt:50
CustomerID.int."A long explanation stays on this source line and wraps inside the displayed comment cell."
```

The three data columns are field, type and comment. The colon suffixes are presentation metadata, not part of the column names or additional data columns. The menu shows those column names. An unquoted dot separates header entries just as it separates data cells; the trailing dot in a partial example introduces the next column, not an additional statement terminator. A literal dotted/colon-containing heading can be quoted before its optional presentation suffix.

Examples of column entries:

| Entry | Meaning |
| --- | --- |
| `field:rt:25` | Right/top, 25% preferred width |
| `field:rt` | Right/top, inherited/default width |
| `field` | Inherited/default alignment and width |
| `field:ct:25:19:6` | Centre/top, 25%, minimum 19 characters, maximum six displayed lines |
| `field::25:19:6` | Default alignment; 25%, minimum 19 characters, maximum six lines |
| `field:ct::19:6` | Centre/top; omitted percentage uses the resolved automatic/default-width rule; minimum 19 characters, maximum six lines |
| `field:::19:6` | Default alignment and percentage behavior; minimum 19 characters, maximum six lines |
| `field::::6` | Only maximum six displayed lines supplied |

An empty setting is not numeric zero. Resolve omitted properties through file > CSS > standard; if no percentage is supplied by those layers, the column participates in automatic equal sharing. Consecutive colons are positional omission within this column-setting context, distinct from :: qualification in a reference context. A quoted column name can contain literal colons without creating settings. Invalid explicitly supplied values require a diagnostic rather than being treated as omissions.

Percentages use a common table-width basis. The recommended measured box is the table's usable inner width for columns, excluding the outer frame/borders and separately allocated spacing. Thus 25 means one quarter of the table width, not a sequential percentage of what the preceding column leaves. Exact padding/spacing measurement remains part of the geometry contract. This replaces the earlier remainder-based percentage proposal for percentage/automatic columns.

The owner confirmed that columns without a percentage divide the remaining space equally. If no columns have percentages, all columns have equal width. This is equal allocation, not weighting by content length. Resolve applicable presentation defaults first; for the displayed columns in percentage/automatic mode, let P be the sum of percentages and N the number of automatic columns. If the total exceeds 100, first apply the largest-percentage reduction described below. When N is positive and the resulting widths are feasible, each automatic column receives (100 - P) / N percent. Percentage columns otherwise keep their specified shares.

| Header | Resolved shares |
| --- | --- |
| `field.type.domain.comment` | 25%, 25%, 25%, 25% |
| `field:rt:25.type:ct.comment:lt` | 25%, 37.5%, 37.5% |
| `field:rt:20.type:ct:30.comment:lt` | 20%, 30%, 50% |

The computed fractional shares above do not require authors to write fractional percentage literals. Resizing preserves the same proportions when constraints remain feasible. Display selection determines which columns participate, without deleting hidden data or its stored preferences.

When percentage allocations exceed 100, reduce the currently largest allocation until the total reaches 100 or that allocation meets the next-largest value. If several columns share the largest value, reduce those columns equally. As their value reaches another column's allocation, include that column in the tied-largest group and continue reducing the group equally. Stop as soon as the total is 100. This implements the owner's instruction to move among the largest columns as their relative sizes change, including when the initial excess exceeds any single allocation. Do not drive one column negative or rescale every percentage proportionally.

For nonnegative percentage inputs totaling more than 100, the same result can be expressed as a common upper limit: choose H so that the sum of min(original percentage, H) is 100. This mathematical description is equivalent to the progressive largest-group reduction; it adds no source notation or new author setting.

When all displayed columns have percentages and their total is below 100, the rightmost displayed column receives the entire unused percentage. Other columns keep their allocations. When automatic columns exist, they instead share the remainder equally under the already confirmed rule. Rightmost refers to the current displayed order; it does not alter the source data's column bindings.

| Initial percentages, left to right | Effective percentages | Explanation |
| --- | --- | --- |
| 60, 30, 20 | 50, 30, 20 | Only the largest needs reduction |
| 60, 60, 10 | 45, 45, 10 | Tied leaders share the reduction equally |
| 90, 50, 10 | 45, 45, 10 | Reduce 90 to 50, then reduce both leaders together |
| 60, 50, 40, 30 | 25, 25, 25, 25 | The excess is 80; progressively include every column rather than exhaust one |
| 20, 30, 10 | 20, 30, 50 | No automatic columns; the rightmost receives the remaining 40 |

Effective shares may be fractional; whole-number source percentages do not require whole-number computed shares. Keep logical allocation precision until display measurement so rounding does not repeatedly favor one of the tied columns. Exact device-unit rounding belongs to rendering detail, not another percentage-allocation policy. The recommended persistence behavior remains to retain authored percentages and calculate their effective allocation, rather than silently rewrite source during display.

Character minimums constrain the resolved widths. The owner settles the failed-fit display: show a shaded square indicating that a table exists but cannot currently be displayed. This applies when the table cannot fit its available display area after allocation/measurement, including a width below its required character minimum. Keep the table data, identity, settings and relationships intact. A cell reaching maxlines uses its accepted ellipsis treatment; the whole-table square is a separate fallback for inability to fit the table itself.

The proposed rendering sequence is: resolve defaults; progressively reduce tied-largest percentage allocations when over 100; allocate any remainder equally among automatic columns, or to the rightmost column when all columns have percentages; measure using default-font character/line units with cell wrapping and line caps; then display either the table or its shaded-square indicator. Do not substitute an earlier grow-until-fit or partial-table-cropping proposal for the owner's indicator. Exact square size/shading belongs to the applicable presentation defaults. If more display space later becomes available, the representation can be recalculated without changing the stored data.

Tied largest allocations, excess greater than one allocation and all-percentage totals below 100 are now settled. Integration with retained fixed-length width modes and fractional percentage source spelling remain grammar/default work. Numeric minchars/maxlines defaults remain to be assigned per applicable context. These details do not reopen the accepted shaded-square fallback, progressive largest-group reduction, automatic equal sharing, rightmost expansion or positional omission syntax.

For a shared dataset, header presentation metadata must remain distinguishable from semantic column identity and appearance-local overrides. Changing width/alignment cannot change cell binding. The exact serialization scope is still to be finalized alongside the view-level `as` proposal.

## Confirmed optional quoting

All information values may optionally be quoted, even when quoting is unnecessary. This includes labels, reference names and table-cell values. Quotes delimit one value; punctuation inside them belongs to that value rather than to the surrounding DDN structure. Syntax keywords and structural separators remain outside the quoted values.

The owner subsequently confirmed either single or double quotes: `"text 'quoted text' more text"` and `'text "quoted text" more text'`. The opening delimiter selects the closing one; the other quote is content. The [quoted/formatted-text chapter](05-quoted-and-formatted-text.md) records the accepted enclosing-quote doubling rule and discusses Markdown formatting separately from DDN value boundaries.

These rows carry the same values under the declared columns:

```text
Key.int..primary key
"Key"."int".."primary key"
```

Examples of punctuation inside values include:

```text
"account.name"."varchar(25)"
notes...."Version 1.2, reviewed."
```

Here the dot inside account.name does not start another cell, and the dots in the comment do not create additional columns. Names can likewise be quoted in headers and references, such as `erd "Sales: Europe"` and `connect "Customer.A" to "Order.B"`.

Quoting protects the outer syntax; it does not change which column receives the value or automatically change its semantic type. For example, a quoted int value in the type column still denotes the supplied type expression. There must be no decimal-versus-separator guessing: a data value containing a literal dot can be quoted, such as `"12.50"`, and interpreted according to its declared column.

The accepted type catalogue, per-column value validation, full quote grammar and explicit empty-string meaning remain to be specified. Quoted table values do not span physical source lines; real multiline text belongs to its separate text contract. Parentheses in varchar(25) are part of the supplied type expression, not section grouping. Optional quoting does not require every author to quote ordinary punctuation-free text.

Name-only fields, unknown types and unassigned domains remain legitimate partial design information. Displaying a type or domain column does not make its values mandatory. The selected method/profile governs the declared type and key semantics; this native example does not impose a finished SQL schema on conceptual design.

Field identity remains separate from the display label, row order and chosen display columns. Renaming, reordering or hiding a field detail must preserve the stored definitions and relationships.

## Integration still required

The shared surface pack currently records a global text alignment using start/centre/end semantics and column entries without a per-column alignment member. This chapter adds a confirmed requirement beyond that envelope. A later schema revision must represent horizontal right/left/centre/full and vertical top/middle/bottom independently for each applicable column, with exact shorthand expansion and defaults. It must preserve explicit file choices and inherited omissions. Do not claim the existing schema already validates these codes.

The column contract also needs the confirmed visual wrapping/line-cap behavior and the proposed percentage-header shorthand. Existing min/max character widths do not substitute for a maximum displayed-line property. The current property schema/check counts do not establish that these additions are covered.

The complete per-column value grammar, hidden-detail persistence, all applicable defaults and remaining lexical rules are still part of the unfinished consolidated language contract. This chapter records the owner's alignment, positional-row and optional-quoting directions without implementing the parser, viewer, designer or verifier.
