# Files, the active workarea and the property reference codex

Current notation is consolidated in [the language reference](09-language-reference.md) under the owner's delegation. Its concrete syntax/interpretation choices supersede unresolved notation statements below; confirmed owner requirements and remaining semantic/default-codex work still apply.

## Confirmed structure

A DDN file describes one workarea, which can contain multiple views and multiple documents. A document is a view designed for targeted output, such as PDF, HTML, a dashboard, DOCX, ODT, CSV or JSON. Document views are part of the workarea, not a second independent kind of workspace. The exported PDF, CSV or other artifact is the result of using that document view, not the view definition itself.

Only one workarea is active at a time. The first file opened supplies that workarea. Views, documents, data and other included content from additional files are treated as part of the main workarea. An included file does not establish a second active workarea or replace the main one. Its workarea declaration is not activated as another spatial owner merely because its content is included. A file can supply the main workarea when opened first in a separate opening operation.

Inclusion preserves the content's source-file identity. Sharing one active spatial surface does not merge all included files into one naming scope. Included files can therefore reuse names that occur in other files without renaming or silently merging the items. Inclusion must also preserve existing references within the included content.

The short single-view form can continue to imply its file's workarea. Adding more views or document views does not require another workarea declaration. Exact author spellings for explicit view/document declarations and file inclusion remain grammar work; the one-workarea rule itself is settled.

Workarea settings come from the first-opened file's active workarea. Including another file cannot replace its method, background, extent or other workarea settings. Included view/data declarations retain their explicit content and source identity. Detailed placement and file-default inheritance still need integration with the shared surface contract; do not invent a second active workarea to resolve them.

## Names and file-qualified references

Declared names must be unique within a file. Views do not create independent naming scopes that permit duplicate declarations of the same name in that file. Separate files may contain the same declared name, but an external reference must identify the file as well as the target name. Load order is not a name-resolution rule.

A repeated reference to an existing named item is not another declaration. Similarly, ordinary text and table-cell contents are values, not automatically declarations in the file's name index. This preserves the existing ability to reuse one definition in multiple views and to enter tentative text. Optional internal identities and editable titles must not weaken the owner's uniqueness rule for declared names.

The accepted qualification symbol is `::`. A compact candidate spelling is:

```text
"sales.ddn"::Customer
"support.ddn"::Customer
```

These are two different targets in two source files even when both are displayed in the main workarea. The quoted filename form is a proposal; exact relative-file resolution, aliases and reference serialization are still to be consolidated. A reference written inside an included file retains that file's local-name context rather than accidentally resolving against the main file.

Case sensitivity and canonical file identity remain lexical/reference details. They do not reopen file-wide uniqueness or the requirement to identify an external target's file.

## Documents as output views

A document view selects and arranges content for its intended output. An ordinary diagram view and a document view can use the same underlying definitions or data while choosing different presentation and selected details. Output-specific properties belong to the applicable document view and target contract: page settings for paged output, tabular projection for CSV, and declared data structure for JSON, for example. A dashboard is not required to behave like a fixed paper page.

The earlier Publication proposal contains useful capture, arrangement and output settings. Integrate those settings with document views; do not require authors to build an unrelated parallel document hierarchy. The earlier Document/EL31, View/EL02 and Publication/EL42 model anchors need an explicit mapping to this owner-defined concept before freezing their schemas. A captured artifact, snapshot or delivery operation remains distinguishable from the document view that defines the output.

This structural clarification does not claim that each output adapter is implemented or that every output has the same capabilities. The existing standalone viewer/designer/verifier and commercial collaboration boundary remains unchanged.

## Versioned built-in defaults

General standard defaults are fixed by version and hardcoded into the viewer, designer and other interpreting modules as applicable. Changing a standard default requires a new version. The reference codex documents those built-in values so independently implemented modules interpret the same version consistently.

The established priority remains:

```text
explicit file settings > applicable CSS > versioned built-in standard defaults
```

Choosing an explicit file value or CSS override is not a change to the standard defaults and does not itself require a new standard version. Ordinary DDN files need not repeat a complete defaults table or fetch one from a server. A document using an identified version must not silently acquire a newer version's defaults because newer software opens it.

The inferred notation selects version ddn-next-1, with omission bound to that same draft contract and included versions required to match. This is a planning identifier, not a released version or a claim that all default tables are frozen. See [the language reference](09-language-reference.md#one-workarea-and-included-files). No compatibility layer is required.

## Property reference codex

The owner requires a reference codex stating the properties that can be set for each catalogue and element. It must let an author answer both "What can I set here?" and "What happens if I omit it?" Catalogue entries must identify their permitted element/relation roles and link to their applicable properties; generic property lists alone are insufficient.

Each expanded catalogue/element entry needs the following information:

| Entry field | Purpose |
| --- | --- |
| Version and catalogue/method/subtype | Identifies the exact built-in contract being described |
| Element/relation role and owner | Identifies where the setting is legal, including view, document view, workarea and member settings |
| Property name and concise notation | Gives the author-facing spelling and its canonical stored meaning |
| Purpose | Explains the visible or semantic effect in ordinary language |
| Value type, units and allowed values | Defines valid settings and applicable constraints |
| Default or omission rule | States the value, explicit absence, or named deterministic rule for this version |
| Override scope | Distinguishes shared-definition settings from view/occurrence and workarea settings |
| CSS eligibility | States whether CSS may set the property under file > CSS > standard |
| Conditions and interactions | Explains when a setting applies and how it interacts with related settings |
| Example | Shows a minimal declaration and an optional override |

Resolved inheritance may keep the codex maintainable, but the reference for an individual catalogue/element must expose its complete effective property list. It must not force authors to guess which generic properties are supported. Derived diagnostics, internal bookkeeping and read-only results must be distinguished from properties authors can set.

Existing inputs are the [shared property catalogue](../../website/reference/index.html), its [machine-readable entries](../../website/reference/index.html), the [151 profile contracts](../../website/reference/profiles.html), and the [default expansion requirements](01-default-profiles.md). Their 262 shared property definitions and partial role defaults are starting material, not a claim that the complete per-catalogue/per-element codex has been finished. The latest table, notes, document-view and status requirements must be reconciled before those tables can be frozen.

## One-way status conversion

The designer offers a context-menu action that converts Draft to In-progress. This is one way: the corresponding status control does not offer a reverse In-progress-to-Draft conversion. The same recorded status setting determines the displayed status icon; there is no independently editable badge value that can disagree with the status.

The viewer displays this setting without gaining editing capability. Status remains distinct from drawing style and the table's cannot-fit indicator. Conversion does not, by itself, establish acceptance or justify inventing missing design facts. Preserve content; any additional transformation of free-form content must be specified rather than inferred from the new status label.

The owner has settled [four user-set statuses](08-status-and-acceptance.md): Draft is free form; In-progress may lack settings/information/data; In-review must be complete and pass verification; Accepted records acceptance date/time/user. An authorized user may return Accepted to In-review or In-progress. These return paths do not reopen the one-way conversion out of Draft. Accepted supersedes the earlier Certified label. The icon designs and detailed schema/authority integration remain open; the distinction between In-progress and In-review is settled.

## Specification integration

The file grammar must bind the first-opened main file, its single workarea, named local content, file-qualified included content and document views to the existing model. The surface schemas must then reflect the corrected name scope, document/view relationship and status setting. Their earlier planning checks are evidence for the earlier baseline only. These are specification changes; maintained source and reader software have not been changed.
