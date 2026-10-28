# Modular DDN distribution

DDN has three delivery forms with the same `ddn-next-1` language, versioned defaults and 151 bounded profiles:

| Form | Use |
| --- | --- |
| Modular folder | Website hosting, embedding, or direct offline use. Shared code loads once; optional diagram families load when required. |
| Native single-file HTML | Four native profiles embedded in each utility. |
| Complete single-file HTML | All 151 profiles embedded for portability. |

The [download page](../../website/download/index.html) includes the modular ZIP. Extract it before opening `viewer.html`, `designer.html` or `verifier.html`; keep the directory intact. The loader uses ordinary local scripts, so no server, CDN, import map or network font service is required. Local document includes and assets must still be supplied by the user/host.

## Boundaries

The shared foundation contains the language, model, structural schema, default resolution and native verification. Native presentation adds cards, tables, native graph layout, navigation and capture. Designer commands and controls are a separate dependency. The verifier loads no diagram renderers.

The 147 optional profiles are divided into 19 packs: graphs (process, UML, ERD, architecture, systems, specialist), charts (standard, statistics, hierarchy, relationships, density/calendar), surfaces (matrices, panels, canvases, timeline, decisions), and geography (choropleth, symbols, outline). Four native profiles bring the total to 151. Each pack has independent catalogue and verification entries and an optional rendering registration. Related packs can share rendering algorithms. The four broad family aliases remain convenience entries that load all their smaller packs.

The lightweight profile index is available at bootstrap. The full structural schema and native catalogue are loaded before the first source/model operation, then reused across utilities. Recognition of a profile does **not** install its semantic rules. Missing capabilities remain unsupported/incomplete, and failed pack loads are reported explicitly. The schema generator verifies exact equivalence with the canonical codex; normal ESM and single-file builds retain eager data.

Appearance, symbol, property and diagram/layout chooser panels load when opened. ZIP support loads when saving an archive. The production build specializes one maintained shell for each utility and uses pinned esbuild tree shaking/minification before offline classic-script packaging. Single-file editions receive a final Terser pass without property mangling or unsafe getter assumptions. The shared catalogue uses dictionaries for repeated strings and object key sequences, then reconstructs the original wire tree before decoding. Every schema index and property order is preserved. Literal local dynamic imports become trusted module-loader requests; source text cannot supply executable paths. Complete single-file editions embed all these modules and defer execution only.

A module is emitted in one chunk, shared where required. The manifest records dependency closures, content hashes, compressed/raw sizes and optimizer provenance mapping emitted modules to original source files. Bootstrap bytes and first-native-document bytes are reported separately; the latter includes the full schema and worker prerequisites. Fonts and user assets are separate resources.

## Embed without the application shell

Load `ddn-loader.js` without a `data-entry` attribute, select an API entry:

```html
<div id="diagram"></div>
<script src="./ddn-modular/ddn-loader.js"></script>
<script>
(async () => {
  const DDN = await DDN_LOADER.loadEntry('api:viewer');
  const runtime = DDN.createRuntime(DDN.createBrowserRuntimeOptions());
  const viewer = DDN.createViewer(document.querySelector('#diagram'), { runtime });
  await viewer.open({
    entry: 'main.ddn',
    files: [{ id: 'main.ddn', text: 'erd Sales\n    Customer\n',
      revision: '1', encoding: 'utf-8', writable: true }],
  });
  // Later: viewer.destroy(); runtime.destroy();
})().catch(error => console.error(error));
</script>
```

`api:designer` additionally exports `createDesigner` and `createCommandService`; supply the established authority provider when adding editing. `api:verifier` exports `createVerifier` and options factories without viewer/designer dependencies. `viewer`, `designer` and `verifier` entry names mount the application shell. Source/model preflight identifies required profiles; the loader chooses only filenames from its trusted distribution manifest. DDN source cannot name executable modules or URLs.

For manually composed ESM applications, use `@ddn/runtime/native`, `@ddn/profiles/native`, `@ddn/viewer/native` and `@ddn/presentation/native`. Load a trusted `@ddn/profiles/families/<family>` entry for catalogue/rules, install its pack from `@ddn/profiles/families` into the runtime, then invoke the matching `@ddn/presentation/families/<family>` installer if rendering is required. These low-level imports do not perform IO. Complete convenience entry points retain eager complete capability.

## Workers, failures and deployment

Workers contain the dependency closure of their compute bootstrap plus the selected verification-family initializers. They contain no viewer, designer, DOM shell or drawing modules. CSP restrictions can use the same cooperative computation fallback. Adding packs to an existing runtime may trigger cooperative verification because its original executor configuration differs; creating a new verifier uses the selected rule set in its worker.

The loader selects a release-specific allowlist of chunk hashes and dependencies. Chunk installation checks that selection, language/default versions and conflicting registrations; a loader from another release cannot replace the active runtime. Repeated identical loading is harmless. Concurrent loads share one request; failures can be retried and have a bounded timeout. Missing packs never authorize a false-valid verification result. These are trusted application modules, not a sandbox for arbitrary third-party code.

Publish each release's loader, manifest and referenced chunks together. Revalidate HTML and the loader; content-addressed chunks and font faces can be cached across releases when their code and dependencies are unchanged. Keep previous release chunks in the deployment store while old pages remain open. Generated local build folders and offline ZIPs contain only the current release.

## Build and qualification

Run `bash tooling/run.sh build:ddn` from the repository root. Output is under `.work/builds/ddn-distribution/`, with modular files in `modular/`. `build:ddn:website` builds the corresponding GPL DDN website assets and renders its gallery. The ZIP contains the manifest-selected chunks, utility pages, GPL `LICENSE`, DDN `NOTICE.md` and optional font resources with their own notices. The standalone HTML downloads also retain the full GPL text, and JavaScript bundles identify `GPL-2.0-or-later`.

Run `test:unit`, `test:ddn:browser` and `test:ddn:website` sequentially: compilation commands share generated configuration. Tests cover dependency isolation, exact catalogue equivalence, missing/conflicting packs, local-file and HTTP loading, all-profile rendering/verification, editing and shell-free embedding.

Splitting reduces the initial dependency set and enables caching. Loading all features still incurs their combined size and some extra chunk metadata. The manifest reports raw bytes and separately compressed chunk totals, including a startup total with the loader and worker prerequisites. Fonts are measured separately. The native single-file viewer and designer meet their original size gates, which are enforced during distribution generation. The verifier still exceeds its compressed-size target. The original targets remain unchanged. See the current measurements in [implementation status](IMPLEMENTATION.md); modular delivery does not establish full release qualification.
