# DDN 0.7.0 — endpoint-ordering replacement patch

This patch targets the runtime in **ddn-0.5-field-guide** (field-guide.1, previously
0.5.0-draft.1). It is built from that actual archive, not from an older companion.
It changes routing, not the authored business model or field order.

## Install by replacing files

1. Back up your extracted project directory and any edited standalone HTML files.
2. Extract the patch ZIP **into the existing directory containing `package.json`,
   `dist/`, `reference/`, and `field-guide/`**. Allow the files to be replaced.
   The patch archive has project-relative paths, not an additional project folder.
3. Close the old tab and reload the site (or hard refresh with Ctrl+Shift+R).
   Restart `npm run serve` if it was running. No npm dependency install is needed.
4. The public version is now `DDNLive.VERSION === "0.7.0"`.

`dist/ddn.global.js` is the deployable single-file library. `dist/ddn.mjs` imports
that same file; the declarations are beside it. The updated `reference/` and
`live/src/` files keep local rebuilds from bringing back the old router.

The patch also replaces the self-contained HTML pages inside this distribution.
They embed their own JavaScript and would otherwise continue to run the old code.
A standalone copy saved elsewhere is not updated by changing `dist/ddn.global.js`:
replace it with the updated `field-guide/portable.html` or Studio copy.

No existing `.ddn` source is replaced. Existing exported SVGs and earlier evidence
are not magically rerendered. Open the source and export again when a fresh SVG is
needed. Earlier validation records are historical; current patch evidence is in
`patches/endpoint-ordering/validation/`.

## Correction

The old initial slot allocator sorted incident relations by relation ID, not their
spatial approach. The later optimizer changed one endpoint at a time and could
finish with crossings that needed a local pair/order change.

The new allocator orders **free compatible slots** by the opposite endpoint's
spatial projection. A bounded local refinement evaluates actual routed crossings,
tries coupled slot permutations, and then legal side changes. It reroutes and
rechecks obstacles, independent tracks, labels, and final curved paths before
accepting a change. This pass runs before free-node movement and is repeated after
accepted node moves. It applies to source and destination endpoints and all sides.

**Distinct visible fields do not exchange rows.** In the reported accounting
case, `Journal Line.journal` and `Journal Line.account` remain those exact fields.
Their permitted attachment sides/approaches can change, rather than falsely
moving a journal reference onto the account row. Several edges referring to the
same field may exchange slots *within that same row*.

Authored sides, endpoint fractions, named ports, and waypoint entries are excluded
from incompatible permutations; explicit node pins stay fixed. Hidden fields keep
their original source identity. The optimizer is deterministic and bounded, not a
promise of zero crossings for every constrained graph.

## Optional policy (no source change is required)

The default is enabled. A view or reusable layout can declare:

```ddn
layout {
    endpoint_ordering: optimize;
}
```

`preserve` selects the previous stable-ID slot order and disables the new joint
refinement. It is **not** a freeze-all-layout command. `optimize: none;` disables
crossing refinement as before. Both modes still respect hard endpoint constraints.
There is no ambiguous `strict` value; hard constraints apply in both modes.

The equivalent public API option is:

```javascript
await diagram.setOptions({ endpointOrdering: "optimize" });
// "preserve" selects the legacy order; "source" follows the DDN policy.
```

Non-graph/data-bound and fixed-lane interaction projections reject this geometry
override rather than pretend to implement it.

## Verification and limits

Run `npm run test:endpoint-ordering` for the new regressions and
`npm run test:routing-efficiency` for the prior short-connector regression.
The patch retains the original source catalogue. The patch report records the
complete catalogue render exercise and the actual before/after browser witness.
Tests are not independent standards, business, or security certification.

Remaining routing warnings are not suppressed. When a field or authored route
prevents a proposed exchange, it remains constrained rather than being relabeled.
