# Privacy, safety, local files and authorized export

**DDN Designer specification 0.2.0-beta.1 — proposed; baseline audited 0.6.0-beta.1.**

## Threat model
Treat source, filenames, labels, notes, profile metadata, imported archives and assets as untrusted input. Treat installed renderer/descriptor/adapter code as trusted versioned application code. The host decides which workspace data a user may receive. Once confidential source has been sent to a browser, a view visibility control cannot protect it from that user.

## Source and profiles
No eval, Function construction, executable DDN expressions or untrusted SVG event handlers. Descriptor visibility conditions use a whitelisted AST. Profile names select installed versions; they do not authorize downloading code. Unknown extensions are retained as data without automatic execution. References are IDs/paths, not fetch instructions. External URLs require explicit host policy and safe schemes.

## Files and archives
Require normalized relative paths, reject traversal/absolute paths, limit file count, expanded bytes, per-file size and nesting, and detect duplicate archive paths. Validate extensions and actual content. Never write to arbitrary disk locations. Opening several `.ddn` files preserves imports where their relative paths are known; unresolved imports become visible issues with a file-picker resolution action, not remote fetches.

Source ZIP/JSON export is an internal workspace handoff and can include sensitive information. SVG publication is a different workflow. Offer raw script, complete dependency workspace, internal review SVG and policy-authorized export as distinct choices. The source choice states that it includes hidden definitions. The original projected redaction fail-closed behavior remains until a separately qualified export closure exists.

## Persistence
By default process locally. Browser draft recovery is explicitly opt-in and shows where data is kept. Provide Clear local recovery and private-mode guidance. File-system access APIs are an optional enhancement; upload/download remain the portable baseline. Shared server storage, accounts and collaboration are not introduced silently. Concurrent editors compare revisions rather than overwriting each other's files.

## SVG and rendering
Use the existing escaping/sanitization path and scoped SVG identifiers. Labels are plain text. Imported images have an asset policy and no hidden automatic tracking requests. Custom fonts are host-supplied references with explicit fallback metrics; do not redistribute fonts from a developer machine. Export strips selection handles, pending ghosts, inspector content and internal diagnostic data unless expressly included in a review export.

## Resource isolation
The renderer's source/view limits remain until replaced by measured capacity controls. A worker boundary must have memory/time budgets and termination. Expensive decision partitions and recursive child views require their own caps. Cancelling a UI promise is not process isolation. A resource-limit error preserves source drafts and offers splitting into linked views.

## CSP and deployment
Design an external-script/style production build with a reviewed CSP and optional Trusted Types integration. The offline review prototype uses inline content and is not a strict-CSP production distribution. Do not instruct users to disable browser security or sandbox protections. Local servers and directory-access permissions are separate deployment issues from renderer correctness.
