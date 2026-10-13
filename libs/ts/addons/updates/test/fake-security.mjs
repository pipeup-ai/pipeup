// A stand-in for macOS's `security` command: keeps items in the JSON file named by FAKE_KEYCHAIN.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = process.env.FAKE_KEYCHAIN;
const items = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
const [cmd, ...rest] = process.argv.slice(2);
const get = (flag) => rest[rest.indexOf(flag) + 1];
const key = `${get("-s")}/${get("-a")}`;
if (cmd === "find-generic-password") {
  if (!(key in items)) process.exit(44);
  console.log(items[key]);
} else if (cmd === "add-generic-password") {
  items[key] = get("-w");
  writeFileSync(file, JSON.stringify(items));
} else process.exit(1);
