# Packaging, extensions and browser operation

## Public distributions

Each utility MUST have two distributions built from the same implementation:

| Distribution | Intended use | Required behavior |
|---|---|---|
| Native ES modules | Embed in another browser application | Explicit imports, tree-shakeable entries, no global mutable registration, no application framework requirement |
| Self-contained HTML | Download and open directly from disk | Inline trusted code/styles and selected packs, local file/drop/paste inputs, no server or network needed, worker fallback |

A static web host can serve the ESM distribution; that does not require an application backend. It is not the direct-from-disk distribution: browser module loading under `file://` has origin/CORS restrictions. The bundled HTML avoids external module imports and local fetch dependencies. [MDN module guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules).

Publish `ddn-viewer`, `ddn-visual-designer` and `ddn-verifier` as public entries. The designer depends on the viewer; the viewer uses the verifier; a headless verifier imports neither. Shared internal packages can be bundled together without exposing every helper as a public compatibility commitment. The declarations in `contracts/` specify the proposed interface, not executable libraries. Existing public APIs need not be preserved.

## Pack boundaries

Each exact retained profile has a route in [profile-routing.json](contracts/profile-routing.json). Method IDs and profile IDs are taken from the reconciled codex, not inferred from a renderer name. Sharing a graph renderer never merges UML, Chen, electrical or DDN rules.

Every route consists of:

1. The exact profile descriptor: roles, property/default references, endpoint rules, limits, purpose and bounded scope.
2. A method rule pack plus exact profile dispatch, including inherited rules declared by the codex.
3. A projection pack for scene construction, layout, routing and labels.
4. A generic typed property/member editor plus profile-specific command descriptors and any required interaction adapter.

These are proposed packaging routes. A route is not evidence that its implementation exists. `profile-routing.json` retains the source-contract pointer, scope, exclusions, rule list and regression-suite references so that a generic renderer cannot be mistaken for complete support.

The **native distribution** contains `ddn@1`, `mindmap.basic@1`, `concept.map@1` and `table.records@1`, with native draft/table/note handling, shared surfaces and native workarea navigation. Native ERD uses the native DDN catalogue/element contracts; it must not inherit Chen or crow's-foot constraints. Additional catalogue subtypes use their codex mappings and any required profile packs. Native-only packaging is not a restriction on the full standard.

The **complete offline distribution** includes all 151 retained profile descriptors, their rule and projection packs, and all required editor descriptors. Specialized exports remain separate capabilities unless bundled explicitly. Completeness means the bounded scope of each retained contract, not unrestricted conformance to every external notation standard.

Descriptors are generated from the authoritative codex at build time. Runtime bundles contain compact applicable fields/checks and lazily exposed help text, not copies of all expanded planning schemas, witnesses and example workspaces. A searchable reference/help pack can be shipped separately. Module manifests MUST distinguish required, optional and worker dependencies; payload accounting includes all transitive dependencies.

## Loading and extension ABI

An installed pack declares `id`, pack version, utility ABI version, supported language/default versions, exact profiles, dependencies, capabilities and a manifest hash. Registration is explicit on a runtime. Duplicate incompatible IDs and dependency cycles are errors before activation. No script path or executable expression in DDN is automatically imported.

An ESM host supplies trusted loaders through the registry. An offline distribution supplies already bundled factories. A missing pack produces a structured capability result and preserves source, identity and navigation; it does not silently substitute another profile. Installing a trusted compatible pack can resume pending work without reopening the document. Code loading and document loading are distinct host operations.

Standard extension points are source/asset provider, data provider, exact profile/rule/projection pack, output adapter, optional renderer backend and execution provider. A renderer consumes the common scene contract and cannot redefine semantic validity. An output adapter declares formats, supported profiles/content features, required assets/metrics, fidelity limitations and execution environment.

Trusted plugin code has host JavaScript privileges; the registry is not a sandbox. Untrusted document content remains data. Markdown uses an allowlisted parser without raw script/HTML execution; URLs and SVG assets are sanitized before rendering/export. Default providers do not retrieve remote URLs. Explicit host resource policy controls network-enabled providers. These requirements apply to all three utilities, including preview/report paths.

The typed pack ABI in `contracts/core.d.ts` declares profile descriptors, rules, command preparation and projection callbacks. Rule callbacks return dependency reads and checked coverage; command callbacks only prepare changes; projection callbacks request text metrics before emitting a scene patch. Each long-running callback must call the supplied accounting/yield checkpoint. The headless scene records are declared separately in `contracts/scene.d.ts`. Callback functions are trusted installed code and are not serialized across the worker boundary.

Every profile-defined command has a registered ID, argument schema, allowed profiles and editor descriptor. A generic typed property/table editor is the required fallback for ordinary metadata. A specialized adapter is required when the profile contract demands a distinct interaction; a free-form JSON box cannot be counted as completion of a specified visual interaction. Exact source-contract commands are included in the profile route and must be mapped to registered IDs during implementation.

Manifest source paths are relative to this specification directory, unless explicitly documented as repository paths. Logical module names do not prescribe npm package names or one JavaScript file per module.

## IO and persistence

Baseline input is the browser File API, directory/file selection where available, drag/drop and pasted text. Assign an explicit logical file ID to each selected source; normalize paths in the selected file map and reject ambiguous duplicates. Includes resolve within that map and preserve declaring-file identity. A missing include is a diagnostic; there is no implicit disk scan or network request. Root selection is explicit for a set containing multiple candidates; adding files later does not silently change the active workarea.

Baseline output is a Blob download. Saving a multi-file workspace downloads a manifest and files, normally in a locally produced archive. The archive implementation is a separate IO capability with size limits. Downloading is not confirmation that the browser persisted the files: the shell distinguishes generated/download-requested from an acknowledged file-system save. Optional direct filesystem access is feature-detected; `showOpenFilePicker` has limited browser availability and secure-context requirements. [MDN file picker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker).

IndexedDB recovery is optional. Quota failures must leave edits in memory and offer explicit download; local storage cannot be the sole durable copy because browser data can be evicted. [MDN storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). Direct-from-disk recovery support is detected at startup rather than assumed. Recovery records include source revisions, language versions and unsaved edit state; they do not certify accepted status or authenticate a user.

## Execution distribution

The worker build contains computation modules only. It receives cloneable records and transferred buffers, never DOM nodes or function callbacks. Transfer relinquishes ownership of buffers, so the application must retain a recoverable authoritative source/model copy. [MDN structured clone](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm), [transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects).

The HTML bundle may instantiate a Blob worker; CSP/browser restrictions can prevent it. A failed worker startup triggers the cooperative same-thread executor with a visible capability report. No mandatory SharedArrayBuffer, cross-origin isolation, service worker, OffscreenCanvas or persistent server is allowed. Workers do not have DOM access; main-context font/DOM measurement is an explicit input to computation. [MDN workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).

Worker code and its dependency payload count toward size budgets, including duplicate bytes embedded in HTML. The default runtime creates one compute worker lazily. Multiple runtimes intentionally create separate contexts; a host can share one runtime across several viewers. Executors are disposable and reconstructible from committed snapshots.

## Browser and embedding baseline

Release verification covers current and previous stable desktop Chrome, Edge, Firefox and Safari on recorded OS/browser versions. This is a release test matrix, not a claim of tests already run. Baseline features are ES2022, SVG, Promise, typed arrays, File/Blob, pointer/keyboard events and requestAnimationFrame. Workers, IndexedDB, filesystem pickers and advanced schedulers are optional. Touch navigation and accessible controls MUST work; large editing sessions on constrained mobile devices are a separately measured capability.

Default shells use scoped CSS and accessible HTML controls. Embedders supply a host element; instances do not leak listeners, styles, IDs or selection into one another. Shadow DOM is optional, not required for correctness. Resize, device-pixel ratio and font changes invalidate presentation metrics appropriately. The language/style registry accepts only codex-supported property mappings; arbitrary host CSS cannot override explicit file properties or change semantic rules.

Cancellation, missing assets/packs, unsupported browser features, resource exhaustion and provider disconnection are typed failures. Destroying one instance releases only its leases. Destroying the owning runtime cancels jobs, closes subscriptions, terminates workers and invalidates its handles. No utility installs global event handlers without a corresponding removal path.
