# ddn-next-1 public migration — 2026-10-28

The public DDN project now uses the new standalone open-source DDN implementation and website. The source intake was captured from DDN materials at development commit `422b7e5977c2c47c9e97d760e943af7d3bdc3ad9`; all captured inputs remained unchanged during qualification. The commercial repository itself and its platform implementation are excluded. [Intake scope](SOURCE-INTAKE.json) records the public boundary and adaptations.

## Replaced surfaces

- `project/ddn`: standalone language/model/defaults/rules/runtime/presentation packages, viewer, visual designer, verifier and adopted API declarations.
- `standard`: current language, property/default codex, schemas and utility contracts. Superseded draft schemas, old parser sources and legacy profile examples are excluded.
- `website`: current offline site, 160 field-guide lessons, all 151 profile references, 560 role previews, complete downloads, modular tools, fonts and converted examples.
- `docs`: current build, embedding, appearance, font, implementation and bounded coverage guides.
- Wiki: 894 current pages generated from the same maintained site; 99 old page addresses redirect to current material. Old wiki snippets and screenshots are retired with their old syntax.
- Workflows: standalone qualification gates before Pages publishing; current standalone release artifacts replace the retired notation npm publisher.

The 0.8 grammar and public APIs are incompatible and retired. Historical implementations remain in Git history; no dual parser, old service runner or compatibility aliases are shipped. Existing reusable family artwork and third-party notices are preserved.

## Verified locally

| Gate | Result |
| --- | --- |
| Adopted ABI and compiler dependency boundary | Passed; 12 standalone packages, no commercial dependency |
| Unit/integration suites | 1,119 passed; no failures or skips |
| Chromium utility suites | 676 passed; no failures or skips |
| Website suites | 56 passed; no failures or skips |
| Gallery regeneration | 166 files / 474 views; no failed capture, nonfinite geometry, browser error or network request |
| Wiki generation and local link resolution | 894 pages plus 99 redirects |
| Maintained JSON, tooling syntax and documentation links | Passed |
| Clean integrity-pinned toolchain bootstrap | Passed; downloaded and verified Node, pnpm, npm and TypeScript |

The gallery preserves the original 163 converted files and 466 views. Tests and gallery builds use the current parser and runtime; no retired runtime is needed. The website is directly usable from disk, through HTTP and from the offline distribution. Gallery regeneration pins Fontconfig resolution to shipped, hash-checked font resources so host-installed system fonts cannot change the generated geometry; user font choices in the browser utilities remain independent.

## Explicit qualification limits

Native single-file viewer, designer and verifier bundles exceed their gzip targets; the verifier also exceeds its raw size target. Build manifests retain those failures. The complete edition records sizes as observations. The migration does not claim the bundle-size release gate, full cross-browser/OS/accessibility matrix, lower-resource performance or prolonged leak tests are qualified. The exact bootstrap's bundled Node artifact currently supports Linux x64; distributed browser utilities do not require that build toolchain.

Optional PDF/DOCX/ODT adapters and commercial server/collaboration/media services are outside this standalone implementation. Bounded profile support does not assert full external-standard execution or certification. See [implementation limits](DDN/IMPLEMENTATION.md).
