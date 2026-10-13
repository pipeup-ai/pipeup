import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { ANCHOR, key, mailbox } from "./share-helpers";

const cli = new URL("../../pipeup/cli/pipeup.mjs", import.meta.url).pathname;
const here = new URL("..", import.meta.url).pathname;

function run(args: string[], env: Record<string, string> = {}) {
  return new Promise<{ code: number; out: string; err: string }>((resolve) => {
    // Run from the add-ons folder, where @pipeup/share is installed, as an author's project would have it.
    const child = spawn("node", [cli, ...args], { cwd: here, env: { ...process.env, ...env } });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => resolve({ code: code ?? 0, out, err }));
    child.stdin.end();
  });
}

test("pipeup read reads the page's shared copy, and sends nothing to it", async () => {
  const m = await mailbox();
  const address = `${m.origin}/m/${m.id}#pm1.${key()}${m.token ? `.${m.token}` : ""}`;
  // Ada shares a comment from Node, as the page would.
  const core = await import(new URL("../../pipeup/dist/pipeup.core.js", import.meta.url).href);
  const { connectShare } = await import(new URL("../share/dist/share.headless.js", import.meta.url).href);
  const attr = core.newDocumentAttribute();
  const { id, key: docKey } = await core.parseDocumentAttribute(attr);
  const doc = await core.PipeupDocument.open({
    doc: id,
    key: docKey,
    store: new core.MemoryStore(),
    identity: await core.createIdentity(),
    name: "Ada",
  });
  await doc.comment(ANCHOR, "Shared from Ada's browser");
  const link = await connectShare(doc, { share: address, local: true, gap: 0 });
  await link.flush(20_000);
  // The sharing link may send once more just after its flush: let it settle before counting.
  await new Promise((r) => setTimeout(r, 1500));
  link.stop();
  await new Promise((r) => setTimeout(r, 300));
  const before = await m.batches();
  expect(before).toBeGreaterThan(0);

  const dir = await mkdtemp(join(tmpdir(), "pipeup-read-share-"));
  const page = join(dir, "page.html");
  await writeFile(
    page,
    `<!doctype html>\n<html data-pipeup-doc="${attr}" data-pipeup-share="${address}">\n<head><title>Plan</title></head>\n<body><p>x</p></body>\n</html>\n`,
  );
  const r = await run(["read", page], { PIPEUP_SHARE_LOCAL: "1" });
  expect(r.err).toContain("Reading the shared copy from 127.0.0.1");
  expect(r.err).toContain("Read the shared copy.");
  expect(r.out).toContain("Shared from Ada's browser");
  expect(r.code).toBe(0);
  expect(await m.batches()).toBe(before);
  await m.close();
});
