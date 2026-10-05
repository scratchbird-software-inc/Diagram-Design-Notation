/* SPDX-License-Identifier: GPL-2.0-or-later. B1-071: extracted from tool.js — drawer/mode parameter model and URL parsing.
 * UMD: inlined into the single-file tool/viewer builds and required by node tests. */
(function (host) {
'use strict';
/* --- pure functions (unit tested in node) --- */

/* Phase 1 drawer split (2026-10 redesign): the old top `appearance` monolith is
 * now two right-side drawers — `style` (Style & Layout) and `document`
 * (Document). `appearance` remains accepted as a legacy alias of `style` in
 * ?drawers= and saved settings so existing links keep working. */
/* Phase 3 (2026-10 redesign): `inspector` joins as a right-side drawer —
 * selection opens it (and closes Document/Style & Layout), deselection returns
 * to Document. */
const DRAWERS = ['style', 'document', 'inspector', 'source', 'files', 'export', 'animation'];
const DRAWER_ALIASES = { appearance: 'style' };

/* B1-049: `api` = icon hidden and not user-openable, but openable by host code
 * via DDNTool.setDrawer — unlike `none`, which is unavailable to everyone.
 * The gear popup offers only GEAR_STATES (`api` is a host feature). */
const DRAWER_STATES = ['open', 'closed', 'none', 'api'];

const GEAR_STATES = ['open', 'closed', 'none'];

const STORAGE_KEY = 'ddn-tool-drawers';

/* D4: mode presets. toolbar=false hides the whole icon toolbar (embed use);
 * icons=false shows only the viewport controls. Explicit ?drawers= pairs and
 * saved localStorage settings override the preset drawer states. */
const MODES = {
  diagram: { toolbar: false, icons: false, drawers: { style: 'none', document: 'none', inspector: 'none', source: 'none', files: 'none', export: 'none', animation: 'none' } },
  view: { toolbar: true, icons: false, drawers: { style: 'none', document: 'none', inspector: 'none', source: 'none', files: 'none', export: 'none', animation: 'none' } },
  explore: { toolbar: true, icons: true, drawers: { style: 'closed', document: 'closed', inspector: 'closed', source: 'closed', files: 'closed', export: 'closed', animation: 'closed' } },
  edit: { toolbar: true, icons: true, drawers: { style: 'closed', document: 'closed', inspector: 'closed', source: 'open', files: 'closed', export: 'closed', animation: 'closed' } },
  /* B1-051 (D1): design mode — the designer IS the viewer with more
   * functionality. Everything from explore PLUS the editing affordances on by
   * default: source drawer open (like edit), the Document drawer open (nothing
   * is selected at boot, and deselection opens Document), drag-to-pin armed
   * (still toggleable), and the design bar visible (kind palette
   * click-to-place, connect-two-elements). Embeddable as
   * ?mode=design&toolbar=off + host I/O. */
  design: { toolbar: true, icons: true, drawers: { style: 'closed', document: 'open', inspector: 'closed', source: 'open', files: 'closed', export: 'closed', animation: 'closed' } }
};

const DEFAULT_MODE = 'explore';

function parseMode(v) { return Object.prototype.hasOwnProperty.call(MODES, v) ? v : null; }

/* D3: `?drawers=style:closed,source:none` — strict validation; malformed
 * pairs, unknown drawers and unknown states are ignored, never fatal. Legacy
 * drawer names resolve through DRAWER_ALIASES first. */
function parseDrawersParam(str) {
  const out = {};
  if (str == null || str === '') return out;
  for (const pair of String(str).split(',')) {
    const m = /^\s*([A-Za-z]+)\s*:\s*([A-Za-z]+)\s*$/.exec(pair);
    if (!m) continue;
    const name = DRAWER_ALIASES[m[1]] || m[1];
    if (!DRAWERS.includes(name) || !DRAWER_STATES.includes(m[2])) continue;
    out[name] = m[2];
  }
  return out;
}

/* A stored/localStorage drawer config is trusted only per validated pair. */
function cleanDrawerConfig(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const k of Object.keys(obj)) {
    const name = DRAWER_ALIASES[k] || k;
    if (DRAWERS.includes(name) && DRAWER_STATES.includes(obj[k])) out[name] = obj[k];
  }
  return out;
}

/* B1-049 (D2): `?toolbar=off` hides the whole icon toolbar WITHOUT changing
 * drawer availability (unlike mode=diagram, which also forces drawers none).
 * Only the exact value `off` counts; anything else is ignored. */
function parseToolbarParam(v) { return v != null && String(v).toLowerCase() === 'off' ? 'off' : null; }

/* Precedence (D3): preset (D4) < localStorage < URL param. `?toolbar=off`
 * beats the preset's toolbar:true but never touches drawer states. */
function resolveDrawerConfig(mode, stored, urlDrawers, urlToolbar) {
  const preset = MODES[parseMode(mode) || DEFAULT_MODE];
  const drawers = { ...preset.drawers, ...cleanDrawerConfig(stored), ...parseDrawersParam(urlDrawers) };
  const resolved = parseMode(mode) || DEFAULT_MODE;
  return { mode: resolved, toolbar: preset.toolbar && parseToolbarParam(urlToolbar) !== 'off', icons: preset.icons, drawers, design: resolved === 'design' };
}

const api = { DRAWERS, DRAWER_ALIASES, DRAWER_STATES, GEAR_STATES, STORAGE_KEY, MODES, DEFAULT_MODE, parseMode, parseDrawersParam, cleanDrawerConfig, parseToolbarParam, resolveDrawerConfig };
if (typeof module === 'object' && module.exports) module.exports = api;
host.DDNToolParams = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
