# RFC 109 — CMMN-style case diagram profile (`cmmn.basic@1` on `kind:graph`)

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive; profile cmmn.basic@1; kinds cmmn.stage/cmmn.milestone/cmmn.sentry; extension x_sentry

## Problem and motivating example

Case-style planning — stages with entry/exit criteria and milestones —
complements procedural flowcharts: a flowchart says what happens next; a case
view says which phase work belongs to and what gates each phase (D1). Neither
`flow.basic@1` nor `uml.activity@1` models declared stage membership with
typed sentries.

Motivating example: a synthetic claim-handling case. A review stage contains
the tasks `gather_documents` and `assess_claim`; a sentry `docs_received`
guards entry into the stage; a milestone `claim_decided` marks the outcome.
An `analysis.precedes` edge orders the two tasks.

## Proposed syntax

No grammar change. Kinds are registry entries, stage grouping is the existing
view `frame` with a resolved `scope` (the mechanism introduced for subject
boundaries and reused for composite states), and sentry typing is a
registered `x_*` extension, which `validateKnown` exempts from the property
allowlist (`ddn-core.js`). Verified: `standard/grammar/ddn.ebnf` untouched
(D2).

- New profile `cmmn.basic@1` bound to the existing projection `kind:graph`.
- New profile kinds:
  - `cmmn.stage` — silhouette `round`, fallback `activity`, family
    `activity`, code `STAGE`, glyph `object`, aliases `[]`.
  - `cmmn.milestone` — silhouette `round`, fallback `activity`, family
    `activity`, code `MILESTONE`, glyph `object`, aliases `[]`.
  - `cmmn.sentry` — silhouette `diamond`, fallback `activity`, family
    `activity`, code `SENTRY`, glyph `object`, aliases `[]`.
- New registered extension property on objects:
  - `x_sentry`:
    `{ "type":"object", "required":["on"], "properties":{ "on":{ "enum":["entry","exit"] } }, "additionalProperties":false }`.
- No new verbs. Containment-free links inside a stage use the existing
  `assoc` (structural) verb; ordering uses the existing `analysis.precedes`
  verb (both registered — verified).

**Verified correction — `x_sentry`, not plain properties.** Plain non-`x_`
properties such as `on:entry` / `on:exit` parse but produce `DDN-W106`
warnings / `DDN106` in strict mode (`validateKnown` in `ddn-core.js` exempts
only `x_*`). The sentry criterion is therefore registered as the extension
`x_sentry:{on:"entry"|"exit"}` (same mechanism as RT-101 context §7 and the
`x_event`/`x_gateway` registrations of RFC-106; a JSON-schema `enum` is
inside the supported contract subset — verified).

```ddn
view case "Claim handling" {
    data: [@claim];
    projection { kind: graph; profile: "cmmn.basic@1"; }
    frame review_frame "Review" {
        scope: @claim.review;
        members: [@claim.gather_documents, @claim.assess_claim, @claim.docs_received];
    }
}
```

## Semantic normalization and identity effects

None beyond resolution (D3). A stage is a `cmmn.stage` object plus a view
`frame` whose `scope` resolves to that stage element and whose `members` are
the stage's plan items (tasks/milestones/sentries) — frame `scope` is
resolved to the element uid at compile time (`ddn-core.js` frame build,
verified). A milestone is a `cmmn.milestone` node. A sentry is a
`cmmn.sentry` node carrying `x_sentry.on`. Tasks reuse the existing
`analysis.task` kind unchanged; no new task kind. "On the stage border" is a
declared-membership notion in v1: the sentry is a member of the stage's
frame. Identities are untouched.

Rejection behavior (D4):

- `DDN-PJ120` (NEW, error) — a selected `cmmn.sentry` is not a member of any
  frame whose scope resolves to a `cmmn.stage` element, or lacks a valid
  `x_sentry.on` (malformed values are already caught by the schema contract
  `DDN105`; this code covers the membership and missing-property cases). The
  message names the sentry.

Code verified free: `grep -rhoE "DDN-PJ120" notation/ standard/ examples/`
prints nothing (RT-101…108 took PJ110–PJ119 + PJW03).

## Visual encoding and routing effects

No renderer change (D5). A stage frame is the existing frame box; its scope
object is the stage header (the same frame machinery the `x_pool`/`x_lane`
pass-through flags use). Sentries render as small diamond nodes (existing
`diamond` silhouette); milestones as rounded nodes (existing `round`
silhouette). Layout and routing are the graph renderer's existing,
deterministic behavior.

## Alternatives considered

- **Geometric border detection for sentries** — rejected for v1 (D6):
  membership is declared (frame `members`), not inferred from coordinates.
- **New containment verbs** — rejected (D6): frames already declare
  membership.
- **A new projection kind** — rejected (D6): the view is graph-shaped; the
  existing `graph` projection carries it.

## Compatibility and migration

Purely additive (D7). No existing kind, verb, profile, or property is edited;
published profiles keep their contracts. Sources that do not use
`cmmn.basic@1`, the `cmmn.*` kinds, or `x_sentry` are unaffected. The
capabilities `unsupported[]` metamodel line is untouched.

## Security, privacy and accessibility

No new inputs: nodes, edges, frames and metadata are already-declared
model/view data. Labels are escaped through the shared `esc()` helper like
every other label. The diagram makes no conformance claim: this is
profile-level coverage, not CMMN conformance.

## Machine schema and diagnostic changes

- `standard/registry/profiles/catalogue.json`: new `kinds[]` entries
  `cmmn.stage`, `cmmn.milestone`, `cmmn.sentry`; new `profiles[]` entry
  `cmmn.basic@1`. Additive only.
- `notation/runtime/ddn-profiles.js` `registry()`: new
  `extension_contracts.x_sentry` on objects.
- `standard/registry/extensions.json` `contracts{}`: mirror of `x_sentry`.
- `notation/runtime/ddn-profile-quality.js` `validate()`: new
  `cmmn.basic@1` block implementing `DDN-PJ120` (mirroring the
  `uml.usecase@2` frame-scope check's style).
- `standard/registry/capabilities.json`: one `implemented[]` line appended;
  `installedProfiles[]` gains the `cmmn.basic@1` entry.
- New diagnostic: `DDN-PJ120` (error).

## Positive and negative fixtures

- Positive example: `examples/basics/49-cmmn.ddn` — a synthetic
  claim-handling case: `cmmn.stage` object `review`; `analysis.task` objects
  `gather_documents` and `assess_claim`; `cmmn.sentry` `docs_received`
  (`x_sentry:{on:"entry"}`); `cmmn.milestone` `claim_decided`; an
  `analysis.precedes` edge between the tasks; a view `case` with a frame
  scoped to the stage listing the tasks and the sentry as members.
- Test suite: `notation/tests/cmmn.js` — positive render with the stage
  frame, both tasks, the sentry diamond and the milestone; an exit sentry
  (`x_sentry:{on:"exit"}`) inside the stage frame renders; `DDN-PJ120` for a
  sentry outside every stage frame and for a sentry member of a frame whose
  scope is not a `cmmn.stage`; `DDN-PJ120` for a sentry without `x_sentry`;
  `DDN105` for `x_sentry:{on:"during"}`; byte-identical determinism; a
  multi-view file rendering the same model under `cmmn.basic@1` and a plain
  graph profile, each with its own profile asserted.

## Implementation/conformance impact

Touch points: this RFC, profile catalogue entries, `ddn-profiles.js`,
`extensions.json`, `ddn-profile-quality.js`, `capabilities.json`, example 49,
test suite, spec chapter `35-cmmn-cases.md`. The grammar
(`standard/grammar/ddn.ebnf`) is untouched; existing profiles' rendering and
validation paths are untouched; the renderer is untouched.

This is profile-level coverage, not CMMN conformance.

## Open questions and decision record

- D1 motivation, D2 vocabulary (profile `cmmn.basic@1`; kinds
  `cmmn.stage`/`cmmn.milestone`/`cmmn.sentry`; extension `x_sentry`; no new
  verbs; no grammar change), D3 semantics (stage as scoped frame of plan
  items; declared-membership sentries; tasks reused as `analysis.task`), D4
  rejection behavior (`DDN-PJ120`), D5 visual encoding (existing frame box,
  diamond and round silhouettes; no renderer change), D6 alternatives, D7
  compatibility: recorded above as fixed decisions of this RFC, including the
  verified correction (`x_sentry` registered extension instead of plain
  `on:entry|on:exit` properties).
- Open: CMMN XML interchange, case execution semantics, and discretionary
  items remain unsupported; a later RFC may add them under a new profile
  version.
