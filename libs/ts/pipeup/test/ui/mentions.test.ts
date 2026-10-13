// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Comment, Thread } from "../../src/model/types";
import { composer } from "../../src/ui/composer";
import { filterPeople, locate, mentionToken, peopleFor, setPeople, type Person } from "../../src/ui/mentions";

const key = (c: string) => c.repeat(43);
const comment = (author: string, name: string, over: Partial<Comment> = {}): Comment => ({
  id: `${author}${name}`.padEnd(43, "_"),
  author,
  name,
  text: "x",
  at: 0,
  edited: false,
  deleted: false,
  replies: [],
  reactions: [],
  ...over,
});
const thread = (root: Comment): Thread => ({
  id: root.id,
  anchor: { path: "", fingerprint: "00000000", snapshot: "" },
  root,
  resolved: false,
});

describe("the people who can be mentioned", () => {
  afterEach(() => {
    setPeople([]);
    document.documentElement.removeAttribute("data-pipeup-agents");
  });

  it("are everyone who commented or reacted, once each, never you", () => {
    const sam = comment(key("S"), "Sam", {
      reactions: [{ emoji: "👍", by: [{ author: key("L"), name: "Lee" }] }],
      replies: [comment(key("S"), "Sam"), comment(key("M"), "")],
    });
    const people = peopleFor([thread(sam), thread(comment(key("Y"), "You"))], key("Y"));
    expect(people.map((p) => p.name)).toEqual(expect.arrayContaining(["Sam", "Lee"]));
    expect(people.filter((p) => p.name === "Sam")).toHaveLength(1);
    expect(people.some((p) => p.ref === key("Y"))).toBe(false);
    // Someone with no name shows as their animal.
    expect(people.find((p) => p.ref === key("M"))!.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it("include the agents the page lists, marked as agents, and people the page supplies", () => {
    document.documentElement.setAttribute("data-pipeup-agents", `${key("A")} nonsense`);
    setPeople([
      { ref: "host:ada", name: "Ada" },
      { ref: "bad ref", name: "Nope" },
    ]);
    const people = peopleFor([], key("Y"));
    expect(people.find((p) => p.ref === key("A"))).toMatchObject({ agent: true });
    expect(people.find((p) => p.ref === "host:ada")).toMatchObject({ name: "Ada" });
    expect(people.some((p) => p.name === "Nope")).toBe(false);
  });

  it("show an AI's replies as an agent", () => {
    const ai = comment(key("A"), "AI assistant · Claude");
    expect(peopleFor([thread(ai)], key("Y"))[0]).toMatchObject({ name: "Claude", agent: true });
  });
});

describe("typing @", () => {
  it("finds the word being typed after an @ that starts a word", () => {
    expect(mentionToken("hi @Sa")).toEqual({ start: 3, query: "Sa" });
    expect(mentionToken("@")).toEqual({ start: 0, query: "" });
    expect(mentionToken("ask @Red F")).toEqual({ start: 4, query: "Red F" });
    expect(mentionToken("mail me@home")).toBeNull();
    expect(mentionToken("no at sign")).toBeNull();
    expect(mentionToken("@Sam said hi there")).toBeNull();
  });

  it("filters names that start with it first, then names that contain it, at most eight", () => {
    const list: Person[] = ["Sam", "Rosa", "Samira", "Lee", "Amy", "Sasha", "Asa", "Isa", "Tosa", "Mesa"].map(
      (name) => ({
        ref: `host:${name}`,
        name,
      }),
    );
    const found = filterPeople(list, "sa").map((p) => p.name);
    expect(found.slice(0, 3)).toEqual(["Sam", "Samira", "Sasha"]);
    expect(found).toHaveLength(8);
    expect(filterPeople(list, "").length).toBe(8);
    expect(filterPeople(list, "zzz")).toEqual([]);
  });
});

describe("finding the mentions in the final words", () => {
  const sam = { label: "Sam", ref: key("S") };
  it("gives each chosen person's range, in the order written", () => {
    expect(locate("Hi @Sam and @Lee, ready?", [sam, { label: "Lee", ref: key("L") }])).toEqual([
      { start: 3, end: 7, ref: key("S") },
      { start: 12, end: 16, ref: key("L") },
    ]);
  });

  it("drops a person whose @name was edited away, or run into another word", () => {
    expect(locate("Hi Sam", [sam])).toEqual([]);
    expect(locate("Hi @Samuel", [sam])).toEqual([]);
    expect(locate("me@Sam", [sam])).toEqual([]);
  });

  it("takes the same name twice in the order chosen, and a name with spaces", () => {
    expect(locate("@Sam and @Sam", [sam, sam]).map((m) => m.start)).toEqual([0, 9]);
    expect(locate("cc @Red Fox!", [{ label: "Red Fox", ref: key("R") }])).toEqual([
      { start: 3, end: 11, ref: key("R") },
    ]);
  });
});

describe("the writing line's @ list", () => {
  const people: Person[] = [
    { ref: key("S"), name: "Sam" },
    { ref: key("L"), name: "Lee" },
  ];
  const make = () => {
    const onSend = vi.fn(async () => {});
    const c = composer({ label: "Reply", onSend, people: () => people });
    document.body.append(c.element);
    return { c, onSend };
  };
  const type = (c: ReturnType<typeof composer>, text: string) => {
    c.input.value = text;
    c.input.setSelectionRange(text.length, text.length);
    c.input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const list = (c: ReturnType<typeof composer>) => c.element.querySelector(".mnl")!;
  const key_ = (c: ReturnType<typeof composer>, k: string) =>
    c.input.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

  it("opens on @, narrows as you type, and Enter takes the highlighted person instead of sending", async () => {
    const { c, onSend } = make();
    type(c, "hi @s");
    const options = () => [...c.element.querySelectorAll("[role=option]")].map((o) => o.textContent);
    expect(options()).toEqual(["Sam"]);
    expect(list(c).classList.contains("show")).toBe(true);
    key_(c, "Enter");
    expect(c.input.value).toBe("hi @Sam ");
    expect(onSend).not.toHaveBeenCalled();
    key_(c, "Enter");
    await vi.waitFor(() =>
      expect(onSend).toHaveBeenCalledWith("hi @Sam", [{ start: 3, end: 7, ref: key("S") }]),
    );
  });

  it("moves with the arrows, and Escape closes the list but keeps the words", () => {
    const { c } = make();
    type(c, "@");
    expect([...c.element.querySelectorAll("[role=option]")]).toHaveLength(2);
    key_(c, "ArrowDown");
    expect(c.element.querySelector("[aria-selected=true]")!.textContent).toBe("Lee");
    key_(c, "Escape");
    expect(list(c).classList.contains("show")).toBe(false);
    expect(c.input.value).toBe("@");
  });

  it("is just a character when the line has no people", async () => {
    const onSend = vi.fn(async () => {});
    const c = composer({ label: "Reply", onSend });
    document.body.append(c.element);
    c.input.value = "@Sam";
    c.input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(c.element.querySelector("[role=listbox]")).toBeNull();
    key_(c, "Enter");
    await vi.waitFor(() => expect(onSend).toHaveBeenCalledWith("@Sam", []));
  });
});
