import { describe, expect, it } from "vitest";
import { STYLES } from "../../src/ui/styles";

/** The custom properties Pipeup's host writes onto its layer from script (theme.ts, host.ts). */
const SET_BY_SCRIPT = ["--pu-accent", "--pu-font", "--pu-on", "--pu-panel", "--pu-pop"];
/** The public tokens add-ons may use: aliases of the short internal ones (add-ons design §3.4). */
const PUBLIC = [
  "--pu-ease",
  "--pu-faint",
  "--pu-hover",
  "--pu-line",
  "--pu-muted",
  "--pu-shadow",
  "--pu-soft",
  "--pu-surface",
  "--pu-text",
];

describe("the stylesheet", () => {
  it("uses only custom properties it defines, or that the host sets", () => {
    const defined = new Set([...STYLES.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const used = [...new Set([...STYLES.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!))];
    expect(used.filter((v) => !defined.has(v) && !SET_BY_SCRIPT.includes(v))).toEqual([]);
  });

  it("keeps its own tokens short: only the host's five and the public set carry the --pu- prefix", () => {
    expect([...new Set(STYLES.match(/--pu-[\w-]+/g))].sort()).toEqual([...SET_BY_SCRIPT, ...PUBLIC].sort());
  });

  it("has balanced braces (a stray one makes the browser drop the rule after it)", () => {
    let depth = 0;
    for (const ch of STYLES.replace(/\/\*[\s\S]*?\*\//g, "")) {
      depth += ch === "{" ? 1 : ch === "}" ? -1 : 0;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });
});
