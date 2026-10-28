# Security policy

Report security issues privately to the repository owner; do not include sensitive source models or data in public issues. GitHub private vulnerability reporting was not enabled at the ddn-next-1 migration. Include a sanitized reproducer, affected contract/build, expected behavior and impact.

DDN source parsing must not execute authored expressions or scripts. Includes and assets are supplied explicitly by the host; core modules do not fetch arbitrary missing dependencies. The viewer is read-only; designer edits use explicit authority and revision checks. Publication/redaction boundaries differ from saving editable source. See the adopted utility contracts and implementation documentation for their exact scope.

Tests establish bounded behavior, not a complete security assessment. Commercial host authentication and collaborative services are separate from the standalone foundation.
