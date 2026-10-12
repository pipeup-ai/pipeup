# Mentions, identity and notifications

Status: **draft, for review**. Functional requirements: [FUNCTIONAL_SPEC §10a](../FUNCTIONAL_SPEC.md).
Targets the next milestone. Includes research still to be done (marked *research*).

Code paths are relative to `libs/ts/pipeup/`.

## The three problems

A mention needs (1) **who exists**, (2) **who someone is**, and (3) **how they hear**. With no accounts and no
server of our own, each has a layered answer: something always works inside the page, and everything that leaves the
page is explicit, opt-in and either manual or an add-on/host hook.

## 1. Who exists: a directory slot

Core knows the people of one document: the authors of its ops (key, latest name, animal, whether an agent). The
`@` list is built from them plus two optional sources:

- `data-pipeup-agents` (existing, §15b) for agents;
- a **directory provider**: `Pipeup.setPeople(list | async (query) => list)` on the page, or the `people` slot an
  add-on supplies. Each entry: `{ id, name, handle?, avatar?, verified?: { by } }`.

The list is a small combobox in Pipeup's shadow root (arrow keys, Enter/Tab, Esc; `aria-activedescendant`;
announced as it narrows). The async form is debounced and cancelled on each keystroke; a provider is a network client only if the *add-on or page code* makes it one, and says so (§11a).

## 2. Who someone is

Today: a key held in the browser (`author` in `OpBody`) plus a self-declared name. Names are claims. We add, without
accounts:

| Level | What it is | Needs |
|---|---|---|
| Browser key | Today's identity: a person in this browser | nothing |
| Host-supplied | The page's author says who is signed in and who can be mentioned (`Pipeup.setIdentity({id, name, …})`); the person's browser key is bound to that id by the page | the host's own sign-in (SSO stays the host's) |
| Proven handle | An add-on shows a handle is theirs (e.g. a GitHub name: the add-on signs `{key, handle}` and the Save to GitHub flow already ties a person to GitHub) | an add-on |
| Portable | The same key on another browser | export/import (below) |

A **verification record** is data, never trusted from the comment: it lives in the folded document as
`{ key, claim, by }` supplied by the host/add-on at runtime, and the UI shows the mark only while the supplier is
present and says who vouches.

**Mention reference.** A mention stores *who*, not just text: an optional `mentions` array on the op body,
`[{ start, end, ref }]` where `ref` is a browser key or `host:<id>` / `handle:<provider>:<name>`. It is inside
the signed body so it can't be altered. To check: `isWellFormed` and `canonicalJson` must accept the new field
without breaking old readers (unknown field vs. new `v`); bounded count and lengths; refs validated by pattern.
If the format can't take an extra field safely, bump to `v: 2` with a reader for both (a stored-format change, so
this needs the maintainer's decision before 1.0).

**Contact details.** Email/handle in the profile are stored locally; shared to the document only on an explicit
choice, as a signed `profile` op (not part of any comment); never in copies or services without agreement.

**Portable identity** (*research*): (a) export the key to a file / short code the person keeps (simple, offline,
works with no third party); (b) a **passkey** (WebAuthn) wrapping the key so the browser's own sync carries it; (c) a
DID or open-network handle (Bluesky/AT, Nostr) that signs a statement binding the handle to the key. (a) is the
recommendation; (b) once browser support for `largeBlob`/PRF is dependable; (c) only on demand.

## 3. How they hear

Pipeup sends nothing. A **notifier** is `(mention) => Promise<void>` supplied by an add-on or the host, called only
after the author has configured it **and the reviewer agrees** to its one-sentence description.

1. **In the page (core):** on open, count unseen mentions of "me" (the browser key, or the host's id) and say so
   once; All comments gets a "mentions of me" filter. "Seen" is kept in the browser.
2. **By hand (core):** "Let Sam know" builds a `mailto:` (when an email is known) or a copyable message with the comment
   text and a link to the comment; the reviewer sends it. A link to a comment needs a stable thread address in
   the URL fragment (the page already must open to the right place; check `docs/design/architecture.md` §anchoring).
3. **Add-ons:**
   - `@pipeup/github`: the Save to GitHub flow already opens a prefilled GitHub page; a mention becomes an `@handle`
     in that issue/PR text, and GitHub notifies. No server, no token. First candidate.
   - `@pipeup/webhook`: POSTs `{who, comment link, words}` to a URL the author set (Slack/Teams incoming webhooks,
     or their own); the URL is a secret held by the author; because the endpoint is the author's, say plainly
     what it can see (the words, unlike the encrypted share paths of §14: this is an explicit exception, the
     reviewer agrees first).
   - email through the author's own service (the mailbox server from 0.5 is a candidate base) *research*.
4. **Host:** `Pipeup.onMention(fn)`, so a company app routes it into its own notifications.

## Common identity providers (research summary)

Reality for a library that runs on any page with no server and no third-party code:

- **Google / Microsoft Entra / Okta / Auth0 / Slack / GitHub sign-in** each need an app registered per site and a
  redirect URL; some token endpoints don't allow browser calls (GitHub); all pull in provider code or a redirect
  flow. Not feasible as a core feature, and not a thing one library can do for "any page".
- **Enterprise SSO** is the host's business. The supported integration is the host passing `setIdentity`/`setPeople`/
  `onMention` after its own sign-in. We document the shape and give a recipe per common provider *as the host's
  code*, not ours.
- **Open/decentralised:** Bluesky (AT), Nostr, DIDs, WebFinger/ActivityPub, Webmention. They cover "prove a handle"
  and a few notify paths, but adoption inside review audiences is low, and each needs network calls. Park behind the
  add-on interface.
- **GitHub** is the one provider that fits Pipeup's grain (Pipeup already saves reviews to Git); do it first.
- **Email** is the common denominator: `mailto:` needs nothing; sending needs the author's service.

## Security and privacy

- Mention lookups are the only new data leaving a page, and only through add-ons/host code that say so.
- Mentions are display-only references. Nothing a mention contains can run or navigate; links are the
  existing, isolated link path.
- No cross-document person list; no contact details in comments by default.
- A directory can show who exists: that is the author's choice when they supply it.
- Impersonation: a verified mark means "the supplier says so", shown with who; names stay claims.

## Tests

Unit: ref validation, fold of mentions, "mentions of me" for key and host id, op-format compatibility both ways.
Browser: combobox keyboard and screen reader, narrowing, async provider cancel, unmatched `@` stays text, "Let Sam
know" builds the right message, host-supplied identity round trip, add-on notifier opt-in prompt.

## Open

Format change vs `v:2`; first add-on (GitHub recommended); whether emails are ever shown by default (recommend no);
portable identity method (recommend file/code first).

## Change log

- 2026-10-12 — First draft.
