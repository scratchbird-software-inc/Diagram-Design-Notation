import { readFileSync, realpathSync, statSync } from 'node:fs';
import { relative, resolve, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest('hex');
const factory = module => 'function(module,exports,require){\n' + module.code + '\n}';
const factories = (graph, ids) => '{' + [...ids].map(id => JSON.stringify(id) + ':' + factory(graph.modules.get(id))).join(',\n') + '}';
const namespaceOf = value => {
    const namespace = value ?? 'DDN_MODULES';
    if (!/^[A-Za-z_$][\w$]*$/.test(namespace)) throw new Error('Invalid module registry namespace');
    return namespace;
};

/** Compile a dependency graph without executing modules. IDs are relative to built.
 * The TypeScript AST rewrites actual static require calls, never text in a string
 * or comment. Dynamic/nonlocal imports and symlink escapes fail the build.
 * Module bodies and side effects are retained; this is not a tree shaker. */
export function collectModules(entries, { built, ts }) {
    const root = realpathSync(built), modules = new Map();
    function visit(path) {
        const file = realpathSync(path), id = relative(root, file).replaceAll('\\', '/');
        if (id === '..' || id.startsWith('../') || !statSync(file).isFile()) throw new Error('Bundle dependency escaped DDN: ' + path);
        if (modules.has(id)) return id;
        modules.set(id, undefined); // Cycles terminate before their dependencies are visited.
        const dependencies = new Set();
        const rewritten = context => {
            const transform = node => {
                if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
                    const arg = node.arguments[0];
                    if (node.arguments.length !== 1 || !arg || !(ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)))
                        throw new Error('Dynamic runtime import cannot be bundled: ' + id);
                    if (!arg.text.startsWith('.')) throw new Error('Nonlocal runtime import: ' + arg.text);
                    const dependency = visit(resolve(dirname(file), arg.text));
                    dependencies.add(dependency);
                    return ts.factory.updateCallExpression(node, node.expression, node.typeArguments, [ts.factory.createStringLiteral(dependency)]);
                }
                return ts.visitEachChild(node, transform, context);
            };
            return source => ts.visitNode(source, transform);
        };
        const result = ts.transpileModule(readFileSync(file, 'utf8'), {
            compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, removeComments: true },
            fileName: file, transformers: { after: [rewritten] }, reportDiagnostics: true,
        });
        const error = result.diagnostics?.find(d => d.category === ts.DiagnosticCategory.Error);
        if (error) throw new Error('Cannot compile bundled module ' + id + ': ' + ts.flattenDiagnosticMessageText(error.messageText, '\n'));
        const code = result.outputText;
        modules.set(id, { code, dependencies: [...dependencies], sha256: digest(code), bytes: Buffer.byteLength(code) });
        return id;
    }
    const names = Object.fromEntries(Object.entries(entries).map(([name, path]) => [name, visit(path)]));
    return { entries: names, modules };
}

/** Stable dependency closure; each module appears once, including cyclic graphs. */
export function moduleClosure(graph, entries) {
    const seen = new Set();
    function visit(id) {
        if (seen.has(id)) return;
        const module = graph.modules.get(id);
        if (!module) throw new Error('Missing bundled module ' + id);
        seen.add(id);
        for (const dependency of module.dependencies) visit(dependency);
    }
    for (const id of typeof entries === 'string' ? [entries] : entries) visit(id);
    return [...seen];
}

export function moduleReport(graph, ids = graph.modules.keys()) {
    return [...ids].map(id => {
        const module = graph.modules.get(id);
        if (!module) throw new Error('Missing bundled module ' + id);
        return { id, bytes: module.bytes, sha256: module.sha256, dependencies: [...module.dependencies] };
    });
}

// Serialized into both standalone files and modular workers. No eval/Function,
// network access, browser UI, or implicit external resolution belongs here.
function moduleLoader(modules) {
    const cache = Object.create(null);
    return function require(id) {
        if (Object.hasOwn(cache, id)) return cache[id].exports;
        if (!Object.hasOwn(modules, id)) throw new Error('Missing bundled module ' + id);
        const module = cache[id] = { exports: {} };
        try { modules[id](module, module.exports, require); }
        catch (error) { delete cache[id]; throw error; }
        return module.exports;
    };
}

/** Self-contained classic-script registry, serialized by runtimeScript(). */
function createModuleRuntime(version, releaseHash) {
    const modules = Object.create(null), metadata = Object.create(null), chunks = new Map();
    const cache = Object.create(null);
    function require(id) {
        if (Object.hasOwn(cache, id)) return cache[id].exports;
        if (!Object.hasOwn(modules, id)) throw new Error('Missing bundled module ' + id);
        const module = cache[id] = { exports: {} };
        try { modules[id](module, module.exports, require); }
        catch (error) { delete cache[id]; throw error; }
        return module.exports;
    }
    function closure(entries) {
        const seen = new Set();
        function visit(id) {
            if (seen.has(id)) return;
            if (!Object.hasOwn(metadata, id)) throw new Error('Missing bundled module ' + id);
            seen.add(id);
            metadata[id].dependencies.forEach(visit);
        }
        entries.forEach(visit);
        return [...seen];
    }
    function register(manifest, incoming) {
        if (!manifest || typeof manifest.id !== 'string' || !manifest.id || typeof manifest.hash !== 'string' || !manifest.hash ||
            manifest.version !== version || manifest.releaseHash !== releaseHash || !Array.isArray(manifest.dependencies) || !Array.isArray(manifest.modules))
            throw new Error('Incompatible or malformed DDN chunk');
        const existing = chunks.get(manifest.id);
        if (existing) {
            if (existing.hash !== manifest.hash) throw new Error('Conflicting DDN chunk ' + manifest.id);
            return;
        }
        for (const dependency of manifest.dependencies)
            if (dependency === manifest.id || !chunks.has(dependency)) throw new Error('Missing DDN chunk dependency ' + dependency);
        const names = new Set();
        for (const item of manifest.modules) {
            if (!item || typeof item.id !== 'string' || !item.id || names.has(item.id) || typeof item.sha256 !== 'string' || !item.sha256 || !Array.isArray(item.dependencies) ||
                item.dependencies.some(id => typeof id !== 'string') || !incoming || !Object.hasOwn(incoming, item.id) || typeof incoming[item.id] !== 'function') throw new Error('Malformed DDN module');
            names.add(item.id);
            if (Object.hasOwn(metadata, item.id) && (metadata[item.id].sha256 !== item.sha256 || JSON.stringify(metadata[item.id].dependencies) !== JSON.stringify(item.dependencies))) throw new Error('Conflicting DDN module ' + item.id);
        }
        if (Object.keys(incoming).length !== names.size) throw new Error('Undeclared DDN chunk module');
        // Validate first, then install atomically so a failed chunk changes nothing.
        for (const item of manifest.modules) if (!Object.hasOwn(metadata, item.id)) {
            metadata[item.id] = { sha256: item.sha256, dependencies: [...item.dependencies] };
            modules[item.id] = incoming[item.id];
        }
        chunks.set(manifest.id, { hash: manifest.hash, dependencies: [...manifest.dependencies], modules: [...names] });
    }
    function worker(entry, preloads = []) {
        if (typeof entry !== 'string' || !Array.isArray(preloads) || preloads.some(id => typeof id !== 'string')) throw new TypeError('Invalid worker module selection');
        const entries = [...preloads, entry], ids = closure(entries);
        const source = 'const modules={' + ids.map(id => JSON.stringify(id) + ':' + modules[id].toString()).join(',') + '};const require=(' +
            // This loader is spelled locally so the serialized runtime has no closure dependencies.
            function (modules) {
                const cache = Object.create(null);
                return function require(id) {
                    if (Object.hasOwn(cache, id)) return cache[id].exports;
                    if (!Object.hasOwn(modules, id)) throw new Error('Missing bundled module ' + id);
                    const module = cache[id] = { exports: {} };
                    try { modules[id](module, module.exports, require); }
                    catch (error) { delete cache[id]; throw error; }
                    return module.exports;
                };
            }.toString() + ')(modules);' + entries.map(id => 'require(' + JSON.stringify(id) + ');').join('');
        const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
        try { return new Worker(url, { name: 'ddn-compute' }); }
        finally { URL.revokeObjectURL(url); }
    }
    function describe() {
        return { version, hash: releaseHash, chunks: [...chunks].map(([id, value]) => ({ id, ...value, dependencies: [...value.dependencies], modules: [...value.modules] })),
            modules: Object.keys(metadata), executed: Object.keys(cache) };
    }
    return Object.freeze({ version, hash: releaseHash, register, require, worker, describe });
}

/** Install one shared registry. Repeated identical runtime scripts are harmless. */
export function runtimeScript({ namespace, version = 'ddn-next-1', hash }) {
    namespace = namespaceOf(namespace);
    if (typeof hash !== 'string' || !hash || typeof version !== 'string' || !version) throw new Error('Runtime version and hash are required');
    return '(()=>{"use strict";const name=' + JSON.stringify(namespace) + ',version=' + JSON.stringify(version) + ',hash=' + JSON.stringify(hash) + ';' +
        'if(Object.hasOwn(globalThis,name)){const current=globalThis[name];if(current?.version!==version||current?.hash!==hash||typeof current.register!=="function")throw Error("Incompatible DDN module runtime");return;}' +
        'Object.defineProperty(globalThis,name,{value:(' + createModuleRuntime.toString() + ')(version,hash)});})();';
}

export function chunkManifest(graph, ids, { id, version = 'ddn-next-1', releaseHash, dependencies = [] }) {
    if (!id || typeof releaseHash !== 'string' || !releaseHash || !Array.isArray(dependencies)) throw new Error('Chunk id and releaseHash are required');
    const modules = moduleReport(graph, ids);
    if (new Set(modules.map(module => module.id)).size !== modules.length) throw new Error('Duplicate module in chunk ' + id);
    const content = { id, version, releaseHash, dependencies: [...dependencies], modules };
    return { ...content, hash: digest(JSON.stringify(content)) };
}

/** Register static function wrappers. The host loads dependencies before this script. */
export function chunkScript(graph, ids, options) {
    ids = [...ids];
    const manifest = chunkManifest(graph, ids, options), namespace = namespaceOf(options.namespace);
    return '(()=>{"use strict";const runtime=globalThis[' + JSON.stringify(namespace) + '];if(!runtime)throw Error("Missing DDN module runtime");runtime.register(' +
        JSON.stringify(manifest) + ',' + factories(graph, ids) + ');})();';
}

/** Run an installed entry, optionally installing its compute-only worker factory. */
export function entryScript(entry, { namespace, workerEntry, workerPreloads = [] } = {}) {
    namespace = namespaceOf(namespace);
    return '(()=>{"use strict";const runtime=globalThis[' + JSON.stringify(namespace) + '];if(!runtime)throw Error("Missing DDN module runtime");' +
        (workerEntry ? 'Object.defineProperty(globalThis,"__ddnCreateWorker",{configurable:true,value:()=>runtime.worker(' + JSON.stringify(workerEntry) + ',' + JSON.stringify(workerPreloads) + ')});' : '') +
        'runtime.require(' + JSON.stringify(entry) + ');})();';
}

/** Preserve the portable single-file build; worker code is its own dependency closure. */
export function bundle(entry, edition, { built, ts }) {
    const graph = collectModules({ main: entry, worker: join(built, 'standalone/src/' + (edition === 'complete' ? 'complete-' : '') + 'worker-bootstrap.js') }, { built, ts });
    const workerIds = moduleClosure(graph, graph.entries.worker);
    const loader = 'const require=(' + moduleLoader.toString() + ')(modules);';
    const workerFactory = 'Object.defineProperty(globalThis,"__ddnCreateWorker",{configurable:true,value:()=>{const source="const modules={"+' + JSON.stringify(workerIds) + '.map(id=>JSON.stringify(id)+":"+modules[id].toString()).join(",")+"};"+' + JSON.stringify(loader + 'require(' + JSON.stringify(graph.entries.worker) + ');') + ';const url=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));try{return new Worker(url,{name:"ddn-compute"});}finally{URL.revokeObjectURL(url);}}});';
    return '(()=>{"use strict";const modules=' + factories(graph, graph.modules.keys()) + ';' + loader + workerFactory + 'require(' + JSON.stringify(graph.entries.main) + ');})();';
}
