// The Apple developer team that signs Safari's app: APPLE_TEAM_ID in the environment, or in .env.local at the
// repository's root (git ignores it). Xcode → Settings → Accounts shows the team's id.
import { existsSync, readFileSync } from "node:fs";

export function teamId(root) {
  if (process.env.APPLE_TEAM_ID) return process.env.APPLE_TEAM_ID;
  const local = `${root}.env.local`;
  if (!existsSync(local)) return "";
  const line = readFileSync(local, "utf8")
    .split("\n")
    .find((l) => /^\s*APPLE_TEAM_ID\s*=/.test(l));
  return line
    ? line
        .split("=")[1]
        .trim()
        .replace(/^["']|["']$/g, "")
    : "";
}
