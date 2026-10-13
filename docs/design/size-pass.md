# Design: the 0.8 size pass

Spec: [§16a](../FUNCTIONAL_SPEC.md). Status: step 1 built (portable identities are `@pipeup/identity`); steps 2 to 4 below.

## Where the bytes are (0.7.0, `origin/next`)

Core gzip: **52.3 KB** (`pipeup.min.js`), 51.5 KB (`esm`), 10.1 KB (`core`, the no-UI build). Minified bytes by module, from an esbuild
metafile of `src/index.ts` (161.9 KB minified before terser; gzip ratio is roughly 0.3):

| Module                                  | Minified | Notes                                                          |
| --------------------------------------- | -------: | -------------------------------------------------------------- |
| `ui/styles.ts`                          |  26.4 KB | Both looks; the largest single item                            |
| `ui/launcher.ts`                        |  14.5 KB | The button and menu                                            |
| `ui/app.ts`                             |  13.7 KB | Wiring                                                         |
| `ui/comment-mode.ts`                    |  11.0 KB | Cursor, picking, keyboard                                      |
| `ui/addons.ts`                          |   9.3 KB | The add-on host and its slots                                  |
| `ui/bubbles.ts`                         |   6.1 KB |                                                                |
| `document.ts`                           |   5.2 KB |                                                                |
| `ui/identity.ts` + `crypto/portable.ts` |   6.2 KB | **Portable identities**: dialog, recovery code, file, contacts |
| `ui/reactions.ts` + `ui/mentions.ts`    |   4.4 KB |                                                                |
| the rest                                |   ~65 KB |                                                                |

## History: what was already done

The 2026-10-07 size pass (`.superpowers/notes/sizepass-report.md`) found about 3.3 KB. Two of its parts shipped: the terser second pass
(0.5.2, −1.3 KB) and a core size pass (−228 B). Its patch is stale and mostly superseded; what it still offers is the CSS
aggregation (about −0.2 KB), the UI helper sharing (about −0.3 KB) and a few more mangled names (about −0.03 KB). Those are small. The size
pass this cycle can't be a polish: reaching 50 KB from 52.3 KB means removing about 2.3 KB.

## Plan

1. **Move portable identities into an add-on** (`@pipeup/identity`): about 6.2 KB minified, roughly 2 KB gzip. Core keeps verifying
   comments signed by such an identity (the signature check is the same) and the `contact`/`uncontact` ops stay readable. This alone
   meets the target. Add-on API need: a menu-row slot and a way to replace the profile's identity, both of which `host.addMenu` and
   `host.sign` mostly cover; any gap is found in the first prototype.
2. **Re-apply what is left of the old patch** after rebasing, taking only items that measure at 100 B or more in a stack.
3. **Lower the budget** in `scripts/size.mjs` and `libs/ts/addons/scripts/build-all.mjs` to 50 KB, and record each step in the ledger
   at the bottom of this note.
4. **Guard against growth**: the budget is the guard; the pull-request rule in §16a is the habit.

## Risks

- Moving the identity code is the only change that touches behaviour for someone who uses it; the e2e tests in `e2e/identity.spec.ts`
  move with it, and a page with the add-on must behave exactly as 0.7.
- Pages already holding a portable identity (made in 0.7) keep it in the browser; without the add-on they still sign with it as an
  ordinary key but can't manage or back it up. The add-on's README says so, and `pipeup check` reports a stored portable identity with
  no add-on.

## Change log

- 2026-10-13 — First draft, from measurements of 0.7.0.
- 2026-10-13 — Approved by the maintainer, including the identity add-on.
- 2026-10-13 — Built step 1: `@pipeup/identity` (3.39 KB gzip, budget 4 KB) with two new slots, `dialog` and `identity`; the dialog's inner styles moved with it. Core 52.3 → 49.9 KB gzip (`min`), 51.5 → 49.2 KB (`esm`); budget lowered to 50 KB. The _My identity_ row moved from under the name to the add-ons' place in the menu. The website's Add-ons section waits for the release, so its script tag points at a published version.
