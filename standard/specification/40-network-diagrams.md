# 40. Network/bus and rack profiles (`network.basic@1`, `network.rack@1`)

Status: implemented in runtime 0.6.0-beta.1, governed by RFC-114
(`standard/governance/rfcs/RFC-114-network.md`). Source grammar remains DDN
0.5; the profiles, kinds, verb, glyphs and extension property are registry
entries, so this chapter is a semantic addition, not a grammar change.

Small network overviews (a bus with attached devices) and rack elevations
are everyday infrastructure sketches. Both profiles run on the existing
`graph` projection. Users write
`projection { kind:graph; profile:"network.basic@1"; }` (or
`"network.rack@1"`). This is profile-level notation coverage, not a
network-management or cloud-provider notation.

## Metamodel

- `network.bus` — a bus segment (silhouette `rect`, fallback `network`,
  family `deployment`, code `BUS`, glyph `network-bus`). The bus is an
  ordinary node kind: the author sizes it (a wide thin rect) with
  `place … { size:[w,h]; }`.
- `network.switch` (silhouette `rect`, fallback `router`, family
  `deployment`, code `SWITCH`, glyph `network-switch`).
- `network.server` (silhouette `rect`, fallback `host`, family
  `deployment`, code `SERVER`, glyph `network-server`).
- `network.rack` (silhouette `rect`, fallback `device`, family
  `deployment`, code `RACK`, glyph `network-rack`).
- `network.attaches` — attachment verb ("attaches to", family
  `structural`, code `ATTACHES`, `start:'none'`, `end:'none'`,
  `source:['*']`, `target:['*']`, `allow_self:false`,
  `member_endpoints:true`). An attachment may target a bus element or a
  port member on any element.
- `x_rack` — registered extension on objects:
  `{ "type":"object", "properties":{ "units":{ "type":"integer", "minimum":1 }, "unit":{ "type":"integer", "minimum":1 } }, "additionalProperties":false }`.
  `units` on the rack is its total U height; `unit` on a device is its
  lowest slot. Malformed values are rejected by the schema contract
  (`DDN105`).

## The bus is a declared node, not routing geometry

This item deliberately does not touch the routing junction machinery. The
router still rejects `layout.junctions!=='explicit'` and
`shared_segments!=='forbidden'` (`DDN046`; spec 05, spec 13): arbitrary
routing-geometry bus/junction networks remain outside this release. The
bus here is an ordinary node with declared many-to-one `network.attaches`
relations — membership is declared data, not shared-trunk geometry. The
`capabilities.json` `unsupported[]` line `native bus/junction-network
drawing` was removed by RFC-114 for exactly this reason: the declared-node
form is now covered, while routing-geometry junction networks stay
rejected.

## The attachment rule (`DDN-PJ127`)

Under either profile, every visible `network.attaches` relation must
TARGET a `network.bus` element or a port member (`to.member` set).
Anything else — for example an element-level edge to a switch or server —
is rejected as `DDN-PJ127`; the message names the relation and the rule.

## The rack slot rule (`DDN-PJ127`)

Under `network.rack@1`, a rack is a view `frame` whose `scope` resolves to
a `network.rack` object and whose `members` are the mounted devices. Each
member device carrying `x_rack.unit` must declare a slot of at least 1 and
at most the rack's `x_rack.units`, and no two devices in one rack frame
may declare the same `unit`; violations are rejected as `DDN-PJ127`, the
message naming the device, the slot and the rule broken. v1 does not
reorder the layout: devices are stacked bottom-up with explicit `place`
pins, and exact 1U geometry is not claimed — the slot number is validated
metadata.

## Visual encoding

The bus is a wide thin rect node; attachments are plain edges (arrowhead
`none`); the rack frame encloses its member devices. No renderer change.

## Glyph provenance

All four glyphs (`g-network-bus`, `g-network-switch`, `g-network-server`,
`g-network-rack`) are original DDN line art drawn for this profile pack
(`stroke="currentColor"`, 24×24 viewBox), registered in
`standard/registry/glyph-library.svg` and mapped in
`standard/registry/catalogue.json`. No vendor logos, fonts or
cloud-provider icon sets are introduced, in compliance with `NOTICE.md`.

## Example

`examples/basics/54-network-diagram.ddn` — a synthetic office network: one
bus, one switch, two servers (each with an `eth0` port; the file server
attaches via `@m.file_server.eth0`) and an uplink router attached to the
switch's `wan` port, plus a 4U rack elevation with the two servers pinned
bottom-up in slots 1 and 3.
