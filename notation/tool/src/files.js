/* SPDX-License-Identifier: GPL-2.0-or-later. B1-071: extracted from tool.js — entry/view picking, file plausibility, fresh ids, ?src= deep links and the import closure.
 * UMD: inlined into the single-file tool/viewer builds and required by node tests. */
(function (host) {
'use strict';
const O = typeof module === 'object' && module.exports ? require('./options.js') : host.DDNOptions;
const MAX_FILE_BYTES = O.MAX_FILE_BYTES;

/* B1-050 (D1): pick the entry file and view for setSource. opts.entry /
 * opts.view win; otherwise the first file (sorted) declaring a view, and its
 * first view. Coded DDN-T1xx errors; parseFn is injected (A.parse) so the
 * helper stays node-testable. */
function pickEntryView(files, opts, parseFn) {
  const toolError = (code, msg) => { const e = new Error(msg); e.code = code; return e; };
  opts = opts || {};
  if (typeof parseFn !== 'function') throw toolError('DDN-T100', 'parse function required');
  const names = Object.keys(files || {}).sort();
  if (!names.length) throw toolError('DDN-T101', 'setSource needs at least one source file');
  const viewsOf = name => {if(name.endsWith('.ddnn'))return [];const doc=parseFn(files[name],name),views=(doc.sections||[doc]).flatMap(s=>(s.declarations||[]).filter(n=>n.type==='view').map(n=>({...n,qualified:n.props?.uid||s.module+'::'+n.id})));return views.map(v=>({...v,id:views.filter(x=>x.id===v.id).length>1?v.qualified:v.id}));};
  if (opts.entry != null) {
    if (!Object.prototype.hasOwnProperty.call(files, opts.entry))
      throw toolError('DDN-T102', 'setSource: opts.entry "' + opts.entry + '" is not in the source map (' + names.join(', ') + ')');
    const views = viewsOf(opts.entry);
    if (!views.length) throw toolError('DDN-T103', 'setSource: entry "' + opts.entry + '" declares no view');
    if (opts.view != null && !views.some(v => (v.id === opts.view || v.qualified === opts.view)))
      throw toolError('DDN-T104', 'setSource: entry "' + opts.entry + '" has no view "' + opts.view + '" (has: ' + views.map(v => v.id).join(', ') + ')');
    return { entry: opts.entry, view: opts.view != null ? opts.view : views[0].id };
  }
  if (opts.view != null) {
    for (const name of names) if (viewsOf(name).some(v => (v.id === opts.view || v.qualified === opts.view))) return { entry: name, view: opts.view };
    throw toolError('DDN-T104', 'setSource: no file declares a view "' + opts.view + '"');
  }
  for (const name of names) {
    /* DDNA-OT-011: companion files are never entries — they are automation
     * companions, not diagram sources (explicit, not incidental to their
     * lacking views). */
    if (isCompanionFile(name, files[name])) continue;
    const views = viewsOf(name);
    if (views.length) return { entry: name, view: views[0].id };
  }
  throw toolError('DDN-T105', 'setSource: no view declaration found in the source');
}

/* Flatten ws.entries() into a picker list [{entry, view, label}]. */
function viewListFrom(entries) {
  if (!Array.isArray(entries)) throw new Error('entries array required');
  const out = [];
  for (const e of entries) for (const v of (e && e.views) || []) out.push({ entry: e.file, view: v.id, label: e.file + ' · ' + (v.name || v.id) });
  return out;
}

function isPlausibleSourceFile(f) {
  if (!f || typeof f.name !== 'string') return false;
  return /\.ddn(?:a|n)?($|\.)/i.test(f.name) || /\.(zip|json)$/i.test(f.name) || (typeof f.type === 'string' && f.type.startsWith('text/'));
}

/* B1-051 (D2): pick a fresh local identifier for a design-mode creation.
 * `taken` is any iterable of existing local ids (or uids — the tail after the
 * last '.' is compared too); the kind keyword is slugged into the base. */
function freshLocalId(taken, base) {
  const b = String(base || 'element').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'element';
  const used = new Set();
  for (const id of taken || []) { used.add(String(id)); used.add(String(id).split('.').pop()); }
  let candidate = 'new_' + b, n = 1;
  while (used.has(candidate)) candidate = 'new_' + b + '_' + (++n);
  return candidate;
}

/* `?src=<relative .ddn path>` deep link (B1-023 D1, reused per B1-027 D5).
 * Strictly relative: any scheme, scheme-relative host, or absolute path is
 * rejected — the tool only ever fetches siblings of its own page. */
function srcFromQuery(search) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const src = params.get('src');
  if (src == null) return null;
  const v = src.trim();
  if (!v) throw new Error('?src= is empty — give a relative path to a .ddn file');
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) throw new Error('?src= must be a relative path, not a URL with a scheme: ' + v);
  if (v.startsWith('//') || v.startsWith('/')) throw new Error('?src= must be a relative path (no host, no absolute path): ' + v);
  if (!/\.ddn$/i.test(v.split(/[?#]/)[0])) throw new Error('?src= must point at a .ddn source: ' + v);
  return v;
}

function srcFetchErrorMessage(err, protocol, src) {
  if (protocol === 'file:')
    return 'cannot fetch ' + src + ' — browsers block file:// page fetches. Serve the site over HTTP (npm run serve) or use Open / paste instead.';
  return err && err.message || 'fetch failed';
}

/* B1-026 import closure, reused for both ?src= deep links and ?entry= paths
 * that are not in the bundled catalogue (D5). Cycle-safe; every fetched text
 * is size-capped; failures name the missing file. */
function srcImportClosure(src, pageHref, fetchFn, parseImports, resolvePath) {
  const files = Object.create(null);
  const entryName = src.split('/').pop().split(/[?#]/)[0];
  const pull = (url, name) => fetchFn(url).then(r => {
    if (!r.ok) throw new Error(name + ' — HTTP ' + r.status + ' (' + url + ')');
    return r.text();
  }).then(text => {
    if (text.length > MAX_FILE_BYTES)
      throw new Error(name + ' is ' + Math.round(text.length / 1e6) + ' MB — the tool accepts sources up to ' + (MAX_FILE_BYTES / 1e6) + ' MB');
    if (Object.prototype.hasOwnProperty.call(files, name)) return null;
    files[name] = text;
    return Promise.all(parseImports(text, name).map(p =>
      pull(new URL(p, url), resolvePath(name, p))));
  });
  return pull(new URL(src, pageHref), entryName).then(() => ({ files, entryName }));
}

/* DDN 0.8 (ch. 57 §D2): the "New document" template picker. `templates` is the
 * build-inlined {name: source} map (content files under notation/tool/templates/);
 * `viewKinds` is the runtime's DDNViewProfiles.VIEW_KINDS table when reachable.
 * The blank document always leads; every template whose name matches a
 * registered view kind is labelled from the registry so the picker stays keyed
 * to chapter 52 as kinds are added. */
function templateList(templates, viewKinds) {
  const names = Object.keys(templates || {}).sort();
  const label = name => {
    if (name === 'blank') return 'Blank document — empty artboard';
    const kind = viewKinds && viewKinds[name];
    return name + (kind ? ' — view kind ' + name : ' — starter');
  };
  return names.map(name => ({ id: name, label: label(name) }));
}

/* DDN 0.8 (ch. 57 §D3): add-file naming convention — a kebab-case .ddn
 * sibling of the current (importing) file, first free name. */
function suggestFileName(currentFile, existingFiles) {
  const dir = String(currentFile || '').includes('/') ? String(currentFile).slice(0, String(currentFile).lastIndexOf('/')) : '';
  const has = (p) => !!(existingFiles && Object.prototype.hasOwnProperty.call(existingFiles, p));
  let base = 'new-module', name = (dir ? dir + '/' : '') + base + '.ddn', n = 2;
  while (has(name)) name = (dir ? dir + '/' : '') + base + '-' + (n++) + '.ddn';
  return name;
}

/* Module alias for an added file: its kebab-case basename as an identifier. */
function aliasForFile(path) {
  const base = String(path || '').split('/').pop().replace(/\.ddn$/i, '');
  return base.replace(/[^A-Za-z0-9_]/g, '_').replace(/^([0-9])/, '_$1') || 'added';
}

/* The `import "…" as …;` line a new file's importer should gain: path relative
 * to the importing file, per chapter 56 §X3. Returns null for bad input. */
function importLineFor(importerFile, newFile) {
  if (typeof importerFile !== 'string' || typeof newFile !== 'string' || !/\.ddn$/i.test(newFile)) return null;
  const from = importerFile.split('/').slice(0, -1), to = newFile.split('/');
  while (from.length && to.length && from[0] === to[0]) { from.shift(); to.shift(); }
  const rel = [...from.map(() => '..'), ...to].join('/');
  return 'import "' + rel + '" as ' + aliasForFile(newFile) + ';';
}

/* DDN 0.8 (ch. 56 §X4): normalize any diagnostic/error carrying a code into
 * the stable machine shape {code, severity, file?, line?, view?, message}.
 * line is 1-based, computed from an offset when the diagnostic does not carry
 * one; site-less diagnostics omit file/line rather than fabricating them. */
function stableDiagnostic(d, files, view) {
  if (!d || typeof d !== 'object') return { code: 'DDN-T100', severity: 'error', message: String(d) };
  const out = { code: d.code || 'DDN-T100', severity: d.severity || 'error' };
  const file = d.file !== undefined ? d.file : d.source;
  if (typeof file === 'string' && file) {
    out.file = file;
    const text = files && files[file];
    const offset = d.line !== undefined ? null : (d.offset !== undefined ? d.offset : d.start);
    if (text && typeof offset === 'number') {
      let line = 1;
      for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') line++;
      out.line = line;
    } else if (typeof d.line === 'number') out.line = d.line;
  }
  if (view) out.view = view;
  out.message = String(d.message !== undefined ? d.message : d);
  return out;
}

/* ------------------------------------------------------------------ *
 * DDNA Phase A (ddna ch.13 §13.2): companion detection and association
 * checks — tool-layer only (DDNA-OT-003: the runtime is untouched, dist
 * stays byte-identical). A companion is a plain DDN file named
 * *.ddna.ddn or carrying automation extension keys (x_profile / x_keel /
 * x_trace). Associations ride DDN's architecture containers (files: [...])
 * and x_link metadata (ddna ch.1 §1.4). Diagnostics are the §13.7 DDN-A###
 * family, surfaced through the tool's diagnostics drawer.
 * ------------------------------------------------------------------ */
function isCompanionFile(name, text) {
  if (/\.ddna(?:\.ddn)?$/.test(name)) return true;
  return /x_(profile|keel|trace)\s*:/.test(String(text || ''));
}
function normalizeWsPath(fromFile, p) {
  const dir = fromFile.includes('/') ? fromFile.slice(0, fromFile.lastIndexOf('/')) : '';
  const parts = [];
  for (const seg of (dir ? dir + '/' + p : p).split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop(); else parts.push(seg);
  }
  return parts.join('/');
}
/* companionFacts(text, parseFn): automation content counts from parse facts
 * (x_profile / x_keel / x_trace carriers anywhere in the declaration tree). */
function companionFacts(text, parseFn) {
  const facts = { profiles: 0, keels: 0, traces: 0, parseError: null };
  let doc = null;
  try { doc = parseFn(text, 'file'); } catch (e) { facts.parseError = e && e.message; return facts; }
  const walk = n => {
    const pr = n.props || {};
    if (pr.x_profile) facts.profiles++;
    if (pr.x_keel) facts.keels++;
    if (pr.x_trace) facts.traces++;
    for (const c of n.children || []) walk(c);
  };
  for (const d of doc.declarations || []) walk(d);
  return facts;
}
/* architectureContainers(files, parseFn): every container with normalized
 * base paths and its declaring file. */
function architectureContainers(files, parseFn) {
  const out = [];
  for (const [name, text] of Object.entries(files || {})) {
    let doc = null;
    try { doc = parseFn(text, name); } catch { continue; }
    for (const d of doc.declarations || []) {
      if (d.type !== 'architecture') continue;
      const list = Array.isArray(d.props && d.props.files) ? d.props.files : [];
      out.push({ file: name, id: d.id, bases: list.filter(f => typeof f === 'string').map(f => normalizeWsPath(name, f)) });
    }
  }
  return out;
}
/* servedBases(companionName, containers, files): the files whose containers
 * name the companion — the declaring file plus the container's other
 * existing bases. */
function servedBases(companion, containers, files) {
  const out = new Set();
  for (const c of containers) {
    if (!c.bases.includes(companion)) continue;
    out.add(c.file);
    for (const b of c.bases) if (b !== companion && Object.prototype.hasOwnProperty.call(files, b)) out.add(b);
  }
  return [...out].sort();
}
/* ddnaDiagnostics(files, parseFn): §13.7 association validity at load/save.
 * A001 association target unresolved (missing container file, orphan
 * companion, unresolved x_link in a companion, cross-base identity
 * collision per ddna ch.1 §1.5); A008 version coupling mismatch. */
function ddnaDiagnostics(files, parseFn) {
  const out = [];
  const names = Object.keys(files || {});
  if (!names.some(n => isCompanionFile(n, files[n]))) {
    /* No companions: still check containers for missing DDNA-named bases. */
  }
  const docs = {};
  for (const n of names) { try { docs[n] = parseFn(files[n], n); } catch { /* parse errors are reported by the core path */ } }
  const containers = architectureContainers(files, parseFn);
  /* Missing container targets (companions or bases). The runtime gates the
   * render with DDN-PJ216; the DDNA layer reports A001 at load. */
  for (const c of containers) for (const b of c.bases) {
    if (!Object.prototype.hasOwnProperty.call(files, b))
      out.push({ severity: 'error', code: 'DDN-A001', file: c.file,
        message: 'architecture ' + c.id + ' names ' + b + ' — the file is not in the workspace (missing base/companion); the association is unresolved' });
  }
  const companions = names.filter(n => isCompanionFile(n, files[n]));
  for (const comp of companions) {
    const served = servedBases(comp, containers, files);
    if (!served.length)
      out.push({ severity: 'error', code: 'DDN-A001', file: comp,
        message: 'ddna companion ' + comp + ' is not associated with any base — no architecture container names it (ddna ch.1 §1.4)' });
    /* §1.5 rule 1: no identity collision across the served bases. */
    if (served.length > 1) {
      const seenMod = new Map(), seenUid = new Map();
      for (const base of served) {
        const doc = docs[base];
        if (!doc) continue;
        if (seenMod.has(doc.module))
          out.push({ severity: 'error', code: 'DDN-A001', file: comp, message: 'companion ' + comp + ' serves bases with a duplicate module "' + doc.module + '" (' + seenMod.get(doc.module) + ', ' + base + ') — base identities must be unique across served bases (ddna ch.1 §1.5)' });
        else seenMod.set(doc.module, base);
        const walk = (n, path) => {
          const uid = doc.module + '::' + (path ? path + '.' : '') + n.id;
          if (seenUid.has(uid))
            out.push({ severity: 'error', code: 'DDN-A001', file: comp, message: 'companion ' + comp + ' serves bases with colliding identity ' + uid + ' (' + seenUid.get(uid) + ', ' + base + ') (ddna ch.1 §1.5)' });
          else seenUid.set(uid, base);
          for (const c of n.children || []) walk(c, (path ? path + '.' : '') + n.id);
        };
        for (const d of doc.declarations || []) if (d.type === 'data' || d.type === 'view' || d.type === 'architecture') walk(d, '');
      }
      /* §1.3 version coupling: the companion's recorded DDN version target
       * must match the served bases' header version. */
      const verOf = n => { const m2 = String(files[n] || '').match(/ddn\s+"([0-9.]+)"/); return m2 && m2[1]; };
      const cv = verOf(comp);
      for (const base of served) {
        const bv = verOf(base);
        if (cv && bv && cv !== bv)
          out.push({ severity: 'error', code: 'DDN-A008', file: comp, message: 'companion ' + comp + ' targets ddn ' + cv + ' but served base ' + base + ' is ddn ' + bv + ' (ddna ch.1 §1.3 version coupling)' });
      }
    }
    /* x_link associations inside companions: absent target file is the
     * graceful DDN-PJW07 path at the DDN layer plus A001 here; a present
     * file with an unresolvable target identity is A001 outright. */
    const doc = docs[comp];
    if (doc) {
      const walk = n => {
        const xl = n.props && n.props.x_link;
        if (xl && typeof xl.file === 'string' && typeof xl.target === 'string') {
          const q = normalizeWsPath(comp, xl.file);
          if (!Object.prototype.hasOwnProperty.call(files, q))
            out.push({ severity: 'error', code: 'DDN-A001', file: comp, message: 'x_link target file ' + q + ' is absent — the DDN layer marks it unresolved (DDN-PJW07), the DDNA association is broken' });
          else if (docs[q]) {
            const ids = new Set();
            const collect = (x, path) => { ids.add((path ? path + '.' : '') + x.id); for (const c of x.children || []) collect(c, (path ? path + '.' : '') + x.id); };
            for (const d2 of docs[q].declarations || []) collect(d2, '');
            if (!ids.has(xl.target))
              out.push({ severity: 'error', code: 'DDN-A001', file: comp, message: 'x_link target ' + xl.target + ' does not resolve in ' + q + ' — the base identity is missing' });
          }
        }
        for (const c of n.children || []) walk(c);
      };
      for (const d of doc.declarations || []) walk(d);
    }
  }
  return out;
}

const api = { pickEntryView, viewListFrom, isPlausibleSourceFile, freshLocalId, srcFromQuery, srcFetchErrorMessage, srcImportClosure,
  templateList, suggestFileName, aliasForFile, importLineFor, stableDiagnostic,
  isCompanionFile, normalizeWsPath, companionFacts, architectureContainers, servedBases, ddnaDiagnostics };
if (typeof module === 'object' && module.exports) module.exports = api;
host.DDNToolFiles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
