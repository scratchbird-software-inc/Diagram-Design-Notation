# 59 Composable element sections and text documents

Status: implementation contract, source dialect `ddn "0.7";`. This is an additive contract; package/release numbering is separate. Sources through dialect 0.6 retain their existing rendering. No database execution or migration engine is introduced by this chapter.

## 59.1 Sections and defaults

An element can expose `name`, `type`, `table` and `notes`. `table` means its structured field/parameter grid, not a Markdown table or a database table kind. `notes` means a text document, including authoritative source code. A procedure remains a procedure when its grid is shown or hidden.

Registry `composition_defaults` declares the initial section list, body order, note height and wrapping policy for a kind. The default is all four sections, table before notes, a 180px note viewport and automatic wrapping. Table defaults show name/type/table; note silhouettes default to name/type/notes. Profile kinds without an explicit record use the common default. Empty sections reserve no body space.

The precedence is **type defaults < element composition < appearance composition**. Arrays replace the inherited array; other keys replace individually. A default is not permission to discard hidden content. Removing a composition override restores inheritance.

A `composition {}` group or `document {}` group opts an element into composed-detail rendering. Declarations with neither group keep their established geometry, including in a 0.7 source. This makes upgrades explicit and preserves the specialized profile renderers. Composed detail uses a card enclosure and the registered type glyph/full type name when the type section is enabled; it is a detail representation, not a replacement for a profile's canonical silhouette. Whole-view charts, timelines, matrices and other generated projections retain their own presentation contracts.

```ddn-0.7
object calculate_total "Calculate total" {
    kind: procedure;
    fields {
        amount { datatype: decimal; parameter_mode: in; }
        total { datatype: decimal; parameter_mode: out; }
    }
    columns {
        mode { path: "parameter_mode"; }
        name { path: "name"; }
        type { path: "datatype"; }
    }
    document {
        format: code;
        role: procedure_source;
        language: "sql";
        text: "BEGIN\n    total := amount;\nEND;\n";
    }
    composition {
        sections: [name, type, table, notes];
        order: [table, notes];
        note_height: 180px;
        note_wrap: off;
    }
}
```

`sections` is a nonempty list of unique section names. Any subset is legal, including name/type only, table only and notes only. `order` contains table and notes exactly once, in the desired vertical order; hidden sections are skipped. `note_height` is a finite 48–2000px viewport height. `note_wrap` is `auto`, `on` or `off`; auto wraps prose and preserves unwrapped literal-code lines. Parameter mode is `in`, `out`, `inout` or `return`, restricted to fields of procedure/function definitions. This is a portable declaration vocabulary, not validation against a particular SQL engine.

For a graph appearance, the same composition group is legal inside `place`. It changes only that appearance and follows chapter 03 occurrence addressing. Explicit multiple-appearance limits of chapter 03 continue to apply.

```ddn-0.7
place @model.calculate_total#2 {
    composition { sections: [name, type, notes, table]; order: [notes, table]; }
}
```

Field IDs do not change when a table moves. Field endpoint coordinates are recomputed from the relocated rows before routing. Body ordering is not parameter ordering. Name/type visibility is independent of the shared semantic label and kind.

## 59.2 Text documents

An element has at most one `document {}` group. The content is shared by all appearances. The document accepts `format` (`plain`, `markdown_text`, `code`), `role` (`note`, `procedure_source`, `function_source`, `source`), optional `language`, required `text` and optional `digest`. Format and role default to plain/note. Language is bounded descriptive text and never selects an execution engine.

Text is a JSON-style DDN string. Escaped line endings, tabs, trailing whitespace and quotes are retained in model content, copy/source editing, snapshots and bundles. A readable multiline literal is not introduced. SHA-256 is computed over the exact UTF-8 text, without newline normalization; a supplied digest must match. The resolved record always carries its digest. Role/format/language remain separate semantic properties and are not covered by the text-only digest.

A procedure body is authoritative content even though it is displayed in the notes section. No display choice may remove it from a complete private model. The reference runtime does not execute source code, validate SQL grammar, derive parameter declarations from text, connect to databases, or claim cross-database SQL portability.

When composed detail has no explicit document, an existing description can supply a plain-text note. This does not reinterpret legacy description strings as Markdown. Description remains a legacy property, not an external document reference.

## 59.3 DDNN storage

Large documents may be stored in UTF-8 JSON companions with extension `.ddnn`. The format is `ddnn@1`:

```json
{
  "format": "ddnn@1",
  "documents": {
    "calculate-total-body": {
      "format": "code",
      "role": "procedure_source",
      "language": "sql",
      "text": "BEGIN\n    total := amount;\nEND;\n"
    }
  }
}
```

The owning element uses an explicit reference:

```ddn-0.7
document { file: "my_project.ddnn"; id: "calculate-total-body"; }
```

An external reference permits only file, id and optional expected digest. Inline properties and external properties cannot be mixed. Paths are relative to the owning DDN source, must remain inside the workspace, and are never remote URLs. Document IDs are stable record keys, independent of display labels. Matching basenames are a convenience, not a discovery rule. Multiple DDNN files and multiple references to a shared record are permitted.

Missing files/records and digest mismatches are coded errors, including when notes are hidden. This implementation takes the conservative complete-model path rather than silently accepting missing explanatory text. A downstream recreation/alteration reader must consume complete content and refuse incomplete authoritative dependencies. Source dialect, semantic type and declared code language remain explicit inputs to that reader.

SDK workspaces, snapshots, directory/file import and ZIP transfer preserve DDNN sources. A self-contained DDN bundle hydrates external records into inline document groups. Hydration changes storage location but not text, digest or model meaning. Renaming a DDNN file updates explicit references. Removing a referenced file requires the normal dependency guard. A document edit and its reference are one validated workspace/history transaction. Removing a reference does not delete the shared external record.

`.ddna` is accepted as an automation-companion filename alongside the existing `.ddna.ddn` convention; its content remains DDN syntax and existing DDNA metadata. `.ddnn` is JSON content, not a DDN module and not an importable semantic namespace. DDN owns structure/identities, DDNA owns automation bindings, and DDNN stores inert text.

## 59.4 Text Markdown profile

`markdown_text` uses the explicit `ddn-markdown-text@1` subset. It supports line-oriented paragraphs, ATX headings, strong/emphasis spans, inline code, fenced/indented code, ordered/unordered list markers and block quotes. Its grammar is deliberately smaller than full CommonMark; unsupported extensions are not activated by library defaults. Soft source line breaks remain display breaks in this profile.

Markdown images and raw HTML outside literal code/escaped text are rejected. Pipe/table-looking text remains literal text and never becomes a grid. Links, math, diagrams, footnotes, task widgets and other extensions remain text; no resource is fetched and no navigation or code execution is implied. A fence tagged `mermaid` remains literal code. Literal-code contexts may contain HTML, Markdown syntax, SQL operators and arbitrary text.

Fences must close. Inline style nesting and list/quote nesting are bounded to eight. The reference limits are 1,000,000 UTF-16 units per document, 20,000 logical lines and 50,000 parsed runs. These bound reference-tool work; they do not turn a diagram appearance into an execution context. DDN source/workspace size limits continue to apply. Typography uses the shared measured-text service with its font provenance and fallback rules.

## 59.5 Interactive viewport and publication

Notes occupy a bounded viewport. When content exceeds its dimensions, the interactive component supplies horizontal and/or vertical scrollbars. Wheel, Shift-wheel, scrollbar dragging and keyboard scrolling are supported. Offsets belong to the viewer session and each appearance; they do not alter content, model fingerprints or DDNA instance identity.

The runtime lays out text but emits only visible lines into the viewport SVG. Scrolling replaces the visible text window and moves accessible scrollbar thumbs without rebuilding or rerouting the model. The full content stays in the resolved document; the scene stores layout data needed to change windows. A scrollbar is not permission to truncate stored text.

`publication { note_mode: viewport; }` is the default composed-detail publication. A clipped note identifies itself as a scrollable excerpt and retains visible scrollbar indicators. Static SVG cannot scroll without an interactive host. `publication { note_mode: full; }` wraps and expands all note text for complete static output; ordinary artboard and minimum-font checks still apply. Neither mode changes the content returned to model readers. Oversized full output requires a suitable publication size/detail view.

Public/redacted export continues to remove document text and legacy descriptions under the existing structural allowlist. It does not grant source-code publication merely because the owning element is allowlisted. Scene text, source maps and viewport contents must be generated from the projected model. Full private exports preserve complete documents.

## 59.6 API and DDNA

The SDK provides `authoring.setComposition` (element or appearance scope), `authoring.setDocument`, `workspace.documents(entry, view)` and validated atomic `workspace.commitFiles`. `documents` returns complete resolved document content for the view's data scope, regardless of displayed sections. It is a private model-reader API, not a redacted publication API. The existing `resolve` API also contains complete content.

The designer Meaning tab edits shared defaults and text content; This view overrides visible sections, order, note height and wrapping for the selected appearance. Saving a new content construct upgrades the edited DDN file's source header to 0.7. Other elements retain their legacy path unless they opt in. Consumers must update companion version declarations as required by the existing DDNA coupling contract; no execution engine is inferred or upgraded.

DDNA replay maps a semantic target to all visible appearances. Appearance ordinals are not runtime instance discriminators. Replay remains read-only and does not reveal hidden note content. Display overlays continue to obey their existing count limits. This chapter adds no SQL execution engine and does not close the unimplemented DDNA execution-model classes.

## 59.7 Diagnostics and compatibility

DDN-CE01: invalid composition; DDN-CE02: invalid parameter mode/context; DDN-NT01: invalid document/sidecar schema; DDN-NT02: document work limit; DDN-NT03: content digest mismatch; DDN-NT04: missing content dependency; DDN-NT05: prohibited Markdown image/HTML; DDN-NT06: unclosed code fence. DDN-V04 rejects new source constructs in older dialects.

Resolved output uses `ddn-resolved@0.7` when a 0.7 source is present. Composition is presentation and is excluded from model canonicalization; external storage paths are excluded from document meaning. Text, format, role and language remain semantic content. Existing semantic canonicalization is unchanged for legacy models. Descriptor defaults and source changes must preserve source-map identities, atomic undo and exact text round trips.
