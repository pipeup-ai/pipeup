// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAddon } from "../src/addon";

type Handler = ((...a: never[]) => void) | null;

/** An event-driven stand-in for SpeechRecognition: nothing happens until a test fires it. */
class FakeRecognition {
  static all: FakeRecognition[] = [];
  static overlaps = 0;
  static availability: string | undefined = "available";
  static installs: unknown[] = [];
  static installed = true;
  static available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string>;
  static install?: (o: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
  lang = "";
  interimResults = false;
  continuous = false;
  processLocally?: boolean;
  onstart: Handler = null;
  onspeechstart: Handler = null;
  onend: Handler = null;
  onerror: Handler = null;
  onresult: Handler = null;
  running = false;
  calls: string[] = [];
  constructor() {
    FakeRecognition.all.push(this);
  }
  start() {
    // One at a time: a start while another has not yet ended is what Safari punishes.
    if (FakeRecognition.all.some((r) => r !== this && r.running)) FakeRecognition.overlaps++;
    this.running = true;
    this.calls.push("start");
  }
  stop() {
    this.calls.push("stop");
  }
  abort() {
    this.calls.push("abort");
  }
  begin() {
    (this.onstart as () => void)();
  }
  say(results: { t: string; final?: boolean }[], at = 0) {
    const list = results.map((r) => Object.assign([{ transcript: r.t }], { isFinal: !!r.final }));
    (this.onresult as (e: unknown) => void)({ resultIndex: at, results: list });
  }
  fail(error: string) {
    (this.onerror as (e: unknown) => void)({ error });
  }
  finish() {
    this.running = false;
    (this.onend as () => void)();
  }
}
const last = () => FakeRecognition.all.at(-1)!;
const install = (kind: "standard" | "webkit" | "webkit-no-available" | "none") => {
  const g = globalThis as Record<string, unknown>;
  delete g.SpeechRecognition;
  delete g.webkitSpeechRecognition;
  FakeRecognition.available =
    kind === "standard" ? async (o) => (void o, FakeRecognition.availability!) : undefined;
  FakeRecognition.install =
    kind === "standard"
      ? async (o) => {
          FakeRecognition.installs.push(o);
          return FakeRecognition.installed;
        }
      : undefined;
  if (kind === "standard") g.SpeechRecognition = FakeRecognition;
  else if (kind !== "none") g.webkitSpeechRecognition = FakeRecognition;
};

const settle = async () => {
  for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0));
};

/** A fake box: the words committed so far and the words in progress. */
function box(initial = "") {
  const b = {
    done: initial,
    prog: "",
    pressed: false,
    connected: true,
    ends: new Set<() => void>(),
    handle: {
      kind: "comment" as const,
      thread: null,
      text: () => b.done + b.prog,
      focus() {},
      connected: () => b.connected,
      setPressed: (on: boolean) => (b.pressed = on),
      onEnd: (fn: () => void) => (b.ends.add(fn), () => b.ends.delete(fn)),
      dictate: () => ({
        update: (t: string) => (b.prog = t),
        commit: (t: string) => ((b.done += t), (b.prog = "")),
        cancel: () => (b.prog = ""),
      }),
    },
    end: () => [...b.ends].forEach((f) => f()),
  };
  return b;
}

interface Tool {
  id: string;
  label: string;
  icon: readonly string[];
  press(h: unknown): void;
}
async function mount(o: { ephemeral?: boolean; root?: Element } = {}) {
  const log = {
    announced: [] as string[],
    notices: [] as string[],
    panels: [] as { el: Node; label: string }[],
    off: undefined as string | undefined,
  };
  let tool: Tool | undefined;
  let closed = 0;
  let onClose: (() => void) | undefined;
  const host = {
    ephemeral: o.ephemeral ?? true,
    root: o.root ?? document.body,
    off: (reason: string) => void (log.off = reason),
    addStyles: () => () => {},
    addComposerTool: (t: Tool) => ((tool = t), () => (tool = undefined)),
    announce: (t: string) => log.announced.push(t),
    notify: (t: string) => log.notices.push(t),
    openPanel: (el: Node, p: { label: string; onClose?: () => void }) => {
      log.panels.push({ el, label: p.label });
      onClose = p.onClose;
      return {
        close: () => {
          closed++;
          p.onClose?.();
        },
      };
    },
  };
  const addon = createAddon();
  const teardown = (await addon.setup(host as never)) as (() => void) | undefined;
  await settle();
  const panel = () => log.panels.at(-1)?.el as HTMLElement | undefined;
  const click = async (text: string) => {
    const b = [...panel()!.querySelectorAll("button")].find((x) => x.textContent === text)!;
    b.click();
    await settle();
  };
  return {
    log,
    teardown,
    panel,
    click,
    closed: () => closed,
    escape: () => onClose?.(),
    tool: () => tool,
    press: async (b: ReturnType<typeof box>) => {
      tool!.press(b.handle);
      await settle();
    },
    sentence: () => panel()?.querySelector(".voice-p")?.textContent,
  };
}

beforeEach(() => {
  FakeRecognition.all = [];
  FakeRecognition.overlaps = 0;
  FakeRecognition.availability = "available";
  FakeRecognition.installs = [];
  FakeRecognition.installed = true;
  install("standard");
  document.documentElement.lang = "en-US";
});
afterEach(() => {
  vi.useRealTimers();
  indexedDB = new IDBFactory();
});

describe("without an engine", () => {
  it("adds nothing at all", async () => {
    install("none");
    const m = await mount();
    expect(m.tool()).toBeUndefined();
    expect(m.teardown).toBeUndefined();
    expect(m.log.panels).toHaveLength(0);
    expect(m.log.off).toBe("this browser has no speech engine");
  });
});

describe("the consent panel", () => {
  it("is a microphone, not a sparkle, labelled Dictate", async () => {
    const m = await mount();
    expect(m.tool()).toMatchObject({ id: "voice", label: "Dictate" });
    expect(m.tool()!.icon.join("")).toMatch(/^M12 3a3 3 0 0/);
  });

  it("says nothing is sent when the engine can work on this device", async () => {
    const m = await mount();
    await m.press(box());
    expect(m.log.panels[0]!.label).toBe("Dictate");
    expect(m.sentence()).toBe("Your words are worked out on this device. Nothing is sent.");
    expect(FakeRecognition.all).toHaveLength(0);
  });

  it("says a speech pack will be downloaded, then installs it on Start", async () => {
    FakeRecognition.availability = "downloadable";
    const m = await mount();
    await m.press(box());
    expect(m.sentence()).toBe(
      "Your browser will first download a speech pack for English (United States) from Google. Your words stay on this device.",
    );
    await m.click("Start");
    expect(FakeRecognition.installs).toEqual([{ langs: ["en-US"], processLocally: true }]);
    expect(last().processLocally).toBe(true);
  });

  it("says the voice goes to Google or Apple when only the service is possible", async () => {
    FakeRecognition.availability = "unavailable";
    const m = await mount();
    await m.press(box());
    expect(m.sentence()).toMatch(/^Your voice is sent to Google \(in Chrome\) or Apple \(in Safari\)/);
    expect(m.sentence()).toMatch(/Pipeup doesn't keep it\.$/);
    await m.click("Start");
    expect(last().processLocally).toBeUndefined();
  });

  it("always says the same in a browser that cannot say where it listens (Safari)", async () => {
    install("webkit-no-available");
    const m = await mount();
    await m.press(box());
    expect(m.sentence()).toMatch(/^Your voice is sent to Google \(in Chrome\) or Apple \(in Safari\)/);
  });

  it("starts nothing on Not now, and asks again next time", async () => {
    const m = await mount();
    const b = box();
    await m.press(b);
    await m.click("Not now");
    expect(FakeRecognition.all).toHaveLength(0);
    expect(m.closed()).toBe(1);
    await m.press(b);
    expect(m.log.panels).toHaveLength(2);
  });

  it("closing the panel (Escape) counts as Not now", async () => {
    const m = await mount();
    await m.press(box());
    m.escape();
    await settle();
    expect(FakeRecognition.all).toHaveLength(0);
  });

  it("tells a reviewer when the choice will not last", async () => {
    const m = await mount({ ephemeral: true });
    await m.press(box());
    expect(m.panel()!.textContent).toContain("This browser won't remember this choice.");
  });

  it("does not say so where settings last", async () => {
    const m = await mount({ ephemeral: false });
    await m.press(box());
    expect(m.panel()!.textContent).not.toContain("won't remember");
  });

  it("keeps the choice: the second press skips the panel, and so does a new page load", async () => {
    const m = await mount({ ephemeral: false });
    const b = box();
    await m.press(b);
    await m.click("Start");
    last().begin();
    await m.press(b); // stops
    last().finish();
    await m.press(b);
    expect(m.log.panels).toHaveLength(1);
    expect(FakeRecognition.all).toHaveLength(2);
    last().finish();
    const again = await mount({ ephemeral: false });
    await again.press(box());
    expect(again.log.panels).toHaveLength(0);
    expect(FakeRecognition.all).toHaveLength(3);
  });

  it("asks again when the browser's engine is not the one that was agreed to", async () => {
    const m = await mount({ ephemeral: false });
    await m.press(box());
    await m.click("Start");
    last().finish();
    install("webkit-no-available");
    const other = await mount({ ephemeral: false });
    await other.press(box());
    expect(other.log.panels).toHaveLength(1);
  });

  it("asks again when the voice would now go to a service but the choice was on-device", async () => {
    const m = await mount({ ephemeral: false });
    await m.press(box());
    await m.click("Start");
    last().finish();
    FakeRecognition.availability = "unavailable";
    const later = await mount({ ephemeral: false });
    await later.press(box());
    expect(later.log.panels).toHaveLength(1);
  });
});

describe("dictating", () => {
  const started = async (initial = "", opts: Parameters<typeof mount>[0] = {}) => {
    const m = await mount(opts);
    const b = box(initial);
    await m.press(b);
    await m.click("Start");
    return { m, b, rec: last() };
  };

  it("sets the engine up for dictation and shows the pressed state", async () => {
    const { m, b, rec } = await started();
    expect(rec).toMatchObject({
      lang: "en-US",
      interimResults: true,
      continuous: true,
      processLocally: true,
    });
    expect(b.pressed).toBe(true);
    rec.begin();
    expect(m.log.announced).toEqual(["Listening"]);
  });

  it("sends words in progress to update and final words to commit", async () => {
    const { b, rec } = await started();
    rec.begin();
    rec.say([{ t: "the second" }]);
    expect(b.prog).toBe("the second");
    rec.say([{ t: "the second chart" }]);
    expect(b.prog).toBe("the second chart");
    rec.say([{ t: "the second chart needs", final: true }]);
    expect(b.done).toBe("the second chart needs");
    expect(b.prog).toBe("");
    rec.say([{ t: "the second chart needs", final: true }, { t: "a clearer" }], 1);
    expect(b.prog).toBe(" a clearer");
    rec.say(
      [
        { t: "the second chart needs", final: true },
        { t: " a clearer label", final: true },
      ],
      1,
    );
    expect(b.done).toBe("the second chart needs a clearer label");
  });

  it("starts after words that are already in the box with a space", async () => {
    const { b, rec } = await started("Looks good");
    rec.begin();
    rec.say([{ t: "but check it", final: true }]);
    expect(b.done).toBe("Looks good but check it");
  });

  it("keeps words still in progress when it stops on its own", async () => {
    const { b, rec } = await started();
    rec.begin();
    rec.say([{ t: "almost done" }]);
    rec.finish();
    expect(b.done).toBe("almost done");
    expect(b.pressed).toBe(false);
  });

  it("stops on a second press, keeps the final words and announces it", async () => {
    const { m, b, rec } = await started();
    rec.begin();
    await m.press(b);
    expect(rec.calls).toEqual(["start", "stop"]);
    expect(FakeRecognition.all).toHaveLength(1);
    rec.say([{ t: "last words", final: true }]); // the engine's closing result
    rec.finish();
    expect(b.done).toBe("last words");
    expect(b.pressed).toBe(false);
    expect(m.log.announced).toEqual(["Listening", "Stopped listening"]);
  });

  it("stops after 60 seconds without speech, and speech keeps it going", async () => {
    const { m, rec } = await (async () => {
      const m = await mount();
      vi.useFakeTimers();
      const b = box();
      m.tool()!.press(b.handle);
      await vi.advanceTimersByTimeAsync(10);
      const start = [...m.panel()!.querySelectorAll("button")].find((x) => x.textContent === "Start")!;
      start.click();
      await vi.advanceTimersByTimeAsync(10);
      return { m, rec: last() };
    })();
    rec.begin();
    await vi.advanceTimersByTimeAsync(59_000);
    expect(rec.calls).toEqual(["start"]);
    rec.say([{ t: "still here" }]);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(rec.calls).toEqual(["start"]);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(rec.calls).toEqual(["start", "stop"]);
    rec.finish();
    expect(m.log.announced).toEqual(["Listening", "Stopped listening"]);
  });

  it("drops the words and aborts when the box is sent, cancelled or cleared", async () => {
    const { b, rec } = await started();
    rec.begin();
    rec.say([{ t: "never mind" }]);
    b.end();
    expect(rec.calls).toEqual(["start", "abort"]);
    expect(b.prog).toBe("");
    rec.say([{ t: "late words", final: true }]);
    rec.finish();
    expect(b.done).toBe("");
  });

  it("stops when the box is no longer on screen (checked every 500 ms)", async () => {
    const m = await mount();
    vi.useFakeTimers();
    const b = box();
    m.tool()!.press(b.handle);
    await vi.advanceTimersByTimeAsync(10);
    [...m.panel()!.querySelectorAll("button")].find((x) => x.textContent === "Start")!.click();
    await vi.advanceTimersByTimeAsync(10);
    const rec = last();
    rec.begin();
    b.connected = false;
    await vi.advanceTimersByTimeAsync(600);
    expect(rec.calls).toEqual(["start", "abort"]);
  });

  it("never starts straight after an abort: it waits for the old one to end", async () => {
    const { m, b, rec } = await started();
    rec.begin();
    b.end(); // abort
    const next = box();
    await m.press(next); // the old one has not ended yet
    expect(FakeRecognition.all).toHaveLength(1);
    expect(next.pressed).toBe(false);
    rec.finish();
    await m.press(next);
    expect(FakeRecognition.all).toHaveLength(2);
    expect(FakeRecognition.overlaps).toBe(0);
    expect(last().running).toBe(true);
  });

  it("a press in another box while listening only stops, it never starts a second recognition", async () => {
    const { m, rec } = await started();
    rec.begin();
    await m.press(box());
    expect(FakeRecognition.all).toHaveLength(1);
    expect(rec.calls).toEqual(["start", "stop"]);
    expect(FakeRecognition.overlaps).toBe(0);
  });

  it("says in words what went wrong", async () => {
    const cases: [string, RegExp][] = [
      ["not-allowed", /microphone is blocked/],
      ["no-speech", /Didn't hear anything/],
      ["network", /speech service couldn't be reached/],
      ["audio-capture", /No microphone was found/],
      ["aborted", /Dictation stopped\./],
    ];
    for (const [error, words] of cases) {
      const { m, rec } = await started();
      rec.begin();
      rec.fail(error);
      rec.finish();
      expect(m.log.notices.at(-1)).toMatch(words);
      FakeRecognition.all = [];
    }
  });

  it("is quiet about an abort it asked for", async () => {
    const { m, b, rec } = await started();
    rec.begin();
    b.end();
    rec.fail("aborted");
    rec.finish();
    expect(m.log.notices).toEqual([]);
  });

  it("tears down: stops a recognition and ends with the tool removed", async () => {
    const { m, rec } = await started();
    rec.begin();
    (m.teardown as () => void)();
    expect(rec.calls).toEqual(["start", "abort"]);
    expect(m.tool()).toBeUndefined();
  });
});

describe("language", () => {
  const lang = (m: Awaited<ReturnType<typeof mount>>) =>
    (m.panel()!.querySelector("select") as HTMLSelectElement).value;

  it("uses the nearest lang above the commenting area", async () => {
    document.body.innerHTML = '<main lang="es-ES"><section id="r"><p>Hola</p></section></main>';
    const m = await mount({ root: document.getElementById("r")! });
    await m.press(box());
    expect(lang(m)).toBe("es-ES");
    await m.click("Start");
    expect(last().lang).toBe("es-ES");
    document.body.innerHTML = "";
  });

  it("falls back to the page's lang, then the browser's", async () => {
    const m = await mount();
    await m.press(box());
    expect(lang(m)).toBe("en-US");
    document.documentElement.lang = "";
    const n = await mount();
    await n.press(box());
    expect(lang(n)).toBe(navigator.language);
  });

  it("offers a change, shows the new answer, and keeps the choice", async () => {
    FakeRecognition.availability = "available";
    const m = await mount({ ephemeral: false });
    await m.press(box());
    const sel = m.panel()!.querySelector("select") as HTMLSelectElement;
    FakeRecognition.availability = "downloadable";
    sel.value = "fr-FR";
    sel.dispatchEvent(new Event("change"));
    await settle();
    expect(m.sentence()).toContain("speech pack for French (France)");
    await m.click("Start");
    expect(last().lang).toBe("fr-FR");
    last().finish();
    FakeRecognition.availability = "available";
    const again = await mount({ ephemeral: false });
    await again.press(box());
    expect(FakeRecognition.all.at(-1)!.lang).toBe("fr-FR");
    expect(again.log.panels).toHaveLength(0);
  });
});
