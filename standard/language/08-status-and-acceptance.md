# User-set status and acceptance

Current notation is consolidated in [the language reference](09-language-reference.md) under the owner's delegation. Its concrete syntax/interpretation choices supersede unresolved notation statements below; confirmed owner requirements and remaining semantic/default-codex work still apply.

## Status meanings

All four statuses are set by the user. The recorded status also selects the icon shown alongside the DDN type icon. Verification produces results and controls eligibility; it does not independently choose or advance the status.

| Status | Owner-defined meaning and requirements |
| --- | --- |
| Draft | Free-form design content |
| In-progress | Work under development; settings, information and data may still be missing |
| In-review | Complete and passes verification |
| Accepted | User-set acceptance with acceptance date, time and user recorded |

Accepted replaces the earlier Certified wording. In-progress and In-review are distinct statuses. Their icons remain to be designed.

Completeness is judged against the applicable catalogue/subtype and verification purpose. It does not mean that authors must explicitly write every defaulted presentation property or that every native conceptual ERD must become a deployment-ready database schema. Applicable versioned defaults can resolve omitted settings; missing required information cannot be fabricated by a default.

Draft freedom and permitted In-progress incompleteness must remain representable in the file. Diagnostics may describe missing or malformed information without converting a draft into a completed design or losing its free-form content.

## User actions and return paths

The normal lifecycle is Draft, In-progress, In-review and Accepted. The confirmed controls and constraints are:

- The designer's context menu changes status; the same setting drives the icon.
- Draft-to-In-progress remains the previously specified one-way conversion. No return to Draft is added by this clarification.
- Selecting In-review requires completeness and successful verification for the applicable content and rules. A failed check does not establish a valid In-review state.
- Setting Accepted records the acceptance date, time and user.
- An authorized user can return Accepted to either In-review or In-progress.
- A return to In-review still has to meet the In-review completeness and verification requirements. A return to In-progress permits missing information.

The Accepted return paths qualify the earlier one-way wording: it applies to leaving Draft, not to every subsequent lifecycle transition. Other transition shortcuts and the exact editing rules while in review/accepted are not established by this clarification.

The read-only viewer displays status, acceptance information and verification results. Status-changing actions belong to the designer/application. The meaning of authorized user must be implemented by the applicable local or commercial authority contract; a CSS setting, icon or recorded acceptance username cannot itself grant authorization. The standalone edition does not acquire a mandatory commercial identity server from this requirement.

## Required file information

The file contract must preserve the user-set status and, for Accepted, the acceptance date/time and accepting user. These are substantive file information, not transient badge paint. Exact property spellings and timestamp encoding remain part of the concise grammar and typed schema integration.

| Information | Requirement | Proposed model integration |
| --- | --- | --- |
| Current status | One of Draft, In-progress, In-review or Accepted; user-set | Extend/reconcile the existing design.state contract rather than introduce a second independently editable status |
| Acceptance date and time | Required when Accepted is set | An acceptance timestamp with an explicit offset or equivalent unambiguous representation; exact encoding to be finalized |
| Accepting user | Required when Accepted is set | A user reference/identifier in the acceptance record; identity representation to be finalized |
| Status icon | Determined by current status | Derived display mapping, not an independent authored property |

Acceptance metadata can be filled as part of the user's acceptance action; the requirement does not force the user to type the clock value manually. Record the actual accepting user and time, not a later file reader or export time.

Retaining earlier acceptance events after reopening, recording the user/time of the return action, and linking each acceptance to the accepted revision/scope are recommended integrations with the earlier acceptance-evidence proposal. They are not additional confirmed workflow requirements. Reopening must not display an old acceptance record as though the current status were still Accepted.

## Status and verification evidence

The earlier surface proposal described Accepted as a derived result. That is superseded: Accepted is a user-set lifecycle status with the required acceptance metadata. Verification results and the validity of any associated evidence remain separately computed information.

Passing verification does not automatically set In-review or Accepted. A later failing/stale result does not silently rewrite the stored user-set status. Report the discrepancy and apply the specified transition or editing policy. The later [inferred editing/history policy](09-language-reference.md#status-acceptance-and-authorization) selects explicit user reopening for protected semantic changes, retaining prior acceptance history. This is a delegated design choice, separate from the owner-defined status meanings.

A file declaring In-review while failing its completeness or verification requirements is inconsistent. Verification should diagnose that condition without treating the declaration itself as proof of success. Likewise, an Accepted declaration missing its required acceptance metadata is incomplete. Loading a file does not invent an acceptance action.

Status ownership and the scope of verification/acceptance must be explicit in the eventual schema. A status on one item does not silently set the status of every other item in the workarea. Drawing look, notes/table representation, type icons and the shaded-square cannot-fit indicator retain their own meanings.

## Integration

Update the language grammar, property reference codex, old draft/review enum, acceptance records and shared command/verification contract to reflect these four states. Preserve the existing client-side viewer/designer/verifier boundary. Existing generated schemas and planning checks describe an earlier baseline; the updated prose does not establish an implemented state machine.
