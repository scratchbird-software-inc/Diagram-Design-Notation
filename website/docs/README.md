# Docs

Project-level documentation. This directory lives inside the deployable
static site (`website/`); every Markdown page here is rendered to HTML by
`website/build-site.mjs` (`npm run build:site`) and browsable from the site's
Docs section.

- `developers/` — developer documentation (B1-010): orientation/doc map,
  getting started, runtime modules and bundle sizes, the workspace API
  reference, embedding, the end-user viewer, CSS styling hooks, live data
  refresh, `.ddn` source authoring, and the 0.5 → 0.6 migration guide. Start
  at `developers/README.md`.
- `notes/` — topical engineering notes imported from the draft packages:
  - `ROUTING-PATCH.md` — endpoint-ordering routing patch notes (draft.2 delta).
  - `HANDDRAWN-FIX.md` — hand-drawn style fix notes (historical; its draft-era
    paths refer to the 0.5 packages, not this repository).
