/* SPDX-License-Identifier: GPL-2.0-or-later. B1-071: extracted from tool.js — raster/SVG export helpers and animation hop timing.
 * UMD: inlined into the single-file tool/viewer builds and required by node tests. */
(function (host) {
'use strict';
const O = typeof module === 'object' && module.exports ? require('./options.js') : host.DDNOptions;
const MAX_RASTER_PX = O.MAX_RASTER_PX;

function rasterCanvasSize(w, h, scale) {
  const s = scale || 2;
  if (!(w > 0) || !(h > 0)) throw new Error('nothing rendered yet');
  const cw = Math.round(w * s), ch = Math.round(h * s);
  if (cw > MAX_RASTER_PX || ch > MAX_RASTER_PX)
    throw new Error('raster export refused: ' + cw + '×' + ch + ' px exceeds the ' + MAX_RASTER_PX + ' px per-side cap; the source declares a very large page');
  return { width: cw, height: ch };
}

/* SVG export string with the active CSS overrides embedded (viewer semantics):
 * an exported file looks like the screen, overrides and all. */
function exportSvgWithOverrides(svgText, css) {
  if (!svgText) throw new Error('nothing rendered yet');
  if (!css) return svgText;
  return svgText.replace(/<svg /, () => '<svg data-ddn-tool-export="presentation-overrides" ').replace(/(<svg[^>]*>)/, m => m + '<style>' + css + '</style>');
}

/* B1-033 (D5): animation controller pure parts.
 * hopWindowsFromMarkers reads the renderer's data-hop attributes
 * ([{hop, start, end}]) into sorted per-hop time windows — hop boundaries are
 * route-length/speed derived by the renderer and exposed on the markers. */
function hopWindowsFromMarkers(markers) {
  if (!Array.isArray(markers)) throw new Error('markers array required');
  const seen = new Map();
  for (const m of markers) {
    if (!m || !Number.isFinite(m.start) || !Number.isFinite(m.end) || !(m.end > m.start))
      throw new Error('invalid hop window: ' + JSON.stringify(m));
    if (!seen.has(m.hop)) seen.set(m.hop, { hop: m.hop, start: m.start, end: m.end });
  }
  return [...seen.values()].sort((a, b) => a.start - b.start || a.end - b.end);
}

/* nextHopTime: pausing mid-hop i advances to the END of hop i (the marker
 * arrives at the next element); exactly on a boundary advances one full hop;
 * past the last boundary wraps to the first. */
function nextHopTime(current, windows) {
  if (!windows.length) throw new Error('no hops to step through');
  const eps = 1e-6;
  for (const w of windows) if (w.end > current + eps) return w.end;
  return windows[0].end;
}

/* Speed multiplier re-times a base SMIL duration (documented D5 approach:
 * re-setting dur beats setCurrentTime scaling because it survives re-renders
 * and needs no per-frame controller loop). */
function scaledDuration(baseDur, multiplier) {
  if (!(baseDur > 0)) throw new Error('base duration must be positive');
  if (![0.5, 1, 2, 4].includes(multiplier)) throw new Error('speed multiplier must be 0.5, 1, 2 or 4');
  return baseDur / multiplier;
}

const api = { rasterCanvasSize, exportSvgWithOverrides, hopWindowsFromMarkers, nextHopTime, scaledDuration };
if (typeof module === 'object' && module.exports) module.exports = api;
host.DDNToolExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
