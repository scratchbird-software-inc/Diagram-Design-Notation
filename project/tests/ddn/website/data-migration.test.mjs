import test from 'node:test';
import assert from 'node:assert/strict';
import { convertData, finalizeDataDocument } from '../../../../tooling/website/migrate-data.mjs';

const source = (profile, projection, elements = []) => ({ entry: 'examples/input.ddn', view: 'review', resolved: { view: { id: 'example::review', local: 'review', name: 'Review', selected: elements.map(element => element.id), relations: [], profiles: { projection: { kind: profile.split('.')[0], profile, ...projection } } }, elements, relations: [] } });
const record = (id, values) => ({ id, name: 'Label ' + id, kind: 'record', properties: { x_record: values } });
const context = { file: 'examples/input.ddn' };

test('chart migration preserves measured values and binds extension channels through metadata', () => {
    const input = source('chart.basic@1', { mark: 'bar', records: [{ $ref: 'one' }], x: 'x_record.region', y: 'x_record.sales', aggregate: 'mean', width: { $quantity: 640, unit: 'px' } }, [record('one', { region: 'North', sales: 23.5 })]);
    const document = convertData(input, context), options = document.views[0].projection.options;
    assert.deepEqual(document.definitions[0].metadata.x_record, { region: 'North', sales: 23.5 });
    assert.deepEqual(options.records, [{ file: context.file, id: 'one' }]);
    assert.equal(options.x, 'metadata.x_record.region'); assert.equal(options.y, 'metadata.x_record.sales');
    assert.equal(options.width, 640); assert.equal(options.aggregate, 'average');
});

test('named layers become the same marks in actual first-occurrence series order', () => {
    const input = source('chart.quality@1', { kind: 'chart', records: [{ $ref: 'target' }, { $ref: 'actual' }], series: 'x_record.kind', layers: [{ series: 'Actual', mark: 'bar' }, { series: 'Target', mark: 'line' }] }, [record('target', { kind: 'Target' }), record('actual', { kind: 'Actual' })]);
    assert.deepEqual(convertData(input, context).views[0].projection.options.layers, [{ mark: 'line' }, { mark: 'bar' }]);
});

test('canvas panel membership and grid geometry survive conversion without copying data', () => {
    const input = source('canvas.bmc@1', { kind: 'panels', columns: 10, panels: [{ id: 'kp', title: 'Partners', row: 0, column: 0, rowspan: 2, colspan: 2, items: [{ $ref: 'note' }] }] }, [{ id: 'note', name: 'Roaster cooperative', kind: 'note', properties: { description: 'Coffee beans from the cooperative.' } }]);
    const document = convertData(input, context), panel = document.definitions.find(value => value.id === 'review::panel::kp');
    assert.deepEqual(panel.metadata.x_record, { id: 'kp', row: 0, column: 0, rowspan: 2, colspan: 2, items: [{ file: context.file, id: 'note' }] });
    assert.equal(document.definitions.filter(value => value.id === 'note').length, 1);
    assert.equal(document.views[0].projection.options.panels[0].target.id, panel.id);
});

test('repeated composed children use independent inclusion placement and one source view', () => {
    const input = source('panels.composed@1', { kind: 'panels', columns: 2, panels: [{ id: 'left', view: { $ref: 'example::chart' }, row: 0, column: 0 }, { id: 'right', view: { $ref: 'example::chart' }, row: 0, column: 1 }] });
    const document = convertData(input, context);
    document.views.push({ id: 'chart', name: 'chart', profile: 'chart.basic@1', projection: { options: { x: 'month', y: 'sales' } } });
    finalizeDataDocument(document);
    assert.equal(document.views.length, 2); assert.equal(document._composedSlots, undefined);
    assert.equal(document.views.find(view => view.id === 'chart').metadata, undefined);
    assert.equal(document.views[0].projection.options.panels[0].target.id, 'chart');
    assert.equal(document.views[0].projection.options.panels[1].target.id, 'chart');
    assert.equal(document.views[0].projection.options.panels[0].layout.column, 0);
    assert.equal(document.views[0].projection.options.panels[1].layout.column, 1);
});

test('decision migration retains predicates and output values with explicit reusable domains', () => {
    const input = source('decision.rules@1', { kind: 'decision', inputs: [{ key: 'severity', type: 'enum', values: ['low', 'high'] }], outputs: ['route'], records: [{ $ref: 'high' }], coverage: 'complete' }, [{ id: 'high', name: 'High severity', kind: 'rule.row', properties: { x_rule: { when: { severity: { op: 'eq', value: 'high' } }, then: { route: 'Review' } } } }]);
    const document = convertData(input, context), options = document.views[0].projection.options, rule = document.definitions.find(value => value.id === options.records[0].id);
    assert.deepEqual(rule.metadata.x_rule.outputs, { route: 'Review' });
    assert.deepEqual(rule.metadata.x_rule.inputs['review::input::severity'], { op: 'eq', value: 'high' });
    assert.deepEqual(document.definitions.find(value => value.id === options.inputs[0].id).content.allowed_values.values, ['low', 'high']);
    assert.equal(options.coverage, 'error');
});

test('decision interval migration preserves open and closed endpoints', () => {
    const predicate = { op: 'interval', min: 10, max: 20, lower_closed: true, upper_closed: false };
    const input = source('decision.rules@1', { kind: 'decision', inputs: [{ key: 'amount', type: 'number' }], outputs: ['route'], records: [{ $ref: 'band' }] }, [{ id: 'band', name: 'Middle band', kind: 'rule.row', properties: { x_rule: { when: { amount: predicate }, then: { route: 'Review' } } } }]);
    const document = convertData(input, context), rule = document.definitions.find(value => value.id === document.views[0].projection.options.records[0].id);
    assert.deepEqual(rule.metadata.x_rule.inputs['review::input::amount'], { op: 'interval', min: 10, max: 20, include_min: true, include_max: false });
    assert.deepEqual(predicate, { op: 'interval', min: 10, max: 20, lower_closed: true, upper_closed: false });
});
