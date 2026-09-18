# 26. Local endpoint ordering (DDN 0.5 routing patch)

Status: implemented bounded routing policy in runtime 0.5.0-draft.2. Source grammar
remains DDN 0.5; existing files need no rewrite. This chapter supplements chapters
on native layout, curved routes, and source-preserving placement.

## Invariants and compatibility groups

A semantic endpoint is an element, field, or named port identity. Its visual
attachment does not authorize a change of semantic identity. An ordering group is
an object occurrence plus side plus visible field-row identity (or the unbound body).
Attachments from different visible rows MUST NOT trade row identities. Free body
attachments and repeated connections to the same row MAY exchange compatible slots.
Hidden-member projections retain the hidden source IDs.

An explicit fraction or named port is not a free slot. Waypoint-authored endpoints
are not automatically permuted. An authored side constrains the side but, absent a
fraction/port/guide, does not necessarily freeze the order of free slots on it.
A pinned element constrains its world-space position; it does not implicitly freeze
all free attachments on that element. `place.size` is not a position pin.

## Policy

`layout.endpoint_ordering` accepts `optimize` (default) and `preserve`. The latter
retains the legacy stable-ID initial slot order and omits the coupled refinement;
other independently enabled layout/routing optimizers can still operate. An
`optimize:none` layout omits the new optimization as well. Unknown policy values
are errors. The API overlay `endpointOrdering` accepts `source`, `optimize`, or
`preserve` and cannot override data-bound or ordered-interaction coordinates.

## Procedure

1. Partition attachments by compatible side/row. Establish deterministic slots;
   order free slots by the opposite endpoint's row centre or object centre.
   Fixed entries keep their assignment.
2. Route using the existing obstacle, label, and endpoint checks. Evaluate the
   actual rendered path samples, not just endpoint-to-endpoint chords.
3. Identify crossing relations incident on a common element; prioritize crossings
   close to that element. Propose compatible pairwise permutations. For different
   rows, retain the rows and try legal side combinations instead.
4. Accept only a feasible reroute that improves the crossing/length criterion.
   The route-length increase per accepted trial is bounded, and cumulative length
   is bounded relative to the pass's input. No element moves during this pass.
5. Run this before permitted free-node moves; recheck after accepted node moves.
   Residual crossings retain their declared gap/jump representation and warning.

This local pass uses at most 32 trials for up to 16 relations, 12 for up to 48,
and 4 for up to 96; larger inputs retain geometric initial ordering but skip the
expensive paired pass. Each pass stops after at most eight improvement sweeps.
It is not a globally optimal port-assignment or minimum-crossing solver.

## Telemetry

`scene.layout.endpointOrdering` reports the selected policy, trial budget, trials,
accepted slot swaps/side changes, input/output crossing counts, local crossing
counts, length and segment-derived bend counts. A skipped stage or a budget limit
is not evidence of optimality. If node movement requires another pass, its prior
record is retained. Source model identities, legend keys, and original text are
unchanged by routing.

## Acceptance examples

The tests cover all four object sides; body and same-row permutation; different-row
and nested-field preservation; explicit fractions; named port sides; hard guides;
pins and retained free positions; invalid policy inputs; quantitative-policy guards;
actual paired swaps in the circular lab; and the Journal Line journal/account
crossing with curved, rounded, and angular routing. The purchasing `Complete`
connector's 140-unit short-route regression remains in force.

See `../patches/endpoint-ordering/validation/` for this patch's actual test results.
Earlier release reports remain historical evidence, not newly executed assertions.
