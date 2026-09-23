/* SPDX-License-Identifier: GPL-2.0-or-later. B1-027 (D6): legacy tool URL mapper.
 * The three retired pages — /tools/viewer/index.html, /tools/studio/index.html,
 * /tools/studio/editor.html — are replaced by redirect stubs that forward to
 * the unified tool (/tools/index.html) preserving the parameters each old
 * page understood: src (viewer deep link), entry/view (gallery + editor boot),
 * plus mode/drawers when present. Malformed values are dropped, never fatal.
 * UMD: inlined into the stubs by website/build-site.mjs and required by tests. */
(function (host) {
'use strict';
function mapLegacyParams(search) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const out = new URLSearchParams();
  const src = params.get('src');
  if (src && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(src.trim()) && !src.trim().startsWith('/') && /\.ddn($|[?#])/i.test(src.trim()))
    out.set('src', src.trim());
  const entry = params.get('entry');
  if (entry && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(entry.trim())) out.set('entry', entry.trim());
  const view = params.get('view');
  if (view) out.set('view', view.trim());
  const mode = params.get('mode');
  if (['diagram', 'view', 'explore', 'edit'].includes(mode)) out.set('mode', mode);
  const drawers = params.get('drawers');
  if (drawers && /^[A-Za-z]+:(open|closed|none)(,[A-Za-z]+:(open|closed|none))*$/.test(drawers)) out.set('drawers', drawers);
  const q = out.toString();
  return q ? '?' + q : '';
}
const api = { mapLegacyParams };
if (typeof module === 'object' && module.exports) module.exports = api;
host.DDNRedirect = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
