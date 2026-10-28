# Complete DDN profile coverage

The complete distribution contains all 151 adopted profile contracts. The table links each profile to its exact bounded scope and exclusions. It is an implementation index, not certification against the full external standards.

Every row is exercised by maintained tests for new-dialect source decoding, structural and semantic verification, defaults and finite projection geometry; every row is also exercised in Chromium with real worker transport and offline SVG capture. A separate authoring test creates an empty draft, adds its first primary item, and checks undo/redo. Family-specific tests cover notation, transformations, calculations and invalid inputs beyond these per-profile smoke checks.

| Evidence | Maintained source |
| --- | --- |
| All-profile source and projection | [Integration tests](../../project/tests/ddn/profiles/integration.test.mjs) |
| All-profile progressive authoring | [Editing tests](../../project/tests/ddn/profiles/editing.test.mjs) |
| Browser, worker and SVG capture | [Complete browser tests](../../project/tests/ddn/browser/complete.browser.mjs) |
| Graph notation and layouts | [Graph tests](../../project/tests/ddn/browser/graph-profiles.test.mjs) |
| Data projections | [Data tests](../../project/tests/ddn/browser/data-profiles.test.mjs) |
| Semantic rules and bounded analysis | [Verification tests](../../project/tests/ddn/verification/) |

| Profile | Projection | Primary roles | Relation roles | Bounded contract |
| --- | --- | ---: | ---: | --- |
| `ddn@1` | graph | 153 | 185 | [Scope and exclusions](../../website/reference/profiles/ddn-1.html) |
| `flow.basic@1` | graph | 7 | 1 | [Scope and exclusions](../../website/reference/profiles/flow-basic-1.html) |
| `dfd.gane_sarson@1` | graph | 3 | 1 | [Scope and exclusions](../../website/reference/profiles/dfd-gane-sarson-1.html) |
| `dfd.yourdon@1` | graph | 3 | 1 | [Scope and exclusions](../../website/reference/profiles/dfd-yourdon-1.html) |
| `uml.structure@1` | graph | 4 | 9 | [Scope and exclusions](../../website/reference/profiles/uml-structure-1.html) |
| `uml.structure@2` | graph | 5 | 9 | [Scope and exclusions](../../website/reference/profiles/uml-structure-2.html) |
| `uml.deployment@1` | graph | 5 | 4 | [Scope and exclusions](../../website/reference/profiles/uml-deployment-1.html) |
| `uml.composite@1` | graph | 4 | 7 | [Scope and exclusions](../../website/reference/profiles/uml-composite-1.html) |
| `uml.usecase@1` | graph | 2 | 4 | [Scope and exclusions](../../website/reference/profiles/uml-usecase-1.html) |
| `requirements.basic@1` | graph | 3 | 3 | [Scope and exclusions](../../website/reference/profiles/requirements-basic-1.html) |
| `chen.basic@1` | chen | 1 | 2 | [Scope and exclusions](../../website/reference/profiles/chen-basic-1.html) |
| `matrix.raci@1` | matrix | 5 | 2 | [Scope and exclusions](../../website/reference/profiles/matrix-raci-1.html) |
| `matrix.crud@1` | matrix | 7 | 3 | [Scope and exclusions](../../website/reference/profiles/matrix-crud-1.html) |
| `matrix.relations@1` | matrix | 153 | 185 | [Scope and exclusions](../../website/reference/profiles/matrix-relations-1.html) |
| `panels.basic@1` | panels | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/panels-basic-1.html) |
| `canvas.bmc@1` | panels | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/canvas-bmc-1.html) |
| `canvas.lean@1` | panels | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/canvas-lean-1.html) |
| `canvas.pest@1` | panels | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/canvas-pest-1.html) |
| `canvas.pestle@1` | panels | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/canvas-pestle-1.html) |
| `canvas.porter5@1` | panels | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/canvas-porter5-1.html) |
| `canvas.empathy@1` | panels | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/canvas-empathy-1.html) |
| `canvas.scorecard@1` | panels | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/canvas-scorecard-1.html) |
| `table.records@1` | table | 153 | 1 | [Scope and exclusions](../../website/reference/profiles/table-records-1.html) |
| `chart.basic@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-basic-1.html) |
| `chart.radar@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-radar-1.html) |
| `chart.funnel@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-funnel-1.html) |
| `timeline.basic@1` | timeline | 153 | 3 | [Scope and exclusions](../../website/reference/profiles/timeline-basic-1.html) |
| `fishbone.basic@1` | fishbone | 3 | 1 | [Scope and exclusions](../../website/reference/profiles/fishbone-basic-1.html) |
| `matrix.heatmap@1` | matrix | 153 | 185 | [Scope and exclusions](../../website/reference/profiles/matrix-heatmap-1.html) |
| `chart.quality@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-quality-1.html) |
| `state.flat@1` | graph | 3 | 1 | [Scope and exclusions](../../website/reference/profiles/state-flat-1.html) |
| `decision.rules@1` | decision | 1 | 0 | [Scope and exclusions](../../website/reference/profiles/decision-rules-1.html) |
| `panels.composed@1` | panels | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/panels-composed-1.html) |
| `uml.usecase@2` | graph | 3 | 4 | [Scope and exclusions](../../website/reference/profiles/uml-usecase-2.html) |
| `uml.usecase@3` | graph | 3 | 4 | [Scope and exclusions](../../website/reference/profiles/uml-usecase-3.html) |
| `chen.binary@2` | chen | 1 | 2 | [Scope and exclusions](../../website/reference/profiles/chen-binary-2.html) |
| `chen.nary@3` | chen | 1 | 2 | [Scope and exclusions](../../website/reference/profiles/chen-nary-3.html) |
| `flow.documented@2` | graph | 11 | 3 | [Scope and exclusions](../../website/reference/profiles/flow-documented-2.html) |
| `chart.gauge@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-gauge-1.html) |
| `chart.candlestick@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-candlestick-1.html) |
| `chart.treemap@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-treemap-1.html) |
| `chart.sankey@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-sankey-1.html) |
| `c4.context@1` | graph | 2 | 1 | [Scope and exclusions](../../website/reference/profiles/c4-context-1.html) |
| `c4.container@1` | graph | 5 | 1 | [Scope and exclusions](../../website/reference/profiles/c4-container-1.html) |
| `c4.component@1` | graph | 5 | 1 | [Scope and exclusions](../../website/reference/profiles/c4-component-1.html) |
| `org.tree@1` | graph | 4 | 1 | [Scope and exclusions](../../website/reference/profiles/org-tree-1.html) |
| `wbs.tree@1` | graph | 1 | 1 | [Scope and exclusions](../../website/reference/profiles/wbs-tree-1.html) |
| `mindmap.basic@1` | graph | 4 | 1 | [Scope and exclusions](../../website/reference/profiles/mindmap-basic-1.html) |
| `concept.map@1` | graph | 4 | 2 | [Scope and exclusions](../../website/reference/profiles/concept-map-1.html) |
| `epc.basic@1` | graph | 3 | 1 | [Scope and exclusions](../../website/reference/profiles/epc-basic-1.html) |
| `matrix.bcg@1` | matrix | 153 | 185 | [Scope and exclusions](../../website/reference/profiles/matrix-bcg-1.html) |
| `matrix.ansoff@1` | matrix | 153 | 185 | [Scope and exclusions](../../website/reference/profiles/matrix-ansoff-1.html) |
| `matrix.tows@1` | matrix | 153 | 185 | [Scope and exclusions](../../website/reference/profiles/matrix-tows-1.html) |
| `panels.journey@1` | panels | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/panels-journey-1.html) |
| `matrix.storymap@1` | matrix | 3 | 1 | [Scope and exclusions](../../website/reference/profiles/matrix-storymap-1.html) |
| `erd.crowfoot@1` | graph | 5 | 2 | [Scope and exclusions](../../website/reference/profiles/erd-crowfoot-1.html) |
| `panels.pyramid@1` | panels | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/panels-pyramid-1.html) |
| `panels.venn@1` | panels | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/panels-venn-1.html) |
| `uml.sequence@1` | sequence | 5 | 1 | [Scope and exclusions](../../website/reference/profiles/uml-sequence-1.html) |
| `uml.sequence@2` | sequence | 5 | 1 | [Scope and exclusions](../../website/reference/profiles/uml-sequence-2.html) |
| `uml.communication@1` | graph | 5 | 2 | [Scope and exclusions](../../website/reference/profiles/uml-communication-1.html) |
| `uml.communication@2` | graph | 5 | 1 | [Scope and exclusions](../../website/reference/profiles/uml-communication-2.html) |
| `uml.object@1` | graph | 3 | 3 | [Scope and exclusions](../../website/reference/profiles/uml-object-1.html) |
| `uml.object@2` | graph | 3 | 2 | [Scope and exclusions](../../website/reference/profiles/uml-object-2.html) |
| `state.composite@1` | graph | 3 | 1 | [Scope and exclusions](../../website/reference/profiles/state-composite-1.html) |
| `uml.statemachine@1` | graph | 11 | 1 | [Scope and exclusions](../../website/reference/profiles/uml-statemachine-1.html) |
| `uml.activity@1` | graph | 6 | 1 | [Scope and exclusions](../../website/reference/profiles/uml-activity-1.html) |
| `uml.activity@2` | graph | 12 | 1 | [Scope and exclusions](../../website/reference/profiles/uml-activity-2.html) |
| `bpmn.basic@1` | graph | 6 | 3 | [Scope and exclusions](../../website/reference/profiles/bpmn-basic-1.html) |
| `bpmn.process@1` | graph | 12 | 4 | [Scope and exclusions](../../website/reference/profiles/bpmn-process-1.html) |
| `bpmn.choreography@1` | graph | 5 | 4 | [Scope and exclusions](../../website/reference/profiles/bpmn-choreography-1.html) |
| `bpmn.conversation@1` | graph | 3 | 1 | [Scope and exclusions](../../website/reference/profiles/bpmn-conversation-1.html) |
| `uml.timing@1` | timing | 4 | 1 | [Scope and exclusions](../../website/reference/profiles/uml-timing-1.html) |
| `uml.timing@2` | timing | 4 | 1 | [Scope and exclusions](../../website/reference/profiles/uml-timing-2.html) |
| `uml.interaction_overview@1` | graph | 6 | 2 | [Scope and exclusions](../../website/reference/profiles/uml-interaction-overview-1.html) |
| `uml.interaction_overview@2` | graph | 6 | 2 | [Scope and exclusions](../../website/reference/profiles/uml-interaction-overview-2.html) |
| `uml.profile@1` | graph | 4 | 6 | [Scope and exclusions](../../website/reference/profiles/uml-profile-1.html) |
| `cmmn.basic@1` | graph | 3 | 3 | [Scope and exclusions](../../website/reference/profiles/cmmn-basic-1.html) |
| `cmmn.complete@1` | graph | 11 | 2 | [Scope and exclusions](../../website/reference/profiles/cmmn-complete-1.html) |
| `sysml.bdd@1` | graph | 2 | 4 | [Scope and exclusions](../../website/reference/profiles/sysml-bdd-1.html) |
| `sysml.ibd@1` | graph | 2 | 4 | [Scope and exclusions](../../website/reference/profiles/sysml-ibd-1.html) |
| `sysml.parametric@1` | graph | 2 | 4 | [Scope and exclusions](../../website/reference/profiles/sysml-parametric-1.html) |
| `archimate.basic@1` | graph | 9 | 1 | [Scope and exclusions](../../website/reference/profiles/archimate-basic-1.html) |
| `pert.cpm@1` | graph | 1 | 1 | [Scope and exclusions](../../website/reference/profiles/pert-cpm-1.html) |
| `fault.tree@1` | graph | 2 | 1 | [Scope and exclusions](../../website/reference/profiles/fault-tree-1.html) |
| `event.tree@1` | graph | 2 | 1 | [Scope and exclusions](../../website/reference/profiles/event-tree-1.html) |
| `network.basic@1` | graph | 3 | 1 | [Scope and exclusions](../../website/reference/profiles/network-basic-1.html) |
| `network.rack@1` | graph | 4 | 1 | [Scope and exclusions](../../website/reference/profiles/network-rack-1.html) |
| `wireframe.ui@1` | graph | 7 | 1 | [Scope and exclusions](../../website/reference/profiles/wireframe-ui-1.html) |
| `family.tree@1` | graph | 2 | 2 | [Scope and exclusions](../../website/reference/profiles/family-tree-1.html) |
| `chart.histogram@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-histogram-1.html) |
| `chart.density@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-density-1.html) |
| `chart.qq@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-qq-1.html) |
| `chart.quantiledot@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-quantiledot-1.html) |
| `chart.dotplot@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-dotplot-1.html) |
| `chart.boxplot@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-boxplot-1.html) |
| `chart.violin@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-violin-1.html) |
| `chart.beeswarm@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-beeswarm-1.html) |
| `chart.topk@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-topk-1.html) |
| `chart.tidytree@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-tidytree-1.html) |
| `chart.radialtree@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-radialtree-1.html) |
| `chart.circlepack@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-circlepack-1.html) |
| `chart.sunburst@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-sunburst-1.html) |
| `chart.packedbubble@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-packedbubble-1.html) |
| `chart.heatmap@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-heatmap-1.html) |
| `chart.densityheatmap@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-densityheatmap-1.html) |
| `chart.calendar@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-calendar-1.html) |
| `chart.parallelcoords@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-parallelcoords-1.html) |
| `chart.wordcloud@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-wordcloud-1.html) |
| `chart.arc@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-arc-1.html) |
| `chart.force@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-force-1.html) |
| `chart.edgebundle@1` | chart | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/chart-edgebundle-1.html) |
| `geo.choropleth@1` | geo | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/geo-choropleth-1.html) |
| `geo.symbols@1` | geo | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/geo-symbols-1.html) |
| `geo.outline@1` | geo | 153 | 0 | [Scope and exclusions](../../website/reference/profiles/geo-outline-1.html) |
| `sysml.requirements@1` | graph | 4 | 11 | [Scope and exclusions](../../website/reference/profiles/sysml-requirements-1.html) |
| `sysml.bdd@2` | graph | 6 | 12 | [Scope and exclusions](../../website/reference/profiles/sysml-bdd-2.html) |
| `sysml.ibd@2` | graph | 6 | 12 | [Scope and exclusions](../../website/reference/profiles/sysml-ibd-2.html) |
| `sysml.parametric@2` | graph | 6 | 12 | [Scope and exclusions](../../website/reference/profiles/sysml-parametric-2.html) |
| `sysml.package@1` | graph | 1 | 3 | [Scope and exclusions](../../website/reference/profiles/sysml-package-1.html) |
| `sysml.usecase@1` | graph | 3 | 4 | [Scope and exclusions](../../website/reference/profiles/sysml-usecase-1.html) |
| `sysml.activity@1` | graph | 12 | 1 | [Scope and exclusions](../../website/reference/profiles/sysml-activity-1.html) |
| `sysml.sequence@1` | sequence | 5 | 1 | [Scope and exclusions](../../website/reference/profiles/sysml-sequence-1.html) |
| `sysml.statemachine@1` | graph | 11 | 1 | [Scope and exclusions](../../website/reference/profiles/sysml-statemachine-1.html) |
| `dmn.drd@1` | graph | 5 | 3 | [Scope and exclusions](../../website/reference/profiles/dmn-drd-1.html) |
| `soaml.services@1` | graph | 7 | 8 | [Scope and exclusions](../../website/reference/profiles/soaml-services-1.html) |
| `uaf.strategic@1` | graph | 4 | 12 | [Scope and exclusions](../../website/reference/profiles/uaf-strategic-1.html) |
| `uaf.operational@1` | graph | 4 | 12 | [Scope and exclusions](../../website/reference/profiles/uaf-operational-1.html) |
| `uaf.services@1` | graph | 3 | 12 | [Scope and exclusions](../../website/reference/profiles/uaf-services-1.html) |
| `uaf.systems@1` | graph | 3 | 12 | [Scope and exclusions](../../website/reference/profiles/uaf-systems-1.html) |
| `uaf.personnel@1` | graph | 4 | 12 | [Scope and exclusions](../../website/reference/profiles/uaf-personnel-1.html) |
| `uaf.resources@1` | graph | 4 | 12 | [Scope and exclusions](../../website/reference/profiles/uaf-resources-1.html) |
| `uaf.security@1` | graph | 4 | 12 | [Scope and exclusions](../../website/reference/profiles/uaf-security-1.html) |
| `uaf.projects@1` | graph | 3 | 12 | [Scope and exclusions](../../website/reference/profiles/uaf-projects-1.html) |
| `uaf.standards@1` | graph | 3 | 12 | [Scope and exclusions](../../website/reference/profiles/uaf-standards-1.html) |
| `uaf.actualresources@1` | graph | 3 | 12 | [Scope and exclusions](../../website/reference/profiles/uaf-actualresources-1.html) |
| `uaf.dictionary@1` | graph | 1 | 12 | [Scope and exclusions](../../website/reference/profiles/uaf-dictionary-1.html) |
| `uaf.summary@1` | graph | 3 | 12 | [Scope and exclusions](../../website/reference/profiles/uaf-summary-1.html) |
| `flow.iso5807@1` | graph | 20 | 1 | [Scope and exclusions](../../website/reference/profiles/flow-iso5807-1.html) |
| `c4.deployment@1` | graph | 5 | 4 | [Scope and exclusions](../../website/reference/profiles/c4-deployment-1.html) |
| `c4.dynamic@1` | graph | 5 | 1 | [Scope and exclusions](../../website/reference/profiles/c4-dynamic-1.html) |
| `epc.complete@1` | graph | 7 | 4 | [Scope and exclusions](../../website/reference/profiles/epc-complete-1.html) |
| `msc.basic@1` | sequence | 6 | 1 | [Scope and exclusions](../../website/reference/profiles/msc-basic-1.html) |
| `idef0.basic@1` | graph | 1 | 2 | [Scope and exclusions](../../website/reference/profiles/idef0-basic-1.html) |
| `petri.basic@1` | graph | 2 | 3 | [Scope and exclusions](../../website/reference/profiles/petri-basic-1.html) |
| `orm.basic@1` | graph | 3 | 4 | [Scope and exclusions](../../website/reference/profiles/orm-basic-1.html) |
| `vsm.basic@1` | graph | 7 | 5 | [Scope and exclusions](../../website/reference/profiles/vsm-basic-1.html) |
| `sdl.basic@1` | graph | 4 | 2 | [Scope and exclusions](../../website/reference/profiles/sdl-basic-1.html) |
| `sdl.process@1` | graph | 13 | 1 | [Scope and exclusions](../../website/reference/profiles/sdl-process-1.html) |
| `fbd.basic@1` | graph | 2 | 1 | [Scope and exclusions](../../website/reference/profiles/fbd-basic-1.html) |
| `ladder.basic@1` | graph | 7 | 2 | [Scope and exclusions](../../website/reference/profiles/ladder-basic-1.html) |
