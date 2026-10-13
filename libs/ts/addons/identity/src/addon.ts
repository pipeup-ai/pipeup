import type { AddonHost, PipeupAddon } from "pipeup";
import { STYLES } from "./styles";
import { openIdentity } from "./view";

const EDIT = ["M4 20h4L19 9l-4-4L4 16z"];

export function createAddon(): PipeupAddon {
  return {
    id: "identity",
    api: 1,
    version: "0.8.0",
    needs: ["menu", "styles", "dialog", "identity"],
    network: {
      when: "never",
      to: [],
      says: "Nothing. Your recovery code stays on this device unless you copy it or save it as a file yourself.",
    },
    setup(host: AddonHost) {
      host.addStyles(STYLES);
      host.addMenuItem({
        id: "identity",
        icon: EDIT,
        label: () => "My identity",
        hint: () => "Back it up, or use one you backed up",
        select: () => openIdentity(host),
      });
    },
  };
}
