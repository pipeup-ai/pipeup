import { execFile, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { allow, choosePath, MAX_BYTES, parseReview } from "../service/lib.mjs";
import { startStandIn } from "../service/stand-in.mjs";

// The checker runs in another process: the service in this one must stay free to answer it.
const run = (args) =>
  promisify(execFile)("node", ["service/check.mjs", ...args], { cwd: join(import.meta.dirname, "..") }).then(
    (r) => ({ status: 0, stdout: r.stdout }),
    (e) => ({ status: e.code, stdout: e.stdout }),
  );

const good = {
  title: "Q3 launch plan",
  url: "https://pages.example.com/plans/launch-plan.html",
  exportedAt: "2026-10-10T09:30:00Z",
  openThreads: 2,
  markdown: "# Review comments\n\n- Sam: Is this date firm?\n",
};

describe("what a service accepts", () => {
  it("takes a good review and only the fields the contract names", () => {
    const r = parseReview(JSON.stringify({ ...good, path: "../../etc/passwd" }));
    expect(r).toMatchObject({ title: good.title, openThreads: 2 });
    expect(r).not.toHaveProperty("path");
  });

  it("refuses what isn't JSON, what lacks fields, and what is too large", () => {
    expect(() => parseReview("nope")).toThrow(/isn't JSON/);
    expect(() => parseReview(JSON.stringify({ title: "x" }))).toThrow(/needs a title/);
    expect(() => parseReview(JSON.stringify({ ...good, exportedAt: "not a time" }))).toThrow(/exportedAt/);
    try {
      parseReview(JSON.stringify({ ...good, markdown: "x".repeat(MAX_BYTES + 1) }));
    } catch (e) {
      expect(e.http).toBe(413);
    }
  });
});

describe("where a review is saved", () => {
  it("is chosen by the service: reviews/<page>/<time>-<who>.md, whatever the request says", () => {
    const at = new Date("2026-10-10T09:30:05Z");
    expect(choosePath(good, "Sam Lee", at, "ab12")).toBe(
      "reviews/launch-plan/20261010-093005-sam-lee-ab12.md",
    );
    expect(choosePath({ title: "Q3: Plan!", url: "nonsense" }, "", at, "cd34")).toBe(
      "reviews/q3-plan/20261010-093005-someone-cd34.md",
    );
    expect(choosePath(good, "Sam", at)).not.toBe(choosePath(good, "Sam", at));
  });

  it("limits one person to ten reviews a minute", () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) expect(allow("rate-test", now)).toBe(true);
    expect(allow("rate-test", now)).toBe(false);
    expect(allow("rate-test", now + 61_000)).toBe(true);
  });
});

describe("the stand-in service", () => {
  const dir = mkdtempSync(join(tmpdir(), "stg-test-"));
  let svc;
  afterAll(() => svc?.server.close());

  it("saves a review as a Markdown file in a Git repository and commits it", async () => {
    svc = await startStandIn({ repo: dir, port: 0, origin: "http://localhost:8789" });
    const res = await fetch(svc.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(good),
    });
    const out = await res.json();
    expect(res.status).toBe(201);
    expect(out.path).toMatch(/^reviews\/launch-plan\/.+\.md$/);
    expect(existsSync(join(dir, out.path))).toBe(true);
    expect(readFileSync(join(dir, out.path), "utf8")).toContain("Is this date firm?");
    expect(execFileSync("git", ["log", "-1", "--format=%H %s"], { cwd: dir, encoding: "utf8" })).toContain(
      out.commit,
    );
  });

  it("is found to follow the contract by the checker", async () => {
    const out = await run([svc.url, "--origin", "http://localhost:8789"]);
    expect(out.stdout).toContain("This service follows the contract.");
    expect(out.status).toBe(0);
  });

  it("is found NOT to follow it when it answers wrongly", async () => {
    const { createServer } = await import("node:http");
    const bad = createServer((req, res) => res.writeHead(200).end("{}"));
    await new Promise((ok) => bad.listen(0, "127.0.0.1", ok));
    const out = await run([`http://127.0.0.1:${bad.address().port}/reviews`]);
    bad.close();
    expect(out.status).toBe(1);
    expect(out.stdout).toContain("FAIL");
  });
});
