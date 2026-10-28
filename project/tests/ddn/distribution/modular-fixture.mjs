import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
export function modularFixture(work) {
    mkdirSync(join(work, 'tmp'), { recursive: true });
    const root = mkdtempSync(join(work, 'tmp/ddn-modular-')), built = join(root, 'compiled'), destination = join(root, 'distribution');
    const files = {
        'shared.js': 'globalThis.sharedRuns=(globalThis.sharedRuns||0)+1;export const value=7;',
        'cycle-a.js': 'import{b}from"./cycle-b.js";export const a=2;export function total(){return a+b;}',
        'cycle-b.js': 'import{a}from"./cycle-a.js";export const b=3;export function first(){return a;}',
        'standalone/src/modular-worker.js': 'import{value}from"../../shared.js";postMessage({value,verified:globalThis.verified||[],hasUi:typeof globalThis.rendered!=="undefined"});',
    };
    for (const mode of ['viewer', 'designer', 'verifier']) files['standalone/src/modular-' + mode + '-entry.js'] = 'import{value}from"../../shared.js";import{total}from"../../cycle-a.js";globalThis.utility=' + JSON.stringify(mode) + ';export const result=value+total();';
    for (const mode of ['viewer', 'designer', 'verifier']) files['standalone/src/modular-' + mode + '-api.js'] = 'import{value}from"../../shared.js";export const result=value;';
    for (const family of ['graphs', 'charts', 'geography', 'surfaces']) {
        files['families/' + family + '.js'] = 'export const family=' + JSON.stringify(family) + ';';
        files['profiles/src/families/' + family + '.js'] = 'import{family}from"../../../families/' + family + '.js";import{value}from"../../../shared.js";(globalThis.verified??=[]).push(family);export const answer=value;';
        files['standalone/src/families/' + family + '.js'] = 'import{family}from"../../../families/' + family + '.js";import{value}from"../../../shared.js";(globalThis.rendered??=[]).push(family);export const answer=value;';
    }
    for (const [name, source] of Object.entries(files)) { const path = join(built, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, source); }
    return { root, built, destination, files };
}
