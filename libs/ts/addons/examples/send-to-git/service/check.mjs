// Checks that a service follows the contract in ../README.md, and says in words what it found.
//
//   node service/check.mjs https://reviews.example.com/reviews [--header "x-company-user: sam"] [--origin https://pages.example.com]
const args = process.argv.slice(2);
const url = args.find((a) => /^https?:/.test(a));
if (!url) {
  console.error(
    'Usage: node service/check.mjs <service address> [--header "name: value"] [--origin <page address>]',
  );
  process.exit(2);
}
const take = (flag) => args.flatMap((a, i) => (a === flag ? [args[i + 1]] : []));
const headers = Object.fromEntries(
  take("--header").map((h) => [h.split(":")[0].trim().toLowerCase(), h.split(":").slice(1).join(":").trim()]),
);
const origin = take("--origin")[0] ?? "http://localhost:8789";
let bad = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const no = (m) => {
  console.log(`  FAIL  ${m}`);
  bad++;
};
/** One check: says `good` when it holds, else `bad`. */
const check = (holds, good, bad) => (holds ? ok(good) : no(bad));
const post = (body, extra = {}) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin, ...headers, ...extra },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const sample = {
  title: "Contract check",
  url: "https://pages.example.com/launch-plan.html",
  exportedAt: new Date().toISOString(),
  openThreads: 1,
  markdown: "# Review comments: Contract check\n\n- Sam: Is this date firm?\n",
};

console.log(`Checking ${url}`);
try {
  const pre = await fetch(url, {
    method: "OPTIONS",
    headers: {
      origin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type",
    },
  });
  check(
    pre.status === 204 || pre.status === 200,
    "answers the browser's check (OPTIONS)",
    `OPTIONS answered ${pre.status}, it should answer 204`,
  );
  const allowed = pre.headers.get("access-control-allow-origin");
  check(
    allowed === origin,
    "allows the page's address",
    `access-control-allow-origin was "${allowed}", it should be ${origin}`,
  );

  const res = await post(sample);
  const out = await res.json().catch(() => ({}));
  check(
    res.status === 201 && typeof out.path === "string" && Boolean(out.commit || out.pr),
    `saved a review as ${out.path}${out.commit ? ` (commit ${String(out.commit).slice(0, 7)})` : ""}`,
    `a good review answered ${res.status} ${JSON.stringify(out)}; it should answer 201 with a path and a commit or pull request`,
  );
  check(
    /^reviews\/[a-z0-9-]+\/.+\.md$/.test(out.path ?? ""),
    "chose the file's path itself, under reviews/",
    `the path "${out.path}" isn't reviews/<page>/<name>.md`,
  );

  const bye = await post("not json");
  check(
    bye.status === 400,
    "refuses a request that isn't JSON (400)",
    `a bad request answered ${bye.status}, it should answer 400`,
  );
  const big = await post({ ...sample, markdown: "x".repeat(300_000) });
  check(
    big.status === 413,
    "refuses a review that is too large (413)",
    `an oversized review answered ${big.status}, it should answer 413`,
  );
  const sneaky = await post({ ...sample, path: "../../etc/passwd" });
  const s = await sneaky.json().catch(() => ({}));
  check(
    !String(s.path ?? "").includes(".."),
    "ignores a path in the request",
    "it used a path from the request; it must choose the path itself",
  );
  if (Object.keys(headers).length) {
    const anon = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify(sample),
    });
    check(
      anon.status === 401,
      "refuses someone who isn't signed in (401)",
      `an unsigned request answered ${anon.status}, it should answer 401`,
    );
  }
} catch (e) {
  no(`couldn't reach the service: ${e.message}`);
}
console.log(bad ? `\n${bad} thing${bad === 1 ? "" : "s"} to fix.` : "\nThis service follows the contract.");
process.exit(bad ? 1 : 0);
