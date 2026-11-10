# Public design review on the existing website

## Design

Keep the current home page and add a quiet Design & feedback link. Serve the generated Pipeup design under `/design/`, preserving its `site/` and `prototype/` relative paths. A small Submit review control gathers anchored comments and an optional overall suggestion. It keeps drafts on failure and confirms a durable receipt.

The review service is separate from GitHub Pages. The initial release allowed anonymous submission. The revised requirement is signed-in submission through common providers; only the configured owner may read private records or change decisions. Owner sign-in is handled by Sites. The service stores immutable reviews, separate implementation decisions and independent publication choices in D1. The generated public design contains no private records or credentials.

## Source and refresh

`apps/site/design/` is a generated public snapshot exported by Designup's `review export --out <folder>` command from the sibling Pipeup design workspace. Do not hand-edit it. Its source marker identifies the output; imported private reviews and outcomes are omitted. The website build copies this folder unchanged into `_site/design/`.

Changes to the submission service and UI belong in the canonical Designup package. The service deployment is generated from `designup review service --out <folder>` and has its own deployment history. The static design's public configuration names only the service URL, project slug and public design URL.

## Verification

Run Pipeup's existing core check before committing website integration. Run Designup's service authorization, persistence, idempotency, publication and public-export tests; browser-test failed-send retries and owner decisions. Inspect the public design at desktop and phone widths and verify anonymous owner API denial and forged-header rejection against the hosted service before inviting reviewers.

## Validation evidence

The core check passed, including 570 browser tests. The website built successfully with the public design snapshot. Desktop, 390 px and 320 px checks confirmed the submission dialog fits and stays clear of prototype navigation. Designup's full browser-enabled suite passed 558 tests without skips. Live service checks confirmed durable idempotent submission, anonymous and forged-header owner-read denials, and a signed-in owner decision that remained private.

## Change log

- 2026-11-10: Initial integration, requested by the maintainer for the approved public-design/private-feedback workflow.

- 2026-11-10: Regenerate specification downloads from the sanitized public model. The final local HTML-resource scan reports zero missing files.

## Required sign-in revision

Status: design and configuration preparation. The deployed initial release still allows anonymous submissions until the authenticated replacement is configured and deployed.

The maintainer confirmed that both owners and reviewers should use common authentication providers and that reviews must not be anonymous. Keep public browsing open. Ask the visitor to sign in before submitting, retain the draft if sign-in is cancelled or a session expires, and require verified account identity on the server. A client-provided name is never proof of identity. Keep the current immutable originals, owner-only inbox, approval decisions and independent public-sharing choices. Existing unsigned records must remain labelled as legacy records rather than being retroactively verified.

Recommended provider broker: Supabase Auth, configured for Google, Microsoft, GitHub and Apple as their provider applications become available. Keep review data in the existing D1 database. Use the managed provider's sessions and server verification instead of implementing OAuth or session issuance in Pipeup. Only configured providers appear as sign-in choices. The owner role is independently authorized server-side; signing in does not grant inbox access.

Before rollout, connect the owner's authentication project, configure provider applications and exact redirect addresses, and verify a real provider sign-in, expired/revoked-token rejection, forged-name/header denial, draft recovery and owner-only access. Do not publish simulated sign-in buttons as working authentication.

- 2026-11-10: Revised authentication requirements and provider integration design from the maintainer's clarification.

Preparation checks: the simulated provider-selection, private-submission and owner-decision walkthrough preserved the draft when its session expired, disabled submission while signed out, and reflowed at 390 px and 320 px. These checks are prototype evidence only. The unchanged core check also passed, including 570 browser tests. Supabase is not yet connected, and no real provider sign-in has been configured or deployed for this revision.
