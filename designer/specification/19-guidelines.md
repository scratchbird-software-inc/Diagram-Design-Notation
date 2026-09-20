# Design guidelines and practical authoring walkthroughs

**DDN Designer specification 0.2.0-beta.1 — proposed; baseline audited 0.6.0-beta.1.**

## Twelve working guidelines
1. Ask what something **is** before asking how to draw it.
2. Keep name and relevant contents visible; move implementation details to progressive sections.
3. Offer a small contextual palette, but make every installed kind discoverable by search.
4. Show the write scope next to semantic edits, not only in documentation.
5. Keep shared definitions, visual occurrences and deployed copies visibly distinct.
6. Treat a connection as a typed statement, not an arbitrary line decoration.
7. Let automatic routing optimize legal visual anchors without exchanging field identities.
8. Treat a drag as one intention, one transaction and one undo step.
9. Let unfinished designs exist; do not invent facts to satisfy publication validation.
10. Change data-bound marks through their data or encoding controls, never by free placement.
11. Give every drag action a click and keyboard equivalent.
12. A successful SVG is evidence of rendering, not business correctness or independent approval.

## Walkthrough A — first data model
Choose Data model. Add Customer automatically. Name it and add customer_id/name/status in the Fields list; no datatype questions appear. Add Order by dragging; it is visibly pinned here. Add order_id/customer_id. Choose Connect on Order.customer_id, click Customer.customer_id, select References. The confirmation sentence identifies each field and leaves enforcement undecided. Switch This view to Names only; both endpoints still resolve to their fields. Add a second view using the same model and choose compact. Change Customer's display name once and observe both views.

## Walkthrough B — deployment without false containment
Open Model and reuse the table definition in a deployment view. Add a database service and a local/cloud location. Create an instance/copy only as an explicit modeled concept. Dragging a card into a location frame offers Move on canvas versus Set placement. The latter previews the placement relationship. Creating a replica requires a new copy plus replica relationship, not merely copying its appearance. The resulting namespace, placement and ownership paths are separately inspectable.

## Walkthrough C — process from blank
Choose Flowchart and insert Start. It is a draft with missing-path obligations, not an error that erases the item. Append Capture, Decision and End through typed connection gestures. A decision shows Add branch tasks. Enter Approved/Rejected guard labels; complete both paths. Review now passes the chosen structural profile. Add a document annotation without making it a process step. Change layout or label mode and confirm semantic source is unchanged.

## Walkthrough D — chart and matrix
Select a matrix cell and create an assignment. Its source owner is the chosen shared block. A companion graph gains the same relationship. Open a chart mark and edit its contributing record value; it changes the table and chart. A total instead opens a contributor list. Attempting to drag the bar presents “Edit value” rather than a pin. Add the chart to a panel by referencing its view, not copying records.

## Walkthrough E — review before a shared change
Select a table used in six views. Convert to View. The conversion preview retains fields, lists invalid storage assertions and affected profile views, and requires explicit disposition. Cancel leaves exact source bytes. Accept becomes one history entry with before/after source. If one projection cannot validate yet, the workspace remains a saved draft with an impacted-view status; strict publication is unavailable until resolved.

## Research interpretation
The guidelines adapt generic patterns demonstrated by draw.io, yEd, React Flow, diagram-js, JointJS, tldraw, Excalidraw and Penpot. They deliberately change those patterns where DDN's semantic reuse demands different behavior. No borrowed interaction convention permits a semantic shortcut that the model cannot represent.
