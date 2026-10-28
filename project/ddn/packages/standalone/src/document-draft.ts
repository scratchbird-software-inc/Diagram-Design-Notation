import type {SourceSet} from '../../types/src/core.js';

export interface DraftAsset {id: string; mime: string; base64: string}
export interface DocumentDraft extends SourceSet {version: 1; savedAt: string; assets: readonly DraftAsset[]}
export const DRAFT_KEY = 'ddn.designer.draft.v1';

export function encodeDraftAsset(id: string, mime: string, bytes: Uint8Array): DraftAsset {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    return {id, mime, base64: btoa(binary)};
}
export function restoreDraftAssets(draft: DocumentDraft): Map<string, File> {
    return new Map(draft.assets.map(asset => {
        const binary = atob(asset.base64), bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        return [asset.id, new File([bytes], asset.id, {type: asset.mime})];
    }));
}
export function readDocumentDraft(text: string | null): DocumentDraft | undefined {
    try {
        const value: unknown = JSON.parse(text ?? 'null');
        if (!value || typeof value !== 'object' || !('entry' in value) || typeof value.entry !== 'string' || !('files' in value) || !Array.isArray(value.files)) return;
        const files: SourceSet['files'][number][] = [], seen = new Set<string>();
        for (const item of value.files as unknown[]) {
            if (!item || typeof item !== 'object' || !('id' in item) || typeof item.id !== 'string' || seen.has(item.id) || !('text' in item) || typeof item.text !== 'string') return;
            seen.add(item.id);
            files.push({id: item.id, text: item.text, revision: 'recovered', encoding: 'utf-8', writable: !('writable' in item) || item.writable !== false});
        }
        if (!seen.has(value.entry)) return;
        const assets: DraftAsset[] = [];
        if ('assets' in value) {
            if (!Array.isArray(value.assets)) return;
            for (const item of value.assets as unknown[]) {
                if (!item || typeof item !== 'object' || !('id' in item) || typeof item.id !== 'string' || !('mime' in item) || typeof item.mime !== 'string' || !('base64' in item) || typeof item.base64 !== 'string') return;
                atob(item.base64); // Reject corrupt recovery data before replacing a live document.
                assets.push({id: item.id, mime: item.mime, base64: item.base64});
            }
        }
        return {version: 1, entry: value.entry, files, assets, savedAt: 'savedAt' in value && typeof value.savedAt === 'string' ? value.savedAt : ''};
    } catch { return; }
}
