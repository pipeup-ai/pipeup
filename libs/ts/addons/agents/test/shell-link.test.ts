// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AddonHost } from "pipeup";
import { startLink } from "../src/link";
import { nextTo, onThisComputer, systemOf } from "../src/nearby";
import { agentPrompt, shellLink } from "../src/prompt";
import { type Block, startReplies } from "../src/replies";
import { taggedBy } from "../src/tag";

const at = (href: string) => new URL(href) as unknown as Location;
const nav = (o: Partial<Navigator> & { userAgentData?: { platform: string } }) =>
  ({ userAgent: "", platform: "", maxTouchPoints: 0, ...o }) as unknown as Navigator;

describe("the computer the page is on", () => {
  it("names the kind of computer, and calls phones and tablets other", () => {
    expect(systemOf(nav({ platform: "MacIntel" }))).toBe("mac");
    expect(systemOf(nav({ userAgentData: { platform: "Windows" } }))).toBe("windows");
    expect(systemOf(nav({ platform: "Linux x86_64" }))).toBe("linux");
    expect(systemOf(nav({ platform: "MacIntel", maxTouchPoints: 5 }))).toBe("other");
    expect(systemOf(nav({ platform: "Linux armv8l", userAgent: "Mozilla/5.0 (Linux; Android 14)" }))).toBe(
      "other",
    );
    expect(systemOf(nav({ platform: "iPhone", userAgent: "Mozilla/5.0 (iPhone)" }))).toBe("other");
  });

  it("knows a page on this computer: a file, or a local address", () => {
    expect(onThisComputer(at("file:///Users/ada/lisbon.html"))).toBe(true);
    expect(onThisComputer(at("http://localhost:3000/lisbon.html"))).toBe(true);
    expect(onThisComputer(at("http://127.0.0.1:8080/"))).toBe(true);
    expect(onThisComputer(at("http://app.localhost:5173/"))).toBe(true);
    expect(onThisComputer(at("https://example.com/lisbon.html"))).toBe(false);
    expect(onThisComputer(at("https://localhost/lisbon.html"))).toBe(false);
  });

  it("names a file after the page, and only on the same site or disk", () => {
    expect(nextTo(".link.js", null, at("http://localhost:3000/trips/lisbon.html?x=1#day2"))).toBe(
      "http://localhost:3000/trips/lisbon.link.js",
    );
    expect(nextTo(".link.js", null, at("file:///Users/ada/lisbon.html"))).toBe(
      "file:///Users/ada/lisbon.link.js",
    );
    expect(nextTo(".link.js", null, at("http://localhost:3000/"))).toBe(
      "http://localhost:3000/index.link.js",
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(nextTo(".link.js", "https://elsewhere.test/x.js", at("http://localhost:3000/a.html"))).toBeNull();
  });
});

describe("tags from a shell link", () => {
  // Made with: printf '%s' "$text" | openssl dgst -sha256 -hmac abcdefghijklmnopqrstuv
  const text =
    'ok:\n```pipeup-replies\nagent: Claude\nthread: t-1\nreply: Moved "brunch" to 11:30 \\ done\naddressed: Changed\n```';
  const tag = "bafab3b7dbf9cbba18ef7b40cc7780044218dc4ca3fb97f5d5fd6282ccbd9f34";

  it("accepts the tag openssl makes with the session's key, and nothing else", async () => {
    expect(await taggedBy("abcdefghijklmnopqrstuv", text, tag)).toBe(true);
    expect(await taggedBy("abcdefghijklmnopqrstuw", text, tag)).toBe(false);
    expect(await taggedBy("abcdefghijklmnopqrstuv", `${text} `, tag)).toBe(false);
    expect(await taggedBy("abcdefghijklmnopqrstuv", text, "")).toBe(false);
    expect(await taggedBy("", text, tag)).toBe(false);
  });
});

describe("the shell link", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-pipeup-link");
    vi.unstubAllGlobals();
  });
  const URL_ = "http://127.0.0.1:53469/o9A_KwmdRm7w-HL7e5ydlAje";

  it("appears when the link file is found, and sends nothing until switched on; then the comments and a fresh session key", async () => {
    let found: string | null = null;
    const sent: { url: string; type: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      sent.push({
        url,
        type: (init.headers as Record<string, string>)["content-type"]!,
        body: JSON.parse(init.body as string),
      });
      return { ok: true };
    });
    const refresh = vi.fn();
    const link = startLink({
      snapshot: async () => ({ v: 1, open: { markdown: "# hi" } }),
      changes: () => () => {},
      refresh,
      find: async () => found,
      here: at("file:///Users/ada/lisbon.html"),
    });
    await link.look();
    expect(link.enabled()).toBe(false);
    found = URL_;
    await link.look();
    expect(link.enabled()).toBe(true);
    expect(link.shell()).toBe(true);
    expect(link.file()).toBe("/Users/ada/lisbon.html");
    expect(refresh).toHaveBeenCalled();
    expect(sent).toEqual([]);

    await link.set(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe(`${URL_}/comments`);
    // Plain text: a simple request to another address on this computer, with no preflight.
    expect(sent[0]!.type).toMatch(/^text\/plain/);
    expect(sent[0]!.body.session).toBe(link.session());
    expect(link.session()).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const first = link.session();
    await link.set(false);
    expect(link.session()).toBe("");
    await link.set(true);
    expect(link.session()).not.toBe(first);
    link.destroy();
  });

  it("tries a busy link again before it gives up", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      if (calls < 3) throw new Error("refused");
      return { ok: true };
    });
    const link = startLink({
      snapshot: async () => ({}),
      changes: () => () => {},
      refresh() {},
      find: async () => URL_,
    });
    await link.look();
    await link.set(true);
    expect(calls).toBe(3);
    expect(link.on()).toBe(true);
    link.destroy();
  });

  it("turns sharing off and says so when the link file goes", async () => {
    let found: string | null = URL_;
    vi.stubGlobal("fetch", async () => ({ ok: true }));
    const lost = vi.fn();
    const link = startLink({
      snapshot: async () => ({}),
      changes: () => () => {},
      refresh() {},
      lost,
      find: async () => found,
    });
    await link.look();
    await link.set(true);
    found = null;
    await link.look();
    expect(link.enabled()).toBe(false);
    expect(link.on()).toBe(false);
    expect(lost).toHaveBeenCalledOnce();
    link.destroy();
  });

  it("refuses an address that isn't on this computer", async () => {
    // The default finder only keeps addresses on 127.0.0.1, localhost or [::1]; a test finder is trusted as given,
    // so check the pattern through a page shown with pipeup watch instead.
    document.documentElement.setAttribute("data-pipeup-link", "http://evil.test:80/abcdefghijklmnop");
    const link = startLink({ snapshot: async () => ({}), changes: () => () => {}, refresh() {} });
    expect(link.enabled()).toBe(false);
    link.destroy();
  });
});

describe("replies blocks a shell link left", () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).pipeupReplies;
  });
  const host = {
    document: { id: "d", ops: () => [], threads: () => [] },
    merge: async () => 0,
    overlay: () => document.createElement("div"),
  } as unknown as AddonHost;

  it("hands blocks over, and looks for the replies file only while a link is running or an agent is listed", async () => {
    (globalThis as Record<string, unknown>).pipeupReplies = [
      {
        format: "pipeup-replies-block",
        v: 1,
        text: "```pipeup-replies\nthread: t\nreply: r\n```",
        tag: "ab",
      },
      { format: "pipeup-replies-block", v: 1, text: 42 },
    ];
    const got: Block[] = [];
    const replies = startReplies(host, { linked: () => false, blocks: (b) => got.push(...b) });
    await vi.waitFor(() => expect(got).toHaveLength(1));
    expect(got[0]).toEqual({ text: "```pipeup-replies\nthread: t\nreply: r\n```", tag: "ab" });
    replies.destroy();
  });
});

describe("Copy for my agent, on this computer", () => {
  const meta = {
    title: "Lisbon, 23–26 Oct",
    url: "file:///Users/ada/lisbon.html",
    doc: "doc-id-123",
    comments: "1. [t-3a1c] On Saturday: Can we make this 11:30? (Ada)",
    open: 1,
    resolved: 0,
    replies: "file:///Users/ada/lisbon.replies.js",
    listed: false,
    nearby: true,
  };

  it("names the shell link for the kind of computer, pinned with its checksum, and asks for no install", () => {
    const mac = agentPrompt({ ...meta, system: "mac" });
    expect(mac).toContain("https://cdn.jsdelivr.net/npm/@pipeup/agents@0.0.0-test/dist/pipeup-link.sh");
    expect(mac).toContain("a".repeat(64));
    expect(mac).toContain("`bash pipeup-link.sh /Users/ada/lisbon.html`");
    expect(mac).toContain("Don't ask me to install anything");
    const win = agentPrompt({ ...meta, url: "file:///C:/Users/ada/lisbon.html", system: "windows" });
    expect(win).toContain("dist/pipeup-link.ps1");
    expect(win).toContain(
      "`powershell -ExecutionPolicy Bypass -File pipeup-link.ps1 C:/Users/ada/lisbon.html`",
    );
    expect(win).not.toContain("pipeup-link.sh");
  });

  it("names none on a phone, or for a page on a website", () => {
    expect(agentPrompt({ ...meta, system: "other" })).not.toContain("pipeup-link");
    expect(agentPrompt({ ...meta, system: "mac", nearby: false })).not.toContain("pipeup-link");
    expect(shellLink("other", "x")).toBeNull();
  });

  it("tells an agent with a shell link running how to read and answer through it", () => {
    const p = agentPrompt({ ...meta, system: "linux", shell: true, file: "/Users/ada/lisbon.html" });
    expect(p).toContain("with a shell link running");
    expect(p).toContain("`bash pipeup-link.sh comments /Users/ada/lisbon.html`");
    expect(p).toContain("`bash pipeup-link.sh reply /Users/ada/lisbon.html`");
    expect(p).not.toContain("fetch https://");
    expect(p).not.toContain("live link running");
  });
});
