import type { PipeupAddon } from "pipeup";

/**
 * A small, complete add-on: one row in Pipeup's menu that opens a panel with a short note.
 *
 * Change the id first. It is yours: lower-case letters, digits and dashes, 2 to 24 characters, starting with a
 * letter. A maker's name in front keeps it distinct ("acme-hello"). The names share, voice, live and assist are
 * the Pipeup project's own; please don't use them.
 */
export function createAddon(): PipeupAddon {
  return {
    id: "acme-hello",
    // The add-on API this was written for. Pipeup keeps an add-on off, with a reason, if it doesn't match.
    api: 1,
    version: "0.1.0",
    // The slots it uses. If this Pipeup lacks one, the add-on stays off and says why.
    needs: ["menu", "panel"],
    // One plain sentence: what leaves the device, and who sees what. Reviewers are shown it first.
    network: { when: "never", to: [], says: "Sends nothing: it only shows a note on this page." },
    setup(host) {
      let panel: { close(): void } | undefined;
      const row = host.addMenuItem({
        id: "hello",
        // 24-unit SVG path data, drawn by Pipeup (never markup).
        icon: ["M4 12h16", "M12 4v16"],
        label: () => "Say hello",
        hint: () => "Shows a short note",
        select: () => {
          panel?.close();
          const note = document.createElement("p");
          // Always text, never HTML: build nodes, or set textContent.
          note.textContent = "Hello from my add-on. It sends nothing anywhere.";
          panel = host.openPanel(note, { label: "Hello", onClose: () => (panel = undefined) });
        },
      });
      // What setup returns runs when Pipeup is torn down: undo everything you added.
      return () => {
        panel?.close();
        row.remove();
      };
    },
  };
}
