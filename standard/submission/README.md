# Standards-body submission drafts (DDN + DDNA)

**Draft status: 2026 draft, pre-submission.** Nothing here has been
submitted to or accepted by any standards body, and no standard number is
assigned anywhere in these drafts — a standards body assigns numbers.

## Contents

- `ddn-submission.md` — the DDN standard submission draft (generated).
- `ddna-submission.md` — the DDNA standard submission draft (generated).
- `facts.json` — every number cited in the drafts, with the source path
  each count was computed from.

## Regenerating

```bash
node tools/build-submission.mjs           # regenerate facts.json + both drafts
node tools/build-submission.mjs --check   # drift-check (also run by the test suite)
```

The drafts are **generated**, never hand-counted: the generator reads
`standard/registry/**`, `standard/specification/`, `ddna/`, the
diagnostic fix guide, and `NOTICE.md`, computes every count, and renders
the markdown from templates. If a count or a claim drifts from the
sources, `--check` fails — it is wired into the project's test suite as a
freshness gate.

## Grounding rules

Every external-standards claim copies the wording already ratified in
`standard/specification/` and `ddna/` ("mirrors" / "based on" / honest
exclusions) — never stronger. No internal project identifiers or
change-record numbers appear in the drafts; status is DRAFT proposal
throughout.
