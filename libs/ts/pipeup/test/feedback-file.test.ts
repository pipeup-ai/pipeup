import { describe, expect, it } from "vitest";
import { createIdentity } from "../src/crypto/identity";
import { newDocumentAttribute, parseDocumentAttribute, seal } from "../src/crypto/seal";
import { OpLog } from "../src/model/log";
import { readFeedbackFile, writeFeedbackFile } from "../src/storage/feedback-file";

const ANCHOR = { path: "", fingerprint: "00000000", snapshot: "x" };

async function someOps(doc: string) {
  const me = await createIdentity();
  const log = new OpLog(doc);
  await log.append(me, "Kev", {
    kind: "create",
    text: "secret words",
    anchor: ANCHOR,
  });
  return log.all();
}

describe("feedback files", () => {
  it("seals ops for the document and reads them back", async () => {
    const doc = await parseDocumentAttribute(newDocumentAttribute());
    const ops = await someOps(doc.id);
    const json = await writeFeedbackFile(doc.id, ops, doc.key);
    expect(json).not.toContain("secret words");
    expect(JSON.parse(json)).toMatchObject({ pipeup: 1, doc: doc.id, sealed: true });
    expect(await readFeedbackFile(json, doc.id, doc.key)).toEqual(ops);
  });

  it("writes readable files when the page has no document key", async () => {
    const ops = await someOps("plain-doc");
    const json = await writeFeedbackFile("plain-doc", ops, null);
    expect(json).toContain("secret words");
    expect(await readFeedbackFile(json, "plain-doc", null)).toEqual(ops);
  });

  it("refuses files for another document, sealed files without a key, and junk", async () => {
    const doc = await parseDocumentAttribute(newDocumentAttribute());
    const json = await writeFeedbackFile(doc.id, await someOps(doc.id), doc.key);
    await expect(readFeedbackFile(json, "other", doc.key)).rejects.toThrow(/different document/);
    await expect(readFeedbackFile(json, doc.id, null)).rejects.toThrow(/sealed/);
    await expect(readFeedbackFile("not json", doc.id, doc.key)).rejects.toThrow(
      /not an Pipeup feedback file/,
    );
    await expect(readFeedbackFile('{"pipeup":2}', doc.id, doc.key)).rejects.toThrow(
      /not an Pipeup feedback file/,
    );
  });

  it("refuses a sealed file opened with another document's key", async () => {
    const doc = await parseDocumentAttribute(newDocumentAttribute());
    const other = await parseDocumentAttribute(newDocumentAttribute());
    const json = await writeFeedbackFile(doc.id, await someOps(doc.id), doc.key);
    await expect(readFeedbackFile(json, doc.id, other.key)).rejects.toThrow(/could not be opened/);
  });

  it("refuses a sealed file whose plaintext is not JSON", async () => {
    const doc = await parseDocumentAttribute(newDocumentAttribute());
    const context = `pipeup-file:${doc.id}`;
    const sealed = await seal(doc.key, "not json", context);
    const file = { pipeup: 1, doc: doc.id, sealed: true, ...sealed };
    const json = JSON.stringify(file);
    await expect(readFeedbackFile(json, doc.id, doc.key)).rejects.toThrow(/not an Pipeup feedback file/);
  });
});
