# Data Design Notation (DDN)

A **model-first diagram language** and open standard proposal: you author data,
format, and view declarations separately in plain-text `.ddn` files, and one
semantic model projects into many diagram types (ERD, DFD, flowchart, C4 context/container/component,
matrix/RACI, chart, radar chart, funnel chart, gauge chart, candlestick chart, treemap, Sankey diagram, timeline, fishbone, decision, org charts, work breakdown structures, mind maps, concept maps, EPC process chains, business-model/lean canvases, PESTLE/five-forces canvases, BCG/Ansoff/TOWS matrices, …) through versioned
profiles and projections.

This repository is a monorepo with four components:

| Directory | Component | Contents |
|---|---|---|
| `standard/` | **Proposed DDN standard** | Normative specification chapters, EBNF grammar, JSON schemas, the notation vocabulary registry, notation plates, governance |
| `notation/` | **Notation project** | Pure-JavaScript reference runtime (parser → validation → layout/routing → deterministic SVG), CLI, browser Studio, adapters, tests |
| `designer/` | **Visual designer project** | Designer specification (0.1), proposed contracts (schemas, UI maps, API types), working prototype, research, decisions |
| `examples/` | **Example diagrams** | 19 basics, projection and quality corpora, 22 use-case scenarios |

Supporting directories: `docs/` (project documentation and website, TBD) and
`tools/` (shared build/serve/package scripts).

## Status

Draft proposal, pre-1.0. Language/runtime/registry at **0.5.0-draft.2**,
designer specification at **0.1.0**. See `standard/specification/00-status-and-scope.md`
and `designer/specification/00-charter.md`. This project does not claim UML,
BPMN, or DMN conformance, and local fixture tests are not legal, accounting,
or security approval.

## Quick start

**No server needed:** open `index.html` in any browser — it renders a live
diagram in-page and links to every standalone page: the full diagram gallery
(`notation/studio/portable-gallery.html`), the Studio editor
(`notation/studio/portable-editor.html`), the working designer prototype
(`designer/prototype/standalone.html`), and the notation plates
(`standard/plates/index.html`). All work from `file://`.

Requires Node 22+ for tests/tooling (no runtime dependencies; Python 3.12+
optional — see `tools/requirements-dev.txt`).

```sh
npm test                                  # notation test suites
npm run serve                             # http://127.0.0.1:8080 → repo root
# Studio:    http://127.0.0.1:8080/notation/studio/editor.html
# Prototype: http://127.0.0.1:8080/designer/prototype/index.html

node notation/cli/cli.js check examples/basics/01-customer.ddn --workspace .
node notation/cli/cli.js render examples/basics/01-customer.ddn --workspace . --out /tmp/customer.svg
```

## Licensing

GPL-2.0-or-later; see `LICENSE`. The previous draft packages were distributed
under MIT by the same contributors; the project was relicensed at import. No
fonts or third-party runtime code are vendored — see `NOTICE.md`.

## Legacy path mapping

Documents imported from the 0.5.0-draft.2 monolith and the designer
specification 0.1 package may still reference their original paths. Mapping:

| Legacy path | Current path |
|---|---|
| `spec/` | `standard/specification/` |
| `grammar/` | `standard/grammar/` |
| `schema/` | `standard/schemas/` |
| `registry/`, `profiles/` | `standard/registry/` |
| `gallery/` | `standard/plates/` |
| `reference/*.js` | `notation/runtime/` |
| `reference/cli.js` | `notation/cli/cli.js` |
| `live/` | `notation/studio/` |
| `dist/` | `notation/dist/` |
| `examples/*.ddn` | `examples/basics/` |
| `use-cases/` | `examples/use-cases/` |
| `codex/RFC-TEMPLATE.md` | `standard/governance/RFC-TEMPLATE.md` |
| designer pkg `spec/` | `designer/specification/` |
| designer pkg `review/` | `designer/decisions/` |

## Contributing

See `CONTRIBUTING.md`. Security reporting: `SECURITY.md`.
