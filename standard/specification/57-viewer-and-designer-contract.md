# 57. Viewer and designer contract (DDN 0.8 draft)

> Examples in this chapter use 0.8 (0.6-dialect) syntax, fenced ```ddn-0.8. The reference runtime implements this chapter's language constructs; the doc-snippet parse gate (`notation/tests/doc-snippets.js`) parse-checks every fence under a `ddn "0.6";` header.

Status: draft for the 0.8 standard revision. This chapter fixes the product
boundary between the open-source viewer, the open-source designer, and any
commercial superset. It is a contract over existing components (the unified
tool in `notation/tool/`, the designer in `designer/`), not a UI
specification: implementations may realize the surface differently but MUST
honor every MUST here. Runtime behavior is governed by chapters 51–55; this
chapter adds no language features.

## 57.1 Viewer: render-only plus navigation (D1)

The viewer renders `.ddn` to SVG and offers **no** editing capability. Its
normative surface is:

1. **Zoom-to-fit**: fit page / fit width / fit height / 100% as pure
   viewport transforms of the finished SVG. Zoom never re-layouts, never
   re-routes, and never changes the exported artifact.
2. **Element focus**: clicking a node focuses it (highlight plus optional
   neighborhood emphasis) using the renderer's `data-ddn-id` hooks. Focus
   state is session-only and never enters the source or exports unless the
   user explicitly exports a styled view.
3. **Link following**: subdiagram references and `x_subdiagram` badges
   navigate to their target views; `ref:` anchors (chapter 55 §S4) expose a
   navigation hook (`href`-style) that focuses the referenced element. Link
   targets resolve through the workspace only — never to network URLs
   (chapter 08; `DDN078` rules unchanged).
4. The viewer MUST NOT mutate source: no inspector edits, no drag-to-pin,
   no save. Presentation overrides (chrome, palette) are session-only.

## 57.2 Designer: new document and templates (D2)

- **Explicit "New document"**: a dedicated, always-visible command. A new
  document starts **EMPTY** unless the user opened an existing `.ddn`.
- The empty document is a valid `.ddn` skeleton:

```ddn-0.8
ddn "0.6";
module "untitled";
data model {
}
view main {
  data: [@model];
  publication { size: content; fit: none; }
}
```

  (0.8 dialect; a 0.7 designer writes the same skeleton with `ddn "0.5";`.)
  An empty `data` block and an empty view selection are legal and render an
  empty artboard (degenerate corpus, chapter 58 §C2).
- **Template picker**: optional, keyed to the registered view kinds of
  chapter 52 — picking `flowchart` scaffolds a `kind: flowchart` view with
  starter elements from that vocabulary. Templates are source generators,
  not runtime features: after creation the document is ordinary `.ddn` with
  no template dependency.

## 57.3 Designer: multi-pane workspace editing (D3)

- One editor tab per workspace file for multi-file workspaces (chapter 56
  §X3); the tab set is the entry's import closure plus explicitly added
  files.
- **Add file** defaults follow the naming conventions: sibling of the
  importing file, kebab-case, `.ddn`; the tool offers to insert the
  matching `import "…" as …;` line rather than leaving a dangling file.
- **Jump-to-definition** on `@refs` (and on `ref:` anchors) navigates to the
  declaring file:line using the diagnostic location contract (chapter 56
  §X4).
- **Diagnostic list**: every check diagnostic listed with code, severity,
  file:line; clicking navigates. The list is regenerated on each check, not
  accumulated.
- **Live re-render**: the active view re-renders debounced (≤ 500 ms after
  last keystroke) while editing; render failures show the last good picture
  dimmed plus the diagnostics, never a blank stage.

## 57.4 Designer: export boundary (D4)

- Client-side, always available: **SVG** (the renderer's native output) and
  **PNG** (canvas rasterization, 2×, capped 16384 px/side). Both run fully
  in the browser from `file://`; no server, no telemetry.
- **PDF and PPTX are commercial/service features.** The OSS designer offers
  no PDF/PPTX button, not even a disabled one advertising them; the formats
  are a hosted superset consuming the same runtime (§57.6).
- **Importers** (e.g. a Mermaid subset) are a designer feature, never a
  viewer one. Mermaid import is deferred to 0.9; the 0.8 surface only fixes
  where it will live (a designer "Import…" command producing ordinary 0.6
  source through the same skeleton/template path as §57.2).

## 57.5 Designer: tidy / re-layout (D5)

A **Tidy** command re-runs placement and routing on the active view with all
authored pins respected: pinned elements keep their positions exactly, free
elements are re-placed by the view's declared (or default) layout algorithm,
and routes are recomputed under the existing quality gates. Tidy is an
ordinary undoable source/workspace operation — it writes computed `place`
pins for free elements only when the user confirms "pin result"; otherwise
it changes the session layout state, not the source. It never relaxes
`endpoint_ordering`, route policies or geometry checks to force a result
(chapters 05/26).

## 57.6 Guardrail: OSS footprint vs commercial superset (D6)

- The open-source footprint is exactly: the existing runtime bundles plus
  the editor component. No 0.8 feature may add a server dependency, a
  build-time codegen step for end users, or a third-party runtime
  dependency.
- A commercial offering is a **hosted superset consuming the same runtime
  bundles** — additional formats (PDF/PPTX), storage, collaboration —
  delivered around, never as a fork of, the runtime. Any divergence in
  check/render behavior between OSS and hosted use of the same source is a
  defect, and the conformance vectors (chapter 58) run against both.
- Feature-gating in the superset happens at the application layer (export
  formats, hosting), never by patching runtime diagnostics or rendering.
