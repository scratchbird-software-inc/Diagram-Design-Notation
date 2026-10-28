# Headless staged verifier

SPDX-License-Identifier: GPL-2.0-or-later

`createVerifier` implements the adopted utility ABI: `verifySources`, `verifyModel`,
`checkTransition`, and `destroy`. The requested level and purpose remain explicit.
Conceptual design permits the established unnamed/name-only forms; draft bodies and
purpose-specific completeness requirements remain separate from structural validity.
No renderer, network service, DOM, source executable code, or new rule package is
required.

The verifier owns copies of registered metadata and request data before asynchronous
work. Callback code remains trusted host-supplied code. Callbacks receive immutable
snapshots and options; cancellation remains live. Source IDs are canonicalized once,
provided UTF-8 bytes must agree with text (including the admitted external leading
BOM representation), and caller objects are not frozen or mutated. Bounded model
capture precedes recursive copying and contributes to operation work accounting.
Cancellation or destruction during an awaited callback prevents a complete report;
destroying an instance also discards both caches.

Verification starts at the active entry and follows explicit includes. Supplied
unincluded files do not contribute file-owned schema/profile errors, consume the
active schema diagnostic cap, or become lifecycle targets. Saturating the 200-issue
reachable-schema cap returns an explicit budget-exceeded report before scope
filtering; truncated diagnostics can never prove a selected scope valid. Rules receive a derived
snapshot containing the reachable file closure, with its own matching semantic
fingerprint, the original revision/version vector, and reachable checked references.
The original provider scope, completeness and unavailable evidence are retained;
a partial provider is never promoted to complete. The final report and conservative
cache keys bind the original supplied snapshot. Callback dependency fingerprints
therefore describe the callback snapshot; the verifier does not reinterpret them as
a second universal digest format.

Trusted rule outputs are checked for outcome, diagnostics, exact invocation scope,
resolving checked/dependency references and honest completeness. Diagnostic source
spans must name a reachable current source revision. Dynamic reads may extend the
selected dependency closure. Newly discovered views receive their required rules
under an appropriate view scope, and structural/purpose checks cover that closure.
A rule declaration alone cannot satisfy a required rule that was skipped at the
requested level/purpose or failed to check its required view. Duplicate profiles,
rules and collisions with the existing built-in rule identities fail admission.

The two bounded caches retain at most 128 reports and 128 rule results. Whole-report
keys include root, source revisions, provider coverage, scope and measurement data.
Semantic rule reuse conservatively binds the full supplied semantic model, model/data
revisions, provider coverage, requested scope/stage/purpose, versions and registry.
Comment-only source changes can reuse safe results while structural and pinned
reference checks run again. Explicit source/revision reads and raw diagnostic spans
force rule execution; source diagnostics derived from targets are attached to the
current CST and revision after verification. This implements safe conservative reuse,
not a claim of minimal per-field invalidation. Rules must declare their reads; trusted
callbacks that consume undeclared host state are outside the deterministic contract.

Publication evidence must have a nonempty fingerprint and font generation, finite JSON
measurements, matching revision/version, exact requested scope and complete coverage
of the checked dependency closure. The fingerprint is an opaque evidence identity at
this boundary; projection-specific metric equations remain with their consumer.
Verification does not manufacture measurements or qualify a publication adapter.

Lifecycle checks preserve the adopted transition matrix and only admit definitions,
views, documents and the active workarea as owners. Even no-op transitions require
resolving owners and valid states. Review/acceptance transitions recheck the current
model, rule versions, report scope/coverage and grants. Acceptance also requires the
specified attribution event. Eligibility is returned without mutating model status or
creating an acceptance record.

VERIFY01 engine tests live in `project/tests/VERIFY01/engine.test.mjs`; the task also
has independently owned lifecycle/scope and utility/worker vectors. This package's
headless verification evidence does not qualify browser rendering, designer behavior,
external domain adapters, services, or a complete product release.
