import type { AddonHost, Thread } from "pipeup";
import { describe, readBlocks, sortEntries, type Sorted } from "./paste";
import { askForBlock } from "./prompt";
import { listedAgents } from "./replies";

/** The dialog's insides (Pipeup draws its frame); its colours are Pipeup's own, so both looks work. */
export const STYLES = `.ag-t{margin:0 0 8px;font-size:15px;font-weight:600}
.ag-f{display:block;width:100%;height:96px;margin:4px 0 8px;padding:8px;border:1px solid var(--ln);border-radius:8px;background:var(--so);color:var(--k);font:12px/1.5 ui-monospace,monospace;resize:vertical}
.ag-l{margin:0;padding:0;list-style:none;font-size:12.5px;line-height:1.45;color:var(--k)}
.ag-l li{padding:5px 0;border-top:1px solid var(--ln);opacity:1;transition:opacity .25s var(--eo)}
.ag-p{margin:8px 0 0;font-size:12px;line-height:1.5;color:var(--mu)}
.ag-a{display:flex;gap:6px;justify-content:flex-end;margin-top:10px}
.ag-b{padding:6px 12px;border:1px solid var(--ln);border-radius:8px;font-size:13px;color:var(--k);transition:background-color .2s var(--eo),opacity .2s var(--eo)}
.ag-b:hover,.ag-b:focus-visible{background:var(--ho);outline:none}
.ag-b.primary{border-color:var(--pu-accent);color:var(--pu-accent)}
.ag-b:disabled{opacity:.45;pointer-events:none}
@media (pointer:coarse){.ag-b{min-height:40px}}`;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...kids);
  return el;
}

/** What this add-on borrows from the core's global to check an agent's signature. */
const checkOp = (): ((op: unknown) => Promise<boolean>) | undefined =>
  (globalThis as { Pipeup?: { checkOp?: (op: unknown) => Promise<boolean> } }).Pipeup?.checkOp;

/**
 * Paste my agent's replies: the person pastes the agent's answer, the dialog says what it found, and nothing is added
 * until they press Add. Signed replies from a listed agent go in as the agent's; the rest as pasted by this reviewer.
 */
export function openPaste(
  host: AddonHost,
  copy: (text: string) => Promise<void>,
  done: (added: number, agent: string) => void,
): void {
  const box = h("textarea", {
    class: "ag-f",
    "aria-label": "Your agent's answer",
    placeholder: "Paste your agent's whole answer here",
    spellcheck: "false",
  });
  const found = h("ul", { class: "ag-l", role: "status" });
  const note = h("p", { class: "ag-p" });
  const add = h("button", { class: "ag-b primary", type: "button" }, "Add replies");
  const ask = h("button", { class: "ag-b", type: "button" }, "Copy that request");
  const cancel = h("button", { class: "ag-b", type: "button" }, "Cancel");
  add.disabled = true;
  ask.hidden = true;
  let sorted: Sorted[] = [];
  let reading = 0;

  const read = async () => {
    const mine = ++reading;
    const text = box.value;
    const check = checkOp();
    const result = await sortEntries(readBlocks(text), {
      doc: host.document.id,
      threads: host.document.threads() as readonly Thread[],
      listed: listedAgents(),
      check: check ?? (async () => false),
    });
    if (mine !== reading) return;
    sorted = result;
    const { lines, adds } = describe(sorted);
    found.replaceChildren(...lines.map((l) => h("li", {}, l)));
    add.textContent = adds ? `Add ${adds} ${adds === 1 ? "reply" : "replies"}` : "Add replies";
    add.disabled = !adds;
    const nothing = !!text.trim() && !sorted.length;
    ask.hidden = !nothing;
    note.textContent = nothing
      ? "There are no replies here that this page can read. Ask your agent to answer in the replies block from Copy for my agent."
      : adds
        ? "Replies show in their threads under the agent's name, marked as AI. They can't change your comments."
        : "";
  };
  box.addEventListener("input", () => void read());

  const dialog = host.openDialog(
    h(
      "div",
      {},
      h("h2", { class: "ag-t" }, "Paste your agent's replies"),
      box,
      found,
      note,
      h("div", { class: "ag-a" }, cancel, ask, add),
    ),
    "Paste your agent's replies",
  );
  queueMicrotask(() => box.focus());
  cancel.addEventListener("click", () => dialog.close());
  ask.addEventListener("click", () => {
    void copy(askForBlock()).then(
      () => (note.textContent = "Copied. Paste it to your agent, then paste its answer here."),
      () => (note.textContent = "Your browser blocked copying."),
    );
  });
  add.addEventListener("click", async () => {
    add.disabled = true;
    let added = 0;
    try {
      for (const s of sorted) {
        if (s.kind === "signed") added += (await host.merge(s.ops)) ? 1 : 0;
        else if (s.kind === "unsigned") {
          await host.paste(s.entry.thread, s.entry.agent, s.entry.reply, s.entry.addressed || undefined);
          added++;
        }
      }
    } catch (e) {
      note.textContent = e instanceof Error ? e.message.replace(/^pipeup: /, "") : "Something went wrong";
      add.disabled = false;
      return;
    }
    dialog.close();
    done(added, sorted.find((s) => s.kind !== "gone")?.entry.agent ?? "");
  });
}
