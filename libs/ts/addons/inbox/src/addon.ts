import type { AddonHost, ItemHandle, PipeupAddon, SignedOp } from "pipeup";
import { inboxId, keyFrom, open, seal, signedBy, type InboxKey } from "./crypto";
import { Service } from "./service";

const KEEP = "pipeup:inbox-on";
const PEOPLE = ["M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8z", "M4 20c0-4 3.6-6 8-6s8 2 8 6"];
const KEY = /^[A-Za-z0-9_-]{43}$/;

/** A note as its sender wrote it, then signed. The fields and their order are what is signed. */
interface Note {
  v: 1;
  from: string;
  name: string;
  text: string;
  link: string;
  title: string;
  at: number;
}
interface Waiting extends Note {
  id: string;
}

const on = (): boolean => {
  try {
    return localStorage.getItem(KEEP) === "1";
  } catch {
    return false;
  }
};
const remember = (value: boolean): void => {
  try {
    localStorage.setItem(KEEP, value ? "1" : "0");
  } catch {
    // for this page only
  }
};

/** The inbox service the page's author named: `data-pipeup-inbox="https://…"`; http only for this computer. */
export function serviceOf(html: Element = document.documentElement): string {
  const v = html.getAttribute("data-pipeup-inbox") ?? "";
  try {
    const u = new URL(v);
    const here = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
    return u.protocol === "https:" || (u.protocol === "http:" && here) ? v : "";
  } catch {
    return "";
  }
}

/** What is signed of a note: its fields in a fixed order. */
const signedText = (n: Note): string => JSON.stringify([n.v, n.from, n.name, n.text, n.link, n.title, n.at]);

/** A note's sender's link, only if it is an ordinary web or file address (never `javascript:` and the like). */
export const safeLink = (link: string): string | null => {
  try {
    const u = new URL(link);
    return u.protocol === "https:" || u.protocol === "http:" || u.protocol === "file:" ? u.href : null;
  } catch {
    return null;
  }
};

export function createAddon(): PipeupAddon {
  return {
    id: "inbox",
    api: 1,
    version: "0.7.0-beta.1",
    needs: ["menu", "notify", "panel", "sign"],
    network: {
      when: "after-consent",
      to: ["the inbox service the page names (data-pipeup-inbox)"],
      says: "Only after you switch on Mentions by inbox: when you mention someone, a short note (who, your words, the page's address) is left for them at the page's inbox service, sealed so only they can read it; and your own inbox is checked there. The service sees that a note arrived, its size and when, and your network address, never who it is from or what it says.",
    },
    setup(host: AddonHost) {
      const base = serviceOf();
      if (!base) return host.off('the page names no inbox service (data-pipeup-inbox="https://…")');
      const service = new Service(base, host.signal);
      const me = host.document.me;
      const poll = Math.max(1, Number(document.documentElement.getAttribute("data-pipeup-inbox-poll")) || 60);
      let enabled = on();
      let mine: { key: InboxKey; id: string } | null = null;
      let cursor = "";
      let timer = 0;
      const waiting = new Map<string, Waiting>();
      let notes: ItemHandle | null = null;
      let panel: { close(): void } | null = null;

      /** This person's encryption key and inbox address, made from their identity (never stored), and published once. */
      const ready = async () => {
        if (mine) return mine;
        const key = await keyFrom(await host.sign("seed", "x25519"));
        const id = await inboxId(me);
        await service.putKey(id, me, key.publicKey, await host.sign("key", `${id}:${key.publicKey}`));
        return (mine = { key, id });
      };

      const paintNotes = () => {
        notes?.remove();
        notes = null;
        if (!waiting.size) return;
        notes = host.addMenuItem({
          id: "waiting",
          icon: PEOPLE,
          label: () => "Mentions waiting",
          hint: () => "People who mentioned you, on pages you may not have opened",
          count: () => String(waiting.size),
          select: show,
        });
      };

      const show = () => {
        const box = document.createElement("div");
        const draw = () => {
          box.replaceChildren();
          if (!waiting.size)
            box.append(Object.assign(document.createElement("p"), { textContent: "Nothing waiting." }));
          for (const n of waiting.values()) {
            const row = document.createElement("div");
            row.append(
              Object.assign(document.createElement("strong"), {
                textContent: `${n.name || "Someone"} mentioned you`,
              }),
              Object.assign(document.createElement("p"), { textContent: n.text }),
              Object.assign(document.createElement("small"), { textContent: `${n.title} · ${n.link}` }),
            );
            const link = safeLink(n.link);
            const actions = document.createElement("div");
            if (link) {
              const go = Object.assign(document.createElement("button"), {
                type: "button",
                textContent: "Open the page",
              });
              go.addEventListener("click", () => window.open(link, "_blank", "noopener,noreferrer"));
              actions.append(go);
            }
            const gone = Object.assign(document.createElement("button"), {
              type: "button",
              textContent: "Dismiss",
            });
            gone.addEventListener("click", () => void dismiss(n.id).then(draw));
            actions.append(gone);
            row.append(actions);
            box.append(row);
          }
        };
        draw();
        panel = host.openPanel(box, { label: "Mentions waiting", onClose: () => (panel = null) });
      };

      const dismiss = async (noteId: string) => {
        if (!mine) return;
        if (await service.remove(mine.id, noteId, me, await host.sign("delete", `${mine.id}:${noteId}`)))
          waiting.delete(noteId);
        paintNotes();
      };

      /** Looks in this person's inbox for notes, opens the ones sealed to them, and keeps the ones signed by their sender. */
      const look = async () => {
        try {
          const who = await ready();
          const got = await service.list(who.id, cursor);
          cursor = got.next;
          let fresh = 0;
          for (const { id, ct } of got.notes) {
            const plain = await open(who.key, ct);
            if (!plain || waiting.has(id)) continue;
            try {
              const [n, sig] = JSON.parse(plain) as [Note, string];
              if (
                n.v !== 1 ||
                !KEY.test(n.from) ||
                !(await signedBy(n.from, "inbox/note", signedText(n), sig))
              )
                continue;
              waiting.set(id, { ...n, id });
              fresh++;
            } catch {
              // not a note this version understands
            }
          }
          if (fresh) {
            paintNotes();
            host.notify(`${fresh} new mention${fresh === 1 ? "" : "s"} waiting`);
          }
        } catch {
          // the service isn't there right now: try again next time
        }
      };

      /** Leaves a note for each person a new comment of this reviewer's names, if they have an inbox here. */
      const tell = async (body: SignedOp["body"]) => {
        const text = body.text ?? "";
        const people = [
          ...new Set((body.mentions ?? []).map((m) => m.ref).filter((r) => KEY.test(r) && r !== me)),
        ];
        for (const person of people) {
          try {
            const inbox = await inboxId(person);
            const pub = await service.getKey(inbox);
            if (!pub) continue;
            const note: Note = {
              v: 1,
              from: me,
              name: host.document.name,
              text,
              link: location.href,
              title: document.title,
              at: Date.now(),
            };
            const sig = await host.sign("note", signedText(note));
            await service.leave(inbox, await seal(pub, JSON.stringify([note, sig])));
          } catch {
            // they can't be reached this way: the comment itself is unaffected
          }
        }
      };

      const start = () => {
        void look();
        timer = window.setInterval(() => !document.hidden && void look(), poll * 1000);
      };
      const stop = () => {
        window.clearInterval(timer);
        waiting.clear();
        paintNotes();
        panel?.close();
      };

      const row = host.addMenuItem({
        id: "inbox",
        icon: PEOPLE,
        label: () => "Mentions by inbox",
        hint: () =>
          `Leaves a sealed note for people you mention, at ${new URL(base).host}, and checks your own inbox there. The service sees that a note arrived, its size and when, and your network address, never who it is from or what it says.`,
        checked: () => enabled,
        select: () => {
          enabled = !enabled;
          remember(enabled);
          if (enabled) start();
          else stop();
        },
      });
      const off = host.document.onChange((_threads, added, source) => {
        if (!enabled || source !== "local") return;
        for (const { body } of added)
          if (
            body.author === me &&
            body.mentions?.length &&
            (body.kind === "create" || body.kind === "reply")
          )
            void tell(body);
      });
      if (enabled) start();
      return () => {
        off();
        window.clearInterval(timer);
        row.remove();
        notes?.remove();
        panel?.close();
      };
    },
  };
}
