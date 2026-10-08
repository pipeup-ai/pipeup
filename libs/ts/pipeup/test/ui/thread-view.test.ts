// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { ANIMALS, animalName, animalOf, colourOf } from "../../src/model/animals";
import { ANIMAL_ICONS, avatar, initial } from "../../src/ui/animals";
import { composer } from "../../src/ui/composer";
import { renderDraft } from "../../src/ui/draft-view";
import { threadView, type ThreadActions } from "../../src/ui/thread-view";
import type { Comment, Thread } from "../../src/model/types";

const NOW = 1_000_000_000_000;
const PLANE = "M21 12L3.5 4.5 6.2 12l-2.7 7.5zM6.2 12H13";
const c = (
  id: string,
  name: string,
  text: string,
  replies: Comment[] = [],
  extra: Partial<Comment> = {},
): Comment => ({
  id,
  author: name,
  name,
  text,
  at: NOW - 5 * 60_000,
  edited: false,
  deleted: false,
  replies,
  ...extra,
});
const thread = (over: Partial<Thread> = {}): Thread => ({
  id: "t1",
  resolved: false,
  anchor: { path: "", fingerprint: "00000000", snapshot: "s" },
  root: c("t1", "Jamie", "Is 20% realistic?", [
    c("r1", "Sam", "Fair point"),
    c("n1", "Jamie", "Thanks"),
    c("r2", "Amy", "+1"),
  ]),
  ...over,
});
const actions = (): ThreadActions & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    reply: vi.fn(async (p: string, t: string) => void calls.push(`reply ${p} ${t}`)),
    resolve: vi.fn(async (id: string) => void calls.push(`resolve ${id}`)),
    reopen: vi.fn(async (id: string) => void calls.push(`reopen ${id}`)),
    copy: vi.fn((id: string) => void calls.push(`copy ${id}`)),
    close: vi.fn(),
  };
};
const key = (el: Element, k: string, shift = false) =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, shiftKey: shift, bubbles: true }));

describe("composer", () => {
  it("sends trimmed text on Enter, keeps Shift+Enter, cancels on Escape, shows the arrow only with text", async () => {
    const onSend = vi.fn(async () => {});
    const onCancel = vi.fn();
    const comp = composer({ label: "Reply", onSend, onCancel });
    const send = comp.element.querySelector(".send")!;
    expect(comp.input.getAttribute("placeholder")).toBeNull();
    expect(send.classList.contains("show")).toBe(false);
    comp.input.value = "  hello  ";
    comp.input.dispatchEvent(new Event("input"));
    expect(send.classList.contains("show")).toBe(true);
    key(comp.input, "Enter", true);
    expect(onSend).not.toHaveBeenCalled();
    key(comp.input, "Enter");
    await vi.waitFor(() => expect(onSend).toHaveBeenCalledWith("hello"));
    await vi.waitFor(() => expect(comp.input.value).toBe(""));
    comp.input.value = "draft";
    key(comp.input, "Escape");
    expect(onCancel).toHaveBeenCalled();
    expect(comp.input.value).toBe("");
  });

  it("sends with a paper plane pointing right, not an arrow", () => {
    const send = composer({ label: "Reply", onSend: vi.fn() }).element.querySelector(".send")!;
    expect([...send.querySelectorAll("path")].map((p) => p.getAttribute("d"))).toEqual([PLANE]);
  });

  it("keeps the text when sending fails", async () => {
    const comp = composer({
      label: "Reply",
      onSend: async () => {
        throw new Error("nope");
      },
    });
    comp.input.value = "keep me";
    key(comp.input, "Enter");
    await new Promise((r) => setTimeout(r, 0));
    expect(comp.input.value).toBe("keep me");
  });
});

describe("threadView", () => {
  it("shows the words, a reply count, replies one level in, one reply line and the thread's actions", () => {
    const el = threadView(thread(), actions(), { variant: "column", now: () => NOW }).element;
    expect(el.dataset.thread).toBe("t1");
    expect(el.querySelector(".root .tx")!.textContent).toBe("Is 20% realistic?");
    expect(el.querySelector(".root .rest")!.textContent).toBe("3 replies");
    expect(el.querySelector(".root .who")!.textContent).toBe("Jamie · 5m ago");
    expect([...el.querySelectorAll(".rps .it .tx")].map((x) => x.textContent)).toEqual([
      "Fair point",
      "Thanks",
      "+1",
    ]);
    expect(el.querySelectorAll(".rbox")).toHaveLength(1);
    expect(el.querySelectorAll(".rbox.always")).toHaveLength(1);
    expect(el.querySelector('.ib[aria-label="Reply"]')).toBeNull();
    const labels = [...el.querySelectorAll(".root .acts .ib")].map((b) => b.getAttribute("aria-label"));
    expect(labels).toEqual(["Copy thread", "Resolve"]);
  });

  it("renders text as text, never HTML", () => {
    const hostile = "<img src=x onerror=alert(1)>";
    const t = thread({
      root: c("t1", hostile, "<b>bold</b>", [c("r1", hostile, "Fair point")]),
    });
    const el = threadView(t, actions(), {
      variant: "popover",
      quote: hostile,
      lost: hostile,
      now: () => NOW,
    }).element;
    expect(el.querySelector("img, b")).toBeNull();
    expect(el.querySelector(".root .tx")!.textContent).toBe("<b>bold</b>");
    expect(el.querySelector(".ctx")!.textContent).toContain(hostile);
    expect(el.querySelectorAll(".rps .tx")[0]!.textContent).toBe("Fair point");
    const d = renderDraft({
      label: hostile,
      me: ME,
      name: () => hostile,
      rename: vi.fn(),
      onSend: vi.fn(),
      onCancel: () => {},
    });
    expect(d.element.querySelector("img")).toBeNull();
    expect(d.element.querySelector(".ctx")!.textContent).toBe(hostile);
    expect(d.element.querySelector(".say")!.textContent).toBe(`${hostile} · change`);
  });

  it("wires actions: copy, resolve and replying to the thread", async () => {
    const a = actions();
    const el = threadView(thread(), a, { variant: "popover", now: () => NOW }).element;
    (el.querySelector('[aria-label="Copy thread"]') as HTMLElement).click();
    (el.querySelector('[aria-label="Resolve"]') as HTMLElement).click();
    const line = el.querySelector(".rbox.always textarea") as HTMLTextAreaElement;
    line.value = "to the thread";
    key(line, "Enter");
    await vi.waitFor(() => expect(a.calls).toEqual(["copy t1", "resolve t1", "reply t1 to the thread"]));
  });

  it("shows resolved threads with Reopen and no reply line; deleted comments as Deleted", () => {
    const t = thread({ resolved: true, root: c("t1", "Jamie", "", [], { deleted: true }) });
    const el = threadView(t, actions(), { variant: "popover", now: () => NOW }).element;
    expect(el.classList.contains("resolved")).toBe(true);
    expect(el.querySelector('[aria-label="Reopen"]')).not.toBeNull();
    expect(el.querySelector(".rbox.always")).toBeNull();
    expect(el.querySelector(".root .tx")!.textContent).toBe("Deleted");
  });

  it("shows the quote and lost-content context lines", () => {
    const el = threadView(thread(), actions(), {
      variant: "popover",
      quote: "20% lift",
      lost: null,
      now: () => NOW,
    }).element;
    expect(el.querySelector(".ctx")!.textContent).toBe(`“20% lift”`);
    const lost = threadView(thread(), actions(), {
      variant: "column",
      lost: "old words",
      now: () => NOW,
    }).element;
    expect(lost.querySelector(".ctx")!.textContent).toBe(`No longer on the page — it read “old words”`);
  });

  it("says where content it can't show lives, when it isn't gone", () => {
    const view = threadView(thread(), actions(), {
      variant: "popover",
      lost: "old words",
      place: "On slide 3",
      now: () => NOW,
    });
    expect(view.element.querySelector(".ctx")!.textContent).toBe(`On slide 3 — it read “old words”`);
    view.update(thread(), { lost: "old words", place: null });
    expect(view.element.querySelector(".ctx")!.textContent).toBe(
      `No longer on the page — it read “old words”`,
    );
  });

  it("updates for a newer copy of the thread and keeps the reply line, with its words", () => {
    const view = threadView(thread(), actions(), { variant: "column", now: () => NOW });
    const line = view.element.querySelector(".rbox.always textarea") as HTMLTextAreaElement;
    line.value = "half typed";
    const newer = thread({
      root: c("t1", "Jamie", "Is 20% realistic? (edited)", [
        c("r1", "Sam", "Fair point"),
        c("r9", "Ben", "New"),
      ]),
    });
    view.update(newer);
    expect(view.element.querySelector(".root .tx")!.textContent).toBe("Is 20% realistic? (edited)");
    expect([...view.element.querySelectorAll(".rps .tx")].map((x) => x.textContent)).toEqual([
      "Fair point",
      "New",
    ]);
    expect(view.element.querySelector(".rbox.always textarea")).toBe(line);
    expect(line.value).toBe("half typed");
    // Resolved by someone meanwhile: the half-typed words keep their line, and a sentence says why.
    view.update({ ...newer, resolved: true });
    expect(view.element.classList.contains("resolved")).toBe(true);
    expect(view.element.querySelector(".rbox.always textarea")).toBe(line);
    expect(line.value).toBe("half typed");
    expect((view.element.querySelector(".rbox .ctx") as HTMLElement).hidden).toBe(false);
    // Once the words are gone, a resolved thread has no reply line.
    line.value = "";
    view.update({ ...newer, resolved: true });
    expect(view.element.querySelector(".rbox.always")).toBeNull();
    line.value = "half typed";
    view.update(newer);
    expect((view.element.querySelector(".rbox .ctx") as HTMLElement).hidden).toBe(true);
    expect(view.element.querySelector(".rbox.always textarea")).toBe(line);
  });
});

/** A draft for someone with the given name ("" for none), recording renames. */
const draft = (name = "", onSend = vi.fn(async (_text: string) => {})) => {
  const me = { name, renamed: [] as string[] };
  const d = renderDraft({
    label: `“20% lift”`,
    me: ME,
    name: () => me.name,
    rename: vi.fn(async (n: string) => {
      me.renamed.push(n);
      me.name = n;
    }),
    onSend,
    onCancel: () => {},
  });
  document.body.append(d.element);
  return { d, me, onSend };
};
const ME = "M".repeat(43);
const shadowless = (el: Element) => el.getRootNode() as Document;

describe("renderDraft", () => {
  it("never asks for a name: the comment line sends straight away", async () => {
    const { d, onSend } = draft();
    const isInert = (el: Element | null): boolean =>
      !!el && ((el as HTMLElement).inert || isInert(el.parentElement));
    const reachable = [...d.element.querySelectorAll("textarea")].filter((t) => !isInert(t));
    expect(reachable.map((t) => t.getAttribute("aria-label"))).toEqual(["Comment"]);
    expect(isInert(d.element.querySelector(".nf input"))).toBe(true);
    expect((d.element.querySelector(".nf") as HTMLElement).inert).toBe(true);
    const text = d.element.querySelector(".row textarea") as HTMLTextAreaElement;
    expect(d.isEmpty()).toBe(true);
    text.value = "Needs a baseline";
    key(text, "Enter");
    await vi.waitFor(() => expect(onSend).toHaveBeenCalledWith("Needs a baseline"));
  });

  it("shows your avatar and who you are, with an invitation to add a name", () => {
    const { d } = draft();
    const animal = animalName(ME);
    expect(d.element.querySelector(".say")!.textContent).toBe(`You're ${animal} · add your name`);
    const face = d.element.querySelector(".row .me .av")!;
    expect(face.getAttribute("data-animal")).toBe(animal);
    expect(face.classList.contains(`c${colourOf(ME)}`)).toBe(true);
    expect(face.querySelector("path")!.getAttribute("d")).toBe(ANIMAL_ICONS[ANIMALS[animalOf(ME)]!]);
    const named = draft("Sam").d;
    expect(named.element.querySelector(".say")!.textContent).toBe("Sam · change");
    expect(named.element.querySelector(".row .me .av")!.textContent).toBe("S");
  });

  it("takes the name on one line, and a click on the avatar never focuses it", () => {
    const { d } = draft();
    expect(d.element.querySelector(".nf input")).not.toBeNull();
    expect(d.element.querySelector(".nf textarea")).toBeNull();
    const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    d.element.querySelector(".row .me")!.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
  });

  it("opens a name field in place, focused at once; Enter saves, Escape cancels", async () => {
    const { d, me } = draft();
    const nf = d.element.querySelector(".nf") as HTMLElement;
    const field = nf.querySelector("input")!;
    (d.element.querySelector(".say button") as HTMLElement).click();
    expect(nf.inert).toBe(false);
    expect((d.element.querySelector(".say") as HTMLElement).inert).toBe(true);
    expect(shadowless(field).activeElement).toBe(field);
    field.value = "Someone";
    key(field, "Escape");
    expect(nf.inert).toBe(true);
    expect(me.renamed).toEqual([]);

    (d.element.querySelector(".row .me") as HTMLElement).click();
    expect(shadowless(field).activeElement).toBe(field);
    field.value = "  Sam ";
    key(field, "Enter");
    await vi.waitFor(() => expect(me.renamed).toEqual(["Sam"]));
    await vi.waitFor(() => expect(nf.inert).toBe(true));
    expect(d.element.querySelector(".say")!.textContent).toBe("Sam · change");
    // The new face eases in over the old one, which leaves once covered.
    const faces = [...d.element.querySelectorAll(".row .me .av")];
    expect(faces.map((f) => f.textContent)).toEqual(["", "S"]);
    expect(shadowless(field).activeElement).toBe(d.element.querySelector(".row textarea"));
  });
});

describe("initial", () => {
  it("is the first letter or digit, upper-cased the same in every locale, one character", () => {
    expect(initial("sam")).toBe("S");
    expect(initial("ßtraße")).toBe("ß");
    expect(initial("istanbul")).toBe("I");
    expect(initial("ıtır")).toBe("I");
    expect(initial("🦊 fox")).toBe("F");
    expect(initial("𝒜da")).toBe("𝒜");
    expect(initial("𐐨ee")).toBe("𐐀");
    expect(initial("7 dwarfs")).toBe("7");
    expect(initial("🦊🦊")).toBe("");
  });
});

describe("avatar", () => {
  it("draws the writer's animal in their colour, or their initial in the same colour once they have a name", () => {
    const a = avatar(ME, "");
    const animal = animalName(ME);
    expect(a.getAttribute("data-animal")).toBe(animal);
    expect(a.className).toBe(`av c${colourOf(ME)}`);
    expect(a.querySelector("path")!.getAttribute("d")).toBe(ANIMAL_ICONS[ANIMALS[animalOf(ME)]!]);
    expect(a.textContent).toBe("");
    const k = avatar(ME, "sam");
    expect(k.textContent).toBe("S");
    expect(k.className).toBe(a.className);
    expect(k.querySelector("svg")).toBeNull();
    // A name with no letter or digit to show keeps the animal.
    expect(avatar(ME, "🦊🦊").querySelector("path")).not.toBeNull();
  });

  it("has a drawing for each of the five animals, and never an emoji", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    expect(Object.keys(ANIMAL_ICONS).sort()).toEqual([...ANIMALS].sort());
    for (const animal of ANIMALS) {
      const d = ANIMAL_ICONS[animal];
      expect(d).toMatch(/^M[-\d. MLHVCSQTAZmlhvcsqtaz]+$/);
      expect(d.length).toBeLessThan(400);
    }
    for (let i = 0; i < 200; i++) {
      const a = avatar(String(i).padStart(43, "x"), i % 2 ? "" : "🦊🦊");
      expect(emoji.test(a.outerHTML)).toBe(false);
    }
  });
});

describe("threadView avatars", () => {
  it("puts each comment's avatar in it, and names writers with no name by their animal", () => {
    const anon = (id: string, author: string) => ({ ...c(id, "", "words"), author });
    const t = thread({
      root: { ...anon("t1", ME), replies: [anon("r1", "Z".repeat(43)), c("r2", "Sam", "Hi")] },
    });
    const el = threadView(t, actions(), { variant: "column", now: () => NOW }).element;
    const root = el.querySelector(".root")!;
    expect(root.querySelector(":scope > .av")!.getAttribute("data-animal")).toBe(animalName(ME));
    expect(root.querySelector(".who")!.textContent).toBe(`${animalName(ME)} · 5m ago`);
    const items = [...el.querySelectorAll(".rps .it")];
    expect(items.map((it) => it.querySelector(":scope > .av")!.textContent)).toEqual(["", "S"]);
    expect(items[0]!.querySelector(".who")!.textContent).toBe(`${animalName("Z".repeat(43))} · 5m ago`);
  });

  it("keeps an avatar across updates, and swaps it when the writer adds a name", () => {
    const anon = { ...c("t1", "", "words"), author: ME };
    const view = threadView(thread({ root: anon }), actions(), { variant: "column", now: () => NOW });
    const first = view.element.querySelector(".root > .av");
    view.update(thread({ root: { ...anon, text: "more words" } }));
    expect(view.element.querySelector(".root > .av")).toBe(first);
    view.update(thread({ root: { ...anon, name: "Sam" } }));
    // The new face eases in over the old one, which stays beneath it until it is covered.
    const both = [...view.element.querySelectorAll(".root > .av")];
    expect(both[0]).toBe(first);
    const named = both[1]!;
    expect(named.textContent).toBe("S");
    view.update(thread({ root: { ...anon, name: "Sam", text: "again" } }));
    expect([...view.element.querySelectorAll(".root > .av")].at(-1)).toBe(named);
    expect(view.element.querySelector(".root .who")!.textContent).toBe("Sam · 5m ago");
  });
});
