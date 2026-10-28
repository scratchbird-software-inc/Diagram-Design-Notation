import type { SourceSet } from '../../types/src/core.js';
import { mountShell, type ShellFactories } from './shell.js';
import { ensureProfileInput, installModularWorkerFactory } from './modular-loading.js';
import { installWebsiteNavigation } from './website-navigation.js';
type SiteHost = typeof globalThis & { DDN_SITE_INITIAL?: { sources: SourceSet; assets?: Record<string, { text: string; mime: string }> } };
export function bootModularShell(factories: ShellFactories, api: object): void {
    installModularWorkerFactory();
    void (async () => {
        const initial = (globalThis as SiteHost).DDN_SITE_INITIAL;
        if (initial) await ensureProfileInput(initial.sources, factories.mode !== 'verifier');
        Object.defineProperty(globalThis, 'DDN', { configurable: true, value: Object.freeze(api) });
        mountShell({ ...factories, edition: 'complete',
            ...(initial ? { initial: { ...initial, view: new URLSearchParams(location.search).get('view') ?? undefined } } : {}),
            ready: state => {
                Object.defineProperty(globalThis, 'DDN_SITE_STATE', { configurable: true, value: state });
                document.documentElement.dataset.ready = 'true';
                factories.ready?.(state);
            },
        });
        if (initial || 'DDN_WEBSITE_CATALOGUE' in globalThis) installWebsiteNavigation(factories.mode);
    })().catch(error => {
        const status = document.createElement('p'); status.setAttribute('role', 'alert');
        status.textContent = error instanceof Error ? error.message : String(error); document.body.append(status);
    });
}
