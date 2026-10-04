# 51. Version and compatibility contract (DDN 0.8 draft)

> Examples in this chapter use 0.8 (0.6-dialect) syntax, fenced ```ddn-0.8. The reference runtime implements this chapter; the doc-snippet parse gate (`notation/tests/doc-snippets.js`) parse-checks every fence under a `ddn "0.6";` header.

Status: **draft specification for the 0.8 standard revision**; the reference
runtime implements this contract (its packaging stamp remains 0.7.0 ahead of
the 0.8 release). This chapter is the conformance
prerequisite for every other 0.8 chapter (52–58): it fixes which source
versions exist, what an 0.8 processor owes each of them, and what may change
under which process. Nothing here outranks `governance/VERSIONING.md`; this
chapter restates the layered rules as an implementer-facing contract.

## 51.1 Accepted header values

Every `.ddn` file begins with a source-language declaration:

```ddn-0.8
ddn "0.6";
```

An 0.8 processor MUST accept exactly the source versions `"0.2"`, `"0.3"`,
`"0.4"`, `"0.5"`, and `"0.6"`. Any other value — including `"0.7"`, `"0.8"`,
`"1.0"`, an unquoted token, or a missing declaration — is a coded parse error
(`DDN012`, existing). The version string is a scalar claim about the file's
source dialect, not a negotiation: a processor never rewrites the header, and
a mixed-version workspace keeps each file's own declared version.

The layers stay distinct, per `governance/VERSIONING.md`:

| Layer | 0.8 value |
|---|---|
| Language source version (`ddn "x";`) | accepted set 0.2–0.6; **0.6 is new in the 0.8 standard** |
| Runtime / notation package semver | 0.8.x (packaging release; 0.6.0-beta.1 and 0.7.0 introduced **no** source version) |
| Core registry identity | `ddn-core@0.3` (unchanged) |
| Standard document set | chapters 00–58, stamped 0.8 |

A document written `ddn "0.5";` remains a 0.5 document forever; it is never
silently upgraded. A processor MUST NOT infer a newer dialect from file
content and MUST NOT rewrite headers during normalization or bundling.

## 51.2 What each accepted version means in an 0.8 processor

- **0.2** — original compat baseline; accepted through the disclosed 0.2
  compatibility path (chapter 00). No new features apply.
- **0.3 / 0.4 / 0.5** — the current production dialects. An 0.8 processor MUST
  parse, validate and render them with the same semantics the 0.7 processor
  produced. New 0.8 syntax (chapters 52–58) is **not available** in these
  dialects: encountering an 0.8 keyword or property in a `ddn "0.5";` file is
  `DDN-V04` (unknown in declared dialect), never silent acceptance.
- **0.6** — the 0.8 dialect. Everything in 0.5 plus: view `kind` declarations
  and profile strictness (52), publication chrome records, page border,
  backgrounds and publication sets (53), text-fit modes (54), markings,
  assertions, provenance and `ref:` anchors (55). A `ddn "0.6";` file that
  uses none of the new constructs MUST produce output byte-identical to the
  same file re-stamped `ddn "0.5";` — the version line itself is the only
  permitted difference in rendered output.

## 51.3 Feature-gating rule

Every normative 0.8 construct is gated on source version 0.6. The gate is
checked at parse/validation time:

- 0.8 construct in a ≤0.5 file → `DDN-V04`, error, naming the construct and
  the minimum source version.
- ≤0.5 construct in a 0.6 file → accepted unchanged; 0.6 removes nothing.
- A workspace mixing versions (via `import`) assembles each module under its
  own declared version; constructs introduced by an imported 0.6 module are
  visible to a 0.5 importer only through ordinary references — the importing
  file cannot *spell* 0.8 syntax itself.

## 51.4 Deprecation policy

Within the pre-1.0 draft series:

1. Nothing accepted in a published source version is removed from a later
   accepted source version. Obsolete spellings MAY be marked *deprecated* in
   the standard text; deprecated constructs keep their meaning and MUST keep
   working, with an info-level diagnostic `DDN-V05` pointing at the
   replacement.
2. Tightening validation of previously accepted **invalid** metadata is
   permitted with new error codes and fixtures covering both acceptance and
   rejection (`VERSIONING.md` rule 2). Tightening that rejects previously
   *valid* documents is a language change requiring an RFC.
3. Profiles remain immutable per published `name@version`; changed profiles
   ship under a new version number.
4. A deprecation becomes a removal only at 1.0, by explicit RFC, with the
   removal noted in this chapter.

## 51.5 Stability promises an implementer may rely on

Given identical inputs — same source bytes, same declared view, same pinned
font metrics (chapter 54 §T4), same renderer version — an 0.8 processor MUST
produce byte-identical SVG and identical diagnostics across runs and across
platforms. Diagnostic codes and their severity are part of the contract:
rewording a message is allowed, changing a code or its severity is not, except
through the tightening path of §51.4.2.

Not promised (unchanged from 0.7): stable coordinates across arbitrary source
edits; byte-identity across different renderer versions; byte-identity when
font metrics are estimated rather than pinned (`DDN-TW01`); byte-identity of
outputs that embed wall-clock data such as the `$date` publication variable
(chapter 53).

## 51.6 Diagnostic codes allocated by this chapter

| Code | Severity | Meaning |
|---|---|---|
| `DDN-V01` | error | Mixed workspace declares an entry version newer than any imported module can supply (a 0.6 construct is referenced from a 0.5 file through an alias that hides its origin). |
| `DDN-V02` | error | File declares `ddn "0.6";` but a construct's semantics depend on a profile version not installed. |
| `DDN-V03` | warning | A construct is newly introduced in 0.6 and has no 0.5 spelling; emitted by tooling that must round-trip older dialects. |
| `DDN-V04` | error | 0.8 (0.6-dialect) keyword or property used in a file declaring source version ≤ 0.5; message names the construct and the minimum version. |
| `DDN-V05` | info | Deprecated construct used; message names the replacement spelling. |
| `DDN-V06` | info | File declares a source version older than the workspace's newest; informational only, never a failure. |
