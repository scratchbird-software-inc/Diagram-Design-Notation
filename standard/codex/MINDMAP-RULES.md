# Mind-map interaction and presentation correction

Owner direction, 24 October 2026. This correction governs `mindmap.basic@1` in
the unreleased `ddn-next-1` candidate and supersedes conflicting retained
pure-profile restrictions. It changes no source grammar, general default value,
public utility ABI or commercial/open-source boundary.

## Topics and links

A topic is a selected `domain`, `entity`, `object` or `term` definition in this
mind-map view. Membership is local to the view. Reusing the same definition in
another view does not change its role here. Repeated appearances do not create
additional semantic topics.

A relation joining two selected topics is an internal branch. It uses `assoc`,
has one source parent and one target child, and belongs to an acyclic tree with
one centre/root. A topic has at most one incoming selected relationship in total, including
external links. Two relations from the same parent still violate this limit.
External relations do not contribute to internal root or cycle counts, but an
external incoming link still counts against the single-incoming limit.

A relation with exactly one selected-topic endpoint is an external link.
It can display a non-topic context element or point to an element selected in
another view. Known DDN role, endpoint and member rules still apply; unknown
roles and invalid endpoints do not become legal merely by crossing a view.
A non-topic context item must be directly linked to a topic. A relation with
neither endpoint in the topic set is not a mind-map relation. An endpoint shown
only to display an external link does not automatically become a topic.

`profile-contracts.json` retains the compact internal palette and contracts.
Its `external_context_profile` and `external_relation_profile` references import
the existing `ddn@1` contracts for external links only. Runtime profile
descriptors expose the combined choices; verification applies the internal or
external rules according to the endpoints. These references are catalogue
metadata, not new source-language settings or executable modules.

## Attachment and layout

Topic attachment points are on the left or right edge. An incoming internal
branch uses one side; outgoing branches use the opposite side. The centre has
no incoming internal branch and may have outgoing branches on both sides.

The centre has one exception: an incoming link from a non-mind-map element may
attach at its top or bottom, using existing `route.target_side north` or `south`.
This applies only to the target endpoint of an external relation at the unique
internal root. Root outgoing links and all non-root topic attachments remain
horizontal. The root still has at most one incoming relationship in total.
Each occupied side distributes its attachments evenly, with distinct positions
ordered by their opposite endpoints so the branches remain distinguishable.

Internal branches are smooth curves without crossovers in automatic tree
layout. Subtrees occupy separate vertical bands. Existing relation-appearance
`route.source_side east` or `west` chooses a root branch side; omission keeps
the alternating automatic arrangement. Descendants continue outward.
File/CSS styling still applies where compatible with these profile rules.
An explicit incompatible attachment is invalid; the root exception above is
valid only for an incoming external link. If authored pins obstruct
noncrossing geometry, the renderer reports the conflict instead of claiming a
complete valid layout or switching to an unauthorized attachment.

Internal branches display no relation name, type, number or legend entry.
This includes authored labels and a view's numbered/token legend setting.
A pure mind map has no relationship legend. A mixed view can retain labels and
a legend for its external links only, subject to the normal legend controls.

## Designer selection controls

Selecting a topic in the designer shows small circular controls spaced equally
along the bottom of its body. They follow the topic during pan, zoom and resize.
Accessible names and keyboard operation accompany the symbols.

| Symbol | Action | Availability |
| --- | --- | --- |
| ⥆ | Add a linked child to the left | Centre, or incoming branch on the right |
| ⥅ | Add a linked child to the right | Centre, or incoming branch on the left |
| 🗑️ | Delete this element | Selected topic, under existing dependency/authority rules |
| 📝 | Edit name | Selected topic |
| 📓 | Add, edit or delete note | Selected topic |

Adding a child and its relation is one authorized source transaction and one
undo step. Root-side choice survives save/reopen. Editing preserves identities
and unrelated source. A generated compact-recipe root may be materialized into
the existing explicit view/element notation when an edit needs an independently
addressable source record; undo restores the original compact source.
These are editing controls, not diagram content: the read-only viewer and
exported snapshots omit them.

## Qualification

Tests must cover both directions, one-sided and two-sided roots, distinct equal
ports, dense and uneven subtree layouts, curves without crossings, suppression
of internal labels/legends, external typed links, the root incoming top/bottom exception, duplicate incoming branches,
cycles, every selection action, source/identity preservation, denied edits,
undo/redo, navigation transforms and export exclusion. Existing native and
complete/modular deliveries must exercise the same implementation.
