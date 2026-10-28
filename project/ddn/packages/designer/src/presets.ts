import type {Json} from '@ddn/types';
import {validateProperty} from '../../defaults/src/index.js';

export type PresetTarget = 'workarea' | 'element' | 'view';
export interface AppearancePreset {
    id: string;
    name: string;
    scope: 'user' | 'company';
    target: PresetTarget;
    profile?: string;
    properties: Record<string, Json>;
}
export interface PresetPack { format: 'ddn-appearance-presets'; version: 1; presets: AppearancePreset[]; }
// Element presets may include occurrence-only paint. The source command still
// verifies compatibility with the exact scope selected when the preset is used.
const owners = {workarea:'workarea',element:'appearance',view:'view_definition'};
export const PRESET_PATHS = ['background.color','background.texture','text.color','border.color','opacity','style.paper','style.font','style.font_size','style.look','shadow','decorations'] as const;
const paths = new Set<string>(PRESET_PATHS);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Portable appearance data. Company is provenance, never an authorization grant. */
export function parsePresetPack(text: string): PresetPack {
    if (text.length > 262144 || new TextEncoder().encode(text).byteLength > 262144) throw Error('Preset files are limited to 256 KiB.');
    const pack: unknown = JSON.parse(text);
    if (!record(pack) || pack.format !== 'ddn-appearance-presets' || pack.version !== 1 || !Array.isArray(pack.presets) || pack.presets.length > 100)
        throw Error('Expected a version 1 DDN appearance preset pack with at most 100 presets.');
    const seen = new Set<string>();
    for (const preset of pack.presets) {
        if (!record(preset) || typeof preset.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(preset.id) || seen.has(preset.id)) throw Error('Preset IDs must be unique, short identifiers.');
        seen.add(preset.id);
        if(preset.id.startsWith('standard-'))throw Error('The standard- ID prefix is reserved for bundled presets.');
        if (typeof preset.name !== 'string' || !preset.name.trim() || preset.name.length > 80) throw Error('Each preset needs a name of at most 80 characters.');
        if (!['user','company'].includes(String(preset.scope)) || !Object.hasOwn(owners,String(preset.target))) throw Error('Preset scope or target is invalid.');
        if (preset.profile !== undefined && (typeof preset.profile !== 'string' || preset.profile.length > 100)) throw Error('Preset profile must be a short profile ID.');
        if (!record(preset.properties) || !Object.keys(preset.properties).length) throw Error('A preset needs appearance properties.');
        for (const [path,value] of Object.entries(preset.properties)) {
            if (!paths.has(path)) throw Error(`Preset property ${path} is not an appearance setting.`);
            const errors=validateProperty(owners[preset.target as PresetTarget],path,value as Json);
            if(errors.length)throw Error(errors.map(e=>e.message).join('; '));
        }
        if (Object.keys(preset).some(key=>!['id','name','scope','target','profile','properties'].includes(key))) throw Error('Unknown preset field.');
    }
    if(Object.keys(pack).some(key=>!['format','version','presets'].includes(key)))throw Error('Unknown preset pack field.');
    return clone(pack) as unknown as PresetPack;
}
export function serializePresetPack(presets: readonly AppearancePreset[]): string {
    const text=JSON.stringify({format:'ddn-appearance-presets',version:1,presets},null,2)+'\n';
    parsePresetPack(text);return text;
}
export function standardPresets(target: PresetTarget): AppearancePreset[] {
    return [
        {id:'light',name:'Clean light',background:'#ffffff',ink:'#243449',texture:null},
        {id:'dark',name:'Dark slate',background:'#233144',ink:'#e8ecf2',texture:null},
        {id:'warm',name:'Warm paper',background:'#f5e9d4',ink:'#473f35',texture:{kind:'paper',color:'#9b7952',opacity:0.12,scale:32,seed:42}},
    ].map(p=>({id:'standard-'+target+'-'+p.id,name:p.name,scope:'user' as const,target,properties:{'background.color':p.background,'background.texture':p.texture as Json,...(target==='workarea'?{}:{'text.color':p.ink,'style.font':'sans','style.font_size':16})}}));
}
export function mergePresetPacks(existing: readonly AppearancePreset[], incoming: readonly AppearancePreset[]): AppearancePreset[] {
    const result=clone([...existing]);
    for(const preset of incoming){const found=result.findIndex(p=>p.id===preset.id);if(found>=0)throw Error(`Preset ID ${preset.id} already exists; rename it before importing.`);result.push(clone(preset));}
    return parsePresetPack(serializePresetPack(result)).presets;
}

export function readLocalPresets(storage?: Pick<Storage,'getItem'>): AppearancePreset[] {
    const text=storage?.getItem('ddn.appearance-presets.v1');return text?parsePresetPack(text).presets:[];
}
export function writeLocalPresets(storage: Pick<Storage,'setItem'>,presets: readonly AppearancePreset[]): void {
    storage.setItem('ddn.appearance-presets.v1',serializePresetPack(presets));
}
