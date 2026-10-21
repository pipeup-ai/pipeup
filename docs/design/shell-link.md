# The shell link

Functional requirements: [FUNCTIONAL_SPEC §15c](../FUNCTIONAL_SPEC.md) (The shell link, without Node) and §15d.
Visual spec: [shell-link-mockups.html](shell-link-mockups.html). This note says how.

## Files next to the page

Everything meets in files named after the page (`lisbon.html` → `lisbon.*`), because a page opened from disk can run
a script next to it but can't read a data file:

| File                   | Written by                       | Read by                                              |
| ---------------------- | -------------------------------- | ---------------------------------------------------- |
| `lisbon.link.js`       | the script, while it runs        | the page, every 4 s while visible (page on this computer only) |
| `lisbon.comments.json` | the script, from the page's POST | the agent (`… comments lisbon.html`)                 |
| `lisbon.replies.js`    | the script (`… reply`), appended | the page, every 4 s while an agent is listed or a link runs |

`lisbon.link.js` pushes `{ format: "pipeup-link", v: 1, url: "http://127.0.0.1:<port>/<secret>" }` onto
`globalThis.pipeupLink`. A reply pushes `{ format: "pipeup-replies-block", v: 1, text, tag }` onto
`globalThis.pipeupReplies`, beside the signed `pipeup-replies` entries `pipeup reply` writes; older add-ons skip the new
format. Both files run inside Pipeup's shadow root (`nearby.ts` `runFile`), only from the same site or the same disk.

## The page's side (agents add-on)

- `nearby.ts`: `nextTo(suffix)` names a file after the page; `onThisComputer()` is `file:`, or `http:` on `localhost`,
  `127.0.0.1`, `[::1]` or `*.localhost`; `systemOf()` reads `userAgentData.platform`, then `platform`, and calls
  phones, tablets (an iPad asking for the desktop site has touch points) and the unknown "other".
- `link.ts`: a page with `data-pipeup-link` is `pipeup watch`'s, as before. Otherwise, on a page on this computer, it
  runs the link file every 4 s while visible; the address must match `http://(127.0.0.1|localhost|[::1]):port/secret`.
  The switch's row is added and removed as the link comes and goes; if it goes while on, sharing stops and the page
  says so. Turning sharing on makes a session key (24 random bytes, base64url), sent first in every snapshot. Sends are
  queued one at a time; a refused send is tried again after 150, 300, 600, 1000 and 1500 ms. A shell link is sent
  `text/plain`, so the cross-origin POST needs no preflight; `pipeup watch` still gets `application/json`.
- `replies.ts`: hands `pipeup-replies-block` entries to the add-on, and looks for the file while an agent is listed or
  a link is running.
- `addon.ts`: each block's text is taken once per load. Entries for threads that are gone, or already answered with the
  same words by the same agent (say, before a reload), are dropped. If sharing is on and `tag.ts` verifies the tag
  (HMAC-SHA256 of the text with the session key, in hex), the entries go in at once (signed ones from a listed agent
  as the agent's, the rest through `host.paste`, so as pasted by the person). Otherwise the text waits: the status says
  replies are waiting, and a menu row opens the paste dialog filled in with it.
- `prompt.ts`: when the page is on this computer and no link runs, Copy for my agent names the script for the system,
  `https://cdn.jsdelivr.net/npm/@pipeup/agents@<version>/dist/<script>`, with its SHA-256. Both come from
  `__PIPEUP_SHELL__`, which `scripts/build-addon.mjs` defines from the files in `agents/shell/` (and copies them to
  `dist`). When a shell link runs, it gives the script's `comments` and `reply` commands instead.

## The scripts

`pipeup-link.sh` needs bash 3.2 (macOS's), `nc`, `sed`, `awk`, and `openssl` for tags. It picks a free port at random
in 49152–65151, a 24-character secret from `/dev/urandom`, checks that `nc -l 127.0.0.1 <port>` really listens before it
writes the link file, then serves one connection at a time through a FIFO. Each request is checked for `Host:
127.0.0.1:<port>`, an `Origin` on this computer (`null` for a file page, or `http://localhost|127.0.0.1|[::1]`), POST
and `/<secret>/comments`, and at most 8 MB; the body is written with a rename. The answer echoes the origin in
`Access-Control-Allow-Origin`. The listener runs in the background and is waited for, so `kill` and Ctrl-C stop it at
once; the trap removes the link file and the FIFO.

`reply` reads stdin, drops trailing newlines, tags the bytes with `openssl dgst -sha256 -hmac <session>` (the session is
read from `lisbon.comments.json` with `sed`), escapes backslashes, quotes and line breaks for a JavaScript string with
`awk`, and appends one line to the replies file. The page decodes the same string and checks the same bytes.
`comments` prints the open comments' Markdown with `plutil` (every Mac), else `python3`, else the JSON.

`pipeup-link.ps1` does the same with PowerShell 5.1's `TcpListener` on the loopback address (no URL reservation, and
connections queue instead of being refused) and `HMACSHA256`. **It has not been run on Windows yet.**

## What was tried

On macOS 26.7 with its own bash, `nc` and LibreSSL 3.3.6: a page at `localhost:3000` and a file page both reached the
link; wrong host, origin or secret were refused; `nc` refuses a second connection while it serves one, which the retries
absorb; `nc` can't serve the page itself (the browser loads scripts in parallel), so the link only receives; LibreSSL
can't sign Ed25519 but does HMAC. `e2e/agents-shell-link.spec.ts` runs the real script against a file page in
Chromium.

## Size

The agents add-on grows by 2.1 KB gzip, to 9.0 KB; its budget rises from 7 to 9.5 KB. Pipeup itself is unchanged.

## Change log

- 2026-10-21 — First version, with the build.
