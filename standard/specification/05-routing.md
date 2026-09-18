# DDN 0.3 — Native placement and routing contract

## Placement presets

| Algorithm | Executed behavior |
|---|---|
| grid | Variable-size rows/columns in selection order, with independent horizontal/vertical gaps. |
| manual | Supplied pins; remaining objects receive nonoverlapping automatic grid placement. |
| layered | Directed ranks, strongly connected components for cycles, deterministic barycentric sweeps; original edge directions are never reversed in the model. |
| tree | Explicit hierarchy with one parent per child; cycles/multiple parents fail. |
| mindmap | Two-sided root with alternating primary branches; otherwise a forest layout. |
| grouped | Groups by a declared property path, then places a grid in each group. The grouping does not create containment facts. |

Spacing values are preferences subject to minimum port/edge clearances. Hard pins cannot overlap. `direction` controls ranked orientation for layered layout and endpoint preference for grid/manual. Tree/mind-map use a horizontal branching arrangement in this edition; a renderer must not claim arbitrary orientation of those algorithms.

## Endpoint and route pipeline

Measure visible cards and rows → place nodes → reserve every field/object port stub → assign independent endpoint slots → route around inflated object boxes and prior callout envelopes → place callouts → validate the complete scene. A later edge cannot overwrite an earlier label or borrow an unrelated connector track.

The native router uses deterministic orthogonal candidates and bounded A* over an obstacle visibility grid. It penalizes bends/crossings and reserves independent lanes. It is not an optimality proof. Exhausted search or infeasible hard geometry returns a diagnostic; no invisible topology mutation is permitted. Rendering the same model, profile and metric environment is deterministic. A changed model may legitimately trigger a different layout; stable coordinates across arbitrary edits are not guaranteed.

## Crossing semantics

An unrelated crossing is not a connection. `gap`, rounded `bridge`, and `square_bridge` are visual crossing treatments. Endpoint semantics and model identities are unchanged. Rounded bridge geometry is a local exception to rectilinear segments. T contacts and shared independent trunks are rejected/avoided rather than drawn as accidental junctions. The reference does not implement arbitrary bus/network junction graphs; `shared_segments:declared` is explicitly rejected.

## Hints and diagnostics

`route {via:[...];source_side:east;target_side:west;callout:[...];}` supplies optional geometry. `route_policy:repair` emits DDN-LW02 and reroutes an unsafe hint. `strict` rejects it. Fields retain their endpoint identities when collapsed. Anchor fractions cannot override field endpoints.

DDN200–218 cover hierarchy, pins, port escape, bounded routing, independent lanes and quality failures. `quality:error` is the default; `warn` is an explicit exploratory output policy, not a conformance pass. `scene.quality` records the checks. The enterprise build additionally runs an independent Python geometry scan.

## Relationship labels

Numbered callouts are circles with ordinary digits; no circled-Unicode font dependence. Text/token modes use measured label boxes. Labels avoid objects, other labels, unrelated paths and reserved future ports. A full legend explains visible keys. Number scope is separate from sequence identity, and shared keysets preserve IDs across views.

## Publication

Post-layout bounds include object bodies, frames, routes and callouts. The legend is measured and space is reserved separately. A full enterprise graph is not silently scaled to unreadable paper. Use linked bounded views or a larger content-sized artboard. Automatic multi-sheet tiling remains an explicit future capability, not a silently accepted `fit` value.

## Curved route geometry

`routing:curved` adds checked cubic curves. `curve:bezier` prefers broad mind-map branches; `curve:rounded` softens corridor corners. The selection is independent of `algorithm` and `style.look`, and can be overridden on one relation. See [Curved relations](13-curved-relations.md) for syntax, endpoint tangents, crossing cuts/jumps, diagnostics and the scene-control contract. Crossing and label validation must use the resulting curve, not just the original rectangular route plan.


## Route efficiency and labels — 0.4.0-draft.2 correction

A crossing-free route is not necessarily an efficient route. Automatic endpoint
optimization MUST also consider excessive path stretch and label-generated
detours, even when the crossing counter is zero. The current bounded heuristic
identifies a non-self route for further trials when its length exceeds 1.8 times
its endpoint Manhattan distance plus 120 CSS units, or it required a label
corridor. This is a candidate-selection heuristic, not an error threshold and
not proof that every longer path is avoidable.

For unbound body attachments, try aligning a legal source/target fraction with
the opposite endpoint before trying alternative sides. Authored sides and
fractions remain constraints; a named field or port MUST NOT be replaced by a
free body anchor. Crossings and overall length/bend cost still determine whether
a trial is accepted. Node movement follows attachment trials rather than
substituting for a simple endpoint alignment.

A label that narrowly misses a short segment MUST NOT automatically move a
nearby connector to the centre of the complete graph. Try local corridors around
the related endpoints, score feasible alternatives by path length and bends,
and expand that local search only within a bounded budget. A hard waypoint route
that cannot accommodate its label is rejected instead of being rewritten.

Low-bend route candidates are incumbents: when their score is substantially
above the Manhattan lower bound, bounded visibility search may choose a much
shorter route with additional bends. Existing incumbent cost bounds prune the
search. Obstacles, independent tracks, labels, and mandatory endpoints remain
hard validity checks. This does not promise global minimum length or crossings.

Curved routes terminating at nonrectangular shapes are checked against the
owner's actual contour. Empty corners of an owner's rectangular bounding box
are not solid material. Unrelated shapes still use conservative obstacle
bounds; actual contour penetration is not allowed.

`npm run test:routing-efficiency` retains the reported purchasing-flow witness,
short-path assertions, fixed endpoints/waypoints, style variants, and alternating
barrier counterexamples. See `../release/ROUTING-FIX.md` and the machine-readable
report in `../release/validation/routing-efficiency.json`.
