# DDN 0.3 — Security and accessibility

Treat a model, its samples and its embedded descriptions as potentially sensitive. The full semantic model and source editor are private-design artifacts unless deliberately published. Hiding a field is not redacting it.

## Explicit publication closure

```ddn
export {
 mode: redacted;
 elements: [@model.directory];
 fields: [@model.directory.staff_id,@model.directory.display_name];
 properties: [kind];
 identifier_mode: opaque;
 title: "Approved directory view";
}
```

An omitted field allowlist is not equivalent to an intentional empty list. Unknown entries and arbitrary free-text property exports fail. Nested fields require their ancestors to be explicitly included. Relations survive only when both approved endpoints and any member endpoints survive. Public output uses opaque IDs by default, strips source positions/paths and unapproved descriptive metadata, and removes nested views/samples. The same projection drives `Render.render`, CLI `resolve` and the editor JSON export.

The rule is **allowlisted does not mean automatically safe**: approved names or structured values may still contain sensitive content. Only an authorized publisher can approve that list. The complete teaching ZIP intentionally contains synthetic private and public examples; it is not itself an anonymized export.

## Input and runtime protections

The reader rejects prototype keys, malformed escapes and unsafe workspace imports. Typed guards are data, not JavaScript or SQL; unsupported operators fail. The renderer XML-escapes untrusted text. It does not execute SQL, authentication, bank transfers or external URLs found in descriptions. Extension validators are registered pure code/data, not downloaded from a diagram. Resource/search/depth bounds prevent unbounded processing; exceeding one is an error, not success.

## Accessibility and print

Colour never carries the only canonical meaning. Registered symbols, text/token fallbacks and line patterns preserve distinctions in neutral output. SVG has titles, descriptions, node identities and textual legends. Selected font measurement and readability checks help prevent clipping, but are not a WCAG certification. Keyboard and assistive-technology testing belongs to the target publishing/editor environment. Do not claim those tests solely from an SVG screenshot.

## Audit contracts

A content digest detects a mismatch against a trusted expected digest; it does not establish custody or prevent an administrator replacing both. `x_custody` requires separate anchor authority, key custodian, retention/hold policies and independent-evidence obligations. The release leaves real evidence custody and independent review pending.
