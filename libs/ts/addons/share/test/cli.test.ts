import {
  createIdentity,
  MemoryStore,
  newDocumentAttribute,
  parseDocumentAttribute,
  PipeupDocument,
} from "pipeup/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { run, type Io } from "../src/cli-run";
import { keepWords, readAttribute, setAttribute, spanWords } from "../src/cli-lib";
import { connectShare } from "../src/headless";
import { PrivateBin } from "../src/privatebin";
import { anchor } from "./helpers";
import { createPrivateBinMock } from "./privatebin-mock";
// @ts-expect-error: the reference server is plain JavaScript
import { createMailboxServer } from "../../../../../services/mailbox/src/server.mjs";

const DOC_ATTR = newDocumentAttribute();
const PAGE = `<!doctype html>\r\n<html lang="en"  data-pipeup-doc="${DOC_ATTR}" class='x'>\r\n<head><title>A &amp; B</title></head>\r\n<body>\r\n  <p>Hello</p>\n</body></html>\n`;

function files(initial: Record<string, string>) {
  const fs = new Map(Object.entries(initial));
  const out: string[] = [];
  const err: string[] = [];
  return { fs, out, err };
}
const make = (
  f: ReturnType<typeof files>,
  fetch: typeof globalThis.fetch,
  env: Record<string, string> = {},
): Io => ({
  fetch,
  env,
  read: async (p) => {
    if (!f.fs.has(p)) throw new Error(`no such file ${p}`);
    return f.fs.get(p)!;
  },
  write: async (p, t) => void f.fs.set(p, t),
  out: (t) => f.out.push(t),
  err: (t) => f.err.push(t),
  wait: async () => {},
});

async function openDoc(attr: string, name: string) {
  const { id, key } = await parseDocumentAttribute(attr);
  return PipeupDocument.open({
    doc: id,
    key,
    store: new MemoryStore(),
    identity: await createIdentity(),
    name,
  });
}

describe("rewriting the page keeps every other byte", () => {
  it("adds the attribute before > and removes cleanly", () => {
    const out = setAttribute(PAGE, "data-pipeup-share", "https://x.example/?abcdefgh#k");
    expect(out.replace(' data-pipeup-share="https://x.example/?abcdefgh#k"', "")).toBe(PAGE);
    expect(readAttribute(out, "data-pipeup-share")).toBe("https://x.example/?abcdefgh#k");
    expect(readAttribute(out, "data-pipeup-doc")).toBe(DOC_ATTR);
  });
  it("replaces an existing value in place, keeping its quotes and everything around it", () => {
    const one = setAttribute(PAGE, "data-pipeup-share", "https://x.example/one");
    const two = setAttribute(one, "data-pipeup-share", "https://x.example/two");
    expect(two).toBe(one.replace("one", "two"));
    const single = PAGE.replace("<html ", "<html data-pipeup-share='old' ");
    expect(setAttribute(single, "data-pipeup-share", "new")).toBe(single.replace("'old'", "'new'"));
  });
  it("is not fooled by > inside a quoted value, or by a body that mentions <html", () => {
    const tricky = `<html data-x="a>b">\n<body><code>&lt;html data-pipeup-share="no"&gt;</code></body>`;
    const out = setAttribute(tricky, "data-pipeup-share", "v");
    expect(out).toBe(
      `<html data-x="a>b" data-pipeup-share="v">\n<body><code>&lt;html data-pipeup-share="no"&gt;</code></body>`,
    );
  });
  it("says so when there is no <html> tag", () => {
    expect(() => setAttribute("<p>fragment</p>", "a", "b")).toThrow(/no <html> tag/);
  });
});

describe("words", () => {
  it("says how long a service keeps a copy", () => {
    const now = Date.UTC(2026, 9, 7);
    expect(keepWords("paste.example.org", 604_800_000, now)).toBe(
      "paste.example.org keeps this shared copy for 1 week, until 14 October 2026.",
    );
    expect(keepWords("paste.example.org", null)).toBe(
      "paste.example.org keeps this shared copy until it is deleted.",
    );
    expect(spanWords(300_000)).toBe("5 minutes");
    expect(spanWords(86_400_000)).toBe("24 hours");
    expect(spanWords(3 * 86_400_000)).toBe("3 days");
    expect(spanWords(400 * 86_400_000)).toBe("13 months");
  });
});

describe("share create / stop / update (PrivateBin)", () => {
  it("creates a paste, writes the address, reports retention, prints the stop key only on the terminal", async () => {
    const mock = createPrivateBinMock({ offered: ["1week"], defaultExpire: "1week" });
    const f = files({ "page.html": PAGE });
    const code = await run(
      ["create", "page.html", "--server", "https://paste.example.org/"],
      make(f, mock.fetch),
    );
    expect(code).toBe(0);
    const page = f.fs.get("page.html")!;
    expect(page.replace(/ data-pipeup-share="[^"]+"/, "")).toBe(PAGE);
    const share = readAttribute(page, "data-pipeup-share")!;
    expect(share).toMatch(/^https:\/\/paste\.example\.org\/\?[0-9a-f]{16}#[A-Za-z0-9_-]{43}$/);
    const text = f.out.join("\n");
    expect(text).toMatch(/paste\.example\.org keeps this shared copy for 1 week, until \d+ \w+ \d{4}\./);
    const token = [...mock.pastes.values()][0]!.token;
    expect(text).toContain(`Stop key: ${token}`);
    expect(text).toContain("Keep this private; never put it in the page");
    expect(page).not.toContain(token);
    // Discussion on, burn after reading off, never asked for.
    const created = JSON.parse(mock.log[0]!.body) as {
      adata: [unknown, string, number, number];
      meta: { expire: string };
    };
    expect(created.adata.slice(2)).toEqual([1, 0]);
    expect(created.meta.expire).toBe("never");
  });

  it("says 'until it is deleted' when the instance keeps it for ever", async () => {
    const mock = createPrivateBinMock();
    const f = files({ "page.html": PAGE });
    expect(
      await run(["create", "page.html", "--server", "https://paste.example.org/"], make(f, mock.fetch)),
    ).toBe(0);
    expect(f.out.join("\n")).toContain("keeps this shared copy until it is deleted.");
  });

  it("without data-pipeup-doc it explains and offers --new-doc; with it, writes a fresh identity", async () => {
    const mock = createPrivateBinMock();
    const bare = PAGE.replace(` data-pipeup-doc="${DOC_ATTR}"`, "");
    const f = files({ "page.html": bare });
    expect(
      await run(["create", "page.html", "--server", "https://p.example.org/"], make(f, mock.fetch)),
    ).toBe(2);
    expect(f.err.join("\n")).toContain("--new-doc");
    expect(f.fs.get("page.html")).toBe(bare);
    expect(mock.log).toHaveLength(0);
    expect(
      await run(
        ["create", "page.html", "--server", "https://p.example.org/", "--new-doc"],
        make(f, mock.fetch),
      ),
    ).toBe(0);
    const page = f.fs.get("page.html")!;
    expect(readAttribute(page, "data-pipeup-doc")).toMatch(/^[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]{43}$/);
    expect(readAttribute(page, "data-pipeup-share")).toContain("https://p.example.org/?");
  });

  it("--from puts a feedback file's comments in, and a headless reviewer reads them", async () => {
    const mock = createPrivateBinMock();
    const author = await openDoc(DOC_ATTR, "Sam");
    await author.comment(anchor, "Please fix the chart");
    const f = files({ "page.html": PAGE, "feedback.json": await author.exportFile() });
    expect(
      await run(
        ["create", "page.html", "--server", "https://p.example.org/", "--from", "feedback.json"],
        make(f, mock.fetch),
      ),
    ).toBe(0);
    expect(f.out.join("\n")).toContain("Put 1 comment from feedback.json into the shared copy.");
    const share = readAttribute(f.fs.get("page.html")!, "data-pipeup-share")!;
    const ada = await openDoc(DOC_ATTR, "Ada");
    const conn = await connectShare(ada, { share, fetch: mock.fetch, gap: 0 });
    await expect.poll(() => ada.threads().length).toBe(1);
    expect(ada.threads()[0]!.root.text).toBe("Please fix the chart");
    conn.stop();
  });

  it("refuses an http server and a feedback file for another document, in words", async () => {
    const mock = createPrivateBinMock();
    const f = files({ "page.html": PAGE });
    expect(
      await run(["create", "page.html", "--server", "http://paste.example.org/"], make(f, mock.fetch)),
    ).toBe(2);
    expect(f.err.join("\n")).toMatch(/https:/);
    const other = await openDoc(newDocumentAttribute(), "Lee");
    await other.comment(anchor, "elsewhere");
    f.fs.set("other.json", await other.exportFile());
    f.err.length = 0;
    expect(
      await run(
        ["create", "page.html", "--server", "https://p.example.org/", "--from", "other.json"],
        make(f, mock.fetch),
      ),
    ).toBe(1);
    expect(f.err.join("\n")).toMatch(/couldn't read other\.json/);
    expect(f.fs.get("page.html")).toBe(PAGE);
  });

  it("stop deletes the first copy and says which later ones it can't, with their expiry", async () => {
    const mock = createPrivateBinMock({ offered: ["1week"], defaultExpire: "1week" });
    const f = files({ "page.html": PAGE });
    const io = make(f, mock.fetch);
    await run(["create", "page.html", "--server", "https://paste.example.org/"], io);
    const share = readAttribute(f.fs.get("page.html")!, "data-pipeup-share")!;
    const key = [...mock.pastes.values()][0]!.token;
    // The paste grows and a browser rolls over to a newer copy.
    const { parseShare } = await import("../src/address");
    const a = parseShare(share) as Extract<ReturnType<typeof parseShare>, { kind: "privatebin" }>;
    const { ladder } = await import("@pipeup/kit");
    const l = ladder((await parseDocumentAttribute(DOC_ATTR)).id, a.key);
    const pb = new PrivateBin(a, l, mock.fetch);
    await pb.roll([]);
    f.err.length = f.out.length = 0;
    expect(await run(["update", "page.html"], io)).toBe(0);
    expect(readAttribute(f.fs.get("page.html")!, "data-pipeup-share")).toContain(`?${pb.head}#`);
    f.fs.set("page.html", setAttribute(f.fs.get("page.html")!, "data-pipeup-share", share));
    f.out.length = 0;
    expect(await run(["stop", "page.html", "--key", "wrong"], io)).toBe(1);
    expect(mock.pastes.size).toBe(2);
    expect(await run(["stop", "page.html", "--key", key], io)).toBe(0);
    expect(mock.pastes.size).toBe(1);
    expect(f.err.join("\n")).toMatch(/1 newer copy was made.*can't delete it/s);
    expect(f.err.join("\n")).toContain(pb.head);
  });
});

describe("mailbox: create, headless sharing, stop", () => {
  let box: ReturnType<typeof createMailboxServer>;
  let origin: string;
  beforeAll(async () => {
    box = createMailboxServer({ memory: true, createToken: "make-it", writeTokens: true });
    origin = `http://127.0.0.1:${(await box.listen(0, "127.0.0.1")).port}`;
  });
  afterAll(() => box.close());

  it("needs the create token from the environment, never the command line", async () => {
    const f = files({ "page.html": PAGE });
    expect(
      await run(["create", "page.html", "--server", `${origin}/pipeup`, "--mailbox"], make(f, fetch)),
    ).toBe(1);
    expect(f.err.join("\n")).toContain("PIPEUP_MAILBOX_CREATE_TOKEN");
    expect(
      await run(
        ["create", "page.html", "--server", origin, "--mailbox", "--create-token", "x"],
        make(f, fetch),
      ),
    ).toBe(2);
  });

  it("creates a mailbox, two headless reviewers converge, stop deletes it", async () => {
    const f = files({ "page.html": PAGE });
    const io = make(f, fetch, { PIPEUP_MAILBOX_CREATE_TOKEN: "make-it" });
    expect(await run(["create", "page.html", "--server", origin, "--mailbox"], io)).toBe(0);
    const share = readAttribute(f.fs.get("page.html")!, "data-pipeup-share")!;
    expect(share).toMatch(/\/m\/[A-Za-z0-9_-]{22,64}#pm1\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]+$/);
    const stopLine = f.out.find((l) => l.startsWith("Stop key: "))!;
    expect(f.fs.get("page.html")).not.toContain(stopLine.slice(10));
    const sam = await openDoc(DOC_ATTR, "Sam");
    const ada = await openDoc(DOC_ATTR, "Ada");
    const a = await connectShare(sam, { share, local: true, gap: 0 });
    const b = await connectShare(ada, { share, local: true, gap: 0 });
    await sam.comment(anchor, "From Sam");
    await a.flush(10_000);
    await ada.comment(anchor, "From Ada");
    await b.flush(10_000);
    // Each reads what the other sent on its next read.
    await expect
      .poll(
        async () => (await Promise.all([a.flush(), b.flush()]), sam.threads().length + ada.threads().length),
        { timeout: 10_000 },
      )
      .toBe(4);
    // Neither re-sends the other's comment.
    expect(sam.ops().filter((o) => o.body.author === ada.me)).toHaveLength(1);
    a.stop();
    b.stop();
    f.out.length = 0;
    expect(await run(["stop", "page.html", "--key", "wrong"], io)).toBe(1);
    expect(await run(["stop", "page.html", "--key", stopLine.slice(10)], io)).toBe(0);
    expect((await fetch(share.split("#")[0]! + "/ops")).status).toBe(404);
  });
});
