# DDN execution

GPL-2.0-or-later. The cooperative and worker executors use the adopted compute ABI. JSON capture owns request values before asynchronous work, rejects nonfinite numbers, sparse arrays, functions, accessors and cycles, and does not call getters or `toJSON`. Optional undefined object fields retain omission semantics; canonical ordering and fingerprints of valid JSON are unchanged. Deep freezing traverses already frozen parents. Source byte buffers remain the runtime's separately copied responsibility.

Accounting captures version values and all three finite, nonnegative budget limits. The cancellation token remains live. Invalid memory/work observations cannot disable a resource limit. Cooperative handlers receive an immutable request and are checked before and after execution.

Worker retries retain the submitted request and budget. Once a fallback starts, a late worker result cannot replace it. Worker denial still registers the fallback with the host's cancellation, deadline and destruction fences; fallback exceptions settle the pending operation. The adapter never fetches code. The existing real-worker tests compare normalized decode and verifier output with cooperative execution.

CORE02 tests cover data ownership, deterministic requests, accounting and retry races. They do not qualify the full G03 browser responsiveness/worker termination targets, every browser platform, hostile plugin isolation, or commercial service execution. Those require their own recorded gates.
