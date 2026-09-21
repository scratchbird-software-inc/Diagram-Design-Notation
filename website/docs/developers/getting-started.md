# Getting started

The DDN runtime ships as plain script files — no build step, no runtime
dependencies. Pick the all-in-one bundle for the simplest start.

## Browser (script tag)

```html
<div id="diagram"></div>
<script src="notation/dist/ddn.global.js"></script>
<script>
  const ws = DDNLive.createWorkspace({
    "hello.ddn": 'ddn "0.5";\nmodule "demo";\ndata m {\n' +
      '  object a "Order intake" { kind: application; }\n' +
      '  object b "Ledger" { kind: table; }\n' +
      '  relation posts @a -> @b { kind: assoc; }\n' +
      '}\nview v "Hello" { data: [@m]; }\n'
  });
  const result = ws.renderSync({ entry: "hello.ddn", view: "v" });
  document.getElementById("diagram").innerHTML = result.svg;
</script>
```

That is a complete first render: create a workspace from a map of file names
to source text, render a declared view synchronously, and place the returned
SVG. Ten lines, and it works from `file://` because nothing is fetched. A
single file can also carry the whole design — model, data, views and formats
as several `module "…";` sections (RFC-117, see
`website/examples/basics/61-self-contained.ddn`) — and `DDNLive.io.bundle(files,
entry)` merges a multi-file workspace into one such self-contained file with
byte-identical rendering.

For an embedded, self-updating element use `DDNLive.mount` instead — see
[embedding.md](embedding.md).

## Node (`require`)

The package is published from `notation/` (`npm pack` there, then
`npm install <tarball>`). Its `exports` map exposes both the all-in-one
bundle and the modular splits:

```js
const DDN = require("@ddn/notation"); // same surface as DDNLive
const ws = DDN.createWorkspace({ "hello.ddn": sourceText });
const { svg, diagnostics } = ws.renderSync({ entry: "hello.ddn", view: "v" });
console.log(svg.length, diagnostics.length);
```

Inside this repository, require the bundle directly:
`require("./notation/dist/ddn.global.js")`. The ES-module twin is
`notation/dist/ddn.mjs`; types ship as `notation/dist/ddn.d.ts`.

## CLI

No install needed inside the repo:

```sh
node notation/cli/cli.js check  website/examples/basics/01-customer.ddn --workspace website/examples/basics
node notation/cli/cli.js render website/examples/basics/01-customer.ddn --view overview --workspace website/examples/basics --out /tmp/overview.svg
node notation/cli/cli.js resolve website/examples/basics/01-customer.ddn --view overview --workspace website/examples/basics
```

`check` parses and validates, `render` writes the deterministic SVG, and
`resolve` prints the resolved model (elements, relations, profiles,
diagnostics) as JSON — the same structures the library returns from
`ws.resolve`.

## What to read next

- Only need validation, not rendering? Load a smaller bundle: [modules.md](modules.md).
- Every method used above is specified in [api-reference.md](api-reference.md).
- The source language itself: [authoring-sources.md](authoring-sources.md).
