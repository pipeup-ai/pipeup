import { expect, test } from "@playwright/test";
import { fixture } from "./helpers";

test("the classic script defines the Pipeup global without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(fixture("doc.html"));
  expect(await page.evaluate(() => typeof (window as any).Pipeup?.PipeupDocument)).toBe("function");
  expect(errors).toEqual([]);
});

test("the global has the module's exports, read only, on an object a page can still add to", async ({
  page,
}) => {
  await page.goto(fixture("doc.html"));
  const shape = await page.evaluate(async () => {
    const g = (window as any).Pipeup;
    const esm = await import(new URL("../../dist/pipeup.esm.js", location.href).href).catch(() => null);
    const names = Object.keys(g);
    const d = Object.getOwnPropertyDescriptor(g, "mount")!;
    let threw = false;
    try {
      g.mount = null;
    } catch {
      threw = true;
    }
    g.mine = 1;
    return {
      names,
      esm: esm ? Object.keys(esm).sort() : null,
      enumerable: d.enumerable,
      configurable: d.configurable,
      writable: d.writable ?? false,
      kept: typeof g.mount,
      threw,
      extensible: g.mine === 1,
      marker: g.__esModule === true && !names.includes("__esModule"),
    };
  });
  expect(shape.names).toContain("mount");
  expect(shape.names).toContain("VERSION");
  if (shape.esm) expect([...shape.names].sort()).toEqual(expect.arrayContaining(shape.esm));
  expect(shape).toMatchObject({
    enumerable: true,
    configurable: false,
    writable: false,
    kept: "function",
    extensible: true,
    marker: true,
  });
});
