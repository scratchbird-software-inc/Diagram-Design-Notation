# 35. CMMN-style case diagrams (profile `cmmn.basic@1` on projection `graph`)

Status: implemented in runtime 0.7.0, governed by RFC-109
(`standard/governance/rfcs/RFC-109-cmmn.md`). Source grammar remains DDN 0.5;
the kinds are registry entries, stage grouping is the existing view `frame`
with a resolved `scope`, and sentry typing uses a registered `x_*` extension
property, so this chapter is a semantic addition, not a grammar change.

A CMMN-style case view models case-style planning — stages containing plan
items, entry/exit criteria on stage borders, and milestones — on the existing
`graph` projection. Users write
`projection { kind:graph; profile:"cmmn.basic@1"; }`.

This is profile-level coverage, not CMMN conformance.

## Metamodel

- **Stages** — a `cmmn.stage` object (silhouette `round`, fallback
  `activity`, family `activity`, code `STAGE`) plus a view `frame` whose
  `scope` resolves to that stage element and whose `members` are the stage's
  plan items (tasks, milestones, sentries). The frame renders as the existing
  frame box; its scope object is the stage header. Membership is declared by
  the frame's `members` list, never inferred from geometry.
- **Milestones** — `cmmn.milestone` nodes (silhouette `round`, fallback
  `activity`, family `activity`, code `MILESTONE`), rendered as rounded
  nodes.
- **Sentries** — `cmmn.sentry` nodes (silhouette `diamond`, fallback
  `activity`, family `activity`, code `SENTRY`), rendered as small diamond
  nodes, carrying the registered extension `x_sentry:{on:…}` with `on` one of
  `entry`, `exit` (schema:
  `{type:'object', required:['on'], properties:{on:{enum:['entry','exit']}}, additionalProperties:false}`
  on objects).
- **Tasks** — the existing `analysis.task` kind, reused unchanged; no new
  task kind is registered.
- **Links** — containment-free links inside a stage use the existing `assoc`
  (structural) verb; ordering uses the existing `analysis.precedes` verb. No
  new verbs are registered.

## Declaration rules

- "On the stage border" is a declared-membership notion in v1: a sentry is
  on a stage's border exactly when it is a member of the view frame whose
  `scope` resolves to that `cmmn.stage` element.
- Every selected `cmmn.sentry` must be a member of at least one such stage
  frame and must carry a valid `x_sentry.on`; otherwise the view is rejected
  with `DDN-PJ120` (error; the message names the sentry). Malformed
  `x_sentry` values — for example `x_sentry:{on:"during"}` — are caught
  earlier by the extension schema contract as `DDN105`; `DDN-PJ120` covers
  the membership and missing-property cases.
- A sentry that is a member of a frame whose scope resolves to a non-stage
  element is likewise rejected with `DDN-PJ120`.

## Example

```ddn
data claim {
    object review "Review" { kind: "cmmn.stage"; }
    object gather_documents "Gather documents" { kind: "analysis.task"; }
    object assess_claim "Assess claim" { kind: "analysis.task"; }
    object docs_received "Docs received?" { kind: "cmmn.sentry"; x_sentry: { "on": "entry" }; }
    object claim_decided "Claim decided" { kind: "cmmn.milestone"; }
    relation order "order" @gather_documents -> @assess_claim { kind: "analysis.precedes"; }
}

view case "Claim handling" {
    data: [@claim];
    projection { kind: graph; profile: "cmmn.basic@1"; }
    frame review_frame "Review" {
        scope: @claim.review;
        members: [@claim.gather_documents, @claim.assess_claim, @claim.docs_received];
    }
}
```

See `website/examples/basics/49-cmmn.ddn` for the full runnable example.

## Out of scope

CMMN XML interchange, case execution semantics, discretionary items, and full
CMMN conformance are unsupported (recorded in the profile catalogue and
`capabilities.json`).
