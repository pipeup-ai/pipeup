# Mentions, identity and notifications

Status: **phase 1 built** (the `@` list, mention refs, seen, same-name tags, portable identities with a recovery code or file, contacts and the by-hand email offer, the `github` add-on); the inbox (`pm2`) is not built.
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

**Portable identity:** see *Durable identity without a provider* below for the chosen design (a recovery code or file).
Later and only on demand: a **passkey** wrapping the key (WebAuthn `largeBlob`/PRF), and a DID or open-network
handle (Bluesky/AT, Nostr) that signs a statement binding the handle to the key.

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

## Durable identity without a provider

**The ID is the identity key.** The Ed25519 key that signs every op (`OpBody.author`) is the person. The display
name is the latest name on their ops (`names` in `src/model/fold.ts`). The **short ID** shown beside a name is the
first 4 characters of a base32 hash of the public key (`Sam · 4F2A`), computed for display and shown only when two
authors in the document share a name, which is the disambiguation §10 already requires. Never merge by name: a
name is a claim, and merging would let anyone type "Sam" and receive Sam's mentions.

**Keeping the key.** Today it lives in IndexedDB (`src/storage`), the same place as comments, and can be evicted
or cleared.

- On first use call `navigator.storage.persist()` (best effort; Safari and private windows may refuse) and record
  the answer, so the menu can warn when the key isn't protected.
- **Back up my identity** (menu): exports the key as a recovery code (a base32 string with a checksum, grouped
  for dictation) and as a `.pipeup-id` file containing the same string. Never uploaded, never stored by Pipeup
  or an add-on (§14: secrets come from what the person keeps). The prompt says so, and says what restoring does.
- **Use my identity** (menu): paste the code or choose the file; validate the checksum; derive the public key;
  replace this browser's key after a clear confirmation if one with comments already exists (the old key's
  comments stay under the old ID and show "(earlier)").
- A passkey-wrapped key (WebAuthn PRF/largeBlob) is a later convenience, not a replacement: it needs
  dependable browser support.

**Lost key.** Old ops still verify under the old public key. Nothing is rewritten. The UI shows an author whose
key has no recent activity and who now has a successor only if the person linked them; otherwise the old name is
marked "(earlier)" (only when the same name has appeared under a newer key; this is a display hint, not a merge).
Mentions of the old key are shown as "Sam (earlier)" and don't notify anyone.

**Two devices.** Each device has its own key until linked. Linking is restoring the same code on the second
device; the two then act as one key. Pipeup never guesses links.

**Signed `seen` op.** A new kind `seen` with `target` = a comment or mention, from the person's key; folded as
"read by (author, at)". It is what makes a mention read on all their devices, and it travels exactly like any op.

## Picking up what was left behind

All content is signed ops with content-derived ids, folded idempotently (`src/model/fold.ts`). So a "pickup" is: pull
every op since a cursor from any store, drop what is already known, verify the rest, fold. This is what the share
add-on's mailbox does today (§7.7, contract `pm1`: `GET <mailbox>/ops?since=<cursor>`, at-least-once, order doesn't
matter). Reactions, mentions, `seen` and profile ops need no new store: they are ops in the same stream. Agents
read the same data through `Pipeup.comments()`, `pipeup comments` and the replies file. What this does not cover:
finding mentions in a document the person hasn't got the address of.

## Inbox (phase 2: a new mailbox contract, `pm2`)

**Goal.** A person collects notes about mentions from any client holding their identity, without knowing which
documents mention them.

- **Address.** `inbox = base32(SHA-256("pipeup-inbox/1" ‖ publicKey))[:26]`, so the sender can compute it from the
  mentioned key, and the service sees only an opaque id. A mention reference already carries the key.
- **Sealing.** The note is encrypted to the recipient's public key (an ephemeral X25519 key against the recipient's
  X25519 key derived from the Ed25519 identity, with an AEAD such as the platform's AES-GCM; no third-party
  code), so only the holder of the identity can read it. The note is `{ doc link, comment id, words (≤ 280
  chars), at }`. The sender's identity is inside the sealed note and signed with the sender's key; the service
  never learns it.
- **Contract.** Additive to `pm1`'s shape, but with different trust, so it is `pm2`: `POST <base>/i/<inbox>`
  (append a sealed note), `GET <base>/i/<inbox>?since=<cursor>` (same cursor rules as ops), `DELETE
  <base>/i/<inbox>/<note>` (needs a proof of ownership: a signature by the inbox's key over the note id). Servers
  may serve `pm1` and `pm2`.
- **Spam control** (*open*). Options, in order of preference: (1) a **write token** the author's page carries,
  so only people holding a page can leave notes; (2) a small **proof of work** per note; (3) a per-inbox
  rate limit. The service can't tell senders apart, so it can't block by identity. Recipients also drop notes
  whose signed sender isn't someone they've seen in a document, once they have a document in common (best
  effort filter).
- **Where the base comes from.** The page's author (the same way they choose a mailbox: `data-pipeup-inbox`, or
  the Share add-on's service). Without one, no inbox is used and mentions only work in the page and by hand.
- **Consent.** The first time a reviewer sends a mention through an inbox, Pipeup says in one sentence what it
  sends and to whom, per §11a.
- **Reading.** The client polls its own inbox while Pipeup is on a page (an add-on), merges what it finds into
  the "mentions of me" list, and offers to open the linked document. Notes are deleted by the recipient once seen.
- **Privacy.** The service sees: the inbox id, the size and the time of each note, the network address of
  the sender and the reader. Anyone who knows a person's public key can compute their inbox address and learn
  whether it has notes waiting (size/timing), which is an accepted leak; the note is sealed.

## Phases

1. **Per document (with mentions):** the `@` list, mention references, "mentions of me", in-page notice, `seen`,
   durable ID display, backup/restore, "Let Sam know".
2. **Inbox:** `pm2` in `@pipeup/mailbox`, the reading add-on, the sending path in the share/mentions add-on.
3. **Notifiers:** GitHub, then webhook, then email (can reuse the inbox as the source).

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

## Decided (2026-10-12)

- GitHub is the first notifier add-on; webhook and email follow.
- An identity is backed up and restored with either a recovery code or a file, the same secret in both forms.

## Open

Format change vs `v:2`; whether emails are ever shown by default (recommend no); the inbox's spam control; whether
the inbox sits in `@pipeup/mailbox` or in its own service.

## Change log

- 2026-10-12 — First draft.
- 2026-10-12 — Durable identity (ID is the key, short ID for same names, persistence, backup and restore, lost keys, two devices, the `seen` op), picking up what was left behind, and the inbox as mailbox contract `pm2` with its sealing, spam options and phases.
- 2026-10-12 — Decided: GitHub first; recovery code and file both.
- 2026-10-13 — Built as above.
