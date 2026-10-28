import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const output = process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const {constrainStandaloneViewport, sameBounds} = await import(pathToFileURL(resolve(output, 'ddn/packages/viewer/src/standalone-viewport.js')));
const view = {file: 'main.ddn', id: 'OnlyView'};
const extent = {x: 40, y: 70, width: 600, height: 400};

test('standalone camera cannot zoom out into or pan across unused workarea', () => {
    const fitted = constrainStandaloneViewport({bounds: {x: -9000, y: 9000, width: 3000, height: 2400}, zoom: .5, activeView: {file: 'other.ddn', id: 'Hidden'}}, extent, view);
    assert.deepEqual(fitted, {bounds: {x: 40, y: 70, width: 300, height: 200}, zoom: .5, activeView: view});
    const zoomed = constrainStandaloneViewport({bounds: {x: 9000, y: -9000, width: 600, height: 400}, zoom: 2}, extent, view);
    assert.deepEqual(zoomed, {bounds: {x: 340, y: 70, width: 600, height: 400}, zoom: 2, activeView: view});
});

test('standalone updates retain an interior camera and clamp when the view shrinks', () => {
    const camera = {bounds: {x: 140, y: 170, width: 600, height: 400}, zoom: 4, activeView: view};
    assert.deepEqual(constrainStandaloneViewport(camera, extent, view), camera);
    const smaller = {x: 40, y: 70, width: 100, height: 80};
    assert.deepEqual(constrainStandaloneViewport(camera, smaller, view), {bounds: {x: 40, y: 70, width: 400, height: 320}, zoom: 4, activeView: view});
});

test('fit detection distinguishes a deliberate zoom from layout rounding', () => {
    assert.equal(sameBounds(extent, {...extent, x: extent.x + .0001}), true);
    assert.equal(sameBounds(extent, {...extent, width: extent.width / 2}), false);
});
