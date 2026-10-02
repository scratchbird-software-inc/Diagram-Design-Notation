// SPDX-License-Identifier: GPL-2.0-or-later. Shared reference-generation
// data + example builders for the DDN element-kind and relation reference.
// Single source of truth consumed by BOTH the wiki reference generator
// (kimi-DDN-workarea gen-reference.mjs) and the website reference section
// (website/build-site.mjs). Everything here is pure data/functions — no IO.

const kwFile = kw => kw.replace(/\./g, '-');
const kwQuote = kw => /^[A-Za-z_][A-Za-z0-9_-]*$/.test(kw) ? kw : `"${kw}"`;


function reqDep(rel, sk, scode, stext, tk, tcode, ttext) {
  const req = (code, text) => code ? ` kind: "req.requirement"; x_diagram: { code: "${code}"; text: "${text}" };` : ` kind: "${sk}"; `;
  const from = sk === 'req.requirement' ? req(scode, stext) : ` kind: "${sk}"; `;
  const to = tk === 'req.requirement' ? req(tcode, ttext) : ` kind: "${tk}"; `;
  return `ddn "0.5";
module "wiki.ref.relations";

// ${rel.name} (${rel.keyword}) between two elements.
data demo {
    object from_side "From" {${from}}
    object to_side "To" {${to}}
    relation shows "${rel.name}" @from_side -> @to_side {
        kind: ${kwQuote(rel.keyword)};
    }
}

view picture "${rel.name}" {
    data: [@demo];
    publication { size: content; }
    legend: off;
    title: off;
    footer: off;
}
`;
}

const REL_EXAMPLE = {
  'sysml.derive': rel => reqDep(rel, 'req.requirement', 'REQ-1', 'The pump shall sustain rated flow.', 'req.requirement', 'REQ-2', 'The pump shall reach rated flow in 500 ms.'),
  'sysml.copy': rel => reqDep(rel, 'req.requirement', 'REQ-1', 'The pump shall sustain rated flow.', 'req.requirement', 'REQ-2', 'The pump shall sustain rated flow.'),
  'sysml.master': rel => reqDep(rel, 'req.requirement', 'REQ-1', 'The pump shall sustain rated flow.', 'req.requirement', 'REQ-2', 'The pump shall sustain rated flow.'),
  'sysml.satisfy': rel => reqDep(rel, 'sysml.block', null, null, 'req.requirement', 'REQ-2', 'The pump shall sustain rated flow.'),
  'sysml.verify': rel => reqDep(rel, 'sysml.testcase', null, null, 'req.requirement', 'REQ-2', 'The pump shall sustain rated flow.'),
  'dmn.inforeq': rel => `ddn "0.5";
module "wiki.ref.relations";

// ${rel.name} (${rel.keyword}) — information flows into the decision.
data demo {
    object from_side "From" { kind: "dmn.inputdata"; }
    object to_side "To" { kind: "dmn.decision"; }
    relation shows "${rel.name}" @from_side -> @to_side {
        kind: ${kwQuote(rel.keyword)};
    }
}

view picture "${rel.name}" {
    data: [@demo];
    publication { size: content; }
    legend: off;
    title: off;
    footer: off;
}
`,
  'dmn.knowledgereq': rel => `ddn "0.5";
module "wiki.ref.relations";

// ${rel.name} (${rel.keyword}) — a business knowledge model the decision calls on.
data demo {
    object from_side "From" { kind: "dmn.bkm"; }
    object to_side "To" { kind: "dmn.decision"; }
    relation shows "${rel.name}" @from_side -> @to_side {
        kind: ${kwQuote(rel.keyword)};
    }
}

view picture "${rel.name}" {
    data: [@demo];
    publication { size: content; }
    legend: off;
    title: off;
    footer: off;
}
`,
  'dmn.authorityreq': rel => `ddn "0.5";
module "wiki.ref.relations";

// ${rel.name} (${rel.keyword}) — the knowledge source governing the decision.
data demo {
    object from_side "From" { kind: "dmn.knowledgesource"; }
    object to_side "To" { kind: "dmn.decision"; }
    relation shows "${rel.name}" @from_side -> @to_side {
        kind: ${kwQuote(rel.keyword)};
    }
}

view picture "${rel.name}" {
    data: [@demo];
    publication { size: content; }
    legend: off;
    title: off;
    footer: off;
}
`,
  'uml.delegation': rel => `ddn "0.5";
module "wiki.ref.relations";

// ${rel.name} (${rel.keyword}) from a boundary port to an internal part.
data demo {
    object box "Box" { kind: "uml.component";
        ports { port api { direction: in; } }
        fields { field engine { x_part: { classifier: "Engine" }; } }
    }
    relation shows "${rel.name}" @box.api -> @box.engine {
        kind: "uml.delegation";
    }
}

view picture "${rel.name}" {
    data: [@demo];
    publication { size: content; }
    legend: off;
    title: off;
    footer: off;
}
`,
};


const KIND_BODY_EXTRA = {
  'req.requirement': '\n        x_diagram: { code: "REQ-1"; text: "The system shall greet the user by name." };',
};


function kindExample(kind, label) {
  const extra = KIND_BODY_EXTRA[kind.keyword];
  const body = extra ? ` kind: ${kwQuote(kind.keyword)};${extra}
    ` : ` kind: ${kwQuote(kind.keyword)}; `;
  return `ddn "0.5";
module "wiki.ref.kinds";

// One ${label} (${kind.keyword}) on its own, drawn by the default graph view.
data demo {
    object example "${label}" {${body}}
}

view picture "${label}" {
    data: [@demo];
    publication { size: content; }
    legend: off;
    title: off;
    footer: off;
}
`;
}


function relExample(rel, opts = {}) {
  const srcKind = opts.source || 'object';
  const tgtKind = opts.target || 'object';
  const marks = rel.family === 'structural'
    ? '\n        source_mark: zeromany;\n        target_mark: one;'
    : '';
  const proj = opts.profile ? `\n    projection { kind: graph; profile: "${opts.profile}"; }` : '';
  const ep = (k, n) => {
    const x = KIND_BODY_EXTRA[k];
    return x ? ` kind: ${kwQuote(k)};${x.replace('REQ-1', 'REQ-' + n)}
    ` : ` kind: ${kwQuote(k)}; `;
  };
  return `ddn "0.5";
module "wiki.ref.relations";

// ${rel.name} (${rel.keyword}) between two elements.
data demo {
    object from_side "From" {${ep(srcKind, 1)}}
    object to_side "To" {${ep(tgtKind, 2)}}
    relation shows "${rel.name}" @from_side -> @to_side {
        kind: ${kwQuote(rel.keyword)};${marks}
    }
}

view picture "${rel.name}" {
    data: [@demo];${proj}
    publication { size: content; }
    legend: off;
    title: off;
    footer: off;
}
`;
}


const SILHOUETTE = {
  rect: 'a rectangle', round: 'a rounded rectangle', terminal: 'a stadium-shaped pill',
  diamond: 'a diamond', ellipse: 'an ellipse', circle: 'a small circle',
  parallelogram: 'a slanted parallelogram', document: 'a rectangle with a wavy bottom edge (a sheet of paper)',
  subprocess: 'a rectangle with double side bars', store: 'an open-topped data-store shape',
  actor: 'a stick figure', package: 'a folder-shaped tab', component: 'a rectangle with the component “plug” tabs',
  hexagon: 'a hexagon', cylinder: 'a database cylinder', offpage: 'a pentagon that points off the page',
  bracket: 'a square bracket that hugs the element it explains', initial: 'a small filled dot',
  final: 'a filled dot inside a ring',
};


const FAMILIES = {
  concept: {
    title: 'Concept & model kinds',
    into: `These kinds are for the *meaning* layer — the business ideas a diagram talks about, before anybody decides how to store or build them. Use them when the argument is "what do we mean by a customer?" rather than "which table is that in?". A concept diagram stays true even when the database underneath changes, which is exactly why you would draw one.`,
    pages: ['Diagrams-ERD', 'Diagrams-ERD-Notation', 'Diagrams-Fishbone', 'Diagrams-States', 'Diagrams-Decision-tables'],
    props: '`description` and `meaning` (plain-language definition), `aliases` (other names people use), `level` (concept / definition / instance), `maturity` (draft → approved), and a stable `uid` so renames don’t break links.',
  },
  sql: {
    title: 'Relational (SQL) kinds',
    into: `These kinds are the vocabulary of a relational database: tables, views, indexes, triggers and friends. They describe *definitions* — the things a \`CREATE\` statement would make — not the live data inside them. Draw them when the conversation is about schema design, migrations, or explaining a database to someone new.`,
    pages: ['Diagrams-ERD', 'Diagrams-ERD-Notation'],
    props: '`fields { field … { key: primary; datatype: …; nullable: false; domain: @…; default: …; } }` for columns, plus `workload` (oltp/olap/…), `role` (authoritative/derived/…), `maturity`, `description` and a stable `uid`.',
  },
  data: {
    title: 'Data structure kinds',
    into: `These kinds describe how data is *shaped* — records, documents, arrays, maps, time series, files, buckets. They sit between the business concepts and any one database: a \`record\` shape can be true of a JSON payload, a table row and a message all at once. Reach for these when the question is "what does this data look like?"`,
    pages: ['Diagrams-ERD', 'Diagrams-Data-flow'],
    props: '`datatype`, `representation`, `shape` (scalar/object/array/map/set/variant), nested `fields { … }`, plus `role`, `workload`, `maturity`, `description` and `uid`.',
  },
  analytics: {
    title: 'Analytics & reporting kinds',
    into: `These kinds are the vocabulary of the reporting world: facts, dimensions, cubes, metrics, dashboards, data products. They describe *analytic roles* — a fact table is a role a dataset plays, with a grain and measures — not a particular vendor’s feature. Use them for star schemas, metric layers and "where does this number come from?" diagrams.`,
    pages: ['Diagrams-Dashboards', 'Diagrams-Charts', 'Diagrams-Matrices'],
    props: '`description` and `meaning` (the formula or grain in words), `role`, `maturity`, `freshness`-style notes via relations, and a stable `uid`.',
  },
  interface: {
    title: 'Interface & messaging kinds',
    into: `These kinds describe the places where systems *talk*: APIs, endpoints, topics, queues, messages, webhooks. An interface kind is a promise about shape and behaviour, not a running server — deployment is drawn separately with the deployment kinds. Use these for integration diagrams and event-driven designs.`,
    pages: ['Diagrams-Architecture', 'Diagrams-Data-flow', 'Diagrams-Sequence'],
    props: '`dialect` (payload format), `parameters`, `payload` shape, `description`, `maturity` and a stable `uid`.',
  },
  activity: {
    title: 'Activity & process kinds',
    into: `These kinds describe *doing*: activities, pipelines, jobs, runs, schedules — and the classic flowchart shapes (start, process, decision) that profiles like \`flow.basic@1\` dress up. Use them whenever the diagram tells a story in time: steps, hand-offs, branches, retries.`,
    pages: ['Diagrams-Flowcharts', 'Diagrams-Flowcharts-Decisions', 'Diagrams-Data-flow', 'Diagrams-Architecture'],
    props: '`description`, `parameters`, `owner`, `maturity`, and on relations between them the control verbs ([control relations](Ref-Relations-Control)).',
  },
  namespace: {
    title: 'Namespace & catalog kinds',
    into: `These kinds are the "where it lives by name" boxes: catalogs, databases, schemas, keyspaces, folders. A namespace is a naming scope, *not* a server — the same schema can be deployed to many hosts. That separation is the whole point: name things here, place them with the deployment kinds.`,
    pages: ['Diagrams-ERD', 'Diagrams-Architecture'],
    props: '`platform` and `platform_version` when the platform matters, plus `description`, `maturity` and `uid`.',
  },
  deployment: {
    title: 'Deployment & infrastructure kinds',
    into: `These kinds are the physical world: clouds, regions, zones, hosts, containers, volumes, devices. They answer "where does it actually run?" Draw them for deployment views, network overviews and residency conversations — and remember a box around boxes only means a boundary if a kind says so.`,
    pages: ['Diagrams-Architecture-Advanced', 'Diagrams-Networks', 'Diagrams-Isometric'],
    props: '`provider`, `region`, `environment`, `location` (local/cloud/edge), `residency`, plus `description` and `uid`.',
  },
  distribution: {
    title: 'Distribution & replication kinds',
    into: `These kinds describe how one logical dataset is *spread out*: partitions, shards, replicas, caches, logs, routers. The careful distinction DDN keeps here is logical vs physical — a shard is a fragment of the data; a replica is a deployed copy of it. Use these for scaling and resilience designs.`,
    pages: ['Diagrams-Architecture-Advanced'],
    props: '`partition_key`, `partition_rule`, `distribution` (hash/range/list/…), `replication_factor`, `replica_role`, `consistency`, plus `description` and `uid`.',
  },
  temporal: {
    title: 'Time & lifecycle kinds',
    into: `These kinds capture data *at a time*: snapshots, backups, archives, timelines, recovery plans, retention rules. They make the difference between "a backup exists" and "a backup we can actually restore from" visible — coverage, window and policy are stated, not hoped for.`,
    pages: ['Diagrams-Timelines'],
    props: '`snapshot_at`, `recovery_window`, `cadence`, plus `description`, `maturity` and `uid`.',
  },
  governance: {
    title: 'Governance & responsibility kinds',
    into: `These kinds name the *who and the rules*: organizations, teams, roles, contracts, policies, classifications, entitlements. Governance relations (who owns what, which policy applies where) turn a picture of boxes into a picture of accountability.`,
    pages: ['Diagrams-Matrices', 'Diagrams-Architecture', 'Diagrams-Trees'],
    props: '`owner`, `classification`, `contract`, `quality`, `scope`, plus `description`, `maturity` and `uid`.',
  },
  evidence: {
    title: 'Evidence & documentation kinds',
    into: `These kinds are the honest margin notes of a model: notes, samples, fixtures, decisions, open issues, observations. They matter because diagrams lie by omission — an \`issue\` box says "this is *not* decided yet" in a way a missing box never can.`,
    pages: ['Diagrams-Fishbone', 'Diagrams-Decision-tables'],
    props: '`source`, `observed_at`, `confidence`, `expected` (for fixtures), `state`, and for samples the required `columns:` / `rows:` grid, plus `description` and `uid`.',
  },
};


function kindLooks(k, family) {
  if (k.silhouette) {
    const s = SILHOUETTE[k.silhouette] || `a ${k.silhouette} shape`;
    return `Drawn as ${s}. The exact look comes from the diagram profile — hand-drawn and neo styles redraw the same kind, they never change what it *is*.`;
  }
  const shape = { card: 'a titled card', pill: 'a small pill', badge: 'a small badge' }[k.shape] || `a ${k.shape} shape`;
  const famNice = { sql: 'SQL' }[family] || family[0].toUpperCase() + family.slice(1);
  return `Drawn as ${shape} in the ${famNice} family colour. Hand-drawn and neo styles redraw the same kind — style changes the look, never the meaning.`;
}


function profilesFor(prof, kw) {
  const i = kw.indexOf('.');
  if (i < 0) return [];
  const ns = kw.slice(0, i);
  return prof.profiles.filter(p => p.id.startsWith(ns + '.')).map(p => p.id);
}


function kindSection(prof, k, family, svgRel, pageLinks) {
  const name = k.text_label || k.name;
  const L = [];
  L.push(`### ${name} (\`${k.keyword}\`)`);
  L.push('');
  L.push(`![The ${name} symbol](${svgRel})`);
  L.push('');
  L.push(`**What it looks like.** ${kindLooks(k, family)}`);
  L.push('');
  const meaning = k.meaning ? k.meaning.replace(/\.$/, '') : `${name} — a ${family} kind.`;
  L.push(`**What it represents.** ${meaning}.`);
  L.push('');
  const profiles = profilesFor(prof, k.keyword);
  const bits = [];
  if (pageLinks.length) bits.push(`diagram pages: ${pageLinks.join(', ')}`);
  if (profiles.length) bits.push(`profiles such as ${profiles.slice(0, 3).map(p => '`' + p + '`').join(', ')}`);
  if (bits.length) {
    L.push(`**Where it shows up.** ${bits.join('; ')}.`);
    L.push('');
  }
  L.push(`**What you can add.** Everything optional: ${FAMILIES[family].props}`);
  L.push('');
  L.push('**Example.** Paste it into the [tool’s source drawer](Guide-Using-the-tool) and Apply:');
  L.push('');
  L.push('```');
  L.push(kindExample(k, name).trimEnd());
  L.push('```');
  L.push('');
  return L.join('\n');
}


const REL_FAMILIES = {
  structural: {
    title: 'Structural relations', file: 'Ref-Relations-Structural',
    into: `Structural relations say two *things* belong together: a purchase belongs to a customer, a wheel is part of a car, a savings account is a kind of account. Nothing moves along these lines — they state how the world is arranged. This is the only relation family that may carry **cardinality marks** (crow’s feet, bars and circles) at its ends.`,
    marks: `Structural relations accept the participation marks \`one\`, \`zeroone\`, \`many\`, \`zeromany\` (crow’s-foot cardinality), plus \`diamond\` (containment — the diamond sits at the *container* end) and \`triangle\` (points at the more general type). Set them with \`source_mark:\` / \`target_mark:\`. Any other mark on a structural relation is an error (DDN114), and these marks on any *other* family are an error too.`,
  },
  flow: {
    title: 'Flow (data movement) relations', file: 'Ref-Relations-Flow',
    into: `Flow relations say *data moves this way*: read, write, replicate, publish, load, sync. The arrow points the way the bytes travel. A flow says nothing about *how* it moves — mechanism, schedule and guarantees are separate properties, so “replicates” and “replicates every 5 minutes over TLS” are the same line with different notes.`,
    marks: `Flow relations end in a **filled arrow** (forward payload movement). Cardinality marks are not allowed here — the line is about movement, not participation. Label the line with what travels (“orders”, “nightly snapshot”).`,
  },
  dependency: {
    title: 'Dependency & reference relations', file: 'Ref-Relations-Dependency',
    into: `Dependency relations say *needs*: this report needs that dataset, this service calls that API, this field uses that domain. A dependency does **not** say data moves — that’s what flow relations are for. Dependency lines are dashed with an open arrow, so a reader can tell “talks to” from “sends to” at a glance.`,
    marks: `Dependency relations end in an **open arrow** — direction of need, read the verb. No cardinality marks. Labels name the nature of the need (“reads schema”, “onboarding queries”).`,
  },
  mapping: {
    title: 'Mapping & representation relations', file: 'Ref-Relations-Mapping',
    into: `Mapping relations say *this stands for that*: a table represents a business entity, a field binds to a domain, a copy is a copy *of*. They are the glue between the meaning layer and the building layers — the lines that let one model serve an ER diagram and a concept diagram without drifting apart.`,
    marks: `Mapping relations end in an **open arrow** pointing at the thing being represented or bound. No cardinality marks. Labels name the mapping when the verb alone isn’t enough.`,
  },
  control: {
    title: 'Control & orchestration relations', file: 'Ref-Relations-Control',
    into: `Control relations say *what happens next*: triggers, schedules, precedes, retries, cancels. These are the arrows of flowcharts, state machines and job orchestration. They move *control*, not data — an order to start, a signal that something finished.`,
    marks: `Control relations end in a **filled arrow** (forward control). Flowchart branches off a decision must be labelled — that’s a profile rule (\`flow.basic@1\`, error DDN-PF009), because an unlabelled exit is where processes go to be misunderstood.`,
  },
  lineage: {
    title: 'Lineage & derivation relations', file: 'Ref-Relations-Lineage',
    into: `Lineage relations say *where this came from*: derives from, aggregates, joins, filters, masks. They answer the auditor’s favourite question — “says who?” — by tracing a number back to its sources. Lineage reads backwards along the arrows: start at the report, walk to the raw data.`,
    marks: `Lineage relations end in a **filled arrow** pointing the way derivation flows (source → derived). No cardinality marks. Labels name the transformation when it isn’t obvious (“daily rollup”, “PII masked”).`,
  },
  governance: {
    title: 'Governance & responsibility relations', file: 'Ref-Relations-Governance',
    into: `Governance relations attach *people and rules* to things: owns, stewards, operates, grants, classifies, retains. They’re what turns an architecture sketch into something an organization can act on — every box with an owner is a box someone can be asked about.`,
    marks: `Governance relations end in an **open arrow** pointing at the governed thing. No cardinality marks. Labels can carry scope (“production only”, “EU residents”).`,
  },
  annotation: {
    title: 'Annotation relations', file: 'Ref-Relations-Annotation',
    into: `Annotation relations attach *commentary* to the model: notes, examples, evidence, decisions, open issues. An annotation never changes what the model means — it explains it. Reach for these whenever the diagram needs an honest margin note instead of another fact.`,
    marks: `Annotation relations are plain lines (no arrow) — a note doesn’t act on anything. No cardinality marks. The note element itself carries the text.`,
  },
};


const ROUTING_NOTE = `**Routing, bends and crossings.** DDN routes relation lines for you. When a crossing bothers you, prefer a hint over a pin: \`route { via: [ … ]; source_side: …; target_side: …; }\` nudges a line’s path, and the view’s \`layout { crossings: gap | bridge | square_bridge; }\` picks how crossings are drawn. A crossing is **never** a connection — only a filled *junction* dot joins lines, and junctions are declared, never guessed. Full list: [Layout and appearance](Guide-Layout-and-appearance).`;


function relSection(r, svgRel, exampleSrc, extra) {
  const L = [];
  L.push(`### ${r.name} (\`${r.keyword}\`)`);
  L.push('');
  L.push(`![What the “${r.name}” line looks like](${svgRel})`);
  L.push('');
  const ends = [];
  if (r.start && r.start !== 'none') ends.push(`starts with a ${r.start} mark`);
  if (r.end && r.end !== 'none') ends.push(`ends with a ${r.end === 'filled' ? 'filled arrowhead' : r.end === 'open' ? 'open arrowhead' : r.end + ' mark'}`);
  const dir = r.direction || (ends.length ? `It ${ends.join(' and ')} — read it in the arrow direction: “From → To”.` : 'It has no arrowheads — the relation is symmetric in meaning; the label does the talking.');
  const meaning = r.meaning ? r.meaning.replace(/\.$/, '') : (r.verb || r.name);
  L.push(`**What it means.** ${meaning}. ${dir}`);
  L.push('');
  if (extra) { L.push(extra); L.push(''); }
  L.push('**Example.** Paste it into the [tool’s source drawer](Guide-Using-the-tool) and Apply:');
  L.push('');
  L.push('```');
  L.push(exampleSrc.trimEnd());
  L.push('```');
  L.push('');
  return L.join('\n');
}


function anchor(name, kw) {
  // GitHub-style heading anchor for "### Name (`kw`)"
  return (name + ' (\`' + kw + '\`)').toLowerCase()
    .replace(/[`()]/g, '').replace(/\./g, '').replace(/\s+/g, '-');
}


export {
  kwFile, kwQuote, reqDep, REL_EXAMPLE, KIND_BODY_EXTRA, kindExample, relExample,
  SILHOUETTE, FAMILIES, kindLooks, profilesFor, kindSection, REL_FAMILIES,
  ROUTING_NOTE, relSection, anchor,
};
