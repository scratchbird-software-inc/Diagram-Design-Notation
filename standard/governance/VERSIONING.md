# Versioning and release policy

DDN is a pre-1.0 draft standard. Versioning is layered:

| Layer | Mechanism | Current |
|---|---|---|
| Language source version | `ddn "0.x";` declaration at the top of every `.ddn` file; runtime accepts a fixed set (`ddn-core.js` `SOURCE_VERSIONS`) | 0.2 – 0.5 |
| Runtime / notation package | semver (pre-1.0 minor releases; prerelease tags `-draft.N`/`-beta.N` used during development); git tags `notation/vX.Y.Z` | 0.7.0 |
| Core registry | pinned identifier `ddn-core@0.3` inside `registry/catalogue.json` | ddn-core@0.3 |
| Profiles | `name@version` identifiers, listed in `registry/profiles/catalogue.json` | 24 installed |
| Standard documents | chapter set per language version; git tags `standard/vX.Y.Z` | 0.7.0 |
| Designer specification | independent semver; git tags `designer/vX.Y.Z` | 0.2.0 |

The 0.7.0 stamp (2026-09-25) drops the prerelease series: this is a
runtime/standard packaging release, not a language change — the language
source version stays at `0.2 – 0.5` and `ddn-core@0.3` is untouched. The
designer keeps its independent semver at `0.2.0`. History: the prerelease
series moved from `-draft.N` to `-beta.N` at 0.6.0-beta.1 (2026-09-20),
also a packaging release.

## Rules

1. The registry may grow additively within a draft; changing or removing a
   kind, relation verb, facet, or property is a language change and needs an
   RFC.
2. A new `-draft.N` may tighten validation only with new error codes and
   fixtures covering both acceptance and rejection.
3. Profiles are immutable once published under a version; changes ship as a
   new version.
4. Runtime, registry, schemas, specification, and fixtures move together for
   a language release; the CLI and SDK bundle must not present a newer
   language than the specification documents. Packaging is part of a release:
   the `@ddn/notation` tarball (`npm pack` in `notation/`) ships the
   version-stamped `dist/` bundles behind the package `exports` map at the
   same semver stamp (0.7.0 at the current release).
5. Release integrity evidence (manifests, checksums, archives) is generated at
   tag time by release tooling; that tooling from the 0.5 monolith is not yet
   imported into this repository.
