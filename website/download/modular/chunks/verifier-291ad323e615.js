/*! DDN — Diagram Design Notation
 * Copyright (c) 2026 ScratchBird Software Inc. and DDN contributors.
 * SPDX-License-Identifier: GPL-2.0-or-later
 * Free and open-source software. See LICENSE and NOTICE.md.
 * Sponsored by ScratchBird Software Inc. — https://scratchbird.ca
 * Public project: https://github.com/ScratchBird-Software-Inc/Diagram-Design-Notation
 */
(()=>{"use strict";const runtime=globalThis["DDN_MODULES"];if(!runtime)throw Error("Missing DDN module runtime");runtime.register({"id":"verifier-291ad323e615","version":"ddn-next-1","releaseHash":"d0156262fe6d1e3538445bd0913a135a4d6aef380002e797f137898b11513f0d","dependencies":["shared-e92b1a849bc6","shared-f58aeb3a29e5"],"modules":[{"id":"standalone/src/modular-verifier-entry.js","bytes":446,"sha256":"08375a6c8f5c789d9d7c660a7bb459f710f3fd3ec0276688b0b624f5e357c742","dependencies":["standalone/src/modular-verifier-api.js","standalone/src/modular-shell.js"]}],"hash":"5ad5f871565d38a615db0f5aef5417704f213ec3661e6b8f4fbfed69d5c590f8"},{"standalone/src/modular-verifier-entry.js":function(module,exports,require){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const api = require("standalone/src/modular-verifier-api.js");
exports.api = api;
const modular_shell_js_1 = require("standalone/src/modular-shell.js");
const { createModularRuntimeOptions, createVerifier } = api;
(0, modular_shell_js_1.bootModularShell)({ mode: 'verifier', options: createModularRuntimeOptions, verifier: createVerifier }, api);

}});})();
