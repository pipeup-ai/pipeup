#!/usr/bin/env node
// Signs the update list with a key kept in the macOS Keychain, so no secret lives in the repository or in CI.
//
//   node tools/sign-updates.mjs init [--id k1]      make a key, keep it in the Keychain, print its public half
//   node tools/sign-updates.mjs sign [--in FILE]    sign the list (asks for your password or Touch ID)
//   node tools/sign-updates.mjs verify [--in FILE]  check the signature and expiry against tools/updates-keys.json
//   node tools/sign-updates.mjs export [--id k1] --yes   print the private key once, to back it up
//
// The Keychain item lets no application in without asking. PIPEUP_SECURITY overrides the `security` command (tests).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { checkList, newKey, publicOf, signList } from "./updates.mjs";

const root = new URL("..", import.meta.url).pathname;
const SERVICE = "pipeup-updates-signing";
const security = process.env.PIPEUP_SECURITY || "security";
const flag = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? (process.argv[i + 1]?.startsWith("--") ? true : (process.argv[i + 1] ?? true)) : undefined;
};
const id = typeof flag("id") === "string" ? flag("id") : "k1";
const file = typeof flag("in") === "string" ? flag("in") : `${root}apps/site/updates.json`;
const keysFile = process.env.PIPEUP_UPDATE_KEYS || `${root}tools/updates-keys.json`;
const fail = (m) => (console.error(`sign-updates: ${m}`), process.exit(1));

const read = () => {
  try {
    return execFileSync(security, ["find-generic-password", "-s", SERVICE, "-a", id, "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};

const command = process.argv[2];
if (command === "init") {
  if (read() !== null) fail(`a key "${id}" is already in the Keychain; it is never overwritten`);
  const { privateKey, publicKey } = newKey();
  // -T "" : no application is pre-approved, so every use asks for your password or Touch ID.
  execFileSync(security, ["add-generic-password", "-s", SERVICE, "-a", id, "-w", privateKey, "-T", ""]);
  console.log(`Made key "${id}" in your Keychain.\nPublic key (add it to tools/updates-keys.json as { "id": "${id}", "key": "${publicKey}" }, with a standby key you keep elsewhere):\n${publicKey}`);
} else if (command === "sign") {
  const priv = read();
  if (priv === null) fail(`no key "${id}" in the Keychain: run init first`);
  const list = JSON.parse(readFileSync(file, "utf8"));
  const signed = signList(list, priv, id);
  const keys = JSON.parse(readFileSync(keysFile, "utf8"));
  const mine = publicOf(priv);
  if (!keys.some((k) => k.id === id && k.key === mine)) fail(`the public half of "${id}" is not in ${keysFile}: add it, then sign`);
  const ok = checkList(signed, keys);
  if (ok !== true) fail(`the signed list does not check out: ${ok}`);
  writeFileSync(file, `${JSON.stringify(signed, null, 2)}\n`);
  console.log(`signed ${file} with "${id}"; expires ${signed.expires.slice(0, 10)}`);
} else if (command === "verify") {
  const ok = checkList(JSON.parse(readFileSync(file, "utf8")), JSON.parse(readFileSync(keysFile, "utf8")));
  if (ok !== true) fail(ok);
  console.log("ok: signed by a known key and not expired");
} else if (command === "export") {
  if (flag("yes") !== true) fail("this prints the private key; add --yes if you mean to");
  const priv = read();
  if (priv === null) fail(`no key "${id}" in the Keychain`);
  console.log(priv);
} else {
  console.log("usage: node tools/sign-updates.mjs init|sign|verify|export (see the top of this file)");
  process.exit(command ? 1 : 0);
}
