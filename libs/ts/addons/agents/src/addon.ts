import type { AddonHost, AgentComments, ItemHandle, PipeupAddon, Thread } from "pipeup";
import { type Link, startLink } from "./link";
import { onThisComputer, systemOf } from "./nearby";
import { readBlocks, sortEntries, type Entry } from "./paste";
import { checkOp, openPaste, STYLES } from "./paste-view";
import { agentPrompt } from "./prompt";
import { type Block, listedAgents, repliesUrl, startReplies } from "./replies";
import { taggedBy } from "./tag";

/** What this add-on borrows from the core's global: the page's comments, as an agent reads them. */
interface Core {
  comments(options?: { all?: boolean }): Promise<AgentComments>;
}
const core = (): Partial<Core> => (globalThis as { Pipeup?: Partial<Core> }).Pipeup ?? {};

const COPY = [
  "M10 8h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z",
  "M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2",
];
const SEND = ["M21 12L3.5 4.5 6.2 12l-2.7 7.5zM6.2 12H13"];
const PASTE = [
  "M7 5h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
  "M10 3h4a1 1 0 0 1 1 1v2H9V4a1 1 0 0 1 1-1z",
  "M12 10v7m-3-3 3 3 3-3",
];

const SAYS =
  "Reads a replies file next to this page, and replies you paste from your agent. When a link is running on this computer, and only after you switch it on, it sends this page's comments to that link. Nothing leaves this computer.";
const WAITING = ["M7 3h7l5 5v13H7z", "M14 3v5h5"];

const sameWords = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

/** The thread already has this reply from this agent (added before this page was reloaded, say). */
function had(threads: readonly Thread[], e: Entry): boolean {
  const t = threads.find((x) => x.id === e.thread);
  return !!t?.root.replies.some((r) => r.name.endsWith(e.agent) && sameWords(r.text, e.reply));
}

const words = (e: unknown): string =>
  e instanceof Error ? e.message.replace(/^pipeup: /, "") : "Something went wrong";

/** Copies words to the clipboard, falling back to a hidden field inside Pipeup's own layer. */
async function copyText(text: string, into: HTMLElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Older browsers or blocked permission: fall back below.
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;opacity:0;pointer-events:none";
  into.append(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("pipeup: your browser blocked copying");
}

export function createAddon(): PipeupAddon {
  return {
    id: "agents",
    api: 1,
    version: "0.6.0",
    needs: ["menu", "status", "notify", "listnote", "dialog", "styles", "paste"],
    network: { when: "page-configured", to: ["page"], says: SAYS },
    setup(host: AddonHost) {
      const offStyles = host.addStyles(STYLES);
      const openCount = () =>
        (host.document.threads() as readonly Thread[]).filter((t) => !t.resolved).length;
      const copy = (text: string) => copyText(text, host.overlay());

      /** Replies blocks a shell link left: the ones tagged with this session's key go in at once, the rest wait. */
      const seen = new Set<string>();
      let waiting: string[] = [];
      let waitingFrom = "";
      const takeBlocks = async (found: Block[]) => {
        let added = 0;
        let who = "";
        for (const b of found) {
          if (seen.has(b.text)) continue;
          seen.add(b.text);
          const threads = host.document.threads() as readonly Thread[];
          const sorted = (
            await sortEntries(readBlocks(b.text), {
              doc: host.document.id,
              threads,
              listed: listedAgents(),
              check: checkOp() ?? (async () => false),
            })
          ).filter((x) => x.kind !== "gone" && !had(threads, x.entry));
          if (!sorted.length) continue;
          if (link.on() && (await taggedBy(link.session(), b.text, b.tag))) {
            for (const x of sorted) {
              if (x.kind === "signed") await host.merge(x.ops);
              else
                await host.paste(
                  x.entry.thread,
                  x.entry.agent,
                  x.entry.reply,
                  x.entry.addressed || undefined,
                );
              added++;
              who = x.entry.agent;
            }
          } else {
            waiting.push(b.text);
            waitingFrom = sorted[0]!.entry.agent;
          }
        }
        if (added) {
          pasted = who;
          host.notify(`${who} answered ${added} comment${added === 1 ? "" : "s"}`);
        }
        paint();
      };
      const link: Link = startLink({
        snapshot: async () => {
          const c = core();
          if (!c.comments) throw new Error("pipeup: this page has no Pipeup to read comments from");
          const [open, all] = await Promise.all([c.comments(), c.comments({ all: true })]);
          return { v: 1, at: new Date().toISOString(), title: document.title, open, all };
        },
        changes: (fn) => host.document.onChange(fn),
        refresh: () => paint(),
        lost: () => host.notify("The link to your agent stopped. Your comments are safe here."),
        overlay: () => host.overlay(),
      });
      const replies = startReplies(host, {
        linked: () => link.enabled(),
        blocks: (found) => void takeBlocks(found).catch((e: unknown) => host.notify(words(e))),
      });

      /** The agent whose replies were last pasted, until one answers by file or link. */
      let pasted = "";
      /** After the person added replies they pasted or looked at. */
      const added = (n: number, who: string) => {
        if (who) pasted = who;
        if (n) waiting = [];
        host.notify(n ? `Added ${n} ${n === 1 ? "reply" : "replies"}` : "No replies added");
        paint();
      };
      const agentName = () => replies.who() || link.agent || pasted;
      /** The quiet line in the menu and the control's tooltip, and the sentence under All comments. */
      const paint = () => {
        sync();
        host.setStatus(
          waiting.length
            ? { text: `Replies from ${waitingFrom || "your agent"} are waiting` }
            : replies.enabled || link.enabled()
              ? {
                  text: link.on()
                    ? `Sharing comments with ${agentName() || "your agent"}`
                    : `${agentName() || "An AI agent"} can answer comments here`,
                }
              : null,
        );
        if (!replies.enabled && !link.enabled()) return host.setListNote(null);
        const t = replies.tally(host.document.threads() as readonly Thread[]);
        const who = agentName() || "An agent";
        const said = t.answered
          ? `${who} has answered ${t.answered} of ${t.open} open comments${t.addressed ? `; ${t.addressed} ${t.addressed === 1 ? "is" : "are"} marked addressed` : ""}`
          : "No replies from an agent yet";
        const skipped = replies.ignored();
        const text =
          (link.on() ? `Sharing with ${link.agent || "your agent"} · ` : "") +
          said +
          (skipped ? ` · ${skipped} from other writers ignored` : "") +
          (t.stray
            ? ` · replies for ${t.stray} comment${t.stray === 1 ? "" : "s"} this page doesn't have`
            : "");
        host.setListNote({
          text,
          action: {
            label: "Check for replies",
            run: async () => {
              try {
                const n = await replies.check();
                host.notify(n ? `${n} new ${n === 1 ? "reply" : "replies"}` : "No new replies");
              } catch (e) {
                host.notify(words(e));
              } finally {
                paint();
              }
            },
          },
        });
      };

      host.addMenuItem({
        id: "prompt",
        icon: COPY,
        label: () => "Copy for my agent",
        hint: () => {
          const n = openCount();
          return `Your ${n} open comment${n === 1 ? "" : "s"}, and how to answer them`;
        },
        select: async () => {
          try {
            const c = core();
            if (!c.comments) throw new Error("pipeup: this page has no Pipeup to read comments from");
            const [open, all] = await Promise.all([c.comments(), c.comments({ all: true })]);
            await copyText(
              agentPrompt({
                title: document.title,
                url: location.href,
                doc: host.document.id,
                comments: open.markdown,
                open: open.threads.length,
                resolved: all.threads.length - open.threads.length,
                replies: repliesUrl(),
                file: link.enabled() ? link.file() : "",
                shell: link.shell(),
                nearby: onThisComputer(),
                system: systemOf(),
                listed: listedAgents().length > 0,
                version: (globalThis as { Pipeup?: { VERSION?: string } }).Pipeup?.VERSION,
              }),
              host.overlay(),
            );
            const n = open.threads.length;
            host.notify(`Copied ${n} open comment${n === 1 ? "" : "s"} for your agent`);
          } catch (e) {
            host.notify(words(e));
          }
        },
      });
      host.addMenuItem({
        id: "paste",
        icon: PASTE,
        label: () => "Paste my agent's replies",
        hint: () => "Adds the answers your agent gave in a chat",
        select: () => openPaste(host, copy, added),
      });

      /** Rows that come and go: the switch while a link is there, and replies waiting to be looked at. */
      let linkItem: ItemHandle | null = null;
      let waitingItem: ItemHandle | null = null;
      function sync(): void {
        if (link.enabled() && !linkItem)
          linkItem = host.addMenuItem({
            id: "link",
            icon: SEND,
            label: () => "Share with my agent",
            hint: () => "Sends this page's comments to the link running on this computer, and nothing else",
            checked: () => link.on(),
            select: async () => {
              try {
                await link.set(!link.on());
              } catch (e) {
                host.notify(words(e));
              }
              paint();
            },
          });
        else if (!link.enabled() && linkItem) {
          linkItem.remove();
          linkItem = null;
        }
        if (waiting.length && !waitingItem)
          waitingItem = host.addMenuItem({
            id: "waiting",
            icon: WAITING,
            label: () => `Replies from ${waitingFrom || "your agent"}`,
            hint: () => "Left next to this page. Look at them before adding.",
            select: () => {
              const text = waiting.join("\n\n");
              openPaste(host, copy, added, { text, title: `Replies ${waitingFrom || "your agent"} left` });
            },
          });
        else if (!waiting.length && waitingItem) {
          waitingItem.remove();
          waitingItem = null;
        }
        linkItem?.update();
        waitingItem?.update();
      }

      const off = host.document.onChange(paint);
      paint();
      return () => {
        off();
        offStyles();
        replies.destroy();
        link.destroy();
        linkItem?.remove();
        waitingItem?.remove();
      };
    },
  };
}
