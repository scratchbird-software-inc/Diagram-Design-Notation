# DDN standard utility specifications

**Public ddn-next-1 edition.** These adopted contracts accompany the implemented standalone utilities. Earlier planning/baseline descriptions below preserve design provenance; they are not the current implementation status. Use [the maintained documentation](../../docs/README.md) and [qualification limits](../../docs/DDN/IMPLEMENTATION.md). Historical 0.8 source and evidence are not runtime dependencies.


The standard browser utilities are a **viewer**, a **visual designer** and a **verifier**. They share one language/model contract and reusable computation services. The viewer remains read-only; the designer adds editing to that viewer; the verifier checks the selected rules independently of rendering. Each ships as an embeddable JavaScript module and a downloadable offline browser application.

Use an incremental model and scene pipeline, initially rendered with SVG plus HTML controls. Existing layout, routing, glyph and profile algorithms remain useful inputs. Replace whole-workspace invalidation, global mutable registries and whole-diagram DOM replacement with explicit runtime instances, dependency tracking and stable occurrence identities. Optional workers keep expensive work away from input handling; they do not by themselves make an algorithm faster.

The specifications target the [ddn-next-1 language/property contract](../codex/README.md). They specify software to implement that contract; they do not change the dialect or imply that the redesigned software exists.

| Specification | Purpose |
|---|---|
| [Architecture](01-architecture.md) | Module ownership, model/source transactions, worker execution, scene pipeline and commercial integration |
| [Viewer](02-viewer.md) | Read-only multi-view workarea display, navigation, live data, accessibility and publication |
| [Visual designer](03-visual-designer.md) | Native progressive design, editing, conversion, undo, status and source preservation |
| [Verifier](04-verifier.md) | Independent staged verification, profile dispatch, completeness, revisions and diagnostics |
| [Packaging and extension contracts](05-packaging.md) | Native ES modules, offline HTML, resource IO, profile packs and failure behavior |
| [Performance and acceptance](06-performance-and-acceptance.md) | Measurable size/responsiveness targets, workloads and implementation gates |
| [Existing system and design choices](07-existing-system.md) | Source evidence, measured existing-runtime behavior and alternatives considered |
| [Implementation sequence](08-implementation-sequence.md) | Deliverable order, utility coverage and integration gates |
| [Core API](contracts/core.d.ts) / [browser API](contracts/browser.d.ts) / [scene ABI](contracts/scene.d.ts) | Proposed typed public interfaces; declarations only |
| [Module manifest](contracts/modules.json) / [profile routing](contracts/profile-routing.json) | Dependencies and every existing profile's rule/render/editor pack route |
| [Requirements and acceptance cases](contracts/requirements.json) | Stable requirement IDs, owners, acceptance scenarios and implementation traceability |

These specifications use MUST for required behavior and SHOULD for a recommendation with a documented reason to deviate. Numeric performance/size budgets are proposed release targets, not measurements of the new design. Existing runtime evidence is kept separate in `evidence/`.

The default installation is small because it loads the native features actually needed. Every one of the 151 retained profiles has an explicit pack route; an optional **complete offline edition** includes all of them without a network dependency. Method-specific rules remain distinct. Optional publication adapters and collaboration services do not become mandatory dependencies of the three utilities.

The artifact directory is `standard/utilities`. Maintained project source is unchanged by this specification task.

See validation evidence (historical specification citation) for specification checks and [existing-runtime evidence](07-existing-system.md) for the measured baseline. Product acceptance remains pending implementation.

Historical evidence/source snapshots cited in this chapter are excluded from the standalone distribution. Current behavior and qualification are documented in [the public project](https://github.com/scratchbird-software-inc/Diagram-Design-Notation).
