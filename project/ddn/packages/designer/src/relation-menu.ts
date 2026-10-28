import {relationPresentation, pathValue, type ProjectedRecord} from '../../presentation/src/native.js';

export type ContextMenuItem = readonly [string, () => void, {
    readonly name: string;
    readonly checked: boolean;
    readonly disabled: boolean;
    readonly title: string;
}?];

/** Presentation switches affect only the selected occurrence in this view. */
export function relationMenuItems(
    entry: ProjectedRecord,
    viewProperties: ProjectedRecord['effective'],
    editable: boolean,
    change: (path: string, value: boolean | string) => void,
): ContextMenuItem[] {
    const state = relationPresentation(entry, viewProperties);
    const disabled = !state.allowed || !editable;
    const reason = !state.allowed ? 'Internal mind-map links have no labels, numbers or legend entries.'
        : !editable ? 'This relation has no editable appearance in this view.' : '';
    const legendHidden = pathValue(viewProperties, 'legend.placement') === 'none' || pathValue(viewProperties, 'chrome.legend') === 'off';
    const item = (name: string, caption: string, checked: boolean, path: string, value: boolean | string, help: string): ContextMenuItem =>
        [caption, () => change(path, value), {name, checked, disabled, title: reason || help}];
    return [
        item('Label visible', `Label: ${state.visible ? 'Visible' : 'Invisible'}`, state.visible,
            'label.visible', !state.visible, 'Show or hide this relation’s label. Legend membership is independent.'),
        item('Number instead of text', `Label format: ${state.mode === 'numbers' ? 'Number' : state.mode === 'tokens' ? 'Token' : 'Text'}`, state.mode === 'numbers',
            'label.mode', state.mode === 'numbers' ? 'text' : 'numbers', 'Switch this label between its relation number and text. This does not change label visibility.'),
        item('Include in legend', `In legend: ${state.inLegend ? 'Included' : 'Excluded'}`, state.inLegend,
            'legend.include', !state.inLegend, 'Include or exclude this relation in the view’s relationship legend.' + (legendHidden ? ' The view currently hides its legend.' : '')),
    ];
}
