import type { PipeupAddon } from "pipeup";
import { createPicker } from "./picker";

const CSS = `.emoji{display:flex;flex-direction:column;color:var(--pu-text);font-size:13px}
.emoji-top{display:flex;gap:6px;padding:8px 8px 4px}
.emoji-q{flex:1;min-width:0;padding:6px 10px;border:1px solid var(--pu-line);border-radius:8px;background:var(--pu-soft);color:inherit;font:inherit}
.emoji-q:focus{outline:2px solid var(--pu-accent);outline-offset:1px}
.emoji-tone,.emoji-t{padding:4px 7px;border:0;border-radius:8px;background:none;font-size:17px;line-height:1;cursor:pointer;transition:background-color .2s var(--pu-ease)}
.emoji-tone:hover,.emoji-t:hover,.emoji-tone:focus-visible,.emoji-t:focus-visible{background:var(--pu-hover);outline:none}
.emoji-tabs{display:flex;justify-content:space-between;padding:0 6px 4px;border-bottom:1px solid var(--pu-line)}
.emoji-tabs[hidden]{display:none}
.emoji-body{height:262px;overflow-y:auto;padding:0 8px 8px}
.emoji-h{margin:10px 2px 4px;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--pu-muted)}
.emoji-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:2px}
.emoji-e{padding:3px 0;border:0;border-radius:8px;background:none;font-size:22px;line-height:1.3;cursor:pointer;transition:background-color .15s var(--pu-ease)}
.emoji-e:hover,.emoji-e:focus-visible{background:var(--pu-hover);outline:none}
.emoji-e:focus-visible{box-shadow:0 0 0 2px var(--pu-accent) inset}
.emoji-none{margin:18px 4px;color:var(--pu-muted)}
@media (prefers-reduced-motion:reduce){.emoji-tone,.emoji-t,.emoji-e{transition:none}}`;

export function createAddon(): PipeupAddon {
  return {
    id: "emoji",
    api: 1,
    version: "0.6.0",
    needs: ["reactions", "styles"],
    network: {
      when: "never",
      to: [],
      says: "Nothing is sent anywhere: the emoji are part of this script.",
    },
    setup(host) {
      const offStyles = host.addStyles(CSS);
      host.setReactionPicker(createPicker());
      return () => {
        host.setReactionPicker(null);
        offStyles();
      };
    },
  };
}
