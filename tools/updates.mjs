// The update list's format, signing and checking, shared by make-updates.mjs, sign-updates.mjs and the tests.
// The list (updates.json) says which Pipeup is latest and which advisories exist; it is signed by the maintainer so the
// `updates` add-on and `pipeup check` can tell it from a forgery. See docs/design/update-notices.md.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";

/** JSON with sorted keys and undefined fields dropped: the same value always signs the same way (as the core does for ops). */
export function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
    .join(",")}}`;
}

/** What is signed: the whole file except its signature. */
export const payload = (file) => {
  const { sig: _sig, ...rest } = file;
  return Buffer.from(canonical(rest), "utf8");
};

const b64u = (b) => Buffer.from(b).toString("base64url");

/** A new Ed25519 key: the private key (PKCS #8, base64) to keep, and the public key (base64url) to publish. */
export function newKey() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" });
  return { privateKey: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"), publicKey: jwk.x };
}

/** The public key (base64url) of a stored private key. */
export function publicOf(privateB64) {
  const key = createPrivateKey({ key: Buffer.from(privateB64, "base64"), format: "der", type: "pkcs8" });
  return createPublicKey(key).export({ format: "jwk" }).x;
}

/** Signs a list with a key, naming the key, and returns the list with `sig` set. */
export function signList(file, privateB64, id) {
  const key = createPrivateKey({ key: Buffer.from(privateB64, "base64"), format: "der", type: "pkcs8" });
  return { ...file, sig: { key: id, value: b64u(sign(null, payload(file), key)) } };
}

/** Whether a list was signed by one of `keys` ([{ id, key }]) and has not expired at `now`: true, or the reason it isn't. */
export function checkList(file, keys, now = Date.now()) {
  const known = keys.find((k) => k.id === file?.sig?.key);
  if (!known) return "it names a key this program does not know";
  const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(known.key, "base64url")]);
  const ok = verify(null, payload(file), createPublicKey({ key: spki, format: "der", type: "spki" }), Buffer.from(file.sig.value, "base64url"));
  if (!ok) return "its signature does not match";
  if (!(Date.parse(file.expires) > now)) return "it has expired";
  return true;
}

export const sha384 = (bytes) => `sha384-${createHash("sha384").update(bytes).digest("base64")}`;
