#!/usr/bin/env bash
set -euo pipefail
DDN_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DDN_ROOT"
node tooling/workspace/run.mjs "$@"
