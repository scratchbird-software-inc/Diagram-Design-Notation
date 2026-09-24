#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later
 * B1-030: generate DDN-AI-REFERENCE.md from the pinned release sources.
 *
 * Hand-authored prose lives in tools/ai-reference-core.md with `<!-- @gen:NAME -->`
 * placeholders. Everything under a placeholder is derived HERE from
 * standard/registry/*.json + notation/runtime sources (never hand-maintained):
 * vocabulary counts, property whitelists (the real DDN.PROPERTIES keyword list),
 * resolved defaults, enums, projection kinds + per-kind supported keys, the full
 * vocabulary tables, the diagnostic-code table, and the grammar appendix.
 *
 * Every ```ddn fenced block in the assembled document is executed against the
 * reference CLI (check AND render, every declared view); the build fails if any
 * example fails.
 *
 * Usage: node tools/build-ai-reference.mjs [outputPath] [--no-validate]
 *   default output: ../kimi-DDN-workarea/DDN-AI-REFERENCE.md (workarea, gitignored)
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const readJSON = p => JSON.parse(read(p));

/* ---------- source extraction helpers ---------- */

function evalConst(src, name) {
  const at = src.indexOf('const ' + name + '=');
  if (at < 0) throw new Error('const ' + name + ' not found');
  let i = src.indexOf('=', at) + 1;
  while (/\s/.test(src[i])) i++;
  const open = src[i], close = open === '{' ? '}' : open === '[' ? ']' : null;
  if (!close) throw new Error('const ' + name + ' is not an object/array literal');
  let depth = 0, j = i, quote = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (quote) { if (c === '\\') j++; else if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) break;
  }
  return { literal: src.slice(i, j + 1), start: at, end: j + 1 };
}

function evalData(src, name) {
  return new Function('return (' + evalConst(src, name).literal + ')')();
}

/* ---------- load sources ---------- */

function loadSources() {
  const capabilities = readJSON('standard/registry/capabilities.json');
  const catalogue = readJSON('standard/registry/catalogue.json');
  const profilesCatalogue = readJSON('standard/registry/profiles/catalogue.json');
  const dataProperties = readJSON('standard/registry/data-properties.json');
  const grammar = read('standard/grammar/ddn.ebnf');
  const coreSrc = read('notation/runtime/ddn-core.js');
  const projDataSrc = read('notation/runtime/ddn-projection-data.js');
  const PROPERTIES = evalData(coreSrc, 'PROPERTIES');
  const CHOICES = evalData(coreSrc, 'CHOICES');
  const DEFAULTS = evalData(coreSrc, 'DEFAULTS');
  const commonLit = evalConst(projDataSrc, 'common').literal;
  const supportedLit = evalConst(projDataSrc, 'supported').literal;
  const { supported: projectionSupported } = new Function(
    'const common=' + commonLit + ';const supported=' + supportedLit + ';return {supported};')();
  const version = capabilities.version;
  return { capabilities, catalogue, profilesCatalogue, dataProperties, grammar,
    PROPERTIES, CHOICES, DEFAULTS, projectionSupported, version };
}

/* ---------- diagnostics extraction (runtime + Studio src) ---------- */

function extractDiagnostics() {
  const dirs = ['notation/runtime', 'notation/studio/src'];
  const files = [];
  for (const d of dirs)
    for (const f of fs.readdirSync(path.join(root, d)).sort())
      if (f.endsWith('.js')) files.push({ rel: d.replace('notation/', '') + '/' + f, abs: path.join(root, d, f) });
  const codes = new Map(); // code -> {severity:Set, files:Set, messages:Set}
  const CODE = '(?:DDN|LIVE)[A-Z0-9]*-?[A-Z]*[0-9]{2,3}';
  const patterns = [
    new RegExp("DDNError\\(\\s*'(" + CODE + ")'\\s*,", 'g'),
    new RegExp("code:\\s*'(" + CODE + ")'", 'g'),
    new RegExp("fail\\(\\s*'(" + CODE + ")'\\s*,", 'g'),
  ];
  const literalsIn = expr => {
    const out = [];
    for (const m of expr.matchAll(/'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/gs)) {
      const pre = expr.slice(Math.max(0, m.index - 24), m.index);
      if (/(failure|code|record|field|view|entry|severity)\s*:\s*$/.test(pre)) continue; // diagnostic payload keys, not prose
      const s = (m[1] !== undefined ? m[1] : m[2]).replace(/\\'/g, "'").replace(/\s+/g, ' ');
      if (s.trim().length > 2) out.push(s);
    }
    return out;
  };  for (const f of files) {
    const src = fs.readFileSync(f.abs, 'utf8');
    for (const re of patterns) {
      for (const m of src.matchAll(re)) {
        const code = m[1];
        const window = src.slice(m.index, m.index + 600);
        const cut = window.search(/[;\n]\s*(const|let|var|function|if|for|return|}|$)/m);
        const expr = window.slice(0, cut > 40 ? cut : 400);
        const message = literalsIn(expr).filter(s => s.trim() !== code).join('').trim();
        const near = src.slice(Math.max(0, m.index - 160), m.index + 160);
        let severity = 'error';
        if (/severity:'warning'/.test(near) || /-W\d|PJW|LW\d|TW\d|CW\d|^DDN-W/.test(code)) severity = 'warning/info';
        else if (/severity:'info'/.test(near)) severity = 'info';
        if (!codes.has(code)) codes.set(code, { severity: new Set(), files: new Set(), messages: new Set() });
        const c = codes.get(code);
        c.severity.add(severity);
        c.files.add(f.rel);
        if (message) c.messages.add(message);
      }
    }
  }
  return [...codes.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, c]) => ({
    code,
    severity: c.severity.has('error') ? 'error' : [...c.severity][0],
    files: [...c.files].sort(),
    message: [...c.messages].sort().join('<br>').replace(/\|/g, '\\|') || '(no literal message)',
  }));
}

/* ---------- generated sections ---------- */

const wrap = (name, body) =>
  '<!-- generated: do not edit (' + name + ') -->\n' + body.trim() + '\n<!-- /generated (' + name + ') -->';

const jsonBlock = obj => '```json\n' + JSON.stringify(obj, null, 1) + '\n```';
const joinList = (a, sep) => (a && a.length ? a.join(sep || ', ') : '-');
const yn = b => (b ? 'yes' : 'no');
const cell = s => String(s === undefined || s === null || s === '' ? '-' : s).replace(/\|/g, '\\|');

function table(headers, rows) {
  return '| ' + headers.join(' | ') + ' |\n|' + headers.map(() => '---').join('|') + '|\n' +
    rows.map(r => '| ' + r.map(cell).join(' | ') + ' |').join('\n');
}

function genCounts(S, diagnostics) {
  const coreKinds = S.catalogue.kinds.length, profKinds = S.profilesCatalogue.kinds.length;
  const coreRels = S.catalogue.relationships.length, profRels = S.profilesCatalogue.relationships.length;
  const projKinds = S.CHOICES.projection.kind;
  return wrap('counts', '**Vocabulary counts (generated from the registries + runtime sources):**\n' +
    '- Object kinds: **' + (coreKinds + profKinds) + ' total** = ' + coreKinds + ' core (`registry/catalogue.json .kinds`) + ' + profKinds + ' profile (`registry/profiles/catalogue.json .kinds`)\n' +
    '- Relationships (verbs): **' + (coreRels + profRels) + ' total** = ' + coreRels + ' core + ' + profRels + ' profile\n' +
    '- Diagram profiles: **' + S.profilesCatalogue.profiles.length + '** (`profiles/catalogue.json .profiles`)\n' +
    '- Projection kinds: **' + projKinds.length + '** (' + projKinds.map(k => '`' + k + '`').join(', ') + ')\n' +
    '- Endpoint marks: ' + S.catalogue.endpoints.length + '; object families: ' + Object.keys(S.catalogue.families).length +
    '; relation families: ' + Object.keys(S.catalogue.relationship_families).length +
    '; facets: ' + S.catalogue.facets.length + '; view types: ' + S.catalogue.view_types.length +
    '; registered data properties: ' + S.dataProperties.properties.length + '\n' +
    '- Diagnostic codes: **' + diagnostics.length + '** extracted from the runtime (reference runtime + Studio `src/`)');
}

function genProperties(S) {
  return wrap('properties',
    '### 3.4 Full property key whitelist per declaration type (from `DDN.PROPERTIES` in `notation/runtime/ddn-core.js`; unknown keys → DDN033; `x_*` always allowed)\n\n' +
    jsonBlock(S.PROPERTIES));
}

function genDefaults(S) {
  return wrap('defaults',
    '### 3.5 Resolved-profile defaults (from `DDN.DEFAULTS`; every view resolves to this full set, overridden per the resolution order above)\n\n' +
    jsonBlock(S.DEFAULTS));
}

function genEnums(S) {
  return wrap('enums',
    '### 3.6 Enumerated values (from `DDN.CHOICES`; anything else → DDN046)\n\n' +
    jsonBlock(S.CHOICES));
}

function genVocabulary(S) {
  const cat = S.catalogue, pc = S.profilesCatalogue;
  const out = [];
  out.push('## 4. Complete vocabulary (machine-extracted)\n\n' +
    'Every value below was extracted programmatically from `standard/registry/catalogue.json` (version ' + cat.version +
    ') and `standard/registry/profiles/catalogue.json` (runtime ' + S.version + '). Use these EXACT keywords. ' +
    'Aliases and lowercase registry codes are also accepted by the resolver (`DDN.kindEntry`/`DDN.relationEntry` match keyword, lowercase code, or alias).');

  out.push('### 4.1 Core object kinds (' + cat.kinds.length + ')\n\n' +
    '`shape` is the registered default presentation (card = rectangular card; activity = rounded card; frame; note = folded annotation; sample = grid; port; cylinder etc.). `defaults` is the registry\'s documentation-only per-kind default property object: the renderer NEVER applies it implicitly; authoring tools merge it before explicit properties (explicit wins) and write it into source.\n\n' +
    table(['keyword', 'name', 'shape', 'family', 'aliases', 'defaults'],
      cat.kinds.map(k => [k.keyword, k.name, k.shape, k.family, joinList(k.aliases), JSON.stringify(k.defaults || {})])));

  out.push('### 4.2 Profile object kinds (' + pc.kinds.length + ')\n\n' +
    table(['keyword', 'name', 'silhouette', 'core fallback', 'family', 'code'],
      pc.kinds.map(k => [k.keyword, k.name, k.silhouette, k.fallback, k.family, k.code])));

  out.push('### 4.3 Core relationships / verbs (' + cat.relationships.length + ')\n\n' +
    '`pattern` is the SVG dash array (`""` = solid). `start`/`end` are default endpoint marks. `self`=allow_self, `member endpoints`=whether field/port-level endpoints are allowed (`member_endpoints: false` → object endpoints only, DDN102). Source/target columns list the endpoint-contract allowed kind keywords (`*` = any). Endpoint violations → DDN102 (or DDN-W102 for unspecified `object` kinds in non-strict modes). Unknown verb → DDN056.\n\n' +
    'Direction note: governance verbs `reports_to` and profile verb `analysis.decomposes` are parent→child (manager→report, deliverable→part) despite their English keyword reading; tree layouts root at the node with no incoming edge of that kind.\n\n' +
    table(['keyword', 'verb', 'family', 'pattern', 'start', 'end', 'source kinds', 'target kinds', 'self', 'member endpoints'],
      cat.relationships.map(r => [r.keyword, r.name, r.family, JSON.stringify(r.pattern || ''), r.start, r.end,
        joinList(r.endpoint_contract.source), joinList(r.endpoint_contract.target),
        yn(r.endpoint_contract.allow_self), yn(r.endpoint_contract.member_endpoints)])));

  out.push('### 4.4 Profile relationships / verbs (' + pc.relationships.length + ')\n\n' +
    table(['keyword', 'verb', 'family', 'start', 'end', 'source kinds', 'target kinds', 'self', 'member endpoints'],
      pc.relationships.map(r => [r.keyword, r.verb || r.name, r.family, r.start, r.end,
        joinList(r.source), joinList(r.target), yn(r.allow_self), yn(r.member_endpoints)])));

  out.push('### 4.5 Diagram profiles (' + pc.profiles.length + ')\n\n' +
    'A profile is selected in a view\'s projection: `projection { kind: graph; profile: "c4.container@1"; }`. `kind` MUST equal the profile\'s registered projection (DDN-PF002); unknown profile → DDN-PF001. Per-profile enforced rules are in section 6.\n\n' +
    table(['profile id', 'projection', 'diagram families', 'scope', 'validation', 'unsupported'],
      pc.profiles.map(p => [p.id, p.projection, joinList(p.diagramFamilies), p.scope,
        joinList(p.validation, '; '), joinList(p.unsupported, '; ')])));

  out.push('### 4.6 Endpoint marks (' + cat.endpoints.length + '; set via `source_mark:` / `target_mark:` on relations)\n\n' +
    'Structural participation marks (`one`, `zeroone`, `many`, `zeromany`, `diamond`, `triangle`) are allowed only on `structural`-family relations (DDN114). Unknown mark → DDN114.\n\n' +
    table(['mark', 'name', 'meaning'], cat.endpoints.map(e => [e[0], e[1], e[2]])));

  const maturity = cat.facets.filter(f => f.group === 'maturity');
  out.push('### 4.7 Object families, relation families, maturity, view types\n\n' +
    table(['family', 'meaning'], Object.entries(cat.families).map(([k, v]) => [k, v.name])) + '\n\n' +
    table(['relation family', 'meaning', 'default style'],
      Object.entries(cat.relationship_families).map(([k, v]) => [k, v.meaning,
        'pattern "' + (v.dash || '') + '", colour ' + v.colour])) + '\n\n' +
    table(['maturity code', 'name', 'meaning', 'colour'],
      maturity.map(f => [f.code, f.name, f.meaning, cat.maturity_colours[f.code] || '-'])) + '\n\n' +
    'The ' + cat.view_types.length + ' standard view types (V01–V' + String(cat.view_types.length).padStart(2, '0') + ', the intended diagram families of the core vocabulary):\n\n' +
    table(['code', 'view type', 'intent'], cat.view_types.map(v => [v[0], v[1], v[2]])));

  out.push('### 4.8 Registered data properties (' + S.dataProperties.properties.length + '; chapter-10 contract vocabulary)\n\n' +
    'These are the reserved semantic property keys for elements/fields/ports/relations. Unknown non-`x_` keys are preserved with warning DDN-W106 (logical) or rejected DDN106 (strict). Boolean-ish properties `nullable`, `optional`, `allow_extra` must be boolean or an explicit state atom (DDN107); `presence` is `required|optional` or a state (DDN107); `domain` must resolve to a `domain` element (DDN108); `level` is `concept|definition|instance|fragment|copy` or a state (DDN109); field `shape` is `scalar|object|record|array|map|set|variant` (DDN112); `shape: variant` requires ≥2 distinct `variants` names plus an explicit `discriminator` (DDN113).\n\n' +
    table(['property', 'targets', 'value shape', 'constraint'],
      S.dataProperties.properties.map(p => [p.path, joinList(p.targets), p.value_shape, p.constraint])));

  return wrap('vocabulary', out.join('\n\n'));
}

function genProjectionKinds(S) {
  const kinds = S.CHOICES.projection.kind;
  return wrap('projection-kinds',
    '`projection.kind` values: ' + kinds.map((k, i) => '`' + k + '`' + (i === 0 ? ' (default)' : '')).join(', ') +
    ' (anything else → DDN-PJ001). Every projection property must be legal for its kind — no silently ignored settings (DDN-PJ005). Allowed keys per kind (`ddn-projection-data.js supported`):\n\n' +
    jsonBlock(S.projectionSupported));
}

function genDiagnostics(diagnostics) {
  return wrap('diagnostics',
    '## 8. Diagnostics (' + diagnostics.length + ' codes, machine-extracted from runtime + Studio sources)\n\n' +
    '`check`/`render` failures print one JSON error object; warnings/infos appear in `warnings`/`diagnostics`. Families: `DDN0xx` lexical/parse, `DDN01x–02x` imports/modules, `DDN03x–06x` build/semantics, `DDN07x` publication, `DDN1xx` contracts/extensions, `DDN13x–14x` process/governance contracts, `DDN15x` redacted export, `DDN2xx` layout/routing, `DDN900` unsupported constructs, `DDN-W…`/`DDN-LW…`/`DDN-PJW…`/`DDN-TW01`/`DDN-CW01` warnings/infos (`DDN-W901` is a reserved legacy warning), `DDN-E0xx` Studio authoring-edit / missing runtime bundle (`DDN-E010`), `DDN-IO…` Studio archive/workspace import-export I/O, `DDN-I…` interaction (experimental sequence-lane projection), `DDN-P…` retained placement, `DDN-PF…` profile validators, `DDN-PJ…` projection validators, `DDN-PX…` profile-completion contracts, `DDN-Q…`/`QC`/`QD`/`QF`/`QL`/`QM`/`QP` quality/decision/fishbone/lifecycle/matrix/panels validators, `LIVE…` in-browser API. How to fix: read the message (it names the offending element/relation/property); the section cross-references: parse errors → §2, build errors → §3, DDN050/056/102/114 → §4 vocabulary tables, DDN-PF/PJ/PX/Q* → §5/§6, DDN2xx → adjust `place`/`route` hints, spacing, or simplify the view (§3.3, §5 coordinate policy).\n\n' +
    table(['code', 'severity', 'raised by', 'meaning (message template(s); runtime values concatenated between literal parts)'],
      diagnostics.map(d => [d.code, d.severity, d.files.join(', '), d.message])));
}

function genGrammar(S) {
  return wrap('grammar',
    '## 12. Appendix — full grammar (standard/grammar/ddn.ebnf, verbatim)\n\n```ebnf\n' + S.grammar.trim() + '\n```');
}

/* ---------- assembly ---------- */

export function assemble({ validate = true } = {}) {
  const S = loadSources();
  const diagnostics = extractDiagnostics();
  const sections = {
    'counts': genCounts(S, diagnostics),
    'properties': genProperties(S),
    'defaults': genDefaults(S),
    'enums': genEnums(S),
    'vocabulary': genVocabulary(S),
    'projection-kinds': genProjectionKinds(S),
    'diagnostics': genDiagnostics(diagnostics),
    'grammar': genGrammar(S),
  };
  let text = read('tools/ai-reference-core.md');
  text = text.replace(/\{\{RUNTIME_VERSION\}\}/g, S.version);
  text = text.replace(/<!-- @gen:([\w-]+) -->/g, (m, name) => {
    if (!sections[name]) throw new Error('no generator for template placeholder @gen:' + name);
    return sections[name];
  });
  if (/<!-- @gen:[\w-]+ -->/.test(text)) throw new Error('unreplaced @gen placeholder remains');
  return { text, version: S.version, diagnosticCount: diagnostics.length };
}

/* ---------- worked-example validation (check AND render) ---------- */

export function validateExamples(text) {
  const cli = path.join(root, 'notation', 'cli', 'cli.js');
  const lines = text.split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^```ddn\s*$/.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && !/^```\s*$/.test(lines[j])) j++;
    if (j >= lines.length) throw new Error('unterminated ```ddn fence at line ' + (i + 1));
    blocks.push({ line: i + 2, text: lines.slice(i + 1, j).join('\n') });
    i = j;
  }
  if (!blocks.length) throw new Error('no ```ddn blocks found');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddn-ai-ref-gen-'));
  let failed = 0, checked = 0;
  try {
    for (const [i, b] of blocks.entries()) {
      b.name = /module "ddn\.examples\.shared";/.test(b.text) ? 'shared.ddn' : 'block' + (i + 1) + '.ddn';
      fs.writeFileSync(path.join(tmp, b.name), b.text + '\n', 'utf8');
    }
    for (const b of blocks) {
      if (b.name === 'shared.ddn') continue; // library module; validated transitively
      const views = [...b.text.matchAll(/^view\s+([A-Za-z_][A-Za-z0-9_-]*)/gm)].map(m => m[1]);
      const runs = views.length ? views.map(v => ['--view', v]) : [[]];
      for (const extra of runs) {
        for (const command of ['check', 'render']) {
          const args = [cli, command, path.join(tmp, b.name), '--workspace', tmp, ...extra];
          if (command === 'render') args.push('--out', path.join(tmp, b.name + '.svg'));
          const r = cp.spawnSync(process.execPath, args, { encoding: 'utf8' });
          checked++;
          const label = command + ' line ' + b.line + ' (' + b.name + (extra.length ? ' ' + extra.join(' ') : '') + ')';
          if (r.status !== 0) {
            failed++;
            console.error('FAIL ' + label + ':');
            console.error((r.stderr || r.stdout).trim());
          } else console.log('PASS ' + label);
        }
      }
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  if (failed) throw new Error(failed + ' of ' + checked + ' example validation runs failed');
  return { blocks: blocks.length, checked };
}

/* ---------- CLI ---------- */

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const validate = !args.includes('--no-validate');
  const outArg = args.find(a => !a.startsWith('--'));
  const out = path.resolve(outArg || path.join(root, '..', 'kimi-DDN-workarea', 'DDN-AI-REFERENCE.md'));
  const { text, version, diagnosticCount } = assemble({ validate });
  if (validate) {
    const { blocks, checked } = validateExamples(text);
    console.log('ai-reference: ' + checked + ' check+render runs across ' + blocks + ' ```ddn blocks, all pass');
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text, 'utf8');
  console.log('ai-reference: wrote ' + out + ' (runtime ' + version + ', ' + diagnosticCount + ' diagnostic codes, ' + text.length + ' bytes)');
}
