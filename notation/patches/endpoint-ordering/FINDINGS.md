# Endpoint-order patch findings

Author investigation and testing; no independent signoff is implied.

| ID | Disposition | Evidence / correction |
|---|---|---|
| PORT-001 | Scoped correction | Stable relation-ID ordering was not a geometric ordering policy. Free compatible slots now use remote geometry, followed by bounded paired refinement of checked routes. |
| PORT-002 | Semantic constraint preserved | The reported journal/account endpoints are different field rows. They are not swapped semantically; legal side changes remove their crossing. Same-field attachments may reorder only within that field row. |
| PORT-003 | Test expectation updated | The documentation-only integrity check required the runtime to remain byte-identical to 0.5 draft.1 and hard-coded that version. This code patch deliberately changes it. The check now requires agreement between the current SDK build digest, actual library, package version and guide metadata; original DDN-source identity checks remain. The first 10/12 result is retained under validation/history. |
| PORT-004 | Documentation numbering corrected | The field guide already used chapter 25; the endpoint-order policy is chapter 26. |
| PORT-005 | Residual limitation | Four sampled crossings remain in the browser accounting witness, and corpus warnings remain visible. No global minimal-crossing or universal layout certification is claimed. |

The old request-specific diagram source is unchanged. No relation endpoints,
column names or legend IDs were rewritten to make the test pass.
