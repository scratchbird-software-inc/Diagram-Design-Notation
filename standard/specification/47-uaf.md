# 47. UAF architecture framework (twelve `uaf.<domain>@1` profiles on projection `graph`)

Status: implemented in runtime 0.7.0. Source grammar
remains DDN 0.5; UAF domains are vocabulary profiles over the existing graph,
matrix, table and timeline machinery — no grammar change.

The Unified Architecture Framework 1.2 organizes architecture description
into twelve domains crossed with viewpoints. DDN ships one graph profile per
domain (recorded grouping) — the domain column is UAF's own
organizing concept — and wires the tabular/serial viewpoints to the existing
projections.

## The domain × viewpoint grid

| Domain | Profile | Vocabulary (kinds) | Stereotyped verbs | Viewpoint presentations |
| --- | --- | --- | --- | --- |
| Strategic | `uaf.strategic@1` | «Capability» (tag silhouette), «EnterpriseGoal», «EnterpriseVision», «StrategicPhase» | «capabilityDependency», «supports», «mapsTo» | capability mapping: `matrix.relations@1` |
| Operational | `uaf.operational@1` | «OperationalPerformer», «OperationalNode», «OperationalActivity», «OperationalExchange» | «performs», «mapsTo», flows | activity flows: `uml.activity@2` |
| Services | `uaf.services@1` | «ServiceSpecification», «ServiceFunction», «ServicePolicy» | «exhibits», «compliesWith» | SoaML wiring: `soaml.services@1` |
| Systems | `uaf.systems@1` | «System», «SystemFunction», «Implementer» | «performs», «mapsTo» | SysML blocks: `sysml.bdd@2` |
| Personnel | `uaf.personnel@1` | «Person» (actor), «Organization», «Post», «Responsibility» | «assignedTo», «owns» | org charts: `org.tree@1` |
| Resources | `uaf.resources@1` | «ResourcePerformer», «Resource», «ResourceFunction», «Technology» | «performs», «forecast» | resource config: `sysml.ibd@2` |
| Security | `uaf.security@1` | «SecurityElement», «SecurityControl», «Threat», «Asset» | «mitigates», «mapsTo» | — |
| Projects | `uaf.projects@1` | «Project», «ProjectMilestone», «WorkPackage» | «milestoneDependency», «mapsTo» | roadmaps: `timeline.basic@1` |
| Standards | `uaf.standards@1` | «Standard», «StandardCollection», «Protocol» | «compliesWith», «forecast» | forecast tables: `table.records@1` |
| Actual Resources | `uaf.actualresources@1` | «ActualResource», «ActualOrganization», «ActualPerson» | «assignedTo», «owns» | — |
| Dictionary | `uaf.dictionary@1` | «DictionaryEntry» | «mapsTo» | dictionary table: `table.records@1` |
| Summary & Overview | `uaf.summary@1` | «ArchitectureDescription», «Viewpoint», «ModelReference» | «mapsTo» | OV-1-style pictograms: view frames + notes |

All kinds render keyword headers from the existing branch; exactly one new
silhouette ships: `tag` (chevron label) for «Capability», the only UAF symbol
without a near-match in the registry. OV-1-style high-level pictograms reuse
ordinary view frames and annotation notes (recorded decision — no new frame
machinery).

## Validation

Registry endpoint contracts police the domain vocabularies as DDN102
(capability dependencies between capabilities, exhibits from performers to
capabilities, mitigation from controls to threats, milestone dependencies
between milestones, etc.). UAF semantics beyond endpoint legality is
architecture analysis — declared out of scope.

## Example

See `website/examples/basics/89-uaf.ddn` — one view per domain with the
vocabulary and verbs, plus an OV-1-style framed summary. Tests:
`notation/tests/uaf-compliance.js` and the `uaf-showcase.js` grid sweep (12).

## Out of scope

UAF XMI interchange, architecture analysis/execution, and formal OMG
certification are unsupported (recorded in the profile catalogue and
`capabilities.json`).
