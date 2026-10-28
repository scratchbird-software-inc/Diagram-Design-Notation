const escaped = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function fileAction(page, name, { replace = false } = {}) {
    const dirty = await page.locator('html').getAttribute('data-ddn-dirty') === 'true';
    // File is the first menu of the menu bar, which is visible at every width.
    await page.getByRole('menubar').getByRole('menuitem', { name: 'File', exact: true }).click();
    await page.getByRole('menuitem', { name: new RegExp('^' + escaped(name)) }).click();
    if (replace && dirty) {
        const confirmation = page.getByRole('dialog', { name: 'Replace your unsaved changes?', exact: true });
        await confirmation.getByRole('button', { name: 'Replace', exact: true }).click();
        await confirmation.waitFor({ state: 'detached' });
    }
}

export async function openSample(page, name = 'ERD whiteboard') {
    await fileAction(page, 'Open a sample…', { replace: true });
    const dialog = page.getByRole('dialog', { name: 'Open a sample', exact: true });
    await dialog.getByRole('option', { name: new RegExp('^' + escaped(name) + '\\s*starter$') }).click();
    await dialog.getByRole('button', { name: 'Open', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
}

/** Complete the document-mode steps, leaving the method/type chooser open. */
export async function chooseNewDocument(page, {mode = 'workarea', name = 'Untitled', layout = 'dynamic'} = {}) {
    const first = page.getByRole('dialog', {name: 'New document', exact: true});
    await first.getByLabel('Workarea name', {exact: true}).fill(name);
    await first.getByRole('button', {name: mode === 'standalone' ? 'Create Standalone View' : 'Create WorkArea', exact: true}).click();
    if (mode === 'workarea') {
        const setup = page.getByRole('dialog', {name: 'Create WorkArea', exact: true});
        await setup.getByRole('button', {name: 'Apply', exact: true}).click();
    }
    await chooseViewLayout(page, layout);
    const chooser = page.getByRole('dialog', {name: 'Choose diagram type', exact: true});
    await chooser.waitFor();
    return chooser;
}

export async function chooseViewLayout(scope, preset = 'dynamic') {
    const dialog = scope.getByRole('dialog', {name: 'Choose view layout', exact: true});
    await dialog.locator(`button[data-surface-preset="${preset}"]`).click();
    await dialog.getByRole('button', {name: 'Continue', exact: true}).click();
    await dialog.waitFor({state: 'detached'});
}

export async function moreAction(scope, name) {
    await scope.getByRole('button', { name: 'More', exact: true }).click();
    await scope.getByRole('menuitem', { name, exact: true }).click();
}

export async function allProperties(scope) {
    await scope.getByRole('button', { name: 'Properties', exact: true }).click();
    await scope.getByRole('region', { name: 'Inspector', exact: true }).getByRole('button', { name: 'All properties…', exact: true }).click();
    return scope.getByRole('dialog', { name: 'Properties', exact: true });
}

export async function inlineName(scope, name) {
    const input = scope.getByRole('textbox', { name: 'Element name', exact: true });
    await input.fill(name); await input.press('Enter');
    await input.waitFor({ state: 'detached' });
    await scope.locator('.ddn-viewer-stage [data-ref][aria-label=' + JSON.stringify(name) + ']').waitFor();
}

export async function paletteElement(page, scope, role, name) {
    await scope.getByRole('button', { name: 'Add element', exact: true }).click();
    const palette = scope.getByRole('region', { name: 'Element palette', exact: true });
    await palette.getByRole('searchbox', { name: 'Find an element type' }).fill(role);
    const tile = palette.locator('button').filter({ has: page.locator('.ddn-palette-id', { hasText: new RegExp('^' + escaped(role) + '$') }) });
    await tile.dblclick(); await inlineName(scope, name);
    await palette.getByRole('button', { name: 'Close the palette', exact: true }).click();
}

/** Walk the visible method -> type chooser, including revisiting a selection. */
export async function chooseDiagramMethod(dialog, method = 'MT01') {
    const back = dialog.getByRole('button', {name: 'All diagram methods', exact: true});
    if (await back.isVisible()) await back.click();
    await dialog.getByRole('group', {name: 'Diagram methods', exact: true}).locator(`button[data-method="${method}"]`).click();
}

export async function selectDiagramProfile(dialog, profile = 'ddn@1', method = 'MT01') {
    await chooseDiagramMethod(dialog, method);
    await dialog.getByRole('group', {name: 'Diagram types', exact: true}).locator(`button[data-profile="${profile}"]`).click();
}

export async function diagramMethodIds(dialog) {
    const back = dialog.getByRole('button', {name: 'All diagram methods', exact: true});
    if (await back.isVisible()) await back.click();
    return dialog.getByRole('group', {name: 'Diagram methods', exact: true}).locator('button[data-method]').evaluateAll(nodes => nodes.map(node => node.dataset.method));
}

export async function diagramProfileIds(dialog, method = 'MT01') {
    await chooseDiagramMethod(dialog, method);
    return dialog.getByRole('group', {name: 'Diagram types', exact: true}).locator('button[data-profile]').evaluateAll(nodes => nodes.map(node => node.dataset.profile));
}
