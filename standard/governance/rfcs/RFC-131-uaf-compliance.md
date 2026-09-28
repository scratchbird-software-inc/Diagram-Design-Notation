# RFC 0131 — UAF 1.2 notation compliance (twelve domain profiles)

Status: implemented  
Authors/reviewers: B1-073 work item  
Language/registry impact: additive registry entries within the 0.7 draft; twelve new profiles `uaf.<domain>@1`; no grammar change; runtime/specification 0.7 line.

## Problem and motivating example

The Unified Architecture Framework (UAF) 1.2 organizes architecture description into a grid of twelve domains (Strategic, Operational, Services, Systems, Personnel, Resources, Security, Projects, Standards, Actual Resources, Dictionary, Summary & Overview) crossed with viewpoints. DDN already ships the heavy machinery: SysML 1.6 profiles and behavioral rebadges, UML 2.5.1 composites, matrix/table/timeline projections, SoaML services, decorator frames. Missing: the UAF kind and stereotyped-relation vocabulary, the domain profiles, and the domain×viewpoint mapping documentation.

## Proposed syntax

No grammar change. Additive kinds/relations/profiles:

1. **Domains → profiles (recorded grouping decision)**: one `uaf.<domain>@1` graph profile per domain — `uaf.strategic@1`, `uaf.operational@1`, `uaf.services@1`, `uaf.systems@1`, `uaf.personnel@1`, `uaf.resources@1`, `uaf.security@1`, `uaf.projects@1`, `uaf.standards@1`, `uaf.actualresources@1`, `uaf.dictionary@1`, `uaf.summary@1`. Twelve profiles because UAF's own organizing concept is the domain column; each profile's validation list names the registry endpoint contracts that police its vocabulary. Tabular/serial viewpoints (capability mapping matrices, standards forecasts, project roadmaps, the dictionary) are viewpoint *presentations* on the existing matrix/table/timeline projections — they do not need separate profiles; the grid artifact (chapter 47 + the example file) maps every domain×viewpoint cell to its profile or projection.
2. **Kinds (~45)** across the domains, all with keyword headers from the existing branch and fallback silhouettes; exactly one new silhouette: `tag` (chevron label) for `uaf.capability`, the one UAF symbol with no near-match in the registry. OV-1-style pictogram views reuse existing frames + annotation notes (recorded decision — no new frame machinery).
3. **Stereotyped verbs (~12)**: `uaf.capabilitydependency`, `uaf.exhibits`, `uaf.mapsto`, `uaf.satisfiescapability`, `uaf.performs`, `uaf.assignedto`, `uaf.complieswith`, `uaf.mitigates`, `uaf.milestonedependency`, `uaf.forecast`, `uaf.supports`, `uaf.owns` — registry relationships with guillemet default labels and endpoint contracts (enforced as DDN102).
4. **Validation**: registry endpoint contracts throughout; no new PJ codes — UAF semantics beyond endpoint legality is architecture analysis (declared out of scope).

## Semantic normalization and identity effects

None — notation over existing element/relation identities.

## Error codes

None new. Endpoint contracts report as DDN102.

## Alternatives considered

1. **One uaf.grid@1 mega-profile**: rejected — a single profile could not give per-domain scopes/validation lists, and the showcase grid is clearer as one profile per domain.
2. **New projections for matrices/roadmaps**: rejected — matrix.relations@1/table.records@1/timeline.basic@1 already render those cells; UAF adds vocabulary, not geometry.
3. **OV-1 pictogram frame machinery**: rejected — the existing frame + note machinery draws high-level pictograms without new renderer concepts.
