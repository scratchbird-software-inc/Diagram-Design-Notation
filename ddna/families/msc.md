# Family chapter — MSC / HMSC (ITU-T Z.120) (EM-4, trace/partial-order)

**Status:** full draft, 2026-09-29. Class assignment per chapter 2 §2.3.
Analysis source: msc.md.

## 1. Family scope & normative sources

ITU-T Z.120 (02/2011): §4 core MSC (partial ordering on events), §5 data
concepts (the §5.3 host-function seam — the KEEL spine of chapter 5),
§6 quantified time, §7 coregions, inline expressions, MSC references,
HMSC. Z.120's own Summary concedes "an informal semantics description is
provided". **Annex B (1998, process-algebra formal semantics) is the
named formal companion — not acquired; UNVERIFIED-PDF**, cited only as a
drafting note. Z.121 (SDL data binding) is the default language binding.

## 2. Execution semantics DDNA adopts

MSC normatively defines **admissible event orders and traces, not a
machine that runs**. DDNA mirrors:

- **Partial ordering** (§4.1): send (`out`) and consumption (`in`) are
  asynchronous events; each instance axis is totally ordered unless a
  coregion or inline expression intervenes; events of different
  instances order only via messages (send before consume) or generalized
  ordering — "no other ordering is prescribed. A Message Sequence Chart
  therefore imposes a partial ordering on the set of events."
- **Traces = sequentializations** (§4.1): one total ordering compatible
  with the partial order; Annex B provides the process-algebra reading
  (drafting note). A DDNA replay that materializes a chosen
  sequentialization is spec-faithful by the standard's own definition.
- **Instance lifecycle** (§4.10–4.11): `create` — no events before
  creation, at most one per instance; `stop` — self only, no events
  after.
- **Control flow** (§4.4): synchronous calls create suspension regions
  ("no events occur until the reply returns"); activation-level symbols
  constrain where in/out events may sit but imply no dynamics.
- **Conditions** (§4.7): **setting** conditions define actual state;
  **guarding** conditions restrict continuation — true by Boolean
  data-language evaluation or by non-empty intersection between the
  guard's condition-name set and the last setting condition on the same
  instance set; `otherwise` is true iff all other operands' guards are
  false.
- **Inline operators** (§7.2): seq = weak sequencing (false-guarded
  operand is dynamically illegal); alt = one operand, common-preamble
  "delayed choice"; par = interleaving preserving operand order; loop
  `loop<n,m>`; opt; exc (once the exception operand starts, the
  remaining operands are abandoned).
- **HMSC** (§7.5): operational reading — single start, multiple outgoing
  flow lines = alt choice, edges are weak sequencing; **if all branches
  are blocked by false guards and no HMSC end is reached, the whole HMSC
  has no legal traces**.

## 3. Feature support

- **Core:** F-MSC-1 partial-order / interleaving inspector (stored
  connectivity graph, §4.1 Fig 6) [VS] — family-distinctive; F-MSC-2
  trace generator / stepping engine (single-instance-event granularity,
  per-event states) [DT]; F-MSC-3 HMSC navigator/executor (§7.5;
  "no legal traces" detection) [DT] — family-distinctive two-level
  graph-over-traces; F-MSC-4 timer/time-constraint checker over the
  virtual clock [DT]; recorded-trace replay (F-X1) [VS].
- **Optional:** coordination with SDL trace export (F-SDL-4 — MSC is the
  rendering, not a second execution format).
- **Excluded:** "MSC execution conformance" — no such thing exists to
  claim (§7 below); native Z.120 PR-form execution (import-only,
  chapter 11); process-algebra composition operators until Annex B is
  acquired (drafting note).

## 4. Expression behavior

KEEL tiers: **T1** the full static-analysis suite (the §5.3 functions
Wf1–Wf4, Tc1–Tc4, EqVar, Vars — all named in the standard);
**T2** `Eval` against per-event per-instance stores (the "event's
state", §5.6 — bindings inherited via message parameters and creation);
**T6** wildcards as independent don't-cares (substitution, freshness,
instantiation into recorded traces, §5.7); **T4** guarding-condition
re-evaluation; condition-name guards as trace-history lookup (DDNA
data); loop-bound expressions; **timer durations and time constraints**
evaluated "once the new state of the event … has been evaluated"
(§6.2); actual parameters of MSC references with the `Tc4` conformance
check. Guard purity: per language binding; Z.121/SDL allows stateful
evaluation (order recorded, chapter 5 §5.4).

## 5. Trace & replay requirements

Nondeterminism classes: **N4** (coregion interleavings, par), **N1**
(alt/delayed choice), **N7** (wildcard instantiation values;
lost/found pairing, §5.8), **N2** (no ordering within the environment is
assumed), **N8** (timer orderings at equal instants). Stamping:
semantic-profile + version incl. the time-domain parameter (§6.4 — dense
or discrete). Replay mode: **faithful replay** of one recorded
sequentialization; the untimed reading is legitimized by the standard
itself ("comments/annotations only", §6.1) and declared in the profile.

## 6. Runtime-model bindings

TIME: **TIME-A+B** — §6.1's global clock with time-passage events and
the must-progress rule maps onto the virtual clock; §6.4's dense/discrete
domain is exactly TIME-B's parameter; measurements and unidirectional
constraints are interval checks over recorded timestamps. DATA:
**DATA-A or C** — per-instance states with binding inheritance (D4
shape). CONC: **CONC-A + CONC-B-data** — partial-order data for the
inspector (F-MSC-1) and validation; the runtime is one recorded
sequentialization (A).

## 7. Conformance claim wording

**"An implementation of Z.120 (02/2011) trace semantics"** — Z.120
defines no conformance clause and no tool classes, so there is nothing
stronger to claim; subsetting (e.g. untimed only) is sanctioned by §6.1.
**Never:** "MSC execution conformance".

## 8. Open items

- Annex B acquisition before any process-algebra claim (chapter 12 §4).
- Geometry is semantics: importers and reorder tooling must preserve
  event order exactly (chapter 11 §11.3.2).
