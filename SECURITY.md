# Security policy

Do not publish sensitive model or sample data in a public issue. The core
renderer must not execute imported source or fetch arbitrary remote
resources; the security boundary is defined in
`standard/specification/08-security-and-accessibility.md`.

## Reporting

> [!IMPORTANT]
> Before this repository is made public, maintainers must establish a real
> private vulnerability reporting channel (GitHub private vulnerability
> reporting or a security contact address) and replace the line below. Until
> then, report vulnerabilities privately to the repository owner.

**Contact:** *(to be established before public release)*

Include the affected version, a minimal sanitized reproducer, expected vs.
actual behaviour, and impact. Keep dependency vulnerability review separate
from language conformance testing.

## Boundaries

- The CLI rejects workspace escapes, symlinks outside the workspace, and
  remote imports; please report any bypass.
- Source archives (ZIP) are not redacted publications; profile-based export
  is the only sanctioned public output path.
- Local fixture tests are not a security qualification.
