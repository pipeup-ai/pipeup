// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ADDON_API, addons, drainQueue, use, type PipeupAddon } from "../src/ui/addons";

const base = (id: string, over: Partial<PipeupAddon> = {}): PipeupAddon => ({
  id,
  api: ADDON_API,
  version: "1.0.0",
  needs: ["menu"],
  network: { when: "never", to: [], says: "Sends nothing." },
  setup: () => {},
  ...over,
});

afterEach(() => {
  document.documentElement.removeAttribute("data-pipeup-addons");
  delete (globalThis as { pipeupAddons?: unknown }).pipeupAddons;
  vi.restoreAllMocks();
});

describe("a page's list of the add-ons that may run", () => {
  it("lets every add-on run when the page has no list", () => {
    use(base("allow-a"));
    expect(addons().find((a) => a.id === "allow-a")?.state).toBe("waiting");
  });

  it("keeps the others off, saying so, when the page lists some", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    document.documentElement.setAttribute("data-pipeup-addons", "allow-b, allow-c");
    use(base("allow-b"));
    use(base("allow-c"));
    use(base("allow-d"));
    expect(addons().find((a) => a.id === "allow-b")?.state).toBe("waiting");
    expect(addons().find((a) => a.id === "allow-c")?.state).toBe("waiting");
    expect(addons().find((a) => a.id === "allow-d")).toMatchObject({
      state: "off",
      reason: "this page doesn't allow it",
    });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("lets none run when the list says none, and ids must match exactly", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    document.documentElement.setAttribute("data-pipeup-addons", "none");
    use(base("allow-e"));
    expect(addons().find((a) => a.id === "allow-e")?.state).toBe("off");
    document.documentElement.setAttribute("data-pipeup-addons", "allow-f2");
    use(base("allow-f"));
    expect(addons().find((a) => a.id === "allow-f")?.state).toBe("off");
  });
});

describe("registering add-ons", () => {
  it("accepts a good add-on and lists it as waiting until Pipeup mounts", () => {
    use(base("reg-a"));
    expect(addons().find((a) => a.id === "reg-a")).toMatchObject({ state: "waiting", version: "1.0.0" });
  });

  it("ignores a second add-on with the same id, with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    use(base("reg-b"));
    use(base("reg-b", { version: "2.0.0" }));
    expect(addons().filter((a) => a.id === "reg-b")).toHaveLength(1);
    expect(addons().find((a) => a.id === "reg-b")?.version).toBe("1.0.0");
    expect(warn).toHaveBeenCalled();
  });

  it("refuses bad ids and reserved ids", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const id of ["A", "x", "has space", "local", "file", "page", "user", "pipeup", "presence", "sync"])
      use(base(id));
    use(null as never);
    expect(addons().filter((a) => ["A", "x", "has space", "local", "file", "page"].includes(a.id))).toEqual(
      [],
    );
    expect(warn).toHaveBeenCalledTimes(11);
  });

  it("keeps an add-on written for another API off, saying why", () => {
    use(base("reg-c", { api: 7 }));
    expect(addons().find((a) => a.id === "reg-c")).toMatchObject({
      state: "off",
      reason: `needs add-on API 7; this Pipeup has ${ADDON_API}`,
    });
  });

  it("keeps an add-on needing a slot this Pipeup lacks off, saying which", () => {
    use(base("reg-d", { needs: ["teleport" as never] }));
    expect(addons().find((a) => a.id === "reg-d")).toMatchObject({
      state: "off",
      reason: "this Pipeup has no teleport slot",
    });
  });
});

describe("the add-on queue", () => {
  it("takes what was pushed before Pipeup loaded, then makes later pushes register at once", () => {
    const g = globalThis as { pipeupAddons?: unknown };
    g.pipeupAddons = [base("queue-a"), base("queue-b")];
    expect(drainQueue()).toBe(true);
    expect(addons().map((a) => a.id)).toEqual(expect.arrayContaining(["queue-a", "queue-b"]));
    (g.pipeupAddons as { push(a: PipeupAddon): void }).push(base("queue-c"));
    expect(addons().some((a) => a.id === "queue-c")).toBe(true);
  });

  it("says another core owns the queue when it finds a foreign push", () => {
    (globalThis as { pipeupAddons?: unknown }).pipeupAddons = { push: () => {} };
    expect(drainQueue()).toBe(false);
  });
});
