/**
 * Host-neutral UI command channel. The viewer and designer register the actions
 * their controls perform; a host shell builds menus, shortcuts and command
 * search from the same entries. One declaration per command keeps every
 * surface (toolbar, menu, context menu, search) in agreement.
 *
 * This is a browser-module convenience, not part of the utility ABI: hosts that
 * do not use it lose nothing, and the registered actions only call the same
 * functions as the visible controls.
 */
export interface UICommand {
    readonly id: string;
    readonly label: string;
    /** A short reason shown when the command is unavailable. */
    readonly hint?: string;
    run(argument?: unknown): void | Promise<void>;
    enabled?(): boolean;
    /** Checked state for toggles and radio choices; undefined for plain actions. */
    checked?(): boolean | undefined;
    /** A live display value, such as the zoom percentage. */
    value?(): string;
}

const registries = new WeakMap<Element, Map<string, UICommand>>();
export const UI_COMMANDS_CHANGED = 'ddn:commands-changed';

/** Registers commands on a host element; returns a function that removes them. */
export function registerUICommands(host: Element, commands: readonly UICommand[]): () => void {
    let registry = registries.get(host);
    if (!registry) { registry = new Map(); registries.set(host, registry); }
    for (const command of commands) registry.set(command.id, command);
    notifyUICommands(host);
    return () => {
        const current = registries.get(host);
        if (!current) return;
        for (const command of commands) if (current.get(command.id) === command) current.delete(command.id);
        notifyUICommands(host);
    };
}

/** Finds a command registered on the host or on any registered descendant. */
export function findUICommand(root: Element, id: string): UICommand | undefined {
    const own = registries.get(root)?.get(id);
    if (own) return own;
    for (const element of root.querySelectorAll('[data-ddn-commands]')) {
        const found = registries.get(element)?.get(id);
        if (found) return found;
    }
    return undefined;
}

export function listUICommands(root: Element): UICommand[] {
    const result = new Map<string, UICommand>();
    for (const element of [root, ...root.querySelectorAll('[data-ddn-commands]')])
        for (const [id, command] of registries.get(element) ?? []) if (!result.has(id)) result.set(id, command);
    return [...result.values()];
}

/** Tells hosts that enabled/checked/value states may have changed. */
export function notifyUICommands(host: Element): void {
    host.setAttribute('data-ddn-commands', '');
    host.dispatchEvent(new CustomEvent(UI_COMMANDS_CHANGED, { bubbles: true }));
}

export function commandEnabled(command: UICommand | undefined): boolean {
    if (!command) return false;
    try { return command.enabled ? command.enabled() : true; } catch { return false; }
}
