# Family chapter — SoaML 1.0.1 (EM-6, conformance/contract)

**Status:** full draft, 2026-09-29. Class assignment per chapter 2 §2.3.
Analysis source: soaml.md.

## 1. Family scope & normative sources

SoaML 1.0.1 §6.4 (service contracts, ServiceChannel §6.4.15 compatibility
rules, CollaborationUse §6.4.16 role binding, milestones §6.4.9,
§6.4.17.1); §2 (compliance tiers: design tools owe concrete+abstract
syntax, **runtime tools owe only XMI** — no runtime-behavior conformance);
UML 2.1.2 Superstructure as the normative behavioral base (predating
fUML/PSSM — discovered: SoaML names no executable-semantics companion).

## 2. Execution semantics DDNA adopts

SoaML defines **no execution/token semantics of its own** — it is a UML
profile + metamodel extension whose behavioral semantics are inherited.
What it *does* define normatively is a **conformance/compatibility
structure**, and DDNA mirrors exactly that:

- **ServiceChannel compatibility** (§6.4.15, Constraints [1]–[3] plus
  the Semantics 4-point rule): one end «Request», the other «Service»,
  and *compatible* where compatible means any of (1) same type,
  (2) Service type specializes/realizes Request type, (3) mutually
  covering operations — "the Service must provide an Operation for every
  Operation used through the Request, the Request must provide an
  Operation for every Operation used through the Service" — or (4) any of
  the above for a port-defined subset. The contract Behavior must be
  compatible with connected protocols.
- **Contract-role binding** (§6.4.16): with `isStrict=true` (the
  default), parts must be compatible with bound roles via the 4-point
  rule (same type / specializes / realizes / contains at least the
  role's ownedAttributes+ownedOperations).
- **Milestones** (§6.4.9): progress instrumentation — signals with
  values, removable without semantic change.
- **isID correlation** (§6.4.8): correlation keys are *structural* —
  not expression evaluation.
- The deep finding: behavioral compatibility between Requests and
  Services is a **declared semantic variation point ×4** (§6.4.15,
  §6.4.10, §6.4.6, §6.4.17.1). The standard *requires* conformance but
  *refuses to define the algorithm* — any DDNA conformance check is a
  documented DDNA-defined interpretation, never "SoaML conformance".

### 2.1 The variation-point inventory (normative map for interpretations)

The four declared semantic variation points are the exact places where
DDNA interpretations live, and every interpretation is registered with an
id (chapter 10 §10.3's labeling rule):

1. **Behavioral compatibility between Requests and Services** (§6.4.15)
   — the ServiceChannel rule requires compatibility but not the algorithm
   for behavioral (protocol-level) matching.
2. **Behavioral compatibility for ComponentRealization** (§6.4.10).
3. **Compliance between role types in a collaboration use** (§6.4.6) —
   the 4-point rule is static, but role *behavior* matching is open.
4. **OwnedBehavior conformance evaluation** (§6.4.17.1) — "how the
   ownedBehaviors of a ServiceInterface are evaluated for conformance
   with behaviors of consuming and providing Participants", and when
   ownedRules are evaluated.

The declarative-family fallback follows from the template: SoaML's
evaluation model is *conformance checking*, not runtime evaluation —
static structural compatibility (ports, interfaces, role binding) plus
behavioral conformance of participant behaviors against choreographies
and protocols. There is no token model to replay; what replays is the
*recorded enactment* over a bound choreography view, and what checks is
the compatibility machinery above.

## 3. Feature support

- **Core:** F-SOA-1 recorded service-enactment replay over bound
  choreography views [VS]; F-SOA-2 milestone-instrumented recorder +
  progress overlay [DT/VS]; F-SOA-3 full §6.4.15 ServiceChannel
  compatibility checker (4 modes + isStrict) [DT/VS results]; F-SOA-4
  choreography conformance validator (documented DDNA interpretation per
  §6.4.17.1; interpretation id recorded) [DT]; recorded-trace replay
  (F-X1) [VS].
- **Optional:** F-SOA-5 correlated multi-instance conversation
  simulation (isID keys) [DT].
- **Excluded:** "SoaML conformance" for behavioral checking (§7);
  running or invoking services; native SoaML XMI execution
  (import-only, chapter 11).

## 4. Expression behavior

KEEL tiers: **T7** milestone value snapshots + progress channel
(removable instrumentation, §6.4.9); **T2** OCL-capability constraints
(pre/post conditions, ownedRules) — evaluation *timing* is a variation
point, so traces record when a rule was evaluated. Numeric tower and
error regime: per language tag (OCL regime where OCL is the tag). Guard
purity: pure. The static compatibility checks (§2 above) are structural
— operation-name coverage, generalization/realization evidence — and do
not need KEEL at all (the DDN profile already validates the same-type
and declared-mode forms at the notation layer).

## 5. Trace & replay requirements

Nondeterminism classes: **N5** (message exchanges, injected stimuli);
**N2/N4** (interleavings across participants in a choreography replay);
interpretation choices recorded with their **interpretation id**
(wherever a DDNA-defined reading of a variation point applies — chapter
10's labeling rule). Stamping: semantic-profile + version incl. the
interpretation id set. Replay mode: **faithful replay** of recorded
enactments over bound choreography views (UML sequence or state machine
— those families' chapters own the view semantics).

## 6. Runtime-model bindings

TIME: **T1** — SoaML is timeless; timestamps are trace envelope data
only. DATA: **DATA-A or C** — participant/conversation instances keyed
by isID correlation keys (structural, chapter 4 §4.2.2). CONC:
**CONC-A** — a choreography replay is one recorded interleaving;
protocol conformance checks run over the stored trace, not a scheduler.

## 7. Conformance claim wording

**"A DDNA-defined interpretation of SoaML behavioral conformance
(documented per §6.4.17.1)"** — the spec requires conformance but
refuses to define the algorithm; the interpretation id is recorded with
every check. **Never:** "SoaML conformance" for behavioral checking —
runtime tools owe only XMI (§2).

## 8. Open items

- The interpretation-id vocabulary for variation-point readings (one
  registry entry per documented interpretation; to be pinned when F-SOA-4
  lands).
- Milestone-expression validation ([DD] register, chapter 8 §8.11).
