#!/usr/bin/env node
// pipeup-mailbox: run the reference server from the environment, or `check <base>` any server.
import { createMailboxServer } from "./server.mjs";
import { runChecks } from "./check.mjs";

const env = process.env;
const num = (v) => (v === undefined || v === "" ? undefined : Number(v));

async function main(argv) {
  if (argv[0] === "check") {
    const base = argv[1];
    if (!base || base.startsWith("-")) {
      console.error("usage: pipeup-mailbox check <base>   (create token in PIPEUP_MAILBOX_CREATE_TOKEN)");
      return 2;
    }
    if (argv.includes("--create-token")) {
      console.error(
        "Put the create token in the PIPEUP_MAILBOX_CREATE_TOKEN environment variable, not on the command line.",
      );
      return 2;
    }
    const results = await runChecks(base, { createToken: env.PIPEUP_MAILBOX_CREATE_TOKEN });
    for (const r of results) console.log(`${r.status} ${r.name}${r.note ? ` (${r.note})` : ""}`);
    const failed = results.filter((r) => r.status === "FAIL").length;
    console.log(failed ? `${failed} check(s) failed.` : "All checks passed.");
    return failed ? 1 : 0;
  }
  if (argv.length) {
    console.error(
      "usage: pipeup-mailbox            start the server (see README for the environment)\n       pipeup-mailbox check <base>",
    );
    return 2;
  }
  const mb = num(env.MAX_MAILBOX_MB);
  const mailbox = createMailboxServer({
    dataDir: env.DATA_DIR || "./data",
    createToken: env.CREATE_TOKEN || undefined,
    writeTokens: env.WRITE_TOKENS === "on",
    maxMailboxBytes: mb === undefined ? undefined : mb * 1024 * 1024,
    keepDays: num(env.KEEP_DAYS),
    rate: { post: num(env.RATE_POST), get: num(env.RATE_GET) },
    trustProxy: env.TRUST_PROXY === "on",
  });
  const { port } = await mailbox.listen(num(env.PORT) ?? 8787, env.HOST || "127.0.0.1");
  console.log(`pipeup-mailbox listening on ${env.HOST || "127.0.0.1"}:${port} (put a TLS proxy in front)`);
  if (!env.CREATE_TOKEN)
    console.warn(
      "warning: CREATE_TOKEN is not set, so anyone who can reach this server can create mailboxes.",
    );
  for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => mailbox.close().then(() => process.exit(0)));
  return undefined;
}

main(process.argv.slice(2)).then(
  (code) => {
    if (code !== undefined) process.exit(code);
  },
  (e) => {
    console.error(e?.message ?? e);
    process.exit(1);
  },
);
