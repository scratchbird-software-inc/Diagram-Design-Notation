# Family chapter — DMN 1.4 (EM-2, declarative rules)

**Status:** full draft, 2026-09-29. Class assignment per chapter 2 §2.3.
Analysis source: dmn.md; expression inventory expr-feel-xpath.md. Claims
pinned to DMN 1.4 (the 1.5 drift item is chapter 12 §5).

## 1. Family scope & normative sources

DMN 1.4 clause 7 (DRG semantics — evaluation order derived from the
requirement graph), clause 8 (decision tables: match semantics §8.1,
side-effect-freedom §8.2.7, hit policies §8.2.10), clause 9 (S-FEEL),
clause 10 (FEEL: ~50 normative semantics tables, built-in library),
§10.4 (decision-service execution), §2.1–2.2 (conformance levels with
partial-interpretation inheritance). Exact clause-10 fine print is
pending full-document acquisition (chapter 12 §4); wording is stable
since 1.0 per the analysis (drafting note where flagged UNVERIFIED-PDF).

## 2. Execution semantics DDNA adopts

DMN has **no token or state-machine semantics** — and DDNA adopts exactly
that finding: "execution" here is **evaluation of a dependency DAG of
expressions**, never flow.

- **Declarative requirement level**: the DRG defines requirements, not an
  execution order; evaluation order is *derived* — a decision is
  evaluated in an environment containing the values of its required
  inputs/decisions and invoked BKMs (clause 7.1).
- **Decision-table evaluation** (normative): a rule matches if every
  input expression satisfies the corresponding input entry (§8.1);
  overlapping matches resolve by hit policy (§8.2.10). The side-effect
  rule — "evaluation of the input expressions … does not produce
  side-effects that influence the evaluation of other input expressions"
  (§8.2.7) — makes every DDNA replay step deterministic.
- **Induced step definition** (the standard never operationalizes it;
  DDNA mirrors it): one step = evaluation of one boxed expression /
  one decision node, topologically consistent with the requirement graph;
  within a table — evaluate input expressions → match rules → apply hit
  policy → produce output; BKM/decision-service invocation is a nested
  evaluation frame (parameter binding per §7.3.6–7.3.7, Table 63
  invocation semantics; §10.4 decision services: encapsulated decisions
  are not visible to the caller).
- **Partial-interpretation inheritance** (§2.1, §2.2.2): any
  interpretation an implementation provides SHALL be consistent with
  clause 10 for what it touches — the normative hook for the hard KEEL
  boundary, stated globally in chapter 10 §10.2.

DDNA never executes FEEL; it references it (§4 below).

## 3. Feature support

- **Core:** F-DMN-1 live decision evaluation hook (host engine, incl.
  full-FEEL tables) [DT]; F-DMN-2 hit-policy completion (all 7 DMN
  policies; priority lists and Collect operators as declared data) [DT];
  recorded-trace replay (F-X1) [VS]; **verified replay** (chapter 4
  §4.3) — this family and `state.flat@1` are its two homes.
- **Optional:** F-DMN-3 decision-service invocation harness (§10.4
  partitions declared) [DT]; F-DMN-4 BPMN↔DMN call-site linkage
  (cross-family trace stitching) [DT; display VS once recorded].
- **Excluded:** full FEEL conformance as a claim unless the host engine
  actually implements all of clause 10; embedded interpretation of any
  FEEL construct (§2.1 inheritance); the DDN notation layer's existing
  stance stands — output-priority ordering and aggregation "are
  evaluation, not notation", `x_boxed` is presentation text, both correct
  boundaries today.

## 4. Expression behavior

KEEL tiers: **T2 pure evaluation core** — the FEEL inventory (chapter 6
§6.1): typed value lattice (Any/Null); **decimal128 tower** (34 digits,
round-half-even, no NaN/±Inf/−0 — DMN §10.3.2.3.1; the language tag
selects the tower, chapter 5 §5.3); ternary logic with null mandatory on
domain violation (§10.3.2.16 — the FEEL error regime); XML-Schema
date/time arithmetic with offset-comparability rules; first-class ranges
+ unary tests (three `in` resolutions); immutable lists (null on
out-of-range); partially-ordered contexts (acyclic, dependency-ordered
evaluation); multi-domain quantification (vacuous-truth rules);
lexically-closed functions with positional/named invocation; three
lossless implicit coercions (to/from singleton list; date→date-time at
UTC midnight; failed adaptation degrades to null, never raises);
versioned host-injectable built-in library; `now()`/`today()` as
**injected values** — DMN has no clock, so "now" is an input parameter
(N5), not a scheduler output. **T1**: ItemDefinition type declarations as
data. **T6-adjacent**: externally-defined (Java/PMML) functions are
opaque references; no evaluation semantics can be guaranteed and trace
steps through them are flagged. Guard purity: pure except that hole
(chapter 5 §5.4). Bounded in-repo evaluation exists under the ratified
D4 wording (bounded decision-table/rule evaluation IS supported; the
full surface via the KEEL reference engine).

## 5. Trace & replay requirements

Nondeterminism classes: **N5** only, essentially — injected "now"/random
values and external input data; the evaluation itself is deterministic
(§8.2.7 side-effect-freedom makes steps commute). Stamping:
semantic-profile + version (hit-policy set in force, FEEL engine id and
version per evaluation record, chapter 4 §4.2.7). Replay mode:
**verified replay** — recompute under the declared profile and check the
trace; faithful replay for traces that pass through externally-defined
functions (flagged steps).

## 6. Runtime-model bindings

TIME: **T5** — time exists only as data (FEEL date/time types and
built-ins); the virtual clock is not needed by this family beyond
timestamping evaluations. DATA: **DATA-A or C** — declarative value
graphs (D6 shape): per-decision computed values keyed by decision id and
evaluation frame; mutation events are the per-node intermediate values
(the replay). CONC: **CONC-A** trivially — C5 order-independence: the
trace must not over-specify evaluation order beyond the dependency DAG.

## 7. Conformance claim wording

**"Partial interpretation consistent with DMN clause 10 for what it
touches"** — the §2.1-sanctioned claim, inherited by every partial
engine. **Never:** full FEEL conformance unless the host engine
implements all of clause 10.

## 8. Open items

- DMN 1.4 full-document acquisition for clause-10 fine print
  (chapter 12 §4).
- 1.4→1.5 version-drift reconciliation (chapter 12 §5).
- `in` resolutions and timezone comparability edge cases marked
  [ddna-defined] risk in the expression inventory (chapter 6 §6.3).
