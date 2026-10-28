# DDN — free and open-source diagramming

Open [index.html](index.html) directly in a current desktop browser. No server, account or network connection is required for the website, gallery or bundled browser utilities. Keep this directory intact so its relative links, sources and assets remain available.

This is the replacement website for the new DDN release. DDN, its viewer, visual designer, verifier, and original website material are free and open source under **GPL-2.0-or-later**, sponsored by [ScratchBird Software Inc.](https://scratchbird.ca). See the [licence and sponsorship page](license/index.html), [full licence](license/LICENSE) and [notices](license/NOTICE.md).

DDN is part of the ScratchBird suite of systems software, alongside [Weaver](https://scratchbird.ca/weaver), [ScratchBird CDE](https://scratchbird.ca/bird) and [ScratchRobin](https://scratchbird.ca/robin). Weaver is a separate commercial platform; its commercial terms do not apply to DDN. Fonts and third-party artwork retain their own included licences.

The site uses the new `ddn-next-1` language and current DDN implementations. This is the maintained website for the [public DDN project](https://github.com/scratchbird-software-inc/Diagram-Design-Notation). GitHub Pages publishes this directory after its checks pass. A local build does not deploy the site.

## What to review

For an AI assistant, attach [ddn-ai-reference.txt](guide/ddn-ai-reference.txt) and describe the desired result. This is one self-contained plain-text authoring reference, including all 151 profiles; it is generated from the maintained contracts and checked with executable examples.

1. Open the [gallery](gallery/index.html). It contains all 151 adopted profiles, nine variation sheets and 166 example files containing 474 views. The original 163 converted files and 466 views are preserved; [paper and stationery](features/paper.html), [appearance standards and image symbols](features/appearance.html) add eight views. Search by profile or title; use the corpus tab to explore every source entry.
2. Choose **View**, **Design** or **Verify** beside an example. The selected example and view open in the actual standalone implementation. The viewer is read-only. The designer adds visual commands, editable source, undo/redo and downloads. The verifier reports source and semantic diagnostics.
3. In the designer, change source or use an editing command, apply it, inspect the result and export the selected view. Save source through the browser download action; changes are not written back to this repository automatically.
4. Try ERD details and ports, diagram relationships, charts, matrices, maps, composed views, drilldown, layout/style variations and isometric depth. Compare the displayed result with its downloadable source.
5. Open the [guide](guide/index.html), [profile and property reference](reference/index.html) and [symbol library](icons/index.html). These describe the current dialect and contracts.
6. Download or open the three [standalone HTML tools](download/index.html). JavaScript embedding facades also require the accompanying `modules/` directory. Examples using icons, maps or frozen images require their declared assets when moved out of this site.
7. Try **Appearance & presets** in the designer for movable background, font and preset forms with numeric sliders. The fixed property drawer is removed; **Item details** opens read-only inspection, and **Properties** supplies typed editable settings. **Interface** selects Light, Dark, Midnight or Warm chrome independently of the diagram. The modern review site and tools use the existing project logos and local fonts; Dark is the initial look when no preference is saved. **Hide source** makes more room for the canvas without losing the editor contents. On phones, source starts collapsed and **Document tools** reveals file/export controls. The optional local font resources provide Inter, Source Serif 4, JetBrains Mono and Caveat; keep `ddn-fonts.js` beside downloaded tools to retain those resources. The appearance page includes a company preset pack to import. Company administration and distribution remain Weaver service work.

## Rebuild and check

From the DDN repository root, with the project toolchain and browser dependencies installed:

```sh
bash tooling/run.sh build:ddn:website
bash tooling/run.sh test:ddn:website
```

The build uses the maintained sources and assets in this directory; the original repository is not needed. It builds all three tools, refreshes the offline source payloads and renders every view with the new viewer. The render gate rejects failed verification, unavailable capture content, invalid geometry, browser errors and network requests before updating gallery images. Reports and disposable build output remain under `.work/`.

The one-time `tooling/website/migrate-*.mjs` tools are separate migration evidence tools. Normal rebuilding does not invoke the deprecated parser or migration input snapshot.

## Provenance and limits

[conversion-manifest.json](gallery/conversion-manifest.json) records original source hashes and converted file hashes. The original artwork is packaged locally with its notices. [Map normalization](assets/geo/normalization.json) records removal of two degenerate, zero-area polygon members; country features and valid polygons are preserved.

The drilldown example intentionally preserves its historical, dated frozen image as a static declared SVG asset. Its old version text is part of the snapshot, not an executable runtime or accepted source dialect. All gallery captures are produced by the new viewer.

These are the bounded implementations of the 151 adopted profiles, not a claim of every feature in every external diagramming standard. PDF/DOCX/ODT adapters, shared editing and commercial services are outside these standalone tools. The complete review bundles contain all profiles; this review does not constitute size-budget or production-release qualification.

Gallery builds use an isolated Fontconfig configuration with the shipped, hash-checked Inter, Source Serif 4, JetBrains Mono and Caveat resources, plus the attributed DejaVu Sans fallback fixture. System font installations cannot change the generated geometry. Linux builds need Fontconfig (`fc-match`); Chromium system dependencies provide it on CI. These build settings do not change the browser utilities’ user-selected fonts.
