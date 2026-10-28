# Language proposal examples

The `.ddn` files here illustrate the short forms in [readable authoring](../02-readable-authoring.md), now consolidated by [the language reference](../09-language-reference.md) and [grammar](../10-grammar.ebnf). They are not accepted by the current product parser. The [consolidated example set](consolidated/README.md) adds complete file-composition and advanced notation scenarios.

| Example | Content |
| --- | --- |
| [Mind-map](mindmap-short.ddn) | Five topics and four branch relationships in five lines |
| [Conceptual ERD](erd-short.ddn) | Two name-only entities and one conceptual association in four lines |
| [Bar chart](bar-short.ddn) | Three labelled numeric values in four lines |
| [ERD with style](erd-style-short.ddn) | The same ERD with two explicit view presentation overrides |
| [ERD with columns](erd-columns-short.ddn) | Proposed column header with confirmed alignment, positional dot-separated cells, empty cells and optional quotes; four fields owned by Customer and a name-only Order |
| [ERD with separate data](erd-data-reference.ddn) | Proposed named dataset with a first-row column header; an entity references its data separately from layout |
| [Indented notes](notes-block.ddn) | Owner's notes-block fragment with two paragraphs; next-block is an illustrative following declaration, not a DDN keyword |
| [Default-profile records](default-profiles.json) | Proposed mind-map/ERD defaults and their source contracts; not a full expansion of all defaults |

These examples use ordinary spaces and indentation. The chosen lexical forms are in the language reference; complete semantic schemas, expanded profile defaults and implementation remain separate work. Keep generated/internal identities and default values out of these visible examples unless needed to illustrate an explicit advanced feature.
