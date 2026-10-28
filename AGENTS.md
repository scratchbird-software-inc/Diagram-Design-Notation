# Current owner direction — 2026-10-28

The owner requests implementation of the public DDN project's migration to the new open-source materials from ScratchWeaver's `project/ddn` and `docs/ddn/website`. This supersedes the historical planning-only task below. Current public contracts are under `standard/` and implementation documentation under `docs/`. No commercial Weaver code or compatibility parser is admitted.

Preserve the dedicated DDN work-area/artifact-routing rules below. Imported maintained regression suites are part of this implementation migration; new exploratory tests and generated outputs remain in the work area. Builds and website generation run from disposable checkouts there.

# DDN agent workspace

This project is independent of other projects. The owner requires every agent working on DDN to use `/home/dcalford/Sandbox/ChatGPT-DDN-WORKAREA` as its dedicated work area. No other project's agents may use that directory.

Before writing artifacts or running builds/tests, read `/home/dcalford/Sandbox/ChatGPT-DDN-WORKAREA/AGENTS.md` and its `README.md`. Keep all working notes, plans, reports, temporary files, new test files and fixtures, logs, caches, browser profiles, builds, and disposable checkouts there. Do not use another project's work area or `/tmp` for agent-created DDN artifacts.

The main repository holds maintained project source and existing project assets. This routing instruction is intentional project configuration. Do not put working artifacts here. Existing scripts can write to repository-relative paths: inspect their destinations and run such scripts from a disposable copy under the DDN work area when output cannot be redirected completely. Do not remove existing tracked tests or assets as a cleanup measure.

Current work is planning language additions before implementation. Plans and candidate syntax live in the work area; they are not implemented or ratified language contracts. Later explicit owner directions take precedence.

The owner has explicitly removed backward compatibility as a constraint: DDN is pre-1.0 with no adopters requiring the current dialect, and its sources, libraries, viewer, designer and verifier may be rewritten together. ScratchRobin's library embedding does not freeze the interface. Do not require legacy grammar support, dual parser modes, compatibility aliases or upgrade/downgrade tooling. Existing code and examples are design evidence; all language/API details may be reconsidered. This freedom does not change the current planning-before-implementation task. Read `planning/2026-10-language-additions/10-dialect-redesign-direction.md` in the work area.

Language design must keep notation short, favor words and existing punctuation, and allow omission of defaulted settings. The owner requires explicit file settings to override CSS, and CSS to override standard defaults. CSS defaults must be scoped by diagram/chart type, including distinct DDN ERD and Chen ERD types. Read the current planning decision register before extending the design.

The owner's work-area hierarchy is part of the design authority: DDN, UML, Chen, electrical and other diagramming methods each define sub-diagram types, symbols, connectors and rules. New-diagram creation selects a method/work area, then an allowed subtype. Verify items and relationships under that contract. The DDN/DDNA/DDNN family connects infrastructure, data architecture, development and management. Product work areas are distinct from the agent artifact directory. Exact work-area namespace mapping and candidate syntax remain proposals in the planning pack.

The latest owner workflow defines a work area as a spatial design surface with placed views; subtypes can have further subtypes. Native DDN supports progressive design with unnamed/name-only entities, draft field text, explicit Columns conversion, selected field details and provisional reusable domains. Draft and validated areas coexist. Status, drawing style, body editor mode and detail visibility are separate. Read `planning/2026-10-language-additions/11-native-ddn-design-surface.md` and `12-assumption-audit.md` in the dedicated work area. Those briefs supersede completed-model, module-first and blanket draft-rejection assumptions. Rules from non-DDN methods must not silently define native DDN. Verification/acceptance scope and shared-edit behavior remain open; the current task is still planning.

The owner subsequently clarified that the ERD and commercial discussion uses are partial examples for building the design skeleton. Read `planning/2026-10-language-additions/13-shared-design-skeleton.md` in the dedicated work area first. Identify shared concepts and correct assumptions; defer detailed workflows, policies, algorithms and acceptance specifications. Do not treat omissions in an example as an immediate specification checklist.

The open-source foundation is standalone single-user client-side JavaScript: a read-only viewer, a designer that uses the viewer and adds editing, and a verifier used by both for logical consistency under DDN rules. The viewer can display changing data or supplied live updates without participating. Multi-user collaboration and interactive design/whiteboard functionality belong to the closed-source expansion with coordinated client/server operation. Preserve this boundary in the skeleton and future planning.
