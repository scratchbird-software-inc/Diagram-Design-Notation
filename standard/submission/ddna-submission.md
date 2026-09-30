# DDNA — DDN with Automation · standards-body submission draft

**Status: DRAFT proposal (2026 draft).** No standard number has been
assigned; a standards body assigns numbers. Nothing here claims adoption,
acceptance, or prior submission. This document was generated from the
project's sources by `tools/build-submission.mjs`; every count is
traceable to `standard/submission/facts.json`. Wording of all
external-standards claims is copied from the ratified DDNA chapters —
"mirrors" / "based on" / "an implementation of", never "conformant to".

## 1. Scope and purpose

DDNA (DDN with Automation) is an **open file-format standard that expands
DDN — it never replaces it**. DDN remains complete and self-sufficient
without DDNA. The DDN file is the identity basis: every identity
referenced in a DDNA file is defined in a DDN file; DDNA files never
define base identities, and one DDNA file may serve multiple DDN files.
Declaration direction is explicit in both directions: DDN files declare
their associated DDNA files; DDNA files declare the DDN identity bases
they require. When a DDNA file serves multiple DDN files, **no identity
collision across bases** is allowed — loading a DDNA file with colliding
base identities is a validation error, which makes bare `@id`
references unambiguous. Alien formats are **import-only**: DDN and DDNA
are the only formats tools display, render, or execute.

Both standards are open; the tools are closed. The open-source viewer and
designer implement DDN only; DDNA tool support is commercial and closed
source. Closure lives at the tool/product level, never in the
specification.

## 2. Architecture and file model

The association machinery is the one DDN's specification defines for
cross-file addressing (DDN spec §17.25): **architecture containers**
group the files of one described architecture with collision-safe
identity; **module-qualified references** address elements across files;
**`x_link` association metadata** is the lightweight cross-file
association — ignorable to DDN-only tools, degrading to a note (never an
error) when a referenced file is absent. Feature definitions live in
their own **feature-id space** (many identities → one feature), and
identity, versioning (DDN source version + DDNA standard version), and
graceful-degradation rules are all in-file declarations.

## 3. Execution-model classes

Every analyzed family maps to exactly one of **six execution-model
classes** (chapter 2 of the DDNA spec): EM-1 token runtime (BPMN, UML
activity, UML state machines, with SDL's special position of a formal
abstract machine), EM-2 declarative DAG evaluation (DMN), EM-3
lifecycle-FSM runtime (CMMN), EM-4 trace-set observational semantics
(UML interactions, MSC/HMSC), EM-5 spec-delegated evaluation (SysML
parametrics, UAF), EM-6 conformance-specification (SoaML). All
operational classes reduce to a single recorded interleaving —
normatively sanctioned by the underlying standards — which is why one
trace format and one concurrency model serve every class.

## 4. Trace format, KEEL interface, runtime models

- **Trace format (the keystone):** per-event records with a monotonic
  envelope and per-step `stepKind`, universal instance identity, choice
  records for **eight normative nondeterminism classes** (N1–N8),
  copy-on-event state snapshots, **semantic-profile + version stamping**,
  referential integrity to real element ids, KEEL evaluation records with
  engine id and version, and optional three-valued validation verdicts.
  Two replay modes: **verified replay** (recompute under a declared
  deterministic profile) and **faithful replay** (recorded choices,
  verbatim — "record, never re-derive").
- **KEEL reference interface:** the Z.120 §5.3 nine-function host-function
  seam adopted verbatim as the spine (parse, typecheck, name-equality,
  conformance, free-vars, substitute, fresh, partial eval), with
  capability tiers **T0–T8**, two numeric towers (FEEL decimal128 vs
  XPath IEEE double — the language tag selects), four null/error regimes,
  and family-dependent guard purity (SDL stateful guards legal; order
  recorded). DDNA **never implements the dialects** — it references them;
  evaluation belongs to host engines.
- **Runtime models (ratified):** TIME-A+B (event-stepped virtual clock
  with a dense constraint layer), DATA-A or C (B rejected), CONC-A +
  CONC-B-data (one global interleaving, partial-order data for trace
  validation), and a declared semantic-profile option set.

## 5. Conformance claims vocabulary

The master rule: claim **"mirrors X" / "based on X" / "an implementation
of X"**, never **"conformant to X"**, unless a conformance tier
explicitly covers the claim. Exactly two near-conformance paths exist:
"mirrors fUML 1.5 Clause 8" inside the fUML subset, and "mirrors W3C
SCXML Appendix D microstep/macrostep" as the state-machine default with
the UML-strict option. Partial-interpretation inheritance is global:
whatever a tool interprets must match the normative clause for what it
touches. DDNA-defined semantics are labeled as such wherever they
substitute for standard semantics.

## 6. Per-family coverage

**12** normative family chapters are drafted:
six class chapters (UML state machines, UML activities, BPMN, SDL, DMN,
CMMN) in the first batch, and six more (UML interactions, MSC/HMSC,
SysML parametrics, SoaML, UAF, and a combined no-standard chapter for
ER/Chen, DFD, EPC, C4, mind maps and the presentation families). Each
follows one structure: scope and pinned sources; the behavior DDNA
adopts; feature support (core / optional / excluded with reason);
expression behavior (tier, tower, regime, purity); trace and replay
requirements; runtime-model bindings; claims wording; open items.

## 7. Open items (stated honestly as future work)

- **Tier-3 gated families await documents or licenses** — ArchiMate 4
  (commercial evaluation license under legal review) and the IEC 60617
  full database are license holds; IEC 61131-3, ISO 15909, ISO/IEC
  19507, ISO 5807, ISA-5.1 await texts; their exclusions stand until
  acquisition.
- **UNVERIFIED-PDF carry-overs** — UML 2.5.1 subsection numbering, PSSM
  1.0, Z.120 Annex B process algebra, Z.103–Z.107, DMN 1.4 clause-10
  fine print — cited with drafting notes only, never normatively, until
  acquired.
- **Feature finalization** — catalog core/optional tags and the DATA
  A-vs-C selection settle as the DDNA file format itself is drafted.

---
*Generated draft. Numbers: standard/submission/facts.json. Regenerate:
`node tools/build-submission.mjs`; drift-check: `--check`.*
