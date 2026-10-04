# 56. Tooling and workspace conventions (DDN 0.8 draft)

Status: draft for the 0.8 standard revision. X1–X2 specify new CLI surface;
X3–X4 write down, as normative convention, behavior the 0.7 CLI already
implements (`notation/cli/cli.js`) so third-party tools can rely on it.
Nothing in this chapter changes the language; it standardizes the tool
interface around it.

## 56.1 CLI legality query (X1)

```text
node notation/cli/cli.js verbs --from <kind> --to <kind>
```

prints, one per line, the relation verbs whose registered endpoint contract
(`standard/registry/relation-constraints.json`) admits a relation from an
element of kind `<kind>` to an element of kind `<kind>`:

```text
$ node notation/cli/cli.js verbs --from task --to decision
flow
ref
```

- Kinds and verbs are registry identifiers; unknown kinds are `DDN-WS01`
  (message lists close matches by edit distance when any exist).
- The answer is computed from the installed registry plus any `--pack`/
  profile extensions registered for the run — the same data `check`
  validates against. There is no cached static list.
- Output is plain text, one verb per line, sorted in registry order; empty
  result = no legal verb (exit code 0, empty stdout). Machine form:
  `--json` emits `{"from":"…","to":"…","verbs":["…"]}`.
- The query answers **endpoint legality only**. It does not predict layout,
  profile-specific restrictions (a profile may still reject the relation,
  e.g. `DDN-PF007`), or rendering success.

## 56.2 Diagnostic hints (X2)

Where a failing rule has one obvious fix, the diagnostic message MUST carry
it. Conventions, already followed by DDN071/DDN047 and now normative:

1. The message names the offending identity, the violated constraint, and
   the concrete remedy with its current value where applicable:
   "… below minimum 10.67px — increase base font to ≥15.5px …".
2. When more than one remedy exists, name the least destructive one first;
   never list remedies the author's own declarations rule out (e.g. do not
   suggest raising a bound the author pinned).
3. Hints are advisory text, never applied automatically. A tool that fixes
   source does so through an explicit, undoable edit (designer, chapter 57).
4. Machine consumers use the `code`, never message text; messages may be
   reworded between versions (chapter 51 §51.5).

## 56.3 Workspace manifest conventions (X3)

A DDN workspace is a directory tree of `.ddn` files. The conventions below
record what the 0.7 CLI does and are normative for 0.8 tools:

1. **Entry file.** The entry is named explicitly (CLI argument, tool
   `?entry=` parameter). When a tool must guess, it looks for
   `main.ddn`, then `index.ddn`, then the single `.ddn` file if exactly one
   exists at the root; ambiguity is reported, never resolved by mtime.
2. **Workspace root.** The root is `--workspace DIR` (default: current
   directory). The entry MUST resolve inside the root; an entry outside is
   rejected. Imports resolve **relative to the importing file's directory**,
   must stay inside the root, and absolute paths, `..` escapes above the
   root, scheme URLs and symlink escapes are rejected ("Unsafe import
   path"). Import cycles are visited once.
3. **Module resolution.** Within the assembled file set, references resolve
   by module-qualified identity (chapter 01/03): sibling sections of one
   multi-module file without import, imported modules by alias. Conflicting
   identities fail (`DDN013/014/023/024`); there is no import-order shadowing.
4. **Side-loaded assets.** Architecture `files` and `x_link.file` join the
   workspace under the same path-safety rules. Optional packs are registered
   per run with `--pack` (never inlined into runtimes).
5. **Manifest file.** A workspace MAY carry `ddn.workspace.json` at the root:
   `{ "format": "ddn-workspace@1", "entry": "main.ddn", "packs": [] }`.
   Tools that find one prefer its `entry` over the guessing order. Absence
   of the manifest is normal and never an error; a malformed manifest is
   `DDN-WS02`.

## 56.4 Cross-file diagnostic stability (X4)

Every diagnostic that concerns source text carries a stable,
machine-parseable location:

```json
{"code":"DDN-PJ104","severity":"error","file":"model/billing.ddn","line":42,"view":"billing","message":"…"}
```

- `file` is the workspace-root-relative POSIX path (`/` separators, no
  leading `./`), exactly as the import graph spells it — stable across
  machines mounting the workspace at different absolute paths.
- `line` is 1-based in that file's UTF-8 text. Diagnostics without a single
  source site (cross-file identity conflicts, render-stage quality reports)
  carry `file`/`line` of the primary site plus the other site named in the
  message; truly site-less diagnostics (e.g. `DDN-LW06`) omit both fields
  rather than fabricating one.
- The JSON shape `{code, severity, file?, line?, view?, message}` is the
  contract. Fields are never renamed; new fields may be added additively.
  `severity` is one of `info|warning|error`.
- Designer diagnostic lists (chapter 57 §D3) and CI gates consume this shape
  directly; line stability follows source stability — tools that rewrite
  source (normalization, bundle) are exempt and say so.

## 56.5 Diagnostic codes allocated by this chapter

| Code | Severity | Meaning |
|---|---|---|
| `DDN-WS01` | error | `verbs` query with an unknown kind; message lists close matches. |
| `DDN-WS02` | error | Malformed `ddn.workspace.json` (bad JSON, unknown `format`, entry not a `.ddn` in the root). |
| `DDN-WS03` | error | Entry guessing found multiple candidate entry files and no manifest; message lists them. |
| `DDN-WS04` | error | Entry file missing or unreadable. |
