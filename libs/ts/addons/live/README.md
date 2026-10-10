# @pipeup/live

Live comments and presence for Pipeup, between people looking at the same page at the same time, peer to peer.
Comments, replies, edits, deletes and resolves appear for each other within about a second, and you see who is
here, where they point and when they are writing.

```html
<script src="pipeup.min.js"></script>
<script src="live.min.js"></script>
```

The page needs `data-pipeup-doc`. Optional attributes:

- `data-pipeup-live="auto"`: the author's suggestion that going live is the default. Nobody is connected until
  they have seen the sentence below and agreed, in Pipeup's menu.
- `data-pipeup-live-relays="wss://a.example,wss://b.example"`: replaces the default meeting-point relays
  (`relay.damus.io`, `nos.lol`, `relay.primal.net`). For development, `ws://localhost` and `ws://127.0.0.1` are accepted too.

## What it sends, and to whom

- **People who are live see each other's network address.** Going live is off for each reviewer until they
  choose "Go live", and a panel says so the first time.
- **The meeting-point relays see your network address and when you connect, never your comments.** They carry
  small sealed messages (kind 25800 Nostr ephemeral events, signed by a throwaway key) that only people holding
  the same version of the file can open.
- STUN servers (Google, Cloudflare) see your address when your browser asks for it. There is no TURN server.
- Comments and cursors travel only on direct encrypted connections between browsers (up to 8 people), and are
  kept nowhere. Without the share add-on, comments made while nobody else is live reach others only when you
  next meet.
- **About 15 to 25 percent of pairs may not connect directly** (more on office networks). Pipeup then says it
  can't reach that person directly; with a shared copy, their comments still arrive more slowly.
- People with a different version of the file (for example before and after sharing was added) do not meet.

Each peer proves who it is with a signed hello bound to the connection, so a cursor or comment is always that
author's. A peer whose hello does not verify is dropped.

## Headless

`@pipeup/live/headless` exports `Mesh`, `createMesh(document, secret)` and `loopback(a, b)`: the same document
sync over any channel that can send a string, for agents and tests. No WebRTC.

## Keeping it intentional

Pin the script with its integrity hash (it is in the release notes), list the add-ons that may run on the page
(`<html data-pipeup-addons="live">`; without the attribute every add-on runs), and set a content security policy that allows
scripts only from the page and the CDN and connections only to the meeting-point relays (`wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.primal.net`) and peer connections. This is best effort: it stops add-ons you didn't
choose, not a page that is already compromised. See the [guide](../../../docs/ADDONS_GUIDE.md).
