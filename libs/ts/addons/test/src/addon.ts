import type { PipeupAddon } from "pipeup";

/** A fixture add-on that uses every slot, so the core's slots can be tested from a real page. */
export function createAddon(): PipeupAddon {
  return {
    id: "hello",
    api: 1,
    version: "1.0.0",
    needs: ["menu", "notify", "note", "composer", "panel", "styles", "status", "overlay", "here", "sign"],
    network: { when: "never", to: [], says: "Sends nothing." },
    setup(host) {
      const w = window as unknown as { __hello?: Record<string, unknown> };
      let pressed = 0;
      let on = false;
      const row = host.addMenuItem({
        id: "count",
        icon: ["M5 12h14"],
        label: () => `Pressed ${pressed} times`,
        hint: () => "An example row",
        count: () => (pressed ? String(pressed) : ""),
        select: () => {
          pressed++;
          row.update();
        },
      });
      host.addMenuItem({
        id: "switch",
        icon: ["M5 12h14"],
        label: () => (on ? "Switch is on" : "Switch is off"),
        hint: () => "An example switch",
        checked: () => on,
        select: () => {
          on = !on;
        },
      });
      host.addMenuItem({
        id: "bad",
        icon: ["M5 12h14"],
        label: () => "Fails",
        hint: () => "Always throws",
        select: () => {
          throw new Error("Can't reach the example service");
        },
      });
      host.addComposerTool({
        id: "words",
        icon: ["M4 12h16M12 4v16"],
        label: "Insert words",
        press: (handle) => {
          const d = handle.dictate();
          d.update("hel");
          d.commit("hello world");
        },
      });
      host.addStyles(".example{color:var(--pu-accent)}");
      host.setStatus({ text: "Example on" });
      host.setComposerNote("Comments here are an example.");
      const ov = host.overlay();
      ov.append(Object.assign(document.createElement("i"), { className: "example", textContent: "overlay" }));
      let frames = 0;
      host.onFrame(() => frames++);
      const seen: unknown[] = [];
      host.onUi((ui) => seen.push(ui));
      w.__hello = {
        host,
        seen,
        frames: () => frames,
        panel: () => {
          const p = document.createElement("p");
          p.textContent = "A panel";
          return host.openPanel(p, { label: "Example panel" });
        },
        torn: false,
      };
      return () => {
        (w.__hello as { torn: boolean }).torn = true;
      };
    },
  };
}
