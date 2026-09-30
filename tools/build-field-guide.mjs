#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later
 * build-field-guide.mjs — generator for the DDN Diagram Field Guide (0.7 port).
 *
 * Chapter contract (from the 0.5 edition, analyzed at
 * /home/dcalford/Sandbox/old/ddn-0.5-field-guide-routing-patch/field-guide/):
 * every chapter is {id,title,category,kind,status,entry,view, what/why/when,
 * read/inputs/pitfalls/limits/variants/refs, runtime{sha256,modelFingerprint,
 * warnings,milliseconds}, files, sourceTour, viewSource, walkthrough,
 * experiment{kind,id,file,before,after,expectation}, exerciseEvidence
 * {before,after,changed,modelChanged,relationIdentitiesPreserved}, editTask}.
 *
 * Every count comes from generated facts (standard/submission/facts.json,
 * same mechanism as tools/build-submission.mjs) — never hand-written.
 * Every chapter fixture is CHECKED + RENDERED through the real workspace at
 * build time; the exercise is EXECUTED and undone, and both SVG hashes are
 * recorded. Run 1 delivers the skeleton + the pilot set below; the full
 * chapter plan ships as field-guide/chapter-plan.json (status: pilot/planned).
 *
 * Modes:
 *   node tools/build-field-guide.mjs           build into field-guide/
 *   node tools/build-field-guide.mjs --out DIR build into DIR (freshness tests)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const REPO = path.resolve(new URL('..', import.meta.url).pathname);
const A = require(path.join(REPO, 'notation/dist/ddn.global.js'));
const args = process.argv.slice(2);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(REPO, 'field-guide');
const facts = JSON.parse(fs.readFileSync(path.join(REPO, 'standard/submission/facts.json'), 'utf8'));
import BATCH2 from './field-guide-batch2.mjs';
const F = k => k.split('.').reduce((o, x) => o[x], facts).value;
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ------------------------------------------------------------ pilots -------
// Curated pilot chapters (6). Each fixture is a real repo example; the
// experiment target is resolved programmatically (first element in the view
// whose kind matches the chapter's probe), so ids never drift.
const CHAPTERS = [...BATCH2,
  {
    id: 'whiteboard', title: 'Whiteboard / discovery sketch', category: 'Data structures and meaning',
    status: 'native', entry: 'website/examples/use-cases/01-whiteboard.ddn', view: 'diagram',
    what: 'A preliminary map of named concepts and their relationships. An unspecified object deliberately leaves storage technology and detailed structure undecided; it is not an undocumented SQL table.',
    why: 'Use this to expose disagreements about vocabulary before implementation choices obscure them. A shared sketch provides stable identities that can acquire fields, domains and deployment details later.',
    when: 'Start an unfamiliar project or facilitate a meeting where participants need to agree on the important things before they agree on keys and types.',
    read: ['Read the nouns in the boxes first.', 'Read each connecting verb as an assertion, not as an enforced foreign key.', 'An unselected element is out of scope for this sketch, not deleted from the model.'],
    inputs: ['Names understood by the participants', 'Relationship meanings and direction', 'Questions that have not been settled'],
    pitfalls: ['Do not infer a table from every rectangle.', 'Do not treat proximity, colour, or a crossed line as a new fact.'],
    limits: 'This is an explanatory model, not an executed business system. A successful render does not establish implementation effectiveness or independent approval.',
    variants: [], refs: [],
    probe: ['application', 'table', 'process'],
    expectation: m => `Only the label of ${m} changes; identities, relations and every other declaration are untouched.`,
    editTask: 'After the safe label change, review the names understood by the participants in the source. Change one additional documented assumption appropriate to this diagram, apply it and inspect every reported diagnostic.',
    tags: ['sketch', 'concept', 'meeting'],
  },
  {
    id: 'business-erd', title: 'Conceptual business ER diagram', category: 'Data structures and meaning',
    status: 'native', entry: 'website/examples/use-cases/02-business-erd.ddn', view: 'diagram',
    what: 'Entities and the relationships between them at business level: names and cardinalities, no storage design.',
    why: 'Agree on the things the business tracks before any schema discussion; the diagram is the vocabulary contract.',
    when: 'Early domain workshops and any review where business stakeholders must confirm scope without reading SQL.',
    read: ['Entities are nouns; relationships are verbs with cardinality marks.', 'Participation marks (zero/one/many) are claims about the domain, not constraints enforced here.'],
    inputs: ['The entities the business names', 'How they relate, in business words', 'Rough cardinalities'],
    pitfalls: ['Do not start assigning datatypes here — that is the logical/physical stage.', 'A relationship without a business-readable verb is usually a missing entity.'],
    limits: 'Conceptual only: no keys, types or indexes are decided by this view.',
    variants: [], refs: [],
    probe: ['entity', 'table', 'application'],
    expectation: m => `Only the label of ${m} changes; identities and relationships are untouched.`,
    editTask: 'Rename one relationship verb so it reads in the business direction, apply, and check the legend and diagnostics.',
    tags: ['erd', 'conceptual', 'domain'],
  },
  {
    id: 'bpmn-collaboration', title: 'BPMN collaboration / message flow between pools', category: 'Processes, interactions and lifecycle',
    status: 'native', entry: 'website/examples/basics/46-bpmn.ddn', view: 'collaboration',
    what: 'Two pools with their internal flows and the message flow between them: the classic BPMN collaboration picture.',
    why: 'Make cross-organisation communication explicit without pretending one party controls the other.',
    when: 'Whenever a process crosses an organisational boundary and responsibilities must stay visibly separate.',
    read: ['Each pool owns its sequence flow; message flow only connects across pools.', 'A message flow inside one pool is a modeling error, not a style choice.'],
    inputs: ['The participants', 'The messages exchanged, in order', 'What each side does independently'],
    pitfalls: ['Do not draw sequence flow between pools.', 'Do not hide a participant whose messages drive your process.'],
    limits: 'Notation coverage only: no execution, simulation or choreography conformance is claimed by this render.',
    variants: [], refs: [],
    probe: ['bpmn.task', 'flow.process', 'bpmn.activity'],
    expectation: m => `Only the label of ${m} changes; pools, messages and flow identities are untouched.`,
    editTask: 'Rename one message to describe the payload it carries (not the action), apply, and inspect diagnostics.',
    tags: ['bpmn', 'collaboration', 'messages'],
  },
  {
    id: 'bar-chart', title: 'Bar chart — live records, keyed refresh', category: 'Charts, distributions and measurement',
    status: 'native', entry: 'website/examples/basics/59-data-refresh.ddn', view: 'latency_chart',
    what: 'A data-bound bar chart over a records block: the records are the source, the chart is a projection of them.',
    why: 'Show that the chart is generated from data you can replace — the supported live-dashboard pattern is a transactional record swap, not an image swap.',
    when: 'Any metric over categories where the numbers will change but the model must not.',
    read: ['Bars read value against unit by category.', 'The source data block is one summary away in the Files panel.'],
    inputs: ['Category keys', 'Numeric values with units', 'A data block to own them'],
    pitfalls: ['Do not edit the picture when the data is wrong — edit the records.', 'Do not reorder keyed records expecting identities to follow position.'],
    limits: 'Bounded native marks and finite JavaScript arithmetic; refresh replaces records, never structure.',
    variants: [], refs: [],
    experimentKind: 'data', dataBlock: 'metrics', probe: ['application', 'record', 'entity'],
    expectation: m => `Only the label of ${m} changes; records, chart bindings and every identity are untouched.`,
    editTask: 'Use ws.replaceData on the metrics block with a second keyed payload, re-render, and confirm the model fingerprint is unchanged (data-only change).',
    tags: ['chart', 'bar', 'refresh'],
  },
  {
    id: 'ladder', title: 'IEC 61131-3 ladder diagram / relay logic', category: 'Processes, interactions and lifecycle',
    status: 'native', entry: 'website/examples/basics/101-ladder.ddn', view: 'd',
    what: 'Three rungs between the power rails: normally-open and normally-closed contacts driving coils, one coil per rung, a parallel OR branch, and a hosted function block.',
    why: 'Ladder logic is the control-room reading of combinatorial logic: conditions left-to-right, one output per rung.',
    when: 'Industrial control documentation where electricians and engineers share one reading of the wiring.',
    read: ['Power flows conceptually left rail to right rail.', 'Contacts in series are AND; contacts stacked on parallel tracks are OR.', 'One rung drives exactly one coil — the validator enforces it.'],
    inputs: ['The signals (contacts)', 'The outputs (coils and their modes)', 'Rung order'],
    pitfalls: ['A rung with two coils is an error, not a design.', 'Branches come from the wiring topology — you do not declare them.'],
    limits: 'Common-practice ladder rendering and validation; no PLC compilation, execution or IEC XML interchange.',
    variants: [], refs: [],
    probe: ['ladder.contact', 'ladder.coil'],
    expectation: m => `Only the label of ${m} changes; rungs, contacts and the coil are untouched.`,
    editTask: 'Change the NC contact to NO (or vice versa) in the source, apply, and reason about the changed logic before reverting.',
    tags: ['ladder', 'iec61131', 'control'],
  },
  {
    id: 'decision-first', title: 'Typed decision table — first match', category: 'Matrices, tables and analysis panels',
    status: 'native', entry: 'website/examples/quality/views.ddn', view: 'decision_first',
    what: 'A typed decision table evaluated in first-match order: the first row whose conditions all match produces the outcome.',
    why: 'Expose rule order as a deliberate design decision instead of an accident of presentation.',
    when: 'Bounded business rules where precedence must be reviewable line by line.',
    read: ['Read rows top-down: the first fully-matching row wins.', 'Type domains on each input gate what a row may claim.'],
    inputs: ['The input fields and their domains', 'The rule rows in priority order', 'The output column'],
    pitfalls: ['Row order is normative here — reordering rows changes outcomes.', 'A gap in the domain is a silent fall-through, not a default row.'],
    limits: 'Bounded decision-table evaluation against one input record; no arbitrary rule-language execution.',
    variants: [], refs: [],
    probe: ['decision.table', 'table', 'record'],
    expectation: m => `Only the label of ${m} changes; rules, domains and the evaluation contract are untouched.`,
    editTask: 'Evaluate the table against one input record with evaluateDecision, then swap two rows and evaluate again — the outcome difference is the lesson.',
    tags: ['decision', 'rules', 'quality'],
  },
];

// The full-edition chapter plan (run 2+ target set). status: pilot | planned.
// Derived from the 0.5 catalogue (119 lessons) adapted to the 0.7 registry —
// new compliance families added, stale support levels to be re-marked per
// chapter as each lands.
const PLAN = JSON.parse(fs.readFileSync(new URL('./field-guide-plan.json', import.meta.url)));

// ---------------------------------------------------------- machinery ------
function filesFor(entry) {
  const files = {};
  const visit = name => {
    if (Object.hasOwn(files, name)) return;
    files[name] = fs.readFileSync(path.join(REPO, name), 'utf8');
    const ast = A.parse(files[name], name);
    for (const imp of ast.imports) visit(A.resolvePath(name, imp.path));
    const walk = n => {
      if (n.type === 'architecture') for (const f of (n.props && n.props.files) || []) visit(A.resolvePath(name, f));
      if (n.props && n.props.x_link && n.props.x_link.file) visit(A.resolvePath(name, n.props.x_link.file));
      for (const c of n.children || []) walk(c);
    };
    for (const sec of ast.sections || []) for (const d of sec.declarations || []) walk(d);
  };
  visit(entry);
  return files;
}

function viewSourceText(entry, viewId) {
  const text = fs.readFileSync(path.join(REPO, entry), 'utf8');
  const lines = text.split('\n');
  const start = lines.findIndex(l => l.startsWith('view ' + viewId + ' '));
  if (start < 0) return null;
  let depth = 0, end = start;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) { if (ch === '{') depth++; if (ch === '}') depth--; }
    if (i > start && depth === 0) { end = i; break; }
    end = i;
  }
  return lines.slice(start, end + 1).join('\n');
}

function buildChapter(ch) {
  const files = filesFor(ch.entry);
  const ws = A.createWorkspace(files);
  const r = ws.renderSync({ entry: ch.entry, view: ch.view });
  const ir = ws.resolve(ch.entry, ch.view);
  const candidates = ir.elements.filter(e => ir.view.selected.includes(e.id));
  const element = candidates.find(e => ch.probe.includes(e.kind)) || candidates[0] || ir.elements[0];
  // guided experiment through the public API (label edit, or a keyed record swap)
  let before, after, r2;
  const svgBefore = sha256(r.svg);
  const fpBefore = r.modelFingerprint;
  if (ch.experimentKind === 'data') {
    const block = ch.dataBlock;
    const current = ir.elements.filter(e => e.ref && e.ref.startsWith(block + '.') && e.properties && e.properties.x_record);
    const first = current[0];
    const xr = first.properties.x_record, beforeV = xr.value, afterV = beforeV + 5;
    const rows = current.map(e => ({ key: e.local || e.ref.split('.').pop(), ...e.properties.x_record }));
    rows[0] = { ...rows[0], value: afterV };
    ws.replaceData(block, rows);
    before = block + '.' + first.ref.split('.').pop() + ' value ' + beforeV;
    after = block + '.' + first.ref.split('.').pop() + ' value ' + afterV;
    ch.expectation = () => `Only the record's value changes from ${beforeV} to ${afterV}; the chart re-renders from the swapped records and undo restores the original payload.`;
  } else {
    before = element.name;
    after = before + ' / review';
    A.authoring.setLabel(ws, ch.entry, ch.view, element.id, after);
  }
  r2 = ws.renderSync({ entry: ch.entry, view: ch.view });
  const svgAfter = sha256(r2.svg);
  const fpAfter = r2.modelFingerprint;
  ws.undo();
  const r3 = ws.renderSync({ entry: ch.entry, view: ch.view });
  const undoOk = sha256(r3.svg) === svgBefore;
  ws.destroy();
  const ast = A.parse(files[ch.entry], ch.entry);
  const moduleIds = new Set(ast.sections.map(s => s.module));
  const sourceTour = Object.keys(files).map(f => {
    const a = A.parse(files[f], f);
    return { file: f, roles: [...new Set(a.declarations.map(d => d.type === 'data' ? 'data' : d.type === 'format' ? 'format' : d.type === 'view' ? 'view' : null).filter(Boolean))] };
  });
  const chapter = {
    ...ch,
    runtime: {
      entry: ch.entry, view: ch.view, profile: ir.view.profiles.projection.profile, projection: ir.view.profiles.projection.kind,
      sha256: svgBefore, modelFingerprint: fpBefore,
      warnings: r.diagnostics.filter(d => d.severity !== 'info').map(d => d.code),
    },
    files: Object.keys(files),
    sourceTour,
    viewSource: viewSourceText(ch.entry, ch.view),
    walkthrough: [
      `Open ${ch.entry} and locate view ${ch.view}. This selects existing data; it is not a stored SVG.`,
      `Inspect the ${ir.view.profiles.projection.profile} profile and ${ir.view.profiles.projection.kind} projection. Read the bindings before changing any value.`,
      'Use the source-file picker or select a diagram element to find its declaration. Edit labels or values deliberately; keep identifiers stable unless all references are updated.',
      'Apply the source, inspect diagnostics, and compare the expected result. Export the SVG only after a successful render.',
    ],
    experiment: { kind: 'label', title: 'Clarify a label without changing its identity', id: element.id, file: ch.entry, before, after, expectation: ch.expectation(after) },
    exerciseEvidence: { before: svgBefore, after: svgAfter, changed: svgBefore !== svgAfter, modelChanged: fpBefore !== fpAfter, relationIdentitiesPreserved: undoOk && r3.modelFingerprint === fpBefore, undoRestoresBefore: undoOk },
  };
  return chapter;
}

// ------------------------------------------------------------- pages -------
const GUIDE_CSS = `body{font:15px/1.55 system-ui,sans-serif;margin:0;color:#1c2733;background:#fafbfc}
header.top{display:flex;gap:1rem;align-items:center;padding:.6rem 1rem;border-bottom:1px solid #d9e2ec;background:#fff}
header.top .mark{background:#285ea8;color:#fff;border-radius:6px;padding:.1rem .45rem;font-weight:700}
nav a{margin-right:.8rem;color:#285ea8;text-decoration:none}
main{max-width:1080px;margin:0 auto;padding:1rem}
.pill{border-radius:999px;padding:.15rem .7rem;font-size:.78rem;font-weight:600;text-transform:uppercase}
.pill.native{background:#e3f2e6;color:#1e6b34}.pill.equivalent{background:#e8effc;color:#285ea8}.pill.subset{background:#fdf0e4;color:#9a5b13}
.card{border:1px solid #d9e2ec;border-radius:8px;background:#fff;padding:.8rem 1rem;margin:.6rem 0}
.views{display:grid;gap:1rem}.viewer-label{font-size:.85rem;color:#5b6b7b}
button{font:inherit;padding:.35rem .8rem;border:1px solid #b9c6d2;border-radius:6px;background:#fff;cursor:pointer}
button.primary{background:#285ea8;color:#fff;border-color:#285ea8}
button:disabled{opacity:.45;cursor:default}
textarea.source-editor{width:100%;min-height:320px;font:12.5px/1.45 ui-monospace,monospace;border:1px solid #b9c6d2;border-radius:6px;padding:.6rem}
pre,code{font:12.5px/1.45 ui-monospace,monospace;background:#f2f5f8;border-radius:6px}
pre{padding:.6rem;overflow:auto}
.status{color:#5b6b7b;font-size:.85rem}.metrics{display:flex;gap:2rem;margin:.8rem 0}
.metrics strong{display:block;font-size:1.6rem}.metrics span{font-size:.82rem;color:#5b6b7b}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #d9e2ec;padding:.3rem .5rem;text-align:left}
.search{width:100%;padding:.35rem;border:1px solid #b9c6d2;border-radius:6px;margin-bottom:.6rem}
.nav-list a{display:block;padding:.18rem 0;color:#285ea8;text-decoration:none;font-size:.9rem}
footer{color:#5b6b7b;font-size:.8rem;padding:1rem;border-top:1px solid #d9e2ec;margin-top:2rem}`;

const GUIDE_JS = `(function(){
const data = window.GUIDE_CHAPTER, files = window.GUIDE_FILES;
const ws = DDNLive.createWorkspace(files);
const status = t => document.getElementById('status').textContent = t;
function redraw(){
  try {
    const r = ws.renderSync({entry: data.entry, view: currentView});
    document.getElementById('main-view').innerHTML = r.svg;
    status('Rendered from live source · revision ' + ws.revision + ' · ' + r.milliseconds + ' ms');
  } catch(e){ status('Render failed: ' + (e && e.code) + ' ' + (e && e.message)); }
}
let currentView = data.view;
const variantSel = document.getElementById('variant');
if (variantSel) variantSel.onchange = () => { currentView = variantSel.value; redraw(); };
document.getElementById('guided').onclick = () => {
  try {
    const ex = data.experiment;
    if (data.experimentKind === 'data') {
      status('Data experiment: edit the records of the data block in the source panel and apply — the chart re-renders from the swapped records.');
      return;
    }
    DDNLive.authoring.setLabel(ws, data.entry, currentView, ex.id, ex.after);
    redraw();
    document.getElementById('undo').disabled = false;
    document.getElementById('exercise-evidence').textContent =
      'Changed ' + ex.id + ' from “' + ex.before + '” to “' + ex.after + '”. ' + ex.expectation;
  } catch(e){ status('Exercise failed: ' + (e && e.message)); }
};
document.getElementById('undo').onclick = () => { ws.undo(); redraw(); document.getElementById('undo').disabled = true; document.getElementById('exercise-evidence').textContent = 'Undone — the diagram is byte-identical to the shipped example.'; };
document.getElementById('redo').onclick = () => { ws.redo(); redraw(); };
document.getElementById('reset').onclick = () => { location.reload(); };
const sel = document.getElementById('file');
for (const f of data.files) sel.add(new Option(f, f));
const editor = document.getElementById('source-editor');
const live = Object.assign({}, files);
function loadFile(){ editor.value = live[sel.value] || ''; }
sel.onchange = loadFile; loadFile();
document.getElementById('apply-source').onclick = () => {
  try { ws.updateFiles({ [sel.value]: editor.value }); live[sel.value] = editor.value; redraw();
    document.getElementById('draft-state').textContent = 'Applied — revision ' + ws.revision + '. Undo is available.';
    document.getElementById('undo').disabled = false;
  } catch(e){ document.getElementById('draft-state').textContent = 'Apply rejected: ' + (e && e.code) + ' ' + (e && e.message); }
};
document.getElementById('download-svg').onclick = () => {
  const svg = document.getElementById('main-view').innerHTML;
  const b = new Blob([svg], {type:'image/svg+xml'}); const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = data.id + '.svg'; a.click();
};
document.getElementById('download-ddn').onclick = () => {
  const b = new Blob([editor.value], {type:'text/plain'}); const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = sel.value.split('/').pop(); a.click();
};
document.getElementById('download-svg').disabled = false;
redraw();
})();`;

function lessonHtml(ch) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(ch.title)}: a source-editable DDN field-guide chapter."><title>${esc(ch.title)} · DDN field guide</title>
<style>${GUIDE_CSS}</style></head><body>
<header class="top"><a class="brand" href="index.html"><span class="mark">D</span></a><strong>DDN Diagram Field Guide</strong><small>0.7 edition (pilot)</small><nav><a href="index.html#paths">Learning paths</a><a href="index.html#chapters">All chapters</a><a href="index.html#coverage">Coverage</a></nav></header>
<main>
<div class="lesson-title"><p class="eyebrow">${esc(ch.category)}</p><h2>${esc(ch.title)}</h2><p class="subtitle">${esc(ch.entry)} # ${esc(ch.view)}</p><span class="pill ${ch.status}">${esc(ch.status)}</span></div>
<div class="explain"><section class="card"><h3>What this diagram shows</h3><p>${esc(ch.what)}</p></section><section class="card"><h3>Why use it?</h3><p>${esc(ch.why)}</p></section><section class="card"><h3>When is it useful?</h3><p>${esc(ch.when)}</p></section></div>
<div class="read-guide"><section class="card"><h3>How to read this example</h3><ol>${ch.read.map(x => `<li>${esc(x)}</li>`).join('')}</ol></section>
<section class="card"><h3>Information to gather first</h3><ul>${ch.inputs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section></div>
<h3>Explore the real diagram</h3><p class="status" id="status">Loading…</p>${ch.variants?.length ? `
<div class="actions" style="margin:.3rem 0"><label for="variant">Variant <select id="variant"><option value="${ch.view}">${esc(ch.view)}</option>${ch.variants.map(v => `<option value="${v.view}">${esc(v.title)}</option>`).join('')}</select></label></div>` : ''}
<div class="views"><div><p class="viewer-label">${esc(ch.runtime.profile)} · ${esc(ch.runtime.projection)}</p><div id="main-view"></div></div></div>
<div class="actions" style="margin:.5rem 0"><button id="download-svg" disabled>Download SVG</button></div>
<section class="exercise card"><p class="eyebrow">GUIDED FIRST EDIT</p><h3>${esc(ch.experiment.title)}</h3>
<p class="expected">${esc(ch.experiment.expectation)}</p>
<div class="exercise-actions"><button id="guided" class="primary">Run guided source change</button><button id="undo" disabled>Undo source edit</button><button id="redo">Redo</button><button id="reset">Restore example</button></div>
<p id="exercise-evidence" class="minor">Shipped evidence: edit changes the render (sha ${ch.exerciseEvidence.before.slice(0, 12)}… → ${ch.exerciseEvidence.after.slice(0, 12)}…), model changes (${ch.exerciseEvidence.modelChanged}), undo restores the shipped bytes (${ch.exerciseEvidence.undoRestoresBefore}).</p>
<p class="minor">${esc(ch.editTask)}</p></section>
<details class="card"><summary>Open the DDN source and edit any definition</summary>
<div class="source-content"><div class="source-tools"><label for="file">File</label><select id="file"></select><button id="apply-source" class="primary">Apply source</button><button id="download-ddn">Download current .ddn</button></div>
<p id="draft-state" class="status"></p><textarea id="source-editor" class="source-editor" spellcheck="false"></textarea>
<p class="minor">All examples are synthetic. Rendering is local to this page.</p></div></details>
<div class="bottom-grid"><section class="card"><h3>How to author this view</h3><ol>${ch.walkthrough.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
<details><summary>Actual view declaration</summary><pre><code>${esc(ch.viewSource || '(view declaration not locatable)')}</code></pre></details></section>
<section class="card"><h3>Where the definitions live</h3><table class="source-tour"><thead><tr><th>Workspace-relative file</th><th>Concern</th></tr></thead><tbody>${ch.sourceTour.map(s => `<tr><td>${esc(s.file)}</td><td>${esc(s.roles.join(', ') || 'support')}</td></tr>`).join('')}</tbody></table></section></div>
<section class="limits card"><h3>Boundaries and common mistakes</h3><p>${esc(ch.limits)}</p><ul>${ch.pitfalls.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>
</main><footer>DDN 0.7.0 · field-guide 0.7 edition (pilot) · original documentation and synthetic examples · no account, font download, CDN, or remote renderer.</footer>
<script src="../../notation/dist/ddn.global.js"></script>
<script>window.GUIDE_FILES = ${JSON.stringify(filesFor(ch.entry)).replace(/<\//g, '<\\/')};</script>
<script>window.GUIDE_CHAPTER = ${JSON.stringify({ id: ch.id, entry: ch.entry, view: ch.view, files: ch.files, experiment: ch.experiment, experimentKind: ch.experimentKind || 'label' }).replace(/<\//g, '<\\/')};</script>
<script>${GUIDE_JS}</script>
</body></html>`;
}

function indexHtml(chapters, meta) {
  const byCat = {};
  for (const c of chapters) (byCat[c.category] ??= []).push(c);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DDN Diagram Field Guide · 0.7 edition</title><style>${GUIDE_CSS}</style></head><body>
<header class="top"><span class="mark">D</span><strong>DDN Diagram Field Guide</strong><small>0.7 edition (pilot)</small><nav><a href="#paths">Learning paths</a><a href="#chapters">All chapters</a><a href="#coverage">Coverage</a></nav></header>
<main>
<section class="hero card"><h1>Understand the diagram.<br>Change the actual design.</h1>
<p>Choose a question, read the diagram, inspect its shared source, and try a real edit. Every chapter includes a live example, a bounded capability statement, and a shipped, undoable first edit.</p>
<div class="metrics">
<div><strong>${meta.chapters}</strong><span>chapters this edition</span></div>
<div><strong>${meta.plannedChapters}</strong><span>planned in the full-edition map</span></div>
<div><strong>${F('profiles.installed')}</strong><span>installed profiles</span></div>
<div><strong>${F('profiles.projectionKinds')}</strong><span>projection kinds</span></div>
<div><strong>${F('registry.totalKinds')}</strong><span>element kinds</span></div>
<div><strong>${F('registry.totalRelations')}</strong><span>relation verbs</span></div>
</div></section>
<section id="paths" class="card"><h3>Learning paths</h3><ol>
<li><strong>Model first:</strong> <a href="lessons/whiteboard.html">Whiteboard sketch</a> → <a href="lessons/business-erd.html">Conceptual ER</a> — agree on the nouns before the verbs.</li>
<li><strong>Processes:</strong> <a href="lessons/bpmn-collaboration.html">BPMN collaboration</a> → <a href="lessons/ladder.html">IEC 61131-3 ladder</a> — two control-world readings of logic.</li>
<li><strong>Data to decisions:</strong> <a href="lessons/bar-chart.html">Bar chart with keyed refresh</a> → <a href="lessons/decision-first.html">First-match decision table</a> — records in, verdicts out.</li>
</ol></section>
<section id="chapters" class="card"><h3>Chapters (${meta.chapters})</h3><input id="search" class="search" type="search" placeholder="Search chapters…" aria-label="Search chapters">
<div id="nav-list" class="nav-list">${Object.entries(byCat).map(([cat, cs]) => `<h4>${esc(cat)}</h4>` + cs.map(c => `<a href="lessons/${c.id}.html" data-text="${esc((c.title + ' ' + c.tags.join(' ')).toLowerCase())}">${esc(c.title)}</a>`).join('')).join('')}</div></section>
<section id="coverage" class="card"><h3>Coverage and honesty</h3>
<p>Support levels: <span class="pill native">native</span> a directly implemented DDN capability within its declared limits; <span class="pill equivalent">equivalent</span> a constructive DDN teaching template for the same information, no external certification implied; <span class="pill subset">subset</span> an explicitly bounded implementation of a wider family. This pilot ships ${meta.chapters} chapters, all ${meta.byStatus}; ${meta.plannedChapters - meta.chapters} more are mapped in <code>chapter-plan.json</code> and land in later runs.</p>
<p>Registry facts are generated, never hand-written: ${F('registry.totalKinds')} element kinds, ${F('registry.totalRelations')} relation verbs, ${F('profiles.installed')} profiles, ${F('profiles.projectionKinds')} projection kinds, ${F('icons.packs')} icon packs (${F('icons.icons')} icons) — source: standard/submission/facts.json.</p></section>
</main><footer>DDN 0.7.0 · field-guide 0.7 edition (pilot) · every chapter's fixture is checked and rendered at build time; every exercise is executed and undone, hashes recorded.</footer>
<script>document.getElementById('search').addEventListener('input',e=>{const q=e.target.value.toLowerCase();for(const a of document.querySelectorAll('#nav-list a'))a.style.display=a.dataset.text.includes(q)?'':'none';});</script>
</body></html>`;
}

function fieldGuideMd(chapters, meta) {
  const lines = [`# DDN Diagram Field Guide — 0.7 edition (pilot)`,
    ``,
    `Generated by \`tools/build-field-guide.mjs\` from the registry, the example corpus and`,
    `\`standard/submission/facts.json\`. Every chapter fixture is checked and rendered at build`,
    `time; every guided first edit is executed and undone, with both SVG hashes recorded.`,
    ``,
    `- chapters this edition: **${meta.chapters}** (all ${meta.byStatus}) · planned full map: **${meta.plannedChapters}**`,
    `- registry facts: **${F('registry.totalKinds')}** element kinds · **${F('registry.totalRelations')}** relation verbs · **${F('profiles.installed')}** profiles · **${F('profiles.projectionKinds')}** projection kinds`,
    ``];
  for (const ch of chapters) {
    lines.push(`## ${ch.title}`, ``,
      `*${ch.category} · ${ch.status} · \`${ch.entry}\` # \`${ch.view}\` · ${ch.runtime.profile}*`, ``,
      `**What:** ${ch.what}`, `**Why:** ${ch.why}`, `**When:** ${ch.when}`, ``,
      `**Read it:** ${ch.read.join(' ')}`, `**Gather first:** ${ch.inputs.join('; ')}`, ``,
      `**Pitfalls:** ${ch.pitfalls.join(' ')}`, `**Limits:** ${ch.limits}`, ``,
      `**Guided first edit:** ${ch.experiment.expectation} (evidence: ${ch.exerciseEvidence.changed ? 'render changes' : 'NO CHANGE?!'}, undo restores shipped bytes: ${ch.exerciseEvidence.undoRestoresBefore})`, ``);
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------- main -----
fs.mkdirSync(path.join(OUT, 'lessons'), { recursive: true });
const chapters = CHAPTERS.map(buildChapter);
const meta = {
  chapters: chapters.length,
  plannedChapters: PLAN.length,
  byStatus: [...new Set(chapters.map(c => c.status))].join('/'),
};
const catalogue = {
  meta: { edition: 'field-guide-0.7-pilot', runtime: A.VERSION, reviewed: '2026-09-30',
    chapterCount: chapters.length, plannedChapterCount: PLAN.length,
    facts: {
      profiles: F('profiles.installed'), projectionKinds: F('profiles.projectionKinds'),
      totalKinds: F('registry.totalKinds'), totalRelations: F('registry.totalRelations'),
      iconPacks: F('icons.packs'), icons: F('icons.icons'),
    } },
  lessons: chapters,
};
const coverage = {
  meta: catalogue.meta,
  profiles: F('profiles.installed'), projectionKinds: F('profiles.projectionKinds'),
  chapters: chapters.map(c => ({ id: c.id, status: c.status, profile: c.runtime.profile, projection: c.runtime.projection, entry: c.entry, view: c.view, sha256: c.runtime.sha256 })),
  exercises: chapters.map(c => ({ id: c.id, ...c.exerciseEvidence })),
};
const exampleIndex = {
  runtime: A.VERSION,
  examples: chapters.map(c => ({ chapter: c.id, entry: c.entry, view: c.view, files: c.files })),
};
fs.writeFileSync(path.join(OUT, 'catalogue.json'), JSON.stringify(catalogue, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'coverage.json'), JSON.stringify(coverage, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'example-index.json'), JSON.stringify(exampleIndex, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'chapter-plan.json'), JSON.stringify(PLAN, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'FIELD-GUIDE.md'), fieldGuideMd(chapters, meta));
for (const ch of chapters) fs.writeFileSync(path.join(OUT, 'lessons', ch.id + '.html'), lessonHtml(ch));
fs.writeFileSync(path.join(OUT, 'index.html'), indexHtml(chapters, meta));
console.log(`field-guide: ${chapters.length} pilot chapters → ${OUT} (catalogue, coverage, example-index, plan ${PLAN.length}, FIELD-GUIDE.md, ${chapters.length} lesson pages, index)`);
for (const c of chapters) console.log(`  ${c.id}: render ok (${c.runtime.warnings.length} warnings, exercise ${c.exerciseEvidence.changed ? 'changes' : 'NO-CHANGE?!'}, undo-restores=${c.exerciseEvidence.undoRestoresBefore}`);
