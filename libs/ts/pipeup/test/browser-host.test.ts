import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const cli = new URL("../cli/pipeup.mjs", import.meta.url).pathname;
const host = new URL("../cli/browser-host.mjs", import.meta.url).pathname;

/** Sends one message to the host as the browser does (a 4-byte length, then JSON) and reads its answer. */
function talk(env: NodeJS.ProcessEnv, message: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [host], { env });
    let out = Buffer.alloc(0);
    child.stdout.on("data", (c: Buffer) => {
      out = Buffer.concat([out, c]);
      if (out.length >= 4 && out.length >= 4 + out.readUInt32LE(0)) {
        resolve(JSON.parse(out.subarray(4, 4 + out.readUInt32LE(0)).toString()));
        child.stdin.end();
      }
    });
    child.on("error", reject);
    const body = Buffer.from(JSON.stringify(message));
    const head = Buffer.alloc(4);
    head.writeUInt32LE(body.length, 0);
    child.stdin.write(Buffer.concat([head, body]));
  });
}

describe("the extension's link to agents on this computer", () => {
  it("keeps what the extension sends, lets an agent read and answer it, and hands the replies back", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pipeup-browser-"));
    const env = { ...process.env, PIPEUP_BROWSER_DIR: dir };
    const sent = await talk(env, {
      type: "send",
      doc: "page-1a2b3c4d",
      url: "https://docs.example.com/plan",
      title: "Lumen launch plan",
      markdown: "# Comments on Lumen launch plan\n\nWhich beta?\n",
      file: '{"ops":[]}',
    });
    expect(sent.ok).toBe(true);
    expect(readFileSync(join(dir, "page-1a2b3c4d", "comments.json"), "utf8")).toBe('{"ops":[]}');

    const run = (...args: string[]) =>
      execFileSync(process.execPath, [cli, "browser", ...args], { env }).toString();
    expect(run()).toContain("Lumen launch plan");
    expect(run("read", "docs.example.com")).toContain("Which beta?");
    expect(
      run("reply", "Lumen", "--thread", "t1", "--agent", "Ada's agent", "Ours.", "I'll", "say", "so."),
    ).toContain("Reply kept");

    const back = await talk(env, { type: "replies", doc: "page-1a2b3c4d" });
    expect(back).toMatchObject({
      ok: true,
      replies: [{ thread: "t1", agent: "Ada's agent", text: "Ours. I'll say so." }],
    });
    expect(await talk(env, { type: "nonsense" })).toMatchObject({ ok: false });
  });

  it("is installed only for a real extension id, with a launcher that knows where Node is", () => {
    const home = mkdtempSync(join(tmpdir(), "pipeup-home-"));
    const env = { ...process.env, HOME: home };
    expect(() =>
      execFileSync(process.execPath, [cli, "browser", "install", "--extension-id", "nope"], {
        env,
        stdio: "pipe",
      }),
    ).toThrow();
    if (process.platform !== "darwin" && process.platform !== "linux") return;
    const id = "a".repeat(32);
    execFileSync(process.execPath, [cli, "browser", "install", "--extension-id", id], { env });
    const place =
      process.platform === "darwin"
        ? "Library/Application Support/Google/Chrome/NativeMessagingHosts"
        : ".config/google-chrome/NativeMessagingHosts";
    const manifest = JSON.parse(readFileSync(join(home, place, "ai.pipeup.browser.json"), "utf8"));
    expect(manifest.allowed_origins).toEqual([`chrome-extension://${id}/`]);
    expect(readFileSync(manifest.path, "utf8")).toContain(process.execPath);

    // Firefox: no id to give, since Pipeup's is the same everywhere.
    execFileSync(process.execPath, [cli, "browser", "install", "--browser", "firefox"], { env });
    const fox =
      process.platform === "darwin"
        ? "Library/Application Support/Mozilla/NativeMessagingHosts"
        : ".mozilla/native-messaging-hosts";
    const foxManifest = JSON.parse(readFileSync(join(home, fox, "ai.pipeup.browser.json"), "utf8"));
    expect(foxManifest.allowed_extensions).toEqual(["extension@pipeup.ai"]);
    expect(foxManifest.allowed_origins).toBeUndefined();
  });
});
