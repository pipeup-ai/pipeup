// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { ANIMALS, animalName, animalOf, colourOf } from "../../src/model/animals";
import { ANIMAL_ICONS, avatar, initial } from "../../src/ui/animals";
import { composer, setComposerSource, SOURCE_CHANGED } from "../../src/ui/composer";
import { renderDraft } from "../../src/ui/draft-view";
import { threadView, type ThreadActions } from "../../src/ui/thread-view";
import { commentMarks, notesKey, threadMarks, threadNotes } from "../../src/ui/notes";
import type { Comment, Thread } from "../../src/model/types";

const NOW = 1_000_000_000_000;
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
  reactions: [],
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
    me: "me",
    picker: () => null,
    people: () => [],
    react: vi.fn(
      async (id: string, e: string, on: boolean) => void calls.push(`${on ? "react" : "unreact"} ${id} ${e}`),
    ),
    reply: vi.fn(async (p: string, t: string) => void calls.push(`reply ${p} ${t}`)),
    resolve: vi.fn(async (id: string) => void calls.push(`resolve ${id}`)),
    reopen: vi.fn(async (id: string) => void calls.push(`reopen ${id}`)),
    notRight: vi.fn(async (id: string) => void calls.push(`notRight ${id}`)),
    copy: vi.fn((id: string) => void calls.push(`copy ${id}`)),
    edit: vi.fn(async (id: string, t: string) => void calls.push(`edit ${id} ${t}`)),
    remove: vi.fn(async (id: string) => void calls.push(`remove ${id}`)),
    drop: vi.fn(),
    close: vi.fn(),
  };
};
const key = (el: Element, k: string, shift = false) =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, shiftKey: shift, bubbles: true }));

describe("composer", () => {
  it("sends trimmed text on Enter, keeps Shift+Enter, cancels on Escape, and Reply is ready only with text", async () => {
    const onSend = vi.fn(async () => {});
    const onCancel = vi.fn();
    const comp = composer({ label: "Reply", placeholder: "Reply or add others with @", onSend, onCancel });
    const send = comp.element.querySelector(".send")!;
    expect(comp.input.getAttribute("placeholder")).toBe("Reply or add others with @");
    expect(send.classList.contains("show")).toBe(false);
    comp.input.value = "  hello  ";
    comp.input.dispatchEvent(new Event("input"));
    expect(send.classList.contains("show")).toBe(true);
    key(comp.input, "Enter", true);
    expect(onSend).not.toHaveBeenCalled();
    key(comp.input, "Enter");
    await vi.waitFor(() => expect(onSend).toHaveBeenCalledWith("hello", []));
    await vi.waitFor(() => expect(comp.input.value).toBe(""));
    comp.input.value = "draft";
    key(comp.input, "Escape");
    expect(onCancel).toHaveBeenCalled();
    expect(comp.input.value).toBe("");
  });

  it("names its send button for what it does, and Cancel ends it as Esc does", () => {
    const onSend = vi.fn();
    const onCancel = vi.fn();
    const el = composer({ label: "Reply", onSend, onCancel }).element;
    expect(el.querySelector(".send")!.textContent).toBe("Reply");
    (el.querySelector(".cnl") as HTMLElement).click();
    expect(onCancel).toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
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
  it("offers Edit and Delete from ⋯ on your own comments only; Edit saves new words, Delete asks once more", async () => {
    const a = actions();
    const mine = thread({ root: c("t1", "me", "My words", [c("r1", "Sam", "Not mine")]) });
    const view = threadView(mine, a, { variant: "popover", now: () => NOW });
    const el = view.element;
    const choices = () => [...el.querySelectorAll(".pm button")].map((b) => b.textContent);
    const choose = (word: string) =>
      ([...el.querySelectorAll(".pm button")].find((b) => b.textContent === word) as HTMLElement).click();
    // A reply someone else wrote has no ⋯ at all.
    expect(el.querySelector('.it [aria-label="More"]')).toBeNull();
    (el.querySelector('.root [aria-label="More"]') as HTMLElement).click();
    expect(choices()).toEqual(["Copy thread", "Edit", "Delete"]);
    choose("Delete");
    expect(choices()).toEqual(["Copy thread", "Edit", "Delete for everyone"]);
    // At once (the second click of a double-click), the question ignores it; a moment later, it deletes.
    choose("Delete for everyone");
    expect(choices()).toEqual(["Copy thread", "Edit", "Delete for everyone"]);
    expect(a.calls).toEqual([]);
    const now = vi.spyOn(performance, "now").mockReturnValue(performance.now() + 600);
    choose("Delete for everyone");
    now.mockRestore();
    await vi.waitFor(() => expect(a.calls).toEqual(["remove t1"]));
    expect(el.querySelector(".pm")).toBeNull();
    // Edit puts the words back in a box; Save changes them.
    (el.querySelector('.root [aria-label="More"]') as HTMLElement).click();
    choose("Edit");
    const box = el.querySelector(".root .edit textarea") as HTMLTextAreaElement;
    expect(box.value).toBe("My words");
    expect(el.querySelector(".root .edit .send")!.textContent).toBe("Save");
    box.value = "Better words";
    key(box, "Enter");
    await vi.waitFor(() => expect(a.calls).toEqual(["remove t1", "edit t1 Better words"]));
    await vi.waitFor(() => expect(el.querySelector(".root .edit")).toBeNull());
  });

  it("shows who and how long ago, the words, a reply count, replies one level in, one reply box and the actions", () => {
    const el = threadView(thread(), actions(), { variant: "column", now: () => NOW }).element;
    expect(el.dataset.thread).toBe("t1");
    expect(el.querySelector(".root .tx")!.textContent).toBe("Is 20% realistic?");
    expect(el.querySelector(".root .rest")!.textContent).toBe("3 replies");
    expect(el.querySelector(".root .who")!.textContent).toBe("Jamie");
    expect(el.querySelector(".root .ago")!.textContent).toBe("5m ago");
    expect([...el.querySelectorAll(".rps .it .tx")].map((x) => x.textContent)).toEqual([
      "Fair point",
      "Thanks",
      "+1",
    ]);
    expect(el.querySelectorAll(".rbox")).toHaveLength(1);
    expect(el.querySelectorAll(".rbox.always")).toHaveLength(1);
    expect(el.querySelector('.ib[aria-label="Reply"]')).toBeNull();
    const labels = [...el.querySelectorAll(".root .acts .ib")].map((b) => b.getAttribute("aria-label"));
    expect(labels).toEqual(["React", "Resolve", "More"]);
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
    (el.querySelector('.root [aria-label="More"]') as HTMLElement).click();
    (
      [...el.querySelectorAll(".pm button")].find((b) => b.textContent === "Copy thread") as HTMLElement
    ).click();
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
    expect((view.element.querySelector(".rbox .note") as HTMLElement).hidden).toBe(false);
    // Once the words are gone, a resolved thread has no reply line.
    line.value = "";
    view.update({ ...newer, resolved: true });
    expect(view.element.querySelector(".rbox.always")).toBeNull();
    line.value = "half typed";
    view.update(newer);
    expect((view.element.querySelector(".rbox .note") as HTMLElement).hidden).toBe(true);
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
    await vi.waitFor(() => expect(onSend).toHaveBeenCalledWith("Needs a baseline", []));
  });

  it("carries a glyph saying comments stay in this browser, until an add-on reports or shows a line", () => {
    const { d } = draft();
    const here = d.element.querySelector(".bts .here") as HTMLElement;
    expect(here.nextElementSibling?.textContent).toBe("Cancel");
    const note = d.element.querySelector(".note") as HTMLElement;
    const shown = () => !here.classList.contains("off") && here.getAttribute("aria-hidden") === "false";
    expect(shown()).toBe(true);
    expect(here.getAttribute("aria-label")).toBe("Comments stay in this browser until you send them.");
    expect(here.title).toBe("Comments stay in this browser until you send them.");
    expect(here.querySelector("svg")).not.toBeNull();
    expect(note.hidden).toBe(true);
    const change = () =>
      d.element.querySelector(".row")!.dispatchEvent(new Event(SOURCE_CHANGED, { bubbles: true }));
    setComposerSource({
      tools: () => [],
      note: () => "Comments here are shared with everyone who has this page.",
      reporting: () => true,
    });
    change();
    expect(shown()).toBe(false);
    expect(note.textContent).toBe("Comments here are shared with everyone who has this page.");
    // An add-on that reports in the menu (Share after the first shared comment) takes the glyph away without a line.
    setComposerSource({ tools: () => [], note: () => null, reporting: () => true });
    change();
    expect(shown()).toBe(false);
    expect(note.hidden).toBe(true);
    setComposerSource(null);
    change();
    expect(shown()).toBe(true);
    expect(note.hidden).toBe(true);
  });

  it("shows your avatar and who you are, with an invitation to add a name", () => {
    const { d } = draft();
    const animal = animalName(ME);
    expect(d.element.querySelector(".say")!.textContent).toBe(`You're ${animal} · add your name`);
    const face = d.element.querySelector(".hdr .me .av")!;
    expect(face.getAttribute("data-animal")).toBe(animal);
    expect(face.classList.contains(`c${colourOf(ME)}`)).toBe(true);
    expect(face.querySelector("path")!.getAttribute("d")).toBe(ANIMAL_ICONS[ANIMALS[animalOf(ME)]!]);
    const named = draft("Sam").d;
    expect(named.element.querySelector(".say")!.textContent).toBe("Sam · change");
    expect(named.element.querySelector(".hdr .me .av")!.textContent).toBe("S");
  });

  it("takes the name on one line, and a click on the avatar never focuses it", () => {
    const { d } = draft();
    expect(d.element.querySelector(".nf input")).not.toBeNull();
    expect(d.element.querySelector(".nf textarea")).toBeNull();
    const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    d.element.querySelector(".hdr .me")!.dispatchEvent(down);
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

    (d.element.querySelector(".hdr .me") as HTMLElement).click();
    expect(shadowless(field).activeElement).toBe(field);
    field.value = "  Sam ";
    key(field, "Enter");
    await vi.waitFor(() => expect(me.renamed).toEqual(["Sam"]));
    await vi.waitFor(() => expect(nf.inert).toBe(true));
    expect(d.element.querySelector(".say")!.textContent).toBe("Sam · change");
    // The new face eases in over the old one, which leaves once covered.
    const faces = [...d.element.querySelectorAll(".hdr .me .av")];
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
    expect(root.querySelector(".hdr > .av")!.getAttribute("data-animal")).toBe(animalName(ME));
    expect(root.querySelector(".who")!.textContent).toBe(animalName(ME));
    const items = [...el.querySelectorAll(".rps .it")];
    expect(items.map((it) => it.querySelector(".hdr > .av")!.textContent)).toEqual(["", "S"]);
    expect(items[0]!.querySelector(".who")!.textContent).toBe(animalName("Z".repeat(43)));
  });

  it("keeps an avatar across updates, and swaps it when the writer adds a name", () => {
    const anon = { ...c("t1", "", "words"), author: ME };
    const view = threadView(thread({ root: anon }), actions(), { variant: "column", now: () => NOW });
    const first = view.element.querySelector(".root > .hdr > .av");
    view.update(thread({ root: { ...anon, text: "more words" } }));
    expect(view.element.querySelector(".root > .hdr > .av")).toBe(first);
    view.update(thread({ root: { ...anon, name: "Sam" } }));
    // The new face eases in over the old one, which stays beneath it until it is covered.
    const both = [...view.element.querySelectorAll(".root > .hdr > .av")];
    expect(both[0]).toBe(first);
    const named = both[1]!;
    expect(named.textContent).toBe("S");
    view.update(thread({ root: { ...anon, name: "Sam", text: "again" } }));
    expect([...view.element.querySelectorAll(".root > .hdr > .av")].at(-1)).toBe(named);
    expect(view.element.querySelector(".root .who")!.textContent).toBe("Sam");
  });
});

describe("a comment's mark from an add-on", () => {
  const MARK = { text: "Only in this browser", by: "share" };
  it("is a quiet line under the comment's words, on a root or a reply alone, with why in its tooltip", () => {
    const t = thread({
      root: c("t1", "Sam", "Sure?", [c("r1", "Ada", "Yes."), c("r2", "Sam", "Moving it.")]),
    });
    commentMarks.set("r2", { ...MARK, tip: "Written while Send my comments was off." });
    const view = threadView(t, actions(), { variant: "popover", now: () => NOW });
    expect(view.element.querySelector(".root .cm")).toBeNull();
    const marks = [...view.element.querySelectorAll(".rps .it .cm")] as HTMLElement[];
    expect(marks).toHaveLength(1);
    expect(marks[0]!.textContent).toBe("Only in this browser");
    expect(marks[0]!.title).toBe("Written while Send my comments was off.");
    expect(marks[0]!.querySelector("svg")).not.toBeNull();
    expect(marks[0]!.classList.contains("new")).toBe(true);
    expect(marks[0]!.closest(".it")!.querySelector(".tx")!.textContent).toBe("Moving it.");
    commentMarks.set("t1", { ...MARK, tip: "Written before this page was shared." });
    view.update(t);
    expect(view.element.querySelector(".root .cm")!.textContent).toBe("Only in this browser");
    // A mark already shown doesn't ease in again when the thread is redrawn.
    expect(view.element.querySelector(".rps .cm")!.classList.contains("new")).toBe(false);
    commentMarks.clear();
    view.update(t);
    // Taken away, each eases out where it was, then is gone at the next redraw.
    expect([...view.element.querySelectorAll(".cm")].every((e) => e.classList.contains("out"))).toBe(true);
    view.update(t);
    expect(view.element.querySelector(".cm")).toBeNull();
  });

  it("is a glyph after the time on a closed card, named by its words", () => {
    commentMarks.set("t1", { ...MARK, tip: "You chose to keep it here." });
    const el = threadView(thread(), actions(), { variant: "card", now: () => NOW }).element;
    const g = el.querySelector(".root .hdr .cm") as HTMLElement;
    expect(g.getAttribute("role")).toBe("img");
    expect(g.getAttribute("aria-label")).toBe("Only in this browser");
    expect(g.title).toBe("You chose to keep it here.");
    expect(g.previousElementSibling!.classList.contains("ago")).toBe(true);
    expect(el.querySelectorAll(".cm")).toHaveLength(1);
    commentMarks.clear();
  });

  it("changes a thread's redraw key only for marks on its own comments", () => {
    const t = thread({ root: c("t1", "Sam", "Sure?", [c("r1", "Ada", "Yes.")]) });
    const before = notesKey(t);
    commentMarks.set("elsewhere", { ...MARK });
    expect(notesKey(t)).toBe(before);
    commentMarks.set("r1", { ...MARK });
    expect(notesKey(t)).not.toBe(before);
    commentMarks.clear();
  });
});

describe("an AI's replies", () => {
  it("are drawn with the AI ring, and a reply being written shows at the end of the thread", () => {
    const t = thread({
      root: c("t1", "Jamie", "Sure?", [c("r1", "AI assistant (on this device)", "Risks says no.")]),
    });
    const view = threadView(t, actions(), { variant: "popover", now: () => NOW });
    expect(view.element.querySelector(".it .av.ai")?.textContent).toBe("AI");
    expect(view.element.querySelector(".ghost")).toBeNull();
    threadNotes.set("t1", "Writing so far");
    view.update(t);
    const ghost = view.element.querySelector(".ghost")!;
    expect(ghost.textContent).toContain("Writing so far");
    expect(ghost.querySelector(".av.ai")).not.toBeNull();
    // The hooks an add-on styles it by, so it never needs core's class names.
    expect(ghost.getAttribute("data-pipeup-writing")).toBe("row");
    expect(ghost.querySelector("[data-pipeup-writing=words]")?.textContent).toContain("Writing so far");
    expect(ghost.querySelector("[data-pipeup-ai]")).not.toBeNull();
    expect(ghost.querySelector(".who")!.textContent).toBe("AI assistant");
    expect(ghost.querySelector(".ago")!.textContent).toBe("writing now");
    threadNotes.delete("t1");
    view.update(t);
    expect(view.element.querySelector(".ghost")).toBeNull();
  });
});

describe("a mark from an add-on", () => {
  it("is a quiet line at the end of the thread, before the reply line, and goes when removed", () => {
    const t = thread();
    const view = threadView(t, actions(), { variant: "popover", now: () => NOW });
    threadMarks.set("t1", "Reviewed by AI · nothing to add");
    view.update(t);
    const seen = view.element.querySelector(".seen")!;
    expect(seen.textContent).toBe("Reviewed by AI · nothing to add");
    expect(seen.nextElementSibling?.classList.contains("rbox")).toBe(true);
    threadMarks.delete("t1");
    view.update(t);
    expect(view.element.querySelector(".seen")).toBeNull();
  });
});

describe("reactions in a thread", () => {
  const withReactions = (resolved = false) =>
    thread({
      resolved,
      root: c("t1", "Ada", "Is it ready?", [], {
        reactions: [
          {
            emoji: "👍",
            by: [
              { author: "me", name: "" },
              { author: "sam", name: "Sam" },
            ],
          },
          { emoji: "🎉", by: [{ author: "lee", name: "Lee" }] },
        ],
      }),
    });

  it("shows each emoji with its count, marks yours, says who on hover, and nothing when nobody reacted", () => {
    const quiet = threadView(thread(), actions(), { variant: "popover", now: () => NOW }).element;
    expect(quiet.querySelector(".rxs")).toBeNull();
    const el = threadView(withReactions(), actions(), { variant: "popover", now: () => NOW }).element;
    const chips = [...el.querySelectorAll<HTMLButtonElement>(".rx")];
    expect(chips.map((b) => b.textContent)).toEqual([
      "👍2Sam, You".replace("Sam, You", "You, Sam"),
      "🎉1Lee",
    ]);
    expect(chips[0]!.getAttribute("aria-pressed")).toBe("true");
    expect(chips[0]!.getAttribute("aria-label")).toBe("Thumbs up, 2 people, including you");
    expect(chips[1]!.getAttribute("aria-pressed")).toBe("false");
  });

  it("takes your reaction back, or gives one, with a click", async () => {
    const a = actions();
    const el = threadView(withReactions(), a, { variant: "popover", now: () => NOW }).element;
    el.querySelectorAll<HTMLButtonElement>(".rx")[0]!.click();
    el.querySelectorAll<HTMLButtonElement>(".rx")[1]!.click();
    expect(a.calls).toEqual(["unreact t1 👍", "react t1 🎉"]);
  });

  it("opens a quick row from React, and a choice gives the reaction and closes it", () => {
    const a = actions();
    const el = threadView(thread(), a, { variant: "popover", now: () => NOW }).element;
    expect(el.querySelector(".rxq")).toBeNull();
    el.querySelector<HTMLButtonElement>("button[aria-label=React]")!.click();
    const quick = [...el.querySelectorAll<HTMLButtonElement>(".rxo")];
    expect(quick.map((b) => b.textContent)).toEqual(["👍", "❤️", "😂", "🎉", "😮", "🙏"]);
    quick[3]!.click();
    expect(a.calls).toEqual(["react t1 🎉"]);
    expect(el.querySelector(".rxq")).toBeNull();
  });

  it("still shows reactions on a resolved thread, but can't change them", () => {
    const el = threadView(withReactions(true), actions(), { variant: "popover", now: () => NOW }).element;
    expect(el.querySelectorAll(".rx")).toHaveLength(2);
    expect([...el.querySelectorAll<HTMLButtonElement>(".rx")].every((b) => b.disabled)).toBe(true);
    expect(el.querySelector("button[aria-label=React]")).toBeNull();
  });
});
