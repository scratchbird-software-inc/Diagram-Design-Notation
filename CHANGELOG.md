# Changelog

## Unreleased

- Add `chebotko.conceptual@1` (method MT22), the Chebotko conceptual data model for Cassandra and YCQL design. It inherits `chen.binary@2`, renders with the Chen projection, requires cardinality at both ends in review, and rejects n-ary relationships. Profiles now total 152.
- Remove a stale reference to a nonexistent codex build script from the codex README.

## ddn-next-1 — 2026-10-28 public repository migration

- Replace the incompatible 0.8 proof of concept with the standalone DDN implementation developed in the DDN open-source tree.
- Adopt the current language, property/default codex, utility API 1.0, type declarations and 151 bounded profile contracts.
- Deliver read-only viewer, local visual designer and shared verifier as ESM, single-file HTML and modular offline tools.
- Replace the public website, documentation and wiki with current syntax/API material, converted examples and buildable references.
- Preserve all 163 converted original examples and 466 views, with current additions bringing the gallery to 166 examples and 474 views; preserve original conversion hashes and third-party attribution.
- Replace legacy tests and workflows with standalone boundary/type/runtime/browser/website qualification and gated Pages publishing. Retired implementation and release notes remain in Git history.

The language identifier is not a semantic package release number. Package manifests retain their upstream staging version. Chromium test evidence does not establish the full cross-browser, accessibility, performance or external-output-adapter release matrix.
