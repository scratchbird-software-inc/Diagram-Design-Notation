# 23. Flat lifecycle profiles and restricted rule-based decision tables

**DDN 0.5.0-draft.1.** These are small executable semantic profiles, not SCXML, full UML statecharts, DMN/FEEL or a workflow service. They validate specified rules and traces without calling databases or executing action references. The diagram remains a view of the declared model.

## 23.1 Typed input domains and predicates

The two profiles share an input-domain definition. Each input has a unique safe `key`, a `type` (`enum`, `boolean`, `number`), and optional boolean `nullable`/`optional` flags. Enum inputs declare distinct scalar `values`. Number inputs declare finite `min` and `max`, inclusive. There are one to eight declared inputs for a decision table; a lifecycle may have none when transitions need no guards.

Missing and null are independent. An optional value can be omitted; a nullable value can explicitly be null. A numeric string is not a number. An undeclared input key fails evaluation rather than entering a hidden side channel.

```ddn
inputs: [
    {key: severity, type: enum, values: ["low", "high"]},
    {key: score, type: number, min: 0, max: 10}
];
```

A condition is a map from input name to one predicate. Predicates on different inputs are conjoined. An omitted input predicate is a wildcard over that input's declared domain. The predicate vocabulary is closed:

| Operator | Parameters | Meaning |
|---|---|---|
| `eq` | `value` | Exact scalar equality within the input domain. |
| `in` | `values` | Membership in an explicit set of allowed scalar values. |
| `interval` | `min`, `max`, optional `lower_closed`, `upper_closed` | Numeric interval within the declared domain; both ends closed by default. |
| `null` | none | Present null value. |
| `missing` | none | Absent value. |

Unknown properties/operators, invalid intervals, incompatible value types and invalid input names fail. No expression string is compiled as JavaScript. There are no arithmetic predicates, function calls, wildcards in bindings, regular expressions or network lookups in this subset.

## 23.2 Decision rule data

Rules are objects with `kind: "rule.row"` and an `x_rule` record:

```ddn
object low_pass "Low severity within tolerance" {
    kind: "rule.row";
    x_rule: {
        when: {
            severity: {op: eq, value: "low"},
            score: {op: interval, min: 0, max: 5, upper_closed: false}
        },
        then: {route: "release", audit: false}
    };
}
```

A decision projection names its ordered rule records, domains, outputs and policy:

```ddn
projection {
    kind: decision; profile: "decision.rules@1";
    records: [@m.rules.high, @m.rules.low_pass, @m.rules.low_review];
    inputs: [{key: severity, type: enum, values:["low","high"]},
             {key: score, type:number, min:0, max:10}];
    outputs: [route, audit];
    hit_policy: unique;
    coverage: complete;
    analysis_budget: 4096;
}
```

Every rule must supply every declared output as a scalar; one to twenty outputs are supported. This version does not impose a separate common output-type declaration, calculate output expressions, or provide DMN result coercion. The rule's stable ID, rather than its row number, identifies it. Explicit record order controls `first`; changing layout order must not silently change rule priority.

`unique` permits at most one matching rule. `first` chooses the first match. `collect` returns all matching outcomes in declared order without implicit sum/min/max aggregation. A no-match evaluation returns `status: no_match` only when the declared coverage policy permits it.

## 23.3 Coverage and conflict analysis

`coverage` is `complete`, `report` or `none`. Complete requires every declared input combination to match. Report returns witnesses of uncovered combinations. None does not require completeness; the analyzer can still report the inspected gaps. Unique-policy overlap rejection remains active regardless of coverage mode.

The analyzer partitions number domains at every interval boundary and equality/set value. It tests boundary singleton atoms and one interior representative where a representable interior exists. Enum and boolean domains are finite. Optional/missing and nullable atoms are added explicitly. Predicates are constant within those declared partitions; this is why a bounded partition analysis can establish more than random sampling would.

It enumerates the product of input atoms within `analysis_budget` (one to 50,000; default 4,096). Results expose the number of partitions and tests, policy, uncovered witnesses, overlaps, first-hit shadowed rows and unreachable rules. Witness collections retain at most twenty examples each; their lengths are not the total number of all uncovered inputs.

For unique or complete claims, exhausting the budget **fails closed** with `DDN-QD008`. First/collect report mode can render with `status: budget_exceeded`; disjointness/coverage are explicitly not established. Invalid zero budgets do not fall back to a default. This is bounded proof over the specified predicate language and finite-number semantics, not unrestricted theorem proving or certification of a real business policy.

```javascript
const result = workspace.evaluateDecision("views.ddn", "decision_unique", {
    severity: "low", score: 5
});
// {policy, matched:[ruleIDs], selected:[ruleIDs], outputs:[records], status}
```

The live laboratory offers a JSON input field and an Evaluate button. Selecting a matching row is a transient UI highlight, not a hidden modification of the model. Source edits invalidate an old evaluation. Evaluation JSON can be downloaded separately. SVG export remains the declared diagram, not an implied evidence record that a production transaction was approved.

## 23.4 Flat lifecycle model

`state.flat@1` is a graph profile. Its selected nodes are `state.initial`, `state.state`, and `state.final`. A `state.state` can explicitly declare `x_state: {terminal:true}`. A state represents one lifecycle condition of the modeled object—not an activity performed by a process.

Transitions use `state.transition` and `x_transition`:

```ddn
relation accepted "Accepted verification" @correcting -> @verified {
    kind: "state.transition";
    x_transition: {
        event: "verify",
        guard: {passed:{op:eq,value:true}}
    };
}
```

The profile requires exactly one initial marker and at least one terminal outcome. The initial marker has no incoming and exactly one outgoing transition; that initial step is unconditional and action-free. Terminal states have no outgoing transitions. All states must be structurally reachable from the initial marker and have a structural path to a terminal outcome. These checks do not claim guards make every such path feasible under all environments.

Every noninitial transition names a nonempty event. Optional guards use the typed domains above. For a given source state and event, guards must be disjoint; a bounded domain analysis validates them. Incomplete event handling is permitted and means that event is not accepted for some inputs. Without guard domains, multiple transitions for one source/event are rejected as ambiguous.

Transitions may name `actions` as references to scoped definitions. They remain documentation references; the trace checker records their IDs and performs no side effects. Nested regions/fields, parallel states, history states, entry/exit actions, timers and hierarchical transitions are not implemented by this flat profile. Full SCXML explicitly covers broader state behavior [Q5]; this profile must not be advertised as an SCXML implementation.

## 23.5 Trace verification

A trace contains at most 1,000 ordered records `{event, data?}`. Data defaults to an empty record and must satisfy the declared input domains; use optional inputs for events that omit them. The initial marker's automatic step chooses the initial active state. Each event must match exactly one outgoing transition whose guard holds.

```javascript
const result = workspace.simulateLifecycle("views.ddn", "lifecycle", [
    {event:"submit"}, {event:"accept"}, {event:"investigated"},
    {event:"verify", data:{passed:false}},
    {event:"investigated"}, {event:"verify",data:{passed:true}},
    {event:"close"}
], "meridian.quality.review::lifecycle.closed");
```

The result reports final state, terminal status, each transition's IDs and recorded action references, and `actionsExecuted:false`. An unavailable event, ambiguous branch, malformed input or expected-final-state mismatch fails. Optional projection `traces` permit up to 100 named fixtures validated before rendering. Event sequence is semantic data; line positions and numeric legend keys do not define it.

The lifecycle renderer uses conventional initial/final circular markers and state cards. Event/guard labels are derived from transition metadata. Outlines and annotations can be styled, but source endpoints and conditions do not change. Marker/actor contour escapes reach the outside of conservative node bounds without passing through another object; the existing short-route regression remains mandatory.

## 23.6 Scope, editor, and acceptance

Studio's full source editor can change inputs, predicates, rules, guards and traces. Generic property editing is available, but there is not yet a specialized graphical condition-builder for every predicate. The live laboratory exposes bounded evaluator and trace input controls. Changes validate the selected view; other views revalidate when rendered.

`DDN-QD001..008` and `DDN-QL001..007` cover typed domains/predicates, policies/budgets, overlap and uncovered witnesses, input checking, state structure, ambiguity, trace shape, unavailable events and final-state mismatches. There is no hidden rule bypass in style/layout controls. In the synthetic example, low severity at score 4.999 releases, low severity at 5 inspects, and high severity quarantines; this is a fixture, not a universal disposition policy.

Acceptance covers threshold ties, holes, conflicting rules, first-hit shadowing, collect output, null/missing differences, unsafe operators, budget exhaustion, unreachable states, forbidden terminal transitions, rework loops, wrong expected endpoints and zero executed actions. Source-bound identity must survive redraw, upload, download and undo.

[Q5] W3C SCXML, https://www.w3.org/TR/scxml/ (checked 2026-09-08). Reference is used to explain the scope boundary, not to claim SCXML conformance.
