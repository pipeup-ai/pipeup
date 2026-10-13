import type { AddonHost, ItemHandle, PipeupAddon } from "pipeup";
import { ladder, pageSecret, settings, SyncEngine } from "@pipeup/kit";
import { parseShare } from "./address";
import { idsOf, type Backend } from "./backend";
import { Mailbox } from "./mailbox";
import { Policy, type Saved } from "./policy";
import { PrivateBin } from "./privatebin";
import { ShareTransport } from "./transport";

export interface ShareOptions {
  /** A sharing address, instead of the page's `data-pipeup-share`. */
  share?: string;
}

const NOTE = "Comments here are shared with everyone who has this page.";
const WEEK = 7 * 86_400_000;
const UP = ["M12 16V4M7 9l5-5 5 5M5 20h14"];
const LOCK = ["M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z"];

export function createAddon(options: ShareOptions = {}): PipeupAddon {
  return {
    id: "share",
    api: 1,
    version: "0.4.1",
    needs: ["sync", "menu", "notify", "note"],
    network: {
      when: "page-configured",
      to: ["page"],
      says: "Sends the comments you choose to share, sealed so only people with this page can read them, to the sharing service the page names. That service sees when and how much is sent, and your network address.",
    },
    async setup(host: AddonHost) {
      const doc = host.document;
      const address = parseShare(
        options.share ?? document.documentElement.getAttribute("data-pipeup-share"),
        true,
      );
      if (address.kind === "off") return host.off(address.reason);
      if (!pageSecret(doc.id)) return host.off("needs a document identity");

      const l = ladder(doc.id, address.key);
      const store = await settings("share", { memory: host.ephemeral });
      const saved = await store.get<Saved>(`doc:${doc.id}`);
      const policy = new Policy(doc.me, saved);
      policy.hold(doc.ops());
      let writing: Promise<void> = Promise.resolve();
      const save = () => {
        writing = writing.then(() => store.set(`doc:${doc.id}`, { ...policy })).catch(() => {});
      };
      save();

      const PROBLEMS = {
        gone: "The shared copy is gone",
        closed: "This page can't send to the shared copy; ask the author for the current file",
        full: "The shared copy is full; the author can start it again",
      };
      const told = new Set<string>();
      const tell = (key: string, text: string) => told.has(key) || (told.add(key), host.notify(text));
      const refresh = () => {
        for (const r of rows) r.update();
        host.setStatus({ text: state() });
        host.setComposerNote(policy.send && !policy.noted && t.problem !== "gone" ? NOTE : null);
        if (t.newer)
          tell(
            "newer",
            `${t.newer} comments come from a newer version of Pipeup; this page can't show them yet.`,
          );
        if (t.problem)
          tell(
            t.problem,
            PROBLEMS[t.problem] + (t.problem === "gone" ? ". Your comments stay on this machine." : "."),
          );
      };
      const f: typeof fetch = (i, n) => fetch(i, n);
      const backend: Backend =
        address.kind === "mailbox"
          ? new Mailbox(address, l, f, host.signal)
          : new PrivateBin(address, l, f, host.signal, policy.gen, (id) => {
              policy.gen = id;
              save();
            });
      const t = new ShareTransport(backend, {
        signal: host.signal,
        gap: 10_000,
        lock: `pipeup-share:${doc.id}`,
        allowed: () => doc.ops().filter((op) => policy.sendable(op)),
        changed: refresh,
      });
      const engine = new SyncEngine({
        id: "share",
        document: doc,
        merge: async (ops) => {
          const n = await host.merge(ops);
          const have = new Set(doc.ops().map((o) => o.body.id));
          for (const id of idsOf(ops)) if (have.has(id)) policy.recv.add(id);
          save();
          return n;
        },
        transport: t,
        sendable: (op) => {
          const ok = policy.sendable(op);
          if (policy.noted !== saved?.noted) save();
          return ok;
        },
        signal: host.signal,
        delay: 2000,
        gap: () => t.gap,
      });
      let prep: ReturnType<typeof setTimeout>;
      engine.onState(() => {
        refresh();
        clearTimeout(prep);
        prep = setTimeout(() => void t.prepare(engine.pending()), 1000);
      });

      const where = new URL(address.kind === "mailbox" ? address.mailbox : address.base).host;
      const state = (): string => {
        const n = engine.waiting;
        return t.problem
          ? PROBLEMS[t.problem]
          : !policy.send
            ? "Shared · not sending your comments"
            : t.offline || engine.state === "offline"
              ? "Shared · offline, sends when back"
              : n
                ? `Shared · ${n} change${n === 1 ? "" : "s"} waiting`
                : "Shared · up to date";
      };
      const hint = (): string => {
        const end = backend.expires;
        return t.problem === "gone"
          ? "Your comments stay on this machine. The author can start sharing again."
          : [
              `Your comments are encrypted and sent to ${where} so others with this page see them. The service can't read them. People who already have your comments, by file or live, could pass them on.`,
              host.ephemeral && "This browser can't keep comments; the shared copy keeps the ones you send.",
              !store.lasting && "This browser won't remember this choice.",
              end &&
                end - Date.now() < WEEK &&
                `The shared copy expires on ${new Date(end).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`,
            ]
              .filter(Boolean)
              .join(" ");
      };

      const rows: ItemHandle[] = [];
      const row = (
        id: string,
        icon: string[],
        label: () => string,
        hint: () => string,
        select: () => void,
        checked?: () => boolean,
      ) => rows[rows.push(host.addMenuItem({ id, icon, label, hint, select, checked })) - 1]!;
      const count = doc
        .ops()
        .filter(
          (o) => policy.held.has(o.body.id) && (o.body.kind === "create" || o.body.kind === "reply"),
        ).length;
      row(
        "send",
        UP,
        () => (policy.send || t.problem ? state() : "Send my comments"),
        hint,
        () => {
          policy.send = !policy.send;
          save();
          engine.rescan();
          refresh();
        },
        () => policy.send,
      );
      if (count) {
        const more = store.lasting ? "" : " This browser won't remember this choice.";
        const choose = (share: boolean) => () => {
          policy.decide(share);
          save();
          for (const r of rows.splice(1)) r.remove();
          engine.rescan();
          refresh();
        };
        row(
          "share-earlier",
          UP,
          () => `Share my ${count} earlier comment${count === 1 ? "" : "s"}`,
          () => `Send the comments you wrote before this page was shared.${more}`,
          choose(true),
        );
        row(
          "keep-earlier",
          LOCK,
          () => "Keep them on this machine",
          () => `Never send the comments you wrote before this page was shared.${more}`,
          choose(false),
        );
      }
      refresh();
      void engine.start().then(refresh, (e) => globalThis.reportError?.(e));
      doc.onChange((_t, added, source) => {
        if (source === "local" && added.length) t.bump();
      });
      return () => {
        clearTimeout(prep);
        engine.stop();
      };
    },
  };
}
