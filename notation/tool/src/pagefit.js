/* SPDX-License-Identifier: GPL-2.0-or-later. B1-071: extracted from tool.js — fit-scale math and DDN071 text/page pre-validation floors.
 * UMD: inlined into the single-file tool/viewer builds and required by node tests. */
(function (host) {
'use strict';
const O = typeof module === 'object' && module.exports ? require('./options.js') : host.DDNOptions;
const MIN_TEXT_PX = O.MIN_TEXT_PX;

/* Fit scale of an sw×sh SVG inside a cw×ch container (same semantics as the
 * B1-007 viewer): 'page' = min fit; 'width' = cw/sw; 'height' = ch/sh; '100' = 1. */
function computeFitScale(mode, cw, ch, sw, sh) {
  if (!(sw > 0) || !(sh > 0) || !(cw > 0) || !(ch > 0)) return 1;
  if (mode === 'width') return cw / sw;
  if (mode === 'height') return ch / sh;
  if (mode === 'page') return Math.min(cw / sw, ch / sh);
  if (mode === '100') return 1;
  throw new Error('unknown fit mode: ' + mode);
}

/* Read a profile quantity ({$quantity, unit} or plain number) as px. */
function quantityPx(v, dflt) {
  if (v == null) return dflt;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && Number.isFinite(v.$quantity)) {
    if (v.unit === 'pt') return v.$quantity * 96 / 72;
    if (v.unit == null || v.unit === 'px') return v.$quantity;
  }
  return dflt;
}

function smallestRolePx(baseFontPx) {
  const b = Number(baseFontPx);
  if (!Number.isFinite(b)) throw new Error('base font must be a number of px');
  return Math.min(11 * b / 16, 11);
}

function baseFontFloor(minTextPx) {
  const m = minTextPx == null ? MIN_TEXT_PX : Number(minTextPx);
  if (!Number.isFinite(m) || m <= 0) throw new Error('minimum text must be a positive number of px');
  return Math.max(1, Math.ceil(16 * m / 11 - 1e-9));
}

/* Friendly pre-render validation (D2): null when the base font is satisfiable,
 * else a message naming the implied minimum — the stage is never touched for
 * a preventable input error. */
function baseFontProblem(baseFontPx, minTextPx) {
  if (baseFontPx == null) return null;
  const m = minTextPx == null ? MIN_TEXT_PX : Number(minTextPx);
  const smallest = smallestRolePx(baseFontPx);
  if (smallest >= m) return null;
  return 'Base font ' + baseFontPx + 'px would make the smallest text ' + smallest.toFixed(2) +
    'px, below the ' + m.toFixed(2) + 'px minimum (DDN071) — use ≥' + baseFontFloor(m) +
    'px (or lower publication.minimum_text in the source)';
}

/* B1-052 (D5): the same pre-validation pattern for the Page/artboard controls.
 * With fit: contain the renderer scales the drawing down to the page; below a
 * drawing-specific artboard size the smallest text role falls under
 * publication.minimum_text and the render hard-fails DDN071 (ddn-render.js).
 * That failure is computable BEFORE rendering from the last scene's unscaled
 * drawing bounds plus its fixed chrome overhead (margins, legend reserve,
 * header/footer), so the tool can refuse the choice with a message naming the
 * smallest usable artboard — the stage keeps the last good picture undimmed.
 * pageDims mirrors the preset mapping in the component's apply() (api.js). */
function pageDims(page, width, height) {
  if (page == null || page === 'source' || page === 'content') return null; // fit: none — no down-scale, nothing to pre-check
  if (page === 'web') return { w: 1600, h: 1000 };
  if (page.startsWith('a4-')) {
    const a = 210 * 96 / 25.4, b = 297 * 96 / 25.4;
    return page.endsWith('portrait') ? { w: a, h: b } : { w: b, h: a };
  }
  if (page.startsWith('letter-')) {
    const a = 8.5 * 96, b = 11 * 96;
    return page.endsWith('portrait') ? { w: a, h: b } : { w: b, h: a };
  }
  if (page !== 'custom') throw new Error('unknown page preset: ' + page);
  return { w: width == null ? 1600 : Number(width), h: height == null ? 1000 : Number(height) };
}

/* Smallest fit scale that keeps the smallest text role at/above the minimum:
 * smallest final text = min(11·base/16, 11, relations ? 12 : ∞)·scale·embed. */
function pageScaleFloor(minTextPx, baseFontPx, hasRelations, embeddingScale) {
  const m = minTextPx == null ? MIN_TEXT_PX : Number(minTextPx);
  if (!Number.isFinite(m) || m <= 0) throw new Error('minimum text must be a positive number of px');
  const base = baseFontPx == null ? 16 : Number(baseFontPx); // style.font_size default
  const cap = Math.min(smallestRolePx(base), hasRelations ? 12 : Infinity);
  const embed = embeddingScale == null ? 1 : Number(embeddingScale);
  if (!(embed > 0)) throw new Error('embedding scale must be positive');
  return m / (cap * embed);
}

/* Friendly pre-render validation (D5): null when the artboard keeps every text
 * role at/above the minimum, else a message naming the smallest usable
 * artboard. ctx carries the last scene's geometry: contentW/contentH (unscaled
 * drawing bounds), chromeW/chromeH (page minus drawing area), plus the
 * publication inputs. No scene yet → null (the renderer's DDN071, whose
 * message names the same remedy, stays the backstop). */
function artboardProblem(pageW, pageH, ctx) {
  if (pageW == null || pageH == null) return null;
  if (!ctx || ctx.contentW == null || ctx.contentH == null || ctx.chromeW == null || ctx.chromeH == null) return null;
  const m = ctx.minTextPx == null ? MIN_TEXT_PX : Number(ctx.minTextPx);
  const scaleMin = pageScaleFloor(m, ctx.baseFontPx, ctx.hasRelations, ctx.embeddingScale);
  const minW = Math.ceil(ctx.contentW * scaleMin + ctx.chromeW - 1e-9);
  const minH = Math.ceil(ctx.contentH * scaleMin + ctx.chromeH - 1e-9);
  if (pageW >= minW && pageH >= minH) return null;
  const fit = Math.min(1, Math.max(0, (pageW - ctx.chromeW) / ctx.contentW), Math.max(0, (pageH - ctx.chromeH) / ctx.contentH));
  const textPx = m / scaleMin * fit; // cap·embed·fit — the smallest final text at this artboard
  return 'Artboard ' + Math.round(pageW) + '×' + Math.round(pageH) + 'px fits this drawing only at ' +
    (fit * 100).toFixed(0) + '% scale, shrinking the smallest text to ' + textPx.toFixed(2) +
    'px, below the ' + m.toFixed(2) + 'px minimum (DDN071) — smallest usable artboard for this drawing is ' +
    minW + '×' + minH + 'px (or enlarge the base font, reduce content, or lower publication.minimum_text in the source)';
}

const api = { computeFitScale, quantityPx, smallestRolePx, baseFontFloor, baseFontProblem, pageDims, pageScaleFloor, artboardProblem };
if (typeof module === 'object' && module.exports) module.exports = api;
host.DDNToolPagefit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
