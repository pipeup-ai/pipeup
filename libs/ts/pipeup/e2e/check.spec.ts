import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const run = promisify(execFile);
const cli = new URL("../cli/pipeup.mjs", import.meta.url).pathname;
const page = (name: string) => new URL(`fixtures/${name}`, import.meta.url).pathname;
interface Result {
  status: "pass" | "warn" | "fail";
  what: string;
  detail: string;
}
const check = async (name: string): Promise<{ code: number; results: Result[]; text: string }> => {
  const go = (...extra: string[]) =>
    run("node", [cli, "check", page(name), ...extra]).then(
      (r) => ({ code: 0, out: r.stdout }),
      (e: { code: number; stdout: string }) => ({ code: e.code, out: e.stdout }),
    );
  const json = await go("--json");
  const words = await go();
  return { code: json.code, results: JSON.parse(json.out).results, text: words.out };
};

test.describe.configure({ mode: "parallel" });

test("a page that leaves Pipeup alone passes at every width, and the exit code is 0", async () => {
  const r = await check("doc.html");
  expect(r.code).toBe(0);
  expect(r.results.filter((x) => x.status === "fail")).toEqual([]);
  expect(r.results.filter((x) => /changes nothing on the page/.test(x.what))).toHaveLength(3);
  expect(r.text).toContain("pass  Pipeup changes nothing on the page (375px)");
});

test("a page whose layout moves when Pipeup is there fails, and says what moved", async () => {
  const r = await check("check-shift.html");
  expect(r.code).toBe(1);
  const f = r.results.find((x) => x.status === "fail" && /changes nothing/.test(x.what))!;
  expect(f.detail).toMatch(/moved by 30\.0px/);
});

test("a page with something to press under Pipeup's button fails", async () => {
  const r = await check("check-overlap.html");
  expect(r.code).toBe(1);
  expect(
    r.results.find((x) => x.status === "fail" && /covers nothing you use/.test(x.what))!.detail,
  ).toContain("button");
});

test("Pipeup included twice is a failure, with the way to fix it", async () => {
  const r = await check("check-twice.html");
  expect(r.code).toBe(1);
  expect(r.results.find((x) => x.what === "Pipeup is included once")).toMatchObject({ status: "fail" });
});

test("styles on <html> that fade Pipeup are a warning, with the property named", async () => {
  const r = await check("check-fade.html");
  const w = r.results.find((x) => /looks right on this page/.test(x.what))!;
  expect(w.status).toBe("warn");
  expect(w.detail).toContain("opacity: 0.4");
});

test("a page that doesn't exist is said so in words", async () => {
  const bad = await run("node", [cli, "check", "/nonexistent/page.html"]).then(
    () => "",
    (e: { stderr: string; stdout: string }) => e.stderr + e.stdout,
  );
  expect(bad.length).toBeGreaterThan(0);
});
