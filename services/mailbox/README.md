# @pipeup/mailbox

The reference HTTP mailbox server for Pipeup shared comments, and a checker for any server that claims to
speak the same contract (`pm1`, [add-ons design](../../docs/design/addons.md) section 7.7).

A mailbox stores opaque, encrypted batches of comments. The server can't read them: it holds ciphertext and
never sees the key, which stays in the shared file's address. Run it when your organisation doesn't want even
ciphertext to go to a public service. The Pipeup project ships this software; it runs no mailbox for anyone.

- About 200 lines of Node (`node:http`, `node:crypto`), no dependencies, Node 22 or newer.
- Storage is one append-only JSON-lines file per mailbox in `DATA_DIR`, plus a small metadata file.
- It speaks plain HTTP on localhost. Put a TLS proxy in front: browsers only accept `https:` for a shared
  file (`http://localhost` and `http://127.0.0.1` work for development with the headless engine).

## Run it

```sh
CREATE_TOKEN="$(openssl rand -base64 24)" DATA_DIR=/var/lib/pipeup-mailbox npx @pipeup/mailbox
```

or with Docker:

```sh
docker build -t pipeup-mailbox .
docker run -d -p 127.0.0.1:8787:8787 -v pipeup-mailbox:/data -e CREATE_TOKEN=... -e TRUST_PROXY=on pipeup-mailbox
```

| Variable         | Default   | Meaning                                                                                          |
| ---------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `PORT`           | 8787      | Port to listen on.                                                                               |
| `HOST`           | 127.0.0.1 | Address to bind (`0.0.0.0` inside a container).                                                  |
| `DATA_DIR`       | `./data`  | Where mailboxes are stored.                                                                      |
| `CREATE_TOKEN`   | none      | When set, creating a mailbox needs `Authorization: Bearer <it>`. Set it.                         |
| `WRITE_TOKENS`   | off       | `on` gives each mailbox a write token, which the share file carries and POST bodies must repeat. |
| `MAX_MAILBOX_MB` | 64        | Quota per mailbox. A full mailbox answers 507.                                                   |
| `KEEP_DAYS`      | 365       | Mailboxes are deleted this many days after their last write. `0` keeps them for ever.            |
| `RATE_POST`      | 60        | POSTs per minute per network address.                                                            |
| `RATE_GET`       | 600       | GETs per minute per network address.                                                             |
| `TRUST_PROXY`    | off       | `on` takes the network address from `X-Forwarded-For`. Turn it on only behind your own proxy.    |

A mailbox is also capped at 100,000 batches and every request body at 512 KiB.

Programmatic use (tests, embedding):

```js
import { createMailboxServer } from "@pipeup/mailbox";
const mailbox = createMailboxServer({ memory: true, writeTokens: true, createToken: "secret" });
const { port } = await mailbox.listen(0);
```

## Behind a TLS proxy

The proxy must pass the CORS headers through (the server sets them itself) and must not add
`Access-Control-Allow-Credentials`. Pages opened from `file://` send `Origin: null`; the answer
`Access-Control-Allow-Origin: *` is what lets them read the response, and `Access-Control-Expose-Headers:
Retry-After` is what lets them read a 429.

Caddy (serving under `/pipeup`):

```caddy
share.example.com {
	handle_path /pipeup/* {
		reverse_proxy 127.0.0.1:8787
	}
}
```

The server serves under any prefix, so you can instead keep the prefix with `handle /pipeup/*`. Caddy
passes `X-Forwarded-For` by default; set `TRUST_PROXY=on`.

nginx:

```nginx
location /pipeup/ {
    proxy_pass http://127.0.0.1:8787/;
    proxy_set_header X-Forwarded-For $remote_addr;
    client_max_body_size 1m;
    # The server already sends these on every response, errors included. If you terminate CORS in nginx
    # instead, repeat them on errors too, with "always":
    #   add_header Access-Control-Allow-Origin "*" always;
    #   add_header Access-Control-Expose-Headers "Retry-After" always;
    # and never add Access-Control-Allow-Credentials.
    # On a private address, also: add_header Access-Control-Allow-Private-Network "true" always;
}
```

Don't add the headers in both places: duplicated `Access-Control-Allow-Origin` values make browsers refuse
the response. With `proxy_pass` the server's own headers go through untouched. Then run the checker.

## Check a server

```sh
PIPEUP_MAILBOX_CREATE_TOKEN=... npx @pipeup/mailbox check https://share.example.com/pipeup
```

It prints PASS, FAIL or SKIP for each check and exits with 1 on any failure. It works against any
implementation, and an operator who writes their own should run it before pointing pages at it. It
creates two mailboxes and deletes both. It checks CORS headers on success and on errors, a simple-request
POST with a `text/plain` body, an idempotent retry, an id mismatch being refused, cursor paging and `more`,
the 512 KiB limit (413), the 429 body and exposed `Retry-After` (SKIP when the server can't be made to
limit within 80 POSTs), and 404 after `DELETE`. The create token is read from the environment, never from the
command line, so it stays out of shell history and process lists. `http:` is accepted only for `localhost`
and `127.0.0.1`.

## The contract in short

| Endpoint                               | Purpose                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `GET <base>/m/<id>/ops?since=<cursor>` | New batches after the cursor, oldest first, with `next`, `more` and `expires`.    |
| `POST <base>/m/<id>/ops`               | Append one batch `{id, ct, token?}`; 201 appended, 200 already there.             |
| `POST <base>/m`                        | Create a mailbox; returns its id, stop key (shown once) and optional write token. |
| `DELETE <base>/m/<id>`                 | Delete it with `Authorization: Bearer <stop key>`; 204.                           |

Every error is JSON `{v: 1, error, message}`: 400 `bad-request`, 403 `token`, 404 `gone`, 409 `cursor`, 413
`too-large`, 429 `rate` (with `Retry-After` and `retryAfter`), 507 `full`. Mailboxes are never listed.
The cursor is the number of batches before it. The rule every implementation must keep: every batch
committed before a response that returned `next` is in that response or an earlier one, and none committed
later is skipped.

## Serverless and edge notes

The reference server is a long-running process. The contract also fits platforms with no server, as long as
each meets the cursor rule above:

- **Cloudflare Workers**: one Durable Object per mailbox. Appends are serialised for free, and the cursor is
  a counter in the object's storage.
- **Deno Deploy**: Deno KV with a per-mailbox counter, incremented in an atomic transaction together with the
  write of the batch.
- **AWS Lambda**: DynamoDB with the mailbox as partition key and a sequence number as sort key, written with a
  conditional put (`attribute_not_exists`) and retried on conflict.

Answer `OPTIONS` and send the CORS headers on every response, errors included, whatever the platform.

## What the operator can see

Ciphertext only: never comment text, names, anchors, the document id or the key. The operator does see
metadata: mailbox ids, when each request is made, batch sizes and counts, the network addresses and user
agents of everyone reading and writing, and so which addresses use the same document. The operator can
withhold, delete or show different readers different batches. They can't forge or alter a comment
(signatures), and a replayed batch is dropped by its id.

The write token is not in logs because it travels only in POST bodies. The mailbox id is in your access
logs, so keep those logs as private as you would any capability URL.

## Tests

```sh
npm test
```
