# DDN 0.3 — Process, requirements and verification

## Balanced interface contracts

A process object may expose ports with `direction:in|out` and a payload reference to a message/record. `x_boundary.ports` lists the outer ports. Each `bindings` entry maps one external port of that process to a port owned by a different internal activity. Every listed outer port must be bound exactly once; directions and payload identities must match. Missing/duplicate/reversed/mismatched bindings fail DDN131–133.

This validates the declared interface mapping, not every possible event trace. It does not infer a boundary by drawing an enclosing box or certify formal DFD-method conformance.

## State and guard contract

`x_workflow` requires states, initial, terminal and transitions. Each transition has a stable id, from/to, event, optional guard and optional positive `max_visits`. All states must be reachable structurally. Terminal states cannot have outgoing transitions. Every cycle must cross a bounded transition. Alternatives with the same state/event must use distinct equality values on the same field; arbitrary guard disjointness is not guessed.

Guards use boolean values, `all`, `any`, `not`, or `{field,op,value}`. Operators are eq, ne, lt, lte, gt, gte, in and exists. Missing inputs cause an error except for exists. No JavaScript/SQL expression execution is allowed. `runTrace` evaluates only supplied fixtures and enforces bounds; it cannot prove operational availability or database atomicity.

## Data invariants

`x_constraint` lists unique field tuples, a half-open non-overlap rule with partition/from/to fields, and an optional immutable pre-state guard. The fixture helpers check supplied rows and before/after values. Null unique members are exempt in that fixture convention; alternative database semantics must be a separate profile. Temporal fixtures use parsed numeric/time instants and explicit open ends. They are not engine migrations or transaction implementations.

## Requirements and evidence

`x_requirement` identifies owner, acceptance, state and evidence references. States are proposed, required, accepted, rejected or waived. Accepted/waived declarations require evidence records. `x_evidence` requires method, scope, observation time, subject hash and result; a pass requires an artifact digest. A readiness result reports declared passing evidence, not that the compiler verified the professional identity, timestamp or signature. Production reviewers must bind approval to exact model/spec/code versions.

The enterprise assurance file preserves all original findings with owners and acceptance gates. Statutory policies, distributed drills, production UI/report completion, specialized algorithms, custody and independent approvals remain blocked. This is a more accurate model than deleting those findings after diagram software improves.
