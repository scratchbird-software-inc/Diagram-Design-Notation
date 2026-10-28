import { installUITheme } from './ui-theme.js';
import { popOut, type Detached } from './popout.js';
import { resizeGrip } from './resize-grip.js';

export interface StandardDialogOptions {
    readonly title: string;
    readonly onApply?: () => void | Promise<void>;
    readonly onClose?: () => void;
    /** Drain pending live edits before user dismissal. Programmatic teardown bypasses it. */
    readonly beforeClose?: () => void | Promise<void>;
    readonly applyLabel?: string;
    readonly cancelLabel?: string;
    /** Keep user dismissal disabled until an asynchronous Apply finishes. */
    readonly lockWhileApplying?: boolean;
    /** Modeless forms leave the diagram available. Modal is the default. */
    readonly modal?: boolean;
    /** Drag the title or focus it and use the arrow keys. Enabled by default. */
    readonly movable?: boolean;
}
export interface StandardDialog {
    readonly element: HTMLElement;
    readonly body: HTMLElement;
    readonly footer: HTMLElement;
    readonly applyButton?: HTMLButtonElement;
    close(): void;
    showError(message: unknown): void;
}
interface DialogState { element: HTMLElement; host: HTMLElement; layer: HTMLElement; modal: boolean; parent?: DialogState; close(): void }
const stacks = new WeakMap<Document, DialogState[]>();
const dialogHosts = new WeakMap<HTMLElement, HTMLElement>();
let nextId = 0;

function focusable(element: HTMLElement): HTMLElement[] {
    return [...element.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href],[tabindex]')]
        .filter(item => item.tabIndex >= 0 && !item.matches(':disabled') && !item.closest('[inert]') && item.getClientRects().length > 0 && item.ownerDocument.defaultView?.getComputedStyle(item).visibility !== 'hidden');
}

/** A movable, viewport-bounded form. Populate body synchronously after creation. */
export function createStandardDialog(host: HTMLElement, options: StandardDialogOptions): StandardDialog {
    const document = host.ownerDocument, window = document.defaultView!, modal = options.modal !== false;
    const stack = stacks.get(document) ?? [];
    stacks.set(document, stack);
    const containing = host.closest<HTMLElement>('.ddn-ui-dialog') ?? document.activeElement?.closest<HTMLElement>('.ddn-ui-dialog');
    const parent = stack.find(item => item.element === containing);
    host = host.closest('.ddn-ui-dialog') && containing && dialogHosts.get(containing) || host;
    installUITheme(host);
    const previousFocus = document.activeElement as HTMLElement | null;
    const layer = document.createElement('div'); layer.className = 'ddn-ui-layer'; layer.dataset.modal = String(modal);
    const element = document.createElement('section'); element.className = 'ddn-ui-dialog'; element.tabIndex = -1;
    element.setAttribute('role', 'dialog');
    if (modal) element.setAttribute('aria-modal', 'true');
    const header = document.createElement('header'), heading = document.createElement('h3');
    header.className = 'ddn-ui-dialog-header'; heading.id = `ddn-ui-dialog-${++nextId}`;
    element.setAttribute('aria-labelledby', heading.id);
    let move: HTMLButtonElement | undefined;
    if (options.movable !== false) {
        move = document.createElement('button'); move.type = 'button'; move.className = 'ddn-ui-dialog-move';
        const label = document.createElement('span'); label.id = heading.id; label.textContent = options.title; heading.removeAttribute('id'); move.append(label);
        move.setAttribute('aria-label', 'Move ' + options.title); move.title = 'Drag to move, or focus this title and use the arrow keys. Shift moves farther.';
        heading.append(move);
    } else heading.textContent = options.title;
    const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.className = 'ddn-ui-dialog-dismiss'; dismiss.textContent = '×'; dismiss.setAttribute('aria-label', 'Close ' + options.title);
    // Modeless editors can move to their own window, e.g. onto a second monitor.
    let popped: Detached | undefined, detach: HTMLButtonElement | undefined;
    if (!modal) {
        detach = document.createElement('button'); detach.type = 'button'; detach.className = 'ddn-ui-dialog-popout'; detach.textContent = '⧉';
        detach.setAttribute('aria-label', 'Pop out ' + options.title); detach.title = 'Open in its own window, for example on a second monitor';
        detach.addEventListener('click', () => {
            if (popped) { popped.dock(); return; }
            popped = popOut(element, { title: options.title, name: 'dialog-' + options.title, width: 460, height: 620, onKeydown: keydown, onReturn() {
                popped = undefined;
                detach!.textContent = '⧉'; detach!.setAttribute('aria-label', 'Pop out ' + options.title); detach!.title = 'Open in its own window, for example on a second monitor';
                if (!closed) { layer.hidden = false; clamp(); }
            } });
            if (!popped) { showError('The browser blocked the new window. Allow pop-ups for this page to detach editors.'); return; }
            layer.hidden = true;
            detach!.textContent = '↩'; detach!.setAttribute('aria-label', 'Return ' + options.title + ' to the page'); detach!.title = 'Return this editor to the page';
        });
        header.append(heading, detach, dismiss);
    }
    else header.append(heading, dismiss);
    const body = document.createElement('div'); body.className = 'ddn-ui-dialog-body';
    const error = document.createElement('div'); error.className = 'ddn-ui-dialog-error'; error.setAttribute('role', 'alert'); error.hidden = true;
    const footer = document.createElement('footer'); footer.className = 'ddn-ui-dialog-footer';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = options.cancelLabel ?? (options.onApply ? 'Cancel' : 'Close'); footer.append(cancel);
    let applying = false, closing = false;
    const requestClose = () => {
        if (closed || closing || applying && options.lockWhileApplying) return;
        if (!options.beforeClose) { close(); return; }
        closing = true; cancel.disabled = dismiss.disabled = true; element.setAttribute('aria-busy', 'true');
        void Promise.resolve().then(options.beforeClose).then(close).catch(failure => { if (!closed) showError(failure); }).finally(() => {
            closing = false; if (!closed) { cancel.disabled = dismiss.disabled = false; element.removeAttribute('aria-busy'); }
        });
    };
    let closed = false, positioned = false, drag: {id: number; x: number; y: number; left: number; top: number} | undefined;
    const activeModal = () => [...stack].reverse().find(item => item.modal);
    const focusInside = () => (focusable(body)[0] ?? focusable(element)[0] ?? element).focus({ preventScroll: true });
    function updateStack() {
        const active = activeModal();
        for (const [index, item] of stack.entries()) {
            item.layer.style.zIndex = String(1000 + index);
            item.element.inert = !!active && item !== active;
            if (item.element.inert) item.element.setAttribute('aria-hidden', 'true'); else item.element.removeAttribute('aria-hidden');
        }
    }
    function bringForward() {
        if (activeModal() || stack.at(-1) === state) return;
        stack.splice(stack.indexOf(state), 1); stack.push(state); updateStack();
    }
    function showError(message: unknown) {
        error.textContent = message == null ? '' : message instanceof Error ? message.message : String(message);
        error.hidden = !error.textContent;
    }
    function position(left: number, top: number) {
        if (closed || popped) return;
        positioned = true; layer.dataset.positioned = '';
        const frame = layer.getBoundingClientRect(), bounds = element.getBoundingClientRect(), gap = parseFloat(window.getComputedStyle(layer).paddingLeft) || 0;
        element.style.left = Math.max(gap, Math.min(left, frame.width - bounds.width - gap)) + 'px';
        element.style.top = Math.max(gap, Math.min(top, frame.height - bounds.height - gap)) + 'px';
    }
    function clamp() { if (positioned) position(parseFloat(element.style.left), parseFloat(element.style.top)); }
    function finishDrag() {
        if (drag && move?.hasPointerCapture(drag.id)) move.releasePointerCapture(drag.id);
        drag = undefined; move?.classList.remove('ddn-ui-dragging');
    }
    function close() {
        if (closed) return;
        closed = true;
        popped?.dock();
        let heldFocus = element.contains(document.activeElement);
        for (const child of [...stack].reverse()) if (child.parent === state) child.close();
        heldFocus ||= element.contains(document.activeElement);
        const index = stack.indexOf(state); if (index >= 0) stack.splice(index, 1);
        observer.disconnect(); resizeObserver?.disconnect(); window.removeEventListener('resize', clamp);
        document.removeEventListener('keydown', keydown, true); document.removeEventListener('focusin', focusin, true);
        finishDrag(); grip.dispose(); layer.remove(); updateStack();
        const active = activeModal();
        if (modal || heldFocus) {
            if (previousFocus?.isConnected && !previousFocus.closest('[inert]') && (!active || active.element.contains(previousFocus))) previousFocus.focus({ preventScroll: true });
            else if (active) (focusable(active.element)[0] ?? active.element).focus({ preventScroll: true });
        }
        options.onClose?.();
    }
    const state: DialogState = { element, host, layer, modal, ...(parent ? {parent} : {}), close };
    function keydown(event: KeyboardEvent) {
        const active = activeModal();
        if (active ? active !== state : !element.contains(event.target as Node)) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); requestClose(); }
        else if (event.key === 'Tab' && modal) {
            const controls = focusable(element), first = controls[0], last = controls.at(-1);
            if (!first) { event.preventDefault(); element.focus(); }
            else if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) { event.preventDefault(); last!.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
        }
    }
    function focusin(event: FocusEvent) { if(element.contains(event.target as Node))bringForward();else if(activeModal()===state)focusInside(); }
    element.addEventListener('pointerdown', bringForward);
    move?.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        bringForward(); const bounds = element.getBoundingClientRect(), frame = layer.getBoundingClientRect();
        drag = {id:event.pointerId,x:event.clientX,y:event.clientY,left:bounds.left-frame.left,top:bounds.top-frame.top};
        move!.setPointerCapture(event.pointerId); move!.classList.add('ddn-ui-dragging'); event.preventDefault(); move!.focus({preventScroll:true});
    });
    move?.addEventListener('pointermove', event => { if (drag?.id === event.pointerId) position(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y); });
    move?.addEventListener('pointerup', finishDrag); move?.addEventListener('pointercancel', finishDrag); move?.addEventListener('lostpointercapture', finishDrag);
    move?.addEventListener('keydown', event => {
        const offsets: Record<string, readonly [number, number]> = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}, offset = offsets[event.key];
        if (!offset) return;
        event.preventDefault(); event.stopPropagation();
        const bounds = element.getBoundingClientRect(), frame = layer.getBoundingClientRect(), step = event.shiftKey ? 40 : 10;
        position(bounds.left-frame.left+offset[0]*step,bounds.top-frame.top+offset[1]*step);
    });
    cancel.addEventListener('click', requestClose); dismiss.addEventListener('click', requestClose);
    let applyButton: HTMLButtonElement | undefined;
    if (options.onApply) {
        applyButton = document.createElement('button'); applyButton.type = 'button'; applyButton.textContent = options.applyLabel ?? 'Apply'; applyButton.dataset.ddnApply = '';
        applyButton.addEventListener('click', async () => {
            if (closed || applyButton!.disabled) return;
            showError(''); applying = true; applyButton!.disabled = true; element.setAttribute('aria-busy', 'true');
            if (options.lockWhileApplying) cancel.disabled = dismiss.disabled = true;
            try { await options.onApply!(); close(); }
            catch (failure) { if (!closed) showError(failure); }
            finally { applying = false; applyButton!.disabled = false; cancel.disabled = dismiss.disabled = false; element.removeAttribute('aria-busy'); }
        });
        footer.append(applyButton);
    }
    stack.push(state); dialogHosts.set(element, host);
    element.append(header, body, error);
    const grip = resizeGrip(element, {label: options.title, size: () => element.getBoundingClientRect(), start() {
        bringForward(); const bounds = element.getBoundingClientRect(), frame = layer.getBoundingClientRect();
        position(bounds.left - frame.left, bounds.top - frame.top);
    }, resize(width, height) {
        if (closed || popped) return;
        const frame = layer.getBoundingClientRect(), gap = parseFloat(window.getComputedStyle(layer).paddingLeft) || 0;
        const maxWidth = Math.max(0, frame.width - parseFloat(element.style.left) - gap), maxHeight = Math.max(0, frame.height - parseFloat(element.style.top) - gap);
        element.dataset.ddnResized = '';
        element.style.width = Math.min(maxWidth, Math.max(Math.min(280, maxWidth), width)) + 'px';
        const minHeight = Math.min(maxHeight, Math.max(180, header.getBoundingClientRect().height + footer.getBoundingClientRect().height + 80));
        element.style.height = Math.min(maxHeight, Math.max(minHeight, height)) + 'px';
        clamp();
    }});
    element.append(footer); layer.append(element); host.append(layer); updateStack();
    document.addEventListener('keydown', keydown, true); document.addEventListener('focusin', focusin, true); window.addEventListener('resize', clamp);
    const observer = new window.MutationObserver(() => { if (!element.isConnected) close(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const resizeObserver = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(clamp) : undefined;
    resizeObserver?.observe(element);
    if(!modal){const bounds=host.getBoundingClientRect(),frame=layer.getBoundingClientRect();position(bounds.right-frame.left-element.getBoundingClientRect().width-12,bounds.top-frame.top+12);}
    window.queueMicrotask(() => { if (!closed && !element.inert && element.isConnected) focusInside(); });
    return { element, body, footer, ...(applyButton ? { applyButton } : {}), close, showError };
}

export interface NumberFieldOptions { readonly min: number; readonly max: number; readonly step?: number | 'any' }
const numberSynchronizers = new WeakMap<HTMLInputElement, () => void>();
/** Refresh a programmatic value without emitting an edit. */
export function syncNumberField(input: HTMLInputElement): void { numberSynchronizers.get(input)?.(); }
/** A bounded slider with an exact numeric entry. Both represent one source value. */
export function numberField(container: HTMLElement, label: string, value: number | string, options: NumberFieldOptions): HTMLInputElement {
    const {min,max,step=1}=options;
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max || step !== 'any' && (!Number.isFinite(step) || step <= 0)) throw Error('Numeric fields need finite increasing bounds and a positive step.');
    const document=container.ownerDocument, window=document.defaultView!; installUITheme(container);
    const wrapper=document.createElement('div'); wrapper.className='ddn-ui-number-field';
    const title=document.createElement('label'); title.textContent=label;
    const row=document.createElement('div'); row.className='ddn-ui-number-controls';
    const range=document.createElement('input'); range.type='range'; range.setAttribute('aria-label',label+' slider');
    const input=document.createElement('input'); input.type='number'; input.setAttribute('aria-label',label); input.id='ddn-ui-number-'+(++nextId); title.htmlFor=input.id;
    for(const control of [range,input]) {control.min=String(min); control.max=String(max); control.step=String(step);}
    input.required=true; input.value=String(value);
    const sync=()=>{if(Number.isFinite(input.valueAsNumber))range.value=input.value; input.setAttribute('aria-invalid',String(!input.checkValidity()));};
    numberSynchronizers.set(input,sync); sync(); input.addEventListener('input',sync); input.addEventListener('change',sync);
    range.addEventListener('input',event=>{event.stopPropagation();if(input.value===range.value)return;input.value=range.value;sync();input.dispatchEvent(new window.Event('input',{bubbles:true}));});
    row.append(range,input); wrapper.append(title,row); container.append(wrapper);return input;
}

interface Colour { r: number; g: number; b: number; a: number }
function parseColour(value: string): Colour | undefined {
    let hex = value.trim();
    if (hex.toLowerCase() === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    if (/^#[\da-f]{3}$/i.test(hex)) hex = '#' + [...hex.slice(1)].map(character => character.repeat(2)).join('');
    if (!/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(hex)) return undefined;
    return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16), a: hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1 };
}
const byte = (value: number) => Math.round(value).toString(16).padStart(2, '0');
const hexColour = (colour: Colour) => '#' + byte(colour.r) + byte(colour.g) + byte(colour.b) + (colour.a < 1 ? byte(colour.a * 255) : '');
const synchronizers = new WeakMap<HTMLInputElement, () => void>();
/** Refresh after a programmatic default change without marking the field edited. */
export function syncColourField(input: HTMLInputElement): void { synchronizers.get(input)?.(); }

export interface ColourFieldOptions { readonly dialogHost?: HTMLElement }
/** Text stays the source value; the native swatch preserves an existing alpha. */
export function colourField(container: HTMLElement, label: string, value: string, options: ColourFieldOptions = {}): HTMLInputElement {
    const document = container.ownerDocument, window = document.defaultView!;
    installUITheme(container);
    const row = document.createElement('div'); row.className = 'ddn-ui-colour-field';
    const wrapper = document.createElement('label'); wrapper.append(document.createTextNode(label));
    const input = document.createElement('input'); input.type = 'text'; input.value = value; input.spellcheck = false; wrapper.append(input);
    const native = document.createElement('input'); native.type = 'color'; native.setAttribute('aria-label', label + ' picker');
    native.title = 'Choose RGB colour; use the palette or text field for transparency.';
    const palette = document.createElement('button'); palette.type = 'button'; palette.textContent = 'Palette'; palette.setAttribute('aria-label', label + ' palette');
    const sync = () => { const colour = parseColour(input.value); native.value = colour ? '#' + byte(colour.r) + byte(colour.g) + byte(colour.b) : '#000000'; };
    const change = (text: string) => {
        if (input.value === text) return;
        input.value = text; sync(); input.dispatchEvent(new window.Event('input', { bubbles: true }));
    };
    const chooseNative = () => { const text = input.value.trim(); change(native.value + (/^#[\da-f]{8}$/i.test(text) ? text.slice(7) : '')); };
    native.addEventListener('input', chooseNative); native.addEventListener('change', chooseNative);
    input.addEventListener('input', sync); input.addEventListener('change', sync);
    synchronizers.set(input, sync); sync();
    palette.addEventListener('click', () => {
        const initial = input.value;
        let draft = initial, colour = parseColour(initial) ?? { r: 0, g: 0, b: 0, a: 1 };
        const dialog = createStandardDialog(options.dialogHost ?? container, {title: label + ' palette', cancelLabel: 'Done'});
        const textField = (parent: HTMLElement, title: string, type = 'text') => {
            const field = document.createElement('label'); field.append(document.createTextNode(title));
            const control = document.createElement('input'); control.type = type; field.append(control); parent.append(field); return control;
        };
        const hex = textField(dialog.body, 'Hex colour'); hex.value = initial; hex.spellcheck = false;
        const picker = textField(dialog.body, 'RGB picker', 'color');
        const channels = document.createElement('div'); channels.className = 'ddn-ui-colour-channels'; dialog.body.append(channels);
        const red = numberField(channels, 'Red', colour.r, {min: 0, max: 255}), green = numberField(channels, 'Green', colour.g, {min: 0, max: 255}), blue = numberField(channels, 'Blue', colour.b, {min: 0, max: 255}), alpha = numberField(channels, 'Alpha', colour.a, {min: 0, max: 1, step: .01});
        alpha.step = 'any';
        const presets = document.createElement('div'); presets.className = 'ddn-ui-colour-swatches'; presets.setAttribute('role', 'group'); presets.setAttribute('aria-label', 'Preset colours');
        const previews = document.createElement('div'); previews.className = 'ddn-ui-colour-previews';
        function preview(title: string, value: string) {
            const block = document.createElement('div'), name = document.createElement('span'); name.className = 'ddn-ui-colour-preview-label'; name.textContent = title;
            const checkers = document.createElement('div'); checkers.className = 'ddn-ui-colour-preview';
            const paint = document.createElement('span'); paint.setAttribute('role', 'img'); paint.setAttribute('aria-label', title + ' colour'); paint.style.backgroundColor = parseColour(value) ? value : 'transparent';
            checkers.append(paint); block.append(name, checkers); previews.append(block); return paint;
        }
        preview('Current', initial); const proposed = preview('Preview', initial);
        function refresh(fromHex = false) {
            if (!fromHex) { draft = hexColour(colour); hex.value = draft; }
            red.value = String(colour.r); green.value = String(colour.g); blue.value = String(colour.b); alpha.value = String(colour.a);
            for (const channel of [red, green, blue, alpha]) syncNumberField(channel);
            picker.value = '#' + byte(colour.r) + byte(colour.g) + byte(colour.b);
            proposed.style.backgroundColor = hexColour(colour); proposed.title = draft;
            hex.removeAttribute('aria-invalid'); dialog.showError('');
        }
        hex.addEventListener('input', () => {
            draft = hex.value; const parsed = parseColour(draft);
            if (parsed) { colour = parsed; refresh(true); change(draft); }
            else { hex.setAttribute('aria-invalid', 'true'); dialog.showError('Use #RGB, #RRGGBB, #RRGGBBAA or transparent.'); }
        });
        for (const channel of [red, green, blue, alpha]) channel.addEventListener('input', () => {
            if ([red, green, blue, alpha].some(control => control.value === '' || !control.checkValidity())) { dialog.showError('RGB channels must be integers from 0 to 255; alpha must be from 0 to 1.'); return; }
            colour = { r: red.valueAsNumber, g: green.valueAsNumber, b: blue.valueAsNumber, a: alpha.valueAsNumber }; refresh(); change(draft);
        });
        picker.addEventListener('input', () => { colour = { ...parseColour(picker.value)!, a: colour.a }; refresh(); change(draft); });
        for (const value of ['#ffffff', '#000000', '#df4545', '#ef8f32', '#fff59d', '#54ab67', '#45a3da', '#955dcc', '#f6c4d2', '#b9e8dc', '#5b83b4', '#3b414b', '#e4c788', '#b4bac5', '#795548', 'transparent']) {
            const swatch = document.createElement('button'); swatch.type = 'button'; swatch.title = value; swatch.setAttribute('aria-label', 'Use ' + value);
            const paint = document.createElement('span'); paint.style.backgroundColor = value; swatch.append(paint);
            swatch.addEventListener('click', () => { draft = value; hex.value = value; colour = parseColour(value)!; refresh(true); change(draft); }); presets.append(swatch);
        }
        const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Reset colour';
        reset.addEventListener('click', () => { draft = initial; hex.value = initial; colour = parseColour(initial) ?? {r: 0, g: 0, b: 0, a: 1}; refresh(true); change(initial); });
        dialog.footer.prepend(reset);
        dialog.body.append(presets, previews); refresh(true);
        if (!parseColour(initial)) hex.setAttribute('aria-invalid', 'true');
    });
    row.append(wrapper, native, palette); container.append(row); return input;
}
