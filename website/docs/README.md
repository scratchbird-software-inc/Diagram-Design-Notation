# Docs

Project-level documentation and (future) the project website.

- `developers/` — developer documentation (B1-010): orientation/doc map,
  getting started, runtime modules and bundle sizes, the workspace API
  reference, embedding, the end-user viewer, CSS styling hooks, live data
  refresh, `.ddn` source authoring, and the 0.5 → 0.6 migration guide. Start
  at `developers/README.md`.
- `notes/` — topical engineering notes imported from the draft packages:
  - `ROUTING-PATCH.md` — endpoint-ordering routing patch notes (draft.2 delta).
  - `HANDDRAWN-FIX.md` — hand-drawn style fix notes.

The prebuilt static site from the 0.5 monolith is not imported; a fresh site
generator will live here. Until then, `npm run serve` serves the repository
directly (Studio, prototype, plates, and specs are all browsable).
