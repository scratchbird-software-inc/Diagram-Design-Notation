# Verification — DDN Designer specification and prototype

Prepared 8 September 2026. This is an author-produced research/specification package with a bounded interaction prototype. It is **not** a production Designer release or a patch to the existing Studio.

## Audited foundation

The accessible complete DDN field-guide archive was extracted and the endpoint-ordering patch overlaid on an analysis copy. Its runtime identifies itself as **0.5.0-draft.2**. The copied prototype library has SHA-256:

```text
05ba94e1a9add994e16523f2b0f862b0b5dc3c733e293987aa287f1c6cc1585d
```

The registry contains 152 core kinds and 36 profile kinds, 90 core relation kinds and19 profile relations,118 core facets,179 glyph recipes and24 installed profile versions. The editor navigation proposal maps all188 kinds and109 relations. Five used profile silhouettes are absent from the top-level shape enumeration; this audit records the metadata gap rather than modifying the baseline.

Thirteen public-API probes were executed in fresh in-memory workspaces: render, shared labels/undo, pin/unpin, generic creation destination, fields, field references, dependent deletion, revision conflict, invalid drafts, invalid kinds, size-only placement, generic kind change and incomplete flowchart construction. These are **observations**, including deliberate rejections, not13 claims of completed new editor functionality.

## Executed deliverable checks

| Suite | Result | Evidence |
|---|---:|---|
| Prototype browser interactions |31/31|`tests/prototype-browser-report.json`|
| Review website filtering/navigation/screens |8/8|`tests/review-site-browser-report.json`|
| Artifact, contract, scope and baseline-identity checks |36/36|`tests/artifact-validation.json`|
| Planned production acceptance cases |84 specified, not executed|`tests/acceptance-plan.json`|

The31 prototype checks include real palette clicks, HTML drag/drop, pointer drag-to-pin, property edits, named-field connection creation, exact undo, shared-view updates, layout/look changes, data-bound view restrictions, DDN/ZIP/SVG downloads, keyboard model selection and invalid-edit rejection. These do not establish full visual editor implementation, accessibility or security.

The8 review-site checks verify20 chapters,188 kind rows, filters, screen enlargement and absence of uncaught page errors. The36 artifact checks include JSON Schema validation, positive and negative descriptor/command fixtures, complete kind/relation mapping, basic-control bounds, no font files, baseline source hashes and local links. Counts overlap and must not be combined into independent proofs.

## Browser environment

Chromium **144.0.7559.96** was used. Ordinary loopback HTTP navigation was attempted and blocked by the execution environment with `ERR_BLOCKED_BY_ADMINISTRATOR`. The harness then injected the complete standalone page into a fresh browser page and exercised actual code and controls. The original missing-headless-shell setup attempt and subsequent harness corrections are documented in the findings.

There is no claim that the prototypes were qualified in current Chrome or Firefox, under normal file/HTTP navigation, Flatpak portals, strict CSP, Trusted Types, touch/pen devices, screen readers, or the full WCAG criteria. Those are proposed production gates. No new full391-view library regression or ERP/business test suite was run because this deliverable does not modify that library.

## Scope preserved

No existing Studio, router, DDN source or production distribution file was changed. The audit validates that all15 inspected baseline files retain their recorded hashes. The working prototype uses the real patched runtime; its richer conversion/draft/impact dialogs are labeled nonexecuting storyboards. No npm/CDN publication, production application, independent review or standards certification is claimed.

The property schemas, shape recipe schema, command contracts and TypeScript API are **proposals**. They are not new exports from `DDNLive` until implemented. The screenshot gallery is generated from the editable HTML/CSS prototype, not a promise that all visible conceptual workflows already exist.

## Reproduce

Browser reading requires no installation. Open `DDN-Designer-Prototype.html` or `index.html` from the complete package. For reliable multi-file access:

```bash
python3 -m http.server 8781 --bind 127.0.0.1
```

Artifact/optional test tooling requires Python3 with `requirements-dev.txt`. JavaScript audit probes use the baseline library and Node.js22 or later:

```bash
node tools/audit-runtime.cjs /path/to/patched-ddn audit/runtime-probes.json
python3 tools/build-audit.py /path/to/patched-ddn
python3 tools/validate-artifacts.py /path/to/patched-ddn
python3 tests/prototype-browser.py
python3 tests/review-site-browser.py
```

The test harness's installed Chromium path is configurable with `CHROMIUM_PATH`. The recorded container runs used `--no-sandbox` in an isolated test process; reproducing that special mode requires explicit `DDN_TEST_NO_SANDBOX=1`. Do not disable production browser security to solve deployment problems. The included prototype is not a secure untrusted-document hosting solution.
