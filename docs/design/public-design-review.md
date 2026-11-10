# Public design review on the existing website

## Design

Keep the current home page and add a quiet Design & feedback link. Serve the generated Pipeup design under `/design/`, preserving its `site/` and `prototype/` relative paths. A small Submit review control gathers anchored comments and an optional overall suggestion. It keeps drafts on failure and confirms a durable receipt.

The review service is separate from GitHub Pages. Anonymous visitors may submit; only the configured owner may read private records or change decisions. Owner sign-in is handled by Sites. The service stores immutable reviews, separate implementation decisions and independent publication choices in D1. The generated public design contains no private records or credentials.

## Source and refresh

`apps/site/design/` is a generated public snapshot exported by Designup's `review export --out <folder>` command from the sibling Pipeup design workspace. Do not hand-edit it. Its source marker identifies the output; imported private reviews and outcomes are omitted. The website build copies this folder unchanged into `_site/design/`.

Changes to the submission service and UI belong in the canonical Designup package. The service deployment is generated from `designup review service --out <folder>` and has its own deployment history. The static design's public configuration names only the service URL, project slug and public design URL.

## Verification

Run Pipeup's existing core check before committing website integration. Run Designup's service authorization, persistence, idempotency, publication and public-export tests; browser-test failed-send retries and owner decisions. Inspect the public design at desktop and phone widths and verify anonymous owner API denial and forged-header rejection against the hosted service before inviting reviewers.

## Validation evidence

The core check passed, including 570 browser tests. The website built successfully with the public design snapshot. Desktop, 390 px and 320 px checks confirmed the submission dialog fits and stays clear of prototype navigation. Designup's full browser-enabled suite passed 558 tests without skips. Live service checks confirmed durable idempotent submission, anonymous and forged-header owner-read denials, and a signed-in owner decision that remained private.

## Change log

- 2026-11-10: Initial integration, requested by the maintainer for the approved public-design/private-feedback workflow.
