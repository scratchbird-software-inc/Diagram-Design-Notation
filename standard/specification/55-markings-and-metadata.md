# 55. Markings, assertions, provenance and cross-references (DDN 0.8 draft)

> Examples in this chapter use 0.8 (0.6-dialect) syntax, fenced ```ddn-0.8. The reference runtime implements this chapter's language constructs; the doc-snippet parse gate (`notation/tests/doc-snippets.js`) parse-checks every fence under a `ddn "0.6";` header.

Status: draft for the 0.8 standard revision (source version `ddn "0.6";`).
This chapter adds declarative markings and metadata that travel with the
model but, in 0.8, **evaluate nothing**: no marking fires a rule engine, no
assertion is checked against data, no provenance field authenticates anything.
They are authored claims carried, rendered and exported — no more.

## 55.1 Markings: the general mechanism (S1)

A *marking* is a named, theme-rendered annotation on an element or relation,
declared with `marks`:

```ddn-0.8
relation legacy_path @old_api -> @db {
  kind: flow;
  marks: [forbidden];
}
object draft_feature "Experimental export" {
  kind: component;
  marks: [tentative];
}
```

(0.8 syntax — requires `ddn "0.6";`: `marks`.)

- `marks` is an array of registered marking names. Unknown markings are
  `DDN-MK01`; duplicates in one array are `DDN-MK02`. Markings compose: an
  element may carry several.
- 0.8 registers two markings:
  - `forbidden` — negation/prohibition. On a relation it renders
    struck-through with a dashed, theme-supplied prohibition treatment (red
    under the default theme; hatched-strike under `mono_print`, dash-heavy
    under `colorblind_safe`) so the signal never rides on colour alone
    (chapter 52 §52.6). On an element it renders the element's outline with
    the same treatment. Semantically it asserts **absence or prohibition by
    the author's claim only** — the runtime does not verify that the
    forbidden path is unreachable.
  - `tentative` — draft/uncommitted content, rendered dashed-grey per theme.
- Negated prose uses the ordinary note idiom plus a marking:
  `note n1 "Not permitted during lockdown" { marks: [forbidden]; }`.
  There is no separate "negation note" element kind.
- Markings are part of the model: they appear in `modelFingerprint`, exports
  and diffs. Removing a marking is a model edit, not a view option.
- Extensibility: new markings register additively in the registry with a
  rendering contract per theme; profiles MUST NOT reuse `forbidden` to mean
  anything other than negation/prohibition.

## 55.2 Assertions (S2)

An *assertion* is optional machine-readable claim text attached to a view or
relation:

```ddn-0.8
relation pay @order -> @ledger {
  kind: flow;
  assertion: "every order posts exactly one ledger entry";
}
view billing "Billing overview" {
  data: [@model];
  assertions: [
    "no cycle contains a payment gateway",
    "every refund references an order"
  ];
}
```

(0.8 syntax — requires `ddn "0.6";`: `assertion` / `assertions`.)

- `assertion` (single string, on a relation) and `assertions` (array of 1–32
  strings on a view; overflow `DDN-MK03`). Strings are plain text, 1–500
  characters (`DDN-MK04`).
- **Inert in 0.8.** Assertions are parsed, validated for shape, carried in the
  resolved IR, shown in exports (`export { … }` includes them in JSON), and
  surfaced in the designer inspector. They are **never evaluated**: no
  assertion influences `check` results, rendering, or conformance. A failing-
  looking assertion is not a diagnostic; a true-looking one is not evidence.
  Evaluation semantics are deferred to 0.9 (chapter 58 records the
  conformance hook).
- Assertions are not executable in any dialect: they run no expression
  language (chapter 16 §16.2 discipline).

## 55.3 Provenance metadata (S3)

Optional view-level provenance:

```ddn-0.8
view arch "System context" {
  data: [@model];
  source: "system-overview.docx §3";
  generator: "ddn-import 0.8.0 (2026-10-04)";
}
```

(0.8 syntax — requires `ddn "0.6";`: `source` / `generator` on a view.)

- `source`: free text (1–300 chars) naming the upstream document the view
  derives from. Convention: `document §locator`; no URL fetching is implied
  and the runtime never resolves it.
- `generator`: free text naming the producing tool, its version and date,
  for machine-authored documents. Hand-authored views omit it.
- Both are metadata only: excluded from `modelFingerprint` (they describe
  the document, not the model), included in JSON export, shown in the
  designer's document properties. They are claims, not signatures — chapter
  08's trust rules are unchanged.
- Generators SHOULD write both fields on every machine-authored view;
  validators MUST NOT require them.

## 55.4 Cross-reference anchors: `ref:` (S4)

Notes and labels may embed references to other elements' reference numerals
(chapter 52 §52.5) or ids:

```ddn-0.8
object valve "Shutoff valve" { kind: component; numeral: 112; }
note ops "Service interval" {
  text: "Drain via ref:valve before opening ref:pump.";
}
```

(0.8 syntax — requires `ddn "0.6";`: `ref:` anchors in text.)

- Syntax: `ref:<element-id>` inside any rendered text run (labels, note text,
  header/footer chrome strings). The anchor renders as the target element's
  `numeral` when it has one, else its display label. The rendered text is
  computed at render time, so numerals stay consistent under edits —
  renumbering an element updates every anchor automatically.
- An anchor naming a missing element is `DDN-MK05` (error) — references
  break loudly (§55.5). Anchors are **block-scoped**: the anchor site and its
  target MUST be elements of the same data block (the view's selected data
  scope); an anchor that resolves in the workspace but whose target lies in
  another data block fires `DDN-MK05` exactly like a missing element. An
  anchor to an element with no numeral renders its
  label; an anchor inside its own element's text is `DDN-MK06`.
- Anchors resolve to **text only**; they carry no hyperlink. Viewer
  navigation hooks for them are specified in chapter 57 §D1.

## 55.5 uid duplication semantics (S5)

Every element carries a stable `uid` (source id or assigned). Editing
operations observe:

- **Move** (cut/paste, drag across groups or frames, reorder): the uid is
  **preserved**. All relations, `ref:` anchors, `marks`, assertions and
  bindings follow the element. A move is not a delete-plus-create.
- **Duplicate** (copy/paste, designer "duplicate"): a **new uid is minted**
  (`<id>_copy`, then `<id>_copy2`, …, first free name). The duplicate is a
  new identity:
  - relations of the original are NOT copied (the duplicate starts
    unconnected) unless the designer gesture explicitly selected them;
  - `ref:` anchors elsewhere still point at the **original** — they are
    never silently retargeted;
  - `numeral`, when present, is not duplicated (a collision would be
    `DDN-VP06`); the duplicate's numeral field starts empty.
- **References break loudly**: deleting an element that is the target of a
  `ref:` anchor, a relation endpoint, a binding or a publication-set figure
  fails the next `check` with the relevant coded error (`DDN-MK05`,
  `DDN022`, `DDN-PB09`). No tool repairs a dangling reference by guessing.
- uid stability across file saves: uids are source ids; a rename of the id
  is a delete-plus-create at the language level, and tools that rename must
  offer to rewrite referencing sites (anchors, bindings, relations) in the
  same undo transaction.

## 55.6 Deferred: diff views (S6)

`diff: [@viewA, @viewB]` with added/removed/changed styling by uid
(geometry ignored; label/kind/marks compared) is **deferred to 0.9**. 0.8
processors MUST reject `diff` as an unknown property (`DDN-V04` in 0.6
files) rather than half-implement it. The uid semantics of §55.5 are written
so diff can build on them without amendment.

## 55.7 Diagnostic codes allocated by this chapter

| Code | Severity | Meaning |
|---|---|---|
| `DDN-MK01` | error | Unknown marking name in `marks`; message lists registered markings. |
| `DDN-MK02` | error | Duplicate marking in one `marks` array. |
| `DDN-MK03` | error | More than 32 assertions on one view. |
| `DDN-MK04` | error | Assertion text empty or over 500 characters. |
| `DDN-MK05` | error | `ref:` anchor names a missing element; message names the anchor site. |
| `DDN-MK06` | error | `ref:` self-reference within an element's own text. |
