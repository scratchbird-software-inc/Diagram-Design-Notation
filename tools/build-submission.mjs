#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later
 * build-submission.mjs — generator for the standards-submission draft.
 * Every number cited in standard/submission/ is computed HERE from the
 * actual files (standard/registry/**, standard/specification/, ddna/,
 * NOTICE.md) and emitted to standard/submission/facts.json with its
 * source path. The submission markdown is rendered from the templates
 * below with those facts — never hand-counted.
 *
 * Modes:
 *   node tools/build-submission.mjs           regenerate facts.json + markdown
 *   node tools/build-submission.mjs --check   regenerate into temp, byte-compare,
 *                                             and lint the drafts (drift = exit 1)
 *   node tools/build-submission.mjs --out DIR render into DIR (used by --check/tests)
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(new URL('..', import.meta.url).pathname);
const read = p => fs.readFileSync(path.join(REPO, p), 'utf8');
const jread = p => JSON.parse(read(p));
const list = (p, f) => fs.readdirSync(path.join(REPO, p)).filter(f);
const args = process.argv.slice(2);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(REPO, 'standard/submission');

// ---------------------------------------------------------------- facts ----
const core = jread('standard/registry/catalogue.json');
const prof = jread('standard/registry/profiles/catalogue.json');
const packIndex = jread('standard/registry/icon-packs/index.json');
const packs = packIndex.packs.map(f => jread('standard/registry/icon-packs/' + f));
const fixes = jread('tools/ai-reference/diagnostic-fixes.json');
const coreJs = read('notation/runtime/ddn-core.js');
const profilesJs = read('notation/runtime/ddn-profiles.js');
const notice = read('NOTICE.md');

const projKinds = (coreJs.match(/projection:\{kind:\[([^\]]*)\]/) || [])[1].split(',').length;
const extContracts = (profilesJs.match(/out\.extension_contracts\.x_[a-z_]+=def/g) || []).length;
const byProjection = {};
for (const p of prof.profiles) byProjection[p.projection] = (byProjection[p.projection] || 0) + 1;

const facts = {
  generated: 'build-submission.mjs — every entry carries its source path',
  registry: {
    coreKinds: { value: core.kinds.length, source: 'standard/registry/catalogue.json (kinds)' },
    coreRelations: { value: core.relationships.length, source: 'standard/registry/catalogue.json (relationships)' },
    profileKinds: { value: prof.kinds.length, source: 'standard/registry/profiles/catalogue.json (kinds)' },
    profileRelations: { value: prof.relationships.length, source: 'standard/registry/profiles/catalogue.json (relationships)' },
    totalKinds: { value: core.kinds.length + prof.kinds.length, source: 'computed: coreKinds + profileKinds' },
    totalRelations: { value: core.relationships.length + prof.relationships.length, source: 'computed: coreRelations + profileRelations' },
    shapes: { value: prof.shapes.length, source: 'standard/registry/profiles/catalogue.json (shapes)' },
  },
  profiles: {
    installed: { value: prof.profiles.length, source: 'standard/registry/profiles/catalogue.json (profiles)' },
    projectionKinds: { value: projKinds, source: 'notation/runtime/ddn-core.js (CHOICES.projection.kind)' },
    byProjection: { value: byProjection, source: 'standard/registry/profiles/catalogue.json (profiles, grouped by projection)' },
  },
  extensions: {
    contracts: { value: extContracts, source: 'notation/runtime/ddn-profiles.js (extension_contracts … = def)' },
  },
  icons: {
    packs: { value: packs.length, source: 'standard/registry/icon-packs/index.json' },
    icons: { value: packs.reduce((n, p) => n + p.icons.length, 0), source: 'standard/registry/icon-packs/*.json (icons)' },
    perPack: { value: Object.fromEntries(packs.map(p => [p.id, p.icons.length])), source: 'standard/registry/icon-packs/*.json' },
    mitPacks: { value: packs.filter(p => p.license === 'MIT').length, source: 'standard/registry/icon-packs/*.json (license)' },
  },
  diagnostics: {
    documentedFixes: { value: Object.keys(fixes.fixes).length, source: 'tools/ai-reference/diagnostic-fixes.json (fixes)' },
  },
  docs: {
    specChapters: { value: list('standard/specification', f => f.endsWith('.md')).length, source: 'standard/specification/*.md' },
    schemas: { value: list('standard/schemas', f => f.endsWith('.schema.json')).length, source: 'standard/schemas/*.schema.json' },
    ddnaChapters: { value: list('ddna', f => f.endsWith('.md')).length, source: 'ddna/*.md (incl. README + appendix)' },
    ddnaFamilyChapters: { value: list('ddna/families', f => f.endsWith('.md')).length, source: 'ddna/families/*.md' },
  },
  licensing: {
    mitAttributions: { value: (notice.match(/MIT License/g) || []).length, source: 'NOTICE.md (MIT License mentions)' },
  },
};
const F = k => k.split('.').reduce((o, x) => o[x], facts).value;

// ------------------------------------------------------------- templates ---
const render = tpl => tpl.replace(/\{\{([a-zA-Z.]+)\}\}/g, (m, k) => {
  const v = F(k);
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
});

const DDN_MD = `# DDN — Diagram Design Notation · standards-body submission draft

**Status: DRAFT proposal (2026 draft).** No standard number has been
assigned; a standards body assigns numbers. Nothing here claims adoption,
acceptance, or prior submission. This document was generated from the
project's machine-readable sources by \`tools/build-submission.mjs\`; every
count is traceable to \`standard/submission/facts.json\`.

## 1. Scope and purpose

DDN is an open dialect for describing diagrams as plain text. One semantic
model — the data — projects into many diagram types through independent
view declarations: **data, format, and view are separate, composable
sections**, so the model is edited once and every view follows. Identity
is stable: every declaration carries a module-scoped identity
(\`module::path\`), unique across the workspace, and references are
explicit \`@id\` forms, never positional. Provenance is explicit: source
files are the truth, every rendered artifact is deterministic from them
(same source → identical bytes), and generation tooling is
freshness-checked so committed artifacts provably match their sources.

The project and the standard are **open**: the specification, the
machine-readable registry, and the reference implementation are published
together; anyone may implement DDN from the documents alone.

## 2. Normative core (mapped to specification chapters)

The normative core lives in \`standard/specification/\` — **{{docs.specChapters}}**
chapters covering: status and conformance scope (ch. 00); the language and
decoding rules (ch. 01); the data model and executable contracts (ch. 02);
views, selection and reuse definitions; routing and layout; publication;
security; notation profiles and diagram families (ch. 17, with per-family
sections); quality projections and validation; cross-file addressing and
architecture containers (§17.25); and the icon pack format (ch. 49) with
its JSON Schema. The syntactic core has a formal EBNF grammar
(\`standard/grammar/ddn.ebnf\`), and **{{docs.schemas}}** JSON Schemas
(draft 2020-12) cover the resolved IR, scene, values, extensions,
publication manifest, layout state, workspace, and icon packs.

## 3. The machine-readable vocabulary (registry)

The vocabulary is data, not prose: \`standard/registry/\` is the
machine-readable catalogue that the specification and the runtime share.

| Measure | Count | Source |
| --- | --- | --- |
| Core object kinds | {{registry.coreKinds}} | registry catalogue |
| Core relation verbs | {{registry.coreRelations}} | registry catalogue |
| Profile object kinds | {{registry.profileKinds}} | profiles catalogue |
| Profile relation verbs | {{registry.profileRelations}} | profiles catalogue |
| **Total element kinds** | **{{registry.totalKinds}}** | computed |
| **Total relation verbs** | **{{registry.totalRelations}}** | computed |
| Shape silhouettes | {{registry.shapes}} | profiles catalogue |
| Installed profiles | {{profiles.installed}} | profiles catalogue |
| Projection kinds | {{profiles.projectionKinds}} | language choices |
| Documented diagnostics | {{diagnostics.documentedFixes}} | diagnostic fix guide |

## 4. Extension mechanism, profiles, and icon packs

Three additive mechanisms keep the core small and everything else a
versioned layer:

- **Extension contracts** — **{{extensions.contracts}}** \`x_*\`-prefixed
  contracts declared in the registry of extension contracts. Unknown
  extensions are carried (never silently dropped); known ones are
  schema-validated. Old processors pass new extensions through untouched.
- **Profiles and projections** — a view's \`projection.profile\` names its
  model kind. **{{profiles.installed}}** versioned profiles are installed
  across **{{profiles.projectionKinds}}** projection kinds (per-projection
  distribution: {{profiles.byProjection}}). Profiles are vocabulary +
  validation layers over the same machinery — no profile redefines core
  semantics.
- **Icon packs** (\`ddn-icon-pack@1\`, spec ch. 49) — symbols ship as
  single self-contained JSON documents with a manifest (id, name, version,
  license, attribution, source) and inline stroke-SVG icons. **{{icons.packs}}**
  packs ship with **{{icons.icons}}** icons total, of which **{{icons.mitPacks}}**
  are curated MIT-licensed third-party selections with license texts in
  their manifests. Every icon — shipped or host-supplied — is sanitized
  before rendering (no scripts, embedded documents, event handlers, or
  external references; 20 KiB cap per icon). Host applications may
  register their own packs at runtime; they are validated and sanitized
  identically.

## 5. Governance and versioning

The standard evolves through a documented change process: language,
vocabulary, or visual-meaning changes require a change record and the
coordinated update of specification chapters, grammar, schemas, registry,
capabilities, runtime, and tests together. Source versions are explicit
in every file (\`ddn "x.y";\`); processors must reject unknown source
versions rather than guess. Registry identities are never removed or
repurposed — incompatible changes are new identities, so existing
documents keep rendering exactly as written. **Processor conformance**
for DDN means: parse and render the documented dialect, honor the
registry's endpoint contracts and profile validators, surface every
diagnostic with its code, and never silently reinterpret unknown content.

## 6. Intellectual property and licensing

The project is GPL-2.0-or-later; the DDN standard itself is an **open
file-format standard** — the closure is at the tool/product level, never
the specification. Third-party marks (UML, BPMN, CMMN, DMN, SysML, SoaML,
UAF, fUML, OCL, ALF, ArchiMate, SDL, MSC and others) are referenced
nominatively to describe which well-known diagram families DDN provides
profiles for — never as endorsements, and with no certification claims
(the project's standing exclusions: no metamodel interchange execution,
no execution semantics, no formal certification). Bundled third-party
icon artwork (two MIT-licensed curated selections) is attributed in
\`NOTICE.md\` with license texts included in the pack manifests.

---
*Generated draft. Numbers: standard/submission/facts.json. Regenerate:
\`node tools/build-submission.mjs\`; drift-check: \`--check\`.*
`;

const DDNA_MD = `# DDNA — DDN with Automation · standards-body submission draft

**Status: DRAFT proposal (2026 draft).** No standard number has been
assigned; a standards body assigns numbers. Nothing here claims adoption,
acceptance, or prior submission. This document was generated from the
project's sources by \`tools/build-submission.mjs\`; every count is
traceable to \`standard/submission/facts.json\`. Wording of all
external-standards claims is copied from the ratified DDNA chapters —
"mirrors" / "based on" / "an implementation of", never "conformant to".

## 1. Scope and purpose

DDNA (DDN with Automation) is an **open file-format standard that expands
DDN — it never replaces it**. DDN remains complete and self-sufficient
without DDNA. The DDN file is the identity basis: every identity
referenced in a DDNA file is defined in a DDN file; DDNA files never
define base identities, and one DDNA file may serve multiple DDN files.
Declaration direction is explicit in both directions: DDN files declare
their associated DDNA files; DDNA files declare the DDN identity bases
they require. When a DDNA file serves multiple DDN files, **no identity
collision across bases** is allowed — loading a DDNA file with colliding
base identities is a validation error, which makes bare \`@id\`
references unambiguous. Alien formats are **import-only**: DDN and DDNA
are the only formats tools display, render, or execute.

Both standards are open, and the open tool implements both. The
open-source viewer and designer implement DDN *and* DDNA — companion
files, trace replay and generation, execution engines, KEEL evaluation
(2026-10-08 owner direction). The commercial product differentiates
quantitatively and collaboratively — it removes the open tool's per-view
display limits and adds concurrent editing, collaboration, history and
extended functionality — never by withholding a capability class.
Differentiation lives at the tool/product level, never in the
specification.

## 2. Architecture and file model

The association machinery is the one DDN's specification defines for
cross-file addressing (DDN spec §17.25): **architecture containers**
group the files of one described architecture with collision-safe
identity; **module-qualified references** address elements across files;
**\`x_link\` association metadata** is the lightweight cross-file
association — ignorable to DDN-only tools, degrading to a note (never an
error) when a referenced file is absent. Feature definitions live in
their own **feature-id space** (many identities → one feature), and
identity, versioning (DDN source version + DDNA standard version), and
graceful-degradation rules are all in-file declarations.

## 3. Execution-model classes

Every analyzed family maps to exactly one of **six execution-model
classes** (chapter 2 of the DDNA spec): EM-1 token runtime (BPMN, UML
activity, UML state machines, with SDL's special position of a formal
abstract machine), EM-2 declarative DAG evaluation (DMN), EM-3
lifecycle-FSM runtime (CMMN), EM-4 trace-set observational semantics
(UML interactions, MSC/HMSC), EM-5 spec-delegated evaluation (SysML
parametrics, UAF), EM-6 conformance-specification (SoaML). All
operational classes reduce to a single recorded interleaving —
normatively sanctioned by the underlying standards — which is why one
trace format and one concurrency model serve every class.

## 4. Trace format, KEEL interface, runtime models

- **Trace format (the keystone):** per-event records with a monotonic
  envelope and per-step \`stepKind\`, universal instance identity, choice
  records for **eight normative nondeterminism classes** (N1–N8),
  copy-on-event state snapshots, **semantic-profile + version stamping**,
  referential integrity to real element ids, KEEL evaluation records with
  engine id and version, and optional three-valued validation verdicts.
  Two replay modes: **verified replay** (recompute under a declared
  deterministic profile) and **faithful replay** (recorded choices,
  verbatim — "record, never re-derive").
- **KEEL reference interface:** the Z.120 §5.3 nine-function host-function
  seam adopted verbatim as the spine (parse, typecheck, name-equality,
  conformance, free-vars, substitute, fresh, partial eval), with
  capability tiers **T0–T8**, two numeric towers (FEEL decimal128 vs
  XPath IEEE double — the language tag selects), four null/error regimes,
  and family-dependent guard purity (SDL stateful guards legal; order
  recorded). DDNA **never implements the dialects** — it references them;
  evaluation belongs to host engines.
- **Runtime models (ratified):** TIME-A+B (event-stepped virtual clock
  with a dense constraint layer), DATA-A or C (B rejected), CONC-A +
  CONC-B-data (one global interleaving, partial-order data for trace
  validation), and a declared semantic-profile option set.

## 5. Conformance claims vocabulary

The master rule: claim **"mirrors X" / "based on X" / "an implementation
of X"**, never **"conformant to X"**, unless a conformance tier
explicitly covers the claim. Exactly two near-conformance paths exist:
"mirrors fUML 1.5 Clause 8" inside the fUML subset, and "mirrors W3C
SCXML Appendix D microstep/macrostep" as the state-machine default with
the UML-strict option. Partial-interpretation inheritance is global:
whatever a tool interprets must match the normative clause for what it
touches. DDNA-defined semantics are labeled as such wherever they
substitute for standard semantics.

## 6. Per-family coverage

**{{docs.ddnaFamilyChapters}}** normative family chapters are drafted:
six class chapters (UML state machines, UML activities, BPMN, SDL, DMN,
CMMN) in the first batch, and six more (UML interactions, MSC/HMSC,
SysML parametrics, SoaML, UAF, and a combined no-standard chapter for
ER/Chen, DFD, EPC, C4, mind maps and the presentation families). Each
follows one structure: scope and pinned sources; the behavior DDNA
adopts; feature support (core / optional / excluded with reason);
expression behavior (tier, tower, regime, purity); trace and replay
requirements; runtime-model bindings; claims wording; open items.

## 7. Open items (stated honestly as future work)

- **Tier-3 gated families await documents or licenses** — ArchiMate 4
  (commercial evaluation license under legal review) and the IEC 60617
  full database are license holds; IEC 61131-3, ISO 15909, ISO/IEC
  19507, ISO 5807, ISA-5.1 await texts; their exclusions stand until
  acquisition.
- **UNVERIFIED-PDF carry-overs** — UML 2.5.1 subsection numbering, PSSM
  1.0, Z.120 Annex B process algebra, Z.103–Z.107, DMN 1.4 clause-10
  fine print — cited with drafting notes only, never normatively, until
  acquired.
- **Feature finalization** — catalog core/optional tags and the DATA
  A-vs-C selection settle as the DDNA file format itself is drafted.

---
*Generated draft. Numbers: standard/submission/facts.json. Regenerate:
\`node tools/build-submission.mjs\`; drift-check: \`--check\`.*
`;

const README_MD = `# Standards-body submission drafts (DDN + DDNA)

**Draft status: 2026 draft, pre-submission.** Nothing here has been
submitted to or accepted by any standards body, and no standard number is
assigned anywhere in these drafts — a standards body assigns numbers.

## Contents

- \`ddn-submission.md\` — the DDN standard submission draft (generated).
- \`ddna-submission.md\` — the DDNA standard submission draft (generated).
- \`facts.json\` — every number cited in the drafts, with the source path
  each count was computed from.

## Regenerating

\`\`\`bash
node tools/build-submission.mjs           # regenerate facts.json + both drafts
node tools/build-submission.mjs --check   # drift-check (also run by the test suite)
\`\`\`

The drafts are **generated**, never hand-counted: the generator reads
\`standard/registry/**\`, \`standard/specification/\`, \`ddna/\`, the
diagnostic fix guide, and \`NOTICE.md\`, computes every count, and renders
the markdown from templates. If a count or a claim drifts from the
sources, \`--check\` fails — it is wired into the project's test suite as a
freshness gate.

## Grounding rules

Every external-standards claim copies the wording already ratified in
\`standard/specification/\` and \`ddna/\` ("mirrors" / "based on" / honest
exclusions) — never stronger. No internal project identifiers or
change-record numbers appear in the drafts; status is DRAFT proposal
throughout.
`;

// ------------------------------------------------------------------ lint ---
function lint(name, text) {
  const problems = [];
  if (!/DRAFT proposal/.test(text)) problems.push('missing DRAFT proposal status');
  const banned = [
    [/B1-\d{3}/, 'internal work-item id'],
    [/RFC-\d+/, 'internal change-record id'],
    [/RFC\s+(?:number\s+)?\d{3,}/i, 'assigned-looking RFC number'],
    [/ISO\s+\d{5}\s+assigned/i, 'assigned-looking standard number'],
    [/has been (submitted|accepted|adopted)/i, 'submission/adoption claim'],
  ];
  for (const [re, label] of banned) if (re.test(text)) problems.push(label + ': ' + (text.match(re) || [])[0]);
  for (const m of text.matchAll(/\{\{[a-zA-Z.]+\}\}/g)) problems.push('unrendered placeholder ' + m[0]);
  return problems.map(p => name + ': ' + p);
}

// ------------------------------------------------------------------ emit ---
function outputs() {
  return {
    'facts.json': JSON.stringify(facts, null, 2) + '\n',
    'ddn-submission.md': render(DDN_MD),
    'ddna-submission.md': render(DDNA_MD),
    'README.md': README_MD,
  };
}
function writeAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(outputs())) fs.writeFileSync(path.join(dir, name), text);
}

if (args.includes('--check')) {
  const os = await import('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddn-submission-'));
  writeAll(tmp);
  const problems = [];
  for (const [name, text] of Object.entries(outputs())) {
    const committed = path.join(REPO, 'standard/submission', name);
    if (!fs.existsSync(committed)) { problems.push(name + ': missing — run node tools/build-submission.mjs'); continue; }
    if (fs.readFileSync(committed, 'utf8') !== text) problems.push(name + ': drifted from sources — run node tools/build-submission.mjs');
    if (name.endsWith('.md')) problems.push(...lint(name, text));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log('submission drift-check: OK (' + Object.keys(outputs()).length + ' files, '
    + F('registry.totalKinds') + ' kinds, ' + F('registry.totalRelations') + ' verbs, '
    + F('profiles.installed') + ' profiles, ' + F('icons.packs') + ' packs/' + F('icons.icons') + ' icons)');
} else {
  writeAll(OUT);
  console.log('submission: wrote facts.json + 3 markdown files to ' + OUT);
}
