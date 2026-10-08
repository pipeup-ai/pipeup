// Prints three pairs of links for the S2 two-device test: open `a` on one device and `b` on the other, both with
// the same key (it is in the link's #fragment, so the Worker never sees it). Run it once per network setup:
// the phone on mobile data, then on the same Wi-Fi as the Mac.   node examples/phone-test/links.mjs https://<worker>
import { randomBytes } from "node:crypto";

const origin = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https:\/\//.test(origin)) {
  console.error(
    "usage: node examples/phone-test/links.mjs https://pipeup-s2-spike.<your-subdomain>.workers.dev",
  );
  process.exit(2);
}
for (const run of ["run1", "run2", "run3"]) {
  const key = randomBytes(16).toString("hex");
  console.log(
    `${run}\n  a (this Mac)  ${origin}/a#k=${key}&run=${run}\n  b (the phone) ${origin}/b#k=${key}&run=${run}\n`,
  );
}
console.log(
  "Each page says 'Connected directly' or 'Couldn't connect directly'; the results also show in `wrangler tail`.",
);
