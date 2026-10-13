# @pipeup/inbox

Tells people they were mentioned, even on pages they haven't opened. When you mention someone, the add-on leaves them
a short note (who, your words, the page's address) at an **inbox service** the page's author names, **sealed so only
that person can read it**. They find their notes from any browser that holds their identity: **Mentions waiting** in
the menu, with _Open the page_ and _Dismiss_. Design: [docs/design/mentions.md](../../../../docs/design/mentions.md)
("Inbox"); the service is the reference mailbox server (`npx @pipeup/mailbox`, contract `pm2`).

## Add it

```html
<html data-pipeup-inbox="https://inbox.example.org/pipeup">
  <script src="https://cdn.jsdelivr.net/npm/pipeup/dist/pipeup.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@pipeup/inbox/dist/inbox.min.js"></script>
</html>
```

`data-pipeup-inbox` is the service's address (https, or http only on this computer); the add-on stays off, saying why,
on a page without it. `data-pipeup-inbox-poll="<seconds>"` changes how often a page looks for notes (60 by default).
Each reviewer switches **Mentions by inbox** on in the menu; nothing is sent before.

## What it sends, and to whom

Only after you switch the row on: a sealed note for each person you mention, left at the page's inbox service; and a
check of your own inbox there. The service sees that a note arrived, its size and when, and your network address, never
who it is from or what it says. Requests carry no cookies and no referrer.

## How it works

- A person's **inbox address** is a hash of their public key, so a sender can work it out and nobody can reverse it.
- Their **encryption key** is made from a signature their identity gives on a fixed text, so the same person has the
  same key on every browser that holds their identity, and the key is never stored or sent. They publish its public
  half, proved by their own signature.
- A note is sealed (X25519 and AES-GCM, with the browser's own crypto) and signed by its sender inside the seal; the
  recipient checks the signature. Each note carries a small proof of work, so flooding someone costs something.
- Only the owner can take a note away, by signing.
