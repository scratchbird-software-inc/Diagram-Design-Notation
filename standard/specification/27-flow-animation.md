# 27. Flow animation (motion markers, flow blocks, tool controls)

Status: implemented in runtime 0.7.0 (B1-033). Source grammar remains DDN
0.5; diagrams without motion properties render byte-identical SVG to previous
releases. Scope: graph-projection relations and view-level flow blocks. Other
projections (sequence, chart, geo, …) ignore motion properties.

## SMIL, not JavaScript (D1)

The renderer emits declarative SMIL — `<animateMotion>` markers travelling the
existing route paths and `<animate>` stroke/opacity pulses. The output is
deterministic: the same DDN source always yields the same animated SVG, so
golden-render tests are unaffected. Animated SVG works from `file://` and
animates autonomously when an exported file is opened directly; no script of
any kind is embedded.

## Relation motion properties (D2)

All seven are optional per relation and registered in
`standard/registry/data-properties.json` under the "Motion and flow animation"
group; invalid values raise `DDN-E014`.

| Property | Values | Default |
|---|---|---|
| `motion` | `flow` \| `pulse` \| `none` | `none` |
| `marker` | `circle` \| `square` \| `rect` | `circle` |
| `marker_size` | length, >0 and ≤128 px | 8 px |
| `marker_color` | colour string | relation colour |
| `rate` | integer 1–32 (markers in flight) | 1 |
| `speed` | length in px/s, >0 and ≤10000 | 60 px/s |
| `pulse_color` | colour string | accent |

`rate > 1` emits a staggered particle stream: markers share one
`<animateMotion>` duration and receive evenly distributed negative `begin`
offsets, which is the required behaviour for traffic-style diagrams.
`pulse` animates edge stroke colour and opacity along the route instead of a
travelling marker.

Scale honesty (D6): SVG+SMIL comfortably handles dozens of concurrent markers;
hundreds strain the DOM. `rate` is therefore capped at 32 per relation — larger
values warn (`DDN-W016`) and clamp at render time. A canvas renderer for
heavier traffic remains a roadmap possibility only.

## Flow blocks (D3)

A view-level `flow` block declares a step-traceable multi-hop sequence:

```ddn
flow trace "Order path" {
    steps: @model.client -> @model.service -> @model.orders;
    marker: square; marker_color: "#d40000"; speed: 90; rate: 2;
}
```

Steps reference declared elements. Each hop resolves to the existing visible
relation between consecutive elements, following the relation's declared
direction; a hop without one raises `DDN-E013`, as does a step that is not a
selected element. Multiple flows per view are allowed. A flow renders its own
marker travelling the concatenated hop route paths in one cycle: every hop
marker owns its hop's path and shares the flow cycle duration, confined to its
hop window by `keyTimes` and a discrete opacity animation, so the chain reads
as a single marker hopping element to element.

## Renderer contract (D4)

Markers carry stable hooks for controllers: motion groups are
`g.ddn-motion[data-relation][data-hop][data-hop-start][data-hop-end][data-dur]`;
flow groups are `g.ddn-flow.ddn-flow-<local>[data-flow][data-dur]` with per-hop
`g.ddn-flow-hop[data-hop][data-hop-start][data-hop-end]` children. Hop boundary
times are route-length/speed derived by the renderer and exposed on those
attributes. Export SVG (tool export and CLI render) includes animation by
default; the `--no-motion` CLI flag, the tool's "Include animation" export
toggle, and the `noMotion` render option strip animation for print/static
targets as a render option, never by text munging.

## Tool playback controls (D5)

The unified tool (`notation/tool/`) carries an Animation drawer — a first-class
drawer in the drawers configuration (open/closed/none, `?drawers=`, mode
presets) with an icon in the toolbar. The icon is hidden when the rendered
view contains no motion; the drawer then shows "No animation in this view".
Controls:

- start/stop via SMIL `pauseAnimations()`/`unpauseAnimations()`; default is
  playing and the pause choice is remembered in memory for the session only;
- step: pauses and advances the selected flow exactly one hop, or — for plain
  `motion` relations without flows — one full traversal of the longest route.
  Implemented by seeking with `setCurrentTime` to the route-length-derived hop
  boundaries read from the `data-hop` attributes;
- a speed multiplier (0.5×/1×/2×/4×) implemented by re-setting the SMIL `dur`
  attributes from cached base durations — chosen over `setCurrentTime` scaling
  because it survives re-renders and needs no per-frame controller loop; the
  playhead is not rescaled;
- a flow selector, shown when more than one flow exists.

## Accessibility and print (D8)

The tool respects `prefers-reduced-motion` by auto-pausing playback at load;
the user can still press Play, and that session choice then wins until reload.
Print and other static targets are served by the static `--no-motion` export.
