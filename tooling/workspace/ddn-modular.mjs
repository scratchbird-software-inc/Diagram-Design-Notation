import {optimizeEntries} from './ddn-optimize.mjs';
import { mkdirSync, writeFileSync, readdirSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { collectModules, moduleClosure, moduleReport, runtimeScript, chunkManifest, chunkScript } from './ddn-bundle.mjs';
import {copyDdnLicense, ddnLicenseMetadata, ddnScriptNotice, ddnHtmlNotice} from './ddn-license.mjs';

const families = ['graphs', 'charts', 'geography', 'surfaces'];
const hash = value => createHash('sha256').update(value).digest('hex');
const sizes = value => ({ rawBytes: Buffer.byteLength(value), gzipBytes: gzipSync(value, { level: 9 }).length });

/** The host controls which trusted entries are loaded. All filenames come from
 * the generated release manifest, never from document text or URL parameters. */
function installLoader(manifest, timeoutMs) {
    const script = document.currentScript;
    if (!script?.src) throw new Error('DDN loader must be loaded from a local script resource');
    const base = new URL('.', script.src), runtime = globalThis.DDN_MODULES;
    if (!runtime || runtime.version !== manifest.version || runtime.hash !== manifest.releaseHash) throw new Error('Incompatible DDN module runtime');
    const existing = globalThis.DDN_LOADER;
    if (existing) {
        if (existing.version !== manifest.version || existing.hash !== manifest.releaseHash) throw new Error('Incompatible DDN loader');
        return;
    }
    const chunks = new Map(manifest.chunks.map(chunk => [chunk.id, chunk]));
    // Derive redundant size/closure metadata locally instead of transferring it per entry.
    const closure=id=>{const seen=new Set();const visit=id=>{if(seen.has(id))return;chunks.get(id).dependencies.forEach(visit);seen.add(id);};visit(id);return [...seen];};
    for(const entry of Object.values(manifest.entries)){
        entry.chunks=closure(entry.chunkId);
        entry.moduleCount=entry.chunks.reduce((sum,id)=>sum+chunks.get(id).moduleIds.length,0);
        for(const key of ['rawBytes','gzipBytes'])entry[key]=entry.chunks.reduce((sum,id)=>sum+chunks.get(id)[key],0);
    }
    for(const chunk of manifest.chunks)chunk.entries=Object.entries(manifest.entries).filter(([,entry])=>entry.chunks.includes(chunk.id)).map(([alias])=>alias);
    manifest.totals={modules:manifest.chunks.reduce((sum,chunk)=>sum+chunk.moduleIds.length,0),chunks:manifest.chunks.length,rawBytes:manifest.chunks.reduce((sum,chunk)=>sum+chunk.rawBytes,0),gzipBytes:manifest.chunks.reduce((sum,chunk)=>sum+chunk.gzipBytes,0)};

    const pendingChunks = new Map(), pendingEntries = new Map(), loadedEntries = new Set();
    const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
    freeze(manifest);
    const entry = alias => {
        if (typeof alias !== 'string' || !Object.hasOwn(manifest.entries, alias)) throw new Error('Unknown DDN entry ' + String(alias));
        return manifest.entries[alias];
    };
    function registered(chunk) {
        const found = runtime.describe().chunks.find(value => value.id === chunk.id);
        if (found && found.hash !== chunk.hash) throw new Error('Incompatible DDN chunk ' + chunk.id);
        return !!found;
    }
    function loadChunk(id) {
        const chunk = chunks.get(id);
        if (!chunk) return Promise.reject(new Error('Unknown DDN chunk ' + id));
        try { if (registered(chunk)) return Promise.resolve(); } catch (error) { return Promise.reject(error); }
        const existing = pendingChunks.get(id);
        if (existing) return existing;
        const task = Promise.all(chunk.dependencies.map(loadChunk)).then(() => {
            if (registered(chunk)) return;
            return new Promise((resolve, reject) => {
                const element = document.createElement('script');
                const done = error => {
                    clearTimeout(timer); element.onload = element.onerror = null;
                    if (error) { element.remove(); reject(error); } else resolve();
                };
                const timer = setTimeout(() => done(new Error('Timed out loading DDN chunk ' + chunk.id)), timeoutMs);
                if (script.nonce) element.nonce = script.nonce;
                element.async = true;
                element.onload = () => { try { if (!registered(chunk)) throw new Error('DDN chunk did not register ' + chunk.id); done(); } catch (error) { done(error); } };
                element.onerror = () => done(new Error('Unable to load DDN chunk ' + chunk.id));
                element.src = new URL(chunk.file, base).href;
                document.head.append(element);
            });
        }).then(value => { pendingChunks.delete(id); return value; }, error => { pendingChunks.delete(id); throw error; });
        pendingChunks.set(id, task);
        return task;
    }
    function prepareEntry(alias) {
        let selected;
        try { selected = entry(alias); } catch (error) { return Promise.reject(error); }
        return loadChunk(selected.chunkId);
    }
    function loadEntry(alias) {
        let selected;
        try { selected = entry(alias); if (selected.kind === 'worker') throw new Error('Use prepareEntry for the DDN worker'); } catch (error) { return Promise.reject(error); }
        const existing = pendingEntries.get(alias);
        if (existing) return existing;
        const task = prepareEntry(alias).then(() => {
            const exports = runtime.require(selected.moduleId);
            loadedEntries.add(alias);
            return exports;
        }).catch(error => { pendingEntries.delete(alias); throw error; });
        pendingEntries.set(alias, task);
        return task;
    }
    function worker(alias, initializerAliases = []) {
        const selected = entry(alias);
        if (selected.kind !== 'worker' || !Array.isArray(initializerAliases)) throw new Error('Invalid DDN worker selection');
        for (const id of selected.chunks) if (!registered(chunks.get(id))) throw new Error('DDN worker is not prepared');
        const initializers = initializerAliases.map(alias => {
            const initializer = entry(alias);
            if (initializer.kind !== 'verification' || !loadedEntries.has(alias)) throw new Error('DDN worker initializer is not loaded: ' + alias);
            return initializer.moduleId;
        });
        return runtime.worker(selected.moduleId, [...new Set(initializers)]);
    }
    function describe() {
        return { version: manifest.version, hash: manifest.releaseHash, loadedEntries: [...loadedEntries],
            pendingEntries: [...pendingEntries.keys()].filter(alias => !loadedEntries.has(alias)), pendingChunks: [...pendingChunks.keys()], registry: runtime.describe() };
    }
    const owners=new Map(manifest.chunks.flatMap(chunk=>chunk.moduleIds.map(id=>[id,chunk.id])));
    runtime.setImporter(id=>{const owner=owners.get(id);return owner?loadChunk(owner).then(()=>runtime.require(id)):Promise.reject(new Error('Unknown DDN lazy module '+id));});
    const auto = script.dataset.entry;
    const ready = auto ? loadEntry(auto) : Promise.resolve();
    const api = Object.freeze({ version: manifest.version, hash: manifest.releaseHash, manifest, prepareEntry, loadEntry, worker, describe, ready });
    Object.defineProperty(globalThis, 'DDN_LOADER', { value: api });
    ready.then(() => { if (auto) document.querySelector('[data-ddn-loader-status]')?.remove(); }).catch(error => {
        const message = document.querySelector('[data-ddn-loader-status]') ?? document.createElement('p');
        message.setAttribute('role', 'alert'); message.textContent = 'Unable to load DDN: ' + error.message;
        if (!message.isConnected) (document.body ?? document.documentElement).append(message);
        document.dispatchEvent(new CustomEvent('ddn:load-error', { detail: { entry: auto, message: error.message } }));
    });
}

/** Partition by entry-closure membership. For every dependency A -> B, B's
 * membership is a superset of A's; distinct groups therefore form a DAG even
 * when the original modules contain cycles. No module is emitted twice. */
export function buildModularDistribution({ built, ts, destination, timeoutMs = 15000 }) {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) throw new Error('DDN loader timeout must be between 100 and 60000 milliseconds');
    const entries = Object.fromEntries(['viewer', 'designer', 'verifier'].map(mode => [mode, join(built, 'standalone/src/modular-' + mode + '-entry.js')]));
    entries.worker = join(built, 'standalone/src/modular-worker.js');
    if(existsSync(join(built,'standalone/src/schema-native.js')))entries['schema:native']=join(built,'standalone/src/schema-native.js');
    for (const mode of ['viewer', 'designer', 'verifier']) entries['api:' + mode] = join(built, 'standalone/src/modular-' + mode + '-api.js');
    for (const family of families) {
        entries['verify:' + family] = join(built, 'profiles/src/families/' + family + '.js');
        entries['render:' + family] = join(built, 'standalone/src/families/' + family + '.js');
    }
    const shardFile=join(built,'profiles/src/generated-shards.json');
    if(existsSync(shardFile)){
        const shards=JSON.parse(readFileSync(shardFile,'utf8'));
        for(const id of Object.keys(shards)){
            entries['verify:'+id]=join(built,'profiles/src/shards/'+id+'.js');
            entries['render:'+id]=join(built,'standalone/src/shards/'+id+'.js');
        }
        for(const family of families){
            entries['verify:'+family]=join(built,'profiles/src/shards/all-'+family+'.js');
            entries['render:'+family]=join(built,'standalone/src/shards/all-'+family+'.js');
        }
    }
    collectModules(entries,{built,ts}); // Validate source paths before the optimizer can read them.
    const optimized=optimizeEntries(entries,{built,label:'modular'});
    const graph=collectModules(optimized.entries,{built:optimized.built,ts});
    for(const module of graph.modules.values())for(const id of module.asyncDependencies??[])graph.entries['module:'+id]=id;
    const aliases=Object.keys(graph.entries).sort();
    const closures = new Map(aliases.map(alias => [alias, moduleClosure(graph, graph.entries[alias])]));
    const memberships = new Map([...graph.modules.keys()].sort().map(id => [id, aliases.filter(alias => closures.get(alias).includes(id))]));
    const releaseHash = hash(JSON.stringify({ entries: graph.entries, modules: moduleReport(graph, [...graph.modules.keys()].sort()), licensing: ddnLicenseMetadata, notice: ddnScriptNotice }));
    const groups = new Map();
    for(const [id,members] of memberships){
        const key=members.join('\0');
        if(!groups.has(key))groups.set(key,{members:[],modules:[]});
        const group=groups.get(key);group.members=[...new Set([...group.members,...members])].sort();group.modules.push(id);
    }
    const owners = new Map();
    for (const group of groups.values()) {
        const label = group.members.length === 1 ? group.members[0].replace(/[^a-z0-9-]/gi,'-').toLowerCase() : group.members.length === aliases.length ? 'core' : 'shared';
        group.id = label + '-' + hash(JSON.stringify([group.members, group.modules])).slice(0, 12);
        for (const id of group.modules) owners.set(id, group.id);
    }
    const byId = new Map([...groups.values()].map(group => [group.id, group]));
    for (const group of groups.values()) group.dependencies = [...new Set(group.modules.flatMap(id => graph.modules.get(id).dependencies.map(id => owners.get(id))).filter(id => id !== group.id))].sort();
    const ordered = [], seen = new Set(), active = new Set();
    function visit(id) {
        if (active.has(id)) throw new Error('Unexpected cycle between DDN chunks');
        if (seen.has(id)) return;
        active.add(id); byId.get(id).dependencies.forEach(visit); active.delete(id); seen.add(id); ordered.push(byId.get(id));
    }
    [...byId.keys()].sort().forEach(visit);
    // Chunk identity follows its own code and static dependencies, never a release stamp.
    const identities=new Map();
    for(const group of ordered){
        const previous=group.id;
        group.dependencies=group.dependencies.map(id=>identities.get(id)).sort();
        group.id='chunk-'+hash(JSON.stringify({version:'ddn-next-1',modules:moduleReport(graph,group.modules),dependencies:group.dependencies,notice:ddnScriptNotice})).slice(0,20);
        identities.set(previous,group.id);
    }
    for(const [module,owner] of owners)owners.set(module,identities.get(owner));
    mkdirSync(join(destination, 'chunks'), { recursive: true });
    copyDdnLicense(destination);
    const chunks = ordered.map(group => {
        const options = { id: group.id, dependencies: group.dependencies };
        const declaration = chunkManifest(graph, group.modules, options), code = ddnScriptNotice + optimized.minify(chunkScript(graph, group.modules, options)), file = 'chunks/' + group.id + '.js';
        writeFileSync(join(destination, file), code + '\n');
        return { id: group.id, file, hash: declaration.hash, dependencies: group.dependencies, moduleIds: group.modules, entries: group.members, ...sizes(code + '\n') };
    });
    // This generated build directory contains only the current release. Hosts
    // deploying cached releases retain old chunks in their deployment store.
    const currentFiles = new Set(chunks.map(chunk => chunk.file.slice('chunks/'.length)));
    for (const file of readdirSync(join(destination, 'chunks')))
        if (/^(?:chunk-[a-f0-9]{20}|[a-z0-9-]+-[a-f0-9]{12})\.js$/.test(file) && !currentFiles.has(file))
            unlinkSync(join(destination, 'chunks', file));
    const chunkById = new Map(chunks.map(chunk => [chunk.id, chunk]));
    function requiredChunks(root) {
        const result = new Set();
        const walk = id => { if (result.has(id)) return; chunkById.get(id).dependencies.forEach(walk); result.add(id); };
        walk(root); return [...result];
    }
    const manifest = {
        format: 'ddn-modular-1', version: 'ddn-next-1', releaseHash, ...ddnLicenseMetadata,
        entries: Object.fromEntries(aliases.map(alias => {
            const moduleId = graph.entries[alias], chunkId = owners.get(moduleId), required = requiredChunks(chunkId);
            const records = required.map(id => chunkById.get(id));
            return [alias, { kind: alias === 'worker' ? 'worker' : alias.startsWith('verify:') ? 'verification' : alias.startsWith('render:') ? 'rendering' : alias.startsWith('api:') ? 'api' : 'utility', moduleId, chunkId, chunks: required,
                moduleCount: records.reduce((sum, chunk) => sum + chunk.moduleIds.length, 0), rawBytes: records.reduce((sum, chunk) => sum + chunk.rawBytes, 0), gzipBytes: records.reduce((sum, chunk) => sum + chunk.gzipBytes, 0) }];
        })), chunks,
        totals: { modules: graph.modules.size, chunks: chunks.length, rawBytes: chunks.reduce((sum, chunk) => sum + chunk.rawBytes, 0), gzipBytes: chunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0) },
    };
    const runtimeManifest={format:manifest.format,version:manifest.version,releaseHash:manifest.releaseHash,...ddnLicenseMetadata,
        entries:Object.fromEntries(Object.entries(manifest.entries).map(([alias,{kind,moduleId,chunkId}])=>[alias,{kind,moduleId,chunkId}])),
        chunks:manifest.chunks.map(({id,file,hash,dependencies,moduleIds,rawBytes,gzipBytes})=>({id,file,hash,dependencies,moduleIds,rawBytes,gzipBytes}))};
    const loader = ddnScriptNotice + optimized.minify('(()=>{const manifest='+JSON.stringify(runtimeManifest)+';'+runtimeScript({hash:releaseHash,chunkList:'manifest.chunks'})+'\n('+installLoader.toString()+')(manifest,'+timeoutMs+');})();');
    writeFileSync(join(destination, 'ddn-loader.js'), loader);
    const loaderSizes = sizes(loader);
    const startupFor = includeData=>Object.fromEntries(['viewer','designer','verifier'].map(alias=>{
        const required=[...new Set([...(includeData?manifest.entries.worker.chunks:[]),...(includeData?(manifest.entries['schema:native']?.chunks??[]):[]),...manifest.entries[alias].chunks])];
        return [alias,{chunks:required,rawBytes:loaderSizes.rawBytes+required.reduce((sum,id)=>sum+chunkById.get(id).rawBytes,0),gzipBytes:loaderSizes.gzipBytes+required.reduce((sum,id)=>sum+chunkById.get(id).gzipBytes,0)}];
    }));
    const startup=startupFor(true),bootstrap=startupFor(false);
    const report = { ...manifest, optimizer:{name:'esbuild',version:optimized.version,treeShaking:true,minified:true}, sourceModules:Object.fromEntries(optimized.provenance),bootstrap,loader: { file: 'ddn-loader.js', sha256: hash(loader), ...loaderSizes }, startup };
    if(existsSync(shardFile)) {
        // Regression ceilings for the new delivery layout, separate from the unchanged native gates.
        const limits={bootstrap:{viewer:[920000,300000],designer:[1100000,370000],verifier:[660000,210000]},startup:{viewer:[1500000,365199],designer:[1800000,472266],verifier:[1250000,260000]}};
        report.sizeBudgets=Object.fromEntries(Object.entries(limits).map(([phase,modes])=>[phase,Object.fromEntries(Object.entries(modes).map(([mode,[rawLimit,gzipLimit]])=>[mode,{rawLimit,gzipLimit,pass:report[phase][mode].rawBytes<=rawLimit&&report[phase][mode].gzipBytes<=gzipLimit}]))]));
    }
    writeFileSync(join(destination, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
    if(report.sizeBudgets&&Object.values(report.sizeBudgets).some(modes=>Object.values(modes).some(gate=>!gate.pass)))throw Error('Modular bundle size regression; see manifest.json sizeBudgets.');
    for (const mode of ['viewer', 'designer', 'verifier']) writeFileSync(join(destination, mode + '.html'), '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DDN ' + mode + '</title>'+ddnHtmlNotice()+'</head><body><p role="status" data-ddn-loader-status>Loading DDN ' + mode + '…</p><noscript>Enable JavaScript to use this local DDN utility.</noscript><script src="ddn-loader.js" data-entry="' + mode + '"></script></body></html>\n');
    return report;
}
