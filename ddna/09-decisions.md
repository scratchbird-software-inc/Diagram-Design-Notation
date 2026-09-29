# Chapter 9 — Decisions register

**Status:** stub. D1–D13 are **ratified** (owner, 2026-09-29: "use the
recommendations"); this chapter will carry the full decision records.

## Ratified decisions (summary)

- **D1** — DDNA does not specify ML/inference capabilities (out of scope).
- **D2** — Interactive view state OUT of DDNA v1 (renderer/host concern);
  revisit after trace replay ships.
- **D3** — ER/Chen semantics via a one-pager: [DD] declarative-constraint
  semantics + KEEL T1/T2.
- **D4** — FEEL capability wording: bounded decision-table/rule evaluation
  supported in-repo; the full FEEL surface via the KEEL reference
  interface; externally-defined functions opaque; engineering solvers
  behind the solver contract. *(Applied to the DDN registry in repo item
  B1-089.)*
- **D5** — Host-declared vocabularies ARE in scope: registry
  data-properties + the T8 open type environment.
- **D6** — "SysML 2.0 deferred to a future profile family" is a named
  standing exclusion. *(Applied to the DDN registry in repo item B1-089.)*
- **D7** — Deployment semantics out of scope (structural; note in spec).
- **D8** — "DDNA analysis overlays": declarative analysis over declared
  data = [DT] features producing stored [VS] results, with DDNA-defined
  semantics and host-pluggable algorithm references.
- **D9** — Importers live in a SHARED (open or dual-licensed) converter
  core; product tiers gate scope/depth, not code.
- **D10** — DDN-side association = ignorable `x_`-style extension property;
  DDN-only tools pass it through untouched. *(Realized as DDN's `x_link`
  and the architecture container, repo item B1-090.)*
- **D11** — `state.flat@1` predicate evaluation GRANDFATHERED as a bounded,
  side-effect-free evaluator equivalent to KEEL T2; no migration.
- **D12** — Runtime design space: TIME-A+B; DATA-A or C (B rejected);
  CONC-A + CONC-B-data; the semantic-profile option set.
- **D13** — The Z.120 §5.3 host-function seam is ADOPTED verbatim as the
  KEEL interface spine (chapter 5 §5.1).

## Open at this draft

None. New decisions are appended here as D14+ as the per-family chapters
surface them.
