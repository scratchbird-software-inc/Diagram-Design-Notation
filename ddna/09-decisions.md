# Chapter 9 — Decisions register (D1–D13, ratified)

**Status:** full draft, 2026-09-29. All thirteen decisions were ratified by
the owner on 2026-09-29 ("use the recommendations", DDNA-NOTES.md). Each
record states the question, the decision, the rationale, and the
consequences for the specification. New decisions append as D14+.

## D1 — ML/inference policy line

**Question:** sentiment/causal/SWOT/label inference entries in the
exclusion inventory had no policy home. **Decision:** DDNA does not
specify ML/inference capabilities; advisory and inference behaviors are
out of scope. **Rationale:** no analyzed standard supplies normative
inference semantics, and the scope statement needs one sentence, not a
program. **Consequences:** no feature may be tagged [DD] "ML"; inference
integrations, if ever desired, are host concerns entirely.

## D2 — Interactivity in/out

**Question:** ~12 inventory entries (drag, drill-down, brushing,
responsive widgets, nested dashboards, animation) hinged on whether
DDNA's runtime model includes interactive view state. **Decision:**
interactive view state is OUT of DDNA v1 (renderer/host concern); revisit
after trace replay ships. **Rationale:** the runtime-models analysis
scoped only execution TIME/DATA/REPLAY/CONCURRENCY; adding view state
would double the v1 surface for no normative gain. **Consequences:**
chapter 7 has no interactivity model; the existing DDN animation/refresh
machinery stays presentational and separate (chapter 7 §7.1).

## D3 — ER/Chen home

**Question:** seven entries (weak entities, n-ary associations,
multivalued/derived attributes, identifying relationships, ORM constraint
verification, schema-mapping rules) were uncovered by any analysis.
**Decision:** a small no-standard one-pager assigning them [DD]
declarative-constraint semantics + KEEL T1/T2. **Rationale:** with no
governing standard, the only honest claim is DDNA-defined; the constraint
surface maps cleanly onto the T1/T2 tiers. **Consequences:** chapter 12
§2 lists the one-pager; ER/Chen features tag core once it lands.

## D4 — FEEL capability wording

**Question:** the DDN registry's exclusion entry "arbitrary/DMN-FEEL rule
execution" contradicted the corpus' established capability boundary.
**Decision:** bounded decision-table/rule evaluation IS supported in-repo;
the full DMN-FEEL surface is available only through a host-supplied FEEL
reference engine identified in the file; externally-defined functions are
opaque; engineering solvers stay behind the solver contract.
**Rationale:** DMN §2.1's partial-interpretation inheritance makes the
tier statement the only consistent position. **Consequences:** applied to
the DDN registry (repo item B1-089); the wording is the template for
capability-tier statements elsewhere (chapter 10).

## D5 — Declarative vocabulary extensibility

**Question:** whether DDNA has host-declared enumerated vocabularies
(middleware deployment models, artifact content descriptors, protocol
vocabularies). **Decision:** yes — registry data-properties plus the T8
open type environment. **Rationale:** T8 already specifies external
type-environment import by notation tag; vocabulary declarations are the
same mechanism at the data level. **Consequences:** a one-paragraph note
in the family chapters that need it; no new machinery.

## D6 — SysML 2.0 naming

**Decision:** "SysML 2.0 deferred to a future profile family" is a named
standing exclusion. **Rationale:** nine bare registry strings needed one
honest name. **Consequences:** applied to the DDN registry (B1-089); DDNA
makes no SysML 2.0 commitments.

## D7 — Deployment semantics

**Decision:** out of scope (structural; note in spec). **Rationale:** UML
ch.19 deployment has no execution semantics to honor. **Consequences:**
deployment models carry placement data only (e.g. the C4 deployment
one-pager); no runtime claims.

## D8 — Analysis-algorithm ownership

**Question:** eight entries (CPM, scheduling, calendars, resource
leveling, cut-sets, reachability) had no owner: the runtime model is never
a scheduler, and the expression inventories evaluate, not analyze.
**Decision:** "DDNA analysis overlays" — declarative-analysis algorithms
over declared model data ARE DDNA [DT] features producing stored [VS]
results, defined as DDNA-defined semantics with host-pluggable algorithm
references. **Rationale:** separates the algorithm (pluggable, host) from
the data and the stored result (spec). **Consequences:** chapter 8's [VS]
analysis-overlay features cite this decision; algorithm identity is part
of result metadata.

## D9 — Where importers live

**Decision:** conversion libraries live in a SHARED (open or
dual-licensed) converter core; product tiers gate scope/depth, not code.
**Rationale:** the open designer's simple import and the commercial full
import must share one converter core or they drift. **Consequences:**
chapter 11's tier rules reference the shared core; no per-product
converter forks.

## D10 — DDN-side association mechanism

**Decision:** the DDN-side association is an ignorable `x_`-style
extension property; DDN-only tools pass it through untouched.
**Rationale:** matches DDN's existing `x_*` exemption discipline; old
parsers break on nothing. **Consequences:** realized in the DDN spec as
`x_link` and the architecture container (repo item B1-090, DDN spec
§17.25); chapter 1 §1.4 specifies the association machinery in those
terms.

## D11 — Grandfathering of `state.flat@1` evaluation

**Decision:** the one embedded evaluation in the open DDN runtime (the
flat-lifecycle predicate evaluator) is grandfathered as a bounded,
side-effect-free evaluator equivalent to KEEL T2; no migration.
**Rationale:** it is documented-safe with actions disabled, and migrating
it behind KEEL would be a breaking change for zero capability gain.
**Consequences:** the KEEL tier table treats it as the reference example
of a T2 core; DDNA files must not read it as precedent for embedded
evaluation anywhere else.

## D12 — Runtime design space

**Decision:** TIME-A+B (event-stepped virtual clock with a dense
constraint layer and ISO-8601 values); DATA-A or C (B rejected);
CONC-A + CONC-B-data; the semantic-profile option set. **Rationale:**
chapter 7's evidence sections; the one remaining specification-authoring
choice (DATA A-vs-C final selection) is deferred to the per-family
chapters. **Consequences:** chapter 7 is the normative text of this
decision.

## D13 — KEEL interface spine

**Decision:** the Z.120 §5.3 host-function seam is adopted verbatim as the
KEEL interface baseline. **Rationale:** it is the only normative typed
host-function interface in the corpus, and three other standards
independently define the same seam (chapter 5 §5.1). **Consequences:**
chapter 5 is the normative text; every KEEL capability is expressed
against the nine functions.
