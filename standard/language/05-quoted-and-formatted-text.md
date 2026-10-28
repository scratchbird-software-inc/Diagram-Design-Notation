# Quoted values and formatted text

Current notation is consolidated in [the language reference](09-language-reference.md) under the owner's delegation. Its concrete syntax/interpretation choices supersede unresolved notation statements below; confirmed owner requirements and remaining semantic/default-codex work still apply.

## Owner direction and review status

The owner specifies either quote delimiter: double quotes can enclose single quotes, and single quotes can enclose double quotes. The owner accepted the subsequent quote/Markdown proposal and added headings using # and other simple Markdown. Regular 10pt Courier remains an illustrative base font, not a universal default selected for every text role.

The accepted direction covers either delimiter, doubling the enclosing quote when needed, Markdown within text, the proposed ++ underline extension and plain-text availability. Headings are now explicitly included. The exact remaining simple-Markdown feature list, detailed lexical rules, text-role defaults and output mappings are still being specified. This chapter implements no reader or editor and does not claim a completed grammar.

The owner's later [indented notes form](06-notes-and-status.md) settles the ordinary multiline-note container: notes declaration/title, an indented body, blank-line paragraph separation and termination at the next outer declaration. It also accepts the owner's compact ##title spelling in the notes-title position. This refines the earlier heading-space proposal below without changing literal text or ordinary table row rules.

## Two interchangeable quote delimiters

These owner examples each produce one text value:

```text
"text 'quoted text' more text"
'text "quoted text" more text'
```

The opening delimiter determines the matching closing delimiter. The other quote character is content. Either delimiter can be used for any value that supports quoting; they do not choose different data types or formatting modes. Dot-separated table cells still split only outside quoted values. A quoted value containing punctuation remains one cell.

Recommended lexical detail: delimiter recognition begins at the start of a value, after any permitted outer whitespace. An apostrophe in an ordinary unquoted word, such as Customer's, must not accidentally start a quoted value. Straight ASCII quotes are the proposed delimiters; typographic curly quotes remain ordinary text. Full whitespace rules remain part of the lexical specification.

## Text containing both quote types

Use two copies of the enclosing quote to represent one literal copy inside the value. This reuses the chosen delimiter rather than introducing another escape character:

```text
"He said ""it's ready""."
'He said "it''s ready".'
```

Both would contain:

```text
He said "it's ready".
```

The recommended decoder behavior is to leave backslashes unchanged, allowing the text format to interpret its own escapes. It must not consume Markdown escapes before Markdown sees them. Literal quote doubling is accepted; the full lexical treatment of other characters still needs consolidation, and the historical parser's escape rules are not automatically part of the new dialect. The meaning of a deliberately supplied empty string versus an absent cell remains separately to be finalized.

## Markdown within text

Support a defined Markdown profile for formatted text roles. The object's resolved presentation supplies the base font, size, colour and alignment; inline markup supplies intentional formatting on the marked span. For the owner's illustrative editor, regular Courier 10pt remains the base while an emphasized span becomes bold or italic and surrounding text keeps its base style.

```text
"A **required** field with an *optional* explanation."
'The **customer** said "please review".'
```

Quotes delimit the DDN value. They are not displayed and do not make its contents automatically plain text. Conversely, an unquoted value in a Markdown-enabled text role can contain Markdown. Formatting mode belongs to the text role/content format, not to the choice of quote character.

Base presentation still resolves file > CSS > standard. An authored inline emphasis mark is a local content instruction over that resolved base; bold must not reset unrelated font size, family or colour. Its exact span properties and standard rendering defaults need to be part of the text contract.

The source may remain Markdown while the designer displays and edits formatted text in place; a source view and familiar formatting commands can be added without requiring the author to write every marker. The viewer displays the same formatting without editing. Source/display correspondence must preserve the original authored text on unrelated changes. Exact editor mechanics remain separate from the language contract.

## Markdown scope and underline

CommonMark uses one asterisk/underscore for emphasis and two for strong emphasis. In particular, `__text__` is not a dedicated underline syntax. A DDN underline marker must be documented as an extension rather than presented as standard Markdown. [CommonMark emphasis specification](https://spec.commonmark.org/0.31.2/#emphasis-and-strong-emphasis)

| Requested formatting | Notation | Status |
| --- | --- | --- |
| Bold | `**text**` | Accepted Markdown strong emphasis with bold presentation |
| Italic | `*text*` | Accepted Markdown emphasis with italic presentation |
| Bold and italic | `***text***` | Standard combined emphasis |
| Underline | `++text++` | Accepted DDN extension; not standard CommonMark |

Keep the Markdown profile versioned and consistent across viewer, designer and publication. A small inline profile suits labels and ordinary table comments; larger text bodies support the accepted headings and the simple block features proposed below. Exact allowed features, nesting, literal-marker escapes, line-break behavior and export mappings still require definition. Supporting formatted text does not silently commit every text field to the entire CommonMark feature set.

For underline, the accepted ++ spelling uses a compact marker without redefining existing underscore emphasis. A documented export mapping is needed because an ordinary Markdown consumer will not necessarily render that extension. The spelling is accepted; exact delimiter interaction, escaping and nesting still require the text grammar.

## Headings and a small block-formatting set

The owner explicitly includes # headings. The proposed body-text profile uses # through ###### followed by a space for six heading levels. The later notes header additionally permits the owner's compact ##title form; this distinction belongs to the explicit notes-title grammar. Heading level is content structure; font, size, weight and spacing come from versioned text-role defaults and the normal file > CSS > standard cascade. No fixed heading sizes are selected here. A heading inside a note remains part of that note; it does not create a DDN view, workarea or element.

The following is the recommended meaning of other simple Markdown for the initial text profile. These additional features are proposals under the owner's scope direction, not a claim that every Markdown extension was accepted:

| Feature | Author form | Intended context |
| --- | --- | --- |
| Paragraphs | Blank line between paragraphs | Multiline text bodies |
| Bulleted lists | `- item` | Multiline text bodies |
| Numbered lists | `1. item` | Multiline text bodies |
| Block quotations | `> text` | Multiline text bodies |
| Inline code | Text enclosed in backticks | Formatted text, kept literal within the span |
| Code blocks | Triple-backtick fences | Multiline text bodies; content displayed as code |
| Links | `[label](target)` | Formatted text; target semantics need the link contract |
| Horizontal divider | `---` on its own block line | Multiline text bodies |

Use a pinned CommonMark baseline for the included syntax and its ambiguities, alongside the explicit DDN underline extension. For example, a line of dashes can also participate in a setext heading; this must follow the selected baseline or be explicitly excluded, not depend on reader guesswork. [CommonMark block and inline specification](https://spec.commonmark.org/0.31.2/)

Example editor contents, not yet a complete DDN multiline-value serialization:

```markdown
# Customer design

The **name** is required; an *alternative name* is optional.

## Open questions

- Can a customer have several addresses?
- Which address should be ++preferred++?

> Confirm these choices before acceptance.
```

Markdown is interpreted only within the already identified text content. Thus # inside a text body is available for a heading rather than being removed as a DDN comment, and a numbered list's dots cannot become data-cell separators after table parsing. The DDN comment syntax outside text remains a separate lexical decision.

The text-role contract must state where block formatting is applicable. The owner's later table rule keeps each data row on one physical source line; visual cell wrapping does not create multiline source values or authorize block lists/code fences inside table cells. Inline-only roles must have a defined treatment of block-looking text. Detailed link targets, soft/hard line breaks in actual text bodies, allowed nesting and formatting preservation on export remain specification work; the feature list alone does not settle them.

## Keep table parsing and text formatting distinct

For a table, first recognize the DDN rows/cells and decode quotes. Then apply the declared column meaning and, for formatted-text cells, parse Markdown within that cell. For example, the following editor content has two columns:

```text
field.comment
name."**Required** for display."
email.'Use the "primary" address when *available*.'
```

The punctuation inside each quoted comment remains in that cell. Markdown does not create columns, consume the first-row header, change field identities or turn ordinary cell values into DDN declarations. Datatypes, source references and numeric data keep their defined meaning; a datatype named int does not become a Markdown document because the surrounding object has formatted comments.

The owner subsequently settled the table case: LF ends a data row, and every cell, including a long quoted value, stays on that one physical source line. Cells wrap visually and the display row grows; wrapping never inserts a stored line break. There is no multiline quoted-cell continuation to define. Actual multiline notes use the [indented block and paragraph rules](06-notes-and-status.md); their complete lexical/storage integration remains to be finished. See [table wrapping and widths](03-table-fields-and-columns.md#visual-wrapping-and-row-height).

Plain-text roles and an explicit plain-text option remain useful for code, literal markup and technical identifiers. Defaults can select Markdown for intended narrative/editor roles without requiring a format declaration on every ordinary object. Literal content, formatting mode and rendered result must be preserved consistently when switching editor representations or exporting.

## Remaining integration

Consolidate the accepted quote-doubling and underline spellings into the complete lexical/text grammar; finalize per-role text defaults, the remaining simple Markdown set, heading styles and publication mappings. Preserve multiline draft/source text and column identities across editing. The wider grammar, generated schema updates and reader/editor implementation remain outstanding work.
