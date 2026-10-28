import type { RuntimeOptions } from '@ddn/types';
import { createComputeExecutor } from '../../execution/src/compute.js';
import { createWorkerExecutor } from '../../execution/src/worker-host.js';
/** Inline HTML supplies a trusted Blob worker; CSP-denied hosts use identical local handlers. */
export function withBrowserExecutor(options: RuntimeOptions): RuntimeOptions {
    const host = globalThis as typeof globalThis & {
        __ddnCreateWorker?: (options?: RuntimeOptions) => Worker;
    };
    const executor = createWorkerExecutor({
        createWorker: () => {
            if (!host.__ddnCreateWorker)
                throw new Error('No local worker factory supplied');
            return host.__ddnCreateWorker(options);
        },
        fallback: createComputeExecutor(options),
    });
    return { ...options, executor };
}
