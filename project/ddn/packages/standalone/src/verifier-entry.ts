import { createVerifier } from '../../verifier/src/index.js';
import { createNativePack } from '../../profiles/src/native.js';
import { mountShell } from './shell.js';
import type { RuntimeOptions } from '@ddn/types';
import { withBrowserExecutor } from './browser-options.js';
import { createBrowserVerifier } from '../../execution/src/browser-verifier.js';
const createNativeRuntimeOptions = (): RuntimeOptions => ({
    versions: { api: '1.0', language: 'ddn-next-1', defaults: 'ddn-next-1', packs: {} },
    packs: [createNativePack()],
});
export const api = { createVerifier, createNativeRuntimeOptions };
Object.defineProperty(globalThis, 'DDN', { value: Object.freeze(api), configurable: true });
mountShell({ mode: 'verifier', options: () => withBrowserExecutor(createNativeRuntimeOptions()), verifier: createBrowserVerifier });
