/** Trusted catalogue data has the same version boundary as executable packs. */
export interface CatalogueFamilyManifest {
    readonly id: string;
    readonly version: string;
    readonly contract: string;
    readonly codexHash: string;
    readonly hash: string;
    readonly profiles: readonly string[];
}
export interface CatalogueFamily {
    readonly id: string;
    readonly version: string;
    readonly contract: string;
    readonly codexHash: string;
    readonly hash: string;
    readonly profiles: Readonly<Record<string, unknown>>;
}
function freeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const child of Object.values(value)) freeze(child);
    }
    return value;
}
/** A stable codex object with immutable snapshots of installed descriptors.
 * Schema instructions and indexes never change when a family is installed. */
export function createCatalogue(base: Record<string, unknown>, manifests: Readonly<Record<string, CatalogueFamilyManifest>>) {
    const known = base.knownProfiles as Record<string, unknown>;
    let profiles = freeze(base.profiles as Record<string, unknown>);
    const installed = new Map<string, string>([['native', manifests.native!.hash]]);
    Object.defineProperty(base, 'profiles', { enumerable: true, configurable: false, get: () => profiles });
    freeze(base);
    function install(family: CatalogueFamily): void {
        const expected = manifests[family.id];
        if (!expected || family.version !== expected.version || family.contract !== expected.contract || family.codexHash !== expected.codexHash || family.hash !== expected.hash)
            throw new Error('Unsupported catalogue family version or hash: ' + family.id);
        const ids = Object.keys(family.profiles ?? {});
        if (ids.length !== expected.profiles.length || ids.some(id => !expected.profiles.includes(id) || !known[id] || !family.profiles[id] || typeof family.profiles[id] !== 'object' || (family.profiles[id] as Record<string, unknown>).id !== id))
            throw new Error('Catalogue family profile identities differ from manifest: ' + family.id);
        if (installed.has(family.id)) return;
        if (ids.some(id => Object.hasOwn(profiles, id))) throw new Error('Duplicate catalogue profile registration: ' + family.id);
        const combined = { ...profiles, ...family.profiles };
        profiles = freeze(Object.fromEntries(Object.keys(known).filter(id => Object.hasOwn(combined, id)).map(id => [id, combined[id]])));
        installed.set(family.id, family.hash);
    }
    return { compiledCodex: base, installCatalogueFamily: install, installedCatalogueFamilies: (): readonly string[] => Object.freeze([...installed.keys()]) };
}
