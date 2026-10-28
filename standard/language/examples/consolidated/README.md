# Consolidated notation examples

These files illustrate [the current language draft](../../09-language-reference.md), not the old product parser. The definitions are source fixtures for specification review; they do not perform actions, contact services or certify the illustrated content.

| File | Exercises |
| --- | --- |
| [Main](main.ddn) with [included content](shared.ddn) | One active workarea, included views/data, file-qualified references, shared occurrences, local defaults, output documents |
| [Stylesheet](theme.css) | Registered CSS hook/property; the explicit file font in main.ddn outranks it |
| [Tables](tables.ddn) | Local headers, plain field lists, compact view header, quoting, empty text and skipped cells |
| [Drafts and notes](drafts-and-notes.ddn) | Free-form content, conversion hints, unnamed entity, paragraph flow and literal DDN-looking text |
| [Live data](live-data.ddn) | Host source, mapping, independent data binding and live dashboard view |
| [Lifecycle](lifecycle.ddn) | User-set status and required acceptance timestamp/user record |
| [Templates](templates.ddn) | Typed parameter binding, instance overrides and newly created definitions |
| [Relationships](relationships.ddn) | Member selectors, named relation, caption and cardinality qualifiers |

Each example other than main/shared is a separate opening scenario, so repeated names across these files are intentional and legal. Both main and shared contain a workarea declaration, but only the first-opened file's workarea is active. Opening main includes shared's Support view in Planning without activating SharedDesign.

Validation in this pack is a bounded specification audit: catalogue counts/routes, fixture presence, indentation, links and selected literal/table examples. It is not a full grammar parser, profile verifier or rendering test. Implementations must later execute both successful and deliberately invalid cases from the language contract.
