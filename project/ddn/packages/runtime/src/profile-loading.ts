import type { ModelSnapshot, Runtime, SourceSet, TaskOptions } from '../../types/src/core.js';
export interface ProfileLoadingHost {
    readonly profiles: readonly { id: string; method: string }[];
    ensure(input: SourceSet | ModelSnapshot | readonly string[], options?: TaskOptions): Promise<void>;
}
const hosts = new WeakMap<Runtime, ProfileLoadingHost>();
/** Distribution-host hook; DDN source cannot supply code or a loading URL. */
export function attachProfileLoadingHost(runtime: Runtime, host: ProfileLoadingHost): void { hosts.set(runtime, host); }
export function profileLoadingHost(runtime: Runtime): ProfileLoadingHost | undefined { return hosts.get(runtime); }
export async function prepareRuntimeProfiles(runtime: Runtime, input: SourceSet | ModelSnapshot | readonly string[], options?: TaskOptions): Promise<void> {
    await hosts.get(runtime)?.ensure(input, options);
}
