# DDN — Diagram Design Notation

DDN is free, open-source design notation with a standalone **viewer, visual designer and verifier**. The current language is **`ddn-next-1`**, with utility API **1.0** and **151 bounded diagram profiles**. It replaces the incompatible 0.8 proof of concept; there is no legacy parser or compatibility mode.

[Website](https://scratchbird-software-inc.github.io/Diagram-Design-Notation/) · [Try the designer](https://scratchbird-software-inc.github.io/Diagram-Design-Notation/tools/index.html?mode=design) · [Downloads](https://scratchbird-software-inc.github.io/Diagram-Design-Notation/download/) · [Wiki](https://github.com/scratchbird-software-inc/Diagram-Design-Notation/wiki) · [Documentation](docs/README.md)

## Use DDN

Open [website/index.html](website/index.html) in your browser, or use the hosted website. Keep the directory intact: the site, examples, fonts and utilities work offline without an account or server. The download page offers single-file HTML utilities and a modular offline ZIP. The viewer is read-only; the designer adds local editing; both use the verifier.

```text
version ddn-next-1
view Orders : ddn@1
```

Start with the [quick start](website/guide/quick-start.html), [language guide](website/guide/language.html), [gallery](website/gallery/index.html) and [complete reference](website/reference/index.html). For AI-generated diagrams, supply the single [AI authoring reference](website/guide/ddn-ai-reference.txt) with your request. It contains the syntax, defaults, constraints, examples and all 151 profiles.

Native DDN supports progressive design, shared definitions, linked views, structured fields, notes, datasets, file/CSS/standard defaults and explicit lifecycle commands. Additional profiles retain their own method rules. Profile support is bounded authoring, checking and presentation, not full external-standard certification or execution engines.

## Build and test

Development needs Node.js, Python 3 and tar. The integrity-pinned bootstrap installs Node **24.22.1**, TypeScript **5.9.3** pnpm **10.34.7** and npm **12.2.1** under `.work`; its bundled Node archive currently targets **Linux x64**. Browser tests use pinned Playwright **1.64.1** and Chromium. The distributed browser utilities have no Node/Python dependency.

```sh
node tooling/bootstrap/bootstrap.mjs
bash tooling/run.sh check
bash tooling/run.sh build:ddn
bash tooling/run.sh test:ddn
node tooling/browser/bootstrap.mjs
bash tooling/run.sh build:ddn:website
bash tooling/run.sh test:ddn:browser
bash tooling/run.sh test:ddn:website
python3 tooling/wiki/build-wiki.py
```

Outputs live under `.work`. The website build refreshes the maintained static site, downloads and all 474 gallery views. Run it in a disposable copy when reviewing changes; repository agents must follow [AGENTS.md](AGENTS.md). npm scripts provide the same commands. [Contributing](CONTRIBUTING.md) explains validation and publishing.

## Embed the modules

See the [package and embedding guide](project/ddn/README.md), [modular delivery guide](docs/DDN/MODULAR-DISTRIBUTION.md), [browser API declarations](project/ddn/packages/types/src/browser.d.ts) and [adopted contracts](standard/README.md). Shared language/model/verifier packages are independent of the DOM and Node. Browser adapters and optional profile/worker/font packs are explicit.

This repository contains only the standalone DDN foundation. Multi-user collaboration, accounts, coordinated servers and media belong to the separate commercial Weaver product; they are not required to use DDN.

## Licence and sponsorship

DDN source, documentation, examples and website are **[GPL-2.0-or-later](LICENSE)**. Third-party resources retain their own licences; preserve [notices](NOTICE.md) and bundled font/icon attribution. Sponsored by [ScratchBird Software Inc.](https://scratchbird.ca), alongside [Weaver](https://scratchbird.ca/weaver), [ScratchBird CDE](https://scratchbird.ca/bird) and [ScratchRobin](https://scratchbird.ca/robin).
