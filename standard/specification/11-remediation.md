# DDN 0.3 — Enterprise remediation contract

This edition uses the enterprise findings as acceptance inputs. The original input remains under `history/0.2-enterprise/`; the current disposition and exact tests are in `enterprise-review/review/FINDINGS.md` and `validation/0.3-regressions.json`.

## Software changes

ERP-DDN-001/002/021: native placement/routing replaces case-only geometry. Reserve object/field ports, separate tracks, avoid obstacles and validate labels. Unsafe pins/routes cannot be accepted as a clean diagram. Tree/mind-map are explicit algorithms; layered preserves directed cycles as SCC ranks.

ERP-DDN-003/004: validate semantic endpoint compatibility and registered extension contracts before layout. Unspecified sketch endpoints are deferred visibly, not silently certified. ERP nullable/type/key/join contracts have explicit diagnostics. Third-party unknown metadata is preserved-with-warning or rejected in strict mode.

ERP-DDN-005/009: render domain/type detail and recursive field structure with stable member identities. Hiding rows changes only appearance. Variants, presence and nullability remain distinct.

ERP-DDN-006/007/025: measure text, allocate content, validate final font/embedding size and reject page overflow in every implemented fit mode. Font estimates are declared. Unsupported pagination is rejected. The dense whole-model paper test remains a guard, not a desired print result.

ERP-DDN-008: use an explicit allowlist for publication. The source model is not silently destroyed to make a public picture. The UI/CLI/render API all call the same projection function.

ERP-DDN-020: validate explicit external/internal port bindings, direction and payload identity. A small declarative guard language supports bounded fixture traces with explicit branch/retry semantics. It does not turn the ERP process diagrams into deployed workflows.

## Business/operational findings become named assurance contracts

ERP-MOD-014 uses explicit field comparisons and enforcement roles. ERP-MOD-015 requires idempotency, pending/accepted/rejected/compensated states, timeout/recovery and reconciliation evidence. ERP-MOD-017 expresses uniqueness/non-overlap/immutability checks and gives fixture validators; physical database installation and race tests remain required.

ERP-APP-019 binds forms/reports to fields, commands, grains, cutoffs and controls without presenting wireframes as implemented applications. ERP-SEC-022 models independent custody obligations. ERP-POL-016, ERP-OPS-018, ERP-FIN-023 and ERP-REV-024 remain blocked pending authentic external policy, operational, algorithm and signoff evidence.

## Regression policy

A fix needs a failing-before/passing-after counterexample, a negative case, corpus regeneration and a recorded scope. Updating a screenshot alone is insufficient. Never change an expected failure into a pass by deleting the test or bypassing validation. Metric/font variations are distinct from look-only changes; compare geometry under the same font environment, and compare semantics independently.

Every current source uses version 0.3. Current generated outputs are rebuilt from those sources. Historic claims remain clearly labeled historic. Runtime capability enums, JSON schemas and website documentation are regenerated together. External approvals are never invented to make the findings count reach zero.

### Experimental interaction export boundary

The fixed-lane interaction extension rejects redacted SVG requests with `DDN-I032`; its occurrence/payload export closure is not implemented. It must not bypass a selected export policy. Ordinary graph SVG and JSON share the allowlist projection. This explicit boundary is covered by the session regression suite.
