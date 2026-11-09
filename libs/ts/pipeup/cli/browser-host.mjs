#!/usr/bin/env node
// The program the browser starts when the Pipeup extension talks to this computer (native messaging): one message in,
// one answer out, each a 4-byte length (in the computer's byte order) then JSON. See browser.mjs.
import { receive, replies } from "./browser.mjs";

let buffer = Buffer.alloc(0);

function answer(message) {
  const body = Buffer.from(JSON.stringify(message));
  const head = Buffer.alloc(4);
  head.writeUInt32LE(body.length, 0);
  process.stdout.write(Buffer.concat([head, body]));
}

async function handle(m) {
  try {
    if (m?.type === "hello") return answer({ ok: true });
    if (m?.type === "send") return answer({ ok: true, ...(await receive(m)) });
    if (m?.type === "replies") return answer({ ok: true, replies: await replies(m.doc) });
    answer({ ok: false, error: `unknown message ${JSON.stringify(m?.type)}` });
  } catch (e) {
    answer({ ok: false, error: String(e?.message ?? e) });
  }
}

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (buffer.length >= 4) {
    const size = buffer.readUInt32LE(0);
    if (buffer.length < 4 + size) return;
    const text = buffer.subarray(4, 4 + size).toString("utf8");
    buffer = buffer.subarray(4 + size);
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      answer({ ok: false, error: "not JSON" });
      continue;
    }
    void handle(message);
  }
});
process.stdin.on("end", () => process.exit(0));
