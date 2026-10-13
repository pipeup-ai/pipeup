import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const tools = new URL("../../../../../tools/", import.meta.url).pathname;
const fake = new URL("./fake-security.mjs", import.meta.url).pathname;

/** A temporary Keychain, key list and update list, and a way to run the signing tool against them. */
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "pipeup-sign-"));
  const files = {
    chain: join(dir, "chain.json"),
    keys: join(dir, "keys.json"),
    list: join(dir, "updates.json"),
  };
  writeFileSync(files.keys, "[]");
  writeFileSync(
    files.list,
    JSON.stringify({
      v: 1,
      at: "2026-10-12T00:00:00Z",
      expires: "2099-01-01T00:00:00Z",
      latest: "0.7.0",
      minimum: "0.5.0",
      versions: {},
      advisories: [],
    }),
  );
  const wrapper = join(dir, "security");
  writeFileSync(wrapper, `#!/bin/sh\nexec node ${fake} "$@"\n`, { mode: 0o755 });
  const run = (...args: string[]) =>
    execFileSync("node", [`${tools}sign-updates.mjs`, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PIPEUP_SECURITY: wrapper,
        FAKE_KEYCHAIN: files.chain,
        PIPEUP_UPDATE_KEYS: files.keys,
      },
    });
  const fails = (...args: string[]) => {
    try {
      run(...args);
      return "";
    } catch (e) {
      return String((e as { stderr: string }).stderr);
    }
  };
  return { files, run, fails };
}

describe("the signing script", () => {
  it("makes a key once, signs the list with it, and the list then verifies", () => {
    const { files, run } = setup();
    const out = run("init", "--in", files.list);
    const key = /\n([A-Za-z0-9_-]{43})\n?$/.exec(out)![1]!;
    writeFileSync(files.keys, JSON.stringify([{ id: "k1", key }]));
    run("sign", "--in", files.list);
    expect(JSON.parse(readFileSync(files.list, "utf8")).sig).toMatchObject({ key: "k1" });
    expect(run("verify", "--in", files.list)).toContain("ok");
  });

  it("never overwrites a key, and says what is missing", () => {
    const { files, run, fails } = setup();
    expect(fails("sign", "--in", files.list)).toContain("no key");
    run("init");
    expect(fails("init")).toContain("never overwritten");
    // The public half must be published before a list is signed, so a list nobody can check is never made.
    expect(fails("sign", "--in", files.list)).toContain("not in");
  });

  it("refuses a changed or expired list, and prints the private key only when told to", () => {
    const { files, run, fails } = setup();
    const key = /\n([A-Za-z0-9_-]{43})\n?$/.exec(run("init"))![1]!;
    writeFileSync(files.keys, JSON.stringify([{ id: "k1", key }]));
    run("sign", "--in", files.list);
    const signed = JSON.parse(readFileSync(files.list, "utf8"));
    writeFileSync(files.list, JSON.stringify({ ...signed, latest: "9.9.9" }));
    expect(fails("verify", "--in", files.list)).toContain("signature does not match");
    // A list that is already out of date is never signed.
    writeFileSync(files.list, JSON.stringify({ ...signed, sig: undefined, expires: "2000-01-01T00:00:00Z" }));
    expect(fails("sign", "--in", files.list)).toContain("it has expired");
    expect(fails("export")).toContain("--yes");
    expect(run("export", "--yes").trim()).toMatch(/^[A-Za-z0-9+/=]{60,}$/);
  });
});
