# Chapter 14 — Bounded declarative evaluation

**Status:** implemented reference-tool profile, 2026-10-09. This is a
DDNA-defined EM-2 dependency-graph interpretation, not DMN or FEEL conformance.
It runs only in the tool layer. The DDN rendering SDK remains independent of
execution. Procedure source in DDN/DDNN remains text; this profile neither
connects to databases nor executes stored procedures, SQL or external services.

## Profile and declarations

The exact profile name is `ddna.em2.dag-l0@1`. Generic EM-2 profile names remain
unavailable (DDN-A006). A companion carries `x_profile` with:

| Property | Meaning |
| --- | --- |
| `name` | `ddna.em2.dag-l0@1` |
| `replay` | `verified` or `faithful` |
| `inputs` | Unique variable names; the supplied JSON record must contain exactly these keys |
| `nodes` | Nonempty list of evaluation nodes |

Each node has only `id`, `target`, `expr` and optional `depends_on`. Node IDs
are unique variables, distinct from input names. `depends_on` lists unique
node IDs; missing dependencies and cycles are errors. Identifiers use ASCII
letters/underscore followed by letters/digits/underscore; language keywords
and `__proto__`, `prototype`, `constructor` are reserved.

`target` identifies an object in a served DDN base, using its block-relative
path (for example `totals.net`) or full `module::block.element` identity.
Resolution must yield exactly one object. Events always record the qualified
identity, so two modules with identical local names cannot receive each
other's replay overlays. Multiple visible appearances of that identity still
receive the same event.

`expr` references a unique companion `x_keel.id`. Its `language` must be
exactly `keel-l0@1`; its `body` is parsed by the existing KEEL L0 host. All free
variables must be declared inputs or direct dependencies. Evaluation receives
all initial inputs and only the node's declared direct dependency results.
Each node evaluates once. Nodes are grouped into topological layers and IDs
are sorted in ASCII order within each layer. Source-list order is irrelevant.

KEEL L0 uses finite JavaScript binary64 numbers, not FEEL decimal128 semantics.
It does not interpret JavaScript, SQL or FEEL source. Host version 1.0.1 fixes
subtraction tokenization (`gross-2`) while retaining unary negative literals.
Recorded host stamps distinguish it from version 1.0.0 during verification.

## Values, budgets and failure

Inputs and results are finite acyclic JSON data. Undefined, functions,
nonfinite numbers, accessors, symbol keys, reserved record keys, sparse lists
and non-plain objects are rejected; negative zero is normalized to zero.
Snapshots are independent copies, so later caller mutations cannot change a
recorded event. There are no callbacks, network requests or external effects.

| Limit | Reference-tool value |
| --- | ---: |
| Nodes | 128 |
| Declared inputs | 128 |
| Expression UTF-8 bytes | 4,096 |
| Expression AST nodes | 512 |
| AST / JSON nesting depth | 32 |
| Initial input record, per-node environment, or individual result JSON bytes | 65,536 |
| Recorded event JSON bytes plus initial-input JSON bytes | 2,097,152 |

The last limit counts each full serialized event, including sequence and scope;
it is not a limit on the entire downloaded document including metadata.
Existing tool step and instance limits also apply. Evaluation is synchronous
and bounded; this profile supplies no background solver or scheduling service.

Malformed declarations, dependency errors, ambiguous targets and invalid values
produce DDN-A009. Unsupported expression languages produce DDN-A005; unsupported
profiles produce DDN-A006. Budget violations produce DDN-A004. Invalid runs do
not publish a downloadable trace document. A step/instance or recorded-data
budget stop retains the successfully recorded prefix with `complete:false`;
that prefix may be replayed but cannot pass complete verified recomputation.

## Recording and replay

The trace retains the existing sidecar envelope and adds
`execution:{engine:"ddna-em2-dag-l0",engineVersion:"1.0.0",inputs:{...}}`.
Its `time_model` is `{kind:"data",id:"T5",clock:"evaluation-index"}`: ordinal
evaluation order, not physical time. Each `decision-evaluation` event records
the target, node ID, result, display value, expression ID/language/body, copied
environment, KEEL host ID/version and clock. All nodes belong to the single
logical instance `evaluation-1`.

Verified replay validates the trace envelope, complete flag, matching profile,
companion association, execution stamp and time model, then reruns the current
companion using the **recorded initial inputs**. It compares every event field,
including expression text, environments, results, state, scope and host stamps.
Record key order is ignored; list and event order are significant. Any mismatch
or unsuccessful recomputation produces DDN-A007. Verification establishes
consistency with the loaded declarations and recorded inputs; it is not a
signature or proof of provenance. Faithful replay displays recorded events
without claiming successful recomputation.

Generated traces are held in tool memory until downloaded. Replacing the source
workspace clears generated traces. Loaded sidecar files remain available in the
tool's separate trace-file store. Neither generation nor replay edits notation
source. The sidecar downloads as `<companion stem>.ddnatrace.json`.

## Reviewable example

Load both `standard/examples/declarative-order.ddn` and
`standard/examples/declarative-order.ddna` into the tool. Open Animation and
enter `{"price":7,"quantity":4}` in the execution input field. Run generates
two events: gross total 28, discounted total 25.2. Step through the events to
see the corresponding element values. Download preserves both the inputs and
results. To associate a saved sidecar, add an `x_trace:{file:"saved.ddnatrace.json";}`
carrier to the companion and load that sidecar with the workspace (or inject it
through `DDNTool.addTraceFile`).

## Remaining work (DDN-T07)

The initial milestone supplies DAG evaluation; the table extension below adds
three explicit hit policies and conflict/null/error rules. Full EM-2 still
needs broader expression-host capability mapping before any DMN conformance claim.
EM-5 needs a declared host contract, bounded solver/query outcomes, units/types
and convergence/failure behavior; UAF queries and SysML constraints must not be
presented as one interchangeable solver. EM-6 needs explicit structural checks
and a documented DDNA protocol interpretation with bounded interaction traces;
SoaML does not by itself supply an operational service runtime. EM-5 and EM-6
remain unavailable. Existing EM-1/3/4 paths are PoC-derived implementations,
not evidence of complete family conformance.

## Decision-table profile: `ddna.em2.tables-l0@1`

**Implemented 2026-10-09.** This second profile shares the graph, input,
identity, expression and replay contracts above. Its execution engine stamp is
`ddna-em2-tables-l0`, version `1.0.0`. The original `dag-l0@1` contract and
engine stamp remain unchanged and reject table declarations. This extension
is DDNA-defined; it does not establish DMN/FEEL conformance.

A node carries exactly one of `expr` or `table`. Expression nodes and table
nodes can depend on one another through the existing `depends_on` list.
A table contains only `hit_policy` and `rows`. Each row contains only a unique
variable-style `id`, a `when` expression reference and a `then` expression
reference. Both references name companion `x_keel` expressions using exactly
`keel-l0@1`. Rows have authored order; no priority or sort order is inferred.

```ddn
{ id: "discount"; target: "totals.discount";
  table: { hit_policy: first; rows: [
    { id: "large"; when: "large_order"; then: "ten_percent"; },
    { id: "ordinary"; when: "always"; then: "zero"; }
  ]; };
}
```

All row predicates evaluate against the same node environment. Each must
produce the boolean `true` or `false`; null, undefined and other values are
errors, without truthiness coercion. All predicates evaluate, including rows
after the first match. A predicate can express conjunctions using KEEL L0;
this profile does not add DMN input-entry syntax or FEEL unary tests.

| Policy | Matching behavior | No matches |
| --- | --- | --- |
| `unique` | Exactly one match returns that row's output; multiple matches fail, even if outputs would be equal | `null` |
| `first` | Return the output of the first matching row in authored order | `null` |
| `collect` | Return a list of all matching outputs in authored order; retain duplicates | `[]` |

Only selected output expressions evaluate. Every expression, including
unselected outputs, is parsed and checked for allowed variables/language before
the graph runs. Selected outputs must satisfy the finite JSON contract; null
is a valid output. Recorded row selection distinguishes a null output from no
match. Row outputs are not variables available to other rows. A downstream
node receives the table's complete result through its dependency name.

A table contains 1–128 rows; a graph contains at most 512 rows across all table
nodes. Exceeding those limits is DDN-A004. Existing limits remain in force,
including the 64 KiB combined result and 2 MiB recorded-data cap. Invalid row
shape, unknown policies, nonboolean predicates, overlapping unique matches or
invalid selected results produce DDN-A009, with no downloadable successful
trace. There are no implicit defaults, aggregates, priority policies, external
calls or hidden conversion of display-table rows into executable rules.

One event records the whole table evaluation. Its `keel.table` contains
`hit_policy`, ordered `rows`, `matched` row IDs and `selected` row IDs. Each
recorded row includes its predicate/output expression IDs, language and body,
predicate match result, and output result if selected. The surrounding `keel`
record retains the copied environment, final result, clock and host stamps.
All declarations are recorded even when their output was not evaluated, so a
change to an unselected output or row order cannot silently pass verification.
Recording is atomic per node: the byte cap never publishes half a table event.

Load `standard/examples/decision-discount.ddn` and its DDNA companion. Inputs
`{"price":50,"quantity":3}` produce gross 150 and net 135; inputs
`{"price":7,"quantity":4}` produce gross and net 28. The first-match policy
chooses the discounted row for the first case and the standard row for the
second. The existing Animation controls generate, display and download the
trace. Rules are authored as companion declarations; a visual rule editor is
not part of this milestone.

The decision-table milestone completes these three bounded policies. Remaining
EM-2 work includes broader family expression contracts, additional policies and
any justified DMN conformance claims. EM-5 solver/query and EM-6 protocol host
contracts remain outstanding; the next T07 priority is their contract analysis.

## Client-side rule authoring

The designer Animation drawer offers **Create decision rules for selected
element** and **Edit decision rules**. Creation adds a bounded L0 companion and
its architecture association atomically, seeded with a constant expression for
the selected target. The editor covers declared inputs, decisions and their
model targets/dependencies, L0 expression bodies, table rows and hit policies.
Saving compiles the proposed profile before applying source changes. Invalid
expressions, unresolved targets and dependency errors preserve the current
workspace. The editor refuses stale drafts after an intervening source change.
All editing and bounded evaluation run in the browser; no hosted service or
database execution is supplied.
