/* SPDX-License-Identifier: GPL-2.0-or-later. B1-071: shared option definitions
 * for the unified tool and the (deprecated) viewer — fonts, routing values,
 * text/page floors and byte caps, previously duplicated across tool.js and
 * viewer.js. The runtime's own font stacks live in
 * notation/runtime/ddn-text.js (FONTS); a drift test in notation/tests/tool.js
 * asserts this table matches it.
 * UMD: inlined into the single-file builds by tools/build-tool.js /
 * tools/build-viewer.js and required by node tests. */
(function (host) {
'use strict';

/* Runtime font stacks (canonical: notation/runtime/ddn-text.js FONTS). */
const FONT_STACKS = {
  sans: 'DejaVu Sans, Arial, sans-serif',
  serif: 'DejaVu Serif, Georgia, serif',
  mono: 'DejaVu Sans Mono, monospace',
  handwriting: 'Comic Neue, Segoe Print, Bradley Hand, Comic Sans MS, cursive'
};
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24];
const ROUTING_VALUES = ['orthogonal', 'straight', 'curved', 'rounded'];
const CROSSING_VALUES = ['gap', 'bridge', 'square_bridge'];

/* B1-046 (D2): publication.minimum_text defaults to 8pt ≈ 10.67px. */
const MIN_TEXT_PX = 8 * 96 / 72;
/* B1-007: viewer/tool source-size cap. */
const MAX_FILE_BYTES = 50_000_000;
/* Raster export allocates a scale× canvas from the source-declared page size. */
const MAX_RASTER_PX = 16384;

const api = { FONT_STACKS, FONT_SIZES, ROUTING_VALUES, CROSSING_VALUES, MIN_TEXT_PX, MAX_FILE_BYTES, MAX_RASTER_PX };
if (typeof module === 'object' && module.exports) module.exports = api;
host.DDNOptions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
