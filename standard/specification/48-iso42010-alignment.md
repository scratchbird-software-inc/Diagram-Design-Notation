# 48. ISO/IEC/IEEE 42010 alignment annex (informative)

Status: informative annex for runtime 0.7.0. This chapter is a *mapping*, not
a conformance claim: it records how the concepts of ISO/IEC/IEEE 42010
(architecture description) line up with shipped DDN machinery, so that teams
working under a 42010-based process know which DDN constructs play which
role. No new grammar, kinds or profiles are introduced; where a 42010
concept already has a faithful DDN home, the annex points at it.

## Concept mapping

| 42010 concept | DDN machinery | Where |
| --- | --- | --- |
| Architecture description | A DDN module — the data blocks (the model) plus the views that frame it. Across files, the `architecture` container declaration groups the bases of one described architecture (17.25). When the description itself must appear *inside* a diagram, «ArchitectureDescription» (`uaf.archdesc`) is the explicit node. | chapters 1–3; `uaf.summary@1` (47); 17.25 |
| Stakeholder | Core `role`, `team` and `organization` kinds for general diagrams; «Person», «Organization», «Post», «Responsibility» (`uaf.personnel@1`) for enterprise views. | registry core kinds; 47 |
| Concern | `issue` and `note` kinds with the annotation relations for free-form concerns; `req.requirement` for formalized ones; «EnterpriseGoal»/«EnterpriseVision» (`uaf.strategic@1`) for motivational concerns. | 47 |
| Viewpoint | «Viewpoint» (`uaf.viewpoint`) records the viewpoint as a first-class element — its name, framed concerns and stakeholders live on the node. | `uaf.summary@1` (47) |
| Viewpoint *governs* view | A DDN `view` block **is** the governed view: `projection { kind; profile }` fixes the model kind, `select:`/`exclude:` frame exactly the elements the viewpoint addresses, and `layout`/`display`/`publication` fix the presentation. One model, many governed views — declaration order and selection are deterministic. | chapters 1–3 |
| Model kind | A DDN *profile* is a model kind: `projection.profile` names the notation (vocabulary + rules) a view is expressed in. The profile catalogue in `standard/registry/profiles/catalogue.json` enumerates the installed model kinds. | 17, registry |
| Correspondence / correspondence rule | Registry endpoint contracts (DDN102) and the profile validators (DDN-PJ…) are the machine-checked correspondence rules; `ref` and `derives` relations record explicit correspondences between elements; projection machinery keeps occurrence-to-entity identity so one element can appear in several views without copying. | 11, registry |
| Architecture rationale | `decision` kind with the `decision` annotation relation (a decision attaches to what it decides), `evidence` relation for the supporting record, `issue` for the open question. | registry core kinds |
| Architecture framework | The standard itself: profiles organized by diagram family, the registry as the machine-readable vocabulary, this specification as the documentation of each model kind. | this document |

## Gap analysis — why no `arch.description@1` profile

The brief allowed a new `arch.description@1` framing profile *only* if this
annex surfaced a genuine gap. Row by row, it does not:

- Description, viewpoint and model-reference nodes already exist as
  «ArchitectureDescription», «Viewpoint» and «ModelReference» under
  `uaf.summary@1` (chapter 47), designed for exactly this framing role;
  reusing them keeps the vocabulary single-sourced.
- Stakeholders, concerns and rationale are covered by core kinds (`role`,
  `team`, `organization`, `issue`, `note`, `decision`) and the annotation
  relation family — no notation gap.
- Viewpoint-governs-view is a structural property of the DDN view mechanism
  itself (profile + selection), not something a profile could add.
- A new profile would duplicate existing registry entries without new
  validation value, which the additive-only discipline reserves for real
  notation gaps.

Recorded decision: **documentation only**. If a future item needs 42010
metadata that is *not* representable (for example machine-checked
concern-to-view coverage), the gap must be demonstrated against this table
first.

## Worked example

`website/examples/basics/89-uaf.ddn` shows the pattern end to end: one
module holds the architecture model across domains, the summary view places
«ArchitectureDescription», «Viewpoint» and «ModelReference» inside an
OV-1-style frame, and each domain view is a governed view — its profile is
the model kind, its `data:`/`select:` scope is the framing.

## Out of scope

Formal 42010 conformance certification, architecture-description interchange
formats, and architecture evaluation methods (trade-off analyses, scenario
evaluations) remain host-process concerns; DDN draws and validates the
descriptions.
