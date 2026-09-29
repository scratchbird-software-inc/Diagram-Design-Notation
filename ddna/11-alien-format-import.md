# Chapter 11 — Alien-format import policy

**Status:** full draft, 2026-09-29. Binding owner decisions of 2026-09-29
(DDNA-NOTES.md: alien-format policy; import/export split by product), with
the corpus' design constraints on converters. "Alien" means any format
that is not DDN or DDNA.

## 11.1 The policy (binding)

1. **DDN and DDNA are the ONLY formats our tools display, render, or
   execute.** Alien formats — BPMN XML/DI, XMI/UMLDI, DMN XML, CMMN XML,
   SysML XMI, PNML, FEEL/OCL/ALF text, MSC/Z.120 PR forms, vendor
   stencils — may be **imported**: read and converted into DDN/DDNA. They
   are never displayed or used natively.
2. **Alien expression languages follow the same rule.** Import/convert
   into DDNA's own expression form where possible; where a construct
   cannot be converted it is carried as an **opaque host reference**
   (KEEL), never parsed or evaluated in alien dialect by our tools.
3. **Product tiers.** The **open designer does simple import, no export** —
   "simple" is a deliberate product-tier limit, not a technical ceiling;
   exact scope is set per format at converter-spec time. The **commercial
   tier does full import and full export.**
4. **Export from the *standard* side remains out of scope** unless
   separately decided — but the commercial tier does full export, so the
   specification does not preclude export mappings.
5. **Re-reading the standing exclusions.** The inventory entries classed
   STANDING under "interchange policy" (61 in the exclusion sweep) are
   re-read as "no NATIVE support" — import converters are a separate,
   permitted feature class.

## 11.2 Where importers live (ratified D9)

Conversion libraries live in a **shared converter core** (open or
dual-licensed). The open designer's simple import and the commercial full
import share that one core; product tiers gate **scope/depth, never
code** — there are no per-product converter forks, so conversion fidelity
is identical across tiers.

## 11.3 Design constraints on converters (corpus-derived)

1. **Preserve rule order losslessly** — DMN's F/R hit policies make
   serialization order normative (§8.2.10), so a DMN importer must keep
   row order exactly (dmn.md §7).
2. **Preserve vertical event order exactly** — MSC geometry IS semantics
   (Z.120 §4.1); any importer or reorder tooling for MSC must keep event
   order to the pixel (msc.md §7).
3. **Attach semantics to the post-transformation abstract model**, not
   surface shorthand — SDL's shorthand transformations (Z.103) mean
   trace references resolve against the unparameterized, transformed
   model (Annex F2); importers must normalize first, bind second
   (sdl.md §6).
4. **Map onto each standard's own extension mechanism** where applicable —
   BPMN §8.3.3 extensionElements, CMMN §5.1.5, XMI stereotypes — and keep
   the semantic/layout split: BPMN20/BPMNDI and DMM/UAFML are the
   format-design lesson repeated by six family analyses.
5. **Resolve classifier context** — XMI ownedBehavior imports need their
   owning classifier (`self`/attributes) bound (statemachines.md §7);
   stereotype and instance-specification mappings (SysML units as
   InstanceSpecifications, sysml.md §7; UAF type↔instance tier,
   uaf.md §7) must be resolved, not carried as strings.

## 11.4 Per-format import notes

| Format | Tier-1 (simple) scope sketch | Notes |
| --- | --- | --- |
| BPMN XML/DI | processes, tasks, gateways, sequence flows, pools/lanes | choreography/conversation depth is commercial; DI coordinates are re-laid-out, never trusted (DDN owns layout) |
| DMN XML | DRDs + decision tables with the seven hit policies | rule order normative (§11.3.1); FEEL bodies convert or carry opaque per §11.1.2 |
| CMMN XML | case plans, tasks, stages, sentries, milestones | decorator flags map to DDN's x_cmmn contract |
| XMI/UMLDI | class/activity/state-machine/sequence diagrams, single metamodel pin | ownedBehavior context binding required (§11.3.5) |
| SCXML | full machine import | state-machine family has the deterministic Appendix-D profile (chapter 3) — the cleanest alien import in the set |
| SysML XMI | bdd/ibd/requirements | units as InstanceSpecifications (§11.3.5) |
| SoaML/UAF XMI | service structure / domain grids | stereotype mapping per profile tables |
| Z.120 textual / PR | MSC event lists | event order is semantics (§11.3.2) |
| CIF (SDL) | blocks/channels/process bodies | post-transformation binding (§11.3.3); CIF grammar not yet acquired (chapter 12 §4) |

"Simple" rows are the *sketch* of the tier scope; each converter's exact
scope statement ships with the converter core (§11.2).

## 11.5 License holds (the only standing restrictions)

- **ArchiMate** — the commercial license for the evaluation text is under
  legal review; no import or feature work until it clears.
- **IEC 60617** — the full symbol database is licensed material; only the
  common-practice subset (already shipped at the notation layer as
  agent-drawn renderings pending document review) is in scope.
- Everything else in the table is royalty-free for implementation per the
  corpus' license readings (OMG/W3C grants; ITU by convention — flagged
  for governance), with the standing cite-don't-reproduce rule
  (chapter 10 §10.8).

## 11.6 What this policy is not

- Not an interchange claim: DDNA does not certify round-trips; fidelity
  statements are per converter, in the converter core.
- Not a display path: imported content is DDN/DDNA the moment it is read;
  nothing alien ever reaches a renderer or an engine.
- Not an export authorization: §11.1.4.
