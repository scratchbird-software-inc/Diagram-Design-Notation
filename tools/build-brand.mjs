#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later. Keep the npm build entry point
 * while the SVG extraction and colour variants use Python's XML parser. */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'build-brand.py');
execFileSync(process.env.PYTHON || 'python3', [script], {
  env: process.env,
  stdio: 'inherit',
});
