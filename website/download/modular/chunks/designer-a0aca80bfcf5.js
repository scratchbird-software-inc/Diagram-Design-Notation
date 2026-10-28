/*! DDN — Diagram Design Notation
 * Copyright (c) 2026 ScratchBird Software Inc. and DDN contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 * Free and open-source software. See LICENSE and NOTICE.md.
 * Sponsored by ScratchBird Software Inc. — https://scratchbird.ca
 * Public project: https://github.com/ScratchBird-Software-Inc/Diagram-Design-Notation
 */
(()=>{"use strict";const runtime=globalThis["DDN_MODULES"];if(!runtime)throw Error("Missing DDN module runtime");runtime.register({"id":"designer-a0aca80bfcf5","version":"ddn-next-1","releaseHash":"d0156262fe6d1e3538445bd0913a135a4d6aef380002e797f137898b11513f0d","dependencies":["shared-afb1265e4636","shared-e92b1a849bc6"],"modules":[{"id":"standalone/src/modular-designer-entry.js","bytes":1012,"sha256":"a75890f56164b360b69f6b61e2e575ea72b990351dfe08c5d1281d0b3fa098ee","dependencies":["standalone/src/modular-designer-api.js","standalone/src/modular-shell.js","designer/src/new-diagram.js"]}],"hash":"84e9db3702f8de24ca238f8875ed337304a739c67361acf5712b2862d58a5882"},{"standalone/src/modular-designer-entry.js":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const api = require("standalone/src/modular-designer-api.js");
exports.api = api;
const modular_shell_js_1 = require("standalone/src/modular-shell.js");
const new_diagram_js_1 = require("designer/src/new-diagram.js");
const { createBrowserRuntimeOptions, createVerifier, createViewer, getViewerHandle, createDesigner } = api;
(0, modular_shell_js_1.bootModularShell)({ mode: 'designer', options: createBrowserRuntimeOptions, verifier: createVerifier, viewer: createViewer, getRuntime: viewer => getViewerHandle(viewer).runtime,
    newDiagram: new_diagram_js_1.newDiagramDialog,
    designer: viewer => createDesigner(viewer, { authority: { async authorize(action) {
                const grants = ['model.edit', 'model.verify', 'lifecycle.review', 'lifecycle.accept', 'lifecycle.reopen'];
                return { allowed: grants.includes(action), principal: 'local-user', grants };
            } } }),
}, api);

}});})();
