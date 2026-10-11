import { describe, expect, it } from "vitest";
import { filePath, MAX_ADDRESS, newFileUrl, parseTarget, readTarget } from "../src/addon";

describe("what the page names", () => {
  it("takes owner/name, with a branch, a folder and a host if given", () => {
    expect(parseTarget("your-org/reviews")).toEqual({
      repo: "your-org/reviews",
      branch: "main",
      folder: "reviews",
      host: "github.com",
    });
    expect(parseTarget("a/b", "docs", "/feedback/", "git.example.com")).toEqual({
      repo: "a/b",
      branch: "docs",
      folder: "feedback",
      host: "git.example.com",
    });
  });

  it("refuses anything that isn't a repository, a branch, a folder or a host", () => {
    for (const bad of ["reviews", "a/b/c", "a b/c", "https://github.com/a/b", ""])
      expect(parseTarget(bad)).toHaveProperty("error");
    expect(parseTarget("a/b", "../x")).toHaveProperty("error");
    expect(parseTarget("a/b", null, "../../etc")).toHaveProperty("error");
    expect(parseTarget("a/b", null, null, "evil.com/x?y")).toHaveProperty("error");
  });

  it("reads the page's attributes, with demo: for the try page and an error when there is no repository", () => {
    const attrs: Record<string, string> = { "data-pipeup-save-to-github": "demo:" };
    expect(readTarget((n) => attrs[n] ?? null)).toEqual({ demo: true });
    expect(readTarget(() => null)).toEqual({ error: "this page names no repository to save to" });
  });
});

describe("the file, and GitHub's page", () => {
  const at = new Date("2026-10-10T09:30:05Z");
  it("is named from the page, the time and the reviewer", () => {
    expect(filePath("reviews", "https://pages.example.com/plans/launch-plan.html", "Q3", "Sam Lee", at)).toBe(
      "reviews/launch-plan/20261010-093005-sam-lee.md",
    );
    expect(filePath("notes", "nonsense", "Q3: Plan!", "", at)).toBe(
      "notes/q3-plan/20261010-093005-reviewer.md",
    );
  });

  it("opens GitHub's new-file page with the name and the content filled in, when it fits", () => {
    const t = parseTarget("your-org/reviews", "feature/x") as never;
    const { url, filled } = newFileUrl(
      t,
      "reviews/launch-plan/a.md",
      "# Review\n\n- Sam: Is this date firm?\n",
    );
    expect(filled).toBe(true);
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://github.com/your-org/reviews/new/feature/x");
    expect(u.searchParams.get("filename")).toBe("reviews/launch-plan/a.md");
    expect(u.searchParams.get("value")).toBe("# Review\n\n- Sam: Is this date firm?\n");
  });

  it("leaves the content out, and says so, when it is too long for an address", () => {
    const t = parseTarget("o/r", null, null, "git.example.com") as never;
    const { url, filled } = newFileUrl(t, "reviews/a/b.md", "x".repeat(MAX_ADDRESS));
    expect(filled).toBe(false);
    expect(url).toMatch(/^https:\/\/git\.example\.com\/o\/r\/new\/main\?filename=/);
    expect(url).not.toContain("value=");
  });
});
