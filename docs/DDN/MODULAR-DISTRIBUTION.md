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

Optional families are `graphs` (92 method profiles), `charts` (30), `geography` (3) and `surfaces` (22). The four native profiles bring the total to 151. Each family has separately loadable catalogue/default data, verification registration and rendering implementation. Shared advanced analysis/rule helpers are emitted once across the families. Fonts and document/geographic assets remain independent resources.

The shared structural/lexical vocabulary deliberately remains available before a family loads. This preserves recognition of known names and exact schema indexes. Recognizing a profile or loading its data does **not** install its semantic rules. Missing capabilities remain unsupported/incomplete, and failed pack loads are reported explicitly.

The generator partitions modules by their entry-point dependency sets. A module is emitted in one chunk, shared where required; arbitrary boundaries cannot duplicate a dependency or create cyclic chunk dependencies. The manifest records every module, chunk, dependency, hash and size. Core/source utilities remain usable through ordinary ESM imports as well.

## Embed without the application shell

Load `ddn-loader.js` without a `data-entry` attribute, prepare the worker modules, and select an API entry:

```html
<div id="diagram"></div>
<script src="./ddn-modular/ddn-loader.js"></script>
<script>
(async () => {
  await DDN_LOADER.prepareEntry('worker');
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

Pack/chunk installation checks the language/default versions, release identity, declared dependencies and conflicting registrations. Repeated identical loading is harmless. Concurrent loads share one request; failures can be retried and have a bounded timeout. Missing packs never authorize a false-valid verification result. These are trusted application modules, not a sandbox for arbitrary third-party code.

Publish each release's loader, manifest and referenced chunks together. Revalidate HTML and the loader; release-specific chunk URLs can be cached. Keep previous release chunks in the deployment store while old pages remain open. Generated local build folders and offline ZIPs contain only the current release.

## Build and qualification

Run `bash tooling/run.sh build:ddn` from the repository root. Output is under `.work/builds/ddn-distribution/`, with modular files in `modular/`. `build:ddn:website` builds the corresponding GPL DDN website assets and renders its gallery. The ZIP contains the manifest-selected chunks, utility pages, GPL `LICENSE`, DDN `NOTICE.md` and optional font resources with their own notices. The standalone HTML downloads also retain the full GPL text, and JavaScript bundles identify `GPL-2.0-or-later`.

Run `test:unit`, `test:ddn:browser` and `test:ddn:website` sequentially: compilation commands share generated configuration. Tests cover dependency isolation, exact catalogue equivalence, missing/conflicting packs, local-file and HTTP loading, all-profile rendering/verification, editing and shell-free embedding.

Splitting reduces the initial dependency set and enables caching. Loading all features still incurs their combined size and some extra chunk metadata. The manifest reports raw bytes and separately compressed chunk totals, including a startup total with the loader and worker prerequisites. Fonts are measured separately. After the rendering corrections, the native single-file designer meets its size gates; viewer and verifier exceed their compressed-size targets. The original targets remain unchanged. See the current measurements in [implementation status](IMPLEMENTATION.md); modular delivery does not establish full release qualification.
