/** Lexical dispatch shares the verifier's compiled codex; defaults are never inserted here. */
import { codex, lexicalShapes } from '../../profiles/src/schema-core.js';
import type { LexicalShape } from '../../profiles/src/schema-core.js';
export type Shape = LexicalShape;
function unfold(shape: Shape | undefined): Shape | undefined {
    const seen = new Set<string>();
    while (shape?.$ref) {
        const key = shape.$ref.split('/').at(-1)!;
        if (seen.has(key))
            break;
        seen.add(key);
        shape = lexicalShapes[key];
    }
    return shape;
}
const genericOptions = () => unfold(unfold(lexicalShapes.view_definition)?.properties?.projection)?.properties?.options;
const aliases: Record<string, string> = { boolean: 'bool', timestamp: 'instant' };
export const shapes: Readonly<Record<string, Shape>> = new Proxy(lexicalShapes, {
    get(target, key) {
        if (typeof key !== 'string')
            return undefined;
        const value = target[aliases[key] ?? key];
        if (value)
            return value;
        // Non-native profiles remain parseable against the shared option vocabulary; their
        // specialized verification and rendering still require their registered packs.
        if (key.startsWith('profile_') && Object.hasOwn(codex.knownProfiles, key.slice(8)))
            return genericOptions();
        return undefined;
    },
});
const descriptor = (entry: {
    category: string;
    schema: number;
    core: string;
}) => ({ category: entry.category, schema: 'n' + entry.schema, core: entry.core });
export const roleTypes: Record<string, {
    category: string;
    schema: string;
    core: string;
}> = Object.fromEntries(Object.entries(codex.roles).map(([key, value]) => [key, descriptor(value)]));
export const coreTypes: Record<string, {
    category: string;
    schema: string;
    core: string;
}> = Object.fromEntries(Object.entries(codex.coreTypes).map(([key, value]) => [key, descriptor(value)]));
export const profiles: readonly string[] = Object.keys(codex.knownProfiles);
