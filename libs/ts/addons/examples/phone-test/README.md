# Spike S2: do two devices on different networks connect?

Tests what the `live` add-on relies on: two browsers meet through a public Nostr relay (`relay.damus.io`), swap
sealed WebRTC offers and answers, and open a direct data channel using Google's and Cloudflare's STUN servers. Each
page reports whether it connected directly and which kind of path it found (host, server-reflexive, relayed).

1. `node examples/phone-test/build.mjs` builds a small Cloudflare Worker that serves the test page.
2. `cd examples/phone-test/worker && npx wrangler login && npx wrangler deploy` (a `workers.dev` subdomain is needed once).
3. `npx wrangler tail --format json` in a second terminal shows each device's result.
4. `node examples/phone-test/links.mjs https://pipeup-s2-spike.<subdomain>.workers.dev` prints three pairs of links.
   Open `a` on this Mac and `b` on the phone, one pair at a time: first the phone on **mobile data**, then again on
   mobile data, then on the **same Wi-Fi** as the Mac. An office or other restrictive network is a fourth run.
5. `npx wrangler delete` removes the Worker. Nothing else is stored, and the only message the Worker sees is each
   device's report (connection types and timings, no addresses).

Record the results in `docs/design/architecture.md` §7 under S2.
