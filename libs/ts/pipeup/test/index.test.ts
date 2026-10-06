import { describe, expect, it } from "vitest";
import * as pipeup from "../src/index";

describe("public API", () => {
  it("exports the core surface", () => {
    for (const name of [
      "PipeupDocument",
      "MemoryStore",
      "IndexedDbStore",
      "loadOrCreateProfile",
      "createIdentity",
      "newDocumentAttribute",
      "parseDocumentAttribute",
      "describeRange",
      "describeElement",
      "resolveAnchor",
      "locate",
      "labelOf",
      "copyThread",
      "copyAll",
      "formatAgo",
      "animalName",
      "nameOf",
    ]) {
      expect(typeof (pipeup as Record<string, unknown>)[name], name).toBe("function");
    }
    expect(pipeup.VERSION).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/);
  });
});
