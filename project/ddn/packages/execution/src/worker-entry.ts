import type { Budget, CancelToken, ComputeRequest, Executor, RuntimeOptions } from '../../types/src/core.js';
import { createComputeExecutor } from './compute.js';
import { fingerprint } from './index.js';
export const WORKER_CHANNEL = 'ddn.compute.v1';
export interface ComputeMessagePort {
    postMessage(message: unknown): void;
    addEventListener(type: 'message', listener: (event: {
        data: unknown;
    }) => void): void;
    removeEventListener(type: 'message', listener: (event: {
        data: unknown;
    }) => void): void;
}
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function token() { let aborted = false; const listeners = new Set<() => void>(); return { value: { get aborted() { return aborted; }, onAbort(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; } } satisfies CancelToken, abort() { if (aborted)
        return; aborted = true; for (const fn of listeners)
        fn(); listeners.clear(); } }; }
/** Explicit installation keeps imports inert in browsers, workers and headless hosts. */
export function installWorkerServer(port: ComputeMessagePort, executor: Executor): () => void {
    let closed = false;
    const active = new Map<number, ReturnType<typeof token>>();
    const receive = (event: {
        data: unknown;
    }): void => {
        const message = event.data;
        if (!record(message) || message.channel !== WORKER_CHANNEL || !Number.isSafeInteger(message.id))
            return;
        const id = message.id as number;
        if (message.type === 'cancel') {
            active.get(id)?.abort();
            return;
        }
        if (message.type !== 'run' || !record(message.request) || active.has(id) || closed)
            return;
        const request = message.request as unknown as ComputeRequest;
        if (request.protocol !== 1 || typeof request.sessionId !== 'string' || typeof request.jobId !== 'string')
            return;
        // JSON-only request validation also rejects functions and nonfinite payloads before execution.
        try {
            fingerprint(request);
        }
        catch {
            return;
        }
        const cancellation = token();
        active.set(id, cancellation);
        void executor.run(request, { cancel: cancellation.value, ...(record(message.budget) ? { budget: message.budget as unknown as Budget } : {}) }).then(result => {
            if (!closed)
                port.postMessage({ channel: WORKER_CHANNEL, type: 'result', id, result });
        }).catch(error => {
            if (!closed)
                port.postMessage({ channel: WORKER_CHANNEL, type: 'failure', id, message: error instanceof Error ? error.message : 'Worker computation failed' });
        }).finally(() => { active.delete(id); });
    };
    port.addEventListener('message', receive);
    return () => { if (closed)
        return; closed = true; port.removeEventListener('message', receive); for (const job of active.values())
        job.abort(); active.clear(); executor.destroy(); };
}
export function bootComputeWorker(options: RuntimeOptions, port: ComputeMessagePort = globalThis as unknown as ComputeMessagePort): () => void {
    return installWorkerServer(port, createComputeExecutor(options));
}
