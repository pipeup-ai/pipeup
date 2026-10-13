# Update notices

Status: **draft, for review**. Functional requirements: [FUNCTIONAL_SPEC §14a](../FUNCTIONAL_SPEC.md).

Code paths are relative to `libs/ts/pipeup/`.

## Constraint

Core makes no network request and has no telemetry (§14, `AGENTS.md`). A check from every visitor's browser would
also tell the hosting service who views each page. So the check cannot be in core, and it must not run in
reviewers' browsers by default. The audience is the author.

## Three layers

### 1. Core: an age line (no network)

- `BUILT_AT` (an ISO date) is written next to `VERSION` in `src/core.ts` by `tools/set-version.sh`, so the
  existing release step keeps it right. Pre-releases carry their own build date.
- At mount, if `Date.now() - BUILT_AT > 365 days`, `console.info` once per page load: the version, its date, and
  the changelog address. Off with `data-pipeup-updates="off"`.
- Estimate: about 0.15 KB gzip. It is the first thing cut if the 46 KB budget is tight; layers 2 and 3 don't
  depend on it.

### 2. Author tools (network from the author's machine only)

- `pipeup check` (`libs/ts/pipeup/scripts`, the CLI) fetches `updates.json`, verifies its signature (below),
  compares with the page's pinned version (the same parse it already does for the `pipeup@X.Y.Z` address and the
  `integrity` attribute), and prints: latest, minimum supported, advisories that match, and the exact new script
  tag with its integrity hash. Offline: skips with one line. This is a tool, not a visitor, so it may use the
  network; it says so.
- `docs/RELEASE.md` gains steps: publish the release notes with a **Security** heading when relevant; publish a
  GitHub security advisory; `npm deprecate pipeup@"<range>" "<message>"` for affected versions; regenerate and
  sign `updates.json`.

### 3. Add-on `@pipeup/updates` (opt-in)

An ordinary add-on (§11a) with the slots: a menu item (existing menu slot, as other add-ons use) and the host's
toast, plus `console`.

**When it runs: author context only.** The author context is true when any of these hold at setup:
`location.protocol === "file:"`; the hostname is `localhost`, `127.0.0.1`, `[::1]`, or ends in `.localhost` or
`.test`; or `data-pipeup-updates` is present on the Pipeup script or root (`"on"`). It is a heuristic for "the
author is probably looking", not a proof of authority; nothing it does depends on that (it can only show text).
`data-pipeup-updates="everyone"` allows reviewers' browsers to make the request too. The add-on's one sentence
says: "Checks the Pipeup project's published update list (GitHub Pages) once a day; that service can see your
network address."

**Request.** `fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", mode: "cors", signal })` to
`https://pipeup-ai.github.io/pipeup/updates.json`, timeout 4 s, no retry. Result cached 24 h in the browser's
storage (wrapped in try/catch; works without it). A failure is silent apart from one console debug line.

**File** (`updates.json`, written by `tools/make-updates.mjs` at release time):

```json
{
  "v": 1,
  "at": "2026-10-12T00:00:00Z",
  "expires": "2027-01-10T00:00:00Z",
  "latest": "0.6.0",
  "minimum": "0.5.0",
  "versions": { "0.6.0": { "integrity": "sha384-…", "date": "2026-10-12", "notes": "https://github.com/pipeup-ai/pipeup/releases/tag/v0.6.0" } },
  "advisories": [
    { "id": "PIPEUP-2026-001", "severity": "security", "affects": "<0.6.1", "fixed": "0.6.1",
      "summary": "Plain text, 200 characters at most.", "url": "https://github.com/pipeup-ai/pipeup/security/advisories/…" }
  ],
  "sig": { "key": "k1", "value": "<base64url Ed25519 over the canonical JSON of everything but sig>" }
}
```

- `severity`: `info` | `recommended` | `security`. `affects` is a simple range (`<x.y.z`, `>=a <b`, or an exact
  list), parsed by a tiny comparator, no dependency.
- Decision: compare `VERSION` (core's) with `latest` and `minimum`, and match advisories.
  - patch/minor newer, no advisory: console line.
  - major newer, or `recommended`: console line + menu marker.
  - `security` match, or `VERSION < minimum`: menu notice with the summary, the fixed version, the link and the
    exact new script tag (with the integrity hash from `versions`).
- Rendering: text nodes only; the link is shown only if its origin is `https://github.com/pipeup-ai/` or
  `https://pipeup-ai.github.io/` (compared as parsed URLs, not by prefix); it opens through Pipeup's
  isolated link path.
- Dismiss: per advisory id or per version, in the browser's storage. A `security` notice returns weekly.
- Pre-releases: a pre-release build compares against the latest pre-release only if its own channel is newer;
  it is never told to move to an older stable.
- Never auto-updates, never edits the page, and the notice waits while comments are closed (existing add-on message
  rule).

### Signing

A tampered file could show fake alerts, or give an author a wrong script tag and integrity hash, so Pipeup
checks it. Decided 2026-10-12: sign locally, with the key in the maintainer's macOS Keychain. No secret goes in
the repository or in Actions, so the "no secrets" statement in `docs/RELEASE.md` stays true.

- **Algorithm.** Ed25519 through WebCrypto (the core already verifies Ed25519 ops, `src/crypto`), no new code in
  the add-on beyond the key list and the comparison.
- **Keys in the add-on and `pipeup check`:** a list of `{ id, key }` (the current key and an offline **standby**
  key). The file names the key id it was signed with, so a key can be rotated or retired by shipping a new list
  (a normal release) and signing with the standby in the meantime.
- **Expiry.** The file carries `expires` (90 days from signing). The add-on and `pipeup check` ignore an expired
  file and say so once; this limits replay of an old signed file. A reminder to re-sign sits in the release
  checklist, and `pipeup check` in the repo's CI warns when the published file has less than 30 days left.

**Script: `tools/sign-updates.mjs`** (Node, built-in `crypto` and `child_process` only; macOS).

| Command | What it does |
|---|---|
| `init [--id k1]` | Generates an Ed25519 key pair. Stores the private key (PKCS #8, base64) as a generic Keychain password with `security add-generic-password -s pipeup-updates-signing -a <id> -w … -T ""`, so **no application is pre-approved** and every read asks for the login password or Touch ID. Prints the public key and the line to paste into the add-on and `pipeup check`. Refuses to overwrite an existing item. |
| `sign [--in updates.json]` | Reads the private key with `security find-generic-password -s pipeup-updates-signing -a <id> -w`, sets `at` and `expires`, signs the canonical JSON of everything except `sig` (the same canonicalisation as the ops), writes `sig`, then verifies the result with the public key before saving. |
| `verify [--in …]` | Verifies a file against the embedded key list and checks `expires`. Runs without Keychain, so CI and `pipeup check` can use it. |
| `export` | Prints the private key once, after a confirmation, so it can be put in the password manager as the encrypted backup. |

- The key is read only for the length of one run, never written to disk or logs, and is cleared from memory afterwards.
- A key lost with the Mac is replaced by signing a new key list with the standby (kept in the password manager, never
  on the same machine) and shipping it in the next release. Files signed by the old key stay valid until they expire.
- The Secure Enclave can't hold Ed25519 keys (it holds P-256), so it isn't used.

**Release steps** (these are added to `docs/RELEASE.md` when this is built): after the release notes and the version
are final, `node tools/make-updates.mjs` (builds `updates.json` from the changelog and the advisories),
`node tools/sign-updates.mjs sign`, `node tools/sign-updates.mjs verify`, then commit the file with the Pages
source in the release PR. The same step is run when an advisory is added without a release.

## Tests

Unit: the version comparator and range matcher (including pre-releases), the decision table, signature accept/reject,
unknown key id, expired file, `sign-updates` with a stubbed `security` command (init refuses to overwrite; sign then
verify round trip; verify fails on any changed byte), link-origin check, the age rule. Browser: not run for a reviewer context (no request made,
checked by network interception), runs in a file/localhost context, console lines and the menu item, dismiss,
waiting while comments are closed, silent failure on offline and on a bad signature. `pipeup check`: offline, bad
signature, advisory match, new tag printed.

## Phases

1. Release tooling (`make-updates`, `sign-updates` with Keychain) and the RELEASE.md steps, so a signed file exists.
2. `pipeup check` reads it.
3. The age line in core.
4. The `@pipeup/updates` add-on.

## Open

- Whether the age line is worth its bytes.
- The exact author-context signal beyond a file, localhost and the attribute.

## Change log

- 2026-10-12 — First draft.
- 2026-10-12 — Decided: sign locally with the key in the macOS Keychain (`tools/sign-updates.mjs`: init, sign, verify, export), with a standby key, a 90-day expiry and no secret in Actions.
