# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately, not in a public issue. On GitHub, open the repository's
**Security** tab and choose **Report a vulnerability** (private vulnerability reporting). Include
the version, the browser, a minimal page or steps that show the problem, and what an attacker could
do with it.

We aim to acknowledge a report within a week and to agree a disclosure date with you once a fix is
ready. Fixes ship as a patch release, with the advisory published on GitHub.

## Supported versions

| Version | Supported |
|---|---|
| 0.3.x | Yes: the latest patch release gets security fixes |
| < 0.3 | No (never published) |

Pipeup is alpha until 1.0; only the newest minor version receives fixes.

## Security model, in brief

- **Text only.** Comment content, names and quoted text are untrusted and are only ever rendered as
  text, never as HTML, so a comment can't run code or change the page.
- **Signed comments.** Every comment, reply and resolve is signed with its reviewer's key. Merged
  comments that fail verification are rejected, so others can't forge or alter them.
- **No network.** Pipeup makes no network requests: comments stay in the reviewer's browser until
  they choose to copy them.
- **No telemetry.** No analytics, tracking or telemetry of any kind, and no runtime dependencies, in Pipeup or its add-ons.
- **Your page stays yours.** All of Pipeup's UI lives in its own shadow root; it doesn't rewrite the
  host page.
- **Verifiable builds.** Each release is published to npm with provenance, and its notes give the
  SRI `integrity` value for the pinned CDN script.

The document key in `data-pipeup-doc` is not a secret from anyone who has the file: it is shared
with the page by design.
