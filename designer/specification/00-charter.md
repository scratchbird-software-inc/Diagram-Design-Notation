# Product charter, scope and terminology

**DDN Designer specification 0.2.0-beta.1 — proposed; baseline audited 0.6.0-beta.1.**

## Decision
Create **DDN Designer**, a separate visual-first application at `designer/index.html` and optional package `ddn-designer`. Preserve the existing Studio at `live/editor.html`. Both use the same public DDN library and canonical source workspace. This document is a proposed implementation specification, not a declaration that the production visual editor has shipped.

The deliverable accompanies the audited 0.6.0-beta.1 endpoint-ordering patch. Its runtime SHA-256 is recorded in `audit/library-audit.json`. This package changes no existing Studio or renderer files. The interactive review prototype demonstrates a subset and labels the rest as design screens.

## Outcome
A user can start from a blank canvas or template, insert a meaningful object, add/edit fields without choosing datatypes, connect objects or fields, refine the model, create additional views, and save real DDN source. Another user can open those files in Studio, change them, and return to Designer without data or comment loss. A third-party webpage can display the result with only the DDN runtime, not the editor.

## Non-negotiable requirements
- **VE-001:** Studio and its URLs, source editing behavior, and public renderer remain available.
- **VE-002:** Source files are authoritative. SVG and framework node arrays are projections, not a parallel semantic database.
- **VE-003:** Every visible object, field, relation, cell, and derived mark has a stable source mapping or an explicitly declared presentation-only role.
- **VE-004:** Kind, profile, maturity, evidence, placement and style are distinct. Hand-drawn does not mean draft. A repeated appearance is not a replica.
- **VE-005:** A semantic edit displays its shared scope; a presentation edit defaults to this view. No silent edits of shared format bundles.
- **VE-006:** Drag-drop, click-place and keyboard insertion are equivalent pathways. Connector creation must also work without dragging.
- **VE-007:** Incomplete designs are editable and saveable. Reviewed/published output is separately validated. No safety or publication guard is globally weakened to enable a gesture.
- **VE-008:** Unknown data and unsupported extensions survive opening and saving without lossy normalization.

## Terms
**Definition**: a model object, field, relation, rule, record, or domain. **Occurrence**: one visual appearance of a definition in a named view. **Instance**: a distinct modeled/deployed instance; not a synonym for occurrence. **Recipe**: a profile-approved rendering form. **Template**: reusable creation defaults that instantiate a semantic kind. **Property adapter**: typed translation between a UI control and source commands. **Draft**: unfinished model state, not a different colour theme. **Current view validation** and **workspace review** are separate scopes.

## Scope of full visual authoring
The end-state editor must author the complete supported DDN 0.5 vocabulary and all nine projections, using graph gestures where appropriate and structured sheets for matrix/chart/time/rule data. It is not required to turn calculated bars into draggable rectangles. The project is not a new ERP, a diagram-standard certification, a database administration client, or a collaborative server. Real-time multiuser editing and arbitrary third-party plugins are later capabilities with separate specifications.

## Release interpretation
The initial implementation milestones build toward full visual editing. No milestone may use the label “full editor” merely because generic nodes can be dragged. Specialized rule, series, panel and interaction editing, safe kind conversion, draft support, accessibility, import/export and regression evidence are acceptance gates.
