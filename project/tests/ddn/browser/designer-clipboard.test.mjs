import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {join} from 'node:path';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const build = process.env.DDN_BUILD_ROOT ?? join(root, '.work/builds/ddn');
const {parseCsv, uniqueName, pasteRecords, parseClipboardText, clipRecord, clipboardText} = await import(pathToFileURL(join(build, 'ddn/packages/designer/src/clipboard.js')));
const {zipFiles} = await import(pathToFileURL(join(build, 'ddn/packages/standalone/src/zip.js')));

test('copies never carry identity or lifecycle, and pasted names stay unique in their style', () => {
    assert.deepEqual(clipRecord({id: 'ddn-element-3', role: 'entity', name: 'Order', design: {state: 'accepted'}, acceptance: [], fill: '#fc0'}), {role: 'entity', name: 'Order', fill: '#fc0'});
    const taken = new Set(['Order', 'Order 2', 'model.api']);
    assert.equal(uniqueName('Order', taken), 'Order 3');
    assert.equal(uniqueName('Customer', taken), 'Customer');
    assert.equal(uniqueName('model.api', taken), 'model.api_2');
    const text = pasteRecords([{record: {role: 'entity', name: 'Order'}, position: {x: 10, y: 20}}, {record: {role: 'entity', name: 'Order'}}], new Set(['Order']), {x: 24, y: 24});
    assert.match(text, /element "Order 2" as "entity"/);
    assert.match(text, /element "Order 3" as "entity"/);
    assert.match(text, /x 34/); assert.match(text, /y 44/);
});

test('DDN text copied elsewhere pastes back as the same elements', () => {
    const text = clipboardText([{record: {role: 'service', name: 'Api', title: 'Order API'}, position: {x: 40, y: 8}}]);
    const parsed = parseClipboardText(text);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].record.role, 'service');
    assert.equal(parsed[0].record.title, 'Order API');
    assert.deepEqual(parsed[0].position, {x: 40, y: 8});
    assert.deepEqual(parseClipboardText('not ddn at all'), []);
});

test('CSV import reads quoted fields, infers number columns and makes safe column ids', () => {
    const table = parseCsv('Name,Unit price,"Note, free text"\r\n"Widget ""A""",12.5,first\nGadget,,"multi\nline"\n');
    assert.deepEqual(table.columns.map(c => [c.id, c.type]), [['name', 'text'], ['unit_price', 'number'], ['note_free_text', 'text']]);
    assert.deepEqual(table.rows, [['Widget "A"', 12.5, 'first'], ['Gadget', null, 'multi\nline']]);
    assert.throws(() => parseCsv(''), /header/);
});

test('bundles are valid stored ZIP archives with every entry intact', async () => {
    const entries = [{name: 'main.ddn', bytes: new TextEncoder().encode('erd Sales\n    Customer\n')}, {name: 'styles/theme.css', bytes: new TextEncoder().encode('.x{}')}];
    const bytes = new Uint8Array(await zipFiles(entries).arrayBuffer()), view = new DataView(bytes.buffer);
    const end = bytes.length - 22;
    assert.equal(view.getUint32(end, true), 0x06054b50);
    assert.equal(view.getUint16(end + 10, true), 2);
    let offset = 0;
    for (const entry of entries) {
        assert.equal(view.getUint32(offset, true), 0x04034b50);
        const nameLength = view.getUint16(offset + 26, true), size = view.getUint32(offset + 18, true);
        assert.equal(new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength)), entry.name);
        assert.deepEqual(bytes.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size), entry.bytes);
        offset += 30 + nameLength + size;
    }
    assert.throws(() => zipFiles([{name: '../escape', bytes: new Uint8Array()}]), /Invalid/);
});
