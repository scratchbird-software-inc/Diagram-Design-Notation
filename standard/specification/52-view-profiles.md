# 52. View profiles, strictness and registered themes (DDN 0.8 draft)

> Examples in this chapter use 0.8 (0.6-dialect) syntax, fenced ```ddn-0.8. The reference runtime implements this chapter's language constructs; the doc-snippet parse gate (`notation/tests/doc-snippets.js`) parse-checks every fence under a `ddn "0.6";` header.

Status: draft for the 0.8 standard revision (source version `ddn "0.6";`;
see chapter 51). A view profile names **what kind of diagram a view is** and
derives three things from that declaration: a default presentation (theme and
property defaults), an allowed element/relation vocabulary, and a validation
strictness. Profiles are declarations of intent checked at `check` time; they
never add semantics to the model and never change routing or layout results
beyond the documented property defaults they set.

## 52.1 Declaring a view kind

A 0.6 view may declare a `kind` and a `strictness`:

```ddn-0.8
ddn "0.6";
module "example.onboarding";
data model {
  object start "Request received" { kind: task; }
  object review "Manager review" { kind: decision; }
  object done "Approved" { kind: task; }
  flow step1 @start -> @review;
  flow step2 @review -> @done;
}
view process "Onboarding flow" {
  data: [@model];
  kind: flowchart;
  strictness: strict;
  publication { size: content; fit: none; }
}
```

(0.8 syntax — requires `ddn "0.6";`: `kind:` and `strictness:` on a view.)

Grammar supplement (extends the `property` production; both are ordinary
view-level properties, also legal inside a `format` `bundle`):

```text
ViewKind       = "kind", ":", identifier, ";" ;
ViewStrictness = "strictness", ":", ( "strict" | "permissive" ), ";" ;
```

- `kind` is a single identifier from the registered view-kind table (§52.2).
  Unknown kinds are `DDN-VP01`. `kind` on a non-view declaration, or repeated,
  follows the existing duplicate/misplacement rules (`DDN011`).
- `strictness` defaults to `permissive` when omitted. `strictness` without a
  `kind` is `DDN-VP02` (strictness has nothing to bind to).
- A bundle-supplied `kind`/`strictness` loses to a view-local declaration,
  following the standard concern-resolution order (chapter 03).

## 52.2 Registered view kinds

The 0.8 registry ships these view kinds. Each names a vocabulary subset (the
object kinds and relation verbs the view is expected to use) and a default
profile/theme attachment. Vocabulary subsets are named registry entries, not
hard-coded lists in processors; the table is normative at the subset-name
level.

| View kind | Vocabulary subset | Default attachment |
|---|---|---|
| `ddn-native` | full core registry (no restriction) | no profile constraint; classic theme |
| `flowchart` | `flow.*` process/task/decision/terminator kinds + `flow` verb | `flow.documented@2`-compatible defaults |
| `c4-context` / `c4-container` / `c4-component` | `c4.*` kinds + `c4.rel` | `c4.context@1` / `c4.container@1` / `c4.component@1` |
| `uml-class`, `uml-sequence`, `uml-state`, `uml-activity`, `uml-usecase` | the matching `uml.*` vocabulary | the corresponding installed `uml.*` profile |
| `chart-bar`, `chart-line` | record projections only | `chart.basic@1` defaults |
| `ladder` | ladder rung/coil/contact kinds | ladder profile defaults |
| `patent-figure` | §52.5 | `patent.legal@1` + `theme.mono.print@1` |

A view kind pins **defaults**, never locks: an author may still override
`style`, `layout`, `projection.profile` explicitly. Explicit author
declarations always win over kind-derived defaults (§52.4).

## 52.3 Strictness semantics

- `permissive` (default): vocabulary outside the kind's subset renders
  normally; each out-of-subset element kind or relation verb produces one
  info diagnostic `DDN-VP03` naming the element, its kind/verb, and the view
  kind. Aggregation is allowed per code (one diagnostic per offending
  element, not per view).
- `strict`: out-of-subset vocabulary is a validation **error** `DDN-VP04`;
  the view fails `check`. The message names the offending identity and the
  subset that would admit it, e.g. "object `db` (kind: database) is outside
  the `flowchart` vocabulary — use kind `task`/`process` or change the view
  kind to `ddn-native`."
- Strictness governs **vocabulary membership only**. It never relaxes any
  existing validation (profile contracts, endpoint rules, DDN2xx geometry
  checks all still apply), and it never changes rendering.

## 52.4 Profile and theme attachment

Attachment is a *defaults cascade*, resolved in this order (later wins):

1. language defaults;
2. view-kind default profile and theme (this chapter);
3. referenced `format` bundle concerns;
4. view-local declarations.

Because kind-derived values sit at layer 2, any explicit 0.5-era declaration
reproduces its 0.7 rendering byte-identically even when a kind is declared.
A kind declaration MUST NOT change the `modelFingerprint` or any semantic
validation outcome; it is a composition-time default and lint axis.

## 52.5 The patent/legal profile pack (`patent.legal@1`)

Registered as an ordinary installed profile plus the `patent-figure` view
kind. It packages the conventions of patent and legal-figure drawings:

- **Reference-numeral field boxes.** Any element may declare
  `numeral: 102;` (integer 1–99999). The profile renders the numeral in a
  boxed field row directly under the element header, and `ref:` anchors
  (chapter 55 §S4) resolve to it. Duplicate numerals within a view are
  `DDN-VP06`; a non-integer or out-of-range numeral is `DDN-VP05`.
- **Flowchart-with-decision blocks.** The `flowchart` vocabulary with the
  profile's decision styling: decisions render as labelled diamonds with
  branch labels on outgoing edges; an unlabelled decision branch is
  `DDN-VP07` under this profile (warning), because examiners require every
  branch to be labelled.
- **Document chrome defaults.** The profile's default bundle sets the
  publication chrome of chapter 53: title block with `$title` and `$date`,
  footer with `FIG. $figure` and `$page`, single page border, monochrome
  theme (§52.6).

The profile claims drawing conventions only. It is not legal advice, not a
patent-office compliance certification, and it does not validate claim text.

## 52.6 Accessibility themes

Two themes ship as named, registered themes attachable to any profile or
declared directly:

```ddn-0.8
view poster "Release poster" {
  data: [@model];
  theme: colorblind_safe;
}
```

(0.8 syntax — requires `ddn "0.6";`: `theme:` on a view.)

- `theme: colorblind_safe;` (`theme.a11y.cb@1`) — a palette whose kind/verb
  colour pairs are distinguishable under deuteranopia/protanopia/tritanopia
  simulation, with redundant non-colour encoding (dash patterns, marker
  shapes) preserved so meaning never rides on hue alone.
- `theme: mono_print;` (`theme.mono.print@1`) — pure black/white/grayscale
  for B/W filing and print: fills restricted to white, hatching and line
  styles carry distinctions, minimum effective contrast 4.5:1 for text
  against its background.

Theme rules: a theme re-skins colours, fills, dash patterns and line weights
**only**. It MUST NOT change geometry, layout, routing, label text or
semantics — the same source under two themes differs only in paint
attributes. Unknown theme names are `DDN-VP08`. A `forbidden` marking
(chapter 55 §S1) keeps a non-colour rendering (strike/dash) under every
theme, including `mono_print`.

## 52.7 Diagnostic codes allocated by this chapter

| Code | Severity | Meaning |
|---|---|---|
| `DDN-VP01` | error | Unknown view `kind`; message lists registered kinds. |
| `DDN-VP02` | error | `strictness` declared without a view `kind`. |
| `DDN-VP03` | info | Element/verb outside the view kind's vocabulary (permissive mode). |
| `DDN-VP04` | error | Element/verb outside the view kind's vocabulary (strict mode); message names the fix. |
| `DDN-VP05` | error | `numeral` not an integer in 1–99999. |
| `DDN-VP06` | error | Duplicate `numeral` within one view; message names both elements. |
| `DDN-VP07` | warning | Decision branch without a label under `patent.legal@1`. |
| `DDN-VP08` | error | Unknown theme name; message lists registered themes. |
| `DDN-VP09` | error | View kind conflicts with an explicit incompatible projection kind (e.g. `kind: chart-bar` with `projection { kind: graph; }`). |
