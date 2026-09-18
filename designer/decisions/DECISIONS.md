# Design decisions for approval

This is an author-proposed baseline. Independent user research and professional signoff are pending.

| ID | Decision | Reason | Alternative and cost |
|---|---|---|---|
| ADR-01 | Separate Designer route/application; keep Studio unchanged. | Visual construction and source editing serve different workflows. | Turning Studio into a large modal editor risks regressing source authoring. |
| ADR-02 | Use the DDN-native SVG and scene as the first interaction host. | Preserves all projection geometries and patched routing. | diagram-js is an optional evaluated interaction adapter; React Flow requires custom projection/port handling. |
| ADR-03 | One canonical source workspace and one history. | Cross-view identity and Git review remain reliable. | A parallel UI shape model requires complex and lossy synchronization. |
| ADR-04 | Three inspector scopes: Meaning, This view, Details. | Users see where changes apply; advanced properties remain discoverable. | One universal property list overwhelms and mixes semantics with appearance. |
| ADR-05 | Eight starter families plus profile-filtered exact-kind search. | Exposes tasks, not hundreds of equal-weight icons. | One generic shape silently erases semantic distinctions; hundreds of buttons impede discovery. |
| ADR-06 | Explicit create-drop pins; click Add leaves position free. | Distinguishes user position intent from automatic layout. | Automatically pinning every generated node defeats layout; ignoring drops frustrates users. |
| ADR-07 | Draft validation is separately typed, not global error suppression. | Users can build a process incrementally without weakening publication. | Strict-only construction blocks Start-before-End; permissive-only hides unsafe operations. |
| ADR-08 | Add existing, duplicate definition, copy representation and replica stay distinct. | A visual duplicate must not invent storage or authority. | Generic copy/paste without intent conflates model and view. |
| ADR-09 | Graph gestures are disabled on data-bound geometry. | Changing chart/date geometry can change facts. | Free dragging makes an attractive but false diagram. |
| ADR-10 | Production operations use prepared, revision-checked change plans. | Undo, imports, members and references remain atomic. | Calling several committing helpers creates partial failure and confusing history. |

Approval should record exact artifact hashes and accepted residual scope. Use `signoff-template.json`; do not prefill reviewer identities or approvals.
