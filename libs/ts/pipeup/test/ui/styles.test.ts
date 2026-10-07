import { describe, expect, it } from "vitest";
import { STYLES } from "../../src/ui/styles";

/** The custom properties Pipeup's host writes onto its layer from script (theme.ts, host.ts). */
const SET_BY_SCRIPT = ["--pu-accent", "--pu-font", "--pu-panel", "--pu-pop"];

describe("the stylesheet", () => {
  it("uses only custom properties it defines, or that the host sets", () => {
    const defined = new Set([...STYLES.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const used = [...new Set([...STYLES.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!))];
    expect(used.filter((v) => !defined.has(v) && !SET_BY_SCRIPT.includes(v))).toEqual([]);
  });

  it("keeps its own tokens short: only the host's four carry the --pu- prefix", () => {
    expect([...new Set(STYLES.match(/--pu-[\w-]+/g))].sort()).toEqual(SET_BY_SCRIPT);
  });
});
