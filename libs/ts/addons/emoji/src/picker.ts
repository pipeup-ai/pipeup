import type { ReactionPicker } from "pipeup";
import { ALL, drawn, GROUP_NAMES, nameOf, search, TONES, withTone, type Entry } from "./emoji";

const COLUMNS = 8;
const RECENT = 24;
const KEEP = { recent: "pipeup:emoji-recent", tone: "pipeup:emoji-tone" };

const kept = (key: string): string => {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
};
const keep = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // remembered for this page only
  }
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/** The picker: search, the groups phones use, recently used, and one skin tone for the hands and people. */
export function createPicker(): ReactionPicker {
  return {
    name: nameOf,
    fill(into, pick) {
      let tone = Math.min(5, Math.max(0, Number(kept(KEEP.tone)) || 0));
      let recent: string[] = kept(KEEP.recent).split(" ").filter(Boolean);
      const shown = (e: Entry) => drawn(withTone(e, tone));
      const input = el("input", "emoji-q");
      input.type = "search";
      input.placeholder = "Search";
      input.setAttribute("aria-label", "Search emoji");
      const toneBtn = el("button", "emoji-tone");
      toneBtn.type = "button";
      const tabs = el("div", "emoji-tabs");
      tabs.setAttribute("role", "toolbar");
      tabs.setAttribute("aria-label", "Groups");
      const body = el("div", "emoji-body");
      const top = el("div", "emoji-top", "");
      top.append(input, toneBtn);
      into.classList.add("emoji");
      into.append(top, tabs, body);

      const choose = (value: string) => {
        recent = [value, ...recent.filter((r) => r !== value)].slice(0, RECENT);
        keep(KEEP.recent, recent.join(" "));
        pick(value);
      };
      const button = (value: string, name: string) => {
        const b = el("button", "emoji-e", value);
        b.type = "button";
        b.tabIndex = -1;
        b.setAttribute("aria-label", name);
        b.addEventListener("click", () => choose(value));
        return b;
      };
      const section = (title: string, buttons: HTMLElement[], id = "") => {
        const s = el("section", "emoji-s");
        if (id) s.dataset.group = id;
        s.append(el("h3", "emoji-h", title));
        const grid = el("div", "emoji-grid");
        grid.append(...buttons);
        s.append(grid);
        return s;
      };
      const paintTone = () => {
        toneBtn.textContent = tone ? `\u{1F44B}${TONES[tone]}` : "\u{1F44B}";
        toneBtn.setAttribute(
          "aria-label",
          `Skin tone: ${["none", "light", "medium-light", "medium", "medium-dark", "dark"][tone]}. Press to change`,
        );
      };
      const render = () => {
        const q = input.value.trim();
        const sections: HTMLElement[] = [];
        if (q) {
          const found = search(q).filter(shown);
          sections.push(
            found.length
              ? section(
                  `${found.length} found`,
                  found.map((e) => {
                    const v = withTone(e, tone);
                    return button(v, nameOf(v) ?? e.name);
                  }),
                )
              : el("p", "emoji-none", "No emoji match"),
          );
        } else {
          const back = recent.filter((r) => drawn(r));
          if (back.length)
            sections.push(
              section(
                "Recent",
                back.map((r) => button(r, nameOf(r) ?? "Emoji")),
              ),
            );
          GROUP_NAMES.forEach((name, g) => {
            const list = ALL.filter((e) => e.group === g && shown(e));
            if (list.length)
              sections.push(
                section(
                  name,
                  list.map((e) => {
                    const v = withTone(e, tone);
                    return button(v, nameOf(v) ?? e.name);
                  }),
                  String(g),
                ),
              );
          });
        }
        body.replaceChildren(...sections);
        body.scrollTop = 0;
        const first = body.querySelector<HTMLElement>(".emoji-e");
        if (first) first.tabIndex = 0;
        tabs.hidden = Boolean(q);
      };
      // The tabs jump to a group; each shows the group's first emoji.
      GROUP_NAMES.forEach((name, g) => {
        const first = ALL.find((e) => e.group === g)!;
        const t = el("button", "emoji-t", first.emoji);
        t.type = "button";
        t.setAttribute("aria-label", name);
        t.title = name;
        t.addEventListener("click", () => {
          const s = body.querySelector<HTMLElement>(`[data-group="${g}"]`);
          if (s)
            body.scrollTo({
              top: s.offsetTop - body.offsetTop,
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            });
        });
        tabs.append(t);
      });
      toneBtn.addEventListener("click", () => {
        tone = (tone + 1) % TONES.length;
        keep(KEEP.tone, String(tone));
        paintTone();
        render();
      });
      input.addEventListener("input", render);
      // Arrow keys move over the emoji (one tab stop for the whole grid); Down from the search goes into it.
      into.addEventListener("keydown", (e) => {
        const t = e.target as HTMLElement;
        const all = [...body.querySelectorAll<HTMLElement>(".emoji-e")];
        if (t === input && e.key === "ArrowDown" && all[0]) {
          e.preventDefault();
          all[0].focus();
          return;
        }
        const at = all.indexOf(t);
        if (at < 0) return;
        const move: Record<string, number> = {
          ArrowRight: 1,
          ArrowLeft: -1,
          ArrowDown: COLUMNS,
          ArrowUp: -COLUMNS,
        };
        let next = at;
        if (e.key in move) next = at + move[e.key]!;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = all.length - 1;
        else return;
        e.preventDefault();
        if (next < 0) return void input.focus();
        const target = all[Math.min(all.length - 1, next)]!;
        for (const b of all) b.tabIndex = b === target ? 0 : -1;
        target.focus();
      });
      paintTone();
      render();
    },
  };
}
