#!/usr/bin/env node
// Exits 0 when version A is newer than version B by semver precedence, 1 otherwise.
//   node tools/version-newer.mjs 0.4.0-beta.1 0.3.2   → 0 (newer)
//   node tools/version-newer.mjs 0.4.0-beta.3 0.4.0   → 1 (a pre-release comes before its release)
const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error("usage: version-newer.mjs A B");
  process.exit(2);
}

function parse(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v);
  if (!m) {
    console.error(`not a version: ${v}`);
    process.exit(2);
  }
  return { core: m.slice(1, 4).map(Number), pre: m[4] ? m[4].split(".") : [] };
}

function compare(x, y) {
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] - y.core[i];
  if (!x.pre.length || !y.pre.length) return y.pre.length - x.pre.length; // a release beats its pre-releases
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
    if (pn && qn && +p !== +q) return +p - +q;
    if (pn !== qn) return pn ? -1 : 1;
    if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}

process.exit(compare(parse(a), parse(b)) > 0 ? 0 : 1);
