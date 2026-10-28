# Inferred notation decisions

The owner authorized the remaining notation to be inferred. The choices below close routine syntax and interpretation questions for the current draft. They do not change explicit owner directions, implement readers, expand the agreed product scope or claim that the entire property codex is populated. [The language reference](09-language-reference.md) controls the resulting spelling.

| Area | Chosen rule | Reason |
| --- | --- | --- |
| Indentation | Spaces, any consistent positive nesting increment; canonical four spaces; reject structural tabs | Familiar indentation without machine-dependent tab widths |
| Comments | Full structural lines beginning //; no inline comments | Leaves # for Markdown/colours and protects URLs/text |
| Names | File-wide unique declared names, case-sensitive NFC; title separate after colon | Preserves the owner's file scope and editable labels |
| Names containing grammar | Quote the complete name or value | Reuses accepted quote syntax instead of adding escapes |
| Version | Optional version ddn-next-1, omission frozen to that same draft contract | Short files remain stable across reader updates |
| Mixed versions | Included files must use the same contract in this draft | No silent reinterpretation or compatibility layer |
| Includes | include plus file location; resolve against declaring file; deduplicate graph before binding | One main workarea without load-order ambiguity |
| External references | File location::name, quoting either component as needed | Identifies source file even if loaded names happen to be unique |
| Generic view | view Name as exact-profile; short registered recipes remain available | Every retained profile has a route without a keyword explosion |
| Definition reuse | element declares; use references and places | Prevents same-file duplicate declarations from masquerading as reuse |
| Occurrences | Optional named clause on use | Disambiguates multiple appearances without changing their shared target |
| Property notation | with plus typed property tree; dotted paths equivalent; item for list entries | One extension form supports nested records without braces/brackets |
| Reset | Remove the authored property | Preserves omission and avoids another state token |
| Defaults | defaults Owner with optional role/profile filter; file/CSS/standard unchanged | Compact repeated presentation choices with explicit scope |
| Plain fields | fields body has no heading; every line is a field name | The first field is never consumed as a guessed header |
| Structured data | data body has a heading row; dots separate headings/cells | One unambiguous header convention |
| Free-form bodies | draft, with optional fields/table conversion hint | Preserves undecided content and avoids implicit destructive parsing |
| View column shorthand | as followed by dot-separated column headers | Uses the same separators as local table headers; replaces the earlier comma proposal |
| Values | Typed conversion; quoted decimals in dot-separated rows; quoted empty text distinct from missing | No locale/content heuristics or lost empty positions |
| Notes | Optional reference name before colon; literal indented body | Keeps the accepted notes form short and referenceable |
| Markdown | Pinned bounded profile plus explicit ++ rule | Same interpretation across viewing and publication |
| Live data | Named source, data from source, typed mapping/key/persistence | Data can change without redefining elements or their placement |
| Relationships | connect with optional as/named/title, qualifiers in with, member selector at | Optional detail extends the agreed simple connection form |
| N-ary roles | relation with ordered endpoint children | Preserves role-specific association meaning without inventing binary edges |
| Output documents | document Name as target, ordered use/notes/data blocks | Treats output documents as views on shared content |
| Templates | using plus typed arguments and parameter bindings | Optional reuse without an executable expression language |
| Status encoding | status alias for design.state; acceptance at/by record | Keeps one user-set value driving its icon and records required acceptance facts |
| Protected editing | Explicit user reopening for protected semantic content; retain prior acceptance history | No silent status changes or accidental replacement of the accepted record |
| Family formats | DDN/DDNA/DDNN share grammar; content roles differ | Consistent references, properties and text rules across the family |
| Advanced catalogue coverage | Generic element/role, relation/endpoint and typed property forms | Retains bounded existing capabilities without adding a bespoke syntax for each |

The editing/history policy and source-update defaults above are inferred design choices, not quotations of owner policy. The normal review remains the opportunity to change them as a whole; no individual clarification is needed to continue specification work.

The next completion work is the expanded property/default codex, exact semantic payload constraints and updated machine schemas. Icon artwork is separate visual design. These are not unresolved choices about whether a file may contain several active workareas, how names are scoped, what the four statuses mean, or how percentage ties are allocated: those are already settled.
