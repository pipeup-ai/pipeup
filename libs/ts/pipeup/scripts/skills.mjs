// Puts a copy of the agent skills inside the package, for `pipeup skills install` (their one source is apps/agent-skills).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const from = new URL("../../../../apps/agent-skills/", import.meta.url).pathname;
const to = new URL("../skills/", import.meta.url).pathname;
if (!existsSync(from)) process.exit(0); // building from a published package: they are already there
rmSync(to, { recursive: true, force: true });
for (const n of readdirSync(from).filter(
  (n) => n.startsWith("pipeup-") && existsSync(join(from, n, "SKILL.md")),
)) {
  mkdirSync(join(to, n), { recursive: true });
  cpSync(join(from, n, "SKILL.md"), join(to, n, "SKILL.md"));
}
