# RFC 114 — Network/bus and rack profiles (`network.basic@1`, `network.rack@1`)

Status: proposed  
Authors/reviewers: to be assigned  
Language/registry impact: DDN 0.5 additive; profiles network.basic@1/network.rack@1; kinds network.bus/switch/server/rack; verb network.attaches; extension x_rack; 4 original glyphs; capabilities.json unsupported[] line removal (bus/junction-network drawing)

## Problem and motivating example

Small network overviews (a bus with attached devices) and rack elevations
are everyday infrastructure sketches (D1). The existing `graph` projection
can draw nodes and links, and the core vocabulary already has `network`,
`router`, `host` and `device` kinds — but nothing expresses a bus segment
with declared many-to-one attachments, switch/server kinds, or a rack with
numbered 1U slots.

Motivating example: a synthetic office network — one bus, one switch, two
servers, an uplink router — plus a 4U rack elevation. Users write
`projection { kind:graph; profile:"network.basic@1"; }` (or
`network.rack@1`). This is profile-level notation coverage, not a
network-management or cloud-provider notation.

## Proposed syntax

No grammar change (D2, verified: profiles, kinds, verbs, glyphs and
extensions are registry entries; `standard/grammar/ddn.ebnf` is untouched).

- Two new profiles, both bound to the existing projection `kind:graph`:
  - `network.basic@1` — bus segment with declared attachments;
    switch/server kinds; original DDN glyphs.
  - `network.rack@1` — rack frames with declared 1U slot numbers; devices
    pinned bottom-up.
- Four new profile kinds:
  - `network.bus` (silhouette `rect`, fallback `network`, family
    `deployment`, code `BUS`, glyph `network-bus`).
  - `network.switch` (silhouette `rect`, fallback `router`, family
    `deployment`, code `SWITCH`, glyph `network-switch`).
  - `network.server` (silhouette `rect`, fallback `host`, family
    `deployment`, code `SERVER`, glyph `network-server`).
  - `network.rack` (silhouette `rect`, fallback `device`, family
    `deployment`, code `RACK`, glyph `network-rack`).
- One new profile verb `network.attaches` (`name`/`verb` "attaches to",
  family `structural`, code `ATTACHES`, `start:'none'`, `end:'none'`,
  glyph `link`, `source:['*']`, `target:['*']`, `allow_self:false`,
  `member_endpoints:true` — attachment may target a bus or a port member).
- One new registered extension property `x_rack` on objects:
  `{ "type":"object", "properties":{ "units":{ "type":"integer", "minimum":1 }, "unit":{ "type":"integer", "minimum":1 } }, "additionalProperties":false }`
  (`units` on the rack = total U height; `unit` on a device = its lowest
  slot).
- Four new ORIGINAL glyphs in `standard/registry/glyph-library.svg`
  (`g-network-bus`, `g-network-switch`, `g-network-server`,
  `g-network-rack`) plus matching `glyphs` map entries in
  `standard/registry/catalogue.json` (D3). No vendor artwork.

```ddn
data m {
    object office_bus "Office bus" { kind: "network.bus"; }
    object core_switch "Core switch" { kind: "network.switch"; }
    object file_server "File server" { kind: "network.server";
        ports { port eth0 } }
    relation a1 "attaches to" @core_switch -> @office_bus { kind: "network.attaches"; }
    relation a2 "attaches to" @file_server.eth0 -> @office_bus { kind: "network.attaches"; }
}
view lan "Office LAN" {
    data: [@m];
    projection { kind: graph; profile: "network.basic@1"; }
    place @m.office_bus { size: [420px, 28px]; }
}
```

## Semantic normalization and identity effects

The bus is an ordinary node kind with declared attachment relations, NOT a
routing-geometry network (context: `DDN046` still rejects
`layout.junctions!=='explicit'` and `shared_segments!=='forbidden'`; this
RFC does not touch the routing junction machinery). Attachments are plain
declared relations; their TARGET endpoint names the bus (element-level) or a
port member on any element (`r.to.member` set).

Rejection behavior (D4):

- `DDN-PJ127` (NEW, error) — under either profile, a visible
  `network.attaches` relation whose TARGET endpoint is neither a
  `network.bus` element nor a port member; and under `network.rack@1`, a
  device whose `x_rack.unit` exceeds its rack frame's `x_rack.units`, or two
  devices in one rack frame declaring the same `unit`. The message names the
  relation/device and the rule broken.

Verified free before allocation:
`grep -rhoE "DDN-PJ127" notation/ standard/ website/examples/` prints nothing.

## Visual encoding and routing effects

Bus = a wide thin rect node (the author sizes it with
`place … { size:[w,h]; }`); attachments are plain edges (arrowhead `none`);
rack = a frame scoped to the `network.rack` object with devices as members,
stacked bottom-up via explicit `place` pins (D5). v1 does NOT reorder the
layout; exact 1U geometry is not claimed — the slot number is validated
metadata. No renderer change.

## Alternatives considered

- Implementing routing-level bus/junction geometry (D6) — rejected: the
  router deliberately forbids shared trunks (`DDN046`); the bus here is a
  declared node, not routing geometry.
- Vendored cloud icon sets (D6) — rejected: `NOTICE.md` forbids vendor
  artwork; original DDN glyphs only.
- Automatic rack stacking in the layout engine (D6) — rejected for v1:
  pinned placement is explicit and deterministic.

## Compatibility and migration

This change removes `native bus/junction-network drawing` from
`standard/registry/capabilities.json` `unsupported[]`. Routing-level
junction networks remain rejected (`DDN046`); the bus is a declared node
with attachment relations, not routing geometry.

Otherwise additive (D7): no existing profile, kind, verb, code, glyph or
capability line changes meaning. Published profiles are untouched. The
`DDN046` junction/shared-trunk guards are unchanged; the bus/junction
sentences in spec 05 and 13 stay, gaining only a pointer to spec 40.

## Security, privacy and accessibility

No computation beyond set membership and slot comparison — bounded, pure,
no I/O, no dynamic code. All four glyphs (`g-network-bus`,
`g-network-switch`, `g-network-server`, `g-network-rack`) are original DDN
line art drawn for this change (`stroke="currentColor"`, 24×24 viewBox);
no vendor logos, fonts or cloud-provider icon sets are introduced, in
compliance with `NOTICE.md` ("No vendor logos or font files are
distributed"). Node names remain visible as text, so meaning survives
monochrome rendering and text extraction; the glyphs are an additional,
not sole, carrier.

## Machine schema and diagnostic changes

- `standard/registry/glyph-library.svg` — four new `<symbol>` entries
  inside `<defs>`.
- `standard/registry/catalogue.json` — `glyphs` gains `network-bus`,
  `network-switch`, `network-server`, `network-rack` entries.
- `standard/registry/profiles/catalogue.json` — `kinds[]` gains the four
  kinds; `relationships[]` gains `network.attaches`; `profiles[]` gains
  `network.basic@1` and `network.rack@1`.
- `notation/runtime/ddn-profiles.js` `registry()` — extension contract
  `x_rack`; mirrored in `standard/registry/extensions.json` `contracts{}`.
- `notation/runtime/ddn-profile-quality.js` `validate()` — the
  `DDN-PJ127` attachment-target and rack-slot checks, guarded by
  `['network.basic@1','network.rack@1'].includes(profile)`.
- `standard/registry/capabilities.json` — `unsupported[]` loses the
  `native bus/junction-network drawing` line; `implemented[]` gains the
  network/rack line; `installedProfiles` +2.
- New diagnostic: `DDN-PJ127` (attachment target not a bus/port; rack slot
  out of range or duplicated).

## Positive and negative fixtures

- Positive: `website/examples/basics/54-network-diagram.ddn` — the `lan` view
  renders the bus bar with switch/server attachments (one via a port member)
  and no arrowheads; the `rack` view renders a rack frame with two servers
  pinned bottom-up in slots 1 and 3 of a 4U rack.
- Negative: `network.attaches` targeting a plain element (not a bus, no
  port member) → `DDN-PJ127`; device `x_rack:{unit:5}` in a
  `x_rack:{units:4}` rack → `DDN-PJ127`; two devices in one rack frame with
  the same `unit` → `DDN-PJ127`; `layout { junctions:auto; }` and
  `shared_segments:declared` still → `DDN046`.

## Implementation/conformance impact

- `notation/runtime/ddn-profiles.js` — `registry()` extension contract for
  `x_rack`.
- `notation/runtime/ddn-profile-quality.js` — `validate()` block for the
  two profiles.
- Suite `notation/tests/network-diagrams.js` (`test:network`) covers the
  fixtures above plus glyph registration and determinism.
- `npm --prefix notation run build:sdk` rebuilds `notation/dist/`.

## Open questions and decision record

Fixed decisions (recorded, not open): D1 motivation; D2 vocabulary (two
profiles on `graph`; kinds `network.bus`/`network.switch`/`network.server`/
`network.rack`; verb `network.attaches`; extension `x_rack`; 4 original
glyphs; no grammar change); D3 glyph artwork; D4 rejection behavior
(`DDN-PJ127`); D5 visual encoding (thin bus rect, plain attachment edges,
pinned rack stacking); D6 alternatives rejected; D7 compatibility
(additive except the single documented capabilities line). Exact 1U
geometric rendering, weight/power/thermal planning, vendor icon sets,
auto-discovery/topology scanning and routing-geometry junction networks
remain on the profiles' `unsupported` lists.
