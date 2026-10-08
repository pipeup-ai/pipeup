# @pipeup/share

Shares a Pipeup page's comments through an encrypted service, so everyone who has the page sees the comments
others chose to share. Comments last while nobody is online, arrive within about 30 seconds while people are
commenting (a few minutes otherwise), keep working offline, and survive browsers that can't keep comments.

## What it sends, and to whom

> Sends the comments you choose to share, sealed so only people with this page can read them, to the sharing
> service the page names. That service sees when and how much is sent, and your network address.

- **Only to the address in the page's `data-pipeup-share`.** Nothing is sent when the attribute is missing, and
  nothing is ever sent to anyone else.
- **Sealed before it leaves.** Comments are encrypted in the browser with a key that is in the page's address
  (after the `#`), which no server receives. The service can't read or forge comments.
- **Only your own comments.** A reviewer's browser sends only that reviewer's comments, plus ones it received
  from the shared copy. It never uploads comments someone else gave you by file or live review.
- **Comments written before sharing began wait for you.** The first time a page is shared, your earlier comments
  are held until you choose "Share my N earlier comments" or "Keep them on this machine".
- **You can stop sending.** "Send my comments" is a switch. While it is off, new comments (and edits and replies
  in those threads) stay on your machine, and you still see everyone else's.
- People who already have your comments, by file or live, could pass them on. Deleting a comment hides it
  everywhere, but anyone who already received it keeps its words.
- The service sees when and how much is sent, and the network addresses of everyone reading and writing. Anyone
  with the page can add unreadable data (Pipeup discards it) and, on a free service, fill the shared copy.

## Add it to a page

```html
<script src="https://cdn.jsdelivr.net/npm/pipeup@0.4.1/dist/pipeup.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@pipeup/share@0.4.1/dist/share.min.js"></script>
```

or one file, `pipeup+share.min.js`. The page needs a document identity (`data-pipeup-doc`) and a sharing address
(`data-pipeup-share`). Without either, the add-on stays off and says why; `Pipeup.addons()` shows the reason.

## Set up sharing (the author's command line)

Reviewers can't create a shared copy from inside the page; the author does it once:

```
npx @pipeup/share create page.html --server https://paste.example.org/
```

This makes a PrivateBin paste with discussions on and the longest expiry (`never`), reads it back and tells you
in words how long the instance keeps it, writes `data-pipeup-share` into `page.html` (every other byte stays as it
was), and prints the **stop key on the terminal only**. Keep the stop key private; never put it in the page.

| Command                             | What it does                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `create <page.html> --server <url>` | makes the shared copy and writes its address into the page                                                    |
| `create … --from feedback.json`     | also puts that file's comments into the shared copy                                                           |
| `create … --new-doc`                | gives the page a document identity if it has none                                                             |
| `create … --mailbox`                | uses your own server (below); a create token comes from `PIPEUP_MAILBOX_CREATE_TOKEN`, never the command line |
| `stop <page.html> --key <stop key>` | deletes the shared copy                                                                                       |
| `update <page.html>`                | points the page at the newest copy (PrivateBin starts a newer one when a paste grows)                         |

Exit codes: 0 done; 1 the service or a file failed; 2 the command wasn't understood or needs something first.

### How much each reviewer downloads (PrivateBin)

PrivateBin returns the whole paste on every read, so the cost is the number of reads times the paste size:

| Paste size                                 | Active (120 reads an hour) | Quiet (30) | Idle or hidden (12) |
| ------------------------------------------ | -------------------------- | ---------- | ------------------- |
| 50 KB (a few hundred comments)             | 6 MB                       | 1.5 MB     | 0.6 MB              |
| 256 KB (just before a new copy is started) | 31 MB                      | 7.7 MB     | 3 MB                |

For documents with many reviewers, use your own instance or a large public one, and respect each volunteer
instance's rules. A mailbox reads only what is new: well under 1 MB an hour.

### What each kind of sharing keeps

|                                      | PrivateBin                                                 | HTTP mailbox                 |
| ------------------------------------ | ---------------------------------------------------------- | ---------------------------- |
| Comments last while nobody is online | for the instance's retention                               | for the operator's retention |
| Live updates                         | polling, 30 s to 5 min                                     | polling, 30 s to 5 min       |
| Presence                             | no                                                         | no                           |
| Only holders of the page can read    | yes                                                        | yes                          |
| Only holders can write               | no: anyone with the address can add junk, which is dropped | with a write token, yes      |
| The service can't read or forge      | yes                                                        | yes                          |
| Missing comments can be detected     | no                                                         | no                           |
| The author can delete it             | the first copy only                                        | yes                          |

## Your own server: the HTTP mailbox

A company that won't send even ciphertext to a volunteer PrivateBin can run its own server. The contract is four
endpoints and is published in the add-ons design (section 7.7); `@pipeup/mailbox` is a reference server. Pages
need `https:` addresses; the sharing address looks like `https://share.example.com/pipeup/m/<id>#pm1.<key>`
(with `.<write token>` when the operator turns tokens on).

## From code (agents, scripts)

```js
import { connectShare } from "@pipeup/share/headless"; // over `pipeup/core`, Node 22 or later
const conn = await connectShare(doc, { share: pageShareAddress });
await conn.flush(); // reads what is new and sends everything waiting
conn.stop();
```

It uses the same transports, checks and send policy as the page, with no interface. The agent writes as its own
reviewer; it sends only its own comments (plus ones received from the shared copy).

## Notes

- Works from `file://`, `http(s)` pages and hosted pages. The browser build refuses `http:` addresses.
- Size: about 8 KB gzip.
- Licence: MIT.
