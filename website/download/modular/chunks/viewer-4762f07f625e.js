/*! DDN — Diagram Design Notation
 * Copyright (c) 2026 ScratchBird Software Inc. and DDN contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 * Free and open-source software. See LICENSE and NOTICE.md.
 * Sponsored by ScratchBird Software Inc. — https://scratchbird.ca
 * Public project: https://github.com/ScratchBird-Software-Inc/Diagram-Design-Notation
 */
(()=>{"use strict";const runtime=globalThis["DDN_MODULES"];if(!runtime)throw Error("Missing DDN module runtime");runtime.register({"id":"viewer-4762f07f625e","version":"ddn-next-1","releaseHash":"d0156262fe6d1e3538445bd0913a135a4d6aef380002e797f137898b11513f0d","dependencies":["shared-e92b1a849bc6","shared-f72e04c5d58f"],"modules":[{"id":"standalone/src/modular-viewer-entry.js","bytes":550,"sha256":"6a9bc916f20d0ef41e9f3d2c38bdf8e26e74422df02efdfc1d75ea0980b71bfc","dependencies":["standalone/src/modular-viewer-api.js","standalone/src/modular-shell.js"]}],"hash":"390ae4280e508fbbd59a2bf57122c80d90de782ef547f01c0306eb58aad28ade"},{"standalone/src/modular-viewer-entry.js":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const api = require("standalone/src/modular-viewer-api.js");
exports.api = api;
const modular_shell_js_1 = require("standalone/src/modular-shell.js");
const { createBrowserRuntimeOptions, createVerifier, createViewer, getViewerHandle } = api;
(0, modular_shell_js_1.bootModularShell)({ mode: 'viewer', options: createBrowserRuntimeOptions, verifier: createVerifier, viewer: createViewer, getRuntime: viewer => getViewerHandle(viewer).runtime }, api);

}});})();
