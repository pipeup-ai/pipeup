// Try all three add-ons on your own machine: `npm run demo` (after `npm run build` here and in ../pipeup).
//
// It starts a local mailbox server (for share) and a local Nostr relay (for live's meeting point), writes
// examples/demo/page.html wired to them with a fresh document key, and prints what to do. Nothing leaves your
// machine except voice's browser speech engine, if you use it. Stop it with Ctrl+C.
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createMailboxServer } from "../../../../services/mailbox/src/server.mjs";
import { newDocumentAttribute } from "../../pipeup/dist/pipeup.core.js";
import { startRelay } from "../kit/test/relay.mjs";

const here = new URL(".", import.meta.url).pathname;
const b64u = (bytes) => Buffer.from(bytes).toString("base64url");

const mailbox = createMailboxServer({ memory: true });
const { port: mailboxPort } = await mailbox.listen(8851, "127.0.0.1");
const relay = await startRelay(8852);
const created = await (
  await fetch(`http://127.0.0.1:${mailboxPort}/m`, { method: "POST", body: JSON.stringify({ v: 1 }) })
).json();
const share = `http://127.0.0.1:${mailboxPort}/m/${created.mailbox}#pm1.${b64u(crypto.getRandomValues(new Uint8Array(32)))}`;

const page = `<!doctype html>
<html lang="en" data-pipeup-doc="${newDocumentAttribute()}" data-pipeup-share="${share}" data-pipeup-live-relays="${relay.url}">
<head>
<meta charset="utf-8">
<title>Pipeup add-ons: try page</title>
<style>
  body { font: 17px/1.6 Georgia, serif; max-width: 640px; margin: 48px auto; padding: 0 20px; color: #222; background: #fff; }
  h1 { font-size: 28px; line-height: 1.2; }
  .note { font: 14px/1.5 system-ui, sans-serif; color: #5f5e5a; }
</style>
</head>
<body>
<main>
  <h1 data-pipeup-id="title">Quarterly report: draft</h1>
  <p class="note" data-pipeup-id="note">Open this same file in a second browser (or a private window) to be a second reviewer.</p>
  <p data-pipeup-id="p1">Revenue grew in every region except the north, where the new pricing confused two large accounts.</p>
  <p data-pipeup-id="p2">The second chart needs a clearer label, and the totals in the table should add up to the headline number.</p>
  <p data-pipeup-id="p3">We recommend extending the pilot by one quarter before committing the budget.</p>
</main>
<script src="../../../pipeup/dist/pipeup.min.js"></script>
<script src="../../share/dist/share.min.js"></script>
<script src="../../voice/dist/voice.min.js"></script>
<script src="../../live/dist/live.min.js"></script>
</body>
</html>
`;
mkdirSync(`${here}demo`, { recursive: true });
writeFileSync(`${here}demo/page.html`, page);

// A small static server for this folder's parent, so the page can also be opened from http://localhost.
const root = join(here, "../.."); // libs/ts, so /pipeup/dist and /addons/<id>/dist are both served
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
};
const site = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(
    /^(\.\.[/\\])+/,
    "",
  );
  const file = join(root, path);
  if (!file.startsWith(root) || !/^\/(addons\/examples\/demo|pipeup\/dist|addons\/[a-z]+\/dist)\//.test(path))
    return void res.writeHead(404).end("Not found");
  try {
    res.writeHead(200, {
      "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404).end("Not found");
  }
});
await new Promise((resolve) => site.listen(8860, "127.0.0.1", resolve));

console.log(`
Pipeup add-ons: local try-out
  page     http://localhost:8860/addons/examples/demo/page.html   (or open file://${here}demo/page.html)
  mailbox  http://127.0.0.1:${mailboxPort}   (share's server, in memory: stop this and the shared copy is gone)
  relay    ${relay.url}   (live's meeting point)

1. Open the page in two browsers (Chrome and Firefox, or a normal and a private window). Each is a reviewer.
2. Share: open the comment control's menu. In one, choose "Start commenting", click a paragraph, comment. The
   other shows it within about half a minute (the menu's share row says "Shared · up to date").
   Try "Send my comments" off, then on; comment before and after.
3. Live: in both, choose "Go live" in the menu. Comments appear within about a second, you see each other's
   cursor while comments are showing, and "People here" lists who is here.
4. Voice: press the microphone in a comment box (Chrome or Safari), allow it, and speak.
`);
process.on("SIGINT", async () => {
  await Promise.allSettled([mailbox.close(), relay.close(), new Promise((r) => site.close(r))]);
  process.exit(0);
});
