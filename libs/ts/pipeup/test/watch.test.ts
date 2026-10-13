import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pageSupport, served, watch } from "../cli/link.mjs";

const page = (scripts: string) =>
  `<!doctype html><html lang="en" data-pipeup-doc="x"><head><title>t</title></head><body><p>hi</p>${scripts}</body></html>`;
const src = (s: string) => `<script src="${s}"></script>`;
const dir = "/nowhere";

describe("which Pipeup a page uses, and what it can do for an agent", () => {
  it("reads a version from the script's address", async () => {
    const at = (v: string) =>
      pageSupport(page(src(`https://cdn.jsdelivr.net/npm/pipeup@${v}/dist/pipeup.min.js`)), dir);
    expect(await at("0.5.1")).toMatchObject({ support: "old", version: "0.5.1" });
    expect(await at("0.4.1")).toMatchObject({ support: "old" });
    expect(await at("0.6.0")).toMatchObject({ support: "builtin", version: "0.6.0" });
    expect(await at("0.6.9")).toMatchObject({ support: "builtin" });
    expect(await at("0.7.0")).toMatchObject({ support: "addon" });
    expect(await at("0.7.0-beta.1")).toMatchObject({ support: "addon" });
    expect(await at("1.0.0")).toMatchObject({ support: "addon" });
  });

  it("can't tell from a floating address, and says unknown", async () => {
    for (const v of ["latest", "0", "0.6"])
      expect(
        await pageSupport(page(src(`https://unpkg.com/pipeup@${v}/dist/pipeup.min.js`)), dir),
      ).toMatchObject({
        support: "unknown",
      });
  });

  it("reads a local script's own text for what it supports", async () => {
    const d = await mkdtemp(join(tmpdir(), "pipeup-watch-"));
    await writeFile(join(d, "old.js"), 'var x="pipeup-root";var q="pipeupAddons"');
    await writeFile(join(d, "mid.js"), 'var x="pipeup-root";var q="pipeupReplies"');
    await writeFile(join(d, "new.js"), 'var x="pipeup-root";var c=["menu","listnote"]');
    await writeFile(join(d, "other.js"), "console.log('not pipeup')");
    expect((await pageSupport(page(src("old.js")), d)).support).toBe("old");
    expect((await pageSupport(page(src("mid.js?v=1")), d)).support).toBe("builtin");
    expect((await pageSupport(page(src("new.js")), d)).support).toBe("addon");
    expect((await pageSupport(page(src("other.js")), d)).support).toBe("unknown");
    expect((await pageSupport(page(src("missing.js")), d)).support).toBe("unknown");
  });

  it("reads a Pipeup carried inside the page", async () => {
    expect((await pageSupport(page('<script>var a="pipeup-root",b="listnote"</script>'), dir)).support).toBe(
      "addon",
    );
  });

  it("notices a page that already includes the add-on", async () => {
    const found = await pageSupport(
      page(src("https://cdn.jsdelivr.net/npm/pipeup@0.7.0/dist/pipeup.min.js") + src("agents.min.js")),
      dir,
    );
    expect(found.loaded).toBe(true);
  });
});

describe("the page as watch serves it", () => {
  const meta = {
    base: "/__pipeup/abcdefghijklmnopqr",
    agent: "Claude",
    key: "K".repeat(43),
    file: "/a/b.html",
  };

  it("adds the add-on's script after the page's own, and nothing else, when asked", () => {
    const out = served(page(src("p.js")), { ...meta, addon: true });
    expect(out).toContain(
      `${src("p.js")}<script src="/__pipeup/abcdefghijklmnopqr/agents.js"></script></body>`,
    );
    expect(out).toContain('data-pipeup-link="/__pipeup/abcdefghijklmnopqr"');
  });

  it("adds no script when the page's Pipeup has agent support built in", () => {
    expect(served(page(src("p.js")), { ...meta, addon: false })).not.toContain("agents.js");
  });

  it("puts the script at the end of a page with no body tag", () => {
    expect(served('<html lang="en"><p>x</p>', { ...meta, addon: true })).toMatch(
      /<script src="[^"]+agents\.js"><\/script>$/,
    );
  });
});

describe("watch", () => {
  const start = async (scripts: string) => {
    const d = await mkdtemp(join(tmpdir(), "pipeup-watch-"));
    const file = join(d, "p.html");
    await writeFile(file, page(scripts));
    return { file, run: () => watch({ page: file, agent: "Claude", key: "K".repeat(43), log: () => {} }) };
  };

  it("refuses a page whose Pipeup is before 0.6, in words", async () => {
    const { run } = await start(src("https://cdn.jsdelivr.net/npm/pipeup@0.5.1/dist/pipeup.min.js"));
    await expect(run()).rejects.toThrow(/uses Pipeup 0\.5\.1, which can't take an agent.*0\.6 or later/);
  });

  it("starts for a 0.6.x page without the add-on", async () => {
    const { run } = await start(src("https://cdn.jsdelivr.net/npm/pipeup@0.6.0/dist/pipeup.min.js"));
    const link = await run();
    expect(link).toMatchObject({ support: "builtin", addon: false });
    await link.close();
  });
});
