# Standalone DDN source boundary

Inherit the root AGENTS.md. The current owner task replaces the public project with the new open-source DDN materials. This tree implements `ddn-next-1`; the retired parser is not a compatibility target.

DDN code and original documentation/site material are GPL-2.0-or-later. Preserve the standalone licence, sponsorship and third-party notices. No commercial Weaver implementation, services, account or subscription belongs in this dependency graph.

Core language/model/verifier packages must not depend on DOM or Node APIs; browser adapters are explicit. The compiler-resolved boundary gate checks this. Adopted public specifications live under `standard/`; declarations in `packages/types` mirror `standard/utilities/contracts`. Run `node project/ddn/tooling/sync-contracts.mjs --check`; use `--write` only for a reviewed contract update. Type checks are distinct from runtime/release evidence.

Maintained imported regression suites are under `project/tests/ddn`. Agents keep new probes, test fixtures, logs, caches, browsers and generated builds in the dedicated work area and run builds from a disposable checkout. Do not add dual parsers or closed platform code.
