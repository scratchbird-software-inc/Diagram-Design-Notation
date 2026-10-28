import { cpSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { root, environment, outputPath } from '../workspace/context.mjs';

const env = environment();
const destination = outputPath(join(env.DDN_BUILD_WORKAREA, 'tools/browser'));
const node = join(env.DDN_BUILD_WORKAREA, 'tools/toolchain/node/bin/node');
const npm = join(env.DDN_BUILD_WORKAREA, 'tools/toolchain/node/lib/node_modules/npm/bin/npm-cli.js');
mkdirSync(destination, { recursive: true });
for (const file of ['package.json', 'package-lock.json']) cpSync(join(root, 'tooling/browser', file), join(destination, file));
function run(args) {
    const result = spawnSync(node, args, { cwd: destination, env: { ...env, PLAYWRIGHT_BROWSERS_PATH: outputPath(join(env.DDN_BUILD_WORKAREA, 'browsers')) }, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}
run([npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund']);
run([join(destination, 'node_modules/playwright/cli.js'), 'install', 'chromium']);
