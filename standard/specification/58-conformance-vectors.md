# 58. Conformance: reference vectors and the degenerate corpus (DDN 0.8 draft)

Status: draft for the 0.8 standard revision. This chapter defines what an
implementation must pass to claim 0.8 conformance, complementing chapter 07
(executable capability matrix) and chapter 00 (conformance layers). The
suite ships in the repository under `notation/tests/vectors/` (canonical
sources) and `notation/tests/vectors/manifest.json` (expected results);
this chapter is the normative description of that suite's construction.

## 58.1 Reference vector suite (C1)

A *reference vector* is one canonical `.ddn` file plus its expected outcome.
The 0.8 suite covers every construct introduced in chapters 51–57, at
minimum one acceptance vector and one rejection vector per diagnostic code
allocated there.

Each manifest entry records:

```json
{
  "id": "text-fit-wrap-01",
  "source": "text-fit-wrap-01.ddn",
  "view": "main",
  "expect": {
    "diagnostics": [],
    "svg_sha256": "…",
    "geometry_sha256": "…"
  }
}
```

**Hash policy (normative).** Rendering depends on font metrics, so two hash
classes exist:

1. **Full-fidelity vectors** (`svg_sha256`): authored under a font pin and
   `metrics: required` (chapter 54 §54.4), with `publicationDate` pinned
   when chrome uses `$date`. Any conformant renderer on any platform MUST
   reproduce the byte hash. A renderer that cannot honor font pins cannot
   claim full-fidelity conformance.
2. **Geometry-only vectors** (`geometry_sha256`): a SHA-256 over a
   canonicalized geometry projection of the scene — node/edge/label boxes
   and path point sequences rounded to 0.01 px, in document order, with all
   text content and paint attributes excluded. Geometry-only vectors let a
   renderer with its own metric environment prove layout/routing equality.
   Every full-fidelity vector also publishes its geometry hash.

A conformant 0.8 implementation MUST: (a) reproduce `diagnostics` exactly —
codes, severities, and `file`/`line` locations per chapter 56 §X4 — for
every vector; (b) reproduce every full-fidelity `svg_sha256` OR document
itself as geometry-only conformant and reproduce every `geometry_sha256`;
(c) fail no rejection vector silently — each must raise its named code.

Double-render determinism (same input rendered twice, byte-identical) is a
conformance gate for every vector, per chapter 51 §51.5.

## 58.2 Degenerate corpus (C2)

The suite includes a fixed degenerate corpus; every entry must check and
render without an uncaught error:

| Vector | Content | Expected |
|---|---|---|
| `empty-view` | `data` block with no elements; one view | empty artboard, no diagnostics |
| `single-node` | one element, no relations | single centered node |
| `stress-500` | 500 nodes, 600 relations, layered layout | completes; `DDN-LW06`-class budget notes allowed; exceeds the 128-element **live-view** cap only in the batch/CLI path, which must still complete |
| `unicode-labels` | labels in CJK, RTL Arabic, combining marks, emoji, ZWJ sequences | measured via pinned metrics or `DDN-TW01` estimates; no mojibake, no crash |
| `max-nesting` | frames nested to the registry depth limit | renders; one level beyond is the coded depth error |
| `empty-chrome` | header/footer runs with empty `$title` (no title, no label, bare view id) | falls back to view id; no `DDN-PB` error |
| `overflow-floor` | `shrink` element whose text cannot fit even at the absolute 8 px floor | `DDN-LW08`, render completes with ellipsis marker |
| `ref-cycle-label` | two notes whose texts anchor each other via `ref:` | renders (anchors resolve to numerals, not text — no infinite regress); a literal self-anchor is `DDN-MK06` |

## 58.3 Regression corpus

The patent-drafts figure corpus
(`kimi-specification-workarea/patent-drafts/*/figures/*.ddn`) is a
standing regression set for 0.8: every figure must render with crossing
counts ≤ the 0.7.0 baseline recorded in the 0.8 verification report, and
byte-identical where the figure uses no 0.8 feature.

## 58.4 Conformance claims

An implementation states its claim per vector class: "0.8 full-fidelity",
"0.8 geometry-only", or "0.8 check-only" (diagnostics contract only, no
render conformance). Claims name the suite version (the manifest's
`suite` field) and the renderer version. Assertion evaluation (chapter 55
§S2) and diff views (§55.6) carry no 0.8 vectors; claiming them is a 0.9
matter.
