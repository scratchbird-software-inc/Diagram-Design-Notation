# RFC 0127 — CMMN 1.1 notation compliance (profile `cmmn.complete@1`)

Status: implemented  
Authors/reviewers: B1-064 work item  
Language/registry impact: additive registry entries within the 0.7 draft; new profile `cmmn.complete@1`; `cmmn.basic@1` immutable; no grammar change; runtime/specification 0.7 line.

## Problem and motivating example

`cmmn.basic@1` covers scoped stage frames, rounded milestones and entry/exit sentries, with generic tasks. CMMN 1.1 additionally specifies: the case plan model container, typed tasks (human/process/decision, blocking variants, discretionary dashed forms), timer and user event listeners, stage variants, sentry on-part/if-part separation with criterion attachment, plan-item decorators (required, repetition, manual activation, completion), case file items, and planning tables.

## Proposed syntax

No grammar change. Additive kinds/relations/contracts; the B1-063 decorator layer is extended (not forked):

1. **New kinds** (family `activity`): `cmmn.caseplan` (clipboard/tab container), `cmmn.task` (generic/blocking), `cmmn.humantask`, `cmmn.processtask`, `cmmn.decisiontask` (binds a `decision.rules@1` view where declared), `cmmn.timerevent` (hourglass silhouette, reused), `cmmn.userevent` (circle with person), `cmmn.casefile` (folded document).
2. **`x_cmmn` (new closed contract, object target)**: `{ discretionary?, nonblocking?, required?, repetition?, manual_activation?, completion? }` — discretionary/non-blocking render dashed borders; decorators render as the badge row (extended B1-063 layer: `!` required, circular-arrow repetition, hand manual-activation, check completion).
3. **Sentries upgraded** — `x_sentry` grows `{ on: entry|exit, attach?: @ref, on_part?: @ref, if_part?: string }`: criterion attachment relocates the sentry onto the plan item's border (B1-063 boundary machinery); `on_part` names the event/case-file source (drawn as a `cmmn.sentryref` connector), `if_part` is the condition text inside the sentry.
4. **New relations**: `cmmn.dependency` (dashed open-arrow dependency between plan items), `cmmn.sentryref` (solid connector from event listener/case file to sentry).
5. **Planning tables** — `x_planning: { items: [string] }` on a stage/task: a dashed-rule table attached at the owner's top edge listing the discretionary items (the one genuinely new renderer concept).
6. **Stages** — existing `cmmn.stage` frame machinery; `x_cmmn.discretionary` renders the dashed stage variant, `x_cmmn.collapsed`-style `+` markers come from the badge row.
7. **New profile `cmmn.complete@1`** (agent's call, recorded here): the CMMN 1.1 surface is one diagram family, so one profile supersedes `cmmn.basic@1` alongside it rather than a version bump that would retire nothing.

## Semantic normalization and identity effects

None — notation over existing element/relation identities.

## Alternatives considered

1. **`cmmn.basic@2`**: rejected — nothing in basic@1 is replaced; the new surface is a superset family, so a new named profile follows the registry convention (uml.statemachine@1 precedent).
2. **Task typing via `x_task` flags**: rejected — task types are distinct metaclasses with distinct icons (person/chevron/table); kinds keep endpoint rules enforceable.
3. **Sentry attachment as ports**: rejected — sentries are vertices with their own identity and outgoing criteria, attached to a host border (B1-063 boundary-event precedent).

## Compatibility and migration

Fully additive; `cmmn.basic@1` fixtures render byte-identically (new rendering paths are contract-driven).

## Machine schema and diagnostic changes

- Registry: +8 kinds, +2 relations, +1 profile; regenerated assets.
- Contracts: `x_cmmn`, `x_planning` (new); `x_sentry` extended (`attach`, `on_part`, `if_part`).
- New error codes (ceilings re-grepped: PJ180, PJW05): `DDN-PJ181` (x_cmmn owner/decorator rules), `DDN-PJ182` (sentry attachment/on-part), `DDN-PJ183` (planning-table rules), `DDN-PJ184` (case plan container rules).

## Non-goals (declared unsupported)

CMMN XML interchange, case engine/execution semantics, formal OMG certification.

## Fixtures

`notation/tests/cmmn-compliance.js`, sweep `notation/tests/cmmn-showcase.js`; gallery fixture `website/examples/basics/83-cmmn-complete.ddn`.

## Decision record

- Profile: **decided** — `cmmn.complete@1` (see Alternatives).
- Planning tables attach at the owner's top edge; discretionary items list is authored text (CMMN's plan-item typing is display text here).
