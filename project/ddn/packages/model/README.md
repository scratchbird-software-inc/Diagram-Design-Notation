# @ddn/model

Shared normalized DDN record and reference helpers for `ddn-next-1`, licensed
GPL-2.0-or-later. The language package constructs the selected include closure;
these helpers operate on that normalized bundle without loading files.

`normalizeLocation(value, fromFile)` resolves relative locations against their
containing source file. Local paths use slash separators, NFC path segments and
dot-segment normalization. Hierarchical URLs use URL scheme, authority, port and
path canonicalization, including `file:/` locations. Traversal above the selected
namespace root is rejected before URL resolution can silently clamp it. URL
authority must be explicit when present. Quoted ASCII spaces are escaped as path
data; path case, encoded separators, query and fragment identity remain distinct.
Absolute opaque URI identities are retained and cannot be used as relative bases.
This function performs no fetching or host admission; selecting permitted source
locations remains the host's responsibility.

`resolveReference` and `findRecord` take already normalized file identities. They
do not resolve a file qualifier a second time. References stay within their
declaring file unless they supply another file identity. IDs are exact stable
strings scoped to a physical file; the same ID may occur in another file. Names
are case-sensitive after NFC normalization. A lookup refuses duplicate IDs,
ambiguous names, conflicting name/ID pairs and missing stable identity. Supplying
a name cannot disambiguate a duplicate ID. `recordRef` never substitutes a mutable
name for a missing ID; malformed records retain an empty reference ID for callers
to diagnose.

Record helpers retain the existing mutable builder API used by the parser and
command preparation. Immutable revision snapshots belong to the runtime boundary.
These helpers neither allocate replacement IDs nor authorize loading additional
files outside the parser's selected include closure.

From the checkout root, with the pinned toolchain already restored:

```sh
source tooling/env.sh
.work/tools/toolchain/node/bin/node tooling/workspace/run.mjs build:open
DDN_BUILD_ROOT="$PWD/.work/builds/ddn" \
  .work/tools/toolchain/node/bin/node --test project/tests/CORE01/model.test.mjs
```

The focused tests cover canonical location vectors, namespace escapes,
file-qualified lookup, duplicate identity rejection, NFC names and actual parser
include cycles. They do not constitute the combined CORE01 qualification receipt.
