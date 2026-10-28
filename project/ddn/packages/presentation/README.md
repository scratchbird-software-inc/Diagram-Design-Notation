# DDN presentation packages

`@ddn/presentation` and `@ddn/viewer` are complete convenience entries. They install all adopted presentation families and preserve the existing synchronous projection API.

`@ddn/presentation/native` and `@ddn/viewer/native` contain native DDN presentation. They do not import optional chart, geographic, surface or foreign-method drawing engines. Native DDN retains the common graph geometry, relationship markers, role symbols, regions, nested views and appearance support it uses.

A modular host loads the matching catalogue and verification family before installing the required presentation family:

| Family | Entry | Installer | Profiles |
| --- | --- | --- | ---: |
| Native DDN | `@ddn/presentation/native` | Included | 4 |
| Graph methods | `@ddn/presentation/families/graphs` | `installGraphsPresentation()` | 92 |
| Charts | `@ddn/presentation/families/charts` | `installChartsPresentation()` | 30 |
| Geography | `@ddn/presentation/families/geography` | `installGeographyPresentation()` | 3 |
| Management surfaces | `@ddn/presentation/families/surfaces` | `installSurfacesPresentation()` | 22 |

Importing an optional family does not install it. The host explicitly calls its installer after resolving the selected version and dependencies. Repeating the same installation is idempotent. Unsupported versions, conflicting replacements and duplicate profile registrations fail without partially installing a family. The built-in family version is `1.0.0`, with language/default contract `ddn-next-1`.

`availableProjectionProfiles` reflects installed drawing implementations. A known catalogue profile whose renderer is not installed produces an explicit unavailable frame and incomplete coverage; supplying a capability callback cannot bypass that requirement. A host must reproject after installing a required family. Optional graph and management-surface families also enable the bounded profile-analysis inspector; native cards do not load that analysis engine.

Data families share scene setup and scalar drawing helpers. Native and foreign graph families share geometry helpers. The splitting does not change scene coordinates, semantic identities, calculations, default precedence or publication behavior.

The existing browser host remains responsible for asynchronous pack loading, asset hashes, version selection and worker setup. These presentation entries perform no network access, runtime compilation or loading by themselves. They can be assembled into a modular website, an offline folder or a single-file distribution.
