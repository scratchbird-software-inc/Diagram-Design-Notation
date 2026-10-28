<!-- SPDX-License-Identifier: GPL-2.0-or-later -->

# DDN defaults

This package resolves the adopted `ddn-next-1` presentation contract. It retains
file settings above eligible CSS above versioned standards. File providers run
from declaring-file defaults through active-workarea defaults, view defaults,
shared definition and explicit occurrence. Included workarea settings do not
become another active provider. Invalid supplied values retain their diagnostics
and value; they do not silently fall back. Ineligible defaults are diagnosed and
do not supply semantic facts, identities, status or authority.

Records contribute leaves, including an explicit nullable value. Empty records
contribute no leaves. Lists replace whole, including an empty list. Resolution
copies supplied values and does not edit the normalized snapshot or source.

`resolveProperties` reads admitted `core::Style` definitions. A `kind: "css"`
record referenced by `style.sheets` stays in the CSS tier. A `kind: "defaults"`
record referenced by workarea/view `defaults` stays in that file tier. Each
attachment resolves unqualified references against its own declaring file.
Defaults references to another kind or unresolved target are diagnosed and
cannot supply a tier. A reusable provider contributes `content.rules`; its own
definition presentation defaults do not become recipient defaults.
View theme/typography inheritance considers the view's providers, independently
of sheets attached to its items. External file stylesheet locations remain a
host loading responsibility; callers pass parsed rules through `context.styles`.
Assets do not gain a `content.rules` field.

The selected view profile supplies the method selector context; the enclosing
workarea does not reclassify a foreign-method view. `src/method-names.ts` copies
only the exact IDs/slugs from the adopted `view-workarea-application.json` methods
table. Conformance tests bind its entries and source hash to that authority.

`DefaultSelector.subtype` accepts the canonical string-array ancestor lineage.
It matches an ordered prefix of the selected lineage; an empty prefix matches
any lineage. This interpretation follows the ordered lineage and ancestor
contract in incorporated `01-default-profiles.md` and
`2026-10-surface-contracts/defaults-and-css.md`. The existing scalar CSS subtype
hook matches a single ancestor. Scalar hooks are runtime selector inputs, not a
new normalized schema spelling.

`parseStylesheet` supplies optional `StyleRule.specificityTuple` metadata as
`[ID count, class/attribute count, type count]`. Resolution compares importance,
then this tuple, then source order. CSS importance never outranks file settings.
Typed rules without parser metadata derive counts from their registered selector
dimensions. Existing numeric `specificity` remains supported: score `s` maps to
`[floor(s/100), floor((s%100)/10), s%10]`, preserving numeric ordering and making
mixed comparisons deterministic. Parsed class counts never carry into an ID
count. Both metadata forms are runtime API fields, not additions to the canonical
Style schema. The parser accepts registered virtual hooks/custom properties;
it does not load resources or implement general DOM CSS.

The maintained `project/tests/CORE02/defaults*.test.mjs` vectors cover all eight
codex owners, all 151 selected profiles, provider scope, specificity, nullable
and collection semantics, exclusions and source isolation. Run against compiled
DDN packages with `DDN_BUILD_ROOT` pointing at the checkout's
`.work/builds/ddn`. Existing verification/profile-family suites retain the
conditional profile, paper, texture, symbol and surface regressions. These are
local resolver conformance tests, not rendering, service or native qualification.
