# Chapter 15 — Delegated evaluation host contracts

**Status: contract and boundary validator, 2026-10-09. No EM-5 engine is installed.**
EM-5 means execution-model class 5 in chapter 2: evaluation delegated to a tool.
It is a classification, not a product, database engine or installed dependency.
This chapter separates constraint solving from graph querying. The contracts
are DDNA-defined proposals for future host implementations. They make no new
SysML/UAF conformance claim and do not independently verify upstream clauses.

`contracts/em5.mjs` implements pure request, capability and response validation.
It is not loaded by the live tool, does not evaluate constraints, traverse
models, dispatch hosts or change source, and does not enable EM-5 Run controls.
`notation/tests/ddna-em5-contract.mjs` is durable boundary acceptance evidence,
not solver qualification. Unknown EM-5 profiles still produce DDN-A006 there.
The boundary validator reports DDN-A010 for invalid records or incompatibility.

## Two separate operations

| Proposed profile | Input | Meaning of success |
| --- | --- | --- |
| `ddna.em5.constraint-host@1` | Typed variables, initial values, equality bindings and language-tagged constraints | A checked satisfying assignment, or checked evidence that none exists under the declared model |
| `ddna.em5.graph-query@1` | Explicit node/edge snapshot and reachability request | Complete reachable identity set under the declared direction and edge-kind filter |

A dependency DAG computes values in a declared direction; it is not a
noncausal solver. Constraint variables can be unknown and an actual solver must
choose and record its strategy. Conversely, graph reachability requires no
constraint language. UAF dates, projections, OCL measures, unit conversion,
continuous simulation and other graph operations are not covered by this first
contract. SQL and procedure bodies in DDN/DDNN remain inert text. Neither
contract grants database, network, filesystem or external service access.

## Shared request and capabilities

Request fields are exactly `format`, `profile`, `requestId`, `snapshot`,
`budget`, `model`, `operation`. Format is `ddna-em5-request@1`. Snapshot contains
`revision` and `digest` (`sha256:` plus 64 lowercase hex digits). A future host
must compute the digest over canonical UTF-8 JSON of `{profile,model,operation}`:
record keys sorted by Unicode code-point order, arrays in their declared order,
finite JSON numbers, negative zero serialized as zero, no whitespace. Revision
is the caller's workspace revision. The validator checks shape and response
agreement, not the digest calculation or revision freshness against a workspace.

Budgets contain positive integer `steps`, `results`, `deadlineMs`. Reference
ceilings are 100,000 steps, 4,096 results and 30,000 ms. Each envelope is limited
to 2 MiB UTF-8 JSON and depth 32. No functions, accessors, cycles, sparse lists,
symbols, nonfinite values or reserved prototype keys are accepted. All named
identities in model data must use `module::path` form. Workspace existence and
occurrence-to-definition resolution belong to the future adapter.

A capability record contains versioned `engine:{id,version}`, lists `profiles`,
`languages`, `numeric`, `units`, and `cancellation:"worker-termination"`.
Negotiation requires an exact supported profile and, for constraints, every
required language, numeric regime and unit identity. There is no fallback to
KEEL L0, JavaScript, SQL, a default unit or a similarly named profile. The
validator does not install a host or assert that its capability declaration is
truthful; host qualification must establish that separately.

## Graph reachability contract

Model fields are `nodes` (at most 4,096 unique qualified identities) and `edges`
(at most 16,384 records `{id,from,to,kind}`). Edge IDs are unique, endpoints must
exist and kinds are explicit strings. Operation fields are:

- `kind:"reachability"`;
- nonempty unique `seeds` naming existing nodes;
- `direction:"outgoing"|"incoming"|"both"`;
- nonempty unique `edgeKinds`, matched exactly;
- boolean `includeSeeds`.

The result is the least reachable set using only the listed edge kinds in the
declared direction. Cycles and parallel edges do not duplicate nodes. When
includeSeeds is false, remove every seed even if a cycle reaches it. Unknown
edge kinds match nothing. Completed node results are sorted in ASCII/code-unit
order; model and seed enumeration must not change the result. A future engine
must use sorted seeds and edge IDs for reproducible traversal evidence. One
step means one inspected adjacency edge, whether admitted by the filter or not.
Hitting a step/result limit before establishing closure is unknown, never a
completed empty or partial answer. No implicit traversal outside the snapshot.

The boundary validator checks result identities/order/count but does not prove
reachability. A future reference evaluator must independently recompute it.

## Constraint host contract

Model fields are `variables`, `constraints`, `bindings`. At most 256 variables
and 512 constraints are accepted, both nonempty; at most 16,384 bindings.
Variables contain unique qualified `id`, `type:"real"|"integer"|"boolean"`,
`unit` (identity string or null) and optional typed initial `value`. Integer
values must be safe integers, reals finite binary64, booleans unitless. Null
is not an assignment value. Absence of value means unknown; zero/false are known.

Constraints contain unique qualified `id`, explicit `language`, nonempty
`body` (up to 4,096 UTF-8 bytes), and unique `variables` naming declared variables.
Only a qualified expression host can verify free-variable coverage and evaluate
the body. A binding is `{left,right}` over variables with identical type and
unit identity. Binding means exact equality; no inferred conversion, coercion,
nested property decomposition or object-instance equality is implemented.

Operation is `{kind:"solve",numeric:"binary64",tolerance:<finite nonnegative>}`.
Tolerance is absolute in each equation's declared canonical units; the selected
language/profile must define its residual test before negotiation can result in
execution. Tolerance never relaxes initial values or binding equality. A host
that cannot establish dimensional correctness or its residual semantics must
reject negotiation. Iteration exhaustion or failure to converge establishes
unknown, not unsatisfied. Engine-defined steps and choices must be documented
and stamped before that engine is accepted.

## Responses, cancellation and replay

Responses contain `format:"ddna-em5-response@1"`, matching profile/requestId/
snapshot, versioned `engine`, `status`, boolean `complete`, `used:{steps}`, and
`result`. Optional fields are `reason`, `evidence`. The adapter must additionally
check the response engine against the negotiated engine; a versioned stamp alone
is insufficient. Outcomes are operation-specific:

| Outcome | Complete | Result/evidence |
| --- | --- | --- |
| Graph `completed` | true | `{nodes:[...]}`, complete closure within result budget |
| Constraint `satisfied` | true | `{assignments:[{variable,value},...]}`, every variable exactly once, plus `evidence:{kind:"checked-assignment",reference}` |
| Constraint `unsatisfied` | true | null result, plus `evidence:{kind:"certificate",reference}` |
| `unknown`, `cancelled`, `failed` | false | null result, nonempty reason, no conclusive evidence |

The validator checks structural evidence references, types, unchanged initial
values and binding equality. It does not check the constraint predicates or
certificates. No caller may turn validator success into a claim of mathematical
correctness. A qualified checker must validate all constraints/units and inspect
certificate contents before promoting a solver response to a trusted result.
Evidence references are inert identifiers; validation never fetches them.

A future adapter must run hosts in a terminable worker, own the monotonic
wall-clock deadline, and cancel on request or workspace revision change. Once
cancelled, failed, timed out or completed, later messages for that request must
be ignored. Timeout becomes unknown with a budget reason; user cancellation
becomes cancelled. Partial assignments/sets may be retained as explicitly
non-authoritative diagnostic artifacts, not as completed results.

Solver replay is faithful to recorded assignments/choices and engine stamps.
A complete result is not automatically a verified trace. Graph verified replay
requires the exact snapshot, derivation profile and successful recomputation.
No trace adapter ships in this milestone; envelope-to-trace mapping, worker
termination, late-message rejection and evidence checking remain acceptance
requirements for an actual implementation.

## Implementation order and completion gates

1. Implement bounded graph reachability on explicit snapshots; independently
   test chains, diamonds, cycles, parallel/reversed edges, filters, seeds and
   permutation invariance. Qualify cancellation, budgets, replay and active-tool
   display before enabling its exact profile.
2. Define one concrete constraint-language/residual profile and qualify a real
   solver/checker with satisfiable, unsatisfiable and underdetermined fixtures;
   preserve unknown/cancelled/failed distinctions. No broad SysML solver claim.
3. Add family-specific type/unit/property adapters only with dedicated evidence.
   UAF temporal projections and measures remain separately versioned work.
4. EM-6 structural/protocol interpretations remain a separate T07 work item.
