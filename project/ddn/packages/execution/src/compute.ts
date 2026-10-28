import type { ComputeRequest, ComputeResult, Json, Executor, RuntimeOptions, SourceSet, ModelSnapshot, VerifyOptions } from '../../types/src/core.js';
import { decodeSources, type DecodeResult } from '../../language/src/index.js';
import { createVerifier, verifyDecoded } from '../../verifier/src/index.js';
import { createExecutor, fingerprint, type AccountingContext } from './index.js';
/** Internal payload contract shared by worker and cooperative executors. */
export interface DecodePayload {
    sources: SourceSet;
    previous?: DecodeResult;
}
export interface DecodedPayload {
    decoded: DecodeResult;
    fingerprint: string;
}
export interface VerifyPayload {
    diagnostics?: readonly import('../../types/src/core.js').Diagnostic[];
    snapshot: ModelSnapshot;
    options: Pick<VerifyOptions, 'scope' | 'purpose' | 'level' | 'measurement'>;
}
/** Byte copies stay with their source owner; compute messages contain decoded text only. */
export function decodePayload(sources: SourceSet, previous?: DecodeResult): Json {
    const files = sources.files.map(({ originalBytes: _, ...file }) => file);
    const old = previous ? { ...previous, documents: previous.documents.map(document => ({ ...document, file: (({ originalBytes: _, ...file }) => file)(document.file) })) } : undefined;
    return { sources: { entry: sources.entry, files }, ...(old ? { previous: old } : {}) } as unknown as Json;
}
function result(request: ComputeRequest, payload: Json, outcome: ComputeResult['outcome'], diagnostics: ComputeResult['diagnostics'], coverage: ComputeResult['coverage']): ComputeResult {
    const { payload: _, ...echo } = request;
    return { request: echo, payload, outcome, diagnostics, coverage };
}
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
async function decode(request: ComputeRequest, context: AccountingContext): Promise<ComputeResult> {
    if (!record(request.payload) || !record(request.payload.sources) || !Array.isArray(request.payload.sources.files))
        throw Error('Decode requires a sources payload');
    const payload = request.payload as unknown as DecodePayload;
    let bytes = 0;
    for (const file of payload.sources.files) {
        if (typeof file.text !== 'string')
            throw Error('Source text must be a string');
        bytes += file.text.length * 2;
        context.accountMemory(bytes);
        await context.checkpoint(file.text.length);
    }
    const decoded = decodeSources(payload.sources, { ...context.task, ...(payload.previous ? { previous: payload.previous } : {}) });
    context.check();
    const digest = fingerprint(decoded.normalized);
    context.check();
    return result(request, { decoded, fingerprint: digest } as unknown as Json, decoded.syntaxValid ? (decoded.diagnostics.some(d => d.severity === 'error') ? 'incomplete' : 'valid') : 'invalid', decoded.diagnostics, decoded.coverage);
}
/** Both execution modes invoke these exact handlers; host-supplied packs stay trusted code. */
export function createComputeExecutor(options: RuntimeOptions): Executor {
    const { executor: _, ...localOptions } = options;
    const verifier = createVerifier(localOptions);
    const executor = createExecutor({
        decode: async (request, context) => { if (fingerprint(request.versions) !== fingerprint(options.versions))
            throw Error('Compute version set does not match the executor'); return decode(request, context); },
        verify: async (request, context) => {
            if (fingerprint(request.versions) !== fingerprint(options.versions))
                throw Error('Compute version set does not match the executor');
            if (!record(request.payload) || !record(request.payload.snapshot) || !record(request.payload.options))
                throw Error('Verify requires snapshot and options payloads');
            const payload = request.payload as unknown as VerifyPayload;
            const report = await verifyDecoded(verifier, payload.snapshot, { ...payload.options, ...context.task }, payload.diagnostics ?? []);
            context.check();
            return result(request, report as unknown as Json, report.outcome, report.diagnostics, report.coverage);
        },
    });
    return { run: (request, task = {}) => executor.run(request, { ...(options.limits ? { budget: options.limits } : {}), ...task }), destroy() { executor.destroy(); verifier.destroy(); } };
}
