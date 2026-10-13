// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { githubName, issueUrl, repoOf } from "../src/addon";

describe("the GitHub names", () => {
  it("come from a supplied gh: person, or from a writer who shared one as how to reach them", () => {
    const key = "K".repeat(43);
    const contacts = new Map([
      [key, "gh:octocat"],
      ["L".repeat(43), "lee@example.test"],
    ]);
    expect(githubName("gh:hubot", contacts)).toBe("hubot");
    expect(githubName(key, contacts)).toBe("octocat");
    expect(githubName("L".repeat(43), contacts)).toBeNull();
    expect(githubName("host:ada", contacts)).toBeNull();
    expect(githubName("gh:not a name", contacts)).toBeNull();
  });
});

describe("the repository", () => {
  it("is the page's owner/repo, and nothing else", () => {
    const html = document.createElement("html");
    html.setAttribute("data-pipeup-github-repo", "pipeup-ai/pipeup");
    expect(repoOf(html)).toBe("pipeup-ai/pipeup");
    for (const bad of ["", "no-slash", "a/b/c", "https://evil.test/x", "a b/c", "../x"]) {
      html.setAttribute("data-pipeup-github-repo", bad);
      expect(repoOf(html)).toBe("");
    }
  });
});

describe("the new-issue address", () => {
  it("carries the @names, the words as a quote, and the page, all escaped", () => {
    const url = issueUrl(
      "pipeup-ai/pipeup",
      ["octocat", "hubot"],
      "Sam",
      "Is this ok?\nPlease check",
      "Q3 plan",
      "https://x.test/p",
    );
    expect(url.startsWith("https://github.com/pipeup-ai/pipeup/issues/new?title=")).toBe(true);
    const body = decodeURIComponent(url.split("&body=")[1]!);
    expect(body).toContain("@octocat @hubot");
    expect(body).toContain("> Is this ok?\n> Please check");
    expect(body).toContain("https://x.test/p");
    expect(url).not.toMatch(/[<> "]/);
  });
});
